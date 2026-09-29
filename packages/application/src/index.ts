import { GameSession, normalizeText, type DifferenceDefinition, type PuzzleDefinition } from '@seven-errors/domain';
import type {
  CommentDecision, CommentIntent, ConnectionStatus, LiveComment, MatchMethod,
  PublicGameState, ResponseSuggestion, SessionMetrics
} from '@seven-errors/shared';

export interface GuessInterpretation {
  matched: boolean;
  differenceId?: string;
  confidence: number;
  reason: string;
}

export interface GuessInterpreter {
  readonly enabled?: boolean;
  interpret(comment: string, availableDifferences: DifferenceDefinition[]): Promise<GuessInterpretation>;
}

export interface StoredEvent { type: string; occurredAt: string; payload: Record<string, unknown> }
export interface EventStore { append(event: StoredEvent): Promise<void> }
export interface LiveChatResponder { send(message: string): Promise<void> }
export interface LiveChatProvider {
  readonly name: 'mock' | 'tiktok';
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  onComment(handler: (comment: LiveComment) => void): () => void;
  getConnectionStatus(): ConnectionStatus;
}

export interface ApplicationDependencies {
  puzzle: PuzzleDefinition;
  interpreter: GuessInterpreter;
  eventStore: EventStore;
  responder: LiveChatResponder;
  now?: () => Date;
  id?: () => string;
  confidenceThreshold?: number;
  autoSendChat?: boolean;
}

export function classifyMessage(message: string): CommentIntent {
  const normalized = normalizeText(message);
  if (!normalized || normalized.length > 280 || /(https?:\/\/|www\.)/.test(message)) return 'SPAM';
  if (/\b(dica|ajuda|hint)\b/.test(normalized)) return 'ASK_HINT';
  if (/^(oi|ola|salve|bom dia|boa tarde|boa noite)\b/.test(normalized)) return 'GREETING';
  if (/^(kk+|haha+|rs+|amei|top|boa|show|🔥|😂)/u.test(message.trim().toLocaleLowerCase('pt-BR'))) return 'REACTION';
  if (normalized.split(' ').length <= 12) return 'GUESS';
  return 'UNKNOWN';
}

interface RuleResult extends GuessInterpretation { method: MatchMethod }

export function matchByRules(comment: string, differences: DifferenceDefinition[]): RuleResult {
  const normalized = normalizeText(comment);
  const padded = ` ${normalized} `;
  const candidates = differences.filter((difference) => {
    // `keywords` describe semantic context for the LLM. Only explicit
    // `ruleKeywords` and aliases are allowed to award points without AI.
    const terms = [...difference.aliases, ...(difference.ruleKeywords ?? difference.keywords)]
      .map(normalizeText)
      .filter((term) => term.length >= 3);
    return terms.some((term) => padded.includes(` ${term} `) || (term.includes(' ') && normalized.includes(term)));
  });
  if (candidates.length === 1) {
    return { matched: true, differenceId: candidates[0]!.id, confidence: 1, reason: 'Alias ou palavra-chave inequívoca.', method: 'RULE_MATCH' };
  }
  if (candidates.length > 1) {
    return { matched: false, confidence: 0, reason: 'Mais de uma diferença corresponde às regras.', method: 'AMBIGUOUS' };
  }
  return { matched: false, confidence: 0, reason: 'Nenhum alias ou palavra-chave correspondeu.', method: 'NO_MATCH' };
}

export class DisabledGuessInterpreter implements GuessInterpreter {
  readonly enabled = false;
  async interpret(): Promise<GuessInterpretation> {
    return { matched: false, confidence: 0, reason: 'Interpretação por IA desabilitada.' };
  }
}

class MetricsTracker {
  commentsReceived = 0;
  participants = new Set<string>();
  guesses = 0;
  correctGuesses = 0;
  wrongGuesses = 0;
  totalGuessLatency = 0;
  aiRequests = 0;
  ruleBasedMatches = 0;
  aiMatches = 0;
  hintsRequested = 0;
  times: Array<{ differenceId: string; elapsedMs: number }> = [];

  snapshot(session: GameSession): SessionMetrics {
    const start = session.startedAt ? Date.parse(session.startedAt) : 0;
    const end = session.finishedAt ? Date.parse(session.finishedAt) : Date.now();
    return {
      commentsReceived: this.commentsReceived,
      uniqueParticipants: this.participants.size,
      guesses: this.guesses,
      correctGuesses: this.correctGuesses,
      wrongGuesses: this.wrongGuesses,
      averageGuessLatency: this.guesses ? Math.round(this.totalGuessLatency / this.guesses) : 0,
      aiRequests: this.aiRequests,
      ruleBasedMatches: this.ruleBasedMatches,
      aiMatches: this.aiMatches,
      gameDuration: start ? Math.max(0, end - start) : null,
      timePerDifference: [...this.times],
      hintsRequested: this.hintsRequested
    };
  }
}

