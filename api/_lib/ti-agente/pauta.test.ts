import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./gestao.js', () => ({ lerDestinatariosDeGestao: vi.fn(), lerEntradaGestao: vi.fn() }));
vi.mock('./dados.js', async (original) => ({ ...(await original<typeof import('./dados.js')>()), lerUltimaReuniao: vi.fn(async () => null) }));

import { lerDestinatariosDeGestao, lerEntradaGestao } from './gestao.js';
import { lerItensDaReuniao, rodarPauta } from './pauta.js';
import { card } from '../../../src/modules/eva/domain/testes/fabricas.js';
import type { EntradaGestao } from '../../../src/modules/eva/domain/gestao.js';

// Dados fictícios. Segunda, 30/11/2026; a reunião da equipe é às 10h.
const AS_9H05 = new Date('2026-11-30T09:05:00-03:00');
const LINK = 'https://app/it/inicio';
type Linha = Record<string, unknown>;

/** Banco falso: config, fila (upsert com ignoreDuplicates pela chave), sugestões e cards. */
function criarDb(e: { cfg: Linha | null; cfgErro?: boolean; mensagens?: Linha[]; sugestoes?: Linha[]; cards?: Linha[] }) {
  const tabelas: Record<string, Linha[]> = {
    ti_agente_mensagens: e.mensagens ?? [], ti_agente_sugestoes: e.sugestoes ?? [], it_requests: e.cards ?? [], ti_agente_checkins: [],
  };
  const from = (tabela: string) => {
    const filtros: ((l: Linha) => boolean)[] = [];
    let upsert: Linha | null = null;
    let head = false;
    const q: Record<string, unknown> = {};
    q.select = (_c?: string, o?: { head?: boolean }) => { if (o?.head) head = true; return q; };
    q.eq = (k: string, v: unknown) => { filtros.push((l) => l[k] === v); return q; };
    q.neq = (k: string, v: unknown) => { filtros.push((l) => l[k] !== v); return q; };
    q.in = (k: string, v: unknown[]) => { filtros.push((l) => v.includes(l[k])); return q; };
    q.gte = () => q;
    q.order = () => q;
    q.limit = () => q;
    q.like = (k: string, p: string) => { const re = new RegExp(`^${p.replace(/%/g, '.*')}$`); filtros.push((l) => re.test(String(l[k]))); return q; };
    q.upsert = (v: Linha) => { upsert = v; return q; };
    const rodar = () => {
      const ls = tabelas[tabela] ?? [];
      if (upsert) {
        if (ls.some((l) => l.chave_dia === upsert!.chave_dia)) return { data: [], error: null };
        ls.push({ id: `m${ls.length + 1}`, ...upsert });
        return { data: [{ id: `m${ls.length}` }], error: null };
      }
      const achadas = ls.filter((l) => filtros.every((f) => f(l)));
      return head ? { count: achadas.length, error: null } : { data: achadas, error: null };
    };
    q.maybeSingle = async () => (e.cfgErro ? { data: null, error: { message: 'column "pauta_ativa" does not exist' } } : { data: e.cfg, error: null });
    q.then = (ok: (v: unknown) => unknown) => Promise.resolve(rodar()).then(ok);
    return q;
  };
  return { db: { from } as never, tabelas };
}

const LIGADA = { whatsapp_ativo: true, pauta_ativa: true, reuniao_dia: 1, reuniao_hora: '10:00' };
const ENTRADA: EntradaGestao = {
  hoje: '2026-11-30', agora: AS_9H05.getTime(), periodo: { de: '2026-11-03', ate: '2026-11-30' }, cards: [], projetos: [], sprints: [], chamados: [],
  pessoas: { 'u-gil': 'Gil Prado' }, equipe: ['u-gil'], diasParado: 5, sugestoesPendentes: 0, sugestaoMaisAntiga: null, cardsSemResposta: [], ausencias: {},
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(lerDestinatariosDeGestao).mockResolvedValue([
    { membroId: 'm-gil', userId: 'u-gil', nome: 'Gil Prado' },
    { membroId: 'm-ana', userId: 'u-ana', nome: 'Ana Souza' },
  ]);
  vi.mocked(lerEntradaGestao).mockResolvedValue(ENTRADA);
});

