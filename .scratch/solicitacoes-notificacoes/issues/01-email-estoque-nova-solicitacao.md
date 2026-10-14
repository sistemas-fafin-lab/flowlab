# 01 — E-mail para o estoque a cada nova SC/SM

**What to build:** toda Solicitação de Compra (SC) ou de Material (SM) criada
dispara um e-mail para o(s) endereço(s) em `REQUESTS_STOCK_ALERT_TO`, com os
detalhes do pedido. O front só avisa o servidor passando o `id` da
solicitação criada; o servidor lê a solicitação, monta o e-mail e resolve o
destinatário. Como a Vercel Hobby tem limite de 12 functions, a pasta
`api/notifications/` passa a usar um dispatcher `[action].ts` (padrão de
`api/umami/[action].ts`), mantendo `/api/notifications/email` funcionando
igual.

**Blocked by:** None — can start immediately

**Status:** done

- [x] `api/notifications/email.ts` vira `api/notifications/[action].ts`, com
      handlers em `api/_lib/handlers/`; `POST /api/notifications/email`
      continua com o mesmo contrato e respostas (resumo de cotações e demais
      chamadores seguem funcionando)
- [x] O middleware de dev do `vite.config.ts` (se emula
      `/api/notifications/*`) continua servindo as rotas
- [x] Novo `POST /api/notifications/request-created` recebe `{ id }`, exige
      JWT de sessão válido no `Authorization: Bearer` (401 sem sessão), lê a
      solicitação com o client admin e envia pelo `sendTemplatedEmail`
- [x] Destinatários vêm só de `REQUESTS_STOCK_ALERT_TO` (vírgula separa
      mais de um); env ausente → erro logado, nada enviado
- [x] Migration nova cria o template `purchase_request_created` em
      `notification_templates`, visual no padrão de
      `quotation_pending_approval_digest`
- [x] Conteúdo: tipo (SC/SM), solicitante, departamento, prioridade,
      justificativa, itens com quantidade, fornecedor quando SC, marcação
      "sem estoque" por item (a partir do estoque atual em `products`) e
      botão "Ver solicitações" apontando para `/requests/purchases` (a issue
      02 troca para a URL filtrada)
- [x] Assunto com "[URGENTE]" quando `priority !== 'standard'`
- [x] `handleSubmitRequest` (`RequestManagement.tsx`) chama o endpoint
      depois que `addRequest` retorna a linha criada, em fire-and-forget com
      try/catch — falha no envio não muda a mensagem de sucesso nem bloqueia
      a criação
- [x] Função pura de montagem das variáveis do e-mail, testada com vitest:
      SC com fornecedor, SM sem fornecedor, `standard` vs `urgent`, item sem
      estoque, escape de HTML em campos livres

## Comments

Env nova na Vercel (fora do repo — avisar o usuário): `REQUESTS_STOCK_ALERT_TO`.
