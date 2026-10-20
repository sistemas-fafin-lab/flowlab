import type { Colaborador } from '../modules/rh';

/** O que a resolução precisa de cada colaborador do RH. */
export interface ColaboradorNaCadeia extends Pick<Colaborador, 'id' | 'gestorId' | 'userProfileId' | 'status'> {
  aprovaSolicitacaoCompra: boolean;
  /** Usuário vinculado nem removido nem desativado. */
  usuarioAtivo: boolean;
}

/**
 * Aprovador da SC (espelho de requests_resolver_aprovador no banco, que é quem
 * grava requests.approver_id; aqui só para exibição): parte do colaborador
 * vinculado a quem pediu e sobe gestor_id — começando no gestor, nunca no
 * próprio solicitante — até o primeiro marcado como aprovador e utilizável.
 * Devolve o user_profile_id dele, ou null sem aprovador na cadeia.
 */
export function resolveRequestApprover(
  requesterUserId: string | null,
  colaboradores: ColaboradorNaCadeia[],
): string | null {
  const porId = new Map(colaboradores.map((c) => [c.id, c]));
  const solicitante = requesterUserId
    ? colaboradores.find((c) => c.userProfileId === requesterUserId)
    : undefined;
  const visitados = new Set<string>();
  let atual = solicitante?.gestorId ? porId.get(solicitante.gestorId) : undefined;
  while (atual && !visitados.has(atual.id)) {
    visitados.add(atual.id);
    if (atual.aprovaSolicitacaoCompra && atual.status === 'ativo' && atual.userProfileId && atual.usuarioAtivo) {
      return atual.userProfileId;
    }
    atual = atual.gestorId ? porId.get(atual.gestorId) : undefined;
  }
  return null;
}
