// ---------- Visitante espera aqui enquanto o anfitrião escolhe a pista e inicia a corrida ----------
class AguardandoAnfitriaoScene extends Phaser.Scene {
    constructor() {
        super('AguardandoAnfitriaoScene');
    }

    preload() {
        Carregando.acompanhar(this, 'Carregando...');
        this.load.audio('musica_menu', 'assets/audio/musica_menu.mp3');
    }

    create() {
        criarBotaoTelaCheia(this);
        tocarMusicaDeFundo(this, 'musica_menu', 0.35);

        this.add.image(480, 270, criarTexturaMadeira(this));
        desenharMolduraPainel(this);

        this.add.text(480, 220, '⏳', { fontSize: '64px' }).setOrigin(0.5);

        this.add.text(480, 300, 'Aguardando o anfitrião\nescolher a pista e começar...', {
            fontSize: '20px',
            fontFamily: FONTE_TITULO || 'Arial',
            fontStyle: '600',
            color: '#fff5e0',
            align: 'center',
            stroke: '#3e2412',
            strokeThickness: 4
        }).setOrigin(0.5);

        this.tweens.add({
            targets: this.children.list[2], // o emoji de ampulheta
            angle: 180,
            duration: 900,
            yoyo: true,
            repeat: -1,
            ease: 'sine.inOut'
        });

        criarBotaoEstilizado(this, 480, 460, 200, 50, '✕  Sair da sala', 0x8b3a3a, 0x5a2222, '#ffffff', () => this.sairDaSala());

        this.pararEscutaSala = Multiplayer.ouvirSala(JogoState.salaCodigo, dados => {
            if (dados.estado === 'jogando') {
                JogoState.pistaEscolhida = dados.pista;
                JogoState.marcasCorridaOnline = dados.marcas;
                JogoState.niveisIAOnline = dados.niveisIA;
                JogoState.turnoInicialOnline = dados.turnoInicial;
                if (this.pararEscutaSala) this.pararEscutaSala();
                this.scene.start('CorridaScene');
            }
        });

        this.events.once('shutdown', () => {
            if (this.pararEscutaSala) this.pararEscutaSala();
        });
    }

    sairDaSala() {
        if (this.pararEscutaSala) this.pararEscutaSala();
        JogoState.online = false;
        JogoState.salaCodigo = null;
        this.scene.start('MenuScene');
    }
}
