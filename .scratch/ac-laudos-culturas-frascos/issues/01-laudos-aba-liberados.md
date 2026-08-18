Status: ready-for-agent
Type: task

# Laudos: aba separada para liberados

Ver contexto completo em `../spec.md` seção 1.

## Objetivo

Separar os laudos com status `laudo_completo_liberado` numa aba própria
"Liberados", tirando-os da listagem principal, e mostrar aí o histórico
completo (sem o corte de 30 dias que existe hoje).

## Arquivos envolvidos

- `src/modules/analises-clinicas/components/LaudosPage.tsx` — grid de cards
  (`grid gap-4 sm:grid-cols-2 lg:grid-cols-3`), KPIs no topo, filtros de busca
  e posto.
- `src/modules/analises-clinicas/hooks/useLaudos.ts` — fetch/CRUD, contém
  `cutoffLiberacaoIso()` e a query `.or(`status.neq.laudo_completo_liberado,liberado_em.gte.${cutoffLiberacaoIso()}`)`.
- `src/modules/analises-clinicas/components/EnvioApoioPage.tsx` — referência
  do padrão de abas do projeto (pill buttons + badge numérico + bloco
  condicional por `aba === '...'`).
- `src/modules/analises-clinicas/types.ts` — `LAUDO_STATUS_KEY`,
  `STATUS_LAUDO`, `AcLaudo`.

## O que fazer

### 1. `useLaudos.ts`

- Remover `cutoffLiberacaoIso()` e a query `.or(...)` que ela alimenta.
- A query principal (laudos "em andamento") passa a excluir totalmente
  liberados completos: `.neq('status', 'laudo_completo_liberado')`.
- Adicionar uma segunda função de fetch, ex. `fetchLaudosLiberados()`, que
  busca **apenas** `status = 'laudo_completo_liberado'`, sem filtro de data,
  ordenado por `liberado_em desc`. Chamar de forma lazy (só quando a aba
  "Liberados" for aberta pela primeira vez), para não pesar o carregamento
  inicial da página.

### 2. `LaudosPage.tsx`

- Seguir o padrão de `EnvioApoioPage.tsx`: `type Aba = 'andamento' | 'liberados'`,
  `useState<Aba>('andamento')`, array de abas com `label` + `badge` (contagem).
- Renderizar pill buttons no topo da página, acima dos filtros/KPIs atuais.
- Bloco condicional: aba "Em andamento" mostra os cards como hoje, mas com a
  query já filtrada (sem `laudo_completo_liberado`); aba "Liberados" mostra os
  cards vindos de `fetchLaudosLiberados()`.
- Os filtros de busca/posto já existentes devem continuar funcionando dentro
  de cada aba (aplicados sobre a lista correspondente à aba ativa).
- O card individual (nome, badge de status, posto/data, progresso, nota, data
  de liberação) não muda de estrutura — só muda qual lista alimenta o grid.
- KPIs no topo: manter como estão hoje (contam todos os status); não fazem
  parte do escopo desta mudança.

## Fora de escopo

- `laudo_parcial_liberado` continua na aba "Em andamento", não vai para
  "Liberados".
- Não criar paginação nesta issue — se o histórico de liberados crescer muito
  e isso virar um problema de performance, é uma issue separada.

## Critério de aceite

- Laudos com `laudo_completo_liberado` não aparecem mais na aba principal,
  independente de há quanto tempo foram liberados.
- Aba "Liberados" mostra todos os laudos completos liberados, incluindo os
  com mais de 30 dias (que hoje somem silenciosamente da consulta).
- Trocar de aba não perde o filtro de busca/posto já digitado (ou reseta de
  forma previsível — decisão de implementação, mas não pode quebrar/travar a
  tela).
