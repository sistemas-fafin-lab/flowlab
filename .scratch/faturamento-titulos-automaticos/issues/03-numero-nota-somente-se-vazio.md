# 03 — Modo "só se estiver vazio" no preenchimento do número da nota

**What to build:** a RPC `fat_atualizar_numero_nota` e a rota
`titulo-atualizar-numero-nota` ganham um parâmetro opcional `somenteSeVazio`.
Com ele ligado, título que já tem número não é alterado e a resposta indica
"já preenchido" de forma distinguível de erro. Sem o parâmetro, a edição
manual se comporta como hoje. Base para a issue 04 não sobrescrever um número
digitado entre a prévia e a confirmação. Ver `../spec.md` — "Backend".

**Blocked by:** None — can start immediately

**Status:** done

- [x] Nova migration que faz `DROP FUNCTION fat_atualizar_numero_nota(UUID, TEXT)`
      e recria com o parâmetro opcional (default falso) — `CREATE OR REPLACE`
      com assinatura nova criaria um overload, e o PostgREST recusa a chamada
      de 2 argumentos por ambiguidade; trocar o retorno de `void` também exige
      o DROP. Refazer COMMENT, REVOKE e GRANT
- [x] Modo `somenteSeVazio` atômico: `UPDATE ... WHERE id_nota = ? AND
      numero_nota IS NULL` (sem ler-e-depois-gravar), para não perder uma
      digitação concorrente
- [x] Com `somenteSeVazio` e número já preenchido: nada muda e o retorno
      identifica "já preenchido"
- [x] Rota repassa o parâmetro e devolve o resultado "já preenchido" com
      status/corpo que a tela distingue de falha
- [x] Tela de edição de título continua funcionando sem o parâmetro
- [x] Teste vitest do handler (Supabase mockado): parâmetro repassado, "já
      preenchido" distinguível, comportamento antigo intacto

**Notas da implementação:** migration `20260930180000_fat_atualizar_numero_nota_somente_se_vazio.sql`.
A RPC retorna `'atualizado' | 'ja-preenchido'` (mesmo token na resposta HTTP:
`{ success: true, resultado }`). Número só com espaços conta como vazio.
O handler sempre envia `p_somente_se_vazio`, então **aplicar a migration antes
do deploy do código** — senão a edição manual quebra.
