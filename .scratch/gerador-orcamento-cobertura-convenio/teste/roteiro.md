# Roteiro — Conferência por fonte pagadora e convênio

Arquivo: `pedido-fonte-convenio.png` (pedido fictício, 6 exames). Use no Gerador de Orçamento → **Ler pedido médico** → **Analisar pedido** → aba **Cobertura do convênio**.

Exames escolhidos nos dados do **dev local** (Supabase de dev, 11/11/2026). Em produção as tabelas podem atender outros exames, então os números podem mudar.

| # | No pedido | Reconhecido como | O que testa |
|---|---|---|---|
| 1 | Cultura para fungos com antifungigrama | CULTURA PARA FUNGOS + ANTIFUNGIGRAMA | coberto por BACEN **e** BACEN - MEDICINA LABORATORIAL |
| 2 | CEA | CEA | só BACEN - MEDICINA LABORATORIAL |
| 3 | Citologia em meio líquido | CITOLOGIA EM MEIO LÍQUIDO | só BACEN (sem "MEDICINA LABORATORIAL") |
| 4 | Colesterol HDL | COLESTEROL HDL | AMHP-DF por outros convênios, nenhum BACEN |
| 5 | Proteína C antigênica | PROTEÍNA C ANTIGÊNICA | nenhum convênio cadastrado atende |
| 6 | Exame Xyzfictício de teste | — | não encontrado na tabela (fora da conta) |

## Resultado esperado (fonte AMHP-DF)

| Convênio | Resumo | Cobertos | Não cobertos |
|---|---|---|---|
| Todos os convênios da fonte | 4 de 5 cobertos pela AMHP-DF | 1, 2, 3, 4 | 5 |
| BACEN | 2 de 5 cobertos pela AMHP-DF · BACEN | 1, 3 | 2, 4, 5 |
| BACEN - MEDICINA LABORATORIAL | 2 de 5 cobertos pela AMHP-DF · BACEN - MEDICINA LABORATORIAL | 1, 2 | 3, 4, 5 |

## Outras conferências

- Abrir "Outros convênios" de um não coberto: os convênios aparecem agrupados por fonte ("AMHP-DF: …").
- Proteína C antigênica: ao abrir, "Nenhum convênio cadastrado atende este exame."
- "Marcar só os não cobertos" com BACEN: ficam marcados 2, 4 e 5, e o botão vira "Adicionar 3 ao carrinho".
- Adicionar ao carrinho e fechar o modal: o carrinho mostra a mesma fonte e convênio, com o mesmo resumo.
- No carrinho, trocar a fonte (ex.: CASSI): o convênio volta para "Todos os convênios da fonte".

Conferido no navegador em 11/11/2026: os três resumos da tabela acima bateram.
