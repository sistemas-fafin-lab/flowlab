# 02: Rejeitar cancela o chamado e o motivo chega ao LAB-BRAIN

**What to build:** quem aprova rejeita a sugestão de um chamado do LAB-BRAIN com um motivo, avisado de que o texto vai para o solicitante. O chamado é cancelado na mesma operação, pela tela ou pelo WhatsApp, e a consulta do LAB-BRAIN devolve `cancelled` com o motivo em `resolucao`. Ver `../spec.md`: Banco (Rejeição), Rota de consulta e Tela.

**Blocked by:** 01

**Status:** done

- [x] A RPC de rejeição, que já exige motivo, cancela o chamado na mesma transação quando a sugestão é `promover_card`. O motivo vira a resolução do chamado.
- [x] Vale para o caminho da tela e para o "como" do WhatsApp.
- [x] Quem não pode aprovar sugestões da EVA é barrado na rejeição.
- [x] Rejeitar outros tipos de sugestão continua igual.
- [x] A consulta devolve `resolucao` também quando a situação é `cancelled`. O pendente continua sem resolução.
- [x] Na tela, o campo de motivo da rejeição de um `promover_card` avisa que o texto vai para o solicitante pelo LAB-BRAIN.
- [x] Testes pela rota de consulta: cancelado com `resolucao`; pendente sem `resolucao`.
- [x] Script SQL de verificação, no banco de teste com `ROLLBACK`:
  - rejeitar sem motivo é recusado;
  - rejeitar com motivo cancela o chamado e grava a resolução;
  - quem não pode aprovar é barrado.
- [x] Migration aplicada no banco de teste (`eqz`).

## Notas da implementação

- O motivo também entra na conversa do chamado como mensagem `resolution`, como faz `it_resolver_chamado`.
- Chamado já resolvido, já cancelado ou apagado: só a sugestão é rejeitada, e o chamado fica como está.
- Chamado já no Kanban (promovido por fora): a rejeição é recusada, como a aprovação. Até a issue 03 (trigger de substituição) chegar, essa sugestão fica presa na fila. **A 02 não vai para produção sem a 03.**
- No WhatsApp, a confirmação de "rejeitar" avisa que o chamado do LAB-BRAIN é cancelado e que o motivo vai para quem pediu.
- Migration `20261113160000_eva_rejeitar_promover_card.sql` aplicada no `eqz` e registrada no histórico. Verificação em `supabase/scripts/verificar_eva_rejeitar_promover_card.sql`. O script da issue 01 continua passando.
