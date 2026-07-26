// ---------- Cena da corrida: pista grande, câmera acompanhando, 4 tampinhas na disputa ----------
class GameScene extends Phaser.Scene {
    constructor() {
        super('CorridaScene');
    }

    preload() {
        this.load.image('fundoPista', 'assets/images/garage_bg.png');
        this.load.audio('musica_garagem', 'assets/audio/musica_garagem.mp3');
    }

    create() {
        criarBotaoTelaCheia(this);
        tocarMusicaDeFundo(this, 'musica_garagem', 0.32);
        this.tampinhas = [];
        this.isDragging = false;
        this.dragStart = null;
        this.vencedor = null;
        this.corridaLiberada = false;

        this.pista = construirPista();
        CapPhysics.init(this);

        // faixa onde a mangueira liga e molha a pista: devagar ali a tampinha escorrega pro
        // lado — agora localizada por posição ao longo do traçado (s), não mais por ângulo
        this.zonaAgua = { sCentro: this.pista.comprimentoTotal * 0.28, meiaFaixaS: 90, limiarVelocidade: 195 };
        // trecho de grama/terra batida: mais atrito, perde força mais rápido ali
        this.zonaAreia = { sCentro: this.pista.comprimentoTotal * 0.68, meiaFaixaS: 110 };

        this.FORCA_MAXIMA = 900;
        this.DISTANCIA_MAXIMA = 140;
        this.VELOCIDADE_MINIMA_PARADA = 5;

        // ---------- mundo grande + câmera acompanhando quem está jogando ----------
        this.physics.world.setBounds(0, 0, MUNDO_LARGURA, MUNDO_ALTURA);
        this.cameras.main.setBounds(0, 0, MUNDO_LARGURA, MUNDO_ALTURA);

        this.add.image(MUNDO_LARGURA / 2, MUNDO_ALTURA / 2, 'fundoPista')
            .setDisplaySize(MUNDO_LARGURA, MUNDO_ALTURA);
        desenharPista(this, this.pista);
        desenharZonaAgua(this, this.pista, this.zonaAgua);
        desenharZonaAreia(this, this.pista, this.zonaAreia);

        // ---------- grid de largada: 4 tampinhas, 2 filas x 2 colunas, logo antes de s = 0 ----------
        const posicoesLargada = [
            this.pista.pontoNaFaixa(0, 0.30),
            this.pista.pontoNaFaixa(0, 0.70),
            this.pista.pontoNaFaixa(-50, 0.30),
            this.pista.pontoNaFaixa(-50, 0.70)
        ];

        const marcasParaIA = Phaser.Utils.Array.Shuffle(MARCAS_DISPONIVEIS.filter(m => m.nome !== JogoState.marcaJogador)).slice(0, 3);
        const marcaJogador = MARCAS_DISPONIVEIS.find(m => m.nome === JogoState.marcaJogador) || MARCAS_DISPONIVEIS[0];
        const MARCAS_CORRIDA = [marcaJogador, ...marcasParaIA];

        // adversários com níveis diferentes de habilidade — não são todos iguais
        const NIVEIS_IA = ['Fácil', 'Médio', 'Difícil'];

        for (let i = 0; i < MARCAS_CORRIDA.length; i++) {
            const t = criarTampinha(this, MARCAS_CORRIDA[i], posicoesLargada[i], this.pista);
            if (i > 0) t.nivelIA = NIVEIS_IA[(i - 1) % NIVEIS_IA.length];
            this.tampinhas.push(t);
        }

        this.jogador = this.tampinhas[0];

        this.jogador.setInteractive(
            new Phaser.Geom.Circle(38, 38, 33),
            Phaser.Geom.Circle.Contains
        );
        this.input.setDraggable(this.jogador);
        this.atualizarInteratividadeJogador();

        const grupoTampinhas = this.physics.add.group(this.tampinhas);
        this.physics.add.collider(grupoTampinhas, grupoTampinhas, (a, b) => {
            CollisionManager.resolveCapCollision(a, b);
            SomFX.colisao();
            this.cameras.main.shake(120, 0.006);
        });
        // sem collider contra a pista: a borda é "mole" (ver CollisionManager.aplicarBordaPista,
        // chamado a cada frame no update()) — não uma parede rígida do Arcade.

        // ---------- câmera: corta na hora pro competidor da vez e acompanha suavemente ----------
        this.cameras.main.centerOn(this.jogador.x, this.jogador.y);
        this.cameraAlvo = this.jogador;
        this.cameras.main.startFollow(this.jogador, true, 0.09, 0.09);

        // ---------- minimapa (canto superior direito, fixo na tela) ----------
        this.criarMinimapa();

        // ---------- sistema de turnos: um peteleco por vez, revezando entre os 4 ----------
        this.turnoAtual = Phaser.Math.Between(0, this.tampinhas.length - 1);
        this.aguardandoParada = false;

        const podeJogadorJogar = () =>
            this.turnoAtual === 0 && !this.aguardandoParada && this.corridaLiberada && !this.vencedor;

        this.input.on('dragstart', (pointer, gameObject) => {
            if (!podeJogadorJogar()) return;
            this.isDragging = true;
            this.dragStart = { x: gameObject.x, y: gameObject.y };
            this.linhaForca.setVisible(true);
        });

        this.input.on('drag', (pointer, gameObject, dragX, dragY) => {
            if (!podeJogadorJogar()) return;
            const dx = dragX - this.dragStart.x;
            const dy = dragY - this.dragStart.y;
            const distancia = Phaser.Math.Distance.Between(0, 0, dx, dy);

            if (distancia > this.DISTANCIA_MAXIMA) {
                const angulo = Math.atan2(dy, dx);
                gameObject.x = this.dragStart.x + Math.cos(angulo) * this.DISTANCIA_MAXIMA;
                gameObject.y = this.dragStart.y + Math.sin(angulo) * this.DISTANCIA_MAXIMA;
            } else {
                gameObject.x = dragX;
                gameObject.y = dragY;
            }

            const distanciaFinal = Phaser.Math.Distance.Between(this.dragStart.x, this.dragStart.y, gameObject.x, gameObject.y);
            const forcaRel = Phaser.Math.Clamp(distanciaFinal / this.DISTANCIA_MAXIMA, 0, 1);
            const cor = Phaser.Display.Color.Interpolate.ColorWithColor(
                Phaser.Display.Color.ValueToColor(0x2ecc71),
                Phaser.Display.Color.ValueToColor(0xe74c3c),
                100, forcaRel * 100
            );
            this.linhaForca.setStrokeStyle(3 + forcaRel * 4, Phaser.Display.Color.GetColor(cor.r, cor.g, cor.b));
            this.linhaForca.setTo(this.dragStart.x, this.dragStart.y, gameObject.x, gameObject.y);
        });

        this.input.on('dragend', (pointer, gameObject) => {
            if (!podeJogadorJogar()) return;
            this.isDragging = false;
            this.linhaForca.setVisible(false);

            SomFX.peteleco();

            const dx = this.dragStart.x - gameObject.x;
            const dy = this.dragStart.y - gameObject.y;
            const distancia = Phaser.Math.Distance.Between(0, 0, dx, dy);

            const forca = Phaser.Math.Clamp(
                (distancia / this.DISTANCIA_MAXIMA) * this.FORCA_MAXIMA,
                0,
                this.FORCA_MAXIMA
            );

            const angulo = Math.atan2(dy, dx);

            gameObject.body.setVelocity(
                Math.cos(angulo) * forca,
                Math.sin(angulo) * forca
            );
            CapPhysics.onImpulse(gameObject, forca);

            gameObject.x = this.dragStart.x;
            gameObject.y = this.dragStart.y;

            this.aguardandoParada = true;
        });

        this.linhaForca = this.add.line(0, 0, 0, 0, 0, 0, 0x2ecc71);
        this.linhaForca.setLineWidth(3);
        this.linhaForca.setVisible(false);
        this.linhaForca.setScrollFactor(1);

        this.textoVencedor = this.add.text(400, 60, '', {
            fontSize: '32px',
            fontFamily: 'Arial',
            color: '#ffff00',
            backgroundColor: '#000000',
            padding: { x: 10, y: 6 }
        }).setOrigin(0.5).setScrollFactor(0).setDepth(1000).setVisible(false);

        this.textoTurno = this.add.text(400, 30, '', {
            fontSize: '20px',
            fontFamily: FONTE_TITULO || 'Arial',
            fontStyle: '600',
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 4
        }).setOrigin(0.5).setScrollFactor(0).setDepth(1000).setVisible(false);

        this.textoContagem = this.add.text(400, 330, '', {
            fontSize: '80px',
            fontFamily: 'Arial',
            color: '#ffffff',
            fontStyle: 'bold'
        }).setOrigin(0.5).setScrollFactor(0).setDepth(1000);

        this.botaoReiniciar = this.add.text(400, 570, '🔄 Reiniciar', {
            fontSize: '24px',
            fontFamily: 'Arial',
            color: '#ffffff',
            backgroundColor: '#333333',
            padding: { x: 16, y: 8 }
        }).setOrigin(0.5).setScrollFactor(0).setDepth(1000).setInteractive({ useHandCursor: true }).setVisible(false);

        this.botaoReiniciar.on('pointerdown', () => {
            this.scene.restart();
        });

        this.botaoMenu = this.add.text(600, 570, 'Menu', {
            fontSize: '24px',
            fontFamily: 'Arial',
            color: '#ffffff',
            backgroundColor: '#333333',
            padding: { x: 16, y: 8 }
        }).setOrigin(0.5).setScrollFactor(0).setDepth(1000).setInteractive({ useHandCursor: true }).setVisible(false);

        this.botaoMenu.on('pointerdown', () => {
            this.scene.start('MenuScene');
        });

        this.iniciarContagem();
    }

