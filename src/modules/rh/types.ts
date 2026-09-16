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

// ─── Holerites (issue 05) ──────────────────────────────────────────────────────

/** Uma linha de `colaborador_holerites` — histórico enviado (visão RH) ou "meus holerites" (colaborador). */
export interface ColaboradorHolerite {
  id: string;
  colaboradorId: string;
  colaboradorNome: string;
  /** "YYYY-MM-DD", sempre dia 1 do mês. */
  competencia: string;
  arquivoPath: string;
  createdAt: string;
}

/** Bloco de páginas casado com um colaborador e com competência detectada — pronto pra gravar ao confirmar. */
export interface HoleriteBlocoIdentificado {
  colaboradorId: string;
  colaboradorNome: string;
  /** "YYYY-MM-DD" */
  competencia: string;
  paginaInicio: number;
  paginaFim: number;
  /** Já existe holerite dessa competência para este colaborador — será substituído ao confirmar. */
  jaExiste: boolean;
}

/** Bloco casado com um colaborador, mas sem "Ref." legível em nenhuma página — não pode ser gravado sem competência. */
export interface HoleriteBlocoSemCompetencia {
  colaboradorId: string;
  colaboradorNome: string;
  paginaInicio: number;
  paginaFim: number;
}

/** CPF válido no PDF, mas sem colaborador correspondente cadastrado. */
export interface HoleriteCpfNaoCasado {
  cpf: string;
  paginaInicio: number;
  paginaFim: number;
}

export interface HoleritePreview {
  totalPaginas: number;
  blocosIdentificados: HoleriteBlocoIdentificado[];
  blocosSemCompetencia: HoleriteBlocoSemCompetencia[];
  cpfsNaoCasados: HoleriteCpfNaoCasado[];
  paginasSemCpf: { numero: number }[];
}

export interface HoleriteFalhaProcessamento {
  colaboradorId: string;
  colaboradorNome: string;
  erro: string;
}

export interface HoleriteConfirmarResultado {
  totalPaginas: number;
  processados: number;
  notificados: number;
  falhas: HoleriteFalhaProcessamento[];
  blocosSemCompetencia: HoleriteBlocoSemCompetencia[];
  cpfsNaoCasados: HoleriteCpfNaoCasado[];
  paginasSemCpf: { numero: number }[];
}
