// Rótulos e badges compartilhados pelos componentes da aba Riscos — evita
// repetir os mesmos `Record<...>` em cada arquivo.

import type {
  NivelClassificacaoRisco,
  OrigemRisco,
  ResultadoTesteContingencia,
  RiscoDTO,
  StatusPlanoAcao,
  StatusPlanoContingencia,
  TratamentoRisco,
} from '../../types';

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

/** Split manual (sem `new Date`) — não sofre deslocamento de fuso horário ao formatar uma data `YYYY-MM-DD` vinda do banco. */
export function formatarDataCurta(iso: string): string {
  const [ano, mes, dia] = iso.slice(0, 10).split('-');
  return dia && mes && ano ? `${dia}/${mes}/${ano}` : iso;
}

export const ROTULO_TRATAMENTO: Record<TratamentoRisco, string> = {
  aceitar: 'Aceitar',
  monitorar: 'Monitorar',
  reduzir: 'Reduzir',
  eliminar: 'Eliminar',
  transferir: 'Transferir',
};

export const ROTULO_STATUS_PLANO: Record<StatusPlanoAcao, string> = {
  planejado: 'Planejado',
  em_andamento: 'Em andamento',
  concluido: 'Concluído',
};

export const BADGE_STATUS_PLANO: Record<StatusPlanoAcao, string> = {
  planejado: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200',
  em_andamento: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
  concluido: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
};

export const ROTULO_STATUS_CONTINGENCIA: Record<StatusPlanoContingencia, string> = {
  ativo: 'Ativo',
  em_revisao: 'Em revisão',
  inativo: 'Inativo',
};

export const BADGE_STATUS_CONTINGENCIA: Record<StatusPlanoContingencia, string> = {
  ativo: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
  em_revisao: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
  inativo: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400',
};

export const ROTULO_RESULTADO_TESTE: Record<ResultadoTesteContingencia, string> = {
  aprovado: 'Aprovado',
  aprovado_com_ressalvas: 'Aprovado com ressalvas',
  reprovado: 'Reprovado',
};

export const BADGE_RESULTADO_TESTE: Record<ResultadoTesteContingencia, string> = {
  aprovado: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
  aprovado_com_ressalvas: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
  reprovado: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
};

/**
 * Mesma leitura de cor de `BADGE_NIVEL` (Tailwind), em hex — para uso em SVG
 * (heatmap), onde classe Tailwind não se aplica. Mantido igual ao badge (não
 * a paleta de status da skill dataviz) de propósito: é o mesmo Nível exibido
 * na tabela/drawer ao lado, teria que ser visualmente idêntico.
 */
export const COR_NIVEL_HEX: Record<NivelClassificacaoRisco, string> = {
  baixo: '#22c55e',
  medio: '#f59e0b',
  alto: '#f97316',
  critico: '#ef4444',
};

/**
 * Paleta categórica de referência da skill dataviz (8 tons, ordem fixa —
 * validada contra separação por daltonismo e contraste; nunca reordenar nem
 * ciclar). Usada como default para a série de um risco no gráfico de
 * incidência enquanto ninguém escolheu uma cor manualmente.
 */
export const PALETA_COR_RISCO_DEFAULT: readonly { light: string; dark: string }[] = [
  { light: '#2a78d6', dark: '#3987e5' }, // blue
  { light: '#eb6834', dark: '#d95926' }, // orange
  { light: '#1baf7a', dark: '#199e70' }, // aqua
  { light: '#eda100', dark: '#c98500' }, // yellow
  { light: '#e87ba4', dark: '#d55181' }, // magenta
  { light: '#008300', dark: '#008300' }, // green
  { light: '#4a3aa7', dark: '#9085e9' }, // violet
  { light: '#e34948', dark: '#e66767' }, // red
];

/** Determinístico: o mesmo `riscoId` sempre cai no mesmo índice da paleta, entre renders/sessões. */
function hashRisco(id: string): number {
  let soma = 0;
  for (let i = 0; i < id.length; i++) soma += id.charCodeAt(i);
  return soma;
}

/**
 * Cor efetiva da série do risco no gráfico: a escolhida manualmente
 * (`risco.cor`, mesmo valor nos dois temas — o `<input type="color">` só
 * produz 1 hex), ou o par light/dark da paleta default por hash do id.
 */
export function corDoRisco(risco: Pick<RiscoDTO, 'id' | 'cor'>): { light: string; dark: string } {
  if (risco.cor) return { light: risco.cor, dark: risco.cor };
  return PALETA_COR_RISCO_DEFAULT[hashRisco(risco.id) % PALETA_COR_RISCO_DEFAULT.length]!;
}