describe('rodarPauta', () => {
  it('1 h antes da reunião, a pauta vai uma vez para cada gestor', async () => {
    const { db, tabelas } = criarDb({ cfg: LIGADA });
    expect(await rodarPauta(db, { agora: AS_9H05, linkInicio: LINK })).toEqual({ pulado: null, enviadas: 2 });
    expect(tabelas.ti_agente_mensagens).toHaveLength(2);
    expect(tabelas.ti_agente_mensagens[0]).toMatchObject({ membro_id: 'm-gil', tipo: 'pauta', status: 'pendente', chave_dia: 'pauta:m-gil:2026-11-30' });
    expect(String(tabelas.ti_agente_mensagens[0].texto)).toContain('🗓️ Pauta da reunião · segunda, 30/11 às 10:00');
    // O relógio roda de novo 10 min depois: nada sai duas vezes, e a pauta nem é montada de novo.
    expect(await rodarPauta(db, { agora: new Date('2026-11-30T09:15:00-03:00'), linkInicio: LINK })).toEqual({ pulado: null, enviadas: 0 });
    expect(lerEntradaGestao).toHaveBeenCalledTimes(1);
  });

  it('desligada, sem as colunas, com o WhatsApp desligado ou fora da hora, não manda', async () => {
    expect((await rodarPauta(criarDb({ cfg: { ...LIGADA, pauta_ativa: false } }).db, { agora: AS_9H05, linkInicio: LINK })).pulado).toMatch(/desligada/);
    expect((await rodarPauta(criarDb({ cfg: null, cfgErro: true }).db, { agora: AS_9H05, linkInicio: LINK })).pulado).toMatch(/desligada/);
    expect((await rodarPauta(criarDb({ cfg: { ...LIGADA, whatsapp_ativo: false } }).db, { agora: AS_9H05, linkInicio: LINK })).pulado).toMatch(/WhatsApp/);
    expect((await rodarPauta(criarDb({ cfg: LIGADA }).db, { agora: new Date('2026-11-30T10:05:00-03:00'), linkInicio: LINK })).pulado).toBe('Fora da hora da pauta.');
    expect((await rodarPauta(criarDb({ cfg: LIGADA }).db, { agora: new Date('2026-12-01T09:05:00-03:00'), linkInicio: LINK })).pulado).toBe('Fora da hora da pauta.');
    expect(lerEntradaGestao).not.toHaveBeenCalled();
  });

  it('sem gestor com o relatório marcado, não manda', async () => {
    vi.mocked(lerDestinatariosDeGestao).mockResolvedValue([]);
    expect((await rodarPauta(criarDb({ cfg: LIGADA }).db, { agora: AS_9H05, linkInicio: LINK })).pulado).toMatch(/Nenhum gestor/);
  });
});

describe('lerItensDaReuniao', () => {
  it('o card novo aprovado vem pelo card criado; o pendente, pelo título; a mudança, pelo card', async () => {
    const criado = card({ id: 'c-novo', codigo: 'IT-401', title: 'Abrir chamado no fornecedor', assigned_to: ['u-ana'] });
    const mudado = card({ id: 'c-velho', codigo: 'IT-402', title: 'Backup do servidor', assigned_to: ['u-bruno'] });
    const { db } = criarDb({
      cfg: LIGADA,
      cards: [criado, mudado] as unknown as Linha[],
      sugestoes: [
        { reuniao_id: 'r1', tipo: 'criar_card', status: 'aprovada', card_id: null, card_resultante_id: 'c-novo', proposta: { titulo: 'Abrir chamado no fornecedor', responsaveis: ['u-ana'], prazo: '2026-12-04' } },
        { reuniao_id: 'r1', tipo: 'criar_card', status: 'pendente', card_id: null, card_resultante_id: null, proposta: { titulo: 'Trocar o nobreak', responsaveis: ['u-bruno'], prazo: null } },
        { reuniao_id: 'r1', tipo: 'atualizar_card', status: 'aprovada', card_id: 'c-velho', card_resultante_id: null, proposta: { prazo: '2026-12-01' } },
        { reuniao_id: 'r1', tipo: 'comentar_card', status: 'aprovada', card_id: 'c-velho', card_resultante_id: null, proposta: { comentario: 'x' } },
        { reuniao_id: 'r2', tipo: 'criar_card', status: 'pendente', card_id: null, card_resultante_id: null, proposta: { titulo: 'De outra reunião' } },
      ],
    });
    const itens = await lerItensDaReuniao(db, 'r1');
    expect(itens.map((i) => [i.descricao, i.sugestao, i.prazo, i.card?.codigo ?? null])).toEqual([
      ['IT-401 Abrir chamado no fornecedor', 'aprovada', '2026-12-04', 'IT-401'],
      ['Card novo "Trocar o nobreak"', 'pendente', null, null],
      ['IT-402 Backup do servidor', 'aprovada', '2026-12-01', 'IT-402'],
    ]);
  });
});
