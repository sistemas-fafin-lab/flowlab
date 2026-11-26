import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./cobranca.js', async (original) => ({
  ...(await original<typeof import('./cobranca.js')>()),
  lerMembrosCobranca: vi.fn(),
  lerCardsAbertos: vi.fn(),
}));
vi.mock('./gestao.js', () => ({ lerDestinatariosDeGestao: vi.fn() }));
vi.mock('./respostas.js', async (original) => ({
  ...(await original<typeof import('./respostas.js')>()),
  registrarAtualizacoes: vi.fn(async () => ({ sugestoes: [], confirmacao: '', cardIds: [] })),
}));
vi.mock('./ia/gerarEstruturado.js', () => ({ gerarEstruturado: vi.fn() }));

import { lerCardsAbertos, lerMembrosCobranca } from './cobranca.js';
import { lerDestinatariosDeGestao } from './gestao.js';
import { gerarEstruturado } from './ia/gerarEstruturado.js';
import { registrarAtualizacoes } from './respostas.js';
import { checkinEmAberto, responderCheckin, rodarCheckin } from './checkin.js';
import { card } from '../../../src/modules/eva/domain/testes/fabricas.js';

// Dados fictícios. Quinta, 26/11, em Brasília.
const AS_9H05 = new Date('2026-11-26T09:05:00-03:00');
const AS_10H05 = new Date('2026-11-26T10:05:00-03:00');
const LINK = 'https://app/it/inicio';
const membro = (id: string, nome: string, e: Record<string, unknown> = {}) => ({
  id: `m-${id}`, user_id: `u-${id}`, nome, ativo: true, recebe_cobranca: false, whatsapp: '5561999990000', ausente_de: null, ausente_ate: null, ausencia_motivo: null, ...e,
});
const ATRASADO = card({ id: 'c45', codigo: 'IT-045', assigned_to: ['u-ana'], due_date: '2026-11-20T00:00:00.000Z' });
const OUTRO = card({ id: 'c60', codigo: 'IT-060', title: 'Link da filial', assigned_to: ['u-ana'], due_date: null });

type Linha = Record<string, unknown>;

/** Banco falso: upsert com ignoreDuplicates pela chave, select com filtros simples, update. */
function criarDb(e: { cfg: Linha | null; checkins?: Linha[]; mensagens?: Linha[] }) {
  const tabelas: Record<string, Linha[]> = { ti_agente_checkins: e.checkins ?? [], ti_agente_mensagens: e.mensagens ?? [] };
  const chave = (t: string, l: Linha) => (t === 'ti_agente_checkins' ? `${l.membro_id}|${l.dia}` : String(l.chave_dia));
  const from = (tabela: string) => {
    const filtros: ((l: Linha) => boolean)[] = [];
    let op: 'select' | 'upsert' | 'update' = 'select';
    let valores: Linha = {};
    let head = false;
    const q: Record<string, unknown> = {};
    q.select = (_c?: string, o?: { head?: boolean }) => { if (o?.head) head = true; return q; };
    q.eq = (k: string, v: unknown) => { filtros.push((l) => l[k] === v); return q; };
    q.like = (k: string, p: string) => { const re = new RegExp(`^${p.replace(/%/g, '.*')}$`); filtros.push((l) => re.test(String(l[k]))); return q; };
    q.upsert = (v: Linha) => { op = 'upsert'; valores = v; return q; };
    q.update = (v: Linha) => { op = 'update'; valores = v; return q; };
    const rodar = () => {
      const ls = tabelas[tabela] ?? [];
      if (op === 'upsert') {
        if (ls.some((l) => chave(tabela, l) === chave(tabela, valores))) return { data: [], error: null };
        const nova = { id: `${tabela}-${ls.length + 1}`, ...valores };
        ls.push(nova);
        return { data: [{ id: nova.id }], error: null };
      }
      const achadas = ls.filter((l) => filtros.every((f) => f(l)));
      if (op === 'update') { achadas.forEach((l) => Object.assign(l, valores)); return { data: null, error: null }; }
      return head ? { count: achadas.length, error: null } : { data: achadas, error: null };
    };
    q.maybeSingle = async () => (tabela === 'ti_agente_config' ? { data: e.cfg, error: null } : { data: rodar().data?.[0] ?? null, error: null });
    q.then = (ok: (v: unknown) => unknown) => Promise.resolve(rodar()).then(ok);
    return q;
  };
  return { db: { from } as never, tabelas };
}

