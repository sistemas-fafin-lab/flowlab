# Mudança de produção — Fase 5 (cutover) + Fases 6, 6B, 7A, 7C e 8

Instruções para levar **produção** ao estado atual do desenvolvimento: aplicar a
mudança no banco (Supabase) e publicar o código novo (Vercel). Escrito em
2026-07-17, validado por diff completo `pg_dump` prod × test.

O que esta mudança adiciona à produção:

- **Fase 5 — cutover do estoque departamental** (o `product_stock` vira a verdade;
  `products.quantity` vira cache). ⚠️ **A parte aditiva já está em prod, mas o
  cutover NÃO** — por isso 98 movimentações desde 01/07 deixaram 72 produtos com
  saldo divergente. O script reconcilia isso.
- **Fase 6 / 6B — coletas e recoletas** (check-in, coleta, baixa de insumos).
- **Fase 7A — recebimento de exames + acompanhamento de culturas.**
- **Fase 7C — temperatura de equipamentos.**
- **Fase 8 — laudos.**
- **Agenda por grade** nos postos (substitui `ac_horarios_padrao`).
- **Notificação FlowLab → LAB-HUB** do status da coleta (via `pg_net` + Vault).

---

## Ordem de execução (checklist)

Faça numa **janela de baixo tráfego**, porque o cutover do estoque e o frontend
novo precisam entrar praticamente juntos.

1. [ ] **Banco** — rodar `supabase/scripts/prod-upgrade-fase6-8.sql` no SQL Editor de prod (Parte 1).
2. [ ] **Vercel** — promover o deploy da branch para Production (Parte 2, §Deploy).
3. [ ] **Banco** — provisionar os 2 segredos do Vault (Parte 1, Passo 2).
4. [ ] **Conferência** — rodar as queries de verificação (Parte 1, Passo 3) e abrir o app.

> Por que 1 e 2 juntos: depois do cutover, o botão "Adicionar Estoque" do
> frontend **antigo** escreveria `products.quantity` direto e seria sobrescrito
> pelo cache na movimentação seguinte. Aplicar o SQL e promover o deploy na mesma
> janela evita essa janela de inconsistência.

---

## Parte 1 — Banco de produção (Supabase)

**Projeto:** `flowlab` (produção), ref `jqxeqmeikqclmmongclj`.
**Arquivo:** [`supabase/scripts/prod-upgrade-fase6-8.sql`](./supabase/scripts/prod-upgrade-fase6-8.sql)
(15 migrations concatenadas: cutover da Fase 5 + Fases 6–8 + fix de RLS de ac_postos, na ordem correta).
Runbook detalhado: [`supabase/scripts/prod-upgrade-fase6-8.md`](./supabase/scripts/prod-upgrade-fase6-8.md).

### Passo 1 — Rodar o script

1. Dashboard de **produção** → **SQL Editor** → **New query**.
2. Colar o conteúdo **inteiro** de `prod-upgrade-fase6-8.sql`.
3. **Run**.

Garantias e cuidados:

- Executa em **transação única**: se qualquer trecho falhar, **nada** é aplicado.
- **Não re-rode após sucesso** — o trecho da migration `20260714` referencia a
  coluna `fechado` que ele mesmo remove; uma 2ª execução daria erro (sem efeito,
  pela transação única, mas desnecessário).
- A migration `20260708120000` (seed de menu) foi **deixada de fora** de
  propósito: sobrescreveria o menu personalizado de prod ("Consumo do Setor",
  categoria "TI & AI"). O script faz só o acréscimo aditivo de "Estoque
  Departamental".
- O script cria a extensão `pg_net` (`CREATE EXTENSION IF NOT EXISTS pg_net`) —
  permitido no SQL Editor (role `postgres`).

### Passo 2 — Segredos do Vault (notificação FlowLab → LAB-HUB)

