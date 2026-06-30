// api/_lib/createUser.ts
// Orquestração do cadastro de um novo usuário, operado por um admin com a
// permissão `canManageUsers`. Agnóstico de framework: retorna { status, payload }
// para ser relayed tanto pela rota Vercel quanto pelo middleware de dev do Vite.
//
// Fluxo (ordem importa — a whitelist precede o CPF por causa da FK):
//   1. Autoriza o chamador (token JWT) → exige canManageUsers (ou role=admin).
//   2. Valida entradas e CPF.
//   3. Upsert em user_whitelist.
//   4. auth.admin.createUser (não afeta a sessão do admin) — trigger cria o profile.
//   5. UPDATE do profile com cpf/telefone/data_nascimento/cargo.
//   6. Cria alias no Google Workspace.
//   7. Envia e-mail de boas-vindas com senha temporária + alias + link do Slack.

import { randomBytes } from 'node:crypto';
import { getSupabaseAdminClient } from './supabase.js';
import { sendTemplatedEmail, isValidEmail } from './email.js';
import { buildAliasEmail, createUserAlias, isWorkspaceConfigured } from './googleWorkspace.js';

export interface CreateUserInput {
  name: string;
  email: string;
  telefone: string;
  cpf: string;
  dataNascimento: string; // YYYY-MM-DD
  department: string;
  customRoleId?: string | null;
}

export interface CreateUserFlowResult {
  status: number;
  payload: Record<string, unknown>;
}

const normalizeCPF = (v: string): string => v.replace(/\D/g, '').trim();

function validateCPF(cpf: string): boolean {
  const d = normalizeCPF(cpf);
  if (d.length !== 11 || /^(\d)\1+$/.test(d)) return false;
  const calc = (n: number) => {
    const sum = d.slice(0, n).split('').reduce((acc, x, i) => acc + +x * (n + 1 - i), 0);
    const rem = (sum * 10) % 11;
    return rem === 10 || rem === 11 ? 0 : rem;
  };
  return calc(9) === +d[9] && calc(10) === +d[10];
}

function generateTempPassword(): string {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower = 'abcdefghijkmnpqrstuvwxyz';
  const digits = '23456789';
  const symbols = '!@#$%&*';
  const all = upper + lower + digits + symbols;
  const pick = (set: string) => set[randomBytes(1)[0] % set.length];
  const base = [pick(upper), pick(lower), pick(digits), pick(symbols)];
  for (let i = 0; i < 8; i++) base.push(pick(all));
  // embaralha
  for (let i = base.length - 1; i > 0; i--) {
    const j = randomBytes(1)[0] % (i + 1);
    [base[i], base[j]] = [base[j], base[i]];
  }
  return base.join('');
}

