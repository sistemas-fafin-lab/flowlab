# 03: Desconto automático por volume e resumo

**What to build:** o carrinho do Gerador de Orçamento passa a calcular sozinho o **Desconto automático por volume** e mostra um resumo com **Valor Total** e **Valor com Desconto** (sempre os dois; iguais quando não há desconto; sem percentual nem selo). Regra igual à da Tabela-Particular: 15% sobre os exames elegíveis com 10 ou mais elegíveis distintos ou R$1.000 ou mais em elegíveis; senão 10% com 5 ou mais ou R$300 ou mais; senão 0. A elegibilidade vem de `elegivelDescontoParticular` da lista de preços.

Ver `.scratch/gerador-orcamento/spec.md` → histórias 20–27 e "Regras puras no navegador".

**Blocked by:** 02 — Gerador de Orçamento: busca e carrinho

**Status:** done no código (20/Out/2026; sem migration nova); falta conferir no navegador depois do deploy

- [x] Função pura de cálculo do Orçamento portada da Tabela-Particular (`calcularOrcamento`), sem dependência de React, rede ou PDF, devolvendo valor total, valor com desconto, percentual aplicado e quantidade de elegíveis
- [x] Contagem de elegíveis ignora a quantidade; valor dos elegíveis usa preço × quantidade
- [x] Faixas não se somam; exames não elegíveis nunca recebem desconto nem contam para as faixas
- [x] Resumo na tela mostra Valor Total e Valor com Desconto a partir do mesmo resultado da função
- [x] Testes portados para o vitest do flowlab, incluindo os limites exatos (5, 10, R$300, R$1.000), carrinho só com não elegíveis e quantidade > 1
