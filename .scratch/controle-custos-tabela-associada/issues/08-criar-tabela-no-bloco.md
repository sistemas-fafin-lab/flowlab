# 08: Criar tabela pelo bloco "Tabelas desta fonte"

**What to build:** Com uma fonte selecionada, o bloco "Tabelas desta fonte" ganha um "+ Nova tabela" (nome + vencimento opcional), para cadastrar o contrato sem precisar abrir o modal de linha ou a importação. Hoje o bloco permite editar o vencimento, renomear, desativar e excluir, mas criar só existe no campo de escolha da tabela. A spec pede o bloco completo: "bloco 'Tabelas desta fonte' (nome, vencimento, selo, ativa; criar/editar/desativar/excluir)". Ver spec: `../spec.md`.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] Botão "+ Nova tabela" no cabeçalho do bloco, com nome e vencimento opcional, usando a mesma regra de nome de `erroNomeTabela` (repetido na fonte sem diferenciar maiúsculas, contando as inativas, é recusado com a mensagem que diz qual tabela já existe).
- [ ] A tabela criada aparece na hora no bloco e nas listas de escolha (modal de linha e importação), sem recarregar.
- [ ] Só para quem gerencia faturamento (`canManageBilling`), como as demais ações do bloco.
- [ ] Reaproveitar `createTabelaAssociada` do hook; nada muda no banco.
- [ ] Conferido no navegador.

## Comments

- 2026-10-22: lacuna encontrada na conferência no navegador do ticket 03 (Supabase de teste). Ver `03-gerenciar-tabelas.md`.
