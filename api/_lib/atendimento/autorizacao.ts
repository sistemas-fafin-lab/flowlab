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

/** Quem passou na autorização: o que o usuário pode além de usar o Gerador. */
export interface AcessoGeradorOrcamento {
  /** auth.users.id de quem chamou (a leitura do pedido médico só aceita arquivos da pasta dele). */
  userId: string;
  /** canViewGeradorOrcamentoCustos: só com ela o custo é consultado e devolvido. */
  podeVerCustos: boolean;
}

// Distinguido por `'falha' in resultado`: o tsconfig da api não é strict, e sem
// strictNullChecks o TS não estreita a união por um discriminante booleano.
export type ResultadoAutorizacao = { acesso: AcessoGeradorOrcamento } | { falha: FalhaAutorizacao };

const negar = (status: number, error: string): { falha: FalhaAutorizacao } => ({
  falha: { status, payload: { success: false, error } },
});

/** Permissões do cargo de quem chamou, ou a falha a responder (token ausente/inválido). */
async function permissoesDoChamador(
  token: string | null,
): Promise<{ userId: string; permissoes: string[] } | { falha: FalhaAutorizacao }> {
  if (!token) return negar(401, 'Token de autenticação ausente.');
  const supabase = getSupabaseAdminClient();

  const { data: caller, error: callerErr } = await supabase.auth.getUser(token);
  if (callerErr || !caller?.user) return negar(401, 'Sessão inválida ou expirada.');

  const { data: callerProfile } = await supabase
    .from('user_profiles')
    .select('custom_roles(permissions)')
    .eq('id', caller.user.id)
    .single();

  const permissoes: string[] =
    (callerProfile?.custom_roles as { permissions?: string[] } | null)?.permissions ?? [];
  return { userId: caller.user.id, permissoes };
}

/** Exige canUseGeradorOrcamento; devolve o acesso do usuário ou a falha a responder. */
export async function autorizarGeradorOrcamento(token: string | null): Promise<ResultadoAutorizacao> {
  const chamador = await permissoesDoChamador(token);
  if ('falha' in chamador) return chamador;
  if (!chamador.permissoes.includes('canUseGeradorOrcamento')) {
    return negar(403, 'Sem permissão para usar o Gerador de Orçamento.');
  }
  return {
    acesso: {
      userId: chamador.userId,
      podeVerCustos: chamador.permissoes.includes('canViewGeradorOrcamentoCustos'),
    },
  };
}

/** Exige canResetarSenhaClinica (Resetar senha clínica: grava no cadastro da clínica no apLIS). */
export async function autorizarResetSenhaClinica(
  token: string | null,
): Promise<{ acesso: { userId: string } } | { falha: FalhaAutorizacao }> {
  const chamador = await permissoesDoChamador(token);
  if ('falha' in chamador) return chamador;
  if (!chamador.permissoes.includes('canResetarSenhaClinica')) {
    return negar(403, 'Sem permissão para resetar senha de clínica.');
  }
  return { acesso: { userId: chamador.userId } };
}

/** Extrai o access_token do header `Authorization: Bearer <jwt>`. */
export function tokenDoHeader(authorization: string | undefined): string | null {
  const header = authorization ?? '';
  return header.startsWith('Bearer ') ? header.slice(7) : null;
}
