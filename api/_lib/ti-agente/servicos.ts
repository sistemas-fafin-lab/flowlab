// Monta as dependências reais da EVA a partir do ambiente (Vercel, Docker ou dev).
import type { SupabaseClient } from '@supabase/supabase-js';
import { criarClienteClaude } from './ia/claude.js';
import { criarClienteGemini } from './ia/gemini.js';
import type { Dependencias } from './ia/gerarEstruturado.js';
import { criarClienteGranola } from './granola.js';
import { registradorDeChamadas } from './dados.js';

export function dependenciasIA(db: SupabaseClient): Dependencias {
  return { claude: criarClienteClaude(), gemini: criarClienteGemini(), registrar: registradorDeChamadas(db) };
}

export function clienteGranola() {
  return criarClienteGranola({ apiKey: process.env.GRANOLA_API_KEY });
}
