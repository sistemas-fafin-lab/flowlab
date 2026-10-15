// Os três papéis da EVA (D31): quem configura, quem é gestor e quem aprova sugestões. Cada um é
// uma chave de cargo (Usuários → Cargos e Permissões). Puro: usado pelo front e pela api/, então
// os imports levam ".js".

export const CHAVE_CONFIGURAR = 'canConfigureAgenteTI';
export const CHAVE_GESTOR = 'canManageAgenteTI';
export const CHAVE_APROVAR = 'canApproveAgenteTI';

export interface PapeisEva {
  /** Abas Membros e Configurações, "Enviar teste". */
  configura: boolean;
  /** Cobrar cards de outras pessoas, avisar o grupo, a fila do WhatsApp e o "último contato". */
  gestor: boolean;
  /** Aprovar e rejeitar sugestões (D28), na tela e pelo WhatsApp. */
  aprova: boolean;
}

/** Pelas permissões da sessão (o que o front recebe do cargo). */
export function papeisEva(permissoes: readonly string[] | null | undefined): PapeisEva {
  const p = permissoes ?? [];
  return { configura: p.includes(CHAVE_CONFIGURAR), gestor: p.includes(CHAVE_GESTOR), aprova: p.includes(CHAVE_APROVAR) };
}

/**
 * Pelo perfil, com a regra do banco (ti_agente_tem_permissao) e do servidor: admin tem os três;
 * removido ou desativado, nenhum. É o que vale pelo WhatsApp, e o que a aba Membros mostra.
 */
export function papeisDoPerfil(perfil: {
  role?: string | null;
  permissoes?: unknown;
  deleted_at?: string | null;
  disabled_at?: string | null;
} | null): PapeisEva {
  if (!perfil || perfil.deleted_at || perfil.disabled_at) return { configura: false, gestor: false, aprova: false };
  if (perfil.role === 'admin') return { configura: true, gestor: true, aprova: true };
  return papeisEva(Array.isArray(perfil.permissoes) ? (perfil.permissoes as string[]) : []);
}
