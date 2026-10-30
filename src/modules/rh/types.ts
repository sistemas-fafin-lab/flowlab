export type ColaboradorStatus = 'ativo' | 'desligado';

export interface Colaborador {
  id: string;
  userProfileId: string | null;
  nome: string;
  email: string | null;
  cpf: string;
  departamentoId: string | null;
  /** Nome do departamento (departamentos.nome), ou null sem departamento. */
  departamentoNome: string | null;
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

/**
 * Campos editáveis da ficha. `departamentoId` só vai para o banco quando
 * definido (undefined = não mexe): trocar o departamento pede canManageDepartamentos.
 */
export interface AtualizarCadastroInput {
  cargo?: string | null;
  dataAdmissao?: string | null;
  matricula?: string | null;
  departamentoId?: string | null;
}

// ─── Dados pessoais (rh-ficha-colaborador) ─────────────────────────────────────

export type Nacionalidade = 'brasileira' | 'brasileira_naturalizada' | 'estrangeira';
export type UF =
  | 'AC' | 'AL' | 'AP' | 'AM' | 'BA' | 'CE' | 'DF' | 'ES' | 'GO' | 'MA' | 'MT' | 'MS' | 'MG' | 'PA'
  | 'PB' | 'PR' | 'PE' | 'PI' | 'RJ' | 'RN' | 'RS' | 'RO' | 'RR' | 'SC' | 'SP' | 'SE' | 'TO';
export type CorRaca = 'branca' | 'preta' | 'parda' | 'amarela' | 'indigena' | 'nao_declarar';
export type Genero = 'masculino' | 'feminino' | 'nao_declarar';
export type EstadoCivil = 'solteiro' | 'casado' | 'uniao_estavel' | 'divorciado' | 'separado' | 'viuvo';

/** Uma linha de `colaborador_dados_pessoais` (1:1 com colaboradores). Todos os campos são opcionais. */
export interface DadosPessoais {
  nacionalidade: Nacionalidade | null;
  ufNascimento: UF | null;
  cidadeNascimento: string | null;
  corRaca: CorRaca | null;
  genero: Genero | null;
  estadoCivil: EstadoCivil | null;
  /** "YYYY-MM-DD" */
  dataNascimento: string | null;
  nomeMae: string | null;
  nomePai: string | null;
}

// ─── Documentos assinados (rh-documentos-assinados) ───────────────────────────

export type TipoDocumento =
  | 'contrato_trabalho'
  | 'termo_confidencialidade_lgpd'
  | 'acordo_compensacao_horas'
  | 'termo_responsabilidade_equipamentos'
  | 'adesao_plano_odontologico'
  | 'autorizacao_uso_imagem'
  | 'aditivo_contratual'
  | 'termo_rescisao'
  | 'outro';

/** Uma linha de `colaborador_documentos`: PDF já assinado, enviado pelo RH. */
export interface DocumentoAssinado {
  id: string;
  colaboradorId: string;
  tipo: TipoDocumento;
  /** Nome livre, só quando `tipo = 'outro'`. */
  nomeOutro: string | null;
  /** "YYYY-MM-DD" */
  dataAssinatura: string;
  arquivoPath: string;
  nomeArquivo: string;
  createdAt: string;
}

// ─── Departamentos ─────────────────────────────────────────────────────────────

export interface Departamento {
  id: string;
  nome: string;
  ativo: boolean;
  /** Colaborador que aprova as SCs de quem está no departamento. */
  aprovadorScId: string | null;
  /** Colaboradores responsáveis pelo departamento (independe de onde estão). */
  responsavelIds: string[];
  /** Responsáveis marcados "autoriza pagamentos" (apto ou não: ver SituacaoGestor). */
  autorizaPagamentosIds: string[];
}

/**
 * Situação de um responsável para autorizar pagamentos (departamentos_painel_pagamentos):
 * só o 'apto' e marcado conta como gestor que autoriza.
 */
export type SituacaoGestor = 'apto' | 'desligado' | 'sem_login' | 'usuario_inativo' | 'sem_permissao';

/** Pedidos de pagamento de um departamento esperando a autorização de alguém. */
export interface PendenciaAutorizacao {
  departamentoId: string;
  /** user_profiles.id do autorizador. */
  autorizadorId: string;
  autorizador: string;
  quantidade: number;
  valor: number;
}

export interface PainelPagamentos {
  /** Chave `departamentoId:colaboradorId` (chaveGestor). */
  situacoes: Record<string, SituacaoGestor>;
  /** user_profiles.id de cada responsável, pela mesma chave (para transferir pedidos). */
  usuarios: Record<string, string | null>;
  pendentes: PendenciaAutorizacao[];
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

/** CPF válido no PDF, mas sem colaborador correspondente cadastrado. Com competência, é guardado até o cadastro. */
export interface HoleriteCpfNaoCasado {
  cpf: string;
  /** "YYYY-MM-DD", ou null sem "Ref." legível. */
  competencia: string | null;
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
  /** Holerites de CPF sem colaborador guardados — aparecem quando o colaborador for cadastrado. */
  pendentesGuardados: number;
  falhasPendentes: { cpf: string; erro: string }[];
  blocosSemCompetencia: HoleriteBlocoSemCompetencia[];
  cpfsNaoCasados: HoleriteCpfNaoCasado[];
  paginasSemCpf: { numero: number }[];
}
