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

// ─── Edição de um agendamento já coletado ─────────────────────────────────────
// O que o formulário de edição entrega (strings cruas dos inputs) e o que segue
// para a RPC editar_coleta. A RPC revalida tudo; isto existe para o operador ver
// o erro antes de salvar.
export interface FormEdicaoColeta {
  pacienteNome: string;
  telefone: string; // com ou sem máscara; vazio = sem telefone
  coletadoPor: string;
  coletadoEm: string; // valor de datetime-local ('YYYY-MM-DDTHH:mm'), fuso local
  observacoes: string;
  validadeOk: boolean | null;
  etiquetado: boolean | null;
}

export interface EdicaoColeta {
  pacienteNome: string;
  telefone: string | null; // só dígitos
  coletadoPor: string;
  coletadoEm: string; // ISO 8601
  observacoes: string | null;
  validadeOk: boolean | null;
  etiquetado: boolean | null;
}

// Telefone BR: 10 (fixo) ou 11 (celular) dígitos, tolerando DDI +55.
const telefoneOk = (digitos: string): boolean => {
  const d = digitos.length === 12 || digitos.length === 13 ? digitos.replace(/^55/, '') : digitos;
  return d.length === 10 || d.length === 11;
};

export const validarEdicaoColeta = (
  form: FormEdicaoColeta,
  agora: Date = new Date(),
): { erro: string } | { dados: EdicaoColeta } => {
  const pacienteNome = form.pacienteNome.trim().replace(/\s+/g, ' ');
  if (!pacienteNome) return { erro: 'Informe o nome do paciente.' };

  const telefone = form.telefone.replace(/\D/g, '');
  if (telefone && !telefoneOk(telefone)) return { erro: 'Telefone inválido — inclua o DDD.' };

  const coletadoPor = form.coletadoPor.trim();
  if (!coletadoPor) return { erro: 'Informe quem coletou.' };

  const coletadoEm = form.coletadoEm ? new Date(form.coletadoEm) : null;
  if (!coletadoEm || Number.isNaN(coletadoEm.getTime())) {
    return { erro: 'Informe a data e a hora da coleta.' };
  }
  if (coletadoEm.getTime() > agora.getTime()) {
    return { erro: 'A data da coleta não pode estar no futuro.' };
  }

  return {
    dados: {
      pacienteNome,
      telefone: telefone || null,
      coletadoPor,
      coletadoEm: coletadoEm.toISOString(),
      observacoes: form.observacoes.trim() || null,
      validadeOk: form.validadeOk,
      etiquetado: form.etiquetado,
    },
  };
};
