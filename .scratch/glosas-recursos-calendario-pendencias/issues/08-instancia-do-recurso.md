# 08: Instância do recurso

Spec: `.scratch/glosas-recursos-calendario-pendencias/spec.md`

**What to build:** cada requisição em recurso mostra a Instância do recurso (1º, 2º ou 3º). Ela vem do apLIS (7 → 1º, 16 → 2º), guarda a maior já vista e pode ser marcada à mão por um lápis no detalhe da requisição. A marcação manual prevalece, entra no histórico e gera um aviso quando diverge do apLIS.

**Blocked by:** None (can start immediately)

**Status:** done

- [x] Migração: instância observada na foto da requisição e campo "instância" nas edições manuais, com RLS igual ao das edições atuais.
- [x] A sincronização grava a maior instância vista; na primeira vez, 7 → 1, 16 → 2 e o resto fica vazio.
- [x] Função pura de instância vigente e divergência, com testes (observada só cresce, editada vence, sem instância).
- [x] O detalhe mostra a instância; o lápis aparece só para quem gerencia o faturamento; a edição vai para o histórico com valor anterior, novo e usuário.

## Comments

- Implementado em 27/11/2026.
  - Migração `20261127100000_glosa_recurso_instancia.sql`: `instancia_observada` e `instancia_editada` (+ `_por`, `_em`) na foto; carga 7 → 1, 16 → 2; a RPC `glosa_recurso_gravar_edicao` passa a aceitar `instancia_editada`. RLS: a mesma das outras edições (UPDATE da foto e RPC exigem canManageBilling).
  - Regras puras em `recursoGlosa.ts`: `instanciaObservada` (só cresce) e `instanciaDoRecurso` (vigente e divergência); `eventoEdicaoManual('instancia', …)` grava "de 1º recurso para 3º recurso".
  - Sincronização: grava a maior instância vista. Requisição com instância marcada à mão não sai da foto, como as outras edições.
  - Detalhe: campo "Instância do recurso" com lápis (seletor 1º/2º/3º), dica com a do apLIS quando editada, e aviso quando diverge. A lista do lote mostra um chip com a instância.
- **Decisão: divergência quando o apLIS não tem instância.** Marcar uma instância numa requisição sem instância observada (ex.: já paga antes do campo existir) também gera o aviso, seguindo a spec ao pé da letra ("existe edição e ela é diferente da observada").
- Marcar à mão o mesmo valor que o apLIS já indica grava a edição e o evento: a instância passa a ficar fixada, sem acompanhar o apLIS.
