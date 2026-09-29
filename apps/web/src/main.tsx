import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { CommentDecision, PublicGameState, ServerEvent } from '@seven-errors/shared';
import './styles.css';

const API = import.meta.env.VITE_API_URL ?? 'http://localhost:3333';
const WS = import.meta.env.VITE_WS_URL ?? 'ws://localhost:3333/ws';

async function command(path: string, body?: unknown): Promise<void> {
  const response = await fetch(`${API}${path}`, {
    method: 'POST',
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  if (!response.ok) { const data = await response.json().catch(() => ({})) as { error?: string }; throw new Error(data.error ?? `HTTP ${response.status}`); }
}

function useGameState(): [PublicGameState | null, string | null, (value: string | null) => void] {
  const [state, setState] = useState<PublicGameState | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let socket: WebSocket | undefined;
    let retry: number | undefined;
    let alive = true;
    const connect = () => {
      socket = new WebSocket(WS);
      socket.onmessage = (event) => {
        const message = JSON.parse(event.data) as ServerEvent;
        if (message.type === 'STATE_CHANGED' || message.type === 'STATE_SNAPSHOT') setState(message.payload);
        if (message.type === 'PROVIDER_ERROR') setError(message.payload.message);
      };
      socket.onopen = () => setError(null);
      socket.onclose = () => { if (alive) retry = window.setTimeout(connect, 1200); };
    };
    fetch(`${API}/api/state`).then((response) => response.json()).then(setState).catch(() => setError('API indisponível. Confirme se npm run dev está ativo.'));
    connect();
    return () => { alive = false; if (retry) clearTimeout(retry); socket?.close(); };
  }, []);
  return [state, error, setError];
}

const statusLabel: Record<string, string> = { IDLE: 'PRONTO', ACTIVE: 'AO VIVO', COMPLETED: 'COMPLETO', STOPPED: 'PARADO' };
const connectionLabel: Record<string, string> = { DISCONNECTED: 'DESCONECTADO', CONNECTING: 'CONECTANDO', CONNECTED: 'CONECTADO', ERROR: 'ERRO' };
const methodLabel: Record<string, string> = { RULE_MATCH: 'REGRA', AI_MATCH: 'INTELIGÊNCIA ARTIFICIAL', NO_MATCH: 'SEM CORRESPONDÊNCIA', AMBIGUOUS: 'AMBÍGUO', DUPLICATE: 'DUPLICADO' };

function CommentRow({ item, state, fail }: { item: CommentDecision; state: PublicGameState; fail: (message: string) => void }) {
  const available = state.session?.puzzle.differences.filter((difference) => !difference.found) ?? [];
  const [selected, setSelected] = useState(item.differenceId ?? available[0]?.id ?? '');
  const run = (path: string, body?: unknown) => command(path, body).catch((error: Error) => fail(error.message));
  return <article className="comment-row">
    <div className="comment-head"><strong>@{item.username}</strong><span>{item.latencyMs}ms</span></div>
    <p>“{item.comment}”</p>
    <div className="decision-line">
      <span className={`method ${item.matchMethod.toLowerCase()}`}>{methodLabel[item.matchMethod] ?? item.matchMethod}</span>
      <span>{item.differenceId ?? '—'}</span><b>{Math.round(item.confidence * 100)}%</b>
    </div>
    <small>{item.reason}</small>
    {!item.accepted && item.classification === 'GUESS' && <div className="review-actions">
      <select value={selected} onChange={(event) => setSelected(event.target.value)}>{available.map((difference) => <option key={difference.id} value={difference.id}>{difference.shortDescription}</option>)}</select>
      <button className="mini success" disabled={!selected} onClick={() => run(`/api/decisions/${item.eventId}/accept`, { differenceId: selected })}>ACEITAR</button>
      <button className="mini" onClick={() => run(`/api/decisions/${item.eventId}/reject`)}>REJEITAR</button>
    </div>}
  </article>;
}

