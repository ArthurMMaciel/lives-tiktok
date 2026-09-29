# Game Engine

## Invariantes

1. Um puzzle tem exatamente sete diferenças com IDs únicos.
2. Regiões e seus limites ficam entre 0 e 1.
3. Apenas sessão `ACTIVE` aceita acerto.
4. Uma diferença pontua uma vez.
5. Um `providerEventId` é processado uma vez.
6. O primeiro item FIFO que marca a diferença recebe o ponto.
7. Cada acerto soma um ponto.
8. Empates ordenam pelo instante em que o participante atingiu a pontuação atual.
9. O sétimo acerto conclui a sessão automaticamente.

## Pipeline

1. Reserva idempotente do evento.
2. Normaliza Unicode, caixa, pontuação e espaços.
3. Classifica intenção.
4. Para `GUESS`, procura aliases/keywords em todas as diferenças; isso permite responder “já encontrada”.
5. Sem resultado inequívoco, consulta `GuessInterpreter` somente se habilitado e somente com diferenças disponíveis.
6. Revalida existência, disponibilidade e threshold.
7. Executa a transição do aggregate.
8. Atualiza métricas, gera template local, persiste evento e publica snapshot.

## Undo e reset

`undo` remove o último acerto, decrementa o score e reabre sessão concluída. `reset` limpa estado, idempotência, comentários, sugestões e métricas. Para o V0, undo é operacional; não reprocessa automaticamente eventos antigos.

## Métricas

Métricas são derivadas durante a sessão: comentários, participantes únicos, palpites, acertos/erros, latência, chamadas IA, matches por método, duração, tempo acumulado por diferença e dicas. A persistência por eventos permite análise posterior, mas não event sourcing/rebuild no V0.

