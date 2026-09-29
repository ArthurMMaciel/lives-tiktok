import { describe, expect, it } from 'vitest';
import type { PuzzleDefinition } from '@seven-errors/domain';
import { DisabledGuessInterpreter, GameApplication, MemoryEventStore, matchByRules } from './index';

const puzzle: PuzzleDefinition = {
  id: 'p', title: 'P', imageA: '/a', imageB: '/b', status: 'READY', createdAt: '2026-01-01T00:00:00.000Z',
  differences: [
    ['diff_01', 'Cadarço', ['cadarço', 'tenis'], ['cordão do sapato']],
    ['diff_02', 'Relógio', ['relogio'], ['faltou o relógio']],
    ['diff_03', 'Nuvem', ['nuvem'], ['nuvem sumiu']],
    ['diff_04', 'Listra', ['listra'], ['listra extra']],
    ['diff_05', 'Maçã', ['maca'], ['maçã a menos']],
    ['diff_06', 'Janela', ['janela'], ['cor da janela']],
    ['diff_07', 'Botão', ['botao'], ['perdeu um botão']]
  ].map(([id, name, keywords, aliases]) => ({
    id: id as string, description: name as string, shortDescription: name as string,
    keywords: keywords as string[], aliases: aliases as string[], region: { x: 0, y: 0, width: 0.1, height: 0.1 }, hint: 'olhe'
  }))
};

const createApp = () => new GameApplication({
  puzzle, interpreter: new DisabledGuessInterpreter(), eventStore: new MemoryEventStore(),
  responder: { send: async () => undefined }, confidenceThreshold: 0.78
});

describe('comment pipeline', () => {
  it('matches keywords and aliases before AI', () => {
    expect(matchByRules('o tênis mudou', puzzle.differences).differenceId).toBe('diff_01');
    expect(matchByRules('faltou o relógio', puzzle.differences).differenceId).toBe('diff_02');
  });

  it('does not award points from generic semantic context keywords', () => {
    const difference = {
      ...puzzle.differences[3]!,
      keywords: ['listra', 'camiseta', 'camisa'],
      ruleKeywords: ['listra'],
      aliases: ['listra extra', 'camiseta diferente']
    };
    expect(matchByRules('camiseta', [difference]).matched).toBe(false);
    expect(matchByRules('tem uma listra extra na camiseta', [difference]).differenceId).toBe('diff_04');
  });

  it('is idempotent by provider event id', async () => {
    const app = createApp(); app.start();
    const comment = { providerEventId: 'same', username: 'ana', message: 'cadarço', receivedAt: new Date().toISOString() };
    await Promise.all([app.enqueueComment(comment), app.enqueueComment(comment)]);
    expect(app.state().session?.found).toBe(1);
    expect(app.state().metrics.commentsReceived).toBe(1);
  });

  it('serializes competing comments and awards the first one only', async () => {
    const app = createApp(); app.start();
    await Promise.all([
      app.enqueueComment({ providerEventId: '1', username: 'joao', message: 'cadarço', receivedAt: new Date().toISOString() }),
      app.enqueueComment({ providerEventId: '2', username: 'pedro', message: 'o tenis mudou', receivedAt: new Date().toISOString() })
    ]);
    expect(app.state().session?.ranking).toHaveLength(1);
    expect(app.state().session?.ranking[0]?.username).toBe('joao');
    expect(app.state().session?.found).toBe(1);
  });

  it('uses the semantic interpreter only after rules miss', async () => {
    let calls = 0;
    const app = new GameApplication({
      puzzle,
      interpreter: {
        enabled: true,
        interpret: async () => { calls++; return { matched: true, differenceId: 'diff_03', confidence: 0.94, reason: 'Menção semântica ao céu.' }; }
      },
      eventStore: new MemoryEventStore(), responder: { send: async () => undefined }
    });
    app.start();
    await app.enqueueComment({ providerEventId: 'semantic', username: 'bia', message: 'sumiu aquela coisa branca lá em cima', receivedAt: new Date().toISOString() });
    expect(calls).toBe(1);
    expect(app.state().session?.puzzle.differences.find((item) => item.id === 'diff_03')?.foundBy).toBe('bia');
    expect(app.state().comments[0]?.matchMethod).toBe('AI_MATCH');
  });
});