function Admin({ state, error, setError }: { state: PublicGameState; error: string | null; setError: (message: string | null) => void }) {
  const [username, setUsername] = useState('arthur');
  const [message, setMessage] = useState('o cadarço está diferente');
  const session = state.session!;
  const run = (path: string, body?: unknown) => command(path, body).then(() => setError(null)).catch((cause: Error) => setError(cause.message));
  const submit = (event: React.FormEvent) => { event.preventDefault(); void run('/api/simulate', { username, message }); setMessage(''); };

  return <main className="admin-shell">
    <header className="topbar">
      <div className="brand"><span className="brand-mark">7</span><div><b>ERROS AO VIVO</b><small>APRESENTADOR COM IA</small></div></div>
      <div className="top-status">
        <span className={`status-dot ${state.connectionStatus === 'CONNECTED' ? 'online' : ''}`} />
        <span>{state.provider === 'mock' ? 'SIMULADOR' : 'TIKTOK'} · {connectionLabel[state.connectionStatus]}</span>
        <span className={`live-pill ${session.status.toLowerCase()}`}>{statusLabel[session.status]}</span>
      </div>
    </header>
    {error && <div className="error-banner">{error}<button onClick={() => setError(null)}>×</button></div>}
    <section className="hero-card">
      <div><p className="eyebrow">SESSÃO ATUAL</p><h1>{session.puzzle.title}</h1><p className="muted">Identificador: {session.id}</p></div>
      <div className="score-ring"><strong>{session.found}</strong><span>/ {session.total}</span><small>ENCONTRADOS</small></div>
      <div className="primary-actions">
        <button className="primary" onClick={() => run('/api/game/start')}>▶ INICIAR JOGO</button>
        <button onClick={() => run('/api/game/stop')}>PARAR</button>
        <button onClick={() => run('/api/game/reset')}>REINICIAR</button>
        <button onClick={() => run('/api/game/undo')}>DESFAZER</button>
        <button onClick={() => run('/api/game/hint')}>DAR DICA</button>
      </div>
    </section>

    <section className="grid-main">
      <div className="stack">
        <section className="panel simulator">
          <div className="panel-title"><div><p className="eyebrow">SIMULADOR</p><h2>Simular comentário</h2></div><span className="tag">MESMO FLUXO DA LIVE</span></div>
          <form onSubmit={submit}><label>Usuário<input value={username} onChange={(e) => setUsername(e.target.value)} /></label><label className="grow">Mensagem<input autoFocus value={message} onChange={(e) => setMessage(e.target.value)} placeholder="o cadarço mudou" /></label><button className="primary" type="submit">ENVIAR ↗</button></form>
        </section>

        <section className="panel">
          <div className="panel-title"><div><p className="eyebrow">DESAFIO</p><h2>7 diferenças</h2></div><span>{session.found}/{session.total}</span></div>
          <div className="differences">{session.puzzle.differences.map((difference, index) => <div className={`difference ${difference.found ? 'found' : ''}`} key={difference.id}>
            <span className="diff-number">{String(index + 1).padStart(2, '0')}</span><div><b>{difference.shortDescription}</b><small>{difference.found ? `@${difference.foundBy} · ${new Date(difference.foundAt!).toLocaleTimeString('pt-BR')}` : difference.hint}</small></div>
            <button className="mini" disabled={difference.found || session.status !== 'ACTIVE'} onClick={() => run('/api/game/mark', { differenceId: difference.id })}>{difference.found ? '✓ ENCONTRADA' : 'MARCAR'}</button>
          </div>)}</div>
        </section>

        <section className="panel">
          <div className="panel-title"><div><p className="eyebrow">MONITORAMENTO</p><h2>Comentários recentes</h2></div><span>{state.comments.length}</span></div>
          <div className="comment-list">{state.comments.length ? state.comments.map((item) => <CommentRow key={item.eventId} item={item} state={state} fail={setError} />) : <p className="empty">Os comentários processados aparecerão aqui.</p>}</div>
        </section>
      </div>

      <aside className="stack">
        <section className="panel ranking"><div className="panel-title"><div><p className="eyebrow">MELHORES JOGADORES</p><h2>🏆 Ranking</h2></div></div>
          {session.ranking.length ? session.ranking.slice(0, 3).map((entry, index) => <div className="rank-row" key={entry.username}><span>{['🥇','🥈','🥉'][index]}</span><b>@{entry.username}</b><strong>{entry.points}</strong></div>) : <p className="empty">O primeiro acerto assume a liderança.</p>}
        </section>
        <section className="panel"><div className="panel-title"><div><p className="eyebrow">APRESENTADOR COM IA</p><h2>Sugestões de resposta</h2></div><span className={`tag ${state.autoSendChat ? 'hot' : ''}`}>AUTOMÁTICO {state.autoSendChat ? 'LIGADO' : 'DESLIGADO'}</span></div>
          <div className="suggestions">{state.suggestions.length ? state.suggestions.map((suggestion) => <article key={suggestion.id}><p>{suggestion.text}</p><div><button className="mini" onClick={() => navigator.clipboard.writeText(suggestion.text)}>COPIAR</button><button className="mini success" disabled={Boolean(suggestion.sentAt)} onClick={() => run(`/api/responses/${suggestion.id}/send`)}>{suggestion.sentAt ? 'ENVIADA' : 'ENVIAR'}</button></div></article>) : <p className="empty">As falas do apresentador aparecerão aqui.</p>}</div>
        </section>
        <section className="panel metrics"><div className="panel-title"><div><p className="eyebrow">EXPERIMENTO</p><h2>Métricas</h2></div></div>
          <div className="metric-grid"><span><b>{state.metrics.commentsReceived}</b>Comentários</span><span><b>{state.metrics.uniqueParticipants}</b>Participantes</span><span><b>{state.metrics.correctGuesses}</b>Acertos</span><span><b>{state.metrics.wrongGuesses}</b>Erros</span><span><b>{state.metrics.ruleBasedMatches}</b>Por regras</span><span><b>{state.metrics.aiMatches}</b>Por inteligência artificial</span><span><b>{state.metrics.averageGuessLatency}ms</b>Latência média</span><span><b>{state.metrics.hintsRequested}</b>Dicas</span></div>
        </section>
        <section className="panel connection"><button onClick={() => run('/api/provider/connect')}>CONECTAR CHAT</button><button onClick={() => run('/api/provider/disconnect')}>DESCONECTAR</button><a href="/overlay?mode=HUD_ONLY" target="_blank">ABRIR PAINEL ↗</a><a href="/overlay?mode=FULL_GAME" target="_blank">ABRIR JOGO COMPLETO ↗</a></section>
      </aside>
    </section>
  </main>;
}

