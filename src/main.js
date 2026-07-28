// ---------- Estado global do jogo (persiste entre scenes) ----------
const JogoState = {
    corJogador: 0xe74c3c,       // cor da marca padrão (Cola Max)
    marcaJogador: 'Cola Max',   // nome da marca padrão, na primeira vez
    musicaAtual: null,          // instância de som (Phaser) da trilha tocando agora
    musicaAtualChave: null      // chave da trilha tocando agora, pra não reiniciar à toa
};

// toca uma trilha de fundo, mas só reinicia se for uma chave diferente da que já está tocando —
// assim dá pra usar a mesma chamada em Menu/Seleção de tampinha/Seleção de pista (mesma
// música) sem cortar e reiniciar a cada troca de tela, e trocar de verdade só quando entra
// na corrida (chave diferente).
function tocarMusicaDeFundo(scene, chave, volume = 0.35) {
    if (JogoState.musicaAtualChave === chave && JogoState.musicaAtual && JogoState.musicaAtual.isPlaying) {
        return; // já é essa música, deixa tocando
    }
    if (JogoState.musicaAtual) {
        JogoState.musicaAtual.stop();
    }
    const musica = scene.sound.add(chave, { loop: true, volume });
    musica.play();
    JogoState.musicaAtual = musica;
    JogoState.musicaAtualChave = chave;
}

