# Faturamento: feedback do usuário (dashboard, faturas, contas a receber, glosas)

Status: Fases 1, 2 e 4 implementadas (issues 02/03/04/07/08/09/10/11/13/15/16/18/19 done; 14/17 wontfix); issues 01/05/06/12 seguem adiadas. Fase 5 (terceiro relatório, 27/08) com issues 20-24, todas `done`; issue 24 desmembrou a issue 25 (`needs-triage`, feature de busca de título por NF, aguardando confirmação do setor — ver comentário de 27/08 nela). Fase 6 (quarto relatório, 27/08) com issues 26-30: 26/27/28 `done`; 29 `needs-triage` (esclarecimento/produto); 30 `needs-info` (provável fora do escopo do flowlab, apLIS legado). Issue 31 (28/08, pergunta direta do usuário na sessão, fora do relatório escrito): regra de NF antes/depois do pagamento por operadora, `done`. Fase 7 (31/08, pergunta direta do usuário, fora do relatório escrito): título sem número da nota — issues 32-35, `ready-for-agent`. Issue 36 (03/09, pergunta direta do usuário, fora do relatório escrito): whitelist de fontes pagadoras consideradas para meta, `done` (migrations locais, não empurradas para produção — ver issue). Fase 8 (03/09, quinto insumo — áudio de reunião transcrito, levantamento amplo de requisitos, não um relatório de bug): issues 37-46; 37/38/39 `ready-for-agent` (gaps pontuais claros); 40/45 `needs-info` (perguntas diretas ao setor); 41/42/43/44/46 `needs-triage` (escopo a fechar). Fase 3 aguarda insumos externos (Mapa de Pagamento das Operadoras e documento de Glosas e Recursos).

Spec resultante de sessão de grilling em 2026-08-18, a partir do relatório de análise do setor de faturamento. Cada item vira uma issue própria em `issues/`. Rodada 4 de grilling em 2026-08-24 revisou um segundo relatório do setor (pós-Fase 1/2 em produção) — ver seção própria abaixo.

## Contexto

O setor de faturamento avaliou o flowlab positivamente (centraliza o que hoje vive em planilhas) e listou melhorias em 4 áreas: Dashboard, Faturas, Contas a Receber e Glosas e Recursos. Durante o grilling foram levantados fatos direto nos dados do apLIS (consultas read-only ao backup via `api/_lib/faturamento/bdLab.ts`) que fundamentam as decisões abaixo.

**Acesso ao banco real (para qualquer issue desta spec que precise investigar/verificar dado do apLIS):** o `.env` do projeto tem `DB_HOST`/`DB_PORT`/`DB_USER`/`DB_PASSWORD`/`DB_NAME=lab` apontando para um túnel ngrok já configurado — dá para consultar o MySQL real (somente leitura, mesmo banco que `bdLab.ts` usa) sem depender do ambiente do cliente nem de esperar snapshot. O schema completo das tabelas está em `/home/erudhir101/projects/import_files/schema-backup-banco.csv` (fora deste repo). Vários fatos desta spec (issues 01, 03, 08, 10) foram verificados/reconfirmados direto nesse banco em 2026-08-18. A instância Supabase local do flowlab é que não tem os dados do apLIS — isso não é bloqueio para pesquisar os dados de origem.

## Decisões já tomadas (grilling session)

- Um único spec com fases; issues 1:1 com os itens do feedback.
- Item 6 (reclassificar glosa × negativa de autorização × procedimento não autorizado) fica **estacionado** aguardando o documento específico de Glosas e Recursos; o contexto de eventos do apLIS está registrado em "Fora de escopo".
- Itens 2.1 (previsão de pagamento por operadora) e 2.5 (NFs pendentes de pagamento por convênio) **aguardam o Mapa de Pagamento das Operadoras** antes de abrir issues. O widget de previsão atual permanece como está até lá.
- **AMHP-DF** = fonte pagadora `IdInstituicao 1025` (o catálogo de regras de prazo usa a chave `AMH`). As exceções de protocolo duplicado (3.1) e de aviso "sem envio" (4) usam esse id.
- **PARTICULAR** = fonte pagadora `IdInstituicao 1102` (ativa no apLIS).
- Recebimento por requisição vem de `fatrequisicaoprocedimento.ValorRecebido`/`DtaRecebido` (populados; `ValorCobrado` nunca é preenchido).
- Pendente de recebimento = `ValorRecebido < ValorLiquido` (cobre glosa integral, VR=0), com `CodEventoFatur` (`RECEBIDO` etc.) como sinal auxiliar — alinhado à planilha do setor.
- "Não faturada" = lote apLIS sem NF/RPS (`fatlote.IdRPS` nulo) em status ativos (1, 2, 3, 6, 7), criado até o fim de M-2 (ex.: em agosto, jan–jun sem NF = pendência); verificação fina por requisição via `NFeReq`/`RPSReq` do export.
- Particulares pendentes = fonte 1102 + evento de laudo liberado (CodEvento 11, 56, 16, 1000, 9, 19 — regra da subtab "recebido" que o setor usa hoje) + sem NF.
- ~~Top 10 motivos de glosa mantém a fonte atual (glosas do flowlab); ampliar 8 → 10 + breakdown por operadora via `glosas.nota_id → notas.operadora_id`.~~ Revisto na rodada 3 — ver abaixo.
- Protocolo duplicado (3.1): badge + filtro, sem bloqueio de operação; exceção por **formato de protocolo** (não por lista de operadoras).
- Guias com `ValorRecebido = 0` (glosa integral) deixam de aparecer como recebidas — a exibição passa a usar os valores do apLIS.
- Novas áreas: widgets-resumo no dashboard + aba "Pendências" em Contas a Receber (híbrido).

