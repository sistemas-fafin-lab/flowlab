# 15 — Dashboard: detalhamento avançado

**What to build:** o dashboard ganha o mapa de calor categoria × mês (um único tom),
as maiores divergências previsto original × pago em barras divergentes (com o previsto
ajustado no tooltip), a tabela de custo unitário (valor por licença/usuário por mês e
variação no ano) e o KPI de economias (soma anualizada dos reajustes de renegociação
com valor menor).

Plano: §8.3, RF25, RN11.

**Blocked by:** 14, 07

**Status:** done no código (conferido com dados fictícios num harness, falta conferir com dados reais)

- [x] Matriz categoria × mês, desvios, custo unitário, economias (+ testes) — em `domain/detalhamento.ts`, não em `finops.ts`.
- [x] Mapa de calor sequencial de um tom com legenda de escala e leitura por célula.
- [x] Barras divergentes: quente acima, frio abaixo, zero neutro.
- [x] Todos com tabela equivalente e estado vazio.
- [x] `npx tsc --noEmit`, `npm run lint` e `npm test` sem erros novos.

## Comments

**05/Out/2026 — implementado.** Sem migration.

**Regras puras, `domain/detalhamento.ts` (8 testes):**
- `mapaDeCalor`: pago por categoria × mês (competência), só as categorias com pagamento, da maior para a menor.
- `faixaSequencial`: 7 faixas lineares. Zero fica `null` (célula neutra), porque "sem gasto" não é "pouco gasto".
- `maioresDesvios`: pago × previsto **original** por despesa, somando as cobranças pagas do período (RN11). Também guarda o previsto ajustado.
  - Lançamento fora da recorrência fica de fora: ele já tem alerta próprio e não tem previsto.
  - Despesa variável entra, marcada como "variável" (o previsto dela é estimativa).
- `custoUnitario`: recorrentes ativas com quantidade. Calcula o equivalente mensal ÷ quantidade vigente, hoje e em janeiro (ou no mês inicial, se a despesa começou no ano).
- `economiasDeRenegociacao`: reajustes com motivo "renegociação" que baixaram o valor e têm vigência no período.
  - A base é o valor vigente logo antes do reajuste, já com reajustes anteriores.
  - A economia é anualizada pelo ciclo: (antes − depois) ÷ meses do ciclo × 12.

**Cores** (em `coresCategorias.ts`, hex documentados da skill dataviz):
- `RAMPA_SEQUENCIAL`: azul nos passos 100–700. No escuro a âncora inverte, e o "quase zero" passa a ser a faixa mais escura.
- `faixaPedeTextoClaro`: texto branco só de `#256abf` para baixo. Em `#3987e5` o texto escuro contrasta mais (cerca de 4,9:1, contra 3,6:1 do branco).
- `POLOS_DIVERGENTES`: vermelho para acima e azul para abaixo (os slots da paleta), com o cinza neutro no meio.

**Tela:**
- **Mapa de calor:** largura inteira, na janela da evolução, só com os meses já vividos.
  - Mostra o valor compacto na célula (md+) e uma linha de leitura ao passar o mouse, com o valor exato e o % do mês.
  - Tem legenda de escala com as 7 faixas e "sem gasto", e tabela equivalente.
- **Maiores desvios:** top 10 em barras divergentes, com o valor com sinal sempre visível.
  - Foco ou hover mostra o previsto original, o ajustado e o pago, e avisa quando o ajuste do mês já previa o valor.
  - As linhas são focáveis pelo teclado. Tem tabela equivalente.
- **Economias em renegociações:** o total anualizado em destaque e a lista de onde veio (antes → depois).
- **Custo unitário:** tabela com quantidade, custo mensal, valor por unidade/mês e variação no ano, que traz ícone, sinal e o valor de referência ("era R$ X em jan/2026").

**Conferência visual:** montei um harness no scratchpad com dados fictícios e tirei captura no Chrome headless, nos temas claro e escuro.
- **Bug encontrado na issue 11:** o gráfico de evolução não aparecia. O pai do `ResponsiveContainer` só tinha `min-height` dentro de uma cadeia de alturas automáticas, então a altura medida era 0.
- **Correção:** altura explícita (`h-72`).
- A coluna de variação do custo unitário quebrava mal; a referência agora fica numa segunda linha.

**Layout:** depois de [Alertas | Renovações], vêm o mapa de calor, depois [Maiores desvios | Economias], depois Custo unitário e, por fim, o Detalhamento.
