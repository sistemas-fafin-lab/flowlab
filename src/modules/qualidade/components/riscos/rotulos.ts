// Rótulos e badges compartilhados pelos componentes da aba Riscos — evita
// repetir os mesmos `Record<...>` em cada arquivo.

import type { NivelClassificacaoRisco, OrigemRisco } from '../../types';

export const ROTULO_NIVEL: Record<NivelClassificacaoRisco, string> = {
  baixo: 'Baixo',
  medio: 'Médio',
  alto: 'Alto',
  critico: 'Crítico',
};

export const BADGE_NIVEL: Record<NivelClassificacaoRisco, string> = {
  baixo: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
  medio: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
  alto: 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300',
  critico: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
};

export const ROTULO_ORIGEM: Record<OrigemRisco, string> = {
  nao_conformidade: 'Não conformidade',
  ocorrencia: 'Ocorrência',
  auditoria: 'Auditoria',
  indicador: 'Indicador',
  reclamacao: 'Reclamação',
  analise_preventiva: 'Análise preventiva',
  falha_equipamento: 'Falha de equipamento',
  mudanca_processo: 'Mudança de processo',
  fornecedor_parceiro: 'Fornecedor/parceiro',
  controle_qualidade: 'Controle de qualidade',
  outro: 'Outro',
};

export const campoInput = 'mt-1 w-full glass-field rounded-xl px-3 py-2 text-sm text-slate-800 dark:text-slate-200';
export const campoLabel = 'text-sm font-medium text-slate-700 dark:text-slate-300';