### Grilling — rodada 2 (2026-08-18): escopo dos widgets do dashboard e exceção de protocolo duplicado

- **Widgets-resumo (issue 11)**: ficam restritos aos itens das issues 07 (requisições não faturadas) e 08 (particulares sem NF). Os itens "requisições recebidas parcialmente, só as pendentes" (issue 09) e "vínculo NF+lote+Aplis" (issue 12) **não** ganham widget no dashboard — decisão explícita, não lacuna: (c) é mais natural de consultar dentro do contexto do lote em Faturas; (d) é uma feature de navegação/detalhe, não uma métrica agregável.
- **Exceção de protocolo duplicado (issue 10)**: a investigação achou que a Medigest usa o mesmo padrão de protocolo-data legítimo que a AMHP-DF (ex.: `03082026`), fato não previsto no feedback original (que só pedia exceção para a AMHP). Em vez de manter/ampliar uma lista de operadoras isentas por `IdFontePagadora`, a regra passa a isentar automaticamente qualquer protocolo cujo valor seja uma **data válida no formato `DDMMYYYY`** (8 dígitos, dia 01–31, mês 01–12, ano plausível), independente da operadora. Isso cobre AMHP-DF e Medigest sem hardcode e continua marcando duplicidades reais como o protocolo `760054` (ASSEFAZ/Medigest), que não tem formato de data.

### Grilling — rodada 3 (2026-08-18): fonte de dados das issues 05 e 06 (adiadas)

- **Correção de ambiente**: o `.env` local tinha `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` apontando para o projeto **de teste** (`eqzqkztgzcngnxmihdom`, "eqk"), não o de produção. O projeto real de produção é **`jqxeqmeikqclmmongclj`** ("jqx") — confirmado via `vercel env pull` (o `VITE_SUPABASE_URL` de produção bate com esse projeto). Corrigir o `.env` local antes de qualquer issue futura que precise ler dado real do Supabase (nenhuma issue desta spec dependia disso além de 04/05/06 — 04 já foi resolvida assumindo a hipótese (c), não bloqueada por isso).
- **Achado em produção (banco `jqx`, consultado via SQL Editor em 2026-08-18)**: `notas` tem 5 linhas, todas inseridas no mesmo instante (`2026-03-27 14:45:38`, milissegundos de diferença) — claramente carga de seed/demo, não uso orgânico. `glosas` tem **0 linhas**. O módulo Títulos/Contas a Receber (que alimenta os widgets de dashboard, incluindo o RPC `fat_dashboard_receber`) não tem, na prática, nenhum dado real de glosa ou faturamento gerado pelo setor até agora — mesmo em produção.
- **Decisão**: issues 05 (top 10 motivos de glosa) e 06 (valor faturado por convênio) ficam **adiadas** (não canceladas). Motivo: construir os widgets sobre `notas`/`glosas` hoje resultaria em widgets vazios/enganosos; migrar a fonte para o apLIS (que tem 26.258 procedimentos com glosa reais) foi considerado, mas o setor optou por manter a fonte nativa do flowlab e esperar o módulo Títulos ganhar uso orgânico em vez de reformular a fonte de dado agora.
- **Critério de retomada**: revisitar quando `notas`/`glosas` tiverem volume real de uso orgânico do setor (títulos criados e baixas/glosas registradas pelo fluxo manual do flowlab, não seed). Reavaliar nesse momento se a fonte nativa já é suficiente ou se ainda vale considerar o apLIS como fonte (opção descartada nesta rodada, não permanentemente).
- **Mesmo achado se aplica às issues 01 e 12** (revisão de 2026-08-18): issue 01 investiga o KPI faturado×recebido do mesmo RPC `fat_dashboard_receber` — sem baixas reais em produção, não há divergência real pra investigar; sua parte de valor real (guia R$0 como "recebida") já está coberta pela issue 09 (apLIS, independente do módulo Títulos). Issue 12 enriquece a expansão de um título já criado — sem título real criado organicamente, não há o que validar. Ambas ficam **adiadas** pelo mesmo critério de retomada acima.

### Grilling — rodada 4 (2026-08-24): segundo relatório do setor, pós-Fase 1/2 em produção

O setor mandou um novo relatório de análise depois de testar o dashboard com as issues 02/03/07/08/10 já em produção. Boa parte do relatório reafirma itens já conhecidos (adiados ou aguardando insumo externo, sem fato novo); o restante são bugs/regressões reais na Fase 1/2 já implementada, ou pedidos novos. Issues 13-19 abaixo.