// ---------- Gerador de sons sintetizados ----------
const SomFX = {
    ctx: null,

    iniciar() {
        if (!this.ctx) {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    },

    criarRuido(duracao) {
        const tamanho = this.ctx.sampleRate * duracao;
        const buffer = this.ctx.createBuffer(1, tamanho, this.ctx.sampleRate);
        const dados = buffer.getChannelData(0);
        for (let i = 0; i < tamanho; i++) {
            dados[i] = Math.random() * 2 - 1;
        }
        return buffer;
    },

    peteleco(pitch = 1) {
        this.iniciar();
        const t = this.ctx.currentTime;

        const ruido = this.ctx.createBufferSource();
        ruido.buffer = this.criarRuido(0.05);

        const filtroAgudo = this.ctx.createBiquadFilter();
        filtroAgudo.type = 'highpass';
        filtroAgudo.frequency.setValueAtTime(3000 * pitch, t);

        const gainRuido = this.ctx.createGain();
        gainRuido.gain.setValueAtTime(0.5, t);
        gainRuido.gain.exponentialRampToValueAtTime(0.001, t + 0.04);

        ruido.connect(filtroAgudo).connect(gainRuido).connect(this.ctx.destination);
        ruido.start(t);
        ruido.stop(t + 0.05);

        const osc = this.ctx.createOscillator();
        const gainOsc = this.ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(500 * pitch, t);
        osc.frequency.exponentialRampToValueAtTime(180 * pitch, t + 0.05);

        gainOsc.gain.setValueAtTime(0.15, t);
        gainOsc.gain.exponentialRampToValueAtTime(0.001, t + 0.06);

        osc.connect(gainOsc).connect(this.ctx.destination);
        osc.start(t);
        osc.stop(t + 0.07);
    },

    colisao(pitch = 1) {
        this.iniciar();
        const t = this.ctx.currentTime;

        const ruido = this.ctx.createBufferSource();
        ruido.buffer = this.criarRuido(0.15);

        const filtroBanda = this.ctx.createBiquadFilter();
        filtroBanda.type = 'bandpass';
        filtroBanda.frequency.setValueAtTime(2500 * pitch, t);
        filtroBanda.Q.setValueAtTime(6, t);

        const gainRuido = this.ctx.createGain();
        gainRuido.gain.setValueAtTime(0.4, t);
        gainRuido.gain.exponentialRampToValueAtTime(0.001, t + 0.12);

        ruido.connect(filtroBanda).connect(gainRuido).connect(this.ctx.destination);
        ruido.start(t);
        ruido.stop(t + 0.15);

        [1800, 2650].forEach((freq, i) => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();

            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq * pitch, t);
            osc.frequency.exponentialRampToValueAtTime(freq * pitch * 0.7, t + 0.1);

            gain.gain.setValueAtTime(0.12, t);
            gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12 - i * 0.02);

            osc.connect(gain).connect(this.ctx.destination);
            osc.start(t);
            osc.stop(t + 0.15);
        });
    },

    vitoria() {
        this.iniciar();
        const notas = [523.25, 659.25, 783.99, 1046.5];

        notas.forEach((freq, i) => {
            const t = this.ctx.currentTime + i * 0.12;

            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();

            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(freq, t);

            gain.gain.setValueAtTime(0.001, t);
            gain.gain.linearRampToValueAtTime(0.2, t + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);

            osc.connect(gain).connect(this.ctx.destination);
            osc.start(t);
            osc.stop(t + 0.4);
        });
    },

    // "shhhlip" — água da mangueira fazendo a tampinha escorregar
    escorregar() {
        this.iniciar();
        const t = this.ctx.currentTime;

        const ruido = this.ctx.createBufferSource();
        ruido.buffer = this.criarRuido(0.3);

        const filtro = this.ctx.createBiquadFilter();
        filtro.type = 'bandpass';
        filtro.frequency.setValueAtTime(1800, t);
        filtro.frequency.exponentialRampToValueAtTime(500, t + 0.3);
        filtro.Q.setValueAtTime(1.2, t);

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.001, t);
        gain.gain.linearRampToValueAtTime(0.22, t + 0.04);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);

        ruido.connect(filtro).connect(gain).connect(this.ctx.destination);
        ruido.start(t);
        ruido.stop(t + 0.3);
    },

    // dois tons descendentes — "ops, saiu da pista"
    foraDaPista() {
        this.iniciar();
        const t = this.ctx.currentTime;
        [420, 300].forEach((freq, i) => {
            const inicio = t + i * 0.09;
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();

            osc.type = 'square';
            osc.frequency.setValueAtTime(freq, inicio);

            gain.gain.setValueAtTime(0.0001, inicio);
            gain.gain.linearRampToValueAtTime(0.1, inicio + 0.01);
            gain.gain.exponentialRampToValueAtTime(0.0001, inicio + 0.13);

            osc.connect(gain).connect(this.ctx.destination);
            osc.start(inicio);
            osc.stop(inicio + 0.14);
        });
    },

    // piado curto, 2 ou 3 bicadas de pitch subindo/descendo — passarinho no quintal
    passarinho() {
        this.iniciar();
        const t = this.ctx.currentTime;
        const bicos = Phaser.Math.Between(2, 3);

        for (let i = 0; i < bicos; i++) {
            const inicio = t + i * 0.09;
            const freqBase = Phaser.Math.Between(2200, 3200);

            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();

            osc.type = 'sine';
            osc.frequency.setValueAtTime(freqBase, inicio);
            osc.frequency.exponentialRampToValueAtTime(freqBase * 1.4, inicio + 0.03);
            osc.frequency.exponentialRampToValueAtTime(freqBase * 0.8, inicio + 0.07);

            gain.gain.setValueAtTime(0.0001, inicio);
            gain.gain.linearRampToValueAtTime(0.12, inicio + 0.01);
            gain.gain.exponentialRampToValueAtTime(0.0001, inicio + 0.08);

            osc.connect(gain).connect(this.ctx.destination);
            osc.start(inicio);
            osc.stop(inicio + 0.1);
        }
    }
};

