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
const COR_PISTA = 0x404040;        // tom parecido com o chão da foto de fundo, pra não conflitar

function pontoNaElipse(cx, cy, raioX, raioY, angulo) {
    return {
        x: cx + Math.cos(angulo) * raioX,
        y: cy + Math.sin(angulo) * raioY
    };
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

// monta os pontos de controle do traçado — uma volta grande com retas e curvas largas,
// amplitude calibrada (testada numericamente) pra nunca formar curva mais fechada do que a
// largura da pista permite, então nunca "pincha" nem se autointersecta.
function gerarPontosDeControle() {
    const N = 16;
    const centro = { x: MUNDO_LARGURA / 2, y: MUNDO_ALTURA / 2 - 50 };
    const pontos = [];
    for (let i = 0; i < N; i++) {
        const a = i * (Math.PI * 2 / N);
        const rx = 1000 + 90 * Math.sin(2 * a + 0.4) + 25 * Math.sin(3 * a - 0.9);
        const ry = 780 + 75 * Math.sin(2 * a - 0.3) + 20 * Math.sin(3 * a + 1.2);
        pontos.push({ x: centro.x + Math.cos(a) * rx, y: centro.y + Math.sin(a) * ry });
    }
    return { pontos, centro };
}

// constrói a pista inteira: traçado + LUT de amostras (posição, tangente, comprimento
// acumulado "s", normal) + pontos das bordas externa/interna (largura uniforme)
function construirPista() {
    const { pontos, centro } = gerarPontosDeControle();
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
    fundo.fillStyle(COR_PISTA, 1);
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
            const jx = p[chave + 'X'] + Phaser.Math.Between(-3, 3);
            const jy = p[chave + 'Y'] + Phaser.Math.Between(-3, 3);
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

// poça d'água + mangueira — devagar ali a tampinha escorrega pro lado
function desenharZonaAgua(scene, pista, zona) {
    desenharZonaEspecial(scene, pista, zona, 0x3f9fd6, 0.3);

    const passos = 16;
    const g = scene.add.graphics();
    g.lineStyle(2, 0xffffff, 0.4);
    for (let l = 0; l < 3; l++) {
        g.beginPath();
        for (let i = 0; i <= passos; i++) {
            const t = i / passos;
            const s = zona.sCentro - zona.meiaFaixaS * 0.7 + zona.meiaFaixaS * 1.4 * t;
            const frac = 0.28 + l * 0.22;
            const p = pista.pontoNaFaixa(s, frac);
            if (i === 0) g.moveTo(p.x, p.y); else g.lineTo(p.x, p.y);
        }
        g.strokePath();
    }
}

// trecho de grama/areia — mais atrito, a tampinha perde força mais rápido ali
function desenharZonaAreia(scene, pista, zona) {
    desenharZonaEspecial(scene, pista, zona, 0x9c8a4e, 0.35);

    for (let i = 0; i < 10; i++) {
        const s = zona.sCentro - zona.meiaFaixaS + Phaser.Math.FloatBetween(0, 2 * zona.meiaFaixaS);
        const frac = Phaser.Math.FloatBetween(0.15, 0.85);
        const p = pista.pontoNaFaixa(s, frac);
        scene.add.image(p.x, p.y, criarTexturaTouceira(scene)).setAlpha(0.85)
            .setRotation(Phaser.Math.FloatBetween(0, Math.PI * 2));
    }
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

    for (let i = 0; i < 45; i++) {
        const s = Phaser.Math.FloatBetween(0, pista.comprimentoTotal);
        const margem = Phaser.Math.Between(20, 90);
        const a = pista.amostraEmS(s);
        const p = { x: a.extX + a.nx * margem, y: a.extY + a.ny * margem };
        if (p.x < 0 || p.x > MUNDO_LARGURA || p.y < 0 || p.y > MUNDO_ALTURA) continue;
        scene.add.image(p.x, p.y, criarTexturaTouceira(scene)).setAlpha(0.9);
    }

    const pontosDecor = [];
    for (let i = 0; i < 6; i++) {
        const s = pista.comprimentoTotal * (i / 6) + Phaser.Math.FloatBetween(-40, 40);
        const margem = Phaser.Math.Between(120, 200);
        const a = pista.amostraEmS(s);
        pontosDecor.push({ x: a.extX + a.nx * margem, y: a.extY + a.ny * margem });
    }
    Phaser.Utils.Array.Shuffle(pontosDecor).slice(0, 4).forEach(pos => {
        if (pos.x < 20 || pos.x > MUNDO_LARGURA - 20 || pos.y < 20 || pos.y > MUNDO_ALTURA - 20) return;
        scene.add.image(pos.x, pos.y, criarTexturaVaso(scene)).setRotation(Phaser.Math.FloatBetween(-0.08, 0.08));
    });
    const cantoChinelo = pontosDecor[4] || pontosDecor[0];
    scene.add.image(cantoChinelo.x + 14, cantoChinelo.y + 6, criarTexturaChinelo(scene))
        .setRotation(Phaser.Math.FloatBetween(-0.5, 0.5)).setAlpha(0.9);
}

// decora a ilha central com um vasinho e algumas pedrinhas
function decorarIlhaCentral(scene, pista) {
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    pista.lut.forEach(p => {
        minX = Math.min(minX, p.intX); maxX = Math.max(maxX, p.intX);
        minY = Math.min(minY, p.intY); maxY = Math.max(maxY, p.intY);
    });
    const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
    const raioX = (maxX - minX) / 2 * 0.55, raioY = (maxY - minY) / 2 * 0.55;

    scene.add.image(cx, cy - raioY * 0.3, criarTexturaVaso(scene)).setScale(1.4);

    for (let i = 0; i < 10; i++) {
        const angulo = Phaser.Math.FloatBetween(0, Math.PI * 2);
        const r = Phaser.Math.FloatBetween(0.15, 0.75);
        scene.add.image(cx + Math.cos(angulo) * raioX * r, cy + Math.sin(angulo) * raioY * r, criarTexturaPedra(scene))
            .setAlpha(0.8).setRotation(Phaser.Math.FloatBetween(0, Math.PI * 2));
    }

    scene.add.text(cx, cy + raioY * 0.35, '🏁', { fontSize: '40px' }).setOrigin(0.5).setAlpha(0.9);
}
