// api/_lib/handlers/qualidade-buscar-detalhe-ihq.ts
// Ação `buscar-detalhe-ihq` — nome do paciente + candidatas a vínculo,
// recalculadas do LIS a cada chamada (nunca persistidas — design.md D3 da
// Etapa 5, ver cabeçalho de src/modules/qualidade/ihq.ts). Candidatas: outras
// requisições do MESMO paciente numa janela ao redor de `dtaAdmissao`, que já
// têm peça (bloco) disponível (`buscarCandidatasVinculoIhqLis`).

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { describeError } from '../errors.js';
import { autorizarQualidade, tokenDoHeader } from '../qualidade/autorizacao.js';
import {
  buscarCandidatasVinculoIhqLis,
  buscarCodPacientePorRequisicaoLis,
  buscarNomesPacientesPorRequisicoesLis,
  ehErroConsulta,
} from '../qualidade/bdLabQualidade.js';
import { getSupabaseAdminClient } from '../supabase.js';

const JANELA_VINCULO_DIAS_PADRAO = 30;

interface CorpoBuscarDetalhe {
  id?: unknown;
  dtaAdmissao?: unknown;
  codRequisicaoIhq?: unknown;
  idTarefaBloco?: unknown;
}

async function carregarJanelaVinculoDias(supabase: ReturnType<typeof getSupabaseAdminClient>): Promise<number> {
  const { data } = await supabase
    .from('app_parametros')
    .select('valor')
    .eq('modulo', 'ihq')
    .eq('chave', 'ihq.janela_vinculo_dias')
    .maybeSingle();
  const valor = Number((data as { valor: unknown } | null)?.valor ?? JANELA_VINCULO_DIAS_PADRAO);
  return Number.isFinite(valor) && valor > 0 ? valor : JANELA_VINCULO_DIAS_PADRAO;
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

  const corpo = req.body as CorpoBuscarDetalhe;
  const dtaAdmissao = typeof corpo?.dtaAdmissao === 'string' ? corpo.dtaAdmissao : null;
  const codRequisicaoIhq = typeof corpo?.codRequisicaoIhq === 'string' ? corpo.codRequisicaoIhq : null;
  if (!dtaAdmissao || !codRequisicaoIhq) {
    res.status(400).json({ success: false, error: 'Informe "dtaAdmissao" e "codRequisicaoIhq".' });
    return;
  }

  try {
    const supabase = getSupabaseAdminClient();

    const [resultadoNome, resultadoPaciente, janelaDias] = await Promise.all([
      buscarNomesPacientesPorRequisicoesLis([codRequisicaoIhq]),
      buscarCodPacientePorRequisicaoLis(codRequisicaoIhq),
      carregarJanelaVinculoDias(supabase),
    ]);

    if (ehErroConsulta(resultadoNome)) {
      res.status(resultadoNome.erro.status).json({ success: false, error: resultadoNome.erro.mensagem });
      return;
    }
    if (ehErroConsulta(resultadoPaciente)) {
      res.status(resultadoPaciente.erro.status).json({ success: false, error: resultadoPaciente.erro.mensagem });
      return;
    }

    const nomePacienteLis = resultadoNome.nomes[codRequisicaoIhq] ?? null;
    const codPaciente = resultadoPaciente.codPaciente;

    if (codPaciente === null) {
      res.setHeader('Cache-Control', 'no-store');
      res.status(200).json({ success: true, data: { nomePacienteLis, candidatas: [] } });
      return;
    }

    const resultadoCandidatas = await buscarCandidatasVinculoIhqLis(codPaciente, dtaAdmissao, codRequisicaoIhq, janelaDias);
    if (ehErroConsulta(resultadoCandidatas)) {
      res.status(resultadoCandidatas.erro.status).json({ success: false, error: resultadoCandidatas.erro.mensagem });
      return;
    }

    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({
      success: true,
      data: {
        nomePacienteLis,
        candidatas: resultadoCandidatas.candidatas.map((c) => ({
          codRequisicaoOriginal: c.codRequisicaoOriginal,
          dtaSolicitacao: c.dtaSolicitacao,
          temPeca: c.temPeca,
        })),
      },
    });
  } catch (err) {
    console.error('[qualidade/buscar-detalhe-ihq] erro:', describeError(err));
    res.status(500).json({ success: false, error: 'Erro interno ao buscar detalhe de IHQ.' });
  }
}
