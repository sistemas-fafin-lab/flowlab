// api/_lib/googleWorkspace.ts
// Criação de alias de e-mail no Google Workspace via Admin SDK Directory API.
//
// Autenticação: service account com domain-wide delegation, impersonando um
// admin do Workspace (GOOGLE_ADMIN_SUBJECT). O alias é anexado a uma conta
// existente (GOOGLE_ALIAS_TARGET).
//
// Variáveis de ambiente:
//   GOOGLE_SA_CLIENT_EMAIL  → email do service account
//   GOOGLE_SA_PRIVATE_KEY   → chave privada (com \n escapado)
//   GOOGLE_ADMIN_SUBJECT    → admin do Workspace a impersonar
//   GOOGLE_ALIAS_TARGET     → userKey (email primário) que recebe os aliases
//   GOOGLE_ALIAS_DOMAIN     → domínio dos aliases (ex: empresa.com)

import { google } from 'googleapis';

const ALIAS_SCOPE = 'https://www.googleapis.com/auth/admin.directory.user.alias';

export interface CreateAliasResult {
  success: boolean;
  alias: string;
  alreadyExists?: boolean;
  error?: string;
}

export function isWorkspaceConfigured(): boolean {
  return Boolean(
    process.env.GOOGLE_SA_CLIENT_EMAIL &&
    process.env.GOOGLE_SA_PRIVATE_KEY &&
    process.env.GOOGLE_ADMIN_SUBJECT &&
    process.env.GOOGLE_ALIAS_TARGET &&
    process.env.GOOGLE_ALIAS_DOMAIN,
  );
}

/**
 * Deriva o e-mail de alias a partir do nome completo (ex.: "João Silva" →
 * joao.silva@dominio). Retorna null se o domínio não estiver configurado.
 */
export function buildAliasEmail(fullName: string): string | null {
  const domain = process.env.GOOGLE_ALIAS_DOMAIN;
  if (!domain) return null;

  const parts = fullName
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // remove acentos
    .toLowerCase()
    .replace(/[^a-z\s]/g, '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (parts.length === 0) return null;

  const local = parts.length === 1 ? parts[0] : `${parts[0]}.${parts[parts.length - 1]}`;
  return `${local}@${domain}`;
}

/** Cria um alias na conta-alvo. Idempotente: alias já existente é sucesso. */
export async function createUserAlias(aliasEmail: string): Promise<CreateAliasResult> {
  const {
    GOOGLE_SA_CLIENT_EMAIL,
    GOOGLE_SA_PRIVATE_KEY,
    GOOGLE_ADMIN_SUBJECT,
    GOOGLE_ALIAS_TARGET,
  } = process.env;

  if (!GOOGLE_SA_CLIENT_EMAIL || !GOOGLE_SA_PRIVATE_KEY || !GOOGLE_ADMIN_SUBJECT || !GOOGLE_ALIAS_TARGET) {
    return { success: false, alias: aliasEmail, error: 'Configuração do Google Workspace ausente no servidor' };
  }

  try {
    const auth = new google.auth.JWT({
      email: GOOGLE_SA_CLIENT_EMAIL,
      key: GOOGLE_SA_PRIVATE_KEY.replace(/\\n/g, '\n'),
      scopes: [ALIAS_SCOPE],
      subject: GOOGLE_ADMIN_SUBJECT,
    });

    const directory = google.admin({ version: 'directory_v1', auth });

    await directory.users.aliases.insert({
      userKey: GOOGLE_ALIAS_TARGET,
      requestBody: { alias: aliasEmail },
    });

    return { success: true, alias: aliasEmail };
  } catch (err: any) {
    const status = err?.code ?? err?.response?.status;
    const message = err?.errors?.[0]?.message ?? err?.message ?? 'Erro desconhecido';

    // Alias já existe → idempotente
    if (status === 409 || /duplicate|exists|entity already/i.test(String(message))) {
      return { success: true, alias: aliasEmail, alreadyExists: true };
    }

    console.error('[googleWorkspace] Falha ao criar alias:', message);
    return { success: false, alias: aliasEmail, error: String(message) };
  }
}
