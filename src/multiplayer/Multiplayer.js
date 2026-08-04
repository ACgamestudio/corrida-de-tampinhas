// ---------- Multiplayer: salas de 2 jogadores (tampinhas 3 e 4 continuam IA) ----------
// Modelo: um código de sala de 5 caracteres, sem senha/login de verdade (só autenticação
// anônima do Firebase, pra cada jogador ter um uid único). O anfitrião (quem cria a sala)
// escolhe a pista e é quem manda as jogadas das duas IAs; o visitante só entra com o código.
// Cada peteleco (do jogador ou de uma IA) vira um documento na subcoleção "jogadas", em
// ordem — cada cliente escuta essa coleção e aplica localmente qualquer jogada que não seja
// a sua própria. Ao final de cada turno, o anfitrião manda uma "correção" (posição exata de
// cada tampinha) pro visitante realinhar, evitando que a física dos dois lados derive.
const Multiplayer = {
    CARACTERES_CODIGO: 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', // sem 0/O/1/I, pra não confundir

    gerarCodigo(tamanho = 5) {
        let codigo = '';
        for (let i = 0; i < tamanho; i++) {
            codigo += this.CARACTERES_CODIGO[Math.floor(Math.random() * this.CARACTERES_CODIGO.length)];
        }
        return codigo;
    },

    refSala(codigo) {
        return FirebaseServicos.db.collection('salas').doc(codigo);
    },

    // cria uma sala nova e devolve o código. Tenta até achar um código livre (bem raro colidir).
    async criarSala() {
        await FirebaseServicos.pronto;
        for (let tentativa = 0; tentativa < 5; tentativa++) {
            const codigo = this.gerarCodigo();
            const ref = this.refSala(codigo);
            const doc = await ref.get();
            if (doc.exists) continue;
            await ref.set({
                anfitriaoUid: FirebaseServicos.uid,
                visitanteUid: null,
                visitanteMarca: null,
                estado: 'aguardando_visitante', // -> 'jogando' -> 'finalizado'
                pista: null,
                marcas: null,
                niveisIA: null,
                turnoInicial: null,
                correcao: null,
                criadaEm: firebase.firestore.FieldValue.serverTimestamp()
            });
            return codigo;
        }
        throw new Error('Não consegui gerar um código de sala livre, tenta de novo.');
    },

    // entra numa sala existente como visitante. Lança erro se o código não existir ou a
    // sala já estiver cheia.
    async entrarSala(codigo) {
        await FirebaseServicos.pronto;
        const ref = this.refSala(codigo);
        const doc = await ref.get();
        if (!doc.exists) throw new Error('Essa sala não existe. Confere o código com quem te mandou.');
        const dados = doc.data();
        if (dados.visitanteUid && dados.visitanteUid !== FirebaseServicos.uid) {
            throw new Error('Essa sala já está com dois jogadores.');
        }
        await ref.update({ visitanteUid: FirebaseServicos.uid });
        return dados;
    },

    // visitante grava qual tampinha escolheu, assim que sai da tela de seleção
    async definirMarcaVisitante(codigo, nomeMarca) {
        await this.refSala(codigo).update({ visitanteMarca: nomeMarca });
    },

    // anfitrião fecha a configuração da corrida (pista + as 4 marcas na ordem certa +
    // níveis de IA + de quem é o primeiro turno) e libera o estado 'jogando' pros dois lados
    async definirSetupCorrida(codigo, { pista, marcas, niveisIA, turnoInicial }) {
        await this.refSala(codigo).update({
            pista, marcas, niveisIA, turnoInicial,
            estado: 'jogando'
        });
    },

    // escuta mudanças na sala inteira (estado, marcas, pista etc.) — devolve função pra parar
    ouvirSala(codigo, aoAtualizar) {
        return this.refSala(codigo).onSnapshot(doc => {
            if (doc.exists) aoAtualizar(doc.data());
        }, erro => console.error('[Multiplayer] erro escutando sala:', erro));
    },

    // envia uma jogada (peteleco de jogador ou de IA) como um novo documento na subcoleção,
    // com número sequencial crescente, pra manter a ordem de aplicação nos dois lados
    async enviarJogada(codigo, { indice, velX, velY, contador }) {
        const colecao = this.refSala(codigo).collection('jogadas');
        await colecao.add({
            indice, velX, velY,
            contador: contador === undefined ? null : contador, // nº do turno global, pra não reaplicar jogada velha
            criadaEm: firebase.firestore.FieldValue.serverTimestamp()
        });
    },

    // escuta só as jogadas NOVAS a partir de agora (ignora o histórico já existente ao entrar
    // no meio, o que não deveria acontecer numa corrida normal, mas evita repetir petelecos
    // antigos se a tela recarregar no meio de uma partida)
    ouvirJogadas(codigo, aoReceberJogada) {
        const colecao = this.refSala(codigo).collection('jogadas').orderBy('criadaEm', 'asc');
        let primeiraLeitura = true;
        return colecao.onSnapshot(snapshot => {
            if (primeiraLeitura) { primeiraLeitura = false; return; } // pula o que já existia
            snapshot.docChanges().forEach(mudanca => {
                if (mudanca.type === 'added') aoReceberJogada(mudanca.doc.data());
            });
        }, erro => console.error('[Multiplayer] erro escutando jogadas:', erro));
    },

    // correção de posição (só o anfitrião envia, ao final de cada turno)
    async enviarCorrecao(codigo, correcao) {
        await this.refSala(codigo).update({ correcao });
    },

    ouvirCorrecao(codigo, aoReceberCorrecao) {
        let ultimaVersaoVista = null;
        return this.refSala(codigo).onSnapshot(doc => {
            if (!doc.exists) return;
            const dados = doc.data();
            if (!dados.correcao) return;
            const marcador = JSON.stringify(dados.correcao); // sem campo de versão à parte: compara o conteúdo
            if (marcador === ultimaVersaoVista) return;
            ultimaVersaoVista = marcador;
            aoReceberCorrecao(dados.correcao);
        }, erro => console.error('[Multiplayer] erro escutando correção:', erro));
    },

    // avisa que o vencedor foi decidido (o anfitrião é quem grava; o visitante só lê)
    async definirVencedor(codigo, indiceVencedor) {
        await this.refSala(codigo).update({ estado: 'finalizado', vencedorIndice: indiceVencedor });
    },

    // best-effort: apaga a sala ao sair (não é crítico se falhar — sobra um doc de teste)
    encerrarSala(codigo) {
        this.refSala(codigo).delete().catch(() => {});
    }
};
