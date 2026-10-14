// Chamadas autenticadas às rotas /api/ti/* da EVA (molde: analises-clinicas/api.ts).
// Token da sessão no header; erro com a mensagem do servidor.
import { supabase } from '../../../lib/supabase';

export async function chamarEva<T>(action: string, body: object, opcoes: { dryRun?: boolean } = {}): Promise<T> {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) throw new Error('Sessão expirada. Faça login novamente.');

  const res = await fetch(`/api/ti/${action}${opcoes.dryRun ? '?dryRun=true' : ''}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  const payload = (await res.json().catch(() => ({}))) as T & { success?: boolean; error?: string; erro?: string | null };
  if (!res.ok || payload.success !== true) {
    throw new Error(payload.error || payload.erro || `A EVA não respondeu (HTTP ${res.status}).`);
  }
  return payload;
}
