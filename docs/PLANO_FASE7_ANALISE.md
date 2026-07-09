# Fase 7 — Análise (registro operacional + baixa de reagentes)

> **Status:** **Etapa C (Temperatura e Equipamentos) ✅ implementada** — construída de forma independente (não depende de A/B); migration `20260709120000_fase7c_temperatura_equipamentos.sql`. Etapa A (registro da análise + desfecho + baixa de reagentes) 🚧 planejada; cultura (Etapa B) adiada.
> **Plano mestre:** `docs/PLANO_FLOWLAB_ANALISES_CLINICAS.md` (Fase 7 — Análise / cultura / temperatura)
> **Depende de:** Fase 5 (multi-local: `product_stock`, trigger de baixa, estoque por local) + Fase 6 ✅ (coleta → `coletado`, o insumo de entrada da análise). **Habilita:** Fase 6 **Etapa B (recoleta)** — o desfecho `reprovado` é o gatilho — e a Fase 8 (KPIs de desperdício/produtividade).

## 1. Objetivo

Fechar a etapa **depois da coleta**: a amostra `coletado` chega ao laboratório central, é **analisada** e recebe um **desfecho operacional** — aprovada (seguiu para resultado, fora do nosso escopo) ou **reprovada** (amostra imprópria → precisa de recoleta). No mesmo ato, a análise **dá baixa nos reagentes/insumos consumidos** no estoque do setor do lab — reaproveitando integralmente a fundação multi-local da Fase 5 e o padrão de baixa da Fase 6.

> **Fora de escopo (do projeto inteiro, não só desta fase):** os **valores do exame / laudo** (resultado clínico). O plano mestre coloca "Resultados (liberação + entrega ao paciente)" fora de escopo; `ac_analises` é o **registro operacional** da análise (qual amostra, quem, quando, desfecho, reagentes), **não** os resultados. A entrega ao paciente é do portal do LAB-HUB.

Ciclo do agendamento (o trecho novo em **negrito**):
```
recebido ─► em_coleta ─► coletado ─►[registrar análise: aprovado]─► analisado
   │            │                          │
   │            │                          └─[registrar análise: reprovado]─► reprovado
   │            └─[problema]─► bloqueado                                          │
   │                                                                             │
   └─► cancelado                          reprovado ═══► recoleta (Fase 6 Etapa B) ┘
```
> `analisado` é terminal nesta fase (Resultados fora de escopo). `reprovado` é o **dead-end análogo ao `bloqueado`**: quem o resolve é a **recoleta (Fase 6 Etapa B)**, ainda não implementada. Até lá, `reprovado` só sinaliza e sai da fila (igual `bloqueado` hoje).

## 2. Decisões travadas (com o usuário)

1. **Etapa A = só a análise.** Cultura (`ac_culturas`) fica para a **Etapa B**; temperatura/equipamentos (`ac_temperaturas`, `ac_equipamentos`) para a **Etapa C**. Espelha o corte enxuto da Fase 6 (entrega valor cedo, mantém escopo controlável).
2. **A análise dá baixa de reagentes** — do estoque de um **setor do laboratório central** (uma `stock_locations` com `posto_id IS NULL`), não do posto. Reusa o mesmo movimento `out`/`internal-consumption` da coleta (§4).
3. **Sem valores de exame / laudo** (fora de escopo do projeto). `ac_analises` guarda só o desfecho operacional (`aprovado`/`reprovado`) + motivo quando reprovado.
4. **Passo único (`registrar_analise`), sem estado intermediário `em_analise` na v1.** A análise vai de `coletado` direto a `analisado`|`reprovado` num ato só — espelha `registrar_coleta` (coletado num ato). Uma fila "em processamento" (`em_analise`) é refinamento posterior, se surgir necessidade de separar "entrou no equipamento" de "desfecho saiu" (mesma lógica YAGNI da §12.2 da Fase 6).
5. **Reprovação com motivo obrigatório, de lista fixa.** `reprovado` exige `motivo_reprova` (hemólise, volume insuficiente, coágulo, amostra inadequada, contaminação, armazenamento) — a lista fixa no frontend, validada por `CHECK`. Igual ao `problema_em` da conferência (Fase 6 §2.2). É esse motivo que alimenta o desperdício (Fase 8) e a recoleta (Fase 6 Etapa B).
6. **Reagentes por seleção manual** (produto + quantidade), **opcionais** — coerente com a coleta (§12.1 da Fase 6). Reprovação na triagem (visual, antes de rodar) → sem reagentes; reprovação/aprovação após rodar → com reagentes. O array vazio é válido nos dois desfechos.
7. **Análise 1:1 agendamento** (`UNIQUE (agendamento_id)`), como conferência e coleta. Vínculo `coleta_id` guardado (snapshot) para o turnaround coleta→análise (KPIs Fase 8).
8. **Baixa é `out` simples (consumo), sem estorno automático** na v1 — o `stock_movement_id` fica guardado para viabilizar estorno depois (idêntico à Fase 6 §2.8).
9. **Atomicidade via RPC.** A análise roda numa **função Postgres transacional** (§5) — herda o `CHECK (quantity >= 0)` + rollback da Fase 5.
10. **RPC `SECURITY DEFINER SET search_path = public`.** As tabelas `ac_*` têm RLS só-SELECT (escritas vêm do LAB-HUB via `service_role`); um `SELECT ... FOR UPDATE` sob `INVOKER` retorna 0 linhas → "não encontrado". Foi o bug da Fase 6; a Fase 7 já nasce `DEFINER` (ver `20260708140000_fix_coletas_security_definer.sql`).

