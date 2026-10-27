import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./cobranca.js', async (original) => ({ ...(await original<typeof import('./cobranca.js')>()), lerCardsAbertos: vi.fn() }));
vi.mock('./dados.js', async (original) => ({ ...(await original<typeof import('./dados.js')>()), lerNomes: vi.fn(async () => ({ 'u-bruno': 'Bruno Mendes', 'u-ana': 'Ana Souza' })) }));

import { lerCardsAbertos } from './cobranca.js';
import {
  enfileirarNoGrupo, enviarResumoDaReuniao, gerarFechamentoDoDia, montarAviso, montarFechamento, montarResumoReuniao, motivoSemGrupo,
} from './grupo.js';
import type { CardTI } from '../../../src/modules/eva/domain/demandas.js';

const card = (c: Partial<CardTI>): CardTI => ({
  id: 'c1', codigo: 'IT-045', title: 'Robô de pré-faturamento', priority: 'high', status: 'in_progress', kanban_status: 'in_progress',
  assigned_to: ['u-bruno'], due_date: '2026-10-10T00:00:00.000Z', kanban_hidden: false, project_id: null, sprint_id: null,
  updated_at: '2026-10-10T12:00:00Z', created_at: '2026-10-01T12:00:00Z', ...c,
});
const ATRASADA = card({});
const AMANHA = card({ id: 'c2', codigo: 'IT-052', title: 'Hub de Laudos', due_date: '2026-10-15T00:00:00.000Z', assigned_to: ['u-ana', 'u-bruno'] });
const LONGE = card({ id: 'c3', codigo: 'IT-060', due_date: '2026-11-30T00:00:00.000Z' });
const FEITA = card({ id: 'c4', codigo: 'IT-070', title: 'Backup do servidor', kanban_status: 'done', status: 'resolved', assigned_to: ['u-ana'] });
const NOMES = { 'u-bruno': 'Bruno Mendes', 'u-ana': 'Ana Souza' };
const GRUPO = '120363000000000001@g.us';

describe('fechamento do dia', () => {
  it('concluídas, atrasadas e o que vence até o próximo dia útil, com o primeiro nome', () => {
    const m = montarFechamento({ hoje: '2026-10-14', concluidas: [FEITA], abertos: [ATRASADA, AMANHA, LONGE], nomes: NOMES, linkInicio: 'https://app/it/inicio' })!;
    expect(m.texto).toBe([
      'Fechamento do dia (14/10)',
      '',
      '✅ Concluídas hoje (1)',
      '• IT-070 Backup do servidor · Ana',
      '',
      '⚠️ Atrasadas (1)',
      '• IT-045 Robô de pré-faturamento · Bruno: venceu 10/10',
      '',
      '⏰ Vencem hoje ou amanhã (1)',
      '• IT-052 Hub de Laudos · Ana, Bruno: vence amanhã',
      '',
      'Detalhes no Início: https://app/it/inicio',
    ].join('\n'));
    expect(m.cardIds).toEqual(['c4', 'c1', 'c2']);
  });

  it('na sexta, "Vencem até segunda"; nada a dizer = null', () => {
    const segunda = card({ id: 'c5', codigo: 'IT-080', due_date: '2026-10-19T00:00:00.000Z' });
    expect(montarFechamento({ hoje: '2026-10-16', concluidas: [], abertos: [segunda], nomes: NOMES, linkInicio: 'x' })!.texto).toContain('⏰ Vencem até segunda (1)');
    expect(montarFechamento({ hoje: '2026-10-14', concluidas: [], abertos: [LONGE], nomes: NOMES, linkInicio: 'x' })).toBeNull();
  });

  it('seção longa corta em 6 itens', () => {
    const muitas = Array.from({ length: 8 }, (_, i) => card({ id: `a${i}`, codigo: `IT-1${i}0` }));
    const t = montarFechamento({ hoje: '2026-10-14', concluidas: [], abertos: muitas, nomes: NOMES, linkInicio: 'x' })!.texto;
    expect(t).toContain('⚠️ Atrasadas (8)');
    expect(t).toContain('… e mais 2');
  });
});

describe('textos do grupo', () => {
  it('resumo de reunião com decisões e sugestões', () => {
    expect(montarResumoReuniao({ id: 'r1', titulo: 'Weekly TI', realizadaEm: '2026-10-13T13:00:00Z', observacoes: 'Migrar o backup.', sugestoes: 3 }, 'https://app/it/inicio')).toBe([
      '📝 Reunião analisada: "Weekly TI" (13/10)',
      '',
      'Principais decisões: Migrar o backup.',
      '',
      '3 sugestões de mudança no Kanban aguardam aprovação de um gestor.',
      'Início: https://app/it/inicio',
    ].join('\n'));
    expect(montarResumoReuniao({ id: 'r1', titulo: 'X', realizadaEm: null, observacoes: null, sugestoes: 0 }, 'l')).toContain('Nenhuma mudança no Kanban foi proposta.');
  });

  it('aviso com o primeiro nome de quem pediu; grupo precisa de WhatsApp ligado e id @g.us', () => {
    expect(montarAviso('Ana Souza', '  Reunião às 10h. ')).toBe('📢 Aviso de Ana:\nReunião às 10h.');
    // D35: no grupo, para quem não tem WhatsApp, o nome de quem recebe.
    expect(montarAviso('Ana Souza', 'Reunião às 10h.', 'Bruno')).toBe('📢 Aviso de Ana para Bruno:\nReunião às 10h.');
    const cfg = { whatsappAtivo: true, grupoId: GRUPO, grupoNome: 'TI', fechamento: true, resumoReuniao: true };
    expect(motivoSemGrupo(cfg)).toBeNull();
    expect(motivoSemGrupo({ ...cfg, whatsappAtivo: false })).toContain('desligado');
    expect(motivoSemGrupo({ ...cfg, grupoId: '5561999924986@c.us' })).toContain('Nenhum grupo');
  });
});

