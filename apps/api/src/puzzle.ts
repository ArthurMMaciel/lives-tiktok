import type { PuzzleDefinition } from '@seven-errors/domain';

export const developmentPuzzle: PuzzleDefinition = {
  id: 'puzzle_dev_01',
  title: 'A tarde no parque',
  imageA: '/puzzles/dev-a.svg',
  imageB: '/puzzles/dev-b.svg',
  status: 'READY',
  createdAt: '2026-09-29T00:00:00.000Z',
  differences: [
    {
      id: 'diff_01', description: 'O cadarço do personagem mudou de vermelho para azul', shortDescription: 'Cadarço',
      keywords: ['cadarço', 'tenis', 'tênis', 'sapato', 'cordão'],
      ruleKeywords: ['cadarço'],
      aliases: ['cor do cadarço', 'cadarço diferente', 'tênis diferente', 'o negócio do sapato', 'cordão do tênis'],
      region: { x: 0.28, y: 0.79, width: 0.15, height: 0.1 }, hint: 'Olhe para os pés do personagem.'
    },
    {
      id: 'diff_02', description: 'O relógio desapareceu do pulso', shortDescription: 'Relógio',
      keywords: ['relogio', 'relógio', 'pulso'], aliases: ['faltou o relógio', 'sem relógio', 'relógio sumiu'],
      ruleKeywords: ['relogio', 'relógio'],
      region: { x: 0.54, y: 0.53, width: 0.08, height: 0.08 }, hint: 'Que horas são? Confira os braços.'
    },
    {
      id: 'diff_03', description: 'Uma nuvem desapareceu do céu', shortDescription: 'Nuvem',
      keywords: ['nuvem', 'ceu', 'céu'], aliases: ['nuvem sumiu', 'faltou uma nuvem', 'nuvem desapareceu'],
      ruleKeywords: [],
      region: { x: 0.69, y: 0.1, width: 0.2, height: 0.12 }, hint: 'Dê uma olhada no céu.'
    },
    {
      id: 'diff_04', description: 'A camiseta ganhou uma listra extra', shortDescription: 'Listra da camiseta',
      keywords: ['listra', 'camiseta', 'camisa'], aliases: ['listra extra', 'camiseta diferente', 'camisa tem outra listra'],
      ruleKeywords: ['listra'],
      region: { x: 0.37, y: 0.46, width: 0.2, height: 0.14 }, hint: 'Conte os detalhes da roupa.'
    },
    {
      id: 'diff_05', description: 'A árvore possui uma maçã a menos', shortDescription: 'Maçã da árvore',
      keywords: ['maca', 'maçã', 'arvore', 'árvore', 'fruta'], aliases: ['maçã a menos', 'faltou uma maçã', 'fruta sumiu'],
      ruleKeywords: ['maca', 'maçã'],
      region: { x: 0.08, y: 0.2, width: 0.19, height: 0.24 }, hint: 'Conte as frutas na árvore.'
    },
    {
      id: 'diff_06', description: 'A janela mudou de amarelo para roxo', shortDescription: 'Cor da janela',
      keywords: ['janela'], aliases: ['cor da janela', 'janela mudou de cor', 'janela diferente'],
      ruleKeywords: [],
      region: { x: 0.72, y: 0.42, width: 0.16, height: 0.18 }, hint: 'Observe a casa ao fundo.'
    },
    {
      id: 'diff_07', description: 'O personagem perdeu um botão', shortDescription: 'Botão',
      keywords: ['botao', 'botão'], aliases: ['perdeu um botão', 'faltou botão', 'botão sumiu'],
      ruleKeywords: [],
      region: { x: 0.46, y: 0.56, width: 0.05, height: 0.08 }, hint: 'Veja com cuidado o centro da roupa.'
    }
  ]
};
