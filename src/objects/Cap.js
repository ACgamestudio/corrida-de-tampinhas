// ---------- Tampinhas: texturas geradas por código + fábrica do objeto de jogo ----------

function desenharEstrela(g, cx, cy, pontas, raioExterno, raioInterno) {
    const passos = pontas * 2;
    const pontos = [];
    for (let i = 0; i < passos; i++) {
        const r = (i % 2 === 0) ? raioExterno : raioInterno;
        const angulo = (Math.PI / pontas) * i - Math.PI / 2;
        pontos.push({ x: cx + Math.cos(angulo) * r, y: cy + Math.sin(angulo) * r });
    }
    g.fillPoints(pontos, true);
}

function desenharIcone(g, tipo, cx, cy, tam, corHex) {
    const cor = Phaser.Display.Color.HexStringToColor(corHex).color;
    g.fillStyle(cor, 0.95);
    g.lineStyle(3, cor, 0.95);

    switch (tipo) {
        case 'raio':
            g.fillPoints([
                { x: cx - 2, y: cy - tam },
                { x: cx + 5, y: cy - tam },
                { x: cx - 1, y: cy },
                { x: cx + 6, y: cy },
                { x: cx - 6, y: cy + tam },
                { x: cx - 1, y: cy + 2 },
                { x: cx - 7, y: cy + 2 }
            ], true);
            break;

        case 'estrela':
            desenharEstrela(g, cx, cy, 5, tam, tam / 2.2);
            break;

        case 'onda':
            g.beginPath();
            g.moveTo(cx - tam, cy + tam / 3);
            g.lineTo(cx - tam / 2, cy - tam / 3);
            g.lineTo(cx, cy + tam / 3);
            g.lineTo(cx + tam / 2, cy - tam / 3);
            g.lineTo(cx + tam, cy + tam / 3);
            g.strokePath();
            break;

        case 'gota':
            g.fillCircle(cx, cy + tam / 3, tam / 2);
            g.fillTriangle(cx - tam / 2, cy, cx + tam / 2, cy, cx, cy - tam);
            break;

        case 'diamante':
            g.fillPoints([
                { x: cx, y: cy - tam },
                { x: cx + tam * 0.7, y: cy },
                { x: cx, y: cy + tam },
                { x: cx - tam * 0.7, y: cy }
            ], true);
            break;

        case 'trevo':
            g.fillCircle(cx - tam / 2, cy - tam / 3, tam / 2.4);
            g.fillCircle(cx + tam / 2, cy - tam / 3, tam / 2.4);
            g.fillCircle(cx, cy + tam / 3, tam / 2.4);
            break;

        case 'coroa':
            g.fillPoints([
                { x: cx - tam, y: cy + tam / 2 },
                { x: cx - tam, y: cy - tam / 4 },
                { x: cx - tam / 2, y: cy + tam / 4 },
                { x: cx, y: cy - tam / 2 },
                { x: cx + tam / 2, y: cy + tam / 4 },
                { x: cx + tam, y: cy - tam / 4 },
                { x: cx + tam, y: cy + tam / 2 }
            ], true);
            break;

        case 'sol':
            for (let i = 0; i < 8; i++) {
                const ang = (Math.PI / 4) * i;
                g.lineBetween(
                    cx + Math.cos(ang) * (tam / 2),
                    cy + Math.sin(ang) * (tam / 2),
                    cx + Math.cos(ang) * tam,
                    cy + Math.sin(ang) * tam
                );
            }
            g.fillCircle(cx, cy, tam / 2.2);
            break;

        default:
            g.fillCircle(cx, cy, tam / 2);
    }
}

function criarTexturaTampinha(scene, marca) {
    const chave = 'tampinha_' + marca.nome.replace(/\s+/g, '_');
    if (scene.textures.exists(chave)) return chave;

    const tamanho = 76;
    const raio = 33;
    const centro = tamanho / 2;
    const g = scene.add.graphics();

    const dentes = 16;
    g.fillStyle(0xb8b8b8, 0.6);
    g.beginPath();
    for (let i = 0; i < dentes * 2; i++) {
        const angulo = (Math.PI * 2 / (dentes * 2)) * i;
        const r = (i % 2 === 0) ? raio : raio - 6;
        const x = centro + Math.cos(angulo) * r;
        const y = centro + Math.sin(angulo) * r;
        if (i === 0) g.moveTo(x, y); else g.lineTo(x, y);
    }
    g.closePath();
    g.fillPath();

    g.fillStyle(marca.cor, 1);
    g.fillCircle(centro, centro, raio - 7);

    g.fillStyle(0xffffff, 0.25);
    g.fillEllipse(centro - 12, centro - 14, 26, 14);

    desenharIcone(g, marca.icone, centro, centro + 6, 16, marca.corTexto);

    g.generateTexture(chave, tamanho, tamanho);
    g.destroy();

    return chave;
}

function criarTexturaParticula(scene, chave, cor) {
    if (scene.textures.exists(chave)) return chave;

    const g = scene.add.graphics();
    g.fillStyle(cor, 1);
    g.fillCircle(8, 8, 8);
    g.generateTexture(chave, 16, 16);
    g.destroy();

    return chave;
}

// monta a tampinha completa: sprite físico, sombra, rastro de partículas e estado de progresso na pista
function criarTampinha(scene, marca, pos, pista) {
    const sombra = scene.add.circle(pos.x + 4, pos.y + 6, 30, 0x000000, 0.25);

    const chave = criarTexturaTampinha(scene, marca);
    const t = scene.add.image(pos.x, pos.y, chave);
    scene.physics.add.existing(t);
    t.body.setCircle(30, 8, 8);
    // sem drag/damping do Arcade aqui — o atrito "de verdade" (tampinha sobre cimento, não
    // sobre gelo) é todo controlado pelo CapPhysics, que dá mais controle sobre a sensação
    // (desaceleração quase constante, não uma curva exponencial que nunca para de vez).
    t.body.setDamping(false);
    t.body.setDrag(0, 0);
    t.body.setBounce(0.55); // colisão "de metal": crispa e separa de verdade, não é mole feito massinha
    t.body.setMass(1);
    t.body.setCollideWorldBounds(true);

    t.nome = marca.nome;
    t.corBase = marca.cor;
    t.sombra = sombra;

    // progresso na volta: acompanha a posição ao longo do traçado (s), não mais um ângulo —
    // fica parado (não soma nem subtrai) enquanto a tampinha estiver fora da pista.
    const statusInicial = calcularStatusNaPista(pista, pos.x, pos.y);
    t.progressoAcumulado = 0;
    t.sAnterior = statusInicial.s;
    t.foraDaPista = false;
    t.molhando = false;

    t.rastro = scene.add.particles(0, 0, criarTexturaParticula(scene, 'particulaRastro_' + marca.nome.replace(/\s+/g, '_'), marca.cor), {
        lifespan: 250,
        speed: { min: 0, max: 20 },
        scale: { start: 0.5, end: 0 },
        alpha: { start: 0.4, end: 0 },
        quantity: 1,
        frequency: 40,
        follow: t
    });
    t.rastro.stop();

    return t;
}
