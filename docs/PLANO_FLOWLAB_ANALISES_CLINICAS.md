# Plano de Implementação — FlowLab · Análises Clínicas

> **Escopo do projeto:** o **AGENDAMENTO** (✅ concluído — Fases 0–3) e a **operação interna do laboratório** — permissões/role `analista`, estoque departamental, coleta/recoleta, análise/cultura/temperatura e dashboard de KPIs (Fases 4–8, a fazer).
> **Fora de escopo:** **Resultados** (liberação + entrega ao paciente) e **notificação WhatsApp**, mais o que depende deles (reconciliação `ac_resultados`↔`ac_analises`, permissão `canLiberarResultados`) — ver "Fora de escopo" no fim.
> O portal do paciente (agendamento + resultados) é do LAB-HUB — ver `LAB-HUB/docs/PLANO_ANALISES_CLINICAS.md`.
> Baseado em: `LAB-HUB/docs/ARQUITETURA_ANALISES_CLINICAS.md`, `FLUXO.md`, `ANALISES_CLINICAS.md`.
> Criado em: Junho/2026 · **Reduzido ao escopo de agendamento em 30/Jun/2026** · **Reexpandido em 30/Jun/2026** para incluir a operação interna (coleta → análise → dashboard); só Resultados e WhatsApp seguem fora.
>
> **Última atualização:** 30/Jun/2026 — agendamento completo + cancelamento cruzado fechado; plano reexpandido com as Fases 4–8 (operação interna). **Fase 4 concluída:** permissão `canManageColetas` + cargo de sistema `analistaSaude` (custom role, não role legacy) + backfill de AC nos cargos seedados.

---

## Contexto e Papéis

```
Paciente → LAB-HUB (agendamento)
                └─► API REST ◄──► FlowLab (operação interna do laboratório)
```

O LAB-HUB cria o agendamento e o envia ao FlowLab; o FlowLab é dono dos **postos e horários** (disponibilidade) e registra os agendamentos recebidos para o operador trabalhar.

O FlowLab é React + TypeScript + Supabase + Vite, com arquitetura modular (`src/modules/`), permissões (legacy + custom roles), e rotas serverless em `api/` (umami, notifications, users). A integração de Análises Clínicas segue esse padrão (`api/analises-clinicas/*`).

---

## ✅ Estado do agendamento (30/Jun/2026)

A **integração de agendamento** já fecha o loop com o LAB-HUB. Falta a **camada de app/UI** no FlowLab e um ajuste de consistência de slots.

| Item | Estado | Onde |
|------|:------:|------|
| Tabelas `ac_postos`, `ac_slots_disponiveis`, `ac_agendamentos` + RLS + triggers + seed | ✅ | `supabase/migrations/20260629120000_ac_integracao_labhub.sql` |
| `receive-agendamento` (LAB-HUB → FlowLab, idempotente por `labhub_id`) | ✅ | `api/analises-clinicas/receive-agendamento.ts` |
| `get-disponibilidade` (D3 — serve postos/slots ao LAB-HUB) | ✅ | `api/analises-clinicas/get-disponibilidade.ts` |
| Helpers de integração (Bearer timing-safe, env) | ✅ | `api/_lib/labhubIntegration.ts`, `api/_lib/supabase.ts` |
| Variáveis de ambiente | ✅ | `.env.example` |
| **Reserva de slot** (disponibilidade refletir horários já tomados) | ✅ | `api/analises-clinicas/get-disponibilidade.ts` (ocupação derivada de `ac_agendamentos`) |
| **AgendamentosPage** (operador vê agendamentos por posto/data) + módulo + rota + permissão | ✅ | `src/modules/analises-clinicas/`, `src/App.tsx`, `src/components/Layout.tsx`, `src/utils/permissions.ts` |
| **Gestão de postos + agenda recorrente** (horários fixos seg–sáb + exceções por dia) | ✅ | `src/modules/analises-clinicas/components/PostosPage.tsx` + migrations `20260630120000` (postos) e `20260630130000` (agenda recorrente) |
| ~~Notificação `ac_agendamento_confirmado` (WhatsApp)~~ | ⏸️ adiado | fora de escopo desta fase |

---

## Fluxo de Agendamento (ponta a ponta)

