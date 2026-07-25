/* CapPhysics: atrito real das tampinhas sobre o cimento.
   Uso:
     CapPhysics.init(scene);
     CapPhysics.onImpulse(tampinha, forca); // registra um novo peteleco/impacto
     CapPhysics.updateAll(scene, tampinhas); // chamar 1x por frame, no update() da cena
*/

const CapPhysics = {
    init(scene) {
        this.scene = scene;

        // atrito "quase constante" (tipo atrito cinético real) — isso é o que faz a tampinha
        // desacelerar de forma previsível e parar de vez, em vez de deslizar pra sempre indo
        // cada vez mais devagar (a sensação de "gelo" que o drag exponencial do Arcade dava).
        this.ATRITO_CONSTANTE = 620; // px/s² — perda de velocidade constante por atrito

        // um pouco de arrasto proporcional à velocidade — dá uma sensação extra de controle
        // nos petelecos mais fortes (perdem um pouco mais de força no começo), sem tirar o
        // caráter "linear" do atrito constante.
        this.ARRASTO_PROPORCIONAL = 0.55; // por segundo

        // abaixo disso a tampinha já não está indo a lugar nenhum — zera de vez (mantém uma
        // pequena inércia até aqui, não trava de repente antes disso)
        this.LIMIAR_PARADA = 6; // px/s
    },

    // registra o momento/força de um novo impulso (peteleco ou colisão). Hoje serve sobretudo
    // pra CollisionManager e AIRacer saberem "há quanto tempo essa tampinha está em movimento",
    // mas mantém o hook aqui pra não espalhar esse estado pela cena.
    onImpulse(t, forca) {
        t._ultimoImpulsoEm = this.scene ? this.scene.time.now : Date.now();
        t._ultimoImpulsoForca = forca || Math.hypot(t.body.velocity.x, t.body.velocity.y);
    },

    updateAll(scene, tampinhas) {
        const dt = Math.min(scene.game.loop.delta, 50) / 1000; // trava contra saltos de frame

        tampinhas.forEach(t => {
            if (!t.body) return;

            const vx = t.body.velocity.x, vy = t.body.velocity.y;
            const v = Math.hypot(vx, vy);
            if (v <= this.LIMIAR_PARADA) {
                if (v > 0) t.body.setVelocity(0, 0);
                return;
            }

            const perda = (this.ATRITO_CONSTANTE + v * this.ARRASTO_PROPORCIONAL) * dt;
            const vNovo = Math.max(0, v - perda);

            if (vNovo <= this.LIMIAR_PARADA) {
                t.body.setVelocity(0, 0);
                return;
            }

            const escala = vNovo / v;
            t.body.velocity.x = vx * escala;
            t.body.velocity.y = vy * escala;
        });
    }
};

if (typeof module !== 'undefined') module.exports = CapPhysics; // CommonJS fallback

window.CapPhysics = CapPhysics;
