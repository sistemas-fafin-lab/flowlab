// Adapter comum das chamadas autenticadas do módulo Qualidade às rotas
// /api/qualidade/* — mesmo contrato de chamarAcClinicasApi (analises-clinicas/api.ts).
// Única porta que ainda passa por um servidor (sync com o LIS, PII sob demanda,
// confirmação de vínculo de IHQ, geração/download de exportação de Câncer) —
// worklist/vocabulário/curadoria/indicadores são supabase-js direto, protegidos
// por RLS (ver openspec/changes/spa-sem-backend-express, design.md D2).

import { supabase } from '../../lib/supabase';

async function getToken(): Promise<string | null> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session?.access_token ?? null;
}

export class ErroApiQualidade extends Error {
  constructor(
    readonly status: number,
    mensagem: string,
  ) {
    super(mensagem);
    this.name = 'ErroApiQualidade';
  }
}

export async function chamarQualidadeApi<T>(action: string, body: object, falhaGenerica?: string): Promise<T> {
  const token = await getToken();
  if (!token) throw new ErroApiQualidade(401, 'Sessão expirada. Faça login novamente.');

  const res = await fetch(`/api/qualidade/${action}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  const payload = (await res.json().catch(() => ({}))) as T & {
    success?: boolean;
    error?: string;
    erro?: string;
  };
  if (!res.ok || payload.success !== true) {
    throw new ErroApiQualidade(
      res.status || 500,
      payload.error || payload.erro || falhaGenerica || `Falha na chamada ${action} (HTTP ${res.status}).`,
    );
  }
  return (payload as unknown as { data: T }).data;
}
