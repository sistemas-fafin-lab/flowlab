Status: needs-triage
Type: feature

# Meta mensal: valor configurável, cálculo faturado × meta, "quanto falta" e lista por trás do número

## Onde

`api/_lib/faturamento/fontesConsideradas.ts`,
`src/modules/faturamento/components/ConsideradaMetaModal.tsx`,
`src/modules/faturamento/components/ContasReceberDashboard.tsx:483-515`
(KPIs de valor faturado/recebido/glosado/acatado).

## Contexto

A issue 36 (03/09, mesma sessão) implementou **só a whitelist** de quais
fontes pagadoras entram no relatório de meta (`operadoras.is_considerada_meta`)
— um checkbox por operadora, sem nenhum campo numérico. O pedido de meta
mensal em si (P2 do levantamento) ainda não tem nenhuma parte implementada:

- Não existe UI para configurar o **valor** da meta mensal (nenhuma
  ocorrência de "meta_mensal"/"valorMeta" em código ou migrations).
- Não existe cálculo de **faturado no mês vs. meta**, nem "quanto falta" —
  os KPIs atuais mostram só valores absolutos (faturado/recebido/glosado/
  acatado), sem referência a nenhuma meta.
- Não existe lista detalhada dos itens que compõem o faturado por trás desse
  número (a usuária foi explícita: "não pode ser só gráfico/número").

## Perguntas para triagem

- A meta é um valor único mensal (editável todo mês), ou fixo/recorrente até
  ser alterado?
- A meta é global (soma de todas as fontes consideradas) ou pode ser
  quebrada por operadora/convênio?
- Quem pode editar a meta — mesmo gate `canManageBilling` dos outros modais
  de configuração deste módulo?
- Onde a meta mensal fica armazenada — nova tabela (ex. `metas_faturamento`
  com mês/ano/valor), já que é um valor por período, não um flag fixo como
  as whitelists existentes?

## O que fazer (após triagem)

1. Nova tabela/config para o valor da meta por mês (ou global, conforme
   decisão acima).
2. UI para o setor definir/editar o valor mensal (gate `canManageBilling`).
3. Widget no dashboard: faturado no mês (usando as fontes já filtradas pela
   whitelist da issue 36) vs. meta, com "quanto falta" calculado.
4. Lista dos títulos/lotes que compõem o valor faturado do mês, acessível a
   partir do widget (não só o número agregado).

## Referência

Levantamento de requisitos com a usuária do setor (áudio transcrito,
2026-09-03), item "Meta mensal" (P2).
