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
    }

    create() {
        this.transicaoEmAndamento = false;

        this.add.rectangle(480, 270, 960, 540, 0x000000, 1);

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

    mostrarBotaoIniciar() {
        const largura = 220;
        const altura = 58;

        const placa = this.add.graphics();
        placa.fillStyle(0x000000, 1);
        placa.fillRoundedRect(-largura / 2, -altura / 2, largura, altura, 10);
        placa.lineStyle(3, 0xffffff, 1);
        placa.strokeRoundedRect(-largura / 2, -altura / 2, largura, altura, 10);
        placa.lineStyle(1, 0xffffff, 0.25);
        placa.lineBetween(-largura / 2 + 10, -8, largura / 2 - 10, -4);
        placa.lineBetween(-largura / 2 + 10, 10, largura / 2 - 10, 14);
        placa.fillStyle(0xffffff, 1);
        [[-largura / 2 + 12, -altura / 2 + 10], [largura / 2 - 12, -altura / 2 + 10],
         [-largura / 2 + 12, altura / 2 - 10], [largura / 2 - 12, altura / 2 - 10]].forEach(([px, py]) => {
            placa.fillCircle(px, py, 2.5);
        });

        const rotulo = this.add.text(0, 0, '▶  INICIAR', {
            fontSize: '26px',
            fontFamily: (typeof FONTE_TITULO !== 'undefined' ? FONTE_TITULO : 'Arial'),
            fontStyle: '600',
            color: '#ffffff'
        }).setOrigin(0.5);

        const botao = this.add.container(480, 270, [placa, rotulo]).setAlpha(0);
        botao.setSize(largura, altura);
        botao.setInteractive({ useHandCursor: true });

        let tweenBalanco = null;

        botao.on('pointerover', () => {
            if (this.transicaoEmAndamento) return;
            tweenBalanco = this.tweens.add({
                targets: botao,
                angle: { from: -2.5, to: 2.5 },
                duration: 220,
                yoyo: true,
                repeat: -1,
                ease: 'sine.inOut'
            });
        });

        botao.on('pointerout', () => {
            if (tweenBalanco) { tweenBalanco.stop(); tweenBalanco = null; }
            this.tweens.add({ targets: botao, angle: 0, duration: 120 });
        });

        botao.on('pointerdown', () => {
            if (this.transicaoEmAndamento) return;
            this.transicaoEmAndamento = true;
            if (tweenBalanco) { tweenBalanco.stop(); tweenBalanco = null; }
            botao.disableInteractive();
            this.comecarVideo(botao);
        });

        this.botaoIniciar = botao;
        this.tweens.add({ targets: botao, alpha: 1, duration: 400 });
    }

    // esse clique é o primeiro (e único) gesto real do usuário na página — é aqui que o
    // navegador libera tela cheia de verdade e som tocando sozinho
    comecarVideo(botao) {
        if (this.scale.fullscreen.available && !this.scale.isFullscreen) {
            try {
                this.scale.startFullscreen();
                // dá pra checar depois se o navegador realmente aceitou, sem quebrar nada
                // se ele recusar (ex.: fora de HTTPS, ou dentro de um iframe sem permissão)
                this.time.delayedCall(300, () => {
                    if (!this.scale.isFullscreen) {
                        console.warn('[Corrida de Tampinhas] Tela cheia não foi concedida pelo navegador. ' +
                            'Cheque se o jogo está rodando em HTTPS (ou localhost) e fora de um iframe sem allow="fullscreen".');
                    }
                });
            } catch (e) {
                console.warn('[Corrida de Tampinhas] Erro ao pedir tela cheia:', e);
            }
        }
        this.travarPaisagem();

        SomFX.iniciar();
        SomFX.peteleco();

        this.tweens.add({
            targets: botao,
            alpha: 0,
            scale: 0.94,
            duration: 250,
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
