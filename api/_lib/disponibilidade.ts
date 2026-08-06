// api/_lib/disponibilidade.ts
// Cálculo da disponibilidade de coleta (postos ativos + horários livres),
// derivado da GRADE de cada posto. Extraído de api/analises-clinicas/get-disponibilidade.ts
// para ser reusado por dois consumidores com AUTORIZAÇÕES diferentes:
//   - get-disponibilidade.ts        → LAB-HUB (FLOWLAB_API_KEY, server-to-server)
//   - disponibilidade-operador (via recepcaoAgendamento.ts) → operador (JWT + canManageColetas)
// A fonte da verdade (grade, ocupação, feriados, fuso) fica única aqui.
//
// O PACIENTE só enxerga o futuro. O OPERADOR também enxerga os últimos
// `AGENDA_RETROATIVO_DIAS` dias (janela retroativa, default 30 = um mês): o
// registro do atendimento é assíncrono — a recepção lança no sistema o que
// aconteceu ontem, na semana passada, ou hoje de manhã. São os mesmos horários
// da grade, só ainda não vencidos no cadastro.

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

export interface OpcoesDisponibilidade {
  /**
   * Dias JÁ PASSADOS a incluir na grade (0 = só do agora em diante).
   * Vale apenas para o operador — o paciente nunca recebe horário vencido.
   */
  retroativoDias?: number;
}

/**
 * Quantos dias para trás o operador pode lançar um agendamento
 * (AGENDA_RETROATIVO_DIAS, default 30 — "um mês" em dias corridos, para o piso
 * da janela não variar com o tamanho do mês). Zero desliga a janela retroativa e
 * devolve o comportamento antigo, idêntico ao do paciente.
 */
export function diasRetroativosOperador(): number {
  const bruto = Number(process.env.AGENDA_RETROATIVO_DIAS);
  if (!Number.isFinite(bruto)) return 30;
  return Math.max(0, Math.trunc(bruto));
}

/**
 * Calcula a disponibilidade de todos os postos ativos para os próximos N dias
 * (mais os `retroativoDias` anteriores, quando pedido). Aplica a grade/bloqueios
 * de cada posto e desconta os agendamentos já feitos (ocupação derivada de
 * ac_agendamentos; cancelar libera o horário).
 *
 * Variáveis de ambiente:
 *   DISPONIBILIDADE_DIAS (default 60) — janela de dias futuros gerada.
 *   AGENDA_RETROATIVO_DIAS (default 30) — teto da janela retroativa do operador.
 *   AGENDA_TZ_OFFSET (default '-03:00') — fuso em que "08:00" é interpretado
 *   (Brasília; o servidor roda em UTC). Brasil não usa horário de verão desde 2019.
 */
export async function computarDisponibilidade(
  opcoes: OpcoesDisponibilidade = {},
): Promise<PostoDisponivel[]> {
  const supabase = getSupabaseAdminClient();

  const retroDias = Math.max(0, Math.trunc(opcoes.retroativoDias ?? 0));
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

  // "Hoje" no fuso local (Brasília): desloca o relógio UTC e lê os componentes.
  const localNow = new Date(nowMs + offsetMin * 60_000);
  const baseUTC = Date.UTC(localNow.getUTCFullYear(), localNow.getUTCMonth(), localNow.getUTCDate());
  // Instante real da meia-noite local do primeiro dia da janela. `baseUTC` são os
  // componentes da data local escritos como UTC, então desfazer o offset devolve
  // o instante verdadeiro.
  const janelaInicioMs = baseUTC - retroDias * 86_400_000 - offsetMin * 60_000;
  // Meia-noite local do dia seguinte ao último da janela — teto da ocupação.
  const janelaFimMs = baseUTC + diasJanela * 86_400_000 - offsetMin * 60_000;
  // Horários vencidos só entram quando há janela retroativa (operador).
  const limiteMs = retroDias > 0 ? janelaInicioMs : nowMs;

  // Ocupação derivada de ac_agendamentos (status <> 'cancelado'), por (posto, instante).
  // O piso acompanha a janela: sem ele, um horário retroativo já preenchido voltaria
  // a aparecer como livre e o operador criaria uma duplicata.
  //
  // Paginado e limitado aos DOIS extremos da janela porque o PostgREST corta a
  // resposta em 1000 linhas (mesmo motivo da paginação em api/_lib/apoio/catalogo.ts).
  // Truncar aqui é silencioso e caro: um horário já tomado reapareceria como livre.
  // Ordenação por `id` (único) — ordenar por data_hora empata justamente nas linhas
  // que interessam, e empate desestabiliza a paginação.
  const chave = (postoId: string, iso: string) => `${postoId}|${iso}`;
  const ocupacao = new Map<string, number>();
  const PAGINA = 1000;
  for (let offset = 0; ; offset += PAGINA) {
    const { data: pagina, error: agErr } = await supabase
      .from('ac_agendamentos')
      .select('posto_id, data_hora, status')
      .gte('data_hora', new Date(limiteMs).toISOString())
      .lt('data_hora', new Date(janelaFimMs).toISOString())
      .neq('status', 'cancelado')
      .order('id', { ascending: true })
      .range(offset, offset + PAGINA - 1);
    if (agErr) throw agErr;

    for (const a of pagina ?? []) {
      if (!a.posto_id) continue;
      const k = chave(a.posto_id, new Date(a.data_hora as string).toISOString());
      ocupacao.set(k, (ocupacao.get(k) ?? 0) + 1);
    }
    if (!pagina || pagina.length < PAGINA) break;
  }

  // Datas bloqueadas por posto (feriados).
  const bloqueado = new Set<string>();
  for (const b of bloqueios ?? []) {
    bloqueado.add(`${b.posto_id}|${b.data}`);
  }

  return (postos ?? []).map((p) => {
    const grade = toGrade(p as Parameters<typeof toGrade>[0]);
    const slots: string[] = [];
    if (!grade) return { id: p.id, nome: p.nome, endereco: p.endereco ?? '', slots };

    for (let i = -retroDias; i < diasJanela; i++) {
      const d = new Date(baseUTC + i * 86_400_000);
      const dateStr = `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
      const dow = d.getUTCDay(); // 0 = domingo

      if (bloqueado.has(`${p.id}|${dateStr}`)) continue; // feriado/bloqueado
      if (!grade.dias.has(dow)) continue;                // dia fora da operação

      for (let t = grade.inicioMin; t <= grade.fimMin; t += grade.intervaloMin) {
        const instante = new Date(`${dateStr}T${minParaHora(t)}:00${tzOffset}`);
        const ms = instante.getTime();
        // Sem janela retroativa, tudo que já passou some (fluxo do paciente). Com
        // ela, vale qualquer horário a partir do início da janela.
        if (!Number.isFinite(ms)) continue;
        if (retroDias > 0 ? ms < limiteMs : ms <= limiteMs) continue;
        const iso = instante.toISOString();
        if ((ocupacao.get(chave(p.id, iso)) ?? 0) >= 1) continue; // 1 paciente por horário
        slots.push(iso);
      }
    }

    return { id: p.id, nome: p.nome, endereco: p.endereco ?? '', slots };
  });
}
