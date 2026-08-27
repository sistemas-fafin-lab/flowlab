Status: done
Type: research

# Dashboard Contas a Receber: confirmar quais widgets aparecem zerados

## Onde

`src/modules/faturamento/components/ContasReceberDashboard.tsx:462-533`
(KPIs "Valor faturado"/"Valor recebido"/"Valor glosado"/"Valor acatado" +
"Previsão contratual"/"Prazo médio...") e `:539-585` (`kpis-pendencias`:
"Requisições não faturadas (até M-1)" / "Particulares sem NF (até M-1)").

## Problema

Relato: "No dashboard ainda apresenta valores zerados", com print mostrando 4
cards monetários em R$ 0,00 e mais widgets abaixo (rótulos ilegíveis no print,
resolução baixa demais para OCR confiável mesmo na imagem original 444×832).

## Duas famílias de widget, diagnósticos diferentes

1. **KPIs de topo (Valor faturado/recebido/glosado/acatado, Previsão
   contratual, Prazo médio)**: fonte é `notas`/`titulos`/`glosas` (Supabase
   nativo). Já **diagnosticado e adiado** nas issues 01/05/06/12 (rodada 3):
   produção não tem uso orgânico dessas tabelas ainda (5 notas de seed em
   2026-08-18, 0 glosas). Zerado aqui é o comportamento esperado até o setor
   passar a criar títulos/baixas organicamente — **não é bug novo**, reafirmar.
2. **Widgets de pendências (`kpis-pendencias`: issue 11)**: fonte é o apLIS
   ao vivo via `bdLab.ts` (`listarLotesPendentes`/`listarParticularesPendentes`),
   que tem volume real (dezenas de milhares de requisições). Esses **não
   deveriam** estar zerados — se o print mostra ZERO nesses dois especificamente
   (não só nos 4 de cima), é bug novo a investigar (ex.: erro silencioso na
   chamada, cache retornando 0, ou a mesma causa raiz da issue 20 se o widget
   também depende de algum filtro de status/período quebrado).

## O que fazer

- Pedir ao setor (ou tirar print em resolução legível) qual(is) widget(s)
   especificamente mostram zero: só os 4 do topo (esperado, adiado) ou também
   "Requisições não faturadas" / "Particulares sem NF" (bug a investigar)?
- Se incluir os widgets de pendências: reproduzir a chamada
  (`useContasReceberDashboard.ts`) e comparar com o resultado direto de
  `listarLotesPendentes`/`listarParticularesPendentes` pro mesmo período.

## Critérios de aceite

- Fica claro quais widgets são "zerado esperado, já adiado" e quais são "bug
  novo", com plano de ação só para o segundo grupo.

## Investigado em 27/08 — família 2 (pendências) confirmada com volume real; família 1 reafirmada

Reproduzi direto no MySQL de produção (apLIS) as MESMAS condições `WHERE` de
`listarLotesPendentes`/`listarParticularesPendentes`
(`api/_lib/faturamento/bdLab.ts:942-999` e `:1214-1264`), com os mesmos
parâmetros que os widgets-resumo usam (`usePendenciasNaoFaturadas`/
`usePendenciasParticulares` com `{ pagina: 1, tamanho: 1 }`, sem
`desde`/`ate`/`operadoraId` — `ContasReceberDashboard.tsx:279-288`):

- `listarLotesPendentes`: **1682 lotes**, R$ 16.070.047,52 — cutoff M-1 =
  2026-07-31.
- `listarParticularesPendentes`: **975 requisições**, R$ 226.747,02.
- Breakdown por `Status` de `fatlote` até o cutoff confirma volume real em
  todos os status de `STATUS_PENDENCIA` ([1,2,3,6,7]), não é um efeito de
  amostra pequena.

**Conclusão**: os dois widgets de `kpis-pendencias` (issue 11) têm dado real
e substancial hoje. Se o print do setor mostrar ZERO neles especificamente,
**é bug novo** — não fica explicado por volume baixo nem por período/filtro
(o widget-resumo não aplica período algum, de propósito). Não achei bug de
código nos handlers (`api/_lib/handlers/faturamento-pendencias*.ts`) nem nos
hooks — a query, a autorização (`canViewBilling`) e o parse da resposta batem
com o resultado direto do banco. Um erro de autorização/rede também não
explicaria "zero": o hook mostra "falha ao consultar" em caso de `erro`, não
"0" (`ContasReceberDashboard.tsx:547-556`).

Família 1 (KPIs de topo, fonte Supabase `notas`) segue reafirmada como zerado
esperado (issues 01/05/06/12) — nada novo aqui.

**Ainda falta**: confirmar com o setor (ou print legível) se o zero
apareceu especificamente nos dois widgets de `kpis-pendencias`. Se sim, o
próximo passo é reproduzir ao vivo com uma sessão de teste (mesmo caminho
proposto na issue 20) para achar a causa — já que não é falta de dado nem bug
óbvio de leitura de código.

## Confirmado em 27/08 — fechada, sem bug

Resposta do usuário: só os 4 KPIs de topo apareceram zerados; os widgets de
`kpis-pendencias` ("Requisições não faturadas" / "Particulares sem NF") não
estavam entre os zerados. Confirma exatamente a família 1 (zerado esperado,
`notas` sem uso orgânico — issues 01/05/06/12) e descarta a família 2 (bug
novo) por completo. Nenhuma ação de código necessária aqui; o zerado dos 4
de topo segue rastreado nas issues 01/05/06/12, que reabrem quando `notas`
tiver volume real.

## Referência

Novo relatório de feedback do setor de faturamento (27/08). Verificação com
dado real de produção em 2026-08-27 (ver histórico da sessão).
