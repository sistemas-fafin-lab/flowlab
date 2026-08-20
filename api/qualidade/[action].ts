/**
 * API Route: /api/qualidade/[action]
 *
 * Dispatcher (dynamic route) — colapsa as rotas de Qualidade numa única
 * Serverless Function, para caber no limite do plano Vercel (12 functions no
 * Hobby, hoje em uso por products/faturamento/analises-clinicas/umami/users/
 * notifications). O segmento `[action]` do path vira `req.query.action` e
 * seleciona o handler; as URLs públicas ficam idênticas às que
 * qualidadeApi.ts (`chamarQualidadeApi`) já chama.
 *
 * Cada handler vive em api/_lib/handlers/ — o prefixo `_` faz o Vercel NÃO
 * contá-los como functions. Autorização, parsing e validação seguem dentro
 * de cada handler (este dispatcher NÃO autoriza nada). Espelha
 * api/faturamento/[action].ts e api/analises-clinicas/[action].ts.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import qualidadeSyncOcorrencias from '../_lib/handlers/qualidade-sync-ocorrencias.js';
import qualidadeSyncCortesias from '../_lib/handlers/qualidade-sync-cortesias.js';
import qualidadeBuscarPiiCortesias from '../_lib/handlers/qualidade-buscar-pii-cortesias.js';
import qualidadeSyncIhq from '../_lib/handlers/qualidade-sync-ihq.js';
import qualidadeBuscarPiiIhq from '../_lib/handlers/qualidade-buscar-pii-ihq.js';
import qualidadeBuscarDetalheIhq from '../_lib/handlers/qualidade-buscar-detalhe-ihq.js';
import qualidadeConfirmarVinculoIhq from '../_lib/handlers/qualidade-confirmar-vinculo-ihq.js';
import qualidadeSyncCancer from '../_lib/handlers/qualidade-sync-cancer.js';
import qualidadeBuscarFunilCancer from '../_lib/handlers/qualidade-buscar-funil-cancer.js';
import qualidadeBuscarDetalheCancer from '../_lib/handlers/qualidade-buscar-detalhe-cancer.js';
import qualidadeGerarExportacaoCancer from '../_lib/handlers/qualidade-gerar-exportacao-cancer.js';
import qualidadeBaixarExportacaoCancer from '../_lib/handlers/qualidade-baixar-exportacao-cancer.js';

// sync-* consulta o MySQL de backup do laboratório (pode ser lento) e
// gerar-exportacao-cancer monta um CSV e sobe ao Storage — ambos passam
// fácil do teto padrão de 10s; o teto vale para a function inteira.
export const config = { maxDuration: 60 };

type Handler = (req: VercelRequest, res: VercelResponse) => Promise<void>;

// Chave = segmento do path, igual ao nome da action em qualidadeApi.ts.
const ROTAS: Record<string, Handler> = {
  'sync-ocorrencias': qualidadeSyncOcorrencias,
  'sync-cortesias': qualidadeSyncCortesias,
  'buscar-pii-cortesias': qualidadeBuscarPiiCortesias,
  'sync-ihq': qualidadeSyncIhq,
  'buscar-pii-ihq': qualidadeBuscarPiiIhq,
  'buscar-detalhe-ihq': qualidadeBuscarDetalheIhq,
  'confirmar-vinculo-ihq': qualidadeConfirmarVinculoIhq,
  'sync-cancer': qualidadeSyncCancer,
  'buscar-funil-cancer': qualidadeBuscarFunilCancer,
  'buscar-detalhe-cancer': qualidadeBuscarDetalheCancer,
  'gerar-exportacao-cancer': qualidadeGerarExportacaoCancer,
  'baixar-exportacao-cancer': qualidadeBaixarExportacaoCancer,
};

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  const raw = req.query.action;
  const action = Array.isArray(raw) ? raw[0] : raw;
  const rota = action ? ROTAS[action] : undefined;

  if (!rota) {
    res.status(404).json({ success: false, error: 'Rota não encontrada.' });
    return;
  }

  await rota(req, res);
}
