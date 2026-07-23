// api/_lib/apoio/pipeline.ts
// Orquestração do processamento da requisição médica (port de process_image do
// envio_alvaro): OCR (Gemini) → enriquecimento pelo catálogo → conferência no
// apLIS → comparação → XML AOL sugerido. O resultado espelha o contrato do legado
// (mesmas chaves) para a tela de revisão e para o jsonb salvo em ac_apoio_fila.
//
// Diferença do legado: a etapa "BD Lab" (MySQL do apLIS via túnel ngrok) foi
// descartada — inviável em serverless; a conferência fica por conta da API apLIS.

import type { SupabaseClient } from '@supabase/supabase-js';
import { PipelineLog } from './log.js';
import {
  carregarCatalogo,
  catalogoParaPrompt,
  enriquecerCodigos,
  normalizar,
  type ExameImagem,
} from './catalogo.js';
import { montarPrompt } from './promptGemini.js';
import { ocrRequisicao, type ArquivoRequisicao } from './gemini.js';
import { buscarRequisicaoAplis, type RequisicaoAplis } from './aplis.js';
import { gerarXmlAlvaro, type DadosImagem } from './xmlAol.js';

export interface ResultadoPipeline {
  success: boolean;
  erro?: string;
  filename: string;
  etapas: Record<string, unknown>;
  log: unknown[];
  numero_requisicao?: string | null;
  paciente?: Record<string, unknown>;
  medico?: Record<string, unknown>;
  convenio?: unknown;
  data_solicitacao?: unknown;
  exames_imagem?: ExameImagem[];
  exames_aplis?: unknown[];
  comparacao?: Record<string, unknown>;
  exames_para_enviar?: ExameImagem[];
  alvaro_xml_sugerido?: string;
  _aplis_raw?: RequisicaoAplis | null;
  resumo?: Record<string, unknown>;
}

// ─── Comparação imagem × apLIS (similaridade de nome por tokens) ────────────────

function tokensDoExame(exame: Record<string, unknown>, campos: string[]): Set<string> {
  const tokens = new Set<string>();
  for (const campo of campos) {
    const valor = exame[campo];
    if (!valor) continue;
    for (const palavra of normalizar(String(valor)).split(' ')) {
      if (palavra.length >= 2) tokens.add(palavra);
    }
  }
  return tokens;
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  if (a.size === 0 || b.size === 0) return 0;
  const inter = [...a].filter((t) => b.has(t)).length;
  return inter / (a.size + b.size - inter);
}

function sobreposicao(a: Set<string>, b: Set<string>): number {
  if (a.size === 0) return 0;
  return [...a].filter((t) => b.has(t)).length / a.size;
}

const LIMIAR_SIMILARIDADE = 0.5;

function compararExames(
  examesImagem: ExameImagem[],
  examesAplis: Record<string, unknown>[],
  log: PipelineLog,
): Record<string, unknown> {
  const tokensImagem = examesImagem.map((ex) => ({
    exame: ex,
    tokens: tokensDoExame(ex as Record<string, unknown>, ['nome_normalizado', 'nome_original']),
  }));
  const tokensAplis = examesAplis.map((ex) => ({ exame: ex, tokens: tokensDoExame(ex, ['nome']) }));

  const coincidentes: unknown[] = [];
  const soNaImagem: ExameImagem[] = [];
  const aplisJaCasados = new Set<number>();

  for (const { exame, tokens } of tokensImagem) {
    let melhorIdx = -1;
    let melhorScore = 0;
    tokensAplis.forEach(({ tokens: tokensApl }, i) => {
      const score = Math.max(
        jaccard(tokens, tokensApl),
        sobreposicao(tokens, tokensApl),
        sobreposicao(tokensApl, tokens),
      );
      if (score > melhorScore) {
        melhorScore = score;
        melhorIdx = i;
      }
    });
    if (melhorScore >= LIMIAR_SIMILARIDADE && !aplisJaCasados.has(melhorIdx)) {
      coincidentes.push({ imagem: exame, aplis: tokensAplis[melhorIdx].exame });
      aplisJaCasados.add(melhorIdx);
    } else {
      soNaImagem.push(exame);
    }
  }

  const soNoAplis = tokensAplis.filter((_, i) => !aplisJaCasados.has(i)).map((t) => t.exame);
  log.info(
    `Comparação (similaridade de nome, limiar=${LIMIAR_SIMILARIDADE}): ${coincidentes.length} coincidentes | ${soNaImagem.length} só imagem | ${soNoAplis.length} só APLIS`,
  );
  return {
    coincidentes,
    so_na_imagem: soNaImagem,
    so_no_aplis: soNoAplis,
    divergencia: soNaImagem.length > 0 || soNoAplis.length > 0,
  };
}

