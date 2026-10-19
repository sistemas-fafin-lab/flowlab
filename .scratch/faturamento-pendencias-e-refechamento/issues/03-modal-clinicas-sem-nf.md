# 03: Modal "Clínicas sem NF" editável

**What to build:** Na aba Pendências → Particulares, o gestor de faturamento abre o modal **"Clínicas sem NF"**. Ali ele vê as clínicas marcadas, busca locais de origem do apLIS pelo nome, adiciona e remove. Quem não tem `canManageBilling` abre o modal só para leitura, para entender por que uma requisição não aparece. Depois de salvar, a lista de Particulares recarrega com a nova exclusão.

Endpoint novo de busca de locais de origem no apLIS por nome, restrito a quem tem acesso a faturamento: devolve id, nome fantasia e razão social, com LIKE escapado e resultado limitado, sem paginação. O modal segue o padrão do modal "Considerada na meta". A escrita vai direto na tabela do ticket 02, com a RLS como gate.

Spec: `.scratch/faturamento-pendencias-e-refechamento/spec.md`.

**Blocked by:** 02 (Coluna Clínica e exclusão das clínicas sem NF)

**Status:** ready-for-agent

- [ ] O botão "Clínicas sem NF" na aba Particulares abre o modal com a lista atual.
- [ ] A busca por nome traz locais de origem do apLIS (ex.: "nexus" → NEXUS 1290).
- [ ] Adicionar ou remover um local reflete na lista de Particulares depois de recarregar.
- [ ] Sem `canManageBilling`, o modal é só leitura, e a RLS recusa escrita direta.
- [ ] O endpoint de busca exige sessão com acesso a faturamento e trata termo vazio ou curto.
- [ ] Testes do endpoint de busca (bdLab mockado): autorização, parâmetro inválido, resultado.
