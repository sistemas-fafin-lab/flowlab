// api/_lib/handlers/qualidade-gerar-exportacao-cancer.ts
// Ação `gerar-exportacao-cancer` — monta o CSV de exportação RHC (Registro
// Hospitalar de Câncer) com os casos elegíveis (cancerRegras.elegivelParaExportacao)
// do trimestre pedido, sobe ao Storage PRIVADO (nunca ao browser com a chave
// anônima — ver cabeçalho de src/modules/qualidade/cancer.ts) e grava
// `qa_exportacoes_rhc`.
//
// ⚠️ Layout do CSV é PROVISÓRIO: não há, neste repositório, o data
// dictionary oficial do RHC (nenhum arquivo Positivos_Cancer.md ou
// equivalente foi localizado — ver .scratch/qualidade/issues/02). As
// colunas abaixo cobrem os campos que o módulo já modela
// (ParametrosFixosCancerDTO + dados do caso) com cabeçalho nomeado, não o
// formato posicional fixo que o Ministério da Saúde normalmente exige.
// Ajustar ao layout oficial (posições/larguras exatas) antes de qualquer
// envio real ao RHC.

import { createHash, randomUUID } from 'node:crypto';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { describeError } from '../errors.js';
import { autorizarQualidadeERetornarUsuario, tokenDoHeader } from '../qualidade/autorizacao.js';
import { carregarCatalogoCido, carregarParametrosFixosCancer } from '../qualidade/cancerConsulta.js';
import { elegivelParaExportacao, type TriagemCancer } from '../qualidade/cancerRegras.js';
import { buscarDetalhesCancerLis, ehErroConsulta } from '../qualidade/bdLabQualidade.js';
import { gerarPdfExportacaoCancer, type LinhaPdfExportacaoCancer } from '../qualidade/gerarPdfExportacaoCancer.js';
import { getSupabaseAdminClient } from '../supabase.js';

const BUCKET_EXPORTACOES = 'qualidade-exportacoes-rhc';

/** Mesmo mapeamento de CancerPage.tsx (ROTULO_SEXO) — só para exibição no PDF; o CSV mantém o código bruto do LIS. */
const ROTULO_SEXO: Record<number, string> = { 0: 'Não declarado', 1: 'Masculino', 2: 'Feminino' };
function rotuloSexo(sexoLis: number | null | undefined): string {
  if (sexoLis === null || sexoLis === undefined) return '';
  return ROTULO_SEXO[sexoLis] ?? String(sexoLis);
}

interface CorpoGerarExportacao {
  ano?: unknown;
  trimestre?: unknown;
  registrador?: unknown;
}

interface LinhaCancerElegivel {
  id: string;
  cod_requisicao: string;
  dta_diagnostico: string;
  dta_coleta: string | null;
  triagem: TriagemCancer;
  cido_topografia_codigo: string | null;
  cido_morfologia_codigo: string | null;
  exportacao_id: string | null;
}

function intervaloTrimestre(ano: number, trimestre: 1 | 2 | 3 | 4): { inicio: string; fim: string } {
  const primeiroMes = (trimestre - 1) * 3 + 1;
  const inicio = `${ano}-${String(primeiroMes).padStart(2, '0')}-01`;
  const ultimoMes = primeiroMes + 2;
  const ultimoDia = new Date(Date.UTC(ano, ultimoMes, 0)).getUTCDate();
  const fim = `${ano}-${String(ultimoMes).padStart(2, '0')}-${String(ultimoDia).padStart(2, '0')}`;
  return { inicio, fim };
}

/**
 * Neutraliza injeção de fórmula (=, +, -, @ como primeiro caractere) — este
 * CSV carrega PII completa (nome, CPF, mãe, nascimento) e é aberto em Excel
 * por quem processa o RHC (achado de code review). Prefixa com `'` (marca de
 * texto do Excel), como o próprio Excel faz ao reimportar.
 */