- **Itens sem fato novo, mantidos como estavam** (decisão: não abrir issue, só reafirmar aqui): item 2.2 (indicadores do dashboard sem dado — Valor Faturado/Recebido/Glosado, Previsão Contratual, Prazo Médio de Recebimento/Ponderado, Comparativo), item 2.3 (top 10 motivos de glosa + breakdown por operadora), item 2.4 valor faturado por convênio, síntese DSI itens 1 e 3 — todos batem com as issues **01/05/06/12** (adiadas por falta de dado orgânico em `notas`/`titulos`/`glosas`; ver rodada 3). Os widgets em questão (Valor faturado/recebido/glosado, Previsão contratual, Prazo médio de recebimento/ponderado) **já existem no código** (`ContasReceberDashboard.tsx:462-527`) — não é feature faltando, é a fonte de dado vazia, mesmo diagnóstico da rodada 3.
- **Itens 2.1/2.5 (previsão de pagamento e NFs pendentes por operadora) e item 6 (reclassificação de glosas)**: relatório novo ainda fala em "encaminharemos"/"documento será elaborado" — nenhum dos dois insumos veio anexado. Seguem parked, Fase 3.
- **Item 3.1 (protocolo duplicado)**: bug real na feature já implementada (issue 10) — o badge só mostra a contagem, não os lotes correlacionados. → issue 13.
- **Item 3.2 (Prejuízo sumindo)**: hipótese de causa raiz aventada nesta rodada não se confirmou na investigação de implementação (24/08) — a aba Faturas (onde mora a exceção "Prejuízo ignora período" da issue 02) não tem Views Salvas integrado (nem no front, nem na `tela` aceita pelo banco em `fat_views_salvas`), então o cenário descrito não é reproduzível no código atual. → issue 14 fechada como `wontfix`; reabrir só com reprodução passo a passo se acontecer de novo.
- **Item 4.1, lotes 6607/6608 (Plan Assiste) "não enviados"**: verificado no apLIS (24/08) — esses lotes **têm `DtaEnvio` preenchido** (21/08), não é o padrão da AMHP-DF (issue 03). Causa raiz: `dataEnvio` do título é um **snapshot gravado na criação** (`fat_criar_titulo`), nunca revalidado contra o apLIS depois. → issue 15 (revalidar ao vivo).
- **Item 4.1, filtro de clínicas parceiras**: verificado no `fatinstituicao` — Nexus/ABAC/Medigest não têm nenhuma flag que as distinga de convênio comum. É classificação de negócio nova. Decisão: lista gerenciável dentro do flowlab (não config fixa no código), gated por `canManageBilling`. → issue 16.
- **Item 4.1, filtro "Todas" vazando período/convênio**: "Todas" é o filtro de Operadora (não status). Causa não identificada por leitura de código — abre como investigação. → issue 17.
- **Item 4.2, "Sem NF (Lotes)" M-1 vs "requisições não faturadas" M-2**: na implementação (issue 07) é uma regra só, a nível de lote, sem separação. Decisão: não criar duas listas, só trocar a janela de M-2 para M-1 (`bdLab.ts:904`). → issue 18.
- **Item 4.2, Particulares sem exigir laudo**: reverte a regra da issue 08 (fonte 1102 + evento de laudo liberado + sem NF) para fonte 1102 + sem NF, sem evento — mas ganha a mesma janela M-1 da issue 18, pra não virar lista sem corte de tempo (a consulta hoje não tem nenhum cutoff). → issue 19, bloqueada por 18.

### Rodada 5 (2026-08-27): terceiro relatório do setor, pós-Fase 4 em produção

O setor mandou um novo print/relato depois das issues 13-19 (Fase 4). Diferente
das rodadas anteriores, nenhum item desta rodada foi investigado a ponto de ter
causa raiz confirmada — os prints têm resolução baixa (444×832, rótulos de
widget ilegíveis mesmo na imagem original) e um item reabre explicitamente uma
decisão de escopo já tomada. Por isso as 5 issues abertas (20-24) nascem todas
`needs-info`, com hipóteses registradas mas nada implementado ainda.

- **"Filtro de Status em Títulos não muda a lista"**: pela leitura de código
  (`useContasReceber.ts:197`, `.eq('status', status)`) não há bug óbvio de
  mapeamento de enum. Hipótese mais provável, dado o histórico de `notas`/
  `titulos` sem uso orgânico (rodada 3): a maioria dos títulos reais criados
  até agora está no mesmo status, então trocar o filtro "não muda" a lista
  porque não há diversidade de status pra filtrar — mesmo padrão das issues
  01/05/06/12, mas não confirmado. → issue 20.
- **"Requisições não faturadas deveria ser requisição sem lote, não lote sem
  NF"**: isto reabre a decisão da rodada 4 ("não criar duas listas, só trocar
  a janela de M-2 para M-1" → issue 18), mas a investigação em 27/08 (consulta
  direta ao MySQL do apLIS) achou fato novo que muda o veredito: **14.335
  requisições têm `Lote IS NULL`** (11.765 com procedimento cobrável); tirando
  Particular (1102) e Cortesia (100), sobram milhares de requisições de
  convênio (BRADESCO, CASSI, ASSEFAZ, Sul América, Medigest, GEAP, AMIL,
  AMHP-DF, INAS GDF, PMDF, TJDFT etc.) que nunca tiveram lote — 150-600/mês,
  R$8-30 mil/mês, desde pelo menos jul/2025. `listarLotesPendentes` (issue
  07/18) não enxerga nada disso, porque só olha `fatlote`. Não é reabertura de
  preferência de UX, é lacuna de cobertura real. → issue 21, promovida a
  `ready-for-agent` (nova função + card em Pendências; "Sem NF (Lotes)" perde
  o cutoff M-1 a pedido do setor, pendente só de confirmar esse detalhe
  específico).
