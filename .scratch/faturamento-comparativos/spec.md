# Faturamento: Pendências corrigidas, Saldo por operadora e aba Comparativos

Status: ready-for-agent

## Problem Statement

A gestora do Faturamento usa o Dashboard do Contas a Receber para decidir onde corrigir processo, mas hoje ele engana e não responde às perguntas dela:

- O card **"Requisições não faturadas"** (R$ 93.939,56, "41 lotes sem NF/RPS") mostra na verdade **lotes sem nota fiscal**. Requisição não faturada é a que **não tem lote**; a lista disso existe na aba Pendências, mas o Dashboard não a usa. A informação de lotes sem NF também importa, mas deve ter card próprio.
- O gráfico **"Saldo por operadora"** não tem filtro próprio e ela não sabe de onde vem o valor nem se cada operadora deve mesmo aquilo. O valor vem do Supabase (`notas.valor_saldo` = total − recebido − glosa acatada), por carteira inteira, sem recorte de período. As baixas do apLIS são confirmadas à mão, sem rotina automática, e o saldo do sistema fica abaixo do apLIS (conferido em 06/11/2026: BRADESCO −R$ 45,9 mil, PMDF −R$ 12,9 mil, AMHP-DF −R$ 33,2 mil).
- Ela não vê **por mês** quanto foi faturado, recebido, glosado, recuperado, acatado e quanto ficou pendente, nem o **código de glosa que mais foi acatado**, nem **quais requisições** estão por trás da glosa para decidir entre estratégia melhor ou rever contrato com o convênio.
- Não há indicador de **quanto tempo leva** para faturar uma requisição (por convênio) nem de **quanto o convênio demora para pagar**, nem a **conversão** entre requisições cadastradas aptas a faturar e as realmente faturadas.
- Não há comparativo de **3 meses**; o que existe (componente "Custo direto") compara só o mês com o anterior e é de outro assunto.
- (Rodada de 12/11/2026) No **volume de envio por convênio**, as barras são verticais e os nomes ficam inclinados e difíceis de ler. Além disso, só se compara guias e lotes, não o valor enviado em R$. A gestora quer o mesmo visual de barras horizontais do Explorador do Painel de Indicadores.
- (Rodada de 12/11/2026) Os cards de valor do Dashboard mostram Faturado, Recebido, Glosado e Acatado, mas não mostram **quanto da glosa foi recuperado** nem **quanto ainda falta receber** no mês que ela está olhando.

## Solution

1. **Dashboard**: três cards de pendência (Requisições não faturadas = sem lote; Particulares sem NF; Lotes sem nota fiscal), cada um levando à sub-aba correspondente de Pendências.
2. **Saldo por operadora**: passa a obedecer aos filtros do Dashboard, ganha o alternador "Carteira total / Só emitidas no período", explica a fórmula e a data da última baixa importada, e mostra o **saldo no apLIS ao lado do saldo no sistema**, com a diferença sinalizada.
3. **Nova aba "Comparativos"** no Contas a Receber, com seletor de mês de referência e 3 colunas (referência, M-1, M-2):
   - **Funil**: Faturado → Recebido → Glosa total (= recuperada + acatada + em disputa), saldo pendente à parte; tudo por competência (mês de emissão).
   - **Ranking de códigos de glosa** com alternador Total | Acatada (padrão Acatada); clicar num código abre a **tabela de requisições** (sem nome de paciente, com CSV).
   - **Vínculo com lote**: glosa, acatada e saldo atribuídos ao lote; glosas sem lote entram como "Fora de lote".
   - **SLA por convênio**: cadastro → envio ao faturamento → recebido no faturamento → faturado; mais **tempo médio de liquidação** (faturado → recebido) com "% já recebido".
   - **Volume de envio** por convênio em **barras horizontais agrupadas** (3 meses por convênio, os 15 maiores), com o alternador Guias | Lotes | **Valor (R$)**, e uma tabela com todos os convênios.
   - **Conversão de requisições** (aptas × faturadas, % e "aptas sem lote"): totais por mês, gráfico horizontal com o % de conversão por convênio e tabela.
   - A **matriz** faturado × glosado × recebido por convênio foi adiada (ver Out of Scope).
