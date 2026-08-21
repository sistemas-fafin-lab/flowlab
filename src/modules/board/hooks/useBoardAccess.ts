import { useMemo } from 'react';
import { useAuth } from '../../../hooks/useAuth';
import { resolveBoardAccess, type BoardAccess } from '../domain/resolveBoardAccess';

/**
 * Usuário sem `custom_role_id` não tem cargo algum — passa `null` para
 * `resolveBoardAccess`, que trata isso como "sem acesso", mesmo que o
 * fallback de permissions de role legada (`getPermissionsForLegacyRole`)
 * concedesse `canManageAllBoards` a um `admin` sem cargo. Ver
 * `resolveBoardAccess.ts` e a nota em `utils/permissions.ts`.
 */
export function useBoardAccess(): BoardAccess {
  const { userProfile } = useAuth();
  const hasCargo = Boolean(userProfile?.customRoleId);
  const boardId = userProfile?.boardId ?? null;
  const permissions = userProfile?.permissions;

  return useMemo(
    () => resolveBoardAccess(hasCargo ? { boardId, permissions } : null),
    [hasCargo, boardId, permissions],
  );
}