## 3. Modelo de dados

### 3.1 `ac_analises` — registro da análise (1:1 agendamento)
```sql
CREATE TABLE IF NOT EXISTS ac_analises (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agendamento_id uuid NOT NULL UNIQUE REFERENCES ac_agendamentos(id) ON DELETE RESTRICT,
  coleta_id      uuid REFERENCES ac_coletas(id),        -- a coleta que originou a amostra (snapshot p/ turnaround)
  location_id    uuid REFERENCES stock_locations(id),   -- setor do lab de onde saiu a baixa (snapshot; null se sem reagentes)
  analisado_por  text NOT NULL,
  analisado_em   timestamptz NOT NULL DEFAULT now(),
  resultado      text NOT NULL CHECK (resultado IN ('aprovado','reprovado')),
  motivo_reprova text CHECK (motivo_reprova IN
                    ('hemolise','volume_insuficiente','coagulo','amostra_inadequada','contaminacao','armazenamento')),
  observacoes    text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  -- 'reprovado' exige motivo; 'aprovado' não tem motivo
  CONSTRAINT ck_analise_reprova CHECK (
       (resultado = 'reprovado' AND motivo_reprova IS NOT NULL)
    OR (resultado = 'aprovado'  AND motivo_reprova IS NULL)
  )
);
CREATE INDEX IF NOT EXISTS idx_ac_analises_analisado_em ON ac_analises(analisado_em DESC);
CREATE INDEX IF NOT EXISTS idx_ac_analises_resultado    ON ac_analises(resultado);
```
- **Uma linha por agendamento** (`UNIQUE`). `resultado='aprovado'` ⇒ agendamento → `analisado`; `'reprovado'` ⇒ `reprovado`.
- `motivo_reprova` = chave do motivo (mesmas chaves da lista fixa do frontend). `CHECK ck_analise_reprova` garante os dois formatos válidos: aprovado sem motivo, ou reprovado **sempre** com motivo.
- `location_id` fica `null` quando a análise não baixou reagentes (reprovação na triagem).

### 3.2 `ac_analise_insumos` — reagentes consumidos (linha por produto)
```sql
CREATE TABLE IF NOT EXISTS ac_analise_insumos (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  analise_id        uuid NOT NULL REFERENCES ac_analises(id) ON DELETE CASCADE,
  product_id        uuid NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  quantity          integer NOT NULL CHECK (quantity > 0),
  stock_movement_id uuid REFERENCES stock_movements(id),  -- a baixa gerada (rastreio/estorno futuro)
  created_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ac_analise_insumos_analise ON ac_analise_insumos(analise_id);
```

