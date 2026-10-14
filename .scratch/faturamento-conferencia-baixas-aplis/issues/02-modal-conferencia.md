# 02 — Modal "Conferir baixas com o apLIS"

**What to build:** o botão no cabeçalho da página Contas a Receber e o modal
que lista as divergências da rota da 01. Ver `../spec.md` — seção "Frontend".

**Blocked by:** 01

**Status:** needs-triage

- [ ] Botão "Conferir baixas com o apLIS" ao lado de "Atualizar do apLIS",
      visível com `canViewBilling`, com o aviso "dados do apLIS até ontem"
- [ ] Modal no padrão do `AtualizarAplisModal`: seções por tipo com contagem e
      total da diferença; colunas título, operadora, emissão, lotes (com status
      no apLIS), recebido no sistema, glosado, recebido no apLIS, diferença,
      último recebimento no apLIS
- [ ] Ação "Abrir título" em cada linha, abrindo o `EditarTituloModal`; ao
      fechar depois de salvar, a conferência é refeita
- [ ] Exportar a lista em CSV (`;`, UTF-8 com BOM, valores em pt-BR)
- [ ] Estado vazio ("nenhuma divergência"), carregando e erro da réplica
- [ ] Segue a identidade visual do Flow LAB (skill `flowlab-identity`)

## Comments
