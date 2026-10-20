# 02: Pré-preencher as cobranças da ASSEFAZ com TUSS único

**What to build:** sem ninguém digitar, as cobranças da ASSEFAZ que têm um TUSS só no apLIS aparecem ligadas aos exames do catálogo. Um script lê a tabela de preço 1 (`fattabelaprocedimento` ativos), liga cada cobrança com exatamente um `Codigo` ao único exame de `custo_exames` com esse `tuss`, e lista no fim o que ligou e o que ficou de fora (com o motivo), para conferência. Ver `../spec.md`, "Pré-preenchimento".

**Blocked by:** 01 (Ligar exame do catálogo a cobrança/teste do apLIS na tela)

**Status:** ready-for-agent

- [ ] Escolha é uma função pura (linhas do apLIS + catálogo → vínculos + descartes com motivo), testada sem banco: TUSS único, cobrança com dois TUSS, TUSS compartilhado por vários exames do catálogo, TUSS ausente do catálogo
- [ ] Script versionado aplica os vínculos sem sobrescrever vínculo já preenchido à mão
- [ ] Rodado no ambiente: 3, 6, 7, 12, 13, 15, 18, 19 e 23 ligados (se o catálogo tiver exame único para o TUSS); 1, 2, 8 e 25 sem vínculo
- [ ] Relatório do que ligou/ficou de fora anexado nos comentários deste ticket