```
LAB-HUB                                            FlowLab
───────                                            ───────
SchedulePage lista postos/slots ──────────────►  GET  api/analises-clinicas/get-disponibilidade  ✅
(proxy GET /api/v1/postos/disponibilidade)        (lê ac_postos + ac_slots_disponiveis ativos)

Paciente confirma
POST /api/v1/agendamentos
  ├ valida slot ao vivo
  ├ insere agendamentos (pendente)
  └ sincroniza ────────────────────────────────►  POST api/analises-clinicas/receive-agendamento  ✅
       (lock anti duplo-envio)                       ├ idempotente por labhub_id
                                                      ├ snapshot local_posto
                                                      └ insere ac_agendamentos (status 'recebido')
  ◄──────────────────── { flowlabId } ────────────┘

   get-disponibilidade já desconta os horários agendados (ocupação derivada de ac_agendamentos)  ✅
   AgendamentosPage — operador vê a fila por posto/data  ✅
   PostosPage — gerente cria postos e horários  ✅
```

> Cancelamento: o LAB-HUB tem `POST /api/v1/agendamentos/:id/cancelar` e **propaga ao FlowLab** ✅ — chama `receive-cancelamento` (best-effort, só quando há `flowlab_id`); o FlowLab marca `ac_agendamentos.status = 'cancelado'` e o slot é liberado (ocupação derivada).

---

## Decisões herdadas (relevantes ao agendamento)

| # | Decisão | Impacto |
|---|---------|---------|
| **D3** | Disponibilidade de postos pertence ao FlowLab | **Resolvido:** proxy em tempo real com tabelas dedicadas `ac_postos` + `ac_slots_disponiveis` (`capacidade`/`reservado`). |
| **D5** | Integração como **Vercel Serverless Functions**, não Edge Functions Deno | Rotas em `api/analises-clinicas/*`. Os nomes lógicos (`receive-agendamento`, `get-disponibilidade`) viram segmentos de path. |

> **Ponte entre os repos (D5):** o cliente do LAB-HUB chama `${FLOWLAB_EDGE_FUNCTION_URL}/<fn>`. Para resolver às rotas Vercel, **`FLOWLAB_EDGE_FUNCTION_URL` no LAB-HUB deve apontar para `https://<flowlab>/api/analises-clinicas`** (dev: `http://localhost:3000/api/analises-clinicas`).

---

## Modelo de Dados (somente agendamento)

> **Atualização (agenda recorrente):** a tabela de slots avulsos `ac_slots_disponiveis`
> foi **substituída** por um modelo recorrente em `20260630130000_ac_agenda_recorrente.sql`:
> horários fixos (seg–sáb) + exceções por dia. O `get-disponibilidade` gera a agenda
> a partir disso; não há mais slots materializados.

`ac_postos` e `ac_agendamentos` (de `20260629120000_ac_integracao_labhub.sql`):

```
ac_postos                         ac_agendamentos
├ id (PK, uuid)                    ├ id (PK, uuid)
├ nome     varchar(120)           ├ labhub_id  uuid UNIQUE   ← idempotência do receive
├ endereco text ''                ├ paciente_nome / paciente_telefone
├ ativo    bool true              ├ posto_id   FK→ac_postos (ON DELETE SET NULL)
└ created_at / updated_at         ├ local_posto text          ← snapshot do nome
                                  ├ data_hora  timestamptz
                                  ├ status     text 'recebido'
                                  └ índice (data_hora, local_posto)
```

Agenda recorrente (`20260630130000_ac_agenda_recorrente.sql`):

```
ac_horarios_padrao (base seg–sáb)     ac_dias_excecao (sobreposição por data)
├ id (PK, uuid)                        ├ id (PK, uuid)
├ posto_id  FK→ac_postos (CASCADE)     ├ posto_id  FK→ac_postos (CASCADE)
├ hora      time                       ├ data      date
├ capacidade int default 1             ├ fechado   bool default false
└ UNIQUE(posto_id, hora)               ├ horarios  jsonb [{hora,capacidade}]  (se !fechado)
                                       └ UNIQUE(posto_id, data) + trigger updated_at
```

> Regras aplicadas pelo `get-disponibilidade`: domingo não tem base; uma exceção
> `fechado=true` zera o dia; `fechado=false` troca os horários só naquele dia.
> Capacidade default 1; ocupação descontada de `ac_agendamentos` ativos.

> `ac_resultados` também existe (migration de integração), mas **fica intocada nesta fase** (resultados adiados).

---

## Frente 1 — Corrigir a reserva de slot (backend)

