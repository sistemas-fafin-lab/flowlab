# 04: Chave no Vercel e resposta ao LAB-BRAIN

**What to build:** os passos humanos para o LAB-BRAIN poder começar a integrar: a chave de chamados criada e entregue por um canal seguro, e a resposta ao pedido dele no Slack. Ver `../spec.md`, D4 e D13.

**Blocked by:** None (can start immediately)

**Status:** ready-for-human

- [x] Gerar uma chave forte (ex.: `openssl rand -hex 32`) e criá-la como variável de ambiente de chamados do LAB-BRAIN no Vercel (Production e Preview) e no ambiente local. (Só Production e `.env`; Preview não tem.)
- [ ] Entregar a chave ao LAB-BRAIN por canal separado, nunca pelo Slack.
- [x] Responder no Slack com o texto abaixo.

## Texto de resposta (Slack)

> Oi, LAB-BRAIN. Como vai funcionar:
>
> • **Endpoint:** `POST https://flow-lab.vercel.app/api/integracoes/lab-brain-chamado-criar`
> • **Autenticação:** header `Authorization: Bearer <chave>`. A chave é dedicada à abertura de chamados, separada da que você já usa para o Envio ao Álvaro. Ela fica guardada nas variáveis de ambiente do FlowLab, na Vercel, e eu entrego por outro canal, não por aqui.
> • **Campos (JSON):** `titulo` (obrigatório, até 255), `descricao` (obrigatório, até 5.000), `solicitante_email` (obrigatório; precisa ser um usuário ativo do FlowLab, senão volta 422), `prioridade` (`low|medium|high|critical`, padrão `medium`), `tipo` (`suporte|desenvolvimento`, faz o papel de categoria, padrão `suporte`) e `id_externo` (obrigatório, o seu identificador; se reenviar o mesmo, devolvo o chamado que já existe).
> • **Resposta:** `{ id, codigo }`, ex.: `IT-123`.
> • **Acompanhamento:** `GET https://flow-lab.vercel.app/api/integracoes/lab-brain-chamado-consultar?id_externo=…` devolve a situação, o responsável e a resolução.
> • **Limite:** 10 chamadas por minuto.
> • Hoje não existe webhook nem e-mail de entrada de chamados; o caminho é esse endpoint.
>
> O guia completo está em `docs/integracoes/LAB_BRAIN_CHAMADOS.md`. **Prazo:** hoje, 13/11.

## Notas (13/11)

- Nome da variável: `LAB_BRAIN_CHAMADOS_API_KEY` (lida em `api/_lib/labBrainChamados.ts`). Ainda não existe na Vercel nem no `.env.local`.
- Domínio de produção: `https://flow-lab.vercel.app`. O código das rotas (a1fc3dc, 39c5478) já está no deploy de produção.
- A Vercel só aplica a variável nova a deploys feitos depois de criá-la: é preciso um redeploy de produção antes de o LAB-BRAIN testar.
- 16/11/2026: `LAB_BRAIN_CHAMADOS_API_KEY` existe na Vercel só em Production, e no `.env` (linha 98), com o mesmo valor: produção aceitou essa chave no teste do IT-434. Preview não tem a variável; só importa para testar num deploy de preview. Os deploys de produção depois da criação já leem a chave: o GET sem chave responde `401`. A resposta do Slack foi enviada (o LAB-BRAIN respondeu a ela). Falta entregar a chave por canal separado; o LAB-BRAIN vai guardá-la no cofre dele.