- **"Protocolo duplicado ainda não mostra o outro lote"**: a issue 13 (done,
  commit `47dc478`) já implementa exatamente isso — `protocoloDuplicadoLabel`
  lista os lotes correlacionados a partir de uma agregação GLOBAL sobre
  `fatlote`. Pela leitura de código a feature está correta; hipótese mais
  provável é descoberta (a lista só aparece no hover do tooltip do badge) ou
  deploy desatualizado, não regressão de lógica. → issue 22.
- **"Dashboard ainda com valores zerados"**: o print mistura dois grupos de
  widget com diagnósticos opostos — os 4 KPIs de topo (Valor faturado/
  recebido/glosado/acatado) já são zero esperado e adiado (issues 01/05/06/12,
  fonte `notas`/`glosas` sem uso orgânico); os widgets de pendências (issue 11)
  usam dado ao vivo do apLIS e **não deveriam** estar zerados — não dá para
  confirmar pelo print (rótulos ilegíveis) quais especificamente aparecem em
  R$ 0,00. → issue 23.
- **"Não é possível filtrar as nfs"**: o print mostra o formulário de criação
  de título (`NovoTituloModal`: Número da nota/Emissão/Competência/Vencimento/
  Observações), que não é uma tela de filtro — o "Número da nota" ali é o
  número do título novo sendo criado. Não dá para saber pelo relato/print se o
  setor está de fato nessa tela esperando algo que ela não faz por design, ou
  se o campo problemático é outro (ex.: "Notas fiscais" em `FiltrosReceber`).
  → issue 24.

### Rodada 6 (2026-08-27): quarto relatório do setor, mesmo dia da Fase 5

O setor mandou mais feedback em texto (sem print desta vez) no mesmo dia em
que a Fase 5 fechou. Diferente da rodada 5, consegui investigar com dado real
do apLIS (túnel MySQL já configurado) e confirmar causa raiz em dois itens
antes de decidir; os demais viram issues `needs-triage`/`needs-info` por
falta de detalhe reproduzível ou por provavelmente estarem fora do escopo do
flowlab.

- **"Notas Fiscais: não cria campo de busca, preenchi algo incorreto?"**:
  mesma confusão de tela/campo já registrada na issue 25 (ver comentário
  novo lá) — mas a investigação achou que a busca por NF **já existe** e
  funciona (`TitulosList.tsx`, campo "Buscar por nota…"), só sujeita à mesma
  pegadinha de período das issues 20/27. Não abriu issue nova; anexado à 25.
- **"Notas fiscais de particulares: data inicial a partir de 2026"**: pedido
  de feature novo, sem tela confirmada ainda — → issue 28.
- **"Dashboard ainda com valores zerados, mesmo mudando os filtros"**: sem
  fato novo — mesma família 1 (KPIs de topo sobre `notas`/`titulos` sem uso
  orgânico) já diagnosticada e adiada nas issues 01/05/06/12 e reafirmada na
  issue 23 nesse mesmo dia. Filtro não muda nada porque a fonte está vazia
  independente do filtro — não abriu issue nova.
- **"Gráficos: ver quais lotes estão agrupados + dados adicionais ausentes"**:
  mesma fonte vazia dos gráficos (`ContasReceberDashboard.tsx`, `notas`/
  `titulos`) para o drill-down; "dados adicionais" ficou vago demais para
  agir sem exemplo concreto → issue 29.
- **"Contas a Receber: filtro de Status não atualiza a lista"**: sintoma
  idêntico ao da issue 20, fechada mais cedo no mesmo dia com causa raiz
  confirmada (período padrão vazio, não bug no Status). A recorrência
  independente do mesmo relato confirma que o aviso genérico "Nenhum título
  no período" não bastou — → issue 27 (mensagem de vazio mais explícita,
  `done`).
- **"Requisições sem lote: existem canceladas que não deveriam aparecer"**:
  investigação direta no MySQL do apLIS confirmou o relato — 575 de 3.430
  requisições da lista da issue 21 tinham evento "Exame Cancelado"
  (`CodEvento = 8`), R$224 mil de R$1 milhão na lista. → issue 26, corrigida
  (`done`).
- **"Poliame e outras clínicas travam a inclusão em lote"**: leitura de
  código (`bdLab.ts`) confirma que o flowlab só lê o apLIS — não cria nem
  edita lote nenhum lá. A trava relatada muito provavelmente é do sistema
  legado (apLIS), fora do alcance deste repositório → issue 30, `needs-info`
  pedindo confirmação de qual sistema antes de qualquer ação.

### Rodada 7 (2026-08-31): pedido direto do usuário — título sem número da nota

Pedido novo, fora de qualquer relatório do setor: poder criar um título em
Contas a Receber sem o número da nota e completá-lo depois, já que às vezes a
nota só sai depois do título. Grilling em duas rodadas fechou o desenho:

- Fecha uma lacuna deixada pela issue 31 (regra de NF antes/depois do
  pagamento por operadora): hoje número da nota é obrigatório em 3 camadas
  (formulário, API, RPC `fat_criar_titulo`) e `NOT NULL` no banco
  (`notas.numero_nota`) — inclusive para operadoras com `nf_apos_pagamento`,
  que por definição não têm o número na hora de criar o título.
