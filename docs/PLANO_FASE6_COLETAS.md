# Fase 6 — Coleta (conferência de recepção + baixa de insumos)

> **Status:** 🚧 planejado — Etapa A (conferência de recepção + coleta + baixa de insumos). Recoletas adiadas (Etapa B, quando o conceito estiver claro).
> **Plano mestre:** `docs/PLANO_FLOWLAB_ANALISES_CLINICAS.md` (Fase 6)
> **Depende de:** Fase 4 ✅ (permissão `canManageColetas`) + Fase 5 (multi-local: `product_stock`, trigger novo, estoque por posto). **Habilita:** Fase 7 (análise) e Fase 8 (KPIs de coleta/recoleta).

## 1. Objetivo

Fechar a lacuna entre **agendamento** e os dados a jusante em dois passos feitos no posto por um funcionário:

1. **Conferência de recepção (check-in):** um checklist que verifica se o paciente está apto **antes de liberar a coleta** (identidade, guia, pedido médico, jejum, termo…). É um **gate**: só com tudo conferido a coleta é liberada. Se algo estiver errado, o funcionário **registra um problema** (em qual item falhou + o motivo) e o agendamento é bloqueado.
2. **Coleta:** registrada só para agendamentos liberados; no mesmo ato **dá baixa nos insumos consumidos** no estoque do posto — reaproveitando integralmente a fundação multi-local da Fase 5.

Ciclo do agendamento:
```
recebido ──[conferência OK]──► em_coleta ──[registrar coleta]──► coletado
    │              │
    │              └──[registrar problema]──► bloqueado
    └───────────────────────────────────────────────────────► cancelado
```
> `cancelado` é um estado **pré-existente / fora de escopo desta fase** — está no diagrama só para contexto. Nenhuma RPC ou ação da Etapa A cria essa transição.

## 2. Decisões travadas (com o usuário)

1. **Conferência é um gate obrigatório.** `recebido → em_coleta` só acontece via a conferência com **todos os itens** OK. A coleta (§5.2) exige `em_coleta` — não dá para coletar sem passar pela recepção.
2. **Check-in enxuto: uma tabela só (`ac_checkins`), sem tabela de itens nem snapshot.** A conferência grava apenas o **desfecho**: passou (`liberado`) ou, se falhou, **em qual item** (`problema_em`) e **por quê** (`problema_motivo`). Os itens do checklist são uma **lista fixa no frontend** — os 5 do mockup (identidade, guia, pedido médico, jejum, termo) são **provisórios**; `problema_em` referencia uma dessas chaves (validada por `CHECK`). Trocar a lista depois = ajuste no frontend + no `CHECK` (aceitável na v1). *Nota: só o item **bloqueante** é registrado, não o estado dos 5 checkboxes.*
3. **Dados dinâmicos do topo ficam fora por ora (genérico).** Exames, convênio, idade e regra de jejum **não existem no `ac_agendamentos`** (só nome/telefone/posto/data-hora) e viriam do LAB-HUB. Nesta fase a tela usa **só o que o FlowLab já tem** + o checklist. **Sem mudança na integração LAB-HUB.**
4. **"Registrar problema" grava item + motivo e bloqueia.** O agendamento vai para o status novo **`bloqueado`** e sai da fila normal. Desbloquear/reagendar é refinamento posterior.
5. **Recoleta fica fora desta rodada** (`ac_recoletas` + `RecoletasPage` = Etapa B, provável gatilho: reprovação na análise, Fase 7).
6. **Insumos por seleção manual** (produto + quantidade) — não há tipo de exame no FlowLab para inferir um "kit".
7. **Baixa sai do estoque do posto.** Origem = `stock_locations` com `posto_id` do agendamento. Sem posto ou sem estoque rastreável ⇒ a coleta é **bloqueada com aviso**.
8. **Baixa é `out` simples (consumo), sem estorno automático** na v1 (o `stock_movement_id` fica guardado para viabilizar estorno depois).
9. **1:1:** conferência 1:1 agendamento e coleta 1:1 agendamento (`UNIQUE (agendamento_id)`).
10. **Atomicidade via RPC.** Conferência e coleta rodam cada uma numa **função Postgres transacional** (§5) — a coleta herda o `CHECK (quantity >= 0)` + rollback da Fase 5.

## 3. Modelo de dados

