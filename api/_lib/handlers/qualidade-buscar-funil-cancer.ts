// api/_lib/handlers/qualidade-buscar-funil-cancer.ts
// Ação `buscar-funil-cancer` — junta o estado de curadoria já sincronizado em
// `qa_cancer_casos` com PII/candidatura lidas do LIS sob demanda (nunca
// persistidas, P10) e as regras puras de api/_lib/qualidade/cancerRegras.ts.
// R2/P1: `casos` sempre traz TODOS os positivos do período — a heurística de
// candidatura é só um destaque visual, nunca um filtro.

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { describeError } from '../errors.js';
import { autorizarQualidade, tokenDoHeader } from '../qualidade/autorizacao.js';
import { carregarCatalogoCido, carregarParametrosFixosCancer } from '../qualidade/cancerConsulta.js';
import { avaliarCandidaturaCancer, calcularFunil, sugerirMorfologia, sugerirTopografia, type TriagemCancer } from '../qualidade/cancerRegras.js';
import { ehErroConsulta, listarDiagnosticosPositivosLis } from '../qualidade/bdLabQualidade.js';
import { getSupabaseAdminClient } from '../supabase.js';

interface CorpoFunil {
  inicio?: unknown;
  fim?: unknown;
}

interface LinhaCancerCaso {
  id: string;
  cod_requisicao: string;
  dta_diagnostico: string;
  dta_coleta: string | null;
  dta_coleta_divergente: boolean;
  triagem: TriagemCancer;
  cido_topografia_codigo: string | null;
  cido_morfologia_codigo: string | null;
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

  const corpo = req.body as CorpoFunil;
  const inicio = typeof corpo?.inicio === 'string' ? corpo.inicio : null;
  const fim = typeof corpo?.fim === 'string' ? corpo.fim : null;
  if (!inicio || !fim) {
    res.status(400).json({ success: false, error: 'Informe "inicio" e "fim" (YYYY-MM-DD).' });
    return;
  }

  try {
    const supabase = getSupabaseAdminClient();

    const [casosResp, lisResp, catalogoTopografia, catalogoMorfologia, parametrosFixos] = await Promise.all([
      supabase
        .from('qa_cancer_casos')
        .select(
          'id, cod_requisicao, dta_diagnostico, dta_coleta, dta_coleta_divergente, triagem, cido_topografia_codigo, cido_morfologia_codigo, observacoes, exportacao_id, revisao_pendente',
        )
        .gte('dta_diagnostico', inicio)
        .lte('dta_diagnostico', fim),
      listarDiagnosticosPositivosLis(inicio, fim),
      carregarCatalogoCido(supabase, 'topografia'),
      carregarCatalogoCido(supabase, 'morfologia'),
      carregarParametrosFixosCancer(supabase),
    ]);

    if (casosResp.error) {
      console.error('[qualidade/buscar-funil-cancer] erro ao ler qa_cancer_casos:', describeError(casosResp.error));
      res.status(500).json({ success: false, error: 'Falha ao ler casos de Registro de Câncer.' });
      return;
    }
    if (ehErroConsulta(lisResp)) {
      res.status(lisResp.erro.status).json({ success: false, error: lisResp.erro.mensagem });
      return;
    }

    const casos = (casosResp.data ?? []) as LinhaCancerCaso[];
    const lisPorRequisicao = new Map(lisResp.casos.map((c) => [c.codRequisicao, c]));
    const descricaoTopografiaPorCodigo = new Map(catalogoTopografia.map((e) => [e.codigo, e.descricao]));
    const descricaoMorfologiaPorCodigo = new Map(catalogoMorfologia.map((e) => [e.codigo, e.descricao]));

    const exportacaoIds = [...new Set(casos.map((c) => c.exportacao_id).filter((v): v is string => v !== null))];
    let registradorPorExportacao = new Map<string, string>();
    if (exportacaoIds.length > 0) {
      const { data: exportacoes } = await supabase.from('qa_exportacoes_rhc').select('id, registrador').in('id', exportacaoIds);
      registradorPorExportacao = new Map(((exportacoes ?? []) as { id: string; registrador: string }[]).map((e) => [e.id, e.registrador]));
    }

    const casosResumo = casos.map((caso) => {
      const lis = lisPorRequisicao.get(caso.cod_requisicao);
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

      return {
        id: caso.id,
        codRequisicao: caso.cod_requisicao,
        dtaDiagnostico: caso.dta_diagnostico,
        dtaColeta: caso.dta_coleta,
        dtaColetaDivergente: caso.dta_coleta_divergente,
        triagem: caso.triagem,
        cidoTopografiaCodigo: caso.cido_topografia_codigo,
        cidoTopografiaDescricao: caso.cido_topografia_codigo
          ? (descricaoTopografiaPorCodigo.get(caso.cido_topografia_codigo) ?? null)
          : null,
        cidoMorfologiaCodigo: caso.cido_morfologia_codigo,
        cidoMorfologiaDescricao: caso.cido_morfologia_codigo
          ? (descricaoMorfologiaPorCodigo.get(caso.cido_morfologia_codigo) ?? null)
          : null,
        observacoes: caso.observacoes,
        exportacaoId: caso.exportacao_id,
        revisaoPendente: caso.revisao_pendente,
        nomePacienteLis: lis?.nomePacienteLis ?? '',
        sexoLis: lis?.sexoLis ?? null,
        cpfLis: lis?.cpfLis ?? null,
        registrador: caso.exportacao_id ? (registradorPorExportacao.get(caso.exportacao_id) ?? null) : null,
        candidatura,
        sugestaoTopografia,
        sugestaoMorfologia,
      };
    });

    const funil = calcularFunil(
      casos.map((c) => ({
        triagem: c.triagem,
        cidoTopografiaCodigo: c.cido_topografia_codigo,
        cidoMorfologiaCodigo: c.cido_morfologia_codigo,
        exportacaoId: c.exportacao_id,
        revisaoPendente: c.revisao_pendente,
      })),
    );

    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({
      success: true,
      data: { periodo: { inicio, fim }, ...funil, casos: casosResumo, parametrosFixos },
    });
  } catch (err) {
    console.error('[qualidade/buscar-funil-cancer] erro:', describeError(err));
    res.status(500).json({ success: false, error: 'Erro interno ao buscar funil de Registro de Câncer.' });
  }
}
