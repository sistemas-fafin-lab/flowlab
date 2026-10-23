# Glosas e Recursos: Dashboard, Glosas recentes e Acompanhamento dos recursos

Status: ready-for-agent

## Problem Statement

O controle de glosas e recursos do faturamento é feito hoje numa planilha, fora do FlowLab. A tela "Glosas e Recursos" tem duas abas que não ajudam nesse controle:

- **"Nativas"** lê a tabela `glosas` do Supabase, que não tem paciente, procedimento nem guia.
- **"Histórico (apLIS)"** é uma consulta somente leitura, sem status de glosa, sem prazo e sem como registrar nada.

A responsável pelas glosas não consegue ver, num só lugar:

- quanto foi glosado no mês de faturamento;
- quanto está em recurso, quanto foi deferido (total ou parcial), quanto foi indeferido e quanto foi acatado;
- quais lotes de recurso estão atrasados em relação ao prazo de cada convênio;
- o histórico de cada requisição dentro do recurso.

Três limitações do apLIS impedem isso:

- **Datas:** o apLIS não guarda a data real de envio do recurso, nem a de retorno, nem a de pagamento.
- **Valor recebido:** o apLIS sobrescreve o valor recebido, então a glosa original se perde quando o recurso é pago.
- **Histórico:** o apLIS não registra as mudanças de status da requisição de forma útil.

Além disso, em Contas a Receber → Títulos, a coluna "Glosado" vem de glosas digitadas à mão ou lançadas pelo "Aplicar baixas e glosas do apLIS". Ela não mostra quanto da glosa foi recebida de volta nem quanto foi acatado.

## Solution

**Página "Glosas e Recursos"**

A página passa a ter três abas, com o visual do FlowLab (tema claro e escuro). Os mockups recebidos servem só como referência de layout. Um cabeçalho comum às três abas tem:

- filtro de período (mês do lote de faturamento original da requisição);
- filtro de convênio;
- botão "Atualizar".

As abas:

- **Dashboard:**
  - 4 cards (Abertas, Em recurso, Revertidas, Definitivas), com comparação com o mês anterior;
  - evolução dos últimos 6 meses;
  - distribuição por status;
  - principais procedimentos glosados;
  - ranking de convênios;
  - resumo por motivo de glosa.
- **Glosas recentes:** tabela paginada e com busca das glosas do período. O olho abre o card de detalhe.
- **Acompanhamento dos recursos:**
  - 4 cards (Total de recursos, Em análise, Deferidos, Indeferidos);
  - duas sub-abas:
    - **Lotes de recurso:** a lista de lotes com prazos e selo de atraso, e o card lateral "Detalhes do recurso".
    - **Recursos fora de lote:** glosas ainda sem recurso, e requisições em recurso que ainda não foram colocadas num lote.

**Fonte dos dados e foto no FlowLab**

A fonte dos dados é o apLIS. O FlowLab guarda, no Supabase, uma foto de cada requisição glosada ou recursada:

- glosa fixada;
- valor recursado;
- recebido;
- status;
- datas.

A foto é atualizada por uma sincronização diária e pelo botão "Atualizar". O histórico de cada requisição nasce da comparação entre uma foto e a seguinte.

**Edição manual (lápis)**

- **No lote:** data de envio real, data real de retorno e data real de pagamento.
- **Na requisição:** valor recursado e valor recebido de glosa.

As edições gravam só no FlowLab, valem acima do apLIS e entram no histórico.

**Prazos por convênio**

Os prazos vêm de regras por convênio, cadastradas numa tela própria. A tela já vem preenchida com a planilha da responsável pelas glosas.

**Contas a Receber → Títulos**

- **Colunas:** Glosado, Glosa recebida e Glosa acatada, calculadas a partir do apLIS.
- **Saldo do título:** passa a descontar a glosa acatada.
- **Lançamento manual de glosa e parte de glosas do "Aplicar baixas e glosas do apLIS":** são desligados. A parte de baixas continua.

## User Stories

### Página e navegação