### 3.1 `ac_checkins` — conferência de recepção (1:1 agendamento)
```sql
CREATE TABLE IF NOT EXISTS ac_checkins (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agendamento_id  uuid NOT NULL UNIQUE REFERENCES ac_agendamentos(id) ON DELETE RESTRICT,
  conferido_por   text NOT NULL,
  conferido_em    timestamptz NOT NULL DEFAULT now(),
  resultado       text NOT NULL CHECK (resultado IN ('liberado','problema')),
  problema_em     text CHECK (problema_em IN ('identidade','guia','pedido_medico','jejum','termo')),
  problema_motivo text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  -- 'problema' exige item + motivo; 'liberado' não tem nenhum dos dois
  CONSTRAINT ck_checkin_problema CHECK (
       (resultado = 'problema' AND problema_em IS NOT NULL AND problema_motivo IS NOT NULL)
    OR (resultado = 'liberado' AND problema_em IS NULL AND problema_motivo IS NULL)
  )
);
```
- **Uma linha por agendamento** (`UNIQUE`). `resultado='liberado'` ⇒ agendamento vai a `em_coleta`; `'problema'` ⇒ `bloqueado`.
- `problema_em` = a chave do item que falhou (mesmas chaves da lista fixa do frontend). `problema_motivo` = texto livre do porquê.
- O `CHECK ck_checkin_problema` garante os dois formatos válidos: liberado sem problema, ou problema **sempre** com item + motivo.

### 3.2 `ac_coletas` — uma coleta por agendamento
```sql
CREATE TABLE IF NOT EXISTS ac_coletas (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agendamento_id uuid NOT NULL UNIQUE REFERENCES ac_agendamentos(id) ON DELETE RESTRICT,
  posto_id       uuid REFERENCES ac_postos(id),
  location_id    uuid REFERENCES stock_locations(id),  -- estoque do posto de onde saiu a baixa (snapshot)
  coletado_por   text NOT NULL,
  coletado_em    timestamptz NOT NULL DEFAULT now(),
  observacoes    text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ac_coletas_posto ON ac_coletas(posto_id);
CREATE INDEX IF NOT EXISTS idx_ac_coletas_coletado_em ON ac_coletas(coletado_em DESC);
```

### 3.3 `ac_coleta_insumos` — insumos consumidos (linha por produto)
```sql
CREATE TABLE IF NOT EXISTS ac_coleta_insumos (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coleta_id         uuid NOT NULL REFERENCES ac_coletas(id) ON DELETE CASCADE,
  product_id        uuid NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  quantity          integer NOT NULL CHECK (quantity > 0),
  stock_movement_id uuid REFERENCES stock_movements(id),  -- a baixa gerada (rastreio/estorno futuro)
  created_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ac_coleta_insumos_coleta ON ac_coleta_insumos(coleta_id);
```

### 3.4 Status do agendamento + `updated_at`
- **Novo status `bloqueado`.** Se `ac_agendamentos.status` tiver um `CHECK`, a migration o **relaxa defensivamente** (padrão da Fase 5) para: `recebido | em_coleta | coletado | bloqueado | cancelado`.
- `updated_at`: reusa a função de trigger já usada pelas demais `ac_*`. `ac_coleta_insumos` é imutável (sem trigger).

## 4. Baixa de insumos — reuso da Fase 5

O estoque do posto é um `stock_locations` com **`controla_consumo = true`** (criado assim pelo `usePostos` — a Qualidade *transfere* para ele; o posto *consome*). A baixa da coleta é exatamente a **2ª etapa (consumo real) desse modelo de 2 etapas**, que já é um `out`/`internal-consumption` saindo do local — nada de novo, é o mesmo movimento que o "Registrar Consumo" do Estoque Departamental grava.

Nada de estoque novo: cada insumo vira **uma** linha em `stock_movements`, interpretada pelo trigger `update_stock_on_movement` da Fase 5:

| Campo | Valor |
|---|---|
| `type` | `'out'` |
| `reason` | `'internal-consumption'` |
| `from_location_id` | estoque do **posto** (`stock_locations.posto_id = agendamento.posto_id`, `rastreavel`) |
| `to_location_id` | `null` |
| `product_id` / `quantity` | o insumo selecionado |

O trigger debita `product_stock` do posto e o cache atualiza `products.quantity`. Saldo insuficiente ⇒ `CHECK (quantity >= 0)` estoura e **reverte a transação** (a RPC do §5.2).

## 5. RPCs transacionais

