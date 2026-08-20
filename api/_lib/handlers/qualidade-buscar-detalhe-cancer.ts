// api/_lib/handlers/qualidade-buscar-detalhe-cancer.ts
// Ação `buscar-detalhe-cancer` — detalhe de 1 caso: junta curadoria já
// gravada em `qa_cancer_casos` com PII completa (nome, sexo, CPF, mãe,
// nascimento, patologista, texto do laudo) lida do LIS sob demanda, nunca
// persistida (P10).

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { describeError } from '../errors.js';
import { autorizarQualidade, tokenDoHeader } from '../qualidade/autorizacao.js';
import { carregarCatalogoCido } from '../qualidade/cancerConsulta.js';
import { avaliarCandidaturaCancer, sugerirMorfologia, sugerirTopografia, type TriagemCancer } from '../qualidade/cancerRegras.js';
import { buscarDetalheCancerLis, ehErroConsulta } from '../qualidade/bdLabQualidade.js';
import { getSupabaseAdminClient } from '../supabase.js';

interface CorpoDetalhe {
  id?: unknown;
}

interface LinhaCancerCasoDetalhe {
  id: string;
  cod_requisicao: string;
  dta_diagnostico: string;
  dta_coleta: string | null;
  dta_coleta_divergente: boolean;
  triagem: TriagemCancer;
  triagem_justificativa: string | null;
  triado_por: string | null;
  triado_em: string | null;
  cido_topografia_codigo: string | null;
  cido_morfologia_codigo: string | null;
  classificado_por: string | null;
  classificado_em: string | null;
  observacoes: string | null;
  exportacao_id: string | null;
  revisao_pendente: boolean;
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

  const corpo = req.body as CorpoDetalhe;
  const id = typeof corpo?.id === 'string' ? corpo.id : null;
  if (!id) {
    res.status(400).json({ success: false, error: 'Informe "id".' });
    return;
  }

  try {
    const supabase = getSupabaseAdminClient();

    const { data, error } = await supabase
      .from('qa_cancer_casos')
      .select(
        'id, cod_requisicao, dta_diagnostico, dta_coleta, dta_coleta_divergente, triagem, triagem_justificativa, triado_por, triado_em, cido_topografia_codigo, cido_morfologia_codigo, classificado_por, classificado_em, observacoes, exportacao_id, revisao_pendente',
      )
      .eq('id', id)
      .maybeSingle();

    if (error) {
      console.error('[qualidade/buscar-detalhe-cancer] erro ao ler qa_cancer_casos:', describeError(error));
      res.status(500).json({ success: false, error: 'Falha ao buscar caso de Registro de Câncer.' });
      return;
    }
    if (!data) {
      res.status(404).json({ success: false, error: 'Caso de Registro de Câncer não encontrado.' });
      return;
    }

    const caso = data as LinhaCancerCasoDetalhe;

    const [detalheResp, catalogoTopografia, catalogoMorfologia] = await Promise.all([
      buscarDetalheCancerLis(caso.cod_requisicao),
      carregarCatalogoCido(supabase, 'topografia'),
      carregarCatalogoCido(supabase, 'morfologia'),
    ]);

    if (ehErroConsulta(detalheResp)) {
      res.status(detalheResp.erro.status).json({ success: false, error: detalheResp.erro.mensagem });
      return;
    }
    const lis = detalheResp.detalhe;

    let registrador: string | null = null;
    if (caso.exportacao_id) {
      const { data: exportacao } = await supabase.from('qa_exportacoes_rhc').select('registrador').eq('id', caso.exportacao_id).maybeSingle();
      registrador = (exportacao as { registrador: string } | null)?.registrador ?? null;
    }

    const candidatura = avaliarCandidaturaCancer(
      { codInternacionalDiagnostico: lis?.codInternacionalDiagnostico ?? null, textoLaudo: lis?.textoLaudo ?? null },
      catalogoMorfologia,
    );
    const sugestaoMorfologia = caso.cido_morfologia_codigo
      ? null
      : sugerirMorfologia({ codInternacionalDiagnostico: lis?.codInternacionalDiagnostico ?? null }, catalogoMorfologia);
    const sugestaoTopografia = caso.cido_topografia_codigo
      ? null
      : sugerirTopografia({ descricaoTopografiaLis: lis?.descricaoTopografiaLis ?? null }, catalogoTopografia);

    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({
      success: true,
      data: {
        id: caso.id,
        codRequisicao: caso.cod_requisicao,
        dtaDiagnostico: caso.dta_diagnostico,
        dtaColeta: caso.dta_coleta,
        dtaColetaDivergente: caso.dta_coleta_divergente,
        triagem: caso.triagem,
        cidoTopografiaCodigo: caso.cido_topografia_codigo,
        cidoTopografiaDescricao: caso.cido_topografia_codigo
          ? (catalogoTopografia.find((e) => e.codigo === caso.cido_topografia_codigo)?.descricao ?? null)
          : null,
        cidoMorfologiaCodigo: caso.cido_morfologia_codigo,
        cidoMorfologiaDescricao: caso.cido_morfologia_codigo
          ? (catalogoMorfologia.find((e) => e.codigo === caso.cido_morfologia_codigo)?.descricao ?? null)
          : null,
        observacoes: caso.observacoes,
        exportacaoId: caso.exportacao_id,
        revisaoPendente: caso.revisao_pendente,
        nomePacienteLis: lis?.nomePacienteLis ?? '',
        sexoLis: lis?.sexoLis ?? null,
        cpfLis: lis?.cpfLis ?? null,
        nomeMaeLis: lis?.nomeMaeLis ?? null,
        dataNascimentoLis: lis?.dataNascimentoLis ?? null,
        patologistaLaudoLis: lis?.patologistaLaudoLis ?? null,
        textoLaudo: lis?.textoLaudo ?? null,
        triagemJustificativa: caso.triagem_justificativa,
        triadoPor: caso.triado_por,
        triadoEm: caso.triado_em,
        classificadoPor: caso.classificado_por,
        classificadoEm: caso.classificado_em,
        registrador,
        candidatura,
        sugestaoTopografia,
        sugestaoMorfologia,
      },
    });
  } catch (err) {
    console.error('[qualidade/buscar-detalhe-cancer] erro:', describeError(err));
    res.status(500).json({ success: false, error: 'Erro interno ao buscar caso de Registro de Câncer.' });
  }
}