### 3.3 Status do agendamento + `updated_at`
- **Novos status `analisado` e `reprovado`.** Se `ac_agendamentos.status` tiver `CHECK`, a migration o **relaxa defensivamente** (padrão da Fase 5/6) para: `recebido | em_coleta | coletado | bloqueado | analisado | reprovado | cancelado`.
- `updated_at`: reusa a função de trigger já usada pelas demais `ac_*`. `ac_analise_insumos` é imutável (sem trigger).

## 4. Baixa de reagentes — reuso da Fase 5/6

Idêntico à coleta (Fase 6 §4), só muda a **origem**: em vez do estoque do posto, sai do **estoque de um setor do lab central** — uma `stock_locations` com `posto_id IS NULL`, `rastreavel = true`, `ativo = true` (a "Qualidade"/principal ou um setor departamental de análises). É a **2ª etapa (consumo real)** do modelo multi-local: a Qualidade transfere para o setor, o setor consome ao analisar.

Cada reagente vira **uma** linha em `stock_movements`, interpretada pelo trigger `update_stock_on_movement` da Fase 5:

| Campo | Valor |
|---|---|
| `type` | `'out'` |
| `reason` | `'internal-consumption'` |
| `from_location_id` | estoque do **setor do lab** (`location_id` escolhido na tela; `posto_id IS NULL`) |
| `to_location_id` | `null` |
| `product_id` / `quantity` | o reagente selecionado |
| `notes` | `'Análise <id>'` |

O trigger debita `product_stock` do setor e o cache atualiza `products.quantity`. Saldo insuficiente ⇒ `CHECK (quantity >= 0)` estoura e **reverte a transação** (a RPC do §5).

## 5. RPC transacional — `registrar_analise`

