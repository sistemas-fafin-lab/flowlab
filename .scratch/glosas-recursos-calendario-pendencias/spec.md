# Glosas e Recursos: Calendário de recursos, Pendências de glosa, Aging e Instância do recurso

Status: done

Continua `.scratch/glosas-recursos-dashboard/spec.md`. Vocabulário do `CONTEXT.md` (Calendário de recursos, Pendências de glosa, Instância do recurso, Glosa da DRE, Calendário de envios).

## Problem Statement

A responsável pelas glosas não tem, numa tela só, **quais lotes ela precisa recorrer e até quando**. O prazo para recorrer de cada convênio está na planilha "Mapa de pagamentos" (coluna RECURSO) e já foi cadastrado no FlowLab como regra "Glosa – Recurso". Mas hoje esse prazo só aparece na sub-aba "Recursos fora de lote", uma lista por requisição, sem visão de calendário e sem um "o que vence hoje".

A gestora do faturamento também não tem, na aba de glosa, a mesma leitura que tem no Contas a Receber:
- os cards de valor (glosado, acatado, recuperado, saldo pendente);
- as pendências;
- o aging;
- o saldo por operadora.

Também não há como saber o que está **atrasado** depois do envio do recurso. A operadora tem um período de análise (coluna ANÁLISE) e um período para pagar (coluna PAGAMENTO 2), e passado esse prazo a responsável precisa cobrar.

Por fim, não dá para acompanhar a evolução por **instância do recurso** (1º, 2º, 3º). O apLIS só tem eventos de 1º recurso (7) e 2º recurso (16). Não existe 3º recurso, nem no catálogo de eventos nem no status do lote de recurso (conferido em 26/11/2026).

## Solution

**Nova aba "Calendário de recursos"** em Glosas e Recursos, no layout do Calendário de envios:
- painéis Hoje / Amanhã / Atrasados e a grade do mês;
- cada item é um lote de faturamento de um convênio com glosas ainda não recorridas, no dia do prazo para recorrer;
- o item sai sozinho quando as requisições entram num lote de recurso enviado;
- os convênios sem prazo cadastrado aparecem numa lista à parte.

**Aba Dashboard de glosa:**
- **Cards de valor:** Valor glosado, Valor acatado, Glosa recuperada e Glosa em disputa substituem os quatro cards por status.
- **Bloco "Pendências de glosa":** três cards (prazo de recurso vencido, retorno atrasado, pagamento atrasado).
- **Aging da glosa em recurso** e **Saldo de glosa por operadora.**
- **Bloco "Recursos por instância":** 1º, 2º e 3º recurso, com evolução de 6 meses.

**Instância do recurso:** vem do apLIS (7 → 1º, 16 → 2º). O lápis no detalhe da requisição permite marcar 1º, 2º ou 3º. O valor marcado prevalece e entra no histórico.

## User Stories

### Calendário de recursos

