// Nome do paciente do Orçamento — regras do lado da tela. Puro, para testar sem DOM.
// A IA só sugere o nome lido no pedido; quem vale é o que o atendente confirma, e o PDF
// só sai com o nome confirmado. Nada disso é gravado: vive no estado da página.

/** Teto do campo; o servidor corta a leitura da IA no mesmo tamanho (leituraPedidoMedico.ts). */
export const MAX_CARACTERES_PACIENTE = 100;

export interface PacienteDoOrcamento {
  nome: string;
  confirmado: boolean;
}

export const SEM_PACIENTE: PacienteDoOrcamento = { nome: '', confirmado: false };

/** Compara nomes sem diferença de espaços, acentos ou maiúsculas. */
const chaveDoNome = (nome: string) =>
  nome.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim().toLowerCase();

/** O nome tem texto de verdade (não vazio nem só espaços). */
export const nomeValido = (nome: string): boolean => nome.trim().length > 0;

/** O atendente mexeu no texto: o que estava confirmado deixa de valer. */
export function editarPaciente(nome: string): PacienteDoOrcamento {
  return { nome, confirmado: false };
}

/** O atendente confirmou o nome. Sem texto, não há o que confirmar. */
export function confirmarPaciente(atual: PacienteDoOrcamento): PacienteDoOrcamento {
  return nomeValido(atual.nome) ? { nome: atual.nome.trim(), confirmado: true } : atual;
}

/**
 * Aplica o nome que a IA leu num pedido. Sem nome lido, nada muda. Nome igual ao que já
 * está no campo mantém a confirmação; nome diferente entra no campo e exige confirmar de
 * novo — o orçamento nunca sai com o nome de outro paciente sem o atendente ver.
 */
export function sugerirPaciente(atual: PacienteDoOrcamento, nomeLido: string | null): PacienteDoOrcamento {
  if (!nomeLido || !nomeValido(nomeLido)) return atual;
  if (chaveDoNome(atual.nome) === chaveDoNome(nomeLido)) return atual;
  return { nome: nomeLido.trim(), confirmado: false };
}
