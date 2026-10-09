# 14 — Orçamento anual por categoria

**What to build:** a aba Orçamento permite cadastrar, por ano, um valor anual para cada
categoria (dividido igualmente pelos 12 meses). O dashboard passa a mostrar o KPI
"Orçamento consumido" como medidor (substituindo o estado vazio), a linha do orçamento
mensal na evolução (no mesmo eixo), o gráfico orçado × realizado por categoria e o
alerta de categoria acima de 90%/100%.

Plano: §4.1 (`ti_orcamentos`), §8.3, §8.4, RF23, RN13, D10.

**Blocked by:** 11

**Status:** done no código (falta aplicar a migration e conferir visualmente)

- [x] Migration: `ti_orcamentos` (UNIQUE `ano` + `categoria_id`), RLS e auditoria.
- [x] `useOrcamentosTI` + `OrcamentoPage`: grade categoria × valor anual para o ano escolhido, copiar do ano anterior.
- [x] Orçado × realizado e % consumido (+ testes) — em `domain/orcamento.ts`, não em `finops.ts`.
- [x] KPI medidor, linha de orçamento na evolução (um eixo só), gráfico por categoria com marcador de meta.
- [x] Alerta de orçamento (+ teste).
- [x] `npx tsc --noEmit`, `npm run lint` e `npm test` sem erros novos.

## Comments

**02/Out/2026 — implementado.**

**Migration `20261009170000_gastos_ti_orcamentos.sql`** (16 testes no PGlite, **ainda não aplicada**):
- `ti_orcamentos (ano, categoria_id, valor_anual ≥ 0, observacao)`, UNIQUE `(ano, categoria_id)`.
- Carimbos de criação/alteração, auditoria em `ti_auditoria` e RLS igual ao resto do módulo: leitura com `canViewGastosTI` ou `canManageGastosTI`, escrita só com `canManageGastosTI`.
- FK para `ti_categorias` sem cascata (NO ACTION): uma categoria com orçamento não pode ser apagada.

**Regras puras, `domain/orcamento.ts` (11 testes):**
- `statusConsumo`: abaixo de 90% ok, de 90% a 100% atenção, acima de 100% estourado.
- `orcadoPorMes`: anual ÷ 12 (RN13). Um ano sem orçamento devolve `null`, e não zero, para a linha do gráfico ficar em branco em vez de parecer "orçamento zero".
- `realizadoPorCategoria`: soma de `valor_pago` dos lançamentos pagos cuja competência cai no ano.
- `orcadoRealizadoPorCategoria`: primeiro as categorias com orçamento, da mais consumida para a menos; no fim, as que gastaram sem orçamento.
- `consumoDoAno`: pago até agora ÷ orçamento do ano inteiro, mais o "ritmo" (% do ano decorrido) para o marcador do medidor.
- `alertasDeOrcamento`: média a partir de 90%, alta acima de 100%.
- `ordenarAlertas` (em `alertas.ts`, com teste) junta os alertas de orçamento com os outros sem perder a ordem por severidade.

**Tela de orçamento (`/it/gastos/orcamento`):** seletor de ano, uma linha por categoria com o valor anual e o equivalente mensal, "Copiar de {ano − 1}" e "Salvar". Campo vazio tira o orçamento daquela categoria naquele ano. Quem só tem `canViewGastosTI` vê a grade só para leitura.

**Dashboard:**
- **KPI "Orçamento {ano}":** mostra o % usado, quanto foi pago de quanto foi orçado e um medidor com marcador do ritmo do ano. O status vem com ícone e texto. Sem orçamento, mostra "—" e, para quem pode gerenciar, um link para cadastrar.
- **Linha tracejada "orçamento mensal"** na evolução, no mesmo eixo em R$, e uma coluna "Orçamento" na tabela equivalente.
- **Widget "Orçado × realizado por categoria":** barra na cor da categoria, traço vertical no orçado, status (ícone e texto) só a partir de 90%. As categorias que gastaram sem orçamento aparecem numa linha no fim. Tem tabela equivalente.
- **Alertas de orçamento** junto dos outros, no mesmo card.

**Decisões:**
- O orçamento é por categoria, então só o filtro de categoria vale para ele. Com fornecedor, setor, natureza ou forma de pagamento ligados, o KPI avisa "só o filtro de categoria vale aqui" e a linha do gráfico some: comparar o gasto de um fornecedor com o orçamento da categoria inteira enganaria.
- O consumo é do ano corrente, independente do período escolhido. O dashboard carrega os lançamentos até dezembro do ano corrente, para contar uma baixa adiantada.
- Se a tabela ainda não existir (migration não aplicada), o dashboard continua funcionando e o KPI mostra "Orçamento indisponível".

**Layout novo do dashboard:** [Por categoria | Orçado × realizado], depois [Fornecedores | Setor | Composição] em 3 colunas no xl, depois [Alertas | Renovações].
