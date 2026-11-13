# 01: Chamado do LAB-BRAIN vira sugestão e a aprovação o promove para o Kanban

**What to build:** quando o LAB-BRAIN abre um chamado, ele nasce na hora como hoje (`201 { id, codigo }`, pendente, fora do Kanban), e em segundo plano nasce uma sugestão de promoção na fila da EVA, montada pela regra fixa. Quem aprova sugestões é avisado no sino, vê a sugestão em EVA → Sugestões com o selo "via LAB-BRAIN", ajusta a proposta se quiser e aprova pela tela ou pelo WhatsApp. O chamado entra no Kanban e o LAB-BRAIN vê a coluna na consulta. Ver `../spec.md`: Solution, Banco, Rota de criação e Tela.

**Blocked by:** None (can start immediately)

**Status:** done

- [x] A fila de sugestões da EVA aceita o tipo `promover_card` e a origem `lab-brain`. Há no máximo uma sugestão `promover_card` por chamado (índice único parcial). Migration idempotente.
- [x] Chamado **novo** do LAB-BRAIN agenda a criação da sugestão em segundo plano (`waitUntil`) e responde `201` sem esperar. O reenvio (`200`) não agenda nada nem cria outra sugestão.
- [x] A sugestão nasce pela regra fixa: coluna "A Fazer", a prioridade enviada, sem responsável e sem prazo, com a marca "sem análise da EVA". Ela fica ligada ao chamado e pendente.
- [x] A gravação da sugestão dispara o aviso do sino para quem aprova, pelo mesmo caminho das outras sugestões.
- [x] Falha ao gravar a sugestão vai para o log e não muda a resposta da criação.
- [x] A RPC de aprovação trata `promover_card`. Na mesma transação, tira o chamado de "fora do Kanban" e aplica coluna, prioridade, responsáveis e prazo, usando a proposta editada quando houver. A situação segue a regra de coluna que a RPC já usa.
- [x] Quem não pode aprovar sugestões da EVA é barrado na RPC, que é `SECURITY DEFINER`.
- [x] A aprovação pelo WhatsApp da EVA funciona para `promover_card` pelo mesmo caminho "como".
- [x] Em EVA → Sugestões, a sugestão `promover_card` mostra:
  - o selo "via LAB-BRAIN", o código, o título, a descrição e o solicitante;
  - a proposta, e a marca "sem análise" quando houver.

  Ela permite editar coluna, prioridade, responsáveis e prazo, como as outras sugestões, na identidade visual do FlowLab.
- [x] Testes pela rota de criação, com o Supabase falso e o trabalho em segundo plano executado na hora:
  - a sugestão nasce;
  - a regra fixa é aplicada;
  - o reenvio não duplica;
  - a falha ao gravar a sugestão mantém o `201`.
- [x] Script SQL de verificação, rodado no banco de teste em transação com `ROLLBACK`:
  - aprovar promove, inclusive com a proposta editada;
  - quem não pode aprovar é barrado;
  - a segunda sugestão `promover_card` para o mesmo chamado é recusada.
- [x] Migration aplicada no banco de teste (`eqz`), com ensaio em `ROLLBACK` e registro no histórico.
