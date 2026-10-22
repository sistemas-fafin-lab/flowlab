# 08: Criar tabela pelo bloco "Tabelas desta fonte"

**What to build:** Com uma fonte selecionada, o bloco "Tabelas desta fonte" ganha um "+ Nova tabela" (nome + vencimento opcional), para cadastrar o contrato sem precisar abrir o modal de linha ou a importação. Hoje o bloco permite editar o vencimento, renomear, desativar e excluir, mas criar só existe no campo de escolha da tabela. A spec pede o bloco completo: "bloco 'Tabelas desta fonte' (nome, vencimento, selo, ativa; criar/editar/desativar/excluir)". Ver spec: `../spec.md`.

**Blocked by:** None (can start immediately)

**Status:** done

- [x] Botão "+ Nova tabela" no cabeçalho do bloco, com nome e vencimento opcional, usando a mesma regra de nome de `erroNomeTabela` (repetido na fonte sem diferenciar maiúsculas, contando as inativas, é recusado com a mensagem que diz qual tabela já existe).
- [x] A tabela criada aparece na hora no bloco e nas listas de escolha (modal de linha e importação), sem recarregar.
- [x] Só para quem gerencia faturamento (`canManageBilling`), como as demais ações do bloco.
- [x] Reaproveitar `createTabelaAssociada` do hook; nada muda no banco.
- [x] Conferido no navegador.

## Comments

- 2026-10-22: lacuna encontrada na conferência no navegador do ticket 03 (Supabase de teste). Ver `03-gerenciar-tabelas.md`.
- 2026-10-22: implementado. `NovaTabela` no bloco `TabelasDaFonte` (botão "+ Nova tabela" no cabeçalho, nome + vencimento opcional, Enter cria e Esc cancela; nome checado por `erroNomeTabela`). `handleCriarTabela` no `PayorsScreen` chama `createTabelaAssociada`, e os erros do banco aparecem no aviso de erro, como nas outras ações do bloco. A grafia da fonte gravada virou `fonteDaNovaTabela` em `domain/tabelasAssociadas.ts` (com teste), usada também pelo `EscolhaTabelaAssociada`. Ao criar com o filtro "Vencidas / a vencer" ligado, o bloco volta para "Todas" para a tabela nova aparecer.
  - Conferido no navegador (Supabase de teste, fonte AMHP-DF): " proasa " recusado com 'Já existe a tabela "PROASA"…'; "TESTE 08" com vencimento criada, aparecendo na hora no bloco e na lista do modal de linha; depois excluída pelo bloco. A importação usa a mesma lista de tabelas do hook, mas não foi aberta.
  - Não conferido pela tela: o bloqueio para quem não tem `canManageBilling` (o botão fica sob o mesmo `podeGerenciar` das outras ações).
  - Ficou de fora, de propósito: o formulário repete o do `EscolhaTabelaAssociada` (campos, regra e botões), mas com layout e forma de mostrar o erro diferentes. Extrair um formulário comum fica para quando surgir um terceiro uso.