- **Bloqueio de baixa**: baixa de título sem número é bloqueada, exceto
  quando a operadora tem `nf_apos_pagamento` ativado (aí é o fluxo esperado).
- **Editar depois**: não existe hoje nenhuma edição de título — nova ação
  "Editar Título" (`canManageBilling`, mesma permissão do `RegraNfModal`),
  restrita a esse único campo por enquanto, liberada em qualquer status
  exceto `cancelada`. Permite corrigir um número já preenchido, mas não
  apagar de volta pra vazio (só substituir).
- **Badge "Aguardando nota"**: mesma condição do bloqueio de baixa (sem
  número e sem `nf_apos_pagamento`) — evita alarme falso nas operadoras onde
  a ausência do número é esperada.

→ issues 32 (criação), 33 (editar/adicionar depois, bloqueada por 32), 34
(bloqueio de baixa, bloqueada por 32) e 35 (badge, bloqueada por 32). 33/34/35
são independentes entre si.

### Rodada 8 (2026-09-03): levantamento amplo de requisitos (áudio de reunião transcrito)

Insumo diferente de todas as rodadas anteriores: não é um relatório de bug do
setor testando o que já está em produção, é a transcrição/síntese de uma
reunião (Gabriel↔Raquel) levantando **por que** o setor precisa do módulo de
faturamento, do zero — cobre praticamente a área inteira (Títulos, Pendências,
Faturas, Glosas, Dashboard). Boa parte do que a reunião pede já existe (o
módulo evoluiu bastante desde a Fase 1), então esta rodada foi investigação de
código pura antes de abrir qualquer issue: 3 sub-agentes mapearam cada item do
levantamento contra `TitulosList.tsx`/`FiltrosReceber.tsx`/`useContasReceber.ts`
(lista de Títulos), detalhamento de lote/baixa/atrasados/meta, e integração
Apelles/exceções — usando também o `git diff` do trabalho em andamento (ainda
não commitado) nos handlers de glosas/recursos legado e pendências.

**Já implementado, sem fato novo (não abriu issue):**
- Detalhamento de lote (itens, status, NF, valores, datas) ao expandir —
  cobre o pedido integralmente em `FaturasDashboard.tsx` e `TitulosList.tsx`.
- Baixa com data + valor parcial + atualização de status — RPC
  `fat_registrar_baixa` já grava tudo isso (só falta exibir o histórico, ver
  issue 39).
- "Não pode ser só gráfico" para pendências — já resolvido pelas listas
  detalhadas de Pendências (issues 07/08/18/19/21/26).
- Indicar o que vem do Apelles vs. o que foi lançado no flowlab — já é
  explícito em toda a UI ("do apLIS" nos textos de ajuda).
- "Baixa não precisa voltar pro Apelles" — já é assim por design (`bdLab.ts`
  é só leitura, sem nenhum INSERT/UPDATE; documentado desde a issue 30).
- "Trazer glosas do Apelles" — parcialmente coberto por "Histórico (apLIS) →
  Glosas do legado"/"Recursos legado", com recorte deliberado (`Status = 3`,
  confirmado com o cliente em 24/08, ver "Fora de escopo (parked)"); gap
  residual (guia com glosa só no demonstrativo de pagamento) já está
  documentado como risco conhecido no design doc, não é fato novo.

**Decisões a confirmar da transcrição, já respondidas pela arquitetura atual
(sem precisar de issue):**
- *"Requisição é o mesmo que título, ou nível abaixo?"* → nível abaixo: a
  hierarquia hoje é título → lote(s) → requisição(ões)/guia(s), confirmado
  pela expansão de `TitulosList.tsx`.
- *"1 NF vincula 1 ou vários lotes/títulos?"* → já é N lotes por 1 título,
  decidido na criação do título (`NovoTituloModal`). Falta só a ação de
  editar esse vínculo depois de criado — issue 46.
- *"Quais são os status oficiais e o que cada um significa?"* → lista fechada
  já existe no enum `TituloStatus` (`types/index.ts`): `aberta`,
  `parcialmente_recebida`, `recebida`, `liquidada`, `glosada`, `cancelada`.

**Gaps reais, viraram issue (37-46):**
- Bug: filtro de Operadora em Títulos esconde fontes fora da whitelist de
  meta da issue 36, mesmo tendo título real — issue 37.
- Atalho "Somente pendentes" como padrão em Títulos — issue 38.
- Histórico de baixas (recebimentos) não é exibido, só o agregado — issue 39.
- Atalho de período mês/trimestre — bloqueado por decidir o campo de
  referência (emissão atual vs. vencimento vs. competência) — issue 40,
  `needs-info`.
- Visão de atrasados/>90 dias é só o gráfico de aging, sem lista/filtro de
  faixa/drill-down — issue 41.
- Nenhuma exportação (CSV/Excel) existe em nenhuma tela do módulo — issue 42.
- Meta mensal: só a whitelist de fontes existe (issue 36); falta o valor da
  meta, o cálculo faturado×meta/quanto falta, e a lista por trás do número —
  issue 43.
