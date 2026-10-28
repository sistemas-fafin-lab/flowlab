// Janelas das Regras de envio do Calendário de envios
// (.scratch/faturamento-calendario-envios/spec.md): descrição legível no cadastro e
// na tela. A validação e o cálculo de dia útil são do servidor
// (api/_lib/faturamento/calendarioEnvios.ts).

import type { JanelaEnvio } from '../types';

export type TipoJanelaEnvio = JanelaEnvio['tipo'];

/** Os tipos de janela, na ordem do cadastro. */
export const TIPOS_JANELA_ENVIO: { tipo: TipoJanelaEnvio; label: string }[] = [
  { tipo: 'dias_corridos', label: 'Faixa de dias corridos' },
  { tipo: 'dias_uteis', label: 'Faixa de dias úteis' },
  { tipo: 'dias_fixos', label: 'Dias fixos' },
  { tipo: 'ultimo_dia_util', label: 'Último dia útil' },
  { tipo: 'todos_os_dias', label: 'Todos os dias' },
  { tipo: 'calendario_convenio', label: 'Calendário do convênio' },
];

/** "3", "3 e 16", "3, 16 e 25". */
function listarDias(dias: number[]): string {
  const ordenados = [...dias].sort((a, b) => a - b).map(String);
  if (ordenados.length <= 1) return ordenados.join('');
  return `${ordenados.slice(0, -1).join(', ')} e ${ordenados[ordenados.length - 1]}`;
}

/** "Dias 1 ao 15", "1º ao 5º dia útil", "Dias 3 e 16", "Último dia útil"… */
export function descreverJanela(janela: JanelaEnvio): string {
  switch (janela.tipo) {
    case 'dias_corridos':
      return janela.de === janela.ate ? `Dia ${janela.de}` : `Dias ${janela.de} ao ${janela.ate}`;
    case 'dias_uteis':
      return janela.de === janela.ate ? `${janela.de}º dia útil` : `${janela.de}º ao ${janela.ate}º dia útil`;
    case 'dias_fixos':
      return `${janela.dias.length === 1 ? 'Dia' : 'Dias'} ${listarDias(janela.dias)}`;
    case 'ultimo_dia_util':
      return 'Último dia útil';
    case 'todos_os_dias':
      return 'Todos os dias';
    case 'calendario_convenio':
      return 'Calendário do convênio';
  }
}