// ---------- Marcas fictícias disponíveis (fonte única, usada por todas as scenes) ----------
// massa: peso da tampinha (1 = padrão). Mais pesada = resiste mais a ser empurrada numa
//   batida, mas também acelera menos com a mesma força de peteleco.
// atrito: quanto ela "gruda" no cimento (1 = padrão). Mais alto = para mais rápido e
//   controlada; mais baixo = desliza bem mais longe, mas também é mais difícil de controlar.
// pitchSom: tom do som de impacto (1 = padrão). Mais alto = "tec" agudo (leve); mais baixo =
//   "tum" grave (pesada).
const MARCAS_DISPONIVEIS = [
    { nome: 'Cola Max',    cor: 0xe74c3c, corTexto: '#ffffff', icone: 'raio',     massa: 0.75, atrito: 0.85, pitchSom: 1.20, estilo: 'Ágil' },
    { nome: 'Refri Pop',   cor: 0x3498db, corTexto: '#ffffff', icone: 'onda',     massa: 1.00, atrito: 1.00, pitchSom: 1.00, estilo: 'Equilibrada' },
    { nome: 'Cerva Gold',  cor: 0xf1c40f, corTexto: '#000000', icone: 'coroa',    massa: 1.35, atrito: 1.10, pitchSom: 0.80, estilo: 'Pesada' },
    { nome: 'Turbo Cola',  cor: 0x2c3e50, corTexto: '#ffffff', icone: 'diamante', massa: 0.90, atrito: 0.65, pitchSom: 1.05, estilo: 'Deslizante' },
    { nome: 'Ice Beer',    cor: 0x1abc9c, corTexto: '#000000', icone: 'gota',     massa: 1.05, atrito: 1.30, pitchSom: 0.95, estilo: 'Controlada' },
    { nome: 'Limão Fresh', cor: 0x2ecc71, corTexto: '#000000', icone: 'estrela',  massa: 0.70, atrito: 0.90, pitchSom: 1.25, estilo: 'Ágil leve' },
    { nome: 'Roxo Bomba',  cor: 0x9b59b6, corTexto: '#ffffff', icone: 'trevo',    massa: 1.50, atrito: 1.15, pitchSom: 0.70, estilo: 'Tanque' },
    { nome: 'Laranjito',   cor: 0xe67e22, corTexto: '#000000', icone: 'sol',      massa: 0.65, atrito: 0.85, pitchSom: 1.30, estilo: 'Levíssima' }
];

// ---------- Tema "quintal": cimento, giz e decoração ----------
function criarTexturaCimento(scene) {
    const chave = 'fundo_cimento';
    if (scene.textures.exists(chave)) return chave;

    const w = 800, h = 600;
    const g = scene.add.graphics();

    g.fillStyle(0xb5b0a6, 1);
    g.fillRect(0, 0, w, h);

    // granulado do cimento
    for (let i = 0; i < 500; i++) {
        const x = Math.random() * w;
        const y = Math.random() * h;
        const tom = Phaser.Math.Between(-14, 14);
        const base = 181 + tom;
        const cor = Phaser.Display.Color.GetColor(base, base - 5, base - 12);
        g.fillStyle(cor, 0.4);
        g.fillRect(x, y, 2, 2);
    }

    // rachaduras
    g.lineStyle(2, 0x8f8a7d, 0.5);
    for (let c = 0; c < 5; c++) {
        let x = Math.random() * w;
        let y = Math.random() * h;
        g.beginPath();
        g.moveTo(x, y);
        const segmentos = Phaser.Math.Between(4, 7);
        for (let s = 0; s < segmentos; s++) {
            x += Phaser.Math.Between(-30, 30);
            y += Phaser.Math.Between(-30, 30);
            g.lineTo(x, y);
        }
        g.strokePath();
    }

    // manchas suaves (umidade, sujeira antiga) — poucas e bem sutis
    for (let m = 0; m < 6; m++) {
        const x = Math.random() * w;
        const y = Math.random() * h;
        const raio = Phaser.Math.Between(18, 45);
        g.fillStyle(0x8a8378, Phaser.Math.FloatBetween(0.04, 0.09));
        g.fillEllipse(x, y, raio * 1.6, raio);
    }

    // vestígio de giz apagado — um risco antigo de uma brincadeira anterior
    g.lineStyle(3, 0xffffff, 0.06);
    for (let gz = 0; gz < 2; gz++) {
        let x = Math.random() * w;
        let y = Math.random() * h;
        g.beginPath();
        g.moveTo(x, y);
        for (let s = 0; s < 5; s++) {
            x += Phaser.Math.Between(-40, 40);
            y += Phaser.Math.Between(-15, 15);
            g.lineTo(x, y);
        }
        g.strokePath();
    }

    g.generateTexture(chave, w, h);
    g.destroy();
    return chave;
}

