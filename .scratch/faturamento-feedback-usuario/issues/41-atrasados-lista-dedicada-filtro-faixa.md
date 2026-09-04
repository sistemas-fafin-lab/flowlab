Status: done
Type: feature

# Lista dedicada de atrasados/>90 dias — modal de drill-down ao clicar no widget de aging

## Onde

`src/modules/faturamento/components/ContasReceberDashboard.tsx:608-641`
(widget "Aging da carteira", gráfico de barras empilhadas por faixa
`d0_30`...`d90_mais`), `src/modules/faturamento/components/TitulosList.tsx:101-115`
(badge `diasAtraso` por linha, já existe mas sem filtro dedicado),
`src/modules/faturamento/components/FiltrosReceber.tsx` (sem filtro de faixa
de atraso).

## Contexto

Pedido explícito e repetido na transcrição: **"não pode ser só gráfico"** —
a usuária precisa de uma lista detalhada (quais operadoras, quais títulos)
por trás do agregado, com filtros e busca, especificamente para cobrança de
atraso (inclusive >90 dias). Hoje o widget "Aging da carteira" é só um
gráfico agregado por faixa, sem clique/drill-down para lista, e não existe
nenhum filtro de faixa/dias de atraso em `FiltrosReceber.tsx` (confirmado por
leitura completa do arquivo). A lista de Títulos já tem o dado (`diasAtraso`
por linha), só falta expor como filtro dedicado.

## Decisão (usuário, 2026-09-03)

Nem lista separada, nem navegação para Títulos: **clicar no widget de aging
abre um modal** com a lista detalhada por trás do agregado. O gráfico
continua como está (visão rápida); o modal é a camada de detalhe.

## O que fazer

Em `ContasReceberDashboard.tsx` (widget "Aging da carteira", linhas
608-641), adicionar `onClick` na barra/faixa clicada que abre um modal
(componente novo, ex. `AgingDetalheModal.tsx`) listando os títulos daquela
faixa: operadora, número da nota, valor e `diasAtraso`.

A busca do modal **não pode reaproveitar `useContasReceber` como está**: essa
query filtra por `data_emissao` (issue 40 muda isso para `data_vencimento`,
mas ainda é um range livre, não uma faixa de dias-de-atraso) e pagina no
servidor. Como `diasAtraso` é derivado no cliente a partir de
`data_vencimento` (`useContasReceber.ts:121`) e não existe como coluna, a
consulta do modal precisa traduzir a faixa clicada (ex. "31-60") em datas de
corte sobre `data_vencimento` — `hoje-60` a `hoje-31` — e aplicar como
`.gte/.lte('data_vencimento', ...)` na query, igual ao caminho técnico já
mapeado no comentário abaixo. Se a barra empilhada permitir clicar num
segmento por operadora especificamente (não só a faixa inteira), o modal
também filtra por `operadora_id`.

## Critérios de aceite

- Clicar em qualquer faixa do gráfico de aging abre um modal com a lista de
  títulos daquela faixa (incluindo especificamente >90 dias).
- O modal mostra operadora, número da nota, valor e dias de atraso por item.
- Fechar o modal não altera o estado/filtro da tela por trás (o gráfico
  permanece intacto).

## Referência

Levantamento de requisitos com a usuária do setor (áudio transcrito,
2026-09-03), itens "Data prevista/programada para pagamento (cobrança e
atraso)" e "Não pode ser só gráfico".

## Comments

**2026-09-03 — investigação de código (reduz o esforço da opção 1 a
"baixo"):**

Confirmado por leitura: `ContasReceberDashboard.tsx:71-87` define as faixas
categóricas (`d0_30`...`d90_mais`) só para o gráfico empilhado (linha 340-366
agrega `data.agingPorOperadora`); `FiltrosReceber.tsx` não tem nenhum campo
de faixa/atraso (varrido do topo ao fim do arquivo); `TitulosList.tsx:106-118`
já renderiza o badge `diasAtraso` por linha, sem filtro atrelado.

Achado que muda o cálculo de esforço da opção 1: `diasAtraso` **não é coluna
no banco** — é derivado no cliente a partir de `data_vencimento`
(`useContasReceber.ts:121`, `diasDeAtraso(linha.data_vencimento)`). Como a
lista é paginada no servidor (`useContasReceber.ts:190-203`, `.range()`),
filtrar `diasAtraso` só depois de já ter a página buscada quebraria
contagem/paginação — mas como a faixa é uma função direta de
`data_vencimento` (coluna real), dá pra traduzir "31-60 dias de atraso" em
`data_vencimento` entre `hoje-60` e `hoje-31` e aplicar como `.gte/.lte` na
mesma query, sem RPC nova nem migration. Ou seja: a opção 1 (filtro de faixa
em Títulos) é implementável só no front + hook, reaproveitando a infra de
filtro existente — não precisa de endpoint novo. Isso não fecha a escolha
entre opção 1/2 sozinha (mérito de produto, "cobrança como fluxo" vs.
reaproveitar tela existente), mas remove a dúvida de viabilidade técnica da
opção 1 como pré-requisito da opção 2.

**2026-09-04 — status corrigido (auditoria de issues 37-46):** já estava
implementado, o `Status` no arquivo é que tinha ficado desatualizado.
`AgingDetalheModal.tsx` existe e é montado em `ContasReceberDashboard.tsx`
(estado `detalheAging`), com `onClick` no `<Bar>` do gráfico de aging que
traduz a faixa clicada (e a operadora, quando o segmento é por operadora)
em `data_vencimento` de corte, igual ao caminho técnico já mapeado acima.
Fechar o modal só limpa `detalheAging`, sem tocar no filtro do dashboard —
os três critérios de aceite confirmados no código.
