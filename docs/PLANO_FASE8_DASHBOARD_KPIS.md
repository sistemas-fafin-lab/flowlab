# Fase 8 — Dashboard / Indicadores (KPIs) de Análises Clínicas

> **Status:** 🔜 **A fazer** (nenhum código ainda). Última fase do escopo de operação interna.
> **Plano mestre:** `docs/PLANO_FLOWLAB_ANALISES_CLINICAS.md` (§Fase 8). Este documento detalha e **prevalece** para a Fase 8.
> **Depende de:** Fases 5–7 ✅ (as tabelas que geram dado já existem e estão no ar): `ac_agendamentos`, `ac_checkins`, `ac_coletas`, `ac_agendamento_exames`, `ac_culturas`, `ac_temperaturas`, `ac_equipamentos`.
> **Criado em:** 10/Jul/2026.

---

## 0. Objetivo

Dar ao **gestor/analista** uma leitura consolidada da operação do laboratório: produtividade da coleta, andamento das culturas e rigor de temperatura (QC). Os dados já são gerados pelas Fases 6–7; falta **agregá-los e exibi-los**.

Entregáveis:
1. **Página de Indicadores** dentro do módulo Análises Clínicas (`/analises-clinicas/indicadores`) — o deliverable **principal**.
2. **Widget-resumo** (opcional, secundário) — ver §5 para a ressalva importante sobre onde ele vive.

---

## 1. ⚠️ Realidade dos dados — o que dá e o que **não** dá para medir

O plano mestre lista 4 famílias de KPI (**recoletas, culturas, temperatura/desperdício, produtividade**). Ao cruzar com o schema real, **duas não têm fonte**:

| KPI do plano mestre | Fonte de dado | Situação |
|---|---|---|
| **Produtividade** (coleta) | `ac_agendamentos`, `ac_coletas`, `ac_checkins`, `ac_agendamento_exames` | ✅ **tem dado** |
| **Culturas** | `ac_culturas` (+ `ac_cultura_etapas`) | ✅ **tem dado** |
| **Temperatura** | `ac_temperaturas`, `ac_equipamentos` | ✅ **tem dado** |
| **Recoletas** | `ac_recoletas` | ❌ **tabela não existe** — Fase 6 Etapa B adiada e **gatilho ainda a redefinir** |
| **Desperdício** | — | ❌ **sem fonte hoje** — definido pelo cliente como **insumo baixado/destinado que não foi efetivamente usado** (foi desperdiçado); o modelo atual **não distingue** "insumo consumido útil" de "desperdiçado" |

**Decisão de escopo (fechada com o usuário — 10/Jul):** a Fase 8 v1 entrega **Produtividade + Culturas + Temperatura**. **Recoletas** e **Desperdício** ficam **fora da v1** (o cliente confirmou que nenhum dos dois é necessário agora) e entram como *placeholders* explícitos, não como KPI vazio que finge ter dado.
- **Recoletas** só destrava quando a Fase 6B existir (e ela depende de **definir o gatilho** — amostra inviável no check-in? solicitação do apoio?). Ver §2 decisão D1.
- **Desperdício = insumo desperdiçado** (baixado mas não usado). Fonte futura: hoje a baixa de insumo (`ac_coleta_insumos` → `stock_movements` `internal-consumption`) **não separa** o que foi aproveitado do que foi jogado fora. Medir isso exigiria **marcar a baixa como desperdício** (novo flag/`reason` ou uma quantidade "desperdiçada" na baixa) — trabalho de modelo, não só de dashboard. Ver §2 decisão D2.

> **SLA de resultado fica fora** (Resultados é fora de escopo do projeto — o laudo sai pelo LAB-HUB). Já registrado no plano mestre.

---

## 2. Decisões a confirmar (com o usuário)

