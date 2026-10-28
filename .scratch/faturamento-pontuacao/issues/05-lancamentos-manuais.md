# 05: Lançamentos manuais

**What to build:** quem gerencia Faturamento lança os pontos dos critérios manuais das duas Frentes, digitando os pontos e uma observação obrigatória. Os critérios são:
- Faturamento: domínio dos POPs e melhoria do setor;
- Recurso de Glosa: intrasetorial, POPs, melhoria, refaturamento, reversão de glosa e destravar recursos.

Critério sem lançamento aparece como "não lançado", com 0.

**Blocked by:** 01 (Bloco "Pontuação do setor" com a meta).

**Status:** done

- [x] Tabela de lançamentos no Supabase: ano, mês, Frente, chave do critério, pontos, observação não vazia, quem lançou e quando.
  - Há um lançamento por mês, Frente e critério. Lançar de novo substitui o anterior e guarda quem alterou.
  - Leitura: quem vê Faturamento. Escrita: quem gerencia Faturamento (RLS).
- [x] Ação de lançar ou alterar no handler da pontuação.
  - Sem observação dá 400.
  - Sem permissão de gerenciar dá 403.
  - Chave de critério que não é manual dá 400.
- [x] Na tela: botão de lançar em cada critério manual, só para quem gerencia Faturamento.
  - O formulário tem pontos, observação e o "Pontos base" de referência.
  - A tabela mostra a observação, quem lançou e quando.
- [x] Os critérios manuais aparecem desde já, todos como "não lançado" com 0.
- [x] Testes do módulo:
  - critério sem lançamento aparece como "não lançado" com 0;
  - ponto lançado entra no total da Frente;
  - pontos com uma casa decimal.
