// Regras puras do formulário de leitura de temperatura — registro e edição
// compartilham as mesmas validações. Recebe `agora` por parâmetro quando
// precisa do instante atual, para ser testável sem relógio global.

// Texto digitado ('24,5' | '24.5' | '24') → número; vazio/espacos/inválido → null.
export const normalizarTemperatura = (texto: string): number | null => {
  if (texto.trim() === '') return null;
  const n = Number(texto.replace(',', '.'));
  return Number.isNaN(n) ? null : n;
};

// O que o formulário de leitura contém antes de validar.
export interface LeituraInput {
  temperatura: string; // como digitado (aceita vírgula)
  registradoPor: string;
  dataHora: string; // 'YYYY-MM-DDTHH:MM' local (valor de datetime-local)
  frascos: { quantidade: number }[]; // só quantidades > 0
}

// Valida o formulário completo e devolve a mensagem de erro ou null.
// A data/hora não pode estar no futuro, com tolerância de 1 min para
// diferenças de relógio (mesma regra do fluxo de registro original).
export const validarLeitura = (input: LeituraInput, agora: Date = new Date()): string | null => {
  if (normalizarTemperatura(input.temperatura) === null) return 'Informe a temperatura lida.';
  if (!input.registradoPor.trim()) return 'Informe quem registrou.';
  if (!input.dataHora) return 'Informe a data e hora da leitura.';
  const quando = new Date(input.dataHora);
  if (Number.isNaN(quando.getTime())) return 'Data e hora inválidas.';
  if (quando.getTime() > agora.getTime() + 60_000) {
    return 'A data e hora não podem estar no futuro.';
  }
  // Quantidade de frasco é sempre inteira — o banco rejeita decimal e isso
  // derrubaria a leitura inteira junto, então barra aqui antes de gravar.
  if (input.frascos.some((f) => !Number.isInteger(f.quantidade))) {
    return 'A quantidade de frascos deve ser um número inteiro.';
  }
  return null;
};

// Valor para <input type="datetime-local"> no fuso local: 'YYYY-MM-DDTHH:MM'.
export const toDatetimeLocal = (d: Date) => {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