| # | Decisão | Recomendação |
|---|---|---|
| **D1** | **Recoleta** entra na Fase 8? | ✅ **Resolvido: não na v1** (cliente confirmou não ser necessário agora). Placeholder "aguardando Fase 6B". |
| **D2** | O que é **"desperdício"** operacionalmente? | ✅ **Resolvido: definido, mas fora da v1.** É **insumo baixado que não foi usado** (desperdiçado). Cliente confirmou não ser necessário agora; medir exige marcar a baixa como desperdício no modelo (§1). |
| **D3** | **Onde vive** o resumo? | **Página dedicada no módulo AC** como principal. Widget no dashboard principal é **secundário** — e tem a ressalva de §5 (operator/analista não veem o dashboard principal). |
| **D4** | **Permissão** da página de Indicadores | **Reusar `canViewAnalisesClinicas`** (sem nova chave — segue o padrão da Fase 7 de não criar keys à toa). Alternativa: nova `canViewAnalisesKPIs` só se o gestor quiser esconder de quem opera. |
| **D5** | **Agregação** client-side ou no banco? | **Client-side na v1** (consistente com CulturasPage/TemperaturaPage, sem migration). Escalar para RPC/view SQL só se o volume crescer (§7). |
| **D6** | **Janela de tempo** padrão dos gráficos | 30 dias, com seletor 7/30/90 (espelha o padrão do `Dashboard.tsx`, que já usa `7 | 15 | 30 | custom`). |

> D1 e D2 estão **fechadas** (ambas fora da v1). As demais têm default seguro e não bloqueiam começar → **a Etapa 1 (§11) pode iniciar já.**

---

## 3. KPIs propostos (v1 — só o que tem dado)

Cada métrica abaixo é **derivável hoje** das tabelas existentes.

### 3.1 Produtividade / Coleta
- **Volume de agendamentos** no período (`ac_agendamentos` por `data_hora`), série diária (entradas).
- **Coletas realizadas** no período (`ac_coletas.coletado_em`).
- **Taxa de conversão** recebido → coletado (coletas ÷ agendamentos não-cancelados).
- **Taxa de cancelamento** (`status = 'cancelado'` ÷ total).
- **Recepção — % com problema** (`ac_checkins.resultado = 'problema'`) + **quebra por item** (`problema_em`: identidade/guia/pedido_medico/jejum/termo) — barra empilhada.
- **Volume por posto** (`local_posto`) — ranking.
- **Exames mais solicitados** (`ac_agendamento_exames.exame_nome`, top N) — barra.
- **Qualidade da amostra:** % `validade_ok` e % `etiquetado` nas coletas (`ac_coletas`).

### 3.2 Culturas
- **Distribuição por status** (Em andamento / Positiva / Laudo concluído) — donut. *(Reusa `STATUS_CULTURA` de `types.ts`.)*
- **% positividade** = positivas ÷ (encerradas). Já computado hoje na `CulturasPage`; consolidar aqui.
- **Atrasadas** = `now > iniciada_em + prazo_dias` e ainda não concluída (métrica acionável — o prazo padrão é sempre 5).
- **Abertas no período** (`iniciada_em`) — tendência.

### 3.3 Temperatura / QC
- **% de leituras fora de faixa** no período (`ac_temperaturas.fora_faixa`).
- **Excursões por equipamento** (top ofensores) — barra, `group by equipamento_id`.
- **Compliance de registro:** equipamentos ativos **com** vs **sem** leitura recente (janela configurável) — expõe equipamento esquecido.
- **Última leitura fora de faixa** (alerta/lista curta).

### 3.4 Placeholders (fora da v1 — não medir agora)
- **Recoletas** → card "aguardando Fase 6B (gatilho a definir)".
- **Desperdício** → card "aguardando marcação de baixa como desperdício" (insumo baixado mas não usado — §1/D2).

---

## 4. Fonte por métrica (mapa técnico)

| Métrica | Tabela | Colunas-chave |
|---|---|---|
| Volume / cancelamento | `ac_agendamentos` | `data_hora`, `status`, `local_posto` |
| Coletas / conversão / qualidade amostra | `ac_coletas` | `coletado_em`, `validade_ok`, `etiquetado`, `posto_id` |
| Recepção (problemas) | `ac_checkins` | `resultado`, `problema_em`, `conferido_em` |
| Mix de exames | `ac_agendamento_exames` | `exame_nome`, `is_cultura`, `created_at` |
| Culturas | `ac_culturas` | `status`, `etapa_ordem`, `iniciada_em`, `prazo_dias` |
| Temperatura | `ac_temperaturas` | `fora_faixa`, `registrado_em`, `equipamento_id` |
| Equipamentos | `ac_equipamentos` | `ativo`, `nome`, `tipo` |

> Todas têm **RLS permissiva por `authenticated`** (SELECT liberado) — o front lê direto via supabase-js, como as páginas de Culturas/Temperatura já fazem. Nenhuma migration nova é necessária para a v1.

---

## 5. Arquitetura — onde o resumo vive (⚠️ ponto de atenção)