4. **Dashboard, cards de valor**: dois cards novos ao lado dos atuais. **Glosa recuperada** mostra "% do glosado" e **Saldo pendente** mostra "Total a receber"; os dois obedecem ao período e à operadora.

## User Stories

1. Como gestora do Faturamento, quero que "Requisições não faturadas" conte só requisições sem lote, para que o número represente trabalho ainda não feito.
2. Como gestora, quero um card separado de "Lotes sem nota fiscal", para não perder a visão de lotes aguardando NF.
3. Como gestora, quero manter o card "Particulares sem NF", para ver os três tipos de pendência lado a lado.
4. Como gestora, quero que os três cards respondam ao mesmo seletor de mês, para comparar a mesma competência.
5. Como gestora, quero clicar num card e cair na sub-aba correspondente de Pendências, para agir sobre a lista.
6. Como gestora, quero ver o valor de cada card ao lado da quantidade (requisições ou lotes), para dimensionar o esforço.
7. Como gestora, quero filtrar o Saldo por operadora pelos filtros do Dashboard (período, operadora, lote, nota), para olhar um recorte.
8. Como gestora, quero alternar entre "Carteira total" e "Só emitidas no período", para separar dívida antiga de recente.
9. Como gestora, quero ver a fórmula do saldo (Total − Recebido − Glosa acatada), para entender de onde vem o número.
10. Como gestora, quero ver a data da última baixa importada do apLIS, para saber se o saldo está atualizado.
11. Como gestora, quero ver o saldo no apLIS ao lado do saldo no sistema por operadora, com a diferença, para saber onde falta importar baixa ou criar título.
12. Como gestora, quero saber se cada operadora realmente deve o valor mostrado, para cobrar com segurança.
13. Como gestora, quero uma aba "Comparativos" no Contas a Receber, para concentrar a análise de glosa e eficiência.
14. Como gestora, quero escolher o mês de referência e ver os 2 meses anteriores lado a lado, para enxergar tendência.
15. Como gestora, quero o padrão do seletor ser o último mês fechado, para não olhar um mês incompleto sem querer.
16. Como gestora, quero o funil Faturado → Recebido → Glosa total → (Recuperada, Acatada, Em disputa) → Saldo pendente, para ver para onde vai o dinheiro.
17. Como gestora, quero ver Glosa recuperada e Saldo pendente do mês, para acompanhar o que foi reavido e o que falta receber.
18. Como gestora, quero que o funil feche (Faturado = Recebido + Acatada + Em disputa + Saldo), para confiar nos números.
19. Como gestora, quero que a Recuperada apareça como detalhe do Recebido, sem somar duas vezes.
20. Como gestora, quero ver o "recebido no mês" (caixa) ao lado do funil por competência, para não confundir as duas visões.
21. Como gestora, quero ver o ranking de códigos de glosa por valor acatado, com descrição, quantidade e % do total acatado, para achar o gargalo de processo.
22. Como gestora, quero alternar o ranking entre Total e Acatada, para comparar o que é glosado com o que é aceito.
23. Como gestora, quero clicar num código e ver as requisições por trás dele, para conferir uma a uma.
24. Como gestora, quero nessa tabela requisição, guia, lote, convênio, procedimento, valor glosado, status e data, para decidir entre estratégia melhor ou revisão de contrato.
25. Como gestora, quero exportar essa tabela em CSV, para levar à reunião com o convênio.
26. Como gestora, quero que a tabela não mostre nome de paciente, para não expor dado pessoal além do necessário.
27. Como gestora, quero ver glosa, acatada e saldo vinculados ao lote, para rastrear a origem.
28. Como gestora, quero que glosas sem lote apareçam como "Fora de lote" nos totais, para o total bater com a tela Glosas e Recursos.
29. Como gestora, quero o tempo médio entre cadastro e envio ao faturamento por convênio, para saber se o cadastro demora.
30. Como gestora, quero o tempo médio entre envio e recebimento no faturamento por convênio, para achar atraso no trânsito de guias.
31. Como gestora, quero o tempo médio entre recebido no faturamento e faturado por convênio, para medir o meu próprio setor.
32. Como gestora, quero ver de qual fonte vem cada marco (sempre o apLIS), para saber a confiabilidade.
33. Como gestora, quero o tempo médio de liquidação por convênio, para prever fluxo de caixa.
34. Como gestora, quero ver junto o "% já recebido", para a média não parecer melhor do que é.
35. Como gestora, quero a matriz faturado × glosado × recebido por convênio nos 3 meses, para dizer "em setembro faturei X, glosei Y".
36. Como gestora, quero o comparativo do volume de lotes/guias enviados por convênio, para ver mudança de comportamento.
37. Como gestora, quero ver quantas requisições aptas a faturar foram cadastradas e quantas foram faturadas, com % de conversão, para achar perda.
38. Como gestora, quero ver "aptas ainda sem lote", para priorizar o que falta faturar.
39. Como gestora, quero que requisições de particular e cortesia fiquem fora das aptas, para a conversão refletir convênios.
40. Como gestora, quero que lotes cancelados ou em prejuízo não contem como faturada, para não inflar a conversão.
41. Como coordenação, quero a aba Comparativos protegida pela permissão por tela, para controlar quem vê.
42. Como gestora, quero que todos os números sejam reproduzíveis (mesma regra no Dashboard e nos Comparativos), para não ter duas verdades.
43. Como gestora, quero que uma falha do apLIS mostre aviso com "Tentar novamente" e não uma tela quebrada, para continuar trabalhando.