1. Como responsável pelas glosas, quero que "Glosas e Recursos" tenha as abas Dashboard, Glosas recentes e Acompanhamento dos recursos, para encontrar cada visão sem misturar assuntos.
2. Como responsável pelas glosas, quero que as abas "Nativas" e "Histórico (apLIS)" deixem de existir, para não haver duas fontes de verdade na mesma tela.
3. Como responsável pelas glosas, quero um cabeçalho com período, convênio e "Atualizar" comum às três abas, para trocar de aba sem perder o recorte.
4. Como responsável pelas glosas, quero que o período padrão seja o mês corrente, para abrir a tela já no recorte mais usado.
5. Como responsável pelas glosas, quero que o período se refira ao mês do lote de faturamento original da requisição, para bater com a planilha de títulos de cada mês.
6. Como responsável pelas glosas, quero filtrar por convênio, para tratar uma operadora de cada vez.
7. Como responsável pelas glosas, quero ver um aviso quando o período for anterior a 2026, para saber que os recursos de anos anteriores não foram organizados em lotes e podem estar incompletos.
8. Como usuário do FlowLab, quero que a tela siga o visual do resto do sistema, com tema claro e escuro, para não estranhar a navegação.
9. Como usuário do FlowLab, quero ver quando foi a última sincronização com o apLIS, para saber se os números estão atualizados.

### Dashboard

10. Como gestora do faturamento, quero um card de Glosas Abertas com valor e quantidade, para saber quanto ainda não foi recorrido.
11. Como gestora do faturamento, quero um card de Em Recurso com valor e quantidade, para saber quanto está aguardando a operadora.
12. Como gestora do faturamento, quero um card de Revertidas com valor e quantidade, para saber quanto foi recuperado.
13. Como gestora do faturamento, quero um card de Definitivas com valor e quantidade, para saber quanto foi perdido.
14. Como gestora do faturamento, quero ver, em cada card, a variação percentual em relação ao mês de faturamento anterior, para perceber tendências.
15. Como gestora do faturamento, quero um gráfico da evolução de Abertas, Em recurso e Revertidas nos últimos 6 meses, para acompanhar o ritmo de recuperação.
16. Como gestora do faturamento, quero um gráfico de distribuição por status, com total de glosas, percentual e quantidade, para ver a composição do mês.
17. Como gestora do faturamento, quero o ranking dos principais procedimentos glosados, alternando entre maior valor e mais ocorrências, para atacar as causas mais caras e as mais frequentes.
18. Como gestora do faturamento, quero o ranking dos convênios que mais glosam, com valor e percentual do total, para priorizar negociações.
19. Como gestora do faturamento, quero o resumo por motivo de glosa (catálogo de motivos do apLIS), com percentual e quantidade, para corrigir falhas recorrentes no faturamento.

### Glosas recentes

20. Como responsável pelas glosas, quero uma aba com as glosas do período, da mais recente para a mais antiga, para ver o que acabou de chegar.
21. Como responsável pelas glosas, quero ver data da glosa, nº da guia, paciente, convênio, procedimento, motivo, valor glosado e status em cada linha, para identificar a glosa sem abrir o apLIS.
22. Como responsável pelas glosas, quero buscar por guia, paciente, convênio ou procedimento, para achar uma glosa específica.
23. Como responsável pelas glosas, quero paginação, para navegar por meses com muitas glosas.
24. Como responsável pelas glosas, quero clicar no olho e abrir o card de detalhe da requisição, para ver histórico, justificativa, observações e documentos.

### Acompanhamento dos recursos: cards e lista de lotes

