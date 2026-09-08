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

**Status:** done

- [x] Todas as abas de convênio da planilha (exceto `Convenios aceitos`,
      `Custo Alvaro`, `TABELA REF`, `PESQUISAR CUSTOS`) são carregadas em
      `custo_fontes_pagadoras`
- [x] `Tabela Associada` preenchida corretamente via `Convenios aceitos`
      ou via prefixo do nome da aba
- [x] Só a `ASSEFAZ REAJUSTE` é migrada, como fonte pagadora "ASSEFAZ";
      a `ASSEFAZ` antiga não gera registros
- [x] `atendido` reflete corretamente o conteúdo da coluna
      `OBS`/`Atendemos` de cada aba
- [x] Linhas em branco não geram registros vazios
- [x] Valores em número, string com vírgula e moeda são todos gravados
      como número correto
- [x] `GAMA` não é migrada e aparece como pulada no relatório final
- [x] TUSS inválido (não existe em `custo_exames`) é pulado sem
      interromper a migração das demais linhas
- [x] Script produz um relatório final com contagem de linhas
      criadas/atualizadas por fonte pagadora e de linhas puladas

## Comments

Implementado em `supabase/scripts/migrar-planilha-legada-fontes-pagadoras.ts`
(rodável via `npx tsx`) + `domain/migracaoPlanilhaLegada.ts` (resolução de
fonte pagadora/tabela associada por aba, localização de cabeçalho, extração
de linhas — testado em `migracaoPlanilhaLegada.test.ts`). Reaproveita
`validarLinhasImportacaoFontePagadora`/`separarUpsertFontePagadora` do
ticket 02 sem alteração.

Regras confirmadas contra a planilha real
(`3 - VALORES ANÁLISES CLÍNICAS.xlsx`):
- Aba no formato `<Parceiro>-<Convênio>` (ex: `AMH-AFFEGO`): fonte pagadora
  é o convênio (parte após o hífen), Tabela Associada é o prefixo — direto
  do nome da aba, sem checar `Convenios aceitos` (o prefixo da aba já é a
  fonte da verdade nesse caso, mesmo quando diverge do parceiro listado lá,
  ex: `AMHP-BACEN` vs. BACEN→AMH na lista).
- Aba sem hífen: fonte pagadora é o próprio nome da aba; Tabela Associada é
  o Parceiro achado em `Convenios aceitos`, ou — quando não há Parceiro
  cadastrado pro convênio — repete o nome da fonte pagadora (mesma
  convenção do registro seed `ABAC`/`ABAC` da migration 20260904110000: sem
  entidade administradora distinta, a tabela repete a fonte). Na planilha
  real, todas as abas sem hífen (`AMPLA`, `CBMDF`, `FASCAL`, `FUSEX`, `GDF`,
  `GEAP`, `PF SAÚDE`, `PLAN ASSISTE E TRIBUNAIS`, `PMDF`, `POSTAL`, `SAÚDE
  CAIXA`, `SIS SENADO`, `TJDFT e STF`) caem nesse segundo caso.
- Cabeçalho não tem layout fixo entre abas (linha em branco antes ou não,
  `Codigo TUSS`/`Nome do Exame`/`Valor convênio`/`OBS` na maioria, mas
  `CÓDIGO`/`DESCRIÇÃO`/`VALOR FINAL` na FASCAL, `Atendemos` em vez de `OBS`
  na PMDF, sem coluna de atendido na SAÚDE CAIXA/FASCAL/FUSEX) —
  `localizarCabecalho` acha as colunas por palavra-chave normalizada em vez
  de índice fixo.

Rodado com `--dry-run` (só leitura) contra o banco real pra conferir o
relatório antes de qualquer escrita: 19 fontes pagadoras processadas, 4449
linhas a criar, 54 a atualizar (colisão esperada com fonte+tabela já
seedadas pela migration 20260904110000, ex: `ASSEFAZ`/`ASSEFAZ`,
`CBMDF`/`CBMDF`, `PMDF`/`PMDF` — a `ASSEFAZ REAJUSTE` sendo "mais nova e
mais completa" sobrescreve corretamente os valores antigos dessas linhas),
11520 puladas por TUSS inválido (esperado — `custo_exames` só tem ~503
TUSS cadastrados). A execução real (sem `--dry-run`) contra o banco de
produção não foi feita nesta sessão — fica pra quem for rodar decidir o
momento.