**Problema:** `get-disponibilidade` só mostra slots com `reservado < capacidade`, mas `receive-agendamento` nunca incrementa `reservado`. Resultado: o horário continua "disponível" mesmo depois de agendado, permitindo marcar o mesmo slot repetidamente.

**Abordagem recomendada — derivar a ocupação de `ac_agendamentos`** (fonte única de verdade, e o cancelamento "libera" o slot automaticamente):
- `get-disponibilidade` passa a contar agendamentos ativos (`status <> 'cancelado'`) por `(posto_id, data_hora)` e expõe o slot só enquanto `count < capacidade`.
- Implementar via RPC/`view` no Postgres (ex.: função `ac_slots_com_ocupacao`) para não fazer N+1 no JS, ou um único SELECT agregado.
- Mantém `capacidade` no slot; a coluna `reservado` deixa de ser autoritativa (pode ser removida numa migration ou mantida só por compatibilidade).

**Alternativa — contador atômico:** `receive-agendamento` faz `UPDATE ac_slots_disponiveis SET reservado = reservado + 1 WHERE posto_id = ? AND data_hora = ? AND reservado < capacidade` (só no INSERT novo, nunca no hit idempotente); decrementa no cancelamento. Exige um endpoint de cancelamento (ver dependência) e cuidado com concorrência/idempotência.

**Decisão recomendada:** derivar de `ac_agendamentos` (mais simples e correto para cancelamento). Avaliar uma constraint/lock só se overbooking concorrente virar problema real (capacidade interna é baixa).

**Slot ausente:** como o LAB-HUB valida o slot ao vivo antes de enviar, todo agendamento recebido deveria casar com um slot. Se não casar (drift), **logar warning e ainda inserir o agendamento** (não perder um paciente que passou pela validação do LAB-HUB).

**Dependência (cancelamento): ✅ resolvida.** Liberar o slot ao cancelar exige o FlowLab saber do cancelamento. Com a abordagem derivada, basta o `status` do `ac_agendamentos` virar `cancelado`. Implementado: `POST api/analises-clinicas/receive-cancelamento` (LAB-HUB → FlowLab, autenticado por `FLOWLAB_API_KEY`, idempotente por `labhub_id`) + o `POST /:id/cancelar` do LAB-HUB agora o chama (best-effort, só quando há `flowlab_id`; falha de propagação loga sem derrubar o cancelamento local).

---

## Frente 2 — AgendamentosPage (app FlowLab)

Criar o módulo e a tela onde o operador vê os agendamentos recebidos.

```
src/modules/analises-clinicas/
├── index.ts
├── types/index.ts              # Agendamento, Posto, SlotDisponivel (camelCase; PainelResultado fica p/ depois)
├── hooks/
│   ├── useAgendamentos.ts      # lista ac_agendamentos (RLS: SELECT p/ authenticated)
│   └── usePostos.ts            # lista ac_postos (Frente 3)
├── services/
│   └── AgendamentoService.ts   # leitura de ac_agendamentos (+ filtros posto/data)
└── components/
    ├── AnalisesClinicasLayout.tsx   # casca/nav do módulo (se necessário)
    └── AgendamentosPage.tsx         # lista por posto/data, filtros, status
```

- **Leitura:** o front lê `ac_agendamentos` direto via supabase-js (a migration já liberou `SELECT` para `authenticated`). Não precisa de rota serverless nova para listar.
- **UI:** seguir a identidade visual do projeto (ver skill `flowlab-identity`): cards/tabela, filtros por posto e data, badges de status (`recebido` → e futuros estados quando coletas existirem).
- **Rota + permissão:** registrar `/analises-clinicas/agendamentos` em `src/App.tsx` sob `<ProtectedRoute>` com `canViewAnalisesClinicas`.

---

## Frente 3 — Gestão de postos e agenda recorrente (app FlowLab)

A `PostosPage` (`/analises-clinicas/postos`, permissão `canManageAnalisesClinicas`) dá ao gerente controle em runtime:

- **Postos:** CRUD de `ac_postos` (nome, endereço, ativar/desativar, excluir).
- **Agenda do posto (modal):** dois blocos:
  - **Horários fixos** (`ac_horarios_padrao`): lista de horas que valem **seg–sáb**, com capacidade (padrão 1, opção de aumentar). Adicionar/remover.
  - **Exceções por dia** (`ac_dias_excecao`): para uma data, **fechar o dia** (feriado) ou definir **horários só daquele dia**. Adicionar/remover.
