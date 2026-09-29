export type ConnectionStatus = 'DISCONNECTED' | 'CONNECTING' | 'CONNECTED' | 'ERROR';
export type SessionStatus = 'IDLE' | 'ACTIVE' | 'COMPLETED' | 'STOPPED';
export type MatchMethod = 'RULE_MATCH' | 'AI_MATCH' | 'NO_MATCH' | 'AMBIGUOUS' | 'DUPLICATE';
export type CommentIntent = 'GUESS' | 'ASK_HINT' | 'REACTION' | 'GREETING' | 'SPAM' | 'UNKNOWN';
export type OverlayMode = 'HUD_ONLY' | 'FULL_GAME';

export interface Region { x: number; y: number; width: number; height: number }

export interface DifferenceView {
  id: string;
  description: string;
  shortDescription: string;
  keywords: string[];
  ruleKeywords?: string[];
  aliases: string[];
  region: Region;
  hint: string;
  found: boolean;
  foundBy?: string;
  foundAt?: string;
}

export interface PuzzleView {
  id: string;
  title: string;
  imageA: string;
  imageB: string;
  status: 'DRAFT' | 'READY' | 'ARCHIVED';
  createdAt: string;
  differences: DifferenceView[];
}

export interface RankingEntry { username: string; points: number; reachedAt: string }

export interface CommentDecision {
  eventId: string;
  providerEventId: string;
  username: string;
  comment: string;
  receivedAt: string;
  classification: CommentIntent;
  matchMethod: MatchMethod;
  differenceId?: string;
  confidence: number;
  reason: string;
  latencyMs: number;
  accepted: boolean;
}

export interface SessionMetrics {
  commentsReceived: number;
  uniqueParticipants: number;
  guesses: number;
  correctGuesses: number;
  wrongGuesses: number;
  averageGuessLatency: number;
  aiRequests: number;
  ruleBasedMatches: number;
  aiMatches: number;
  gameDuration: number | null;
  timePerDifference: Array<{ differenceId: string; elapsedMs: number }>;
  hintsRequested: number;
}

export interface ResponseSuggestion {
  id: string;
  text: string;
  createdAt: string;
  sentAt?: string;
}

export interface PublicGameState {
  connectionStatus: ConnectionStatus;
  provider: 'mock' | 'tiktok';
  session: null | {
    id: string;
    status: SessionStatus;
    startedAt?: string;
    finishedAt?: string;
    found: number;
    total: number;
    puzzle: PuzzleView;
    ranking: RankingEntry[];
    lastFound?: { username: string; difference: string; at: string };
  };
  comments: CommentDecision[];
  suggestions: ResponseSuggestion[];
  metrics: SessionMetrics;
  autoSendChat: boolean;
}

export interface LiveComment {
  providerEventId: string;
  username: string;
  message: string;
  receivedAt: string;
}

export type ServerEvent =
  | { type: 'STATE_SNAPSHOT'; payload: PublicGameState }
  | { type: 'STATE_CHANGED'; payload: PublicGameState }
  | { type: 'PROVIDER_ERROR'; payload: { message: string } };
