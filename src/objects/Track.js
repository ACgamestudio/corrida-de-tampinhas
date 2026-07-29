// ---------- Pista grande: traçado por spline, colisão e zonas especiais ----------
// A pista é definida por um pequeno conjunto de pontos de controle (o "traçado"), ligados
// por uma curva de Catmull-Rom fechada — isso garante curvas contínuas e suaves, sem trechos
// quebrados/pontiagudos. A partir dessa linha central, a pista é uma faixa de LARGURA UNIFORME
// (deslocada pra fora e pra dentro, perpendicular à direção da pista em cada ponto).
//
// Tudo — física, IA, detecção de dentro/fora — usa a mesma LUT (lookup table) de amostras da
// pista, indexada por "s" (distância percorrida ao longo do traçado, em pixels), em vez de
// ângulo a partir de um centro. Isso é o que permite curvas de verdade (não só uma oval).

const MUNDO_LARGURA = 3000;
const MUNDO_ALTURA = 2000;

const LARGURA_PISTA = 200;         // uniforme em toda a pista (~30% maior que a versão anterior)
const RESOLUCAO_LUT = 900;         // amostras ao redor da volta inteira
const COR_PISTA = 0x808080;        // tom parecido com o chão da foto de fundo, pra não conflitar

// ---------- traçados disponíveis: cada preset é só a "receita" harmônica do contorno em
// volta do centro (quantos pontos de controle, raio-base e alguns termos senoidais somados
// em cima). Presets com mais termos/frequências mais altas viram voltas com mais curvas —
// é isso que diferencia visualmente cada pista, mesmo usando o mesmo motor de spline.
// metadados de cada pista disponível na tela de seleção: nome de exibição, arquivo de fundo
// e uma linha de descrição — usados tanto por SelecaoPistaScene quanto por GameScene, pra
// não duplicar essa lista em dois lugares diferentes
const PISTAS_DISPONIVEIS = {
    garagem: {
        nome: '🏠 GARAGEM', arquivo: 'assets/images/garage_bg.jpg',
        descricao: 'Curvas de verdade no chão da garagem de casa'
    },
    praia: {
        nome: '🏖️ PRAIA', arquivo: 'assets/images/praia_bg.jpg',
        descricao: 'Volta serpenteando na areia, cheia de curva'
    },
    calcada: {
        nome: '🚧 CALÇADA', arquivo: 'assets/images/calcada_bg.jpg',
        descricao: 'Ziguezague apertado no ladrilho da calçada'
    }
};

const PISTA_PRESETS = {
    // traçado original: 2 curvas largas por "lado", poucas ondulações — uma volta clássica
    garagem: {
        N: 16, rxBase: 1000, ryBase: 780,
        termosRx: [{ amp: 90, freq: 2, fase: 0.4 }, { amp: 25, freq: 3, fase: -0.9 }],
        termosRy: [{ amp: 75, freq: 2, fase: -0.3 }, { amp: 20, freq: 3, fase: 1.2 }]
    },
    // mais serpenteante: frequências mais altas (3 e 5) dão bem mais curvas ao longo da volta
    praia: {
        N: 20, rxBase: 950, ryBase: 720,
        termosRx: [{ amp: 150, freq: 3, fase: 0.6 }, { amp: 55, freq: 5, fase: -1.1 }],
        termosRy: [{ amp: 120, freq: 3, fase: -0.5 }, { amp: 45, freq: 5, fase: 0.8 }]
    },
    // três camadas de ondulação (2, 4 e 6) — curvas de tamanhos variados na mesma volta,
    // um traçado mais "quebrado" que o da praia, tipo ziguezague de calçada
    calcada: {
        N: 18, rxBase: 980, ryBase: 760,
        termosRx: [{ amp: 130, freq: 2, fase: 1.0 }, { amp: 65, freq: 4, fase: -0.4 }, { amp: 30, freq: 6, fase: 0.7 }],
        termosRy: [{ amp: 100, freq: 2, fase: -0.6 }, { amp: 50, freq: 4, fase: 0.9 }, { amp: 22, freq: 6, fase: -0.3 }]
    }
};

