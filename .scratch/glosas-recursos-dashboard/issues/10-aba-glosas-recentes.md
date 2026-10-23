# 10: Aba "Glosas recentes"

Spec: `.scratch/glosas-recursos-dashboard/spec.md`

**What to build:** a aba "Glosas recentes" mostra as glosas do período, da mais recente para a mais antiga. As colunas são: data da glosa (data de recebimento da requisição), nº da guia, paciente, convênio, procedimento, motivo (catálogo de motivos do apLIS), valor glosado e status, este traduzido como no Dashboard (Aberta, Em recurso, Revertida, Definitiva).

**Blocked by:** 02, 05

**Status:** ready-for-agent

- [ ] Respeita o período e o convênio do cabeçalho.
- [ ] Tem busca por guia, paciente, convênio ou procedimento, e paginação.
- [ ] Não tem caixas de seleção nem ações em lote.
- [ ] O status segue a tradução do spec: Abertas = status 6; Em recurso = 7 ou 16 sem classificação final; Revertidas = deferido + deferido parcial; Definitivas = acatada + indeferido.
- [ ] O olho abre o card "Detalhes do recurso" direto na requisição.
