# Upgrade de produção — Fase 5 cutover + Fases 6, 6B, 7A, 7C e 8 (2026-07-17)

Leva o banco de **produção** (`jqxeqmeikqclmmongclj`, pooler `aws-0-sa-east-1`) ao
mesmo estado do banco de **test** (`FlowLab - test`, `eqzqkztgzcngnxmihdom`).
Aplicação pelo **SQL Editor** do dashboard de produção (prod está em outra conta
da CLI; com a senha do PG também dá via psql, mas o SQL Editor basta).

## Como foi verificado

Duas rodadas, com conclusões idênticas onde se sobrepõem:

1. **OpenAPI do PostgREST** (tabelas/colunas/RPCs) + queries de dados.
2. **Diff completo de `pg_dump --schema-only`** dos dois bancos (2026-07-17),
   objeto a objeto: tabelas, funções, triggers, policies, constraints, índices.

O diff bruto tinha ~54 objetos "diferentes", mas quase tudo era ruído: corpos de
função da prod com **CRLF** (colados de arquivos Windows), formatação de CHECK
(`(ARRAY[…])::text[]` vs `ARRAY[(…)::text]` — semanticamente iguais), `START` de
sequence e artefatos `\unrestrict` do pg_dump 18. Sobraram **apenas**:

| Divergência real | Causa | Ação |
| --- | --- | --- |
| `update_stock_on_movement` com corpo **legado** na prod; `sync_product_quantity_cache` inexistente | **Cutover da Fase 5 (`20260701130000`) nunca foi aplicado** — só a parte aditiva | Incluído como item **[1/15]** do script |
| 11 tabelas `ac_*` + RPCs + triggers + policies das Fases 6–8 ausentes | 13 migrations pendentes (`20260708130000` → `20260716150000`) | Itens [2..14] do script |
| `ac_postos` policies com `user_profiles.role` | Sistema usa `custom_roles.permissions`; sem role legada o UPDATE afeta 0 linhas | Item **[15]** — fix de RLS com `canManageAnalisesClinicas` |
| `ac_horarios_padrao` + `ac_dias_excecao.{fechado,horarios}` só na prod | Modelo antigo de agenda; a `20260714` dropa | Coberto pelo item [10] |
| `product_stock.min_stock`, `ac_postos.agenda_*` só no test | Migrations pendentes | Cobertos ([12] e [10]) |

### Consequência do cutover ausente (medida na prod)

Desde 01/07, **98 movimentações** (73 `out/sale` + 25 `out/internal-consumption`)
debitaram só `products.quantity` (gatilho legado) — `product_stock` congelou →
**72 produtos divergentes** (`products.quantity ≠ SUM(product_stock)`).

A reconciliação do próprio cutover (§1.2) **cura os 72**: verificado que nenhum
produto de prod tem saldo em mais de um local (Estoque 95 produtos, Depósito 77,
sem sobreposição), então a guarda "só 1 local" não pula ninguém e cada saldo é
igualado ao `products.quantity` atual — que é a verdade. Nenhuma movimentação de
prod usa `from/to_location_id` (frontend legado no ar), então nada mais depende
do estado antigo.

## Passo 1 — Rodar o script (junto com o deploy do frontend)

Dashboard de **produção** → SQL Editor → colar o conteúdo inteiro de
[`prod-upgrade-fase6-8.sql`](./prod-upgrade-fase6-8.sql) → **Run**.

- Executa em **transação única**: se algo falhar, nada é aplicado.
- ⚠️ **Coordenar com o deploy do app novo na Vercel**: após o cutover, o botão
  "Adicionar Estoque" do frontend legado (que escreve `products.quantity`
  direto) teria o valor sobrescrito pelo cache na próxima movimentação. O ideal
  é rodar o script e promover o deploy na mesma janela.
- **Não re-rodar** após sucesso: o trecho da `20260714` referencia a coluna
  `fechado` que ele mesmo dropa (a 2ª execução erra, sem efeito colateral).

## Passo 2 — Vault (notificação FlowLab → LAB-HUB)

O gatilho `trg_ac_notificar_labhub_status` (migration `20260713`) lê 2 segredos
do Vault. **Sem eles nada quebra** — o gatilho só emite WARNING e a coleta segue
— mas o LAB-HUB não fica sabendo do status. Quando a integração estiver no ar em
produção, rodar no SQL Editor de prod (com os valores REAIS):

```sql
select vault.create_secret(
  'https://<dominio-de-producao-do-flowlab>/api/analises-clinicas/deliver-coleta',
  'flowlab_deliver_coleta_url');
select vault.create_secret('<FLOWLAB_API_KEY de producao>', 'flowlab_api_key');
```

- O domínio é o do deploy `flowlab` na Vercel (dashboard → project → Domains).
- A `FLOWLAB_API_KEY` deve ser **idêntica** à configurada no LAB-HUB de produção
  (mesmo par usado por `receive-agendamento`/`get-disponibilidade`).

## Passo 3 — Conferências pós-aplicação

No SQL Editor de prod:

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

## Avisos

- **Slot 14:00 da Unidade Asa Sul**: existia como horário avulso no modelo
  antigo e não entra na grade 08:00–11:00. Se ainda for desejado, ajustar a
  grade do posto na UI de Análises Clínicas (ou estender `agenda_hora_fim`).
- **`20260708120000_fix_module_categories_seed` foi excluída**: sobrescreveria o
  menu personalizado de prod ("Consumo do Setor", categoria "TI & AI"). O §15 do
  script faz só o acréscimo de "Estoque Departamental".
- **pg_net**: o script faz `CREATE EXTENSION IF NOT EXISTS pg_net` — no SQL
  Editor (role postgres) isso é permitido; nada a fazer antes.
- Divergências cosméticas (CRLF, formatação de CHECK, `START` de sequence,
  COMMENT perdido no baseline do test) foram deixadas como estão — não afetam
  comportamento e não valem o risco de mexer.
