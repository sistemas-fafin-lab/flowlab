# Fase 7A — Recebimento de exames + Acompanhamento de Culturas

> **Status:** ✅ **Implementada (2026-07-10).** O desenho anterior desta fase — *análise central com baixa de reagentes* — foi **descartado** depois que o cliente esclareceu a operação real (§0). **Camada de dados** ✅ (migrations `20260709130000` / `131000` / `132000`, + `20260710120000` renomeando a etapa final) e **camada visual** ✅ (check-in estendido + página Culturas + rota/nav), tudo aplicado ao banco de test.
> **Plano mestre:** `docs/PLANO_FLOWLAB_ANALISES_CLINICAS.md` — ⚠️ ainda descreve o desenho antigo (análise/reagentes/laudo interno). **Para a Fase 7A, este documento prevalece.**
> **Depende de:** Fase 6 ✅ (conferência de recepção + o passo pós-conferência). Fase 5 só é tocada pela **baixa de insumo opcional** (§4). **Não** depende de análise interna — a análise é feita **fora** (laboratório de apoio).

---

## 0. Reescopo — por que o plano mudou

O plano original assumia que o **laboratório coletava** a amostra e a **analisava internamente**, consumindo reagentes (daí `ac_analises` + baixa). O cliente corrigiu a operação real:

- **Quem coleta é o médico**, não o laboratório. O paciente marca **data + local** e leva o material.
- No local, o funcionário faz o **checkup**: a conferência de recepção (já existe) **+ lê o pedido e seleciona os exames + confere a validade da amostra + coloca a etiqueta**.
- A **análise é externa** (laboratório de apoio) → **não há baixa de reagentes de análise** no FlowLab.
- Os exames de **cultura** (microbiologia) são **acompanhados manualmente** — o funcionário atualiza etapa/status conforme o exame anda, no **mesmo molde da página Temperatura e Equipamentos** (Fase 7C). "Acompanhar o resultado firme" = esse acompanhamento manual.

**Consequência:** todo o desenho de *análise interna com desfecho aprovado/reprovado e baixa de reagentes* (antigo §3–§7, preservado em §10 como histórico) **sai**. Entram: catálogo de exames, seleção de exames no check-in, e a página de Culturas.

> Registro durável do reescopo: memória `analises-clinicas-reescopo-fluxo-real.md`.

---

## 1. Fluxo real

```
        (LAB-HUB)                         no local, com o funcionário
recebido ──► [conferência de recepção] ──► em_coleta ──► [registrar: exames + validade + etiqueta] ──► coletado
   │                    │                                          │
   │                    └─[problema]─► bloqueado                   ├─ para cada exame de CULTURA:
   └─► cancelado                                                   │     abre linha em ac_culturas ──► (acompanhamento manual)
                                                                   │
                                                                   └─ (amostra enviada ao apoio externo; resultado acompanhado à parte)
```

- A **state machine do agendamento não muda**: `recebido → em_coleta → coletado`, com `bloqueado`/`cancelado`. **Sem** novos status (`analisado`/`reprovado` do desenho antigo **não** entram — não há desfecho interno).
- O passo pós-conferência (hoje "coleta") passa a registrar **exames + validade + etiqueta** em vez de "coleta com baixa de insumos". O nome dos status (`em_coleta`/`coletado`) foi **mantido** (decisão do usuário — menos risco no que o LAB-HUB grava).
- **Culturas** são um acompanhamento **paralelo e manual**, não alteram o status do agendamento.

---

## 2. Decisões travadas (com o usuário)

