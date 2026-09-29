import type { ConnectionStatus, LiveComment } from '@seven-errors/shared';
import type { LiveChatProvider, LiveChatResponder } from '@seven-errors/application';

export class MockLiveChatProvider implements LiveChatProvider {
  readonly name = 'mock' as const;
  private status: ConnectionStatus = 'DISCONNECTED';
  private handlers = new Set<(comment: LiveComment) => void>();
  async connect(): Promise<void> { this.status = 'CONNECTED'; }
  async disconnect(): Promise<void> { this.status = 'DISCONNECTED'; }
  onComment(handler: (comment: LiveComment) => void): () => void { this.handlers.add(handler); return () => this.handlers.delete(handler); }
  getConnectionStatus(): ConnectionStatus { return this.status; }
  emit(comment: LiveComment): void { for (const handler of this.handlers) handler(comment); }
}

export class TikTokLiveAdapter implements LiveChatProvider, LiveChatResponder {
  readonly name = 'tiktok' as const;
  private status: ConnectionStatus = 'DISCONNECTED';
  private connection: any;
  private handlers = new Set<(comment: LiveComment) => void>();
  private lastSentAt = 0;

  constructor(
    private readonly username: string,
    private readonly options: { signApiKey?: string; sessionId?: string; ttTargetIdc?: string; minIntervalMs: number }
  ) {}

  async connect(): Promise<void> {
    if (!this.username) throw new Error('TIKTOK_USERNAME não configurado');
    this.status = 'CONNECTING';
    try {
      const module = await import('tiktok-live-connector');
      const authenticated = Boolean(this.options.sessionId && this.options.ttTargetIdc);
      const connectionOptions = authenticated
        ? {
            signApiKey: this.options.signApiKey || undefined,
            authenticateWs: true as const,
            session: { cookie: { type: 'cookie' as const, value: { sessionId: this.options.sessionId!, ttTargetIdc: this.options.ttTargetIdc! } } }
          }
        : { signApiKey: this.options.signApiKey || undefined, authenticateWs: false as const };
      this.connection = new module.TikTokLiveConnection(this.username.replace(/^@/, ''), connectionOptions);
      this.connection.on(module.WebcastEvent.CHAT, (data: any) => {
        const comment: LiveComment = {
          providerEventId: String(data.msgId ?? data.common?.msgId ?? `${data.user?.uniqueId}:${data.createTime ?? Date.now()}:${data.comment}`),
          username: String(data.user?.uniqueId ?? data.user?.nickname ?? 'viewer'),
          message: String(data.comment ?? ''),
          receivedAt: new Date(Number(data.createTime ?? Date.now())).toISOString()
        };
        for (const handler of this.handlers) handler(comment);
      });
      await this.connection.connect();
      this.status = 'CONNECTED';
    } catch (error) {
      this.status = 'ERROR';
      throw new Error(error instanceof Error ? error.message.replace(/session(id)?=[^\s&]+/gi, 'session=[redacted]') : 'Falha ao conectar TikTok');
    }
  }

  async disconnect(): Promise<void> { this.connection?.disconnect?.(); this.status = 'DISCONNECTED'; }
  onComment(handler: (comment: LiveComment) => void): () => void { this.handlers.add(handler); return () => this.handlers.delete(handler); }
  getConnectionStatus(): ConnectionStatus { return this.status; }

  async send(message: string): Promise<void> {
    if (this.status !== 'CONNECTED' || !this.connection?.sendMessage) throw new Error('TikTok não conectado ou envio não suportado');
    if (!this.options.sessionId) throw new Error('Envio exige sessão autenticada');
    const wait = this.options.minIntervalMs - (Date.now() - this.lastSentAt);
    if (wait > 0) throw new Error(`Rate limit: aguarde ${wait}ms`);
    await this.connection.sendMessage(message.slice(0, 150)); this.lastSentAt = Date.now();
  }
}
