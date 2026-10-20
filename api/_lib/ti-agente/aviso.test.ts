import { describe, expect, it } from 'vitest';
import { checarAvisoPessoal, enviarAvisoPessoal } from './aviso.js';
import type { Usuario } from './autorizacao.js';

const GESTOR: Usuario = { userId: 'u-ana', permissoes: ['canManageIT', 'canManageAgenteTI'] };
const SO_APROVA: Usuario = { userId: 'u-ana', permissoes: ['canApproveAgenteTI'] };
const GRUPO = '120363000000000001@g.us';

type Membro = { id: string; user_id: string; whatsapp: string | null; ativo: boolean; perfil: { name: string; deleted_at: string | null; disabled_at: string | null } | null };
const BRUNO: Membro = { id: 'm-bruno', user_id: 'u-bruno', whatsapp: '5561999924986', ativo: true, perfil: { name: 'Bruno Mendes', deleted_at: null, disabled_at: null } };
const SEM_ZAP: Membro = { ...BRUNO, whatsapp: null };

/** Banco falso: config, um membro (ou nenhum), a equipe (para citar no grupo) e os inserts na fila. */
function criarDb(e: { whatsappAtivo?: boolean; grupo?: string | null; membro?: Membro | null; equipe?: string[] } = {}) {
  const inserts: Record<string, unknown>[] = [];
  const from = (tabela: string) => {
    const q: Record<string, unknown> = {};
    for (const m of ['select', 'eq']) q[m] = () => q;
    q.maybeSingle = async () => ({
      data: tabela === 'ti_agente_config'
        ? { whatsapp_ativo: e.whatsappAtivo ?? true, cobranca_ativa: true, dias_parado: 5, whatsapp_grupo_id: e.grupo ?? null, whatsapp_grupo_nome: e.grupo ? 'TI FAFIN' : null }
        : (e.membro === undefined ? BRUNO : e.membro),
      error: null,
    });
    // lerMembrosCobranca: a equipe inteira, para ver se o primeiro nome se repete.
    q.then = (ok: (v: unknown) => unknown) => Promise.resolve({
      data: (e.equipe ?? ['Bruno Mendes', 'Ana Souza']).map((name, i) => ({ id: `m${i}`, user_id: `u${i}`, whatsapp: null, recebe_cobranca: false, ativo: true, perfil: { name, deleted_at: null } })),
      error: null,
    }).then(ok);
    q.insert = (linha: Record<string, unknown>) => { inserts.push(linha); return q; };
    q.single = async () => ({ data: { id: 'msg-1' }, error: null });
    return q;
  };
  return { db: { from }, inserts };
}

const QUARTA_11H = new Date('2026-10-14T14:00:00Z');
const PEDIDO = { de: 'Ana Souza', aviso: 'Reunião às 10h.' };

describe('aviso de gestor para uma pessoa (D32)', () => {
  it('só gestor; WhatsApp ligado; a pessoa ativa na aba Membros', async () => {
    expect(await checarAvisoPessoal(criarDb().db as never, SO_APROVA, 'u-bruno')).toMatchObject({ ok: false, status: 403 });
    expect(await checarAvisoPessoal(criarDb({ whatsappAtivo: false }).db as never, GESTOR, 'u-bruno')).toMatchObject({ ok: false, erro: expect.stringContaining('desligado') });
    expect(await checarAvisoPessoal(criarDb({ membro: null }).db as never, GESTOR, 'u-bruno')).toMatchObject({ ok: false, erro: 'Essa pessoa não está na aba Membros da EVA.' });
    expect(await checarAvisoPessoal(criarDb({ membro: { ...BRUNO, ativo: false } }).db as never, GESTOR, 'u-bruno')).toMatchObject({ ok: false, erro: 'Bruno está inativo na aba Membros.' });
    // Inativo não vai para o grupo: a citação é para quem está na equipe.
    expect(await checarAvisoPessoal(criarDb({ membro: { ...SEM_ZAP, ativo: false }, grupo: GRUPO }).db as never, GESTOR, 'u-bruno')).toMatchObject({ ok: false, erro: 'Bruno está inativo na aba Membros.' });
    // A adesão "Recebe cobrança" não conta para aviso (escolha do usuário).
    expect(await checarAvisoPessoal(criarDb().db as never, GESTOR, 'u-bruno')).toEqual({ ok: true, membroId: 'm-bruno', userId: 'u-bruno', nome: 'Bruno Mendes', grupo: null });
  });

  it('sem WhatsApp (D35): vai para o grupo da equipe, citando a pessoa; sem grupo escolhido, recusa', async () => {
    expect(await checarAvisoPessoal(criarDb({ membro: SEM_ZAP }).db as never, GESTOR, 'u-bruno')).toMatchObject({
      ok: false, erro: 'Bruno não tem WhatsApp cadastrado na aba Membros, e não há grupo da equipe escolhido para o aviso ir por lá (EVA → Configurações).',
    });
    expect(await checarAvisoPessoal(criarDb({ membro: SEM_ZAP, grupo: GRUPO }).db as never, GESTOR, 'u-bruno')).toMatchObject({
      ok: true, grupo: { id: GRUPO, nome: 'TI FAFIN', citado: 'Bruno' },
    });
    // Dois Brunos na equipe: o nome inteiro.
    const xaras = criarDb({ membro: SEM_ZAP, grupo: GRUPO, equipe: ['Bruno Mendes', 'Bruno Lima'] });
    expect(await checarAvisoPessoal(xaras.db as never, GESTOR, 'u-bruno')).toMatchObject({ grupo: { citado: 'Bruno Mendes' } });
  });

  it('grava o aviso na fila do membro, com quem pediu; fora do horário, agendado', async () => {
    const { db, inserts } = criarDb();
    expect(await enviarAvisoPessoal(db as never, GESTOR, 'u-bruno', PEDIDO, QUARTA_11H))
      .toEqual({ ok: true, id: 'msg-1', para: 'Bruno Mendes', noGrupo: false, grupoNome: null, agendadaPara: null });
    expect(inserts[0]).toMatchObject({ membro_id: 'm-bruno', direcao: 'saida', tipo: 'aviso', status: 'pendente', texto: '📢 Aviso de Ana:\nReunião às 10h.', enviada_por: 'u-ana', proxima_tentativa_em: null });

    const sabado = await enviarAvisoPessoal(criarDb().db as never, GESTOR, 'u-bruno', { de: 'Ana', aviso: 'x' }, new Date('2026-10-17T13:00:00Z'));
    expect(sabado).toMatchObject({ ok: true, agendadaPara: '2026-10-19T10:00:00.000Z' });
    expect(await enviarAvisoPessoal(criarDb().db as never, GESTOR, 'u-bruno', { de: 'Ana', aviso: '   ' }, QUARTA_11H)).toMatchObject({ ok: false, erro: 'Escreva o aviso.' });
  });

  it('no grupo: sem membro, com o destino do grupo e "para <pessoa>" no texto', async () => {
    const { db, inserts } = criarDb({ membro: SEM_ZAP, grupo: GRUPO });
    expect(await enviarAvisoPessoal(db as never, GESTOR, 'u-bruno', PEDIDO, QUARTA_11H))
      .toEqual({ ok: true, id: 'msg-1', para: 'Bruno Mendes', noGrupo: true, grupoNome: 'TI FAFIN', agendadaPara: null });
    expect(inserts[0]).toMatchObject({ membro_id: null, chat_id_destino: GRUPO, tipo: 'aviso', texto: '📢 Aviso de Ana para Bruno:\nReunião às 10h.', enviada_por: 'u-ana' });
  });
});
