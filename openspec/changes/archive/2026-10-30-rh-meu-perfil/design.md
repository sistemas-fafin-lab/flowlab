## Context

Hoje o autoatendimento do colaborador é `MeusHoleritesSection`, renderizada em `/rh/holerites` (rota sem `ProtectedRoute`). Por isso o item "RH" da sidebar (`src/components/Layout.tsx`) aponta para `/rh/holerites` e não tem gate no item pai — ver comentário ali. O rodapé da sidebar mostra um card estático (nome, cargo, departamento). As policies de leitura do próprio registro já existem: `colaboradores_select_own`, `colaborador_holerites_select_own`, storage `colaborador_holerites_storage_select_own`, e a SELECT de `colaborador_dados_pessoais` criada em `rh-ficha-colaborador`.

## Goals / Non-Goals

**Goals:**
- Tela `/meu-perfil` com card, dados pessoais (leitura) e recibos, reaproveitando os componentes da proposta 1.
- Tirar o autoatendimento de dentro de RH e limpar a sidebar para colaboradores comuns.

**Non-Goals:**
- Edição de dados pelo colaborador (proposta `rh-solicitacao-alteracao-dados`).
- Documentos assinados (proposta `rh-documentos-assinados`; a aba Documentos já nasce preparada para um segundo card).
- Remuneração no card.

## Decisions

### D1. Página no módulo RH, rota fora de `/rh`
`MeuPerfilPage` mora em `src/modules/rh/components/` (o domínio é colaborador), mas a rota é `/meu-perfil` porque é do usuário, não da área administrativa. Sem `ProtectedRoute` de permissão — só autenticação, como as demais rotas.

### D2. Hook `useMeuColaborador`
Generaliza a busca que `useMeusHolerites` já faz (`colaboradores` por `user_profile_id = auth.uid()`), trazendo também gestor e departamento (mesmo select de `useColaboradores`) e os dados pessoais. Retorna `{ colaborador, dadosPessoais, loading, semVinculo }`. `useMeusHolerites` passa a receber o `colaboradorId` ou continua independente — escolher o que evitar fetch duplicado.

### D3. Leitura do gestor pelo colaborador
O card mostra o nome do gestor. A policy `colaboradores_select_own` só deixa ler a própria linha, então o join `gestor:colaboradores!gestor_id(id,nome)` voltaria `null` para o colaborador comum. Opções:
- (a) RPC `SECURITY DEFINER` `rh_meu_perfil()` que retorna a linha do próprio colaborador já com `gestor_nome` e `departamento_nome`. **Escolhida**: um round-trip, não amplia RLS.
- (b) Nova policy permitindo ler a linha do próprio gestor — expõe CPF/e-mail do gestor ao subordinado. Rejeitada.
### D4. Sidebar
- Item "RH": adicionar `anyOf` com todas as chaves do grupo RH (`canViewColaboradores`, `canManageColaboradores`, `canManageHolerites`, `canViewAllHolerites`, `canViewHoleritesEquipe`, `canManageDepartamentos`) e `href` para `/rh/colaboradores`; reescrever o comentário que justificava o href antigo. Se `canAccessItem` não aceita `anyOf` no pai, usar o mecanismo que o Layout já usa para outros grupos.
- Subitem Holerites: `anyOf` das três chaves de holerites.
- Card do rodapé: envolver em `Link`/`button` para `/meu-perfil`, com estado ativo quando a rota é `/meu-perfil`, no desktop e no drawer mobile.

### D5. `HoleritesPage`
Remove o ramo de autoatendimento; a rota ganha `ProtectedRoute` com `anyOf` das três chaves de holerites. `MeusHoleritesSection` é substituída pelo uso de `RecibosPagamentoLista` dentro do Meu perfil e pode ser removida se não sobrar consumidor.

## Risks / Trade-offs

- [Colaboradores acostumados a RH › Holerites não encontram mais os recibos] → mensagem no release e o card do rodapé com rótulo "Meu perfil" visível.
- [RPC `SECURITY DEFINER` mal escrita vaza dados de outros] → filtrar estritamente por `auth.uid()`, sem parâmetro de id, `search_path` fixo; teste manual com dois usuários.
- [Links antigos/bookmarks para `/rh/holerites`] → usuário comum recebe acesso negado; aceitável (a tela de acesso negado já existe).

## Migration Plan

Deploy único (front + migration da RPC). Rollback: reverter o front; a RPC pode ficar.

## Open Questions

- Confirmar na implementação o mecanismo de `anyOf` no item pai da sidebar (D4).