O gatilho `trg_ac_notificar_labhub_status` (migration `20260713`) lê 2 segredos do
Vault para chamar o `deliver-coleta` quando a coleta muda de status. **Sem eles
nada quebra** — o gatilho só emite `WARNING` e a coleta segue — mas o LAB-HUB não
recebe o status. Rodar **uma vez** no SQL Editor de prod, com os valores reais:

```sql
select vault.create_secret(
  'https://<DOMINIO-DE-PRODUCAO-DO-FLOWLAB>/api/analises-clinicas/deliver-coleta',
  'flowlab_deliver_coleta_url');

select vault.create_secret('<FLOWLAB_API_KEY de producao>', 'flowlab_api_key');
```

- `<DOMINIO-DE-PRODUCAO-DO-FLOWLAB>`: o domínio do deploy `flowlab` na Vercel
  (dashboard → Project `flowlab` → Settings → Domains). Ex.:
  `flowlab-sistemas-fafin-lab-sistemas-fafins-projects.vercel.app`.
- `<FLOWLAB_API_KEY de producao>`: **o mesmo valor** já configurado na variável
  `FLOWLAB_API_KEY` do Vercel (e idêntico ao do LAB-HUB de produção).

Para conferir/atualizar depois:

```sql
select name from vault.secrets where name in ('flowlab_deliver_coleta_url','flowlab_api_key');
-- para trocar um valor: select vault.update_secret('<id>', '<novo valor>');
```

### Passo 3 — Conferências (SQL Editor de prod)

```sql
-- estoque reconciliado: deve retornar 0
select count(*) as divergentes from (
  select p.id from products p
  left join product_stock ps on ps.product_id = p.id
  group by p.id, p.quantity
  having p.quantity is distinct from coalesce(sum(ps.quantity),0)
) d;

-- 11 tabelas novas no lugar
select table_name from information_schema.tables
 where table_schema = 'public' and table_name like 'ac\_%' order by 1;

-- catálogo de exames semeado (centenas de linhas TUSS)
select count(*) from ac_exames;

-- trilha de cultura: 3 etapas, a última "Laudo concluído"
select ordem, nome from ac_cultura_etapas order by ordem;

-- grade dos postos configurada pelo seed
select nome, agenda_hora_inicio, agenda_hora_fim,
       agenda_intervalo_min, agenda_dias_semana from ac_postos;

-- menu preservado + "Estoque Departamental" acrescentado
select items from module_categories where id = 'operacoes';

-- modelo antigo removido
select to_regclass('public.ac_horarios_padrao');  -- deve ser NULL
```

---

## Parte 2 — Vercel

**Projeto:** `flowlab` (org `sistemas-fafins-projects`), ref
`prj_vWkuavwyTHpJQiAWA9gwFSiAKR9X`.

### Configuração do projeto (já definida)

| Item | Valor |
| --- | --- |
| Framework preset | **Vite** |
| Build command | `vite build` (do `package.json`) |
| Output directory | `dist` |
| Install command | `npm install` |
| Roteamento SPA | `vercel.json` → rewrite de tudo que não é `/api/*` para `/` |
| Funções serverless | `api/**` (Node, TypeScript) — inclui `api/analises-clinicas/deliver-coleta.ts` |

Nada de build precisa mudar para esta entrega.

### Variáveis de ambiente

Confira em: dashboard → Project `flowlab` → **Settings → Environment Variables**
(escopo **Production**). **Nunca** commitar os valores; use o dashboard ou
`vercel env add`. As variáveis do **backend** (`api/`) devem apontar para o
**Supabase de PRODUÇÃO** (`jqxeqmeikqclmmongclj`), não para o de test.

**Relevantes para esta mudança (Análises Clínicas / coletas) — já configuradas em Production:**

