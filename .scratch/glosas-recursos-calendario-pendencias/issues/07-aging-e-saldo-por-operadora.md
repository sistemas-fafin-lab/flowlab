# 07: Aging da glosa em recurso e Saldo de glosa por operadora

Spec: `.scratch/glosas-recursos-calendario-pendencias/spec.md`

**What to build:** no Dashboard de glosa, o aging do valor em recurso ainda em aberto, nas faixas A vencer, 1–30, 31–60, 61–90 e +90 dias desde a data de pagamento prevista, empilhado por operadora (7 maiores + Outras), com a nota "Fora das faixas". Ao lado, o saldo de glosa em disputa por operadora (10 maiores).

**Blocked by:** 02

**Status:** done

- [x] Funções puras de aging (a partir dos prazos por requisição da issue 02) e de saldo por operadora, com testes dos limites de faixa (0, 30, 31, 60, 61, 90, 91), "A vencer", fora das faixas e "Outras".
- [x] Convênio sem regra de Análise (sem vínculo ou "sem prazo") vai para "Fora das faixas" mesmo quando há data real de retorno e `prazosDasRequisicoes` dá data de pagamento (decisão de 26/11/2026). Teste para esse caso.
- [x] O saldo por operadora usa a mesma classe "em disputa" do card Glosa em disputa.
- [x] Respeita o filtro de convênio; gráficos no padrão do Aging da carteira e do Saldo por operadora do Contas a Receber, nos temas claro e escuro.

## Comments

- Implementação:
  - `agingDaGlosaEmRecurso` em `api/_lib/faturamento/recursoGlosa.ts`, sobre `prazosDasRequisicoes`.
  - `saldoDeGlosaPorOperadora` em `api/_lib/faturamento/glosaRecuperada.ts`, ao lado de `cardsValorGlosa`, porque usa a mesma `classificarParaFunil`.
  - Aging: endpoint novo `glosas-recursos-aging`, com leitura em `dadosPendenciasGlosa.ts`.
  - Saldo: vem no endpoint do Dashboard.
  - Tela: `AgingGlosaBloco.tsx`, abaixo das Pendências de glosa.
- Faixas: o dia do pagamento previsto (0 dia) ainda é "A vencer", como no aging do Contas a Receber (`atraso <= 0`).
- "Fora das faixas":
  - Separa o valor sem data de envio do valor de convênio sem regra.
  - Para isso o endpoint lê também os lotes de recurso não enviados, inclusive lotes em montagem ou abandonados, com as requisições do período.
- **Decisão (27/11/2026): período.** O aging e o saldo por operadora seguem o período do cabeçalho, isto é, o mês do lote de faturamento original da requisição, como o resto da aba.
  - No aging, os prazos continuam vindo do lote de recurso (envio, retorno real e regra).
  - No saldo, as barras somam o card Glosa em disputa, com exceção da cauda além das 10 maiores.
- **Limitação: o total do aging só fecha para requisições em lote de recurso.**
  - Requisição de lote com valor em aberto zero (por exemplo, sem valor recursado) não entra nem nas faixas nem na nota.
  - Requisição em 1º/2º recurso sem lote de recurso fica fora do universo, como o spec define. Exemplo: 66 das 143 em 2º recurso, em 26/11/2026.