// ─── Pipeline completo ──────────────────────────────────────────────────────────

export async function processarRequisicao(
  supabase: SupabaseClient,
  arquivos: ArquivoRequisicao[],
  numeroRequisicaoManual: string | null,
): Promise<ResultadoPipeline> {
  const log = new PipelineLog();
  const filename = arquivos.map((a) => a.filename).join(', ');
  log.info(`═══ Início do pipeline ═══ ${arquivos.length} arquivo(s): ${filename}`);
  const result: ResultadoPipeline = { success: false, filename, etapas: {}, log: [] };

  // 1. Catálogo + OCR
  log.info('Etapa 1: OCR via Gemini Vision');
  let catalogo;
  try {
    catalogo = await carregarCatalogo(supabase);
    log.ok(`Catálogo ac_apoio_exames carregado: ${catalogo.length} entradas`);
  } catch (err) {
    catalogo = [];
    log.warn(`Falha ao carregar o catálogo — OCR seguirá sem tabela: ${String(err)}`);
  }

  let ocrData: Record<string, unknown>;
  try {
    ocrData = await ocrRequisicao(arquivos, montarPrompt(catalogoParaPrompt(catalogo)), log);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log.error(`Falha no OCR: ${msg}`);
    result.erro = `Falha no OCR: ${msg}`;
    result.etapas.ocr = { ok: false, erro: msg };
    result.log = log.toList();
    return result;
  }
  if (ocrData.success === false) {
    log.error('Gemini retornou erro', ocrData);
    result.erro = String(ocrData.erro ?? 'Gemini retornou erro');
    result.etapas.ocr = { ok: false, ...ocrData };
    result.log = log.toList();
    return result;
  }

  log.info('Etapa 1b: Correlacionando exames com o catálogo (ac_apoio_exames)');
  const examesImagem = enriquecerCodigos(
    Array.isArray(ocrData.exames) ? (ocrData.exames as ExameImagem[]) : [],
    catalogo,
    log,
  );
  const numeroRequisicao = (
    numeroRequisicaoManual ?? String(ocrData.numero_requisicao ?? '')
  ).trim();
  log.ok(
    `OCR concluído: ${examesImagem.length} exame(s) | nº requisição: '${numeroRequisicao || 'não encontrado'}'`,
  );
  result.etapas.ocr = { ok: true, exames: examesImagem.length, num_req: numeroRequisicao };

  // 2. Conferência no apLIS
  log.info('Etapa 2: Consulta APLIS (requisicaoListar)');
  let aplis: RequisicaoAplis | null = null;
  if (numeroRequisicao) {
    try {
      aplis = await buscarRequisicaoAplis(numeroRequisicao, log);
      result.etapas.aplis = aplis
        ? { ok: true, requisicao: numeroRequisicao, paciente: aplis.nome }
        : { ok: false, aviso: `Requisição '${numeroRequisicao}' não encontrada no APLIS` };
    } catch (err) {
      log.error(`Erro ao consultar APLIS: ${String(err)}`);
      result.etapas.aplis = { ok: false, erro: String(err) };
    }
  } else {
    log.warn('Número de requisição ausente — consulta APLIS pulada');
    result.etapas.aplis = { ok: false, aviso: 'Número de requisição não encontrado' };
  }

  // 3. Comparação imagem × apLIS
  const examesAplis = (aplis?.exames ?? []) as Record<string, unknown>[];
  const comparacao = compararExames(examesImagem, examesAplis, log);
  result.etapas.comparacao = {
    ok: true,
    divergencia: comparacao.divergencia,
    coincidentes: (comparacao.coincidentes as unknown[]).length,
    so_na_imagem: (comparacao.so_na_imagem as unknown[]).length,
    so_no_aplis: (comparacao.so_no_aplis as unknown[]).length,
  };

  // Todos os exames com código AOL seguem para o XML
  const examesParaEnviar = examesImagem.filter((ex) => ex.codigo_aol_sugerido);
  log.info(`Exames com código AOL para enviar: ${examesParaEnviar.length} de ${examesImagem.length}`);

  // 4. Consolidação do paciente/médico (apLIS tem prioridade sobre a imagem)
  const pacienteImagem = (ocrData.paciente ?? {}) as Record<string, unknown>;
  const medicoImagem = (ocrData.medico ?? {}) as Record<string, unknown>;
  const paciente = {
    nome: aplis ? aplis.nome : pacienteImagem.nome ?? null,
    cpf: aplis ? aplis.cpf : pacienteImagem.cpf ?? null,
    datanasc: aplis ? aplis.datanasc : pacienteImagem.datanasc ?? null,
    sexo: aplis ? aplis.sexo : pacienteImagem.sexo ?? null,
    email: aplis ? aplis.email : pacienteImagem.email ?? null,
    fonte: aplis?.nome ? 'aplis' : 'imagem',
  };
  const medico = {
    nome: aplis?.medico_nome ?? medicoImagem.nome ?? null,
    crm: aplis?.medico_crm ?? medicoImagem.crm ?? null,
  };

  // 5. XML AOL sugerido
  log.info('Etapa 3: Gerando XML para o Álvaro');
  const dadosImagem: DadosImagem = {
    paciente: pacienteImagem,
    medico: medicoImagem,
    numero_requisicao: numeroRequisicao || null,
    data_solicitacao: (ocrData.data_solicitacao as string | null) ?? null,
  };
  const xml = gerarXmlAlvaro(aplis, dadosImagem, examesParaEnviar, {}, log);

  result.success = true;
  result.numero_requisicao = numeroRequisicao || null;
  result.paciente = paciente;
  result.medico = medico;
  result.convenio = aplis?.convenio ?? ocrData.convenio ?? null;
  result.data_solicitacao = aplis?.data_solicitacao ?? ocrData.data_solicitacao ?? null;
  result.exames_imagem = examesImagem;
  result.exames_aplis = examesAplis;
  result.comparacao = comparacao;
  result.exames_para_enviar = examesParaEnviar;
  result.alvaro_xml_sugerido = xml;
  result._aplis_raw = aplis; // usado pelo rebuild-xml
  result.resumo = {
    total_imagem: examesImagem.length,
    total_aplis: examesAplis.length,
    coincidentes: (comparacao.coincidentes as unknown[]).length,
    so_na_imagem: (comparacao.so_na_imagem as unknown[]).length,
    so_no_aplis: (comparacao.so_no_aplis as unknown[]).length,
    divergencia: comparacao.divergencia,
    para_enviar_alvaro: examesParaEnviar.length,
    aplis_consultado: aplis !== null,
    fonte_paciente: paciente.fonte,
  };
  log.ok(`═══ Pipeline concluído — ${examesParaEnviar.length} exame(s) prontos para o Álvaro ═══`);
  result.log = log.toList();
  return result;
}
