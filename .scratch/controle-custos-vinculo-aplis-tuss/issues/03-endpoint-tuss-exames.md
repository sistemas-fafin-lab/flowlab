# 03: Endpoint `tuss-exames` para a Admissão

**What to build:** o Sistema de Admissão consegue baixar, com uma chave própria, tudo o que precisa para escolher o TUSS de um procedimento: os exames ligados ao apLIS, as linhas de fontes pagadoras e as exclusões, num payload só, sem valores nem custos. Mesmo padrão do endpoint `orcamento-particular`. Formato da resposta em `../spec.md`.

**Blocked by:** 01 (Ligar exame do catálogo a cobrança/teste do apLIS na tela)

**Status:** done no código (20/Out/2026); falta configurar `ADMISSAO_API_KEY` na Vercel, fazer deploy e verificar com `curl`

- [x] `GET /api/integracoes/tuss-exames` com `Authorization: Bearer <ADMISSAO_API_KEY>` (chave dedicada)
- [x] 405 para não-GET, 401 sem chave/chave errada, 500 genérico sem chave configurada ou falha no banco, `Cache-Control: no-store`
- [x] Payload `{ exames, fontes_pagadoras, exclusoes, gerado_em }`; `exames` só com os ligados; sem `valor`, `custo_*`, `nome` nem `fonte_pagadora`
- [x] Montagem do payload numa função testável com client falso; testes do handler no padrão de `orcamento-particular.test.ts`
- [x] `ADMISSAO_API_KEY` documentada no `.env.example`
- [ ] Verificado com `curl` contra o ambiente

## Comments

- 20/10/2026: implementado em `api/integracoes/tuss-exames.ts` + `api/_lib/tussExames.ts`. `buscarTodasPaginado` saiu de `orcamentoParticular.ts` para `api/_lib/supabasePaginado.ts` (agora usado pelos dois endpoints). Um exame ligado pode ter `tuss: ''` (a coluna aceita vazio); a Admissão deve tratar vazio como "não mandar TUSS".