- Exceções por operadora (clínica parceira, NF pós-pagamento, considerada
  meta) não registram motivo/data/responsável — issue 44.
- Esclarecer se "anexar NF" significa upload de arquivo (não existe hoje,
  hoje é só o número) ou é confusão com o campo textual atual — issue 45,
  `needs-info`.
- Vincular/desvincular lote de um título já criado (hoje só na criação) —
  issue 46.

## Entrega em fases

### Fase 1 — Investigações + ajustes rápidos do dashboard

~~1. Investigar divergência faturado × recebido no dashboard (e guias R$0 como "recebidas") — issue 01.~~
2. Lotes "Prejuízo" somem por causa do período padrão do filtro (item 3.3) — issue 02.
3. Exceção AMHP-DF no aviso "sem envio" (Títulos – Aberta) — issue 03.
4. Indicar mudança de status ao longo do tempo em Títulos (item 4) — issue 04.

~~5. Widget top 10 motivos de glosa com breakdown por operadora (item 2.2) — issue 05.~~
~~6. Widget valor faturado por convênio (item 2.3) — issue 06.~~
Issues 01, 05 e 06 **adiadas** — ver "Fora de escopo (parked)".

### Fase 2 — Pendências e faturas

7. Aba "Pendências": requisições não faturadas (janela M-2) (item 2.4) — issue 07.
8. Aba "Pendências": particulares sem NF emitida (item 2.6) — issue 08 (bloqueada por 07).
9. Recebimento por requisição no lote "Recebido - parcial" (itens 3.2 e 3.2b) — issue 09.
10. Sinalizar lotes com protocolo de envio duplicado, exceto protocolos em formato de data (item 3.1) — issue 10.
11. Widgets-resumo das novas pendências no dashboard — issue 11 (bloqueada por 07 e 08).
~~12. Vínculo NF → lote → requisição do Aplis no Títulos (item 5) — issue 12.~~ **Adiada** — ver "Fora de escopo (parked)".

### Fase 4 — Segundo relatório do setor (2026-08-24), pós-produção

13. Badge de protocolo duplicado não mostra os lotes correlacionados (item 3.1) — issue 13.
~~14. Prejuízo some de novo ao aplicar View salva com período customizado (item 3.2) — issue 14.~~ **Wontfix** — cenário não reproduzível (aba Faturas não tem Views Salvas).
15. Títulos: "sem envio" preso no snapshot da criação, não revalida contra o apLIS (item 4.1, ex. Plan Assiste 6607/6608) — issue 15.
16. Títulos: filtro pra ocultar clínicas parceiras (Nexus, ABAC, Medigest etc.) (item 4.1) — issue 16.
17. Investigar filtro "Todas" (operadora) vazando NFs fora do período/convênio, incl. R$0,00 como "Recebido" (item 4.1) — issue 17.
18. Pendências "Sem NF (Lotes)": janela M-2 → M-1 (item 4.2) — issue 18.
19. Pendências Particulares: remove exigência de laudo emitido, ganha janela M-1 (item 4.2) — issue 19 (bloqueada por 18).

### Fase 5 — Terceiro relatório do setor (2026-08-27), pós-Fase 4

Todas needs-info: nenhuma tem causa raiz confirmada nem decisão de escopo
fechada ainda (ver "Rodada 5" acima). Próximo passo de cada uma é
esclarecimento com o setor antes de virar `task`.

20. Títulos: filtro de Status parece não mudar a lista (bug real vs. falta de
    diversidade de status nos dados) — issue 20.
21. Pendências: nova lista "requisições sem lote vinculado" (M-1) — lacuna de
    faturamento real, confirmada com dado do apLIS (milhares de requisições de
    convênio sem lote); "Sem NF (Lotes)" perde o cutoff M-1 — issue 21.
22. Faturas: setor não percebeu a lista de lotes correlacionados no badge de
    protocolo duplicado (issue 13, done) — descoberta/deploy, não regressão
    de lógica pela leitura de código — issue 22.
23. Dashboard: confirmar se os widgets zerados são os já adiados (01/05/06/12)
    ou se os widgets de pendências (issue 11, dado ao vivo) também zeraram —
    issue 23.
24. Esclarecer em qual tela/campo o setor tentou "filtrar as nfs" sem sucesso
    — issue 24.

### Fase 6 — Quarto relatório do setor (2026-08-27), mesmo dia da Fase 5

26. Pendências "Sem lote": excluir requisições com evento "Exame Cancelado"
    (`CodEvento = 8`) — issue 26, `done`.
27. Títulos: mensagem de lista vazia explicita período/status, reincidência
    da issue 20 — issue 27, `done`.
28. Notas fiscais de particulares: data inicial padrão a partir de 2026 —
    issue 28, `needs-triage` (tela ainda não confirmada).
29. Dashboard: drill-down de lotes nos gráficos + "dados adicionais"
    ausentes — issue 29, `needs-triage` (exemplo concreto pendente).
30. Poliame/clínicas travam inclusão em lote — issue 30, `needs-info`
    (provável fora do escopo do flowlab, apLIS legado).

### Fase 7 — Pedido direto do usuário (2026-08-31): título sem número da nota

32. Contas a Receber: criar título sem número da nota (relaxa obrigatoriedade
    em formulário/API/RPC/banco, exibição com placeholder) — issue 32,
    `ready-for-agent`.