// monta os pontos de controle a partir de um preset — `escala` encolhe todas as ondulações
// igualmente, usado pelo verificador de segurança logo abaixo pra "domar" um traçado gerado
// forte demais até ele parar de se autointersectar, sem precisar mexer no preset à mão
function gerarPontosDeControle(preset, escala = 1) {
    const { N, rxBase, ryBase, termosRx, termosRy } = preset;
    const centro = { x: MUNDO_LARGURA / 2, y: MUNDO_ALTURA / 2 - 50 };
    const pontos = [];
    for (let i = 0; i < N; i++) {
        const a = i * (Math.PI * 2 / N);
        const rx = rxBase + termosRx.reduce((soma, tm) => soma + tm.amp * escala * Math.sin(tm.freq * a + tm.fase), 0);
        const ry = ryBase + termosRy.reduce((soma, tm) => soma + tm.amp * escala * Math.sin(tm.freq * a + tm.fase), 0);
        pontos.push({ x: centro.x + Math.cos(a) * rx, y: centro.y + Math.sin(a) * ry });
    }
    return { pontos, centro };
}

// verifica, numa amostragem rápida (baixa resolução), se o traçado não "pincha" nem se
// autointersecta: pega só pontos suficientemente distantes um do outro AO LONGO da volta
// (senão vizinhos imediatos sempre dariam falso positivo) e confere se a distância real no
// espaço entre eles nunca fica menor que a largura da pista. Se ficar, o traçado é inseguro.
function traçadoEhSeguro(pontos, largura) {
    const AMOSTRAS = 140;
    const brutos = [];
    for (let i = 0; i < AMOSTRAS; i++) {
        brutos.push(catmullRomPonto(pontos, (i / AMOSTRAS) * pontos.length));
    }
    const separacaoMinima = Math.max(6, Math.round(AMOSTRAS * 0.12));
    const distanciaSegura = largura * 1.15;

    for (let i = 0; i < AMOSTRAS; i++) {
        for (let j = i + 1; j < AMOSTRAS; j++) {
            const separacaoCircular = Math.min(j - i, AMOSTRAS - (j - i));
            if (separacaoCircular < separacaoMinima) continue; // vizinhos na mesma curva: ignora
            const d = Phaser.Math.Distance.Between(brutos[i].x, brutos[i].y, brutos[j].x, brutos[j].y);
            if (d < distanciaSegura) return false;
        }
    }
    return true;
}

// Catmull-Rom uniforme (tensão padrão), fechada: t contínuo em [0, pontos.length)
function catmullRomPonto(pontos, t) {
    const n = pontos.length;
    const i = Math.floor(t) % n;
    const u = t - Math.floor(t);

    const pm1 = pontos[(i - 1 + n) % n];
    const p0 = pontos[i];
    const p1 = pontos[(i + 1) % n];
    const p2 = pontos[(i + 2) % n];

    const u2 = u * u, u3 = u2 * u;

    const x = 0.5 * ((2 * p0.x) + (-pm1.x + p1.x) * u
        + (2 * pm1.x - 5 * p0.x + 4 * p1.x - p2.x) * u2
        + (-pm1.x + 3 * p0.x - 3 * p1.x + p2.x) * u3);
    const y = 0.5 * ((2 * p0.y) + (-pm1.y + p1.y) * u
        + (2 * pm1.y - 5 * p0.y + 4 * p1.y - p2.y) * u2
        + (-pm1.y + 3 * p0.y - 3 * p1.y + p2.y) * u3);

    return { x, y };
}

