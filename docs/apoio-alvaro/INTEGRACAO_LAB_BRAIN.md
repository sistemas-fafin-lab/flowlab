# Integração LAB-BRAIN: consulta ao Envio ao Álvaro

Como o LAB-BRAIN consulta, somente leitura, as tabelas do Envio ao Álvaro no FlowLab: o vínculo requisição → OS do Álvaro, a fila de envio com o histórico, e o catálogo de exames do apoio. Código em `api/_lib/labBrainApoio.ts`.

## Acesso

- **Endereço:** o domínio do FlowLab na Vercel. As rotas ficam sob `/api/integracoes/`.
- **Autenticação:** header `Authorization: Bearer <LAB_BRAIN_API_KEY>` em toda chamada. A chave é dedicada a esta integração (não é a `FLOWLAB_API_KEY`, a `ADMISSAO_API_KEY` nem a do LAB-HUB); o admin entrega por canal separado. Trocar a chave = mudar a variável na Vercel e no LAB-BRAIN.
- **Somente leitura:** só `GET`. Qualquer outro método responde `405`.

```ts
const res = await fetch(`${FLOWLAB}/api/integracoes/lab-brain-apoio-requisicao?cod=${cod}`, {
  headers: { Authorization: `Bearer ${LAB_BRAIN_API_KEY}` },
  signal: AbortSignal.timeout(10000),
});
```

## Rotas

| Rota | Parâmetros | Devolve |
| --- | --- | --- |
| `GET /api/integracoes/lab-brain-apoio-requisicao` | `cod` (nº da requisição no LIS, obrigatório) | Vínculo com o Álvaro + itens da fila daquela requisição |
| `GET /api/integracoes/lab-brain-apoio-fila` | `status`, `desde`, `ate`, `limite`, `pagina` (todos opcionais) | Itens da fila, mais recentes primeiro, paginados |
| `GET /api/integracoes/lab-brain-apoio-exames` | — | Catálogo completo de exames do apoio (códigos AOL) |

### `lab-brain-apoio-requisicao?cod=0085093421000`

```json
{
  "cod_requisicao": "0085093421000",
  "enviada_alvaro": true,
  "requisicao": {
    "codigo_lis": "0085093421000", "codigo_os": "123456", "nome": "…", "datanasc": "1980-01-01",
    "data_coleta": "2026-11-05T13:00:00+00:00", "laudo": { "http_status": 200, "resposta_alvaro": {} },
    "created_at": "…", "updated_at": "…"
  },
  "fila": [
    { "id": "uuid", "status": "enviado", "origem": "automatico", "numero_requisicao": "0085093421000",
      "agendamento_id": "uuid", "paciente": {}, "medico": {}, "exames": [], "erro_mensagem": null,
      "resumo": {}, "created_at": "…", "updated_at": "…" }
  ]
}
```

- `enviada_alvaro`: `true` quando a requisição já tem OS no Álvaro (`requisicao` preenchido). `false` com `requisicao: null` quando ela só está na fila (aguardando, enviando ou com erro).
- `fila`: até 50 itens daquela requisição, o mais recente primeiro. Uma requisição reenviada aparece mais de uma vez.
- `404` quando a requisição não está em nenhuma das duas tabelas.

### `lab-brain-apoio-fila`

| Parâmetro | Formato | Padrão |
| --- | --- | --- |
| `status` | `aguardando`, `enviando`, `enviado` ou `erro` | todos |
| `desde` / `ate` | `AAAA-MM-DD`, dias inteiros no horário de Brasília, sobre `updated_at` | sem limite |
| `limite` | 1 a 200 | 50 |
| `pagina` | a partir de 1 | 1 |

Resposta: `{ "itens": [...], "pagina": 1, "limite": 50, "tem_mais": true }`. Cada item tem os mesmos campos dos itens de `fila` acima. Pare de paginar quando `tem_mais` for `false`.

### `lab-brain-apoio-exames`

`{ "exames": [{ "cod_exame": "TSH", "descricao_exame": "…", "descricao_material": "soro", "cod_material": "543", "updated_at": "…" }] }`, o catálogo inteiro numa resposta.

### Fora do payload

Ficam de fora de propósito: o XML enviado (`xml_envio`), a resposta crua do webservice (`alvaro_response`), os caminhos dos arquivos digitalizados (`filename`) e o preço do catálogo (`preco`). Se o LAB-BRAIN precisar de algum, a liberação é uma mudança no código.

## Limite e auditoria

- **Limite:** 120 chamadas por minuto (janela deslizante), somando as três rotas. A 121ª responde `429` com o header `Retry-After` (segundos até liberar uma vaga).
- **Auditoria:** cada chamada liberada grava uma linha em `integracao_chamadas` (integração `lab-brain`, rota, parâmetros consultados e horário). Chamadas recusadas por chave (`401`), permissão (`403`), parâmetro (`400`) ou limite (`429`) não entram na auditoria nem consomem cota.
- Se a auditoria não puder ser gravada, a chamada responde `500` sem consultar as tabelas.

## Erros

Todos no formato `{ "success": false, "error": "<mensagem>" }`.

| Código | Quando | O que o agente faz |
| --- | --- | --- |
| 400 | Parâmetro inválido (a mensagem diz qual) | Corrigir a chamada; não repetir igual |
| 401 | Chave ausente ou errada | Parar e avisar o admin |
| 403 | Operação fora das permissões do agente | Parar e avisar o admin |
| 404 | Requisição fora do Envio ao Álvaro | Tratar como "não enviada" |
| 405 | Método diferente de GET | Corrigir a chamada |
| 429 | Limite por minuto atingido | Esperar `Retry-After` segundos |
| 500 | Erro interno (detalhe só no log da Vercel) | Tentar de novo mais tarde |
| 503 | A chave da integração não está configurada no FlowLab | Parar e avisar o admin |

## Implantação

1. Aplicar a migration `supabase/migrations/20261106140000_integracao_chamadas.sql` (tabela de auditoria + função `integracao_registrar_chamada`).
2. Gerar a chave (`openssl rand -hex 32`) e cadastrar `LAB_BRAIN_API_KEY` na Vercel (Production) e no `.env` do LAB-BRAIN.
3. Deploy. Conferir com uma chamada a `lab-brain-apoio-exames`: `200` com o catálogo e uma linha nova em `integracao_chamadas`.
