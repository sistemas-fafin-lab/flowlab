# 13: Requisições faturadas sem tarefa de recebido (ou de envio)

**What to build:** no bloco "SLA por convênio" da aba Comparativos, um link "N requisições sem tarefa de recebido" que abre a lista das requisições faturadas do período e do convênio do bloco às quais falta a tarefa 37/44 (recebido no faturamento) ou a tarefa 34 (envio ao faturamento). Serve para cobrar o lançamento no apLIS, em vez de criar um segundo registro no Flow (ver issue 08). Ver `../spec.md`, seção SLA.

**Blocked by:** 06

**Status:** needs-triage

Decidido no grilling de 12/11/2026:

- Fica no próprio bloco do SLA, filtrado pelo convênio e período do bloco.
- Entram as duas faltas, com uma coluna "marco que falta" (recebido, envio ou ambos). A falta de envio depende da pergunta aberta 1 da spec (a tarefa 34 é o envio?). Até a confirmação, a tela mostra uma dica dizendo que essa regra é provisória.
- Colunas: requisição, convênio, lote, data do faturado, marco que falta. Sem nome de paciente. Exportação CSV, como na lista de requisições por código de glosa.
- Mesmo universo do SLA: requisição no mês em que foi faturada (fechamento do lote; sem ele, criação).

- [ ] A contagem do link bate com a diferença entre as requisições do grupo e o `qtd` da etapa correspondente do SLA (mais os descartados).
- [ ] A lista respeita convênio e período do bloco.
- [ ] CSV com as mesmas colunas, sem paciente.
- [ ] Teste da função pura que separa as faltas, com dados montados à mão.
