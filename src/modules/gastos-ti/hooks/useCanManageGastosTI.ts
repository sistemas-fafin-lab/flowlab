import { useAuth } from '../../../hooks/useAuth';
import { hasPermission } from '../../../utils/permissions';

/**
 * Toda escrita do módulo (categorias, despesas, ajustes, baixas, orçamento)
 * exige `canManageGastosTI` — quem só tem `canViewGastosTI` é só leitura. A RLS
 * já barra a escrita no banco; este hook só evita mostrar botões que dariam 403.
 */
export function useCanManageGastosTI(): boolean {
  const { userProfile } = useAuth();
  return hasPermission(userProfile?.permissions || [], 'canManageGastosTI');
}