1. Como responsável pelas glosas, quero uma aba "Calendário de recursos" em Glosas e Recursos, para ver num lugar só o que preciso recorrer e até quando.
2. Como responsável pelas glosas, quero que cada item do calendário seja um lote de faturamento de um convênio com requisições glosadas, com motivo de glosa e ainda sem recurso, para recorrer lote a lote como faço no apLIS.
3. Como responsável pelas glosas, quero que o item caia no dia do prazo para recorrer (data de recebimento + regra "Glosa – Recurso" do convênio), para não precisar contar dias à mão.
4. Como responsável pelas glosas, quero ver em cada item o convênio, o nº do lote de faturamento, o protocolo, a quantidade de requisições e o valor glosado ainda não recorrido, para priorizar os maiores.
5. Como responsável pelas glosas, quero ver em cada item os principais motivos de glosa (código e descrição), para já saber o que vou argumentar.
6. Como responsável pelas glosas, quero um painel "Hoje" com o que vence hoje, para saber o que não pode passar do dia.
7. Como responsável pelas glosas, quero um painel "Amanhã" com o que vence amanhã, para me programar.
8. Como responsável pelas glosas, quero um bloco "Atrasados" com os itens cujo prazo já passou e que continuam sem recurso, para recuperar o que ainda for possível.
9. Como responsável pelas glosas, quero a grade do mês com os itens em cada dia e um navegador de mês, para enxergar a carga das próximas semanas.
10. Como responsável pelas glosas, quero que o item saia do calendário sozinho quando as requisições entrarem num lote de recurso enviado, para não ter que marcar nada à mão.
11. Como responsável pelas glosas, quero que um item com parte das requisições já recorridas continue no calendário só com as que faltam, para ver o que sobrou.
12. Como responsável pelas glosas, quero que requisições do mesmo lote com prazos diferentes apareçam em dias diferentes, para o prazo de cada uma ser respeitado.
13. Como responsável pelas glosas, quero que os lotes de convênios sem regra de recurso (sem prazo ou sem regra cadastrada) apareçam numa lista "Sem prazo cadastrado", com link para a tela de regras, para nada sumir sem aviso.
14. Como responsável pelas glosas, quero clicar num item e ver as requisições dele, com o mesmo detalhe da sub-aba "Recursos fora de lote", para conferir antes de montar o lote de recurso.
15. Como responsável pelas glosas, quero que o filtro de convênio do cabeçalho valha também no calendário, para trabalhar uma operadora por vez.
16. Como responsável pelas glosas, quero que o calendário use as regras que já cadastrei e reflita na hora uma regra alterada, para corrigir o prazo de um convênio e ver o efeito.

### Cards de valor do Dashboard de glosa

17. Como gestora do faturamento, quero um card "Valor glosado" com o percentual do faturado, para saber quanto do faturamento as operadoras glosaram.
18. Como gestora do faturamento, quero um card "Valor acatado" com o percentual do glosado, para saber quanto foi dado como perdido.
19. Como gestora do faturamento, quero um card "Glosa recuperada" com o percentual do glosado, para saber quanto os recursos trouxeram de volta.
20. Como gestora do faturamento, quero um card "Glosa em disputa" com a glosa que ainda está em disputa, para saber quanto ainda pode voltar.
21. Como gestora do faturamento, quero ver em cada card a quantidade de requisições e a variação contra o mês anterior, como nos cards de hoje, para perceber tendências.
22. Como gestora do faturamento, quero que esses cards usem a mesma classificação (recuperada, acatada, em disputa) dos cards de glosa do Contas a Receber, para não ver duas contas diferentes para a mesma coisa.

### Pendências de glosa

23. Como gestora do faturamento, quero um bloco "Pendências de glosa" com seletor de mês e "Todo o período", no layout das Pendências de faturamento, para cobrar a equipe do jeito que já faço com o faturamento.
24. Como gestora do faturamento, quero um card "Glosas sem recurso com prazo vencido", com valor e quantidade, para saber o que corre risco de virar perda.
25. Como gestora do faturamento, quero um card "Recursos com retorno atrasado" (passou do envio + Análise sem retorno), com valor e quantidade de lotes, para saber quais operadoras cobrar pela análise.
26. Como gestora do faturamento, quero um card "Recursos com pagamento atrasado" (passou do envio + Análise + Pagamento sem o valor ter voltado), com valor e quantidade, para saber quais operadoras cobrar pelo pagamento.
27. Como gestora do faturamento, quero clicar num card de pendência e abrir a lista filtrada correspondente, para agir sobre os itens.
28. Como gestora do faturamento, quero que o seletor de mês considere os prazos que venceram naquele mês e "Todo o período" mostre tudo o que está vencido, para separar o atraso novo do acumulado.

### Aging e saldo por operadora

