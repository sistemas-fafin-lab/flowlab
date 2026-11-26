// Ausências da equipe (D40, issue 29): férias, licença, folga. Marcadas na aba Membros ou pelo
// WhatsApp ("vou estar de férias de 01/12 a 05/12"). No período, a pessoa não recebe cobrança e sai
// da conta de sobrecarga; o relatório de gestão avisa dos cards dela que vencem nesse tempo.
// Pura; a api/ (NodeNext) importa: os imports levam ".js".
import { diferencaDias, formatarDiaMes, type Dia } from './datas.js';

export interface Ausencia {
  ausente_de: Dia | null;
  /** Último dia, incluso. null = sem ausência marcada. */
  ausente_ate: Dia | null;
  ausencia_motivo?: string | null;
}

/** Até onde dá para marcar de uma vez (licenças longas são marcadas de novo). */
export const MAX_AUSENCIA_DIAS = 120;
/** O relatório avisa da ausência que começa nos próximos dias, para o gestor se preparar. */
export const AVISO_AUSENCIA_DIAS = 7;

const DIA = /^\d{4}-\d{2}-\d{2}$/;

export const estaAusente = (a: Ausencia, hoje: Dia): boolean =>
  !!a.ausente_ate && hoje <= a.ausente_ate && (!a.ausente_de || hoje >= a.ausente_de);

/** Já começou ou começa em até `dias` dias, e ainda não terminou. */
export const ausenciaProxima = (a: Ausencia, hoje: Dia, dias = AVISO_AUSENCIA_DIAS): boolean =>
  !!a.ausente_ate && a.ausente_ate >= hoje && (!a.ausente_de || diferencaDias(hoje, a.ausente_de) <= dias);

/** O primeiro dia que conta (de, ou hoje quando já começou ou não tem início). */
export const inicioDaAusencia = (a: Ausencia, hoje: Dia): Dia => (a.ausente_de && a.ausente_de > hoje ? a.ausente_de : hoje);

/** "de férias até 05/12", "ausente de 01/12 a 05/12 (licença)". */
export function descreverAusencia(a: Ausencia, hoje: Dia): string {
  if (!a.ausente_ate) return '';
  const motivo = (a.ausencia_motivo ?? '').trim();
  const ferias = /f[ée]rias/i.test(motivo);
  const periodo = a.ausente_de && a.ausente_de > hoje
    ? `de ${formatarDiaMes(a.ausente_de)} a ${formatarDiaMes(a.ausente_ate)}`
    : `até ${formatarDiaMes(a.ausente_ate)}`;
  return `${ferias ? 'de férias' : 'ausente'} ${periodo}${motivo && !ferias ? ` (${motivo})` : ''}`;
}

export type AusenciaValidada = { ok: true; de: Dia; ate: Dia } | { ok: false; erro: string };

/** O período pedido (pela tela ou pela IA): datas válidas, sem passado, até 120 dias. */
export function validarAusencia(de: string | null | undefined, ate: string | null | undefined, hoje: Dia): AusenciaValidada {
  const inicio = (de ?? '').trim() || hoje;
  const fim = (ate ?? '').trim();
  if (!DIA.test(fim) || Number.isNaN(Date.parse(fim))) return { ok: false, erro: 'Até quando? Diga o último dia (ex.: "até 05/12").' };
  if (!DIA.test(inicio) || Number.isNaN(Date.parse(inicio))) return { ok: false, erro: 'Não entendi o primeiro dia da ausência.' };
  if (fim < hoje) return { ok: false, erro: `O último dia (${formatarDiaMes(fim)}) já passou.` };
  if (fim < inicio) return { ok: false, erro: 'O último dia vem antes do primeiro.' };
  if (diferencaDias(inicio, fim) > MAX_AUSENCIA_DIAS) return { ok: false, erro: `Marco no máximo ${MAX_AUSENCIA_DIAS} dias de uma vez.` };
  return { ok: true, de: inicio, ate: fim };
}
