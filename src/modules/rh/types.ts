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
}
