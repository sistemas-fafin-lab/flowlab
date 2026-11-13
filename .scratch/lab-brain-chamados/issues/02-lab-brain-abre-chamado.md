# 02: LAB-BRAIN abre um chamado e o TI o vê com o selo

**What to build:** o LAB-BRAIN chama a rota de criação de chamado com a chave dele e um chamado comum de TI nasce no nome do solicitante. O chamado entra pendente e fora do Kanban, igual ao aberto pela tela. Na lista e no detalhe dos chamados, o TI vê o selo "via LAB-BRAIN". Reenviar o mesmo `id_externo` não duplica o chamado. Ver `../spec.md`, D1, D2, D4 a D6, D8, D9, D11, D12, D13.

**Blocked by:** 01

**Status:** resolved

- [x] Os chamados de TI ganham as colunas `origem` (nula = tela) e `id_externo`, únicas por origem quando preenchidas. A migration é idempotente.
- [x] A rota fica no dispatcher de integrações que já existe e só aceita POST; outro método devolve 405.
- [x] Autenticação com a chave de chamados do LAB-BRAIN; sem chave ou com chave errada, 401. A chave de leitura do apoio não abre a rota.
- [x] A rota exige `chamados.criar` no manifesto.
- [x] Validação do corpo:
  - `titulo` (até 255 caracteres, sem espaço sobrando), `descricao` (até 5.000), `solicitante_email` e `id_externo` são obrigatórios;
  - `prioridade` aceita só `low|medium|high|critical`, padrão `medium`;
  - `tipo` aceita só `suporte|desenvolvimento`, padrão `suporte`;
  - entrada inválida devolve 400.
- [x] O solicitante é procurado pelo e-mail, sem diferenciar maiúsculas. Se não existir, ou se estiver removido ou desativado, devolve 422 com uma mensagem clara.
- [x] A cota `lab-brain-chamados` é de 10 por minuto, com auditoria. Sem cota, devolve 429 com `Retry-After`. Erros de chave e de parâmetro não consomem cota.
- [x] Na criação, devolve 201 `{ id, codigo }`, com o chamado pendente, fora do Kanban, `origem = 'lab-brain'` e o `id_externo` gravado.
- [x] Reenviar o mesmo `id_externo` devolve 200 com o chamado que já existe, sem criar outro.
- [x] A lista e o detalhe dos chamados de TI mostram o selo "via LAB-BRAIN" para essa origem, na identidade visual do FlowLab. Os chamados da tela continuam iguais.
- [x] Testes pela rota, com o Supabase falso:
  - 405, 401 (sem chave, chave errada e chave de leitura) e 403;
  - 400 para cada campo;
  - 422 para e-mail inexistente, removido e desativado;
  - 429;
  - 201 com os padrões aplicados;
  - 200 no reenvio.
- [x] Guia novo da integração de chamados, com acesso, campos, exemplos e códigos de erro do POST.

## Comments

- 13/11/2026: implementado. Rota `POST /api/integracoes/lab-brain-chamado-criar` em `api/_lib/labBrainChamados.ts` (handler fino em `api/_lib/handlers/integracoes-lab-brain-chamado-criar.ts`), chave `LAB_BRAIN_CHAMADOS_API_KEY`, cota `lab-brain-chamados` de 10/min via `registrarChamada` (ganhou o parâmetro `cota`). O chamado nasce como o da tela (`kanban_hidden: true`, status padrão `pending`) com `origem = 'lab-brain'`. O reenvio é checado antes do solicitante, então devolve 200 mesmo se a pessoa foi desativada depois; a corrida de duas chamadas iguais cai no índice único (23505) e também devolve 200. Migration `20261113110000_it_requests_origem_id_externo.sql` (índice único parcial e CHECK de que `id_externo` exige `origem`). Selo em `src/components/IT/OrigemChamadoBadge.tsx`, usado na lista, no detalhe e também no drawer do Kanban. Guia em `docs/integracoes/LAB_BRAIN_CHAMADOS.md`.
- Decisões fora do texto da spec: texto longo demais é recusado com 400 (D5, história 9 e checklist), não cortado como diz a D12; `id_externo` e `solicitante_email` com até 255 caracteres; e-mail com formato mínimo `x@y`.
- Para a 03: o preâmbulo método → chave → manifesto → corpo → cota agora tem duas cópias (apoio e chamados). Com a terceira (GET de chamado), extrair um guard comum.
