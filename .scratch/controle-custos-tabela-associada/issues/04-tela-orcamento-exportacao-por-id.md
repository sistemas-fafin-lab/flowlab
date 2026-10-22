# 04: Tela, orçamento e exportação passam a usar o id da tabela

**What to build:** A tela de Fontes Pagadoras, o backend do gerador de orçamento e as exportações passam a ler a tabela associada pelo cadastro. Para o usuário nada muda nas regras — linha de exame continua tendo precedência sobre a linha geral do TUSS na mesma fonte + tabela, e a Tabela Particular do orçamento continua vindo só de Particular/Particular, com "PART" fora — mas as exportações ganham a coluna Vencimento. Ver spec: `../spec.md`.

**Blocked by:** 01 — Cadastro de tabelas associadas, com vencimento

**Status:** ready-for-agent

- [x] Domínio da tela (cobertura de exames por fonte, fontes de um exame, irmãos, checagem de linha duplicada) compara "mesma fonte + tabela" pelo id da tabela.
- [x] Testes do domínio cobrindo precedência e duplicidade por id, incluindo duas tabelas cujos nomes colidiam por normalização.
- [x] Backend do orçamento identifica a Tabela Particular pelo cadastro (nome "Particular" da fonte Particular); demais tabelas da fonte Particular continuam fora — testes do orçamento atualizados.
- [x] Exportações de linhas de fonte pagadora trazem a coluna Vencimento — testes de exportação atualizados.

## Comments

- Domínio da tela (`domain/busca.ts`): a precedência linha de exame × linha geral (`examesPorFontePagadora`, `fontesPagadorasDoExame`, `irmaosNaLinha`) e a duplicidade (`analisarLinhaFontePagadora`, que agora recebe `tabelaId` em vez de fonte + texto) comparam pelo id do cadastro. `ExameDaFontePagadora` ganhou `tabelaId`. Testes com "Particular" × "PARTICULAR" cadastradas à parte.
- Pendência do 02 resolvida aqui: a prévia da importação (`calcularAtendidoImportacao`, entrada `tabelaId`) e o upsert de `importPayors` casam pelo id (`linhasDaTabela`, antes `linhasDaFonteETabela` por nome exato).
- Orçamento (`api/_lib/orcamentoParticular.ts`): lê `custo_tabelas_associadas` e pega as linhas cujo `tabela_associada_id` é o cadastro "Particular" (sem diferenciar maiúsculas) da fonte Particular; não lê mais o texto `tabela_associada`. Tabela "Particular" de outra fonte não entra.
- Exportações: coluna Vencimento (dd/mm/aaaa, vazia sem vencimento) logo depois de "Tabela Associada" nas três exportações, lida do cadastro pelo id. `formatarVencimento` foi para `domain/vencimento.ts` (o bloco `TabelasDaFonte` usa a mesma).
- Divergência conhecida até o 06: o orçamento junta todos os cadastros "particular" (sem diferenciar maiúsculas) da fonte Particular, então "Particular" e "PARTICULAR" entram juntas (com a precedência de linha de exame e o "primeiro vence" misturados entre elas), como antes; na tela são tabelas diferentes. Some quando a unificação juntar as duas.
- Fora deste ticket: `api/_lib/tussExames.ts` (payload da Admissão) ainda expõe o texto `tabela_associada`, sem o id — é contrato externo; mexer junto com o 07 se o texto for removido.
- Falta conferir no navegador.
- 2026-10-22 — Conferido no navegador contra o Supabase de teste (migrações 170000, 180000 e 190000 aplicadas), com tabelas "TESTE" na fonte AMHP-DF, apagadas no fim. Ok: mesmo exame em duas tabelas da mesma fonte convive; a mesma linha na mesma tabela é barrada ("Já existe esta linha…"); o .csv traz "Vencimento" depois de "Tabela Associada" (31/12/2026, ou vazio). Não conferidos: o .xlsx e o orçamento particular (a API não roda só com o Vite).
