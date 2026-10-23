# 05: Card "Detalhes do recurso": lote, requisições e as abas Justificativa, Observações e Documentos

Spec: `.scratch/glosas-recursos-dashboard/spec.md`

**What to build:** o olho de um lote abre o card lateral "Detalhes do recurso", ao lado da lista (não é modal). O topo mostra os dados do lote; abaixo vem a lista das requisições do lote. Clicar numa requisição abre as abas Justificativa, Observações e Documentos. O card também pode ser aberto direto numa requisição, sem o bloco do lote; os tickets 09 e 10 usam esse modo.

**Blocked by:** 01

**Status:** ready-for-agent

- [x] O topo mostra nº do lote, protocolo, convênio, status e datas.
- [x] Cada requisição mostra paciente, guia, valor recursado e valor recebido de glosa.
- [x] Justificativa: o texto da requisição dentro do lote de recurso do apLIS.
- [x] Observações: as tarefas do apLIS da requisição direcionadas ao setor "GLOSA - FATURAMENTO" (código 22), com data e mensagem.
- [x] Documentos: as imagens da requisição, reaproveitando a consulta e o modal de imagens do legado que já existem.
- [x] Existe a aba Histórico, ainda vazia ("em breve"); o ticket 06 a preenche.
- [x] O card abre só com a requisição quando chamado sem lote.
- [x] O card funciona nos temas claro e escuro e numa largura menor.

## Comments

**Implementado (23/10/2026).** Decisões tomadas na implementação, para revisar:

- **Endpoint:** `GET /api/faturamento/glosas-recursos-detalhe` com dois modos. `?idLoteRecurso=N` devolve as requisições do lote da foto, em qualquer mês. `?idRequisicao=N` devolve a requisição da foto, mais a justificativa e as observações lidas ao vivo do apLIS. A requisição que não está na foto recebe 404.
- **Topo do lote:** o card recebe a linha da lista (`LoteRecursoFoto`), que já traz retorno e pagamento previstos e o selo. Com isso não se repete o cálculo de prazos.
- **Valor recebido de glosa** = ΔRec (`valorRecebidoGlosa` em `recursoGlosa.ts`, com teste), a mesma conta da classificação. Fica "—" no deferido total sem lote.
- **Justificativa:** é por procedimento (`fatloterecursoprocedimento.Justificativa`, no lote de recurso da foto), com o código e a descrição do procedimento, o valor recursado e o motivo da glosa. A requisição fora de lote não tem justificativa.
- **Observações:** vêm de `tarefa` com `CodSetor = 22`, da mais recente para a mais antiga, com tipo, remetente, mensagem, situação (em aberto ou concluída) e a observação de conclusão.
- **Aba inicial:** é Justificativa, enquanto o Histórico mostra "em breve". Quando o ticket 06 preencher o Histórico, vale abrir nele.
- **Modo só requisição:** `<DetalhesRecursoCard idRequisicao={n} onClose={...} />`, sem `lote` (para os tickets 09 e 10).
- **Largura menor:** abaixo de `xl` o card desce para baixo da lista e a tela rola até ele. O olho fica na primeira coluna, para não sumir na rolagem horizontal da tabela.
- **Requisição que foi para outro lote:** a lista do lote vem de `glosa_recurso_requisicoes.id_lote_recurso`, ou seja, do lote mais recente de cada requisição (decisão do ticket 01). Quando a requisição vai para o 2º recurso num lote novo, ela some do card do lote antigo. A justificativa mostrada é sempre a do lote mais recente.
- **Contagem:** a linha da lista soma só o mês do recorte, mas o card lista as requisições do lote em todos os meses. Por isso o card mostra o mês de faturamento de cada requisição e avisa "Todos os meses de faturamento".
- **Dev:** as rotas de Glosas e Recursos (01–05) e as de imagens não estavam no espelho de dev do `vite.config.ts` e foram incluídas, junto com o `res.send` para os bytes da imagem.

**Achado — documentos não abrem (vale um ticket próprio):** a aba Documentos lista as imagens e abre o visualizador do legado no documento clicado, mas a imagem aparece quebrada. Todos os blobs de `requisicaoimagem.Img` no MySQL de backup estão sem nenhum byte `0xFF`: as 24.404 imagens, inclusive as digitalizadas hoje, e nenhuma das 350 de outubro tem `0xFF`. O JPEG perde todos os seus marcadores e não há como reconstruí-lo. A perda vem da réplica, não do FlowLab. Caminhos possíveis: corrigir a cópia do backup, ou buscar o arquivo ao vivo no módulo `imagem` do site do apLIS.

**Não verificado de ponta a ponta:** o Supabase de dev não tem as tabelas da foto (migrations das issues 01 a 04 não aplicadas). O card foi conferido no navegador com a lista e o detalhe simulados (dados reais do lote 169). A consulta ao apLIS (justificativa e tarefas) foi conferida ao vivo, e a lista de documentos usou a rota real.
