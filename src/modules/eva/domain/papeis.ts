// Os três papéis da EVA (D31): quem configura, quem é gestor e quem aprova sugestões. Cada um é
// uma chave de cargo (Usuários → Cargos e Permissões) ou, pessoa a pessoa, uma linha da aba
// Permissões (ti_agente_papeis, D33). Puro: usado pelo front e pela api/, então os imports levam ".js".

export const CHAVE_CONFIGURAR = 'canConfigureAgenteTI';
export const CHAVE_GESTOR = 'canManageAgenteTI';
export const CHAVE_APROVAR = 'canApproveAgenteTI';
export const CHAVES_EVA: readonly string[] = [CHAVE_CONFIGURAR, CHAVE_GESTOR, CHAVE_APROVAR];

export interface PapeisEva {
  /** Abas Membros, Permissões e Configurações, "Enviar teste". */
  configura: boolean;
  /** Cobrar cards de outras pessoas, avisar o grupo e as pessoas, a fila do WhatsApp e o "último contato". */
  gestor: boolean;
  /** Aprovar e rejeitar sugestões (D28), na tela e pelo WhatsApp. */
  aprova: boolean;
}

/** A linha de ti_agente_papeis: as três definidas para a pessoa, no lugar do cargo. */
export type LinhaPapeis = PapeisEva;

export const SEM_PAPEIS: PapeisEva = { configura: false, gestor: false, aprova: false };
const TODOS: PapeisEva = { configura: true, gestor: true, aprova: true };

/** Pelas permissões da sessão (o que o front recebe do cargo, já com a linha aplicada). */
export function papeisEva(permissoes: readonly string[] | null | undefined): PapeisEva {
  const p = permissoes ?? [];
  return { configura: p.includes(CHAVE_CONFIGURAR), gestor: p.includes(CHAVE_GESTOR), aprova: p.includes(CHAVE_APROVAR) };
}

/** As três como chaves de permissão. */
export function chavesDosPapeis(p: PapeisEva): string[] {
  return [p.configura && CHAVE_CONFIGURAR, p.gestor && CHAVE_GESTOR, p.aprova && CHAVE_APROVAR].filter((c): c is string => !!c);
}

/**
 * A regra do banco (ti_agente_tem_permissao) sobre uma lista de permissões: admin ganha as três;
 * com linha, as três vêm dela e as do cargo saem; sem linha, fica o cargo. As outras chaves não mudam.
 */
export function comPapeisDaPessoa(
  permissoes: readonly string[] | null | undefined,
  linha: LinhaPapeis | null | undefined,
  ehAdmin = false,
): string[] {
  const base = [...(permissoes ?? [])];
  if (ehAdmin) return [...new Set([...base, ...CHAVES_EVA])];
  if (!linha) return base;
  return [...base.filter((p) => !CHAVES_EVA.includes(p)), ...chavesDosPapeis(linha)];
}

/** De onde vêm os papéis de uma pessoa: o que a aba Permissões mostra. */
export type OrigemPapeis = 'admin' | 'definido' | 'cargo' | 'inativo';

export interface PerfilPapeis {
  role?: string | null;
  /** As permissões do cargo (custom_roles.permissions). */
  permissoes?: unknown;
  deleted_at?: string | null;
  disabled_at?: string | null;
}

export function origemDosPapeis(perfil: PerfilPapeis | null, linha?: LinhaPapeis | null): OrigemPapeis {
  if (!perfil || perfil.deleted_at || perfil.disabled_at) return 'inativo';
  if (perfil.role === 'admin') return 'admin';
  return linha ? 'definido' : 'cargo';
}

/** Os papéis pelo cargo, sem a linha. */
export function papeisDoCargo(perfil: PerfilPapeis | null): PapeisEva {
  if (!perfil) return SEM_PAPEIS;
  return papeisEva(Array.isArray(perfil.permissoes) ? (perfil.permissoes as string[]) : []);
}

/**
 * Pelo perfil e pela linha, com a regra do banco e do servidor: admin tem os três; com linha,
 * vale a linha; sem linha, o cargo; removido ou desativado, nenhum. É o que vale pelo WhatsApp,
 * e o que as abas Membros e Permissões mostram.
 */
export function papeisDoPerfil(perfil: PerfilPapeis | null, linha?: LinhaPapeis | null): PapeisEva {
  switch (origemDosPapeis(perfil, linha)) {
    case 'inativo': return SEM_PAPEIS;
    case 'admin': return TODOS;
    case 'definido': return { configura: !!linha?.configura, gestor: !!linha?.gestor, aprova: !!linha?.aprova };
    default: return papeisDoCargo(perfil);
  }
}
