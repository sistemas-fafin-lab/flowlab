/** Competência "2026-08-01" (dia 1, formato da coluna) -> "Agosto/2026". */
const MESES_LABEL = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

export const formatCompetenciaExtenso = (competencia: string): string => {
  const [ano, mes] = competencia.split('-');
  const indice = Number(mes) - 1;
  return MESES_LABEL[indice] ? `${MESES_LABEL[indice]}/${ano}` : competencia;
};