export class GameApplication {
  readonly session: GameSession;
  private readonly deps: Required<Pick<ApplicationDependencies, 'now' | 'id' | 'confidenceThreshold'>> & ApplicationDependencies;
  private readonly processed = new Set<string>();
  private readonly metrics = new MetricsTracker();
  private comments: CommentDecision[] = [];
  private suggestions: ResponseSuggestion[] = [];
  private listeners = new Set<(state: PublicGameState) => void>();
  private queue: Promise<void> = Promise.resolve();
  private connectionStatus: ConnectionStatus = 'DISCONNECTED';
  private provider: 'mock' | 'tiktok' = 'mock';

  constructor(deps: ApplicationDependencies) {
    this.deps = {
      ...deps,
      now: deps.now ?? (() => new Date()),
      id: deps.id ?? (() => crypto.randomUUID()),
      confidenceThreshold: deps.confidenceThreshold ?? 0.78
    };
    this.session = new GameSession(this.deps.id(), deps.puzzle);
  }

  subscribe(listener: (state: PublicGameState) => void): () => void {
    this.listeners.add(listener);
    listener(this.state());
    return () => this.listeners.delete(listener);
  }

  setProvider(name: 'mock' | 'tiktok', status: ConnectionStatus): void {
    this.provider = name; this.connectionStatus = status; this.emit();
  }

  start(): void {
    this.session.start(this.deps.now().toISOString());
    void this.record('GameStarted', { sessionId: this.session.id, puzzleId: this.session.puzzleView().id });
    this.emit();
  }

  stop(): void {
    this.session.stop(this.deps.now().toISOString());
    void this.record('GameStopped', { sessionId: this.session.id }); this.emit();
  }

  reset(): void {
    this.session.reset(); this.processed.clear();
    this.comments = []; this.suggestions = [];
    Object.assign(this.metrics, new MetricsTracker());
    void this.record('GameReset', { sessionId: this.session.id }); this.emit();
  }

  undo(): void { this.session.undo(); this.emit(); }

  markDifference(differenceId: string, username = 'admin'): void {
    const result = this.session.findDifference(differenceId, username, this.deps.now().toISOString());
    if (result.kind === 'FOUND') this.onFound(username, result.difference.shortDescription, result.difference.id, result.found, result.total, result.completed);
    this.emit();
  }

  giveHint(): string | null {
    const available = this.session.getAvailableDifferences();
    if (!available.length) return null;
    const difference = available[0]!;
    this.metrics.hintsRequested++;
    this.addSuggestion(`DICA 👀 ${difference.hint}`);
    void this.record('HintRequested', { sessionId: this.session.id, differenceId: difference.id });
    this.emit();
    return difference.hint;
  }

  acceptDecision(eventId: string, differenceId: string): void {
    const decision = this.comments.find((item) => item.eventId === eventId);
    if (!decision || decision.accepted) return;
    const result = this.session.findDifference(differenceId, decision.username, this.deps.now().toISOString());
    if (result.kind === 'FOUND') {
      decision.accepted = true; decision.differenceId = differenceId; decision.matchMethod = 'AI_MATCH';
      this.onFound(decision.username, result.difference.shortDescription, differenceId, result.found, result.total, result.completed);
    }
    this.emit();
  }

  rejectDecision(eventId: string): void {
    const decision = this.comments.find((item) => item.eventId === eventId);
    if (decision) { decision.accepted = false; decision.reason = 'Rejeitado manualmente pelo operador.'; this.emit(); }
  }

  enqueueComment(comment: LiveComment): Promise<void> {
    const task = this.queue.then(() => this.processComment(comment));
    this.queue = task.catch(() => undefined);
    return task;
  }

  async sendSuggestion(id: string): Promise<void> {
    const suggestion = this.suggestions.find((item) => item.id === id);
    if (!suggestion || suggestion.sentAt) return;
    await this.deps.responder.send(suggestion.text);
    suggestion.sentAt = this.deps.now().toISOString();
    await this.record('ResponseSent', { sessionId: this.session.id, suggestionId: id }); this.emit();
  }

  state(): PublicGameState {
    const puzzle = this.session.puzzleView();
    const last = this.session.lastFound();
    const lastDifference = last ? this.session.getDifference(last.differenceId) : undefined;
    return {
      connectionStatus: this.connectionStatus,
      provider: this.provider,
      session: {
        id: this.session.id, status: this.session.status, startedAt: this.session.startedAt, finishedAt: this.session.finishedAt,
        found: this.session.foundCount, total: this.session.total, puzzle, ranking: this.session.ranking(),
        lastFound: last && lastDifference ? { username: last.username, difference: lastDifference.shortDescription, at: last.at } : undefined
      },
      comments: this.comments.slice(0, 50), suggestions: this.suggestions.slice(0, 20),
      metrics: this.metrics.snapshot(this.session), autoSendChat: this.deps.autoSendChat ?? false
    };
  }

