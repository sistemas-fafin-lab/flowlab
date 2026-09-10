# 01 — Migration: elegibilidade de desconto automático por exame (Particular)

**What to build:** nova migration em `supabase/migrations/` (mesmo padrão de
`20260904110000_custo_fontes_pagadoras.sql` e
`20260908120000_custo_fontes_pagadoras_atendido.sql`) que adiciona a coluna:

```sql
ALTER TABLE public.custo_fontes_pagadoras
  ADD COLUMN IF NOT EXISTS elegivel_desconto_particular BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN public.custo_fontes_pagadoras.elegivel_desconto_particular IS
  'TRUE = exame conta para a política de desconto automático por volume do
   orçamento Particular na Tabela Particular (5+ exames elegíveis distintos ou
   R$300 acumulado = 10%%; 10+ ou R$1.000 = 15%%). Só tem sentido nas linhas
   fonte_pagadora=''Particular'' — nas demais fica FALSE e é ignorado, mesmo
   padrão de ''coluna que só importa pra um subconjunto de linhas'' já usado
   por ''atendido''. Editável na tela (PayorsScreen), não vem do APLIS.';
```

Backfill na própria migration: marcar `elegivel_desconto_particular = TRUE`
para as linhas `fonte_pagadora='Particular'` cujo `tuss` está nesta lista —
os 48 TUSS distintos hoje marcados "Sim" na coluna "Desconto automático" da
planilha `Tabela Comparativo de Valores A C.xlsx` (aba "Orçamento
Particular"), preservando a política de desconto já vigente:

```sql
UPDATE public.custo_fontes_pagadoras
SET elegivel_desconto_particular = TRUE
WHERE fonte_pagadora = 'Particular'
  AND tuss IN (
    '40301060','40301087','40301150','40301281','40301397','40301400',
    '40301419','40301630','40301648','40301842','40301990','40302040',
    '40302113','40302199','40302318','40302423','40302504','40302512',
    '40302580','40302750','40302830','40304264','40304361','40305465',
    '40306852','40308391','40311210','40313190','40313328','40316106',
    '40316190','40316211','40316220','40316246','40316270','40316289',
    '40316300','40316335','40316360','40316408','40316416','40316424',
    '40316467','40316491','40316505','40316513','40316521','40316572'
  );
```

Aplicar primeiro em **teste** (`eqzqkztgzcngnxmihdom`) para validar, depois em
**produção** (`jqxeqmeikqclmmongclj`) — produção é onde a Tabela Particular
vai ler os dados de verdade (confirmado: 360 linhas `fonte_pagadora='Particular'`
em prod). Rodar via SQL Editor do dashboard, seguindo o mesmo cuidado do
`mudanca_supabase.md` — não faz parte do escopo desta ticket aplicar sozinho
em produção sem confirmação explícita de quem tem acesso.

**Blocked by:** Nenhum — pode começar imediatamente.

**Status:** ready-for-human

- [x] Migration criada em `supabase/migrations/`, idempotente (`ADD COLUMN IF
      NOT EXISTS`) — `supabase/migrations/20260910090000_custo_fontes_pagadoras_elegivel_desconto_particular.sql`
- [x] Coluna `elegivel_desconto_particular BOOLEAN NOT NULL DEFAULT FALSE`
      existe em `custo_fontes_pagadoras`
- [x] Backfill marca `TRUE` exatamente nas linhas `fonte_pagadora='Particular'`
      com um dos 48 TUSS listados acima; todas as outras linhas (Particular ou
      não) ficam `FALSE`
- [ ] Migration aplicada em teste e validada por query antes de aplicar em
      produção
- [ ] `select count(*) from custo_fontes_pagadoras where fonte_pagadora =
      'Particular' and elegivel_desconto_particular` retorna 48 (ou o número
      de linhas Particular que casam com os 48 TUSS, caso algum TUSS da lista
      não exista mais na tabela)

## Comments

Migration escrita e revisada (code-review sem findings). Não apliquei em
teste nem em produção: não tenho credenciais de banco (psql/`DATABASE_URL`)
neste ambiente — só a service role key de teste via `SUPABASE_URL`/
`SUPABASE_SERVICE_ROLE_KEY` do `.env`, que não executa DDL arbitrário — e o
próprio ticket pede para rodar via SQL Editor do dashboard. Falta, para
quem tem acesso:

1. Colar o conteúdo da migration no SQL Editor de **teste**
   (`eqzqkztgzcngnxmihdom`) e rodar.
2. Validar com a query de contagem acima (checklist final).
3. Repetir em **produção** (`jqxeqmeikqclmmongclj`), com confirmação
   explícita antes de rodar (fora do escopo deste agente sem isso).
