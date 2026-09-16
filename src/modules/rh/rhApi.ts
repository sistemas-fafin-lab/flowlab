// Adapter das chamadas autenticadas do módulo de RH às rotas /api/rh/* —
// mesmo contrato de chamarQualidadeApi (src/modules/qualidade/qualidadeApi.ts).
// Usado só pelo fluxo de upload de holerites (parsing/confirmação); a listagem
// (histórico RH e "meus holerites") é supabase-js direto, protegida por RLS.

import { supabase } from '../../lib/supabase';

async function getToken(): Promise<string | null> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session?.access_token ?? null;
}

export class ErroApiRh extends Error {
  constructor(
    readonly status: number,
    mensagem: string,
  ) {
    super(mensagem);
    this.name = 'ErroApiRh';
  }
}

export async function chamarRhApi<T>(action: string, body: object, falhaGenerica?: string): Promise<T> {
  const token = await getToken();
  if (!token) throw new ErroApiRh(401, 'Sessão expirada. Faça login novamente.');

  const res = await fetch(`/api/rh/${action}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  const payload = (await res.json().catch(() => ({}))) as T & {
    success?: boolean;
    error?: string;
  };
  if (!res.ok || payload.success !== true) {
    throw new ErroApiRh(
      res.status || 500,
      payload.error || falhaGenerica || `Falha na chamada ${action} (HTTP ${res.status}).`,
    );
  }
  return (payload as unknown as { data: T }).data;
}
