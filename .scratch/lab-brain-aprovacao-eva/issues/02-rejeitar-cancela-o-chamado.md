# 02: Rejeitar cancela o chamado e o motivo chega ao LAB-BRAIN

**What to build:** quem aprova rejeita a sugestão de um chamado do LAB-BRAIN com um motivo, avisado de que o texto vai para o solicitante. O chamado é cancelado na mesma operação, pela tela ou pelo WhatsApp, e a consulta do LAB-BRAIN devolve `cancelled` com o motivo em `resolucao`. Ver `../spec.md`: Banco (Rejeição), Rota de consulta e Tela.

**Blocked by:** 01

**Status:** ready-for-agent

- [ ] A RPC de rejeição, que já exige motivo, cancela o chamado na mesma transação quando a sugestão é `promover_card`. O motivo vira a resolução do chamado.
- [ ] Vale para o caminho da tela e para o "como" do WhatsApp.
- [ ] Quem não pode aprovar sugestões da EVA é barrado na rejeição.
- [ ] Rejeitar outros tipos de sugestão continua igual.
- [ ] A consulta devolve `resolucao` também quando a situação é `cancelled`. O pendente continua sem resolução.
- [ ] Na tela, o campo de motivo da rejeição de um `promover_card` avisa que o texto vai para o solicitante pelo LAB-BRAIN.
- [ ] Testes pela rota de consulta: cancelado com `resolucao`; pendente sem `resolucao`.
- [ ] Script SQL de verificação, no banco de teste com `ROLLBACK`:
  - rejeitar sem motivo é recusado;
  - rejeitar com motivo cancela o chamado e grava a resolução;
  - quem não pode aprovar é barrado.
- [ ] Migration aplicada no banco de teste (`eqz`).
