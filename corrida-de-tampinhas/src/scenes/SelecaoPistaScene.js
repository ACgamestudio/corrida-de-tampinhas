class SelecaoPistaScene extends Phaser.Scene {
    constructor() {
        super('SelecaoPistaScene');
    }

    preload() {
        this.load.image('fundoPista', 'assets/images/garage_bg.png');
        this.load.audio('musica_menu', 'assets/audio/musica_menu.mp3');
    }

    desenharCompartimento(x, y, largura, altura) {
        const g = this.add.graphics();
        g.fillStyle(0x000000, 0.35);
        g.fillRoundedRect(x - largura / 2 + 3, y - altura / 2 + 3, largura, altura, 10);
        g.fillStyle(0xf0e6d2, 0.14);
        g.fillRoundedRect(x - largura / 2, y - altura / 2, largura, altura, 10);
        return g;
    }

    desenharBorda(x, y, largura, altura, cor, espessura = 3) {
        const g = this.add.graphics();
        g.lineStyle(espessura, cor, 1);
        g.strokeRoundedRect(x - largura / 2, y - altura / 2, largura, altura, 10);
        return g;
    }

    create() {
        criarBotaoTelaCheia(this);
        tocarMusicaDeFundo(this, 'musica_menu', 0.35);
        this.add.image(400, 300, criarTexturaMadeira(this));

        this.add.text(400, 32, 'ESCOLHA A PISTA', {
            fontSize: '24px',
            fontFamily: FONTE_TITULO || 'Arial',
            color: '#fff5e0',
            fontStyle: 'bold',
            stroke: '#3e2412',
            strokeThickness: 5
        }).setOrigin(0.5);

        // ---------- carta em destaque: Garagem (única disponível por enquanto) ----------
        const cx = 400, cy = 250;
        const largura = 300, altura = 300;

        this.desenharCompartimento(cx, cy, largura, altura);
        const borda = this.desenharBorda(cx, cy, largura, altura, 0xffd700, 4);

        // moldura com a foto de verdade da garagem como preview da pista
        const previewMask = this.add.graphics();
        previewMask.fillStyle(0xffffff, 1);
        previewMask.fillRoundedRect(cx - largura / 2 + 10, cy - altura / 2 + 10, largura - 20, altura - 90, 8);
        const preview = this.add.image(cx, cy - 40, 'fundoPista').setDisplaySize(largura - 20, (largura - 20) * (768 / 1376));
        preview.setMask(previewMask.createGeometryMask());

        // brilho suave pulsando na borda, pra parecer uma opção "premium"/em destaque
        this.tweens.add({
            targets: borda, alpha: { from: 0.55, to: 1 }, duration: 1100, yoyo: true, repeat: -1
        });

        this.add.text(cx, cy + altura / 2 - 68, '🏠 GARAGEM', {
            fontSize: '20px',
            fontFamily: FONTE_TITULO || 'Arial',
            fontStyle: 'bold',
            color: '#fff5e0',
            stroke: '#3e2412',
            strokeThickness: 4
        }).setOrigin(0.5);

        this.add.text(cx, cy + altura / 2 - 40, 'Curvas de verdade no chão da\ngaragem de casa', {
            fontSize: '13px',
            fontFamily: 'Arial',
            color: '#e8dcc4',
            align: 'center',
            lineSpacing: 3
        }).setOrigin(0.5);

        const selo = this.add.text(cx + largura / 2 - 8, cy - altura / 2 + 8, 'DISPONÍVEL', {
            fontSize: '10px',
            fontFamily: 'Arial',
            fontStyle: 'bold',
            color: '#1b1b1b',
            backgroundColor: '#ffd700',
            padding: { x: 6, y: 3 }
        }).setOrigin(1, 0);

        const zonaClique = this.add.rectangle(cx, cy, largura, altura, 0xffffff, 0)
            .setInteractive({ useHandCursor: true });
        zonaClique.on('pointerover', () => this.tweens.add({ targets: [preview, selo], scale: 1.02, duration: 120 }));
        zonaClique.on('pointerout', () => this.tweens.add({ targets: [preview, selo], scale: 1, duration: 120 }));

        // ---------- vagas "em breve", só pra mostrar que vem mais pista por aí ----------
        const emBreve = [{ x: 140, nome: '🌆 Rua' }, { x: 660, nome: '🏖️ Praia' }];
        emBreve.forEach(({ x, nome }) => {
            this.desenharCompartimento(x, cy, 150, 300);
            this.desenharBorda(x, cy, 150, 300, 0x5b3a1f);
            this.add.text(x, cy - 20, nome, {
                fontSize: '15px', fontFamily: 'Arial', color: '#a89a80', align: 'center'
            }).setOrigin(0.5).setAlpha(0.6);
            this.add.text(x, cy + 30, '🔒 EM BREVE', {
                fontSize: '12px', fontFamily: 'Arial', fontStyle: 'bold', color: '#a89a80'
            }).setOrigin(0.5).setAlpha(0.6);
        });

        // ---------- botão confirmar ----------
        const botaoConfirmar = this.add.text(650, 560, '✅ COMEÇAR', {
            fontSize: '22px',
            fontFamily: 'Arial',
            color: '#000000',
            backgroundColor: '#2ecc71',
            padding: { x: 18, y: 10 }
        }).setOrigin(0.5).setInteractive({ useHandCursor: true });

        botaoConfirmar.on('pointerover', () => botaoConfirmar.setStyle({ backgroundColor: '#27ae60' }));
        botaoConfirmar.on('pointerout', () => botaoConfirmar.setStyle({ backgroundColor: '#2ecc71' }));
        botaoConfirmar.on('pointerdown', () => this.scene.start('CorridaScene'));
        zonaClique.on('pointerdown', () => this.scene.start('CorridaScene'));

        // ---------- botão voltar ----------
        const botaoVoltar = this.add.text(150, 560, '← Voltar', {
            fontSize: '20px',
            fontFamily: 'Arial',
            color: '#ffffff',
            backgroundColor: '#333333',
            padding: { x: 12, y: 6 }
        }).setOrigin(0.5).setInteractive({ useHandCursor: true });

        botaoVoltar.on('pointerdown', () => this.scene.start('SelecaoScene'));
    }
}
