# 03 — Migração da planilha legada para Fontes Pagadoras

**What to build:** um script único (fora da tela) que carrega em
`custo_fontes_pagadoras` os dados da planilha "VALORES ANÁLISES CLÍNICAS"
usada anteriormente pela equipe para controlar custo por convênio,
substituindo esse controle manual pela tela de Fontes Pagadoras. Reaproveita
a mesma lógica de validação de TUSS contra `custo_exames` e de upsert
(fonte pagadora + TUSS) construída no ticket 02, só que rodando
programaticamente sobre o arquivo inteiro em vez de via upload manual.

- Migra como fonte pagadora cada aba de convênio da planilha, **exceto**:
  `Convenios aceitos` (usada só como referência), `Custo Alvaro` (já
  carregada em `custo_exames`, não é uma fonte pagadora), `TABELA REF`
  (valores todos zerados) e `PESQUISAR CUSTOS` (rascunho de análise).
- `Tabela Associada` de cada fonte pagadora é resolvida pela aba
  `Convenios aceitos` (mapeamento convênio → Parceiro) ou, quando o nome
  da aba já vem no formato `<Parceiro>-<Convênio>` (ex: `AMH-AFFEGO`),
  pelo prefixo antes do hífen.
- `ASSEFAZ`: migra só os dados da aba `ASSEFAZ REAJUSTE` (versão mais nova
  e mais completa) como sendo a fonte pagadora "ASSEFAZ" — a aba `ASSEFAZ`
  antiga é descartada.
- Coluna `OBS`/`Atendemos` de cada aba vira o booleano `atendido`: texto
  não-vazio = `Não`, célula vazia = `Sim`.
- Linhas em branco (ex.: sobra de fórmula arrastada em `ASSEFAZ
  REAJUSTE`, que tem ~49.600 linhas vazias) são ignoradas.
- Valores em formatos diferentes entre abas (número puro, string com
  vírgula decimal, moeda `"R$ X,XX"`) são normalizados para número antes
  de gravar.
- A aba `GAMA` usa códigos AMB/92/CBHPM em vez de TUSS e **não** é
  migrada automaticamente — fica para cadastro manual posterior na tela.
- TUSS que não existe em `custo_exames` é pulado (mesma regra de
  validação do import da tela), não trava a migração inteira.
- Ao final, o script reporta: quantas linhas foram criadas/atualizadas por
  fonte pagadora, quantas foram puladas por TUSS inválido, e confirma que
  `GAMA` foi ignorada.

**Blocked by:** 02 — Importar custos de Fontes Pagadoras (reaproveita a
validação de TUSS e a lógica de upsert construídas nesse ticket).

**Status:** ready-for-agent

- [ ] Todas as abas de convênio da planilha (exceto `Convenios aceitos`,
      `Custo Alvaro`, `TABELA REF`, `PESQUISAR CUSTOS`) são carregadas em
      `custo_fontes_pagadoras`
- [ ] `Tabela Associada` preenchida corretamente via `Convenios aceitos`
      ou via prefixo do nome da aba
- [ ] Só a `ASSEFAZ REAJUSTE` é migrada, como fonte pagadora "ASSEFAZ";
      a `ASSEFAZ` antiga não gera registros
- [ ] `atendido` reflete corretamente o conteúdo da coluna
      `OBS`/`Atendemos` de cada aba
- [ ] Linhas em branco não geram registros vazios
- [ ] Valores em número, string com vírgula e moeda são todos gravados
      como número correto
- [ ] `GAMA` não é migrada e aparece como pulada no relatório final
- [ ] TUSS inválido (não existe em `custo_exames`) é pulado sem
      interromper a migração das demais linhas
- [ ] Script produz um relatório final com contagem de linhas
      criadas/atualizadas por fonte pagadora e de linhas puladas