// constrói a pista inteira: traçado + LUT de amostras (posição, tangente, comprimento
// acumulado "s", normal) + pontos das bordas externa/interna (largura uniforme).
// `presetKey` escolhe o traçado (ver PISTA_PRESETS); se o traçado gerado pelo preset se
// autointersectar (raro, mas possível com amplitudes altas), a função encolhe as ondulações
// automaticamente e tenta de novo, até achar uma volta segura.
function construirPista(presetKey = 'garagem') {
    const preset = PISTA_PRESETS[presetKey] || PISTA_PRESETS.garagem;

    let escala = 1;
    let candidato = gerarPontosDeControle(preset, escala);
    for (let tentativa = 0; tentativa < 6 && !traçadoEhSeguro(candidato.pontos, LARGURA_PISTA); tentativa++) {
        escala *= 0.85;
        candidato = gerarPontosDeControle(preset, escala);
    }
    const { pontos, centro } = candidato;
    const n = pontos.length;

    const brutos = [];
    for (let i = 0; i < RESOLUCAO_LUT; i++) {
        const t = (i / RESOLUCAO_LUT) * n;
        brutos.push(catmullRomPonto(pontos, t));
    }

    // tangente por diferença central, comprimento acumulado, normal (perpendicular, pra fora)
    const lut = [];
    let s = 0;
    for (let i = 0; i < RESOLUCAO_LUT; i++) {
        const anterior = brutos[(i - 1 + RESOLUCAO_LUT) % RESOLUCAO_LUT];
        const proximo = brutos[(i + 1) % RESOLUCAO_LUT];
        const tangente = Math.atan2(proximo.y - anterior.y, proximo.x - anterior.x);

        if (i > 0) {
            s += Phaser.Math.Distance.Between(brutos[i - 1].x, brutos[i - 1].y, brutos[i].x, brutos[i].y);
        }

        // normal apontando pra fora do laço (testado/corrigido logo abaixo, uma vez, pro
        // primeiro ponto — como o traçado é uma curva suave e não se autointersecta, a
        // orientação relativa se mantém em toda a volta)
        let nx = -Math.sin(tangente), ny = Math.cos(tangente);

        lut.push({ x: brutos[i].x, y: brutos[i].y, tangente, nx, ny, s });
    }
    const comprimentoTotal = s + Phaser.Math.Distance.Between(
        brutos[RESOLUCAO_LUT - 1].x, brutos[RESOLUCAO_LUT - 1].y, brutos[0].x, brutos[0].y
    );

    // garante que a normal aponta pra fora (se não, inverte todas de uma vez)
    const primeiro = lut[0];
    const paraFora = { x: primeiro.x - centro.x, y: primeiro.y - centro.y };
    if (primeiro.nx * paraFora.x + primeiro.ny * paraFora.y < 0) {
        lut.forEach(p => { p.nx *= -1; p.ny *= -1; });
    }

    const meiaLargura = LARGURA_PISTA / 2;
    lut.forEach(p => {
        p.extX = p.x + p.nx * meiaLargura; p.extY = p.y + p.ny * meiaLargura;
        p.intX = p.x - p.nx * meiaLargura; p.intY = p.y - p.ny * meiaLargura;
    });

    const pista = {
        centro, lut, comprimentoTotal, largura: LARGURA_PISTA,

        // amostra mais próxima de uma coordenada s (com wraparound)
        indiceParaS(sAlvo) {
            let sN = sAlvo % comprimentoTotal;
            if (sN < 0) sN += comprimentoTotal;
            return Math.round((sN / comprimentoTotal) * RESOLUCAO_LUT) % RESOLUCAO_LUT;
        },

        amostraEmS(sAlvo) {
            return lut[this.indiceParaS(sAlvo)];
        },

        // ponto na faixa da pista: fracaoLargura 0 = borda interna (ilha), 1 = borda externa
        pontoNaFaixa(sAlvo, fracaoLargura) {
            const p = this.amostraEmS(sAlvo);
            return {
                x: Phaser.Math.Linear(p.intX, p.extX, fracaoLargura),
                y: Phaser.Math.Linear(p.intY, p.extY, fracaoLargura)
            };
        }
    };
    return pista;
}

// mantém um ângulo dentro de [-π, π]
function normalizarAngulo(a) {
    while (a > Math.PI) a -= Math.PI * 2;
    while (a < -Math.PI) a += Math.PI * 2;
    return a;
}

// menor distância entre duas posições "s" ao longo da pista, considerando o laço fechado
function diferencaS(sA, sB, comprimentoTotal) {
    let d = sA - sB;
    const metade = comprimentoTotal / 2;
    if (d > metade) d -= comprimentoTotal;
    if (d < -metade) d += comprimentoTotal;
    return d;
}

