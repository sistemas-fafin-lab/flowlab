import type { Colaborador } from '../modules/rh';

/** O que a resolução precisa de cada colaborador do RH. */
export interface ColaboradorNaResolucao extends Pick<Colaborador, 'id' | 'userProfileId' | 'status'> {
  departamentoId: string | null;
  /** Usuário vinculado nem removido nem desativado. */
  usuarioAtivo: boolean;
}

/** O que a resolução precisa de cada departamento do RH. */
export interface DepartamentoDoAprovador {
  id: string;
  /** Colaborador que aprova as SCs de quem está no departamento. */
  aprovadorScId: string | null;
}

/**
 * Aprovador da SC (espelho de requests_resolver_aprovador no banco, que é quem
 * grava requests.approver_id; aqui só para exibição): o aprovador_sc_id do
 * departamento do colaborador vinculado a quem pediu, se ativo, com login,
 * usuário ativo e não o próprio solicitante. Devolve o user_profile_id dele,
 * ou null — sem procurar outro aprovador.
 */
export function resolveRequestApprover(
  requesterUserId: string | null,
  colaboradores: ColaboradorNaResolucao[],
  departamentos: DepartamentoDoAprovador[],
): string | null {
  if (!requesterUserId) return null;
  const solicitante = colaboradores.find((c) => c.userProfileId === requesterUserId);
  const departamento = departamentos.find((d) => d.id === solicitante?.departamentoId);
  const aprovador = colaboradores.find((c) => c.id === departamento?.aprovadorScId);
  if (!aprovador || aprovador === solicitante || aprovador.status !== 'ativo' || !aprovador.usuarioAtivo) return null;
  return aprovador.userProfileId;
}
