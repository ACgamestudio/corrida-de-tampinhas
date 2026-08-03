// ---------- Estado global do jogo (persiste entre scenes) ----------
const JogoState = {
    corJogador: 0xe74c3c,       // cor da marca padrão (Cola Max)
    marcaJogador: 'Cola Max',   // nome da marca padrão, na primeira vez
    pistaEscolhida: 'garagem',  // chave da pista escolhida em SelecaoPistaScene (ver PISTAS_DISPONIVEIS)
    musicaAtual: null,          // instância de som (Phaser) da trilha tocando agora
    musicaAtualChave: null,     // chave da trilha tocando agora, pra não reiniciar à toa
    pontuacaoDecimos: 0,        // pontuação do jogador em décimos (ver carregarPontuacaoSalva abaixo)

    // ---------- multiplayer online (ver src/multiplayer/) ----------
    online: false,              // true durante uma partida online (2 jogadores + 2 IA)
    souAnfitriao: false,        // true = eu criei a sala e escolho a pista; false = visitante
    salaCodigo: null,           // código de 5 caracteres da sala atual no Firestore
    meuIndice: 0,               // índice da MINHA tampinha em GameScene.tampinhas (0=anfitrião, 1=visitante)
    marcasCorridaOnline: null,  // [nomeMarca x4] definido pelo anfitrião, sincronizado via Firestore
    niveisIAOnline: null,       // [nível x2] das duas tampinhas de IA (índices 2 e 3)
    turnoInicialOnline: null    // de quem é o primeiro turno, sorteado pelo anfitrião
};
JogoState.pontuacaoDecimos = carregarPontuacaoSalva();

// ---------- Pontuação do jogador: persiste entre corridas via localStorage ----------
// Guardada em "décimos" (inteiro) em vez de número quebrado (0.2, 1.0...) porque soma
// repetida de floats em JS acumula erro de arredondamento (0.2 + 0.2 + 0.2 !== 0.6 exato).
// 1 vitória = 10 décimos (1,0 ponto). 1 batida = 2 décimos (0,2 ponto).
const CHAVE_PONTUACAO_SALVA = 'corridaTampinhas_pontuacaoDecimos';

// tampinha secreta: aparição rara numa corrida, vale 500,0 pontos (5000 em décimos) —
// mesma escala usada pra vitória (10) e batida (2), só que bem maior por ser rara.
const PONTOS_TAMPINHA_SECRETA = 5000;
const CHANCE_TAMPINHA_SECRETA = 0.2; // 20% de chance de aparecer em cada corrida

function carregarPontuacaoSalva() {
    try {
        const salvo = localStorage.getItem(CHAVE_PONTUACAO_SALVA);
        const valor = salvo !== null ? parseInt(salvo, 10) : 0;
        return Number.isFinite(valor) ? valor : 0;
    } catch (e) {
        return 0; // localStorage indisponível (ex.: navegação privada bloqueando) — só não persiste
    }
}

function adicionarPontos(decimos) {
    JogoState.pontuacaoDecimos += decimos;
    try {
        localStorage.setItem(CHAVE_PONTUACAO_SALVA, String(JogoState.pontuacaoDecimos));
    } catch (e) { /* segue sem salvar */ }
}