Rodada de 12/11/2026:

44. Como gestora, quero o volume de envio em barras horizontais, para ler o nome inteiro de cada convênio sem inclinar a cabeça.
45. Como gestora, quero ver os 3 meses lado a lado em cada convênio, com cores consistentes entre os blocos, para comparar a tendência de cada um.
46. Como gestora, quero que o gráfico mostre os 15 convênios de maior volume no mês de referência, para focar no que pesa.
47. Como gestora, quero que a ordem dos convênios acompanhe a medida escolhida, para o ranking fazer sentido em Guias, Lotes ou Valor.
48. Como gestora, quero alternar o volume de envio entre Guias, Lotes e Valor (R$), para comparar convênios também pelo dinheiro enviado.
49. Como gestora, quero que o Valor enviado bata com o valor do lote no apLIS, para conferir sem desconfiar do número.
50. Como gestora, quero a tabela de volume com Lotes, Guias e Valor por mês e todos os convênios, para ver também os que ficaram fora do gráfico.
51. Como gestora, quero que o gráfico aumente de altura conforme o número de convênios, para os nomes não se sobreporem.
52. Como gestora, quero ver por mês quantas requisições aptas a faturar foram cadastradas, quantas foram faturadas, o % de conversão e quantas aptas ainda estão sem lote, para medir a perda do mês.
53. Como gestora, quero o % de conversão de cada convênio nos 3 meses em barras horizontais, para achar o convênio onde a conversão caiu.
54. Como gestora, quero que o gráfico de conversão mostre os 15 convênios com mais aptas no mês de referência, para focar no que tem volume.
55. Como gestora, quero uma tabela de conversão com todos os convênios e aptas, faturadas, % e aptas sem lote em cada mês, para levar a lista ao time.
56. Como gestora, quero que o mês da requisição seja o da data de solicitação, como nas Pendências, para os números baterem entre as telas.
57. Como gestora, quero que uma requisição conte como faturada se estiver em lote hoje, mesmo que o lote seja de um mês posterior, para a conversão refletir o que já foi feito.
58. Como gestora, quero que um convênio sem aptas no mês apareça com "—" e não com 0%, para não confundir ausência com perda total.
59. Como gestora, quero um card "Glosa recuperada" no Dashboard com "% do glosado", para acompanhar o que foi reavido sem trocar de aba.
60. Como gestora, quero que a Glosa recuperada do card seja a mesma do funil da aba Comparativos, para não ter duas verdades.
61. Como gestora, quero uma dica no card avisando que a regra da Glosa recuperada ainda é provisória, para não tomar decisão sobre um número sem confirmação.
62. Como gestora, quero um card "Saldo pendente" no Dashboard com "Total a receber", para ver quanto falta entrar no período.
63. Como gestora, quero que o Saldo pendente seja Faturado − Recebido − Acatado, a mesma regra do Saldo por operadora, para o total bater com o gráfico.
64. Como gestora, quero que os dois cards novos obedeçam ao período e à operadora escolhidos, para olhar o mês que preciso ver.
65. Como gestora, quero ser avisada no card quando os filtros de lote e nota não se aplicam, para não achar que o número está filtrado.
66. Como gestora, quero os 6 cards de valor na mesma fileira em telas largas, para ler a decomposição do faturado de uma vez.

