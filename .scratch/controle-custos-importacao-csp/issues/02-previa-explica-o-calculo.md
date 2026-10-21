# 02: Prévia da importação explica o cálculo do Atendido

**What to build:** A prévia da importação mostra por que cada TUSS ficou Sim ou Não: qual exame definiu o CSP num TUSS compartilhado, aviso "custo não cadastrado" quando o custo é 0, aviso dos exames com linha própria na mesma fonte + tabela que a importação não altera, e o total de linhas Sim e Não para o limite atual. Ver spec: `../spec.md`.

**Blocked by:** 01 — Atendido calculado por % máx CSP na importação

**Status:** done (conferido no navegador em 21/Out/2026)

- [x] A função de cálculo devolve também o exame que definiu o CSP e os avisos (custo não cadastrado; nomes dos exames com linha própria não alterados).
- [x] Prévia mostra o exame que definiu o CSP quando o TUSS tem mais de um exame coberto.
- [x] Prévia mostra o aviso "custo não cadastrado" nas linhas com custo usado 0.
- [x] Prévia avisa, por TUSS, os exames com linha própria que não serão alterados.
- [x] Prévia mostra a contagem de Sim e Não, atualizada quando o limite muda.
- [x] Testes da função cobrindo exame definidor e os dois avisos.
