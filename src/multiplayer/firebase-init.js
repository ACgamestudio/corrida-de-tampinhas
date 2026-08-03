// ---------- Firebase: configuração do projeto + inicialização (Auth anônimo + Firestore) ----------
// Essas chaves não são segredo — são públicas por design no Firebase (a segurança de verdade
// vem das "regras" do Firestore, configuradas no console, não de esconder isso aqui).
const firebaseConfig = {
    apiKey: "AIzaSyAGHpnvI8-6kNrBrz1IxinWA06xN7PCtYQ",
    authDomain: "corrida-de-tampinhas.firebaseapp.com",
    projectId: "corrida-de-tampinhas",
    storageBucket: "corrida-de-tampinhas.firebasestorage.app",
    messagingSenderId: "21340124050",
    appId: "1:21340124050:web:cd4798f6ff2b594433c74b"
};

const FirebaseServicos = {
    app: null,
    auth: null,
    db: null,
    uid: null,
    pronto: null // Promise que resolve quando o login anônimo terminar
};

FirebaseServicos.pronto = new Promise((resolve, reject) => {
    try {
        FirebaseServicos.app = firebase.initializeApp(firebaseConfig);
        FirebaseServicos.auth = firebase.auth();
        FirebaseServicos.db = firebase.firestore();

        FirebaseServicos.auth.onAuthStateChanged(usuario => {
            if (usuario) {
                FirebaseServicos.uid = usuario.uid;
                resolve(FirebaseServicos);
            }
        });

        FirebaseServicos.auth.signInAnonymously().catch(erro => {
            console.error('[Firebase] falha no login anônimo:', erro);
            reject(erro);
        });
    } catch (erro) {
        console.error('[Firebase] falha ao inicializar:', erro);
        reject(erro);
    }
});
