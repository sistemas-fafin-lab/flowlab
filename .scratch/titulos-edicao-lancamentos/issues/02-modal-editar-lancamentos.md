# 02 — Modal "Editar título" com baixas e glosas editáveis

**What to build:** o modal ganha a seção de lançamentos (baixas + glosas sem
baixa), com editar/excluir por linha, formulário de correção com motivo, e a
regra pura de diff/validação testada. Ver `../spec.md`.

**Blocked by:** 01

**Status:** done

- [x] `utils/correcaoLancamento.ts` + testes: diff dos campos, validação, payload da RPC
- [x] Hook: `buscarLancamentos`, `corrigirLancamento`, `excluirBaixa`
- [x] Modal: número da nota (como hoje) + lançamentos; editar abre o formulário da baixa com as glosas; excluir pede motivo e avisa das glosas
- [x] Título cancelado: lançamentos só leitura

**Notas da implementação:** `CorrecaoLancamentoForm.tsx` (formulário de uma
baixa ou do grupo sem baixa) dentro de `EditarTituloModal.tsx`. Salvar o
número da nota não fecha mais o modal. Seletor de lote da glosa só aparece em
título com mais de um lote.
