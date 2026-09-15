export type ColaboradorStatus = 'ativo' | 'desligado';

export interface Colaborador {
  id: string;
  userProfileId: string | null;
  nome: string;
  email: string | null;
  cpf: string;
  departamento: string | null;
  cargo: string | null;
  dataAdmissao: string | null;
  dataDesligamento: string | null;
  status: ColaboradorStatus;
  gestorId: string | null;
  matricula: string | null;
  createdAt: string;
  updatedAt: string;
  usuarioVinculado: { nome: string; email: string } | null;
  gestor: { id: string; nome: string } | null;
}

/** Campos editáveis pela issue 02 — cadastro (cargo/admissão/matrícula/departamento). */
export interface AtualizarCadastroInput {
  cargo?: string | null;
  dataAdmissao?: string | null;
  matricula?: string | null;
  departamento?: string | null;
}
