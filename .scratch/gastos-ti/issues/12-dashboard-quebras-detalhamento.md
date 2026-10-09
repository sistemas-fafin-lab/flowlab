# 12 — Dashboard: quebras e detalhamento

**What to build:** abaixo da evolução mensal, o dashboard mostra o gasto por categoria
(todas, com nome próprio, numa cor só), top 10 fornecedores com % do total e %
acumulado e a frase "3 fornecedores = X% do gasto", gasto por setor, as proporções
recorrente × pontual e OPEX × CAPEX em barras 100% rotuladas, e a tabela de
detalhamento com todas as ocorrências do recorte, ordenável e exportável.

Plano: §8.3, §8.5, RF19, RF22.

**Blocked by:** 11

**Status:** done no código (falta conferir visualmente)

- [x] `domain/finops.ts`: agrupamentos por categoria, fornecedor e setor; concentração; proporções (+ testes, junto com a 11).
- [x] Gráficos de barras horizontais ordenadas, sem segundo eixo, com tabela equivalente.
- [x] Proporções como barra 100% rotulada, nunca pizza de 2 fatias.
- [x] Tabela de detalhamento ordenável + exportar `.xlsx` (botão "Exportar" no cabeçalho, reaproveita `linhasExportacaoMes`).
- [x] Filtrar não repinta as categorias que sobram (cor por `ordem`, via `slotsDeCor` sobre a lista completa).
- [x] `npx tsc --noEmit`, `npm run lint` e `npm test` sem erros novos.

## Comments

**01/Out/2026 — implementado** junto com a 11, na mesma página.

**Ajuste em relação ao plano (§8.3):** no ranking "Por categoria", cada barra usa a **cor da própria categoria**, a mesma da evolução mensal; da 9ª em diante, o cinza de "Outros". O plano previa uma cor só. A mudança mantém a identidade da categoria igual em todos os gráficos e continua aceitando quantas categorias existirem. Fornecedores e setores, que não têm cor própria, ficam numa cor só.

**Barras em HTML** (não recharts): nome e valor sempre visíveis, com rótulo direto na ponta, então nada depende do hover. Barra de 10px, com ponta arredondada e base reta.

**Fornecedores:** top 10 + "Outros (n)", com % e % acumulado em cada linha. O subtítulo diz quanto os 3 maiores somam do gasto.

**Detalhamento:**
- todas as cobranças do período, ordenáveis por mês, despesa, fornecedor, categoria, previsto e pago;
- mostra as primeiras 50, com "Mostrar todas".
