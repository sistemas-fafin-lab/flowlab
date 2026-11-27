# 09: Recursos por instância no Dashboard

Spec: `.scratch/glosas-recursos-calendario-pendencias/spec.md`

**What to build:** no Dashboard de glosa, três cards (1º, 2º e 3º recurso) com quantidade, valor recorrido e valor recuperado, e um gráfico de 6 meses com o valor recorrido por instância, pelo mês do lote original.

**Blocked by:** 08

**Status:** done

- [x] Função pura do resumo por instância vigente, com testes (sem instância fica fora; editada vence observada; meses sem dado).
- [x] Respeita os filtros de período e convênio; cards e gráfico no padrão do Dashboard de glosa, nos temas claro e escuro.

## Comments

- Implementado em 27/11/2026.
  - `recursosPorInstancia` em `api/_lib/faturamento/glosaRecuperada.ts`, ao lado de `cardsValorGlosa`, porque usa a mesma `classificarParaFunil`. Testada em `glosaRecuperada.test.ts`.
  - Os cards somam por instância vigente (`instanciaDoRecurso`):
    - a quantidade;
    - o valor recorrido (`recursadoEfetivo`, o editado pelo lápis ou o do apLIS);
    - o valor recuperado (a classe "recuperada" do funil, a mesma do card Glosa recuperada).
  - O gráfico mostra o valor recorrido por instância nos 6 meses até o período, com zero nos meses sem dado.
  - Leitura: vem no endpoint do Dashboard (`recursosPorInstancia`), que passou a ler `instancia_observada` e `instancia_editada`. Respeita o período e o convênio do cabeçalho.
  - Tela: `RecursosPorInstanciaBloco.tsx`, abaixo do Aging/Saldo por operadora e acima dos gráficos que já existiam.
- Revisão: a taxa recuperado ÷ recorrido em cada card foi retirada. O spec não pede essa taxa, e ela seria calculada no cliente.
