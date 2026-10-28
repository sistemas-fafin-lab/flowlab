# 06: Fechar e reabrir a pontuação

**What to build:** quem gerencia Faturamento clica em "Fechar pontuação". O mês fica congelado: fatos, membros, lançamentos e pontos. Depois disso a página sempre mostra os números congelados, com o selo "Fechado em dd/mm por fulano". "Reabrir" volta para a prévia ao vivo e registra quem reabriu.

**Blocked by:** 02 (Tarefas pendentes, com os membros das Frentes), 05 (Lançamentos manuais).

**Status:** done (28/Out/2026; migration `20261027160000` em produção); falta a conferência manual de fechar e reabrir um mês

- [x] Tabela de fechamentos no Supabase: ano e mês (únicos enquanto em vigor), o resumo inteiro em JSON, o "dados até" usado, quem fechou e quando.
  - Reabrir tira o fechamento de vigor e guarda quem reabriu e quando. Um mês pode ser fechado de novo depois.
  - Leitura: quem vê Faturamento. Escrita: quem gerencia Faturamento (RLS).
- [x] Fechar recalcula a prévia no servidor e grava esse resultado. O que a tela mostrava não é usado.
  - O fechamento é recusado (409, mensagem clara) quando o "dados até" do backup do apLIS ainda não chegou ao último dia do mês.
- [x] O GET de mês fechado devolve o resumo congelado, sem consultar o apLIS, e mostra quem fechou e quando.
- [x] Mês fechado não aceita lançamento manual: o banco recusa, e o handler devolve 409.
  - Ao reabrir, os lançamentos continuam lá.
- [x] O fechamento guarda os membros daquele mês. Mudar a lista depois não altera meses fechados.
- [x] Na tela: "Fechar pontuação" e "Reabrir" só para quem gerencia Faturamento, com confirmação.
- [ ] Conferido à mão:
  - fechar, mudar um lançamento direto no banco e ver que é recusado;
  - reabrir e ver a prévia ao vivo de novo.

**Implementado (commit 2e7fb63):** migration `20261027160000_fat_pontuacao_fechamentos.sql` (índice único parcial dos fechamentos em vigor, trigger que recusa lançamento em mês fechado com SQLSTATE PT409 → HTTP 409), POST `acao: fechar|reabrir` e GET de mês fechado servindo o resumo congelado (pontos, fatos, membros e lançamentos). Falta a conferência à mão.
