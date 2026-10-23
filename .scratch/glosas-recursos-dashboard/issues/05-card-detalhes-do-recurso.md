# 05: Card "Detalhes do recurso": lote, requisições e as abas Justificativa, Observações e Documentos

Spec: `.scratch/glosas-recursos-dashboard/spec.md`

**What to build:** o olho de um lote abre o card lateral "Detalhes do recurso", ao lado da lista (não é modal). O topo mostra os dados do lote; abaixo vem a lista das requisições do lote. Clicar numa requisição abre as abas Justificativa, Observações e Documentos. O card também pode ser aberto direto numa requisição, sem o bloco do lote; os tickets 09 e 10 usam esse modo.

**Blocked by:** 01

**Status:** ready-for-agent

- [ ] O topo mostra nº do lote, protocolo, convênio, status e datas.
- [ ] Cada requisição mostra paciente, guia, valor recursado e valor recebido de glosa.
- [ ] Justificativa: o texto da requisição dentro do lote de recurso do apLIS.
- [ ] Observações: as tarefas do apLIS da requisição direcionadas ao setor "GLOSA - FATURAMENTO" (código 22), com data e mensagem.
- [ ] Documentos: as imagens da requisição, reaproveitando a consulta e o modal de imagens do legado que já existem.
- [ ] Existe a aba Histórico, ainda vazia ("em breve"); o ticket 06 a preenche.
- [ ] O card abre só com a requisição quando chamado sem lote.
- [ ] O card funciona nos temas claro e escuro e numa largura menor.
