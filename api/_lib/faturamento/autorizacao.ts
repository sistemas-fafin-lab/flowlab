// api/_lib/faturamento/autorizacao.ts
// Autorização das rotas /api/faturamento/*.
//
// O `token` é o JWT de SESSÃO do operador, não a FLOWLAB_API_KEY: estas rotas atendem
// o navegador de um usuário logado, não um canal server-to-server. Mesma checagem de
// recepcaoAgendamento.autorizarOperador / uploadDocumentoRecepcao.
//
// Por que um arquivo próprio em vez de replicar por handler: o repo replica a checagem
// entre MÓDULOS de propósito (ver o comentário em uploadDocumentoRecepcao.ts), e essa
// escolha fica preservada — nada aqui é importado por outro módulo. Dentro do módulo de
// faturamento são dois handlers com a MESMA permissão, e duplicar a regra entre eles só
// criaria a chance de os dois divergirem numa alteração futura.

import { getSupabaseAdminClient } from '../supabase.js';

export interface FalhaAutorizacao {
  status: number;
  payload: Record<string, unknown>;
}

/** Permissão exigida pela rota. `canManageBilling` é o nível de escrita. */
export type PermissaoFaturamento = 'canViewBilling' | 'canManageBilling';

/**
 * Devolve `null` quando o operador tem `permissao`; a falha a devolver, senão.
 *
 * Espelha a RLS instalada em 20260807120000: leitura aceita qualquer uma das duas
 * permissões (quem registra baixa evidentemente pode ver o título), escrita exige
 * `canManageBilling`. Se as duas regras divergissem, a rota autorizaria uma
 * chamada que o banco recusaria depois — erro 500 no lugar de um 403 claro.
 */
export async function autorizarFaturamento(
  token: string | null,
  permissao: PermissaoFaturamento = 'canViewBilling',
): Promise<FalhaAutorizacao | null> {
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
    permissao === 'canViewBilling' ? ['canViewBilling', 'canManageBilling'] : ['canManageBilling'];
  const authorized =
    callerProfile?.role === 'admin' || aceitas.some((p) => callerPermissions.includes(p));

  if (!authorized) {
    return {
      status: 403,
      payload: {
        success: false,
        error: permissao === 'canManageBilling'
          ? 'Sem permissão para gerenciar contas a receber.'
          : 'Sem permissão para consultar faturamento.',
      },
    };
  }
  return null;
}

/** Extrai o access_token do header `Authorization: Bearer <jwt>`. */
export function tokenDoHeader(authorization: string | undefined): string | null {
  const header = authorization ?? '';
  return header.startsWith('Bearer ') ? header.slice(7) : null;
}