33. Contas a Receber: adicionar/corrigir número da nota depois da criação
    (nova ação "Editar Título", `canManageBilling`) — issue 33 (bloqueada por
    32), `ready-for-agent`.
34. Contas a Receber: bloquear baixa de título sem número, exceto operadoras
    com NF pós-pagamento — issue 34 (bloqueada por 32), `ready-for-agent`.
35. Contas a Receber: badge "Aguardando nota", exceto operadoras com NF
    pós-pagamento — issue 35 (bloqueada por 32), `ready-for-agent`.

### Fase 8 — Levantamento amplo de requisitos (2026-09-03), áudio de reunião transcrito

37. Bug: filtro de Operadora em Títulos esconde fontes fora da whitelist de
    meta da issue 36 — issue 37, `ready-for-agent`.
38. Atalho "Somente pendentes" como padrão na lista de Títulos — issue 38,
    `ready-for-agent`.
39. Histórico de baixas (recebimentos) visível por título — issue 39,
    `ready-for-agent`.
40. Atalho de período mês/trimestre — aguarda confirmação do campo de
    referência (emissão/vencimento/competência) — issue 40, `needs-info`.
41. Lista dedicada de atrasados/>90 dias (drill-down do aging) com filtro de
    faixa — issue 41, `needs-triage`.
42. Exportação (CSV/Excel) das listas do módulo — issue 42, `needs-triage`.
43. Meta mensal: valor configurável, cálculo e lista por trás do número —
    issue 43, `needs-triage`.
44. Auditoria (motivo/data/responsável) nas exceções de operadora — issue 44,
    `needs-triage`.
45. Esclarecer necessidade de anexar arquivo de NF vs. campo textual atual —
    issue 45, `needs-info`.
46. Vincular/desvincular lote de um título já criado — issue 46,
    `needs-triage`.

### Fase 3 — Aguardando insumos externos (sem issues ainda)

- **2.1 Previsão de pagamento por operadora**: reconciliar o widget atual com o Mapa de Pagamento das Operadoras quando ele for encaminhado.
- **2.5 NFs pendentes de pagamento por convênio**: área específica baseada no Mapa de Pagamento.
- **Item 6 Glosas e Recursos**: reclassificação aguardando o documento específico do setor.

## Issues

- `issues/01-investigar-divergencia-faturado-recebido.md` — research, **adiada** (ver Fora de escopo)
- `issues/02-investigar-prejuizo-pesquisa-personalizada.md` — task
- `issues/03-excecao-amhp-sem-envio.md` — task
- `issues/04-investigar-nf-semelhante-entre-status.md` — task
- `issues/05-dashboard-top10-motivos-glosa-convenio.md` — task, **adiada** (ver Fora de escopo)
- `issues/06-dashboard-valor-faturado-convenio.md` — task, **adiada** (ver Fora de escopo)
- `issues/07-pendencias-requisicoes-nao-faturadas.md` — task
- `issues/08-pendencias-particulares-sem-nf.md` — task
- `issues/09-lote-parcial-recebimento-por-requisicao.md` — task
- `issues/10-lotes-protocolo-duplicado.md` — task
- `issues/11-dashboard-widgets-pendencias.md` — task (bloqueada por 07 e 08)
- `issues/12-titulos-vinculo-nf-lote-requisicao.md` — task, **adiada** (ver Fora de escopo)
- `issues/13-protocolo-duplicado-lista-lotes-correlacionados.md` — task
- `issues/14-prejuizo-ignora-periodo-view-salva.md` — task
- `issues/15-titulos-revalidar-envio-ao-vivo.md` — task
- `issues/16-titulos-filtro-clinicas-parceiras.md` — task
- `issues/17-investigar-filtro-todas-titulos-fora-periodo.md` — research
- `issues/18-pendencias-sem-nf-janela-m1.md` — task
- `issues/19-pendencias-particulares-remove-laudo-aplica-m1.md` — task (bloqueada por 18)
- `issues/20-titulos-filtro-status-sem-efeito.md` — research
- `issues/21-pendencias-separar-sem-nf-sem-lote.md` — task, ready-for-agent (lacuna confirmada no apLIS)
- `issues/22-protocolo-duplicado-nao-percebido.md` — research
- `issues/23-dashboard-widgets-zerados-confirmar-quais.md` — research
- `issues/24-novo-titulo-campo-filtro-nf-indefinido.md` — research
- `issues/25-buscar-titulo-existente-por-numero-nf.md` — feature, needs-triage
- `issues/26-pendencias-sem-lote-exclui-exame-cancelado.md` — task, done
- `issues/27-titulos-mensagem-vazio-explica-periodo.md` — task, done
- `issues/28-particulares-data-inicial-2026.md` — feature, needs-triage
- `issues/29-dashboard-graficos-drilldown-lotes.md` — feature, needs-triage
- `issues/30-poliame-trava-inclusao-lote-apLIS.md` — research, needs-info
- `issues/32-titulo-criar-sem-numero-nota.md` — task, ready-for-agent
- `issues/33-titulo-editar-adicionar-numero-nota.md` — task, ready-for-agent (bloqueada por 32)
- `issues/34-titulo-bloquear-baixa-sem-numero-nota.md` — task, ready-for-agent (bloqueada por 32)
- `issues/35-titulo-badge-aguardando-nota.md` — task, ready-for-agent (bloqueada por 32)
- `issues/37-titulos-filtro-operadora-esconde-fora-whitelist-meta.md` — task, ready-for-agent
- `issues/38-titulos-atalho-somente-pendentes.md` — task, ready-for-agent
- `issues/39-titulos-historico-baixas.md` — task, ready-for-agent
- `issues/40-titulos-filtro-periodo-atalho-mes-trimestre.md` — task, needs-info
- `issues/41-atrasados-lista-dedicada-filtro-faixa.md` — feature, needs-triage
- `issues/42-exportacao-csv-excel.md` — feature, needs-triage
- `issues/43-meta-mensal-valor-calculo.md` — feature, needs-triage
- `issues/44-auditoria-toggles-excecao-operadora.md` — feature, needs-triage
- `issues/45-esclarecer-anexar-nf-arquivo.md` — research, needs-info
- `issues/46-titulo-vincular-desvincular-lote-pos-criacao.md` — feature, needs-triage

