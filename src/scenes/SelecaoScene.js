// ---------- Cena de seleção de tampinha: vitrine de madeira com halo neon ----------
// Cada tampinha fica sobre um brilho radial da própria cor (gerado em canvas, com blend
// mode ADD por cima da madeira — é o que dá a sensação de luz de verdade, não só um
// círculo colorido). A escolhida fica girando sem parar (feito uma roleta), em vez de
// só ganhar um contorno — é isso que chama atenção pra qual tá selecionada.
class SelecaoScene extends Phaser.Scene {
    constructor() {
        super('SelecaoScene');
    }

    preload() {
        this.load.audio('musica_menu', 'assets/audio/musica_menu.mp3');
    }

    create() {
        criarBotaoTelaCheia(this);
        tocarMusicaDeFundo(this, 'musica_menu', 0.35);

        this.add.image(480, 270, criarTexturaMadeira(this));

        // moldura arredondada ao redor de toda a vitrine
        const moldura = this.add.graphics();
        moldura.lineStyle(6, 0xf0d9a8, 0.5);
        moldura.strokeRoundedRect(14, 10, 932, 466, 26);
        moldura.lineStyle(2, 0x3e2412, 0.6);
        moldura.strokeRoundedRect(20, 16, 920, 454, 22);

        this.add.text(480, 40, 'ESCOLHA SUA TAMPINHA', {
            fontSize: '32px',
            fontFamily: (typeof FONTE_TITULO !== 'undefined' ? FONTE_TITULO : 'Arial'),
            fontStyle: '700',
            color: '#fff5e0',
            stroke: '#3e2412',
            strokeThickness: 6
        }).setOrigin(0.5);

        let marcaSelecionada = MARCAS_DISPONIVEIS.find(m => m.nome === JogoState.marcaJogador) || MARCAS_DISPONIVEIS[0];

        const textoSelecionada = this.add.text(480, 74, marcaSelecionada.nome, {
            fontSize: '17px',
            fontFamily: 'Arial',
            fontStyle: 'bold',
            color: '#ffd76b',
            stroke: '#3e2412',
            strokeThickness: 3
        }).setOrigin(0.5);

        // ---------- vitrine: 4 colunas x 2 linhas, cada uma com halo neon da cor da marca ----------
        const colunas = 4;
        const espacamentoX = 195;
        const espacamentoY = 168;
        const inicioX = 480 - ((colunas - 1) * espacamentoX) / 2;
        const inicioY = 198;

        const opcoes = [];

        MARCAS_DISPONIVEIS.forEach((marca, i) => {
            const col = i % colunas;
            const linha = Math.floor(i / colunas);
            const x = inicioX + col * espacamentoX;
            const y = inicioY + linha * espacamentoY;

            const chaveGlow = criarTexturaBrilho(this, marca.cor);
            const chaveTampinha = criarTexturaTampinha(this, marca);

            const ehSelecionada = marca.nome === marcaSelecionada.nome;

            const halo = this.add.image(x, y, chaveGlow)
                .setBlendMode(Phaser.BlendModes.ADD)
                .setScale(ehSelecionada ? 0.95 : 0.72);

            const img = this.add.image(x, y, chaveTampinha)
                .setScale(1.42)
                .setInteractive({ useHandCursor: true });

            const rotulo = this.add.text(x, y + 68, marca.nome, {
                fontSize: '13px',
                fontFamily: 'Arial',
                fontStyle: 'bold',
                color: '#fff5e0',
                stroke: '#3e2412',
                strokeThickness: 3,
                align: 'center',
                wordWrap: { width: 150 }
            }).setOrigin(0.5);

            // balanço contínuo e sutil, pra vitrine parecer viva (não estática)
            this.tweens.add({
                targets: [img, halo],
                y: y - 4,
                duration: 1400 + i * 90,
                yoyo: true,
                repeat: -1,
                ease: 'sine.inOut',
                delay: i * 120
            });

            const opcao = { img, halo, rotulo, marca, x, y, tweenGiro: null };

            // gira a tampinha sem parar enquanto ela for a selecionada; qualquer outra
            // fica parada (com o ângulo voltando suavemente pra 0 se estava girando antes)
            const atualizarGiro = () => {
                if (opcao.marca.nome === marcaSelecionada.nome) {
                    if (!opcao.tweenGiro) {
                        opcao.img.setAngle(0);
                        opcao.tweenGiro = this.tweens.add({
                            targets: opcao.img,
                            angle: 360,
                            duration: 2200,
                            repeat: -1,
                            ease: 'Linear'
                        });
                    }
                } else if (opcao.tweenGiro) {
                    opcao.tweenGiro.stop();
                    opcao.tweenGiro = null;
                    this.tweens.add({ targets: opcao.img, angle: 0, duration: 200, ease: 'sine.out' });
                }
            };
            atualizarGiro();

            const selecionar = () => {
                marcaSelecionada = marca;
                textoSelecionada.setText(marca.nome);

                opcoes.forEach(o => {
                    o.atualizarGiro();
                    this.tweens.add({
                        targets: o.halo,
                        scale: o.marca.nome === marcaSelecionada.nome ? 0.95 : 0.72,
                        duration: 220,
                        ease: 'sine.out'
                    });
                });

                SomFX.peteleco(1.3);
            };
            opcao.atualizarGiro = atualizarGiro;
            opcao.selecionar = selecionar;

            img.on('pointerover', () => {
                this.tweens.add({ targets: img, scale: 1.55, duration: 140 });
                this.tweens.add({ targets: halo, scale: opcao.marca.nome === marcaSelecionada.nome ? 1.05 : 0.82, duration: 140 });
            });
            img.on('pointerout', () => {
                this.tweens.add({ targets: img, scale: 1.42, duration: 140 });
                this.tweens.add({ targets: halo, scale: opcao.marca.nome === marcaSelecionada.nome ? 0.95 : 0.72, duration: 140 });
            });
            img.on('pointerdown', selecionar);

            opcoes.push(opcao);
        });

        // brilho pulsante contínuo no halo da tampinha selecionada — chama atenção sem
        // precisar de nenhum texto extra dizendo "selecionada"
        this.time.addEvent({
            delay: 16,
            loop: true,
            callback: () => {
                const pulso = 0.85 + Math.sin(this.time.now / 260) * 0.15;
                opcoes.forEach(o => {
                    if (o.marca.nome === marcaSelecionada.nome) o.halo.setAlpha(pulso);
                    else o.halo.setAlpha(0.75);
                });
            }
        });

        // ---------- botões ----------
        const botaoEstilizado = (x, y, largura, altura, texto, corFundo, corBorda, corTexto, aoClicar) => {
            const g = this.add.graphics();
            g.fillStyle(corFundo, 0.92);
            g.fillRoundedRect(-largura / 2, -altura / 2, largura, altura, 12);
            g.lineStyle(3, corBorda, 1);
            g.strokeRoundedRect(-largura / 2, -altura / 2, largura, altura, 12);

            const rotulo = this.add.text(0, 0, texto, {
                fontSize: '19px',
                fontFamily: 'Arial',
                fontStyle: 'bold',
                color: corTexto
            }).setOrigin(0.5);

            const botao = this.add.container(x, y, [g, rotulo]);
            botao.setSize(largura, altura);
            botao.setInteractive({ useHandCursor: true });

            botao.on('pointerover', () => this.tweens.add({ targets: botao, scale: 1.05, duration: 100 }));
            botao.on('pointerout', () => this.tweens.add({ targets: botao, scale: 1, duration: 100 }));
            botao.on('pointerdown', aoClicar);

            return botao;
        };

        botaoEstilizado(180, 500, 160, 48, '←  Voltar', 0x2b2b2b, 0x555555, '#ffffff', () => {
            this.scene.start('MenuScene');
        });

        botaoEstilizado(780, 500, 200, 52, '✅ CONFIRMAR', 0x2ecc71, 0x1e8449, '#052e13', () => {
            JogoState.corJogador = marcaSelecionada.cor;
            JogoState.marcaJogador = marcaSelecionada.nome;
            this.scene.start('SelecaoPistaScene');
        });
    }
}
