# 09: Sub-aba "Recursos fora de lote"

Spec: `.scratch/glosas-recursos-dashboard/spec.md`

**What to build:** a sub-aba "Recursos fora de lote" lista as requisições do período que não estão em nenhum lote de recurso: as de status 6 (selo "glosado sem recurso") e as de status 7 ou 16 (selo "em recurso sem lote"). Para cada uma, mostra o prazo para recorrer (regra Glosa – Recurso, contada da data de recebimento da requisição) e o selo de atraso. Serve também para a responsável conferir a limpeza dos lotes de 2026.

**Blocked by:** 03, 05

**Status:** ready-for-agent

- [ ] As colunas são as mesmas de Glosas recentes: data da glosa, guia, paciente, convênio, procedimento, motivo e valor glosado. Somam-se o selo de tipo, o prazo para recorrer e o selo de atraso.
- [ ] Respeita o período e o convênio do cabeçalho, com busca e paginação.
- [ ] Convênio sem regra mostra "—" no prazo.
- [ ] O olho abre o card "Detalhes do recurso" direto na requisição.