1. **Laboratório não coleta nem analisa.** Médico coleta; análise no apoio externo. Sem baixa de reagentes de análise.
2. **Check-in ganha 3 coisas:** seleção de exames (do catálogo), validade da amostra (um check), etiqueta (um check).
3. **Catálogo de exames importado da planilha** Google Sheets (comparativo de valores) → tabela `ac_exames`, seed re-executável. **Não** integração live com a API do Google.
4. **Culturas detectadas pelo nome** ("cultura" no nome do exame → `is_cultura`). Pega 8 exames no catálogo atual; editável à mão (marcar exceções).
5. **Página Culturas = molde da Temperatura** (Fase 7C): lista de itens atualizada manualmente, escrita direta sob RLS permissiva. **Sem RPC, sem integração.**
6. **Etapas da cultura começam mínimas e extensíveis** (o cliente ainda não conhece a trilha microbiológica). Trilha vive em `ac_cultura_etapas` (ordenada); adicionar etapa = inserir uma linha, sem migration de schema.
7. **Consumo de insumo é preservado como capacidade** (o consumo "pode ocorrer em outros lugares"), mas **sai do passo de check-in** — a `registrar_coleta` ainda aceita insumos, agora **opcionais**.
8. **Validade/etiqueta não bloqueiam** o registro (só ficam gravadas). `prazo_dias` padrão **5**.
9. **Permissão:** reusar `canManageColetas` ("Gerenciar Coletas e Análises", já dada ao `analistaSaude`). **Sem** nova chave (o antigo `canManageAnalises` foi descartado).

---

## 3. Modelo de dados (✅ implementado)

RLS **permissiva por `authenticated`** em todas as tabelas novas (o gate real é o frontend + a permissão), consistente com a Fase 6/7C. Trigger `ac_set_updated_at()` compartilhado.

### 3.1 `ac_exames` — catálogo de exames (migration `…130000`)
```sql
CREATE TABLE ac_exames (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome        text NOT NULL,          -- Descrição Exame (campo confiável; 100% preenchido)
  mnemonico   text,
  codigo_tuss text,
  material    text,                   -- tipo de amostra: S (soro), U (urina), F (fezes)…
  is_cultura  boolean NOT NULL DEFAULT false,  -- microbiológico de cultura (nome contém "cultura")
  ativo       boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
```
- **Seed idempotente** (só popula se a tabela estiver vazia → preserva edições): **529 exames**, dos quais **8** `is_cultura`. Importado da planilha "Comparativo de Valores A C / Orçamento Particular"; preço e colunas de convênio ficam **fora**.
- Re-importação futura (planilha mudou) = migration nova e pontual.

### 3.2 `ac_agendamento_exames` — exames marcados no check-in (migration `…131000`)
```sql
CREATE TABLE ac_agendamento_exames (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agendamento_id uuid NOT NULL REFERENCES ac_agendamentos(id) ON DELETE CASCADE,
  exame_id       uuid NOT NULL REFERENCES ac_exames(id) ON DELETE RESTRICT,
  exame_nome     text NOT NULL,                   -- snapshot
  is_cultura     boolean NOT NULL DEFAULT false,  -- snapshot
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (agendamento_id, exame_id)
);
```

### 3.3 `ac_coletas` — validade + etiqueta (ALTER, migration `…131000`)
```sql
ALTER TABLE ac_coletas ADD COLUMN validade_ok boolean;  -- amostra dentro da validade
ALTER TABLE ac_coletas ADD COLUMN etiquetado  boolean;  -- etiqueta colocada
```

### 3.4 `ac_cultura_etapas` — trilha ordenada e extensível (migration `…131000`)
```sql
CREATE TABLE ac_cultura_etapas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ordem integer NOT NULL UNIQUE,
  nome  text NOT NULL,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
-- Seed genérico mínimo: (1,'Recebida'),(2,'Em análise'),(3,'Pronta p/ laudo')
```
O stepper da página desenha a partir daqui. O cliente renomeia/insere as etapas microbiológicas reais quando as conhecer — só inserir linhas.

### 3.5 `ac_culturas` — cultura acompanhada (1 por exame de cultura/agendamento) (migration `…131000`)
```sql
CREATE TABLE ac_culturas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agendamento_id uuid NOT NULL REFERENCES ac_agendamentos(id) ON DELETE RESTRICT,
  exame_id       uuid REFERENCES ac_exames(id),
  exame_nome     text NOT NULL,             -- tipo do exame (snapshot)
  paciente_nome  text,                      -- snapshot (exibe sem join)
  posto_id       uuid,
  local_posto    text,                      -- snapshot do nome do posto
  etapa_ordem    integer NOT NULL DEFAULT 1,           -- → ac_cultura_etapas.ordem
  status         text NOT NULL DEFAULT 'em_andamento', -- em_andamento|positiva|sem_crescimento|pronta_laudo
  nota           text,                      -- nota livre da etapa atual
  resultado      text,                      -- desfecho/laudo textual (opcional)
  iniciada_em    timestamptz NOT NULL DEFAULT now(),
  prazo_dias     integer NOT NULL DEFAULT 5,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (agendamento_id, exame_id)
);
```

