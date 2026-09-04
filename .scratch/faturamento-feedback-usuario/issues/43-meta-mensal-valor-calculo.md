Status: done
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

## Investigação adicional (2026-09-03)

Os KPIs atuais do dashboard (`ContasReceberDashboard.tsx:462-527`, valores
`faturado`/`recebido`/`glosado`/`acatado`) somam sobre o **período livre**
escolhido no filtro da tela (`FiltrosReceber.tsx`), não sobre "o mês
corrente" — não existe hoje nenhum conceito de mês calendário fixo em nenhum
RPC do módulo. Uma meta mensal precisa desse conceito (mês/ano), então não dá
pra simplesmente reaproveitar o filtro de período existente; a meta precisa
de fonte de dado própria e de um cálculo que trave no mês/ano da meta,
independente do filtro que a usuária tiver selecionado na tela.

## Decisões (grilling com o usuário, 2026-09-03)

- **Meta é um valor único global** (soma de todas as fontes já marcadas
  `is_considerada_meta = true` pela issue 36) — não quebrada por
  operadora/convênio.
- **Auditoria/motivo de exceção** das flags de operadora usadas para compor
  esse cálculo (whitelist da issue 36) fica coberta pela issue 44 — não
  duplicar esse mecanismo aqui.

## Decisões assumidas (não perguntadas ao usuário, seguem padrão do módulo — revisar se o setor discordar)

- **Uma meta por mês/ano, sem repetição automática**: se o setor não
  cadastrar a meta de um mês, o dashboard mostra "meta não definida" nesse
  mês em vez de repetir silenciosamente o valor do mês anterior (evita meta
  desatualizada passar despercebida).
- **Gate `canManageBilling`**: mesmo padrão de `ClinicasParceirasModal`/
  `RegraNfModal`/`ConsideradaMetaModal`.
- **Sem tela de histórico de metas por enquanto**: só o valor do mês atual é
  exibido/editável; não é necessário navegar metas de meses passados nesta
  entrega.

## O que fazer

1. Nova tabela `metas_faturamento` (`ano INTEGER`, `mes INTEGER` 1-12,
   `valor_meta NUMERIC`, `UNIQUE (ano, mes)`, `updated_by`/`updated_at`),
   RLS seguindo o mesmo padrão de `operadoras` (`canViewBilling` para SELECT,
   `canManageBilling` para INSERT/UPDATE).
2. Modal de edição (mesmo esqueleto de `ConsideradaMetaModal.tsx`/
   `ClinicasParceirasModal.tsx`): campo único de valor (R$) para o mês/ano
   corrente, gate `canManageBilling`.
3. Novo cálculo (RPC ou handler) que soma o `faturado` do mês/ano da meta
   restrito às fontes de `listarFontesConsideradasMeta` (mesma função já
   usada pela issue 36) — não misturar com o `faturado` do período livre dos
   KPIs existentes.
4. Widget novo no dashboard: valor da meta, faturado no mês, "quanto falta"
   (`max(meta - faturado, 0)`, com estado "meta batida" quando
   `faturado >= meta`).
5. Lista dos títulos que compõem esse faturado, acessível a partir do
   widget: reaproveitar `TitulosList.tsx` com um filtro predefinido
   (mês/ano da meta + fontes da whitelist) em vez de criar uma tela nova —
   mesmo padrão do "não pode ser só gráfico/número" já resolvido para
   Pendências (issues 07/08/18/19/21/26) e para o drill-down de atrasados
   (issue 41).

## Referência

Levantamento de requisitos com a usuária do setor (áudio transcrito,
2026-09-03), item "Meta mensal" (P2).
