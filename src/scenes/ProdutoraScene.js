// ---------- Cena da produtora: botão INICIAR + vídeo institucional ----------
// É a PRIMEIRA cena do jogo. O botão "INICIAR" aparece ANTES de tudo, com o vídeo já
// parado atrás dele. Esse clique é um gesto real do usuário — o único jeito de um
// navegador liberar de verdade tela cheia e som tocando sozinho — então é nele que a
// gente pede tela cheia, trava a orientação e só então bota o vídeo pra tocar. Assim a
// tela já fica cheia desde o início do vídeo da produtora, não só depois dele.
// Quando o vídeo termina, segue direto pra IntroScene (sem precisar de um segundo
// clique — a tela cheia já foi concedida lá no primeiro).

class ProdutoraScene extends Phaser.Scene {
    constructor() {
        super('ProdutoraScene');
    }

    preload() {
        Carregando.acompanhar(this, 'Carregando...');
        this.load.video('videoProdutora', 'assets/video/produtora.mp4');
        this.load.image('fundoMenu', 'assets/images/menu_bg.webp');
    }

    create() {
        this.transicaoEmAndamento = false;

        // papel de parede do menu já no fundo desde a primeira tela (o "INICIAR"), em vez
        // de um preto liso — um leve escurecido por cima só pra tampinha/texto se destacarem
        this.add.image(480, 270, 'fundoMenu').setDisplaySize(960, 540);
        this.add.rectangle(480, 270, 960, 540, 0x000000, 0.4);

        // vídeo criado mas parado — só começa a tocar depois do clique em "INICIAR"
        this.video = this.add.video(480, 270, 'videoProdutora');

        this.video.on('created', () => {
            const vw = this.video.video.videoWidth;
            const vh = this.video.video.videoHeight;
            const escala = Math.min(960 / vw, 540 / vh);
            this.video.setDisplaySize(vw * escala, vh * escala);
            this.video.setPosition(480, 270);

            // sem isso, o Android puxa o player nativo de vídeo em tela cheia sozinho assim
            // que o .play() roda — e isso briga com o requestFullscreen() do próprio jogo
            // (às vezes fazendo ele ser recusado silenciosamente). playsinline mantém o
            // vídeo dentro do canvas, deixando a tela cheia real por conta só do jogo.
            const elVideo = this.video.video;
            elVideo.setAttribute('playsinline', '');
            elVideo.setAttribute('webkit-playsinline', '');
            elVideo.playsInline = true;
        });

        this.video.once('complete', () => this.iniciarJogo());

        // botão "INICIAR" logo de cara, antes do vídeo rodar
        this.mostrarBotaoIniciar();
    }

    // pede tela cheia de verdade (cobre até a barra de endereço do Chrome), usando o
    // Phaser como primeira opção e caindo pro Fullscreen API nativo direto no <html> se
    // o wrapper do Phaser não estiver disponível por algum motivo — assim a chance de
    // funcionar é maior em mais navegadores/dispositivos diferentes
    pedirTelaCheia() {
        if (this.scale.isFullscreen) return;

        const confirmar = () => {
            this.time.delayedCall(300, () => {
                if (!this.scale.isFullscreen && !document.fullscreenElement) {
                    console.warn('[Corrida de Tampinhas] Tela cheia não foi concedida pelo navegador. ' +
                        'Isso costuma acontecer quando o jogo está dentro de um iframe sem allow="fullscreen" ' +
                        '(ex.: em algumas plataformas de preview/embed) — fora desse caso, num navegador ' +
                        'aberto direto (Chrome/Android, por ex.) a tela cheia real é concedida nesse clique. ' +
                        'No iOS Safari o próprio sistema não permite site nenhum esconder a barra do navegador ' +
                        '— só funciona depois de "Adicionar à Tela de Início" e abrir pelo ícone.');
                }
            });
        };

        if (this.scale.fullscreen.available) {
            try {
                this.scale.startFullscreen();
                confirmar();
                return;
            } catch (e) {
                console.warn('[Corrida de Tampinhas] Erro ao pedir tela cheia via Phaser:', e);
            }
        }

        // fallback: Fullscreen API nativo, direto no documento inteiro
        const el = document.documentElement;
        const pedir = el.requestFullscreen || el.webkitRequestFullscreen || el.msRequestFullscreen;
        if (pedir) {
            try {
                pedir.call(el);
                confirmar();
            } catch (e) {
                console.warn('[Corrida de Tampinhas] Erro ao pedir tela cheia nativa:', e);
            }
        }
    }