25. Como responsável pelas glosas, quero um card com o total de recursos do período e a variação em relação ao mês anterior, para dimensionar o trabalho.
26. Como responsável pelas glosas, quero um card "Em análise" com os recursos de lotes enviados que ainda não tiveram retorno, com o percentual do total, para saber quanto está com a operadora.
27. Como responsável pelas glosas, quero um card "Deferidos", com o percentual do total, para saber quanto foi pago de volta.
28. Como responsável pelas glosas, quero um card "Indeferidos", com o percentual do total, para saber quanto foi negado.
29. Como responsável pelas glosas, quero ver separadamente o valor deferido parcial (em tratativa), para cobrar a diferença da operadora.
30. Como responsável pelas glosas, quero ver o valor de glosa acatada, para saber quanto o laboratório decidiu não recorrer.
31. Como responsável pelas glosas, quero uma lista dos lotes de recurso com: nº do lote de recurso, nº de protocolo de faturamento, convênio, valor glosado, valor recorrido, data de envio, data de retorno, data de pagamento do recurso, status do lote e atraso. Assim acompanho todos de uma vez.
32. Como responsável pelas glosas, quero que as datas de retorno e de pagamento sejam calculadas pelas regras de prazo do convênio, para não ter que contar dias à mão.
33. Como responsável pelas glosas, quero que a lista diferencie data prevista de data real, para saber se a operadora já respondeu de fato.
34. Como responsável pelas glosas, quero um selo "No prazo", "Vence hoje" ou "Atrasado" em cada lote, para saber o que cobrar hoje.
35. Como responsável pelas glosas, quero que lotes ainda não enviados apareçam como "Criado", sem selo de atraso e fora dos cards de Em análise e Deferido, porque o prazo só começa no envio.
36. Como responsável pelas glosas, quero que um lote de convênio sem prazo definido mostre "—" no prazo e no atraso, para não ver atraso inventado.
37. Como responsável pelas glosas, quero buscar por nº do lote de recurso, guia, paciente, convênio ou protocolo, e filtrar por status, para achar um recurso.
38. Como responsável pelas glosas, quero paginação na lista de lotes, para navegar quando houver muitos.

### Card "Detalhes do recurso"

39. Como responsável pelas glosas, quero que o olho de um lote abra o card lateral "Detalhes do recurso" ao lado da lista, para consultar sem perder a lista de vista.
40. Como responsável pelas glosas, quero ver no topo do card os dados do lote (nº, protocolo, convênio, status, datas e atraso), para ter o contexto do recurso.
41. Como responsável pelas glosas, quero ver no card a lista das requisições do lote, com paciente, guia, valor recursado e valor recebido de glosa, para saber o resultado de cada uma.
42. Como responsável pelas glosas, quero corrigir pelo lápis a data de envio real do lote, porque no apLIS não dá para registrar quando o recurso foi de fato enviado.
43. Como responsável pelas glosas, quero que a data de envio corrigida recalcule a data de retorno, a data de pagamento e o selo de atraso, para os prazos refletirem a realidade.
44. Como responsável pelas glosas, quero registrar pelo lápis a data real de retorno da operadora e a data real de pagamento do recurso, para o atraso parar de contar quando a operadora já respondeu.
45. Como responsável pelas glosas, quero corrigir pelo lápis o valor recursado e o valor recebido de glosa de cada requisição, para acertar casos que o apLIS não reflete.
46. Como responsável pelas glosas, quero que um campo corrigido à mão mostre a marca "editado manualmente", para saber de onde veio o valor.
47. Como responsável pelas glosas, quero que a sincronização com o apLIS não sobrescreva um campo que eu corrigi à mão, para não perder meu ajuste.
48. Como responsável pelas glosas, quero clicar numa requisição dentro do card e ver as abas Histórico, Justificativa, Observações e Documentos, para entender o caso inteiro.
49. Como responsável pelas glosas, quero que o Histórico mostre, com data, cada mudança da requisição dentro do recurso (por exemplo: enviado, foi para 2º recurso, glosa acatada, recebido, edição manual), para reconstruir o que aconteceu.
50. Como responsável pelas glosas, quero que cada edição manual apareça no histórico com o usuário, a data e o valor anterior, para ter auditoria.
51. Como responsável pelas glosas, quero ver a justificativa que consta na requisição dentro do lote de recurso, para saber o que foi argumentado.
52. Como responsável pelas glosas, quero ver como observação as tarefas da requisição direcionadas ao setor "GLOSA - FATURAMENTO" no apLIS, para não precisar abrir o apLIS.
53. Como responsável pelas glosas, quero ver os documentos digitalizados da requisição, para conferir a guia e os anexos do recurso.
54. Como responsável pelas glosas, quero que, em Glosas recentes e em Recursos fora de lote, o olho abra o mesmo card direto na requisição, sem o bloco do lote, para ter a mesma experiência.
55. Como responsável pelas glosas, quero ver a marca "valor inicial estimado" nas requisições cuja foto foi tirada depois do envio do recurso, para saber que a glosa fixada pode não ser a original.

### Recursos fora de lote

