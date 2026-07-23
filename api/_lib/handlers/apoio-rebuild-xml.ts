/**
 * API Route: POST /api/analises-clinicas/apoio-rebuild-xml
 *
 * Regenera o XML AOL depois que o operador editou a revisão (marcou/desmarcou
 * exames, corrigiu sexo/nascimento/CPF). Mesmo contrato do /rebuild-xml do
 * envio_alvaro: recebe o resultado bruto do pipeline + a seleção de exames +
 * overrides, devolve o XML novo (sempre com senha/chave em placeholder).
 *
 * Autorização: JWT de SESSÃO do operador (canManageColetas).
 * Body: { raw_result, exames_selecionados: [], overrides?: {sexo, datanasc, ...} }
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { autorizarOperador } from '../recepcaoAgendamento.js';
import { describeError } from '../errors.js';
import { PipelineLog } from '../apoio/log.js';
import { gerarXmlAlvaro, type DadosImagem, type OverridesPaciente } from '../apoio/xmlAol.js';
import type { ExameImagem } from '../apoio/catalogo.js';
import type { RequisicaoAplis } from '../apoio/aplis.js';

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.status(405).json({ success: false, error: 'Método não permitido' });
    return;
  }

  const authHeader = req.headers.authorization ?? '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  const erroAuth = await autorizarOperador(token);
  if (erroAuth) {
    res.status(erroAuth.status).json(erroAuth.payload);
    return;
  }

  const body = (req.body ?? {}) as Record<string, unknown>;
  const examesSelecionados = Array.isArray(body.exames_selecionados)
    ? (body.exames_selecionados as ExameImagem[])
    : [];
  const rawResult = (body.raw_result ?? {}) as Record<string, unknown>;
  const overrides = (body.overrides ?? {}) as OverridesPaciente;

  try {
    const log = new PipelineLog();
    const dadosImagem: DadosImagem = {
      paciente: (rawResult.paciente as Record<string, unknown> | null) ?? {},
      medico: (rawResult.medico as Record<string, unknown> | null) ?? {},
      numero_requisicao: (rawResult.numero_requisicao as string | null) ?? null,
      data_solicitacao: (rawResult.data_solicitacao as string | null) ?? null,
    };
    const xml = gerarXmlAlvaro(
      (rawResult._aplis_raw as RequisicaoAplis | null) ?? null,
      dadosImagem,
      examesSelecionados,
      overrides,
      log,
    );

    res.status(200).json({
      success: true,
      xml,
      log: log.toList(),
      total_exames: examesSelecionados.length,
    });
  } catch (err) {
    console.error('[analises-clinicas/apoio-rebuild-xml] erro:', describeError(err));
    res.status(500).json({ success: false, error: 'Erro interno ao gerar o XML.' });
  }
}
