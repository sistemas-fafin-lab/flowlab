# Spec: tabela associada como cadastro da fonte pagadora, com vencimento de contrato

Status: ready-for-agent

## Problem Statement

No Controle de Custos, a fonte pagadora é quem paga (ex.: AMHP, uma "Campanha") e a tabela associada é o preço daquela fonte para um contrato específico (ex.: PROASA, AFFEGO, cada campanha) — uma fonte tem várias tabelas. Hoje a tabela associada é só um texto digitado em cada linha de preço. Sem cadastro, cada grafia diferente vira uma tabela nova: a fonte Particular está com "Part", "Particular", "PARTICULAR" e "PART", e o banco aceita o mesmo TUSS com preços diferentes em cada uma. Também não há onde registrar quando o contrato daquela tabela vence, então o faturamento não tem como acompanhar contratos vencidos nem saber quando reajustar.

## Solution

- A tabela associada vira um cadastro próprio, ligado à fonte pagadora, com nome único por fonte (sem diferenciar maiúsculas), vencimento opcional e situação ativa/inativa.
- As linhas de preço passam a apontar para a tabela cadastrada; na importação e no modal de linha a tabela é escolhida da lista da fonte, com "+ Nova tabela" no próprio campo — texto livre deixa de existir.
- A tela de Fontes Pagadoras ganha um bloco "Tabelas desta fonte" para criar, editar, desativar e excluir tabelas, com selo de vencimento ("vencida" / "vence em até 30 dias") e um filtro de contratos a vencer.
- As tabelas duplicadas existentes são unificadas por uma migração que só aplica um mapa decidido pelo faturamento, com conflitos de preço resolvidos TUSS a TUSS.

## User Stories

1. Como responsável pelo faturamento, quero cadastrar as tabelas associadas de cada fonte pagadora, para representar os contratos (PROASA, AFFEGO, cada campanha) que a fonte paga.
2. Como responsável pelo faturamento, quero que uma fonte possa ter várias tabelas associadas, para refletir os vários contratos de um mesmo pagador.
3. Como responsável pelo faturamento, quero ser impedido de criar duas tabelas com o mesmo nome na mesma fonte, mesmo com maiúsculas diferentes, para que não nasça outro "PART" ao lado de "Part".
4. Como responsável pelo faturamento, quero informar a data de vencimento do contrato de cada tabela, para acompanhar a validade do contrato.
5. Como responsável pelo faturamento, quero deixar o vencimento em branco quando não houver contrato com prazo, para não inventar uma data.
6. Como responsável pelo faturamento, quero ver um selo "vencida" nas tabelas com contrato vencido, para agir sobre elas.
7. Como responsável pelo faturamento, quero ver um selo "vence em até 30 dias" nas tabelas perto do vencimento, para me programar para o reajuste.
8. Como responsável pelo faturamento, quero filtrar as tabelas com contrato a vencer ou vencido, para revisar todas de uma vez.
9. Como responsável pelo faturamento, quero que uma tabela vencida continue valendo no orçamento e na importação, porque o vencimento é um aviso, não um bloqueio.
10. Como responsável pelo faturamento, quero ver as tabelas de uma fonte num bloco da própria tela de Fontes Pagadoras, para gerenciar sem trocar de aba.
11. Como responsável pelo faturamento, quero escolher a tabela associada de uma lista ao importar uma planilha, para não digitar o nome errado.
12. Como responsável pelo faturamento, quero escolher a tabela associada de uma lista ao criar ou editar uma linha de preço, pelo mesmo motivo.
13. Como responsável pelo faturamento, quero criar uma tabela nova direto do campo de escolha ("+ Nova tabela"), já com vencimento, para não interromper a importação.
14. Como responsável pelo faturamento, quero renomear uma tabela e ter todas as linhas dela atualizadas de uma vez, para corrigir um nome sem editar linha a linha.
15. Como responsável pelo faturamento, quero excluir uma tabela que não tem linhas, para limpar cadastros criados por engano.
16. Como responsável pelo faturamento, quero ser impedido de excluir uma tabela que ainda tem linhas, para não apagar preços sem perceber.
17. Como responsável pelo faturamento, quero desativar uma tabela que não está mais em uso, para que ela suma das listas de escolha sem apagar o histórico.
18. Como responsável pelo faturamento, quero que as linhas de uma tabela inativa continuem valendo na tela e no orçamento, porque desativar só tira a tabela das escolhas.
19. Como responsável pelo faturamento, quero que a tabela Particular da fonte Particular não possa ser renomeada, excluída nem desativada, porque o gerador de orçamento depende dela pelo nome.
20. Como usuário do gerador de orçamento, quero que a Tabela Particular continue vindo só da tabela "Particular" da fonte Particular, e que "PART" continue fora, para que os preços do orçamento não mudem com a migração.
21. Como responsável pelo faturamento, quero receber a lista de todas as tabelas existentes por fonte, com o número de linhas de cada, para decidir quais juntar.
22. Como responsável pelo faturamento, quero decidir quais tabelas são a mesma (ex.: "Particular" + "PARTICULAR"), para que nada seja juntado só porque a grafia parece igual.
23. Como responsável pelo faturamento, quero ver cada TUSS que tem preços diferentes nas tabelas que vou juntar, e escolher o preço que fica, para não perder um valor correto.
24. Como responsável pelo faturamento, quero que a unificação não rode enquanto houver conflito sem resposta, para não gravar um preço escolhido pelo sistema.
25. Como responsável pelo faturamento, quero que as exportações (.xlsx/.csv) tragam a coluna Vencimento da tabela associada, para acompanhar contratos fora do sistema.
26. Como responsável pelo faturamento, quero que exclusões de exame e valores personalizados por exame continuem ligados às mesmas linhas depois da unificação, para não perder ajustes já feitos.

