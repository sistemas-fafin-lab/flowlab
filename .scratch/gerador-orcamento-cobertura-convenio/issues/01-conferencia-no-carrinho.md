# 01: Conferência de cobertura no carrinho

**What to build:** o atendente escolhe um convênio num seletor "Conferir cobertura do convênio" acima do carrinho do Gerador de Orçamento e vê, em cada item, um selo ✓ coberto ou ✗ não coberto, além de um indicador geral: "Todos os exames são aceitos pela X" quando o convênio cobre tudo, ou "K de N cobertos pela X" quando não. É só conferência: preço, quantidade, Desconto automático por volume, resumo de valores e PDFs continuam iguais. Esta fatia cria as regras puras da Conferência de cobertura e o convênio escolhido guardado na página, que as próximas fatias reaproveitam.

Ver `.scratch/gerador-orcamento-cobertura-convenio/spec.md` → histórias 13–23, 25, 26 e "Implementation Decisions".

**Blocked by:** None (can start immediately)

**Status:** resolved

- [x] Módulo de domínio puro `cobertura` (sem React, rede ou PDF), ao lado de `carrinho`/`orcamento`/`pedidoMedico`
- [x] `conveniosDaLista(exames)` devolve os nomes distintos de `conveniosAceitos`, em ordem alfabética pt-BR
- [x] `conferirCobertura(exames, convenio)` devolve cobertos, não cobertos (cada um com os outros convênios que o atendem, sem o escolhido, em ordem) e o resumo `{ cobertos, total, todosCobertos }`; exame repetido (tuss + nome) conta uma vez; exames de mesmo TUSS e nomes diferentes são distintos
- [x] Testes vitest do módulo cobrindo: todos cobertos, parte coberta, nenhum coberto, lista vazia, repetido conta uma vez, outros convênios sem o escolhido, não coberto sem nenhum convênio, convênio inexistente, mesmo TUSS com nomes diferentes; e para `conveniosDaLista`: sem repetição, ordem com acentos, lista vazia, exames sem convênio
- [x] O convênio escolhido (ou nenhum) é estado único da página do Gerador, sem persistência (some ao recarregar)
- [x] Seletor acima do carrinho com busca por digitação (sem acento, sem diferenciar maiúsculas, mesma normalização da busca de exames), opções de `conveniosDaLista` e opção de limpar a escolha
- [x] Com convênio e carrinho não vazio: selo ✓/✗ por item e o indicador verde ("Todos os exames são aceitos pela X") ou âmbar ("K de N cobertos pela X")
- [x] Quantidade de um item não altera a conta; carrinho vazio ou sem convênio não mostra selo nem indicador
- [x] Preços, desconto, resumo e PDFs (cliente e interno) inalterados; nenhuma permissão nova (usa `canUseGeradorOrcamento`); nenhuma mudança no servidor
- [x] Conferido no navegador