// ── Banco falso ──────────────────────────────────────────────────────────────

function criarDb(config: Record<string, unknown>, existente = false) {
  const gravadas: { op: string; linha: Record<string, unknown>; opcoes?: unknown }[] = [];
  const from = (tabela: string) => {
    const q: Record<string, unknown> = {};
    let resultado: unknown = { data: [], error: null };
    for (const m of ['select', 'eq', 'neq', 'gte', 'order', 'limit']) q[m] = () => q;
    q.maybeSingle = async () => ({ data: tabela === 'ti_agente_config' ? config : null, error: null });
    q.insert = (linha: Record<string, unknown>) => { gravadas.push({ op: 'insert', linha }); resultado = { data: [{ id: 'novo' }], error: null }; return q; };
    q.upsert = (linha: Record<string, unknown>, opcoes: unknown) => {
      gravadas.push({ op: 'upsert', linha, opcoes });
      resultado = { data: existente ? [] : [{ id: 'novo' }], error: null };
      return q;
    };
    q.then = (ok: (v: unknown) => unknown) => Promise.resolve(resultado).then(ok);
    return q;
  };
  return { db: { from }, gravadas };
}

const CONFIG = { whatsapp_ativo: true, whatsapp_grupo_id: GRUPO, whatsapp_grupo_nome: 'TI FAFIN', fechamento_diario_ativo: true, resumo_reuniao_grupo_ativo: true };

beforeEach(() => {
  vi.clearAllMocks();
  (lerCardsAbertos as ReturnType<typeof vi.fn>).mockResolvedValue([ATRASADA]);
});

describe('fila do grupo', () => {
  it('mensagem do grupo fora do horário fica agendada; teste sai na hora', async () => {
    const { db, gravadas } = criarDb(CONFIG);
    const sabado = new Date('2026-10-17T13:00:00Z');
    const r = await enfileirarNoGrupo(db as never, { grupoId: GRUPO, texto: 'Oi', agora: sabado });
    expect(r).toEqual({ gravada: true, id: 'novo', agendadaPara: '2026-10-19T10:00:00.000Z' });
    expect(gravadas[0].linha).toMatchObject({ membro_id: null, chat_id_destino: GRUPO, tipo: 'grupo', status: 'pendente', proxima_tentativa_em: '2026-10-19T10:00:00.000Z' });
    const t = await enfileirarNoGrupo(db as never, { grupoId: GRUPO, texto: 'Teste', tipo: 'teste', agora: sabado });
    expect(t.agendadaPara).toBeNull();
  });

  it('fechamento: grava uma vez por dia (chave), não grava no fim de semana nem desligado; dryRun monta mesmo assim', async () => {
    const quarta18h = new Date('2026-10-14T21:00:00Z');
    const { db, gravadas } = criarDb(CONFIG);
    const r = await gerarFechamentoDoDia(db as never, { agora: quarta18h, linkInicio: 'l' });
    expect(r).toMatchObject({ hoje: '2026-10-14', pulado: null, gravada: true });
    expect(gravadas[0]).toMatchObject({ op: 'upsert', linha: { chave_dia: 'fechamento:2026-10-14', chat_id_destino: GRUPO }, opcoes: { onConflict: 'chave_dia', ignoreDuplicates: true } });

    const repetida = criarDb(CONFIG, true);
    expect((await gerarFechamentoDoDia(repetida.db as never, { agora: quarta18h, linkInicio: 'l' })).gravada).toBe(false);

    const desligado = criarDb({ ...CONFIG, fechamento_diario_ativo: false });
    expect(await gerarFechamentoDoDia(desligado.db as never, { agora: quarta18h, linkInicio: 'l' })).toMatchObject({ pulado: 'O fechamento do dia está desligado.', texto: null });
    expect(desligado.gravadas).toEqual([]);
    const previa = await gerarFechamentoDoDia(desligado.db as never, { agora: quarta18h, linkInicio: 'l', dryRun: true });
    expect(previa.texto).toContain('Fechamento do dia (14/10)');
    expect(desligado.gravadas).toEqual([]);

    const sabado = criarDb(CONFIG);
    expect((await gerarFechamentoDoDia(sabado.db as never, { agora: new Date('2026-10-17T21:00:00Z'), linkInicio: 'l' })).pulado).toContain('Fim de semana');
  });

  it('resumo de reunião: uma vez por reunião, só ligado, e não para reunião antiga', async () => {
    const agora = new Date('2026-10-14T15:00:00Z');
    const reuniao = { id: 'r1', titulo: 'Weekly', realizadaEm: '2026-10-13T13:00:00Z', observacoes: null, sugestoes: 2 };
    const { db, gravadas } = criarDb(CONFIG);
    expect(await enviarResumoDaReuniao(db as never, reuniao, 'l', agora)).toMatchObject({ gravada: true });
    expect(gravadas[0].linha).toMatchObject({ chave_dia: 'reuniao:r1', tipo: 'grupo' });

    const antiga = criarDb(CONFIG);
    expect(await enviarResumoDaReuniao(antiga.db as never, { ...reuniao, realizadaEm: '2026-09-21T13:00:00Z' }, 'l', agora)).toBeNull();
    const desligado = criarDb({ ...CONFIG, resumo_reuniao_grupo_ativo: false });
    expect(await enviarResumoDaReuniao(desligado.db as never, reuniao, 'l', agora)).toBeNull();
    expect([...antiga.gravadas, ...desligado.gravadas]).toEqual([]);
  });
});
