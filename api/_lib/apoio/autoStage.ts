// api/_lib/apoio/autoStage.ts
// Enfileiramento automático de um agendamento no Envio ao Álvaro. Quando um
// agendamento chega do LAB-HUB já com o pedido médico anexado, roda o mesmo
// pipeline do fluxo manual e deixa o item pronto na fila (status 'aguardando').
// O envio real ao Álvaro continua manual/conferido — a automação para na fila.
//
// Best-effort: qualquer falha vira apoio_status='erro' (visível para reprocessar
// pela varredura de pendentes) e NUNCA propaga — o chamador (receive-agendamento
// via waitUntil, ou a action apoio-auto-stage) não deve quebrar por causa disto.

import type { SupabaseClient } from '@supabase/supabase-js';
import { buscarDocumentosLabhub, type DocumentoFlowLab } from '../documentosCheckin.js';
import { processarRequisicao } from './pipeline.js';
import { mimePorNome, type ArquivoRequisicao } from './gemini.js';
import { randomUUID } from 'node:crypto';

const BUCKET = 'ac-apoio-requisicoes';
const MAX_ARQUIVOS = 4;

// Estágio do enfileiramento (espelha o CHECK de ac_agendamentos.apoio_status).
type ApoioStatus = 'pendente' | 'enfileirado' | 'sem_documento' | 'erro' | 'ignorado';

export interface AutoStageResultado {
  ok: boolean;
  // Motivo do desfecho, para o chamador reportar/logar sem interpretar o resto.
  motivo: 'enfileirado' | 'ja_enfileirado' | 'sem_documento' | 'ignorado' | 'nao_encontrado' | 'erro';
  filaId?: string;
  erro?: string;
}

function importavel(doc: DocumentoFlowLab): boolean {
  const mime = doc.mimeType ?? '';
  return mime.startsWith('image/') || mime === 'application/pdf' || /\.pdf$/i.test(doc.nomeArquivo ?? '');
}

async function setApoioStatus(
  supabase: SupabaseClient,
  agendamentoId: string,
  status: ApoioStatus,
): Promise<void> {
  const { error } = await supabase
    .from('ac_agendamentos')
    .update({ apoio_status: status })
    .eq('id', agendamentoId);
  if (error) {
    console.error(`[autoStage] falha ao marcar apoio_status='${status}' em ${agendamentoId}:`, error.message);
  }
}

/**
 * Baixa os bytes das signed URLs do LAB-HUB e, em paralelo, guarda uma cópia no
 * bucket privado (paridade de auditoria com o fluxo manual). A cópia é secundária:
 * se o upload falhar, seguimos com os bytes em memória e o nome do arquivo.
 */
async function baixarEArquivar(
  supabase: SupabaseClient,
  agendamentoId: string,
  docs: DocumentoFlowLab[],
): Promise<{ arquivos: ArquivoRequisicao[]; paths: string[] }> {
  const arquivos: ArquivoRequisicao[] = [];
  const paths: string[] = [];

  for (const doc of docs) {
    const resp = await fetch(doc.url);
    if (!resp.ok) {
      throw new Error(`Falha ao baixar documento do LAB-HUB (${doc.nomeArquivo}): HTTP ${resp.status}`);
    }
    const bytes = Buffer.from(await resp.arrayBuffer());
    const nome = doc.nomeArquivo || `${doc.id}`;
    arquivos.push({ data: bytes, mimeType: doc.mimeType || mimePorNome(nome), filename: nome });

    // Cópia de auditoria — não bloqueia o pipeline se falhar.
    const path = `${agendamentoId}/${randomUUID()}-${nome.replace(/[^\w.\-]+/g, '_')}`;
    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(path, bytes, { contentType: doc.mimeType || undefined, upsert: false });
    if (error) {
      console.error(`[autoStage] upload de auditoria falhou (${path}):`, error.message);
      paths.push(nome);
    } else {
      paths.push(path);
    }
  }

  return { arquivos, paths };
}

