# Spec: importação de fonte pagadora vinculando cada linha a um exame

Status: ready-for-agent

## Problem Statement

A importação de tabela de fonte pagadora (spec `controle-custos-importacao-csp`) casa a planilha só pelo TUSS. Cada TUSS vira uma "linha geral", que vale para todos os exames do TUSS com o mesmo preço e o mesmo Atendido. O Atendido é calculado pelo exame **mais caro** do TUSS. A coluna "Nome do Exame" é lida e descartada.

Isso não reflete o contrato:

- Um TUSS pode ter vários exames com custos diferentes. No backup de 2026-10-21, 67 TUSS têm mais de um exame, e em 30 deles os custos diferem. Exemplo: TUSS 40307271, IGE TOTAL (R$ 8,00) e IgE Painel Alimentos (R$ 45,77). O IGE TOTAL pode sair "Não" por causa do custo do painel.
- Um TUSS sem exame na aba Exames é rejeitado na validação. O valor do convênio para esse exame se perde, mesmo que o laboratório ainda não precise do custo dele.
- Um exame cadastrado com custo 0 sai "Não", com o aviso "custo não cadastrado". Para o faturamento, custo 0 já é um custo levantado.

Os nomes da planilha vêm da tabela do convênio. Cada tabela de contrato usa a própria grafia, que não bate com a aba Exames, mas fica próxima dela (ex.: "Hemograma" × "HEMOGRAMA COMPLETO").

## Solution

- Cada linha da planilha vira uma linha de preço própria, que guarda o **nome do exame no convênio**.
- A importação tenta **vincular** cada linha a um exame do mesmo TUSS **por semelhança de nome**. Vinculada, a linha vale só para aquele exame, e o Atendido sai do CSP daquele exame.
- Quando não acha um exame parecido o bastante (ou o TUSS não tem exame), a linha sobe assim mesmo, com o valor do convênio, Atendido "Não" e "Custo não levantado" no lugar do custo.
- Na tela, o usuário pode **vincular à mão** uma linha não levantada, ou trocar o exame de um vínculo automático errado.
- Custo 0 conta como custo levantado: CSP 0%, Atendido "Sim".

## User Stories

1. Como responsável pelo faturamento, quero que cada exame da planilha do convênio seja vinculado ao exame certo do laboratório, mesmo com o nome escrito de outro jeito, para que cada um tenha o próprio custo e Atendido.
2. Como responsável pelo faturamento, quero que, num TUSS com vários exames, cada linha da planilha use o custo do exame a que foi vinculada, e não o do mais caro do TUSS, para que um exame barato não fique "Não" por causa de outro.
3. Como responsável pelo faturamento, quero que um exame da planilha sem exame parecido na aba Exames suba com o valor do convênio, Atendido "Não" e "Custo não levantado", para ter a tabela inteira do convênio no sistema.
4. Como responsável pelo faturamento, quero que um TUSS sem nenhum exame cadastrado também suba desse jeito, em vez de ser rejeitado.
5. Como responsável pelo faturamento, quero que um exame com custo 0 cadastrado conte como custo levantado (CSP 0%, Atendido "Sim"), porque custo 0 foi conferido.
6. Como responsável pelo faturamento, quero ver na prévia da importação a que exame cada linha foi vinculada, ou que ficou não levantada, para conferir antes de gravar.
7. Como responsável pelo faturamento, quero vincular à mão, na tela da fonte pagadora, uma linha com "Custo não levantado" ao exame certo, para que ela passe a mostrar o custo.
8. Como responsável pelo faturamento, quero trocar o exame de uma linha vinculada errado pela importação.
9. Como responsável pelo faturamento, quero que reimportar a mesma tabela mantenha os vínculos que fiz à mão, para não refazer o trabalho a cada reajuste.
10. Como responsável pelo faturamento, quero que, depois de um vínculo manual, o Atendido continue como estava até eu mudar, como já acontece quando o custo muda.
11. Como responsável pelo faturamento, quero ver o nome do exame no convênio na tela e na exportação, para comparar com a tabela do contrato.
12. Como usuário do gerador de orçamento e da Admissão, quero que uma linha não levantada não apareça como convênio de nenhum exame.

## Implementation Decisions

- **Nome no convênio**: coluna nova em `custo_fontes_pagadoras` (texto, opcional), gravada pela importação a partir de "Nome do Exame". Linhas criadas pelo modal de linha não a preenchem.
- **Três tipos de linha** (hoje são dois):
  - **linha de exame** (`exame_id` preenchido): vale só para aquele exame. É o que a importação grava quando vincula.
  - **linha não levantada** (`exame_id` nulo, nome no convênio preenchido): não cobre nenhum exame. Aparece na tela da fonte com nome no convênio, TUSS, valor, "Custo não levantado" e Atendido.
  - **linha geral do TUSS** (`exame_id` nulo, nome no convênio nulo): continua como hoje, para as linhas existentes e para "aplicar a todos os exames do TUSS" no modal. A importação deixa de criar esse tipo.
