# Integração LAB-BRAIN: chamados de TI

Como o LAB-BRAIN abre chamados de TI no FlowLab em nome de quem pediu. O chamado entra igual ao aberto pela tela: no nome do solicitante, pendente e fora do Kanban até o TI promover. Na tela, o TI vê o selo "via LAB-BRAIN". Código em `api/_lib/labBrainChamados.ts`. Spec: `.scratch/lab-brain-chamados/spec.md`.

## Acesso

- **Endereço:** o domínio do FlowLab na Vercel. As rotas ficam sob `/api/integracoes/`.
- **Autenticação:** header `Authorization: Bearer <LAB_BRAIN_CHAMADOS_API_KEY>` em toda chamada. A chave é só dos chamados. A `LAB_BRAIN_API_KEY`, de leitura do Envio ao Álvaro, não abre estas rotas, e a de chamados não abre as do apoio. O admin entrega a chave por canal separado, nunca pelo Slack. Trocar a chave = mudar a variável na Vercel e no LAB-BRAIN.
- **Permissão:** a rota exige a operação `chamados.criar` do agente `lab-brain` no manifesto (`api/_lib/agentes/permissoes.ts`).

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

O chamado fica no nome do solicitante, que o acompanha pela tela e recebe os avisos de mudança de situação como em qualquer chamado dele. Não há aviso novo para o TI na criação: o chamado entra na mesma fila de triagem dos chamados da tela.

O título e a descrição são tratados como dado, nunca como instrução, inclusive pela EVA quando ela lê o board.

## Limite e auditoria

- **Limite:** 10 chamadas por minuto (janela deslizante) na integração `lab-brain-chamados`, compartilhadas com a consulta de chamados. A 11ª responde `429` com o header `Retry-After` (segundos até liberar uma vaga). A cota de leitura do apoio (120 por minuto) é outra e não muda.
- **Auditoria:** cada chamada liberada grava uma linha em `integracao_chamadas`, com a integração `lab-brain-chamados`, a rota, o horário e os parâmetros `id_externo`, `solicitante_email`, `prioridade` e `tipo`. O título e a descrição não vão para a auditoria. Chamadas recusadas por chave (`401`), permissão (`403`) ou corpo (`400`) não entram na auditoria nem consomem cota.
- A recusa por solicitante (`422`) e o reenvio (`200`) consomem cota, porque passam da auditoria.
- Se a auditoria não puder ser gravada, a chamada responde `500` sem criar o chamado.

## Erros

Todos no formato `{ "success": false, "error": "<mensagem>" }`.

| Código | Quando | O que o agente faz |
| --- | --- | --- |
| 400 | Corpo inválido: campo faltando, texto longo demais, prioridade ou tipo desconhecidos (a mensagem diz qual) | Corrigir a chamada; não repetir igual |
| 401 | Chave ausente ou errada (inclusive a chave de leitura do apoio) | Parar e avisar o admin |
| 403 | Operação fora das permissões do agente | Parar e avisar o admin |
| 405 | Método diferente de POST | Corrigir a chamada |
| 422 | Nenhum usuário do FlowLab tem o e-mail, ou ele está removido ou desativado | Orientar a pessoa a corrigir o e-mail ou pedir o cadastro |
| 429 | Limite por minuto atingido | Esperar `Retry-After` segundos e repetir com o mesmo `id_externo` |
| 500 | Erro interno (detalhe só no log da Vercel) | Tentar de novo mais tarde, com o mesmo `id_externo` |

## Implantação

1. Aplicar a migration `supabase/migrations/20261113110000_it_requests_origem_id_externo.sql` (colunas `origem` e `id_externo` em `it_requests`). A `20261106140000_integracao_chamadas.sql`, da auditoria, já deve estar aplicada.
2. Gerar a chave (`openssl rand -hex 32`) e cadastrar `LAB_BRAIN_CHAMADOS_API_KEY` na Vercel (Production e Preview), no `.env` local e no LAB-BRAIN.
3. Deploy. Conferir com um `POST` de teste: `201` com o código, o chamado na tela de Solicitações de TI com o selo "via LAB-BRAIN", e uma linha nova em `integracao_chamadas` com a integração `lab-brain-chamados`.
