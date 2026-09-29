import { describe, expect, it } from 'vitest';
import { GameSession, type PuzzleDefinition, validatePuzzle } from './index';

const puzzle = (): PuzzleDefinition => ({
  id: 'p1', title: 'Test', imageA: '/a.svg', imageB: '/b.svg', status: 'READY', createdAt: '2026-01-01T00:00:00.000Z',
  differences: Array.from({ length: 7 }, (_, index) => ({
    id: `d${index + 1}`, description: `Difference ${index + 1}`, shortDescription: `D${index + 1}`,
    keywords: [`key${index + 1}`], aliases: [`alias${index + 1}`],
    region: { x: 0.1, y: 0.1, width: 0.1, height: 0.1 }, hint: 'Hint'
  }))
});

describe('GameSession', () => {
  it('requires exactly seven unique, normalized differences', () => {
    expect(() => validatePuzzle({ ...puzzle(), differences: puzzle().differences.slice(0, 6) })).toThrow(/exactly 7/);
    const duplicate = puzzle(); duplicate.differences[1]!.id = 'd1';
    expect(() => validatePuzzle(duplicate)).toThrow(/Duplicate/);
  });

  it('scores only the first finder of a difference', () => {
    const session = new GameSession('s1', puzzle()); session.start('2026-01-01T00:00:00.000Z');
    expect(session.findDifference('d1', 'joao', '2026-01-01T00:00:01.000Z').kind).toBe('FOUND');
    expect(session.findDifference('d1', 'pedro', '2026-01-01T00:00:02.000Z').kind).toBe('ALREADY_FOUND');
    expect(session.ranking()).toEqual([{ username: 'joao', points: 1, reachedAt: '2026-01-01T00:00:01.000Z' }]);
  });

  it('orders tied scores by who reached the score first', () => {
    const session = new GameSession('s1', puzzle()); session.start('2026-01-01T00:00:00.000Z');
    session.findDifference('d1', 'maria', '2026-01-01T00:00:01.000Z');
    session.findDifference('d2', 'joao', '2026-01-01T00:00:02.000Z');
    expect(session.ranking().map((x) => x.username)).toEqual(['maria', 'joao']);
  });

  it('completes, undoes and resets a game', () => {
    const session = new GameSession('s1', puzzle()); session.start('2026-01-01T00:00:00.000Z');
    for (let i = 1; i <= 7; i++) session.findDifference(`d${i}`, 'ana', `2026-01-01T00:00:0${i}.000Z`);
    expect(session.status).toBe('COMPLETED');
    expect(session.ranking()[0]?.points).toBe(7);
    session.undo(); expect(session.status).toBe('ACTIVE'); expect(session.foundCount).toBe(6);
    session.reset(); expect(session.status).toBe('IDLE'); expect(session.foundCount).toBe(0); expect(session.ranking()).toEqual([]);
  });
});
