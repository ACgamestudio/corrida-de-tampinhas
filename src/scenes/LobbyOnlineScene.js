// ---------- Lobby online: criar sala (anfitrião) ou entrar com código (visitante) ----------
class LobbyOnlineScene extends Phaser.Scene {
    constructor() {
        super('LobbyOnlineScene');
    }

    preload() {
        Carregando.acompanhar(this, 'Carregando...');
        this.load.audio('musica_menu', 'assets/audio/musica_menu.mp3');
    }

    create() {
        criarBotaoTelaCheia(this);
        tocarMusicaDeFundo(this, 'musica_menu', 0.35);

        this.pararEscutaSala = null;

        this.add.image(480, 270, criarTexturaMadeira(this));
        desenharMolduraPainel(this);

        this.add.text(480, 60, '🌐 JOGAR ONLINE', {
            fontSize: '30px',
            fontFamily: FONTE_TITULO || 'Arial',
            fontStyle: '700',
            color: '#fff5e0',
            stroke: '#3e2412',
            strokeThickness: 6
        }).setOrigin(0.5);

        this.textoStatus = this.add.text(480, 120, 'Jogue com um amigo — tampinhas 3 e 4 continuam IA.', {
            fontSize: '15px',
            fontFamily: 'Arial',
            color: '#e8dcc4',
            align: 'center',
            wordWrap: { width: 640 }
        }).setOrigin(0.5);

        this.textoCodigo = this.add.text(480, 220, '', {
            fontSize: '52px',
            fontFamily: FONTE_TITULO || 'Arial',
            fontStyle: '700',
            color: '#ffd76b',
            stroke: '#3e2412',
            strokeThickness: 6,
            letterSpacing: 6
        }).setOrigin(0.5).setVisible(false);

        this.botaoCriar = criarBotaoEstilizado(this, 330, 300, 260, 56, '➕ Criar sala', 0x2ecc71, 0x1e8449, '#052e13', () => this.criarSala());
        this.botaoEntrar = criarBotaoEstilizado(this, 630, 300, 260, 56, '🔑 Entrar com código', 0x3498db, 0x21618c, '#08243a', () => this.entrarSala());

        criarBotaoEstilizado(this, 180, 500, 160, 48, '←  Voltar', 0x2b2b2b, 0x555555, '#ffffff', () => this.voltarAoMenu());

        this.events.once('shutdown', () => {
            if (this.pararEscutaSala) this.pararEscutaSala();
        });
    }

    setStatus(texto) {
        this.textoStatus.setText(texto);
    }

    voltarAoMenu() {
        if (this.pararEscutaSala) this.pararEscutaSala();
        if (JogoState.online && JogoState.souAnfitriao && JogoState.salaCodigo) {
            Multiplayer.encerrarSala(JogoState.salaCodigo);
        }
        JogoState.online = false;
        JogoState.salaCodigo = null;
        this.scene.start('MenuScene');
    }

    async criarSala() {
        this.botaoCriar.disableInteractive();
        this.botaoEntrar.disableInteractive();
        this.setStatus('Criando sala...');

        try {
            const codigo = await Multiplayer.criarSala();
            JogoState.online = true;
            JogoState.souAnfitriao = true;
            JogoState.salaCodigo = codigo;
            JogoState.meuIndice = 0;

            this.textoCodigo.setText(codigo).setVisible(true);
            this.setStatus('Compartilhe esse código com quem vai jogar. Aguardando a outra pessoa entrar...');

            this.pararEscutaSala = Multiplayer.ouvirSala(codigo, dados => {
                if (dados.visitanteUid) {
                    if (this.pararEscutaSala) this.pararEscutaSala();
                    this.scene.start('SelecaoScene');
                }
            });
        } catch (erro) {
            console.error('[LobbyOnline] falha ao criar sala:', erro);
            this.setStatus('Não consegui criar a sala. Confere sua internet e tenta de novo.');
            this.botaoCriar.setInteractive({ useHandCursor: true });
            this.botaoEntrar.setInteractive({ useHandCursor: true });
        }
    }

    async entrarSala() {
        const digitado = window.prompt('Digite o código da sala (5 caracteres):');
        if (!digitado) return;
        const codigo = digitado.trim().toUpperCase();

        this.botaoCriar.disableInteractive();
        this.botaoEntrar.disableInteractive();
        this.setStatus('Entrando na sala ' + codigo + '...');

        try {
            await Multiplayer.entrarSala(codigo);
            JogoState.online = true;
            JogoState.souAnfitriao = false;
            JogoState.salaCodigo = codigo;
            JogoState.meuIndice = 1;
            this.scene.start('SelecaoScene');
        } catch (erro) {
            console.error('[LobbyOnline] falha ao entrar na sala:', erro);
            this.setStatus(erro.message || 'Não consegui entrar nessa sala.');
            this.botaoCriar.setInteractive({ useHandCursor: true });
            this.botaoEntrar.setInteractive({ useHandCursor: true });
        }
    }
}