29. Como gestora do faturamento, quero um aging da glosa em recurso nas faixas A vencer, 1–30, 31–60, 61–90 e +90 dias, contadas da data de pagamento prevista do recurso, para ver há quanto tempo o dinheiro está parado.
30. Como gestora do faturamento, quero que cada faixa venha empilhada por operadora, com as menores em "Outras", para ver quem concentra o atraso.
31. Como gestora do faturamento, quero que o saldo sem data de envio ou de convênio sem prazo apareça numa nota "Fora das faixas" com o valor, para o total bater.
32. Como gestora do faturamento, quero um gráfico "Saldo de glosa por operadora" com os 10 maiores saldos pendentes de glosa, para priorizar negociações.
33. Como gestora do faturamento, quero que o aging e o saldo por operadora respeitem o filtro de convênio do cabeçalho, para olhar uma operadora por vez.

### Instância do recurso

34. Como responsável pelas glosas, quero que cada requisição em recurso mostre a instância (1º, 2º ou 3º recurso), para saber em que rodada ela está.
35. Como responsável pelas glosas, quero que a instância venha sozinha do apLIS (1º recurso → 1º, 2º recurso → 2º), para não ter que preencher o que o apLIS já sabe.
36. Como responsável pelas glosas, quero que a instância continue registrada depois que a requisição sai do recurso (paga, não acatada, acatada), para a evolução não perder o histórico.
37. Como responsável pelas glosas, quero um lápis "Instância do recurso" no detalhe da requisição para marcar 1º, 2º ou 3º, porque o apLIS não tem 3º recurso.
38. Como responsável pelas glosas, quero que a instância marcada à mão prevaleça sobre a do apLIS e entre no histórico com usuário e data, como as outras edições.
39. Como responsável pelas glosas, quero um aviso no detalhe quando a instância marcada à mão divergir da que o apLIS indica, para eu conferir.
40. Como usuário só com permissão de ver o faturamento, quero ver a instância sem o lápis, porque só quem gerencia deve alterar.

### Recursos por instância (Dashboard)

41. Como gestora do faturamento, quero três cards (1º, 2º e 3º recurso), com quantidade, valor recorrido e valor recuperado, para ver quanto cada rodada recupera.
42. Como gestora do faturamento, quero um gráfico dos últimos 6 meses com o valor em cada instância, pelo mês do lote de faturamento original, para acompanhar a evolução.

## Implementation Decisions

### Mapeamento da planilha

- Na planilha "Mapa de pagamentos", a coluna B (SITES) desloca as demais uma posição. O "prazo de recurso" é a coluna **RECURSO**, e "envio + G + H" é **ANÁLISE + PAGAMENTO 2**.
- Essas três colunas já são as regras "Glosa – Recurso", "Glosa – Análise" e "Glosa – Pagamento" do cadastro de regras de prazo por convênio (carga inicial do spec anterior).
- **Nada é relido da planilha.** Se a planilha mudar, a responsável corrige as regras na tela.

### Seam de teste

- **Seam único:** o módulo puro de regras de recurso de glosa no servidor, que já recebe "hoje" como parâmetro e já é testado.
  - As regras novas entram nele como funções puras.
  - Handlers e componentes só ligam banco e tela.
- Os cards de valor reaproveitam a classificação de funil que já existe (recuperada / acatada / em disputa) e não ganham conta nova.

### Funções novas no módulo de regras

1. **Itens do calendário:**
   - Entrada: requisições da foto em status 6, com lote de faturamento, fonte pagadora, data de recebimento, glosa fixada e motivos; regras de prazo por convênio; o mês; e hoje.
   - Saída: itens agrupados por **lote de faturamento × data do prazo para recorrer**, cada um com quantidade, valor, motivos e selo (hoje / amanhã / atrasado / futuro), mais a lista "sem prazo".
   - O prazo de cada requisição usa a mesma função de "prazo para recorrer" da sub-aba "Recursos fora de lote".
2. **Pendências de glosa:**
   - Entrada: requisições e lotes da foto, regras, recorte (mês ou todo o período) e hoje.
   - Saída: os três cards (valor e quantidade) e as listas que cada card abre.