- **Vínculo por semelhança**: só entre os exames do mesmo TUSS, inclusive quando o TUSS tem um exame só. Os nomes são normalizados (maiúsculas, acentos, pontuação, palavras como "de/da/do" e as genéricas da tabela TUSS, "Dosagem" e "Pesquisa") e comparados por palavras em comum (abreviação de 4+ letras e começo comum de 7+ letras contam), de modo que "Hemograma" × "HEMOGRAMA COMPLETO" vincula. Nota = palavras em comum / palavras do nome mais curto; abaixo de 0,5 → não levantada. **Todos os exames do TUSS com a maior nota recebem a linha** (decidido com o usuário em 2026-10-22: mesmo TUSS, nome parecido, o convênio paga o mesmo), cada um com o próprio custo e Atendido: "Creatinina, Dosagem" → CREATININA - S, - U e - U-24. Um exame menos parecido fica de fora ("Ige, Total" não leva o IgE Painel Alimentos).
- **Linha própria cadastrada à mão** (modal de linha) para o exame vinculado, na mesma tabela: a importação a adota (atualiza valor, Atendido e grava o nome no convênio), porque a tabela do convênio é a fonte da verdade. A prévia avisa.
- **Dois nomes do convênio para o mesmo exame** na mesma tabela: o primeiro vincula e o segundo fica não levantado, com aviso na prévia. A unicidade por (tabela, exame) continua.
- **Atendido**: vinculada → `csp = custo do exame * 100 / valor`, `atendido = csp <= limite` (custo 0 → "Sim"). Não levantada → "Não". Valor ≤ 0 → "Não", como hoje.
- **Reimportação**: a linha da planilha casa com a existente por (tabela, TUSS, nome no convênio normalizado). Existente vinculada → atualiza valor e Atendido e mantém o exame (manual ou automático). Existente não levantada → tenta vincular de novo (o exame pode ter sido cadastrado depois).
- **Vínculo manual**: ação "Vincular exame" na linha não levantada e "Trocar exame" na linha vinculada que tem nome no convênio. A escolha mostra primeiro os exames do mesmo TUSS, mas aceita qualquer exame. O Atendido não é recalculado, porque o % máx CSP não é salvo.
- **Unicidade**: o ticket 07 de `controle-custos-tabela-associada` cria um índice único `(tabela_associada_id, btrim(tuss)) WHERE exame_id IS NULL`. Ele passa a valer só para linhas gerais (nome no convênio nulo). Linhas não levantadas ficam únicas por (tabela, TUSS, nome no convênio normalizado). A migração do 07 ainda não foi aplicada, então é ajustada antes de ir para produção.
- **Leitores**: a tela, o orçamento (`api/_lib/orcamentoParticular.ts`) e o payload da Admissão (`api/_lib/tussExames.ts`) passam a ignorar linhas não levantadas na cobertura de exames. A Admissão aplica a regra de cobertura do lado dela, então o payload não envia linhas não levantadas (senão viram linha geral do TUSS lá).
- **Exportação**: as exportações de linhas de fonte pagadora ganham a coluna "Nome no convênio".
- **Módulo de domínio**: a função pura de semelhança e a de cálculo da importação ficam no módulo de domínio da importação, testáveis sem React nem Supabase. A prévia e a gravação consomem o mesmo resultado.

## Testing Decisions

- Bom teste aqui verifica o resultado da função de domínio (planilha + exames + linhas existentes → vínculo, custo, CSP, Atendido), não a forma interna da semelhança.
- **Semelhança**: "Hemograma" × "HEMOGRAMA COMPLETO" vincula; acentos e maiúsculas não importam; exames do TUSS com a mesma nota → todos vinculados; nome sem palavra em comum → não levantada; exame de outro TUSS nunca é candidato.
- **Cálculo**: vinculada usa o custo do próprio exame; custo 0 → "Sim"; não levantada → "Não"; TUSS sem exame → não levantada, não rejeitada; valor 0 → "Não"; dois nomes para o mesmo exame → o segundo fica não levantado com aviso.
- **Reimportação**: mantém o exame de uma linha vinculada à mão; revincula uma não levantada quando o exame passou a existir.
- **Cobertura** (busca, orçamento, payload da Admissão): linha não levantada não cobre nenhum exame.
- Prior art: testes de `importacaoFontesPagadoras`, `busca` e do orçamento.
- Sem teste de componente React nem de Supabase, como no resto do Controle de Custos.

## Out of Scope

- Vincular por semelhança a exames de outro TUSS.
- Salvar o % máx CSP ou recalcular o Atendido quando o custo ou o vínculo mudam.
- Converter as linhas gerais já existentes em linhas de exame fora da reimportação.
- Dar preço, numa reimportação, a exames do TUSS que o convênio não listou.
- Cadastrar o exame na aba Exames a partir da linha não levantada.

## Further Notes

- Pedido do usuário do faturamento, em conversa de 2026-10-22. Substitui, da spec `controle-custos-importacao-csp`: o "maior custo do TUSS" (história 8), "custo 0 → Não" (13) e "TUSS não cadastrado é rejeitado" (21).
- **Decidido com o usuário (2026-10-22):**
  1. **Exame do sistema que o convênio não listou** fica fora daquela fonte: o valor vai só para os exames que o convênio listou. Ex.: a planilha traz só "IGE TOTAL"; o "IgE Painel Alimentos", do mesmo TUSS 40307271, não recebe preço.
  2. **Tabelas já importadas ficam como estão** e só mudam quando forem reimportadas. Na reimportação, a linha geral de um TUSS presente na planilha é substituída pelas linhas novas (vinculadas ou não levantadas), e as exclusões e os valores personalizados dela vão junto. A prévia avisa quantas linhas gerais serão substituídas. Linhas gerais de TUSS que não estão na planilha não são tocadas.
- **Pendente:** planilhas reais de dois ou três convênios, para calibrar o limite de semelhança. Até chegarem, o limite é calibrado com os nomes da aba Exames e ajustado depois.