56. Como responsável pelas glosas, quero uma sub-aba com as requisições em "GLOSADO ainda SEM RECURSO" que não estão em nenhum lote de recurso, para saber o que ainda falta recorrer.
57. Como responsável pelas glosas, quero que essa sub-aba também mostre as requisições em 1º ou 2º recurso que não estão em nenhum lote, com um selo diferente, para conferir a limpeza que estou fazendo nos lotes de 2026.
58. Como responsável pelas glosas, quero ver nessa sub-aba o prazo para recorrer (regra "GLOSA – RECURSO" do convênio) e o selo de atraso, para não perder o prazo de recurso.
59. Como responsável pelas glosas, quero que essa sub-aba tenha as mesmas colunas, busca e paginação de Glosas recentes, para não aprender duas telas.

### Regras de prazo por convênio

60. Como responsável pelas glosas, quero uma tela para cadastrar, por convênio, as regras de prazo de pagamento da fatura, de recurso, de análise e de pagamento do recurso, para os prazos seguirem o contrato de cada operadora.
61. Como responsável pelas glosas, quero que cada regra seja de um destes tipos: N dias corridos, N dias úteis, dia X do mês seguinte, N-ésimo dia útil do mês seguinte, último dia do mês seguinte ou sem prazo. Isso cobre os formatos que os convênios usam.
62. Como responsável pelas glosas, quero que a tela já venha preenchida com a minha planilha de prazos, para não ter que digitar tudo.
63. Como responsável pelas glosas, quero que os casos sem regra clara ("informação não clara", "sem prazo definido", vazio, "após solicitação de NF", "conforme cronograma") entrem como sem prazo, para eu completar depois.
64. Como responsável pelas glosas, quero ligar uma regra a uma ou mais fontes pagadoras do apLIS (por exemplo, os dois cadastros do Bradesco), para a regra valer para todos os cadastros do mesmo convênio.
65. Como responsável pelas glosas, quero ver quais fontes pagadoras com glosa ainda não têm regra ligada, para completar o vínculo.
66. Como responsável pelas glosas, quero que alterar uma regra recalcule na hora os prazos e atrasos exibidos, para ver o efeito imediatamente.

### Contas a Receber → Títulos

67. Como analista do contas a receber, quero que a coluna "Glosado" mostre o valor fixado das requisições em "GLOSADO ainda SEM RECURSO" dos lotes do título, para o glosado refletir o retorno da análise de conta.
68. Como analista do contas a receber, quero uma coluna "Glosa recebida" ao lado do Glosado, com o valor deferido dos recursos das requisições do título, para saber quanto da glosa voltou.
69. Como analista do contas a receber, quero uma coluna "Glosa acatada" com o saldo negativo das requisições em "Recebido a menor – acatado" e "Glosa definitiva – acatada diretoria", para saber quanto foi dado como perdido.
70. Como analista do contas a receber, quero que o saldo do título desconte a glosa acatada, para o saldo mostrar só o que ainda pode entrar.
71. Como analista do contas a receber, quero que os cards de total do recorte somem as novas colunas, para ter a visão consolidada.
72. Como analista do contas a receber, quero que a linha expandida do título liste as glosas vindas do apLIS, para ver de onde vem cada valor.
73. Como analista do contas a receber, quero que o lançamento manual de glosa e a parte de glosas do "Aplicar baixas e glosas do apLIS" deixem de existir, mantendo as baixas, para não haver glosa em dobro.

### Sincronização e permissões

74. Como usuário do faturamento, quero que a foto das requisições seja atualizada por uma rotina diária, para os números estarem prontos quando eu abrir a tela.
75. Como usuário do faturamento, quero que o botão "Atualizar" sincronize o período filtrado na hora, para ver o efeito de algo que acabei de mudar no apLIS (lembrando que a réplica do apLIS atrasa cerca de 1 dia).
76. Como usuário com permissão de ver o faturamento, quero acessar as três abas e o card de detalhe, para consultar sem poder alterar.
77. Como usuário com permissão de gerenciar o faturamento, quero usar o lápis e editar as regras de prazo, porque só quem gerencia deve mexer nos valores.
78. Como usuário sem permissão de gerenciar, quero não ver o lápis nem os botões de edição, para não clicar em algo que não terá efeito.

## Implementation Decisions

### Fonte e granularidade

