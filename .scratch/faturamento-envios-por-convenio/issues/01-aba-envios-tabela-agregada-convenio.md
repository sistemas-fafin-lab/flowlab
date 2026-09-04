# 01 — Nova aba "Envios": tabela agregada por convênio

**What to build:** dentro de "Contas a Receber" (`ContasReceberPage.tsx`),
uma nova aba (ao lado de Dashboard / Títulos / Pendências) mostra, para o
período selecionado, uma linha por convênio (fonte pagadora) com o total de
lotes enviados a ele — sem precisar selecionar um convênio antes nem criar
um título. O usuário abre a aba e já vê, de cara, uma visão macro de todos
os convênios com movimentação no período.

- Tabela com uma linha por convênio: nome do convênio, quantidade de lotes,
  quantidade de requisições/guias, valor total.
- Filtro de status por padrão restrito aos lotes "enviados" (STLOT 2 —
  Conciliação, e 3 — Faturado), com opção de expandir para os demais status
  do lote (reaproveitar o catálogo `STLOT_LABELS` já existente).
- Filtro de período com presets "Mês atual" (selecionado por padrão ao
  abrir), "Trimestre atual" (calendário — reaproveitar o utilitário
  `periodoEsteTrimestre()` já existente, usado hoje em `TitulosList.tsx`) e
  personalizado.
- Convênios sem nenhuma movimentação no período selecionado não aparecem na
  tabela (não aparecem com zero).
- Ordenação padrão por valor total decrescente.
- A agregação é feita no backend (consulta agrupando por fonte pagadora,
  filtrando por período e status), não client-side sobre resultados
  paginados — a escala de lotes no banco de origem (apLIS) não permite
  paginar tudo pra somar na tela.
- Acesso: mesma permissão que já protege a página inteira
  (`canViewBilling`) — nenhuma permissão nova.

**Blocked by:** None — can start immediately.

**Status:** done

- [x] Nova aba visível dentro de "Contas a Receber", junto de
      Dashboard/Títulos/Pendências
- [x] Ao abrir, a aba já carrega com período "Mês atual" e status "enviados"
      (Conciliação + Faturado), sem exigir nenhuma seleção prévia de
      convênio
- [x] A tabela mostra uma linha por convênio com: nome, qtd. de lotes, qtd.
      de requisições, valor total — dados de todos os convênios com
      movimentação no período, não só um selecionado
- [x] Convênio sem lote no período não aparece na lista
- [x] Tabela ordenada por valor total decrescente por padrão
- [x] Filtro de período permite trocar para "Trimestre atual" (alinhado ao
      calendário) e para um intervalo personalizado
- [x] Filtro de status permite expandir além de "enviados" para ver outros
      status de lote
- [x] A agregação é resolvida no backend (endpoint/consulta dedicada), não
      recalculada no cliente sobre páginas da listagem de lotes existente

## Comments

Implementado: `EnviosPorConvenio.tsx` (aba nova) + `useEnviosPorConvenio.ts` +
`GET /api/faturamento/envios-por-convenio` + `listarEnviosPorConvenio` em
`api/_lib/faturamento/bdLab.ts` (agregação por `IdFontePagadora` no MySQL de
backup, sem paginação).

Decisão de escopo: a agregação NÃO aplica a whitelist `fontesConsideradas`
("considerada meta") que outras telas do módulo usam — o texto da issue pede
explicitamente "uma visão macro de TODOS os convênios com movimentação no
período" (linha 8) e o critério de aceite reforça "dados de todos os
convênios com movimentação no período, não só um selecionado". Aplicar a
whitelist esconderia convênios com movimentação real só porque não foram
marcados para meta, contradizendo esse critério. Se o financeiro quiser essa
tabela restrita à mesma whitelist do Dashboard/Títulos, é um ajuste
separado.