**Constatação:** o dashboard principal (`src/components/Dashboard.tsx`) é gated por **`canViewDashboard`**, que os legacy roles **`operator` e `requester` NÃO têm** (`permissions.ts` remove `canViewDashboard` do operator) e o cargo **`analistaSaude` também não tem**. Ou seja: **quem opera o laboratório não enxerga o dashboard principal.** Colocar o resumo de AC *só* lá o esconderia exatamente do público-alvo.

**Conclusão:**
- **Principal → Página de Indicadores no módulo AC** (`/analises-clinicas/indicadores`), gated por `canViewAnalisesClinicas`. É onde analista e gestor chegam.
- **Secundário/opcional → Widget no `Dashboard.tsx`** só para admin (que tem `canViewDashboard`). Custo real: o dashboard usa `react-grid-layout` com `DEFAULT_LAYOUTS` + `localStorage` versionado (`flowLab_dashboard_layout_v6`); adicionar um widget exige **entrada no layout + bump da chave para `v7`** (senão o layout salvo do usuário não mostra o card novo). Por isso o widget é **fase 2 do trabalho**, não bloqueante.

---

## 6. Permissões e rotas

| Rota | Componente | Permissão | Nav |
|---|---|---|---|
| `/analises-clinicas/indicadores` | `IndicadoresPage` | `canViewAnalisesClinicas` (D4) | subitem "Indicadores" no grupo "Análises Clínicas" |

Pontos de edição (mesmos da Fase 7):
- `src/App.tsx` — import + `<Route>` sob `<ProtectedRoute permission="canViewAnalisesClinicas">`.
- `src/components/Layout.tsx` — subitem no grupo AC (linha ~617–621), incluir a rota no mapa de breadcrumb (linha ~460) e garantir que o `anyOf` do grupo já cobre (`canViewAnalisesClinicas` já está lá).
- `src/modules/analises-clinicas/index.ts` — exportar `IndicadoresPage`.
- **Sem migration de permissão** (reuso de `canViewAnalisesClinicas`, que admin/operator/analistaSaude já possuem via backfill da Fase 4).

---

## 7. Frontend

```
src/modules/analises-clinicas/
├── hooks/
│   └── useAcIndicadores.ts   # busca os recortes e devolve os agregados já prontos
└── components/
    └── IndicadoresPage.tsx    # header-resumo (tiles) + grade de gráficos + seletor de período
```

- **`useAcIndicadores`** — um hook que faz alguns SELECTs enxutos (idealmente **filtrados por data no servidor** — `.gte('data_hora', desde)` — para não puxar histórico inteiro) e devolve os agregados calculados em memória (`useMemo`). Espelha o estilo de `useTemperaturas`/`useCulturas`.
- **`IndicadoresPage`** — seguir a identidade visual (skill **`flowlab-identity`**): header-resumo com **stat tiles** (padrão já usado em `CulturasPage`/`TemperaturaEquipamentosPage`), seletor de período (7/30/90, D6), e uma **grade de gráficos**.
- **Gráficos com `recharts`** (já é dependência — o `Dashboard.tsx` usa). **Antes de escrever qualquer gráfico, carregar a skill `dataviz`** (paleta acessível light/dark, escolha de forma). Reaproveitar `CHART_COLORS`/`CHART_COLORS_DARK` e o padrão theme-aware (`useTheme`) do `Dashboard.tsx`.
- **Placeholders (D1/D2):** cards "Recoletas" e "Desperdício" renderizam um estado vazio explícito (ícone + "aguardando Fase 6B" / "fonte a definir"), nunca um número falso.

### 7.1 Escalonamento (se o volume crescer)
Puxar todas as linhas para o cliente é aceitável no volume de um lab pequeno (mesma premissa das páginas atuais). Se virar problema, criar **RPCs de agregação** (`SECURITY INVOKER` bastam — o SELECT é liberado por RLS) ou **views** que retornem contagens por dia/status, e o hook passa a lê-las. Não fazer isso na v1 sem necessidade medida.

---

## 8. Escopo / não-escopo

**Na v1:** Produtividade + Culturas + Temperatura (§3.1–3.3), página dedicada, leitura client-side.

**Fora da v1:**
- **Recoletas** (depende da Fase 6B + gatilho — D1).
- **Desperdício** = insumo baixado mas não usado; depende de marcar a baixa como desperdício no modelo (D2).
- **Widget no dashboard principal** (fase 2 do trabalho, §5).
- **SLA de resultado** (Resultados é fora de escopo do projeto).
- **Export/PDF dos indicadores**, drill-down por paciente, alertas automáticos — refinamento futuro.
- **RLS por setor / dashboard departamental** de estoque (já listado como refinamento na Fase 5).