## Implementation Decisions

- **Regra única de pendências**: o Dashboard passa a consumir as três listas de Pendências já existentes (sem lote, particulares, lotes sem NF/RPS) como fonte dos cards. As regras de cada lista não mudam. "Requisição não faturada" = requisição de convênio cobrável, sem lote e sem RPS ativo, até M-1; o seletor de mês continua recortando a data de solicitação.
- **Saldo por operadora**:
  - Fonte continua o Supabase (títulos − baixas − glosa acatada), com os filtros do Dashboard já aceitos pela consulta de agregação.
  - Novo parâmetro para limitar o saldo a títulos emitidos no período (padrão: carteira total).
  - Metadado de "última baixa importada".
  - Comparativo com o apLIS: saldo por fonte pagadora calculado no apLIS (valor líquido − recebido) em lotes comparáveis ao universo dos títulos do sistema. A diferença é informativa; **não** corrige o saldo nem dá baixa automática.
- **Competência**: todo o funil e os KPIs do mês usam o mês de emissão do título/lote. O "recebido no mês" por caixa continua no card existente.
- **Definições de glosa**:
  - Acatada = status do apLIS 18 ("Recebido a menor – acatado") e 8 ("Glosa definitiva – acatada diretoria"), os mesmos que já abatem o saldo.
  - Recuperada = glosa que entrou em recurso e depois teve valor recebido, calculada a partir da foto de recursos do apLIS. O mapeamento exato de status é entregue **para a usuária confirmar** antes de ir para produção. A tabela `glosas` do Supabase não serve: não tem registros `revertida` e a glosa vinda do apLIS nunca grava esse status.
  - Em disputa = glosa aberta ou em recurso.
  - Recuperada está dentro de Recebido (detalhe), não somada.
- **Vínculo com lote**: o lote da glosa vem do vínculo existente (98% preenchido); sem lote vira "Fora de lote".
- **Requisições por código de glosa**: a lista vem da foto de recursos e/ou dos demonstrativos do apLIS, porque `glosas.requisicao_id` está quase vazio (6 de 522). Colunas: requisição, guia, lote, convênio, procedimento, valor glosado, status, data. Sem nome de paciente. Exportação CSV.
- **Ranking de códigos**: dois modos, Total e Acatada; padrão Acatada; mostra código, descrição, valor, quantidade, % do total.
- **SLA** (por convênio, média de dias; mediana como apoio quando útil):
  - Cadastro = evento "Admissão" do histórico da requisição, com a data de solicitação como fallback.
  - Envio ao faturamento = primeira tarefa tipo 34 ("Envio de autorização") da requisição. **A usuária ainda precisa confirmar que 34 é o envio.**
  - Recebido no faturamento = primeira tarefa tipo 37 ou 44 (regra já usada no módulo).
  - Faturado = data de fechamento do lote, com a de criação como fallback; envio ao convênio **não** é usado (13% dos lotes não têm).
  - Intervalos negativos ou fora de ordem (ex.: recebimento antes do envio) são descartados da média e contados à parte.
  - Cada marco indica a fonte (sempre o apLIS; a bipagem no Flow foi descartada, ver issue 08).
  - Requisições faturadas sem tarefa de recebido (37/44) ou de envio (34) aparecem numa lista no próprio bloco (issue 13), para cobrar o lançamento no apLIS.