3. **Aging da glosa em recurso:** faixas por dias desde a data de pagamento prevista, por operadora, mais o total "fora das faixas".
4. **Saldo de glosa por operadora:** os 10 maiores saldos em disputa.
5. **Instância do recurso:** a instância vigente de uma requisição, a partir da instância observada no apLIS e da edição manual.
6. **Recursos por instância:** cards e meses a partir das requisições com instância.

### Calendário de recursos

- **Universo:** requisições na foto em status 6 (GLOSADO ainda SEM RECURSO), com glosa fixada > 0, com motivo de glosa preenchido e fora de qualquer lote de recurso enviado.
- **Agrupamento:** lote de faturamento original × data do prazo. Um lote com requisições de datas de recebimento diferentes pode aparecer em mais de um dia.
- **Prazo no fim de semana:** a grade e os painéis são de segunda a sexta. Um prazo que cai no sábado ou no domingo é exibido na sexta-feira anterior (a "data de exibição"), com o selo "vence sáb" ou "vence dom". A data real continua guardada e é a que define o atraso.
  - Isso é comum: das requisições em status 6 desde 01/2026, 81% cairiam no fim de semana com a regra de 60 dias corridos, 12% com 30 e 7% com 90 (backup do apLIS, 26/11/2026).
- **Selo (pela data de exibição):**
  - Hoje: data de exibição = hoje.
  - Amanhã: data de exibição = o próximo dia útil (segunda a sexta) depois de hoje.
  - Atrasado: prazo real < hoje.
  - Futuro: o restante.
- **Sem prazo:** convênio sem vínculo com regra, ou regra "Glosa – Recurso" do tipo sem prazo. O item vai para a lista "Sem prazo cadastrado", não para a grade.
- **Saída do calendário:** automática na sincronização (diária ou "Atualizar"), quando a requisição muda de status ou entra num lote de recurso enviado. Não há marcação manual de "recorrido", ao contrário do Agendamento de envio.
- **Dias úteis:** os mesmos do cálculo de prazo atual (segunda a sexta, sem feriados). Os feriados do Calendário de envios não entram aqui.
- **Período do cabeçalho:** não filtra o calendário, que é navegado pelo próprio mês. O filtro de convênio vale.

### Cards de valor (substituem Abertas / Em recurso / Revertidas / Definitivas)

Cada requisição da foto do período é classificada pela mesma função de funil dos cards de glosa do Contas a Receber:

| Card | Valor | Percentual |
|---|---|---|
| Valor glosado | recuperada + acatada + em disputa | do faturado do período |
| Valor acatado | acatada | do glosado |
| Glosa recuperada | recuperada | do glosado |
| Glosa em disputa | em disputa (glosado − recuperada − acatada) | — |

- **Nome do card:** "Glosa em disputa", e não "Saldo pendente". No Contas a Receber, Saldo pendente é o total a receber (faturado − recebido − acatado), e aqui o card mede só a glosa em disputa (decisão de 26/11/2026).
- **Período:** é o mês do lote de faturamento original, o mesmo filtro do resto da tela.
- **Variação:** contra o mês anterior, sobre o valor, como os cards atuais.
- **Faturado do período:** vem da mesma fonte do card do Contas a Receber.
- A distribuição por status e os rankings da aba continuam como estão.

### Pendências de glosa

| Card | Conta | Valor | Quantidade |
|---|---|---|---|
| Glosas sem recurso com prazo vencido | requisição em status 6 com prazo para recorrer < hoje | glosa fixada | requisições |
| Recursos com retorno atrasado | lote enviado, sem data real de retorno e sem classificação final, com data de retorno prevista < hoje (selo "Atrasado" atual) | soma do valor recursado do lote | lotes |
| Recursos com pagamento atrasado | requisição de lote enviado, sem classificação final (nem deferido total, nem indeferido, nem acatada), com data de pagamento prevista < hoje | valor recursado − valor recebido de glosa | requisições |

- **Mês selecionado:** conta o que venceu dentro dele, até hoje. "Todo o período" conta tudo o que está vencido.
- **Abertura dos cards:**
  - o 1º abre a sub-aba "Recursos fora de lote" filtrada em vencidos;
  - o 2º e o 3º abrem a lista de "Lotes de recurso" filtrada pelo atraso correspondente.
