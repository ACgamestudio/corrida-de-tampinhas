class SelecaoScene extends Phaser.Scene {
    constructor() {
        super('SelecaoScene');
    }

    desenharCompartimento(x, y, largura, altura) {
        const g = this.add.graphics();
        g.fillStyle(0x000000, 0.35);
        g.fillRoundedRect(x - largura / 2 + 3, y - altura / 2 + 3, largura, altura, 8);
        g.fillStyle(0xf0e6d2, 0.14);
        g.fillRoundedRect(x - largura / 2, y - altura / 2, largura, altura, 8);
        return g;
    }

    desenharBorda(x, y, largura, altura, cor) {
        const g = this.add.graphics();
        g.lineStyle(3, cor, 1);
        g.strokeRoundedRect(x - largura / 2, y - altura / 2, largura, altura, 8);
        return g;
    }

    create() {
        this.add.image(400, 300, criarTexturaMadeira(this));

        this.add.text(400, 32, 'ESCOLHA SUA TAMPINHA', {
            fontSize: '24px',
            fontFamily: 'Arial',
            color: '#fff5e0',
            fontStyle: 'bold',
            stroke: '#3e2412',
            strokeThickness: 5
        }).setOrigin(0.5);

        let marcaSelecionada = MARCAS_DISPONIVEIS.find(m => m.nome === JogoState.marcaJogador) || MARCAS_DISPONIVEIS[0];

        // ---------- vitrine de destaque (compartimento grande no topo) ----------
        this.desenharCompartimento(400, 135, 150, 120);
        this.desenharBorda(400, 135, 150, 120, 0xffd700);

        const chavePreview = criarTexturaTampinha(this, marcaSelecionada);
        const preview = this.add.image(400, 125, chavePreview).setScale(1.3);

        const previewTexto = this.add.text(400, 180, marcaSelecionada.nome, {
            fontSize: '15px',
            fontFamily: 'Arial',
            fontStyle: 'bold',
            color: '#fff5e0',
            stroke: '#3e2412',
            strokeThickness: 3
        }).setOrigin(0.5);

        // ---------- prateleira com compartimentos (grade) ----------
        const colunas = 4;
        const espacamento = 100;
        const inicioX = 400 - ((colunas - 1) * espacamento) / 2;
        const y = 330;

        const opcoes = [];

        MARCAS_DISPONIVEIS.forEach((marca, i) => {
            const col = i % colunas;
            const linha = Math.floor(i / colunas);
            const x = inicioX + col * espacamento;
            const yPos = y + linha * 115;

            this.desenharCompartimento(x, yPos, 84, 84);
            const corBorda = marca.nome === marcaSelecionada.nome ? 0xffd700 : 0x5b3a1f;
            const borda = this.desenharBorda(x, yPos, 84, 84, corBorda);

            const chave = criarTexturaTampinha(this, marca);
            const img = this.add.image(x, yPos - 8, chave).setInteractive({ useHandCursor: true });

            const rotulo = this.add.text(x, yPos + 34, marca.nome, {
                fontSize: '10px',
                fontFamily: 'Arial',
                color: '#fff5e0',
                align: 'center',
                wordWrap: { width: 78 }
            }).setOrigin(0.5);

            const opcao = { img, borda, rotulo, marca, x, y: yPos };

            const selecionar = () => {
                marcaSelecionada = marca;
                preview.setTexture(chave);
                previewTexto.setText(marca.nome);

                opcoes.forEach(o => {
                    const cor = o.marca.nome === marcaSelecionada.nome ? 0xffd700 : 0x5b3a1f;
                    o.borda.clear();
                    o.borda.lineStyle(3, cor, 1);
                    o.borda.strokeRoundedRect(o.x - 42, o.y - 42, 84, 84, 8);
                });
            };

            img.on('pointerover', () => img.setScale(1.08));
            img.on('pointerout', () => img.setScale(1));
            img.on('pointerdown', selecionar);

            opcoes.push(opcao);
        });

        // ---------- botão confirmar ----------
        const botaoConfirmar = this.add.text(650, 550, '✅ CONFIRMAR', {
            fontSize: '22px',
            fontFamily: 'Arial',
            color: '#000000',
            backgroundColor: '#2ecc71',
            padding: { x: 18, y: 10 }
        }).setOrigin(0.5).setInteractive({ useHandCursor: true });

        botaoConfirmar.on('pointerover', () => botaoConfirmar.setStyle({ backgroundColor: '#27ae60' }));
        botaoConfirmar.on('pointerout', () => botaoConfirmar.setStyle({ backgroundColor: '#2ecc71' }));

        botaoConfirmar.on('pointerdown', () => {
            JogoState.corJogador = marcaSelecionada.cor;
            JogoState.marcaJogador = marcaSelecionada.nome;
            this.scene.start('SelecaoPistaScene');
        });

        // ---------- botão voltar ----------
        const botaoVoltar = this.add.text(150, 550, '← Voltar', {
            fontSize: '20px',
            fontFamily: 'Arial',
            color: '#ffffff',
            backgroundColor: '#333333',
            padding: { x: 12, y: 6 }
        }).setOrigin(0.5).setInteractive({ useHandCursor: true });

        botaoVoltar.on('pointerdown', () => {
            this.scene.start('MenuScene');
        });
    }
}