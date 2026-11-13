# 03: LAB-BRAIN acompanha a situação do chamado

**What to build:** o LAB-BRAIN consulta, pelo `id_externo`, um chamado que ele abriu. Recebe a situação, a coluna do Kanban, a prioridade, o responsável e a resolução, para responder ao solicitante até a conclusão. Chamados de outras origens não são visíveis. Ver `../spec.md`, D3, D7 a D9.

**Blocked by:** 02

**Status:** ready-for-agent

- [ ] Só aceita GET, com a mesma chave de chamados, e exige `chamados.ler` no manifesto.
- [ ] Sem `id_externo`, devolve 400.
- [ ] A rota usa a cota `lab-brain-chamados`, compartilhada com a criação.
- [ ] Só encontra chamados com `origem = 'lab-brain'`; qualquer outro devolve 404.
- [ ] Devolve o código, a situação, a coluna do Kanban, a prioridade, o nome do responsável (ou nulo), a resolução (quando o chamado estiver resolvido) e a data da última atualização.
- [ ] Não devolve comentários, anexos nem outros dados pessoais.
- [ ] Testes pela rota, com o Supabase falso:
  - 400, 401 e 404 para outra origem;
  - 200 com resolução e 200 sem resolução;
  - comentários e anexos ausentes.
- [ ] Seção do GET no guia da integração de chamados.
