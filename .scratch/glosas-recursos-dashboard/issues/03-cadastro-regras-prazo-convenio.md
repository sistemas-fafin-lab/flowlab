# 03: Cadastro de regras de prazo por convênio

Spec: `.scratch/glosas-recursos-dashboard/spec.md`

**What to build:** uma tela, dentro de Acompanhamento dos recursos, para cadastrar por convênio as quatro regras de prazo: Pagamento (fatura), Glosa – Recurso, Glosa – Análise e Glosa – Pagamento. Cada regra é de um destes tipos: N dias corridos, N dias úteis, dia X do mês seguinte, N-ésimo dia útil do mês seguinte, último dia do mês seguinte, ou sem prazo. Cada regra se liga a uma ou mais fontes pagadoras do apLIS. A tela já vem preenchida com a planilha da responsável pelas glosas (tabela nas Further Notes do spec).

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] Existe uma tabela de regras de prazo e uma de vínculo com fontes pagadoras do apLIS, com RLS: lê quem pode ver o faturamento, edita quem pode gerenciar.
- [ ] A migration carrega a planilha do spec. Os casos não claros, vazios, "após solicitação de NF" e "conforme cronograma" entram como sem prazo. A interpretação de "20º dia útil" (Cassi) e de "20 dias" (Fascal) segue o spec.
- [ ] O vínculo com as fontes pagadoras é pré-preenchido por semelhança de nome (por exemplo, BRADESCO liga os dois cadastros do Bradesco) e pode ser alterado na tela.
- [ ] A tela lista as fontes pagadoras com glosa ou recurso que ainda não têm regra ligada.
- [ ] Só quem pode gerenciar o faturamento vê os controles de edição.