---

## 4. RPC `registrar_coleta` v2 (✅ implementada, migration `…132000`)

`SECURITY DEFINER SET search_path = public` (toca `ac_agendamentos`, que tem RLS só-SELECT → `FOR UPDATE` precisa de DEFINER; ver `20260708140000`). Assinatura nova:

```sql
registrar_coleta(
  p_agendamento_id uuid,
  p_coletado_por   text,
  p_observacoes    text,
  p_exame_ids      uuid[]  DEFAULT '{}',   -- exames marcados
  p_validade_ok    boolean DEFAULT NULL,
  p_etiquetado     boolean DEFAULT NULL,
  p_insumos        jsonb   DEFAULT '[]'    -- baixa opcional (capacidade preservada)
) RETURNS uuid
```

Comportamento:
1. Gate: exige `em_coleta` (resolve por `id`, senão por `labhub_id`).
2. Insere `ac_coletas` (com `validade_ok`/`etiquetado`; `location_id` só quando há insumos).
3. Para cada `exame_id`: grava `ac_agendamento_exames` (snapshot nome + `is_cultura`); se for cultura, **abre** `ac_culturas` (snapshot paciente/posto, etapa 1, status `em_andamento`, prazo 5). `ON CONFLICT DO NOTHING`.
4. **Insumos opcionais:** o loop de baixa (`out`/`internal-consumption`, trigger da Fase 5) só roda se houver insumos; **o estoque rastreável do posto só é exigido nesse caso** (antes a RPC falhava sempre sem estoque).
5. `em_coleta → coletado`.

---

## 5. Frontend (✅ implementado)

### 5.1 Check-in estendido — `PainelColetasPage` / `ColetaModal`
- Trocar o corpo do modal do passo pós-conferência: **remove a seção de insumos** e coloca:
  - **multi-select de exames** (lê `ac_exames` `ativo`; busca por nome/mnemônico) — é aqui que "os exames vêm pra cá";
  - **check "validade da amostra"** e **check "etiqueta colocada"**.
- `useColetas.registrarColeta(...)` passa a mandar `p_exame_ids`, `p_validade_ok`, `p_etiquetado` (e `p_insumos: []`).
- A capacidade de insumos permanece na RPC para reuso futuro; sai só da tela de check-in.

### 5.2 Página Culturas — `CulturasPage` (`/analises-clinicas/culturas`)
Molde da `TemperaturaEquipamentosPage` (escrita direta, sem RPC). Espelha o mockup aprovado:
- **Filtro de posto** (derivado das culturas presentes). **Tracking-only:** não há "+ Nova cultura" — como `ac_culturas.agendamento_id` é `NOT NULL`, toda cultura nasce no check-in; a página só acompanha.
- **4 KPIs** derivados: em andamento, positivas (+ % positividade), laudo concluído, **atrasadas** (além do `prazo_dias`). ("prazo médio" foi trocado por "atrasadas" — mais acionável, já que o prazo padrão é sempre 5.)
- **Grade de cards**: tipo do exame · paciente · posto; **badge de status** (`STATUS_CULTURA`: Em andamento · Positiva · Laudo concluído); **stepper** desenhado de `ac_cultura_etapas` com a `etapa_ordem` atual destacada; nota/resultado; iniciada em + prazo.
- **Edição manual:** avançar/retroceder etapa (controle segmentado), trocar status, editar nota/resultado, ajustar prazo, remover acompanhamento — tudo `UPDATE`/`DELETE` direto em `ac_culturas`.
- Hook novo **`useCulturas`** (espelha `useTemperaturas`): `refetch` (culturas + etapas), `updateCultura`, `deleteCultura`.

### 5.3 Rota + nav
- Rota `/analises-clinicas/culturas` em `App.tsx`, gated `canManageColetas`.
- Subitem **"Culturas"** no grupo "Análises Clínicas" em `Layout.tsx` (mesmo padrão de "Check-in"/"Temperatura"), + incluir no breadcrumb e no `anyOf` do grupo.

---

## 6. RLS / permissões

- Tabelas novas: RLS **permissiva por `authenticated`** (SELECT/INSERT/UPDATE/DELETE conforme a tabela). O gate real é o frontend + a permissão.
- **Gating:** `canManageColetas` (reuso). Sem nova chave, sem migration de permissão.

