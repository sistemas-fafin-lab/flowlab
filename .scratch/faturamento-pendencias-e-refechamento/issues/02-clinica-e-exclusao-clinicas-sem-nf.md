# 02: Coluna Clínica e exclusão das clínicas sem NF em Particulares

**What to build:** Em Pendências → Particulares, cada requisição mostra a **Clínica**: o Local de Origem da requisição no apLIS (`requisicao.IdLocalOrigem` → `fatinstituicao`, nome fantasia). As requisições de locais de origem marcados como **"não emite NF"** somem da lista **e** do total. Um toggle "Mostrar clínicas sem NF", desligado por padrão, traz essas requisições de volta, cada linha identificada como clínica sem NF.

A lista de locais sem NF vive numa tabela nova no Supabase: `aplis_id` (inteiro, chave), nome exibido, quem marcou e quando. RLS: leitura para `canViewBilling` ou `canManageBilling`, escrita só para `canManageBilling`. A migration já insere ABAC (1155), Nexus (1290), Mater Clínica (1014) e Ecomed (1222). Os médicos com razão social "Mater Sul" ficam de fora de propósito. O handler de Particulares lê essa lista com o cliente do usuário e cache curto, no mesmo padrão em que Sem lote lê a whitelist de fontes consideradas na meta, e passa os ids para a consulta do MySQL. Parâmetro novo: `incluirSemNf=1`. Cada requisição devolvida ganha `localOrigem: { id, nome }` e `clinicaSemNf: boolean`.

Ainda não há tela para editar a lista: isso fica no ticket 03.

Spec: `.scratch/faturamento-pendencias-e-refechamento/spec.md`.

**Blocked by:** 01 (Particulares e Sem lote até hoje): mexe na mesma consulta

**Status:** ready-for-agent

- [ ] A migration cria a tabela com RLS e insere os 4 locais de origem.
- [ ] Particulares mostra a coluna Clínica.
- [ ] Sem `incluirSemNf`, as requisições dos 4 locais não aparecem e não somam no total (nem no widget do Dashboard).
- [ ] Com o toggle ligado, elas aparecem e ficam visualmente marcadas como clínica sem NF.
- [ ] Uma falha ao ler a lista no Supabase devolve erro claro, nunca uma lista sem o filtro.
- [ ] Testes do handler de Particulares (bdLab e Supabase mockados): repassa os ids da lista, liga e desliga `incluirSemNf`, trata erro do Supabase. Prior art: testes de `faturamento-titulos-aplis-previa`.
- [ ] Conferido à mão: Particulares de out/2026 sem requisições de ABAC, Nexus, Mater Clínica e Ecomed.
