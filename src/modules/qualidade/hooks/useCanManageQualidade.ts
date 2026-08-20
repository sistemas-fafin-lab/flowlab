import { useAuth } from '../../../hooks/useAuth';
import { hasPermission } from '../../../utils/permissions';

/**
 * Todas as ações de escrita do módulo (sincronizar, salvar curadoria,
 * confirmar vínculo, criar/editar cota, editar parâmetro fixo) exigem
 * `canManageQualidade` — quem só tem `canViewQualidade` é só leitura.
 * Os handlers do dispatcher já checam isso (`autorizarQualidade`); este hook
 * evita repetir a leitura de `userProfile.permissions` em cada página/drawer.
 */
export function useCanManageQualidade(): boolean {
  const { userProfile } = useAuth();
  return hasPermission(userProfile?.permissions || [], 'canManageQualidade');
}
