// ---------- Cena da corrida: pista grande, câmera acompanhando, 4 tampinhas na disputa ----------
class GameScene extends Phaser.Scene {
    constructor() {
        super('CorridaScene');
    }

    preload() {
        this.load.image('fundoPista', 'assets/images/garage_bg.png');
        this.load.spritesheet('mao_peteleco_anim', 'assets/images/mao_peteleco_anim.png', { frameWidth: 150, frameHeight: 245 });
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

        // manchas de óleo na pista: ali o atrito quase some e a tampinha escorrega bem mais
        // longe (e um pouco pro lado, de forma imprevisível) — duas manchas em pontos
        // diferentes da volta, localizadas por posição ao longo do traçado (s)
        this.zonasOleo = [
            { sCentro: this.pista.comprimentoTotal * 0.28, meiaFaixaS: 80 },
            { sCentro: this.pista.comprimentoTotal * 0.68, meiaFaixaS: 95 }
        ];

        this.FORCA_MAXIMA = 900;
        this.DISTANCIA_MAXIMA = 140;
        this.VELOCIDADE_MINIMA_PARADA = 5;
        this.PENALIDADE_RETROCESSO_PX = 900; // sair da pista custa 900px de volta na volta

        // ---------- mundo grande + câmera acompanhando quem está jogando ----------
        this.physics.world.setBounds(0, 0, MUNDO_LARGURA, MUNDO_ALTURA);
        this.cameras.main.setBounds(0, 0, MUNDO_LARGURA, MUNDO_ALTURA);

        // a foto tem só 1408x768 — qualquer ampliação borra ela. Mosaico em escala 1:1
        // (tamanho real, sem ampliar nada) pra manter nítida; ela só se repete mais vezes
        // pelo mundo (a maior parte da área de jogo já é coberta pela cor sólida da pista).
        this.add.tileSprite(0, 0, MUNDO_LARGURA, MUNDO_ALTURA, 'fundoPista')
            .setOrigin(0, 0)
            .setTileScale(1, 1);
        desenharPista(this, this.pista);
        this.zonasOleo.forEach(zona => desenharZonaOleo(this, this.pista, zona));

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

        // IMPORTANTE: `physics.add.group(...)` reaplica os valores "padrão" do grupo em cada
        // membro assim que ele entra — inclusive bounce (volta pra 0), collideWorldBounds
        // (volta pra false) e massa (volta pra 1) — mesmo já tendo sido configurados em
        // criarTampinha(). É um comportamento interno do Phaser (PhysicsGroup.createCallbackHandler)
        // que sobrescreve silenciosamente essas propriedades. Sem isso, a colisão vira "grudenta"
        // (bounce 0) e todas as tampinhas pesam igual (massa 1), perdendo a identidade de peso
        // que cada marca deveria ter. Reaplicando aqui, depois do grupo já existir.
        this.tampinhas.forEach(t => {
            t.body.setBounce(0.55);
            t.body.setCollideWorldBounds(true);
            t.body.setMass(t._massaOriginal);
        });

        this.physics.add.collider(grupoTampinhas, grupoTampinhas, (a, b) => {
            const impacto = CollisionManager.resolveCapCollision(a, b);
            SomFX.colisao((a.pitchSom + b.pitchSom) / 2);

            // tremor de câmera proporcional à força real da batida: um toque leve mal chacoalha,
            // uma pancada forte sacode de verdade — sem exagero em nenhum dos dois extremos
            const intensidade = Phaser.Math.Clamp(impacto / 850, 0, 1);
            this.cameras.main.shake(80 + intensidade * 100, 0.002 + intensidade * 0.01);

            // faíscas só nas batidas fortes — metal batendo em metal de verdade
            if (impacto > 260) {
                this.criarFaiscas((a.x + b.x) / 2, (a.y + b.y) / 2, intensidade);
            }
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
            this.maoPeteleco.setFrame(0);
            this.maoPeteleco.setVisible(true);
            this.setaDirecao.setVisible(true);
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
            const corHex = Phaser.Display.Color.GetColor(cor.r, cor.g, cor.b);

            // ângulo de disparo: pra onde a tampinha vai voar quando soltar (oposto do puxão)
            const anguloDisparo = Math.atan2(this.dragStart.y - gameObject.y, this.dragStart.x - gameObject.x);

            // mão: "segura" a tampinha na posição puxada, com o punho arrastando pro lado do puxão
            this.maoPeteleco.setPosition(gameObject.x, gameObject.y);
            this.maoPeteleco.setRotation(anguloDisparo + Math.PI / 2);

            // seta: começa um pouco à frente da posição de origem (onde a tampinha vai disparar
            // de fato) e aponta na direção do tiro; cresce e muda de cor conforme a força
            const RAIO_TAMPINHA = 30;
            this.setaDirecao.setPosition(
                this.dragStart.x + Math.cos(anguloDisparo) * (RAIO_TAMPINHA + 12),
                this.dragStart.y + Math.sin(anguloDisparo) * (RAIO_TAMPINHA + 12)
            );
            this.setaDirecao.setRotation(anguloDisparo);
            this.setaDirecao.setScale(0.7 + forcaRel * 1.2, 0.85 + forcaRel * 0.5);
            this.setaDirecao.setTint(corHex);
        });

        this.input.on('dragend', (pointer, gameObject) => {
            if (!podeJogadorJogar()) return;
            this.isDragging = false;
            this.setaDirecao.setVisible(false);

            SomFX.peteleco(gameObject.pitchSom);

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

            // poeira: só quando o peteleco sai forte de verdade — um tapa fraquinho não levanta pó
            if (forca > this.FORCA_MAXIMA * 0.55) {
                this.criarPoeira(this.dragStart.x, this.dragStart.y, angulo + Math.PI);
            }

            gameObject.x = this.dragStart.x;
            gameObject.y = this.dragStart.y;

            // toca a animação real do peteleco (o vídeo virando frames) bem na posição de
            // origem, e só esconde a mão quando ela terminar de "abrir" os dedos
            this.maoPeteleco.setPosition(this.dragStart.x, this.dragStart.y);
            this.maoPeteleco.play('peteleco_flick');
            this.maoPeteleco.once('animationcomplete', () => {
                this.maoPeteleco.setVisible(false);
                this.maoPeteleco.setFrame(0);
            });

            this.aguardandoParada = true;
        });

        // mão que "segura" a tampinha durante o arrasto + seta indicando a direção do disparo,
        // no lugar da linha reta de antes (ver handlers de drag acima)
        // sprite com os frames reais do vídeo (fundo removido): frame 0 é a pinça "segurando"
        // (mostrada durante o arrasto) e os frames seguintes são o peteleco abrindo de verdade,
        // tocados como animação na hora de soltar. Origem no ponto onde os dedos se tocam
        // (achado automaticamente detectando o "buraco" da pinça nos frames fechados), pra
        // girar em torno de onde ela seguraria a tampinha.
        this.maoPeteleco = this.add.sprite(0, 0, 'mao_peteleco_anim', 0)
            .setOrigin(0.33, 0.42).setScale(0.65).setDepth(500).setVisible(false).setScrollFactor(1);

        if (!this.anims.exists('peteleco_flick')) {
            this.anims.create({
                key: 'peteleco_flick',
                frames: this.anims.generateFrameNumbers('mao_peteleco_anim', { start: 0, end: 5 }),
                frameRate: 18,
                repeat: 0
            });
        }

        this.setaDirecao = this.add.image(0, 0, criarTexturaSeta(this))
            .setOrigin(0, 0.5).setDepth(500).setVisible(false).setScrollFactor(1);

        this.textoVencedor = this.add.text(480, 54, '', {
            fontSize: '32px',
            fontFamily: 'Arial',
            color: '#ffff00',
            backgroundColor: '#000000',
            padding: { x: 10, y: 6 }
        }).setOrigin(0.5).setScrollFactor(0).setDepth(1000).setVisible(false);

        this.textoTurno = this.add.text(480, 27, '', {
            fontSize: '20px',
            fontFamily: FONTE_TITULO || 'Arial',
            fontStyle: '600',
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 4
        }).setOrigin(0.5).setScrollFactor(0).setDepth(1000).setVisible(false);

        this.textoContagem = this.add.text(480, 270, '', {
            fontSize: '80px',
            fontFamily: 'Arial',
            color: '#ffffff',
            fontStyle: 'bold'
        }).setOrigin(0.5).setScrollFactor(0).setDepth(1000);

        this.botaoReiniciar = this.add.text(480, 510, '🔄 Reiniciar', {
            fontSize: '24px',
            fontFamily: 'Arial',
            color: '#ffffff',
            backgroundColor: '#333333',
            padding: { x: 16, y: 8 }
        }).setOrigin(0.5).setScrollFactor(0).setDepth(1000).setInteractive({ useHandCursor: true }).setVisible(false);

        this.botaoReiniciar.on('pointerdown', () => {
            this.scene.restart();
        });

        this.botaoMenu = this.add.text(720, 510, 'Menu', {
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
        const box = { x: 800, y: 16, w: 144, h: 110 };
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

    // ---------- faíscas: só nas batidas fortes entre tampinhas (metal contra metal) ----------
    criarFaiscas(x, y, intensidade) {
        const faiscas = this.add.particles(x, y, criarTexturaParticula(this, 'particulaFaisca', 0xfff2a8), {
            lifespan: { min: 140, max: 260 },
            speed: { min: 80, max: 180 + intensidade * 160 },
            scale: { start: 0.55, end: 0 },
            alpha: { start: 1, end: 0 },
            tint: [0xfff2a8, 0xffd24d],
            quantity: 1,
            emitting: false
        });
        faiscas.explode(Phaser.Math.Between(4, 6) + Math.round(intensidade * 4));
        this.time.delayedCall(300, () => faiscas.destroy());
    }

    // ---------- poeira: quando um peteleco sai forte o bastante pra "cavoucar" o cimento ----------
    criarPoeira(x, y, angulo) {
        const poeira = this.add.particles(x, y, criarTexturaParticula(this, 'particulaPoeira', 0xcfc9bd), {
            lifespan: { min: 250, max: 420 },
            speed: { min: 20, max: 70 },
            angle: { min: Phaser.Math.RadToDeg(angulo) - 40, max: Phaser.Math.RadToDeg(angulo) + 40 },
            scale: { start: 0.35, end: 0.9 },
            alpha: { start: 0.35, end: 0 },
            quantity: 1,
            emitting: false
        });
        poeira.explode(5);
        this.time.delayedCall(450, () => poeira.destroy());
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
                        this.time.delayedCall(this.atrasoIA(this.tampinhas[this.turnoAtual]), () => this.iaFazerJogada());
                    }
                }
            }
        });
    }

    // tempo de "reação" da IA antes de jogar — quanto mais difícil o nível, mais rápido ela age
    atrasoIA(t) {
        const FAIXAS = {
            'Fácil':   [900, 1400],
            'Médio':   [650, 1000],
            'Difícil': [350, 600]
        };
        const [min, max] = FAIXAS[t.nivelIA] || FAIXAS['Médio'];
        return Phaser.Math.Between(min, max);
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

        if (decisao.força > this.FORCA_MAXIMA * 0.55) {
            this.criarPoeira(ia.x, ia.y, Math.atan2(-decisao.dirY, -decisao.dirX));
        }

        SomFX.peteleco(ia.pitchSom);
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
            this.time.delayedCall(this.atrasoIA(this.tampinhas[this.turnoAtual]), () => this.iaFazerJogada());
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
            // enquanto o jogador está mirando (arrastando), a tampinha ainda não "correu" pra
            // lugar nenhum — ela só está sendo puxada pra trás na mão. Tratar isso como "saiu
            // da pista" fazia a punição (câmera tremendo, teleporte) disparar todo frame
            // enquanto a mira ficasse fora da faixa, num loop sem fim. Só valer depois de solta.
            if (this.isDragging && t === this.jogador) return;

            const status = calcularStatusNaPista(this.pista, t.x, t.y);

            // borda "mole": segura petelecos normais (perdem velocidade e continuam na pista),
            // deixa os fortes atravessarem — nunca é uma parede rígida
            CollisionManager.aplicarBordaPista(t, status);

            if (!status.dentro && !t.foraDaPista) {
                // acabou de sair da pista agora mesmo: penalidade — some no ponto de saída e
                // reaparece centralizada na faixa, PENALIDADE_RETROCESSO_PX pra trás (na volta),
                // parada. Não é gradual nem "escorregando pra fora"; é o castigo de ter saído.
                SomFX.foraDaPista();
                this.cameras.main.shake(160, 0.01);

                const sPunicao = status.s - this.PENALIDADE_RETROCESSO_PX;
                const posPenalidade = this.pista.pontoNaFaixa(sPunicao, 0.5);
                const amostraPunicao = this.pista.amostraEmS(sPunicao);

                t.body.setVelocity(0, 0);
                t.x = posPenalidade.x;
                t.y = posPenalidade.y;
                t.sAnterior = amostraPunicao.s;
                t.progressoAcumulado -= this.PENALIDADE_RETROCESSO_PX;
                t.foraDaPista = false; // já está de volta na pista, centralizada

                return; // já tratamos essa tampinha por completo neste quadro
            }

            if (!status.dentro) {
                // ainda fora (não é o quadro em que saiu — isso já foi punido acima): chão
                // irregular (grama/terra), perdendo velocidade mais rápido enquanto não volta
                t.body.velocity.x *= 0.965;
                t.body.velocity.y *= 0.965;
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

                // mancha de óleo: o atrito quase some ali — devolve parte do que o atrito
                // normal (CapPhysics) acabou de tirar nesse mesmo quadro, então a tampinha
                // escorrega bem mais longe. Também dá um empurrãozinho lateral aleatório
                // (pro lado que for, sorteado quando entra na mancha), simulando o
                // deslizamento imprevisível de pisar em óleo.
                const velocidade = Phaser.Math.Distance.Between(0, 0, t.body.velocity.x, t.body.velocity.y);
                const emAlgumaMancha = this.zonasOleo.some(
                    zona => Math.abs(diferencaS(status.s, zona.sCentro, this.pista.comprimentoTotal)) < zona.meiaFaixaS
                );

                if (emAlgumaMancha && velocidade > 4) {
                    t.body.velocity.x *= 1.045;
                    t.body.velocity.y *= 1.045;

                    if (!t.escorregandoOleo) {
                        t.escorregandoOleo = true;
                        t.direcaoEscorregaoOleo = Phaser.Math.RND.pick([-1, 1]);
                        SomFX.escorregar();
                        this.time.delayedCall(500, () => { t.escorregandoOleo = false; });
                    }

                    const empurraoLateral = t.direcaoEscorregaoOleo * 2.2;
                    t.body.velocity.x += status.nx * empurraoLateral;
                    t.body.velocity.y += status.ny * empurraoLateral;
                } else if (!emAlgumaMancha) {
                    t.escorregandoOleo = false;
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
