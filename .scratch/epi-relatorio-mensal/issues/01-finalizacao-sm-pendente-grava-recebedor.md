# 01: Finalização de solicitação de materiais pendente grava recebedor e assinatura

**What to build:** quando o estoquista finaliza uma solicitação de materiais direto do estado pendente (o que as ações de solicitação já permitem), o nome de quem recebeu e a assinatura passam a ser gravados como numa solicitação aprovada. Se a gravação do recebedor e da assinatura não afetar nenhuma solicitação, a finalização mostra erro em vez de concluir a solicitação sem assinatura. Spec: `.scratch/epi-relatorio-mensal/spec.md` (Módulos → Finalização; Testing Decisions → Correção da finalização).

**Blocked by:** None (can start immediately).

**Status:** done

- [x] A gravação do recebedor e da assinatura aceita as mesmas situações em que a solicitação de materiais pode ser finalizada (pendente ou aprovada), usando a mesma regra das ações de solicitação, não uma lista duplicada.
- [x] Finalizar uma solicitação de materiais pendente grava o recebedor e a assinatura, que aparecem no "ver assinatura".
- [x] Se nenhuma linha for gravada, o usuário vê um erro e a solicitação não é marcada como concluída.
- [x] O fluxo de solicitação aprovada continua igual.
- [x] O teste existente das ações de solicitação ganha o caso "solicitação de materiais pendente pode ser finalizada".
