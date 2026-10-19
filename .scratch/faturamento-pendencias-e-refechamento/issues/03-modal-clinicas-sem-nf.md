# 03: Modal "Clínicas sem NF" editável

**What to build:** Na aba Pendências → Particulares, o gestor de faturamento abre o modal **"Clínicas sem NF"**. Ali ele vê as clínicas marcadas, busca locais de origem do apLIS pelo nome, adiciona e remove. Quem não tem `canManageBilling` abre o modal só para leitura, para entender por que uma requisição não aparece. Depois de salvar, a lista de Particulares recarrega com a nova exclusão.

Endpoint novo de busca de locais de origem no apLIS por nome, restrito a quem tem acesso a faturamento: devolve id, nome fantasia e razão social, com LIKE escapado e resultado limitado, sem paginação. O modal segue o padrão do modal "Considerada na meta". A escrita vai direto na tabela do ticket 02, com a RLS como gate.

Spec: `.scratch/faturamento-pendencias-e-refechamento/spec.md`.

**Blocked by:** 02 (Coluna Clínica e exclusão das clínicas sem NF)

**Status:** ready-for-human — código pronto; falta validar a tela depois de aplicar a migration `20261019170000_clinicas_sem_nf.sql` (em 19/10/2026 a tabela ainda não existe no Supabase).

- [x] O botão "Clínicas sem NF" na aba Particulares abre o modal com a lista atual. _`ClinicasSemNfModal.tsx`, lido direto de `clinicas_sem_nf` com o cliente da sessão._
- [x] A busca por nome traz locais de origem do apLIS (ex.: "nexus" → NEXUS 1290). _`GET /api/faturamento/locais-origem?busca=` (`buscarLocaisOrigem` em `bdLab.ts`: `fatinstituicao.Local = 1`, nome fantasia ou razão social, LIKE escapado, até 20). A consulta foi conferida no banco real: "nexus" devolve só a 1290._
- [x] Adicionar ou remover um local reflete na lista de Particulares depois de recarregar. _Ao fechar o modal com alteração, a aba limpa o cache de Particulares (memória e localStorage, inclusive o do widget do Dashboard) e recarrega com `semCache=1`, que renova o cache de 60s da lista no servidor._
- [x] Sem `canManageBilling`, o modal é só leitura, e a RLS recusa escrita direta. _Sem a permissão, a busca e os botões de remover somem. Uma inclusão recusada pela RLS vira erro; uma exclusão que a RLS barra (0 linhas) também aparece como falha._
- [x] O endpoint de busca exige sessão com acesso a faturamento e trata termo vazio ou curto. _401 sem sessão, 403 sem canViewBilling/canManageBilling, 400 com termo de menos de 2 ou mais de 100 caracteres._
- [x] Testes do endpoint de busca (bdLab mockado): autorização, parâmetro inválido, resultado. _`faturamento-locais-origem.test.ts`._
- [ ] Conferido à mão na tela: abrir o modal, adicionar e remover um local, ver a lista de Particulares mudar; com usuário sem `canManageBilling`, só leitura. **Depende de aplicar a migration.**
