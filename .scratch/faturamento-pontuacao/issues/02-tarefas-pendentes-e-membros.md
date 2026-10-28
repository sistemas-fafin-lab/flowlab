# 02: Tarefas pendentes, com os membros das Frentes

**What to build:** o critério "Tarefas pendentes" aparece nas duas Frentes. Mostra quantas tarefas do apLIS cada membro deixou abertas no fim do mês. A Frente ganha 1 ponto só se todos os membros estiverem zerados. Os membros de cada Frente passam a existir no FlowLab.

**Blocked by:** 01 (Bloco "Pontuação do setor" com a meta).

**Status:** done

- [x] Tabela de membros das Frentes no Supabase: Frente, id e nome do usuário do apLIS, ativo.
  - Leitura: quem vê Faturamento. Escrita: quem gerencia Faturamento (RLS).
  - Já vem preenchida com:
    - Faturamento: Renata Queiroz Bento (235), Rívia Freire Araujo Barretos Borba (202) e Cleber Kendel de Andrade (256);
    - Recurso de Glosa: Raquel dos Santos Avelino (224) e Maria Eduarda Fonseca Bomfim (173).
- [x] Consulta no backup do apLIS, só para os membros ativos. Uma tarefa conta como aberta no fim do mês quando:
  - é endereçada ao usuário (destinatário = usuário do apLIS) ou ao setor "GLOSA – FATURAMENTO";
  - foi incluída até 23h59 do último dia do mês;
  - não estava concluída até esse momento.
- [x] O critério vale 1 ponto só se todos os membros da Frente tiverem 0 pendências.
  - O detalhe lista as pendências por pessoa.
  - A Raquel conta na frente Recurso de Glosa como qualquer membro.
- [x] Testes do módulo:
  - todos zerados dão 1;
  - um membro com 1 pendência zera a Frente;
  - pendências por pessoa no detalhe;
  - Frente com membro sem nenhuma tarefa.
- [x] Conferido à mão contra setembro/2026. Tarefas recebidas no mês e concluídas até 30/09, levantadas em 27/10/2026:
  - Renata: 1.378 e 1.262;
  - Rívia: 934 e 925;
  - Cleber: 804 e 804.
  As pendências do fim do mês também incluem tarefas abertas de meses anteriores.

**Conferência (27/10/2026):** a consulta repete os números acima. Abertas no fim de set/2026: Renata 116, Rívia 9, Cleber 0, Raquel 149, Maria Eduarda 422 e 42 do setor GLOSA – FATURAMENTO (sem destinatário), que contam nas duas Frentes.

**Pendente:** aplicar a migration `20261027130000_fat_pontuacao_membros.sql` no Supabase antes do deploy. Sem a tabela, o GET da pontuação dá 502.