### 5.1 `registrar_checkin` — a conferência (gate)
```sql
CREATE OR REPLACE FUNCTION registrar_checkin(
  p_agendamento_id  uuid,
  p_conferido_por   text,
  p_resultado       text,   -- 'liberado' | 'problema'
  p_problema_em     text,   -- chave do item que falhou (só quando 'problema')
  p_problema_motivo text
) RETURNS uuid
LANGUAGE plpgsql AS $$
DECLARE v_status text; v_checkin_id uuid;
BEGIN
  SELECT status INTO v_status FROM ac_agendamentos WHERE id = p_agendamento_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Agendamento % não encontrado', p_agendamento_id; END IF;
  IF v_status <> 'recebido' THEN
    RAISE EXCEPTION 'Conferência só é possível em agendamento "recebido" (atual: %)', v_status;
  END IF;
  IF p_resultado NOT IN ('liberado','problema') THEN RAISE EXCEPTION 'Resultado inválido'; END IF;
  IF p_resultado = 'problema' AND (p_problema_em IS NULL OR btrim(COALESCE(p_problema_motivo,'')) = '') THEN
    RAISE EXCEPTION 'Problema exige o item (problema_em) e o motivo';
  END IF;

  INSERT INTO ac_checkins (agendamento_id, conferido_por, resultado, problema_em, problema_motivo)
  VALUES (p_agendamento_id, p_conferido_por, p_resultado,
          CASE WHEN p_resultado = 'problema' THEN p_problema_em END,
          CASE WHEN p_resultado = 'problema' THEN NULLIF(p_problema_motivo,'') END)
  RETURNING id INTO v_checkin_id;

  UPDATE ac_agendamentos
     SET status = CASE WHEN p_resultado = 'liberado' THEN 'em_coleta' ELSE 'bloqueado' END,
         updated_at = now()
   WHERE id = p_agendamento_id;

  RETURN v_checkin_id;
END; $$;
```

### 5.2 `registrar_coleta` — a coleta + baixa (exige `em_coleta`)
```sql
-- p_insumos: jsonb array de { "product_id": uuid, "quantity": int }
CREATE OR REPLACE FUNCTION registrar_coleta(
  p_agendamento_id uuid,
  p_coletado_por   text,
  p_observacoes    text,
  p_insumos        jsonb
) RETURNS uuid
LANGUAGE plpgsql AS $$
DECLARE
  v_posto_id uuid; v_location_id uuid; v_status text;
  v_coleta_id uuid; v_mov_id uuid; v_prod uuid; v_qty int; ins jsonb;
BEGIN
  SELECT posto_id, status INTO v_posto_id, v_status
    FROM ac_agendamentos WHERE id = p_agendamento_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Agendamento % não encontrado', p_agendamento_id; END IF;
  IF v_status <> 'em_coleta' THEN
    RAISE EXCEPTION 'Coleta exige agendamento liberado na recepção (status em_coleta; atual: %)', v_status;
  END IF;

  IF v_posto_id IS NULL THEN RAISE EXCEPTION 'Agendamento sem posto: não há estoque de onde baixar'; END IF;
  -- posto_id não tem UNIQUE em stock_locations (hoje é 1:1 pelo usePostos); LIMIT 1
  -- torna a origem determinística mesmo se um posto vier a ter >1 local.
  SELECT id INTO v_location_id FROM stock_locations
    WHERE posto_id = v_posto_id AND rastreavel = true AND ativo = true
    ORDER BY is_principal DESC, created_at
    LIMIT 1;
  IF v_location_id IS NULL THEN RAISE EXCEPTION 'Posto sem estoque rastreável configurado'; END IF;

  INSERT INTO ac_coletas (agendamento_id, posto_id, location_id, coletado_por, observacoes)
  VALUES (p_agendamento_id, v_posto_id, v_location_id, p_coletado_por, NULLIF(p_observacoes,''))
  RETURNING id INTO v_coleta_id;

  FOR ins IN SELECT * FROM jsonb_array_elements(COALESCE(p_insumos,'[]'::jsonb))
  LOOP
    v_prod := (ins->>'product_id')::uuid;
    v_qty  := (ins->>'quantity')::int;
    IF v_qty IS NULL OR v_qty <= 0 THEN RAISE EXCEPTION 'Quantidade inválida para insumo %', v_prod; END IF;

    INSERT INTO stock_movements (product_id, product_name, type, reason, quantity, from_location_id, authorized_by, notes)
    SELECT v_prod, p.name, 'out', 'internal-consumption', v_qty, v_location_id, p_coletado_por, 'Coleta '||v_coleta_id
      FROM products p WHERE p.id = v_prod
    RETURNING id INTO v_mov_id;   -- trigger da Fase 5 debita product_stock (CHECK>=0 barra saldo insuficiente)
    -- INSERT...SELECT com produto inexistente insere 0 linhas (não é erro): sem este
    -- guard, o FK de ac_coleta_insumos barraria depois, mas com erro cru. Mensagem clara:
    IF NOT FOUND THEN RAISE EXCEPTION 'Produto % não encontrado', v_prod; END IF;

    INSERT INTO ac_coleta_insumos (coleta_id, product_id, quantity, stock_movement_id)
    VALUES (v_coleta_id, v_prod, v_qty, v_mov_id);
  END LOOP;

  UPDATE ac_agendamentos SET status = 'coletado', updated_at = now() WHERE id = p_agendamento_id;
  RETURN v_coleta_id;
END; $$;
```
- Ambas `SECURITY INVOKER` (default): a RLS permissiva (`authenticated`) já cobre; sem privilégio elevado.
- Coleta **sem insumos** é permitida (array vazio) — registra sem baixa. **Decisão travada (§12.1):** coletas sem insumo são válidas; sem `IF` extra.

