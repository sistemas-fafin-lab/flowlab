#!/usr/bin/env -S npx tsx
// tools/agente-ti-whatsapp/send-outbox.ts
//
// Fila de saída do WhatsApp da EVA, a agente de TI (issue 12, plano §11.2). Roda na VPS a
// cada minuto (timer systemd, ver install.sh): grava a situação da sessão do WAHA em
// ti_agente_config e envia as mensagens pendentes de ti_agente_mensagens pelo WAHA LOCAL.
// A Vercel não alcança o WAHA (D9), por isso o envio sai daqui.
//
// A rotina fica em api/_lib/ti-agente/outbox.ts (com testes); este arquivo só lê o
// ambiente, monta os clientes e registra o resultado. Nenhuma chave vai para o log.
//
// Variáveis de ambiente:
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY → projeto do app (não o de teste)
//   WAHA_URL      → http://127.0.0.1:3000 (o localhost da VPS, NÃO a URL do ngrok)
//   WAHA_API_KEY  → a chave de API do WAHA (X-Api-Key)
//   WAHA_SESSION  → eva (padrão; a sessão do número da EVA no WAHA)
//
// Uso:
//   npx tsx tools/agente-ti-whatsapp/send-outbox.ts            (envia)
//   npx tsx tools/agente-ti-whatsapp/send-outbox.ts --dry-run  (só mostra sessão e fila; não grava nem envia)

import { getSupabaseAdminClient } from '../../api/_lib/supabase.js';
import { criarClienteWaha } from '../../api/_lib/ti-agente/waha.js';
import { LIMITE_POR_EXECUCAO, esvaziarFila, repositorioSupabase } from '../../api/_lib/ti-agente/outbox.js';

const SCRIPT = 'eva-whatsapp';

async function main(): Promise<number> {
  const dryRun = process.argv.includes('--dry-run');
  const faltando = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'WAHA_API_KEY'].filter((k) => !process.env[k]?.trim());
  if (faltando.length > 0) {
    console.error(`[${SCRIPT}] Variáveis ausentes: ${faltando.join(', ')}.`);
    return 2;
  }
  const url = (process.env.WAHA_URL || 'http://127.0.0.1:3000').trim();
  if (/ngrok/i.test(url)) {
    console.error(`[${SCRIPT}] WAHA_URL aponta para o ngrok. Use o localhost da VPS (http://127.0.0.1:3000), D9.`);
    return 2;
  }

  const waha = criarClienteWaha({ url, apiKey: process.env.WAHA_API_KEY, sessao: process.env.WAHA_SESSION || 'eva' });
  const repo = repositorioSupabase(getSupabaseAdminClient());

  if (dryRun) {
    const sessao = await waha.sessao();
    const ativo = await repo.whatsappAtivo();
    const fila = await repo.pendentes(new Date().toISOString(), LIMITE_POR_EXECUCAO);
    console.log(JSON.stringify({
      sessao: 'erro' in sessao ? `erro: ${sessao.erro}` : sessao.status,
      whatsappAtivo: ativo,
      pendentes: fila.length,
      semNumero: fila.filter((m) => !m.membro?.whatsapp).length,
    }, null, 2));
    return 0;
  }

  const r = await esvaziarFila(repo, waha);
  const resumo = r.desligado
    ? 'envio desligado em Configurações'
    : r.sessao !== 'WORKING'
      ? 'sessão não conectada; nada enviado'
      : `${r.enviadas} enviada(s), ${r.falhas} falha(s)${r.definitivas ? `, ${r.definitivas} definitiva(s)` : ''}`;
  // Só loga quando há o que dizer, para o journal não encher a cada minuto.
  if (r.enviadas || r.falhas || r.sessao !== 'WORKING') console.error(`[${SCRIPT}] sessão ${r.sessao}: ${resumo}`);
  return r.falhas > 0 && r.enviadas === 0 ? 1 : 0;
}

main()
  .then((code) => process.exit(code))
  .catch((err) => {
    console.error(`[${SCRIPT}] Erro inesperado:`, err instanceof Error ? err.message : err);
    process.exit(1);
  });