---

## 7. Escopo / status

| Item | Status |
|---|---|
| `ac_exames` + seed 529 exames | ✅ implementado (migration) |
| `ac_agendamento_exames` · `ac_coletas`(+2 col) · `ac_cultura_etapas` · `ac_culturas` | ✅ implementado (migration) |
| `registrar_coleta` v2 (exames + validade + etiqueta + culturas) | ✅ implementado (migration) |
| Tipos (`AcExame`, `AcCultura`, `AcCulturaEtapa`, `AcAgendamentoExame`, `STATUS_CULTURA`) | ✅ implementado |
| Migrations aplicadas ao banco de test (`supabase db push`) | ✅ aplicado |
| Etapa final renomeada `Pronta p/ laudo` → `Laudo concluído` (migration `…20260710120000`) | ✅ implementado |
| Check-in estendido (UI + `useColetas`) | ✅ implementado |
| Página Culturas + `useCulturas` + rota/nav | ✅ implementado |

**Fora de escopo:** valores de exame/laudo clínico (o acompanhamento aqui é operacional); integração automática de resultado (é manual); estorno de baixa; cultura como fluxo com ramificação positivo/negativo (a trilha é linear e editável na v1); microbiologia detalhada (antibiograma como etapa própria) — refináveis via `ac_cultura_etapas`.

---

## 8. Verificação

1. **Type-check/lint** sem novos erros (os erros pré-existentes em IT/quotations/Postos não são desta fase).
2. **Migrations idempotentes** — `IF NOT EXISTS`, seed guardado por "só se vazia", `ON CONFLICT DO NOTHING`, `DROP FUNCTION IF EXISTS`.
3. **Seed:** `ac_exames` com 529 linhas, 8 `is_cultura` (copro/uro/cultura bacteriana/fungos/strepto B/urina c/ colônias).
4. **RPC (ambiente test):**
   - Gate: `registrar_coleta` fora de `em_coleta` ⇒ erro.
   - Com exames (inclui 1 cultura) + validade/etiqueta, **sem insumos** ⇒ `ac_coletas` (com os 2 checks), `ac_agendamento_exames` (N), **1** `ac_culturas` aberta; agendamento → `coletado`; **sem** exigir estoque do posto.
   - Com insumos ⇒ baixa `out` no estoque do posto (Fase 5) + exige estoque rastreável; saldo insuficiente reverte tudo.
   - Re-registrar ⇒ barrado pelo `UNIQUE(agendamento_id)` de `ac_coletas`.
5. **UI:** check-in lista/seleciona exames do catálogo; ao confirmar, a cultura aparece na página; a página edita etapa/status manualmente e os KPIs refletem.

---

## 9. Riscos & mitigação

- **Detecção de cultura por nome** pode errar bordas (ex.: microbiológicos sem "cultura" no nome) — mitigado por `is_cultura` editável à mão.
- **Trilha de etapas provisória** (trio genérico) — assumido; refinar em `ac_cultura_etapas` quando o cliente conhecer as etapas reais.
- **Catálogo desatualiza** vs. planilha — re-import pontual quando necessário; seed não sobrescreve edições.
- **`registrar_coleta` mudou de assinatura** — a versão antiga `(uuid,text,text,jsonb)` é dropada; o hook `useColetas` **precisa** ser atualizado junto (senão manda parâmetros a menos, mas os defaults cobrem — ainda assim, atualizar para enviar exames/validade/etiqueta).

---

## 10. Desenho descartado (histórico — NÃO implementar)

O plano original desta fase modelava a **análise interna**: tabelas `ac_analises` + `ac_analise_insumos`, RPC `registrar_analise` (baixa de reagentes do setor do lab), status `analisado`/`reprovado`, `PainelAnalisesPage` com desfecho aprovado/reprovado e motivo de reprova, e uma nova permissão `canManageAnalises`.

**Por que foi descartado:** pressupunha que o laboratório analisava a amostra consumindo reagentes. Na operação real, a análise é **externa** (apoio) e não há baixa de reagentes nossa; o "resultado" é acompanhado **manualmente** (Culturas). Manter esse desenho seria retrabalho e enganaria quem lê. Preservado aqui só como registro da decisão.
