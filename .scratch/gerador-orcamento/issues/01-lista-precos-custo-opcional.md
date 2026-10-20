# 01: Montagem da lista de preços com custo opcional

**What to build:** preparação para o Gerador de Orçamento. A montagem da lista de preços que hoje alimenta o endpoint por chave de API da Tabela-Particular passa a aceitar uma opção "sem custo". Com ela desligada, a consulta nem busca as colunas de custo dos exames e os itens saem sem o campo `custo`. Sem mudança de comportamento para quem já usa: o endpoint por chave de API continua pedindo a lista **com** custo e responde exatamente como hoje.

Ver `.scratch/gerador-orcamento/spec.md` → "Endpoint interno de preços".

**Blocked by:** None (can start immediately)

**Status:** done no código (20/Out/2026; sem migration nova); falta publicar

- [x] A montagem da lista de preços recebe uma opção que diz se o custo entra
- [x] Sem custo: a consulta aos exames não seleciona as colunas de custo e nenhum item da resposta tem a chave `custo`
- [x] Com custo: a resposta é idêntica à atual (custo direto + indireto; `null` quando o TUSS não tem exame correspondente)
- [x] O endpoint `/api/integracoes/orcamento-particular` chama a montagem com custo e não muda de comportamento
- [x] Os testes existentes da montagem continuam passando, e há testes novos para o caso sem custo (Supabase falso, só comportamento observável)
