# 7 Erros LIVE — AI Game Host

MVP de um game show operado pelo chat: comentários passam por regras locais, opcionalmente por classificação semântica, e somente o backend determinístico decide pontuação e estado. O projeto funciona integralmente sem TikTok, OpenAI ou banco usando o simulador do Admin.

## Rodar localmente

Requisitos: Node.js 20+ e npm 10+.

```bash
npm install
npm run dev
```

Abra:

- Admin: http://localhost:5173/admin
- Overlay HUD: http://localhost:5173/overlay?mode=HUD_ONLY
- Overlay com imagens: http://localhost:5173/overlay?mode=FULL_GAME
- API health: http://localhost:3333/health

No Admin, clique **START GAME**, preencha o simulador e envie `o cadarço está diferente`. A mesma rota de aplicação recebe comentários mock e TikTok. Continue com relógio, nuvem, listra, maçã, janela e botão até 7/7.

Para OBS, adicione uma **Browser Source**, use uma das URLs de overlay, ajuste para 1920×1080 e mantenha o fundo transparente. O overlay recebe atualizações por WebSocket e não precisa de reload.

## Arquitetura

O projeto é um monólito modular, não microservices:

```text
apps/web (React: Admin + Overlay)
        │ HTTP / WebSocket
apps/api (Fastify: presentation + adapters)
        │
packages/application (casos de uso + ports)
        │
packages/domain (Puzzle + GameSession + invariantes)
        │
packages/shared (contratos serializáveis)
```

Dependências externas entram apenas por adapters. `domain` não conhece Fastify, React, TikTok, OpenAI, PostgreSQL ou WebSocket. Fastify foi escolhido em vez de NestJS porque o V0 tem um processo e poucos casos de uso; entrega HTTP/WebSocket com menos framework e mantém as camadas explícitas.

O estado ativo vive em memória. Uma fila FIFO no `GameApplication` serializa comentários; o aggregate executa `check + mark + score` em uma transição síncrona. Isso garante o primeiro vencedor em uma réplica. Antes de escalar horizontalmente, a arbitragem precisa migrar para transação/lock PostgreSQL.

Mais detalhes: [arquitetura](docs/ARCHITECTURE.md), [engine](docs/GAME_ENGINE.md), [plano](docs/IMPLEMENTATION_PLAN.md) e [ADRs](docs/ADR-001-ARCHITECTURE.md).

## Configuração

Copie `.env.example` para `.env`. Sem `.env`, o padrão é seguro: mock, IA desabilitada e envio automático desligado.

| Variável | Uso |
| --- | --- |
| `API_PORT` | Porta Fastify, padrão `3333` |
| `WEB_ORIGIN` | Origins CORS separadas por vírgula |
| `GUESS_INTERPRETER` | `disabled` ou `openai` |
| `OPENAI_API_KEY` | Chave server-side, nunca enviada ao browser |
| `OPENAI_MODEL` | Modelo com Structured Outputs |
| `AI_CONFIDENCE_THRESHOLD` | Threshold determinístico, padrão `0.78` |
| `LIVE_CHAT_PROVIDER` | `mock` ou `tiktok` |
| `TIKTOK_USERNAME` | Unique ID do host LIVE |
| `TIKTOK_SIGN_API_KEY` | Chave opcional do serviço de assinatura do connector |
| `TIKTOK_SESSION_ID` / `TIKTOK_TT_TARGET_IDC` | Sessão experimental para conexão autenticada/envio |
| `AUTO_SEND_CHAT` | `false` por padrão |
| `DATABASE_URL` | PostgreSQL/Supabase opcional |
| `EVENT_LOG_PATH` | NDJSON local, padrão `data/events.ndjson` |

### OpenAI

Defina `GUESS_INTERPRETER=openai` e `OPENAI_API_KEY`. O adapter usa a Responses API com `text.format`/JSON Schema estrito. O comentário é uma mensagem de usuário separada e é tratado como input não confiável. Regras e aliases são tentados primeiro; a IA só recebe o catálogo mínimo ainda disponível e nunca altera estado.

### PostgreSQL / Supabase

Aplique [a migration inicial](supabase/migrations/20260929000000_initial.sql), configure `DATABASE_URL` e rode:

```bash
npm run seed
```

Sem banco, o puzzle de desenvolvimento fica no código e eventos são persistidos em NDJSON local. O banco não é obrigatório para jogar localmente.

### TikTok experimental

Configure `LIVE_CHAT_PROVIDER=tiktok` e `TIKTOK_USERNAME`. A integração usa `tiktok-live-connector`, que é não oficial, baseada em engenharia reversa e pode quebrar sem aviso. `AUTO_SEND_CHAT=false` deve permanecer assim até validar a conta/sessão e os riscos. Leia [a documentação TikTok](docs/TIKTOK_INTEGRATION.md) antes de ativar.

## Criar um puzzle

Use [o puzzle de desenvolvimento](apps/api/src/puzzle.ts) como modelo. Um puzzle precisa ter exatamente sete diferenças, IDs únicos e regiões normalizadas entre 0 e 1. Coloque imagens em `apps/web/public/puzzles` e referencie caminhos `/puzzles/...`. `validatePuzzle` rejeita dados inválidos ao criar a sessão.

## Qualidade

```bash
npm test
npm run lint
npm run typecheck
npm run build
```

Com a API rodando, `npm run smoke` joga automaticamente os sete palpites e exige uma sessão `COMPLETED`.

Os testes não chamam TikTok ou OpenAI. Cobrem invariantes, scoring, evento duplicado, diferença duplicada, concorrência FIFO, aliases/keywords, fallback semântico mockado, conclusão, reset/undo e ranking.

## Limites do V0

- Uma única sessão e uma única réplica da API.
- Reiniciar a API perde o estado ativo; os eventos servem para auditoria, não recovery.
- `NEXT PUZZLE`/rotação automática não está implementado porque há somente o puzzle de validação.
- Integração TikTok não tem SLA nem status oficial.
- Não há autenticação no Admin; exponha somente em rede controlada.
- Sem geração de imagens, TTS, pagamentos, múltiplos canais ou operação 24/7.

