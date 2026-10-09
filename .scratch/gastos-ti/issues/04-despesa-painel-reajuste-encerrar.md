# 04 — Despesa: painel lateral, reajuste, encerrar e excluir

**What to build:** clicar numa despesa abre um painel lateral com os dados, as próximas
12 ocorrências, o histórico de valores e a auditoria. Dali o usuário edita (correção do
valor base, vale desde o início), **reajusta** (novo valor a partir de uma competência,
sem reescrever o passado), **encerra** (informa a última competência) ou **exclui**
(só enquanto não houver lançamentos).

Plano: §4.1 (`ti_despesa_reajustes`), §7, RF02–RF04, RF06, RN04, RN08.

**Blocked by:** 03

**Status:** done (migration gerada, ainda não aplicada; tela não conferida no navegador)

- [x] Migration: `ti_despesa_reajustes` (UNIQUE `despesa_id` + `vigente_desde`, motivo com CHECK), RLS e auditoria.
- [x] `domain/recorrencia.ts`: valor vigente passa a considerar reajustes (RN04 itens 2 e 3), com testes de reajuste no meio do intervalo e reajuste futuro que ainda não vale.
- [x] `DespesaDrawer` com dados, próximas ocorrências, histórico de valores e auditoria legível (antes → depois). Implementado como `DespesaPainel`.
- [x] `ReajusteModal`: competência, valor, motivo, quantidade opcional, observação.
- [x] Encerrar = definir `competencia_fim`; a despesa sai das projeções a partir dali.
- [x] Excluir: o botão aparece sempre para quem gerencia; quem barra a exclusão de despesa com lançamentos é o banco (o `RESTRICT` entra na 06), e a tela traduz o 23503 numa mensagem que orienta a encerrar.
- [x] `npx tsc --noEmit`, `npm run lint` e `npm test` sem erros novos.

## Comments

**01/Out/2026 — implementado.**

**Migration:** `supabase/migrations/20261009140000_gastos_ti_reajustes.sql`.
- Começa com um guarda que exige a migration da 03.
- O trigger `ti_despesa_reajustes_validar` recusa reajuste no mês inicial ou antes dele, com erro 23514 e mensagem explicando que nesse caso o certo é corrigir o valor base. Ele também mantém `created_by`/`created_at` imutáveis.
- Apagar a despesa apaga os reajustes (CASCADE).
- As linhas de auditoria dos reajustes carregam `despesa_id`, e é assim que o histórico da despesa as encontra.

**Teste da migration (PGlite):** 17 de 17 verificações passaram:
- guarda;
- reaplicação;
- RLS;
- mês duplicado (23505);
- mês inicial e meses anteriores (23514);
- 4 CHECKs;
- `created_by` imutável;
- remoção;
- cascata;
- auditoria com `despesa_id`.

**Regras puras:**
- `quantidadeVigente` (em `recorrencia.ts`).
- `reajustes.ts`: validação, vigência sugerida e variação.
- `auditoria.ts`: transforma o antes/depois em jsonb em frases como "Valor base: R$ 2.480,00 → R$ 2.600,00", com rótulos e formatação por campo. Ignora carimbos e trata o caso de fornecedor desvinculado.
- 18 testes novos, 104 no módulo.

**Hooks:**
- `useDespesasTI` carrega os reajustes embutidos e ganhou `registrarReajuste`, `removerReajuste`, `definirFim` e `excluirDespesa`.
- `useAuditoriaDespesa` busca só quando a seção abre: as linhas da despesa e as das tabelas filhas, pelo `despesa_id` no jsonb. A partir da 06, isso já inclui os lançamentos, sem mudar nada aqui.

**Tela:**
- `PainelLateral`: cópia local do `DrawerLateral` de Qualidade, com ESC desligável enquanto há formulário por cima.
- `DespesaPainel`:
  - resumo, dados e próximas 12 cobranças;
  - custo por unidade/mês quando há quantidade;
  - histórico de valores com variação %;
  - remover reajuste com confirmação em dois cliques;
  - histórico de alterações em linha do tempo.
- `ReajusteModal`: mostra "antes" e a variação em R$ e %, e avisa quando uma renegociação com redução vai contar como economia.
- `EncerramentoModal`: também permite tirar o prazo.
- `ExcluirDespesaModal`: botão vermelho.
- O `ModalFormulario` foi para z-[70], acima do painel, e ganhou a variante `perigo`.
- Clicar na linha da lista agora abre o painel para todos, inclusive quem só visualiza. A edição sai do painel.
- A lista mostra a quantidade vigente.

**Ajuste de ambiente:** a ferramenta de edição transforma ` ` e `̀` escritos no código no caractere literal, o que o lint acusou. Os dois arquivos afetados foram regravados com o escape em texto, e nenhum caractere invisível literal sobrou no módulo nem nas migrations.

**Verificação:**
- `tsc`: nenhum erro em `gastos-ti`.
- `eslint` limpo.
- 104 testes do módulo passando.
