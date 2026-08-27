Status: done
Type: research

# Faturas: usuário relata que protocolo duplicado ainda não mostra o outro lote

## Onde

`src/modules/faturamento/components/FaturasDashboard.tsx:82-86`
(`protocoloDuplicadoLabel`) e `:546-551` (badge + `Tooltip`).

## Problema

Relato: "Na parte de protocolo duplicado aparece o lote que tem o protocolo
duplicado, porém não aparece qual foi o outro lote duplicado."

Isso é exatamente o que a issue 13 (done, commit `47dc478`) resolveu:
`protocoloDuplicadoLabel` já monta `"Protocolo duplicado com o(s) lote(s) X,
Y"` a partir de `lote.protocoloDuplicadoLotes`, que vem de uma agregação
GLOBAL sobre `fatlote` (`protocolosDuplicados` em `bdLab.ts:343-381`, não
restrita ao período filtrado). Pela leitura de código, a informação pedida já
está implementada e correta.

## Hipóteses (nenhuma confirmada ainda)

1. **Descoberta**: o texto só aparece em um `Tooltip` (hover) sobre o badge
   "protocolo duplicado" — o usuário pode não ter percebido que precisa passar
   o mouse, e só vê a contagem/badge à primeira vista (o feedback foi escrito
   como texto, sem print desta tela específica, então não dá pra confirmar se
   ele chegou a interagir com o badge).
2. **Deploy**: verificar se o commit `47dc478` já está na versão que o setor
   está testando (checar `vercel ls`/branch de produção).
3. **Dado real**: se o outro lote do grupo está fora do período/filtro atual
   da aba Faturas, o número aparece no tooltip mas o usuário não consegue
   *encontrá-lo* na tabela sem trocar o filtro — o que bateria com "não
   aparece" mesmo com o dado correto no tooltip.

## O que fazer

- Confirmar com o setor se ele testou o hover no badge, e se sim, o que viu.
- Se for (1), considerar tornar a lista de lotes correlacionados visível sem
  hover (ex.: texto inline abaixo do badge) — resolve (1) e reduz o risco de
  descoberta baixa também se for (3) combinado com um link que troca o filtro
  (já cogitado, não obrigatório, no critério de aceite original da issue 13).
- Confirmar se o deploy em uso já tem o commit `47dc478`.

## Critérios de aceite

- Diagnóstico aponta causa (descoberta/deploy/dado fora do filtro) antes de
  qualquer mudança de código nova.

## Investigado em 27/08 — hipóteses (2) e (3) descartadas, (1) confirmada por leitura de código

- **Deploy (2) descartado**: `47dc478` está em `main` desde 2026-08-24
  (3 dias antes deste feedback), sem nada pendente de merge sobre
  `FaturasDashboard.tsx` depois dele. Não é bundle desatualizado.
- **Dado real (3) descartado como causa isolada**: `protocolosDuplicados`
  (`api/_lib/faturamento/bdLab.ts:343-381`) agrega `fatlote` inteira, sem
  filtro de período/status, e `normalizarLote` (`:507-528`) monta
  `protocoloDuplicadoLotes` como o grupo inteiro MENOS o próprio lote —
  sempre com pelo menos 1 item quando `protocoloDuplicado` é `true` (o mapa só
  guarda protocolos com `COUNT(*) > 1`). O texto do tooltip
  (`protocoloDuplicadoLabel`, `FaturasDashboard.tsx:82-86`) sempre lista os
  outros lotes corretamente — não há caminho de código em que o dado exista e
  o tooltip mostre só a contagem.
- **Descoberta (1) confirmada como causa mais provável**: o badge renderizado
  (`FaturasDashboard.tsx:546-551`) mostra só o texto fixo "protocolo
  duplicado" — nenhum número de lote nem contagem aparece sem interação. O
  `Tooltip` (`src/components/Tooltip.tsx`) é puramente CSS via
  `group-hover`/`group-focus` ausente: sem `:focus`, sem suporte a toque
  (`pointer-events-none` no balão, `opacity-0`/`invisible` até
  `group-hover`). Em touch/mobile isso normalmente não abre nada ao tocar (sem
  hover real), e mesmo no desktop exige o usuário saber que deve passar o
  mouse sobre um badge que não sinaliza ser interativo (sem ícone de info,
  sem sublinhado, sem `cursor-help`). Isso bate com o relato: o usuário via o
  lote com "protocolo duplicado" mas não "o outro lote".

## Encaminhamento

Diagnóstico fechado sem precisar de reprodução ao vivo — a causa mais provável
(baixa descoberta do hover) é verificável só pelo código e pelo comportamento
padrão de `group-hover` em touch. Próximo passo é implementação, não mais
pesquisa: tornar a lista de lotes correlacionados visível sem hover (texto
inline abaixo/ao lado do badge, como já cogitado no critério de aceite
original da issue 13) — resolve tanto por desktop quanto touch, e não depende
de o usuário adivinhar que o badge é interativo.

## Referência

Novo relatório de feedback do setor de faturamento (27/08). Investigação por
leitura de código em 2026-08-27 (ver histórico da sessão).

## Implementado em 27/08

- `src/modules/faturamento/utils/formato.ts`: nova `protocoloDuplicadoLotesLabel(lotes, contagem)`,
  extraída da antiga `protocoloDuplicadoLabel` local do componente — só monta o
  texto ("lote(s) X, Y" / "N lotes" / "—"), sem a repetição de "Protocolo
  duplicado" (isso já é o texto do badge ao lado). Testada em
  `formato.test.ts`.
- `FaturasDashboard.tsx` (coluna do lote, ~536-560): o badge "protocolo
  duplicado" perdeu o `Tooltip` (hover-only, sem foco/toque) e ganhou uma
  segunda linha visível abaixo dele, sempre renderizada quando
  `lote.protocoloDuplicado`, com a lista de lotes correlacionados. Não
  depende mais de hover — resolve desktop e touch igual.
- `npm run test` (224 testes) e `tsc --noEmit` passando.

## Verificado em 27/08

Confirmado manualmente no navegador (filtro "Protocolos duplicados" na aba
Faturas): lote 6215 (FASCAL) mostra o badge "protocolo duplicado" com
"lote(s) 3324" visível logo abaixo, sem hover. Drill-down do lote (5
requisições, protocolo 142158) segue funcionando normalmente — sem
regressão. Issue fechada.
