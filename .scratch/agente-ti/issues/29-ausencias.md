# 29 — Ausências da equipe

**What to build:** férias, licença e folga marcadas na EVA. Nesse período, ninguém cobra a pessoa, e o gestor fica sabendo do que vence enquanto ela está fora. Sugestão aceita pelo usuário em 24/Nov.

Plano: §2 (D40) e §11.8.

**Blocked by:** nada.

**Status:** done no código (24/Nov/2026). Falta aplicar a migration e publicar.

- [x] **Aba Membros:** de (opcional), até e motivo, no `DatePicker` do design system. O selo "de férias até 05/12" aparece na lista.
- [x] **WhatsApp:** a intenção `ausencia`.
  - "vou estar de férias de 01/12 a 05/12" e "amanhã vou faltar" marcam; "voltei" desfaz.
  - O gestor marca a de outra pessoa.
  - Quem marca a própria avisa os gestores no sino, com o que vence no período.
- [x] **Cobrança:** a pessoa ausente fica fora da cobrança da manhã e da pedida pelo gestor. A recusa e o botão Cobrar dizem até quando.
- [x] **Relatório de gestão:**
  - quem está fora sai da sobrecarga;
  - a lista por pessoa mostra a ausência;
  - a "Atenção" avisa de quem sai em até 7 dias com card vencendo, e sugere quem cobre.
- [ ] Aplicar a migration e publicar.
- [ ] Conferir: marcar uma ausência pelo WhatsApp e ver o selo na aba Membros.

## Comments

**24/Nov/2026 — implementado no código.**
- **Conferido com o Claude real, dados fictícios:** "vou estar de férias de 01/12 a 05/12", "amanhã vou faltar, tenho consulta médica", "voltei das férias!" e "o Bruno está de folga até sexta" viraram a intenção certa, com as datas e a pessoa.
- **Testes:**
  - `domain/ausencia.test.ts`;
  - `domain/cobranca.test.ts` (`presentes`, o botão);
  - `domain/gestao.test.ts` (coberturas, sobrecarga);
  - `ti-agente-cobrar.test.ts` (responsável ausente);
  - `comandos.test.ts` (marcar, desfazer, gestor marca a de outra pessoa, datas).
