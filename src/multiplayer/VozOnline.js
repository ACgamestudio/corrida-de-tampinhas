// ---------- Voz online: conversa por voz entre os 2 jogadores da sala ----------
// Como funciona: áudio direto entre os dois navegadores (WebRTC, ponto a ponto — não passa
// por servidor nenhum). O Firestore é usado só pro "aperto de mão" inicial: o anfitrião
// grava uma oferta, o visitante responde, e os dois trocam candidatos de rede (ICE).
// Depois disso a conversa não gasta mais nada do Firebase.
//
// Por padrão o microfone entra MUDO e só abre enquanto o jogador segura o botão de falar
// (push-to-talk). Isso evita o problema clássico de sala aberta: barulho de casa, TV ligada
// e o eco da própria voz voltando do alto-falante do outro.
//
// Nada aqui pode derrubar o jogo: qualquer falha (microfone negado, rede bloqueada,
// navegador sem suporte) cai em estado 'indisponivel' e a corrida continua normal.
const VozOnline = {
    // servidores STUN públicos: só servem pra cada lado descobrir seu próprio IP externo.
    // Em redes mais fechadas (4G/5G com NAT simétrico, wifi corporativo) STUN não basta e
    // seria preciso um servidor TURN, que é pago — ver observação no README.
    SERVIDORES: [
        { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }
    ],

    ativa: false,
    estado: 'desligada',      // desligada | pedindo | conectando | pronta | indisponivel
    motivo: '',
    falando: false,           // meu microfone está aberto agora?
    outroFalando: false,      // detectado por nível de áudio do outro lado
    saidaMuda: false,

    pc: null,
    fluxoLocal: null,
    audioRemoto: null,
    codigo: null,
    souAnfitriao: false,
    aoMudar: null,            // callback pra UI

    _paradas: [],
    _analiseRemota: null,
    _timerNivel: null,

    _avisar() {
        if (typeof this.aoMudar === 'function') {
            try { this.aoMudar(this.estado, this); } catch (e) { console.error('[Voz] callback:', e); }
        }
    },

    _setEstado(estado, motivo = '') {
        this.estado = estado;
        this.motivo = motivo;
        this._avisar();
    },

    ref() {
        return FirebaseServicos.db.collection('salas').doc(this.codigo);
    },

    // ---------- ligar ----------
    async iniciar({ codigo, souAnfitriao, aoMudar }) {
        if (this.ativa) return;
        this.codigo = codigo;
        this.souAnfitriao = souAnfitriao === true;
        this.aoMudar = aoMudar || null;
        this.ativa = true;
        this.saidaMuda = false;
        this.falando = false;
        this.outroFalando = false;

        if (!window.RTCPeerConnection || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            this._setEstado('indisponivel', 'Este navegador não suporta voz.');
            return;
        }

        this._setEstado('pedindo', 'Liberando o microfone...');

        try {
            this.fluxoLocal = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,   // sem isso o outro escuta a própria voz voltando
                    noiseSuppression: true,
                    autoGainControl: true
                },
                video: false
            });
        } catch (erro) {
            console.warn('[Voz] microfone não liberado:', erro);
            this._setEstado('indisponivel', 'Microfone não liberado. Você continua ouvindo o outro jogador.');
            // segue mesmo sem microfone: dá pra ficar só escutando
            this.fluxoLocal = null;
        }

        // entra mudo: só abre enquanto segurar o botão de falar
        if (this.fluxoLocal) {
            this.fluxoLocal.getAudioTracks().forEach(t => { t.enabled = false; });
        }

        try {
            await this._conectar();
        } catch (erro) {
            console.error('[Voz] falha ao conectar:', erro);
            this._setEstado('indisponivel', 'Não consegui abrir o canal de voz.');
        }
    },

    async _conectar() {
        this._setEstado('conectando', 'Conectando a voz...');

        this.pc = new RTCPeerConnection({ iceServers: this.SERVIDORES });

        if (this.fluxoLocal) {
            this.fluxoLocal.getTracks().forEach(t => this.pc.addTrack(t, this.fluxoLocal));
        } else {
            // sem microfone, ainda precisa declarar que quer RECEBER áudio
            this.pc.addTransceiver('audio', { direction: 'recvonly' });
        }

        // elemento de áudio pra tocar a voz do outro lado
        this.audioRemoto = document.createElement('audio');
        this.audioRemoto.autoplay = true;
        this.audioRemoto.playsInline = true;
        this.audioRemoto.style.display = 'none';
        document.body.appendChild(this.audioRemoto);

        this.pc.ontrack = (evento) => {
            const fluxo = evento.streams[0];
            if (!fluxo) return;
            this.audioRemoto.srcObject = fluxo;
            this.audioRemoto.play().catch(() => {}); // se o autoplay barrar, o 1º toque na tela resolve
            this._monitorarNivel(fluxo);
        };

        this.pc.onconnectionstatechange = () => {
            const s = this.pc ? this.pc.connectionState : 'closed';
            if (s === 'connected') this._setEstado('pronta', '');
            else if (s === 'failed') this._setEstado('indisponivel', 'A rede bloqueou a conexão de voz.');
            else if (s === 'disconnected') this._setEstado('conectando', 'Voz caiu, tentando religar...');
        };

        const minhaIce = this.souAnfitriao ? 'iceAnfitriao' : 'iceVisitante';
        const iceDoOutro = this.souAnfitriao ? 'iceVisitante' : 'iceAnfitriao';

        this.pc.onicecandidate = (evento) => {
            if (!evento.candidate) return;
            this.ref().collection(minhaIce).add(evento.candidate.toJSON())
                .catch(erro => console.warn('[Voz] falha enviando candidato:', erro));
        };

        this._paradas.push(
            this.ref().collection(iceDoOutro).onSnapshot(snap => {
                snap.docChanges().forEach(m => {
                    if (m.type !== 'added' || !this.pc) return;
                    this.pc.addIceCandidate(new RTCIceCandidate(m.doc.data()))
                        .catch(erro => console.warn('[Voz] candidato recusado:', erro));
                });
            }, erro => console.warn('[Voz] erro escutando ICE:', erro))
        );

        const sinais = this.ref().collection('sinais');

        if (this.souAnfitriao) {
            // apaga sinalização de qualquer tentativa anterior nessa mesma sala: uma
            // "resposta" velha faria o anfitrião fechar o canal com um SDP inválido
            await this._limparSinalizacao();

            const oferta = await this.pc.createOffer({ offerToReceiveAudio: true });
            await this.pc.setLocalDescription(oferta);
            await sinais.doc('oferta').set({ tipo: oferta.type, sdp: oferta.sdp });

            this._paradas.push(
                sinais.doc('resposta').onSnapshot(async doc => {
                    if (!doc.exists || !this.pc) return;
                    if (this.pc.currentRemoteDescription) return;
                    const d = doc.data();
                    await this.pc.setRemoteDescription(new RTCSessionDescription({ type: d.tipo, sdp: d.sdp }));
                }, erro => console.warn('[Voz] erro escutando resposta:', erro))
            );
        } else {
            this._paradas.push(
                sinais.doc('oferta').onSnapshot(async doc => {
                    if (!doc.exists || !this.pc) return;
                    if (this.pc.currentRemoteDescription) return;
                    const d = doc.data();
                    await this.pc.setRemoteDescription(new RTCSessionDescription({ type: d.tipo, sdp: d.sdp }));
                    const resposta = await this.pc.createAnswer();
                    await this.pc.setLocalDescription(resposta);
                    await sinais.doc('resposta').set({ tipo: resposta.type, sdp: resposta.sdp });
                }, erro => console.warn('[Voz] erro escutando oferta:', erro))
            );
        }
    },

    async _limparSinalizacao() {
        const ref = this.ref();
        const nomes = ['sinais', 'iceAnfitriao', 'iceVisitante'];
        for (const nome of nomes) {
            try {
                const snap = await ref.collection(nome).get();
                await Promise.all(snap.docs.map(d => d.ref.delete().catch(() => {})));
            } catch (erro) {
                console.warn('[Voz] não consegui limpar ' + nome + ':', erro);
            }
        }
    },

    // ---------- detecta quando o outro está falando (só pra mostrar na tela) ----------
    _monitorarNivel(fluxo) {
        try {
            SomFX.iniciar();
            const ctx = SomFX.ctx;
            if (!ctx) return;
            const fonte = ctx.createMediaStreamSource(fluxo);
            const analise = ctx.createAnalyser();
            analise.fftSize = 512;
            fonte.connect(analise); // NÃO conecta no destino: o <audio> já toca o som
            this._analiseRemota = analise;

            const dados = new Uint8Array(analise.frequencyBinCount);
            clearInterval(this._timerNivel);
            this._timerNivel = setInterval(() => {
                if (!this._analiseRemota) return;
                this._analiseRemota.getByteFrequencyData(dados);
                let soma = 0;
                for (let i = 0; i < dados.length; i++) soma += dados[i];
                const media = soma / dados.length;
                const falando = !this.saidaMuda && media > 12;
                if (falando !== this.outroFalando) {
                    this.outroFalando = falando;
                    this._avisar();
                }
            }, 160);
        } catch (erro) {
            console.warn('[Voz] não consegui medir o nível de áudio:', erro);
        }
    },

    // ---------- controles ----------
    temMicrofone() {
        return !!(this.fluxoLocal && this.fluxoLocal.getAudioTracks().length);
    },

    // abre/fecha o microfone (push-to-talk)
    falar(abrir) {
        if (!this.temMicrofone()) return false;
        const novo = abrir === true;
        if (novo === this.falando) return novo;
        this.falando = novo;
        this.fluxoLocal.getAudioTracks().forEach(t => { t.enabled = novo; });
        this._avisar();
        return novo;
    },

    // muta/desmuta o que CHEGA do outro jogador
    alternarSaida() {
        this.saidaMuda = !this.saidaMuda;
        if (this.audioRemoto) this.audioRemoto.muted = this.saidaMuda;
        if (this.saidaMuda) this.outroFalando = false;
        this._avisar();
        return this.saidaMuda;
    },

    // ---------- desligar ----------
    encerrar() {
        this.ativa = false;
        this.aoMudar = null; // a cena já pode ter sido destruída: não chama mais a UI
        clearInterval(this._timerNivel);
        this._timerNivel = null;
        this._analiseRemota = null;

        this._paradas.forEach(parar => { try { parar(); } catch (e) {} });
        this._paradas = [];

        if (this.fluxoLocal) {
            this.fluxoLocal.getTracks().forEach(t => t.stop());
            this.fluxoLocal = null;
        }
        if (this.pc) {
            try { this.pc.ontrack = null; this.pc.onicecandidate = null; this.pc.close(); } catch (e) {}
            this.pc = null;
        }
        if (this.audioRemoto) {
            this.audioRemoto.srcObject = null;
            this.audioRemoto.remove();
            this.audioRemoto = null;
        }

        // limpa a sinalização da sala (best-effort: se falhar, sobram uns docs pequenos)
        if (this.codigo && this.souAnfitriao) {
            const ref = this.ref();
            ['sinais', 'iceAnfitriao', 'iceVisitante'].forEach(nome => {
                ref.collection(nome).get()
                    .then(snap => snap.forEach(d => d.ref.delete().catch(() => {})))
                    .catch(() => {});
            });
        }

        this.codigo = null;
        this.falando = false;
        this.outroFalando = false;
        this.saidaMuda = false;
        this.estado = 'desligada';
        this.motivo = '';
    }
};