- **Fonte:** o apLIS (MySQL de backup, lido ao vivo pelas funções do servidor do faturamento) é a fonte. Nada é gravado no apLIS.
- **Status da requisição:** é o evento de faturamento da requisição (catálogo de eventos de faturamento do apLIS). Os códigos usados:

  | Código | Evento |
  |---|---|
  | 6 | GLOSADO ainda SEM RECURSO |
  | 7 | Recurso de glosa – 1º recurso |
  | 16 | Recurso de glosa – 2º recurso |
  | 15 | Recurso não acatado |
  | 17 | Recurso de glosa pago |
  | 34 | Glosa recebida |
  | 33 | Em tratativas com convênio |
  | 18 | Recebido a menor – acatado |
  | 8 | Glosa definitiva – acatada diretoria |

- **Granularidade:** é a **requisição**. A glosa é a soma do líquido menos a soma do recebido dos procedimentos. Os procedimentos aparecem no detalhe, com o valor recursado de cada um tirado do lote de recurso.
- **Lote de recurso:** é o lote de recurso de glosa do apLIS e é a fonte de verdade do Acompanhamento. Não existe "lote virtual". A responsável vai mover todos os recursos de 2026 para lotes de recurso no apLIS.
- **Mês de referência:** para período, cards e comparação com o mês anterior, é o mês do lote de faturamento original da requisição.

### Foto (persistência no Supabase)

Tabelas novas no Supabase, com RLS no padrão do faturamento (ler com permissão de ver o faturamento, gravar com permissão de gerenciar):

- **Foto da requisição glosada/recursada:**
  - identificador da requisição no apLIS e lote de faturamento original;
  - fonte pagadora;
  - lote de recurso (opcional);
  - status do apLIS;
  - líquido e recebido atuais;
  - glosa fixada e recebido no momento da fixação;
  - valor recursado;
  - marca de "valor inicial estimado";
  - data da primeira e da última sincronização.
- **Foto do lote de recurso:**
  - identificador, status, protocolo e fonte pagadora;
  - data de envio do apLIS.
- **Edições manuais:** por lote (data de envio, data real de retorno, data real de pagamento) e por requisição (valor recursado, valor recebido de glosa), com usuário e data. O valor editado vale acima do apLIS.
- **Histórico:** eventos por requisição e por lote, com data, tipo, valor anterior, valor novo e usuário (quando é edição manual).
- **Regras de prazo por convênio:** nome do convênio, quatro regras (pagamento da fatura, recurso, análise, pagamento do recurso) e vínculo com uma ou mais fontes pagadoras do apLIS.

### Glosa fixada

- **Requisição que entra pela primeira vez antes do envio do recurso:** a glosa fixada é líquido − recebido naquele momento, e o recebido fica guardado como base.
- **Requisição que já estava em 6, 7 ou 16 na primeira sincronização:** a glosa fixada é líquido − recebido na primeira sincronização, com a marca "valor inicial estimado".
- **Requisição que já estava em 34 ou 17 na primeira sincronização:** conta como deferido total. O valor deferido é o recursado do lote de recurso, quando existir. Sem lote, fica em branco para a responsável completar pelo lápis. Leva a marca "valor inicial estimado".
- **Depois de fixada:** a glosa fixada não muda com as sincronizações seguintes. Só o lápis altera.

### Classificação de cada requisição

R = valor recursado (editado ou do apLIS) e ΔRec = recebido atual − recebido na fixação (ou o valor recebido de glosa editado, quando houver).

- **Em análise:** lote de recurso enviado (data de envio do apLIS ou editada) e ΔRec = 0.
- **Deferido:** ΔRec ≥ R.
- **Deferido parcial / em tratativa:** 0 < ΔRec < R.
- **Indeferido:** status 15.
- **Glosa acatada:** status 18 ou 8. O valor é o saldo negativo da requisição (líquido − recebido).

### Status do Dashboard

| Status | O que conta | Valor |
|---|---|---|
| Abertas | status 6 | glosa fixada |
| Em recurso | status 7 ou 16 sem classificação final | glosa fixada |
| Revertidas | deferido + deferido parcial | valor deferido |
| Definitivas | glosa acatada + indeferido | glosa fixada |

### Prazos

**Tipos de regra:**
- dias corridos (N);
- dias úteis (N);
- dia X do mês seguinte;
- N-ésimo dia útil do mês seguinte;
- último dia do mês seguinte;
- sem prazo.

Dia útil é de segunda a sexta, sem feriados.

**Como cada regra é usada:**

