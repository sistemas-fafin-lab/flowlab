import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./dados.js', async (original) => ({
  ...(await original<typeof import('./dados.js')>()),
  // Quem é gestor da EVA (canManageAgenteTI): a Ana e a Carla; o Bruno não.
  lerQuemTem: vi.fn(async () => ['u-ana', 'u-carla']),
}));

import { MAX_ALERTAS_DIA, gerarRelatoriosDeGestao, gravarFotoDoDia, verificarAlertas } from './gestao.js';

const LINK = 'https://app/it/inicio';
// Sexta, 13/11, 8h e 22h em Brasília; segunda, 16/11, 8h; sábado, 14/11, 8h.
const SEXTA_8H = new Date('2026-11-13T11:00:00Z');
const SEXTA_22H = new Date('2026-11-14T01:00:00Z');
const SEGUNDA_8H = new Date('2026-11-16T11:00:00Z');
const SABADO_8H = new Date('2026-11-14T11:00:00Z');

const membro = (id: string, nome: string, e: { relatorio?: boolean; alertas?: boolean; whatsapp?: string | null } = {}) => ({
  id: `m-${id}`, user_id: `u-${id}`, whatsapp: e.whatsapp === undefined ? '5561999990000' : e.whatsapp,
  recebe_relatorio: !!e.relatorio, recebe_alertas: !!e.alertas, perfil: { name: nome, deleted_at: null, disabled_at: null },
});

// Card crítico da Ana que venceu ontem: atraso novo e alerta.
const CRITICO = {
  id: 'c1', codigo: 'IT-045', title: 'Robô de pré-faturamento', priority: 'critical', status: 'in_progress', kanban_status: 'in_progress',
  assigned_to: ['u-ana'], due_date: '2026-11-12T00:00:00.000Z', kanban_hidden: false, project_id: null, sprint_id: null,
  updated_at: '2026-11-12T12:00:00Z', created_at: '2026-11-01T12:00:00Z',
};

interface Estado {
  whatsappAtivo: boolean;
  membros: ReturnType<typeof membro>[];
  cards: Record<string, unknown>[];
  /** Chaves já gravadas (chave_dia é única no banco). */
  chaves: Set<string>;
  /** Alertas que a pessoa já recebeu hoje. */
  alertasHoje: number;
  /** A foto diária mais recente antes do período (D42); fotoErro: a tabela ainda não existe. */
  foto?: Record<string, unknown> | null;
  fotoErro?: boolean;
}

/** Banco falso por tabela: o que cada leitura devolve e o que a fila grava. */
function criarDb(e: Estado) {
  const gravadas: Record<string, unknown>[] = [];
  const fotos: Record<string, unknown>[] = [];
  const from = (tabela: string) => {
    const f: Record<string, unknown> = {};
    let linha: Record<string, unknown> | null = null;
    let head = false;
    const q: Record<string, unknown> = {};
    for (const m of ['order', 'limit', 'range', 'gte', 'lt', 'not', 'or', 'neq', 'in', 'like']) q[m] = () => q;
    q.select = (_c?: string, o?: { head?: boolean }) => { if (o?.head) head = true; return q; };
    q.eq = (k: string, v: unknown) => { f[k] = v; return q; };
    q.upsert = (l: Record<string, unknown>) => { linha = l; return q; };
    q.maybeSingle = async () => {
      if (tabela === 'ti_agente_fotos') {
        return e.fotoErro ? { data: null, error: { message: 'relation "ti_agente_fotos" does not exist' } } : { data: e.foto ? { foto: e.foto } : null, error: null };
      }
      return {
        data: tabela === 'ti_agente_config' ? { whatsapp_ativo: e.whatsappAtivo, cobranca_ativa: true, dias_parado: 5 } : null,
        error: null,
      };
    };
    const resolver = () => {
      if (linha && tabela === 'ti_agente_fotos') {
        fotos.push(linha);
        return { data: null, error: null };
      }
      if (linha) {
        const chave = linha.chave_dia as string;
        if (e.chaves.has(chave)) return { data: [], error: null };
        e.chaves.add(chave);
        gravadas.push(linha);
        return { data: [{ id: `msg-${gravadas.length}` }], error: null };
      }
      switch (tabela) {
        case 'it_requests': return { data: f.is_internal === false ? [] : e.cards, error: null };
        case 'ti_agente_membros':
          return {
            data: e.membros.filter((m) => (f.recebe_relatorio === undefined || m.recebe_relatorio) && (f.recebe_alertas === undefined || m.recebe_alertas)
              && (f.recebe_relatorio === undefined && f.recebe_alertas === undefined ? true : !!m.whatsapp)),
            error: null,
          };
        case 'ti_agente_sugestoes': return { data: [], count: 0, error: null };
        case 'ti_agente_mensagens': return head ? { count: e.alertasHoje, error: null } : { data: [], error: null };
        default: return { data: [], error: null };
      }
    };
    q.then = (ok: (v: unknown) => unknown, erro?: (v: unknown) => unknown) => Promise.resolve(resolver()).then(ok, erro);
    return q;
  };
  return { db: { from }, gravadas, fotos };
}

