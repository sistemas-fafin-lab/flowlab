/**
 * Texto do erro para a tela. O erro do Supabase (PostgrestError) é um objeto simples, não um
 * Error: lido como Error, a mensagem do banco se perdia e a tela mostrava um texto genérico.
 */
export function mensagemDoErro(err: unknown, padrao: string): string {
  if (err instanceof Error && err.message) return err.message;
  if (err && typeof err === 'object' && 'message' in err && typeof err.message === 'string' && err.message) {
    const codigo = 'code' in err && typeof err.code === 'string' && err.code ? ` (código ${err.code})` : '';
    return `${err.message}${codigo}`;
  }
  return padrao;
}
