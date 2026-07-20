// api/_lib/disponibilidade.ts
// Cálculo da disponibilidade de coleta (postos ativos + horários futuros livres),
// derivado da GRADE de cada posto. Extraído de api/analises-clinicas/get-disponibilidade.ts
// para ser reusado por dois consumidores com AUTORIZAÇÕES diferentes:
//   - get-disponibilidade.ts        → LAB-HUB (FLOWLAB_API_KEY, server-to-server)
//   - disponibilidade-operador (via recepcaoAgendamento.ts) → operador (JWT + canManageColetas)
// A fonte da verdade (grade, ocupação, feriados, fuso) fica única aqui.

import { getSupabaseAdminClient } from './supabase.js';

// Espelha PostoDisponivel de @lab-hub/shared.
export interface PostoDisponivel {
  id: string;
  nome: string;
  endereco: string;
  slots: string[]; // horários ISO 8601 disponíveis
}

// Grade de agenda de um posto (colunas agenda_* de ac_postos).
interface AgendaGrade {
  inicioMin: number;   // minutos desde 00:00
  fimMin: number;      // minutos desde 00:00
  intervaloMin: number;
  dias: Set<number>;   // dias-da-semana operados (0=dom … 6=sáb)
}

// 'HH:MM:SS' | 'HH:MM' → minutos desde 00:00, ou null se inválido.
const horaParaMin = (h: unknown): number | null => {
  if (typeof h !== 'string') return null;
  const m = /^(\d{1,2}):(\d{2})/.exec(h);
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
};

// Constrói a grade do posto; devolve null se a agenda não estiver configurada.
const toGrade = (p: {
  agenda_hora_inicio: unknown;
  agenda_hora_fim: unknown;
  agenda_intervalo_min: unknown;
  agenda_dias_semana: unknown;
}): AgendaGrade | null => {
  const inicioMin = horaParaMin(p.agenda_hora_inicio);
  const fimMin = horaParaMin(p.agenda_hora_fim);
  const intervaloMin = Number(p.agenda_intervalo_min);
  const dias = Array.isArray(p.agenda_dias_semana)
    ? new Set((p.agenda_dias_semana as unknown[]).map(Number).filter((d) => d >= 0 && d <= 6))
    : new Set<number>();
  if (inicioMin === null || fimMin === null) return null;
  if (!Number.isFinite(intervaloMin) || intervaloMin <= 0) return null;
  if (fimMin < inicioMin || dias.size === 0) return null;
  return { inicioMin, fimMin, intervaloMin, dias };
};

const pad = (n: number) => String(n).padStart(2, '0');
const minParaHora = (min: number) => `${pad(Math.floor(min / 60))}:${pad(min % 60)}`;

/**
 * Calcula a disponibilidade de todos os postos ativos para os próximos N dias.
 * Aplica a grade/bloqueios de cada posto e desconta os agendamentos já feitos
 * (ocupação derivada de ac_agendamentos; cancelar libera o horário).
 *
 * Variáveis de ambiente:
 *   DISPONIBILIDADE_DIAS (default 60) — janela de dias gerada.
 *   AGENDA_TZ_OFFSET (default '-03:00') — fuso em que "08:00" é interpretado
 *   (Brasília; o servidor roda em UTC). Brasil não usa horário de verão desde 2019.
 */
export async function computarDisponibilidade(): Promise<PostoDisponivel[]> {
  const supabase = getSupabaseAdminClient();

  const diasJanela = Math.max(1, Number(process.env.DISPONIBILIDADE_DIAS) || 60);
  const tzOffset = process.env.AGENDA_TZ_OFFSET || '-03:00';
  // Offset 'AHH:MM' → minutos (para descobrir a data/dia-da-semana local de Brasília).
  const m = /^([+-])(\d{2}):(\d{2})$/.exec(tzOffset);
  const offsetMin = m ? (m[1] === '-' ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3])) : -180;

  const [{ data: postos, error: postosErr }, { data: bloqueios, error: bloqErr }] =
    await Promise.all([
      supabase
        .from('ac_postos')
        .select('id, nome, endereco, agenda_hora_inicio, agenda_hora_fim, agenda_intervalo_min, agenda_dias_semana')
        .eq('ativo', true)
        .order('nome'),
      supabase.from('ac_dias_excecao').select('posto_id, data'),
    ]);
  if (postosErr) throw postosErr;
  if (bloqErr) throw bloqErr;

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

  // Datas bloqueadas por posto (feriados).
  const bloqueado = new Set<string>();
  for (const b of bloqueios ?? []) {
    bloqueado.add(`${b.posto_id}|${b.data}`);
  }

  // "Hoje" no fuso local (Brasília): desloca o relógio UTC e lê os componentes.
  const localNow = new Date(nowMs + offsetMin * 60_000);
  const baseUTC = Date.UTC(localNow.getUTCFullYear(), localNow.getUTCMonth(), localNow.getUTCDate());

  return (postos ?? []).map((p) => {
    const grade = toGrade(p as Parameters<typeof toGrade>[0]);
    const slots: string[] = [];
    if (!grade) return { id: p.id, nome: p.nome, endereco: p.endereco ?? '', slots };

    for (let i = 0; i < diasJanela; i++) {
      const d = new Date(baseUTC + i * 86_400_000);
      const dateStr = `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
      const dow = d.getUTCDay(); // 0 = domingo

      if (bloqueado.has(`${p.id}|${dateStr}`)) continue; // feriado/bloqueado
      if (!grade.dias.has(dow)) continue;                // dia fora da operação

      for (let t = grade.inicioMin; t <= grade.fimMin; t += grade.intervaloMin) {
        const instante = new Date(`${dateStr}T${minParaHora(t)}:00${tzOffset}`);
        const ms = instante.getTime();
        if (!Number.isFinite(ms) || ms <= nowMs) continue; // inválido ou já passou
        const iso = instante.toISOString();
        if ((ocupacao.get(chave(p.id, iso)) ?? 0) >= 1) continue; // 1 paciente por horário
        slots.push(iso);
      }
    }

    return { id: p.id, nome: p.nome, endereco: p.endereco ?? '', slots };
  });
}