let estado: Estado;
beforeEach(() => {
  estado = {
    whatsappAtivo: true,
    membros: [
      membro('ana', 'Ana Souza', { relatorio: true, alertas: true }),
      // Marcou, mas não é gestor: não recebe.
      membro('bruno', 'Bruno Mendes', { relatorio: true, alertas: true }),
      // Gestora sem a adesão marcada: não recebe.
      membro('carla', 'Carla Dias'),
    ],
    cards: [CRITICO],
    chaves: new Set(),
    alertasHoje: 0,
  };
});

describe('relatório de gestão da manhã (D38)', () => {
  it('dia útil: o do dia, só para o gestor com a adesão e WhatsApp; uma vez por dia', async () => {
    const { db, gravadas } = criarDb(estado);
    const r = await gerarRelatoriosDeGestao(db as never, { agora: SEXTA_8H, linkInicio: LINK });
    expect(r).toMatchObject({ pulado: null, recorte: 'dia', destinatarios: ['Ana Souza'], gravadas: 1, repetidas: 0 });
    expect(gravadas).toEqual([expect.objectContaining({
      membro_id: 'm-ana', tipo: 'relatorio', status: 'pendente', chave_dia: 'relatorio:m-ana:2026-11-13', proxima_tentativa_em: null,
    })]);
    expect(gravadas[0].texto).toMatch(/^📊 Gestão da TI · sexta, 13\/11\n\nKanban: 1 aberto · 1 atrasado \(1 novo\)/);
    expect(gravadas[0].texto).toContain('• IT-045 Robô de pré-faturamento: crítico, atrasado há 1 dia · Ana');

    const outra = await gerarRelatoriosDeGestao(db as never, { agora: SEXTA_8H, linkInicio: LINK });
    expect(outra).toMatchObject({ gravadas: 0, repetidas: 1 });
  });

  it('segunda: o da semana anterior, de segunda a domingo', async () => {
    const { db, gravadas } = criarDb(estado);
    const r = await gerarRelatoriosDeGestao(db as never, { agora: SEGUNDA_8H, linkInicio: LINK });
    expect(r.recorte).toBe('semana');
    expect(gravadas[0].texto).toMatch(/^📈 Semana da TI · 09\/11 a 15\/11\n\nNa semana\n/);
  });

  it('fim de semana e WhatsApp desligado não gravam; o dryRun monta o texto mesmo assim', async () => {
    const sabado = criarDb(estado);
    expect(await gerarRelatoriosDeGestao(sabado.db as never, { agora: SABADO_8H, linkInicio: LINK })).toMatchObject({ pulado: expect.stringContaining('Fim de semana'), texto: null });
    const previa = await gerarRelatoriosDeGestao(sabado.db as never, { agora: SABADO_8H, linkInicio: LINK, dryRun: true });
    expect(previa.texto).toMatch(/^📊 Gestão da TI/);
    expect(sabado.gravadas).toEqual([]);

    estado.whatsappAtivo = false;
    const desligado = criarDb(estado);
    expect(await gerarRelatoriosDeGestao(desligado.db as never, { agora: SEXTA_8H, linkInicio: LINK })).toMatchObject({ pulado: 'O WhatsApp da EVA está desligado.' });
    expect(desligado.gravadas).toEqual([]);
  });

  it('ninguém marcado: diz onde marcar', async () => {
    estado.membros = [membro('carla', 'Carla Dias')];
    const { db } = criarDb(estado);
    expect(await gerarRelatoriosDeGestao(db as never, { agora: SEXTA_8H, linkInicio: LINK }))
      .toMatchObject({ pulado: 'Nenhum gestor com o relatório de gestão marcado (EVA → Membros).' });
  });
});