---

## 9. Verificação

1. **Type-check/lint** sem novos erros (ignorar os pré-existentes de IT/quotations/Postos).
2. **Sem migration** na v1 → nada a aplicar no banco; a página lê tabelas existentes.
3. **Dados reais (ambiente test):** com agendamentos/coletas/culturas/temperaturas semeados, cada tile e gráfico bate com uma contagem conferida à mão (ex.: culturas positivas na página = `SELECT count(*) ... status='positiva'`).
4. **Período:** trocar 7/30/90 recomputa e nenhum gráfico quebra com dataset vazio.
5. **Permissão:** usuário com `canViewAnalisesClinicas` vê a página; sem ela, `AccessDenied`. Item de menu aparece só para quem tem a permissão.
6. **Placeholders** de Recoleta/Desperdício aparecem como estado vazio, não como `0` enganoso.
7. **Tema:** gráficos legíveis em light e dark (reuso do padrão do `Dashboard.tsx`).

---

## 10. Riscos & mitigação

- **KPI sem fonte** (recoletas/desperdício) — mitigado tornando-os placeholders explícitos; não prometer número que não existe.
- **Puxar histórico inteiro** para o cliente — mitigado filtrando por data no SELECT; escalar para agregação SQL só sob necessidade (§7.1).
- **Widget no dashboard principal invisível ao operador** — mitigado priorizando a página do módulo (§5); widget é opt-in para admin.
- **`desperdício` mal definido** vira métrica enganosa — mitigado exigindo D2 antes de qualquer card.

---

## 11. Faseamento sugerido do trabalho

1. **Etapa 1 (núcleo):** ✅ **construída (10/Jul).** `useAcIndicadores` + `IndicadoresPage` (`/analises-clinicas/indicadores`, `canViewAnalisesClinicas`) com **6 tiles** (agendamentos, coletas, conversão, cancelamento, culturas ativas, temp. fora de faixa) + **5 gráficos** (produtividade agendamentos×coletas por dia · culturas por status donut · excursões de temperatura por equipamento · exames mais solicitados · motivos de bloqueio na recepção) + seletor 7/30/90 + rota/nav/breadcrumb. Placeholders de Recoleta/Desperdício em estado vazio explícito. `tsc`/`eslint` limpos nos arquivos novos; `vite build` OK. **Falta:** drive visual contra o banco de test + deploy.
   - **Etapa 1b (13/Jul — do mockup do time):** adicionados **"Alertas do processo"** (lista "exigem ação agora": temperatura fora de faixa por equipamento · culturas atrasadas · insumo abaixo do mínimo · recepção bloqueada · validade de insumo próxima/vencida — ordenados por severidade, estado vazio "tudo em dia") e **"Produtividade por posto"** (coletas concluídas ÷ agendadas por posto, barras horizontais, meta 80% — mesmo critério do `PostoCard` de `AgendamentosPage`). **Recoleta ficou de fora** do card de alertas (sem tabela `ac_recoletas` — D1). ⚠️ **Nota de escopo:** os alertas de insumo (mínimo/validade) **cruzam para o módulo de estoque** (`stock_locations`/`product_stock`/`products`, todos com RLS `SELECT` liberado p/ `authenticated`) — extensão consciente do §8, que só previa Produtividade+Culturas+Temperatura. `tsc`/`eslint`/`vite build` limpos.
   - **Etapa 1c (13/Jul — D6):** seletor de período ganhou **"Personalizado"** (dois `input type="date"` De/Até, espelhando o `Dashboard.tsx`). O hook `useAcIndicadores` passou de `desdeDias: number` para `(desde, ate)` ISO, com limite superior (`.lte`) em todas as consultas com janela; a página deriva o intervalo (preset OU datas) num `useMemo` estável — `ate` só recomputa ao trocar preset/datas, evitando refetch em loop. A série diária agora itera do início ao fim do intervalo (não mais "últimos N dias fixos"). Culturas/insumos seguem estado atual (sem filtro de data). `tsc`/`eslint`/`vite build` limpos.
2. **Etapa 2 (opcional):** widget-resumo no `Dashboard.tsx` para admin (bump `localStorage` → `v7`).
3. **Etapa 3 (destravável depois):** cards de Recoleta (após Fase 6B) e Desperdício (após D2).
