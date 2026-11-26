// O que a VPS faz além da fila (D43 e D44, issue 32). Roda no script da VPS
// (tools/agente-ti-whatsapp/send-outbox.ts); o banco e o WAHA chegam por injeção, para testar.
// - baixarMidias: o áudio ou a imagem recebidos ficam no WAHA local, que a Vercel não alcança (D9).
//   A VPS baixa, sobe para o bucket privado ti-agente-midias e avisa a Vercel (/api/ti/agente-midia).
// - criarChamadorVercel: as duas rotas que a VPS chama, com o CRON_SECRET. Nunca lança.
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  BUCKET_MIDIAS, MIDIA_DESISTE_MS, MIDIA_MAX_BYTES, caminhoDaMidia, caminhoNoWaha, mimeBase,
} from '../../../src/modules/eva/domain/midia.js';
import type { ClienteWaha } from './waha.js';

export interface MidiaPendente { id: string; membro_id: string; midia_url: string | null; midia_mimetype: string | null; created_at: string }

export interface RepositorioMidias {
  pendentes(limite: number): Promise<MidiaPendente[]>;
  subir(caminho: string, bytes: Uint8Array, mimetype: string): Promise<void>;
  marcarBaixada(id: string, caminho: string, bytes: number): Promise<void>;
  marcarNaoBaixou(id: string, erro: string): Promise<void>;
}

export type AvisarMidia = (mensagemId: string) => Promise<{ ok: true } | { ok: false; erro: string }>;

export interface ResultadoMidias {
  baixadas: number;
  /** Não baixou de vez (arquivo grande, sumiu do WAHA): a Vercel pede para mandar de novo. */
  naoBaixadas: number;
  /** Falhou agora e tenta de novo na próxima passada (dentro de MIDIA_DESISTE_MS). */
  adiadas: number;
  /** O aviso à Vercel falhou: o relógio retoma em até 10 min. */
  avisosFalhos: number;
  erros: string[];
}

export async function baixarMidias(
  repo: RepositorioMidias,
  waha: Pick<ClienteWaha, 'baixarArquivo'>,
  avisar: AvisarMidia,
  opcoes: { agora?: () => number; limite?: number } = {},
): Promise<ResultadoMidias> {
  const agora = opcoes.agora ?? Date.now;
  const r: ResultadoMidias = { baixadas: 0, naoBaixadas: 0, adiadas: 0, avisosFalhos: 0, erros: [] };
  const avisarVercel = async (id: string) => {
    const a = await avisar(id);
    if ('erro' in a) { r.avisosFalhos += 1; r.erros.push(`aviso à Vercel: ${a.erro}`); }
  };
  const desistir = async (m: MidiaPendente, erro: string) => {
    await repo.marcarNaoBaixou(m.id, erro);
    r.naoBaixadas += 1;
    r.erros.push(erro);
    await avisarVercel(m.id);
  };

  for (const m of await repo.pendentes(opcoes.limite ?? 3)) {
    const caminho = caminhoNoWaha(m.midia_url);
    if (!caminho) { await desistir(m, 'A URL do arquivo no WAHA não é válida.'); continue; }

    const b = await waha.baixarArquivo(caminho);
    if ('erro' in b) {
      // O WAHA guarda o arquivo por alguns minutos: até lá, tenta de novo na próxima passada.
      if (agora() - Date.parse(m.created_at) > MIDIA_DESISTE_MS) await desistir(m, b.erro);
      else { r.adiadas += 1; r.erros.push(b.erro); }
      continue;
    }
    if (b.bytes.byteLength > MIDIA_MAX_BYTES) {
      await desistir(m, `Arquivo de ${(b.bytes.byteLength / 1024 / 1024).toFixed(1)} MB, acima do limite de 10 MB.`);
      continue;
    }
    const tipo = mimeBase(m.midia_mimetype) || mimeBase(b.mimetype) || 'application/octet-stream';
    const destino = caminhoDaMidia(m.membro_id, m.id, tipo);
    try {
      await repo.subir(destino, b.bytes, tipo);
      await repo.marcarBaixada(m.id, destino, b.bytes.byteLength);
    } catch (e) {
      r.adiadas += 1;
      r.erros.push(e instanceof Error ? e.message : String(e));
      continue;
    }
    r.baixadas += 1;
    await avisarVercel(m.id);
  }
  return r;
}

