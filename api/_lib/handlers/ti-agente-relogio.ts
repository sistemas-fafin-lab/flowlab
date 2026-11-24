// API Route: POST /api/ti/agente-relogio — o "relógio" da EVA (D44, issue 32).
// A Vercel do plano Hobby só agenda cron uma vez por dia. A VPS, que já roda a cada minuto, chama
// esta rota a cada 10 min (minuto 0, 10, 20…), e o que depende de hora fica aqui, na Vercel: muda
// com o deploy, sem gerar e copiar o pacote da VPS de novo.
// Hoje: os alertas de gestão (D38, antes conferidos dentro do script da VPS), as mídias que
// ficaram para trás (D43) e a triagem dos chamados novos da tela (D45). As próximas rotinas de
// horário entram aqui.
// Responde 202 na hora e trabalha em segundo plano (waitUntil): a VPS não fica parada esperando,
// porque é ela que envia as mensagens. Para conferir à mão, ?esperar=true devolve o resultado.
// Segurança: Authorization: Bearer <CRON_SECRET>. Cada parte falha sozinha, sem derrubar as outras.
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { waitUntil } from '@vercel/functions';
import { APP_BASE_URL } from '../appUrl.js';
import { getSupabaseAdminClient } from '../supabase.js';
import { cronAutorizado } from '../ti-agente/autorizacao.js';
import { verificarAlertas } from '../ti-agente/gestao.js';
import { retomarMidias } from '../ti-agente/midia.js';
import { dependenciasIA } from '../ti-agente/servicos.js';
import { triarChamadosNovos } from '../ti-agente/triagem.js';

const ROTA = 'ti/agente-relogio';

async function parte<T>(nome: string, fn: () => Promise<T>): Promise<T | { erro: string }> {
  try {
    return await fn();
  } catch (e) {
    console.error(`[${ROTA}] ${nome}`, e);
    return { erro: e instanceof Error ? e.message : 'Erro interno' };
  }
}

/** Uma volta do relógio. Exportada para os testes. */
export async function rodarRelogio(agora = new Date()) {
  const db = getSupabaseAdminClient();
  const ia = dependenciasIA(db);
  const [alertas, midias, triagem] = await Promise.all([
    parte('alertas', () => verificarAlertas(db, { agora, linkInicio: `${APP_BASE_URL}/it/inicio` })),
    parte('midias', () => retomarMidias(db, ia, agora)),
    // D45: os chamados novos da tela viram sugestão de entrada no Kanban.
    parte('triagem', () => triarChamadosNovos(db, ia)),
  ]);
  return { em: agora.toISOString(), alertas, midias, triagem };
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  res.setHeader('Cache-Control', 'no-store');
  if (!cronAutorizado(req)) {
    res.status(401).json({ success: false, error: 'Não autorizado.' });
    return;
  }
  if (String(req.query.esperar ?? '') === 'true') {
    res.status(200).json({ success: true, ...(await rodarRelogio()) });
    return;
  }
  const trabalho = rodarRelogio().catch((e) => console.error(`[${ROTA}]`, e));
  try {
    waitUntil(trabalho);
  } catch (e) {
    // Fora da Vercel (dev, Docker), o processo segue vivo e a volta termina sozinha.
    console.error(`[${ROTA}] waitUntil indisponível:`, e);
  }
  res.status(202).json({ success: true, aceito: new Date().toISOString() });
}
