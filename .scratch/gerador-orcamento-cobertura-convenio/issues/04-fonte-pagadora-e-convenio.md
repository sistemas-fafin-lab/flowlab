# 04: Conferir por fonte pagadora e convênio

**What to build:** a Conferência de cobertura passa a ter dois filtros: **Fonte pagadora** (obrigatório) e **Convênio** (opcional, as tabelas associadas da fonte, como estão cadastradas). Só com a fonte, o exame conta como coberto se alguma tabela dela o atende (como hoje). Com convênio, só se aquela tabela o atende. Motivo: em produção a fonte AMHP-DF agrupa 26 convênios (AFFEGO, BACEN, NOTRE DAME…), e conferir só pela fonte cobre demais.

Ver `.scratch/gerador-orcamento-cobertura-convenio/spec.md` → "Granularidade: fonte pagadora e convênio".

**Blocked by:** 03 — Outros convênios e atalho "Marcar só os não cobertos"

**Status:** resolved

- [x] Montagem da lista (`buildOrcamentoParticular`) manda `coberturaConvenios: { fonte, convenio }[]` por exame, com a regra por tabela do Controle de Custos (linha do exame tem precedência sobre a geral do TUSS da mesma tabela; exclusão tira o exame da geral); sem valor
- [x] `conveniosAceitos` = fontes distintas de `coberturaConvenios` (mesma regra); a integração da Tabela Particular não recebe `coberturaConvenios`
- [x] Domínio `cobertura`: fontes da lista, convênios de uma fonte, e `conferirCobertura` com `{ fonte, convenio | null }`; outros convênios do não coberto agrupados por fonte (sem o escolhido)
- [x] Testes vitest do servidor e do domínio cobrindo os casos acima
- [x] Seletor com dois campos (fonte, convênio) no carrinho e na aba do modal, mesmo estado da página; trocar a fonte limpa o convênio
- [x] Indicador, selo e resumo nomeiam a escolha ("AMHP-DF" ou "AMHP-DF · BACEN")
- [x] Conferido no navegador
