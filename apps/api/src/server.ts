import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import websocket from '@fastify/websocket';
import {
  ConsoleLiveChatResponder, DisabledGuessInterpreter, GameApplication,
  type EventStore, type GuessInterpreter, type LiveChatProvider, type LiveChatResponder
} from '@seven-errors/application';
import type { ServerEvent } from '@seven-errors/shared';
import { developmentPuzzle } from './puzzle';
import { OpenAIGuessInterpreter } from './adapters/openai-guess-interpreter';
import { FileEventStore, PostgresEventStore } from './adapters/event-store';
import { MockLiveChatProvider, TikTokLiveAdapter } from './adapters/providers';

const env = process.env;
const logger = { level: env.LOG_LEVEL ?? 'info', redact: ['req.headers.authorization', 'req.headers.cookie', 'headers.authorization', 'headers.cookie'] };
const server = Fastify({ logger });
await server.register(cors, { origin: env.WEB_ORIGIN?.split(',') ?? ['http://localhost:5173'] });
await server.register(websocket);

const autoSend = env.AUTO_SEND_CHAT === 'true';
const tiktokAdapter = new TikTokLiveAdapter(env.TIKTOK_USERNAME ?? '', {
  signApiKey: env.TIKTOK_SIGN_API_KEY,
  sessionId: env.TIKTOK_SESSION_ID,
  ttTargetIdc: env.TIKTOK_TT_TARGET_IDC,
  minIntervalMs: Number(env.CHAT_SEND_MIN_INTERVAL_MS ?? 3000)
});
const mockProvider = new MockLiveChatProvider();
const provider: LiveChatProvider = env.LIVE_CHAT_PROVIDER === 'tiktok' ? tiktokAdapter : mockProvider;
const responder: LiveChatResponder = provider.name === 'tiktok' && autoSend
  ? tiktokAdapter
  : new ConsoleLiveChatResponder(Number(env.CHAT_SEND_MIN_INTERVAL_MS ?? 3000));
const interpreter: GuessInterpreter = env.GUESS_INTERPRETER === 'openai' && env.OPENAI_API_KEY
  ? new OpenAIGuessInterpreter(env.OPENAI_API_KEY, env.OPENAI_MODEL ?? 'gpt-5-mini', Number(env.AI_TIMEOUT_MS ?? 5000))
  : new DisabledGuessInterpreter();
const eventStore: EventStore = env.DATABASE_URL
  ? new PostgresEventStore(env.DATABASE_URL)
  : new FileEventStore(env.EVENT_LOG_PATH ?? 'data/events.ndjson');

const app = new GameApplication({
  puzzle: developmentPuzzle, interpreter, eventStore, responder, autoSendChat: autoSend,
  confidenceThreshold: Number(env.AI_CONFIDENCE_THRESHOLD ?? 0.78)
});

provider.onComment((comment) => void app.enqueueComment(comment).catch((error) => server.log.error({ err: error }, 'comment pipeline failed')));
if (provider.name === 'mock') {
  await provider.connect();
  app.setProvider(provider.name, provider.getConnectionStatus());
} else app.setProvider(provider.name, provider.getConnectionStatus());

const sockets = new Set<{ send(data: string): void; readyState: number }>();
const sendEvent = (event: ServerEvent): void => {
  const data = JSON.stringify(event);
  for (const socket of sockets) if (socket.readyState === 1) socket.send(data);
};
app.subscribe((state) => sendEvent({ type: 'STATE_CHANGED', payload: state }));

server.get('/health', async () => ({ ok: true, provider: provider.name }));
server.get('/api/state', async () => app.state());
server.get('/ws', { websocket: true }, (socket) => {
  sockets.add(socket);
  socket.send(JSON.stringify({ type: 'STATE_SNAPSHOT', payload: app.state() } satisfies ServerEvent));
  socket.on('close', () => sockets.delete(socket));
});

server.post('/api/game/start', async () => { app.start(); return app.state(); });
server.post('/api/game/stop', async () => { app.stop(); return app.state(); });
server.post('/api/game/reset', async () => { app.reset(); return app.state(); });
server.post('/api/game/undo', async () => { app.undo(); return app.state(); });
server.post('/api/game/hint', async () => ({ hint: app.giveHint(), state: app.state() }));
server.post<{ Body: { differenceId?: string; username?: string } }>('/api/game/mark', async (request, reply) => {
  if (!request.body?.differenceId) return reply.code(400).send({ error: 'differenceId is required' });
  app.markDifference(request.body.differenceId, request.body.username ?? 'admin');
  return app.state();
});

server.post<{ Body: { username?: string; message?: string; providerEventId?: string } }>('/api/simulate', async (request, reply) => {
  const username = request.body?.username?.trim().replace(/^@/, '').slice(0, 40);
  const message = request.body?.message?.trim().slice(0, 280);
  if (!username || !message) return reply.code(400).send({ error: 'username and message are required' });
  await app.enqueueComment({
    providerEventId: request.body.providerEventId ?? `mock:${crypto.randomUUID()}`,
    username, message, receivedAt: new Date().toISOString()
  });
  return app.state();
});

server.post<{ Params: { eventId: string }; Body: { differenceId?: string } }>('/api/decisions/:eventId/accept', async (request, reply) => {
  if (!request.body?.differenceId) return reply.code(400).send({ error: 'differenceId is required' });
  app.acceptDecision(request.params.eventId, request.body.differenceId); return app.state();
});
server.post<{ Params: { eventId: string } }>('/api/decisions/:eventId/reject', async (request) => {
  app.rejectDecision(request.params.eventId); return app.state();
});
server.post<{ Params: { id: string } }>('/api/responses/:id/send', async (request, reply) => {
  try { await app.sendSuggestion(request.params.id); return app.state(); }
  catch (error) { return reply.code(429).send({ error: error instanceof Error ? error.message : 'Falha ao enviar' }); }
});

server.post('/api/provider/connect', async (_request, reply) => {
  try { await provider.connect(); app.setProvider(provider.name, provider.getConnectionStatus()); return app.state(); }
  catch (error) {
    app.setProvider(provider.name, 'ERROR');
    const message = error instanceof Error ? error.message : 'Falha ao conectar';
    sendEvent({ type: 'PROVIDER_ERROR', payload: { message } });
    return reply.code(502).send({ error: message });
  }
});
server.post('/api/provider/disconnect', async () => { await provider.disconnect(); app.setProvider(provider.name, provider.getConnectionStatus()); return app.state(); });

const port = Number(env.API_PORT ?? 3333);
await server.listen({ host: '0.0.0.0', port });

const shutdown = async (): Promise<void> => { await provider.disconnect(); await server.close(); };
process.on('SIGINT', () => void shutdown());
process.on('SIGTERM', () => void shutdown());