const LIGADO = { whatsapp_ativo: true, checkin_ativo: true };

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(lerMembrosCobranca).mockResolvedValue([
    membro('ana', 'Ana Souza'),
    membro('bruno', 'Bruno Mendes'),
    membro('davi', 'Davi Lima', { ausente_de: '2026-11-25', ausente_ate: '2026-12-05', ausencia_motivo: 'férias' }),
    membro('caio', 'Caio Lima', { whatsapp: null }),
  ] as never);
  vi.mocked(lerCardsAbertos).mockResolvedValue([ATRASADO, OUTRO]);
  vi.mocked(lerDestinatariosDeGestao).mockResolvedValue([{ membroId: 'm-gestor', userId: 'u-gestor', nome: 'Gil' }]);
});

describe('rodarCheckin: a pergunta das 9h (D46)', () => {
  it('pergunta a quem tem WhatsApp e está presente, uma vez por dia, com o radar dos cards', async () => {
    const { db, tabelas } = criarDb({ cfg: LIGADO });
    expect(await rodarCheckin(db, { agora: AS_9H05, linkInicio: LINK })).toEqual({ pulado: null, perguntados: 2, resumos: 0 });
    expect(tabelas.ti_agente_checkins.map((c) => c.membro_id)).toEqual(['m-ana', 'm-bruno']);
    const [ana, bruno] = tabelas.ti_agente_mensagens;
    expect(ana).toMatchObject({ membro_id: 'm-ana', tipo: 'checkin', status: 'pendente', chave_dia: 'checkin:m-ana:2026-11-26' });
    expect(ana.texto).toContain('No radar: IT-045');
    expect(bruno.texto).not.toContain('No radar');

    // O relógio roda de novo às 9h15: ninguém é perguntado duas vezes.
    expect(await rodarCheckin(db, { agora: AS_9H05, linkInicio: LINK })).toMatchObject({ perguntados: 0 });
    expect(tabelas.ti_agente_mensagens).toHaveLength(2);
  });

  it('desligado, ou com o WhatsApp desligado, não faz nada', async () => {
    expect(await rodarCheckin(criarDb({ cfg: { ...LIGADO, checkin_ativo: false } }).db, { agora: AS_9H05, linkInicio: LINK })).toMatchObject({ pulado: 'Check-in desligado em Configurações.' });
    expect(await rodarCheckin(criarDb({ cfg: { ...LIGADO, whatsapp_ativo: false } }).db, { agora: AS_9H05, linkInicio: LINK })).toMatchObject({ pulado: 'O WhatsApp da EVA está desligado.' });
    expect(lerMembrosCobranca).not.toHaveBeenCalled();
  });
});

