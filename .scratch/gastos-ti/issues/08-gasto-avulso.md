# 08 — Gasto avulso no mês

**What to build:** no Mês a mês, o botão "+ Gasto avulso" registra uma cobrança que não
estava prevista (ex.: cobrança extra de um fornecedor). Ela vira uma despesa de
recorrência única naquela competência, com os mesmos campos obrigatórios do cadastro
(categoria, fornecedor, valor, forma de pagamento, autorizado por), e opcionalmente já
com a baixa feita.

Plano: §7 (Mês a mês), RF14.

**Blocked by:** 06

**Status:** done (sem migration nova; tela não conferida no navegador)

- [x] `GastoAvulsoModal` reaproveitando os campos do formulário de despesa (`CampoFornecedor`, `CampoArquivos`, validação de `validarDespesa`), com recorrência fixa em Única e competência = mês aberto.
- [x] Opção "já foi pago" cria a despesa e a baixa em seguida. Se a baixa falhar, o modal fecha (salvar de novo duplicaria a despesa) e um aviso diz explicitamente que a cobrança foi registrada sem baixa.
- [x] O avulso aparece na lista do mês e na aba Despesas (é uma despesa como as outras).
- [x] `npx tsc --noEmit`, `npm run lint` e `npm test` sem erros novos.

## Comments

**01/Out/2026 — implementado.**

**Regras puras, `domain/avulso.ts` (5 testes):**
- `despesaDoAvulso` transforma o formulário curto numa despesa única: o dia de vencimento sai da data escolhida.
- `validarVencimentoNoMes`: o vencimento precisa cair no mês aberto.
- Um teste confirma que a despesa gerada passa em `validarDespesa` e produz exatamente uma ocorrência, no mês aberto. É essa a condição que o trigger de `ti_lancamentos` exige para aceitar a baixa.

**Ajuste de tipo:** `linhaBaixa` e `registrarBaixa` passaram a aceitar `OcorrenciaParaGravar`, o mínimo de uma ocorrência. Assim o avulso dá baixa na despesa recém-criada sem montar uma `OcorrenciaDoMes` inteira.

**Tela:**
- Botão "+ Gasto avulso" no cabeçalho do Mês a mês, só para quem gerencia.
- O campo de vencimento fica limitado ao mês.
- "Já foi pago" vem marcado por padrão, com data, NF e comprovante. Gasto avulso costuma ser registrado depois de pago.

**Verificação:**
- `tsc`: nenhum erro em `gastos-ti`. O ícone `ReceiptText` não existe na versão do lucide do projeto e foi trocado por `FilePlus`.
- `eslint` limpo.
- 153 testes do módulo passando.
