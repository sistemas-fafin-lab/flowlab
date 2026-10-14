# 02 — Lançar as glosas do apLIS

**What to build:** o operador marca as glosas de cada título (checkbox
separado do das baixas), confirma, e as glosas entram depois das baixas do
título, todas ou nenhuma, com a origem apLIS registrada. Reabrir a prévia não
sugere de novo o que já foi lançado. O modal e o botão viram "Aplicar baixas e
glosas do apLIS". Ver `../spec.md` — decisões 5, 7, 12, 13 e 14.

**Blocked by:** 01

**Status:** ready-for-agent

- [ ] Migration: coluna `glosas.origem` (nulo = digitada; `'aplis'`)
- [ ] RPC `fat_lancar_glosas_aplis` (exige `canManageBilling`): numa transação por título, confere título não cancelado e com número, lote vinculado ao título, motivo e status válidos, soma das glosas ≤ valor total; grava `origem`, `lote_id`, `codigo_glosa`, status e autor; sem `recebimento_id`
- [ ] Roteiro de teste manual em SQL nos comentários: lote de outro título, soma acima do total, status inválido, erro desfaz a transação, `origem` gravada, usuário sem permissão
- [ ] A regra desconta, por título + lote + código, as glosas de origem apLIS não revertidas; só a glosa sem origem conta como manual (pulado); teste vitest dos dois casos
- [ ] Dois checkboxes por título (baixas e glosas) e marcar/desmarcar todos de cada; rodapé com o total de baixas e o de glosas separados
- [ ] Execução em sequência: baixas do título, depois as glosas numa chamada só se todas as baixas marcadas entraram; resultado por título inclui "baixa falhou, glosas não lançadas"; erro num título não para os outros; teste vitest da seleção, do total e do resumo
- [ ] Fechar depois de lançar relê a lista e a conferência; modal e botão renomeados

## Comments
