import { createClient } from '@supabase/supabase-js';
import { Database } from './database.types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Variáveis de ambiente do Supabase não estão definidas');
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    // Armazenar sessão em localStorage para persistência entre recargas
    storage: window.localStorage,
    // Auto-refresh token habilitado
    autoRefreshToken: true,
    // Detectar sessões persistidas automaticamente
    persistSession: true,
    // Não chamar getSession() ao inicializar (evita loop de refresh)
    detectSessionInUrl: true,
  },
  // Configurações globais
  global: {
    headers: {
      'X-Client-Info': 'flowlab',
    },
  },
  // Tratamento de erros mais tolerante
  db: {
    schema: 'public',
  },
});