# 07: Remover a integração por chave de API da Tabela-Particular

**What to build:** com o Gerador de Orçamento em produção e a Tabela-Particular desligada, o flowlab deixa de manter a porta de entrada que só existia para o app externo: sai o endpoint `/api/integracoes/orcamento-particular`, a validação por chave dedicada e a variável `TABELA_PARTICULAR_API_KEY`. A montagem da lista de preços fica, porque o endpoint interno usa.

Ver `.scratch/gerador-orcamento/spec.md` → histórias 43–44 e "Desligamento".

**Blocked by:** 05 — Custos: PDF interno e custo controlado pela permissão; 06 — Leitura do pedido médico por IA; e a confirmação do responsável de que o projeto da Tabela-Particular foi desligado na Vercel depois do período de plano B

**Status:** ready-for-human

- [ ] Responsável confirmou neste arquivo (em `## Comments`) que a Tabela-Particular foi desligada
- [ ] Endpoint `/api/integracoes/orcamento-particular` e seus testes removidos
- [ ] Validação por `TABELA_PARTICULAR_API_KEY` removida; a montagem da lista de preços e seus testes continuam
- [ ] Variável `TABELA_PARTICULAR_API_KEY` removida dos ambientes (Vercel/Docker) e de qualquer `.env.example`
- [ ] Nenhuma referência restante à integração no código ou na documentação ativa
