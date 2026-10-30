## Context

Após as propostas 1 e 2, os dados pessoais vivem em `colaborador_dados_pessoais` (escrita só com `canManageColaboradores`) e o colaborador lê os próprios no Meu perfil. O projeto já tem fluxos de aprovação com RPC atômica e trava de status — `payment_request_decidir_autorizacao` (pagamentos) e `requests_decidir_sc` (solicitações de compra) — e a central de notificações `user_notifications`.

## Goals / Non-Goals

**Goals:**
- Colaborador propõe alterações; RH aprova/recusa; aplicação atômica.
- Toda regra crítica no banco (uma pendente, campos permitidos, quem decide).

**Non-Goals:**
- E-mail, anexo de comprovante, alteração de dados cadastrais/nome/CPF, tela de histórico.

## Decisions

### D1. Modelo
`colaborador_solicitacoes_alteracao(id, colaborador_id fk, solicitado_por uuid fk user_profiles, alteracoes jsonb, status text CHECK in ('pendente','aprovada','recusada','cancelada'), motivo_recusa text, decidido_por uuid, decidido_em timestamptz, resultado_visto_em timestamptz, created_at)`.
`alteracoes` = `[{campo, de, para}]` com `campo` entre as 9 colunas editáveis de `colaborador_dados_pessoais`.
Índice único parcial `(colaborador_id) WHERE status = 'pendente'` garante uma pendente por colaborador.
A tabela também é o histórico de auditoria das alterações feitas por solicitação.

### D2. RPCs `SECURITY DEFINER` (padrão de `payment_request_decidir_autorizacao`)
- `rh_solicitar_alteracao(p_alteracoes jsonb)`: resolve o colaborador por `auth.uid()`; rejeita campos fora da lista; descarta itens sem diferença real; recalcula `de` a partir de `colaborador_dados_pessoais`; valida domínios (reaproveita os CHECKs aplicando os valores em um registro temporário ou validando explicitamente); insere; notifica os usuários com `canManageColaboradores`.
- `rh_cancelar_solicitacao(p_id)`: só o dono, só se pendente.
- `rh_decidir_solicitacao(p_id, p_aprovar bool, p_motivo text)`: exige `canManageColaboradores`; `SELECT ... FOR UPDATE`; erro `'Esta solicitação não está mais pendente.'` se status ≠ pendente; se aprovar, upsert em `colaborador_dados_pessoais` com os `para`; grava decisão; notifica o colaborador (se tiver `user_profile_id`).
- `rh_dispensar_resultado(p_id)`: só o dono; grava `resultado_visto_em`.
Todas com `search_path` fixo.
- **Alternativa**: INSERT/UPDATE direto com RLS + triggers — mais pontos de falha; o projeto já preferiu RPC para decisões.

### D3. RLS da tabela
SELECT: `canViewColaboradores OR canManageColaboradores OR` dono. Sem policies de INSERT/UPDATE/DELETE (só as RPCs escrevem).

### D4. Destinatários da notificação ao RH
Usuários ativos cujo cargo tem `canManageColaboradores`, resolvidos dentro da RPC pelo mesmo mecanismo de `current_user_has_permission` (consultar a função para reaproveitar a lógica de cargo → permissões). Link: `/rh/colaboradores?colaborador=<id>` — a `ColaboradoresPage` passa a abrir o modal quando recebe esse parâmetro.

### D5. Front
- `hooks/useSolicitacaoAlteracao(colaboradorId)`: última solicitação relevante (pendente, ou decidida com `resultado_visto_em` nulo) + ações.
- Edição no Meu perfil reaproveita os inputs de `DadosPessoaisSection` com `modo: 'colaborador'` (diff contra os valores atuais, marcação "Alterado", rodapé sticky).
- Função pura `calcularAlteracoes(atuais, editados)` em `utils/` com testes (mesma regra que a RPC aplica; a RPC continua sendo a fonte da verdade).
- Lista: `useColaboradores` passa a trazer `tem_solicitacao_pendente` (subselect/`exists` via view ou contagem embutida `colaborador_solicitacoes_alteracao(count)` filtrada por status).

## Risks / Trade-offs

- [RH edita diretamente um campo que também está numa solicitação pendente; ao aprovar, o valor do RH é sobrescrito] → o banner do RH destaca quando o valor atual difere do `de` registrado ("valor atual mudou desde o pedido"), para o RH decidir conscientemente.
- [RPCs `SECURITY DEFINER` com bug ampliam acesso] → validar dono/permissão no início de cada função; testar com usuário comum tentando decidir e solicitar para outro.
- [Ruído de notificação para muitos usuários com a chave] → aceitável hoje (poucos usuários no RH).

## Migration Plan

Migration (tabela, índice, RLS, RPCs) + front no mesmo deploy. Rollback: reverter o front; a tabela e RPCs podem ficar sem uso.

## Open Questions

- Nenhuma bloqueante.