```sql
-- p_insumos: jsonb array de { "product_id": uuid, "quantity": int }
DROP FUNCTION IF EXISTS registrar_analise(uuid, text, uuid, text, text, text, jsonb);

CREATE OR REPLACE FUNCTION registrar_analise(
  p_agendamento_id uuid,
  p_analisado_por  text,
  p_location_id    uuid,   -- setor do lab de onde sai a baixa (obrigatório se houver reagentes)
  p_resultado      text,   -- 'aprovado' | 'reprovado'
  p_motivo_reprova text,   -- chave do motivo (só quando 'reprovado')
  p_observacoes    text,
  p_insumos        jsonb
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER            -- ac_* têm RLS só-SELECT; FOR UPDATE precisa de DEFINER (§2.10)
SET search_path = public
AS $$
DECLARE
  v_agendamento_id uuid; v_status text; v_coleta_id uuid;
  v_analise_id uuid; v_mov_id uuid; v_prod uuid; v_qty int; ins jsonb;
  v_has_insumos boolean := jsonb_array_length(COALESCE(p_insumos,'[]'::jsonb)) > 0;
BEGIN
  -- Resolve por id local; se não achar, tenta por labhub_id (padrão da Fase 6).
  SELECT id, status INTO v_agendamento_id, v_status
    FROM ac_agendamentos WHERE id = p_agendamento_id FOR UPDATE;
  IF NOT FOUND THEN
    SELECT id, status INTO v_agendamento_id, v_status
      FROM ac_agendamentos WHERE labhub_id = p_agendamento_id FOR UPDATE;
  END IF;
  IF v_agendamento_id IS NULL THEN
    RAISE EXCEPTION 'Agendamento % não encontrado', p_agendamento_id;
  END IF;
  IF v_status <> 'coletado' THEN
    RAISE EXCEPTION 'Análise exige amostra coletada (status coletado; atual: %)', v_status;
  END IF;

  IF p_resultado NOT IN ('aprovado','reprovado') THEN RAISE EXCEPTION 'Resultado inválido'; END IF;
  IF p_resultado = 'reprovado' AND p_motivo_reprova IS NULL THEN
    RAISE EXCEPTION 'Reprovação exige o motivo';
  END IF;

  -- Valida o local só quando há reagentes a baixar.
  IF v_has_insumos THEN
    IF p_location_id IS NULL THEN RAISE EXCEPTION 'Selecione o estoque do setor para baixar os reagentes'; END IF;
    PERFORM 1 FROM stock_locations
      WHERE id = p_location_id AND rastreavel = true AND ativo = true;
    IF NOT FOUND THEN RAISE EXCEPTION 'Estoque do setor inválido (precisa ser rastreável e ativo)'; END IF;
  END IF;

  -- Vínculo com a coleta que originou a amostra (snapshot; pode não existir).
  SELECT id INTO v_coleta_id FROM ac_coletas WHERE agendamento_id = v_agendamento_id;

  INSERT INTO ac_analises (agendamento_id, coleta_id, location_id, analisado_por,
                           resultado, motivo_reprova, observacoes)
  VALUES (v_agendamento_id, v_coleta_id,
          CASE WHEN v_has_insumos THEN p_location_id END,
          p_analisado_por, p_resultado,
          CASE WHEN p_resultado = 'reprovado' THEN p_motivo_reprova END,
          NULLIF(p_observacoes, ''))
  RETURNING id INTO v_analise_id;

  FOR ins IN SELECT * FROM jsonb_array_elements(COALESCE(p_insumos,'[]'::jsonb))
  LOOP
    v_prod := (ins->>'product_id')::uuid;
    v_qty  := (ins->>'quantity')::int;
    IF v_qty IS NULL OR v_qty <= 0 THEN RAISE EXCEPTION 'Quantidade inválida para reagente %', v_prod; END IF;

    INSERT INTO stock_movements (product_id, product_name, type, reason, quantity,
                                 from_location_id, authorized_by, notes)
    SELECT v_prod, p.name, 'out', 'internal-consumption', v_qty, p_location_id, p_analisado_por,
           'Análise ' || v_analise_id
      FROM products p WHERE p.id = v_prod
    RETURNING id INTO v_mov_id;   -- trigger da Fase 5 debita product_stock (CHECK>=0 barra saldo insuficiente)
    IF NOT FOUND THEN RAISE EXCEPTION 'Produto % não encontrado', v_prod; END IF;

    INSERT INTO ac_analise_insumos (analise_id, product_id, quantity, stock_movement_id)
    VALUES (v_analise_id, v_prod, v_qty, v_mov_id);
  END LOOP;

  UPDATE ac_agendamentos
     SET status = CASE WHEN p_resultado = 'aprovado' THEN 'analisado' ELSE 'reprovado' END,
         updated_at = now()
   WHERE id = v_agendamento_id;

  RETURN v_analise_id;
END; $$;

GRANT EXECUTE ON FUNCTION registrar_analise(uuid, text, uuid, text, text, text, jsonb) TO authenticated;
```
- **Gate:** exige `coletado`. Não dá para analisar `recebido`/`em_coleta`/`bloqueado`/`reprovado`/`analisado`.
- **Análise sem reagentes** é permitida (array vazio) — registra o desfecho sem baixa e sem exigir `location_id`. Cobre a reprovação na triagem.
- A validação do local não bloqueia postos por ID, mas a **tela só oferece locais `posto_id IS NULL`** (§6) — a baixa de análise nunca sai de um posto.

## 6. Frontend (Etapa A)

- **`types.ts`:** adicionar `'analisado'` e `'reprovado'` a `AcAgendamentoStatus`; tipos `AcAnalise`, `AcAnaliseInsumo`; `AnaliseResultado = 'aprovado' | 'reprovado'`; `MotivoReprovaKey`; e a **lista fixa** `MOTIVOS_REPROVA_ANALISE` (chave + rótulo) — fonte dos itens da tela e das chaves de `motivo_reprova`. Reusa `InsumoInput`.
- **Hook `useAnalises`** (novo, espelha `useColetas`): `registrarAnalise(agendamentoId, analisadoPor, locationId, resultado, motivoReprova, observacoes, insumos)` → `rpc('registrar_analise')`; `fetchAnalises(agendamentoIds)` → lê `ac_analises` (para exibir motivo dos reprovados). O saldo do setor reusa `useInventory().fetchLocationStock(locationId)` (mesmo helper da coleta).
- **`PainelAnalisesPage`** (`/analises-clinicas/analises`, gated — ver §7): a análise é **central**, não por posto, então a fila é **global** (todos os `coletado`), sem o seletor de posto da coleta (posto entra só como coluna informativa). Um seletor de **setor do lab** (dropdown de `stock_locations` com `posto_id IS NULL`, `rastreavel`, `ativo`, default `is_principal`) define de onde sai a baixa.
  - **Aguardando análise** (`coletado`) → ação **"Registrar análise"** abre o modal: `analisado_por`, o setor do lab, um toggle **Aprovado / Reprovado**, e **linhas de reagente** (produto + qtd) alimentadas por `fetchLocationStock(setor)` (só o que tem saldo, com `max`).
    - **Aprovado** → confirma ⇒ `registrar_analise` ⇒ `analisado`.
    - **Reprovado** → exige **motivo** (dropdown de `MOTIVOS_REPROVA_ANALISE`) + observação; reagentes opcionais ⇒ `registrar_analise` ⇒ `reprovado`.
  - **Analisadas** (`analisado`) e **Reprovadas** (`reprovado`) aparecem como histórico/estatística; as reprovadas em destaque (fila da futura recoleta + desperdício).
