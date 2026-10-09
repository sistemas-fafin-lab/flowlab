# 16 — Caixa × competência e drill-down

**What to build:** um alternador no cabeçalho do dashboard troca entre **visão caixa**
(valor no mês do pagamento) e **visão competência** (despesa anual diluída em 12 meses,
semestral em 6 etc.). Clicar numa barra de categoria, fornecedor ou setor aplica aquele
filtro no painel inteiro e abre um painel lateral com o resumo do item (despesas, total
em 12 meses, evolução).

Plano: §8.3, RF24, RF26.

**Blocked by:** 14, 12

**Status:** done no código (conferido com dados fictícios num harness, falta conferir com dados reais)

- [x] Diluição conforme os meses do ciclo (+ testes, incluindo anual paga em janeiro e virada de ano) — em `domain/visao.ts`.
- [x] Alternador que recalcula KPIs e gráficos sem refetch.
- [x] Clique em barra aplica o filtro global (a barra de filtros reflete a seleção) e abre o resumo lateral.
- [x] Acessível por teclado: o foco numa barra mostra o mesmo que o hover e Enter aplica o filtro.
- [x] `npx tsc --noEmit`, `npm run lint` e `npm test` sem erros novos.

## Comments

**05/Out/2026 — implementado.** Sem migration.

**Três visões, não duas.** A base que o dashboard já usava é a **cobrança**: o mês a que a cobrança se refere, o mesmo do Mês a mês. Ela continua como padrão, para os números das duas abas baterem. As outras duas visões:
- **Caixa:** a cobrança paga entra no mês do `pago_em`; a não paga, no mês do vencimento.
- **Diluída:** a "visão competência" do RF24. Uma cobrança de ciclo de N meses vira N fatias iguais a partir da competência. Mensal, única e lançamento fora da recorrência ficam inteiros.

**Como funciona (`domain/visao.ts`, 7 testes):** as visões não recalculam nada.
- `ocorrenciasNaVisao` gera as cobranças com margem (11 meses antes, 3 depois), remapeia cada uma para o mês da visão (`competenciaDeCaixa` ou `diluirOcorrencia`) e fica com as que caem no recorte. Todas as funções de `finops.ts` somam essas ocorrências "virtuais" como sempre.
- `cobrancasNaVisao` devolve as cobranças **reais** por trás do recorte, para o detalhamento e a exportação, que listam cobranças e não fatias. No caixa, cada uma mantém o mês a que se refere.

**Testes:**
- No caixa: atraso, adiantamento e não paga.
- Na diluída: anual paga em janeiro vira 1/12 por mês; anual de julho atravessa a virada do ano; trimestral vira 3 fatias com chaves distintas.
- O resumo do drill-down.

**Sem refetch:** `intervaloDeCarga` passou a incluir a margem das visões (`MARGEM_VISOES`). Trocar de visão só recalcula.

**Paginação (correção de um bug latente):** `useLancamentosIntervaloTI` agora pagina de 1000 em 1000, com ordem estável. O PostgREST corta em 1000 linhas por chamada, e antes já se carregavam uns 27 meses sem paginar. Com a margem, a carga passou de uns 3 anos, e linhas sumiriam sem aviso.

**O que segue a visão:** Realizado, Previsto, variação, sparkline, evolução, rankings, composição, mapa de calor e maiores desvios.

**O que não segue, de propósito:**
- A pagar, alertas, custo recorrente, anualizado, renovações, custo unitário e economias: não dependem de como o mês é atribuído.
- Orçamento: conta pelo ano da cobrança.
- Detalhamento e exportação: listam cobranças inteiras. No caixa, são as pagas (ou a vencer) no período; na diluída, as do período. O subtítulo diz qual é o caso.

**Drill-down (RF26):**
- **Clique:** as barras de categoria, fornecedor e setor viram botões (o foco do teclado mostra o mesmo destaque do hover, Enter ou Espaço aplicam). "Outros" e "sem setor" não viram filtro.
- **Filtro:** o clique aplica o filtro global, e a barra de filtros mostra a seleção. No fornecedor, usa a grafia da lista do filtro, para o select acertar a opção.
- **Painel lateral (`ResumoDrillDown`):** mostra o pago em 12 meses, o custo recorrente, as despesas ativas, o pago por mês (base cobrança, com lista para leitor de tela) e as despesas do item com situação. Tem um botão "Remover filtro e fechar".
- **Fechar:** fechar o painel mantém o filtro. Se o filtro mudar pela barra, o painel fecha sozinho.

**Conferência visual:** harness no scratchpad com dados fictícios e captura no Chrome headless.
- O alternador e a frase que explica a visão atual aparecem na barra de filtros.
- A anual de R$ 18 mil de março vira R$ 1,5 mil por mês na diluída.
- O painel lateral bate com a conta feita à mão (R$ 23.700 = 1.500 × 11 + 900 × 8).
