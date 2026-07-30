

const AIRacer = {
    NIVEIS: {
        // agressividade: intensidade geral (curvas, ultrapassagem); chanceAtaque: prob. de
        // avaliar um ataque neste turno; precisao: 0-1, quão perto do flanco ideal a mira cai
        'Fácil':   { forcaMin: 480, forcaMax: 700, agressividade: 0.5,  chanceAtaque: 0.25, precisao: 0.6 },
        'Médio':   { forcaMin: 600, forcaMax: 820, agressividade: 0.8,  chanceAtaque: 0.55, precisao: 0.8 },
        'Difícil': { forcaMin: 700, forcaMax: 900, agressividade: 1.15, chanceAtaque: 0.9,  precisao: 0.97 }
    },

    RAIO_TAMPINHA: 30,
    ALCANCE_MAX_ATAQUE: 620,    // ~ distância que um peteleco forte percorre antes do atrito parar
    ALCANCE_ATRAS_ATAQUE: 130, // também vale bater em quem está logo atrás tentando ultrapassar

    decideMove(ia, pista, nivel = 'Médio', outros = []) {
        const cfg = this.NIVEIS[nivel] || this.NIVEIS['Médio'];
        const status = calcularStatusNaPista(pista, ia.x, ia.y);

        // ---------- fora da pista: prioridade é voltar, não seguir em frente nem atacar ----------
        if (!status.dentro) {
            const alvoRecuperacao = pista.amostraEmS(status.s); // ponto central bem ali do lado
            const dx = alvoRecuperacao.x - ia.x, dy = alvoRecuperacao.y - ia.y;
            const norm = Math.hypot(dx, dy) || 1;
            return {
                dirX: dx / norm, dirY: dy / norm,
                força: Phaser.Math.Between(cfg.forcaMin * 0.7, cfg.forcaMin * 1.1)
            };
        }

        // ---------- avalia oportunidade de ataque antes de qualquer coisa ----------
        const alvo = this.escolherAlvoDeAtaque(ia, status, pista, cfg, outros);
        if (alvo) {
            return this.montarTiroDeAtaque(ia, alvo, cfg);
        }

        // ---------- curvatura à frente, pra saber se deve frear ----------
        const LOOKAHEAD_CURVA = 230;
        const amostraAtual = pista.lut[status.indice];
        const amostraCurva = pista.amostraEmS(status.s + LOOKAHEAD_CURVA);
        const severidadeCurva = Math.abs(normalizarAngulo(amostraCurva.tangente - amostraAtual.tangente));
        const curvFactor = Phaser.Math.Clamp(1 - severidadeCurva * 1.2, 0.75, 1);

        // ---------- quão perto da borda está (pra reagir mais rápido se estiver quase saindo) ----------
        const proximidadeBorda = Phaser.Math.Clamp(Math.abs(status.lateral) / (pista.largura / 2), 0, 1);

        // ---------- ponto-alvo: centro da pista, um pouco à frente (mais perto se estiver
        // quase saindo da faixa — corrige com mais urgência) ----------
        const LOOKAHEAD_MIRA_BASE = 260 + cfg.agressividade * 60;
        const lookaheadEfetivo = Phaser.Math.Linear(LOOKAHEAD_MIRA_BASE, LOOKAHEAD_MIRA_BASE * 0.4, proximidadeBorda);
        const pontoAlvo = pista.pontoNaFaixa(status.s + lookaheadEfetivo, 0.5);

        // ---------- ultrapassagem: se tem alguém logo à frente, mira um pouco pro lado livre ----------
        let ajusteLateral = 0;
        outros.forEach(o => {
            if (o === ia) return;
            const stO = calcularStatusNaPista(pista, o.x, o.y);
            const diffS = diferencaS(stO.s, status.s, pista.comprimentoTotal);
            if (diffS > 0 && diffS < 260) {
                ajusteLateral = -Math.sign(stO.lateral || 1) * pista.largura * 0.22 * cfg.agressividade;
            }
        });
        if (ajusteLateral !== 0) {
            pontoAlvo.x += amostraAtual.nx * ajusteLateral;
            pontoAlvo.y += amostraAtual.ny * ajusteLateral;
        }

        const dx = pontoAlvo.x - ia.x, dy = pontoAlvo.y - ia.y;
        const norm = Math.hypot(dx, dy) || 1;

        let força = Phaser.Math.Between(cfg.forcaMin, cfg.forcaMax) * curvFactor;
        força *= Phaser.Math.Linear(1, 0.92, proximidadeBorda); // cautela mínima perto da borda

        return { dirX: dx / norm, dirY: dy / norm, força };
    },

    // avalia todos os adversários ao alcance e escolhe o melhor alvo pra bater agora — ou null
    // se nenhum valer a pena (aí a IA só corre normal). Prioriza: quem está à frente na corrida
    // (tirar ele do caminho ajuda a ultrapassar), quem já está perto da borda (fácil de empurrar
    // de vez pra fora) e quem está mais perto fisicamente (peteleco chega com mais força sobrando).
    escolherAlvoDeAtaque(ia, status, pista, cfg, outros) {
        if (Math.random() > cfg.chanceAtaque) return null; // nem todo turno é ataque — também precisa correr

        let melhor = null, melhorPontuacao = -Infinity;

        outros.forEach(o => {
            if (o === ia) return;
            const stO = calcularStatusNaPista(pista, o.x, o.y);
            if (!stO.dentro) return; // já tá fora da pista, não vale gastar peteleco nele

            const diffS = diferencaS(stO.s, status.s, pista.comprimentoTotal);
            const distReal = Phaser.Math.Distance.Between(ia.x, ia.y, o.x, o.y);
            const aoAlcance = diffS >= -this.ALCANCE_ATRAS_ATAQUE && diffS <= this.ALCANCE_MAX_ATAQUE
                && distReal <= this.ALCANCE_MAX_ATAQUE * 1.15;
            if (!aoAlcance) return;

            // quão perto da borda o alvo já está — quanto mais perto, mais fácil eliminar de vez
            const proximidadeBordaAlvo = Phaser.Math.Clamp(Math.abs(stO.lateral) / (pista.largura / 2), 0, 1);

            const pontuacao =
                (diffS > 0 ? 1.3 : 0.9) +                 // à frente vale mais que defender por trás
                proximidadeBordaAlvo * 2.2 +               // perto da borda = alvo fácil de eliminar
                Phaser.Math.Linear(1, 0, Phaser.Math.Clamp(distReal / this.ALCANCE_MAX_ATAQUE, 0, 1));

            if (pontuacao > melhorPontuacao) {
                melhorPontuacao = pontuacao;
                melhor = { alvo: o, status: stO };
            }
        });

        // só ataca se realmente valer a pena — evita gastar o peteleco num alvo ruim/longe demais
        return (melhor && melhorPontuacao > 1.4) ? melhor : null;
    },

    // mira pro flanco do alvo oposto ao lado que ele já está pendendo — bater ali empurra o
    // alvo pra fora da pista, feito uma tacada de bilhar (o impacto empurra ele pro lado que
    // ele já estava mais perto de sair). Níveis com menos precisão erram a mira por mais.
    montarTiroDeAtaque(ia, alvoInfo, cfg) {
        const { alvo, status: stO } = alvoInfo;

        const ladoParaEmpurrar = Math.sign(stO.lateral) || 1;
        const offsetFlanco = this.RAIO_TAMPINHA * 0.85 * -ladoParaEmpurrar;

        const erroMira = (1 - cfg.precisao) * this.RAIO_TAMPINHA * 2.5;
        const jitterX = Phaser.Math.FloatBetween(-erroMira, erroMira);
        const jitterY = Phaser.Math.FloatBetween(-erroMira, erroMira);

        const pontoMira = {
            x: alvo.x + stO.nx * offsetFlanco + jitterX,
            y: alvo.y + stO.ny * offsetFlanco + jitterY
        };

        const dx = pontoMira.x - ia.x, dy = pontoMira.y - ia.y;
        const norm = Math.hypot(dx, dy) || 1;

        // ataque é sempre com força alta — a ideia é maximizar o impacto, não economizar peteleco
        const força = Phaser.Math.Between(cfg.forcaMax * 0.9, cfg.forcaMax);

        return { dirX: dx / norm, dirY: dy / norm, força };
    }
};

if (typeof module !== 'undefined') module.exports = AIRacer; // CommonJS fallback
window.AIRacer = AIRacer;
