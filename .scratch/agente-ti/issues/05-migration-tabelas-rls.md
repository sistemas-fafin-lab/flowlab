# 05 — Migration: tabelas e RLS do agente

**What to build:** a migration com as seis tabelas do agente e as regras de acesso:
- `ti_agente_config` (uma linha só);
- `ti_agente_membros`;
- `ti_agente_reunioes` (com `provedor` e `motivo_reserva`, D17);
- `ti_agente_sugestoes`;
- `ti_agente_mensagens`;
- `ti_agente_chamadas_ia`, o registro de cada chamada ao Claude ou ao Gemini (RN14). Só metadados, nunca texto de reunião ou mensagem.

Ainda sem as RPCs de aprovação, que ficam na 11.

Pontos que exigem atenção:
- `ti_agente_membros` e `ti_agente_mensagens` têm telefones e conversas, e só os aprovadores leem.
- Nenhuma tabela aceita gravação de reuniões, sugestões ou mensagens pelo cliente. Isso fica com o servidor e a VPS, usando a service role.
- `chave_dia` UNIQUE em `ti_agente_mensagens` garante uma cobrança por pessoa por dia, mesmo se o cron rodar duas vezes.

Plano: §6.1, §6.2 e convenções da §6.

**Blocked by:** 01 (a chave `canApproveAgenteTI` precisa existir no front para os testes de ponta a ponta).

**Status:** ready-for-agent

- [ ] Migration `2026MMDDhhmmss_agente_ti_tabelas.sql`, idempotente, com a guarda de `current_user_has_permission` no topo.
- [ ] As seis tabelas, com CHECKs nomeados, índices, `COMMENT ON` em pt-BR e triggers de `updated_at`.
- [ ] `ti_agente_config` com a linha inicial (`granola_folder_id = 'fol_WEROcYgPA0ti68'`, tudo desligado, `dias_parado = 5`) e as colunas `waha_status` / `waha_verificado_em` (D25).
- [ ] `ti_agente_mensagens` com:
  - `tipo` incluindo `cobranca_manual`;
  - `status` incluindo `entregue` e `lida`;
  - coluna `enviada_por` (D22, D24).
- [ ] `ti_agente_chamadas_ia` com `finalidade` incluindo `chat` e coluna `user_id`, base do limite diário do chat (RN17).
- [ ] `ti_agente_sugestoes` com `origem` (`reuniao`, `whatsapp`, `comentario`, `chat`) e `proposta_por` (D28, RN18).
- [ ] RLS conforme a tabela da §6.2.
- [ ] Nenhum `INSERT` em `custom_roles` (D15).
- [ ] Conferência manual descrita na issue:
  - sem chave, não lê nada;
  - só `canManageIT` lê reuniões, sugestões e o registro de IA, mas não lê membros nem `ti_agente_mensagens` (a fila do WhatsApp é só para gestores, D24);
  - aprovador lê tudo.
- [ ] Atualizar a §6 do plano se algo mudar na implementação.

## Comments
