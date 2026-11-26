// Contas de data da grade do mês (GradeMes) e do Calendário de envios.
// Datas em ISO (`YYYY-MM-DD`) e meses em `YYYY-MM`, sempre em UTC para não
// escorregar de dia com o fuso.

export const DIAS_SEMANA = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex'] as const;

const NOME_MES = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric', timeZone: 'UTC' });

export const dataUtc = (iso: string): Date => new Date(`${iso}T00:00:00Z`);

export const somarDias = (iso: string, dias: number): string => {
  const d = dataUtc(iso);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
};

export const somarMeses = (mes: string, meses: number): string => {
  const [ano, numero] = mes.split('-').map(Number);
  const d = new Date(Date.UTC(ano, numero - 1 + meses, 1));
  return d.toISOString().slice(0, 7);
};

/** "Novembro de 2026". */
export const nomeMes = (mes: string): string => {
  const nome = NOME_MES.format(dataUtc(`${mes}-01`));
  return nome.charAt(0).toUpperCase() + nome.slice(1);
};

/** Só o nome do mês, em minúsculas ("dezembro"), para os botões. */
export const nomeCurtoMes = (mes: string): string => nomeMes(mes).split(' ')[0].toLowerCase();

/**
 * Semanas do mês só de segunda a sexta: cada semana tem 5 dias, e os que caem
 * fora do mês ficam null (a primeira e a última semana podem ter buracos).
 */
export function semanasDoMes(mes: string): (string | null)[][] {
  const primeiro = `${mes}-01`;
  // Volta até a segunda-feira da semana do dia 1 (getUTCDay: 0 = domingo).
  let segunda = somarDias(primeiro, -((dataUtc(primeiro).getUTCDay() + 6) % 7));
  const semanas: (string | null)[][] = [];
  while (segunda.slice(0, 7) <= mes) {
    const dias = DIAS_SEMANA.map((_, i) => somarDias(segunda, i)).map((d) => (d.slice(0, 7) === mes ? d : null));
    if (dias.some(Boolean)) semanas.push(dias);
    segunda = somarDias(segunda, 7);
  }
  return semanas;
}
