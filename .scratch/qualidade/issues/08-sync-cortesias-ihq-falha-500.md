Status: done
Type: bug

# sync-cortesias e sync-ihq falhavam com 500 em produção — KPIs de Cortesias/IHQ/Câncer vazios

## Onde

Reportado pelo usuário: `POST /api/qualidade/sync-cortesias` devolvendo 500 em
produção, e o painel (`DashboardPage.tsx`) mostrando os KPIs de IHQ,
Cortesias e Registro de Câncer vazios (Ocorrências, que não depende de
heurística, sem esse sintoma).

## Causa raiz

`qa_cortesias.id_requisicao_lis` e `qa_ihq_solicitacoes.id_requisicao_ihq`
são `NOT NULL` no schema (`20260820120000_qualidade_piloto.sql`), mas:

1. `bdLabQualidade.ts` nunca buscava `r.IdRequisicao` nessas duas queries
   (`listarAutorizacoesCortesiaLis`/`listarSolicitacoesIhqLis`) — o campo
   não existia nem nas interfaces `AutorizacaoCortesiaLis`/`SolicitacaoIhqLis`.
2. `qualidade-sync-cortesias.ts`/`qualidade-sync-ihq.ts` não incluíam
   `id_requisicao_lis`/`id_requisicao_ihq` no payload do `upsert` — todo
   INSERT violava a constraint NOT NULL, o Supabase devolvia `error`, e o
   handler respondia 500 ("Falha ao gravar ... sincronizadas.").
3. Só em IHQ, um segundo bug: `onConflict: 'cod_requisicao_ihq'` não batia
   com nenhuma UNIQUE existente (só havia a composta
   `(id_requisicao_ihq, id_tarefa_bloco)`, e `id_tarefa_bloco` nunca é
   preenchido por este sync — NULL nunca colide em UNIQUE constraint, então
   mesmo apontando pra composta cada sync duplicaria a linha).

Câncer (`qualidade-sync-cancer.ts`) já incluía `id_requisicao_lis`
corretamente — não tinha este bug. Se o funil de Câncer ainda aparecer vazio
depois desta correção, a causa é outra (ninguém rodou "Sincronizar" ainda
para o período, ou a heurística `Positivo = 1` não bate com o schema real —
ver o cabeçalho de `bdLabQualidade.ts`).

## Correção

- `api/_lib/qualidade/bdLabQualidade.ts`: adiciona `idRequisicaoLis`/
  `idRequisicaoIhq` às interfaces e às queries (`r.IdRequisicao` no SELECT +
  GROUP BY de Cortesias).
- `api/_lib/handlers/qualidade-sync-cortesias.ts` e `qualidade-sync-ihq.ts`:
  incluem o campo no payload do upsert.
- Migration `20260825120000_qualidade_fix_sync_ihq_cortesias.sql`: adiciona
  `UNIQUE (cod_requisicao_ihq)` em `qa_ihq_solicitacoes`, batendo com o
  `onConflict` que o handler já assumia.

## Comments

Depois de aplicar a migration em produção, clicar "Sincronizar" em
`/qualidade/cortesias` e `/qualidade/ihq` para o período em questão e
confirmar `sincronizadas > 0` na resposta.