    // ---------- minimapa: contorno fixo da pista + um ponto por tampinha ----------
    criarMinimapa() {
        const box = { x: 640, y: 16, w: 144, h: 110 };
        this.minimapaEscala = { x: box.w / MUNDO_LARGURA, y: box.h / MUNDO_ALTURA, box };

        const fundo = this.add.rectangle(box.x + box.w / 2, box.y + box.h / 2, box.w + 8, box.h + 8, 0x000000, 0.45)
            .setScrollFactor(0).setDepth(999).setStrokeStyle(2, 0xffffff, 0.6);

        const contorno = this.add.graphics().setScrollFactor(0).setDepth(999);
        contorno.lineStyle(1.5, 0xffffff, 0.8);
        const desenhaContorno = (chave) => {
            contorno.beginPath();
            this.pista.lut.forEach((p, i) => {
                const mx = box.x + p[chave + 'X'] * this.minimapaEscala.x;
                const my = box.y + p[chave + 'Y'] * this.minimapaEscala.y;
                if (i === 0) contorno.moveTo(mx, my); else contorno.lineTo(mx, my);
            });
            contorno.closePath();
            contorno.strokePath();
        };
        desenhaContorno('ext');
        desenhaContorno('int');
    }

    atualizarMinimapa() {
        const { box, x: ex, y: ey } = this.minimapaEscala;
        this.tampinhas.forEach(t => {
            if (!t.pontoMinimapa) {
                t.pontoMinimapa = this.add.circle(0, 0, t === this.jogador ? 4 : 3, t.corBase)
                    .setScrollFactor(0).setDepth(1000)
                    .setStrokeStyle(1, t === this.jogador ? 0xffffff : 0x000000, 0.9);
            }
            t.pontoMinimapa.x = box.x + t.x * ex;
            t.pontoMinimapa.y = box.y + t.y * ey;
        });
    }

