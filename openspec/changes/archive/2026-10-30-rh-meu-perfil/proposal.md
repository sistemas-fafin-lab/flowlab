## Why

O colaborador não tem um lugar no FlowLab para consultar o próprio cadastro: hoje o único autoatendimento é "Meus holerites", escondido dentro de RH › Holerites (aba visível a todos justamente por isso). O protótipo em `.design-sync/modulo_rh/` define uma tela **Meu perfil**, acessada pelo card do usuário no rodapé da sidebar, com card de resumo, dados pessoais e documentos. Ela também é a base das propostas `rh-documentos-assinados` e `rh-solicitacao-alteracao-dados`.

Proposta 2 de 4 do módulo RH. **Depende de `rh-ficha-colaborador`** (tabela `colaborador_dados_pessoais`, `ColaboradorResumoCard`, `RecibosPagamentoLista`).

## What Changes

- Nova rota `/meu-perfil`, acessível a qualquer usuário autenticado.
- Card do usuário no rodapé da sidebar (desktop e mobile) passa a ser clicável e leva a `/meu-perfil`, com a legenda "Meu perfil".
- Tela Meu perfil: card de resumo (variação B, o mesmo da ficha do RH) + abas **Dados pessoais** (somente leitura nesta proposta) e **Documentos** (Recibos de pagamento).
- Estado vazio para conta sem colaborador vinculado.
- **BREAKING**: "Meus holerites" sai de `/rh/holerites`. A rota passa a exigir `canManageHolerites`, `canViewAllHolerites` ou `canViewHoleritesEquipe`; o item "RH" da sidebar deixa de aparecer para quem não tem nenhuma chave de RH.

## Capabilities

### New Capabilities
- `rh-meu-perfil`: tela de autoatendimento do colaborador — acesso, card de resumo, dados pessoais (leitura) e recibos de pagamento.

### Modified Capabilities
(nenhuma — não há specs de RH em `openspec/specs/`; `rh-ficha-colaborador` ainda não foi arquivada.)

## Impact

- **Frontend**: nova página `src/modules/rh/components/MeuPerfilPage.tsx`; `src/App.tsx` (rota nova e `ProtectedRoute` em `/rh/holerites`); `src/components/Layout.tsx` (card do rodapé clicável, gate do item RH e do subitem Holerites, `href` do item pai); `HoleritesPage.tsx` (remove `MeusHoleritesSection`); `hooks/useMeusHolerites.ts` reaproveitado; novo hook do próprio colaborador + dados pessoais.
- **Banco**: uma RPC `SECURITY DEFINER` `rh_meu_perfil()` para o colaborador ler o próprio registro com nome do gestor e do departamento sem ampliar a RLS (ver design D3). Holerites e dados pessoais já são cobertos por `colaborador_holerites_select_own` e pela SELECT de `colaborador_dados_pessoais` (proposta 1).
- **Usuários**: colaboradores comuns deixam de ver o item RH na sidebar e passam a acessar holerites pelo Meu perfil (comunicar no release).