## 6. Frontend (Etapa A)

- **`types.ts`:** adicionar `'bloqueado'` a `AcAgendamentoStatus`; tipos `AcCheckin`, `AcColeta`, `AcColetaInsumo` e input `InsumoInput { productId; quantity }`. **Lista fixa** `CHECKLIST_RECEPCAO` (chave + rótulo + descrição) — a fonte dos itens da tela e das chaves de `problema_em`.
- **Hook `useColetas`** (novo): `registrarCheckin(agendamentoId, conferidoPor, resultado, problemaEm, motivo)` → `rpc('registrar_checkin')`; `registrarColeta(agendamentoId, coletadoPor, observacoes, insumos)` → `rpc('registrar_coleta')`; `fetchColetas(filtros)`.
- **`PainelColetasPage`** (`/analises-clinicas/coletas`, gated `canManageColetas`): seletor posto + data (padrão `AgendamentosPage`, reusa `useAgendamentos`). Duas filas:
  - **Aguardando conferência** (`recebido`) → ação **"Conferência de recepção"** abre o checklist (itens de `CHECKLIST_RECEPCAO`; cabeçalho só com nome/posto/hora — §2.3). Botão **"Liberar coleta"** habilita só com todos marcados (→ `registrar_checkin` liberado ⇒ `em_coleta`); **"Registrar problema"** pede **qual item** (dropdown das chaves) + motivo (→ `registrar_checkin` problema ⇒ `bloqueado`).
  - **Liberados p/ coleta** (`em_coleta`) → ação **"Registrar coleta"**: `coletado_por`, `observacoes` e **linhas de insumo** (produto + qtd). A página resolve o `location_id` do posto (`stock_locations WHERE posto_id = <posto selecionado> AND rastreavel AND ativo` — o mesmo que a RPC faz server-side no §5.2) e alimenta o dropdown com **`fetchLocationStock(postoLocationId)`** (só o que tem saldo no posto, com `max` pela qtd). Confirmar → `registrar_coleta` ⇒ `coletado`. Ação sob `canManageColetas` — a mesma permissão do resto do fluxo (§7/§12.2).
  - Bloqueados aparecem com o status/motivo (fora da fila de ação).
- **Rota + nav** em `App.tsx`/`Layout.tsx`. *Sem tela de recoleta nesta etapa.*

## 7. RLS / permissões

- `ac_checkins`, `ac_coletas`, `ac_coleta_insumos`: RLS habilitada, policies **consistentes com as demais `ac_*`** (`authenticated`).
- Escopo por posto (o coletor só vê o próprio posto) = refinamento posterior (junto com a RLS por setor da Fase 5).
- **Gating por `canManageColetas` (Fase 4), uma permissão para todo o fluxo:** abre a `PainelColetasPage`, vê as filas, roda `registrar_checkin` e `registrar_coleta` (incluindo a baixa de insumos). **Não** exige `canConsumeStockDepart` — a baixa é um efeito interno da coleta, gateado pela permissão da própria feature (decisão §12.2).

## 8. Escopo da Fase 6

- **Etapa A (esta rodada):** §3 (3 tabelas: `ac_checkins`, `ac_coletas`, `ac_coleta_insumos` + status `bloqueado` + RLS/índices/updated_at) + §5 (RPCs `registrar_checkin` e `registrar_coleta`) + §6 (`PainelColetasPage` com conferência e coleta + hook + rota/gating). Entrega o fluxo recepção→coleta com baixa de insumos.
- **Etapa B (depois):** `ac_recoletas` + `RecoletasPage`; enriquecimento do agendamento (exames/convênio/jejum via LAB-HUB) para a conferência completa; desbloqueio/reagendamento; itens de checklist configuráveis (se a lista fixa apertar).
- **Fora de escopo:** estorno automático de baixa (§2.8); notificação `ac_recoleta` (WhatsApp); escopo/RLS por posto.