export async function createUserFlow(
  token: string | null,
  input: Partial<CreateUserInput>,
): Promise<CreateUserFlowResult> {
  const supabase = getSupabaseAdminClient();

  // ── 1. Autorização ──────────────────────────────────────────────────────────
  if (!token) {
    return { status: 401, payload: { success: false, error: 'Token de autenticação ausente.' } };
  }

  const { data: caller, error: callerErr } = await supabase.auth.getUser(token);
  if (callerErr || !caller?.user) {
    return { status: 401, payload: { success: false, error: 'Sessão inválida ou expirada.' } };
  }

  const { data: callerProfile } = await supabase
    .from('user_profiles')
    .select('role, custom_roles(permissions)')
    .eq('id', caller.user.id)
    .single();

  const callerPermissions: string[] = (callerProfile?.custom_roles as any)?.permissions ?? [];
  const authorized =
    callerProfile?.role === 'admin' || callerPermissions.includes('canManageUsers');

  if (!authorized) {
    return { status: 403, payload: { success: false, error: 'Sem permissão para cadastrar usuários.' } };
  }

  // ── 2. Validação de entrada ─────────────────────────────────────────────────
  const name = (input.name ?? '').trim();
  const email = (input.email ?? '').trim().toLowerCase();
  const telefone = (input.telefone ?? '').trim();
  const dataNascimento = (input.dataNascimento ?? '').trim();
  const department = (input.department ?? '').trim();
  const customRoleId = input.customRoleId || null;
  const normalizedCpf = normalizeCPF(input.cpf ?? '');

  if (!name || !email || !department) {
    return { status: 400, payload: { success: false, error: 'Campos obrigatórios ausentes: nome, email, departamento.' } };
  }
  if (!isValidEmail(email)) {
    return { status: 400, payload: { success: false, error: 'Endereço de email inválido.' } };
  }
  if (!validateCPF(normalizedCpf)) {
    return { status: 400, payload: { success: false, error: 'CPF inválido.' } };
  }

  // ── 3. Whitelist (antes do CPF, por causa da FK) ────────────────────────────
  const { error: whitelistErr } = await supabase
    .from('user_whitelist')
    .upsert({ cpf: normalizedCpf, name, activity: true }, { onConflict: 'cpf' });

  if (whitelistErr) {
    console.error('[createUser] Erro ao gravar whitelist:', whitelistErr.message);
    return { status: 500, payload: { success: false, error: 'Erro ao registrar o CPF na whitelist.' } };
  }

  // ── 4. Cria o usuário no Auth (não afeta a sessão do admin) ──────────────────
  const tempPassword = generateTempPassword();
  const { data: created, error: createErr } = await supabase.auth.admin.createUser({
    email,
    password: tempPassword,
    email_confirm: true,
    user_metadata: { name, department },
  });

  if (createErr || !created?.user) {
    const msg = createErr?.message ?? 'Erro desconhecido';
    const alreadyExists = /already|exists|registered/i.test(msg);
    console.error('[createUser] Erro ao criar usuário no Auth:', msg);
    return {
      status: alreadyExists ? 409 : 500,
      payload: { success: false, error: alreadyExists ? 'Já existe um usuário com este email.' : 'Erro ao criar a conta de acesso.' },
    };
  }

  const userId = created.user.id;

  // ── 5. Completa o perfil (o trigger já criou a linha base) ──────────────────
  const profilePatch: Record<string, unknown> = {
    name,
    department,
    cpf: normalizedCpf,
    telefone: telefone || null,
    data_nascimento: dataNascimento || null,
    updated_at: new Date().toISOString(),
  };
  if (customRoleId) profilePatch.custom_role_id = customRoleId;

  const { data: updated, error: profileErr } = await supabase
    .from('user_profiles')
    .update(profilePatch)
    .eq('id', userId)
    .select('id');

  // Fallback: se o trigger não tiver criado a linha, insere-a.
  if (!profileErr && (!updated || updated.length === 0)) {
    const { error: insertErr } = await supabase.from('user_profiles').insert({
      id: userId,
      email,
      name,
      role: 'requester',
      department,
      cpf: normalizedCpf,
      telefone: telefone || null,
      data_nascimento: dataNascimento || null,
      ...(customRoleId ? { custom_role_id: customRoleId } : {}),
    });
    if (insertErr) {
      console.error('[createUser] Erro ao inserir perfil (fallback):', insertErr.message);
    }
  } else if (profileErr) {
    console.error('[createUser] Erro ao atualizar perfil:', profileErr.message);
  }

  // ── 6. Alias no Google Workspace (best-effort) ──────────────────────────────
  const aliasEmail = buildAliasEmail(name);
  let aliasOk = false;
  let aliasError: string | undefined;
  if (aliasEmail && isWorkspaceConfigured()) {
    const aliasResult = await createUserAlias(aliasEmail);
    aliasOk = aliasResult.success;
    aliasError = aliasResult.error;
  } else {
    aliasError = 'Google Workspace não configurado no servidor.';
  }

  // ── 7. E-mail de boas-vindas (best-effort) ──────────────────────────────────
  const emailResult = await sendTemplatedEmail({
    to: email,
    templateSlug: 'welcome_new_user',
    variables: {
      name,
      login_email: email,
      temp_password: tempPassword,
      workspace_email: aliasOk && aliasEmail ? aliasEmail : '(não provisionado)',
      slack_invite_url: process.env.SLACK_INVITE_URL ?? '',
    },
  });

  // Avisos não-fatais (usuário foi criado com sucesso)
  const warnings: string[] = [];
  if (!aliasOk) warnings.push(`Alias do Workspace não criado: ${aliasError ?? 'erro desconhecido'}`);
  if (!emailResult.success) warnings.push(`E-mail de boas-vindas não enviado: ${emailResult.error ?? 'erro desconhecido'}`);
  if (!process.env.SLACK_INVITE_URL) warnings.push('SLACK_INVITE_URL não configurado — link do Slack ausente no e-mail.');

  return {
    status: 201,
    payload: {
      success: true,
      userId,
      aliasEmail: aliasOk ? aliasEmail : null,
      emailSent: emailResult.success,
      warnings,
    },
  };
}
