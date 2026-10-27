# 06: Ranking de faturistas (quem abriu os lotes)

**What to build:** o usuário vê o Top 10 de faturistas do período. A faturista é o usuário que **criou o lote** no apLIS. O ranking segue o botão R$ / Qtd, como os outros três. A pergunta que ele responde é "quem mais faturou e como a carga está dividida", para o gestor equilibrar a carteira de convênios entre as faturistas.

**Blocked by:** 02 (Ranking de convênios + botão R$/Qtd).

**Status:** done

- [x] Faturista = `fatlote.IdLogin` → `autusuario.IdUsuario` (nome em `autusuario.NomUsuario`). Conferido no banco em 27/10/2026: 2026 inteiro, sem lotes cancelados, todos os `IdLogin` acham um usuário.
- [x] `SQL_LINHAS_FATURADAS` (`api/_lib/faturamento/bdLab.ts`) passa a trazer `l.IdLogin` e o `NomUsuario` (LEFT JOIN em `autusuario`). `LinhaFaturada` ganha `faturistaId` e `faturistaNome`. Nunca buscar outras colunas de `autusuario`, porque a tabela tem `Senha`, `CPF`, `TokenGPT` etc.
- [x] Em Qtd, a ordem é pelo número de requisições distintas, igual ao ranking de clínicas. O valor ordena em R$: soma do `ValorLiquido`.
- [x] O tooltip mostra o nome inteiro, a métrica que não está selecionada e o **nº de lotes** abertos no período.
- [x] Lote sem `IdLogin` (ou com usuário que não existe) aparece agrupado como "Sem usuário".
- [x] O título deixa claro que é por quem **abriu** o lote, por exemplo "Faturistas (por quem abriu o lote)". Quem fez a conferência, as guias ou as glosas pode ser outra pessoa, e o rótulo não deve prometer mais do que o dado mostra.
- [x] Os cards e os outros três rankings não mudam.
- [x] Testes do módulo (`indicadoresFaturamento.test.ts`):
  - quantidade = requisições distintas, mesmo com vários procedimentos;
  - nº de lotes distintos por faturista;
  - "Sem usuário";
  - ordem por valor diferente da ordem por quantidade.

## Referência: números de jul–set/2026

Conta feita no banco em 27/10/2026, com a mesma regra da página (mês de criação do lote, sem os cancelados). O total de setembro bate com o da página (≈ R$ 1,38 mi).

| Mês | Faturista | Lotes | Req. | R$ |
|---|---|---|---|---|
| set | Renata Queiroz Bento | 111 | 2.230 | 697.889,69 |
| set | Rívia Freire A. B. Borba | 64 | 1.416 | 479.159,97 |
| set | Cleber Kendel de Andrade | 16 | 612 | 177.484,78 |
| set | Raquel dos Santos Avelino | 7 | 87 | 20.318,22 |
| set | Maria Eduarda F. Bomfim | 1 | 9 | 5.143,49 |

Use estes números para conferir o ranking na tela.

## Fora do escopo (decidir depois)

- **Pontuação no Lab Points:** ainda não está claro o que é o Lab Points; não existe nada com esse nome no repositório. Fica para quando o usuário explicar.
- **Carga real de trabalho:** "abriu o lote" não mede conferência, guias e glosas. Antes de usar o ranking para medir carga, ver se `requisicaohistorico` registra quem incluiu as requisições no lote.
- **Ranking de faturista × convênio** (quem pega quais convênios). No trimestre os convênios grandes ficaram divididos entre 2 ou 3 pessoas, e PMDF, INAS, STJ e AMIL ficaram quase só com uma. Pode virar um filtro ou um detalhe ao clicar na barra.
