// Utilitários de CPF compartilhados (cadastro de usuário, autenticação).

/** Remove tudo que não for dígito. */
export const normalizeCPF = (value: string): string =>
  value.replace(/\D/g, "").trim();

/** Aplica a máscara 000.000.000-00 conforme o usuário digita. */
export const formatCPF = (value: string): string => {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  return digits
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
};

/** Valida um CPF (com ou sem máscara) pelos dígitos verificadores. */
export const validateCPF = (cpf: string): boolean => {
  const digits = normalizeCPF(cpf);
  if (digits.length !== 11 || /^(\d)\1+$/.test(digits)) return false;
  const calc = (n: number) => {
    const sum = digits
      .slice(0, n)
      .split("")
      .reduce((acc, d, i) => acc + +d * (n + 1 - i), 0);
    const rem = (sum * 10) % 11;
    return rem === 10 || rem === 11 ? 0 : rem;
  };
  return calc(9) === +digits[9] && calc(10) === +digits[10];
};
