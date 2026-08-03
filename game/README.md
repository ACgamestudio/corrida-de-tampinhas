# Heart Less OwO Jokenpô

Jogo de luta (fighting game) com o elenco original de **Heart Less OwO** (16
personagens: Jokenpô, Teddy, Lolly, Zuko, Miyu, Razor, Shadow, Blitz, Toxin,
Nya, Yuki, Star, Void, King, Kai e Spark). Nenhum personagem, imagem, som ou
vídeo do Dragon Ball é usado — todo o visual vem da sua própria arte, e os
sons são gerados por código (Web Audio API), sem depender de nenhum arquivo
externo.

## Como abrir

Abra `index.html` no navegador (ou suba a pasta inteira num servidor
estático). Não precisa de instalação nem build.

## Fluxo do jogo

1. **Tela inicial** — mostra o pôster do jogo com o botão **INICIAR**. Esse
   clique libera o áudio do navegador, tenta abrir o jogo em **tela cheia**
   e travar a **orientação paisagem** (funciona na maioria dos navegadores
   mobile; no desktop a tela cheia funciona, o travamento de orientação é
   ignorado silenciosamente por não fazer sentido). Se o navegador não
   suportar travar a orientação (ex: iOS Safari), aparece um aviso pedindo
   pra girar o aparelho sempre que a tela estiver em modo retrato.
2. **Vídeo da produtora** — `assets/videos/produtora.mp4` (incluído).
3. **Vídeo de intro** — `assets/videos/intro.mp4` (incluído).
4. **Seleção de personagem** — grade com os 16 lutadores, cada card já vem
   com a cor e o nome estilizados. Clique pra selecionar e depois em
   CONFIRMAR.
5. **Jogo** — duelo estilo fighting game contra um rival sorteado entre os
   outros personagens. Cada um tem uma barra de vida e um medidor de
   especial. A cada rodada você escolhe **Soco**, **Chute**, **Bloqueio** ou
   **Especial** (só disponível com o medidor cheio):
   - Soco vence Chute (é mais rápido)
   - Chute quebra Bloqueio
   - Bloqueio anula Soco (e ainda revida um pouco)
   - Especial causa dano pesado (reduzido se bloqueado)

   Quem zerar a vida primeiro perde. Ao final (vitória, derrota ou
   nocaute duplo), o jogo sempre volta para a **tela de seleção de
   personagens** — nunca para a tela inicial/vídeos de novo.

## Vídeos de golpe especial e vitória (opcionais)

O jogo já está preparado para tocar um vídeo próprio de cada personagem:

- **Ao usar o Especial** — toca em tela cheia por cima da luta, depois volta
  pro combate sozinho.
- **Ao vencer a partida** — toca dentro da tela de nocaute, junto com o
  confete.

Basta salvar os arquivos com o **id** do personagem (não o nome exibido) em:

```
assets/videos/specials/<id>.mp4   -> toca quando ESSE personagem usa o Especial
assets/videos/victory/<id>.mp4    -> toca quando ESSE personagem vence
```

Os ids usados internamente (podem ser diferentes do nome mostrado na tela):

| Nome exibido | id (nome do arquivo) |
|---|---|
| Jokenpô | `heart` |
| Teddy | `teddy` |
| Lolly | `lolly` |
| Zuko | `zuko` |
| Miyu | `miyu` |
| Razor | `razor` |
| Shadow | `shadow` |
| Blitz | `blitz` |
| Toxin | `toxin` |
| Nya | `nya` |
| Yuki | `yuki` |
| Star | `star` |
| Void | `void` |
| King | `king` |
| Kai | `kai` |
| Spark | `spark` |

Nenhum desses vídeos é obrigatório — o jogo funciona normalmente sem eles
(o Especial só não mostra o clipe, e a vitória só mostra o confete). Vá
soltando os arquivos nessas pastas conforme forem ficando prontos, não
precisa mexer em nenhum código. Recomendado: clipes curtos (1–3s) e bem
comprimidos, pra não pesar o jogo.

## Sons

Todos os efeitos (socos, chutes, bloqueios, especial, seleção, vitória,
derrota) e a musiquinha de fundo são **gerados por código** em
`sound.js`, usando osciladores e ruído filtrado da Web Audio API. Não é
necessário adicionar nenhum arquivo `.mp3`. Se quiser trocar por sons/
músicas reais no futuro, é só editar `sound.js` e tocar arquivos de áudio
próprios ali dentro.

## Estrutura de pastas

```
index.html
styles.css
script.js
sound.js                 -> motor de som sintetizado (SFX + música de fundo)
characters.js             -> lista dos 16 personagens (nome/cor/id)
assets/
  img/
    poster.png             -> pôster completo (usado na tela inicial)
    characters/*.png        -> cada card de personagem já estilizado
  videos/
    produtora.mp4            -> vídeo da produtora (já incluído)
    intro.mp4                 -> vídeo de intro (já incluído)
```

## Personalizar

- **Nomes/cores dos personagens**: edite `characters.js`.
- **Vida máxima / dano de cada golpe**: constantes no topo de `script.js`
  (`MAX_HP`) e dentro da função `resolveTurn`.
- **Sons**: edite `sound.js` (frequências, duração, tipo de onda).
- **Cards de personagem**: se algum card precisar de ajuste, troque o PNG
  correspondente em `assets/img/characters/` (mesmo nome de arquivo).
