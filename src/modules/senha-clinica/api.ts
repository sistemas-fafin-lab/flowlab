// Adapter da aba Resetar senha clínica: /api/atendimento/senha-clinica-* com o token da
// sessão (o servidor valida o JWT + canResetarSenhaClinica). Cada chamada abre e fecha uma
// sessão no site do apLIS (~1–2 s), por isso a busca é por botão/Enter, não a cada tecla.

import { supabase } from '../../lib/supabase';

export interface Clinica {
  id: number;
  nome: string;
  razaoSocial: string;
}

export interface ContatoClinica {
  nome: string;
  setor: string;
  cargo: string;
  telefone: string;
  celular: string;
  email: string;
}

/** Cadastro da clínica no apLIS, como a tela de Instituição mostra (só leitura). */
export interface DetalhesClinica extends Clinica {
  cnpj: string;
  inativa: boolean;
  dataInclusao: string;
  dataDesativacao: string;
  segmento: string;
  tipos: string[];
  endereco: string;
  contatos: ContatoClinica[];
}

export interface UsuarioLaudoWeb {
  id: string;
  usuario: string;
  setor: string;
  liberado: boolean;
  ultimoLogin: string;
}

export interface ResultadoReset {
  usuario: string;
  nomeClinica: string;
  /** false: gravou, mas a releitura do cadastro mostrou outra diferença além da senha. */
  cadastroIntacto: boolean;
  diferencas: string[];
  /** Login de teste com o usuário e a senha nova, feito pelo servidor logo depois de gravar. */
  login: { status: 'ok' | 'falhou' | 'nao_conferido'; motivo: string };
}

async function chamar<T>(caminho: string, init: RequestInit = {}, falha: string): Promise<T> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error('Sessão expirada. Faça login novamente.');

  let res: Response;
  try {
    res = await fetch(`/api/atendimento/${caminho}`, {
      ...init,
      headers: { ...init.headers, Authorization: `Bearer ${session.access_token}` },
    });
  } catch {
    throw new Error(`${falha} Verifique a conexão.`);
  }
  const body = (await res.json().catch(() => ({}))) as { success?: boolean; error?: string } & T;
  if (!res.ok || !body.success) throw new Error(body.error || falha);
  return body;
}

export async function buscarClinicas(termo: string): Promise<Clinica[]> {
  const r = await chamar<{ clinicas: Clinica[] }>(
    `senha-clinica-buscar?termo=${encodeURIComponent(termo)}`,
    {},
    'Não foi possível buscar as clínicas.',
  );
  return r.clinicas;
}

export async function buscarUsuarios(idClinica: number): Promise<{ clinica: DetalhesClinica; usuarios: UsuarioLaudoWeb[] }> {
  const r = await chamar<{ clinica: Omit<DetalhesClinica, 'id'> & { id: string }; usuarios: UsuarioLaudoWeb[] }>(
    `senha-clinica-usuarios?id=${idClinica}`,
    {},
    'Não foi possível carregar os usuários da clínica.',
  );
  return { clinica: { ...r.clinica, id: Number(r.clinica.id) }, usuarios: r.usuarios };
}

export async function resetarSenha(idInstituicao: number, idUsuario: string, senha: string): Promise<ResultadoReset> {
  return chamar<ResultadoReset>(
    'senha-clinica-resetar',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idInstituicao, idUsuario, senha }),
    },
    'Não foi possível resetar a senha.',
  );
}