/** O repositório de verdade, com a service role. */
export function repositorioMidiasSupabase(db: SupabaseClient): RepositorioMidias {
  const falhou = (error: { message: string } | null) => { if (error) throw new Error(error.message); };
  return {
    async pendentes(limite) {
      const { data, error } = await db
        .from('ti_agente_mensagens')
        .select('id, membro_id, midia_url, midia_mimetype, created_at')
        .eq('direcao', 'entrada')
        .eq('midia_status', 'pendente')
        .order('created_at')
        .limit(limite);
      falhou(error);
      return ((data ?? []) as MidiaPendente[]).filter((m) => !!m.membro_id);
    },
    async subir(caminho, bytes, mimetype) {
      const { error } = await db.storage.from(BUCKET_MIDIAS).upload(caminho, bytes, { contentType: mimetype, upsert: true });
      falhou(error);
    },
    async marcarBaixada(id, caminho, bytes) {
      const { error } = await db.from('ti_agente_mensagens')
        .update({ midia_status: 'baixada', midia_path: caminho, midia_bytes: bytes })
        .eq('id', id).eq('midia_status', 'pendente');
      falhou(error);
    },
    async marcarNaoBaixou(id, erro) {
      const { error } = await db.from('ti_agente_mensagens')
        .update({ midia_status: 'nao_baixou', erro: erro.slice(0, 500) })
        .eq('id', id).eq('midia_status', 'pendente');
      falhou(error);
    },
  };
}

type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;

export interface ChamadorVercel {
  /** POST /api/ti/agente-midia — trata a mídia que acabou de subir. */
  midia: AvisarMidia;
  /** POST /api/ti/agente-relogio — as rotinas de horário (D44). */
  relogio(): Promise<{ ok: true; dados: unknown } | { ok: false; erro: string }>;
}

/** As rotas da Vercel que a VPS chama. Sem o segredo, nem tenta. O segredo nunca vai para o erro. */
export function criarChamadorVercel(cfg: { base: string; segredo: string; timeoutMs?: number }, fetchImpl: FetchLike = fetch): ChamadorVercel {
  const base = cfg.base.replace(/\/+$/, '');
  async function post(rota: string, corpo: unknown, timeoutMs: number): Promise<{ ok: true; dados: unknown } | { ok: false; erro: string }> {
    try {
      const resposta = await fetchImpl(`${base}/api/ti/${rota}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${cfg.segredo}`, 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(corpo ?? {}),
        signal: AbortSignal.timeout(timeoutMs),
      });
      const texto = await resposta.text().catch(() => '');
      if (!resposta.ok) {
        const dica = resposta.status === 401 ? ' (o CRON_SECRET da VPS é diferente do da Vercel?)' : resposta.status === 404 ? ' (o deploy com esta rota já foi feito?)' : '';
        return { ok: false, erro: `Vercel HTTP ${resposta.status} em /api/ti/${rota}${dica}` };
      }
      try { return { ok: true, dados: texto ? JSON.parse(texto) : null }; } catch { return { ok: true, dados: texto }; }
    } catch (e) {
      const nome = e instanceof Error ? e.name : '';
      if (nome === 'TimeoutError' || nome === 'AbortError') return { ok: false, erro: `A Vercel não respondeu a tempo em /api/ti/${rota}.` };
      return { ok: false, erro: `Sem conexão com a Vercel em /api/ti/${rota} (${e instanceof Error ? e.message : String(e)}).` };
    }
  }
  return {
    async midia(id) {
      const r = await post('agente-midia', { id }, cfg.timeoutMs ?? 15_000);
      return r.ok ? { ok: true } : r;
    },
    // O relógio responde na hora e trabalha em segundo plano: a VPS não fica parada esperando.
    relogio: () => post('agente-relogio', {}, cfg.timeoutMs ?? 15_000),
  };
}
