// api/_lib/atendimento/autorizacao.ts
// Autorização das rotas /api/atendimento/* — espelha api/_lib/faturamento/autorizacao.ts
// (o repo replica a checagem entre módulos de propósito; nada aqui é importado
// por outro módulo).
//
// O `token` é o JWT de SESSÃO do usuário, não uma chave de API: estas rotas
// atendem o navegador de quem está logado no flowlab.

import { getSupabaseAdminClient } from '../supabase.js';

export interface FalhaAutorizacao {
  status: number;
  payload: Record<string, unknown>;
}

/** Devolve `null` quando o usuário pode usar o Gerador de Orçamento; a falha a devolver, senão. */
export async function autorizarGeradorOrcamento(token: string | null): Promise<FalhaAutorizacao | null> {
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
    .select('custom_roles(permissions)')
    .eq('id', caller.user.id)
    .single();

  const callerPermissions: string[] =
    (callerProfile?.custom_roles as { permissions?: string[] } | null)?.permissions ?? [];
  if (!callerPermissions.includes('canUseGeradorOrcamento')) {
    return { status: 403, payload: { success: false, error: 'Sem permissão para usar o Gerador de Orçamento.' } };
  }
  return null;
}

/** Extrai o access_token do header `Authorization: Bearer <jwt>`. */
export function tokenDoHeader(authorization: string | undefined): string | null {
  const header = authorization ?? '';
  return header.startsWith('Bearer ') ? header.slice(7) : null;
}
