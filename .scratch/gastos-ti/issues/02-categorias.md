# 02 — Categorias expansíveis

**What to build:** um usuário com `canManageGastosTI` abre "Categorias" (a partir da
aba Despesas) e vê as 8 categorias iniciais, com Inteligência Artificial em 1º.
Ele cria categorias novas, renomeia, descreve o que entra em cada uma, reordena e
desativa. A ordem define a cor nos gráficos (as 8 primeiras têm cor própria). Quem só
tem `canViewGastosTI` vê a lista sem os botões de escrita.

Esta issue também cria a infraestrutura de banco que as próximas reaproveitam:
`ti_auditoria` + função de trigger genérica, e o guarda de
`current_user_has_permission` no topo da migration.

Plano: §4.1 (`ti_categorias`, carga inicial, `ti_auditoria`), §4.2 (RLS), D5, RF07.

**Blocked by:** 01

**Status:** done (migration gerada, ainda não aplicada em nenhum ambiente)

- [x] Migration: `ti_categorias` (nome único sem diferenciar maiúsculas, `descricao`, `natureza_padrao`, `ordem`, `ativo`), carga das 8 iniciais com descrições da §4.1.
- [x] Migration: `ti_auditoria` + função de trigger `SECURITY DEFINER` reutilizável, ligada a `ti_categorias`.
- [x] RLS: SELECT com view ou manage; INSERT/UPDATE com manage; sem DELETE.
- [x] Hook `useCategoriasTI` (padrão de `rh/hooks`) e hook `useCanManageGastosTI`.
- [x] `CategoriasModal`: criar, renomear, descrever, reordenar, desativar/reativar.
- [x] Nome duplicado (ex.: "ia" × "IA") mostra erro claro, não erro cru do Postgres.
- [x] Função pura que mapeia `ordem` → cor da paleta (8 cores; 9ª em diante = "Outros"), com teste.
- [x] `npx tsc --noEmit`, `npm run lint` e `npm test` sem erros novos.

## Comments

**01/Out/2026 — implementado.**

**Migration:** `supabase/migrations/20261009120000_gastos_ti_categorias.sql`. Ainda não foi aplicada em nenhum ambiente.
- `ti_auditoria`:
  - Colunas `tabela`, `registro_id`, `acao`, `antes`, `depois`, `autor_id`, `created_at`.
  - O trigger genérico `ti_auditoria_trigger()` é `SECURITY DEFINER`. As próximas tabelas só ligam um trigger a ele.
  - UPDATE que só mexe em `updated_at`/`updated_by` não gera linha.
  - Mudanças sem sessão (SQL Editor) também são registradas, com `autor_id` NULL.
- `ti_categorias`:
  - Nome único por `lower(nome)`, e CHECK de nome sem espaços nas pontas e não vazio.
  - Sem policy de DELETE.
  - A carga inicial roda antes do trigger de auditoria, para não gerar 8 linhas de ruído.
- RPC `ti_reordenar_categorias(uuid[])`: grava a ordem inteira numa instrução, é `SECURITY INVOKER` e recusa com erro 42501 quem não tem `canManageGastosTI`.

**Teste da migration em Postgres real:** PGlite, Postgres em WASM, rodando no scratchpad, com stubs de `auth.uid()`, `authenticated`, `user_profiles` e `current_user_has_permission`. Passaram 34 de 34 verificações:
- a migration aplica e reaplica sem duplicar;
- carga inicial com IA em 1º e Licenças/Hardware como CAPEX;
- RLS sem chave, só com `canViewGastosTI` e com `canManageGastosTI`;
- 23505 para nome repetido sem diferenciar maiúsculas, 23514 para espaços nas pontas, nome vazio e natureza inválida;
- DELETE não apaga nada;
- a reordenação grava 1..n;
- auditoria com autor e antes/depois, e UPDATE sem mudança fora da trilha.

**Frontend:**
- `types.ts` e `constants.ts`.
- `domain/categorias.ts`: ordenar com desempate pelo nome, `proximaOrdem`, `moverCategoria`, normalizar e validar nome sem diferenciar maiúsculas nem acentos.
- `domain/coresCategorias.ts`: paleta e slots. Categoria inativa mantém o seu slot, para desativar não repintar as outras.
- `hooks/useCanManageGastosTI.ts` e `hooks/useCategoriasTI.ts`. A reordenação é otimista, com refetch se falhar. `criarCategoria` devolve o id, que a 03 usa para selecionar a categoria nova.
- `components/categorias/CategoriaForm.tsx` (a 03 reaproveita no formulário da despesa) e `CategoriasModal.tsx`, sobre o `DetailModal` compartilhado.
- O botão "Categorias" fica na aba Despesas.

**Paleta:** validada com `validate_palette.js` da skill dataviz contra `#ffffff` (claro) e `#0f172a` (escuro), e passou em tudo. No claro, aqua, amarelo e magenta ficam abaixo de 3:1 de contraste, então todo gráfico precisa de rótulo visível ou tabela equivalente. Isso já está registrado em `coresCategorias.ts` e na issue 11.

**Ressalva de locale:** o índice `lower(nome)` pode não igualar letras acentuadas em todo locale do Postgres, por exemplo "ÇA" × "ça" no locale C. A checagem que garante isso é a do frontend (`validarNomeCategoria`, com `localeCompare` de sensibilidade base).

**Verificação:**
- 22 testes novos passando.
- `tsc`: nenhum erro em `gastos-ti`. Os 25 que restam já existiam.
- `eslint` limpo no módulo.
