# Gastos de TI — base de despesas + dashboard FinOps

Status: done no código (issues 01 a 16, 05/Out/2026); falta aplicar a migration de orçamento e conferir com dados reais

## Contexto

Novo módulo da área de Tecnologia para registrar tudo o que a TI gasta e enxergar
esse gasto como FinOps. O desenho completo (glossário, decisões, requisitos RF/RN/RNF,
modelo de dados, telas, dashboard, verificação e riscos) está em
`docs/plans/gastos-ti/PLANO_GASTOS_TI.md`. **Esse plano é a fonte da verdade.** As
issues abaixo citam as seções dele em vez de repetir o conteúdo.

## Decisões já fechadas com o usuário (30/Set/2026), não reabrir sem motivo novo

- **D2:** duas chaves novas, `canViewGastosTI` e `canManageGastosTI`, grupo
  `Tecnologia`. Não reaproveitar `canManageIT`.
- **D3:** "Autorizado por" é **texto livre** obrigatório, com sugestões dos nomes já
  digitados. Data da autorização opcional.
- **D5:** categorias **expansíveis**. 8 iniciais, a 1ª é **Inteligência Artificial**.
  A cor vem da ordem: as 8 primeiras têm cor própria, da 9ª em diante viram "Outros"
  só no gráfico empilhado.
- **D6:** ocorrências **calculadas**, com **total margem de edição** em qualquer mês
  (ajuste "só este mês" ou "deste mês em diante", baixa, dispensa, editar e desfazer).
  Só grava linha no primeiro toque. Sem fechamento de mês.
- **D13:** não existe planilha atual. O modelo de importação é o da §7.1 do plano.
- **D14:** nenhuma migration grava em `custom_roles`. O usuário atribui as chaves
  manualmente depois de cada implantação. Até lá só admin vê o módulo.
- O dashboard é **único** (sem visão separada de IA: filtra-se pela categoria).

## Convenções que valem para todas as issues

- Módulo em `src/modules/gastos-ti/`; tabelas com prefixo `ti_`.
- Toda regra de cálculo em `domain/` puro, com `hoje` como argumento (nunca
  `new Date()` dentro da regra) e testes vitest ao lado.
- RLS por `current_user_has_permission('canViewGastosTI' | 'canManageGastosTI')`.
- Competência trafega como texto `YYYY-MM-01`, nunca `Date` com fuso.
- Sem função serverless nova: leitura e escrita direto no Supabase, protegidas por RLS.
- Visual do `ITHubDashboard` (vidro, acento violeta). Antes de qualquer gráfico,
  carregar a skill `dataviz` e validar a paleta em claro e escuro.

## Grafo de dependências

```
01 shell
└─ 02 categorias
   └─ 03 despesas: cadastro e lista
      ├─ 05 despesa: anexos
      ├─ 09 importação Excel
      └─ 04 despesa: painel, reajuste, encerrar, excluir
         └─ 06 mês a mês: baixa, dispensa, desfazer
            ├─ 07 ajuste de ocorrência
            ├─ 08 gasto avulso
            ├─ 10 exportação Excel
            └─ 11 dashboard: filtros, KPIs, evolução
               ├─ 12 dashboard: quebras e detalhamento
               ├─ 13 dashboard: alertas e renovações (+ 07, para o selo "fora da recorrência")
               └─ 14 orçamento
                  ├─ 15 detalhamento avançado (+ 07, para o desvio contra o previsto original)
                  └─ 16 caixa × competência e drill-down (+ 12)
```

## Issues

1. `01-shell-permissoes-rotas-menu.md` — Fase 0
2. `02-categorias.md` — Fase 1
3. `03-despesas-cadastro-lista.md` — Fase 1
4. `04-despesa-painel-reajuste-encerrar.md` — Fase 1
5. `05-despesa-anexos.md` — Fase 1
6. `06-mes-a-mes-baixa-dispensa.md` — Fase 2
7. `07-ajuste-ocorrencia.md` — Fase 2
8. `08-gasto-avulso.md` — Fase 2
9. `09-importacao-excel.md` — Fase 2 (pode ser antecipada logo depois da 03)
10. `10-exportacao-excel.md` — Fase 2
11. `11-dashboard-filtros-kpis-evolucao.md` — Fase 3
12. `12-dashboard-quebras-detalhamento.md` — Fase 3
13. `13-dashboard-alertas-renovacoes.md` — Fase 3
14. `14-orcamento.md` — Fase 4
15. `15-dashboard-detalhamento-avancado.md` — Fase 4
16. `16-caixa-competencia-drill-down.md` — Fase 4
