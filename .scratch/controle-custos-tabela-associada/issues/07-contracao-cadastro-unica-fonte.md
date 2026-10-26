# 07: Contração — cadastro de tabela associada como única fonte da verdade

**What to build:** Com as duplicadas unificadas e todo o código lendo pelo id, o banco passa a garantir as regras do cadastro: nome de tabela único por fonte sem diferenciar maiúsculas, toda linha com tabela cadastrada, e unicidade das linhas por tabela. O texto livre da tabela deixa de ser lido por qualquer código. Para o usuário, fica impossível voltar a nascer um "PART" ao lado de "Part". Ver spec: `../spec.md`.

**Blocked by:** 02 — Escolha por lista; 03 — Gerenciar tabelas; 04 — Tela, orçamento e exportação por id; 06 — Unificação das tabelas duplicadas

**Status:** done

- [x] Unicidade de nome por fonte sem diferenciar maiúsculas/espaços nas pontas.
- [x] `tabela_associada_id` obrigatório em `custo_fontes_pagadoras`.
- [x] Unicidade por (tabela_associada_id, TUSS) para linhas gerais e (tabela_associada_id, exame) para linhas de exame, substituindo a unicidade por texto.
- [x] Nenhum leitor (tela, importação, exportação, orçamento, integrações) usa mais o texto da tabela; a coluna de texto é removida ou mantida só como compatibilidade, sem divergir do cadastro.
- [x] Testes e `tsc` verdes; conferência manual das constraints na migração. (testes e `tsc` ok; a conferência manual espera a migração ser aplicada depois da unificação)

## Comments

- 2026-10-22 — Código e migração prontos; a migração **só pode ser aplicada depois da unificação do ticket 06** (que espera o mapa do 05).
  - Migração `supabase/migrations/20261022150000_custo_tabelas_associadas_contracao.sql`:
    - começa conferindo; se houver nomes repetidos na fonte (sem diferenciar maiúsculas), nome vazio, linha sem tabela ou linha duplicada por (tabela, TUSS)/(tabela, exame), aborta listando tudo, sem alterar nada. Pelo backup de 2026-10-21, hoje aborta por `Particular`/`PARTICULAR`, `part`/`PART` e a tabela `''` da fonte Particular; as linhas já não têm duplicata;
    - cria o índice único `(fonte_pagadora, lower(btrim(nome)))` e o CHECK de nome preenchido, e as regras do cadastro passam a valer também no INSERT (nome gravado sem espaços nas pontas, mensagem dizendo qual tabela já existe);
    - troca a UNIQUE `(fonte, texto, tuss, exame_id)` por índices únicos parciais `(tabela_associada_id, btrim(tuss)) WHERE exame_id IS NULL` e `(tabela_associada_id, exame_id) WHERE exame_id IS NOT NULL`. A UNIQUE antiga, com `exame_id` nulo, nem impedia duas linhas gerais do mesmo TUSS;
    - a coluna `tabela_associada` fica só por compatibilidade, sempre como cópia do nome do cadastro. Quando a gravação traz o id, o id manda; um update que troca só o texto para o de outra tabela é recusado (23514). Quando traz só o texto, o nome precisa ser de uma tabela já cadastrada na fonte (sem diferenciar maiúsculas); senão dá erro 23503, e o cadastro não é mais criado pelo texto.
  - Ordem: se a migração da unificação for gerada com timestamp posterior a `20261022150000`, renomear a da contração para depois dela. As consultas da conferência manual estão no cabeçalho do arquivo.
  - Leitores que ainda usavam o texto:
    - tela/exportação (`useCostControl`): o nome vem do cadastro por embed (`tabela:custo_tabelas_associadas(nome)`);
    - payload da Admissão (`api/_lib/tussExames.ts`): o nome vem do cadastro pelo id, e o payload ganhou `tabela_associada_id` (mudança aditiva no contrato);
    - scripts one-shot `migrar-orcamento-particular.ts` e `migrar-planilha-legada-fontes-pagadoras.ts`: casam e gravam pelo id do cadastro (o da planilha cadastra a tabela que faltar).
  - Ficou de fora: `supabase/scripts/fix-particular-tuss-40601200.sql` (one-shot antigo, já aplicado) ainda filtra pelo texto. E `supabase/scripts/unificar-tabelas-associadas.ts` ainda lê o texto, de propósito. Ele roda **antes** da contração e a SQL que gera usa `ON CONFLICT (fonte_pagadora, nome)`, que deixa de existir depois do 07.
  - Nomes já gravados com espaços nas pontas não são aparados pela migração; a unicidade compara por `lower(btrim(nome))`, e os nomes novos ou renomeados já são gravados sem esses espaços.
  - Erro de tipo antigo, fora deste ticket: `migrar-orcamento-particular.ts` passa `LinhaPlanilhaFontePagadora[]` sem `atendido` para `separarUpsertFontePagadora`. Vem do ticket do % máx CSP.

- 2026-10-26 — Renomeada para `20261026140000_custo_tabelas_associadas_contracao.sql` (depois da unificação, 20261026130000) e aplicada em produção; a conferência interna passou. Conferido por dado: nenhum (tabela, TUSS) ou (tabela, exame) duplicado e texto igual ao cadastro. Não conferido: os índices em `pg_indexes` e os INSERT/UPDATE que devem falhar (sem acesso SQL direto a produção nesta sessão).
