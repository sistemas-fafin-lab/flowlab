// Utilitário de data mínimo compartilhado entre módulos (faturamento,
// analises-clinicas). Mantenha aqui SÓ o que mais de um módulo precisa.

// Chave local YYYY-MM-DD de um Date (fuso do navegador).
export const dayKey = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