- **Tempo médio de liquidação**: faturado → data de recebimento, só para requisições já recebidas; acompanhado de "% já recebido".
- **Conversão**: apta = requisição cujo **mês da data de solicitação** é o mês da coluna, de convênio cobrável (fora Particular e Cortesia, evento cobrável, com procedimento). Faturada = apta que **hoje** está em lote com status diferente de cancelado e prejuízo, mesmo que o lote seja de mês posterior. Aptas sem lote = aptas − faturadas; num mês fechado, bate com a sub-aba "Sem lote". Sem prazo de "perda de janela" por convênio. Na tela: totais por mês, gráfico horizontal com o % de conversão dos 15 convênios com mais aptas no mês de referência, e tabela completa. O % de um convênio sem aptas aparece como "—".
- **Volume de envio (rodada de 12/11)**: barras horizontais agrupadas (convênio no eixo vertical, 3 meses por convênio). Mostra os 15 maiores pela medida selecionada no mês de referência, e a altura acompanha o número de convênios. Nova medida **Valor** = soma do valor líquido dos procedimentos das requisições do lote, a mesma regra do valor do lote no apLIS, no mesmo universo de lotes (data de criação, mesmos status). A rota de volume passa a devolver o valor por convênio e mês, e a tabela ganha a coluna Valor.
- **Padrão visual dos gráficos por convênio**: barras horizontais agrupadas, no estilo do Explorador do Painel de Indicadores. Volume e conversão usam o mesmo componente visual.
- **Cards de valor do Dashboard (rodada de 12/11)**:
  - **Glosa recuperada** usa a mesma regra de mapeamento de status do funil e mostra "% do glosado". Enquanto a usuária não confirmar a regra, o card mostra uma dica dizendo que ela é provisória.
  - **Saldo pendente** = Faturado − Recebido − Acatado, a mesma regra do Saldo por operadora. O mockup da usuária usava Faturado − Recebido; essa conta foi descartada.
  - Os dois obedecem ao período e à operadora e ignoram lote e nota, porque a Recuperada vem da foto de recursos do apLIS. A dica do card explica isso.
  - A fileira passa a ter 6 cards em telas largas; os layouts salvos continuam válidos.
- **Aba Comparativos**: nova aba do Contas a Receber, com permissão por tela na estrutura existente (ADR 0001). Seletor de mês único; 3 colunas fixas (referência, M-1, M-2). Padrão: último mês fechado. Gráficos de barras agrupadas por convênio mais tabela de detalhe, no visual do módulo.
- **Contratos de API**: cada bloco tem uma rota de leitura própria com parâmetros de mês e filtros; falha do apLIS devolve resposta de indisponibilidade (não 500), como nas demais rotas de Pendências.
- **Dados que não existem hoje**: nada é gravado novo nesta entrega; tudo é leitura do apLIS e do Supabase.

## Testing Decisions

