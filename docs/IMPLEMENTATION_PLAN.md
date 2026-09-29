# Plano de implementação — 7 Erros LIVE

## Visão geral

O V0 valida se comentários de uma LIVE podem operar um jogo de 7 erros com interpretação híbrida (regras primeiro, IA como fallback), estado determinístico e atualização em tempo real. O modo simulador é o caminho principal e não depende de TikTok, OpenAI ou Supabase.

## Estado inicial

O repositório remoto estava vazio em 29/09/2026. Não havia código, configuração ou histórico funcional a preservar.

## Arquitetura e decisões técnicas

- Monorepo npm/TypeScript com `apps/api`, `apps/web`, `packages/domain`, `packages/application` e `packages/shared`.
- Fastify no backend: menor superfície e boilerplate que NestJS para um único processo HTTP/WebSocket de MVP.
- React + Vite no Admin e Overlay, com uma conexão WebSocket compartilhando contratos em `packages/shared`.
- O domínio é TypeScript puro e não importa HTTP, WebSocket, React, OpenAI, TikTok ou banco.
- A aplicação conhece somente portas: chat, interpretação, persistência, relógio, IDs, eventos e respostas.
- Estado ativo em memória no V0. Eventos importantes têm uma porta de persistência; o adapter PostgreSQL/Supabase é opcional por ambiente.
- Concorrência: comentários entram em uma fila FIFO serial por processo; a operação `validar + marcar + pontuar` é uma única transição síncrona do aggregate `GameSession`.
- Idempotência por `providerEventId`, reservada antes de interpretar o comentário.
- Regra/alias exatos e tokens discriminantes antecedem o fallback OpenAI.
- OpenAI usa saída JSON estruturada, comentário em mensagem de usuário separada e catálogo mínimo de diferenças ainda disponíveis.
- TikTok fica atrás de `LiveChatProvider`; o adapter é experimental e carregado dinamicamente.
- `AUTO_SEND_CHAT=false` por padrão. O V0 gera sugestões; envio real exige configuração explícita e rate limit.

## Escopo por fase

### Fase 1 — domínio

- Puzzle validando exatamente sete diferenças e regiões normalizadas.
- GameSession, transições, score, ranking estável, conclusão, reset e undo.
- Testes de engine, duplicidade, concorrência lógica, conclusão e ranking.

### Fase 2 — pipeline e simulador

- Portas `LiveChatProvider`, `GuessInterpreter`, `EventStore` e `LiveChatResponder`.
- Normalização, classificação, RuleMatcher, fallback semântico e fila FIFO.
- Mock provider passando pelo mesmo pipeline de produção.

### Fase 3 — API, WebSocket e UI

- Endpoints de comando/consulta e stream WebSocket.
- Admin dark/game-show com simulador, controles, decisões, ranking, métricas e sugestões.
- Overlay `HUD_ONLY` e `FULL_GAME`, transparente e sem reload.

### Fase 4 — IA

- Adapter OpenAI com Structured Outputs e validação local da resposta.
- Circuito de fallback seguro quando chave/API não estiver disponível.
- Testes sem rede.

### Fase 5 — TikTok READ

- Adapter `tiktok-live-connector` isolado e opcional.
- Conectar/desconectar, comentários e status, sem segredo em logs.

### Fase 6 — resposta

- Console responder e adapter TikTok somente quando explicitamente habilitado.
- Rate limit e sugestão manual sempre disponível.

### Fase 7 — persistência, métricas e polimento

- Event store PostgreSQL opcional, schema SQL e seed do puzzle.
- Métricas experimentais, logs estruturados e documentação operacional.
- Rodar `test`, `lint`, `typecheck` e `build` e corrigir falhas.

## Regras e restrições

- IA nunca muda estado, pontua, escolhe vencedor ou executa ferramentas.
- Somente o primeiro evento FIFO aceito para uma diferença recebe o ponto.
- Evento duplicado nunca volta a classificar ou pontuar.
- Nenhum segredo é enviado ao frontend, IA ou logs.
- O sistema precisa completar uma partida pelo simulador sem serviços externos.

## Riscos e mitigação

- **API TikTok não oficial e instável:** adapter isolado, reconexão controlada, modo mock como padrão e documentação explícita.
- **Licença modificada AGPL do connector:** dependência opcional e aviso para revisão jurídica antes de distribuição comercial.
- **Envio ao chat frágil:** desligado por padrão, sessão somente via ENV e rate limit.
- **Falso positivo semântico:** threshold configurável, catálogo apenas de diferenças disponíveis e revisão manual ACCEPT/REJECT no Admin.
- **Duas instâncias da API:** fila em memória só protege um processo; deployment V0 deve usar uma réplica. Migração futura usa lock/transação PostgreSQL.
- **Perda do estado ativo ao reiniciar:** aceitável no experimento; eventos persistidos permitem auditoria, não recuperação completa no V0.
- **Custo/latência da IA:** regras primeiro, timeout e fallback para `NO_MATCH`.

## Fora do escopo

SaaS, autenticação complexa, pagamentos, múltiplos canais, geração de imagens, Kubernetes, filas externas e operação autônoma 24/7.