// status de um ponto (x,y) em relação à pista: posição ao longo do traçado (s), distância
// lateral ao centro da faixa (negativa = lado da ilha, positiva = lado externo) e se está
// dentro da faixa.
function calcularStatusNaPista(pista, x, y) {
    // busca no LUT: varredura completa (barato — poucas centenas de amostras, poucos objetos)
    let melhorIdx = 0, melhorDist = Infinity;
    const { lut } = pista;
    for (let i = 0; i < lut.length; i++) {
        const dx = x - lut[i].x, dy = y - lut[i].y;
        const d = dx * dx + dy * dy;
        if (d < melhorDist) { melhorDist = d; melhorIdx = i; }
    }

    const amostra = lut[melhorIdx];
    const dx = x - amostra.x, dy = y - amostra.y;
    const lateral = dx * amostra.nx + dy * amostra.ny; // projeção na normal

    const meiaLargura = pista.largura / 2;
    return {
        s: amostra.s,
        indice: melhorIdx,
        lateral,
        tangente: amostra.tangente,
        nx: amostra.nx,
        ny: amostra.ny,
        dentro: Math.abs(lateral) <= meiaLargura,
        alemDaBorda: Math.abs(lateral) - meiaLargura // positivo = quanto passou da borda
    };
}

// desenha a pista riscada de giz: fundo tingido da faixa + contornos irregulares + linha de
// chegada + placas de progresso
function desenharPista(scene, pista) {
    const { lut, comprimentoTotal } = pista;

    // pinta o anel da pista (onde a corrida acontece) com uma cor sólida parecida com o chão
    // da foto de fundo — desenhado em pequenos quadriláteros ao longo de toda a volta, o que
    // deixa um "buraco" natural na ilha central e do lado de fora, onde a foto continua visível
    const fundo = scene.add.graphics();
    fundo.fillStyle(COR_PISTA, 0.55);
    for (let i = 0; i < lut.length; i++) {
        const a = lut[i], b = lut[(i + 1) % lut.length];
        fundo.fillPoints([
            { x: a.extX, y: a.extY }, { x: b.extX, y: b.extY },
            { x: b.intX, y: b.intY }, { x: a.intX, y: a.intY }
        ], true);
    }

    const contorno = (chave) => {
        const g = scene.add.graphics();
        g.lineStyle(5, 0xffffff, 0.85);
        g.beginPath();
        lut.forEach((p, i) => {
            const jx = p[chave + 'X'];
            const jy = p[chave + 'Y'];
            if (i === 0) g.moveTo(jx, jy); else g.lineTo(jx, jy);
        });
        g.closePath();
        g.strokePath();
    };
    contorno('ext');
    contorno('int');

    // linha de chegada — risco perpendicular à pista, em s = 0
    const largada = pista.amostraEmS(0);
    const segmentos = 10;
    for (let i = 0; i < segmentos; i++) {
        const t0 = i / segmentos, t1 = (i + 1) / segmentos;
        const x0 = Phaser.Math.Linear(largada.intX, largada.extX, t0);
        const y0 = Phaser.Math.Linear(largada.intY, largada.extY, t0);
        const x1 = Phaser.Math.Linear(largada.intX, largada.extX, t1);
        const y1 = Phaser.Math.Linear(largada.intY, largada.extY, t1);
        const g = scene.add.graphics();
        g.lineStyle(8, i % 2 === 0 ? 0x000000 : 0xffffff, 0.9);
        g.lineBetween(x0, y0, x1, y1);
    }

    // placas de progresso a cada 1/4 de volta
    const marcos = ['LARGADA', '1/4 DA VOLTA', 'METADE DA VOLTA', '3/4 DA VOLTA'];
    for (let i = 1; i < 4; i++) {
        const amostra = pista.amostraEmS(comprimentoTotal * (i / 4));
        const px = amostra.x + amostra.nx * (pista.largura / 2 + 60);
        const py = amostra.y + amostra.ny * (pista.largura / 2 + 60);
        scene.add.text(px, py, marcos[i], {
            fontSize: '16px', fontFamily: 'Arial', fontStyle: 'bold',
            color: '#ffffff', backgroundColor: '#00000055', padding: { x: 6, y: 3 }
        }).setOrigin(0.5).setAlpha(0.8);
    }
}

// desenha uma zona especial (poça d'água ou grama/areia) que atravessa a pista numa faixa
// definida por posição ao longo do traçado (s), não mais por ângulo
function desenharZonaEspecial(scene, pista, zona, cor, alpha) {
    const passos = 16;
    const g = scene.add.graphics();
    g.fillStyle(cor, alpha);
    const pontos = [];
    for (let i = 0; i <= passos; i++) {
        const s = zona.sCentro - zona.meiaFaixaS + (2 * zona.meiaFaixaS) * (i / passos);
        const a = pista.amostraEmS(s);
        pontos.push({ x: a.extX, y: a.extY });
    }
    for (let i = passos; i >= 0; i--) {
        const s = zona.sCentro - zona.meiaFaixaS + (2 * zona.meiaFaixaS) * (i / passos);
        const a = pista.amostraEmS(s);
        pontos.push({ x: a.intX, y: a.intY });
    }
    g.fillPoints(pontos, true);
    return g;
}

