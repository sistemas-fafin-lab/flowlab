import { describe, expect, it } from 'vitest';
import { checarAvisoPessoal, enviarAvisoPessoal } from './aviso.js';
import type { Usuario } from './autorizacao.js';

const GESTOR: Usuario = { userId: 'u-ana', permissoes: ['canManageIT', 'canManageAgenteTI'] };
const SO_APROVA: Usuario = { userId: 'u-ana', permissoes: ['canApproveAgenteTI'] };

type Membro = { id: string; user_id: string; whatsapp: string | null; ativo: boolean; perfil: { name: string; deleted_at: string | null; disabled_at: string | null } | null };
const BRUNO: Membro = { id: 'm-bruno', user_id: 'u-bruno', whatsapp: '5561999924986', ativo: true, perfil: { name: 'Bruno Mendes', deleted_at: null, disabled_at: null } };

/** Banco falso: config, um membro (ou nenhum) e os inserts na fila. */
function criarDb(e: { whatsappAtivo?: boolean; membro?: Membro | null } = {}) {
  const inserts: Record<string, unknown>[] = [];
  const from = (tabela: string) => {
    const q: Record<string, unknown> = {};
    for (const m of ['select', 'eq']) q[m] = () => q;
    q.maybeSingle = async () => ({
      data: tabela === 'ti_agente_config' ? { whatsapp_ativo: e.whatsappAtivo ?? true, cobranca_ativa: true, dias_parado: 5 } : (e.membro === undefined ? BRUNO : e.membro),
      error: null,
    });
    q.insert = (linha: Record<string, unknown>) => { inserts.push(linha); return q; };
    q.single = async () => ({ data: { id: 'msg-1' }, error: null });
    return q;
  };
  return { db: { from }, inserts };
}

const QUARTA_11H = new Date('2026-10-14T14:00:00Z');

describe('aviso de gestor para uma pessoa (D32)', () => {
  it('só gestor; WhatsApp ligado; a pessoa ativa na aba Membros com WhatsApp', async () => {
    expect(await checarAvisoPessoal(criarDb().db as never, SO_APROVA, 'u-bruno')).toMatchObject({ ok: false, status: 403 });
    expect(await checarAvisoPessoal(criarDb({ whatsappAtivo: false }).db as never, GESTOR, 'u-bruno')).toMatchObject({ ok: false, erro: expect.stringContaining('desligado') });
    expect(await checarAvisoPessoal(criarDb({ membro: null }).db as never, GESTOR, 'u-bruno')).toMatchObject({ ok: false, erro: 'Essa pessoa não está na aba Membros da EVA.' });
    expect(await checarAvisoPessoal(criarDb({ membro: { ...BRUNO, ativo: false } }).db as never, GESTOR, 'u-bruno')).toMatchObject({ ok: false, erro: 'Bruno está inativo na aba Membros.' });
    expect(await checarAvisoPessoal(criarDb({ membro: { ...BRUNO, whatsapp: null } }).db as never, GESTOR, 'u-bruno')).toMatchObject({ ok: false, erro: 'Bruno não tem WhatsApp cadastrado na aba Membros.' });
    // A adesão "Recebe cobrança" não conta para aviso (escolha do usuário).
    expect(await checarAvisoPessoal(criarDb().db as never, GESTOR, 'u-bruno')).toEqual({ ok: true, membroId: 'm-bruno', userId: 'u-bruno', nome: 'Bruno Mendes' });
  });

  it('grava o aviso na fila do membro, com quem pediu; fora do horário, agendado', async () => {
    const { db, inserts } = criarDb();
    expect(await enviarAvisoPessoal(db as never, GESTOR, 'u-bruno', '📢 Aviso de Ana:\nReunião às 10h.', QUARTA_11H))
      .toEqual({ ok: true, id: 'msg-1', para: 'Bruno Mendes', agendadaPara: null });
    expect(inserts[0]).toMatchObject({ membro_id: 'm-bruno', direcao: 'saida', tipo: 'aviso', status: 'pendente', texto: '📢 Aviso de Ana:\nReunião às 10h.', enviada_por: 'u-ana', proxima_tentativa_em: null });

    const sabado = await enviarAvisoPessoal(criarDb().db as never, GESTOR, 'u-bruno', 'x', new Date('2026-10-17T13:00:00Z'));
    expect(sabado).toMatchObject({ ok: true, agendadaPara: '2026-10-19T10:00:00.000Z' });
    expect(await enviarAvisoPessoal(criarDb().db as never, GESTOR, 'u-bruno', '   ', QUARTA_11H)).toMatchObject({ ok: false, erro: 'Escreva o aviso.' });
  });
});