## Fora de escopo (parked)

- **Item 6 — reclassificação de glosas**: aguardando o documento específico de Glosas e Recursos. **Achado pontual corrigido em 24/08** (fora deste ciclo de issues, direto no teste do usuário): a tela "Histórico (apLIS) → Glosas do legado" (`HistoricoGlosasLegado.tsx`, feature à parte, ver `docs/plans/faturamento/glosas-recursos-legado-design.md`) listava negativa de autorização (ex. "3051 DOCUMENTAÇÃO EM ANÁLISE") junto com glosa real. Regra final confirmada com o cliente: só conta como glosa a requisição de um lote com `fatlote.Status = 3` (Faturado), literal — não os demais status pós-envio (4 Recebido, 6 Exportado TOTVS, 7 Recebido - parcial, que também foram cogitados e descartados). Corrigido em `filtroGlosasLegado` (`api/_lib/faturamento/bdLab.ts`) com `JOIN fatlote` + `Status = 3`, substituindo a heurística inicial por `DtaRecebido`/`ValorRecebido`. Volume real: ~2.699 linhas (de ~26 mil sem filtro). Resolve só essa tela; a reclassificação completa abaixo (glosa × negativa de autorização × procedimento não autorizado × ocorrência administrativa) para o resto do módulo segue estacionada. Contexto registrado para o documento futuro: a classificação (glosa × negativa de autorização × procedimento não autorizado × ocorrência administrativa) pode usar os eventos do apLIS — `CodEvento` (tabela `evento`) 57 (Aguarda autorização do convênio), 58 (Aguarda resolução de não conformidade), 1021 (Amostra Pendente de PGTO.), 1036 (Autorização para o Laboratório LAP), 1040 (Requisição para pagamento no particular — rótulo com typo no banco: "Requsição"), 1041 (Requisição criada para faturamento, ativo; o 1049 é inativo), 1022 (FAT. EXTERNO), 1039 (APENAS PARA FATURAMENTO DA SULAMERICA), 1008 (FATURAMENTO ENCERRADO) — além de `CodEventoFatur` (tabela `eventofatur`: 1 AGUARDANDO FATURAMENTO, 2 FATURAMENTO EM PROGRESSO, 3 AGUARDANDO RE-FATURAMENTO, 5 RECEBIDO, 6 GLOSADO ainda SEM RECURSO, 7 RECURSO DE GLOSA - 1º RECURSO, 8 GLOSA DEFINITIVA - ACATADA DIRETORIA, 11 CONCILIAÇÃO - AGUARDANDO, 14 AGUARDANDO CARÊNCIA, 15 RECURSO NÃO ACATADO) e `IdMotivoGlosa`/`DesMotivoGlosa` (ex.: 1702 = COBRANÇA DE PROCEDIMENTO EM DUPLICIDADE; 2902 = GLOSA MANTIDA). Esses valores foram verificados no banco e estão documentados no export que o setor usa (projeto csv-filter, `filtros.md`; schema em `import_files/schema-backup-banco.csv`).
- **Itens 2.1 e 2.5**: retomados quando o Mapa de Pagamento das Operadoras chegar.
- **Issues 01, 05, 06 e 12**: adiadas — `notas`/`titulos`/`glosas` (Supabase, produção) não têm uso orgânico do setor ainda (5 notas de seed, 0 glosas reais, verificado em 2026-08-18). Issue 01 (KPI faturado×recebido) e issue 12 (vínculo NF→lote→requisição na expansão do título) dependem da mesma base sem dado real. Retomar todas as quatro quando o módulo Títulos tiver volume real; ver "Grilling — rodada 3" acima para o achado completo e a alternativa descartada (migrar para o apLIS).
- **Preencher `DtaEnvio` no apLIS** (não é escopo do flowlab; a exceção AMHP-DF cobre o sintoma).
- **Reafirmado pelo relatório de 24/08 (rodada 4), sem fato novo**: itens 2.1/2.5 (previsão por operadora, ainda sem Mapa de Pagamento), item 6/glosas (ainda sem doc "Zero Glosa"), e os itens que batem com as issues 01/05/06/12 (indicadores do dashboard sem dado por falta de uso orgânico em `notas`/`titulos`/`glosas`) — ver "Grilling — rodada 4" acima.
