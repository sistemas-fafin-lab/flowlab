// Formatação compartilhada pelo módulo de faturamento.
//
// `formatCurrency` já existia em src/utils/paymentUtils.ts e é reexportado daqui
// em vez de copiado: FaturasDashboard tinha uma cópia local, e uma terceira
// (dashboard + títulos + modais) garantiria que uma delas divergisse.

import type { AgingBucket } from '../types';

export { formatCurrency } from '../../../utils/paymentUtils';

/**
 * Data ISO (YYYY-MM-DD) no formato brasileiro.
 *
 * O `T00:00:00` é obrigatório: `new Date('2026-08-07')` é interpretado como
 * meia-noite UTC e, num fuso negativo como o de São Paulo, volta como 06/08.
 * Uma data de vencimento errando um dia muda o aging do título.
 */
export const formatData = (iso: string | null | undefined): string =>
  iso ? new Date(`${iso}T00:00:00`).toLocaleDateString('pt-BR') : '—';

/**
 * Timestamptz completo (ex.: `notas.updated_at`) em data + hora no padrão brasileiro.
 *
 * `timeZone` fixo em America/Sao_Paulo: sem isto, o horário sai no fuso do
 * dispositivo que roda o código (navegador do usuário, ou o runner de CI),
 * não no fuso da operação — que é sempre Brasil.
 */
export const formatDataHora = (iso: string | null | undefined): string =>
  iso
    ? new Date(iso).toLocaleString('pt-BR', {
        timeZone: 'America/Sao_Paulo',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '—';

/** Competência "2026-08" → "08/2026". */
export const formatCompetencia = (competencia: string | null | undefined): string => {
  if (!competencia) return '—';
  const [ano, mes] = competencia.split('-');
  return ano && mes ? `${mes}/${ano}` : competencia;
};

const paraIso = (data: Date): string =>
  `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}-${String(data.getDate()).padStart(2, '0')}`;

/** Data de hoje em ISO local (e não UTC, como faria toISOString). */
export const hojeIso = (): string => paraIso(new Date());

export interface PeriodoRange {
  desde: string;
  ate: string;
}

/**
 * Atalhos de período da aba Títulos (issue 40) — 1º ao último dia do mês/
 * trimestre em cima de "hoje", sempre em ISO local. Independem da coluna que
 * o filtro usa por baixo (vencimento): só preenchem o range da UI.
 */
export const periodoEsteMes = (): PeriodoRange => {
  const hoje = new Date();
  return {
    desde: paraIso(new Date(hoje.getFullYear(), hoje.getMonth(), 1)),
    ate: paraIso(new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0)),
  };
};

export const periodoMesPassado = (): PeriodoRange => {
  const hoje = new Date();
  return {
    desde: paraIso(new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1)),
    ate: paraIso(new Date(hoje.getFullYear(), hoje.getMonth(), 0)),
  };
};

export const periodoEsteTrimestre = (): PeriodoRange => {
  const hoje = new Date();
  const inicioTrimestre = Math.floor(hoje.getMonth() / 3) * 3;
  return {
    desde: paraIso(new Date(hoje.getFullYear(), inicioTrimestre, 1)),
    ate: paraIso(new Date(hoje.getFullYear(), inicioTrimestre + 3, 0)),
  };
};

/**
 * Texto do badge "protocolo duplicado" — lista os OUTROS lotes do mesmo grupo
 * (issue 13 do feedback: só a contagem não dizia quais; issue 22: precisa
 * ficar visível sem depender de hover para aparecer).
 */
export const protocoloDuplicadoLotesLabel = (
  lotes: number[] | null | undefined,
  contagem: number | null | undefined,
): string => {
  if (lotes && lotes.length > 0) return `lote(s) ${lotes.join(', ')}`;
  if (contagem) return `${contagem} lotes`;
  return '—';
};

/**
 * Dias entre hoje e o vencimento. Positivo = atrasado, null = sem vencimento.
 * Calculado em UTC nos dois lados para não sofrer com horário de verão.
 */
export const diasDeAtraso = (dataVencimento: string | null | undefined): number | null => {
  if (!dataVencimento) return null;
  const venc = Date.parse(`${dataVencimento}T00:00:00Z`);
  if (Number.isNaN(venc)) return null;
  const hoje = Date.parse(`${hojeIso()}T00:00:00Z`);
  return Math.round((hoje - venc) / 86_400_000);
};

/** Desloca uma data ISO em dias corridos, em UTC — mesmo motivo do UTC fixo
 *  em `diasDeAtraso`: sem isso, o range da faixa pode discordar em um dia do
 *  atraso calculado por `diasDeAtraso` perto da virada do dia. */
const deslocarDias = (iso: string, dias: number): string => {
  const data = new Date(`${iso}T00:00:00Z`);
  data.setUTCDate(data.getUTCDate() + dias);
  return data.toISOString().slice(0, 10);
};

export interface FaixaAgingRange {
  /** Início do range sobre `data_vencimento` (`.gte`), ou null quando a faixa não tem piso (+90 dias). */
  desde: string | null;
  /** Fim do range sobre `data_vencimento` (`.lte`), ou null quando a faixa não tem teto (a vencer). */
  ate: string | null;
  /** `a_vencer` também inclui título sem vencimento cadastrado — igual à RPC
   *  `fat_dashboard_receber` (`atraso IS NULL OR atraso <= 0`, ver
   *  20260903120000_aging_por_operadora.sql). Sem isso a lista do modal ficaria
   *  menor do que o total que o gráfico mostra para essa faixa. */
  incluirSemVencimento: boolean;
}

/**
 * Traduz a faixa de aging clicada no gráfico (issue 41) num range sobre
 * `data_vencimento` — o mesmo cálculo de `atraso = hoje - data_vencimento`
 * que a RPC `fat_dashboard_receber` faz no banco, só que em cima da coluna
 * real, para o modal de drill-down consultar `notas` direto sem RPC nova.
 */
export const faixaAgingParaRange = (bucket: AgingBucket, hoje: string = hojeIso()): FaixaAgingRange => {
  switch (bucket) {
    case 'a_vencer':
      return { desde: hoje, ate: null, incluirSemVencimento: true };
    case 'd1_30':
      return { desde: deslocarDias(hoje, -30), ate: deslocarDias(hoje, -1), incluirSemVencimento: false };
    case 'd31_60':
      return { desde: deslocarDias(hoje, -60), ate: deslocarDias(hoje, -31), incluirSemVencimento: false };
    case 'd61_90':
      return { desde: deslocarDias(hoje, -90), ate: deslocarDias(hoje, -61), incluirSemVencimento: false };
    case 'd90_mais':
      return { desde: null, ate: deslocarDias(hoje, -91), incluirSemVencimento: false };
  }
};
