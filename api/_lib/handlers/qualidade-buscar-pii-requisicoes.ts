// api/_lib/handlers/qualidade-buscar-pii-requisicoes.ts
// Ação `buscar-pii-requisicoes` — nome do paciente por `codRequisicao`, em
// lote, para a tabela de laudos retificados da aba Indicadores
// (src/modules/qualidade/requisicoes.ts). PII sob demanda (P10): nunca
// persistida em `qa_requisicoes`, só devolvida nesta resposta. Mesmo padrão
// de qualidade-buscar-pii-cortesias.ts.

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { describeError } from '../errors.js';
import { autorizarQualidade, tokenDoHeader } from '../qualidade/autorizacao.js';
import { buscarNomesPacientesPorRequisicoesLis, ehErroConsulta } from '../qualidade/bdLabQualidade.js';

const MAX_CODIGOS = 500;

interface CorpoBuscarPii {
  codigosRequisicao?: unknown;
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.status(405).json({ success: false, error: 'Método não permitido.' });
    return;
  }

  const erroAuth = await autorizarQualidade(tokenDoHeader(req.headers.authorization), 'canViewQualidade');
  if (erroAuth) {
    res.status(erroAuth.status).json(erroAuth.payload);
    return;
  }

  const corpo = req.body as CorpoBuscarPii;
  const codigos = Array.isArray(corpo?.codigosRequisicao) ? corpo.codigosRequisicao.filter((c): c is string => typeof c === 'string') : [];
  if (codigos.length === 0) {
    res.status(200).json({ success: true, data: {} });
    return;
  }
  const codigosUnicos = [...new Set(codigos)];
  if (codigosUnicos.length > MAX_CODIGOS) {
    res.status(400).json({ success: false, error: `No máximo ${MAX_CODIGOS} códigos por chamada.` });
    return;
  }

  try {
    const resultado = await buscarNomesPacientesPorRequisicoesLis(codigosUnicos);
    if (ehErroConsulta(resultado)) {
      res.status(resultado.erro.status).json({ success: false, error: resultado.erro.mensagem });
      return;
    }
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({ success: true, data: resultado.nomes });
  } catch (err) {
    console.error('[qualidade/buscar-pii-requisicoes] erro:', describeError(err));
    res.status(500).json({ success: false, error: 'Erro interno ao buscar nomes de pacientes.' });
  }
}