- **Mutação via front + RLS:** o front grava direto via supabase-js; as policies de INSERT/UPDATE/DELETE (admin/operator) estão em `20260630120000` (postos) e `20260630130000` (agenda recorrente).

> Não há mais geração/materialização de slots: o `get-disponibilidade` calcula a agenda dos próximos N dias (env `DISPONIBILIDADE_DIAS`, default 60) a partir da base + exceções, no fuso de Brasília (`AGENDA_TZ_OFFSET`, default `-03:00`).
> Isto destrava o `SchedulePage` real do LAB-HUB: com postos e horários de verdade, a disponibilidade vira dado de produção.

---

## Permissões e Rotas (a adicionar)

| Rota | Componente | Permissão | Estado |
|------|------------|-----------|:------:|
| `/analises-clinicas/agendamentos` | AgendamentosPage | `canViewAnalisesClinicas` | ✅ |
| `/analises-clinicas/postos` | PostosPage | `canManageAnalisesClinicas` | ✅ |

- ✅ Adicionadas `canViewAnalisesClinicas`, `canManageAnalisesClinicas` e `canManageColetas` (Fase 4) a `ALL_PERMISSION_KEYS` em `src/utils/permissions.ts` (grupo "Análises Clínicas"). Pelos legacy roles, admin e operator recebem todas automaticamente (mapeiam `ALL_PERMISSION_KEYS`); requester não. Para usuários em **custom roles de sistema** (Administrador/Operador), o backfill em `20260630140000` as injeta nos arrays seedados. O cargo `analistaSaude` (seed na mesma migration) recebe `canViewAnalisesClinicas` + `canManageColetas`. (Permissão `canLiberarResultados` segue fora — acompanha Resultados.)
- Item de menu "Análises Clínicas" (grupo OPERAÇÕES) com subitens Agendamentos e Postos de Coleta em `src/components/Layout.tsx`.
- A RLS de mutação (admin/operator) está na migration `20260630120000`. Como o sistema também usa permissões de app, a PostosPage é gateada por `canManageAnalisesClinicas`; a RLS é a defesa no banco.

---

## Variáveis de Ambiente — já configuradas

`.env.example` já traz o necessário para o agendamento:

| Variável | Papel |
|----------|-------|
| `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` | Acesso das serverless functions ao banco (service role) |
| `FLOWLAB_API_KEY` | Auth inbound (LAB-HUB → FlowLab); idêntica à do LAB-HUB |
| `LABHUB_API_URL`, `LABHUB_WEBHOOK_SECRET` | Usadas pelo fluxo de **resultados** (adiado) — sem ação agora |

> Do lado do LAB-HUB: garantir `FLOWLAB_EDGE_FUNCTION_URL = …/api/analises-clinicas` (D5).

---

## Fases

> **Concluído:** Fases 0–3 (agendamento) + Fase 4 (fundação de permissões). **A fazer:** Fases 5–8 (operação interna), na ordem abaixo — ordenadas por dependência técnica + valor (jornada do paciente: coleta → análise → KPIs).

### Fase 0 — Integração ✅ (concluída)
- [x] Migration `ac_postos` / `ac_slots_disponiveis` / `ac_agendamentos` (+ RLS, triggers, seed)
- [x] `receive-agendamento` (idempotente) e `get-disponibilidade` (D3)
- [x] Helpers + `.env.example`

### Fase 1 — Consistência de slot ✅
- [x] `get-disponibilidade` deriva ocupação de `ac_agendamentos` (conta agendamentos ativos por `posto_id`+`data_hora` no próprio handler); slot disponível só enquanto `ocupação < capacidade`. Cancelar libera o slot automaticamente.
- [x] Agendamento sem posto não ocupa slot
- [x] (follow-up cruzado) `receive-cancelamento` no FlowLab + propagação do cancelar do LAB-HUB — endpoint `api/analises-clinicas/receive-cancelamento.ts` (idempotente) e `flowlab.receiveCancelamento` ligado ao `POST /:id/cancelar` (LAB-HUB), com testes

### Fase 2 — App: ver agendamentos ✅
- [x] Scaffold `src/modules/analises-clinicas/` (index, types, hooks)
- [x] `AgendamentosPage` (lista por posto/data, filtros, status, tabela/cards responsivos) lendo `ac_agendamentos`
- [x] Rota `/analises-clinicas/agendamentos` + `canViewAnalisesClinicas` + item de menu