describe('rodarCheckin: o resumo das 10h (D46)', () => {
  it('vai para os gestores do relatório, com quem respondeu, quem não respondeu e quem está fora; uma vez', async () => {
    const { db, tabelas } = criarDb({
      cfg: LIGADO,
      checkins: [
        { membro_id: 'm-ana', dia: '2026-11-26', status: 'respondido', planejados: ['IT-045'], bloqueios: [{ codigo: 'IT-060', motivo: 'esperando a operadora' }], resumo: null },
        { membro_id: 'm-bruno', dia: '2026-11-26', status: 'perguntado', planejados: [], bloqueios: [], resumo: null },
      ],
    });
    const r = await rodarCheckin(db, { agora: AS_10H05, linkInicio: LINK });
    expect(r.resumos).toBe(1);
    const resumo = tabelas.ti_agente_mensagens.find((m) => m.tipo === 'checkin_resumo')!;
    expect(resumo).toMatchObject({ membro_id: 'm-gestor', chave_dia: 'checkin_resumo:m-gestor:2026-11-26' });
    expect(resumo.texto).toContain('• Ana: IT-045\n  ⛔ IT-060: esperando a operadora');
    expect(resumo.texto).toContain('• Bruno: sem resposta');
    expect(resumo.texto).toContain('• Davi: de férias');
    expect(resumo.texto).not.toContain('Caio');

    expect((await rodarCheckin(db, { agora: AS_10H05, linkInicio: LINK })).resumos).toBe(0);
  });
});

describe('responderCheckin (D46)', () => {
  const ANA = { id: 'm-ana', user_id: 'u-ana', nome: 'Ana Souza' };
  const ia = (dados: Record<string, unknown> | null) => vi.mocked(gerarEstruturado).mockResolvedValueOnce(
    dados ? { ok: true, provedor: 'gemini', motivoReserva: null, tentativas: [], dados } as never : { ok: false, erros: ['x'], tentativas: [] },
  );

  it('grava o plano e os bloqueios (só códigos de cards abertos), anota o bloqueio no card e confirma', async () => {
    const { db, tabelas } = criarDb({ cfg: LIGADO, checkins: [{ id: 'ck1', membro_id: 'm-ana', dia: '2026-11-26', status: 'perguntado' }] });
    expect(await checkinEmAberto(db, 'm-ana', '2026-11-26')).toEqual({ id: 'ck1' });
    ia({ e_checkin: true, planejados: ['it-045', 'IT-999'], bloqueios: [{ card_codigo: 'IT-060', motivo: 'esperando a operadora' }], resumo: 'IT-045 e o link da filial' });
    const r = await responderCheckin(db, {} as never, { checkinId: 'ck1', mensagemId: 'msg1', membro: ANA, texto: 'hoje o 45; o 60 está travado esperando a operadora', cards: [ATRASADO, OUTRO] });
    expect(r).toEqual({
      resposta: 'Anotado, Ana! ☀️ Hoje: IT-045. Avisei os gestores do bloqueio no IT-060 e anotei no card.',
      planejados: ['IT-045'], bloqueios: [{ codigo: 'IT-060', motivo: 'esperando a operadora' }],
    });
    expect(tabelas.ti_agente_checkins[0]).toMatchObject({ status: 'respondido', planejados: ['IT-045'], resumo: 'IT-045 e o link da filial' });
    expect(registrarAtualizacoes).toHaveBeenCalledWith(db, expect.objectContaining({ itens: [expect.objectContaining({ intencao: 'bloquear', card: OUTRO })] }));
    expect(await checkinEmAberto(db, 'm-ana', '2026-11-26')).toBeNull();
  });

  it('outro assunto, ou a IA sem responder: null, e a mensagem segue o fluxo normal', async () => {
    const { db, tabelas } = criarDb({ cfg: LIGADO, checkins: [{ id: 'ck1', membro_id: 'm-ana', dia: '2026-11-26', status: 'perguntado' }] });
    ia({ e_checkin: false, planejados: [], bloqueios: [], resumo: '' });
    expect(await responderCheckin(db, {} as never, { checkinId: 'ck1', mensagemId: 'm', membro: ANA, texto: 'tem reunião hoje?', cards: [] })).toBeNull();
    ia(null);
    expect(await responderCheckin(db, {} as never, { checkinId: 'ck1', mensagemId: 'm', membro: ANA, texto: 'hoje o 45', cards: [] })).toBeNull();
    expect(tabelas.ti_agente_checkins[0].status).toBe('perguntado');
  });
});
