// Regras da aba Departamentos do RH. O banco é a guarda definitiva (índice único
// em lower(btrim(nome)) e trigger de desativação, ver 20261020215000); aqui é o
// mesmo critério para avisar antes de salvar.

import type { ColaboradorStatus, Departamento, SituacaoGestor } from '../types';

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

// ─── Gestores que autorizam pagamentos (20261023120000) ────────────────────────
// O banco decide (departamento_autorizadores_pagamento) e barra a saída do último gestor;
// aqui é a mesma leitura, para a tela avisar antes.

export const ROTULO_SITUACAO_GESTOR: Record<SituacaoGestor, string> = {
  apto: 'Apto',
  desligado: 'Desligado',
  sem_login: 'Sem login',
  usuario_inativo: 'Usuário inativo',
  sem_permissao: 'Cargo sem "Ser Autorizador de Pagamentos"',
};

export const chaveGestor = (departamentoId: string, colaboradorId: string): string => `${departamentoId}:${colaboradorId}`;

/** Responsáveis marcados e aptos: quem de fato autoriza os pagamentos do departamento. */
export function autorizadoresAptos(
  departamento: Pick<Departamento, 'id' | 'autorizaPagamentosIds'>,
  situacoes: Record<string, SituacaoGestor>,
): string[] {
  return departamento.autorizaPagamentosIds.filter((id) => situacoes[chaveGestor(departamento.id, id)] === 'apto');
}

/** Departamentos ativos sem nenhum gestor apto: quem está neles não consegue pedir pagamento. */
export function departamentosSemAutorizador<T extends Pick<Departamento, 'id' | 'nome' | 'ativo' | 'autorizaPagamentosIds'>>(
  departamentos: T[],
  situacoes: Record<string, SituacaoGestor>,
): T[] {
  return departamentos.filter((d) => d.ativo && autorizadoresAptos(d, situacoes).length === 0).sort(porNome);
}

export interface GestorComDepartamentos<C> {
  colaborador: C;
  departamentos: { id: string; nome: string; ativo: boolean; autorizaPagamentos: boolean }[];
}

/** Visão "por gestor": cada responsável com os departamentos pelos quais responde. */
export function gestoresComDepartamentos<C extends { id: string; nome: string }>(
  departamentos: Pick<Departamento, 'id' | 'nome' | 'ativo' | 'responsavelIds' | 'autorizaPagamentosIds'>[],
  colaboradores: C[],
): GestorComDepartamentos<C>[] {
  const porId = new Map(colaboradores.map((c) => [c.id, c]));
  const grupos = new Map<string, GestorComDepartamentos<C>>();
  for (const d of [...departamentos].sort(porNome)) {
    for (const id of d.responsavelIds) {
      const colaborador = porId.get(id);
      if (!colaborador) continue;
      const grupo = grupos.get(id) ?? { colaborador, departamentos: [] };
      grupo.departamentos.push({ id: d.id, nome: d.nome, ativo: d.ativo, autorizaPagamentos: d.autorizaPagamentosIds.includes(id) });
      grupos.set(id, grupo);
    }
  }
  return [...grupos.values()].sort((a, b) => porNome(a.colaborador, b.colaborador));
}