- **Rota + nav** em `App.tsx`/`Layout.tsx` (subitem "Análise" no grupo Análises Clínicas, mesmo padrão do "Check-in"). *Sem tela de cultura/temperatura nesta etapa.*

## 7. RLS / permissões

- `ac_analises`, `ac_analise_insumos`: RLS habilitada, policies **consistentes com as demais `ac_*`** (`authenticated` SELECT; escritas via RPC `DEFINER`).
- **Gating — nova chave `canManageAnalises` (decisão travada).** A análise acontece no **lab central** e é feita pelo **analista**, papel/local distinto do **coletor** no posto — é uma **segregação de função real** (exatamente o caso que a §12.2 da Fase 6 previa para justificar uma chave dedicada). Criar `canManageAnalises` (grupo "Análises Clínicas" em `src/utils/permissions.ts`), dá-la ao cargo `analistaSaude` e fazer o backfill de Administrador/Operador (padrão da migration `20260630140000`). A `PainelAnalisesPage` e a RPC ficam sob ela.
  - *Descartada:* reusar `canManageColetas` (sugestão da linha 237 do plano mestre) — era mais barato (sem migration de permissão), mas não separaria coletor de analista.

## 8. Escopo da Fase 7

- **Etapa A (esta rodada):** §3 (2 tabelas: `ac_analises`, `ac_analise_insumos` + status `analisado`/`reprovado` + RLS/índices/updated_at) + §5 (RPC `registrar_analise`) + §6 (`PainelAnalisesPage` + hook + rota/gating). Entrega o fluxo coleta→análise com desfecho e baixa de reagentes.
- **Etapa B (depois):** `ac_culturas` (microbiologia: incubação, positivo/negativo, tempo). Provável reuso do mesmo padrão de baixa/registro.
- **Etapa C (✅ implementada, independente):** `ac_equipamentos` + `ac_temperaturas` — cadastro de equipamentos com faixa aceitável e log de leituras com alerta de "fora da faixa" (derivado por trigger). Página `TemperaturaEquipamentosPage` (`/analises-clinicas/temperatura`, gated `canManageColetas`), hook `useTemperaturas`, migration `20260709120000`. Feed do desperdício (Fase 8). *Não* depende de A/B nem toca `ac_agendamentos`.
- **Habilita a Fase 6 Etapa B (recoleta):** com `reprovado` existindo e carregando o motivo, a recoleta ganha seu gatilho — a `RecoletasPage` consome os agendamentos `reprovado` (e os `bloqueado` da conferência).
- **Fora de escopo:** valores de exame / laudo (Resultados); estorno automático de baixa (§2.8); notificação (WhatsApp); escopo/RLS por setor.

## 9. Verificação

