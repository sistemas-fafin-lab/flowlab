# Faturamento: Indicadores (exames, convênios e clínicas mais faturados)

Status: ready-for-agent

## Problem Statement

O setor de faturamento não consegue responder, sem montar planilha, três perguntas simples sobre qualquer mês (ou período) que precisar olhar:

- quais **exames** foram mais faturados;
- quais **convênios** (fontes pagadoras) mais faturaram;
- de quais **clínicas** (Local de Origem) veio o maior volume de requisições faturadas.

Hoje a aba Faturas lista lotes e as requisições de cada lote. É possível chegar nesses números abrindo lote por lote, mas o usuário não quer lotes nem requisições: quer só os números, num painel parecido com o Dashboard de Glosas e Recursos.

## Solution

Uma página nova no Faturamento, **"Indicadores de Faturamento"**, ao lado de Faturas, Recebimentos e Glosas.

**Cabeçalho**

- **Período** com dois modos:
  - **Mês**: seletor de um mês, que já vem com o mês anterior;
  - **Período**: datas de início e fim livres.
- **Botão R$ / Qtd**: um botão só, que troca a métrica dos três rankings ao mesmo tempo.
- **Aviso "dados até dd/mm hh:mm"**, como nas outras telas que leem o banco de backup do laboratório.

**Cards** (não mudam com o botão R$/Qtd)

- Total faturado (R$).
- Nº de requisições faturadas.
- Nº de exames faturados.

Cada card mostra a variação sobre o período anterior. No modo Mês, o período anterior é o mês anterior. No modo Período, é o período imediatamente anterior, de mesmo tamanho.

**Três rankings Top 10**, em barras horizontais no visual do Dashboard de Glosas:

1. **Exames mais faturados**
2. **Convênios que mais faturaram**
3. **Clínicas com mais requisições faturadas**

Cada ranking é ordenado pela métrica escolhida no botão (R$ ou Qtd) e mostra a outra métrica no tooltip. O ranking de exames tem uma nota curta: "Particular entra no mês em que o lote mensal é criado".

## User Stories

### Página e navegação

1. Como usuário do faturamento, quero um item "Indicadores" no menu do Faturamento, para chegar ao painel sem passar por Faturas.
2. Como usuário do faturamento, quero que a página use a mesma permissão de visualização do Faturamento, para não depender de uma liberação nova.
3. Como usuário sem permissão de faturamento, quero não ver o item nem acessar a página, para que os números de faturamento fiquem restritos.
4. Como usuário do faturamento, quero que a página siga o tema claro e escuro do FlowLab, para que ela tenha a mesma cara das outras telas.
5. Como usuário do faturamento, quero ver um esqueleto enquanto os números carregam, para saber que a página está trabalhando.
6. Como usuário do faturamento, quero uma mensagem clara quando o banco do laboratório não responder, para não confundir falha com um mês zerado.

### Período

7. Como usuário do faturamento, quero que a página abra já no mês anterior, porque esse é o último mês fechado.
8. Como usuário do faturamento, quero escolher qualquer mês, para comparar meses antigos.
9. Como usuário do faturamento, quero alternar para "Período" e informar início e fim, para olhar um intervalo que não é um mês inteiro (uma quinzena ou um trimestre, por exemplo).
10. Como usuário do faturamento, quero que o período considere a data de criação do lote de faturamento, para que o mesmo mês mostre os mesmos lotes que o Dashboard de Glosas.
11. Como usuário do faturamento, quero que os lotes cancelados fiquem de fora, porque eles não são faturamento.
12. Como usuário do faturamento, quero que os lotes ainda em processamento ou em conciliação entrem, para que o mês corrente não apareça quase vazio.
13. Como usuário do faturamento, quero ver até que data o banco de backup tem dados, para saber se os lotes de hoje ainda não chegaram.

### Cards

14. Como usuário do faturamento, quero ver o total faturado do período em R$, para saber quanto foi faturado.
15. Como usuário do faturamento, quero ver quantas requisições foram faturadas no período, para medir o volume.
16. Como usuário do faturamento, quero ver quantos exames foram faturados no período, contando a quantidade cobrada de cada procedimento, para medir a produção.
17. Como usuário do faturamento, quero que cada card mostre a variação sobre o mês anterior, para ver se subimos ou caímos.
18. Como usuário do faturamento, quero que, no modo Período, a variação compare com o período anterior de mesmo tamanho, para que a comparação seja justa.
19. Como usuário do faturamento, quero que os cards não mudem com o botão R$/Qtd, porque cada card já tem a sua própria métrica.
20. Como usuário do faturamento, quero que a variação não apareça (ou apareça como "—") quando o período anterior não tiver nada, para não ver um percentual sem sentido.

### Botão R$ / Qtd

