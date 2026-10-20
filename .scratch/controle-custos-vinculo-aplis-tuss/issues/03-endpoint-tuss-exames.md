# 03: Endpoint `tuss-exames` para a Admissão

**What to build:** o Sistema de Admissão consegue baixar, com uma chave própria, tudo o que precisa para escolher o TUSS de um procedimento: os exames ligados ao apLIS, as linhas de fontes pagadoras e as exclusões, num payload só, sem valores nem custos. Mesmo padrão do endpoint `orcamento-particular`. Formato da resposta em `../spec.md`.

**Blocked by:** 01 (Ligar exame do catálogo a cobrança/teste do apLIS na tela)

**Status:** ready-for-agent

- [ ] `GET /api/integracoes/tuss-exames` com `Authorization: Bearer <ADMISSAO_API_KEY>` (chave dedicada)
- [ ] 405 para não-GET, 401 sem chave/chave errada, 500 genérico sem chave configurada ou falha no banco, `Cache-Control: no-store`
- [ ] Payload `{ exames, fontes_pagadoras, exclusoes, gerado_em }`; `exames` só com os ligados; sem `valor`, `custo_*`, `nome` nem `fonte_pagadora`
- [ ] Montagem do payload numa função testável com client falso; testes do handler no padrão de `orcamento-particular.test.ts`
- [ ] `ADMISSAO_API_KEY` documentada no `.env.example`
- [ ] Verificado com `curl` contra o ambiente
