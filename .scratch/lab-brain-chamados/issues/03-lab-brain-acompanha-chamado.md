# 03: LAB-BRAIN acompanha a situação do chamado

**What to build:** o LAB-BRAIN consulta, pelo `id_externo`, um chamado que ele abriu. Recebe a situação, a coluna do Kanban, a prioridade, o responsável e a resolução, para responder ao solicitante até a conclusão. Chamados de outras origens não são visíveis. Ver `../spec.md`, D3, D7 a D9.

**Blocked by:** 02

**Status:** resolved

- [x] Só aceita GET, com a mesma chave de chamados, e exige `chamados.ler` no manifesto.
- [x] Sem `id_externo`, devolve 400.
- [x] A rota usa a cota `lab-brain-chamados`, compartilhada com a criação.
- [x] Só encontra chamados com `origem = 'lab-brain'`; qualquer outro devolve 404.
- [x] Devolve o código, a situação, a coluna do Kanban, a prioridade, o nome do responsável (ou nulo), a resolução (quando o chamado estiver resolvido) e a data da última atualização.
- [x] Não devolve comentários, anexos nem outros dados pessoais.
- [x] Testes pela rota, com o Supabase falso:
  - 400, 401 e 404 para outra origem;
  - 200 com resolução e 200 sem resolução;
  - comentários e anexos ausentes.
- [x] Seção do GET no guia da integração de chamados.

## Comments

- 13/11/2026: implementado. Rota `GET /api/integracoes/lab-brain-chamado-consultar?id_externo=` em `api/_lib/labBrainChamados.ts` (handler fino em `api/_lib/handlers/integracoes-lab-brain-chamado-consultar.ts`), testes em `api/_lib/labBrainChamados.consulta.test.ts`. Resposta: `codigo`, `situacao`, `coluna_kanban`, `prioridade`, `responsavel`, `resolucao`, `atualizado_em`.
- Decisões fora do texto da spec: `coluna_kanban` é `null` enquanto o chamado está fora do Kanban (`kanban_hidden`), porque o `backlog` padrão enganaria; com vários responsáveis (`assigned_to` é `uuid[]`), `responsavel` traz os nomes separados por vírgula; `resolucao` só sai com a situação `resolved`; o `id` não sai, porque o agente consulta pelo `id_externo`. O 404 consome cota, porque passa da auditoria (a D8 só isenta erro de chave e de parâmetro).
- O guard pedido na 02 foi extraído: `autorizarAgente` e `recusarSemCota` em `api/_lib/agentes/rotaAgente.ts`, usados pelas três rotas do LAB-BRAIN (apoio, criação e consulta). `primeiro` passou a ser exportado de `labBrainApoio.ts`.
