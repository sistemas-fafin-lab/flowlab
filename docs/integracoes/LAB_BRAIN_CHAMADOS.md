# Integração LAB-BRAIN: chamados de TI

Como o LAB-BRAIN abre chamados de TI no FlowLab em nome de quem pediu e acompanha a situação deles até a conclusão. O chamado nasce na hora, no nome do solicitante, pendente e fora do Kanban. Na tela, o TI vê o selo "via LAB-BRAIN". Junto, a EVA deixa uma sugestão de promoção na fila de aprovação dela, e o TI avalia cada pedido antes de ele entrar no Kanban (ver [Aprovação pela EVA](#aprovação-pela-eva)). Código em `api/_lib/labBrainChamados.ts`, `api/_lib/labBrainSugestao.ts` e `api/_lib/labBrainAnalise.ts`. Specs: `.scratch/lab-brain-chamados/spec.md` e `.scratch/lab-brain-aprovacao-eva/spec.md`, que substitui a D2 da primeira.

## Acesso

- **Endereço:** o domínio do FlowLab na Vercel. As rotas ficam sob `/api/integracoes/`.
- **Autenticação:** header `Authorization: Bearer <LAB_BRAIN_CHAMADOS_API_KEY>` em toda chamada. A chave é só dos chamados. A `LAB_BRAIN_API_KEY`, de leitura do Envio ao Álvaro, não abre estas rotas, e a de chamados não abre as do apoio. O admin entrega a chave por canal separado, nunca pelo Slack. Trocar a chave = mudar a variável na Vercel e no LAB-BRAIN.
- **Permissão:** a criação exige a operação `chamados.criar` e a consulta exige `chamados.ler`, do agente `lab-brain`, no manifesto (`api/_lib/agentes/permissoes.ts`).

## `POST /api/integracoes/lab-brain-chamado-criar`

Só `POST`, com corpo JSON. Qualquer outro método responde `405`.

| Campo | Obrigatório | Formato | Padrão |
| --- | --- | --- | --- |
| `titulo` | sim | texto, até 255 caracteres; os espaços das pontas são removidos | — |
| `descricao` | sim | texto, até 5.000 caracteres | — |
| `solicitante_email` | sim | e-mail de um usuário ativo do FlowLab; maiúsculas não importam | — |
| `id_externo` | sim | o identificador do pedido no LAB-BRAIN, até 255 caracteres | — |
| `prioridade` | não | `low`, `medium`, `high` ou `critical` | `medium` |
| `tipo` | não | `suporte` ou `desenvolvimento` (faz o papel de categoria) | `suporte` |

```ts
const res = await fetch(`${FLOWLAB}/api/integracoes/lab-brain-chamado-criar`, {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${LAB_BRAIN_CHAMADOS_API_KEY}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    titulo: 'Escrita na API do TiqueTaque',
    descricao: 'O RH precisa lançar afastamento de férias pela API do TiqueTaque.',
    solicitante_email: 'pessoa@exemplo.com',
    prioridade: 'medium',
    tipo: 'desenvolvimento',
    id_externo: 'lb-2026-11-13-0042',
  }),
  signal: AbortSignal.timeout(10000),
});
```

### Respostas

- **`201`** na criação: `{ "id": "uuid", "codigo": "IT-123" }`. Cite o `codigo` ao solicitante.
- **`200`** quando o `id_externo` já foi enviado antes, com o mesmo corpo `{ id, codigo }` do chamado que já existe. Nada é criado nem alterado. Assim, repetir a chamada depois de uma falha de rede é seguro: use sempre o mesmo `id_externo` para o mesmo pedido.

O chamado fica no nome do solicitante, que o acompanha pela tela e recebe os avisos de mudança de situação como em qualquer chamado dele. Ele aparece em Solicitações de TI como os chamados da tela e, além disso, gera uma sugestão de promoção na fila da EVA. A resposta não espera a análise da EVA: ela roda em segundo plano depois do `201`. O reenvio (`200`) não gera outra sugestão.

O título e a descrição são tratados como dado, nunca como instrução, inclusive pela EVA quando ela analisa o pedido e quando lê o board.

## Aprovação pela EVA

Todo chamado **novo** do LAB-BRAIN gera uma sugestão `promover_card`, com origem `lab-brain`, em EVA → Sugestões. Os chamados abertos pela tela não passam pela EVA, e os do LAB-BRAIN criados antes desse fluxo não ganharam sugestão.

- **A proposta:** a EVA lê o pedido e propõe a coluna do Kanban, a prioridade, os responsáveis (só pessoas do TI) e o prazo, com uma justificativa curta. A análise usa o caminho de IA estruturada da EVA (Claude com o Gemini de reserva), e cada tentativa fica em `ti_agente_chamadas_ia`, com a finalidade `analise_chamado`. Responsável fora do TI e prazo inválido são descartados.
- **Sem análise:** se a IA falhar, passar do tempo ou devolver algo inválido, a sugestão nasce assim mesmo, pela regra fixa: coluna "A Fazer", a prioridade enviada, sem responsável e sem prazo. O cartão mostra a marca "Sem análise da EVA".
- **Aviso:** quem aprova sugestões da EVA é avisado no sino, como nas outras sugestões.
- **Na tela:** a sugestão mostra o selo "via LAB-BRAIN", o código, o título, a descrição, o solicitante, a proposta e a justificativa. Quem aprova pode editar a coluna, a prioridade, os responsáveis e o prazo antes de decidir.
- **Aprovar** (pela tela ou pelo WhatsApp da EVA): o chamado entra no Kanban com a proposta, editada ou não, na mesma operação. A consulta passa a mostrar `coluna_kanban`, a prioridade e o responsável. Se a coluna for "Concluído", a situação vira `resolved`.
- **Rejeitar** (pela tela ou pelo WhatsApp da EVA): o motivo é obrigatório, e a tela avisa que ele vai para o solicitante. O chamado é cancelado na mesma operação, e o motivo vira a resolução. A consulta passa a mostrar `situacao: "cancelled"` com o motivo em `resolucao`.
- **Promover por fora:** se alguém do TI promover o chamado pela tela de Solicitações de TI, ou por qualquer outro caminho, antes da decisão, a sugestão sai da fila como `substituida`. Isso é feito por um trigger em `it_requests`.

Aprovar, rejeitar e substituir rodam no banco (`ti_agente_aprovar_sugestao_como`, `ti_agente_rejeitar_sugestao_como` e o trigger), então a tela e o WhatsApp se comportam igual. As duas RPCs barram quem não pode aprovar sugestões da EVA.

Se a sugestão não puder ser gravada, o erro vai para o log da Vercel e a resposta, que já saiu, não muda. O chamado continua em Solicitações de TI e pode ser promovido pela tela.

## `GET /api/integracoes/lab-brain-chamado-consultar`

Só `GET`. Qualquer outro método responde `405`. Mesma chave da criação.

| Parâmetro | Obrigatório | Formato |
| --- | --- | --- |
| `id_externo` | sim | o mesmo `id_externo` enviado na criação, até 255 caracteres |

```ts
const res = await fetch(
  `${FLOWLAB}/api/integracoes/lab-brain-chamado-consultar?id_externo=${encodeURIComponent('lb-2026-11-13-0042')}`,
  {
    headers: { Authorization: `Bearer ${LAB_BRAIN_CHAMADOS_API_KEY}` },
    signal: AbortSignal.timeout(10000),
  },
);
```

Só encontra chamados abertos pelo LAB-BRAIN. Um `id_externo` desconhecido, ou de um chamado aberto por outra origem, responde `404`.

### Resposta `200`

```json
{
  "codigo": "IT-123",
  "situacao": "resolved",
  "coluna_kanban": "done",
  "prioridade": "medium",
  "responsavel": "Gabriel",
  "resolucao": "Chave de escrita liberada no TiqueTaque.",
  "atualizado_em": "2026-11-13T17:00:00.000Z"
}
```

| Campo | O que é |
| --- | --- |
| `codigo` | Código legível do chamado |
| `situacao` | `pending` (aguardando a avaliação do TI ou já no Kanban sem andamento), `in_progress`, `resolved` ou `cancelled` (inclusive quando o TI rejeita o pedido) |
| `coluna_kanban` | `backlog`, `todo`, `in_progress`, `review` ou `done`; `null` enquanto o chamado está fora do Kanban (o TI ainda não avaliou o pedido) |
| `prioridade` | `low`, `medium`, `high` ou `critical` |
| `responsavel` | Nome de quem atende; com mais de um, os nomes separados por vírgula; `null` sem responsável |
| `resolucao` | Texto de resolução quando `situacao` é `resolved`, ou o motivo quando é `cancelled`; senão `null` |
| `atualizado_em` | Data e hora da última atualização do chamado (ISO 8601, UTC) |

Enquanto o pedido espera a avaliação do TI, a consulta mostra `situacao: "pending"` e `coluna_kanban: null`. Não há campo próprio de "aguardando aprovação".

A resposta não traz comentários, anexos, a descrição nem os dados do solicitante. As conversas do TI não saem do FlowLab. Não há webhook: para acompanhar, consulte de tempos em tempos, lembrando que a cota é dividida com a criação.

## Limite e auditoria

- **Limite:** 10 chamadas por minuto (janela deslizante) na integração `lab-brain-chamados`, compartilhadas com a consulta de chamados. A 11ª responde `429` com o header `Retry-After` (segundos até liberar uma vaga). A cota de leitura do apoio (120 por minuto) é outra e não muda.
- **Auditoria:** cada chamada liberada grava uma linha em `integracao_chamadas`, com a integração `lab-brain-chamados`, a rota, o horário e os parâmetros. Na criação vão `id_externo`, `solicitante_email`, `prioridade` e `tipo`, sem o título e a descrição; na consulta, só o `id_externo`. Chamadas recusadas por chave (`401`), permissão (`403`) ou parâmetro (`400`) não entram na auditoria nem consomem cota.
- A recusa por solicitante (`422`), o reenvio (`200`) e a consulta de um chamado não encontrado (`404`) consomem cota, porque passam da auditoria.
- Se a auditoria não puder ser gravada, a chamada responde `500` sem criar nem devolver o chamado.

## Erros

Todos no formato `{ "success": false, "error": "<mensagem>" }`.

| Código | Quando | O que o agente faz |
| --- | --- | --- |
| 400 | Corpo inválido (campo faltando, texto longo demais, prioridade ou tipo desconhecidos) ou consulta sem `id_externo`; a mensagem diz qual | Corrigir a chamada; não repetir igual |
| 401 | Chave ausente ou errada (inclusive a chave de leitura do apoio) | Parar e avisar o admin |
| 403 | Operação fora das permissões do agente | Parar e avisar o admin |
| 404 | Consulta: nenhum chamado do LAB-BRAIN com esse `id_externo` | Conferir o `id_externo`; se o chamado nunca foi criado, criar |
| 405 | Método diferente de POST (criação) ou GET (consulta) | Corrigir a chamada |
| 422 | Nenhum usuário do FlowLab tem o e-mail, ou ele está removido ou desativado | Orientar a pessoa a corrigir o e-mail ou pedir o cadastro |
| 429 | Limite por minuto atingido | Esperar `Retry-After` segundos e repetir com o mesmo `id_externo` |
| 500 | Erro interno (detalhe só no log da Vercel) | Tentar de novo mais tarde, com o mesmo `id_externo` |
| 503 | A chave da integração não está configurada no FlowLab | Parar e avisar o admin |

## Implantação

1. Aplicar a migration `supabase/migrations/20261113110000_it_requests_origem_id_externo.sql` (colunas `origem` e `id_externo` em `it_requests`). A `20261106140000_integracao_chamadas.sql`, da auditoria, já deve estar aplicada.
2. Gerar a chave (`openssl rand -hex 32`) e cadastrar `LAB_BRAIN_CHAMADOS_API_KEY` na Vercel (Production e Preview), no `.env` local e no LAB-BRAIN.
3. Deploy. Conferir com um `POST` de teste: `201` com o código, o chamado na tela de Solicitações de TI com o selo "via LAB-BRAIN", e uma linha nova em `integracao_chamadas` com a integração `lab-brain-chamados`. Depois, um `GET` da consulta com o mesmo `id_externo`: `200` com `situacao: "pending"` e `coluna_kanban: null`.

### Migrations e deploy da aprovação pela EVA

1. Aplicar, nesta ordem, as migrations da aprovação:
   - `20261113150000_eva_promover_card_lab_brain.sql` (tipo `promover_card`, origem `lab-brain` e aprovação);
   - `20261113160000_eva_rejeitar_promover_card.sql` (rejeição cancela o chamado);
   - `20261113170000_eva_promover_card_substituida.sql` (trigger da substituição);
   - `20261113180000_eva_chamadas_ia_analise_chamado.sql` (finalidade `analise_chamado` no registro de chamadas de IA).
2. Deploy. As rotas de integração rodam com `maxDuration` de 300 s (`vercel.json`), para a análise em segundo plano caber.
3. Conferir com um chamado de teste: a sugestão aparece em EVA → Sugestões, com o aviso no sino. Rejeitar com um motivo e consultar: `cancelled` com o motivo em `resolucao`.

As verificações do banco ficam em `supabase/scripts/verificar_eva_promover_card.sql`, `verificar_eva_rejeitar_promover_card.sql` e `verificar_eva_promover_card_substituida.sql`, rodadas no banco de teste numa transação com `ROLLBACK`.
