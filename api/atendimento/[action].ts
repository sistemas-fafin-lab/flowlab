/**
 * API Route: /api/atendimento/[action]
 *
 * Dispatcher (dynamic route) da área Atendimento — mesmo padrão de
 * api/faturamento/[action].ts: uma única Serverless Function para o módulo,
 * para caber no limite do plano Vercel (12 no Hobby). Gerador de Orçamento (lista de
 * preços e leitura do pedido médico por IA) e Resetar senha clínica (Laudo Web no apLIS). Autorização/parsing/validação ficam
 * dentro de cada handler (este dispatcher NÃO autoriza nada).
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import geradorOrcamentoPrecos from '../_lib/handlers/atendimento-gerador-orcamento-precos.js';
import geradorOrcamentoPedidoMedico from '../_lib/handlers/atendimento-gerador-orcamento-pedido-medico.js';
import senhaClinicaBuscar from '../_lib/handlers/atendimento-senha-clinica-buscar.js';
import senhaClinicaUsuarios from '../_lib/handlers/atendimento-senha-clinica-usuarios.js';
import senhaClinicaResetar from '../_lib/handlers/atendimento-senha-clinica-resetar.js';

type Handler = (req: VercelRequest, res: VercelResponse) => Promise<void>;

const ROTAS: Record<string, Handler> = {
  'gerador-orcamento-precos': geradorOrcamentoPrecos,
  'gerador-orcamento-pedido-medico': geradorOrcamentoPedidoMedico,
  'senha-clinica-buscar': senhaClinicaBuscar,
  'senha-clinica-usuarios': senhaClinicaUsuarios,
  'senha-clinica-resetar': senhaClinicaResetar,
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
