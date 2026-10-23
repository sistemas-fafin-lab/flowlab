# 11: Aba "Dashboard"

Spec: `.scratch/glosas-recursos-dashboard/spec.md`

**What to build:** a aba Dashboard mostra o panorama do período: 4 cards (Glosas Abertas, Em Recurso, Revertidas, Definitivas), com valor, quantidade e variação em relação ao mês de faturamento anterior; evolução dos últimos 6 meses; distribuição por status; principais procedimentos glosados; ranking de convênios; e resumo por motivo de glosa.

**Blocked by:** 02

**Status:** done

- [x] Os cards usam a tradução de status do spec e a glosa fixada (nas Revertidas, o valor deferido).
- [x] A evolução mostra Abertas, Em recurso e Revertidas nos 6 meses até o período filtrado.
- [x] A distribuição por status mostra o total, o percentual e a quantidade de cada status.
- [x] Os procedimentos alternam entre "maior valor" e "mais ocorrências", com valor e percentual do total.
- [x] O ranking de convênios mostra valor e percentual do total.
- [x] O resumo por motivo usa o catálogo de motivos do apLIS e agrupa os menores em "Outros".
- [x] Os gráficos seguem a biblioteca e o padrão dos dashboards do faturamento e funcionam nos temas claro e escuro.
- [x] Um período anterior a 2026 mostra o aviso de dados de recurso incompletos (o aviso vale para a página toda).

## Notas da implementação

- **Regra:** `recursoGlosa.resumirDashboard(competencia, porMes)` (testada) monta tudo a partir das requisições da foto por mês. A tradução de status é a `statusDashboard` da issue 10.
- **Leitura:** `GET /api/faturamento/glosas-recursos-dashboard` (competencia, fontePagadoraId) lê os 6 meses da foto numa consulta paginada. Esses 6 meses já incluem o anterior, que é a base da variação.
- **Tela:** `GlosasDashboard`, com recharts no padrão do Dashboard de Contas a Receber: eixos, grade e tooltip mudam com o tema. A rosca com o total no centro é a do Dashboard principal. Conferida com dados simulados nos temas claro e escuro, e em 390 px de largura sem rolagem horizontal.
- **Decisões, para revisar:**
  - **Valores:** Abertas, Em recurso e Definitivas valem pela glosa fixada. Revertidas valem pelo valor deferido (ΔRec ou o valor do lápis), e o 34/17 sem lote conta 0 até o lápis.
  - **Variação dos cards:** é sobre o **valor** (o número grande do card). No Acompanhamento (issue 02) a variação é sobre a quantidade. Sem valor no mês anterior, o card mostra "Sem valor no mês anterior".
  - **Universo dos rankings:** procedimentos, convênios e motivos contam as mesmas glosas da distribuição, ou seja, só as que estão nos quatro status. Fica de fora, por exemplo, o status 33 sem nada recebido. Todas entram pela glosa fixada (o que foi glosado), inclusive as Revertidas.
  - **Valor por procedimento é estimado:** a foto guarda só a lista de procedimentos glosados da requisição. A glosa fixada da requisição é dividida igualmente entre eles, e o subtítulo do gráfico avisa. Para o valor real seria preciso gravar o valor por procedimento na foto. Fica como evolução.
  - **Percentuais:** "maior valor" e convênios usam o total glosado; "mais ocorrências" usa o total de ocorrências de procedimento; motivos usam o total de ocorrências de motivo.
  - **Motivos:** só os do catálogo `fatmotivoglosa`. A requisição glosada sem motivo (recebido abaixo do líquido) fica fora do resumo. A tela mostra percentual e ocorrências, sem coluna de valor.
  - **Cortes de exibição:** 10 linhas nos rankings. No resumo por motivo, mais de 6 motivos viram os 5 maiores e "Outros".
- **Pontos em aberto:**
  - O handler repete a leitura paginada e o mapeamento linha → `RequisicaoFoto` dos outros handlers. Isso já estava em aberto desde a issue 10 e agora são seis cópias.
  - As rotas de glosas não estão em `api/server.ts` (só a `-cron` está), igual às irmãs.
  - Migrations da feature **não aplicadas** no Supabase. Sem elas, a aba responde 502.