- O mesmo cálculo de prazo vale para todas as instâncias. Recurso sem data de envio não entra no 2º nem no 3º card.

### Aging da glosa em recurso

- **Universo:** requisições de lote de recurso enviado, sem classificação final.
- **Valor:** recursado − recebido de glosa.
- **Faixa:** dias de hoje − data de pagamento prevista. Data não alcançada = "A vencer".
- **Fora das faixas:** requisição sem data de envio ou de convênio sem regra de Análise ou de Pagamento. O valor aparece numa nota acima do gráfico.
  - Convênio sem regra de Análise (sem vínculo ou "sem prazo") fica fora **mesmo com data real de retorno**, ainda que os prazos por requisição deem uma data de pagamento a partir dela (decisão de 26/11/2026). A lista de Lotes de recurso e o card de pagamento atrasado continuam usando essa data.
- **Visual:** empilhado por operadora, com as 7 maiores e "Outras", no padrão do aging do Contas a Receber. O recorte é próprio: não copia as exclusões do aging de títulos.

### Saldo de glosa por operadora

- Soma do "em disputa" (a mesma classe do card Glosa em disputa) por fonte pagadora, com os 10 maiores, em barra horizontal, no padrão do Saldo por operadora do Contas a Receber.

### Instância do recurso

- **Na foto da requisição:**
  - **Instância observada:** a maior instância já vista no apLIS (status 7 → 1, status 16 → 2). Gravada na sincronização e **nunca diminui**, para continuar valendo depois que a requisição vai para 34, 15, 18 etc. Na primeira sincronização deste campo, quem está em 7 ganha 1, quem está em 16 ganha 2 e os demais ficam vazios.
  - **Instância editada:** campo novo nas edições manuais por requisição (valores 1, 2 ou 3), com usuário e data. O tipo de edição "instância" entra no histórico, com valor anterior e novo.
- **Instância vigente:** a editada, se houver; senão a observada; senão vazia.
- **Aviso de divergência:** existe edição e ela é diferente da observada (ex.: marcada 3, apLIS ainda em 7).
- **Permissões:** o lápis aparece só para quem tem permissão de gerenciar o faturamento. A gravação segue o RLS das edições manuais atuais.

### Recursos por instância (Dashboard)

- **Universo:** requisições com instância vigente preenchida, no mês do lote de faturamento original.
- **Cards por instância:**
  - quantidade;
  - valor recorrido (valor recursado, editado ou do apLIS);
  - valor recuperado (a mesma regra de "recuperada" do funil).
- **Gráfico:** valor recorrido por instância nos 6 meses até o período filtrado.
- **Limitação:** a instância atribui todo o recurso de uma requisição à instância vigente. O valor recorrido no 1º recurso de uma requisição que chegou ao 2º não é separado.

### Leitura (endpoints)

- **Calendário de recursos:** mês e fonte pagadora → itens, a lista sem prazo, e os painéis de hoje, amanhã e atrasados.
- **Dashboard de glosa:** o endpoint atual passa a trazer os cards de valor, as pendências (com o recorte), o aging, o saldo por operadora e os recursos por instância. Podem virar endpoints separados se o tempo de resposta pedir.
- **Edição manual:** o endpoint de edições por requisição aceita o campo "instância".

### Telas

- **Aba "Calendário de recursos":** quarta aba de Glosas e Recursos, reaproveitando os componentes de layout do Calendário de envios (painéis, grade do mês e bloco de atrasados) quando couberem. Funciona nos temas claro e escuro.
- **Dashboard:** os cards novos no lugar dos antigos. Abaixo deles, nesta ordem:
  1. Pendências de glosa;
  2. Aging e Saldo por operadora, lado a lado;
  3. Recursos por instância;
  4. os gráficos que já existem.

## Testing Decisions

