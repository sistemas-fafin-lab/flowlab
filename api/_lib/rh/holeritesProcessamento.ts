// api/_lib/rh/holeritesProcessamento.ts
// Casa os blocos de página (holeritesParsing.agruparPaginasPorCpf) contra o
// cadastro de colaboradores — núcleo compartilhado pela pré-visualização
// (rh-holerites-preview) e pela confirmação (rh-holerites-confirmar), que
// SEMPRE reprocessa o PDF do zero (mesmo algoritmo determinístico) em vez de
// confiar em blocos vindos do cliente: o único risco que a própria reunião do
// RH levantou foi "colaborador receber holerite de outro" — a tela de
// conferência é revisão humana, não a fonte de verdade dos dados gravados.

import { agruparPaginasPorCpf, extrairCompetenciaDaPagina, extrairCpfDaPagina, normalizarCpf, type PaginaExtraida } from './holeritesParsing.js';

export interface ColaboradorParaMatching {
  id: string;
  nome: string;
  cpf: string;
}

export interface HoleriteExistente {
  colaboradorId: string;
  /** "YYYY-MM-DD" */
  competencia: string;
}

export interface BlocoIdentificado {
  colaboradorId: string;
  colaboradorNome: string;
  /** "YYYY-MM-DD" */
  competencia: string;
  paginaInicio: number;
  paginaFim: number;
  /** Já existe holerite dessa competência para este colaborador — será substituído ao confirmar. */
  jaExiste: boolean;
}

export interface BlocoSemCompetencia {
  colaboradorId: string;
  colaboradorNome: string;
  paginaInicio: number;
  paginaFim: number;
}

export interface CpfNaoCasado {
  cpf: string;
  paginaInicio: number;
  paginaFim: number;
}

export interface PaginaSemCpfResultado {
  numero: number;
}

export interface ResultadoProcessamento {
  totalPaginas: number;
  blocosIdentificados: BlocoIdentificado[];
  blocosSemCompetencia: BlocoSemCompetencia[];
  cpfsNaoCasados: CpfNaoCasado[];
  paginasSemCpf: PaginaSemCpfResultado[];
}

/** Extrai CPF e competência de cada página de texto — passo determinístico compartilhado. */
export function extrairPaginas(textosPorPagina: string[]): PaginaExtraida[] {
  return textosPorPagina.map((texto, indice) => ({
    numero: indice + 1,
    cpf: extrairCpfDaPagina(texto),
    competencia: extrairCompetenciaDaPagina(texto),
  }));
}

/**
 * Agrupa e casa contra `colaboradores` (CPF é a única chave de matching — ver
 * spec). Blocos não casados não bloqueiam o restante do lote: ficam
 * reportados em `cpfsNaoCasados` para tratamento manual.
 */
export function processarHolerites(
  textosPorPagina: string[],
  colaboradores: ColaboradorParaMatching[],
  holeritesExistentes: HoleriteExistente[],
): ResultadoProcessamento {
  const paginas = extrairPaginas(textosPorPagina);
  const { blocos, paginasSemCpf } = agruparPaginasPorCpf(paginas);

  const colaboradorPorCpf = new Map(colaboradores.map((c) => [normalizarCpf(c.cpf), c]));
  const existentesPorChave = new Set(holeritesExistentes.map((h) => `${h.colaboradorId}::${h.competencia}`));

  const blocosIdentificados: BlocoIdentificado[] = [];
  const blocosSemCompetencia: BlocoSemCompetencia[] = [];
  const cpfsNaoCasados: CpfNaoCasado[] = [];

  for (const bloco of blocos) {
    const colaborador = colaboradorPorCpf.get(bloco.cpf);
    if (!colaborador) {
      cpfsNaoCasados.push({ cpf: bloco.cpf, paginaInicio: bloco.paginaInicio, paginaFim: bloco.paginaFim });
      continue;
    }

    if (!bloco.competencia) {
      blocosSemCompetencia.push({
        colaboradorId: colaborador.id,
        colaboradorNome: colaborador.nome,
        paginaInicio: bloco.paginaInicio,
        paginaFim: bloco.paginaFim,
      });
      continue;
    }

    blocosIdentificados.push({
      colaboradorId: colaborador.id,
      colaboradorNome: colaborador.nome,
      competencia: bloco.competencia,
      paginaInicio: bloco.paginaInicio,
      paginaFim: bloco.paginaFim,
      jaExiste: existentesPorChave.has(`${colaborador.id}::${bloco.competencia}`),
    });
  }

  return {
    totalPaginas: textosPorPagina.length,
    blocosIdentificados,
    blocosSemCompetencia,
    cpfsNaoCasados,
    paginasSemCpf,
  };
}
