# 04: Tela, orçamento e exportação passam a usar o id da tabela

**What to build:** A tela de Fontes Pagadoras, o backend do gerador de orçamento e as exportações passam a ler a tabela associada pelo cadastro. Para o usuário nada muda nas regras — linha de exame continua tendo precedência sobre a linha geral do TUSS na mesma fonte + tabela, e a Tabela Particular do orçamento continua vindo só de Particular/Particular, com "PART" fora — mas as exportações ganham a coluna Vencimento. Ver spec: `../spec.md`.

**Blocked by:** 01 — Cadastro de tabelas associadas, com vencimento

**Status:** ready-for-agent

- [ ] Domínio da tela (cobertura de exames por fonte, fontes de um exame, irmãos, checagem de linha duplicada) compara "mesma fonte + tabela" pelo id da tabela.
- [ ] Testes do domínio cobrindo precedência e duplicidade por id, incluindo duas tabelas cujos nomes colidiam por normalização.
- [ ] Backend do orçamento identifica a Tabela Particular pelo cadastro (nome "Particular" da fonte Particular); demais tabelas da fonte Particular continuam fora — testes do orçamento atualizados.
- [ ] Exportações de linhas de fonte pagadora trazem a coluna Vencimento — testes de exportação atualizados.