- **O que é um bom teste:** olha só entradas e saídas das funções puras do módulo de regras de recurso de glosa (requisições, lotes, regras, mês, hoje). Não olha a ordem de laços nem funções auxiliares. As datas são fixas no teste, nunca o relógio.
- **O que tem teste:** só o módulo de domínio. Handlers, hooks e componentes ficam sem teste, como no spec anterior.
- **Calendário:**
  - agrupamento por lote e prazo;
  - lote com dois prazos;
  - selos hoje, amanhã, atrasado e futuro;
  - virada de mês;
  - convênio sem regra e regra sem prazo vão para a lista sem prazo;
  - requisição em lote de recurso enviado sai;
  - requisição sem motivo de glosa ou com glosa 0 não entra.
- **Pendências:**
  - cada card no mês e em todo o período;
  - lote com data real de retorno não conta como retorno atrasado;
  - requisição deferida total, indeferida ou acatada não conta como pagamento atrasado;
  - recurso sem data de envio fica fora.
- **Aging:**
  - limites de cada faixa (0, 30, 31, 60, 61, 90, 91);
  - "A vencer";
  - "Fora das faixas" sem envio e sem regra;
  - agrupamento em "Outras".
- **Cards de valor:**
  - a soma bate com a classificação do funil;
  - percentuais com faturado zero e com glosado zero.
- **Instância:**
  - a observada só cresce;
  - a editada vence;
  - o aviso de divergência;
  - requisição sem instância.
- **Exemplos a seguir:** os testes atuais do módulo de regras de recurso de glosa e de glosa recuperada no servidor, os do Calendário de envios e os de cards de glosa/saldo no front. Todos usam vitest com funções puras.

## Out of Scope

- Ler a planilha "Mapa de pagamentos" de novo ou importá-la. As regras são as do cadastro.
- Prazo do próximo recurso (2º/3º) no calendário: indeferido ou deferido parcial voltando a ser recorrido. Depende de uma data real de retorno confiável. Fica para uma entrega futura.
- Separar o valor recorrido por instância dentro de uma mesma requisição.
- Feriados no cálculo de prazos de glosa.
- Gravar qualquer coisa no apLIS (instância, status, lotes).
- Marcar à mão um item do calendário como "recorrido".
- Contador no menu ou alerta por e-mail dos prazos de recurso.
- Pedir ao suporte do apLIS um evento de 3º recurso (pode ser feito à parte; se existir, a instância observada passa a lê-lo).

## Further Notes

- **Fatos levantados em 26/11/2026:**
  - **Eventos ativos de recurso no apLIS:** 6 (sem recurso, 3.069 requisições), 7 (1º recurso, 3.291), 16 (2º recurso, 143) e 15 (não acatado, 294). Não há 3º recurso. O evento 17 está inativo no apLIS, mas ainda tem 36 requisições.
  - **Status do lote de recurso:** inclui "2° Recurso" (código 5, 3 lotes). Não existe 3º.
  - **2º recurso e lotes:** das 143 requisições em 2º recurso, só 77 estão em algum lote de recurso. O 2º recurso em geral não ganha lote novo. Por isso não se deriva a instância de "estar em 2 lotes" (35 requisições estão em 2+ lotes, quase sempre por lote refeito).
  - **Data de recebimento:** é o maior `DtaRecebido` dos procedimentos da requisição, já gravado na foto. É a base do prazo para recorrer.
- **Regras com "sem prazo" na carga inicial:**
  - Recurso: AMHP, AMPLA, SELECT, STM.
  - Análise: BRB, CASSI, PLAN ASSISTE, TST.
  - Pagamento: INAS, PMDF, STJ, TST, entre outros.
  - Esses convênios aparecem na lista "Sem prazo cadastrado" ou em "Fora das faixas" até a responsável completar as regras.
- **Para revisar na implementação:** o "faturado do período" do card Valor glosado. No Contas a Receber o período é o de emissão do título; aqui é o mês do lote original. Se a fonte não permitir esse recorte, usar o faturado dos lotes do mês e registrar a decisão na issue.
