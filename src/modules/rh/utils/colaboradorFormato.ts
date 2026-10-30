/** "Mariana Costa Ribeiro" -> "MR" (primeiro e último nome). */
export const iniciais = (nome: string): string => {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return '?';
  const primeira = partes[0][0];
  const ultima = partes.length > 1 ? partes[partes.length - 1][0] : '';
  return `${primeira}${ultima}`.toUpperCase();
};

/** "Mariana Costa Ribeiro" -> "Mariana Ribeiro". */
export const nomeCurto = (nome: string): string => {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  if (partes.length <= 2) return partes.join(' ');
  return `${partes[0]} ${partes[partes.length - 1]}`;
};

/** "2026-03-05" -> "05/03/2026"; null/vazio/formato inválido -> null. */
export const formatDataBR = (iso: string | null | undefined): string | null => {
  if (!iso) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : null;
};

/** Data local de hoje como "YYYY-MM-DD" (não UTC — evita virar o dia antes da hora em America/Sao_Paulo). */
export const dataDeHojeISO = (agora: Date = new Date()): string =>
  `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, '0')}-${String(agora.getDate()).padStart(2, '0')}`;

/** Mensagem de erro para data "YYYY-MM-DD" que não pode ser futura; null se ok ou vazia. */
export const validarDataNaoFutura = (valor: string | null, rotulo: string, hoje: string = dataDeHojeISO()): string | null => {
  if (!valor) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(valor) || Number.isNaN(new Date(`${valor}T00:00:00`).getTime())) {
    return `${rotulo} inválida.`;
  }
  if (valor > hoje) return `${rotulo} não pode ser uma data futura.`;
  return null;
};
