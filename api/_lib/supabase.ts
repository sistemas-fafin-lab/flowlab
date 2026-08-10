// api/_lib/supabase.ts
// Cliente Supabase para uso em Vercel Serverless Functions.
// Utiliza a Service Role Key para operar fora do contexto de sessão do usuário.

import { createClient, SupabaseClient } from '@supabase/supabase-js';

let _client: SupabaseClient | null = null;

export function getSupabaseAdminClient(): SupabaseClient {
  if (_client) return _client;

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      'Variáveis de ambiente SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórias'
    );
  }

  _client = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  return _client;
}

/**
 * Cliente que age COMO o usuário da sessão, e não como service_role.
 *
 * Necessário quando a rota chama uma RPC que depende de `auth.uid()` — o caso de
 * `fat_criar_titulo`, que grava `notas.criado_por` e valida
 * `current_user_has_permission`. Com o cliente admin, `auth.uid()` volta NULL e a
 * RPC recusaria a chamada de todo mundo.
 *
 * Não é cacheado: a chave do cache seria o token, que muda a cada sessão.
 *
 * O `apikey` continua sendo a service role quando não há anon key no ambiente do
 * servidor — quem determina o papel no Postgres é o JWT do header Authorization,
 * não a apikey.
 */
export function getSupabaseUserClient(accessToken: string): SupabaseClient {
  const supabaseUrl = process.env.SUPABASE_URL;
  const apiKey =
    process.env.SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !apiKey) {
    throw new Error(
      'Variáveis de ambiente SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórias'
    );
  }

  return createClient(supabaseUrl, apiKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
}
