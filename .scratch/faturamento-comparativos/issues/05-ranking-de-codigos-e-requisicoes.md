# 05: Ranking de códigos de glosa e requisições por código

**What to build:** na aba Comparativos, o ranking de códigos de glosa com alternador **Total | Acatada** (padrão Acatada), mostrando código, descrição, valor, quantidade e % do total. Clicar num código abre a tabela de requisições (requisição, guia, lote, convênio, procedimento, valor glosado, status, data) com exportação CSV e **sem nome de paciente**. A lista vem da foto de recursos e/ou dos demonstrativos do apLIS, não de `glosas.requisicao_id` (quase vazio). Ver `../spec.md`.

**Blocked by:** 04

**Status:** ready-for-agent

- [ ] O ranking Acatada e o Total batem com o funil do mesmo mês.
- [ ] Código sem descrição aparece só pelo código.
- [ ] A tabela e o CSV não contêm nome de paciente.
- [ ] Testes do ranking (ordenação, percentual, centavos) e da rota; `npm test` e typecheck passam.
