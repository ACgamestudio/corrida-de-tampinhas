// Overlay de carregamento em DOM (fora do canvas do Phaser).
// Fica em DOM de propósito: durante o preload de uma cena o Phaser não desenha nada e o
// canvas mostra só a cor de fundo (o "cinza morto"). Um elemento HTML por cima continua
// visível e animando mesmo quando a thread principal travar decodificando textura grande —
// a animação usa transform/opacity, que roda no compositor, não no JS.
const Carregando = {
    el: null,
    barra: null,
    texto: null,
    timerMostrar: null,
    timerSeguranca: null,
    timerEsconderAdiado: null,
    visivel: false,
    inicioCarregamento: 0,   // performance.now() de quando o loader começou (START)
    mostradoEm: 0,           // performance.now() de quando a classe .ativo foi realmente aplicada

    ATRASO_MS: 180,           // só aparece se o carregamento passar disso (evita flash em cache)
    TEMPO_MINIMO_VISIVEL_MS: 400, // uma vez visível, fica pelo menos esse tanto — evita ela
                                   // "piscar" sem pintar nenhum frame quando o create() da cena
                                   // trava a thread principal logo depois de um download rápido
    LIMITE_MS: 20000,        // trava de segurança: nunca deixa o overlay preso na tela

    init() {
        if (this.el !== null) return;
        this.el = document.getElementById('carregando');
        this.barra = document.getElementById('carregando-barra');
        this.texto = document.getElementById('carregando-texto');
    },

    acompanhar(cena, rotulo) {
        this.init();
        if (!this.el) return;
        if (cena.__overlayLigado) return;
        cena.__overlayLigado = true;

        const loader = cena.load;

        loader.on(Phaser.Loader.Events.START, () => {
            this.definirProgresso(0);
            if (rotulo && this.texto) this.texto.textContent = rotulo;
            this.inicioCarregamento = performance.now();
            clearTimeout(this.timerMostrar);
            this.timerMostrar = setTimeout(() => this.mostrar(), this.ATRASO_MS);
            clearTimeout(this.timerSeguranca);
            this.timerSeguranca = setTimeout(() => this.esconder(), this.LIMITE_MS);
        });

        loader.on(Phaser.Loader.Events.PROGRESS, p => this.definirProgresso(p));

        loader.on(Phaser.Loader.Events.FILE_LOAD_ERROR, f => {
            console.warn('[Carregando] falhou:', f && f.key, f && f.src);
        });

        loader.on(Phaser.Loader.Events.COMPLETE, () => {
            this.definirProgresso(1);
            // não esconde no COMPLETE: o download acabou, mas o navegador ainda vai decodificar
            // a imagem e subir a textura pra GPU, e a cena ainda não rodou create(). Esconder
            // aqui devolveria justamente 1 ou 2 frames de tela travada.
            cena.events.once(Phaser.Scenes.Events.CREATE, () => {
                requestAnimationFrame(() => requestAnimationFrame(() => this.esconder()));
            });
        });
    },

    definirProgresso(p) {
        if (this.barra) this.barra.style.transform = 'scaleX(' + Math.max(0.02, p) + ')';
    },

    mostrar() {
        if (!this.el || this.visivel) return;
        this.visivel = true;
        this.mostradoEm = performance.now();
        this.el.classList.add('ativo');
    },

    esconder() {
        clearTimeout(this.timerMostrar);
        clearTimeout(this.timerSeguranca);
        clearTimeout(this.timerEsconderAdiado);

        // se o carregamento já demorou mais que o atraso mas a barra ainda não tinha sido
        // mostrada (create() travou a thread e comeu o timer do "mostrar"), força mostrar
        // agora mesmo — do contrário ela nunca aparece nesse tipo de carregamento
        if (!this.visivel && performance.now() - this.inicioCarregamento >= this.ATRASO_MS) {
            this.mostrar();
        }

        if (!this.el || !this.visivel) return;

        const decorrido = performance.now() - this.mostradoEm;
        if (decorrido < this.TEMPO_MINIMO_VISIVEL_MS) {
            // já apareceu, mas faz pouco tempo — segura na tela até completar o mínimo,
            // senão ela pode sumir no mesmo frame em que apareceu e ninguém vê nada
            this.timerEsconderAdiado = setTimeout(
                () => this.esconderAgora(),
                this.TEMPO_MINIMO_VISIVEL_MS - decorrido
            );
            return;
        }
        this.esconderAgora();
    },

    esconderAgora() {
        if (!this.el || !this.visivel) return;
        this.visivel = false;
        this.el.classList.remove('ativo');
    }
};
