const FONTE_TITULO = '"Fredoka", "Arial", sans-serif';

// frases de rodapé — sorteia uma a cada visita ao menu, pra ficar sempre fresco
const FRASES_RODAPE = [
    'Reviva uma brincadeira que marcou gerações.',
    'Toda grande corrida começa com um peteleco.'
];

class MenuScene extends Phaser.Scene {
    constructor() {
        super('MenuScene');
    }

    preload() {
        this.load.audio('musica_menu', 'assets/audio/musica_menu.mp3');
    }

    create() {
        criarBotaoTelaCheia(this);
        this.transicaoEmAndamento = false;

        // fundo tema quintal
        this.add.image(400, 300, criarTexturaCimento(this));
        this.add.rectangle(400, 300, 800, 600, 0x000000, 0.35);
        espalharDecoracao(this);

        // sol — presença quieta no fundo, respirando devagar
        const sol = this.add.text(60, 55, '☀️', { fontSize: '46px' }).setOrigin(0.5).setAlpha(0.85);
        this.tweens.add({
            targets: sol,
            alpha: 0.55,
            scale: 1.06,
            duration: 2600,
            yoyo: true,
            repeat: -1,
            ease: 'sine.inOut'
        });

        // passarinhos — pequeno detalhe vivo no céu
        const passaro1 = this.add.text(680, 70, '🐦', { fontSize: '22px' }).setOrigin(0.5);
        const passaro2 = this.add.text(730, 95, '🐦', { fontSize: '18px' }).setOrigin(0.5).setAlpha(0.85);
        this.passarinhosVisuais = [passaro1, passaro2];
        this.passarinhosVisuais.forEach((p, i) => {
            this.tweens.add({
                targets: p,
                y: p.y - 8,
                duration: 1600 + i * 300,
                yoyo: true,
                repeat: -1,
                ease: 'sine.inOut'
            });
        });

        // título
        this.add.text(400, 140, 'CORRIDA DE', {
            fontSize: '38px',
            fontFamily: FONTE_TITULO,
            fontStyle: '600',
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 6
        }).setOrigin(0.5);

        this.add.text(400, 188, 'TAMPINHAS', {
            fontSize: '50px',
            fontFamily: FONTE_TITULO,
            fontStyle: '700',
            color: '#ffe066',
            stroke: '#000000',
            strokeThickness: 6
        }).setOrigin(0.5);

        // frase que traz a lembrança à tona
        this.add.text(400, 228, '"Quem nunca brincou de corrida de tampinhas?"', {
            fontSize: '16px',
            fontFamily: FONTE_TITULO,
            fontStyle: 'italic',
            color: '#f5f0e6'
        }).setOrigin(0.5).setAlpha(0.9);

        // tampinha decorativa: usa a marca já escolhida pelo jogador (ou a padrão)
        const marcaAtual = MARCAS_DISPONIVEIS.find(m => m.nome === JogoState.marcaJogador) || MARCAS_DISPONIVEIS[0];
        const chaveTampinha = criarTexturaTampinha(this, marcaAtual);
        this.tampinhaDecor = this.add.image(400, 320, chaveTampinha).setScale(1.3);

        this.tweenGiroTampinha = this.tweens.add({
            targets: this.tampinhaDecor,
            angle: 360,
            duration: 4000,
            repeat: -1
        });

        // botão — placa de madeira, não retângulo de menu
        this.criarBotaoComecar(400, 430);

        // rodapé — vende a ideia do jogo em vez de expor detalhes técnicos
        const frase = Phaser.Utils.Array.GetRandom(FRASES_RODAPE);
        this.add.text(400, 555, frase, {
            fontSize: '14px',
            fontFamily: FONTE_TITULO,
            fontStyle: 'italic',
            color: '#e8e2d5'
        }).setOrigin(0.5).setAlpha(0.85);

        // trilha de quintal: música de fundo (continua tocando ao ir pra seleção de tampinha
        // e de pista — só troca de verdade quando entra na corrida) + passarinho cantando
        tocarMusicaDeFundo(this, 'musica_menu', 0.35);
        this.agendarSomAmbiente();

        // ao sair do menu (troca de scene), só corta os agendamentos — a música continua
        this.events.once('shutdown', () => {
            if (this.timerPassarinho) this.timerPassarinho.remove();
        });
    }

    agendarSomAmbiente() {
        const proximoPassarinho = () => {
            SomFX.passarinho();
            const ave = Phaser.Utils.Array.GetRandom(this.passarinhosVisuais);
            this.tweens.add({ targets: ave, scaleX: 1.25, scaleY: 0.8, duration: 90, yoyo: true });
            this.timerPassarinho = this.time.delayedCall(Phaser.Math.Between(2500, 5500), proximoPassarinho);
        };
        this.timerPassarinho = this.time.delayedCall(Phaser.Math.Between(1200, 2500), proximoPassarinho);
    }

    criarBotaoComecar(x, y) {
        const largura = 220;
        const altura = 58;

        const placa = this.add.graphics();
        placa.fillStyle(0x8b5a2b, 1);
        placa.fillRoundedRect(-largura / 2, -altura / 2, largura, altura, 10);
        placa.lineStyle(3, 0x5b3a1f, 1);
        placa.strokeRoundedRect(-largura / 2, -altura / 2, largura, altura, 10);
        // veio de madeira sutil
        placa.lineStyle(1, 0x5b3a1f, 0.35);
        placa.lineBetween(-largura / 2 + 10, -8, largura / 2 - 10, -4);
        placa.lineBetween(-largura / 2 + 10, 10, largura / 2 - 10, 14);
        // "pregos" nos cantos
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

        const botao = this.add.container(x, y, [placa, rotulo]);
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

    // Clique → som → tampinha gira → desliza → fade → Seleção (~0,8s)
    iniciarTransicaoParaSelecao(botao) {
        SomFX.peteleco();

        this.tweens.add({
            targets: botao,
            scale: 0.94,
            duration: 90,
            yoyo: true
        });

        if (this.tweenGiroTampinha) this.tweenGiroTampinha.stop();

        this.tweens.add({
            targets: this.tampinhaDecor,
            angle: this.tampinhaDecor.angle + 720,
            scale: 1.5,
            duration: 320,
            ease: 'cubic.out',
            onComplete: () => {
                this.tweens.add({
                    targets: this.tampinhaDecor,
                    x: 900,
                    duration: 260,
                    ease: 'cubic.in'
                });
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
