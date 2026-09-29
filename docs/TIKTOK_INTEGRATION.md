# Integração TikTok LIVE

Pesquisa atualizada em 29/09/2026.

## Oficial versus experimental

O catálogo público oficial do TikTok for Developers oferece produtos/scopes autorizados, e a Research API consulta comentários de vídeos publicados. Não foi encontrada nele uma API pública oficial de chat LIVE em tempo real adequada ao jogo. Portanto, Login Kit ou Research API não substituem o provider necessário.

O V0 usa opcionalmente [`tiktok-live-connector`](https://github.com/zerodytrash/TikTok-Live-Connector), versão 2.5.0. O próprio repositório o descreve como não oficial, baseado em engenharia reversa e não production-ready. A versão atual é ESM-only, exige Node 20+ e depende de assinatura do WebSocket. Consulte também os [scopes oficiais TikTok](https://developers.tiktok.com/docs/en/scopes-overview) e a [API oficial de comentários de vídeo](https://developers.tiktok.com/docs/en/research-api-specs-query-video-comments) para entender a diferença.

## READ

```env
LIVE_CHAT_PROVIDER=tiktok
TIKTOK_USERNAME=nome_sem_arroba
```

O adapter tenta leitura anônima. Dependendo de mudanças do TikTok, região e limites do sign provider, a conexão pode falhar. Use o botão Connect Provider no Admin depois que a LIVE estiver ativa.

## sessão autenticada e WRITE

O método `sendMessage` do connector requer conexão autenticada e assinatura. Se for testar:

```env
TIKTOK_SIGN_API_KEY=...
TIKTOK_SESSION_ID=...
TIKTOK_TT_TARGET_IDC=...
AUTO_SEND_CHAT=false
```

Comece com `false`: copie sugestões manualmente. Somente após validação controlada altere para `true`. O adapter limita frequência e trunca mensagem, mas isso não elimina risco de bloqueio, mudança de protocolo ou violação de termos. Nunca versione cookies e nunca compartilhe o `.env`.

## Isolamento

`TikTokLiveAdapter` é o único arquivo que importa a biblioteca. Ele traduz CHAT para `LiveComment`, cria um `providerEventId`, sanitiza erros antes de devolvê-los e implementa a porta de resposta. O game engine não conhece tipos TikTok. Substituir a biblioteca ou adicionar YouTube/Twitch não muda o domínio.

## Licença e operação

A versão investigada declara licença AGPL-3.0 modificada. Faça revisão da licença e dos termos do TikTok antes de distribuição ou operação comercial. Não trate esse adapter como integração oficial nem como dependência com SLA.

