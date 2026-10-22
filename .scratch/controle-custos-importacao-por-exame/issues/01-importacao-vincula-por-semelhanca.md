# 01: Importação vincula cada linha da planilha a um exame por semelhança

**What to build:** A importação de tabela de fonte pagadora passa a gravar uma linha por exame do convênio, com o nome do exame no convênio. Cada linha é vinculada por semelhança de nome a um exame do mesmo TUSS; sem exame parecido (ou sem exame no TUSS), sobe com o valor, Atendido "Não" e "Custo não levantado". Custo 0 é custo levantado (Sim). A prévia mostra o vínculo de cada linha, e a tela da fonte mostra as linhas não levantadas. Ver spec: `../spec.md`.

**Blocked by:** None

**Status:** ready-for-agent

- [x] Coluna `nome_exame_convenio` em `custo_fontes_pagadoras`, com unicidade das linhas não levantadas por (tabela, TUSS, nome); migração da contração (ticket 07 de `controle-custos-tabela-associada`) ajustada para não tratar essas linhas como linha geral.
- [x] Domínio: semelhança de nomes (só entre exames do mesmo TUSS, empate → não levantado) e plano da importação (vínculo, custo, CSP, Atendido, linha existente a atualizar, linhas gerais substituídas), com testes.
- [x] Validação: TUSS sem exame deixa de ser rejeitado; "Nome do Exame" passa a ser obrigatório.
- [x] Prévia: nome no convênio, exame vinculado (ou "Custo não levantado"), custo, CSP, Atendido e aviso das linhas gerais substituídas.
- [x] Gravação: remove as linhas gerais substituídas, atualiza as existentes (reimportação mantém o exame vinculado) e insere as novas.
- [x] Tela da fonte mostra as linhas não levantadas (nome no convênio, "Custo não levantado"); as vinculadas mostram o nome no convênio.
- [x] Orçamento, payload da Admissão e unificação ignoram linhas não levantadas na cobertura de exames.
- [x] Exportações com a coluna "Nome no convênio".

## Comments

- 2026-10-22 — Implementado; falta conferir no navegador (precisa da migração aplicada no Supabase de teste).
  - Migração `20261022140000_custo_fontes_pagadoras_nome_exame_convenio.sql`: coluna, CHECK de nome preenchido e índice único das linhas não levantadas por (tabela, TUSS, nome). A contração do ticket 07 de `controle-custos-tabela-associada` foi renomeada para `20261022150000` (depende da coluna) e passou a tratar só linhas gerais na conferência e no índice (tabela, TUSS).
  - Domínio: `semelhancaNomes.ts` (palavras em comum, sem acento/maiúsculas/palavras vazias, abreviação de 4+ letras; vincula com metade ou mais das palavras do nome mais curto; desempate pelo nome com menos palavras sobrando; empate total → não levantado) e `planejarImportacao` em `importacaoFontesPagadoras.ts`. `calcularAtendidoImportacao` saiu; `validarLinhasImportacaoFontePagadora`/`separarUpsertFontePagadora` ficaram só para os scripts de migração antigos.
  - Tela: `ehLinhaNaoLevantada`/`ehLinhaGeral` em `busca.ts`; a linha não levantada aparece na fonte com o nome no convênio e "Custo não levantado"; a vinculada mostra "No convênio: …". O filtro de exame também busca pelo nome no convênio. A aba Análise passou a usar o exame da linha de exame e a ignorar as não levantadas.
  - Editar uma linha não levantada pelo modal de linha e escolher o exame já a vincula (atualiza a linha, não cria outra). O ticket 02 fica para a ação dedicada na tabela.
  - Orçamento e payload da Admissão ignoram as não levantadas (no payload, `exame_id` null seria linha geral do TUSS do lado da Admissão).
  - O limite de semelhança ainda não foi calibrado com planilhas reais de convênio.
- 2026-10-22 — Ajustes com a planilha real `AMH - Conab.xlsx` (239 linhas; simulação contra os exames do Supabase de teste):
  - leitura: cabeçalho procurado nas 20 primeiras linhas e em qualquer coluna, aceitando "Codigo TUSS" e "Valor convênio"; colunas a mais ignoradas; linhas em branco puladas (`lerPlanilhaConvenio`);
  - semelhança: "Dosagem"/"Pesquisa"/"ou" não contam; começo comum de 7+ letras casa ("Triglicerídeos" × "TRIGLICÉRIDES");
  - empate: a linha vale para todos os exames do TUSS com a maior nota (decisão do usuário), uma linha gravada por exame;
  - resultado: 211 linhas distintas da planilha → 185 linhas vinculadas, 44 de TUSS sem exame, 8 de nome diferente (siglas, "Não localizado").