export async function autoStageAgendamento(
  supabase: SupabaseClient,
  agendamentoId: string,
): Promise<AutoStageResultado> {
  try {
    // ── 1. Agendamento + elegibilidade ──────────────────────────────────────────
    const { data: agendamento, error: agErr } = await supabase
      .from('ac_agendamentos')
      .select('id, status')
      .eq('id', agendamentoId)
      .maybeSingle();

    if (agErr) throw new Error(agErr.message);
    if (!agendamento) return { ok: false, motivo: 'nao_encontrado' };

    if (agendamento.status === 'cancelado' || agendamento.status === 'bloqueado') {
      await setApoioStatus(supabase, agendamentoId, 'ignorado');
      return { ok: false, motivo: 'ignorado' };
    }

    // ── 2. Dedup — um agendamento nunca gera dois itens ─────────────────────────
    const { data: jaExiste } = await supabase
      .from('ac_apoio_fila')
      .select('id')
      .eq('agendamento_id', agendamentoId)
      .limit(1)
      .maybeSingle();
    if (jaExiste) {
      await setApoioStatus(supabase, agendamentoId, 'enfileirado');
      return { ok: false, motivo: 'ja_enfileirado', filaId: jaExiste.id };
    }

    // ── 3. Pedido(s) médico(s) no LAB-HUB ───────────────────────────────────────
    const docsResp = await buscarDocumentosLabhub(supabase, agendamentoId);
    if (!docsResp.ok) throw new Error(docsResp.erro ?? 'Falha ao buscar documentos no LAB-HUB.');

    const pedidos = (docsResp.documentos ?? [])
      .filter((d) => d.tipo === 'pedido_medico' && importavel(d))
      .slice(0, MAX_ARQUIVOS);

    if (pedidos.length === 0) {
      await setApoioStatus(supabase, agendamentoId, 'sem_documento');
      return { ok: false, motivo: 'sem_documento' };
    }

    // ── 4. Baixa + arquiva + pipeline ───────────────────────────────────────────
    const { arquivos, paths } = await baixarEArquivar(supabase, agendamentoId, pedidos);
    const resultado = await processarRequisicao(supabase, arquivos, null);

    if (!resultado.success) {
      await setApoioStatus(supabase, agendamentoId, 'erro');
      return { ok: false, motivo: 'erro', erro: resultado.erro ?? 'Pipeline falhou.' };
    }

    // ── 5. Insere na fila (mesmo contrato do "Salvar na fila" manual) ────────────
    // xml_envio = XML sugerido pelo pipeline (exames com código AOL, credenciais em
    // placeholder). exames = todos os detectados, para a conferência na aba Fila.
    const { data: filaRow, error: insErr } = await supabase
      .from('ac_apoio_fila')
      .insert({
        status: 'aguardando',
        origem: 'automatico',
        agendamento_id: agendamentoId,
        numero_requisicao: resultado.numero_requisicao ?? null,
        filename: paths.join(', ') || resultado.filename,
        paciente: resultado.paciente ?? null,
        medico: resultado.medico ?? null,
        exames: resultado.exames_imagem ?? null,
        xml_envio: resultado.alvaro_xml_sugerido ?? null,
        resumo: resultado.resumo ?? null,
      })
      .select('id')
      .single();

    if (insErr) throw new Error(insErr.message);

    await setApoioStatus(supabase, agendamentoId, 'enfileirado');
    return { ok: true, motivo: 'enfileirado', filaId: filaRow.id };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[autoStage] erro ao enfileirar agendamento ${agendamentoId}:`, msg);
    // Marca erro para a varredura de pendentes reprocessar; nunca propaga.
    await setApoioStatus(supabase, agendamentoId, 'erro').catch(() => undefined);
    return { ok: false, motivo: 'erro', erro: msg };
  }
}
