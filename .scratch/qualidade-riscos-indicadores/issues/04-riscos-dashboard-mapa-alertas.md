# 04 — Riscos: dashboard, mapa por setor e alertas

**What to build:** um usuário abre o dashboard da aba Riscos e vê: cards
(totais por classificação, planos de ação pendentes/vencidos, riscos
aguardando reavaliação, contingências ativas), filtros (período, setor,
processo, classificação, status, responsável), gráfico por setor e gráfico
de distribuição por classificação — mais um mapa tabular de riscos por
setor (Processo | Risco | P | S | Nível | Status), voltado para uso em
auditoria. Quatro tipos de alerta aparecem calculados na leitura: risco
crítico sem plano de ação, ação vencida, risco aguardando reavaliação
(plano concluído sem reavaliação posterior) e contingência com teste a
vencer (janela configurável, default 20 dias).

Nenhuma regra de alerta chama `new Date()`/`NOW()` internamente — a data de
referência é sempre passada como argumento explícito pelo client de dados,
para os alertas ficarem determinísticos e testáveis (mesmo princípio já
usado em `periodoParaIntervalo` deste módulo). Não há motor de notificação
(email/push) — os alertas são só os cards/consultas do dashboard.

Referência de implementação completa: projeto de origem
`Flowlab_Controle_Qualidade`, branch `main`, commit `d78e375` —
`domain/riscosAlertas.ts` (+ 225 linhas de teste, dá pra portar caso a
caso), `components/riscos/RiscosDashboardPage.tsx`,
`components/riscos/MapaRiscosPorSetorPage.tsx`.

**Blocked by:** 01, 02, 03.

**Status:** done

- [x] Nenhuma regra de alerta chama `new Date()` internamente.
- [x] Os 4 tipos de alerta batem contra dados de teste conhecidos.
- [x] Mapa por setor filtra corretamente por setor.
- [x] `npx tsc --noEmit` e `npm test` sem erros novos.

## Comments

Implementado com `domain/riscosAlertas.ts` (puro, `hoje` como argumento
explícito — nunca `new Date()` internamente) + `RiscosDashboardPage.tsx` +
`MapaRiscosPorSetorPage.tsx`. Reestruturado o roteamento: `/qualidade/riscos`
passa a ser o dashboard (issue), `/qualidade/riscos/matriz` a antiga página
de cadastro/matriz, `/qualidade/riscos/mapa` o mapa por setor.

Revisão automatizada (`/code-review`) encontrou e corrigiu, todos dentro do
código novo desta issue:
- `buscarIndicadoresRiscos`: o filtro por responsável escondia o alerta
  "crítico sem plano" (risco sem plano nunca casa com `.some()` por
  responsável) — alertas agora são calculados sobre o histórico completo;
  só os cards/gráficos respeitam o filtro de responsável.
- Mesmo filtro: "plano de ação pendente" contava planos de *todos* os
  responsáveis do risco, não só do filtrado — agora usa só os planos do
  responsável selecionado.
- `listarRiscos`: `criado_em` é `timestamptz`, e o filtro `fim` comparava
  direto com `'YYYY-MM-DD'`, truncando para meia-noite e excluindo riscos
  criados mais tarde no último dia do período.
- `RiscosDashboardPage`: chave da lista de alertas podia colidir (dois
  alertas do mesmo risco); filtro de texto "Processo" agora tem debounce de
  350ms (mesmo padrão de `TitulosList.tsx`), evitando refetch a cada tecla.

Índice `idx_qa_riscos_setor_id` adicionado à migration desta issue (setor é
filtro/agregação constante no dashboard e no mapa).

Fora do escopo desta issue, sinalizado mas não corrigido: gap de RLS em
storage de evidências (issues 02/03) e falta de validação de enum em
`riscosClassificacao.ts` (issue 01) — ambos em código já commitado de
issues anteriores.
