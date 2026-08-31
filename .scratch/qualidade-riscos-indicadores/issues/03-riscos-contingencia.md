# 03 — Riscos: planos de contingência + histórico de testes

**What to build:** um usuário cadastra um plano de contingência
("o que fazer quando um risco vira realidade") — código, setor, evento,
cenário, impactos, gatilho de acionamento, ações imediatas, responsáveis,
comunicação, materiais, fornecedor alternativo, prazo máximo de
interrupção, status, documento anexado — e registra testes ao longo do
tempo (data, resultado, necessidade de melhoria, próxima data prevista),
sem perder o histórico de testes anteriores.

Importante: plano de contingência é **independente de risco** — não exige
vincular um risco existente (requisito do cliente original: "são duas
coisas relacionadas, mas diferentes"). Por isso esta ticket não depende de
01/02, só do shell de navegação (00).

Referência de implementação completa: projeto de origem
`Flowlab_Controle_Qualidade`, branch `main`, commit `d78e375` —
`components/ContingenciasPage.tsx`,
`components/riscos/NovoPlanoContingenciaDrawer.tsx`,
`components/riscos/PlanoContingenciaDetalheDrawer.tsx`, tabelas
`qa_planos_contingencia`/`qa_testes_contingencia` em
`qualidade_riscos_schema.sql`.

**Blocked by:** 00.

**Status:** done

- [x] Cadastrar um plano de contingência não exige vincular um risco.
- [x] Registrar um teste novo não sobrescreve o teste anterior — histórico
      completo em `qa_testes_contingencia`.
- [x] Documento do plano pode ser anexado e recuperado depois.
- [x] `npx tsc --noEmit` e `npm test` sem erros novos.

## Comments

Implementado como `ContingenciasPage`/`NovoPlanoContingenciaDrawer`/
`PlanoContingenciaDetalheDrawer` em `src/modules/qualidade/components/`
(padrão espelhado de `RiscosPage`/`NovoRiscoDrawer`/`RiscoDetalheDrawer`),
cliente de dados em `contingencias.ts`, agregação pura em
`domain/riscosContingencia.ts` (histórico de testes, ordenação por data,
próxima data prevista), tipos em `types.ts`, rota
`/qualidade/riscos/contingencias` em `App.tsx` e link "Contingências" no
cabeçalho de `RiscosPage` (mesmo padrão do link "Cotas" em
`CortesiasPage`/`CortesiasCotasPage` — issue 00 não expõe a navegação como
subitem próprio no menu, só a rota `/qualidade/riscos`).

Migration `20260831190000_qualidade_riscos_contingencia.sql`: tabelas
`qa_planos_contingencia` (sem FK para `qa_riscos` — independente de risco,
por design) e `qa_testes_contingencia` (só INSERT/SELECT, sem UPDATE/DELETE
— histórico imutável). Deliberadamente **não** reaproveita
`qa_riscos_modulo_auditoria_trigger` de `20260831170000` — define sua
própria função de auditoria (`qa_contingencia_modulo_auditoria_trigger`,
cópia estrutural) para não criar uma dependência de migration entre
contingência e o schema de risco, seguindo a decisão de escopo do spec.md
("só precisa do shell de navegação (00), não do schema de risco"). Bucket de
storage dedicado `qa-contingencia-documentos` (privado, mesmo padrão de
`qa-riscos-evidencias`).

`npx tsc --noEmit` e `npx vitest run` (251 testes) sem regressões.
`/code-review` (Standards + Spec) rodou em duas sub-agents paralelas;
achados corrigidos: policy de DELETE faltando no bucket de storage, tipo
`documento` reescrito inline em vez de reaproveitar `DocumentoPlanoContingencia`,
e a função de auditoria genérica reaproveitada criando uma dependência de
migration não intencional com o schema de risco (issue 01) — todos
corrigidos antes do commit.