describe('alertas na hora (D38)', () => {
  it('no horário da EVA: grava o alerta para o gestor marcado, uma vez por acontecimento', async () => {
    const { db, gravadas } = criarDb(estado);
    const r = await verificarAlertas(db as never, { agora: SEXTA_8H, linkInicio: LINK });
    expect(r).toMatchObject({ pulado: null, detectados: 1, gravados: 1, repetidos: 0, noLimite: 0 });
    expect(gravadas).toEqual([expect.objectContaining({ membro_id: 'm-ana', tipo: 'alerta', chave_dia: 'alerta:m-ana:atraso:c1:2026-11-12' })]);
    expect(gravadas[0].texto).toMatch(/^🚨 Card crítico atrasado: IT-045/);

    expect(await verificarAlertas(db as never, { agora: SEXTA_8H, linkInicio: LINK })).toMatchObject({ gravados: 0, repetidos: 1 });
  });

  it('fora do horário não confere; no limite do dia, o alerta espera', async () => {
    expect(await verificarAlertas(criarDb(estado).db as never, { agora: SEXTA_22H, linkInicio: LINK })).toMatchObject({ pulado: 'Fora do horário da EVA.' });
    estado.alertasHoje = MAX_ALERTAS_DIA;
    const cheio = criarDb(estado);
    expect(await verificarAlertas(cheio.db as never, { agora: SEXTA_8H, linkInicio: LINK })).toMatchObject({ gravados: 0, noLimite: 1 });
    expect(cheio.gravadas).toEqual([]);
  });

  it('sem ninguém com os alertas marcados, nem confere o painel', async () => {
    estado.membros = [membro('ana', 'Ana Souza', { relatorio: true })];
    expect(await verificarAlertas(criarDb(estado).db as never, { agora: SEXTA_8H, linkInicio: LINK })).toMatchObject({ pulado: 'Nenhum gestor com os alertas marcados.' });
  });
});

describe('foto diária e tendência (D42)', () => {
  it('o fechamento grava a foto do painel de hoje, uma linha por dia', async () => {
    const { db, fotos } = criarDb(estado);
    const f = await gravarFotoDoDia(db as never, new Date('2026-11-13T21:00:00Z'));
    expect(f).toMatchObject({ dia: '2026-11-13', abertos: 1, atrasados: 1, criticosAtrasados: 1, naFila: 0, pessoas: { 'u-ana': { abertos: 1, atrasados: 1, concluidos: 0 } } });
    expect(fotos).toEqual([{ dia: '2026-11-13', foto: f }]);
  });

  it('o relatório da semana compara com a foto de antes do período; sem a tabela, só não compara', async () => {
    estado.foto = { dia: '2026-11-06', abertos: 4, atrasados: 2, naFila: 3 };
    const { db, gravadas } = criarDb(estado);
    await gerarRelatoriosDeGestao(db as never, { agora: SEGUNDA_8H, linkInicio: LINK });
    expect(gravadas[0].texto).toContain('• Em 06/11: 2 atrasados e 3 na fila (agora 1 e 0)');

    estado.fotoErro = true;
    estado.chaves = new Set();
    const semTabela = criarDb(estado);
    expect(await gerarRelatoriosDeGestao(semTabela.db as never, { agora: SEGUNDA_8H, linkInicio: LINK })).toMatchObject({ gravadas: 1 });
    expect(semTabela.gravadas[0].texto).not.toContain('• Em ');
  });
});
