import { supabase } from '../../lib/supabase';

export type EventoPagamento = 'criado' | 'decidido' | 'transferido';

// Avisa por e-mail (e no sininho) quem precisa agir: o autorizador quando o pedido é
// criado ou transferido para ele (aba Departamentos); o solicitante e o Financeiro quando o
// autorizador decide. O servidor lê o pedido pelo id e escolhe os destinatários
// (api/_lib/handlers/notifications-payment-request.ts). Nunca lança: falha no aviso não
// pode desfazer a ação.
export async function notificarPagamento(id: string | undefined, evento: EventoPagamento): Promise<void> {
  if (!id) return;
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) return;
    const res = await fetch('/api/notifications/payment-request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ id, evento }),
    });
    if (!res.ok) console.warn('[notificarPagamento] falha ao avisar:', evento, res.status);
  } catch (err) {
    console.warn('[notificarPagamento] falha ao avisar:', evento, err);
  }
}