function criarTexturaFolha(scene) {
    const chave = 'decor_folha';
    if (scene.textures.exists(chave)) return chave;

    const g = scene.add.graphics();
    g.fillStyle(0xc97a2b, 1);
    g.fillEllipse(10, 10, 16, 10);
    g.lineStyle(1, 0x8b4513, 0.8);
    g.lineBetween(3, 10, 17, 10);
    g.generateTexture(chave, 20, 20);
    g.destroy();
    return chave;
}

function criarTexturaPedra(scene) {
    const chave = 'decor_pedra';
    if (scene.textures.exists(chave)) return chave;

    const g = scene.add.graphics();
    g.fillStyle(0x7a7a7a, 1);
    g.fillCircle(8, 8, 7);
    g.fillStyle(0x9a9a9a, 0.6);
    g.fillCircle(6, 6, 3);
    g.generateTexture(chave, 16, 16);
    g.destroy();
    return chave;
}
// botão pequeno de tela cheia, usado em todas as cenas — ativar uma vez faz o jogo ficar em
// tela cheia através das trocas de cena também (é um estado do navegador, não da cena), então
// funciona bem quando o celular é virado pra paisagem: sem barra de endereço comendo espaço,
// o Phaser reajusta o tamanho sozinho (modo FIT já escuta resize/orientationchange).
function criarBotaoTelaCheia(scene) {
    if (!scene.scale.fullscreen.available) return null; // ex.: Safari iOS mais antigo não suporta

    const botao = scene.add.text(34, 566, '⛶', {
        fontSize: '22px',
        fontFamily: 'Arial',
        color: '#ffffff',
        backgroundColor: '#00000066',
        padding: { x: 8, y: 4 }
    }).setOrigin(0.5).setScrollFactor(0).setDepth(1000).setInteractive({ useHandCursor: true });

    const atualizarIcone = () => botao.setText(scene.scale.isFullscreen ? '⤢' : '⛶');

    botao.on('pointerover', () => botao.setStyle({ backgroundColor: '#000000aa' }));
    botao.on('pointerout', () => botao.setStyle({ backgroundColor: '#00000066' }));
    botao.on('pointerdown', () => {
        if (scene.scale.isFullscreen) scene.scale.stopFullscreen();
        else scene.scale.startFullscreen();
    });

    scene.scale.on('enterfullscreen', atualizarIcone);
    scene.scale.on('leavefullscreen', atualizarIcone);

    return botao;
}

function criarTexturaMadeira(scene) {
    const chave = 'fundo_madeira';
    if (scene.textures.exists(chave)) return chave;

    const w = 800, h = 600;
    const g = scene.add.graphics();

    g.fillStyle(0x8b5a2b, 1);
    g.fillRect(0, 0, w, h);

    // veios da madeira (linhas onduladas)
    for (let i = 0; i < 40; i++) {
        const y = Math.random() * h;
        const tom = Phaser.Math.Between(-20, 20);
        const base = 90 + tom;
        const cor = Phaser.Display.Color.GetColor(base + 50, base + 20, base - 10);
        g.lineStyle(Phaser.Math.Between(1, 2), cor, 0.25);
        g.beginPath();
        g.moveTo(0, y);
        for (let x = 0; x <= w; x += 40) {
            g.lineTo(x, y + Math.sin(x / 60 + i) * 6);
        }
        g.strokePath();
    }

    // emendas de tábuas (linhas verticais mais escuras)
    g.lineStyle(2, 0x5b3a1f, 0.4);
    for (let x = 160; x < w; x += 160) {
        g.lineBetween(x, 0, x, h);
    }

    g.generateTexture(chave, w, h);
    g.destroy();
    return chave;
}

// vasinho de planta — decoração de quintal de verdade
function criarTexturaVaso(scene) {
    const chave = 'decor_vaso';
    if (scene.textures.exists(chave)) return chave;

    const w = 28, h = 34;
    const g = scene.add.graphics();

    // vaso de barro (trapézio)
    g.fillStyle(0xb0602f, 1);
    g.fillPoints([
        { x: 6, y: h - 2 }, { x: w - 6, y: h - 2 },
        { x: w - 4, y: h - 16 }, { x: 4, y: h - 16 }
    ], true);
    g.lineStyle(2, 0x8a4a22, 0.7);
    g.lineBetween(4, h - 16, w - 4, h - 16);

    // planta (folhas verdes irregulares saindo do vaso)
    g.fillStyle(0x3f8f3f, 1);
    [[-8, -4], [0, -10], [8, -3], [-3, -8]].forEach(([dx, dy]) => {
        g.fillEllipse(w / 2 + dx, h - 16 + dy, 12, 8);
    });
    g.fillStyle(0x5cb85c, 0.9);
    g.fillEllipse(w / 2, h - 22, 10, 7);

    g.generateTexture(chave, w, h);
    g.destroy();
    return chave;
}

