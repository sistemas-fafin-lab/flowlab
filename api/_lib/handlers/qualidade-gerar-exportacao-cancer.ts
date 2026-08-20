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
import { autorizarQualidade, idDoUsuario, tokenDoHeader } from '../qualidade/autorizacao.js';
import { carregarParametrosFixosCancer } from '../qualidade/cancerConsulta.js';
import { elegivelParaExportacao, type TriagemCancer } from '../qualidade/cancerRegras.js';
import { buscarDetalhesCancerLis, ehErroConsulta } from '../qualidade/bdLabQualidade.js';
import { getSupabaseAdminClient } from '../supabase.js';

const BUCKET_EXPORTACOES = 'qualidade-exportacoes-rhc';

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
  const erroAuth = await autorizarQualidade(token, 'canManageQualidade');
  if (erroAuth) {
    res.status(erroAuth.status).json(erroAuth.payload);
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
    const usuarioId = await idDoUsuario(token!);
    if (!usuarioId) {
      res.status(401).json({ success: false, error: 'Sessão inválida ou expirada.' });
      return;
    }

    const supabase = getSupabaseAdminClient();
    const { inicio, fim } = intervaloTrimestre(ano, trimestre);

    const [casosResp, parametrosFixos] = await Promise.all([
      supabase
        .from('qa_cancer_casos')
        .select('id, cod_requisicao, dta_diagnostico, dta_coleta, triagem, cido_topografia_codigo, cido_morfologia_codigo, exportacao_id')
        .gte('dta_diagnostico', inicio)
        .lte('dta_diagnostico', fim),
      carregarParametrosFixosCancer(supabase),
    ]);

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
    for (const caso of elegiveis) {
      const paciente = detalhesResp.detalhes[caso.cod_requisicao];
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
    // Caminho determinístico a partir de (ano, trimestre, id) — não precisa de
    // coluna própria em qa_exportacoes_rhc; baixar-exportacao-cancer.ts
    // reconstrói o mesmo caminho a partir da linha lida por id.
    const caminhoArquivo = `${ano}/${trimestre}/${exportacaoId}.csv`;

    const { error: erroUpload } = await supabase.storage.from(BUCKET_EXPORTACOES).upload(caminhoArquivo, bufferCsv, {
      contentType: 'text/csv; charset=utf-8',
      upsert: false,
    });
    if (erroUpload) {
      console.error('[qualidade/gerar-exportacao-cancer] erro ao subir CSV:', describeError(erroUpload));
      res.status(500).json({ success: false, error: 'Falha ao gravar arquivo de exportação.' });
      return;
    }

    const geradoEm = new Date().toISOString();
    const { error: erroInsert } = await supabase.from('qa_exportacoes_rhc').insert({
      id: exportacaoId,
      ano,
      trimestre,
      hash_arquivo: hashArquivo,
      total_casos: elegiveis.length,
      registrador,
      gerado_por: usuarioId,
      gerado_em: geradoEm,
    });
    if (erroInsert) {
      console.error('[qualidade/gerar-exportacao-cancer] erro ao gravar qa_exportacoes_rhc:', describeError(erroInsert));
      res.status(500).json({ success: false, error: 'Falha ao registrar exportação.' });
      return;
    }

    const { error: erroUpdateCasos } = await supabase
      .from('qa_cancer_casos')
      .update({ exportacao_id: exportacaoId })
      .in('id', elegiveis.map((c) => c.id));
    if (erroUpdateCasos) {
      console.error('[qualidade/gerar-exportacao-cancer] erro ao vincular casos exportados:', describeError(erroUpdateCasos));
      res.status(500).json({ success: false, error: 'Exportação gravada, mas falhou ao vincular os casos exportados.' });
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
