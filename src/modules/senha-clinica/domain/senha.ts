// Regra de senha do Laudo Web, a mesma que o apLIS valida ao salvar a instituição
// (cópia de validarSenhaLaudoWeb em api/_lib/aplisSite/instituicaoForm.ts — o servidor
// confere de novo): ao menos 8 caracteres, uma letra e um número, sem espaços.

export function validarSenha(senha: string): string | null {
  if (senha.length < 8) return 'A senha precisa ter pelo menos 8 caracteres.';
  if (!/[A-Za-z]/.test(senha)) return 'A senha precisa ter pelo menos uma letra.';
  if (!/[0-9]/.test(senha)) return 'A senha precisa ter pelo menos um número.';
  if (/\s/.test(senha)) return 'A senha não pode ter espaços.';
  return null;
}

// Sem caracteres que se confundem ao ditar ou ler (0/O, 1/l/I).
const LETRAS = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ';
const DIGITOS = '23456789';

/** Senha aleatória de `tamanho` caracteres que passa na regra (letras e ao menos 2 dígitos). */
export function gerarSenha(tamanho = 10, aleatorio: (n: number) => number = sortear): string {
  const escolher = (fonte: string) => fonte[aleatorio(fonte.length)];
  const chars = Array.from({ length: tamanho }, (_, i) => (i < 2 ? escolher(DIGITOS) : escolher(LETRAS + DIGITOS)));
  // Embaralha (Fisher–Yates) para os dígitos garantidos não ficarem sempre no começo.
  for (let i = chars.length - 1; i > 0; i--) {
    const j = aleatorio(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  const senha = chars.join('');
  return validarSenha(senha) === null ? senha : gerarSenha(tamanho, aleatorio);
}

function sortear(n: number): number {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return buf[0] % n;
}

/** Texto pronto para mandar à clínica (WhatsApp/e-mail) depois do reset. */
export function mensagemAcesso(clinica: string, usuario: string, senha: string): string {
  return [`Acesso ao Laudo Web — ${clinica}`, `Usuário: ${usuario}`, `Senha: ${senha}`].join('\n');
}
