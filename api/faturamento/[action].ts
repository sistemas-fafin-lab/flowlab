/**
 * API Route: /api/faturamento/[action]
 *
 * Dispatcher (dynamic route) — colapsa as rotas de faturamento numa única Serverless
 * Function, para caber no limite do plano Vercel (12 functions no Hobby). O segmento
 * `[action]` do path vira `req.query.action` e seleciona o handler, então as URLs
 * públicas ficam idênticas (ex.: /api/faturamento/lotes) e novas actions não custam
 * function nova.
 *
 * Cada handler vive em api/_lib/handlers/ — o prefixo `_` faz o Vercel NÃO contá-los
 * como functions. Autorização, parsing e validação seguem dentro de cada handler.
 *
 * Espelha api/analises-clinicas/[action].ts.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import faturamentoLotes from '../_lib/handlers/faturamento-lotes.js';
import faturamentoEnviosPorConvenio from '../_lib/handlers/faturamento-envios-por-convenio.js';
import faturamentoLoteDetalhe from '../_lib/handlers/faturamento-lote-detalhe.js';
import faturamentoPendencias from '../_lib/handlers/faturamento-pendencias.js';
import faturamentoPendenciaDetalhe from '../_lib/handlers/faturamento-pendencia-detalhe.js';
import faturamentoPendenciasParticulares from '../_lib/handlers/faturamento-pendencias-particulares.js';
import faturamentoPendenciasSemLote from '../_lib/handlers/faturamento-pendencias-sem-lote.js';
import faturamentoLocaisOrigem from '../_lib/handlers/faturamento-locais-origem.js';
import faturamentoTituloCriar from '../_lib/handlers/faturamento-titulo-criar.js';
import faturamentoTituloLotesEnvio from '../_lib/handlers/faturamento-titulo-lotes-envio.js';
import faturamentoTituloAtualizarNumeroNota from '../_lib/handlers/faturamento-titulo-atualizar-numero-nota.js';
import faturamentoTituloDesvincularLote from '../_lib/handlers/faturamento-titulo-desvincular-lote.js';
import faturamentoTitulosAplisPrevia from '../_lib/handlers/faturamento-titulos-aplis-previa.js';
import faturamentoTitulosConferenciaAplis from '../_lib/handlers/faturamento-titulos-conferencia-aplis.js';
import faturamentoTitulosBaixasAplisPrevia from '../_lib/handlers/faturamento-titulos-baixas-aplis-previa.js';
import faturamentoOperadorasSync from '../_lib/handlers/faturamento-operadoras-sync.js';
import faturamentoGlosasLegado from '../_lib/handlers/faturamento-glosas-legado.js';
import faturamentoRecursosLegado from '../_lib/handlers/faturamento-recursos-legado.js';
import faturamentoImagensLegado from '../_lib/handlers/faturamento-imagens-legado.js';
import faturamentoImagemLegadoArquivo from '../_lib/handlers/faturamento-imagem-legado-arquivo.js';
import faturamentoStatusFaturamento from '../_lib/handlers/faturamento-status-faturamento.js';
import faturamentoRecebidosMes from '../_lib/handlers/faturamento-recebidos-mes.js';
import faturamentoAplisCobrancasTestes from '../_lib/handlers/faturamento-aplis-cobrancas-testes.js';
import faturamentoGlosasRecursosSincronizar from '../_lib/handlers/faturamento-glosas-recursos-sincronizar.js';
import faturamentoGlosasRecursosLotes from '../_lib/handlers/faturamento-glosas-recursos-lotes.js';
import faturamentoGlosasRecursosResumo from '../_lib/handlers/faturamento-glosas-recursos-resumo.js';
import faturamentoGlosasRecursosDetalhe from '../_lib/handlers/faturamento-glosas-recursos-detalhe.js';

type Handler = (req: VercelRequest, res: VercelResponse) => Promise<void>;

// Chave = segmento do path.
const ROTAS: Record<string, Handler> = {
  lotes: faturamentoLotes,
  'envios-por-convenio': faturamentoEnviosPorConvenio,
  'lote-detalhe': faturamentoLoteDetalhe,
  'pendencias-nao-faturadas': faturamentoPendencias,
  'pendencia-lote-detalhe': faturamentoPendenciaDetalhe,
  'pendencias-particulares': faturamentoPendenciasParticulares,
  'pendencias-sem-lote': faturamentoPendenciasSemLote,
  'locais-origem': faturamentoLocaisOrigem,
  'titulo-criar': faturamentoTituloCriar,
  'titulo-lotes-envio': faturamentoTituloLotesEnvio,
  'titulo-atualizar-numero-nota': faturamentoTituloAtualizarNumeroNota,
  'titulo-desvincular-lote': faturamentoTituloDesvincularLote,
  'titulos-aplis-previa': faturamentoTitulosAplisPrevia,
  'titulos-conferencia-aplis': faturamentoTitulosConferenciaAplis,
  'titulos-baixas-aplis-previa': faturamentoTitulosBaixasAplisPrevia,
  'operadoras-sync': faturamentoOperadorasSync,
  'glosas-legado': faturamentoGlosasLegado,
  'recursos-legado': faturamentoRecursosLegado,
  'imagens-legado': faturamentoImagensLegado,
  'imagem-legado-arquivo': faturamentoImagemLegadoArquivo,
  'status-faturamento': faturamentoStatusFaturamento,
  'recebidos-mes': faturamentoRecebidosMes,
  'aplis-cobrancas-testes': faturamentoAplisCobrancasTestes,
  'glosas-recursos-sincronizar': faturamentoGlosasRecursosSincronizar,
  'glosas-recursos-lotes': faturamentoGlosasRecursosLotes,
  'glosas-recursos-resumo': faturamentoGlosasRecursosResumo,
  'glosas-recursos-detalhe': faturamentoGlosasRecursosDetalhe,
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
