// api/_lib/qualidade/autorizacao.ts
// Autorização das rotas /api/qualidade/*. Espelha api/_lib/faturamento/autorizacao.ts
// (mesmo raciocínio no cabeçalho daquele arquivo: a checagem se replica entre
// MÓDULOS de propósito, não dentro de um módulo).
//
// O `token` é o JWT de SESSÃO do usuário logado no SPA — o dispatcher
// /api/qualidade/[action] não faz nenhuma autorização por si (ver seu
// cabeçalho e a issue 01-api-qualidade-dispatcher.md); cada handler chama
// `autorizarQualidade` antes de tocar em qualquer dado.

import { getSupabaseAdminClient } from '../supabase.js';

export interface FalhaAutorizacao {
  status: number;
  payload: Record<string, unknown>;
}

/** `canManageQualidade` é o nível de escrita/sincronização — RLS não aceita `canViewQualidade` para isso. */
export type PermissaoQualidade = 'canViewQualidade' | 'canManageQualidade';

/**
 * Espelha a RLS instalada nas migrations 20260820120000-150000: leitura
 * aceita `canViewQualidade` OU `canManageQualidade`; escrita (sync,
 * curadoria, confirmação de vínculo, geração de exportação) exige só
 * `canManageQualidade`. Devolve o `userId` da sessão validada quando
 * autorizado — handlers que precisam do id (confirmar-vinculo-ihq,
 * gerar-exportacao-cancer) usam `autorizarQualidadeComUsuario` direto, em
 * vez de validar o token duas vezes (achado de code review).
 */
async function autorizarQualidadeComUsuario(
  token: string | null,
  permissao: PermissaoQualidade,
): Promise<FalhaAutorizacao | { userId: string }> {
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
  const aceitas: string[] =
    permissao === 'canViewQualidade' ? ['canViewQualidade', 'canManageQualidade'] : ['canManageQualidade'];
  const authorized = callerProfile?.role === 'admin' || aceitas.some((p) => callerPermissions.includes(p));

  if (!authorized) {
    return {
      status: 403,
      payload: {
        success: false,
        error:
          permissao === 'canManageQualidade'
            ? 'Sem permissão para gerenciar/sincronizar Qualidade.'
            : 'Sem permissão para consultar Qualidade.',
      },
    };
  }
  return { userId: caller.user.id };
}

/** Devolve `null` quando o operador tem `permissao`; a falha a devolver, senão. */
export async function autorizarQualidade(
  token: string | null,
  permissao: PermissaoQualidade = 'canViewQualidade',
): Promise<FalhaAutorizacao | null> {
  const resultado = await autorizarQualidadeComUsuario(token, permissao);
  return 'userId' in resultado ? null : resultado;
}

/** Para handlers que precisam do `userId` além da autorização — 1 validação de token só, não 2. */
export async function autorizarQualidadeERetornarUsuario(
  token: string | null,
  permissao: PermissaoQualidade,
): Promise<FalhaAutorizacao | { userId: string }> {
  return autorizarQualidadeComUsuario(token, permissao);
}

/** Extrai o access_token do header `Authorization: Bearer <jwt>`. */
export function tokenDoHeader(authorization: string | undefined): string | null {
  const header = authorization ?? '';
  return header.startsWith('Bearer ') ? header.slice(7) : null;
}