| Regra | Data base | Resultado |
|---|---|---|
| GLOSA – ANÁLISE | data de envio do lote (editada ou do apLIS) | data de retorno prevista |
| GLOSA – PAGAMENTO | data de retorno (real, se houver; senão a prevista) | data de pagamento prevista |
| GLOSA – RECURSO | data de recebimento da requisição | prazo para recorrer (aba Recursos fora de lote) |
| PAGAMENTO (da fatura) | — | fica cadastrada, sem uso nesta entrega |

**Selo de atraso:** só para lotes enviados que ainda não têm data real de retorno nem classificação final.

| Selo | Quando |
|---|---|
| No prazo | hoje < data de retorno |
| Vence hoje | hoje = data de retorno |
| Atrasado | hoje > data de retorno |
| — | convênio sem regra |

### Histórico

Cada sincronização compara a foto anterior com a nova e grava eventos:

- entrada em lote de recurso;
- envio do lote;
- mudança de status da requisição (por exemplo, 7 → 16 "foi para 2º recurso", 7 → 18 "glosa acatada");
- mudança no recebido.

Edições manuais também viram eventos. Um campo editado à mão não gera evento de sincronização, porque o valor da sincronização é ignorado para esse campo. O histórico começa a contar na primeira sincronização; não há reconstrução do passado.

### Sincronização

- **Endpoint de sincronização:** recebe um período (mês de faturamento) e, opcionalmente, um convênio. Lê do apLIS:
  - as requisições do período nos status listados acima, ou presentes em algum lote de recurso;
  - os lotes de recurso dessas requisições.

  Depois aplica as regras e grava a foto e o histórico.
- **Rotina diária:** uma rotina agendada (cron da Vercel, como as que já existem no projeto) sincroniza os meses de 2026.
- **Botão "Atualizar":** sincroniza o período e o convênio filtrados.
- **Aviso:** o meta da resposta informa a data do dado (a réplica do apLIS atrasa cerca de 1 dia), como as outras telas ao vivo já fazem.

### Módulo de regras de recurso de glosa (servidor, funções puras)

Concentra toda a regra de negócio e é o principal ponto de teste:

- **Classificação:** classificar a requisição (a partir da foto, das edições e do status do apLIS).
- **Fixação:** calcular a glosa fixada e a marca de "valor inicial estimado".
- **Prazos:** aplicar uma regra de prazo a uma data base e calcular o selo de atraso de um lote.
- **Histórico:** gerar os eventos a partir da foto anterior, da foto nova e das edições manuais.
- **Títulos:** somar Glosado, Glosa recebida e Glosa acatada por lote de faturamento.

### Leitura (endpoints)

- **Dashboard:** cards com mês anterior, série de 6 meses, distribuição, procedimentos (por valor e por ocorrências), convênios e motivos.
- **Glosas recentes:** paginada e com busca.
- **Lotes de recurso:** paginada, com busca e filtro de status, já com prazos e selo.
- **Recursos fora de lote:** paginada e com busca, com o prazo para recorrer.
- **Detalhe:** de lote (com requisições) e de requisição, com histórico, justificativa (do lote de recurso), observações (tarefas do apLIS do setor "GLOSA - FATURAMENTO", código 22) e documentos (reaproveita a consulta e o modal de imagens da requisição que já existem).
- **Cadastro:** regras de prazo e vínculo com fontes pagadoras.
- **Gravação de edição manual:** de lote e de requisição.

Todas seguem o padrão de dispatcher e handlers do faturamento.

### Frontend

- **Página:** a página "Glosas e Recursos" é reescrita com as três abas e o cabeçalho comum. Saem os componentes das abas "Nativas" e "Histórico (apLIS)"; o hook de glosas nativas sai da página.
- **Card "Detalhes do recurso":** é um painel lateral ao lado da lista, não um modal. Ao ser aberto pelo lote, mostra o bloco do lote e a lista de requisições; clicar numa requisição abre as abas Histórico, Justificativa, Observações e Documentos. Ao ser aberto por Glosas recentes ou por Recursos fora de lote, vai direto à requisição.
- **Cadastro de regras:** a tela de regras de prazo fica acessível dentro de Acompanhamento.
- **Gráficos:** seguem a biblioteca e o padrão de gráficos já usados nos dashboards do faturamento.
- **Permissões:** o lápis e a edição de regras só aparecem para quem tem permissão de gerenciar o faturamento.

