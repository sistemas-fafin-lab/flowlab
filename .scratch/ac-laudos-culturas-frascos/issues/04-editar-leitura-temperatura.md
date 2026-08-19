Status: ready-for-agent
Type: task

# Temperatura: editar uma leitura já registrada

## Objetivo

Permitir corrigir uma leitura de temperatura já registrada (valor,
registrado por, data/hora, observação e frascos), a partir do histórico do
equipamento, com um botão de editar em cada leitura.

## Arquivos envolvidos

- `supabase/migrations/20260709120000_fase7c_temperatura_equipamentos.sql` —
  `ac_temperaturas` hoje é append-only (só SELECT + INSERT) — referência.
- `supabase/migrations/20260818140000_ac_tipos_frasco.sql` — `ac_temperatura_frascos`
  (SELECT/INSERT/DELETE) e RPC `ac_registrar_temperatura` (padrão de RPC a seguir).
- `src/modules/analises-clinicas/types.ts` — `AcTemperatura` (comentário de
  "append-only" precisa ser atualizado).
- `src/modules/analises-clinicas/components/TemperaturaEquipamentosPage.tsx` —
  `HistoricoModal` (~linhas 968–1186, lista de leituras) e `LeituraModal`
  (~620–966, validação inline do formulário de leitura).
- `src/modules/analises-clinicas/hooks/useTemperaturas.ts` — CRUD do módulo.
- `src/utils/permissions.ts` — `canManageColetas` (gate já usado para registrar).

## O que fazer

### 1. Nova migration — schema

Criar `supabase/migrations/<timestamp>_ac_editar_temperatura.sql`:

- Política de UPDATE em `ac_temperaturas` para `authenticated` (a trigger de
  `fora_faixa` já dispara em `UPDATE OF temperatura, equipamento_id` — o valor
  derivado é recalculado).
- RPC `ac_editar_temperatura(p_temperatura_id uuid, p_temperatura numeric,
  p_registrado_por text, p_observacao text, p_registrado_em timestamptz,
  p_frascos jsonb)` — atualiza a leitura e substitui os frascos (DELETE +
  INSERT dos novos) numa transação só, no mesmo espírito de
  `ac_registrar_temperatura` (erro em frasco inválido reverte tudo; leitura
  inexistente levanta erro).
- GRANT EXECUTE para `authenticated`.

### 2. Tipos

- Atualizar comentário "log append-only" de `AcTemperatura` em `types.ts`.

### 3. Helpers puros (`domain/leituras.ts`) — TDD

Extrair de `LeituraModal` os helpers de validação/normalização do formulário
de leitura para `domain/leituras.ts`, testados em
`domain/leituras.test.ts` (red → green):

- `normalizarTemperatura(texto)` — aceita vírgula; null quando inválido.
- `validarLeitura({ temperatura, registradoPor, dataHora, frascos })` —
  obrigatórios, data válida, data não no futuro (tolerância de 1 min),
  quantidades de frasco inteiras. Devolve mensagem de erro ou null.
- Se útil, `toDatetimeLocal`/`fmt*` também migram para o domínio.

### 4. Hook (`useTemperaturas.ts`)

- `editarTemperatura(input)` — chama `ac_editar_temperatura` via
  `supabase.rpc`, devolve erro ou null (mesmo contrato de
  `registrarTemperatura`).

### 5. UI (`TemperaturaEquipamentosPage.tsx`)

- `LeituraModal` passa a usar os helpers do domínio (comportamento idêntico).
- Novo `EditarLeituraModal`: mesmos campos do formulário de leitura
  pré-preenchidos com a leitura (temperatura, registrado por, data/hora,
  observação, frascos — incluindo tipos que hoje estão inativos no catálogo),
  salvar direto (sem passo de confirmação), mesma validação.
- `HistoricoModal`: botão lápis por leitura (gate `canManageColetas`, passado
  pela página) que abre o modal de edição; ao salvar, recarrega a lista do
  histórico e as séries do painel (via `onDone`).

## Fora de escopo

- Não criar permissão nova (usa `canManageColetas`).
- Não alterar o fluxo de 2 passos do registro de leitura.
- Não incluir edição nos gráficos/indicadores (eles só refletem os dados).

## Critério de aceite

- Um usuário com `canManageColetas` vê botão de editar em cada leitura do
  histórico e consegue corrigir valor, autor, data/hora, observação e frascos.
- Ao salvar, o histórico, o gráfico e o painel refletem os novos valores
  (`fora_faixa` recalculado pela trigger).
- Sem permissão, o botão não aparece.
- `npm test` verde; typecheck/lint limpos.
