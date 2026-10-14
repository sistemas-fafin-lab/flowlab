# 01 — Banco: auditoria + RPCs de correção e exclusão de lançamentos

**What to build:** migration com `notas_lancamentos_audit_logs`,
`fat_corrigir_lancamento(p jsonb)` e `fat_excluir_baixa(uuid, text)`. Ver `../spec.md`.

**Blocked by:** None — can start immediately

**Status:** done

- [x] Tabela de auditoria append-only (SELECT para canView/canManageBilling, sem INSERT/UPDATE/DELETE por policy)
- [x] `fat_corrigir_lancamento`: edita campos da baixa, edita/inclui/exclui glosas da baixa (ou do grupo sem baixa), motivo obrigatório, um registro de auditoria por campo alterado
- [x] Validações do lançamento repetidas; teto de glosas checado depois de aplicar (rollback se estourar)
- [x] Recusa título cancelado, baixa/glosa de outro título, salvamento sem alteração
- [x] `fat_excluir_baixa`: apaga as glosas da baixa e a baixa, com cópia completa na auditoria

**Notas da implementação:** migration `20261014120000_fat_corrigir_lancamentos.sql`.
Helpers internos (`fat_auditar_lancamento`, `fat_validar_glosa_lancamento`,
`fat_travar_titulo_lancamento`) sem EXECUTE para `authenticated`. O teto de
glosas só recusa quando a correção **aumenta** o glosado (título legado já
acima do total ainda pode ser corrigido para baixo). **Aplicar a migration
antes do deploy do código** — sem ela o modal mostra erro ao carregar o
histórico e ao salvar. O SQL não foi executado localmente (sem Postgres de
teste disponível na sessão).