    atualizarInteratividadeJogador() {
        const podeJogar = this.turnoAtual === 0 && this.corridaLiberada && !this.vencedor;
        if (podeJogar) {
            this.jogador.setInteractive(); // reaproveita a hit area circular já configurada
            this.input.setDraggable(this.jogador);
        } else {
            this.jogador.disableInteractive();
        }
    }

    // move a câmera na hora pro competidor da vez, depois acompanha suavemente enquanto ele desliza
    focarCameraNoTurno() {
        const alvo = this.tampinhas[this.turnoAtual];
        this.cameraAlvo = alvo;
        this.cameras.main.stopFollow();
        this.cameras.main.pan(alvo.x, alvo.y, 450, 'Sine.easeInOut', true);
        this.time.delayedCall(460, () => {
            if (this.cameraAlvo === alvo) {
                this.cameras.main.startFollow(alvo, true, 0.09, 0.09);
            }
        });
    }

    iniciarContagem() {
        const passos = ['3', '2', '1', 'Vai!'];
        let i = 0;

        this.textoContagem.setText(passos[i]);

        this.time.addEvent({
            delay: 800,
            repeat: passos.length - 1,
            callback: () => {
                i++;
                if (i < passos.length) {
                    this.textoContagem.setText(passos[i]);
                }
                if (i === passos.length - 1) {
                    this.corridaLiberada = true;
                    this.time.delayedCall(600, () => this.textoContagem.setText(''));
                    this.atualizarTextoTurno();
                    this.atualizarInteratividadeJogador();
                    this.focarCameraNoTurno();

                    if (this.turnoAtual !== 0) {
                        this.time.delayedCall(Phaser.Math.Between(700, 1100), () => this.iaFazerJogada());
                    }
                }
            }
        });
    }