| Variável | Escopo | Observação |
| --- | --- | --- |
| `LABHUB_API_URL` | Production, Preview | URL da API do **LAB-HUB de produção** (confirmar que **não** é `localhost:3333`). |
| `FLOWLAB_API_KEY` | Production, Preview | Chave compartilhada com o LAB-HUB. **Mesmo valor** usado no segredo `flowlab_api_key` do Vault. |
| `LABHUB_WEBHOOK_SECRET` | Production, Preview | Segredo HMAC dos webhooks (resultado + coleta); idêntico ao `FLOWLAB_WEBHOOK_SECRET` do LAB-HUB. |
| `SUPABASE_URL` | Production | Aponta para prod (`jqx`). |
| `SUPABASE_SERVICE_ROLE_KEY` | Production | Service role de prod (bypassa RLS). |
| `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` | Prod, Preview, Dev | Frontend → Supabase de prod. |

> ✅ Para esta entrega **não é preciso adicionar nenhuma variável nova no Vercel** —
> todas as necessárias já existem em Production. O que é realmente novo está no
> **banco** (script + Vault do Passo 2) e no **deploy do código** (abaixo).

**Demais variáveis** (e-mail transacional e analytics), já configuradas e sem
relação com esta mudança: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`,
`SMTP_FROM`, `UMAMI_USER`, `UMAMI_PASS`, `UMAMI_TIMEZONE`.

> Opcionais que **não** estão em Production hoje (features fora do escopo desta
> entrega — só configurar se forem usadas em prod): `VITE_APP_URL` (sem ela, o app
> usa a URL padrão de `src/utils/appUrl.ts`), `GOOGLE_SA_*` /
> `GOOGLE_ADMIN_SUBJECT` / `GOOGLE_ALIAS_*` (criação de alias no Google Workspace),
> `SLACK_INVITE_URL`.

### Deploy do código novo

⚠️ **A produção atual do Vercel é de ~14 dias atrás — anterior às Fases 6–8.** O
código dessas fases está na branch `feat/coleta-status-callback` (publicada só
como **preview**). Sem promover para Production, as telas novas e o
`deliver-coleta` **não existem em prod**.

Opção recomendada (pelo Git, com histórico limpo):

1. Abrir/mergear o PR da branch de Análises Clínicas na branch base do projeto
   (ver a política de base de PR do time).
2. O merge na branch de produção dispara o build e a promoção automática no
   Vercel (deploy de Production).

Opção alternativa (promover manualmente via CLI, sem merge):

```bash
# a partir da raiz do repo, com o Vercel CLI logado (org sistemas-fafins-projects)
vercel --prod
```

Depois do deploy, confirme que a versão de Production é a nova (dashboard →
Deployments → a mais recente com Environment = **Production**).

---

## Verificação end-to-end (após 1–4)

1. Abrir o app de produção e logar.
2. **Estoque**: abrir Estoque Departamental — saldos por local batendo; registrar
   uma movimentação de teste e confirmar que `product_stock` e o cache
   `products.quantity` mexem juntos.
3. **Análises Clínicas**: abrir os módulos novos (Coletas, Culturas, Temperatura,
   Laudos) — devem carregar sem erro; catálogo de exames disponível no check-in.
4. **Integração LAB-HUB** (se já estiver ativa em prod): mudar o status de uma
   coleta e confirmar no LAB-HUB que o agendamento reflete (`coletado → realizado`).
   Se os segredos do Vault não estiverem provisionados, o status **não** propaga
   (e aparece um `WARNING` nos logs do Postgres), mas nada quebra.

## Rollback / observações

- O **script do banco** é transacional: uma falha não deixa estado parcial. Depois
  de aplicado com sucesso, não há "desfazer" automático — as tabelas novas são
  aditivas e o cutover só troca gatilhos/reconcilia saldos (não apaga dados).
- O **deploy do Vercel** é reversível: dashboard → Deployments → escolher o deploy
  anterior de Production → **Promote to Production** (rollback instantâneo). Mas se
  já tiver aplicado o cutover no banco, prefira manter o frontend novo (ver a nota
  de coordenação no topo).
- Os segredos do Vault podem ser adicionados **depois**, sem redeploy: o gatilho os
  lê a cada disparo.
