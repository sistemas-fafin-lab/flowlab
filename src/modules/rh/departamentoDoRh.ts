import { supabase } from '../../lib/supabase';
import { notificarPagamento } from '../pagamentos/notificarPagamento';

// O departamento de uma pessoa é o do RH (colaboradores.departamento_id): é ele que define
// quem autoriza os pagamentos dela e quem aprova as SCs. As duas RPCs abaixo trocam o
// departamento e devolvem os pedidos de pagamento que aguardavam autorização e seguiram para
// o gestor do departamento novo (20261103150000); cada um é avisado por e-mail.

function avisarPedidosMovidos(ids: string[] | null | undefined): void {
  (ids ?? []).forEach((id) => void notificarPagamento(id, 'transferido'));
}

/** RH: põe o colaborador no departamento. Devolve quantos pedidos seguiram para o gestor novo. */
export async function definirDepartamentoDoColaborador(colaboradorId: string, departamentoId: string | null): Promise<number> {
  const { data, error } = await supabase.rpc('colaborador_definir_departamento', {
    p_colaborador: colaboradorId,
    p_departamento: departamentoId,
  });
  // As mensagens do banco (colaboradores_validar_departamento, permissão) já vêm em português.
  if (error) throw new Error(error.message);
  const movidos = (data as string[] | null) ?? [];
  avisarPedidosMovidos(movidos);
  return movidos.length;
}

export type SituacaoDepartamentoUsuario = 'ok' | 'sem_colaborador' | 'sem_departamento';

/**
 * Tela de Usuários: o departamento escolhido (pelo nome) vai para o colaborador do usuário.
 * sem_colaborador: o usuário não está vinculado a um colaborador; sem_departamento: não há
 * departamento ativo com esse nome no RH. Nos dois casos o RH não muda.
 */
export async function definirDepartamentoDoUsuario(
  userId: string,
  departamento: string,
): Promise<{ situacao: SituacaoDepartamentoUsuario; movidos: number }> {
  const { data, error } = await supabase.rpc('usuario_definir_departamento', {
    p_user: userId,
    p_departamento: departamento,
  });
  if (error) throw new Error(error.message);
  const r = data as { situacao: SituacaoDepartamentoUsuario; movidos: string[] | null } | null;
  avisarPedidosMovidos(r?.movidos);
  return { situacao: r?.situacao ?? 'ok', movidos: r?.movidos?.length ?? 0 };
}
