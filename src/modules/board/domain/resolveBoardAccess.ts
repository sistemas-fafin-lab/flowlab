// Resolve o que um usuário pode ver/fazer nos boards genéricos por
// departamento, a partir do cargo (custom_role) atribuído a ele.
// Ver .scratch/board-multidepartamento/spec.md — "Regra de acesso".

export type BoardAccess =
  | { kind: 'none' }
  | { kind: 'single'; boardId: string; canManage: boolean }
  | { kind: 'all' };

export interface ResolveBoardAccessInput {
  /** `custom_roles.board_id` do cargo do usuário. */
  boardId?: string | null;
  /** `custom_roles.permissions` do cargo do usuário. */
  permissions?: readonly string[];
}

/**
 * `cargo` é `null`/`undefined` quando o usuário não tem `custom_role_id`
 * atribuído (sem cargo = sem acesso a nenhum board).
 */
export function resolveBoardAccess(cargo: ResolveBoardAccessInput | null | undefined): BoardAccess {
  if (!cargo) return { kind: 'none' };

  const permissions = cargo.permissions ?? [];
  if (permissions.includes('canManageAllBoards')) return { kind: 'all' };

  if (!cargo.boardId) return { kind: 'none' };

  return { kind: 'single', boardId: cargo.boardId, canManage: permissions.includes('canManageBoard') };
}
