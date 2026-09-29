const base = process.env.SMOKE_API_URL ?? 'http://localhost:3333';

async function post(path, body) {
  const response = await fetch(`${base}${path}`, {
    method: 'POST',
    headers: body ? { 'content-type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined
  });
  if (!response.ok) throw new Error(`${path}: ${await response.text()}`);
}

await post('/api/game/reset');
await post('/api/game/start');
// Generic context must never award the more specific "extra stripe" difference.
await post('/api/simulate', { username: 'teste', message: 'camiseta' });
const guesses = [
  ['arthur', 'o cadarço está diferente'],
  ['maria', 'faltou o relógio'],
  ['arthur', 'a nuvem sumiu'],
  ['pedro', 'tem uma listra extra na camiseta'],
  ['maria', 'tem uma maçã a menos'],
  ['arthur', 'a janela mudou de cor'],
  ['pedro', 'o personagem perdeu um botão']
];
for (const [username, message] of guesses) await post('/api/simulate', { username, message });
const state = await (await fetch(`${base}/api/state`)).json();
const result = {
  status: state.session.status,
  found: state.session.found,
  leader: state.session.ranking[0],
  suggestions: state.suggestions.length,
  comments: state.metrics.commentsReceived,
  correct: state.metrics.correctGuesses,
  wrong: state.metrics.wrongGuesses,
  ruleMatches: state.metrics.ruleBasedMatches
};
console.log(JSON.stringify(result, null, 2));
if (result.status !== 'COMPLETED' || result.found !== 7 || result.correct !== 7 || result.wrong !== 1) process.exitCode = 1;
