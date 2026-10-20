// Regras da aba Departamentos do RH. O banco é a guarda definitiva (índice único
// em lower(btrim(nome)) e trigger de desativação, ver 20261020215000); aqui é o
// mesmo critério para avisar antes de salvar.

import type { ColaboradorStatus } from '../types';

/** Comparador por nome, em português (acentos e maiúsculas). */
export const porNome = (a: { nome: string }, b: { nome: string }): number => a.nome.localeCompare(b.nome, 'pt-BR');

const chaveDoNome = (nome: string): string => nome.trim().toLowerCase();

/** Mensagem de erro do nome, ou null se pode salvar. `idAtual` é o departamento sendo renomeado. */
export function validarNomeDepartamento(
  nome: string,
  departamentos: { id: string; nome: string }[],
  idAtual?: string,
): string | null {
  if (!nome.trim()) return 'Informe o nome do departamento.';
  const repetido = departamentos.some((d) => d.id !== idAtual && chaveDoNome(d.nome) === chaveDoNome(nome));
  return repetido ? 'Já existe um departamento com esse nome.' : null;
}

/** Desativar é bloqueado enquanto houver colaborador ativo no departamento. Mensagem, ou null se pode. */
export function bloqueioDesativarDepartamento(
  departamentoId: string,
  colaboradores: { departamentoId: string | null; status: ColaboradorStatus }[],
): string | null {
  const ativos = colaboradores.filter((c) => c.departamentoId === departamentoId && c.status === 'ativo').length;
  if (ativos === 0) return null;
  return ativos === 1
    ? 'Não é possível desativar: 1 colaborador ativo ainda está neste departamento.'
    : `Não é possível desativar: ${ativos} colaboradores ativos ainda estão neste departamento.`;
}

/** Pendência da aba: colaboradores ativos sem departamento, em ordem de nome. */
export function colaboradoresSemDepartamento<
  T extends { nome: string; departamentoId: string | null; status: ColaboradorStatus },
>(colaboradores: T[]): T[] {
  return colaboradores
    .filter((c) => c.status === 'ativo' && !c.departamentoId)
    .sort(porNome);
}
