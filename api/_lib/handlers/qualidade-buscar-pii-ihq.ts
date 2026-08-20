// api/_lib/handlers/qualidade-buscar-pii-ihq.ts
// Ação `buscar-pii-ihq` — nome do paciente por
// `codRequisicaoIhq|idTarefaBloco`, em lote, para a worklist de IHQ
// (src/modules/qualidade/ihq.ts, `buscarIhqLista`). PII sob demanda (P10):
// nunca persistida em `qa_ihq_solicitacoes`. Lê os pares (cod_requisicao_ihq,
// id_tarefa_bloco) do período direto de `qa_ihq_solicitacoes` (já
// sincronizada), depois busca o nome no LIS por código, em lote.

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { describeError } from '../errors.js';
import { autorizarQualidade, tokenDoHeader } from '../qualidade/autorizacao.js';
import { buscarNomesPacientesPorRequisicoesLis, ehErroConsulta } from '../qualidade/bdLabQualidade.js';
import { getSupabaseAdminClient } from '../supabase.js';

interface CorpoBuscarPii {
  inicio?: unknown;
  fim?: unknown;
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
  const inicio = typeof corpo?.inicio === 'string' ? corpo.inicio : null;
  const fim = typeof corpo?.fim === 'string' ? corpo.fim : null;
  if (!inicio || !fim) {
    res.status(400).json({ success: false, error: 'Informe "inicio" e "fim" (YYYY-MM-DD).' });
    return;
  }

  try {
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from('qa_ihq_solicitacoes')
      .select('cod_requisicao_ihq, id_tarefa_bloco')
      .gte('dta_admissao', inicio)
      .lte('dta_admissao', fim);

    if (error) {
      console.error('[qualidade/buscar-pii-ihq] erro ao ler qa_ihq_solicitacoes:', describeError(error));
      res.status(500).json({ success: false, error: 'Falha ao ler solicitações de IHQ do período.' });
      return;
    }

    const linhas = (data ?? []) as { cod_requisicao_ihq: string; id_tarefa_bloco: number | null }[];
    if (linhas.length === 0) {
      res.status(200).json({ success: true, data: {} });
      return;
    }

    const codigos = [...new Set(linhas.map((l) => l.cod_requisicao_ihq))];
    const resultado = await buscarNomesPacientesPorRequisicoesLis(codigos);
    if (ehErroConsulta(resultado)) {
      res.status(resultado.erro.status).json({ success: false, error: resultado.erro.mensagem });
      return;
    }

    const nomes: Record<string, string> = {};
    for (const linha of linhas) {
      const nome = resultado.nomes[linha.cod_requisicao_ihq];
      if (nome) nomes[`${linha.cod_requisicao_ihq}|${linha.id_tarefa_bloco ?? ''}`] = nome;
    }

    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({ success: true, data: nomes });
  } catch (err) {
    console.error('[qualidade/buscar-pii-ihq] erro:', describeError(err));
    res.status(500).json({ success: false, error: 'Erro interno ao buscar nomes de pacientes.' });
  }
}
