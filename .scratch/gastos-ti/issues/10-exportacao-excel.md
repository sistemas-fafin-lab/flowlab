# 10 — Exportação para Excel

**What to build:** "Exportar" na aba Despesas gera um `.xlsx` com as mesmas colunas do
modelo de importação (respeitando os filtros da tela), e "Exportar" no Mês a mês gera a
lista da competência com previsto, ajustado, pago, situação e datas.

Plano: §7.1 (Exportação), RF16. Padrão: `src/components/CostControl/domain/exportacao.ts`.

**Blocked by:** 06

**Status:** done (sem migration nova)

- [x] `domain/exportacao.ts` (+ teste) montando as linhas das duas exportações.
- [x] A exportação de despesas reimporta sem erro pelo importador da 09 (as já existentes caem no aviso de duplicada).
- [x] Valores como número (não texto) e datas no formato brasileiro.
- [x] `npx tsc --noEmit`, `npm run lint` e `npm test` sem erros novos.

## Comments

**01/Out/2026 — implementado.**

**Regras puras, `domain/exportacao.ts` (3 testes):**
- `linhasExportacaoDespesas`: as 24 colunas do modelo, com competência em `mm/aaaa`, datas em `dd/mm/aaaa`, rótulos das listas e valores como número. Exporta o **valor base**, que é o mesmo que a importação grava; os reajustes não viajam na planilha.
- O teste de ida e volta passa a exportação pelo importador: entra sem erro, com os mesmos dados, e as despesas que já existem vêm marcadas como "já cadastrada", então não duplicam.
- `linhasExportacaoMes`: uma linha por cobrança, com previsto calculado, previsto com ajuste, pago, pago em, situação, forma de pagamento, NF, motivo da dispensa e observação.

**Tela:** "Exportar" na aba Despesas e no Mês a mês, nos dois casos respeitando os filtros aplicados. Os arquivos saem como `gastos_ti_despesas_<data>.xlsx` e `gastos_ti_mes_<aaaa-mm>.xlsx`.