  private async processComment(comment: LiveComment): Promise<void> {
    const begin = performance.now();
    if (this.processed.has(comment.providerEventId)) return;
    this.processed.add(comment.providerEventId);
    this.metrics.commentsReceived++;
    this.metrics.participants.add(comment.username);
    const classification = classifyMessage(comment.message);
    let method: MatchMethod = 'NO_MATCH';
    let feedbackGenerated = false;
    let interpretation: GuessInterpretation = { matched: false, confidence: 0, reason: 'Mensagem não classificada como palpite.' };

    if (classification === 'ASK_HINT') {
      this.giveHint();
    } else if (classification === 'GUESS' && this.session.status === 'ACTIVE') {
      this.metrics.guesses++;
      const available = this.session.getAvailableDifferences();
      const rule = matchByRules(comment.message, this.session.puzzleView().differences);
      method = rule.method;
      interpretation = rule;
      if (!rule.matched && this.deps.interpreter.enabled !== false) {
        this.metrics.aiRequests++;
        const ai = await this.deps.interpreter.interpret(comment.message, available);
        interpretation = ai;
        method = ai.matched ? 'AI_MATCH' : method === 'AMBIGUOUS' ? 'AMBIGUOUS' : 'NO_MATCH';
      }
    }

    let accepted = false;
    if (interpretation.matched && interpretation.differenceId && interpretation.confidence >= this.deps.confidenceThreshold) {
      const result = this.session.findDifference(interpretation.differenceId, comment.username, this.deps.now().toISOString());
      if (result.kind === 'FOUND') {
        accepted = true;
        this.metrics.correctGuesses++;
        if (method === 'RULE_MATCH') this.metrics.ruleBasedMatches++; else this.metrics.aiMatches++;
        this.onFound(comment.username, result.difference.shortDescription, result.difference.id, result.found, result.total, result.completed);
      } else if (result.kind === 'ALREADY_FOUND') {
        this.addSuggestion(`@${comment.username} essa já foi encontrada 👀 Ainda faltam ${result.total - result.found}.`);
        feedbackGenerated = true;
      }
    }

    const latencyMs = Math.round(performance.now() - begin);
    if (classification === 'GUESS') {
      this.metrics.totalGuessLatency += latencyMs;
      if (!accepted) {
        this.metrics.wrongGuesses++;
        const remaining = this.session.total - this.session.foundCount;
        if (!feedbackGenerated) this.addSuggestion(`@${comment.username} não foi dessa vez 😂 Ainda faltam ${remaining} 👀`);
      }
    }
    const decision: CommentDecision = {
      eventId: this.deps.id(), providerEventId: comment.providerEventId, username: comment.username,
      comment: comment.message, receivedAt: comment.receivedAt, classification, matchMethod: method,
      differenceId: interpretation.differenceId, confidence: interpretation.confidence,
      reason: interpretation.reason, latencyMs, accepted
    };
    this.comments.unshift(decision);
    await this.record('CommentProcessed', { sessionId: this.session.id, ...decision });
    this.emit();
  }

  private onFound(username: string, difference: string, differenceId: string, found: number, total: number, completed: boolean): void {
    const at = this.deps.now().toISOString();
    const started = this.session.startedAt ? Date.parse(this.session.startedAt) : Date.parse(at);
    this.metrics.times.push({ differenceId, elapsedMs: Math.max(0, Date.parse(at) - started) });
    this.addSuggestion(`@${username} ACERTOU 🔥 Era ${difference.toLocaleLowerCase('pt-BR')}! ${found}/${total} encontrados.`);
    void this.record('DifferenceFound', { sessionId: this.session.id, username, differenceId, found, total });
    if (completed) {
      this.addSuggestion('7/7! VOCÊS ZERARAM O JOGO 🔥🏆');
      void this.record('GameCompleted', { sessionId: this.session.id });
    }
  }

  private addSuggestion(text: string): void {
    const suggestion = { id: this.deps.id(), text, createdAt: this.deps.now().toISOString() };
    this.suggestions.unshift(suggestion);
    void this.record('ResponseGenerated', { sessionId: this.session.id, suggestionId: suggestion.id, text });
    if (this.deps.autoSendChat) void this.sendSuggestion(suggestion.id).catch(() => undefined);
  }

  private async record(type: string, payload: Record<string, unknown>): Promise<void> {
    await this.deps.eventStore.append({ type, occurredAt: this.deps.now().toISOString(), payload });
  }

  private emit(): void { const state = this.state(); for (const listener of this.listeners) listener(state); }
}

export class MemoryEventStore implements EventStore {
  readonly events: StoredEvent[] = [];
  async append(event: StoredEvent): Promise<void> { this.events.push(structuredClone(event)); }
}

export class ConsoleLiveChatResponder implements LiveChatResponder {
  private lastSentAt = 0;
  constructor(private readonly minIntervalMs = 3000) {}
  async send(message: string): Promise<void> {
    const wait = this.minIntervalMs - (Date.now() - this.lastSentAt);
    if (wait > 0) throw new Error(`Rate limit: aguarde ${wait}ms`);
    this.lastSentAt = Date.now();
    console.info(JSON.stringify({ level: 'info', event: 'chat_response', message }));
  }
}