21. Como usuário do faturamento, quero um único botão R$ / Qtd que troque os três rankings ao mesmo tempo, para não precisar mexer em cada gráfico.
22. Como usuário do faturamento, quero que a troca seja imediata, sem recarregar os dados, para comparar as duas visões rapidamente.
23. Como usuário do faturamento, quero que o botão comece em R$, porque "mais faturado" é antes de tudo valor.

### Ranking de exames

24. Como usuário do faturamento, quero ver os 10 exames mais faturados do período, para saber o que mais rende.
25. Como usuário do faturamento, quero que o exame seja agrupado pelo código do procedimento, para que o mesmo exame não se divida em várias barras, uma por convênio.
26. Como usuário do faturamento, quero ver o código e a descrição mais usada daquele código no período, para reconhecer o exame.
27. Como usuário do faturamento, quero que, em R$, o ranking seja pela soma do valor faturado, e em Qtd, pela soma da quantidade cobrada.
28. Como usuário do faturamento, quero ver no tooltip a métrica que não está selecionada e o nome inteiro do exame, para ter o número completo sem trocar de visão.
29. Como usuário do faturamento, quero que os exames do Particular entrem no ranking, para que ele mostre o faturamento real.

### Ranking de convênios

30. Como usuário do faturamento, quero ver os 10 convênios (fontes pagadoras) que mais faturaram no período, para saber de quem depende o faturamento.
31. Como usuário do faturamento, quero que o convênio seja a fonte pagadora do lote, porque é para ela que o lote é cobrado.
32. Como usuário do faturamento, quero que o Particular apareça como mais uma fonte pagadora, no mês em que o lote mensal dele é criado.
33. Como usuário do faturamento, quero que, em Qtd, o ranking de convênios seja pelo número de exames faturados, para que ele seja coerente com o de exames.

### Ranking de clínicas

34. Como usuário do faturamento, quero ver as 10 clínicas (Local de Origem da requisição) com mais requisições faturadas no período, para saber de onde vem o volume.
35. Como usuário do faturamento, quero que, em Qtd, esse ranking seja pelo número de requisições, e em R$, pelo valor faturado dessas requisições.
36. Como usuário do faturamento, quero que o título diga "requisições faturadas", para não confundir com as requisições que entraram no mês.
37. Como usuário do faturamento, quero que as requisições sem Local de Origem apareçam agrupadas como "Sem clínica", para que o total não fique escondido.

## Implementation Decisions

### Fonte dos dados

- Os dados vêm do MySQL de backup do laboratório, como Faturas e Glosas. O backup atrasa cerca de 1 dia, e a resposta traz a data do dado mais recente para a tela avisar.
- O lote entra no período pela **data de criação** (`fatlote.DtaCriacao`), a mesma regra do Dashboard de Glosas. O fim do período é inclusivo, e o dia inteiro conta.
- Entram todos os status de lote, **menos o 5 (Cancelado)**.
- Lote → requisições pela coluna `requisicao.Lote`. Requisição → procedimentos cobrados por `fatrequisicaoprocedimento`.
- **Valor faturado = `ValorLiquido`.** O `ValorCobrado` está praticamente vazio: em set/2026, só 1 de 9.832 linhas tinha valor. O `ValorLiquido` é igual a Quantidade × Valor unitário em todas as linhas com valor unitário, e a soma dele é o `VlrLote` do apLIS (equivalência já conferida no código das Faturas).
- **Quantidade de exames = soma de `Quantidade`.** Um procedimento cobrado 2× conta 2.
- **Exame:** código e descrição pelo caminho `fatrequisicaoprocedimento → fatconvenioprocedimento → fattabelaprocedimento`, o mesmo das Faturas. O agrupamento é **só pelo código**. A descrição mostrada é a **mais frequente daquele código no período**, ponderada pela quantidade; o desempate fica a critério da implementação, desde que seja estável. O `CodExame` (exame interno) não é usado: está vazio em quase metade das linhas.
- **Convênio** = fonte pagadora do lote (`fatlote.IdFontePagadora` → `fatinstituicao`, pelo nome fantasia).
- **Clínica** = Local de Origem da requisição (`requisicao.IdLocalOrigem` → `fatinstituicao`), o mesmo conceito de "Clínica" de Pendências → Particulares.

### Módulo de indicadores de faturamento (servidor, funções puras)

É o único ponto de teste e concentra toda a regra:

- **Janelas:** a partir do período pedido (Mês `AAAA-MM`, ou início e fim), calcular a janela atual e a anterior. A anterior é o mês anterior no modo Mês, ou a janela imediatamente anterior com o mesmo número de dias no modo Período.
- **Resumo:** a partir das linhas achatadas (lote × requisição × procedimento: id do lote, data de criação do lote, id da requisição, código, descrição, quantidade, valor líquido, fonte pagadora, Local de Origem), produzir:
  - os **cards** (total faturado, requisições distintas, soma da quantidade) da janela atual e da anterior, com a variação percentual (nula quando o anterior é zero);
  - os **três rankings Top 10, já calculados nas duas ordenações**: por valor e por quantidade. Cada item traz as duas métricas. Para exames e convênios, a quantidade é a soma da quantidade cobrada. Para clínicas, é o número de requisições distintas.

