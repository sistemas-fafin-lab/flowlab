Status: todo
Type: bug

# Frontend de Qualidade não checa `canManageQualidade` em nenhuma ação de escrita

## Onde

`src/modules/qualidade/` inteiro — busca por `canManageQualidade`/`canViewQualidade` no
módulo só encontra o comentário de `index.ts`. Nenhuma página (`OcorrenciasPage.tsx`,
`CortesiasPage.tsx`, `IhqPage.tsx`, `CancerPage.tsx`) nem drawer de curadoria desabilita ou
esconde uma ação de escrita (Sincronizar, salvar curadoria, confirmar vínculo, criar/editar
cota, gerar exportação) para quem só tem `canViewQualidade`.

Achado durante o code review da issue `01-api-qualidade-dispatcher.md` — os handlers do
dispatcher já checam `canManageQualidade` corretamente (`autorizarQualidade`) e devolvem 403
com mensagem clara; o problema é só de UX no frontend (botão fica habilitado, usuário clica,
recebe erro genérico em vez do botão já vir desabilitado/oculto).

## O que fazer

1. Nas 4 páginas + drawers relevantes, ler `permissions` de `useAuth()` e usar
   `hasPermission(permissions, 'canManageQualidade')` para desabilitar/esconder: botão
   "Sincronizar", salvar curadoria, confirmar vínculo de IHQ, criar/editar cota de
   Cortesias, gerar exportação RHC.
2. Considerar um único hook/helper compartilhado (`useCanManageQualidade()`) em vez de
   repetir a leitura em cada página, já que as 4 seguem o mesmo padrão.

## Critérios de aceite

- Um usuário só com `canViewQualidade` não vê nenhum botão de escrita habilitado nas 4
  páginas de Qualidade.