- **Bom teste**: observa só comportamento visto de fora (dada a entrada, qual valor ou resposta sai). Não testa como a consulta é montada nem estado interno de componentes.
- **Seam (confirmado pelo usuário em 06/11/2026)**: o mais alto possível e, de preferência, um só: **funções puras de cálculo** em cima de linhas já lidas (funil, SLA, liquidação, conversão, ranking, vínculo com lote, comparação com o apLIS), com dados montados à mão. As rotas ganham testes de contrato (permissão, parâmetro inválido = 400, formato da resposta, apLIS fora do ar). Consultas SQL não são testadas isoladamente.
- **Casos essenciais**:
  - Funil fecha (Faturado = Recebido + Acatada + Em disputa + Saldo) e Recuperada não é somada duas vezes.
  - Competência: título emitido em outro mês não entra.
  - Glosa sem lote entra como "Fora de lote".
  - SLA: fallbacks de cadastro e de faturado, intervalo negativo descartado e contado, convênio sem dados.
  - Liquidação considera só requisições recebidas e informa o % recebido.
  - Conversão exclui particular, cortesia, lote cancelado e prejuízo.
  - Virada de ano no seletor de 3 meses.
  - Ranking Acatada × Total e arredondamento em centavos.
  - (12/11) Conversão: data de solicitação define o mês; lote de mês posterior conta como faturada; exclusões; convênio sem aptas = "—".
  - (12/11) Volume: o valor por convênio e mês soma o valor líquido dos lotes do universo; os 15 maiores seguem a medida.
  - (12/11) Cards: Recuperada igual à do funil no mesmo recorte; Saldo pendente = Faturado − Recebido − Acatado.
- **Prior art**: `indicadoresFaturamento.test.ts`, `pontuacaoSetor.test.ts`, `baixasAplis.test.ts` (funções puras); `faturamento-pendencias-particulares.test.ts` (rotas).

## Out of Scope

- **Bipagem e protocolo de guias no Flow**: descartados no grilling de 12/11/2026 (issue 08, `wontfix`). O envio e o recebido já são registrados nas tarefas 34 e 37/44 do apLIS; a falta de marco (28% sem recebido) é esquecimento de lançar, tratado pela lista da issue 13.
- Baixa automática do apLIS por cron.
- Corrigir ou recalcular o saldo; só se mostra a divergência.
- Prazo de "perda de janela" por convênio.
- Nome de paciente nas tabelas.
- Alterar o componente "Custo direto" do Marcos.
- Gravar dados novos ou mudar o schema do Supabase.
- (12/11) **Matriz** faturado × glosado × recebido por convênio: adiada, porque não fez parte do pedido atual. Confirmar com a usuária antes de fazer.
- (12/11) Filtros de lote e de nota nos cards Glosa recuperada e Saldo pendente.

## Further Notes

- **Perguntas abertas para a usuária** (viram `needs-info` até resposta; não bloqueiam o resto):
  1. A tarefa tipo 34 é o envio de guias ao faturamento?
  2. O mapeamento de status do apLIS para "Glosa recuperada" está correto?
  3. Qual o prazo de janela de faturamento por convênio (para uma futura "perda de janela")?
- Cobertura dos dados de 01/08 a 31/10/2026 (12.799 requisições): admissão no histórico 96%; recebido no faturamento 72%; lote com data de fechamento 96%; `DtaAutorizacao` só 1,75% (descartada como marco).
- Resposta sugerida à usuária sobre o saldo: o valor é a carteira de títulos do sistema menos baixas e glosa acatada. Hoje está R$ 12 a 46 mil abaixo do apLIS nas 3 maiores operadoras porque as baixas são importadas manualmente; a nova comparação lado a lado mostra isso.
- Rodada de 12/11/2026: o pedido veio com duas imagens. Uma era o Explorador com barras horizontais e a outra um mockup dos 6 cards de valor. As imagens citadas "do Marcos" e "feita por IA" não chegaram, e a rodada seguiu sem elas. A regra da Glosa recuperada continua aberta e agora afeta também o card do Dashboard.
- Vocabulário do domínio: usar **Pendências**, **Contas a Receber**, **Calendário de envios**, **Regra de envio**; não usar "envio" para o lote enviado no apLIS nem "tarefa" para Agendamento de envio.
