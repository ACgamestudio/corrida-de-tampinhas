// ---------- Cena de seleção de pista: mesmo estilo em madeira da seleção de tampinha ----------
// As fotos das pistas são 4096x2048 (proporção 2:1) — os quadros que as envolvem têm
// exatamente essa proporção, então a imagem preenche o quadro inteiro, sem sobrar nenhuma
// faixa da cor de fundo em volta.
const PROPORCAO_FOTO_PISTA = 2048 / 4096; // altura / largura, real, direto do arquivo

class SelecaoPistaScene extends Phaser.Scene {
    constructor() {
        super('SelecaoPistaScene');
    }

    preload() {
        // as 3 fotos de pista já ficam prontas aqui — são só 3 arquivos pequenos de preview,
        // vale a pena carregar todas de uma vez pra trocar de seleção sem esperar
        Object.entries(PISTAS_DISPONIVEIS).forEach(([chave, info]) => {
            this.load.image('previewPista_' + chave, info.arquivo);
        });
        this.load.audio('musica_menu', 'assets/audio/musica_menu.mp3');
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

        this.add.text(480, 38, 'ESCOLHA A PISTA', {
            fontSize: '32px',
            fontFamily: FONTE_TITULO || 'Arial',
            fontStyle: '700',
            color: '#fff5e0',
            stroke: '#3e2412',
            strokeThickness: 6
        }).setOrigin(0.5);

        let pistaSelecionada = JogoState.pistaEscolhida || 'garagem';
        if (!PISTAS_DISPONIVEIS[pistaSelecionada]) pistaSelecionada = 'garagem';

        const textoSelecionada = this.add.text(480, 70, PISTAS_DISPONIVEIS[pistaSelecionada].nome, {
            fontSize: '17px',
            fontFamily: 'Arial',
            fontStyle: 'bold',
            color: '#ffd76b',
            stroke: '#3e2412',
            strokeThickness: 3
        }).setOrigin(0.5);

        // ---------- 3 cartas lado a lado, uma por pista ----------
        const chaves = Object.keys(PISTAS_DISPONIVEIS);
        const cyFrame = 210;
        const FRAME_W = 250;
        const FRAME_H = FRAME_W * PROPORCAO_FOTO_PISTA; // exatamente a proporção da foto
        const espacamentoX = 300;
        const inicioX = 480 - ((chaves.length - 1) * espacamentoX) / 2;

        const opcoes = [];

        chaves.forEach((chave, i) => {
            const info = PISTAS_DISPONIVEIS[chave];
            const cx = inicioX + i * espacamentoX;

            const ehSelecionada = chave === pistaSelecionada;

            // halo neon dourado atrás do quadro, mesmo recurso visual da tela de tampinha
            const halo = this.add.image(cx, cyFrame, criarTexturaBrilho(this, 0xffd700))
                .setBlendMode(Phaser.BlendModes.ADD)
                .setScale(ehSelecionada ? 2.0 : 1.5, ehSelecionada ? 1.15 : 0.85);

            // a foto preenchendo um quadro do tamanho exato dela — sem máscara cortando nada
            const preview = this.add.image(cx, cyFrame, 'previewPista_' + chave).setDisplaySize(FRAME_W, FRAME_H);

            // cantos levemente arredondados no recorte da foto, sem cortar nenhum pixel a mais
            const mascaraForma = this.add.graphics();
            mascaraForma.fillStyle(0xffffff, 1);
            mascaraForma.fillRoundedRect(cx - FRAME_W / 2, cyFrame - FRAME_H / 2, FRAME_W, FRAME_H, 14);
            mascaraForma.setVisible(false);
            preview.setMask(mascaraForma.createGeometryMask());

            const borda = this.desenharBorda(cx, cyFrame, FRAME_W, FRAME_H, ehSelecionada ? 0xffd700 : 0x8a7860, ehSelecionada ? 4 : 2);

            const yTitulo = cyFrame + FRAME_H / 2 + 30;
            const rotulo = this.add.text(cx, yTitulo, info.nome, {
                fontSize: '18px',
                fontFamily: FONTE_TITULO || 'Arial',
                fontStyle: 'bold',
                color: '#fff5e0',
                stroke: '#3e2412',
                strokeThickness: 4
            }).setOrigin(0.5);

            this.add.text(cx, yTitulo + 24, info.descricao, {
                fontSize: '12px',
                fontFamily: 'Arial',
                color: '#e8dcc4',
                align: 'center',
                wordWrap: { width: FRAME_W + 20 }
            }).setOrigin(0.5);

            const opcao = { chave, preview, borda, halo, cx };
            opcoes.push(opcao);

            const atualizarSelecao = () => {
                const selecionada = opcao.chave === pistaSelecionada;
                this.tweens.add({
                    targets: borda, alpha: 1, duration: 150,
                    onStart: () => {
                        borda.clear();
                        borda.lineStyle(selecionada ? 4 : 2, selecionada ? 0xffd700 : 0x8a7860, 1);
                        borda.strokeRoundedRect(cx - FRAME_W / 2, cyFrame - FRAME_H / 2, FRAME_W, FRAME_H, 10);
                    }
                });
                this.tweens.add({
                    targets: halo,
                    scaleX: selecionada ? 2.0 : 1.5,
                    scaleY: selecionada ? 1.15 : 0.85,
                    duration: 200,
                    ease: 'sine.out'
                });
            };
            opcao.atualizarSelecao = atualizarSelecao;

            const zonaClique = this.add.rectangle(cx, cyFrame, FRAME_W, FRAME_H + 80, 0xffffff, 0)
                .setInteractive({ useHandCursor: true });

            zonaClique.on('pointerover', () => this.tweens.add({ targets: [preview, borda], scale: 1.03, duration: 120 }));
            zonaClique.on('pointerout', () => this.tweens.add({ targets: [preview, borda], scale: 1, duration: 120 }));
            zonaClique.on('pointerdown', () => {
                pistaSelecionada = opcao.chave;
                textoSelecionada.setText(info.nome);
                opcoes.forEach(o => o.atualizarSelecao());
                SomFX.peteleco(1.3);
            });
        });

        // brilho pulsante contínuo no halo da pista selecionada
        this.time.addEvent({
            delay: 16,
            loop: true,
            callback: () => {
                const pulso = 0.85 + Math.sin(this.time.now / 260) * 0.15;
                opcoes.forEach(o => {
                    o.halo.setAlpha(o.chave === pistaSelecionada ? pulso : 0.55);
                });
            }
        });

        // ---------- botões ----------
        criarBotaoEstilizado(this, 180, 500, 160, 48, '←  Voltar', 0x2b2b2b, 0x555555, '#ffffff', () => {
            this.scene.start('SelecaoScene');
        });

        criarBotaoEstilizado(this, 780, 500, 200, 52, '✅ COMEÇAR', 0x2ecc71, 0x1e8449, '#052e13', () => {
            JogoState.pistaEscolhida = pistaSelecionada;
            this.scene.start('CorridaScene');
        });
    }
}
