// ---------- Cena de abertura: vídeo de introdução + menu revelado no final ----------
// O vídeo toca mudo (a trilha de fundo é a música do menu, tocando desde já) e, quando
// termina, fica pausado no último quadro — o menu (sem o título "Corrida de Tampinhas",
// já que o vídeo mostra isso) aparece em cima dessa imagem parada, não troca de fundo.
//
// O áudio já foi desbloqueado antes, no clique do botão INICIAR da ProdutoraScene — por
// isso a música começa a tocar direto aqui, sem precisar de nenhum toque na tela.

class IntroScene extends Phaser.Scene {
    constructor() {
        super('IntroScene');
    }

    preload() {
        Carregando.acompanhar(this, 'Carregando...');
        this.load.audio('musica_menu', 'assets/audio/musica_menu.mp3');
        this.load.video('videoIntro', 'assets/video/intro.mp4');
    }

    create() {
        criarBotaoTelaCheia(this);
        this.transicaoEmAndamento = false;
        this.menuRevelado = false;

        // música do menu já começa a tocar junto com o vídeo (o vídeo em si é mudo)
        tocarMusicaDeFundo(this, 'musica_menu', 0.35);
        this.agendarSomAmbiente();

        this.add.rectangle(480, 270, 960, 540, 0x000000, 1);

        // vídeo no tamanho normal dele, sem cortar nada — sem áudio
        this.video = this.add.video(480, 270, 'videoIntro');
        this.video.setMute(true);
        // o jogo agora É 960x540 (16:9), igual ao vídeo — cobre a tela exatamente,
        // sem cortar nada e sem sobrar faixa preta nenhuma
        this.video.setDisplaySize(960, 540);
        this.video.play(false);

this.video.on('created', () => {
    const vw = this.video.video.videoWidth;
    const vh = this.video.video.videoHeight;
    const escala = Math.min(960 / vw, 540 / vh);
    this.video.setDisplaySize(vw * escala, vh * escala);
    this.video.setPosition(480, 270);
});

        // dica discreta pra pular, e deixa a tela toda tocável pra pular também
        const dicaPular = this.add.text(480, 513, 'toque para pular', {
            fontSize: '14px',
            fontFamily: 'Arial',
            color: '#ffffff',
            backgroundColor: '#00000066',
            padding: { x: 10, y: 4 }
        }).setOrigin(0.5).setAlpha(0.8);
        this.tweens.add({ targets: dicaPular, alpha: 0.3, duration: 900, yoyo: true, repeat: -1 });

        const zonaPular = this.add.rectangle(480, 270, 960, 540, 0xffffff, 0).setInteractive();
        zonaPular.on('pointerdown', () => this.revelarMenu());
        this.zonaPular = zonaPular;
        this.dicaPular = dicaPular;

        this.video.once('complete', () => this.revelarMenu());

        this.events.once('shutdown', () => {
            if (this.timerPassarinho) this.timerPassarinho.remove();
        });
    }

    agendarSomAmbiente() {
        const proximoPassarinho = () => {
            SomFX.passarinho();
            this.timerPassarinho = this.time.delayedCall(Phaser.Math.Between(2500, 5500), proximoPassarinho);
        };
        this.timerPassarinho = this.time.delayedCall(Phaser.Math.Between(1200, 2500), proximoPassarinho);
    }

    // congela o vídeo no quadro atual (pausado, não escondido) e revela o menu por cima
    revelarMenu() {
        if (this.menuRevelado) return;
        this.menuRevelado = true;

        this.video.pause(); // fica parado no último quadro — é o "fundo" do menu agora

        if (this.zonaPular) { this.zonaPular.destroy(); this.zonaPular = null; }
        if (this.dicaPular) { this.dicaPular.destroy(); this.dicaPular = null; }

        // painel semi-transparente por trás do menu, só pra garantir contraste com o vídeo parado
        this.add.rectangle(480, 270, 960, 540, 0x000000, 0.22);

        // tampinha decorativa: usa a marca já escolhida pelo jogador (ou a padrão)
        const marcaAtual = MARCAS_DISPONIVEIS.find(m => m.nome === JogoState.marcaJogador) || MARCAS_DISPONIVEIS[0];
        const chaveTampinha = criarTexturaTampinha(this, marcaAtual);
        this.tampinhaDecor = this.add.image(480, 234, chaveTampinha).setScale(1.3).setAlpha(0);

        this.tweenGiroTampinha = this.tweens.add({
            targets: this.tampinhaDecor,
            angle: 360,
            duration: 4000,
            repeat: -1
        });

        this.criarBotaoComecar(480, 360);

        const frase = Phaser.Utils.Array.GetRandom(FRASES_RODAPE);
        this.textoRodape = this.add.text(480, 500, frase, {
            fontSize: '14px',
            fontFamily: FONTE_TITULO,
            fontStyle: 'italic',
            color: '#e8e2d5'
        }).setOrigin(0.5).setAlpha(0);

        // um fade suave dos elementos do menu surgindo por cima do vídeo parado
        this.tweens.add({
            targets: [this.tampinhaDecor, this.botaoComecar, this.textoRodape],
            alpha: 1,
            duration: 500
        });
    }

    criarBotaoComecar(x, y) {
        const largura = 220;
        const altura = 58;

        const placa = this.add.graphics();
        placa.fillStyle(0x8b5a2b, 1);
        placa.fillRoundedRect(-largura / 2, -altura / 2, largura, altura, 10);
        placa.lineStyle(3, 0x5b3a1f, 1);
        placa.strokeRoundedRect(-largura / 2, -altura / 2, largura, altura, 10);
        placa.lineStyle(1, 0x5b3a1f, 0.35);
        placa.lineBetween(-largura / 2 + 10, -8, largura / 2 - 10, -4);
        placa.lineBetween(-largura / 2 + 10, 10, largura / 2 - 10, 14);
        placa.fillStyle(0x3a2413, 1);
        [[-largura / 2 + 12, -altura / 2 + 10], [largura / 2 - 12, -altura / 2 + 10],
         [-largura / 2 + 12, altura / 2 - 10], [largura / 2 - 12, altura / 2 - 10]].forEach(([px, py]) => {
            placa.fillCircle(px, py, 2.5);
        });

        const rotulo = this.add.text(0, 0, '▶  COMEÇAR', {
            fontSize: '26px',
            fontFamily: FONTE_TITULO,
            fontStyle: '600',
            color: '#fff3e0'
        }).setOrigin(0.5);

        const botao = this.add.container(x, y, [placa, rotulo]).setAlpha(0);
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
            this.iniciarTransicaoParaSelecao(botao);
        });

        this.botaoComecar = botao;
    }

    iniciarTransicaoParaSelecao(botao) {
        SomFX.peteleco();

        this.tweens.add({ targets: botao, scale: 0.94, duration: 90, yoyo: true });

        if (this.tweenGiroTampinha) this.tweenGiroTampinha.stop();

        this.tweens.add({
            targets: this.tampinhaDecor,
            angle: this.tampinhaDecor.angle + 720,
            scale: 1.5,
            duration: 320,
            ease: 'cubic.out',
            onComplete: () => {
                this.tweens.add({ targets: this.tampinhaDecor, x: 1080, duration: 260, ease: 'cubic.in' });
            }
        });

        this.time.delayedCall(300, () => {
            this.cameras.main.fadeOut(300, 0, 0, 0);
        });

        this.cameras.main.once('camerafadeoutcomplete', () => {
            this.scene.start('SelecaoScene');
        });
    }
}
