// ─── Resolução obrigatória dos chamados de TI ─────────────────────────────────
// Chamado (is_internal = false) só vira "Resolvido" com um texto dizendo o que foi
// feito. O banco garante (trigger de 20261023120000_it_chamados_resolucao_anexos);
// aqui ficam a mesma regra para as telas e o bloco do e-mail de conclusão.

export const RESOLUCAO_MIN_CARACTERES = 10;
export const RESOLUCAO_MAX_CARACTERES = 4000;

/** Mensagem do problema com o texto, ou null quando ele pode ser gravado. */
export function validarResolucao(texto: string): string | null {
  const t = texto.trim();
  if (!t) return 'Descreva o que foi feito para resolver o chamado.';
  if (t.length < RESOLUCAO_MIN_CARACTERES) {
    return `Detalhe um pouco mais (mínimo de ${RESOLUCAO_MIN_CARACTERES} caracteres).`;
  }
  if (t.length > RESOLUCAO_MAX_CARACTERES) {
    return `Resuma em até ${RESOLUCAO_MAX_CARACTERES} caracteres.`;
  }
  return null;
}

/**
 * Levar este item para "Resolvido" pede o texto? Sim para chamado que ainda não
 * está resolvido; tarefa interna da TI, não — a mesma regra do trigger.
 */
export function exigeResolucao(item: { is_internal?: boolean | null; status: string }): boolean {
  return !item.is_internal && item.status !== 'resolved';
}

export function escaparHtml(texto: string): string {
  return texto
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const FONTE = "font-family:'Segoe UI',Arial,sans-serif;";

/**
 * HTML da variável {{resolution_block}} do template it_ticket_resolved. O render
 * do e-mail não escapa nada, então o texto sai escapado daqui. Sem texto, vazio.
 */
export function blocoResolucaoEmail(texto: string | null | undefined, qtdAnexos = 0): string {
  const t = (texto ?? '').trim();
  if (!t) return '';
  const anexos =
    qtdAnexos > 0
      ? `<p style="margin:12px 0 0 0;font-size:12px;color:#6b7280;${FONTE}">&#128206; ${qtdAnexos} ${
          qtdAnexos === 1 ? 'anexo disponível' : 'anexos disponíveis'
        } no chamado</p>`
      : '';
  return (
    '<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;margin-bottom:32px;">' +
    '<tr><td style="background-color:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:20px 24px;">' +
    `<p style="margin:0 0 6px 0;font-size:11px;font-weight:600;color:#6b7280;letter-spacing:1px;text-transform:uppercase;${FONTE}">Resolução</p>` +
    `<p style="margin:0;font-size:15px;color:#374151;line-height:1.7;white-space:pre-line;${FONTE}">${escaparHtml(t)}</p>` +
    anexos +
    '</td></tr></table>'
  );
}