## Implementation Decisions

- **Schema**: nova tabela `custo_tabelas_associadas` com `id`, `fonte_pagadora` (texto — a fonte pagadora continua sem cadastro próprio), `nome`, `vencimento` (data, opcional), `ativa` (padrão true) e timestamps. Unicidade de `nome` por `fonte_pagadora`, sem diferenciar maiúsculas/espaços nas pontas.
- `custo_fontes_pagadoras` ganha `tabela_associada_id` (FK, obrigatória após a migração). A unicidade atual por (fonte, tabela texto, TUSS) passa a ser por (tabela_associada_id, TUSS) para linhas gerais, e por (tabela_associada_id, exame) para linhas de exame. O texto `tabela_associada` deixa de ser a fonte da verdade; a remoção da coluna (ou sua manutenção por um período, para compatibilidade da API) é decisão de implementação, desde que nenhum leitor dependa do texto divergir do cadastro.
- **RLS**: mesmo gate de `custo_fontes_pagadoras` (ver e gerenciar faturamento).
- **Regras no banco**: exclusão de tabela só sem linhas (FK restritiva); a tabela Particular da fonte Particular é protegida contra renomear, excluir e desativar.
- **Tela de Fontes Pagadoras**: com uma fonte selecionada, bloco "Tabelas desta fonte" (nome, vencimento, selo, ativa; criar/editar/desativar/excluir) e filtro de contratos a vencer/vencidos.
- **Situação de vencimento**: função pura `situacaoVencimento(vencimento, hoje)` → `vencida` (antes de hoje) | `a_vencer` (de hoje até 30 dias) | `em_dia` | `sem_vencimento`. Usada no selo e no filtro.
- **Inativa**: some das listas de escolha (importação, modal de linha, "+ Nova tabela" não sugere) e não recebe linhas novas; linhas existentes continuam valendo em todo lugar.
- **Campo de tabela associada** (importação e modal de linha): escolha da lista de tabelas ativas da fonte selecionada, com "+ Nova tabela" (nome + vencimento) no próprio campo.
- **Domínio da tela**: a precedência linha de exame × linha geral do TUSS e a noção de "mesma fonte + tabela" (cobertura, duplicidade, irmãos) passam a comparar por id da tabela, não por texto normalizado.
- **Backend do orçamento**: continua identificando a Tabela Particular pelo nome "Particular" da fonte Particular, agora via cadastro; as demais tabelas da fonte Particular continuam fora.
- **Exportações**: coluna Vencimento adicionada nas exportações de linhas de fonte pagadora.
- **Unificação das duplicadas**:
  1. Levantamento (só leitura em produção): todas as combinações (fonte, tabela texto) com número de linhas e, para grupos que o faturamento indicar como candidatos, os TUSS/exames com preços diferentes.
  2. O faturamento devolve o **mapa de junção** (quais nomes viram qual tabela) e a **escolha de preço** por conflito.
  3. Uma função pura de planejamento recebe linhas atuais, mapa e escolhas e devolve **ou** a lista de conflitos sem resposta **ou** as operações a aplicar (criar tabelas, apontar linhas, remover linhas perdedoras, remapear exclusões e valores personalizados das linhas removidas para a linha que fica). A migração só é gerada a partir de um plano sem conflitos.
  4. Nada é unificado sem estar no mapa; "Part"/"PART" só se juntam a "Particular" se o mapa disser.

## Testing Decisions

- Bom teste verifica comportamento externo (entradas → saída das funções de domínio; resposta do orçamento), não detalhes internos.
- **Testado**:
  - `situacaoVencimento`: sem data, vencida, vence hoje, vence em 30 dias, vence em 31 dias.
  - Domínio da tela (busca/cobertura): precedência e duplicidade por id da tabela, inclusive duas tabelas de nomes que antes colidiam por normalização.
  - Planejamento da unificação: sem conflitos → operações; conflito sem escolha → bloqueio; escolha aplicada → linha perdedora removida e exclusões/valores personalizados remapeados; nome fora do mapa intocado.
  - Orçamento particular: Tabela Particular via cadastro, "PART" fora.
- Prior art: testes de busca/cobertura do Controle de Custos, testes de exportação, testes do backend do orçamento particular.
- Regras no banco (unicidade, proteção da Particular, exclusão só sem linhas) ficam na migração SQL e são conferidas manualmente — o projeto não tem teste automatizado de SQL.

## Out of Scope

- Cadastro próprio de fonte pagadora.
- Data de reajuste separada do vencimento, histórico de vigências ou de preços.
- Bloqueio de orçamento ou importação por contrato vencido.
- Notificações (e-mail/push) de vencimento.
- Unificação automática por semelhança de nome.
- Importação com % máx CSP (spec `controle-custos-importacao-csp`).

## Further Notes

- Pedido do Marcos Jr. (faturamento). Decisões fechadas em sessão de grilling (Q9–Q13, Q17–Q21).
- O levantamento da unificação precisa de leitura no Supabase de produção, que foi negada nesta sessão — o dev precisa liberar ou rodar a consulta.
- Entrega depois da `controle-custos-importacao-csp`.
