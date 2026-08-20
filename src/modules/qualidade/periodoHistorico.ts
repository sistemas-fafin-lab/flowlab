function dois(n: number): string {
  return String(n).padStart(2, '0');
}

/**
 * Único ponto deste helper que lê o relógio — usado apenas para o intervalo
 * padrão de um gráfico de tendência ("últimos N meses até hoje"), nunca
 * dentro de regra de negócio (P4). O período em si continua um parâmetro
 * explícito passado à consulta.
 */
function hoje(): { ano: number; mes: number; dia: number } {
  const agora = new Date();
  return { ano: agora.getFullYear(), mes: agora.getMonth() + 1, dia: agora.getDate() };
}

/** Intervalo dos últimos `quantidadeMeses` meses (incluindo o mês corrente, até hoje). */
export function intervaloUltimosMeses(quantidadeMeses: number): { inicio: string; fim: string } {
  const { ano, mes, dia } = hoje();

  let anoInicio = ano;
  let mesInicio = mes - (quantidadeMeses - 1);
  while (mesInicio < 1) {
    mesInicio += 12;
    anoInicio -= 1;
  }

  return {
    inicio: `${anoInicio}-${dois(mesInicio)}-01`,
    fim: `${ano}-${dois(mes)}-${dois(dia)}`,
  };
}
