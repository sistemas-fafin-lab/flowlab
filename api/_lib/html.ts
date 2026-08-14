// api/_lib/html.ts
// Escape de HTML para variáveis interpoladas em templates de email
// (renderTemplate em api/_lib/email.ts faz substituição simples, sem escapar).

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string),
  );
}