### Fase 3 — App: gerir postos + agenda recorrente ✅
- [x] Migration `20260630130000_ac_agenda_recorrente.sql`: dropa `ac_slots_disponiveis`; cria `ac_horarios_padrao` + `ac_dias_excecao` (+ RLS admin/operator, índices, trigger, seed)
- [x] Policies de mutação de `ac_postos` (migration `20260630120000`)
- [x] `get-disponibilidade` reescrito: gera a agenda (base seg–sáb + exceções) no fuso de Brasília, descontando ocupação
- [x] `PostosPage` (CRUD posto + toggle + excluir) com modal de **Agenda**: horários fixos e exceções por dia (fechar/horários especiais), capacidade padrão 1 + rota `/analises-clinicas/postos` + `canManageAnalisesClinicas`

### Fase 4 — Permissões e cargo `analistaSaude` ✅
- [x] Permissão `canManageColetas` em `ALL_PERMISSION_KEYS` (grupo "Análises Clínicas") — `src/utils/permissions.ts`
- [x] **Decisão:** "analista" virou um **cargo de sistema (custom role) `analistaSaude`**, não role legacy. Motivo: o sistema atribui cargos só via custom roles (`UserManagement`/`customRoleId`); a role legacy não tem UI de atribuição (é definida automaticamente: 1º usuário `admin`, demais `requester`), então uma role legacy `analista` seria invasiva (tipo `UserRole`, CHECK constraint, `Record<UserRole>`) **e inerte**. Seed em `20260630140000_ac_role_analista.sql` (`canViewAnalisesClinicas` + `canManageColetas`, sem `canManageAnalisesClinicas`).
- [x] **Backfill** dos cargos de sistema `Administrador`/`Operador` com as 3 permissões de AC (`canViewAnalisesClinicas`, `canManageAnalisesClinicas`, `canManageColetas`) — corrige o gap latente das Fases 2–3 (esses cargos seedados nunca enxergaram o módulo). Mesma migration.
- [ ] (forward-looking) Gatear as páginas operacionais (coleta/recoleta, análise) por `canManageColetas` — **fica para as Fases 6–7**, quando essas páginas existirem. A key já está pronta.

> Fundação barata e que **gateia tudo abaixo** — feita primeiro para evitar retrabalho de permissão.
> `canLiberarResultados` fica fora (acompanha Resultados).

### Fase 5 — Estoque departamental 🔜
> **Plano detalhado:** [`PLANO_FASE5_ESTOQUE_DEPARTAMENTAL.md`](PLANO_FASE5_ESTOQUE_DEPARTAMENTAL.md)

**Redesenho (substitui "`Department.ANALISES_CLINICAS` + categoria `insumos_clinicos`"):** estoque **multi-local plano** — `products.quantity` vira cache do total; saldo por local em `product_stock`; `products.location` (texto livre, hoje "Estoque"/"Depósito"/…) é promovido para `stock_locations`.

- [ ] **Parte A — Fundação:** `stock_locations` (plano) + `product_stock` + `stock_movements` com `from/to` + reescrita do trigger `update_stock_on_movement` + seed/promoção do `location` (migration defensiva)
- [ ] **Parte B — UI mínima:** dropdown de local no form, recebimento (com assinatura), transferência entre locais, saldo por local
- [ ] (fora de escopo) RLS por setor e dashboard departamental → refinamento / Fase 8

> Dependência da coleta: `ac_coleta_insumos` (Fase 6) dá baixa em `stock_movements`, então os locais precisam existir antes.

### Fase 6 — Coleta / recoleta 🔜
> **Plano detalhado:** [`PLANO_FASE6_COLETAS.md`](PLANO_FASE6_COLETAS.md)

**Etapa A — Coletas + baixa (esta rodada):**
- [ ] Migrations `ac_coletas`, `ac_coleta_insumos` (+ RLS, índices, trigger `updated_at`)
- [ ] Baixa de insumos em `stock_movements` ao registrar a coleta, via RPC transacional `registrar_coleta` (reusa o trigger multi-local da Fase 5; origem = estoque do posto)
- [ ] `PainelColetasPage` (fila derivada dos agendamentos `recebido`/`em_coleta`) — insumo por seleção manual
- [ ] Rota `/analises-clinicas/coletas` + gating `canManageColetas`

**Etapa B — Recoletas (adiada):**
- [ ] `ac_recoletas` + `RecoletasPage` + rota `/recoletas` — quando o gatilho da recoleta estiver definido (provável: reprovação na análise, Fase 7)

