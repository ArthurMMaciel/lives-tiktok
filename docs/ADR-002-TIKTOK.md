# ADR-002 — TikTok LIVE como adapter experimental

Status: aceito para o V0

## Evidência pesquisada em 29/09/2026

O portal público TikTok for Developers documenta APIs como Login Kit, Content Posting, Display e Research; a API Research consulta comentários de vídeos publicados, não entrega chat LIVE em tempo real. Não foi encontrada uma API pública oficial adequada a este caso.

`tiktok-live-connector` 2.5.0 é uma biblioteca Node ESM que lê o Webcast interno. O próprio projeto se declara não oficial, baseado em engenharia reversa e não production-ready. Envio de mensagem requer sessão autenticada e assinatura; isso aumenta risco operacional, de conta e de compatibilidade.

## Decisão

- Implementar READ por adapter opcional `TikTokLiveChatProvider`.
- Não exigir cookies para leitura anônima quando a biblioteca permitir.
- Manter cookies, session IDs e chaves somente em variáveis de ambiente.
- Não logar bundles de sessão ou erros crus que possam contê-los.
- Manter WRITE desligado por padrão e sempre oferecer copiar a sugestão.
- Revisar termos e licença antes de qualquer uso comercial/distribuição.

## Recursos oficiais versus não oficiais

| Recurso | Situação no V0 |
| --- | --- |
| Login Kit / APIs públicas documentadas | Oficiais, mas não resolvem chat LIVE em tempo real |
| Research API de comentários de vídeo | Oficial, assíncrona e inadequada para LIVE |
| Leitura via `tiktok-live-connector` | Não oficial/experimental |
| Envio via sessão autenticada do connector | Não oficial, experimental e desativado |

