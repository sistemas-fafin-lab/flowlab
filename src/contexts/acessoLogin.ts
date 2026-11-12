/** O que o login precisa saber do perfil para decidir se a conta pode entrar. */
export interface PerfilParaLogin {
  disabled_at: string | null;
  deleted_at: string | null;
}

/**
 * A conta pode entrar se tem perfil e não está desativada nem excluída. Não exige CPF
 * nem consulta a user_whitelist, aposentada em 20261112150000: contas de setor não têm
 * CPF, e quem saiu é barrado pela desativação (que também bloqueia no Auth).
 */
export function podeEntrar(perfil: PerfilParaLogin | null): boolean {
  return perfil !== null && perfil.disabled_at === null && perfil.deleted_at === null;
}
