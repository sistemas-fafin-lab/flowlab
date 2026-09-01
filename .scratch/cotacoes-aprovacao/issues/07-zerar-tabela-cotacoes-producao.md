# 07 — Zerar tabela de cotações em produção

**What to build:** um script SQL avulso, de execução manual e única, que
remove todas as cotações da base de produção. A cascata de banco já
existente cuida das tabelas relacionadas (itens, propostas, itens de
proposta, fornecedores convidados, aprovações, logs de auditoria) — não é
necessário tratamento adicional para elas. Sem backup/export prévio. Esta é
a etapa final e isolada da entrega, executada só depois que todos os outros
tickets estiverem implementados e validados em produção.

**Blocked by:** 02, 03, 04, 05, 06

**Status:** done

- [x] Script SQL avulso criado na mesma área do repositório onde já existem
      scripts equivalentes de manutenção de banco
- [x] Executar o script remove todas as cotações e, por cascata de banco já
      existente, todos os registros relacionados (itens, propostas, itens de
      proposta, fornecedores convidados, aprovações, logs de auditoria)
- [x] Nenhum backup/export é feito antes da execução (decisão explícita do
      responsável pelo produto)
- [x] A execução é manual, tratada como ação isolada e irreversível, com
      confirmação explícita no momento — não faz parte de nenhum deploy
      automatizado
- [x] Tabelas não relacionadas por FK a cotações (ex.: fornecedores,
      usuários) não são afetadas

## Comments

Criado `supabase/scripts/zerar_cotacoes.sql`, na mesma pasta dos demais
scripts avulsos de manutenção (`reverter_coleta.sql`, `remover_usuario.sql`
etc.). É só documentação + SQL comentado — nada roda sozinho: passo 1
(contagem opcional), passo 2 (`DELETE FROM quotations;`, comentado, precisa
ser descomentado e executado manualmente no SQL Editor do Supabase) e passo
3 (conferir que zerou). Confirmado por leitura das migrations
(`20260219120000_expand_quotations_module.sql` e
`20260219130000_messaging_infrastructure.sql`) que `quotation_items`,
`quotation_invited_suppliers`, `quotation_proposals` (e por cascata
`quotation_proposal_items`), `quotation_approvals`, `quotation_audit_logs` e
`quotation_messages` já têm `ON DELETE CASCADE` a partir de `quotations` —
um único `DELETE FROM quotations` basta. Sem função nem GRANT: é um comando
SQL avulso para colar no SQL Editor, não uma ação exposta a `authenticated`.
Não roda automaticamente por design — só deve ser executado manualmente
depois que as issues 02–06 estiverem validadas em produção, por isso não
foi executado nesta sessão.
