# 13 — Dashboard: alertas e renovações

**What to build:** o card "Alertas FinOps" lista, ordenado por severidade e com ícone +
rótulo + cor de status: ocorrência vencida sem baixa, pago acima do previsto original
(tolerância 10%), renovação próxima sem renovação automática, renovação automática
próxima e lançamento fora da recorrência. O card "Renovações" lista as despesas que
terminam ou renovam nos próximos 90 dias, com dias restantes, valor anualizado e o selo
"renova sozinha" ou "exige decisão". Sem e-mail: tudo é calculado na leitura.

Plano: §8.3, §8.4, RF20, RF21, RN11, RN12, RN14, RN17.

**Blocked by:** 11, 07

**Status:** done no código (falta conferir visualmente)

- [x] `domain/alertas.ts` (+ teste com dados conhecidos para cada tipo), `hoje` sempre como argumento.
- [x] Desvio medido contra o previsto **original**, não o ajustado (RN11) — testado com previsão ajustada para cima que não esconde o desvio.
- [x] Card de alertas com estado vazio "tudo em dia".
- [x] Card de renovações ordenado por data.
- [x] Cores de status reservadas para alertas, nunca usadas como cor de série (composição usa os slots 1 e 2 da paleta categórica).
- [x] `npx tsc --noEmit`, `npm run lint` e `npm test` sem erros novos.

## Comments

**01/Out/2026 — implementado.**

**Regras puras, `domain/alertas.ts` (9 testes):**
- `diasAte`, em UTC.
- `terminoDaDespesa`: último dia da competência final.
- `renovacoesProximas`: até 90 dias, ordenadas, com o valor anualizado.
- `calcularAlertas`, com os 5 tipos:
  - vencida sem baixa, severidade alta;
  - pago acima do previsto original em mais de 10%, média;
  - termina dentro do aviso sem renovar sozinha, alta;
  - renova sozinha dentro do aviso, média ("hora de renegociar");
  - fora da recorrência, baixa.
  - A ordem é por severidade e, dentro dela, pela data mais urgente.

**Janela dos alertas:** os últimos 12 meses até o mês atual, com os filtros aplicados, mas **independente do período** escolhido. Uma cobrança vencida tem que aparecer mesmo que o período selecionado seja outro.

**Tela:**
- `AlertasCard`: cada alerta tem ícone e severidade para leitor de tela, e não só a cor. Mostra os 6 primeiros, com "Ver todos".
- `RenovacoesCard`: mostra os dias restantes e o selo "renova sozinha" ou "exige decisão".
