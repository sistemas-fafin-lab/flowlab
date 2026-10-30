## Context

O módulo RH (`src/modules/rh`) já tem: tabela `colaboradores` (entidade própria, separada de `user_profiles`), modal `ColaboradorDetalheModal` sobre o `DetailModal` genérico com três seções empilhadas (`EditarCadastroSection`, `VinculoUsuarioSection`, `GestorSection`), holerites em `colaborador_holerites` + bucket privado `colaborador-holerites`, e departamentos. A policy `colaboradores_update` (migration `20260915120000`) exige só `canViewColaboradores` — quem vê, edita. A chave `canManageColaboradores` aparece em comentários SQL mas não existe no catálogo.

Referência visual: `.design-sync/modulo_rh/Modulo RH.dc.html` (modal variação A, card variação B). Decisões tomadas com o usuário: remuneração e centro de custo fora; nome/CPF/e-mail somente leitura; dados pessoais em tabela separada.

## Goals / Non-Goals

**Goals:**
- Separar leitura (`canViewColaboradores`) de escrita (`canManageColaboradores`) com RLS.
- Persistir dados pessoais com proteção própria (LGPD: cor/raça, filiação).
- Entregar o novo layout do modal e um card de resumo reutilizável pelo Meu perfil.
- Expor os recibos de pagamento do colaborador dentro da ficha.

**Non-Goals:**
- Remuneração, centro de custo, documentos assinados, Meu perfil, solicitação de alteração (propostas seguintes).
- Editar nome, CPF ou e-mail.
- Criar/excluir colaboradores pela UI.
- Endereço, dependentes, dados de estrangeiro.

## Decisions

### D1. Tabela 1:1 `colaborador_dados_pessoais` em vez de colunas em `colaboradores`
PK = `colaborador_id` (FK `ON DELETE CASCADE`), colunas `nacionalidade`, `uf_nascimento`, `cidade_nascimento`, `cor_raca`, `genero`, `estado_civil`, `data_nascimento`, `nome_mae`, `nome_pai`, `updated_at`, `updated_by`. Domínios fechados via `CHECK` com valores em snake_case (`solteiro`, `uniao_estavel`…); os rótulos ficam no front (`rotulosDadosPessoais.ts`). `data_nascimento <= current_date` também via `CHECK`.
- **Por quê**: RLS por tabela permite que a policy de SELECT dos dados pessoais seja diferente da de `colaboradores` (que tem outras policies de leitura, como `colaboradores_select_holerites_manage`), e a proposta 4 (solicitação de alteração) aplica mudanças só nessa tabela.
- **Alternativa**: colunas em `colaboradores` — mais simples, mas herda todas as policies de SELECT existentes, expondo dados sensíveis a quem só gerencia holerites.

RLS:
- SELECT: `current_user_has_permission('canViewColaboradores') OR colaborador_id IN (SELECT id FROM colaboradores WHERE user_profile_id = auth.uid())`.
- INSERT/UPDATE: `current_user_has_permission('canManageColaboradores')`. Sem DELETE.

Escrita via `upsert` (onConflict `colaborador_id`) no supabase-js — não precisa de RPC.

### D2. `canManageColaboradores` substitui `canViewColaboradores` na policy de UPDATE
Migration: `DROP POLICY colaboradores_update` + recriar com `canManageColaboradores`; conceder a chave ao Administrador (`cr.id = 'a0000000-0000-0000-0000-000000000001'`, formato exigido por `permissions.test.ts`) e ao cargo "RH". Registrar em `CHAVES_POSTERIORES`. No front, um `podeGerenciar` derivado de `hasPermission('canManageColaboradores')` é passado às seções.
- **Alternativa**: manter `canViewColaboradores` para tudo — rejeitada pelo usuário (Q8).

### D3. Modal próprio em vez de estender `DetailModal`
O layout de duas colunas (card 300px + conteúdo com abas, tela cheia < 760px) não cabe no `DetailModal` genérico. Criar o layout dentro de `ColaboradorDetalheModal` usando os mesmos tokens/classes do projeto (Tailwind) e o comportamento de ESC/clique-fora do `DetailModal`. Se o `DetailModal` aceitar `size`/`children` livres sem cabeçalho fixo, reaproveitá-lo; decidir na implementação lendo o componente.

### D4. Coordenação de edição por seção no modal
O modal guarda `secaoEmEdicao: 'cadastrais' | 'pessoais' | 'gestor' | null` e passa `bloqueada = secaoEmEdicao !== null && secaoEmEdicao !== minha` a cada seção. Fechar o modal com edição em andamento pede confirmação implícita: ESC/clique-fora são ignorados enquanto há edição (o usuário cancela primeiro).

### D5. Card de resumo como componente puro
`components/ColaboradorResumoCard.tsx` recebe `Colaborador` (+ gestor resolvido) e não faz fetch. Reutilizado pelo `rh-meu-perfil`. Formatação (CPF mascarado, iniciais, data dd/mm/aaaa) em `utils/` com testes.

### D6. Lista de recibos reutilizável e detecção de arquivo ausente
Extrair de `MeusHoleritesSection` um componente `RecibosPagamentoLista` (props: `holerites`, `visao: 'rh' | 'colaborador'`) com agrupamento por ano, busca e filtro de ano. A lógica pura (normalizar busca, casar "março"/"03/2026"/"2026", agrupar por ano) vai para `utils/recibosFiltro.ts` com testes Vitest.
Arquivo ausente: ao carregar a lista, uma chamada `storage.from('colaborador-holerites').list('<colaborador_id>/')` traz os nomes existentes; holerites cujo `arquivo_path` não está na lista são marcados `indisponivel`. Uma chamada por colaborador, não por holerite.
- **Alternativa**: descobrir só no clique (erro do signed URL) — mais barato, mas não permite o estado visual do protótipo.

### D7. Hook de dados pessoais
`hooks/useDadosPessoais(colaboradorId)` com `carregar` e `salvar(input)` retornando `string | null` (mesmo padrão de erro de `useColaboradores`).

## Risks / Trade-offs

- [Cargos que hoje editam só com `canViewColaboradores` perdem a edição] → listar na migration os cargos afetados (comentário) e avisar o RH no release; conceder `canManageColaboradores` ao cargo "RH" na mesma migration.
- [`storage.list` limitado a 100 itens por padrão] → passar `limit: 1000`; um colaborador tem ~12 holerites/ano.
- [CHECKs com valores fixos dificultam incluir opção nova] → alterar exige migration; aceitável para listas oficiais (IBGE/eSocial) e raramente mudam.
- [Modal próprio diverge do `DetailModal`] → reaproveitar o máximo de classes e o hook de ESC existente.

## Migration Plan

1. Aplicar a migration (tabela, RLS, policy de UPDATE, concessão da chave) no dev; conferir com um usuário "RH - Consulta" que o UPDATE é negado.
2. Deploy do front junto — o front antigo com usuário sem a chave nova passaria a receber erro de RLS ao salvar, então os dois sobem no mesmo release.
3. Rollback: recriar a policy antiga com `canViewColaboradores`; a tabela nova pode ficar (não é lida pelo front antigo).

## Open Questions

- Nenhuma bloqueante. Confirmar na implementação se o `DetailModal` comporta o layout (D3).
