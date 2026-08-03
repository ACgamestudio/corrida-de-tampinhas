// Elenco de personagens de "Heart Less OwO" — todos personagens originais,
// usando os cards já estilizados em assets/img/characters/ (recortados do
// layout de seleção oficial do jogo). Nenhum personagem, som ou vídeo do
// Dragon Ball é usado no jogo.

const CHARACTERS = [
  { id: 'heart',  name: 'Jokenpô', color: '#ff2d55' },
  { id: 'teddy',  name: 'Teddy',   color: '#e0a838' },
  { id: 'lolly',  name: 'Lolly',   color: '#ff3d9e' },
  { id: 'zuko',   name: 'Zuko',    color: '#2d8bff' },
  { id: 'miyu',   name: 'Miyu',    color: '#b95bff' },
  { id: 'razor',  name: 'Razor',   color: '#ff3b1f' },
  { id: 'shadow', name: 'Shadow',  color: '#9b5de5' },
  { id: 'blitz',  name: 'Blitz',   color: '#2fe0d0' },
  { id: 'toxin',  name: 'Toxin',   color: '#7ee034' },
  { id: 'nya',    name: 'Nya',     color: '#ffcc33' },
  { id: 'yuki',   name: 'Yuki',    color: '#3a7bff' },
  { id: 'star',   name: 'Star',    color: '#b98bff' },
  { id: 'void',   name: 'Void',    color: '#e0a838' },
  { id: 'king',   name: 'King',    color: '#b060ff' },
  { id: 'kai',    name: 'Kai',     color: '#ff3131' },
  { id: 'spark',  name: 'Spark',   color: '#ff8c1a' },
];

const charImg = (id) => `./assets/img/characters/${id}.png`;
