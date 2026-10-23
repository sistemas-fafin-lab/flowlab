# 06: Histórico das requisições

Spec: `.scratch/glosas-recursos-dashboard/spec.md`

**What to build:** a cada sincronização, o FlowLab compara a foto anterior de cada requisição e de cada lote com a nova e grava eventos com data. A aba Histórico do card "Detalhes do recurso" mostra esses eventos em ordem cronológica.

**Blocked by:** 05

**Status:** ready-for-agent

- [ ] Existe uma tabela de histórico (por requisição e por lote: data, tipo, valor anterior, valor novo, usuário quando houver), com RLS no padrão do faturamento.
- [ ] Geram evento:
  - entrada em lote de recurso;
  - envio do lote;
  - mudança de status da requisição, com texto legível (por exemplo, 7 → 16 "foi para 2º recurso", 7 → 18 "glosa acatada");
  - mudança no recebido.
- [ ] A primeira sincronização de uma requisição gera um único evento de "início do acompanhamento". Não há reconstrução do passado.
- [ ] A aba Histórico do card mostra os eventos.
- [ ] Testes do módulo de regras cobrem a geração de eventos a partir de duas fotos.
- [ ] Testes do handler de sincronização confirmam a gravação dos eventos.