function csvCampo(valor: string | number | null): string {
  let texto = valor === null ? '' : String(valor);
  if (/^[=+\-@]/.test(texto)) texto = `'${texto}`;
  return /[",\n;]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
}

const CABECALHO_CSV = [
  'CodRequisicao',
  'NomPaciente',
  'Sexo',
  'CPF',
  'NomMae',
  'DataNascimento',
  'DtaDiagnostico',
  'DtaColeta',
  'CidoTopografiaCodigo',
  'CidoMorfologiaCodigo',
  'CNES',
  'Fonte',
  'RegiaoAdministrativa',
  'Municipio',
  'Estado',
  'NaturalidadeFixa',
  'NacionalidadeFixa',
  'CorIgnorado',
  'EnderecoCodigo',
  'ProfissaoCodigo',
  'MeioDiagnostico',
  'Extensao',
  'CasoRaro',
  'EstadoCivilIgnorado',
  'EscolaridadeIgnorado',
  'Registrador',
];

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.status(405).json({ success: false, error: 'Método não permitido.' });
    return;
  }

  const token = tokenDoHeader(req.headers.authorization);
  const autorizacao = await autorizarQualidadeERetornarUsuario(token, 'canManageQualidade');
  if (!('userId' in autorizacao)) {
    res.status(autorizacao.status).json(autorizacao.payload);
    return;
  }

  const corpo = req.body as CorpoGerarExportacao;
  const ano = typeof corpo?.ano === 'number' ? corpo.ano : null;
  const trimestre = typeof corpo?.trimestre === 'number' && [1, 2, 3, 4].includes(corpo.trimestre) ? (corpo.trimestre as 1 | 2 | 3 | 4) : null;
  const registrador = typeof corpo?.registrador === 'string' ? corpo.registrador.trim() : '';
  if (!ano || !trimestre || !registrador) {
    res.status(400).json({ success: false, error: 'Informe "ano", "trimestre" (1-4) e "registrador".' });
    return;
  }

  try {
    const usuarioId = autorizacao.userId;

    const supabase = getSupabaseAdminClient();
    const { inicio, fim } = intervaloTrimestre(ano, trimestre);

    const [casosResp, parametrosFixos, catalogoTopografia, catalogoMorfologia] = await Promise.all([
      supabase
        .from('qa_cancer_casos')
        .select('id, cod_requisicao, dta_diagnostico, dta_coleta, triagem, cido_topografia_codigo, cido_morfologia_codigo, exportacao_id')
        .gte('dta_diagnostico', inicio)
        .lte('dta_diagnostico', fim),
      carregarParametrosFixosCancer(supabase),
      carregarCatalogoCido(supabase, 'topografia'),
      carregarCatalogoCido(supabase, 'morfologia'),
    ]);
    const descricaoTopografia = new Map(catalogoTopografia.map((e) => [e.codigo, e.descricao]));
    const descricaoMorfologia = new Map(catalogoMorfologia.map((e) => [e.codigo, e.descricao]));

    if (casosResp.error) {
      console.error('[qualidade/gerar-exportacao-cancer] erro ao ler qa_cancer_casos:', describeError(casosResp.error));
      res.status(500).json({ success: false, error: 'Falha ao ler casos de Registro de Câncer.' });
      return;
    }

    const elegiveis = ((casosResp.data ?? []) as LinhaCancerElegivel[]).filter((caso) =>
      elegivelParaExportacao({
        triagem: caso.triagem,
        cidoTopografiaCodigo: caso.cido_topografia_codigo,
        cidoMorfologiaCodigo: caso.cido_morfologia_codigo,
        exportacaoId: caso.exportacao_id,
      }),
    );

    if (elegiveis.length === 0) {
      res.status(400).json({ success: false, error: 'Nenhum caso elegível (confirmado, classificado nos 2 eixos e ainda não exportado) neste trimestre.' });
      return;
    }

    const detalhesResp = await buscarDetalhesCancerLis(elegiveis.map((c) => c.cod_requisicao));
    if (ehErroConsulta(detalhesResp)) {
      res.status(detalhesResp.erro.status).json({ success: false, error: detalhesResp.erro.mensagem });
      return;
    }

    const linhasCsv: string[] = [CABECALHO_CSV.join(';')];
    const linhasPdf: LinhaPdfExportacaoCancer[] = [];
    for (const caso of elegiveis) {
      const paciente = detalhesResp.detalhes[caso.cod_requisicao];
      linhasPdf.push({
        codRequisicao: caso.cod_requisicao,
        nomePaciente: paciente?.nomePacienteLis ?? '',
        sexo: rotuloSexo(paciente?.sexoLis),
        dataNascimento: paciente?.dataNascimentoLis ?? '',
        dtaDiagnostico: caso.dta_diagnostico,
        dtaColeta: caso.dta_coleta ?? '',
        topografiaCodigo: caso.cido_topografia_codigo ?? '',
        topografiaDescricao: descricaoTopografia.get(caso.cido_topografia_codigo ?? '') ?? '',
        morfologiaCodigo: caso.cido_morfologia_codigo ?? '',
        morfologiaDescricao: descricaoMorfologia.get(caso.cido_morfologia_codigo ?? '') ?? '',
      });
      linhasCsv.push(
        [
          caso.cod_requisicao,
          paciente?.nomePacienteLis ?? '',
          paciente?.sexoLis ?? '',
          paciente?.cpfLis ?? '',
          paciente?.nomeMaeLis ?? '',
          paciente?.dataNascimentoLis ?? '',
          caso.dta_diagnostico,
          caso.dta_coleta ?? '',
          caso.cido_topografia_codigo ?? '',
          caso.cido_morfologia_codigo ?? '',
          parametrosFixos.cnes,
          parametrosFixos.fonte,
          parametrosFixos.regiaoAdministrativa,
          parametrosFixos.municipio,
          parametrosFixos.estado,
          parametrosFixos.naturalidadeFixa,
          parametrosFixos.nacionalidadeFixa,
          parametrosFixos.corIgnorado,
          parametrosFixos.enderecoCodigo,
          parametrosFixos.profissaoCodigo,
          parametrosFixos.meioDiagnostico,
          parametrosFixos.extensao,
          parametrosFixos.casoRaro,
          parametrosFixos.estadoCivilIgnorado,
          parametrosFixos.escolaridadeIgnorado,
          registrador,
        ]
          .map(csvCampo)
          .join(';'),
      );
    }

    const conteudoCsv = linhasCsv.join('\n');
    const bufferCsv = Buffer.from(conteudoCsv, 'utf-8');
    const hashArquivo = createHash('sha256').update(bufferCsv).digest('hex');
    const exportacaoId = randomUUID();
    const geradoEm = new Date().toISOString();
    const bufferPdf = gerarPdfExportacaoCancer({ ano, trimestre, registrador, geradoEm, parametrosFixos, linhas: linhasPdf });
    // Caminho determinístico a partir de (ano, trimestre, id) — não precisa de
    // coluna própria em qa_exportacoes_rhc; baixar-exportacao-cancer.ts
    // reconstrói o mesmo caminho (com a extensão pedida) a partir da linha
    // lida por id.
    const caminhoBase = `${ano}/${trimestre}/${exportacaoId}`;
    const caminhoCsv = `${caminhoBase}.csv`;
    const caminhoPdf = `${caminhoBase}.pdf`;

    const { error: erroUpload } = await supabase.storage.from(BUCKET_EXPORTACOES).upload(caminhoCsv, bufferCsv, {
      contentType: 'text/csv; charset=utf-8',
      upsert: false,
    });
    if (erroUpload) {
      console.error('[qualidade/gerar-exportacao-cancer] erro ao subir CSV:', describeError(erroUpload));
      res.status(500).json({ success: false, error: 'Falha ao gravar arquivo de exportação.' });
      return;
    }

    const { error: erroUploadPdf } = await supabase.storage.from(BUCKET_EXPORTACOES).upload(caminhoPdf, bufferPdf, {
      contentType: 'application/pdf',
      upsert: false,
    });
    if (erroUploadPdf) {
      console.error('[qualidade/gerar-exportacao-cancer] erro ao subir PDF:', describeError(erroUploadPdf));
      // Nenhuma linha em qa_exportacoes_rhc foi gravada ainda (RPC roda
      // depois) — remove o CSV órfão para uma nova tentativa não colidir
      // com upsert: false.
      await supabase.storage.from(BUCKET_EXPORTACOES).remove([caminhoCsv]);
      res.status(500).json({ success: false, error: 'Falha ao gravar arquivo de exportação.' });
      return;
    }

    // Insert de qa_exportacoes_rhc + update de qa_cancer_casos.exportacao_id
    // numa função só (migration 20260821090000): as duas escritas viram uma
    // transação implícita — se o update falhar, o insert também é desfeito,
    // em vez de deixar uma exportação "órfã" (arquivo já subido, linha
    // gravada, casos ainda elegíveis) que uma nova tentativa duplicaria
    // (achado de code review).
    const { error: erroRegistrar } = await supabase.rpc('qualidade_registrar_exportacao_rhc', {
      p_id: exportacaoId,
      p_ano: ano,
      p_trimestre: trimestre,
      p_storage_path: caminhoCsv,
      p_hash_arquivo: hashArquivo,
      p_total_casos: elegiveis.length,
      p_registrador: registrador,
      p_gerado_por: usuarioId,
      p_gerado_em: geradoEm,
      p_caso_ids: elegiveis.map((c) => c.id),
    });
    if (erroRegistrar) {
      console.error('[qualidade/gerar-exportacao-cancer] erro ao registrar exportação:', describeError(erroRegistrar));
      res.status(500).json({ success: false, error: 'Falha ao registrar exportação.' });
      return;
    }

    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({
      success: true,
      data: {
        id: exportacaoId,
        ano,
        trimestre,
        hashArquivo,
        totalCasos: elegiveis.length,
        registrador,
        geradoPor: usuarioId,
        geradoEm,
      },
    });
  } catch (err) {
    console.error('[qualidade/gerar-exportacao-cancer] erro:', describeError(err));
    res.status(500).json({ success: false, error: 'Erro interno ao gerar exportação.' });
  }
}
