// api/_lib/errors.ts
// Descrição de erros para log nas Vercel Serverless Functions.

/**
 * Descreve um erro capturado, para ir ao log do servidor.
 *
 * `err instanceof Error` não cobre os erros do PostgREST/supabase-js, que são
 * objetos simples ({ message, code, details, hint }): sem isso, uma query que
 * falha vira "Erro desconhecido" no log e o 500 fica sem diagnóstico.
 *
 * Nunca devolva isto ao cliente — a mensagem expõe detalhes do schema.
 */
export function describeError(err: unknown): string {
  if (err instanceof Error) return err.message;

  if (err && typeof err === 'object') {
    const o = err as Record<string, unknown>;
    if (typeof o.message === 'string') {
      const extras = (['code', 'details', 'hint'] as const)
        .filter((k) => o[k] !== null && o[k] !== undefined && o[k] !== '')
        .map((k) => `${k}=${String(o[k])}`)
        .join(' ');
      return extras ? `${o.message} (${extras})` : o.message;
    }
    try {
      return JSON.stringify(err);
    } catch {
      return String(err); // referência circular, getter que lança, etc.
    }
  }

  return String(err);
}