    // best-effort: nem todo navegador expõe/permite essa API (ex.: Safari iOS não tem);
    // por isso o try/catch e o .catch() na Promise — sem eles, um navegador que recusa
    // pararia a execução do resto do jogo com um erro no console
    travarPaisagem() {
        try {
            if (screen.orientation && screen.orientation.lock) {
                screen.orientation.lock('landscape').catch(() => {});
            }
        } catch (e) { /* API indisponível nesse navegador — a rotação via CSS já resolve */ }
    }

    // o botão "INICIAR" agora É uma tampinha girando (a mesma arte usada no resto do
    // jogo, na cor da marca escolhida/padrão) — o texto fica fixo por cima, só a
    // tampinha roda por baixo dele
    mostrarBotaoIniciar() {
        const marcaAtual = MARCAS_DISPONIVEIS.find(m => m.nome === JogoState.marcaJogador) || MARCAS_DISPONIVEIS[0];
        const chaveTampinha = criarTexturaTampinha(this, marcaAtual);

        const tampinha = this.add.image(0, 0, chaveTampinha).setScale(2.7);

        const rotulo = this.add.text(0, 0, 'INICIAR', {
            fontSize: '19px',
            fontFamily: (typeof FONTE_TITULO !== 'undefined' ? FONTE_TITULO : 'Arial'),
            fontStyle: '700',
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 5
        }).setOrigin(0.5);

        const botao = this.add.container(480, 270, [tampinha, rotulo]).setAlpha(0);
        botao.setSize(190, 190);
        botao.setInteractive({ useHandCursor: true });

        // giro contínuo — a tampinha nunca para de rodar enquanto o jogador não clica
        let tweenGiro = this.tweens.add({
            targets: tampinha,
            angle: 360,
            duration: 3500,
            repeat: -1
        });

        botao.on('pointerover', () => {
            if (this.transicaoEmAndamento) return;
            if (tweenGiro) tweenGiro.stop();
            tweenGiro = this.tweens.add({
                targets: tampinha,
                angle: tampinha.angle + 360,
                duration: 900,
                repeat: -1
            });
            this.tweens.add({ targets: botao, scale: 1.06, duration: 150 });
        });

        botao.on('pointerout', () => {
            if (this.transicaoEmAndamento) return;
            if (tweenGiro) tweenGiro.stop();
            tweenGiro = this.tweens.add({
                targets: tampinha,
                angle: tampinha.angle + 360,
                duration: 3500,
                repeat: -1
            });
            this.tweens.add({ targets: botao, scale: 1, duration: 150 });
        });

        botao.on('pointerdown', () => {
            if (this.transicaoEmAndamento) return;
            this.transicaoEmAndamento = true;
            if (tweenGiro) tweenGiro.stop();
            botao.disableInteractive();
            this.comecarVideo(botao, tampinha);
        });

        this.botaoIniciar = botao;
        this.tweens.add({ targets: botao, alpha: 1, duration: 400 });
    }

    // esse clique é o primeiro (e único) gesto real do usuário na página — é aqui que o
    // navegador libera tela cheia de verdade e som tocando sozinho (e é por isso que a
    // tela cheia + o travamento em paisagem acontecem exatamente aqui, dentro do clique)
    comecarVideo(botao, tampinha) {
        this.pedirTelaCheia();
        this.travarPaisagem();

        SomFX.iniciar();
        SomFX.peteleco();

        // peteleco final: a tampinha dá um giro rápido antes de tudo desaparecer
        this.tweens.add({
            targets: tampinha,
            angle: tampinha.angle + 720,
            duration: 320,
            ease: 'cubic.out'
        });

        this.tweens.add({
            targets: botao,
            alpha: 0,
            scale: 0.9,
            duration: 300,
            delay: 100,
            onComplete: () => botao.destroy()
        });

        // vídeo tocando com som, já em tela cheia
        this.video.setMute(false);
        this.video.play(false);

        // segurança: se o vídeo não disparar 'complete' por algum motivo, segue o jogo
        // de qualquer jeito depois de um tempo, pra nunca travar o jogador aqui
        this.time.delayedCall(15000, () => this.iniciarJogo());
    }

    iniciarJogo() {
        if (this.transicaoParaJogoFeita) return;
        this.transicaoParaJogoFeita = true;

        this.time.delayedCall(150, () => {
            this.cameras.main.fadeOut(300, 0, 0, 0);
        });

        this.cameras.main.once('camerafadeoutcomplete', () => {
            this.scene.start('IntroScene');
        });
    }
}