## 9. Verificação

1. **Type-check/lint** sem novos erros.
2. **Migration idempotente** (`IF NOT EXISTS`; relaxamento defensivo do `CHECK` de status).
3. **RPCs (transacionais) — testar no ambiente test** (padrão §10.4 da Fase 5, com rollback sem resíduo):
   - **Conferência liberada:** `ac_checkins` (resultado `liberado`, sem problema_em/motivo) + agendamento → `em_coleta`.
   - **Conferência com problema:** `ac_checkins` (resultado `problema`, `problema_em`+motivo obrigatórios) + agendamento → `bloqueado`; sem item ou sem motivo ⇒ erro (RPC e `CHECK`).
   - **Gate:** `registrar_coleta` em agendamento `recebido` (sem conferência) ⇒ erro; só passa em `em_coleta`.
   - **Coleta com N insumos com saldo** ⇒ `ac_coletas` (1) + `ac_coleta_insumos` (N) + N `out` no posto; `product_stock`/`products.quantity` caem; agendamento → `coletado`.
   - **Um** insumo sem saldo ⇒ **nada** gravado (coleta, insumos, baixas e status revertem juntos).
   - Agendamento sem posto / posto sem estoque ⇒ bloqueio com erro claro.
   - Re-registrar mesma conferência/coleta ⇒ barrado pelo `UNIQUE (agendamento_id)`.
4. **UI:** fila de conferência mostra `recebido`; liberar move para a fila de coleta (`em_coleta`); problema tira da fila (`bloqueado`); dropdown de insumos só oferta produtos com saldo no posto; baixa reflete no Estoque Departamental do posto.

## 10. Riscos & mitigação

- **Atomicidade** (conferência e coleta multi-insumo) — RPCs únicas (§5); `CHECK>=0` reverte o conjunto na coleta.
- **Posto sem `stock_locations`** — baixa sem origem; mitigado por bloqueio explícito (§2.7) e pela dependência do vínculo posto→local (§11).
- **Dependência da Fase 5 em produção** — a baixa exige o trigger novo + `product_stock`; a Fase 6 **não sobe em prod antes do cutover da Fase 5** (§11).
- **Itens de checklist fixos no frontend** (§2.2) — trocar a lista exige deploy + ajustar o `CHECK` de `problema_em`; aceitável na v1, e vira tabela configurável na Etapa B se apertar.
- **Baixa sem estorno (v1)** — coleta corrigida deixaria a baixa órfã; mitigado guardando `stock_movement_id` para estorno futuro.

## 11. Dependências (ordem de rollout)

1. **Fase 5 em produção** (cutover + frontend) — pré-requisito do §4/§5.2. Em dev/test já está aplicado.
2. **Vínculo posto → `stock_locations`** (trabalho em `usePostos.ts`/`AgendamentosPage.tsx`, hoje não-commitado) precisa estar em produção para cada posto ter estoque de onde baixar. Sem ele, toda coleta cai no bloqueio do §2.7.

## 12. Decisões (perguntas respondidas)

1. **Coleta sem insumos → permitida.** O §5.2 aceita array vazio (registra a coleta sem baixa) e fica assim: nem a RPC nem o form exigem ≥1 insumo.
2. **Permissão da baixa → sob `canManageColetas` (Opção A, uma permissão só).** Todo o fluxo de coleta — filas, conferência e "Registrar coleta" (com a baixa de insumos) — fica sob `canManageColetas`; **não** exige `canConsumeStockDepart`. Motivos: (a) a convenção do sistema é permissão **por feature** (a movimentação principal usa `canAddMovements`, o consumo departamental usa `canConsumeStockDepart`) — não há uma permissão única de "baixar estoque", então a coleta baixa sob a permissão da própria feature; (b) `canConsumeStockDepart` é **department-scoped** (a lógica de escopo por departamento vive no `EstoqueDepartamental.tsx`, não na chave), eixo que não é o da coleta (posto); (c) mantém os bounded contexts isolados (a coleta não depende de uma permissão do módulo de Estoque); (d) a auditoria de quem baixou já vem de `stock_movements` (`authorized_by`, `notes='Coleta <id>'`), não da permissão; (e) evita a "permissão pela metade" (um cargo que confere mas trava no "Registrar coleta"). **Se um dia surgir segregação de funções real** (conferir ≠ coletar), aí sim se cria uma chave dedicada (ex.: `canRegistrarColeta`) e se divide — YAGNI até lá.
