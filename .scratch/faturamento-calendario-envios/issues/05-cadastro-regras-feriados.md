# 05: Cadastro de Regras de envio e feriados

**What to build:** quem tem `canManageCalendarioEnvios` abre "Regras de envio" no Calendário e cria, edita ou desativa a regra de cada convênio: uma ou mais janelas (faixa de dias corridos, faixa de dias úteis, dias fixos, último dia útil, todos os dias, calendário do convênio), observação, convênios membros, fontes pagadoras do apLIS e, nos "todos os dias", os "envios sugeridos no mês" (opcional). Também mantém a lista de feriados (data, descrição, nacional/DF). Uma regra desativada sai das próximas sugestões mas mantém o histórico.

**Blocked by:** 02 (Calendário com Hoje/Amanhã e marcação de envio).

**Status:** done

- [x] CRUD de regras na API, validando as janelas (de ≤ ate, dias entre 1 e 31, dias úteis entre 1 e 23, ao menos uma janela).
- [x] Descrição legível de cada janela ("1º ao 5º dia útil", "Dias 3 e 16", "Último dia útil"), com teste no estilo do teste de regra de prazo.
- [x] Modal de regras: lista com busca, edição com várias janelas, observação, membros, fontes pagadoras (seleção de fonte pagadora do apLIS), envios sugeridos no mês, ativo.
- [x] CRUD de feriados e modal de feriados; mudar feriado reflete na grade e no cálculo de dia útil.
- [x] Toda alteração registra quem e quando.
