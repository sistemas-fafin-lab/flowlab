// api/_lib/umamiAuth.ts
// Autorização de /api/umami — usado pelo handler de produção (api/umami.ts) e
// pelo middleware de desenvolvimento (vite.config.ts), para os dois exigirem
// exatamente a mesma coisa.

import { getSupabaseAdminClient } from './supabase.js';
import { describeError } from './errors.js';

export interface UmamiAuthResult {
  ok: boolean;
  status: number;
  error?: string;
}

/** Mesma permissão que protege a rota /it/dashboard no SPA (ver src/App.tsx). */
const REQUIRED_PERMISSION = 'canManageIT';

/**
 * Valida a sessão do operador no header `Authorization: Bearer <access_token>`.
 *
 * ATENÇÃO: aqui `Bearer` é o JWT de SESSÃO do usuário, não a FLOWLAB_API_KEY —
 * o mesmo contrato de api/analises-clinicas/get-documentos.ts. Sem esta checagem
 * o endpoint é um proxy anônimo: ele autentica no Umami com credenciais de
 * servidor e devolve as métricas de TODOS os sites para quem chamar.
 */
export async function authorizeUmamiRequest(
  authHeader: string | string[] | undefined,
): Promise<UmamiAuthResult> {
  const header = Array.isArray(authHeader) ? authHeader[0] : authHeader;
  const token = header?.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return { ok: false, status: 401, error: 'Token de autenticação ausente.' };
  }

  try {
    const supabase = getSupabaseAdminClient();

    const { data: caller, error: callerErr } = await supabase.auth.getUser(token);
    if (callerErr || !caller?.user) {
      return { ok: false, status: 401, error: 'Sessão inválida ou expirada.' };
    }

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role, custom_roles(permissions)')
      .eq('id', caller.user.id)
      .single();

    const permissions: string[] =
      (profile?.custom_roles as { permissions?: string[] } | null)?.permissions ?? [];
    const authorized = profile?.role === 'admin' || permissions.includes(REQUIRED_PERMISSION);

    if (!authorized) {
      return { ok: false, status: 403, error: 'Sem permissão para ver as métricas de uso.' };
    }

    return { ok: true, status: 200 };
  } catch (err) {
    console.error('[umamiAuth] falha ao autorizar:', describeError(err));
    return { ok: false, status: 500, error: 'Erro interno.' };
  }
}
