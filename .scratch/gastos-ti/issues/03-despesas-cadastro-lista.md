# 03 — Despesas: cadastro e lista

**What to build:** um usuário com `canManageGastosTI` cadastra uma despesa
(ex.: "Microsoft 365, 40 licenças, mensal, R$ 2.480, autorizado por Fulano") e ela
aparece na lista da aba Despesas com o valor vigente, o equivalente mensal e a
próxima ocorrência. Durante o cadastro, uma prévia mostra as próximas 6 ocorrências,
para quem cadastra ver na hora se a recorrência ficou certa. Pelo próprio formulário dá
para criar uma categoria nova e cadastrar um fornecedor rapidamente.

Plano: §4.1 (`ti_despesas`), §6, §7 (Despesas e formulário), RF01, RF05, RF07 (inline),
RF08, RN01–RN05, RN08–RN10, D3, D4, D7.

**Blocked by:** 02

**Status:** done (migration gerada, ainda não aplicada; tela não conferida no navegador)

- [x] Migration: `ti_despesas` com todos os campos da §4.1 (`autorizado_por` texto não vazio, `autorizado_em` opcional), CHECKs nomeados, índices, trigger de `updated_at`/`updated_by`, auditoria.
- [x] RLS: SELECT com view ou manage; INSERT/UPDATE/DELETE com manage.
- [x] `domain/competencia.ts` (+ teste): somar meses, vencimento limitado ao fim do mês, formatar "out/2026", converter de/para `YYYY-MM-01`.
- [x] `domain/recorrencia.ts` (+ teste): ocorrências no intervalo, valor vigente (já aceita reajustes; a 04 só passa a carregá-los), equivalente mensal, situação da despesa por datas (futura/ativa/encerrada).
- [x] `constants.ts`: recorrências, formas de pagamento (D7), tipo de valor, natureza, com rótulos.
- [x] `useDespesasTI` + `DespesasPage`: filtros, busca com debounce de 350 ms, ordenação, totais no rodapé.
- [x] `DespesaFormModal` nos 4 blocos da §7, com prévia ao vivo e "+ Nova categoria".
- [x] "Autorizado por": texto livre com `<datalist>` dos nomes já usados; espaços extras removidos ao salvar.
- [x] Fornecedor: busca em `suppliers` + cadastro rápido (nome + CNPJ); `fornecedor_nome` sempre gravado.
- [x] Casos de borda da §11 cobertos para competência e recorrência (dia 31, anual no meio do ano, trimestral, encerrada, futura, única, parcelamento, virada de ano).
- [x] `npx tsc --noEmit`, `npm run lint` e `npm test` sem erros novos.

## Comments

**01/Out/2026 — implementado.**

**Migration:** `supabase/migrations/20261009130000_gastos_ti_despesas.sql`.
- Começa com um guarda que exige a migration da issue 02.
- Todos os campos da §4.1, com CHECKs nomeados. As formas de pagamento são gravadas em minúsculas (`cartao_corporativo`, `debito_automatico` etc.) e os rótulos ficam em `constants.ts`.
- Trigger `ti_despesas_set_carimbos`: `updated_at`/`updated_by` sempre do servidor, e `created_by`/`created_at` imutáveis no UPDATE.
- DELETE liberado para quem tem `canManageGastosTI`. Quem impede apagar despesa com histórico é o `RESTRICT` de `ti_lancamentos`, que entra na issue 06.

**Teste da migration (PGlite):** 36 de 36 verificações passaram, e a migration da 02 continua passando nas suas 34:
- aplica e reaplica, e falha com mensagem clara se a 02 não foi aplicada antes;
- RLS;
- 16 CHECKs recusando com 23514;
- carimbos: `created_by` não muda no UPDATE e `updated_by` é quem editou;
- apagar o fornecedor zera `fornecedor_id` e mantém o nome;
- categoria em uso não pode ser apagada (23503);
- auditoria de insert, update e delete com autor e antes/depois.

**Regras puras, com 64 testes novos (86 no módulo):**
- `competencia.ts`: texto `YYYY-MM-01`, virada de ano, vencimento limitado ao último dia do mês, inclusive em ano bissexto.
- `recorrencia.ts`:
  - as ocorrências pulam direto para a janela, sem iterar desde o início do contrato;
  - `valorVigente` já considera reajustes;
  - a próxima ocorrência de uma despesa futura distante começa no início dela.
- `valores.ts`: `parseValorBR`, usado também pelo importador da 09. O arredondamento a centavos não sofre o erro de ponto flutuante de `Math.round(n * 100)`, que transformaria 10,005 em 10,00.
- `validacaoDespesa.ts`: normaliza (os CHECKs do banco recusam espaço nas pontas) e valida por campo, recebendo `hoje` como argumento.
- `listaDespesas.ts`:
  - linhas derivadas, filtros e ordenação;
  - na ordenação, os vazios vão para o fim nas duas direções;
  - custo recorrente do recorte;
  - nomes distintos para as sugestões de autorizador.

**Tela:**
- `DespesasPage`:
  - busca com debounce de 350 ms e 7 filtros;
  - ordenação por coluna com `aria-sort`;
  - rodapé com contagem e custo recorrente mensal;
  - estados vazio, de erro e de carregamento.
  - Clicar na linha abre o formulário em modo de edição, só para quem tem `canManageGastosTI`. A issue 04 troca isso pelo painel lateral.
- `DespesaFormModal`:
  - os 4 blocos da §7 e a prévia das próximas 6 cobranças, com equivalente mensal e total dos próximos 12 meses;
  - "+ Nova categoria" sem sair do formulário;
  - a categoria sugere a natureza.
- `CampoFornecedor`:
  - combobox com teclado sobre `suppliers`;
  - digitar o nome exato de um fornecedor cadastrado já vincula;
  - cadastro rápido com nome e CNPJ/CPF.
- `ModalFormulario`: moldura reaproveitável. Não fecha ao clicar fora e não fecha com ESC enquanto salva.
- `CategoriaForm` deixou de ser `<form>`, porque agora aparece dentro do formulário da despesa e formulário aninhado é HTML inválido.

**Verificação:**
- `tsc`: nenhum erro em `gastos-ti`.
- `eslint` limpo.
- 86 testes do módulo passando.

**Não verificado:** a tela no navegador. As tabelas ainda não existem em nenhum banco, e não há credencial de teste nesta máquina.
