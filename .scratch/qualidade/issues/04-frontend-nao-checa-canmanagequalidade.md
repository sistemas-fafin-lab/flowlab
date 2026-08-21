Status: done
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

## Comments

Resolvido após code review (Standards + Spec) do WIP:

1. **Hook compartilhado** `useCanManageQualidade()` (`hooks/useCanManageQualidade.ts`)
   + gate nas 4 páginas e drawers: Sincronizar oculto, salvar curadoria/confirmar
   vínculo/criar-editar cota ocultos ou `disabled`, classificação CID-O e triagem
   gateadas (`CasoDrawer`), e os botões de salvar de `CampoParametroFixo` agora
   também checam `canManage` (antes só a entrada em edição checava).
2. **Legacy roles corrigidos** (`src/utils/permissions.ts`): `canViewQualidade`/
   `canManageQualidade` saíram do fallback de `operator` — no banco,
   `current_user_has_permission()` só honra `custom_roles.permissions` ou
   `role='admin'`, então o fallback sintetizado dava botões habilitados que o RLS
   negava com 403 (o exato bug da issue). Admin legado mantém as chaves (RLS
   reconhece `role='admin'`). Teste novo `src/utils/permissions.test.ts` cobre os 3
   papéis (TDD: vermelho → verde).
3. **Exportação RHC** não existia na UI — criado `cancer/ExportacaoRhcCard.tsx`
   (ano/trimestre/registrador + botão "Gerar exportação" gateado por `canManage`,
   lista de exportações com download livre para `canViewQualidade`) e plugado na
   `CancerPage`.
4. **Fixes de Standards do review**: `.glass-field` definida em `src/index.css`
   (par light/dark + foco — a classe era usada em 14 lugares sem definição);
   `chamarQualidadeApi` agora lança `ErroApiQualidade` com o status real (branch
   401 das páginas era inalcançável) e as mensagens "ver STATUS.md" (arquivo
   inexistente) foram removidas; `Inicio` renomeado para `QualidadeDashboardPage`;
   prop `colunaAcoes` removida de `TabelaExpansivel` (nenhum caller usava);
   policy `qa_parametros_write` restrita a `chave LIKE 'cancer.%'` (antes dava
   escrita sobre todas as chaves compartilhadas a qualquer `canManageQualidade`).

Verificado: `npx tsc --noEmit` sem erros novos (25 pré-existentes em arquivos de
IT), `npm test` 161/161, `npm run build` ok, eslint sem erros novos nos arquivos
tocados.
