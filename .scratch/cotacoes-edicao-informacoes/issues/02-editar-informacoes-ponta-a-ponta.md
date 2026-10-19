# 02 — Editar informações da cotação, de ponta a ponta

**What to build:** quem tem a nova permissão "Editar informações da cotação"
(ou "Administrar Cotações") vê o botão **"Editar informações"** na gaveta de
qualquer cotação que não esteja cancelada nem rejeitada, abre um modal com
título, descrição, justificativa, prioridade, centro de custo, prazo de
entrega e prazo de resposta já preenchidos, altera o que quiser e salva tudo
de uma vez. A alteração é gravada no banco e gera uma entrada
`info_edited` no histórico da cotação com `{ campo: { de, para } }`. As
regras valem também no banco, por trigger, para chamadas diretas ao
Supabase; alterações por SQL sem usuário logado passam sem checagem e ficam
registradas como "Sistema (SQL)". Editar não invalida aprovações nem envia
mensagens.

Nesta fatia a linha do tempo mostra a entrada com o rótulo "Informações
editadas", ainda sem o detalhe "antes → depois" (vem no ticket 03).

Ver spec: `.scratch/cotacoes-edicao-informacoes/spec.md` (Implementation
Decisions — módulo puro, hook, permissão, trigger, tipos de auditoria,
gaveta, modal; Testing Decisions — seams 2 e 3).

**Blocked by:** 01 — Prefactor: regra de edição de informações na máquina de estados.

**Status:** ready-for-human

- [x] Permissão `canEditQuotationInfo` ("Editar informações da cotação", grupo Cotações) cadastrada; migration a concede a todo cargo que já tem `canCreateQuotations`.
- [x] Módulo puro de edição de informações com **validação** (título obrigatório após trim; prioridade em `low | medium | high | urgent`; opcionais vazios viram nulo; prazos no passado aceitos) e **diff** (só campos alterados, `{ de, para }`; vazio ↔ preenchido conta; texto igual após trim não conta; nada alterado = diff vazio), com testes vitest.
- [x] Trigger BEFORE UPDATE em `quotations`, que só age quando algum dos sete campos muda: com usuário logado, recusa em `cancelled`/`rejected`, sem `canEditQuotationInfo` nem `canAdministerQuotations`, ou com validação inválida, com mensagens em português; sem usuário logado, não checa nada.
- [x] O trigger grava em `quotation_audit_logs` a ação `info_edited` com o diff em `details`; sem usuário logado, `performed_by` é `00000000-0000-0000-0000-000000000000` e `performed_by_name` é "Sistema (SQL)".
- [x] Mudanças só de status ou de outros campos (cancelar, enviar para aprovação, aprovar, converter) passam e não geram `info_edited`.
- [x] Ação `info_edited` incluída nos tipos de auditoria, com rótulo "Informações editadas", ícone e cor na linha do tempo.
- [x] Hook de cotações ganha a função que grava as informações no banco e atualiza o estado com o retorno; diff vazio não chama o banco; não grava histórico pelo front.
- [x] Botão "Editar informações" na gaveta visível só com a permissão e fora de cancelada/rejeitada; modal valida com o módulo puro, mostra o erro do banco se o trigger recusar e funciona também em rascunho.
- [ ] Validação manual no Supabase de teste dos cenários do seam 3 da spec (com permissão, só admin, sem permissão, cancelada, rejeitada, título vazio, prioridade inválida, SQL Editor, mudança só de status, concessão da migration).

## Comments

**Implementação (agente):** código, migration e testes prontos; falta só o
último item, que depende de alguém aplicar a migration no projeto de teste.

- Migration: `supabase/migrations/20261019120000_quotation_info_edit.sql`
  (concessão da permissão + trigger `quotation_guard_info_edit`). Ainda não
  aplicada em lugar nenhum — o agente não tem credencial de banco.
- Para o seam 3: colar a migration no SQL Editor de **teste**
  (`eqzqkztgzcngnxmihdom`) e rodar
  `set -a; . ./.env.development.local; set +a; node .scratch/cotacoes-edicao-informacoes/validar-trigger-teste.mjs`.
  O roteiro cobre os cenários do seam 3 com os usuários do seed de
  `cotacoes-aprovacao-gestor` (a chave de serviço faz o papel do SQL Editor:
  sem `auth.uid()`). Para "só admin" ele cria um cargo temporário e devolve o
  usuário ao Operador no fim. No banco de teste nenhum cargo tem
  `canAdministerQuotations` hoje.
- Prazo de entrega: a coluna é `deadline`. O fetch lia `q.delivery_deadline`
  (inexistente), então o prazo de entrega nunca aparecia; corrigido junto,
  porque o modal precisa vir preenchido.
- O `details` gravado pelo trigger tem as chaves das colunas (`title`,
  `description`, `justification`, `priority`, `cost_center`, `deadline`,
  `response_deadline`), e os prazos chegam como timestamp completo — o
  ticket 03 formata a partir disso.
- O cargo Administrador também recebe a chave na migration (explícito, além
  de já ter `canCreateQuotations`), para manter o teste do catálogo de
  permissões coerente.
- Fica para observar: o formulário grava a data como `aaaa-mm-dd` em coluna
  timestamptz (meia-noite UTC), igual à criação de cotação. A gaveta formata
  o prazo de resposta sem fixar UTC e pode mostrar o dia anterior em UTC-3 —
  comportamento que já existia, fora do escopo deste ticket.
