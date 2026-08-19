// Formatação compartilhada pelo módulo de faturamento.
//
// `formatCurrency` já existia em src/utils/paymentUtils.ts e é reexportado daqui
// em vez de copiado: FaturasDashboard tinha uma cópia local, e uma terceira
// (dashboard + títulos + modais) garantiria que uma delas divergisse.

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

/** Data de hoje em ISO local (e não UTC, como faria toISOString). */
export const hojeIso = (): string => {
  const hoje = new Date();
  return `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-${String(hoje.getDate()).padStart(2, '0')}`;
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
