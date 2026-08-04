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
        Carregando.acompanhar(this, 'Carregando...');
        this.load.audio('musica_menu', 'assets/audio/musica_menu.mp3');
    }

    create() {
        criarBotaoTelaCheia(this);
        tocarMusicaDeFundo(this, 'musica_menu', 0.35);

        this.add.image(480, 270, criarTexturaMadeira(this));

        // moldura arredondada ao redor de toda a vitrine
        desenharMolduraPainel(this);

        this.add.text(480, 30, 'ESCOLHA SUA TAMPINHA', {
            fontSize: '32px',
            fontFamily: (typeof FONTE_TITULO !== 'undefined' ? FONTE_TITULO : 'Arial'),
            fontStyle: '700',
            color: '#fff5e0',
            stroke: '#3e2412',
            strokeThickness: 6
        }).setOrigin(0.5);

        let marcaSelecionada = MARCAS_DISPONIVEIS.find(m => m.nome === JogoState.marcaJogador) || MARCAS_DISPONIVEIS[0];

        const textoSelecionada = this.add.text(480, 58, marcaSelecionada.nome, {
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
        const espacamentoY = 150;
        const inicioX = 480 - ((colunas - 1) * espacamentoX) / 2;
        const inicioY = 186;

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

            const rotulo = this.add.text(x, y + 58, marca.nome, {
                fontSize: '13px',
                fontFamily: 'Arial',
                fontStyle: 'bold',
                color: '#fff5e0',
                stroke: '#3e2412',
                strokeThickness: 3,
                align: 'center',
                wordWrap: { width: 150 }
            }).setOrigin(0.5);

            // ponto forte: uma linha curta abaixo do nome, resumindo o que a tampinha
            // entrega de melhor (arranco, resistência, deslize, freada etc.)
            const rotuloPontoForte = this.add.text(x, y + 74, marca.pontoForte, {
                fontSize: '10px',
                fontFamily: 'Arial',
                fontStyle: 'italic',
                color: '#ffd76b',
                stroke: '#3e2412',
                strokeThickness: 2,
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

        // ---------- modo de jogo: contra a IA ou online, escolhido aqui mesmo ----------
        // antes isso ficava num lobby separado no menu; juntar com a escolha da tampinha
        // tira uma tela do caminho e deixa o jogador ver o código da sala sem sair daqui.
        this.modoOnline = false;
        this.salaPronta = false;
        this.pararEscutaSala = null;

        const abaSolo = this.criarAba(392, 88, 172, 34, '🎮  Contra a IA', () => this.trocarModo(false));
        const abaOnline = this.criarAba(568, 88, 172, 34, '🌐  Online', () => this.trocarModo(true));
        this.abas = { solo: abaSolo, online: abaOnline };

        // painel online (fica escondido no modo solo)
        this.painelOnline = [];

        this.textoCodigo = this.add.text(480, 432, '', {
            fontSize: '34px',
            fontFamily: FONTE_TITULO || 'Arial',
            fontStyle: '700',
            color: '#ffd76b',
            stroke: '#3e2412',
            strokeThickness: 5
        }).setOrigin(0.5).setVisible(false);

        this.textoStatusOnline = this.add.text(480, 466, '', {
            fontSize: '14px',
            fontFamily: 'Arial',
            fontStyle: 'bold',
            color: '#e8dcc4',
            align: 'center',
            wordWrap: { width: 700 }
        }).setOrigin(0.5).setVisible(false);

        this.botaoCriar = criarBotaoEstilizado(this, 360, 432, 210, 44, '➕ Criar sala', 0x2ecc71, 0x1e8449, '#052e13', () => this.criarSala());
        this.botaoEntrar = criarBotaoEstilizado(this, 600, 432, 230, 44, '🔑 Entrar com código', 0x3498db, 0x21618c, '#08243a', () => this.entrarSala());
        this.painelOnline.push(this.botaoCriar, this.botaoEntrar);
        this.mostrarPainel(false);

        // ---------- botões ----------
        criarBotaoEstilizado(this, 150, 505, 150, 44, '←  Voltar', 0x2b2b2b, 0x555555, '#ffffff', () => {
            this.limparOnline(true);
            this.scene.start('MenuScene');
        });

        this.botaoConfirmar = criarBotaoEstilizado(this, 800, 505, 200, 48, '✅ CONFIRMAR', 0x2ecc71, 0x1e8449, '#052e13', () => {
            JogoState.corJogador = marcaSelecionada.cor;
            JogoState.marcaJogador = marcaSelecionada.nome;

            if (!this.modoOnline) {
                JogoState.online = false;
                JogoState.salaCodigo = null;
                this.scene.start('SelecaoPistaScene');
                return;
            }

            if (!this.salaPronta) {
                this.setStatus(JogoState.salaCodigo
                    ? 'Ainda falta o segundo jogador entrar na sala.'
                    : 'Crie uma sala ou entre com um código antes de confirmar.');
                return;
            }

            if (!JogoState.souAnfitriao) {
                // visitante: grava a escolha na sala e espera o anfitrião escolher a pista
                this.pararEscuta();
                Multiplayer.definirMarcaVisitante(JogoState.salaCodigo, marcaSelecionada.nome)
                    .then(() => this.scene.start('AguardandoAnfitriaoScene'))
                    .catch(erro => {
                        console.error('[SelecaoScene] falha ao gravar marca do visitante:', erro);
                        this.scene.start('AguardandoAnfitriaoScene'); // a sala já registrou a entrada
                    });
                return;
            }

            this.pararEscuta();
            this.scene.start('SelecaoPistaScene');
        });

        const abrirOnline = JogoState.abrirOnlineNaSelecao === true;
        JogoState.abrirOnlineNaSelecao = false;
        this.trocarModo(abrirOnline);

        this.events.once('shutdown', () => this.pararEscuta());
    }

    // aba do seletor de modo: retângulo simples que muda de cor quando fica ativo
    criarAba(x, y, largura, altura, texto, aoClicar) {
        const g = this.add.graphics();
        const rotulo = this.add.text(0, 0, texto, {
            fontSize: '15px', fontFamily: 'Arial', fontStyle: 'bold', color: '#e8dcc4'
        }).setOrigin(0.5);

        const aba = this.add.container(x, y, [g, rotulo]);
        aba.setSize(largura, altura);
        aba.setInteractive({ useHandCursor: true });
        aba.on('pointerdown', () => { SomFX.peteleco(1.1); aoClicar(); });

        aba.setAtivo = (ativo) => {
            g.clear();
            g.fillStyle(ativo ? 0xffd76b : 0x000000, ativo ? 0.95 : 0.4);
            g.fillRoundedRect(-largura / 2, -altura / 2, largura, altura, 10);
            g.lineStyle(2, ativo ? 0x8a5a12 : 0x6b5638, 1);
            g.strokeRoundedRect(-largura / 2, -altura / 2, largura, altura, 10);
            rotulo.setColor(ativo ? '#3e2412' : '#cbbfa6');
        };
        aba.setAtivo(false);
        return aba;
    }

    // esconder um botão no Phaser não desliga o clique dele — sem apagar o input, os
    // botões de sala invisíveis continuavam capturando toque no modo solo
    mostrarPainel(visivel) {
        this.painelOnline.forEach(b => {
            b.setVisible(visivel);
            if (visivel) b.setInteractive({ useHandCursor: true });
            else b.disableInteractive();
        });
    }

    trocarModo(online) {
        if (!online) this.limparOnline(true);

        this.modoOnline = online;
        this.abas.solo.setAtivo(!online);
        this.abas.online.setAtivo(online);

        this.mostrarPainel(online && !JogoState.salaCodigo);
        this.textoStatusOnline.setVisible(online);
        this.textoCodigo.setVisible(false);

        if (online) {
            this.setStatus('Você e um amigo correm juntos — as tampinhas 3 e 4 continuam IA.\nCrie uma sala ou entre com o código de quem criou.');
        }
    }

    setStatus(texto) {
        this.textoStatusOnline.setText(texto).setVisible(this.modoOnline);
    }

    pararEscuta() {
        if (this.pararEscutaSala) { this.pararEscutaSala(); this.pararEscutaSala = null; }
    }

    // volta pro estado offline; se eu era o anfitrião, apaga a sala que criei
    limparOnline(apagarSala) {
        this.pararEscuta();
        if (apagarSala && JogoState.online && JogoState.souAnfitriao && JogoState.salaCodigo) {
            Multiplayer.encerrarSala(JogoState.salaCodigo);
        }
        JogoState.online = false;
        JogoState.souAnfitriao = false;
        JogoState.salaCodigo = null;
        this.salaPronta = false;
        if (this.textoCodigo) this.textoCodigo.setVisible(false);
    }

    async criarSala() {
        if (!this.modoOnline) return;
        this.botaoCriar.disableInteractive();
        this.botaoEntrar.disableInteractive();
        this.setStatus('Criando sala...');

        try {
            const codigo = await Multiplayer.criarSala();
            JogoState.online = true;
            JogoState.souAnfitriao = true;
            JogoState.salaCodigo = codigo;
            JogoState.meuIndice = 0;

            this.mostrarPainel(false);
            this.textoCodigo.setText(codigo).setVisible(true);
            this.setStatus('Passe esse código para o outro jogador. Aguardando ele entrar...');

            this.pararEscuta();
            this.pararEscutaSala = Multiplayer.ouvirSala(codigo, dados => {
                if (dados.visitanteUid && !this.salaPronta) {
                    this.salaPronta = true;
                    this.setStatus('Jogador 2 conectado! Escolha sua tampinha e toque em CONFIRMAR.');
                    SomFX.vitoria && SomFX.vitoria();
                }
            });
        } catch (erro) {
            console.error('[SelecaoScene] falha ao criar sala:', erro);
            this.setStatus('Não consegui criar a sala. Confere a internet e tenta de novo.');
            this.mostrarPainel(true);
        }
    }

    async entrarSala() {
        if (!this.modoOnline) return;
        const digitado = window.prompt('Digite o código da sala (5 caracteres):');
        if (!digitado) return;
        const codigo = digitado.trim().toUpperCase();

        this.botaoCriar.disableInteractive();
        this.botaoEntrar.disableInteractive();
        this.setStatus('Entrando na sala ' + codigo + '...');

        try {
            await Multiplayer.entrarSala(codigo);
            JogoState.online = true;
            JogoState.souAnfitriao = false;
            JogoState.salaCodigo = codigo;
            JogoState.meuIndice = 1;
            this.salaPronta = true;

            this.mostrarPainel(false);
            this.textoCodigo.setText(codigo).setVisible(true);
            this.setStatus('Conectado! Escolha sua tampinha e toque em CONFIRMAR — depois é só esperar o anfitrião escolher a pista.');
        } catch (erro) {
            console.error('[SelecaoScene] falha ao entrar na sala:', erro);
            this.setStatus(erro.message || 'Não consegui entrar nessa sala.');
            this.mostrarPainel(true);
        }
    }
}
