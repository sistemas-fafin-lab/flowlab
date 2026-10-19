# 02: Coluna Clínica e exclusão das clínicas sem NF em Particulares

**What to build:** Em Pendências → Particulares, cada requisição mostra a **Clínica**: o Local de Origem da requisição no apLIS (`requisicao.IdLocalOrigem` → `fatinstituicao`, nome fantasia). As requisições de locais de origem marcados como **"não emite NF"** somem da lista **e** do total. Um toggle "Mostrar clínicas sem NF", desligado por padrão, traz essas requisições de volta, cada linha identificada como clínica sem NF.

A lista de locais sem NF vive numa tabela nova no Supabase: `aplis_id` (inteiro, chave), nome exibido, quem marcou e quando. RLS: leitura para `canViewBilling` ou `canManageBilling`, escrita só para `canManageBilling`. A migration já insere ABAC (1155), Nexus (1290), Mater Clínica (1014) e Ecomed (1222). Os médicos com razão social "Mater Sul" ficam de fora de propósito. O handler de Particulares lê essa lista com o cliente do usuário e cache curto, no mesmo padrão em que Sem lote lê a whitelist de fontes consideradas na meta, e passa os ids para a consulta do MySQL. Parâmetro novo: `incluirSemNf=1`. Cada requisição devolvida ganha `localOrigem: { id, nome }` e `clinicaSemNf: boolean`.

Ainda não há tela para editar a lista: isso fica no ticket 03.

Spec: `.scratch/faturamento-pendencias-e-refechamento/spec.md`.

**Blocked by:** 01 (Particulares e Sem lote até hoje): mexe na mesma consulta

**Status:** ready-for-agent

- [x] A migration cria a tabela com RLS e insere os 4 locais de origem. _`20261019170000_clinicas_sem_nf.sql`, ainda **não aplicada** no Supabase: até aplicar, Particulares devolve 502 ("Não foi possível ler a lista de clínicas sem NF")._
- [x] Particulares mostra a coluna Clínica.
- [x] Sem `incluirSemNf`, as requisições dos 4 locais não aparecem e não somam no total (nem no widget do Dashboard, que chama sem o parâmetro).
- [x] Com o toggle ligado, elas aparecem e ficam visualmente marcadas como clínica sem NF (selo "Sem NF" e linha esmaecida).
- [x] Uma falha ao ler a lista no Supabase devolve erro claro, nunca uma lista sem o filtro.
- [x] Testes do handler de Particulares (bdLab e Supabase mockados): repassa os ids da lista, liga e desliga `incluirSemNf`, trata erro do Supabase. Prior art: testes de `faturamento-titulos-aplis-previa`.
- [x] Conferido à mão: Particulares de out/2026 sem requisições de ABAC, Nexus, Mater Clínica e Ecomed.

**Conferência no banco real (19/10/2026)**, chamando `listarParticularesPendentes` direto com os 4 ids (sem passar pelo handler, porque a tabela ainda não existe no Supabase): out/2026 com `incluirSemNf` dá 47 requisições, R$ 9.482,30, das quais 3 de clínica sem NF (1 Mater Clínica, 2 Ecomed); sem ele, 44 requisições, R$ 8.613,30, nenhuma dos 4 locais. Falta conferir o caminho completo (handler + RLS + tela) depois de aplicar a migration.

**Risco conhecido:** se a RLS de `clinicas_sem_nf` negar a leitura, o Postgres devolve lista vazia, não erro, e as 4 clínicas voltariam a aparecer sem aviso. Hoje a RLS usa as mesmas permissões que `autorizarFaturamento` confere antes, então não acontece; uma lista vazia de propósito (ticket 03) é legítima e não dá para distinguir.