// tijolo — usado como bordinha decorativa do quintal
function criarTexturaTijolo(scene) {
    const chave = 'decor_tijolo';
    if (scene.textures.exists(chave)) return chave;

    const g = scene.add.graphics();
    g.fillStyle(0xa8492f, 1);
    g.fillRoundedRect(0, 0, 22, 11, 2);
    g.lineStyle(1, 0x7a3320, 0.6);
    g.strokeRoundedRect(0, 0, 22, 11, 2);
    g.generateTexture(chave, 22, 11);
    g.destroy();
    return chave;
}

// chinelo havaiana esquecido no quintal
function criarTexturaChinelo(scene) {
    const chave = 'decor_chinelo';
    if (scene.textures.exists(chave)) return chave;

    const g = scene.add.graphics();
    g.fillStyle(0x2980b9, 1);
    g.fillEllipse(12, 15, 18, 26);
    g.lineStyle(2, 0xf1c40f, 0.9);
    g.beginPath();
    g.moveTo(12, 6);
    g.lineTo(5, 15);
    g.moveTo(12, 6);
    g.lineTo(19, 15);
    g.strokePath();
    g.generateTexture(chave, 24, 30);
    g.destroy();
    return chave;
}

// touceira de grama — tufo de grama crescendo entre as rachaduras do cimento
function criarTexturaTouceira(scene) {
    const chave = 'decor_touceira';
    if (scene.textures.exists(chave)) return chave;

    const g = scene.add.graphics();
    for (let i = 0; i < 7; i++) {
        const x = 3 + i * 2.4 + Phaser.Math.FloatBetween(-1, 1);
        const alt = Phaser.Math.Between(8, 16);
        g.lineStyle(2, Phaser.Display.Color.GetColor(
            Phaser.Math.Between(60, 90), Phaser.Math.Between(120, 160), Phaser.Math.Between(40, 70)
        ), 0.85);
        g.beginPath();
        g.moveTo(x, 20);
        g.lineTo(x + Phaser.Math.FloatBetween(-3, 3), 20 - alt);
        g.strokePath();
    }
    g.generateTexture(chave, 20, 20);
    g.destroy();
    return chave;
}

// mangueira de jardim enrolada — fica do lado de fora da pista, perto do bico que molha a pista
function criarTexturaMangueira(scene) {
    const chave = 'decor_mangueira';
    if (scene.textures.exists(chave)) return chave;

    const tam = 46;
    const g = scene.add.graphics();
    g.lineStyle(6, 0x1e7a3a, 1);
    g.beginPath();
    g.arc(tam / 2, tam / 2, 16, 0, Math.PI * 1.7);
    g.strokePath();
    g.lineStyle(6, 0x249c4a, 1);
    g.beginPath();
    g.arc(tam / 2, tam / 2, 9, Math.PI * 0.2, Math.PI * 2);
    g.strokePath();
    g.fillStyle(0xcccccc, 1);
    g.fillCircle(tam / 2, tam / 2, 4);
    g.generateTexture(chave, tam, tam);
    g.destroy();
    return chave;
}

// bico da mangueira, bem na beira da pista, de onde sai o fiozinho d'água
function criarTexturaBicoMangueira(scene) {
    const chave = 'decor_bico_mangueira';
    if (scene.textures.exists(chave)) return chave;

    const g = scene.add.graphics();
    g.fillStyle(0x555555, 1);
    g.fillRoundedRect(0, 4, 20, 8, 3);
    g.fillStyle(0x333333, 1);
    g.fillCircle(18, 8, 5);
    g.generateTexture(chave, 24, 16);
    g.destroy();
    return chave;
}