O módulo não acessa banco nem relógio: recebe as linhas e o período por parâmetro.

### Leitura (endpoint)

- Uma ação nova no dispatcher do faturamento, no padrão dos handlers existentes. Ela recebe o modo e o período, valida as datas e a permissão de visualização do Faturamento, busca as linhas das duas janelas numa consulta só e devolve o resumo do módulo, mais a data do dado mais recente.
- A consulta fica junto das outras consultas do faturamento ao banco do laboratório e só lê e achata as linhas, sem regra de negócio.

### Frontend

- Uma página nova no módulo de faturamento, com rota protegida pela permissão de visualização do Faturamento e um item no menu ao lado de Faturas, Recebimentos e Glosas.
- Um hook de leitura busca o resumo de novo quando o período muda. O botão R$/Qtd é só estado de tela e escolhe qual dos dois rankings pré-calculados mostrar.
- Os gráficos usam o mesmo padrão do Dashboard de Glosas: recharts, barras horizontais, eixo em milhares para R$, rótulo encurtado no eixo, nome inteiro no tooltip e eixos e tooltip seguindo o tema.
- Os seletores de mês e de datas reaproveitam os componentes de data já usados no Faturamento.

## Testing Decisions

- **O que é um bom teste aqui:** um teste que verifica o resumo devolvido (cards, variação, ordem e conteúdo dos rankings, janelas) a partir de linhas e de um período montados à mão. Nada de testar como a função está implementada por dentro. Nada depende do relógio: o período sempre vem por parâmetro.
- **Ponto de teste único – módulo de indicadores de faturamento.** Testado direto, com fábricas de linha com overrides. Cobre:
  - **Janelas:** mês anterior, incluindo a virada de ano (jan → dez); período anterior de mesmo tamanho; período de um dia só.
  - **Cards:** requisição com vários procedimentos conta 1 requisição; quantidade maior que 1 soma na contagem de exames; variação positiva, negativa e nula quando o anterior é zero; as linhas da janela anterior não entram nos números da atual.
  - **Ranking de exames:** o mesmo código com descrições diferentes (convênios diferentes) vira uma barra só, com a descrição mais frequente; ordem por valor diferente da ordem por quantidade; corte no Top 10.
  - **Ranking de convênios:** agrupado pela fonte pagadora do lote; o Particular aparece como uma fonte qualquer.
  - **Ranking de clínicas:** a quantidade é o número de requisições distintas, não de procedimentos; requisições sem Local de Origem viram "Sem clínica".
- **Exemplos já existentes:** os testes do resumo do Dashboard de Glosas (o módulo de regras de recurso de glosa) e os testes de funções puras do acesso ao banco do faturamento.
- **O que não ganha teste próprio:** a consulta ao banco, o handler e a tela, porque apenas leem ou mostram o que o módulo calcula.

## Out of Scope

- Listar lotes ou requisições a partir do painel (sem drill-down).
- Exportar para CSV/Excel.
- Lista completa além do Top 10.
- Filtro por convênio ou por clínica.
- Valor recebido, glosa ou saldo (já estão em Recebimentos e em Glosas).
- Contar requisições pela data de entrada (cadastro): tudo segue o mês do lote.
- Tratar o Particular de forma diferente (pela data da requisição): ele segue a regra do lote.
- Permissão própria para a página.

## Further Notes

- **Fatos levantados no banco do laboratório em 26/10/2026 (lotes criados em set/2026, sem cancelados):**
  - 9.832 linhas de procedimento cobrado e R$ 1.380.054,78 de `ValorLiquido`; só 420 linhas têm quantidade maior que 1.
  - 178 códigos de procedimento distintos. O mesmo código chega a ter 4 descrições diferentes conforme a tabela do convênio (ex.: 40601110, 40601226).
  - O Particular (fonte pagadora 1102) entra num único lote mensal, criado no começo do mês seguinte: as 218 requisições particulares de setembro (de 252) estão num lote criado em 05/10. As outras 34 ainda não tinham lote.
- **Pedido original do usuário:** "abrir um campo onde posso olhar quais os exames mais faturados, quais os convênios mais faturou e a clínica que mais recebemos requisições em qualquer mês que eu precisar fazer esse filtro […] Não precisa detalhar os lotes e trazer as requisições, apenas os dados mesmos." A imagem de referência citada pelo usuário não chegou nesta conversa.