function Overlay({ state }: { state: PublicGameState }) {
  const session = state.session!;
  const mode = new URLSearchParams(location.search).get('mode') === 'FULL_GAME' ? 'FULL_GAME' : 'HUD_ONLY';
  return <main className={`overlay ${mode === 'FULL_GAME' ? 'full' : 'hud'}`}>
    {mode === 'FULL_GAME' && <div className="game-images"><figure><img src={session.puzzle.imageA} /><figcaption>IMAGEM A</figcaption></figure><figure><img src={session.puzzle.imageB} /><figcaption>IMAGEM B</figcaption></figure></div>}
    <section className="overlay-hud"><div className="overlay-title"><span className="brand-mark">7</span><div><small>JOGO DOS</small><b>ERROS</b></div></div><div className="overlay-score"><strong>{session.found}</strong><span>/ {session.total}</span><small>ENCONTRADOS</small></div>
      <div className="overlay-rank"><b>🏆 RANKING</b>{session.ranking.slice(0, 3).map((entry, index) => <span key={entry.username}>{['🥇','🥈','🥉'][index]} @{entry.username} <strong>{entry.points}</strong></span>)}</div>
    </section>
    {session.lastFound && <div className="last-found">🔥 @{session.lastFound.username.toUpperCase()} ENCONTROU {session.lastFound.difference.toUpperCase()}!</div>}
    {session.status === 'COMPLETED' && <div className="completed">7/7 · JOGO COMPLETO 🔥</div>}
  </main>;
}

function App() {
  const [state, error, setError] = useGameState();
  if (!state?.session) return <main className="loading"><div className="brand-mark">7</div><p>Conectando ao Game Host…</p>{error && <small>{error}</small>}</main>;
  return location.pathname.startsWith('/overlay') ? <Overlay state={state} /> : <Admin state={state} error={error} setError={setError} />;
}

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);
