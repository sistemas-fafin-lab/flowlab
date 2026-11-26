# 06: Pendências de glosa

Spec: `.scratch/glosas-recursos-calendario-pendencias/spec.md`

**What to build:** no Dashboard de glosa, o bloco "Pendências de glosa" com seletor de mês e "Todo o período" e três cards (valor e quantidade): glosas sem recurso com prazo vencido, recursos com retorno atrasado e recursos com pagamento atrasado. Cada card abre a lista filtrada.

**Blocked by:** 02

**Status:** done

- [x] Função pura das pendências por recorte e hoje, usando os prazos por requisição (issue 02) e o prazo para recorrer, com os testes do spec.
- [x] O card de prazo vencido abre "Recursos fora de lote" com o filtro novo "vencidos"; os de retorno e de pagamento atrasado abrem "Lotes de recurso" com os filtros novos correspondentes.
- [x] Recurso sem data de envio não entra nos cards de atraso.
- [x] Visual das Pendências de faturamento do Contas a Receber, nos temas claro e escuro.

## Comments

- Implementada como `pendenciasDeGlosa` em `api/_lib/faturamento/recursoGlosa.ts`. A leitura da foto fica em `api/_lib/faturamento/dadosPendenciasGlosa.ts` e é a mesma do endpoint novo `glosas-recursos-pendencias` e dos filtros novos das listas. O bloco é `PendenciasGlosaBloco.tsx`.
- **Recorte:** o período do cabeçalho não filtra (como no Calendário de recursos); o convênio filtra. O mês é o mês em que o prazo venceu. Com filtro de pendência (`pendencia=vencidos | retorno-atrasado | pagamento-atrasado`, `mesVencimento`), as listas também cobrem todos os meses de faturamento e mostram um aviso; a paginação é em memória.
- **Card 1:** o universo é o da lista que ele abre (status 6, fora de qualquer lote de recurso). A requisição em lote de recurso ainda não enviado fica fora; glosa fixada em branco conta com valor 0. O calendário é diferente: só exclui lote enviado e exige glosa > 0 e motivo. A confirmar.
- **Card 2:** soma o recursado com as edições do lápis; a coluna "Valor recorrido" da lista vem da view, sem as edições.
- **Card 3:** conta requisições, e a lista aberta mostra os lotes que as contêm (o subtítulo do card dá as duas quantidades).
- **Visual:** mesmas classes do bloco do Contas a Receber (vidro, `Kpi`, variantes `dark:`). Não foi conferido no navegador: a tela exige login.
