# Reunião 1 — Backlog (Feito × A Fazer)

> Documento derivado da reunião com o cliente. Mapeia cada ponto discutido ao estado
> real do código no FlowLab (branch `feat/coleta-status-callback`).
> **Legenda:** ✅ Feito · 🚧 Parcial · ⬜ A fazer · ℹ️ Informativo (não é desenvolvimento)
>
> Referência técnica: `docs/PLANO_FLOWLAB_ANALISES_CLINICAS.md` (plano mestre) e planos das Fases 5–8.

---

## Resumo executivo

| # | Tópico | Estado |
|---|--------|:------:|
| 1 | Ajustes no Módulo de Agendamento (conferência, documentos, convênio) | 🚧 Parcial *(documentos ✅; falta conferência opcional + 24h)* |
| 2 | Notificações via WhatsApp | ⬜ A fazer |
| 3 | Módulo de Culturas e Suabe | 🚧 Parcial *(status ✅ · suabe dispensado · cultura avulsa construída, falta aplicar migration)* |
| 4 | Módulo de Equipamentos e Temperatura | ✅ Feito |
| 5 | Agenda de Posto (horários de coleta) | ✅ Feito *(nesta branch — falta merge/deploy)* |
| 6 | Dashboard e Indicadores | 🚧 Parcial |
| 7 | Acesso dos Colaboradores (logins individuais) | ✅ Feito *(config de prod dispensada por ora)* |
| 8 | Reunião com a Shift | ℹ️ Informativo |
| 9 | Modelo de Evolução (MVP / melhoria contínua) | ℹ️ *(preview no ar + Slack ✅; falta promover a produção)* |

---

## 1. Ajustes no Módulo de Agendamento 🚧

> Este item se divide por repositório: a **captura** de documentos e o **convênio** são do
> portal do paciente (**LAB-HUB**); a **exibição/conferência** é do **FlowLab**.

**Documentos (RG/identidade, carteirinha do convênio, pedido médico)** — ✅ Feito (nos dois repos)
- ✅ **LAB-HUB (captura/upload):** módulo de documentos do paciente com upload implementado
  (`identidade | carteirinha | pedido_medico | outro`) — commits `88b9bc0`, `0850b71`,
  `0f0f1ff`, `3b53424` (`DocumentCard`, `useDocumentos`, timeline de coleta).
- ✅ **FlowLab (exibição na conferência):** proxy `api/analises-clinicas/get-documentos.ts` +
  `useDocumentosAgendamento.ts` + `DocumentoThumb`/`DocumentoLightbox`; tipos espelhados em
  `types.ts` (`TipoDocumento`).

**Seletor de convênio (lista dos atendidos) + upload da carteirinha** — 🚧 Parcial (LAB-HUB)
- ✅ Tipo `Convenio` no `packages/shared` e uso em `ProfilePage`/`DocumentsPage`; carteirinha
  é um tipo de documento com upload.
- 🔎 **A validar:** se o seletor apresenta a **lista dos convênios atendidos** (cadastro/lista
  fechada) ou é campo livre. Se não houver a lista dos atendidos, falta modelá-la.

**Anexo do pedido médico + antecedência de 24h para autorização do convênio** — ⬜ A fazer
- O pedido médico já é um tipo de documento com upload/exibição, mas **não há** o tratamento
  da regra de solicitar autorização ao convênio com **24h de antecedência** (nem alerta/
  destaque para isso no fluxo).

**Itens da conferência não obrigatórios** — ⬜ A fazer (FlowLab)
- Hoje o checklist de recepção é **fixo com 5 itens** (`CHECKLIST_RECEPCAO` em
  `src/modules/analises-clinicas/types.ts`): Identidade, Guia do convênio, Pedido médico,
  Preparo/jejum, Termo de coleta.
- A liberação da coleta hoje **exige todos os itens marcados**
  (`todosOk = checked.size === CHECKLIST_RECEPCAO.length`; botão "Liberar coleta" fica
  `disabled` até completar — `PainelColetasPage.tsx:492,708`).
- **Falta:** tornar alguns itens opcionais (não bloquear a liberação).
  ⏳ **Depende da lista da Marina** de quais itens deixam de ser obrigatórios.

---

## 2. Notificações de Pacientes via WhatsApp ⬜

- ✅ **Infra existe:** módulo de messaging com provider WAHA
  (`src/modules/messaging/` — `MessagingService`, `WAHAProvider`), já usado em cotações.