    atualizarTextoTurno() {
        if (this.vencedor) { this.textoTurno.setVisible(false); return; }
        const nomeAtual = this.tampinhas[this.turnoAtual].nome;
        this.textoTurno.setText(this.turnoAtual === 0 ? 'Sua vez!' : ` Vez de ${nomeAtual}...`);
        this.textoTurno.setVisible(true);
    }

    // cada IA usa seu próprio nível (Fácil/Médio/Difícil) pra decidir direção e força —
    // mira num ponto à frente na linha central da pista, freia antes de curvas fechadas e
    // corrige se estiver perto demais da borda (ver AIRacer.decideMove)
    iaFazerJogada() {
        if (this.vencedor) return;

        const ia = this.tampinhas[this.turnoAtual];
        const decisao = AIRacer.decideMove(ia, this.pista, ia.nivelIA, this.tampinhas);

        ia.body.setVelocity(
            decisao.dirX * decisao.força,
            decisao.dirY * decisao.força
        );
        CapPhysics.onImpulse(ia, decisao.força);

        SomFX.peteleco();
        this.aguardandoParada = true;
    }

    // detecta quando as tampinhas pararam de se mover pra liberar o próximo turno
    verificarFimDeTurno() {
        if (!this.aguardandoParada || this.vencedor) return;

        const todasPararam = this.tampinhas.every(t => {
            const v = Phaser.Math.Distance.Between(0, 0, t.body.velocity.x, t.body.velocity.y);
            return v < this.VELOCIDADE_MINIMA_PARADA;
        });
        if (!todasPararam) return;

        this.tampinhas.forEach(t => t.body.setVelocity(0, 0));
        this.aguardandoParada = false;
        this.turnoAtual = (this.turnoAtual + 1) % this.tampinhas.length;
        this.atualizarTextoTurno();
        this.atualizarInteratividadeJogador();
        this.focarCameraNoTurno();

        if (this.turnoAtual !== 0) {
            this.time.delayedCall(Phaser.Math.Between(700, 1100), () => this.iaFazerJogada());
        }
    }

