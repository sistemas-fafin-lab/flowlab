# Resumo diário de cotações pendentes → FlowLAB

Roda 1x/dia (17h) e envia, para cada gestor com alçada de aprovação, um
e-mail individual listando só as cotações que ainda estão "aguardando
aprovação" dentro do limite de valor dele.

Reaproveita, dentro do próprio runtime do domínio de cotações
(TypeScript/Node — não reescrito em outra linguagem):

- a mesma view de elegibilidade (`user_approval_limits_with_details`,
  `can_approve = true`) usada pela notificação de submissão
  (`src/modules/quotations/hooks/useQuotation.ts`);
- a função pura `buildPendingApprovalDigestNotifications`
  (`src/modules/quotations/pendingApprovalDigest.ts`), que agrupa as
  cotações pendentes por gestor elegível e monta as notificações — coberta
  por teste unitário em `pendingApprovalDigest.test.ts`;
- o endpoint de notificação por e-mail já existente
  (`POST /api/notifications/email`), o mesmo usado pela notificação de
  submissão e pelo alerta de hardware;
- o link de destino (`buildQuotationsUrl` em `src/modules/quotations/routes.ts`),
  o mesmo usado pelo card da Home e pela notificação de submissão.

Diferente do alerta de hardware (`tools/hardware-monitor/`, script Python
standalone), este script depende do código-fonte do domínio de cotações —
não é copiado para `/opt`, roda a partir de um checkout do próprio repositório
FlowLAB com `node_modules` instalado.

## Uso manual

```bash
FLOWLAB_API_URL=https://flow-lab.vercel.app \
  SUPABASE_URL=https://xxxx.supabase.co \
  SUPABASE_SERVICE_ROLE_KEY=<service-role-key> \
  npx tsx tools/quotation-approval-digest/send-digest.ts
```

Ou via script do `package.json`:

```bash
FLOWLAB_API_URL=... SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
  npm run send-quotation-approval-digest
```

Use `--dry-run` para ver os payloads que seriam enviados, sem disparar
nenhum e-mail:

```bash
FLOWLAB_API_URL=... SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
  npm run send-quotation-approval-digest -- --dry-run
```

Gestor sem nenhuma cotação pendente dentro da sua alçada não gera e-mail.

## Configuração (variáveis de ambiente)

| Variável | Obrigatória | Padrão | Descrição |
|---|---|---|---|
| `FLOWLAB_API_URL` | sim | — | Base da API do FlowLAB, usada para `POST /api/notifications/email` |
| `SUPABASE_URL` | sim | — | URL do projeto Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | sim | — | Service role key (leitura de cotações e alçadas) |
| `VITE_APP_URL` | não | `FLOWLAB_API_URL` | Base do link `Ver Cotações` no corpo do e-mail |

## Template no Supabase

A migration
`supabase/migrations/20260901130000_quotation_pending_approval_digest_template.sql`
cria o template `quotation_pending_approval_digest` com as variáveis
`{{pending_count}}`, `{{pending_list_html}}` e `{{action_url}}`. Aplique no
Supabase (CLI ou SQL editor) antes do primeiro envio real.

## Agendamento

### systemd timer (recomendado)

O `install.sh` cria um timer systemd que roda o script todo dia às 17h, a
partir de um checkout do repositório (`REPO_DIR`):

```bash
sudo REPO_DIR=/opt/flowlab \
     FLOWLAB_API_URL=https://flow-lab.vercel.app \
     SUPABASE_URL=https://xxxx.supabase.co \
     SUPABASE_SERVICE_ROLE_KEY=<service-role-key> \
     ./install.sh
```

### Sem o instalador — crontab

```cron
0 17 * * * cd /opt/flowlab && FLOWLAB_API_URL=https://flow-lab.vercel.app SUPABASE_URL=https://xxxx.supabase.co SUPABASE_SERVICE_ROLE_KEY=<service-role-key> /usr/bin/npx tsx tools/quotation-approval-digest/send-digest.ts
```

## Observações de segurança

O endpoint `/api/notifications/email` do FlowLAB hoje é público (não exige
chave) — ver observação equivalente em `tools/hardware-monitor/README.md`.
Já `SUPABASE_SERVICE_ROLE_KEY` é um segredo de leitura ampla: mantenha-a só
no ambiente do host que roda o cron, nunca em código versionado.
