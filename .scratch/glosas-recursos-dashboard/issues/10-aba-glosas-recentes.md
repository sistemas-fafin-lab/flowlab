# 10: Aba "Glosas recentes"

Spec: `.scratch/glosas-recursos-dashboard/spec.md`

**What to build:** a aba "Glosas recentes" mostra as glosas do período, da mais recente para a mais antiga. As colunas são: data da glosa (data de recebimento da requisição), nº da guia, paciente, convênio, procedimento, motivo (catálogo de motivos do apLIS), valor glosado e status, este traduzido como no Dashboard (Aberta, Em recurso, Revertida, Definitiva).

**Blocked by:** 02, 05

**Status:** done

- [x] Respeita o período e o convênio do cabeçalho.
- [x] Tem busca por guia, paciente, convênio ou procedimento, e paginação.
- [x] Não tem caixas de seleção nem ações em lote.
- [x] O status segue a tradução do spec: Abertas = status 6; Em recurso = 7 ou 16 sem classificação final; Revertidas = deferido + deferido parcial; Definitivas = acatada + indeferido.
- [x] O olho abre o card "Detalhes do recurso" direto na requisição.

## Notas da implementação

- **Status:** `recursoGlosa.statusDashboard(foto, edições)` (testada), para a issue 11 reaproveitar. Ordem: status 6 → Aberta; 34/17 → Revertida (deferido total do apLIS, mesmo com lote não enviado ou sem recursado); deferido/deferido parcial → Revertida; acatada/indeferido → Definitiva; 7/16 restantes → Em recurso. Fora dos quatro (por exemplo, 33 ou 5 sem nada recebido desde a fixação) → null, e a tela mostra "—" com o status do apLIS no título. Status 6 é Aberta mesmo se algo foi recebido depois da fixação (leitura literal do spec).
- **Leitura:** `GET /api/faturamento/glosas-recursos-recentes` (competencia, fontePagadoraId, busca, pagina, tamanho): todas as requisições da foto no mês, ordenadas por data de recebimento (mais recente primeiro, sem data no fim). A migration `20261023200000` acrescenta à view `glosa_recurso_requisicoes_lista` o que a classificação lê (líquido, recebido, base da fixação, recursado, edições do lápis e `lote_enviado`).
- **Tela:** `GlosasRecentesLista`, sem caixas de seleção. O olho abre `DetalhesRecursoCard` só com `idRequisicao`.
- **Revisão:** saíram `PaginacaoGlosas` (usada pelas três listas), `ListaResumida` e o hook `useListaRequisicoesGlosas` (fora de lote e recentes). O mapeamento linha → `RequisicaoFoto` continua repetido em cinco handlers.
- **Pontos em aberto:** (1) a "data da glosa" é o último `DtaRecebido`, regravado a cada sincronização, então pode mudar para a data do pagamento do recurso. (2) As linhas sem status (null) entram na lista e na contagem.
- Migration **não aplicada** no Supabase. Sem ela, a aba não lê.
