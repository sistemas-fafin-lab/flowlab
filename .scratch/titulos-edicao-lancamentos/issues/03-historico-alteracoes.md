# 03 — Seção "Alterações" na linha expandida do título

**What to build:** lista da auditoria de lançamentos do título (data, quem,
campo, antes → depois, motivo) na linha expandida. Ver `../spec.md`.

**Blocked by:** 01

**Status:** done

- [x] Hook `buscarAlteracoes(notaId)`
- [x] Seção "Alterações" abaixo de "Baixas registradas", recarregada quando o título muda

**Notas da implementação:** carregado junto com as baixas (mesma versão
`statusAtualizadoEm`); a seção só aparece quando há alteração. Formatação em
`descreverAlteracao` (utils/correcaoLancamento.ts, testada).
