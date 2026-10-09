# 11 — Dashboard: filtros, KPIs e evolução mensal

**What to build:** a aba Dashboard ganha a barra única de filtros (período, categoria,
fornecedor, setor, natureza, forma de pagamento), a fileira de KPIs (realizado com
variação sobre o período anterior e minigráfico, previsto com ajustes e % pago, custo
recorrente mensal, custo anualizado, a pagar em 30 dias com as vencidas, e orçamento
como estado vazio explícito até a 14) e o gráfico de evolução mensal empilhado por
categoria, com 3 meses de projeção esmaecidos.

**Antes do primeiro gráfico, carregar a skill `dataviz`** e rodar o validador de paleta
em claro e escuro nas 8 cores de categoria.

Plano: §8.1–8.3, §8.5, §9, RF17, RF18, RF19 (só a evolução), RN05, RN06.

**Blocked by:** 06

**Status:** done no código (falta conferir visualmente e contra o banco com dados reais)

- [x] `domain/finops.ts` (+ teste): realizado e previsto por período, variação, custo recorrente (variáveis pela média dos 3 últimos pagos), anualizado, a pagar em N dias, série mensal por categoria com projeção.
- [x] Carga: despesas + reajustes inteiros (`useDespesasTI`) e lançamentos só do intervalo necessário, filtrado no servidor (`useLancamentosIntervaloTI` + `intervaloDeCarga`). Não precisou de um `useFinopsDashboard` à parte: a página monta tudo com as funções puras num `useMemo`.
- [x] Componentes do módulo: `ui/Widget` (vidro + "Ver tabela"), `ui/Sparkline`, `Kpi` e `eixoMoeda` locais, modelados em `ContasReceberDashboard.tsx`.
- [x] Cabeçalho, filtros e presets no visual do `ITHubDashboard`; cores do gráfico trocadas pelo tema via `useTheme`.
- [x] Evolução mensal: um eixo só, cor por `ordem` da categoria, 9ª categoria em diante em "Outros" cinza, tooltip, legenda, tabela equivalente.
- [x] Trocar filtro mantém o conteúdo anterior esmaecido (sem piscar o skeleton); recorte vazio mostra estado vazio.
- [ ] Cada KPI conferido contra uma soma feita à mão no banco — **não feito**: depende de dados reais lançados e de acesso logado.
- [x] `npx tsc --noEmit`, `npm run lint` e `npm test` sem erros novos.

## Comments

**01/Out/2026 — implementado.**

**Decisões de desenho:**
- **Base dos números: competência**, o mesmo critério do Mês a mês, para os números das duas abas baterem. "Por data de pagamento" (caixa) e "diluída" ficam para a issue 16, como alternador.
- **Janela da evolução:** os 12 meses até o fim do período, mais 3 de projeção quando o período termina no mês atual. Um período de um mês sozinho viraria um gráfico de uma barra só.
- **Quebras por categoria, fornecedor, setor e composição** usam o realizado. Se o período ainda não tem pagamento (período futuro), usam o previsto, e o subtítulo avisa.
- **KPIs "do agora"** não dependem do período: custo recorrente, anualizado e "a pagar em 30 dias". Eles respeitam os filtros.

**Regras puras, `domain/finops.ts` (17 testes):**
- período: presets, período anterior, janela da evolução e intervalo de carga;
- filtros;
- totais e variação;
- custo recorrente pela média dos 3 últimos pagos da variável, até o mês atual;
- anualizado;
- a pagar em 30 dias e vencidas;
- série mensal: pago até o mês atual, previsto depois, e "Outros" da 9ª categoria em diante;
- agrupamentos com % e % acumulado, top 10 + "Outros" e proporções.

**Tela:**
- `FinopsDashboardPage`, com filtros em uma linha acima de tudo (período primeiro).
- 6 KPIs, um deles com minigráfico. Orçamento aparece como estado vazio explícito até a issue 14, nunca como 0.
- `EvolucaoMensal` em recharts:
  - segmento próprio, com canto de 4px só no topo da pilha e 2px de respiro na cor da superfície;
  - projeção esmaecida;
  - tooltip com o valor antes do nome e chave de linha;
  - legenda HTML e tabela equivalente.
- Grade sólida de 1px, sem tracejado, como pede a skill. O `ContasReceberDashboard` usa tracejado, e aqui foi seguida a skill.

**Verificação:**
- `npm test`: 76 arquivos, 790 testes passando.
- `tsc`: nenhum erro em `gastos-ti`.
- `eslint` limpo.
- Build do Vite: ok.
- **Não verificado:** a renderização no navegador, que é o passo 7 da skill dataviz (olhar o gráfico pronto procurando rótulo encavalado ou estouro de área).
