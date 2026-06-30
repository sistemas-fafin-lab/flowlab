/**
 * API Route: GET /api/analises-clinicas/get-disponibilidade
 *
 * Vercel Serverless Function — devolve postos ativos e seus horários futuros
 * disponíveis (direção LAB-HUB → FlowLab, D3). O SchedulePage do LAB-HUB consome
 * essa lista via proxy GET /api/v1/postos/disponibilidade.
 *
 * A agenda é GERADA a partir do modelo recorrente:
 *   • ac_horarios_padrao — horários fixos do posto, válidos de SEG a SÁB
 *   • ac_dias_excecao    — por data, fecha o dia ou troca a lista de horários
 * Para os próximos N dias, aplicamos a base/exceção e descontamos os agendamentos
 * já feitos (ocupação derivada de ac_agendamentos; cancelar libera o horário).
 *
 * Autorização: header `Authorization: Bearer <FLOWLAB_API_KEY>` (server-to-server).
 *
 * Formato de retorno (espelha PostoDisponivel de @lab-hub/shared):
 *   [{ id, nome, endereco, slots: string[] /* ISO 8601 *\/ }]
 *
 * Variáveis de ambiente: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, FLOWLAB_API_KEY.
 *   DISPONIBILIDADE_DIAS (default 60) — janela de dias gerada.
 *   AGENDA_TZ_OFFSET (default '-03:00') — fuso em que "08:00" é interpretado
 *   (Brasília; o servidor roda em UTC). Brasil não usa horário de verão desde 2019.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSupabaseAdminClient } from '../_lib/supabase.js';
import { isFlowlabApiKeyValid } from '../_lib/labhubIntegration.js';

interface PostoDisponivel {
  id: string;
  nome: string;
  endereco: string;
  slots: string[];
}

interface HorarioItem {
  hora: string; // 'HH:MM'
  capacidade: number;
}

// 'HH:MM:SS' | 'HH:MM' → 'HH:MM'
const normHora = (h: string): string => String(h).slice(0, 5);

const toItem = (raw: unknown): HorarioItem | null => {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as { hora?: unknown; capacidade?: unknown };
  if (typeof o.hora !== 'string') return null;
  const capacidade = Number(o.capacidade);
  return { hora: normHora(o.hora), capacidade: Number.isFinite(capacidade) && capacidade >= 1 ? capacidade : 1 };
};

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
): Promise<void> {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    res.status(405).json({ success: false, error: 'Método não permitido' });
    return;
  }

  if (!isFlowlabApiKeyValid(req)) {
    res.status(401).json({ success: false, error: 'Não autorizado' });
    return;
  }

  try {
    const supabase = getSupabaseAdminClient();

    const diasJanela = Math.max(1, Number(process.env.DISPONIBILIDADE_DIAS) || 60);
    const tzOffset = process.env.AGENDA_TZ_OFFSET || '-03:00';
    // Offset 'AHH:MM' → minutos (para descobrir a data/dia-da-semana local de Brasília).
    const m = /^([+-])(\d{2}):(\d{2})$/.exec(tzOffset);
    const offsetMin = m ? (m[1] === '-' ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3])) : -180;

    const [{ data: postos, error: postosErr }, { data: padroes, error: padErr }, { data: excecoes, error: excErr }] =
      await Promise.all([
        supabase.from('ac_postos').select('id, nome, endereco').eq('ativo', true).order('nome'),
        supabase.from('ac_horarios_padrao').select('posto_id, hora, capacidade'),
        supabase.from('ac_dias_excecao').select('posto_id, data, fechado, horarios'),
      ]);
    if (postosErr) throw postosErr;
    if (padErr) throw padErr;
    if (excErr) throw excErr;

    const nowMs = Date.now();
    const nowIso = new Date(nowMs).toISOString();

    // Ocupação derivada de ac_agendamentos (status <> 'cancelado'), por (posto, instante).
    const { data: agendamentos, error: agErr } = await supabase
      .from('ac_agendamentos')
      .select('posto_id, data_hora, status')
      .gt('data_hora', nowIso)
      .neq('status', 'cancelado');
    if (agErr) throw agErr;

    const chave = (postoId: string, iso: string) => `${postoId}|${iso}`;
    const ocupacao = new Map<string, number>();
    for (const a of agendamentos ?? []) {
      if (!a.posto_id) continue;
      const k = chave(a.posto_id, new Date(a.data_hora as string).toISOString());
      ocupacao.set(k, (ocupacao.get(k) ?? 0) + 1);
    }

    // Base recorrente por posto (ordenada por hora).
    const baseraw = new Map<string, HorarioItem[]>();
    for (const p of padroes ?? []) {
      const lista = baseraw.get(p.posto_id) ?? [];
      lista.push({ hora: normHora(p.hora as string), capacidade: (p.capacidade as number) ?? 1 });
      baseraw.set(p.posto_id, lista);
    }
    for (const lista of baseraw.values()) lista.sort((a, b) => a.hora.localeCompare(b.hora));

    // Exceções por posto+data.
    const excMap = new Map<string, { fechado: boolean; horarios: HorarioItem[] }>();
    for (const e of excecoes ?? []) {
      const horarios = Array.isArray(e.horarios)
        ? (e.horarios as unknown[]).map(toItem).filter((x): x is HorarioItem => x !== null)
        : [];
      horarios.sort((a, b) => a.hora.localeCompare(b.hora));
      excMap.set(`${e.posto_id}|${e.data}`, { fechado: Boolean(e.fechado), horarios });
    }

    // "Hoje" no fuso local (Brasília): desloca o relógio UTC e lê os componentes.
    const localNow = new Date(nowMs + offsetMin * 60_000);
    const baseUTC = Date.UTC(localNow.getUTCFullYear(), localNow.getUTCMonth(), localNow.getUTCDate());
    const pad = (n: number) => String(n).padStart(2, '0');

    const resposta: PostoDisponivel[] = (postos ?? []).map((p) => {
      const base = baseraw.get(p.id) ?? [];
      const slots: string[] = [];

      for (let i = 0; i < diasJanela; i++) {
        const d = new Date(baseUTC + i * 86_400_000);
        const dateStr = `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
        const dow = d.getUTCDay(); // 0 = domingo

        let horarios: HorarioItem[];
        const exc = excMap.get(`${p.id}|${dateStr}`);
        if (exc) {
          if (exc.fechado) continue; // feriado/fechado
          horarios = exc.horarios; // lista própria do dia (vazia = sem agenda)
        } else if (dow === 0) {
          continue; // domingo não tem base
        } else {
          horarios = base;
        }

        for (const h of horarios) {
          const instante = new Date(`${dateStr}T${h.hora}:00${tzOffset}`);
          const ms = instante.getTime();
          if (!Number.isFinite(ms) || ms <= nowMs) continue; // inválido ou já passou
          const iso = instante.toISOString();
          const ocupado = ocupacao.get(chave(p.id, iso)) ?? 0;
          if (ocupado >= h.capacidade) continue;
          slots.push(iso);
        }
      }

      return { id: p.id, nome: p.nome, endereco: p.endereco ?? '', slots };
    });

    res.status(200).json(resposta);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro desconhecido';
    console.error('[analises-clinicas/get-disponibilidade] erro:', message);
    res.status(500).json({ success: false, error: 'Erro interno' });
  }
}