function formatarPontuacao() {
    return (JogoState.pontuacaoDecimos / 10).toFixed(1).replace('.', ',');
}

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

    // peteleco de verdade: o "tec" seco do dedo batendo na borda da tampinha — um clique
    // bem curto e estalado (a unha/dedo), seguido de um "tum" curtinho e grave (o corpo da
    // tampinha absorvendo o impacto e saindo andando). Sem ressonância longa: um peteleco
    // real não "canta", é rápido e seco.
    peteleco(pitch = 1) {
        this.iniciar();
        const t = this.ctx.currentTime;

        // estalo do dedo: transiente bem curto e muito agudo, quase só o ataque
        const estalo = this.ctx.createBufferSource();
        estalo.buffer = this.criarRuido(0.012);

        const filtroEstalo = this.ctx.createBiquadFilter();
        filtroEstalo.type = 'bandpass';
        filtroEstalo.frequency.setValueAtTime(5500 * pitch, t);
        filtroEstalo.Q.setValueAtTime(1.3, t);

        const gainEstalo = this.ctx.createGain();
        gainEstalo.gain.setValueAtTime(0.55, t);
        gainEstalo.gain.exponentialRampToValueAtTime(0.001, t + 0.012);

        estalo.connect(filtroEstalo).connect(gainEstalo).connect(this.ctx.destination);
        estalo.start(t);
        estalo.stop(t + 0.014);

        // clique mais seco por cima, ainda mais curto — dá a "borda" do dedo tocando
        const clique = this.ctx.createBufferSource();
        clique.buffer = this.criarRuido(0.006);

        const filtroClique = this.ctx.createBiquadFilter();
        filtroClique.type = 'highpass';
        filtroClique.frequency.setValueAtTime(6500 * pitch, t);

        const gainClique = this.ctx.createGain();
        gainClique.gain.setValueAtTime(0.4, t);
        gainClique.gain.exponentialRampToValueAtTime(0.001, t + 0.006);

        clique.connect(filtroClique).connect(gainClique).connect(this.ctx.destination);
        clique.start(t);
        clique.stop(t + 0.007);

        // "tum" curto e grave: o impacto empurrando a tampinha, sem ressoar muito
        const osc = this.ctx.createOscillator();
        const gainOsc = this.ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(260 * pitch, t);
        osc.frequency.exponentialRampToValueAtTime(90 * pitch, t + 0.045);

        gainOsc.gain.setValueAtTime(0.001, t);
        gainOsc.gain.linearRampToValueAtTime(0.16, t + 0.004);
        gainOsc.gain.exponentialRampToValueAtTime(0.001, t + 0.05);

        osc.connect(gainOsc).connect(this.ctx.destination);
        osc.start(t);
        osc.stop(t + 0.055);
    },

    // metal batendo em metal: duas tampinhas se esbarrando. Diferente do peteleco (que é
    // seco), aqui tem um "clank" com ressonância metálica de verdade — parciais fora da
    // proporção harmônica normal (tipo sino), que é o que faz o ouvido reconhecer "metal"
    // em vez de "madeira" ou "plástico".
    colisao(pitch = 1) {
        this.iniciar();
        const t = this.ctx.currentTime;

        // impacto seco do choque (o "clack" duro do encontro das bordas)
        const impacto = this.ctx.createBufferSource();
        impacto.buffer = this.criarRuido(0.02);

        const filtroImpacto = this.ctx.createBiquadFilter();
        filtroImpacto.type = 'bandpass';
        filtroImpacto.frequency.setValueAtTime(3200 * pitch, t);
        filtroImpacto.Q.setValueAtTime(2.2, t);

        const gainImpacto = this.ctx.createGain();
        gainImpacto.gain.setValueAtTime(0.45, t);
        gainImpacto.gain.exponentialRampToValueAtTime(0.001, t + 0.02);

        impacto.connect(filtroImpacto).connect(gainImpacto).connect(this.ctx.destination);
        impacto.start(t);
        impacto.stop(t + 0.022);

        // ressonância metálica: parciais inarmônicos (proporções tipo sino, não múltiplos
        // inteiros), cada um com seu próprio decaimento rápido — é isso que dá o "clang"
        const fundamental = 950 * pitch;
        const parciais = [1, 2.42, 3.86, 5.31];
        parciais.forEach((razao, i) => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();

            osc.type = 'sine';
            osc.frequency.setValueAtTime(fundamental * razao, t);
            osc.frequency.exponentialRampToValueAtTime(fundamental * razao * 0.94, t + 0.13);

            const amplitudeInicial = 0.16 / (i + 1);
            const duracao = 0.16 - i * 0.02;
            gain.gain.setValueAtTime(amplitudeInicial, t);
            gain.gain.exponentialRampToValueAtTime(0.0008, t + duracao);

            osc.connect(gain).connect(this.ctx.destination);
            osc.start(t);
            osc.stop(t + duracao + 0.02);
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

    // "shhhlip" — a tampinha escorregando na mancha de óleo
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
// pontoForte: frase curta mostrada na vitrine de seleção, resumindo em uma linha o que a
//   combinação de massa/atrito daquela tampinha entrega de melhor numa corrida.
const MARCAS_DISPONIVEIS = [
    { nome: 'Cola Max',    cor: 0xe74c3c, corTexto: '#ffffff', icone: 'raio',     massa: 0.75, atrito: 0.85, pitchSom: 1.20, estilo: 'Ágil',       pontoForte: 'Arranca rápido' },
    { nome: 'Refri Pop',   cor: 0x3498db, corTexto: '#ffffff', icone: 'onda',     massa: 1.00, atrito: 1.00, pitchSom: 1.00, estilo: 'Equilibrada', pontoForte: 'Equilíbrio total' },
    { nome: 'Cerva Gold',  cor: 0xf1c40f, corTexto: '#000000', icone: 'coroa',    massa: 1.35, atrito: 1.10, pitchSom: 0.80, estilo: 'Pesada',      pontoForte: 'Resiste a batidas' },
    { nome: 'Turbo Cola',  cor: 0x2c3e50, corTexto: '#ffffff', icone: 'diamante', massa: 0.90, atrito: 0.65, pitchSom: 1.05, estilo: 'Deslizante',  pontoForte: 'Desliza mais longe' },
    { nome: 'Ice Beer',    cor: 0x1abc9c, corTexto: '#000000', icone: 'gota',     massa: 1.05, atrito: 1.30, pitchSom: 0.95, estilo: 'Controlada',  pontoForte: 'Freia com precisão' },
    { nome: 'Limão Fresh', cor: 0x2ecc71, corTexto: '#000000', icone: 'estrela',  massa: 0.70, atrito: 0.90, pitchSom: 1.25, estilo: 'Ágil leve',   pontoForte: 'Leve na largada' },
    { nome: 'Roxo Bomba',  cor: 0x9b59b6, corTexto: '#ffffff', icone: 'trevo',    massa: 1.50, atrito: 1.15, pitchSom: 0.70, estilo: 'Tanque',      pontoForte: 'Quase imparável' },
    { nome: 'Laranjito',   cor: 0xe67e22, corTexto: '#000000', icone: 'sol',      massa: 0.65, atrito: 0.85, pitchSom: 1.30, estilo: 'Levíssima',   pontoForte: 'A mais rápida de largada' }
];

// ---------- Tema "quintal": cimento, giz e decoração ----------
function criarTexturaCimento(scene) {
    const chave = 'fundo_cimento';
    if (scene.textures.exists(chave)) return chave;

    const w = 960, h = 540;
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
// botão com cantos arredondados, usado nas telas de seleção (tampinha, pista) — visual
// único e consistente: fundo colorido, borda, texto centralizado, e um leve "pulo" de
// escala no hover/clique. Devolve o container pra quem chamou poder reposicionar se quiser.
function criarBotaoEstilizado(scene, x, y, largura, altura, texto, corFundo, corBorda, corTexto, aoClicar) {
    const g = scene.add.graphics();
    g.fillStyle(corFundo, 0.92);
    g.fillRoundedRect(-largura / 2, -altura / 2, largura, altura, 12);
    g.lineStyle(3, corBorda, 1);
    g.strokeRoundedRect(-largura / 2, -altura / 2, largura, altura, 12);

    const rotulo = scene.add.text(0, 0, texto, {
        fontSize: '19px',
        fontFamily: 'Arial',
        fontStyle: 'bold',
        color: corTexto
    }).setOrigin(0.5);

    const botao = scene.add.container(x, y, [g, rotulo]);
    botao.setSize(largura, altura);
    botao.setInteractive({ useHandCursor: true });

    botao.on('pointerover', () => scene.tweens.add({ targets: botao, scale: 1.05, duration: 100 }));
    botao.on('pointerout', () => scene.tweens.add({ targets: botao, scale: 1, duration: 100 }));
    botao.on('pointerdown', aoClicar);

    return botao;
}

// moldura de madeira arredondada usada como painel em todas as telas de seleção — deixa
// as bordas do "quadro" claras por fora e escuras por dentro, tipo um caixilho de verdade
function desenharMolduraPainel(scene) {
    const moldura = scene.add.graphics();
    moldura.lineStyle(6, 0xf0d9a8, 0.5);
    moldura.strokeRoundedRect(14, 10, 932, 466, 26);
    moldura.lineStyle(2, 0x3e2412, 0.6);
    moldura.strokeRoundedRect(20, 16, 920, 454, 22);
    return moldura;
}

// botão pequeno de tela cheia, usado em todas as cenas — ativar uma vez faz o jogo ficar em
// tela cheia através das trocas de cena também (é um estado do navegador, não da cena), então
// funciona bem quando o celular é virado pra paisagem: sem barra de endereço comendo espaço,
// o Phaser reajusta o tamanho sozinho (modo FIT já escuta resize/orientationchange).
function criarBotaoTelaCheia(scene) {
    if (!scene.scale.fullscreen.available) return null; // ex.: Safari iOS mais antigo não suporta

    const botao = scene.add.text(34, 506, '⛶', {
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

    const w = 960, h = 540;
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
    width: 960,
    height: 540,
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
    scene: [ProdutoraScene, IntroScene, MenuScene, SelecaoScene, SelecaoPistaScene, LobbyOnlineScene, AguardandoAnfitriaoScene, GameScene]
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
