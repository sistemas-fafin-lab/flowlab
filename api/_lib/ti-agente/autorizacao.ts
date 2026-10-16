// Autorização das rotas /api/ti/* da EVA — espelha api/_lib/rh/autorizacao.ts.
import type { VercelRequest } from '@vercel/node';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseAdminClient } from '../supabase.js';
import { comPapeisDaPessoa, type LinhaPapeis } from '../../../src/modules/eva/domain/papeis.js';

export interface FalhaAutorizacao {
  status: number;
  payload: Record<string, unknown>;
}

export interface Usuario {
  userId: string;
  /** As do cargo, com a aba Permissões da EVA aplicada (D33). O role legado não conta. */
  permissoes: string[];
}

/** Extrai o access_token do header `Authorization: Bearer <jwt>`. */
export function tokenDoHeader(authorization: string | undefined): string | null {
  const header = authorization ?? '';
  return header.startsWith('Bearer ') ? header.slice(7) : null;
}

export function tem(u: Usuario, permissao: string): boolean {
  return u.permissoes.includes(permissao);
}

/** Valida a sessão e exige QUALQUER uma das permissões de `algumaDe`. */
export async function autorizar(token: string | null, algumaDe: string[]): Promise<FalhaAutorizacao | Usuario> {
  if (!token) return { status: 401, payload: { success: false, error: 'Token de autenticação ausente.' } };
  const supabase = getSupabaseAdminClient();

  const { data: caller, error } = await supabase.auth.getUser(token);
  if (error || !caller?.user) return { status: 401, payload: { success: false, error: 'Sessão inválida ou expirada.' } };

  const [{ data: perfil }, linha] = await Promise.all([
    supabase
      .from('user_profiles')
      .select('deleted_at, custom_roles(permissions)')
      .eq('id', caller.user.id)
      .single(),
    lerLinhaPapeis(supabase, caller.user.id),
  ]);
  if (!perfil || perfil.deleted_at) return { status: 403, payload: { success: false, error: 'Usuário inativo.' } };

  const usuario: Usuario = {
    userId: caller.user.id,
    permissoes: comPapeisDaPessoa((perfil.custom_roles as { permissions?: string[] } | null)?.permissions, linha),
  };
  if (!algumaDe.some((p) => tem(usuario, p))) {
    return { status: 403, payload: { success: false, error: 'Sem permissão para usar a EVA.' } };
  }
  return usuario;
}

/**
 * As permissões de quem escreveu pelo WhatsApp (D29): lá não há sessão, só o membro ligado ao
 * número. Removido ou desativado no FlowLab = null (sem permissão nenhuma), como no RLS.
 */
export async function usuarioPorId(db: SupabaseClient, userId: string): Promise<Usuario | null> {
  const [{ data: perfil, error }, linha] = await Promise.all([
    db
      .from('user_profiles')
      .select('deleted_at, disabled_at, custom_roles(permissions)')
      .eq('id', userId)
      .maybeSingle(),
    lerLinhaPapeis(db, userId),
  ]);
  if (error) throw new Error(error.message);
  if (!perfil || perfil.deleted_at || perfil.disabled_at) return null;
  return {
    userId,
    permissoes: comPapeisDaPessoa((perfil.custom_roles as { permissions?: string[] } | null)?.permissions, linha),
  };
}

// Sem a migration 20261015160000 aplicada, a tabela não existe: vale o cargo, como antes.
const TABELA_AUSENTE = new Set(['42P01', 'PGRST205']);

/** As permissões da EVA definidas para a pessoa na aba Permissões (D33); null = segue o cargo. */
export async function lerLinhaPapeis(db: SupabaseClient, userId: string): Promise<LinhaPapeis | null> {
  const { data, error } = await db.from('ti_agente_papeis').select('configura, gestor, aprova').eq('user_id', userId).maybeSingle();
  if (error) {
    if (TABELA_AUSENTE.has(error.code ?? '')) return null;
    throw new Error(error.message);
  }
  return (data as LinhaPapeis | null) ?? null;
}

/** Todas as linhas da aba Permissões, por pessoa (para listar quem tem um papel). */
export async function lerLinhasPapeis(db: SupabaseClient): Promise<Map<string, LinhaPapeis>> {
  const { data, error } = await db.from('ti_agente_papeis').select('user_id, configura, gestor, aprova').limit(1000);
  if (error) {
    if (TABELA_AUSENTE.has(error.code ?? '')) return new Map();
    throw new Error(error.message);
  }
  return new Map((data ?? []).map((l) => [l.user_id as string, { configura: !!l.configura, gestor: !!l.gestor, aprova: !!l.aprova }]));
}

/** Crons da Vercel: `Authorization: Bearer <CRON_SECRET>` (como umami-inatividade-cron). */
export function cronAutorizado(req: VercelRequest): boolean {
  const segredo = process.env.CRON_SECRET;
  return !!segredo && req.headers.authorization === `Bearer ${segredo}`;
}

export function ehFalha(x: FalhaAutorizacao | Usuario): x is FalhaAutorizacao {
  return 'status' in x;
}