// espalha folhas, pedrinhas, vasos, tijolos, chinelo e grama nas margens da tela — usado
// pelo menu (tela única 800x600, sem pista) pra dar cara de quintal de verdade.
function espalharDecoracao(scene) {
    const miudos = [criarTexturaFolha(scene), criarTexturaPedra(scene)];

    for (let i = 0; i < 14; i++) {
        const zona = Phaser.Math.Between(0, 3);
        let x, y;

        if (zona === 0) { x = Phaser.Math.Between(10, 790); y = Phaser.Math.Between(8, 78); }
        else if (zona === 1) { x = Phaser.Math.Between(10, 790); y = Phaser.Math.Between(512, 592); }
        else if (zona === 2) { x = Phaser.Math.Between(4, 30); y = Phaser.Math.Between(90, 510); }
        else { x = Phaser.Math.Between(770, 796); y = Phaser.Math.Between(90, 510); }

        const tipo = Phaser.Utils.Array.GetRandom(miudos);
        scene.add.image(x, y, tipo)
            .setRotation(Phaser.Math.FloatBetween(0, Math.PI * 2))
            .setAlpha(0.85);
    }

    // touceiras de grama crescendo pelas frestas do cimento
    for (let i = 0; i < 8; i++) {
        const zona = Phaser.Math.Between(0, 3);
        let x, y;
        if (zona === 0) { x = Phaser.Math.Between(20, 780); y = Phaser.Math.Between(4, 40); }
        else if (zona === 1) { x = Phaser.Math.Between(20, 780); y = Phaser.Math.Between(560, 596); }
        else if (zona === 2) { x = Phaser.Math.Between(2, 20); y = Phaser.Math.Between(100, 500); }
        else { x = Phaser.Math.Between(780, 798); y = Phaser.Math.Between(100, 500); }
        scene.add.image(x, y, criarTexturaTouceira(scene)).setAlpha(0.9);
    }

    // vasos de planta e um chinelo esquecido, só nos cantos
    const cantos = [
        { x: 34, y: 34 }, { x: 766, y: 34 }, { x: 34, y: 566 }, { x: 766, y: 566 }
    ];
    Phaser.Utils.Array.Shuffle(cantos).slice(0, 3).forEach(pos => {
        scene.add.image(pos.x, pos.y, criarTexturaVaso(scene)).setRotation(Phaser.Math.FloatBetween(-0.08, 0.08));
    });
    const cantoChinelo = cantos[3] || { x: 766, y: 566 };
    scene.add.image(cantoChinelo.x + 14, cantoChinelo.y + 6, criarTexturaChinelo(scene))
        .setRotation(Phaser.Math.FloatBetween(-0.5, 0.5)).setAlpha(0.9);

    // fileira de tijolinhos decorando um canto, como bordinha de jardim
    const chaveTijolo = criarTexturaTijolo(scene);
    const cantoTijolo = Phaser.Utils.Array.GetRandom(['topo', 'base']);
    for (let i = 0; i < 5; i++) {
        const x = 60 + i * 24;
        const y = cantoTijolo === 'topo' ? 14 : 586;
        scene.add.image(x, y, chaveTijolo).setRotation(Phaser.Math.FloatBetween(-0.05, 0.05));
    }
}

const config = {
    type: Phaser.AUTO,
    width: 800,
    height: 600,
    parent: "game",
    backgroundColor: "#8b8b8b",
    scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH
    },
    physics: {
        default: "arcade",
        arcade: {
            debug: false
        }
    },
    scene: [MenuScene, SelecaoScene, SelecaoPistaScene, GameScene]
};

function iniciarJogo() {
    window.game = new Phaser.Game(config);
}

// garante que a fonte "Fredoka" já esteja pronta antes do Phaser desenhar o primeiro texto
if (document.fonts && document.fonts.load) {
    Promise.race([
        Promise.all([
            document.fonts.load('600 40px Fredoka'),
            document.fonts.load('700 48px Fredoka')
        ]),
        new Promise(resolve => setTimeout(resolve, 500)) // trava de segurança
    ]).then(iniciarJogo);
} else {
    iniciarJogo();
}