// mancha de óleo — poça escura e brilhante no cimento; ali o atrito quase some e a
// tampinha escorrega bem mais longe do que o normal, de um jeito meio imprevisível
function desenharZonaOleo(scene, pista, zona) {
    desenharZonaEspecial(scene, pista, zona, 0x1a1a1a, 0.45);

    // reflexo irregular (o "brilho" do óleo) — algumas manchas mais escuras e um par de
    // reflexos esverdeados/arroxeados por cima, tipo poça de óleo de verdade
    const passos = 10;
    for (let m = 0; m < 4; m++) {
        const g = scene.add.graphics();
        const s0 = zona.sCentro - zona.meiaFaixaS + Phaser.Math.FloatBetween(0, 2 * zona.meiaFaixaS);
        const frac0 = Phaser.Math.FloatBetween(0.2, 0.8);
        const p0 = pista.pontoNaFaixa(s0, frac0);
        const raio = Phaser.Math.Between(14, 30);
        g.fillStyle(0x0d0d0d, 0.5);
        g.fillEllipse(p0.x, p0.y, raio * 1.6, raio);
    }

    const g = scene.add.graphics();
    for (let l = 0; l < 2; l++) {
        const cor = l === 0 ? 0x4a7d6b : 0x5a4a7d;
        g.lineStyle(2, cor, 0.35);
        g.beginPath();
        for (let i = 0; i <= passos; i++) {
            const t = i / passos;
            const s = zona.sCentro - zona.meiaFaixaS * 0.6 + zona.meiaFaixaS * 1.2 * t;
            const frac = 0.35 + l * 0.3 + Math.sin(t * 6) * 0.05;
            const p = pista.pontoNaFaixa(s, frac);
            if (i === 0) g.moveTo(p.x, p.y); else g.lineTo(p.x, p.y);
        }
        g.strokePath();
    }
}

// ---------- miudezas de oficina espalhadas pela pista: parafuso, porca, chave de boca,
// chave Philips, alicate, martelo e fita isolante. Desenhadas simples e pequenas — são
// cenário, não devem competir visualmente com as tampinhas.

function criarTexturaParafuso(scene) {
    const chave = 'decor_parafuso';
    if (scene.textures.exists(chave)) return chave;

    const g = scene.add.graphics();
    g.fillStyle(0x9a9a9a, 1);
    g.fillCircle(9, 9, 8);
    g.fillStyle(0x5f5f5f, 1);
    g.fillCircle(9, 9, 4.5);
    g.lineStyle(2, 0x2b2b2b, 0.9);
    g.lineBetween(6, 9, 12, 9); // fenda da cabeça do parafuso
    g.generateTexture(chave, 18, 18);
    g.destroy();
    return chave;
}

function criarTexturaPorca(scene) {
    const chave = 'decor_porca';
    if (scene.textures.exists(chave)) return chave;

    const g = scene.add.graphics();
    const cx = 9, cy = 9, r = 8;
    g.fillStyle(0x707070, 1);
    const hex = [];
    for (let i = 0; i < 6; i++) {
        const a = (Math.PI / 3) * i - Math.PI / 6;
        hex.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r });
    }
    g.fillPoints(hex, true);
    g.fillStyle(0x2b2b2b, 1);
    g.fillCircle(cx, cy, 3.2); // furo central
    g.generateTexture(chave, 18, 18);
    g.destroy();
    return chave;
}

function criarTexturaChaveDeBoca(scene) {
    const chave = 'decor_chave_boca';
    if (scene.textures.exists(chave)) return chave;

    const w = 34, h = 12;
    const g = scene.add.graphics();
    g.fillStyle(0x8f8f8f, 1);
    g.fillRoundedRect(4, h / 2 - 2.5, w - 8, 5, 2); // cabo
    g.fillCircle(w - 4, h / 2, 6); // cabeça de anel
    g.fillStyle(0x3d3d3d, 1);
    g.fillCircle(w - 4, h / 2, 2.6);
    g.fillStyle(0x8f8f8f, 1);
    g.fillTriangle(2, h / 2 - 4, 2, h / 2 + 4, 9, h / 2); // ponta de boca aberta
    g.generateTexture(chave, w, h);
    g.destroy();
    return chave;
}