### Contas a Receber → Títulos

- **Colunas novas:** "Glosa recebida" e "Glosa acatada", calculadas por lote de faturamento do título a partir da foto.
- **Coluna "Glosado":** passa a vir da foto (glosa fixada das requisições em status 6 dos lotes do título).
- **Saldo do título:** a regra derivada no banco (hoje total − recebido − glosa definitiva da tabela `glosas`) passa a descontar a glosa acatada vinda da foto.
- **Totais e linha expandida:** os totais do recorte e a linha expandida passam a usar a foto.
- **Desligamentos:** o lançamento manual de glosa e a parte de glosas do "Aplicar baixas e glosas do apLIS" são desligados. As baixas continuam.
- **Tabela `glosas`:** fica no banco como histórico, sem uso na tela.

### Carga inicial das regras de prazo

A migration já insere as regras da planilha (ver Further Notes), com vínculo automático às fontes pagadoras do apLIS por semelhança de nome. O que não casar fica sem vínculo para a responsável ligar na tela.

## Testing Decisions

- **O que é um bom teste aqui:** um teste que verifica comportamento observável a partir das entradas (foto, status do apLIS, edições, regras, data de hoje) e das saídas (classificação, valores, datas, eventos, o que foi gravado). Nada de testar como a função está implementada por dentro. Datas de "hoje" são passadas como parâmetro, para o teste não depender do relógio.
- **Ponto de teste 1 – módulo de regras de recurso de glosa (funções puras).** Testado direto, com casos montados à mão por fábricas com overrides. Cobre:
  - **Classificação:** todos os casos (em análise, deferido no limite ΔRec = R, deferido parcial, indeferido, acatada) e o valor editado tendo prioridade.
  - **Fixação:** glosa fixada e "valor inicial estimado" para os status 6, 7, 16, 34 e 17 na primeira sincronização.
  - **Prazos:** cada tipo de regra, incluindo virada de mês, fim de semana em dias úteis, N-ésimo dia útil, último dia do mês e sem prazo.
  - **Selo de atraso:** os três selos e "—", lote não enviado e lote com retorno real.
  - **Histórico:** os eventos de mudança de status, entrada em lote, envio, recebido, e a supressão dos campos editados à mão.
  - **Títulos:** as somas de Glosado, Glosa recebida e Glosa acatada.
- **Ponto de teste 2 – handler de sincronização.** Testado com o acesso ao apLIS e o cliente do Supabase simulados. Cobre:
  - gravar a foto e o histórico corretamente;
  - não sobrescrever um campo editado à mão;
  - sincronizar só o período e o convênio pedidos;
  - recusar quem não tem permissão.
- **Exemplos já existentes:**
  - testes de funções puras de regra do faturamento: os de glosas sugeridas do apLIS e os de conferência com o apLIS;
  - testes de handler com o apLIS e o Supabase simulados: os da prévia de baixas e glosas do apLIS e os da conferência de títulos com o apLIS.
- **O que não ganha teste próprio:** os handlers só de leitura e os componentes de tela, porque apenas exibem o que o módulo de regras calcula.

## Out of Scope

- Gravar qualquer coisa no apLIS (status, data de envio, valores).
- Feriados no cálculo de dias úteis.
- Usar a regra "PAGAMENTO" da fatura (fica só cadastrada).
- Reconstruir o histórico anterior à primeira sincronização.
- Organizar os recursos de anos anteriores a 2026 (só consulta, com aviso).
- A barra lateral e as telas "Relatórios", "Convênios" e "Configurações" do mockup.
- Ações do mockup "Enviar novo recurso" e "Marcar como atrasado" (o atraso é calculado; nada é enviado à operadora pelo FlowLab).
- Caixas de seleção e ações em lote nas listas.
- Apagar a tabela `glosas` do Supabase.

## Further Notes

- **Fatos levantados no apLIS em 23/10/2026:**
  - **Lotes de recurso por convênio:** dos 441 lotes, 434 são do Bradesco (dois cadastros de fonte pagadora), 6 do Plan Assiste e 1 da Cassi.
  - **Requisições em recurso sem lote:** das 2.998 requisições em status 7, só 318 estão em algum lote de recurso. A responsável vai fazer uma limpeza movendo os recursos de 2026 para lotes, e a sub-aba "Recursos fora de lote" serve para conferir essa limpeza.
  - **Status dos lotes de recurso:** 19 no status 1 (não enviados), 420 no 2 (enviados), 2 no 4.
  - **Datas dos lotes de recurso:** nenhum tem data de finalização; só 4 têm data de vencimento.
  - **Log de alterações do apLIS:** quase não registra mudança de status de requisição (8 casos em outubro/2026), por isso o histórico é do FlowLab.
  - **Tarefas do setor "GLOSA - FATURAMENTO"** (código 22): 46, todas em aberto.
