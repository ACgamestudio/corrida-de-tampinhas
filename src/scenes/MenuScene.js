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
        Carregando.acompanhar(this, 'Carregando...');
        this.load.audio('musica_menu', 'assets/audio/musica_menu.mp3');
        this.load.image('fundoMenu', 'assets/images/menu_bg.webp');
    }

    create() {
        criarBotaoTelaCheia(this);
        this.transicaoEmAndamento = false;

        // fundo: a nova arte de capa (o próprio desenho já traz sol, pássaros e cactos)
        this.add.image(480, 270, 'fundoMenu').setDisplaySize(960, 540);
        this.add.rectangle(480, 270, 960, 540, 0x000000, 0.22);

        // título
        this.add.text(480, 126, 'CORRIDA DE', {
            fontSize: '38px',
            fontFamily: FONTE_TITULO,
            fontStyle: '600',
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 6
        }).setOrigin(0.5);

        this.add.text(480, 169, 'TAMPINHAS', {
            fontSize: '50px',
            fontFamily: FONTE_TITULO,
            fontStyle: '700',
            color: '#ffe066',
            stroke: '#000000',
            strokeThickness: 6
        }).setOrigin(0.5);

        // frase que traz a lembrança à tona
        this.add.text(480, 205, '"Quem nunca brincou de corrida de tampinhas?"', {
            fontSize: '16px',
            fontFamily: FONTE_TITULO,
            fontStyle: 'italic',
            color: '#f5f0e6'
        }).setOrigin(0.5).setAlpha(0.9);

        // tampinha decorativa: usa a marca já escolhida pelo jogador (ou a padrão)
        const marcaAtual = MARCAS_DISPONIVEIS.find(m => m.nome === JogoState.marcaJogador) || MARCAS_DISPONIVEIS[0];
        const chaveTampinha = criarTexturaTampinha(this, marcaAtual);
        this.tampinhaDecor = this.add.image(480, 288, chaveTampinha).setScale(1.3);

        this.tweenGiroTampinha = this.tweens.add({
            targets: this.tampinhaDecor,
            angle: 360,
            duration: 4000,
            repeat: -1
        });

        // botão — placa de madeira, não retângulo de menu
        this.criarBotaoComecar(480, 387);

        // pontuação total acumulada (vitórias + batidas, ver GameScene) — persiste entre
        // sessões via localStorage, então aparece aqui mesmo antes de correr de novo
        this.add.text(926, 24, '⭐ ' + formatarPontuacao() + ' pts', {
            fontSize: '15px',
            fontFamily: 'Arial',
            fontStyle: 'bold',
            color: '#ffd76b',
            stroke: '#3e2412',
            strokeThickness: 3,
            backgroundColor: '#00000055',
            padding: { x: 8, y: 4 }
        }).setOrigin(1, 0);

        // rodapé — vende a ideia do jogo em vez de expor detalhes técnicos
        const frase = Phaser.Utils.Array.GetRandom(FRASES_RODAPE);
        this.add.text(480, 500, frase, {
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
                    x: 1080,
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