1. **Type-check/lint** sem novos erros.
2. **Migration idempotente** (`IF NOT EXISTS`; `DROP FUNCTION IF EXISTS`; relaxamento defensivo do `CHECK` de status).
3. **RPC (transacional) — testar no ambiente test** (padrão da Fase 5/6, rollback sem resíduo):
   - **Gate:** `registrar_analise` em agendamento que não está `coletado` (ex.: `em_coleta`, `bloqueado`) ⇒ erro; só passa em `coletado`.
   - **Aprovado com N reagentes com saldo** ⇒ `ac_analises` (1, resultado `aprovado`, sem motivo) + `ac_analise_insumos` (N) + N `out` no setor; `product_stock`/`products.quantity` caem; agendamento → `analisado`.
   - **Reprovado com motivo** (ex.: `hemolise`) ⇒ `ac_analises` (resultado `reprovado`, motivo obrigatório) + agendamento → `reprovado`; reprovado **sem** motivo ⇒ erro (RPC e `CHECK`); aprovado **com** motivo ⇒ erro (`CHECK`).
   - **Reprovado na triagem** (sem reagentes, sem `location_id`) ⇒ registra sem baixa (`location_id` null); agendamento → `reprovado`.
   - **Um** reagente sem saldo ⇒ **nada** gravado (análise, insumos, baixas e status revertem juntos).
   - Reagentes informados mas **sem `location_id`** ⇒ erro claro; local não rastreável/inativo ⇒ erro.
   - Re-registrar a mesma análise ⇒ barrado pelo `UNIQUE (agendamento_id)`.
4. **UI:** fila de análise mostra os `coletado` (global, com o posto como coluna); aprovar move para "Analisadas"; reprovar move para "Reprovadas" com o motivo; dropdown de reagentes só oferta produtos com saldo no setor; baixa reflete no Estoque Departamental do setor.

## 10. Riscos & mitigação

- **Atomicidade** (análise multi-reagente) — RPC única (§5); `CHECK>=0` reverte o conjunto.
- **Setor do lab sem `stock_locations` configurada** — sem local rastreável não há de onde baixar; mitigado exigindo o local só quando há reagentes (a análise "seca"/triagem passa sem local) e por erro claro quando falta.
- **Dependência da Fase 5 em produção** — a baixa exige o trigger novo + `product_stock`; a Fase 7 **não sobe em prod antes do cutover da Fase 5** (herda a §11 da Fase 6).
- **Motivos de reprova fixos no frontend** (§2.5) — trocar a lista exige deploy + ajustar o `CHECK` de `motivo_reprova`; aceitável na v1 (mesmo trade-off do checklist da Fase 6).
- **`reprovado` como dead-end até a recoleta** — igual ao `bloqueado` hoje: sai da fila e aguarda a Fase 6 Etapa B. Aceitável; é o gancho que justifica a Etapa B.
- **Baixa sem estorno (v1)** — análise corrigida deixaria a baixa órfã; mitigado guardando `stock_movement_id` para estorno futuro.

## 11. Dependências (ordem de rollout)

1. **Fase 6 em produção** (que por sua vez exige **Fase 5 + vínculo posto→`stock_locations`**, §11 da Fase 6) — a análise consome amostras `coletado`, geradas pela coleta.
2. **Estoque do setor do lab em `stock_locations`** (`posto_id IS NULL`, `rastreavel`, `ativo`, abastecido pela Qualidade) — sem ele, só a análise sem reagentes funciona.
3. **Migration de permissão `canManageAnalises` (§7):** nova chave + seed no `analistaSaude` + backfill Administrador/Operador — precisa ir junto.

## 12. Decisões (perguntas respondidas)

1. **Escopo da Etapa A → só análise.** Cultura e temperatura/equipamentos ficam para as Etapas B/C. Motivo: entregar o desfecho (que destrava a recoleta) e a baixa de reagentes rápido, sem carregar o escopo de microbiologia e IoT de equipamentos.
2. **Baixa de reagentes → sim, do setor do lab central.** Reusa Fase 5/6 (movimento `out`/`internal-consumption`), com a origem sendo uma `stock_locations` `posto_id IS NULL` escolhida na tela. Mantém a análise fiel ao módulo de estoque (é o valor central do projeto).
3. **Passo único vs `em_analise` → passo único.** `coletado → analisado|reprovado` num ato, espelhando `registrar_coleta`. `em_analise` (fila "em processamento") vira refinamento se a operação pedir separar entrada no equipamento do desfecho.
4. **Reagentes opcionais nos dois desfechos → sim.** Cobre reprovação na triagem (sem baixa) e análise rodada (com baixa), sem `IF` extra no form nem na RPC.
5. **Permissão → nova chave `canManageAnalises` (§7).** Segregação real coletor×analista justifica chave dedicada; descartado reusar `canManageColetas` (sugestão do plano mestre). Custa uma migration de permissão (nova key + seed `analistaSaude` + backfill Administrador/Operador).
