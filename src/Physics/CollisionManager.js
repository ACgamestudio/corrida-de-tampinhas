/* CollisionManager: resposta de colisão tampinha-tampinha e a "borda mole" da pista.

   A pista NÃO tem parede física rígida (ver Track.js — não existe mais criarParedesPista
   com corpos estáticos). A borda é só uma linha desenhada; o comportamento dela — segurar
   petelecos fracos, deixar os fortes passarem, permitir empurrar o adversário pra fora — é
   toda feita aqui, em cima da posição/velocidade real da tampinha a cada frame.
*/

const CollisionManager = {
    // ---------- tampinha vs tampinha ----------
    // O Arcade já resolveu a sobreposição e aplicou sua resposta padrão antes deste callback
    // rodar; aqui a gente reforça o impulso (pra parecer batida de metal, não toque de pluma),
    // e adiciona um giro visual proporcional à "pancada de lado" do impacto.
    resolveCapCollision(a, b) {
        const dx = b.x - a.x, dy = b.y - a.y;
        const dist = Math.hypot(dx, dy) || 1;
        const nx = dx / dist, ny = dy / dist;

        const rvx = b.body.velocity.x - a.body.velocity.x;
        const rvy = b.body.velocity.y - a.body.velocity.y;
        const velNormal = rvx * nx + rvy * ny; // >0 = já se separando (b se afasta de a)
        const velRelTotal = Math.hypot(rvx, rvy); // "energia" do impacto, sem depender do ângulo exato

        if (velRelTotal > 20) {
            // Duas fontes de empurrão, e usamos a MAIOR das duas:
            // 1) amplifica a separação que o Arcade já calculou (bom pra batidas quase de frente)
            // 2) um empurrão mínimo baseado na velocidade relativa TOTAL do impacto (garante que
            //    batidas de raspão — onde a componente ao longo da normal é pequena mas a
            //    velocidade real do choque é alta — também derrubem a tampinha atingida)
            const BOOST = 1.9;
            const porSeparacao = Math.max(velNormal, 0) * (BOOST - 1);
            const porEnergia = velRelTotal * 0.85;
            const impulso = Math.max(porSeparacao, porEnergia) / 2;

            a.body.velocity.x -= nx * impulso;
            a.body.velocity.y -= ny * impulso;
            b.body.velocity.x += nx * impulso;
            b.body.velocity.y += ny * impulso;
        }

        // giro visual (cosmético, não mexe na física): impacto fora do centro — a componente
        // tangencial da velocidade relativa — faz cada tampinha "torcer" um pouco, dando a
        // sensação de peso e de impacto real baseado no ângulo da batida.
        const tx = -ny, ty = nx;
        const velTangencial = rvx * tx + rvy * ty;
        const GIRO = 0.0025;
        a.rotation -= velTangencial * GIRO;
        b.rotation += velTangencial * GIRO;

        if (window.CapPhysics) {
            CapPhysics.onImpulse(a);
            CapPhysics.onImpulse(b);
        }
    },

    // ---------- borda "mole" da pista ----------
    // status vem de calcularStatusNaPista(pista, t.x, t.y). Chamar 1x por tampinha por frame,
    // sempre (não só quando já está fora) — o próprio "alemDaBorda" cuida de não fazer nada
    // enquanto a tampinha estiver bem dentro da faixa.
    LIMIAR_ATRAVESSAR: 260, // px/s — abaixo disso a borda seve como freio; acima, ela cede
    ZONA_DEGRAU: 30,        // px além da linha onde o "degrau" ainda segura

    aplicarBordaPista(t, status) {
        const alem = status.alemDaBorda;
        if (alem <= 0) return { bateu: false, atravessou: false };

        const v = Math.hypot(t.body.velocity.x, t.body.velocity.y);
        const lado = status.lateral >= 0 ? 1 : -1; // de que lado da faixa ela saiu

        if (v < this.LIMIAR_ATRAVESSAR || alem > this.ZONA_DEGRAU * 3) {
            // peteleco normal: a borda segura — remove a componente de velocidade que ainda
            // aponta pra fora, dá um empurrãozinho de volta pra dentro da faixa, e tira uma
            // boa parte da energia (bateu num degrauzinho, não é elástico feito parede de borracha)
            const compForaX = t.body.velocity.x * status.nx * lado;
            const compForaY = t.body.velocity.y * status.ny * lado;
            const compFora = compForaX + compForaY;
            if (compFora > 0) {
                t.body.velocity.x -= status.nx * lado * compFora * 1.4;
                t.body.velocity.y -= status.ny * lado * compFora * 1.4;
            }

            const empurrao = Math.min(alem, this.ZONA_DEGRAU) * 5;
            t.body.velocity.x -= status.nx * lado * empurrao;
            t.body.velocity.y -= status.ny * lado * empurrao;

            t.body.velocity.x *= 0.7;
            t.body.velocity.y *= 0.7;

            return { bateu: true, atravessou: false };
        }

        // forte o bastante pra atravessar: deixa passar (ela sai da pista de verdade), mas
        // "pular o degrau" ainda custa um pouco de velocidade — não é totalmente de graça
        t.body.velocity.x *= 0.9;
        t.body.velocity.y *= 0.9;
        return { bateu: false, atravessou: true };
    }
};

if (typeof module !== 'undefined') module.exports = CollisionManager;
window.CollisionManager = CollisionManager;