- **Relação com outros specs:** este spec substitui, na tela de Títulos, o comportamento de glosas do spec `.scratch/faturamento-glosas-sincronizar-aplis/` (glosas do apLIS que substituem as digitadas). Aquele fluxo de lançamento de glosa é desligado aqui.
- **Planilha de prazos para a carga inicial** (como a responsável pelas glosas enviou; o que estiver vazio ou não claro entra como "sem prazo"):

  | Convênio | Pagamento (fatura) | Glosa – Recurso | Glosa – Análise | Glosa – Pagamento |
  |---|---|---|---|---|
  | ASSEFAZ | dia 20 do mês subsequente da fatura | 60 dias | 60 dias | 60 dias |
  | AMIL | 30 dias após entrega | 90 dias | 90 dias | 30 dias |
  | AMHP | — | — | — | — |
  | AMPLA | 90 dias após a NF | — | — | — |
  | BRADESCO | 45 dias após receber fatura | 90 dias | 90 dias | 90 dias |
  | BRB | 60 dias | 60 dias | não clara | 60 dias |
  | CAMARA | 60 dias | 30 dias | 30 dias | 60 dias |
  | CASSI | 30 dias | 60 dias | — | 20º dia útil |
  | CBMDF | 30 dias após NF | 30 dias | 60 dias | 30 dias |
  | E-VIDA | 35 dias | 20 dias | 20 dias | 60 dias |
  | FASCAL | até o 20º dia útil após o recebimento da fatura | 60 dias | 90 dias | 20 dias |
  | FUSEX | 60 dias | 45 dias | 30 dias | 30 dias |
  | GAMA | 60 dias | 60 dias | 60 dias | 60 dias |
  | GEAP | 90 dias | 60 dias | 60 dias | 90 dias |
  | INAS | 30 dias | 30 dias | 60 dias | 4 meses (conforme cronograma no e-mail) → sem prazo |
  | PF | até o último dia do mês subsequente | 60 dias | 90 dias | 60 dias |
  | PLAN ASSISTE | 30 dias | 90 dias | não clara | não clara |
  | PMDF | 30 dias após NF | 30 dias | 30 dias | 30 dias após NF |
  | POSTAL SAÚDE | até 60 dias | 60 dias | 60 dias | último dia do mês subsequente |
  | SAÚDE CAIXA | 30 dias | 60 dias | 60 dias | 30 dias |
  | SELECT | do dia 25 até o último dia do mês subsequente da entrega | — | — | — |
  | SIS SENADO | 60 dias | 90 dias | 45 dias | 60 dias |
  | STF-MED | 30 dias após o 1º dia útil de recebimento da NF | 60 dias | 60 dias | 30 dias |
  | STM | 60 dias | — | — | — |
  | STJ | 10 dias contando do 1º dia útil do mês subsequente da NF | 120 dias | 60 dias | após solicitação de NF → sem prazo |
  | SUL AMERICA | 35 dias | 90 dias | 90 dias | 35 dias |
  | TJDFT | 30 dias após NF | 60 dias | 60 dias | 30 dias |
  | TRE | 30 dias após NF | 60 dias | 60 dias | 30 dias |
  | TRT | 30 dias após NF | 60 dias | 5 dias úteis | 30 dias |
  | TST | 20º dia do mês subsequente | 60 dias | sem prazo definido | sem prazo definido |

- **Interpretação das regras:**
  - "N dias" sem qualificação = dias corridos.
  - "20º dia útil" (Cassi, glosa – pagamento) = 20º dia útil do mês seguinte à data base.
  - "20 dias" (Fascal, glosa – pagamento) = 20 dias corridos.
  - A coluna "Pagamento (fatura)" é só guardada nesta entrega. Os formatos que dependem da data da NF ou da entrega entram como texto livre / sem prazo, até haver uso.
