// Adapter comum das chamadas autenticadas do módulo analises-clinicas às rotas
// /api/analises-clinicas/* (proxy do LAB-HUB). Centraliza o contrato: token da
// sessão do operador, POST JSON, e a forma de erro { success, error | erro }.
// Antes disso, getToken tinha 3+ cópias e buscarPacientes 2 (uma em cada hook),
// e o contrato de erro era sincronizado à mão em cada chamador.

import { supabase } from '../../lib/supabase';

// Paciente devolvido pelo typeahead da recepção (espelha PacienteBuscaItem do
// LAB-HUB). O CPF vem MASCARADO — só o suficiente p/ o operador confirmar a pessoa.
export interface PacienteBuscaItem {
  id: string;
  nome: string;
  cpfMascarado: string;
  dataNascimento: string; // YYYY-MM-DD
}

// Token da sessão do operador para as chamadas às funções serverless (proxy do
// LAB-HUB). As rotas /api validam este JWT + a permissão do fluxo.
export const getToken = async (): Promise<string | null> => {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token ?? null;
};

// POST JSON autenticado a uma action do proxy. Exige `success: true` na
// resposta (contrato de TODAS as rotas do proxy) e lança Error com a mensagem do
// servidor (payload.error ?? payload.erro) ou a `falhaGenerica` do chamador.
export async function chamarAcClinicasApi<T>(
  action: string,
  body: object,
  falhaGenerica?: string,
): Promise<T> {
  const token = await getToken();
  if (!token) throw new Error('Sessão expirada. Faça login novamente.');

  const res = await fetch(`/api/analises-clinicas/${action}`, {
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
    throw new Error(
      payload.error || payload.erro || falhaGenerica || `Falha na chamada ${action} (HTTP ${res.status}).`,
    );
  }
  return payload;
}

// Typeahead de pacientes no LAB-HUB. Silenciosa: em erro/sessão expirada devolve
// lista vazia — o operador ainda pode cadastrar um paciente novo.
export async function buscarPacientes(q: string): Promise<PacienteBuscaItem[]> {
  const termo = q.trim();
  if (termo.length < 2) return [];
  const token = await getToken();
  if (!token) return [];

  try {
    const res = await fetch(
      `/api/analises-clinicas/buscar-pacientes?q=${encodeURIComponent(termo)}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    const body: { success?: boolean; pacientes?: PacienteBuscaItem[] } =
      await res.json().catch(() => ({}));
    if (!res.ok || !body.success) return [];
    return body.pacientes ?? [];
  } catch {
    return [];
  }
}
