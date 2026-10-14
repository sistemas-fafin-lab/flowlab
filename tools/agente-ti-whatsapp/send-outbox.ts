#!/usr/bin/env -S npx tsx
// tools/agente-ti-whatsapp/send-outbox.ts
//
// Fila de saída do WhatsApp da EVA, a agente de TI (issue 12, plano §11.2). Roda na VPS a
// cada minuto (timer systemd, ver install.sh): grava a situação da sessão do WAHA e, a cada
// 30 min, a lista de grupos (D29) em ti_agente_config, e envia as mensagens pendentes de
// ti_agente_mensagens pelo WAHA LOCAL.
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
// Cada execução do timer (a cada minuto) roda a fila e, por até 50 s, olha de novo a cada 5 s:
// a resposta da EVA a uma mensagem sai em segundos, não no minuto seguinte. O timer continua
// abrindo uma execução por vez (Type=oneshot), e os 50 s terminam antes do próximo minuto.
//
// Uso:
//   npx tsx tools/agente-ti-whatsapp/send-outbox.ts            (envia; fica até 50 s olhando a fila)
//   npx tsx tools/agente-ti-whatsapp/send-outbox.ts --uma-vez  (uma passada só)
//   npx tsx tools/agente-ti-whatsapp/send-outbox.ts --dry-run  (só mostra sessão e fila; não grava nem envia)

import { getSupabaseAdminClient } from '../../api/_lib/supabase.js';
import { criarClienteWaha } from '../../api/_lib/ti-agente/waha.js';
import { LIMITE_POR_EXECUCAO, esvaziarFila, repositorioSupabase, type ResultadoFila } from '../../api/_lib/ti-agente/outbox.js';

const SCRIPT = 'eva-whatsapp';
/** De quanto em quanto tempo a fila é relida dentro de uma execução, e por quanto tempo. */
const INTERVALO_MS = 5_000;
const JANELA_MS = 50_000;

/** Só loga quando há o que dizer, para o journal não encher. */
function registrar(r: ResultadoFila) {
  if (r.erroGrupos) console.error(`[${SCRIPT}] Não consegui ler os grupos do WAHA: ${r.erroGrupos}`);
  const vencidas = r.vencidas ? `; ${r.vencidas} vencida(s) na fila` : '';
  const resumo = r.desligado
    ? `envio desligado em Configurações${vencidas}`
    : r.sessao !== 'WORKING'
      ? `sessão não conectada; nada enviado${vencidas}`
      : `${r.enviadas} enviada(s), ${r.falhas} falha(s)${r.definitivas ? `, ${r.definitivas} definitiva(s)` : ''}${vencidas}`;
  if (r.enviadas || r.falhas || r.vencidas || r.sessao !== 'WORKING') console.error(`[${SCRIPT}] sessão ${r.sessao}: ${resumo}`);
}

async function main(): Promise<number> {
  const dryRun = process.argv.includes('--dry-run');
  const faltando = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'WAHA_API_KEY'].filter((k) => !process.env[k]?.trim());
  if (faltando.length > 0) {
    console.error(`[${SCRIPT}] Variáveis ausentes: ${faltando.join(', ')}.`);
    return 2;
  }
  // Texto de exemplo colado no lugar do valor ("…", "<chave>") ou caractere que não cabe num
  // cabeçalho HTTP: avisa aqui, em vez de um erro obscuro do fetch. O valor não vai para o log.
  const marcador = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'WAHA_API_KEY', 'WAHA_URL', 'WAHA_SESSION']
    .filter((k) => { const v = process.env[k]; return v !== undefined && (/[^\x20-\x7E]/.test(v) || /^<.*>$/.test(v.trim())); });
  if (marcador.length > 0) {
    console.error(`[${SCRIPT}] ${marcador.join(', ')} parece(m) o texto de exemplo ("…" ou "<…>") ou tem caractere inválido. Use o valor real.`);
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
      paraOGrupo: fila.filter((m) => m.chat_id_destino).length,
      semNumero: fila.filter((m) => !m.chat_id_destino && !m.membro?.whatsapp).length,
    }, null, 2));
    return 0;
  }

  const inicio = Date.now();
  let r = await esvaziarFila(repo, waha);
  registrar(r);
  let enviadas = r.enviadas;
  let falhas = r.falhas;
  // Desligado ou sem sessão: nada a fazer até o próximo minuto.
  const continuar = () => !process.argv.includes('--uma-vez') && !r.desligado && r.sessao === 'WORKING';
  while (continuar() && Date.now() - inicio + INTERVALO_MS < JANELA_MS) {
    await new Promise((ok) => setTimeout(ok, INTERVALO_MS));
    // Leitura barata: só roda a fila inteira (sessão, envio) quando há mensagem pronta para sair.
    const prontas = await repo.pendentes(new Date().toISOString(), 1);
    if (prontas.length === 0) continue;
    r = await esvaziarFila(repo, waha);
    registrar(r);
    enviadas += r.enviadas;
    falhas += r.falhas;
  }
  return falhas > 0 && enviadas === 0 ? 1 : 0;
}

main()
  .then((code) => process.exit(code))
  .catch((err) => {
    console.error(`[${SCRIPT}] Erro inesperado:`, err instanceof Error ? err.message : err);
    process.exit(1);
  });