function criarTexturaChavePhillips(scene) {
    const chave = 'decor_chave_phillips';
    if (scene.textures.exists(chave)) return chave;

    const w = 30, h = 10;
    const g = scene.add.graphics();
    g.fillStyle(0xc0392b, 1);
    g.fillRoundedRect(0, h / 2 - 3.5, 13, 7, 3); // cabo vermelho
    g.fillStyle(0xb0b0b0, 1);
    g.fillRect(12, h / 2 - 1.6, w - 12, 3.2); // haste metálica
    g.lineStyle(1.5, 0x4a4a4a, 0.9);
    g.lineBetween(w - 2, h / 2 - 2, w - 2, h / 2 + 2);
    g.generateTexture(chave, w, h);
    g.destroy();
    return chave;
}

function criarTexturaAlicate(scene) {
    const chave = 'decor_alicate';
    if (scene.textures.exists(chave)) return chave;

    const w = 30, h = 26;
    const g = scene.add.graphics();
    g.lineStyle(3.5, 0x707070, 1);
    // dois cabos cruzando num pivô (formato de "X" aberto, clássico de alicate)
    g.lineBetween(2, h - 2, 15, 11);
    g.lineBetween(w - 2, h - 2, 15, 11);
    g.fillStyle(0xd9534f, 1);
    g.fillCircle(4, h - 3, 3.4); // cabo com borracha (alça)
    g.fillCircle(w - 4, h - 3, 3.4);
    g.fillStyle(0x8f8f8f, 1);
    g.fillTriangle(15, 11, 9, 0, 15, 3); // bico superior
    g.fillTriangle(15, 11, 21, 0, 15, 3);
    g.generateTexture(chave, w, h);
    g.destroy();
    return chave;
}

function criarTexturaMartelo(scene) {
    const chave = 'decor_martelo';
    if (scene.textures.exists(chave)) return chave;

    const w = 32, h = 30;
    const g = scene.add.graphics();
    g.fillStyle(0x8a5a2b, 1);
    g.fillRoundedRect(13, 8, 5, 20, 2); // cabo de madeira
    g.fillStyle(0x555555, 1);
    g.fillRoundedRect(2, 0, 26, 11, 2); // cabeça
    g.fillStyle(0x3a3a3a, 0.7);
    g.fillRect(2, 0, 8, 11); // orelha de arrancar prego, num dos lados
    g.generateTexture(chave, w, h);
    g.destroy();
    return chave;
}

function criarTexturaFitaIsolante(scene) {
    const chave = 'decor_fita_isolante';
    if (scene.textures.exists(chave)) return chave;

    const g = scene.add.graphics();
    g.fillStyle(0x1a1a1a, 1);
    g.fillCircle(10, 10, 9);
    g.fillStyle(0x2b2b2b, 1);
    g.fillCircle(10, 10, 6);
    g.fillStyle(0x000000, 1);
    g.fillCircle(10, 10, 3); // miolo do rolo
    g.generateTexture(chave, 20, 20);
    g.destroy();
    return chave;
}

