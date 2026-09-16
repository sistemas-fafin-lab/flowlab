// api/_lib/rh/autorizacao.ts
// Autorização das rotas /api/rh/* — espelha api/_lib/qualidade/autorizacao.ts
// (mesmo raciocínio: a checagem se replica entre módulos de propósito, não
// dentro de um módulo). Só existe um nível de permissão de escrita aqui
// (`canManageHolerites`, sem split view/manage — ver spec da issue 05), e um
// único formato de retorno: os dois handlers do módulo (preview/confirmar)
// precisam do `userId` (uploaded_by), então não há motivo pra uma segunda
// função "autorizar sem devolver usuário" como em qualidade/autorizacao.ts
// (que tem os dois formatos porque tem os dois tipos de chamador).

import { getSupabaseAdminClient } from '../supabase.js';

export interface FalhaAutorizacao {
  status: number;
  payload: Record<string, unknown>;
}

/** Devolve o `userId` da sessão validada quando autorizado (`canManageHolerites` ou admin legado), ou a falha a devolver. */
export async function autorizarRhERetornarUsuario(token: string | null): Promise<FalhaAutorizacao | { userId: string }> {
  if (!token) {
    return { status: 401, payload: { success: false, error: 'Token de autenticação ausente.' } };
  }
  const supabase = getSupabaseAdminClient();

  const { data: caller, error: callerErr } = await supabase.auth.getUser(token);
  if (callerErr || !caller?.user) {
    return { status: 401, payload: { success: false, error: 'Sessão inválida ou expirada.' } };
  }

  const { data: callerProfile } = await supabase
    .from('user_profiles')
    .select('role, custom_roles(permissions)')
    .eq('id', caller.user.id)
    .single();

  const callerPermissions: string[] =
    (callerProfile?.custom_roles as { permissions?: string[] } | null)?.permissions ?? [];
  const authorized = callerProfile?.role === 'admin' || callerPermissions.includes('canManageHolerites');

  if (!authorized) {
    return { status: 403, payload: { success: false, error: 'Sem permissão para gerenciar holerites.' } };
  }
  return { userId: caller.user.id };
}

/** Extrai o access_token do header `Authorization: Bearer <jwt>`. */
export function tokenDoHeader(authorization: string | undefined): string | null {
  const header = authorization ?? '';
  return header.startsWith('Bearer ') ? header.slice(7) : null;
}
