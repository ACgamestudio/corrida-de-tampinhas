// ---------- Cena da produtora: vídeo institucional + botão INICIAR ----------
// É a PRIMEIRA cena do jogo. Não tem mais botão "ASSISTIR": assim que a cena começa,
// já dispara um "auto clique" (iniciarReproducao) que pede tela cheia, desbloqueia o
// AudioContext (SomFX) e já bota o vídeo pra tocar com som, tudo automaticamente.
// Quando o vídeo termina, aparece o botão "INICIAR" (preto e branco), e é aí que
// segue pra IntroScene.
//
// Aviso: navegadores (Chrome, Firefox, Safari etc.) só liberam vídeo com som e tela
// cheia dentro de um gesto REAL do usuário (um clique de verdade). Um "auto clique"
// disparado por código não conta como gesto pra eles, então dependendo do navegador
// o vídeo pode começar mudo e a tela cheia pode não ser concedida — nesse caso o
// navegador não avisa com erro, simplesmente ignora o pedido silenciosamente.

class ProdutoraScene extends Phaser.Scene {
    constructor() {
        super('ProdutoraScene');
    }

    preload() {
        this.load.video('videoProdutora', 'assets/video/produtora.mp4');
    }

    create() {
        this.transicaoEmAndamento = false;
        this.botaoIniciar = null;

        this.add.rectangle(480, 270, 960, 540, 0x000000, 1);

        // vídeo criado mas parado — só começa a tocar quando iniciarReproducao() rodar
        this.video = this.add.video(480, 270, 'videoProdutora');

        this.video.on('created', () => {
            const vw = this.video.video.videoWidth;
            const vh = this.video.video.videoHeight;
            const escala = Math.min(960 / vw, 540 / vh);
            this.video.setDisplaySize(vw * escala, vh * escala);
            this.video.setPosition(480, 270);
        });

        this.video.once('complete', () => this.mostrarBotaoIniciar());

        // "auto clique": dispara sozinho, sem esperar nenhum toque do jogador
        this.iniciarReproducao();
    }

    iniciarReproducao() {
        // pede tela cheia já de cara
        if (this.scale.fullscreen.available && !this.scale.isFullscreen) {
            this.scale.startFullscreen();
        }

        // desbloqueia o AudioContext do SomFX
        SomFX.iniciar();

        // vídeo tocando com som, sem esperar clique nenhum
        this.video.setMute(false);
        this.video.play(false);

        // segurança: se o vídeo não disparar 'complete' por algum motivo, mostra o
        // botão de qualquer jeito depois de um tempo, pra nunca travar o jogador aqui
        this.time.delayedCall(12000, () => this.mostrarBotaoIniciar());
    }

    mostrarBotaoIniciar() {
        if (this.botaoIniciar) return;
        this.video.pause();

        this.add.rectangle(480, 270, 960, 540, 0x000000, 0.35);

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
            this.iniciarJogo(botao);
        });

        this.botaoIniciar = botao;
        this.tweens.add({ targets: botao, alpha: 1, duration: 400 });
    }

    iniciarJogo(botao) {
        // a tela cheia já foi pedida lá no clique em "ASSISTIR" (início do vídeo da
        // produtora); aqui só garante o caso do jogador ter saído da tela cheia
        // manualmente nesse meio-tempo
        if (this.scale.fullscreen.available && !this.scale.isFullscreen) {
            this.scale.startFullscreen();
        }

        // desbloqueia o áudio de novo — SomFX.iniciar() cria/retoma o AudioContext, e o
        // próprio clique já dispara o "unlock" interno do Phaser Sound Manager
        SomFX.iniciar();
        SomFX.peteleco();

        this.tweens.add({ targets: botao, scale: 0.94, duration: 90, yoyo: true });

        this.time.delayedCall(150, () => {
            this.cameras.main.fadeOut(300, 0, 0, 0);
        });

        this.cameras.main.once('camerafadeoutcomplete', () => {
            this.scene.start('IntroScene');
        });
    }
}
