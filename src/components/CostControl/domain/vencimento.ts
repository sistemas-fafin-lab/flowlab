// ═══════════════════════════════════════════════════════════════════════════════
// Vencimento do contrato de uma tabela associada
// (.scratch/controle-custos-tabela-associada/spec.md). Só aviso: tabela
// vencida continua valendo no orçamento e na importação. Datas em ISO
// (YYYY-MM-DD), como o Postgres devolve a coluna `date` — comparar dias, não
// instantes, evita o vencimento "andar" um dia por causa do fuso.
// ═══════════════════════════════════════════════════════════════════════════════

export type SituacaoVencimento = 'vencida' | 'a_vencer' | 'em_dia' | 'sem_vencimento';

export const DIAS_AVISO_VENCIMENTO = 30;

const diasEntre = (de: string, ate: string): number =>
  Math.round((Date.parse(`${ate}T00:00:00Z`) - Date.parse(`${de}T00:00:00Z`)) / 86_400_000);

/** vencida (antes de hoje) | a_vencer (de hoje até 30 dias) | em_dia | sem_vencimento. */
export const situacaoVencimento = (vencimento: string | null, hoje: string): SituacaoVencimento => {
  if (!vencimento) return 'sem_vencimento';
  const dias = diasEntre(hoje, vencimento);
  if (dias < 0) return 'vencida';
  if (dias <= DIAS_AVISO_VENCIMENTO) return 'a_vencer';
  return 'em_dia';
};

/** Vencida ou vencendo — o recorte do filtro "Vencidas / a vencer". */
export const pedeAtencao = (situacao: SituacaoVencimento): boolean =>
  situacao === 'vencida' || situacao === 'a_vencer';

/** Data de hoje no fuso do navegador, em ISO — o "hoje" de situacaoVencimento. */
export const hojeISO = (agora: Date = new Date()): string => {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${agora.getFullYear()}-${pad(agora.getMonth() + 1)}-${pad(agora.getDate())}`;
};
