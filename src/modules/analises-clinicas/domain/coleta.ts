// O que o operador vê da coleta num agendamento já coletado. Sem coleta →
// null (nada a exibir). Observações em branco são tratadas como ausentes —
// quem não preencheu não quer ruído na tela.
import type { AcColeta } from '../types';

export interface ResumoColeta {
  coletadoPor: string;
  coletadoEm: string; // ISO original; a formatação fica na UI
  observacoes: string | null;
}

export const resumoColeta = (coleta: AcColeta | null): ResumoColeta | null => {
  if (!coleta) return null;
  const observacoes = coleta.observacoes?.trim() || null;
  return { coletadoPor: coleta.coletado_por, coletadoEm: coleta.coletado_em, observacoes };
};
