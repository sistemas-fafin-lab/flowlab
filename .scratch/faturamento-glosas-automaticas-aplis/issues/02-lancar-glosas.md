# 02 — Lançar as glosas do apLIS

**What to build:** o operador marca as glosas de cada título (checkbox
separado do das baixas), confirma, e as glosas entram depois das baixas do
título, todas ou nenhuma, com a origem apLIS registrada. Reabrir a prévia não
sugere de novo o que já foi lançado. O modal e o botão viram "Aplicar baixas e
glosas do apLIS". Ver `../spec.md` — decisões 5, 7, 12, 13 e 14.

**Blocked by:** 01

**Status:** done

- [x] Migration: coluna `glosas.origem` (nulo = digitada; `'aplis'`)
- [x] RPC `fat_lancar_glosas_aplis` (exige `canManageBilling`): numa transação por título, confere título não cancelado e com número, lote vinculado ao título, motivo e status válidos, soma das glosas ≤ valor total; grava `origem`, `lote_id`, `codigo_glosa`, status e autor; sem `recebimento_id`
- [x] Roteiro de teste manual em SQL nos comentários: lote de outro título, soma acima do total, status inválido, erro desfaz a transação, `origem` gravada, usuário sem permissão
- [x] A regra desconta, por título + lote + código, as glosas de origem apLIS não revertidas; só a glosa sem origem conta como manual (pulado); teste vitest dos dois casos
- [x] Dois checkboxes por título (baixas e glosas) e marcar/desmarcar todos de cada; rodapé com o total de baixas e o de glosas separados
- [x] Execução em sequência: baixas do título, depois as glosas numa chamada só se todas as baixas marcadas entraram; resultado por título inclui "baixa falhou, glosas não lançadas"; erro num título não para os outros; teste vitest da seleção, do total e do resumo
- [x] Fechar depois de lançar relê a lista e a conferência; modal e botão renomeados

## Comments

### 14/10/2026 — implementado

- **Migration** `supabase/migrations/20261014190000_fat_lancar_glosas_aplis.sql`:
  `glosas.origem` (nulo ou `'aplis'`, com CHECK) e `fat_lancar_glosas_aplis(p)`.
  A RPC reaproveita `fat_travar_titulo_lancamento` (trava e recusa cancelado),
  `fat_validar_glosa_lancamento` (motivo, valor > 0, lote do título) e
  `fat_auditar_lancamento`: cada glosa grava `responsavel` (nome de quem chamou) e
  uma linha de inclusão em `notas_lancamentos_audit_logs` (quem confirmou, US 28).
  Exige lote em toda glosa (sem ele a prévia não teria como descontá-la). Teto:
  glosado não revertido + novas ≤ valor total, antes de qualquer INSERT.
  **Não testada contra banco** (não há Postgres local): o roteiro manual está nos
  comentários da migration. A rota da prévia passa a ler `glosas.origem` — aplicar
  a migration antes de publicar o backend.
- **Desconto** (`glosasSugeridas`): por lote + código (sem código, pelo motivo em
  texto), as glosas `origem = 'aplis'` não revertidas descontam dos grupos —
  primeiro do de mesmo status, depois dos outros (a glosa lançada aberta continua
  contando se o apLIS passou a requisição a definitiva). Só glosa sem origem conta
  como `glosa-manual`.
- **Prévia:** cada glosa leva `loteId` (uuid do lote no sistema), lido junto dos
  títulos (`titulosParaConferir` devolve `idLoteSistema`).
- **Modal:** checkbox de baixas e de glosas por título e "marcar todas" de cada um;
  rodapé com baixas e glosas separadas. Execução em `aplicarTitulo` (util, testada
  com as RPCs injetadas). Seleção inicial: tudo, menos baixas repetidas em outro
  título e **glosas de um lote sugerido em mais de um título** (lote vinculado aos
  dois: o desconto é por título, e lançar nos dois glosaria o lote em dobro) —
  achado da revisão, o mesmo selo "lote em outro título".

