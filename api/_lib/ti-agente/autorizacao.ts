// Autorização das rotas /api/ti/* da EVA — espelha api/_lib/rh/autorizacao.ts.
import type { VercelRequest } from '@vercel/node';
import { getSupabaseAdminClient } from '../supabase.js';

export interface FalhaAutorizacao {
  status: number;
  payload: Record<string, unknown>;
}

export interface Usuario {
  userId: string;
  permissoes: string[];
  ehAdmin: boolean;
}

/** Extrai o access_token do header `Authorization: Bearer <jwt>`. */
export function tokenDoHeader(authorization: string | undefined): string | null {
  const header = authorization ?? '';
  return header.startsWith('Bearer ') ? header.slice(7) : null;
}

export function tem(u: Usuario, permissao: string): boolean {
  return u.ehAdmin || u.permissoes.includes(permissao);
}

/** Valida a sessão e exige QUALQUER uma das permissões de `algumaDe`. */
export async function autorizar(token: string | null, algumaDe: string[]): Promise<FalhaAutorizacao | Usuario> {
  if (!token) return { status: 401, payload: { success: false, error: 'Token de autenticação ausente.' } };
  const supabase = getSupabaseAdminClient();

  const { data: caller, error } = await supabase.auth.getUser(token);
  if (error || !caller?.user) return { status: 401, payload: { success: false, error: 'Sessão inválida ou expirada.' } };

  const { data: perfil } = await supabase
    .from('user_profiles')
    .select('role, deleted_at, custom_roles(permissions)')
    .eq('id', caller.user.id)
    .single();
  if (!perfil || perfil.deleted_at) return { status: 403, payload: { success: false, error: 'Usuário inativo.' } };

  const usuario: Usuario = {
    userId: caller.user.id,
    permissoes: (perfil.custom_roles as { permissions?: string[] } | null)?.permissions ?? [],
    ehAdmin: perfil.role === 'admin',
  };
  if (!algumaDe.some((p) => tem(usuario, p))) {
    return { status: 403, payload: { success: false, error: 'Sem permissão para usar a EVA.' } };
  }
  return usuario;
}

/** Crons da Vercel: `Authorization: Bearer <CRON_SECRET>` (como umami-inatividade-cron). */
export function cronAutorizado(req: VercelRequest): boolean {
  const segredo = process.env.CRON_SECRET;
  return !!segredo && req.headers.authorization === `Bearer ${segredo}`;
}

export function ehFalha(x: FalhaAutorizacao | Usuario): x is FalhaAutorizacao {
  return 'status' in x;
}
