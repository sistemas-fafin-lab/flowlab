# 10: Cards "Glosa recuperada" e "Saldo pendente" no Dashboard

**What to build:** no bloco de valor do Dashboard do Contas a Receber (`kpis-valor` em `ContasReceberDashboard.tsx`), incluir dois cards depois de Faturado, Recebido, Glosado e Acatado. Pedido da usuária com mockup de 6 cards; grilling de 12/11/2026.

**Blocked by:** 04 (regra de Recuperada)

**Status:** done (implementada em 560b222 e eb00eb8, 12/11/2026)

## Decisões

- **Glosa recuperada**: tem "% do glosado" embaixo e usa a **mesma regra do funil** (`STATUS_APLIS_RECUPERADA` em `api/_lib/faturamento/glosaRecuperada.ts`). Essa regra ainda não foi confirmada pela usuária, então o card mostra uma dica dizendo que é provisória. Se a regra mudar, o card e o funil mudam juntos.
- **Saldo pendente**: tem "Total a receber" embaixo. A fórmula é **Faturado − Recebido − Acatado**, a mesma do Saldo por operadora e do funil. O mockup usava Faturado − Recebido; essa conta foi descartada para não haver dois saldos diferentes.
- **Filtros**: os dois cards obedecem ao **período** e à **operadora** do Dashboard e ignoram os filtros de lote e de nota, porque a Recuperada vem da foto de recursos do apLIS. A dica do card explica isso.
- **Glosado e Acatado** (12/11/2026, depois da implementação): os cards "Valor glosado" e "Valor acatado" deixam a tabela `glosas` (só histórico) e passam a vir da mesma rota, com os dados do apLIS. Glosado = glosa total da foto (recuperada + acatada + em disputa), Acatado = `notas.valor_glosa_acatada`. Assim Faturado − Recebido − Acatado fecha com o Saldo pendente na tela. Como os dois agora vêm da foto, também passam a ignorar os filtros de lote e de nota.
- **Layout**: a fileira passa de 4 para 6 cards em telas largas. Com menos espaço, os cards quebram em mais linhas. Os layouts salvos pelos usuários continuam funcionando, porque o widget já rola quando não cabe.

## Critérios

- [x] Para o mesmo mês e o mesmo convênio, Recuperada bate com a linha "da qual, glosa recuperada" do funil da aba Comparativos.
- [x] Saldo pendente = Faturado − Recebido − Acatado com os filtros aplicados.
- [x] Testes de função pura do cálculo e da rota, se ela mudar; `npm test` e typecheck passam.

## Entrega (12/11/2026)

- Rota `GET /api/faturamento/dashboard-glosa-saldo`; cálculo puro em `src/modules/faturamento/utils/cardsGlosaSaldo.ts`; hook `useCardsGlosaSaldo.ts`; cards em `ContasReceberDashboard.tsx` (560b222).
- "Valor glosado" e "Valor acatado" passaram a vir da mesma rota, com dados do apLIS (eb00eb8).
- Recuperada usa a mesma regra e a mesma data de glosa do funil (`dataDaGlosaNoFunil`), então continua provisória enquanto a usuária não confirmar o mapeamento da issue 04.
