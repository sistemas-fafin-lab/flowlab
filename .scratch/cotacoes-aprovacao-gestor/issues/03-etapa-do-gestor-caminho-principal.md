# 03 — Etapa do gestor: caminho principal

**What to build:** a aprovação de cotações passa a ter a etapa do gestor do
pedido antes da alçada. Enviar para aprovação leva a cotação para o novo
status "Aprovação do gestor" (`awaiting_manager_approval`), que aparece no
stepper, nos cards de status e no filtro da lista de cotações. Pela lista
completa de cotações, o gestor do pedido (ou um admin, no lugar dele) abre o
mesmo modal-resumo de aprovação usado hoje — com todas as propostas, troca
de vencedora e assinatura eletrônica — e:

- **aprova** → a cotação segue para "Aguardando aprovação" e só então sai o
  e-mail de alçada (`quotation_awaiting_approval`) para quem tem alçada;
- **rejeita** (comentário obrigatório) → a cotação volta para "Em análise".

Na etapa do gestor não há checagem de valor/alçada. A regra de quem pode
decidir fica numa RPC nova no servidor. Neste ticket a aprovação do gestor
**sempre** leva para a etapa de alçada — a dispensa por alçada do gestor é o
ticket 04.

Ver spec: `.scratch/cotacoes-aprovacao-gestor/spec.md` (Implementation
Decisions — Status novo, Schema/níveis, RPC nova, Auditoria, Modal-resumo,
E-mails/`quotation_awaiting_approval`, Transição no deploy).

**Blocked by:** 01 — Prefactor: testes da máquina de estados e builders de propostas/itens compartilhados; 02 — Gestor do pedido na SC e na cotação.

**Status:** done

- [x] Status `awaiting_manager_approval` ("Aprovação do gestor") no tipo, rótulos, cores, stepper, cards de status, filtro da lista e em qualquer constraint/rótulo de status no banco.
- [x] Máquina de estados: `under_review → awaiting_manager_approval`, `awaiting_manager_approval → awaiting_approval | under_review | cancelled`; aprovação e troca de vencedora permitidas em `awaiting_manager_approval`. Testes da máquina de estados atualizados/estendidos.
- [x] Enviar para aprovação leva a `awaiting_manager_approval` e **não** dispara mais o e-mail de alçada.
- [x] `quotation_approvals` distingue a linha da etapa do gestor (nível próprio, ex. `manager`) da linha da alçada, mantendo uma linha por etapa.
- [x] RPC nova de decisão da etapa do gestor (`SECURITY DEFINER`, atômica, `FOR UPDATE`): autoriza antes de ler a cotação (usuário = `requester_manager_id` ou admin), exige status `awaiting_manager_approval`, valida o valor informado contra o valor real atual, exige comentário na rejeição.
- [x] Aprovação do gestor → status `awaiting_approval` e disparo do e-mail de alçada existente para quem tem alçada ≥ valor.
- [x] Rejeição do gestor → status `under_review`, comentário gravado.
- [x] Modal-resumo em `awaiting_manager_approval`: sem aviso de "fora da alçada", comentário obrigatório na rejeição, chama a RPC nova; troca de vencedora reaproveita a operação existente.
- [x] Auditoria: envio para a etapa do gestor, aprovação/rejeição do gestor (indicando quando foi admin no lugar do gestor), troca de vencedora na etapa 1.
- [x] Cotações já em `awaiting_approval` antes do deploy continuam na etapa de alçada, sem mudança.
- [x] Validação manual no projeto Supabase de teste — Validado em 07–08/10 no projeto de teste (migrations aplicadas): gestor aprova (C1), gestor rejeita com comentário obrigatório (C2), admin aprova no lugar do gestor com nota na auditoria (C2), outro usuário sem o botão de aprovar (C5), valor defasado recusado com mensagem (C5).