- ⬜ **A fazer (todas as 3 notificações):**
  - Notificação **imediata** confirmando o agendamento.
  - Notificação **24h antes** da coleta: "Você confirma? Sim ou Não?" (verificar interesse).
  - Notificação automática de **recoleta**: mensagem **genérica** ("foi solicitada recoleta
    para conclusão do laudo"), **sem** citar o motivo (ex.: hemólise).
- ⚠️ Hoje está **explicitamente fora de escopo** no plano mestre (seção "Fora de escopo").
  Entrar em escopo exige: templates AC, gatilhos nos eventos (agendamento criado /
  agenda-D1 / recoleta) e agendamento temporizado da mensagem de 24h.
- 🔗 A notificação de recoleta depende também de **definir o gatilho da recoleta** (ver item 3
  / Fase 6 Etapa B, hoje adiada).

---

## 3. Módulo de Culturas e Suabe 🚧

**Acompanhamento manual por status** — ✅ Feito
- ✅ `CulturasPage.tsx` já faz acompanhamento **manual** (molde da Temperatura): etapa,
  status, nota, resultado e prazo. Migrations `20260709131000_fase7a_culturas.sql` e
  `20260710120000` (rename da etapa final).
- ✅ **Nomenclatura de status ajustada** para o combinado na reunião: **Em andamento ·
  Positivada · Concluída** — rótulos em `types.ts` (`STATUS_CULTURA`), KPIs de `CulturasPage`
  e gráfico "Culturas por status" de `IndicadoresPage`. As **chaves de banco**
  (`positiva`/`pronta_laudo`) foram mantidas → sem migration nem impacto em dados existentes.

**Botão "+" para cadastrar cultura SEM vínculo obrigatório com a coleta** — ✅ Construído (16/Jul) · ⬜ falta aplicar migration + drive
- ✅ Botão **"Nova cultura"** na `CulturasPage` abre um modal de cadastro **avulso** (sem
  `agendamento_id`): tipo de cultura (catálogo `is_cultura` + "Outro" texto livre), paciente e
  posto opcionais, prazo e nota.
- ✅ Migration `20260716120000_ac_culturas_avulsa.sql` torna `ac_culturas.agendamento_id`
  **nullable**; hook `useCulturas.createCultura` grava a avulsa (RLS de INSERT já permitia).
- ⬜ **Falta:** aplicar a migration no ambiente de test/produção e validar o fluxo na UI
  (build e typecheck já passam localmente).

**Suabe como tipo de cultura (meio diferente)** — ✅ Não necessário
- Decisão do cliente (16/Jul): **não precisa** adicionar/renomear "Suabe" como tipo próprio —
  os tipos de cultura já existentes atendem. Item encerrado.

---

## 4. Módulo de Equipamentos e Temperatura ✅

- ✅ **Cadastro de equipamentos** com tipo, localização e faixa [mín, máx]
  (`ac_equipamentos`: `tipo`, `localizacao`, `temp_min`, `temp_max` —
  migration `20260709120000`).
- ✅ **Registro de temperatura** append-only, **em qualquer momento e múltiplas vezes por
  dia** (`ac_temperaturas`).
- ✅ **Alerta visual quando fora do intervalo:** `fora_faixa` derivado por trigger; a página
  `TemperaturaEquipamentosPage.tsx` mostra situação normal/no limite/fora, sparkline e
  header-resumo com indicadores.
- ⬜ **Sugestão futura** (não é para agora): termômetros inteligentes integrados ao sistema.

---

## 5. Agenda de Posto (Horários de Coleta) ✅

Implementado nesta branch (`feat/coleta-status-callback`) — falta apenas merge/deploy.

- ✅ Modal com **horário início → horário fim → intervalo entre atendimentos** (ex.: a cada
  15 min) — `PostosPage.tsx` (`agenda_hora_inicio`, `agenda_hora_fim`, `agenda_intervalo_min`;
  `contarHorarios()` gera a grade).
- ✅ **Seletor de dias da semana** (domingo a sábado) — `agenda_dias_semana`.
- ✅ **Exceções/bloqueios por dia** (ex.: feriados) — bloqueia agendamentos na data.
- Migration `20260714120000_ac_agenda_grade_horarios.sql` (grade de horários + bloqueios).
- ⬜ **Pendente:** merge para `main` e deploy em produção.

---

## 6. Dashboard e Indicadores 🚧

- ✅ **Página de Indicadores** construída (Fase 8, Etapa 1) — `IndicadoresPage.tsx`,
  rota `/analises-clinicas/indicadores`, seletor 7/30/90 dias + intervalo personalizado. Já entrega:
  - Total de agendamentos, coletas realizadas, conversão e cancelamentos.
  - **Gráfico agendamentos × coletas** ao longo do tempo + produtividade por posto.
  - **Culturas por status.**
  - **Exames mais pedidos.**
  - **Alertas de temperatura** (% fora de faixa / excursões).
- ✅ **Alertas de insumos abaixo do mínimo** — KPI de contagem ("Insumos < mín.") + linha no
  card "Alertas do processo", **por local** (posto). Usa o **mínimo por local**
  (`product_stock.min_stock`), editável no **Estoque Departamental**, incluindo insumos **zerados**.
  - Migration `20260716130000_product_stock_min_local.sql` adiciona o mínimo por local.
  - Corrige de quebra o badge "Estoque baixo" do Estoque Departamental, que comparava a fatia
    do local contra o mínimo **global** do produto (falso-positivo).
- ⬜ **Falta no painel:**
  - **Recoletas pendentes** — depende da Fase 6 Etapa B (recoleta) + gatilho a definir.
  - **Registro de desperdício/consumo de insumos** — hoje **sem fonte de dado**
    (exige marcar a baixa como desperdício no modelo).
- 🔎 Falta ainda: drive visual final + deploy.

---

## 7. Acesso dos Colaboradores ao FlowLab ✅

- ✅ **Login individual** por colaborador, com provisionamento automatizado
  (`api/users/create.ts` → `api/_lib/createUser.ts`):
  - Cria usuário, completa perfil e envia e-mail de boas-vindas com senha temporária.
- ✅ **Dados de cadastro:** nome, **CPF** (com validação), **data de nascimento** e **cargo**
  (via custom role / `custom_role_id`) — `createUser.ts`.
- ✅ **Alias de e-mail** criado no **Google Workspace** (Admin SDK Directory API,
  `api/_lib/googleWorkspace.ts` — `buildAliasEmail`, `createUserAlias`), direcionado à caixa
  do setor. E-mail de boas-vindas inclui o alias e o link do Slack.
- ✅ **Config de produção dispensada por ora** (decisão do cliente, 16/Jul — "colaborador não
  precisa"). Quando for ativar em produção, restam as variáveis `GOOGLE_ALIAS_*` + service
  account com domain-wide delegation (limite de **30 aliases por caixa**, operacional da TI).

---

## 8. Reunião com a Shift ℹ️

Não é item de desenvolvimento. Registro:
- Reunião com a Shift (patologia, biomol, análises clínicas) avaliada positivamente.
- Próxima: apresentar o projeto a representantes de todos os setores + diretoria.
- **Louise** = representante do laboratório na reunião.

---

## 9. Modelo de Evolução do Sistema (MVP e Melhoria Contínua) ℹ️

- ℹ️ Sistema atual é um **MVP** (substitui planilhas); evolução por melhoria contínua e
  entregas incrementais.
- ✅ **Containerização** para deploy no VPS já feita (Docker — SPA + API, commit `76b702b`).
- ✅ **Sistema no ar em preview** (16/Jul) — publicado, ainda em ambiente de preview.
- ✅ **Canal no Slack criado** para comunicação, bugs e melhorias.
- ⬜ **Pendente:** promover **preview → produção definitiva** e enviar o link à equipe.
  *(Nota: a Fase 5 — estoque departamental — ainda está marcada como "a fazer: deploy em
  produção" no plano; entra nesse cutover.)*

---

## Próximos passos sugeridos (ordem prática)

> Atualizado em 16/Jul após decisões do cliente. **Já resolvidos:** nomenclatura de status
> das culturas (1.3 ✅), cultura avulsa / botão "+" (3a ✅), alerta de insumos abaixo do mínimo
> (item 6 ✅ — corrigido p/ comparação global), Suabe dispensado, canal Slack criado, preview no
> ar, config de colaborador dispensada.

1. **Convênio (item 1b/1c):** validar o seletor (lista dos atendidos) e a regra de 24h.
2. **Conferência opcional (item 1a):** aguardando a lista da Marina.
3. **Gatilho de recoleta (Fase 6B):** destrava o KPI de recoletas pendentes (item 6) e a
   notificação de recoleta (item 2).
4. **WhatsApp (item 2):** decidir entrada em escopo (confirmação imediata → lembrete 24h →
   recoleta).
5. **Promover preview → produção definitiva (item 9)** + cutover da Fase 5 + merge da agenda
   de posto (item 5).
