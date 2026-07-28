// ---------- Cena de seleção de pista: mesmo estilo em madeira da seleção de tampinha ----------
// A foto da garagem é 4096x2048 (proporção 2:1) — o quadro que a envolve tem exatamente
// essa proporção, então a imagem preenche o quadro inteiro, sem sobrar nenhuma faixa da
// cor de fundo em volta (o que acontecia antes, quando o quadro tinha uma proporção
// diferente da foto).
const PROPORCAO_FOTO_PISTA = 2048 / 4096; // altura / largura, real, direto do arquivo

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
        this.add.image(480, 270, criarTexturaMadeira(this));

        // moldura arredondada ao redor de toda a vitrine — igual à tela de tampinha
        desenharMolduraPainel(this);

        this.add.text(480, 40, 'ESCOLHA A PISTA', {
            fontSize: '32px',
            fontFamily: FONTE_TITULO || 'Arial',
            fontStyle: '700',
            color: '#fff5e0',
            stroke: '#3e2412',
            strokeThickness: 6
        }).setOrigin(0.5);

        // ---------- carta em destaque: Garagem (única disponível por enquanto) ----------
        const cx = 480, cyFrame = 175;
        const FRAME_W = 380;
        const FRAME_H = FRAME_W * PROPORCAO_FOTO_PISTA; // 190 — exatamente a proporção da foto

        // halo neon dourado atrás do quadro, mesmo recurso visual da tela de tampinha
        const halo = this.add.image(cx, cyFrame, criarTexturaBrilho(this, 0xffd700))
            .setBlendMode(Phaser.BlendModes.ADD)
            .setScale(2.6, 1.5);
        this.tweens.add({
            targets: halo, alpha: { from: 0.55, to: 0.95 }, duration: 1100, yoyo: true, repeat: -1
        });

        // a foto preenchendo um quadro do tamanho exato dela — sem máscara cortando nada e
        // sem sobra de fundo: FRAME_W x FRAME_H tem a mesma proporção da imagem de verdade
        const preview = this.add.image(cx, cyFrame, 'fundoPista').setDisplaySize(FRAME_W, FRAME_H);

        // cantos levemente arredondados no recorte da foto, sem cortar nenhum pixel a mais
        // (a máscara tem exatamente o mesmo tamanho do quadro, só arredonda as quinas) —
        // o graphics usado como fonte da máscara precisa ficar invisível, senão ele mesmo
        // aparece por cima como uma caixa branca sólida, tapando a foto
        const mascaraForma = this.add.graphics();
        mascaraForma.fillStyle(0xffffff, 1);
        mascaraForma.fillRoundedRect(cx - FRAME_W / 2, cyFrame - FRAME_H / 2, FRAME_W, FRAME_H, 14);
        mascaraForma.setVisible(false);
        preview.setMask(mascaraForma.createGeometryMask());

        const borda = this.desenharBorda(cx, cyFrame, FRAME_W, FRAME_H, 0xffd700, 4);
        this.tweens.add({
            targets: borda, alpha: { from: 0.55, to: 1 }, duration: 1100, yoyo: true, repeat: -1
        });

        const selo = this.add.text(cx + FRAME_W / 2 - 8, cyFrame - FRAME_H / 2 + 8, 'DISPONÍVEL', {
            fontSize: '11px',
            fontFamily: 'Arial',
            fontStyle: 'bold',
            color: '#1b1b1b',
            backgroundColor: '#ffd700',
            padding: { x: 6, y: 3 }
        }).setOrigin(1, 0);

        const yTitulo = cyFrame + FRAME_H / 2 + 34;
        this.add.text(cx, yTitulo, '🏠 GARAGEM', {
            fontSize: '22px',
            fontFamily: FONTE_TITULO || 'Arial',
            fontStyle: 'bold',
            color: '#fff5e0',
            stroke: '#3e2412',
            strokeThickness: 4
        }).setOrigin(0.5);

        this.add.text(cx, yTitulo + 28, 'Curvas de verdade no chão da garagem de casa', {
            fontSize: '13px',
            fontFamily: 'Arial',
            color: '#e8dcc4',
            align: 'center'
        }).setOrigin(0.5);

        const zonaClique = this.add.rectangle(cx, cyFrame, FRAME_W, FRAME_H + 90, 0xffffff, 0)
            .setInteractive({ useHandCursor: true });
        zonaClique.on('pointerover', () => this.tweens.add({ targets: [preview, borda, selo], scale: 1.02, duration: 120 }));
        zonaClique.on('pointerout', () => this.tweens.add({ targets: [preview, borda, selo], scale: 1, duration: 120 }));
        zonaClique.on('pointerdown', () => this.scene.start('CorridaScene'));

        // ---------- vagas "em breve", só pra mostrar que vem mais pista por aí ----------
        const emBreve = [{ x: 155, nome: '🌆 Rua' }, { x: 805, nome: '🏖️ Praia' }];
        emBreve.forEach(({ x, nome }) => {
            this.desenharCompartimento(x, cyFrame, 150, FRAME_H + 90);
            this.desenharBorda(x, cyFrame, 150, FRAME_H + 90, 0x5b3a1f);
            this.add.text(x, cyFrame - 20, nome, {
                fontSize: '15px', fontFamily: 'Arial', color: '#a89a80', align: 'center'
            }).setOrigin(0.5).setAlpha(0.6);
            this.add.text(x, cyFrame + 30, '🔒 EM BREVE', {
                fontSize: '12px', fontFamily: 'Arial', fontStyle: 'bold', color: '#a89a80'
            }).setOrigin(0.5).setAlpha(0.6);
        });

        // ---------- botões ----------
        criarBotaoEstilizado(this, 180, 500, 160, 48, '←  Voltar', 0x2b2b2b, 0x555555, '#ffffff', () => {
            this.scene.start('SelecaoScene');
        });

        criarBotaoEstilizado(this, 780, 500, 200, 52, '✅ COMEÇAR', 0x2ecc71, 0x1e8449, '#052e13', () => {
            this.scene.start('CorridaScene');
        });
    }
}