    update() {
        this.tampinhas.forEach(t => {
            if (t.sombra) {
                t.sombra.x = t.x + 4;
                t.sombra.y = t.y + 6;
            }

            if (t.body && t.rastro) {
                const velocidade = Phaser.Math.Distance.Between(0, 0, t.body.velocity.x, t.body.velocity.y);
                if (velocidade > 60) {
                    t.rastro.start();
                } else {
                    t.rastro.stop();
                }
            }
        });

        this.atualizarMinimapa();

        if (this.vencedor) return;

        // atrito real de todas as tampinhas (ver CapPhysics) — chamado 1x por frame, sempre
        CapPhysics.updateAll(this, this.tampinhas);

        this.verificarFimDeTurno();

        this.tampinhas.forEach(t => {
            const status = calcularStatusNaPista(this.pista, t.x, t.y);

            // borda "mole": segura petelecos normais (perdem velocidade e continuam na pista),
            // deixa os fortes atravessarem — nunca é uma parede rígida
            CollisionManager.aplicarBordaPista(t, status);

            if (!status.dentro) {
                // fora da pista de verdade: chão irregular (grama/terra), sem teleporte —
                // só a consequência natural de estar fora do cimento, perdendo velocidade
                // mais rápido e sem ganhar progresso na volta enquanto estiver lá fora.
                t.body.velocity.x *= 0.965;
                t.body.velocity.y *= 0.965;
                t.foraDaPista = true;
            } else {
                if (t.foraDaPista) {
                    // acabou de voltar pra pista: resincroniza sem contar o salto como progresso
                    t.sAnterior = status.s;
                } else {
                    const delta = diferencaS(status.s, t.sAnterior, this.pista.comprimentoTotal);
                    t.progressoAcumulado += delta;
                    t.sAnterior = status.s;
                }
                t.foraDaPista = false;

                // zona molhada da mangueira: devagar ali, a água empurra a tampinha pra fora
                const diffAgua = diferencaS(status.s, this.zonaAgua.sCentro, this.pista.comprimentoTotal);
                if (Math.abs(diffAgua) < this.zonaAgua.meiaFaixaS) {
                    const velocidade = Phaser.Math.Distance.Between(0, 0, t.body.velocity.x, t.body.velocity.y);
                    if (velocidade > 4 && velocidade < this.zonaAgua.limiarVelocidade) {
                        const fatorEscorregao = 1 - (velocidade / this.zonaAgua.limiarVelocidade);
                        const empurrao = fatorEscorregao * 5.5;
                        t.body.velocity.x += status.nx * empurrao;
                        t.body.velocity.y += status.ny * empurrao;

                        if (!t.molhando) {
                            t.molhando = true;
                            SomFX.escorregar();
                            this.time.delayedCall(500, () => { t.molhando = false; });
                        }
                    }
                }

                // trecho de grama/terra: mais atrito, a tampinha perde força mais rápido ali
                const diffAreia = diferencaS(status.s, this.zonaAreia.sCentro, this.pista.comprimentoTotal);
                if (Math.abs(diffAreia) < this.zonaAreia.meiaFaixaS) {
                    t.body.velocity.x *= 0.965;
                    t.body.velocity.y *= 0.965;
                }
            }

            if (t.progressoAcumulado >= this.pista.comprimentoTotal && !this.vencedor) {
                this.vencedor = t.nome;
                this.tampinhaVencedora = t;
                this.atualizarInteratividadeJogador();
            }
        });

        if (this.vencedor) {
            SomFX.vitoria();

            this.cameras.main.stopFollow();
            this.cameras.main.pan(this.tampinhaVencedora.x, this.tampinhaVencedora.y, 500, 'Sine.easeInOut');

            const corVencedor = this.tampinhaVencedora.corBase;
            const explosao = this.add.particles(
                this.tampinhaVencedora.x,
                this.tampinhaVencedora.y,
                criarTexturaParticula(this, 'particulaExplosao', corVencedor),
                {
                    lifespan: 700,
                    speed: { min: 100, max: 300 },
                    scale: { start: 1, end: 0 },
                    alpha: { start: 1, end: 0 },
                    quantity: 30,
                    emitting: false
                }
            );
            explosao.explode(30);

            this.textoTurno.setVisible(false);
            this.textoVencedor.setText('🏆 ' + this.vencedor + ' venceu!');
            this.textoVencedor.setVisible(true);
            this.botaoReiniciar.setVisible(true);
            this.botaoMenu.setVisible(true);
            this.tampinhas.forEach(t => {
                t.body.setVelocity(0, 0);
                if (t.rastro) t.rastro.stop();
            });
        }
    }
}
