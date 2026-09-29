import type { DifferenceView, PuzzleView, RankingEntry, Region, SessionStatus } from '@seven-errors/shared';

export interface DifferenceDefinition {
  id: string;
  description: string;
  shortDescription: string;
  keywords: string[];
  /** Subset of keywords specific enough to award a deterministic match. */
  ruleKeywords?: string[];
  aliases: string[];
  region: Region;
  hint: string;
}

export interface PuzzleDefinition {
  id: string;
  title: string;
  imageA: string;
  imageB: string;
  status: 'DRAFT' | 'READY' | 'ARCHIVED';
  createdAt: string;
  differences: DifferenceDefinition[];
}

export type FindDifferenceResult =
  | { kind: 'FOUND'; difference: DifferenceView; found: number; total: number; completed: boolean }
  | { kind: 'ALREADY_FOUND'; difference: DifferenceView; found: number; total: number }
  | { kind: 'NOT_FOUND'; found: number; total: number }
  | { kind: 'SESSION_NOT_ACTIVE'; found: number; total: number };

interface ScoreRecord { username: string; points: number; reachedAt: string }
interface FindRecord { differenceId: string; username: string; at: string }

function assertRegion(region: Region): void {
  const values = [region.x, region.y, region.width, region.height];
  if (values.some((value) => !Number.isFinite(value) || value < 0 || value > 1)) {
    throw new Error('Difference regions must use normalized values between 0 and 1');
  }
  if (region.x + region.width > 1 || region.y + region.height > 1) {
    throw new Error('Difference region must fit inside the image');
  }
}

export function validatePuzzle(puzzle: PuzzleDefinition): PuzzleDefinition {
  if (puzzle.differences.length !== 7) throw new Error('A puzzle must contain exactly 7 differences');
  const ids = new Set<string>();
  for (const difference of puzzle.differences) {
    if (ids.has(difference.id)) throw new Error(`Duplicate difference id: ${difference.id}`);
    ids.add(difference.id);
    if (!difference.description || !difference.shortDescription) throw new Error('Difference descriptions are required');
    assertRegion(difference.region);
  }
  return structuredClone(puzzle);
}

export class GameSession {
  readonly id: string;
  private readonly basePuzzle: PuzzleDefinition;
  private differences = new Map<string, DifferenceView>();
  private scores = new Map<string, ScoreRecord>();
  private history: FindRecord[] = [];
  private _status: SessionStatus = 'IDLE';
  private _startedAt?: string;
  private _finishedAt?: string;

  constructor(id: string, puzzle: PuzzleDefinition) {
    this.id = id;
    this.basePuzzle = validatePuzzle(puzzle);
    this.resetDifferences();
  }

  get status(): SessionStatus { return this._status; }
  get startedAt(): string | undefined { return this._startedAt; }
  get finishedAt(): string | undefined { return this._finishedAt; }
  get foundCount(): number { return [...this.differences.values()].filter((item) => item.found).length; }
  get total(): number { return this.differences.size; }

  start(at: string): void {
    if (this._status === 'ACTIVE') return;
    if (this._status === 'COMPLETED' || this._status === 'STOPPED') this.reset();
    this._status = 'ACTIVE';
    this._startedAt = at;
  }

  stop(at: string): void {
    if (this._status !== 'ACTIVE') return;
    this._status = 'STOPPED';
    this._finishedAt = at;
  }

  reset(): void {
    this._status = 'IDLE';
    this._startedAt = undefined;
    this._finishedAt = undefined;
    this.scores.clear();
    this.history = [];
    this.resetDifferences();
  }

  findDifference(differenceId: string, username: string, at: string): FindDifferenceResult {
    if (this._status !== 'ACTIVE') return { kind: 'SESSION_NOT_ACTIVE', found: this.foundCount, total: this.total };
    const difference = this.differences.get(differenceId);
    if (!difference) return { kind: 'NOT_FOUND', found: this.foundCount, total: this.total };
    if (difference.found) return { kind: 'ALREADY_FOUND', difference: structuredClone(difference), found: this.foundCount, total: this.total };

    difference.found = true;
    difference.foundBy = username;
    difference.foundAt = at;
    this.history.push({ differenceId, username, at });
    const score = this.scores.get(username);
    this.scores.set(username, { username, points: (score?.points ?? 0) + 1, reachedAt: at });

    const completed = this.foundCount === this.total;
    if (completed) {
      this._status = 'COMPLETED';
      this._finishedAt = at;
    }
    return { kind: 'FOUND', difference: structuredClone(difference), found: this.foundCount, total: this.total, completed };
  }

  undo(): FindRecord | null {
    const record = this.history.pop();
    if (!record) return null;
    const difference = this.differences.get(record.differenceId);
    if (difference) {
      difference.found = false;
      delete difference.foundBy;
      delete difference.foundAt;
    }
    const score = this.scores.get(record.username);
    if (score && score.points <= 1) this.scores.delete(record.username);
    else if (score) this.scores.set(record.username, { ...score, points: score.points - 1, reachedAt: record.at });
    if (this._status === 'COMPLETED') {
      this._status = 'ACTIVE';
      this._finishedAt = undefined;
    }
    return record;
  }

  getDifference(id: string): DifferenceView | undefined {
    const value = this.differences.get(id);
    return value ? structuredClone(value) : undefined;
  }

  getAvailableDifferences(): DifferenceView[] {
    return [...this.differences.values()].filter((item) => !item.found).map((item) => structuredClone(item));
  }

  ranking(): RankingEntry[] {
    return [...this.scores.values()]
      .sort((a, b) => b.points - a.points || a.reachedAt.localeCompare(b.reachedAt) || a.username.localeCompare(b.username))
      .map((entry) => ({ ...entry }));
  }

  puzzleView(): PuzzleView {
    return { ...this.basePuzzle, differences: [...this.differences.values()].map((item) => structuredClone(item)) };
  }

  lastFound(): FindRecord | undefined {
    const value = this.history.at(-1);
    return value ? { ...value } : undefined;
  }

  private resetDifferences(): void {
    this.differences = new Map(this.basePuzzle.differences.map((difference) => [difference.id, { ...structuredClone(difference), found: false }]));
  }
}

export function normalizeText(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
