# ADR-001 — Monólito modular orientado a ports/adapters

Status: aceito para o V0

## Contexto

O produto precisa provar uma interação de baixa latência, mas integra integrações instáveis (TikTok e LLM) e regras que não podem depender delas.

## Decisão

Usar um monólito modular TypeScript em um único processo backend. `domain` contém aggregates e invariantes; `application` contém casos de uso e portas; `apps/api` contém adapters e presentation; `apps/web` contém apenas presentation. Pacotes internos apontam em uma única direção: `shared <- domain <- application <- api`.

O estado da sessão ativa fica em memória e é alterado por uma fila FIFO. A persistência guarda puzzles/eventos. O V0 roda com uma única réplica da API.

## Consequências

- O simulador e o TikTok usam exatamente o mesmo pipeline.
- Testes de regras não precisam de rede ou framework.
- Escalar horizontalmente exige mover a arbitragem atômica para PostgreSQL ou um coordenador distribuído.
- Uma queda da API encerra a sessão em memória; isso é aceito nesta validação.

