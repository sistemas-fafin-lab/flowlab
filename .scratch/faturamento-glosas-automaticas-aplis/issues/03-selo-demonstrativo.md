# 03 — Selo do demonstrativo nas glosas sugeridas

**What to build:** cada glosa sugerida na prévia mostra se confere com o
demonstrativo importado no apLIS ("confere" / "difere do demonstrativo"), ou
nada quando não há demonstrativo. É só informação: não desmarca nem bloqueia.
Ver `../spec.md` — decisão 10.

**Blocked by:** 01

**Status:** done

- [x] Leitura da glosa do demonstrativo por (requisição, código do procedimento), só do demonstrativo mais recente de cada guia (há reimportações duplicadas); pode reaproveitar o que as telas de glosa legado já usam
- [x] Comparação por grupo de glosa (lote + código + status) com tolerância de R$ 0,01: `confere` / `difere` / sem demonstrativo; teste vitest dos três casos
- [x] Selo na linha da glosa no modal; a seleção inicial não muda
- [x] Conferido com dado real: lote 6485 confere (R$ 327,88, demonstrativo 4450); a glosa total de R$ 507,15 do lote 6063 sai sem demonstrativo

## Comments

### 15/10/2026 — implementado

- **Leitura junto das diferenças** (`diferencasDosLotes` em `api/_lib/faturamento/bdLab.ts`):
  cada grupo traz `demonstrativoValor`, o Σ `VlrGlosa` do demonstrativo mais
  recente de cada par requisição + código do procedimento (`DENSE_RANK` no MySQL 8),
  com todas as linhas dele, inclusive as sem glosa. "Mais recente" é por par, não
  por guia: um recurso reimporta só as linhas contestadas, e tomar a guia mais
  recente apagaria as outras. Os procedimentos são somados por requisição + código
  antes de casar com o demonstrativo, senão o código repetido na requisição
  (18 pares, achado da revisão) contaria o demonstrativo duas vezes — sem teste
  automático (não há teste de SQL no repositório). Bloco de 1.000 lotes: ~2,8 s
  (era ~1,7 s).
- **Comparação** (`glosasSugeridas`): por grupo lote + código + status, o glosado
  **bruto** do apLIS (antes do desconto do já lançado) contra o do demonstrativo,
  tolerância R$ 0,01. Procedimento do grupo sem demonstrativo conta como 0 (dá
  "difere"); nenhum com demonstrativo → `null`. Num grupo lançado em parte, o selo
  vale para o glosado inteiro, não para o resto sugerido.
- **Modal:** selo "confere" (verde) / "difere do demonstrativo" (âmbar) depois do
  valor da glosa; a seleção inicial não muda (teste em `selecaoPadrao`).

Conferido ao vivo (réplica até 14/10): lote 6485 com as duas glosas 3292
(R$ 254,44 aberta e R$ 73,44 definitiva) "confere", demonstrativo 4450 com
R$ 327,88; lote 6063 com a glosa 1705 de R$ 507,15 sem demonstrativo. O lote 6247
tem um "difere" real: o apLIS não recebeu R$ 0,98 da 1424 e o demonstrativo 4478
glosa R$ 24,63.

