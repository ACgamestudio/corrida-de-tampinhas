/* AIRacer: decisões de peteleco pros adversários.
   API: AIRacer.decideMove(ia, pista, nivel, outros) -> { dirX, dirY, força }

   Ideia central: em vez de "sempre indo pra baixo" ou só seguindo a tangente do ponto atual,
   a IA mira num ponto um pouco à frente NA LINHA CENTRAL da pista (técnica de "perseguição",
   comum em IA de corrida). Isso sozinho já resolve a maior parte do trabalho: como a pista
   curva, o ponto-alvo também curva, então o peteleco naturalmente acompanha a curva; e se a
   tampinha estiver fora do centro da faixa, mirar no centro à frente já puxa ela de volta.
*/

const AIRacer = {
    NIVEIS: {
        'Fácil':   { forcaMin: 480, forcaMax: 700, agressividade: 0.5 },
        'Médio':   { forcaMin: 600, forcaMax: 820, agressividade: 0.8 },
        'Difícil': { forcaMin: 700, forcaMax: 900, agressividade: 1.15 }
    },

    decideMove(ia, pista, nivel = 'Médio', outros = []) {
        const cfg = this.NIVEIS[nivel] || this.NIVEIS['Médio'];
        const status = calcularStatusNaPista(pista, ia.x, ia.y);

        // ---------- fora da pista: prioridade é voltar, não seguir em frente ----------
        if (!status.dentro) {
            const alvoRecuperacao = pista.amostraEmS(status.s); // ponto central bem ali do lado
            const dx = alvoRecuperacao.x - ia.x, dy = alvoRecuperacao.y - ia.y;
            const norm = Math.hypot(dx, dy) || 1;
            return {
                dirX: dx / norm, dirY: dy / norm,
                força: Phaser.Math.Between(cfg.forcaMin * 0.7, cfg.forcaMin * 1.1)
            };
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
    }
};

if (typeof module !== 'undefined') module.exports = AIRacer;
window.AIRacer = AIRacer;

if (typeof module !== 'undefined') module.exports = AIRacer;
window.AIRacer = AIRacer;