// espalha decoração ao longo de toda a borda externa da pista grande
function espalharDecoracaoNaPista(scene, pista) {
    const miudos = [criarTexturaFolha(scene), criarTexturaPedra(scene)];
    const voltas = 90;

    for (let i = 0; i < voltas; i++) {
        const s = Phaser.Math.FloatBetween(0, pista.comprimentoTotal);
        const margem = Phaser.Math.Between(50, 170);
        const a = pista.amostraEmS(s);
        const p = { x: a.extX + a.nx * margem, y: a.extY + a.ny * margem };
        if (p.x < 0 || p.x > MUNDO_LARGURA || p.y < 0 || p.y > MUNDO_ALTURA) continue;

        const tipo = Phaser.Utils.Array.GetRandom(miudos);
        scene.add.image(p.x, p.y, tipo).setRotation(Phaser.Math.FloatBetween(0, Math.PI * 2)).setAlpha(0.85);
    }

    // ferramentas de oficina esquecidas nas laterais da pista — parafusos e porcas soltos,
    // mais fartos (são pequenos e discretos); ferramentas maiores (chaves, alicate, martelo,
    // fita isolante), mais raras
    const miudosOficina = [criarTexturaParafuso(scene), criarTexturaPorca(scene)];
    for (let i = 0; i < 40; i++) {
        const s = Phaser.Math.FloatBetween(0, pista.comprimentoTotal);
        const margem = Phaser.Math.Between(25, 100);
        const a = pista.amostraEmS(s);
        const p = { x: a.extX + a.nx * margem, y: a.extY + a.ny * margem };
        if (p.x < 0 || p.x > MUNDO_LARGURA || p.y < 0 || p.y > MUNDO_ALTURA) continue;
        scene.add.image(p.x, p.y, Phaser.Utils.Array.GetRandom(miudosOficina))
            .setRotation(Phaser.Math.FloatBetween(0, Math.PI * 2)).setAlpha(0.9);
    }

    const ferramentasGrandes = [
        criarTexturaChaveDeBoca(scene), criarTexturaChavePhillips(scene),
        criarTexturaAlicate(scene), criarTexturaMartelo(scene), criarTexturaFitaIsolante(scene)
    ];
    for (let i = 0; i < 16; i++) {
        const s = Phaser.Math.FloatBetween(0, pista.comprimentoTotal);
        const margem = Phaser.Math.Between(70, 190); // principalmente nas laterais, longe da faixa
        const a = pista.amostraEmS(s);
        const p = { x: a.extX + a.nx * margem, y: a.extY + a.ny * margem };
        if (p.x < 0 || p.x > MUNDO_LARGURA || p.y < 0 || p.y > MUNDO_ALTURA) continue;
        scene.add.image(p.x, p.y, Phaser.Utils.Array.GetRandom(ferramentasGrandes))
            .setRotation(Phaser.Math.FloatBetween(0, Math.PI * 2)).setAlpha(0.9);
    }

    const pontosDecor = [];
    for (let i = 0; i < 6; i++) {
        const s = pista.comprimentoTotal * (i / 6) + Phaser.Math.FloatBetween(-40, 40);
        const margem = Phaser.Math.Between(120, 200);
        const a = pista.amostraEmS(s);
        pontosDecor.push({ x: a.extX + a.nx * margem, y: a.extY + a.ny * margem });
    }
    // algumas ferramentas um pouco mais perto do centro da pista, só pra enriquecer o cenário
    // sem nunca bloquear a faixa de corrida (ficam do lado de fora dela, perto da borda)
    Phaser.Utils.Array.Shuffle(pontosDecor).slice(0, 4).forEach(pos => {
        if (pos.x < 20 || pos.x > MUNDO_LARGURA - 20 || pos.y < 20 || pos.y > MUNDO_ALTURA - 20) return;
        scene.add.image(pos.x, pos.y, Phaser.Utils.Array.GetRandom(ferramentasGrandes))
            .setRotation(Phaser.Math.FloatBetween(-0.3, 0.3)).setAlpha(0.9);
    });
}

// decora a ilha central com ferramentas e algumas pedrinhas
function decorarIlhaCentral(scene, pista) {
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    pista.lut.forEach(p => {
        minX = Math.min(minX, p.intX); maxX = Math.max(maxX, p.intX);
        minY = Math.min(minY, p.intY); maxY = Math.max(maxY, p.intY);
    });
    const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
    const raioX = (maxX - minX) / 2 * 0.55, raioY = (maxY - minY) / 2 * 0.55;

    scene.add.image(cx, cy - raioY * 0.3, criarTexturaMartelo(scene)).setScale(1.6)
        .setRotation(Phaser.Math.FloatBetween(-0.2, 0.2));

    for (let i = 0; i < 10; i++) {
        const angulo = Phaser.Math.FloatBetween(0, Math.PI * 2);
        const r = Phaser.Math.FloatBetween(0.15, 0.75);
        scene.add.image(cx + Math.cos(angulo) * raioX * r, cy + Math.sin(angulo) * raioY * r, criarTexturaPedra(scene))
            .setAlpha(0.8).setRotation(Phaser.Math.FloatBetween(0, Math.PI * 2));
    }

    scene.add.text(cx, cy + raioY * 0.35, '🏁', { fontSize: '40px' }).setOrigin(0.5).setAlpha(0.9);
}
