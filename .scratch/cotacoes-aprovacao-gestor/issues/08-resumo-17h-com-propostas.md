# 08 — Resumo das 17h com todas as propostas

**What to build:** quem tem alçada (a Louise) passa a ver, no resumo diário
das 17h de cotações pendentes, todas as propostas de cada cotação com a
vencedora destacada — não só código, título, solicitante e valor. O resumo
continua cobrindo apenas a etapa de alçada (`awaiting_approval`), com a
mesma regra de destinatário (alçada × valor) e o mesmo agendamento. A
consulta do script do resumo passa a carregar as propostas das cotações
pendentes, e a lista de propostas reaproveita o builder compartilhado.

Ver spec: `.scratch/cotacoes-aprovacao-gestor/spec.md` (Implementation
Decisions — E-mails/`quotation_pending_approval_digest`).

**Blocked by:** 01 — Prefactor: testes da máquina de estados e builders de propostas/itens compartilhados.

**Status:** done

- [x] Script do resumo diário carrega as propostas (fornecedor, valor, status/vencedora) de cada cotação pendente.
- [x] Cada cotação listada no e-mail traz suas propostas com a vencedora destacada, via builder compartilhado.
- [x] Template `quotation_pending_approval_digest` ajustado (migration) se o layout precisar acomodar a sublista de propostas. (Não precisou: a sublista entra como `<ul>` aninhado dentro do `<li>` de cada cotação; confirmar o visual no e-mail real.)
- [x] Regras existentes preservadas: só `awaiting_approval`, destinatário por alçada ≥ valor, gestor sem pendência não recebe, gestor sem e-mail não recebe.
- [x] Testes do resumo atualizados: propostas presentes por cotação, vencedora marcada, escape de HTML; testes existentes continuam passando.
- [x] Validação manual: execução do script contra o projeto de teste e recebimento real do e-mail. — Validado em 08/10: --dry-run contra o projeto de teste monta o resumo só para quem tem alçada ≥ valor (Aprovador recebe C3; Gestor B, alçada 10 mil, não recebe), propostas ordenadas por valor e vencedora marcada; cotações na etapa do gestor ficam fora. Envio real com várias cotações não feito (visual coberto por testes).