> Próximo passo após o agendamento e **porta de entrada dos dados** a jusante. A notificação `ac_recoleta` fica fora (WhatsApp fora de escopo).

### Fase 7 — Análise / cultura / temperatura 🔜
- [ ] Migrations `ac_analises`, `ac_culturas`, `ac_temperaturas`, `ac_equipamentos` (+ RLS, índices)
- [ ] Páginas de análise e cultura + monitoramento de temperatura de equipamentos com alertas
- [ ] Rotas + gating

> Camada de **rigor interno** (QC). Vem depois da coleta (analisa-se o que foi coletado) e não bloqueia nada do lado do paciente.

### Fase 8 — Dashboard / KPIs 🔜
- [ ] Widget no dashboard principal + página de KPIs: recoletas, culturas, temperatura/desperdício, produtividade
- [ ] (KPIs de SLA de resultado ficam para quando Resultados entrar no escopo)

> Por último: os KPIs só têm dado depois que coleta/recoleta/análise estão gerando registros.

---

## Requisitos Técnicos (agendamento)

- [x] Rotas serverless em `api/analises-clinicas/*` (D5)
- [x] `receive-agendamento`/`get-disponibilidade` validam `FLOWLAB_API_KEY` (timing-safe)
- [x] Idempotência de `receive-agendamento` (UNIQUE `labhub_id` + corrida 23505)
- [x] RLS + triggers `updated_at` + índices nas tabelas de agendamento
- [x] Disponibilidade reflete agendamentos ativos (Frente 1)
- [x] Policies de mutação para gestão de postos/slots (Frente 3)
- [x] Dados pessoais do paciente (nome, telefone) não logados — auditado: `receive-agendamento`, `get-disponibilidade` e `receive-cancelamento` só logam mensagens de erro (nunca nome/telefone)
- [x] Comunicação entre sistemas apenas server-to-server

---

## Pendências / atenção

- ~~**Bug ativo:** disponibilidade não decresce após agendar~~ ✅ corrigido (ocupação derivada de `ac_agendamentos`).
- ~~**Cancelamento cruzado:** liberar slot ao cancelar depende de propagação LAB-HUB → FlowLab~~ ✅ feito: `receive-cancelamento` no FlowLab + `POST /:id/cancelar` do LAB-HUB chamando `flowlab.receiveCancelamento`. A propagação é **best-effort** (só quando há `flowlab_id`); se o FlowLab estiver fora, o cancelamento local é mantido e a falha é logada — não há retry automático (eventual reconciliação fica como melhoria futura, não bloqueante).
- ~~**Aplicar as migrations:** `20260630120000` e `20260630130000`~~ ✅ já aplicadas.
- **Config cruzada:** `FLOWLAB_EDGE_FUNCTION_URL` do LAB-HUB → `…/api/analises-clinicas` (dev: `http://localhost:3000/api/analises-clinicas`).
- **Fora de escopo:** arquivos não-rastreados de provisionamento de usuário (`api/users/*`, `_lib/{createUser,googleWorkspace,email}.ts`, `NewUserForm.tsx`, `cpf.ts`, migration `…_add_user_contact_fields.sql`) são de outra feature.

---

## Fora de escopo

Deliberadamente fora do escopo do projeto (retomar só se a prioridade mudar):

- **Resultados:** `ac_resultados` (já existe) + `deliver-resultado` (já existe, sem UI) + `LiberacaoResultadosPage` + permissão `canLiberarResultados`. A liberação e a entrega do resultado ao paciente passam pelo portal do LAB-HUB.
- **Notificação WhatsApp:** templates `ac_agendamento_confirmado`, `ac_recoleta` e `ac_resultado_disponivel` via MessagingService (WAHA), disparados nos respectivos eventos.
- **Reconciliação `ac_resultados` ↔ `ac_analises`:** hoje `ac_resultados.agendamento_id` aponta direto ao agendamento; religar à análise (Fase 7) só faz sentido quando Resultados entrar no escopo.

---

*Referências: `LAB-HUB/docs/ARQUITETURA_ANALISES_CLINICAS.md` · `LAB-HUB/docs/FLUXO.md` · `LAB-HUB/docs/ANALISES_CLINICAS.md` · Plano do LAB-HUB: `LAB-HUB/docs/PLANO_ANALISES_CLINICAS.md`*
