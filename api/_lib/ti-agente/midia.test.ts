import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./comandos.js', async (original) => ({
  ...(await original<typeof import('./comandos.js')>()),
  // A mensagem escrita (ou transcrita) segue para o roteador de sempre, testado em comandos.test.
  processarRecebida: vi.fn(async () => ({ ok: true, acao: 'conversa', resposta: 'Anotado!', erro: null })),
}));
vi.mock('./autorizacao.js', async (original) => ({
  ...(await original<typeof import('./autorizacao.js')>()),
  // A Ana não é da gestão: anexa só nos próprios cards.
  usuarioPorId: vi.fn(async (_db: unknown, userId: string) => ({ userId, permissoes: [] })),
}));

import {
  AUDIO_NAO_ENTENDI, CARD_NAO_ACHADO, MIDIA_GRANDE, MIDIA_NAO_BAIXOU, PEDIR_CARD_DA_IMAGEM,
} from '../../../src/modules/eva/domain/midia.js';
import { anexarAguardando } from './anexos.js';
import { processarRecebida } from './comandos.js';
import type { Dependencias } from './ia/gerarEstruturado.js';
import type { ClienteIA } from './ia/tipos.js';
import { processarMidia, retomarMidias } from './midia.js';

// Dados fictícios. Terça, 24/11, 15h (UTC).
const AGORA = new Date('2026-11-24T15:00:00Z');
const MEMBRO = { id: 'm1', user_id: 'u-ana', nome: 'Ana Souza' };

type Linha = Record<string, unknown>;

/** Banco falso em memória: filtros, update com retorno, insert; e o storage com os dois buckets. */
function criarDb(tabelas: Record<string, Linha[]>, arquivos: Record<string, Uint8Array> = {}) {
  const storage = new Map(Object.entries(arquivos));
  const removidos: string[] = [];
  const from = (tabela: string) => {
    const filtros: ((l: Linha) => boolean)[] = [];
    let op: 'select' | 'update' | 'insert' = 'select';
    let valores: unknown = null;
    let retornar = false;
    const q: Record<string, unknown> = {};
    q.select = () => { retornar = true; return q; };
    q.update = (v: Linha) => { op = 'update'; valores = v; return q; };
    q.insert = (v: Linha | Linha[]) => { op = 'insert'; valores = v; return q; };
    q.eq = (k: string, v: unknown) => { filtros.push((l) => l[k] === v); return q; };
    q.in = (k: string, vs: unknown[]) => { filtros.push((l) => vs.includes(l[k])); return q; };
    q.lt = (k: string, v: string) => { filtros.push((l) => String(l[k]) < v); return q; };
    q.gte = (k: string, v: string) => { filtros.push((l) => String(l[k]) >= v); return q; };
    q.order = () => q;
    q.limit = () => q;
    const linhas = () => (tabelas[tabela] ??= []).filter((l) => filtros.every((f) => f(l)));
    const executar = () => {
      if (op === 'insert') { (tabelas[tabela] ??= []).push(...[valores as Linha | Linha[]].flat().map((l) => ({ ...l }))); return { data: null, error: null }; }
      if (op === 'update') {
        const ls = linhas();
        ls.forEach((l) => Object.assign(l, valores));
        return { data: retornar ? ls.map((l) => ({ ...l })) : null, error: null };
      }
      return { data: linhas().map((l) => ({ ...l })), error: null };
    };
    q.maybeSingle = async () => ({ data: (executar().data ?? [])[0] ?? null, error: null });
    q.then = (ok: (v: unknown) => unknown, ko?: (v: unknown) => unknown) => Promise.resolve(executar()).then(ok, ko);
    return q;
  };
  const bucket = (b: string) => ({
    download: async (p: string) => (storage.has(`${b}/${p}`) ? { data: new Blob([storage.get(`${b}/${p}`)!]), error: null } : { data: null, error: { message: 'Object not found' } }),
    upload: async (p: string, bytes: Uint8Array) => { storage.set(`${b}/${p}`, bytes); return { data: null, error: null }; },
    getPublicUrl: (p: string) => ({ data: { publicUrl: `https://sb/storage/v1/object/public/${b}/${p}` } }),
    remove: async (ps: string[]) => { ps.forEach((p) => { storage.delete(`${b}/${p}`); removidos.push(`${b}/${p}`); }); return { data: null, error: null }; },
  });
  return { db: { from, storage: { from: bucket } } as never, tabelas, storage, removidos };
}

const ia = (gemini: ClienteIA['chamar']): Dependencias & { claude: { chamar: ReturnType<typeof vi.fn> } } => ({
  claude: { provedor: 'claude', modelo: 'c', chamar: vi.fn() },
  gemini: { provedor: 'gemini', modelo: 'g', chamar: gemini },
  registrar: vi.fn(async () => undefined),
});
const respondeu = (transcricao: string, entendeu = true): ClienteIA['chamar'] =>
  vi.fn(async () => ({ provedor: 'gemini' as const, modelo: 'g', resultado: 'ok' as const, texto: JSON.stringify({ tem_fala: entendeu, transcricao, entendeu }), duracaoMs: 1 }));

const recebida = (id: string, extra: Linha = {}): Linha => ({
  id, membro_id: 'm1', direcao: 'entrada', tipo: 'recebida', status: 'recebida', texto: '(áudio)', created_at: '2026-11-24T14:59:00Z',
  midia_tipo: 'audio', midia_mimetype: 'audio/ogg; codecs=opus', midia_status: 'baixada', midia_path: `m1/${id}.ogg`, erro: null, ...extra,
});

let base: Record<string, Linha[]>;
beforeEach(() => {
  vi.mocked(processarRecebida).mockClear();
  base = {
    ti_agente_membros: [{ id: 'm1', user_id: 'u-ana', perfil: { name: 'Ana Souza' } }],
    it_requests: [
      { id: 'c45', codigo: 'IT-045', assigned_to: ['u-ana'], requested_by: 'u-x' },
      { id: 'c46', codigo: 'IT-046', assigned_to: ['u-bruno'], requested_by: 'u-x' },
    ],
  };
});

const respostas = (tabelas: Record<string, Linha[]>) => (tabelas.ti_agente_mensagens ?? []).filter((m) => m.direcao === 'saida').map((m) => m.texto);

describe('áudio (D43)', () => {
  it('transcreve só com o Gemini, apaga o áudio e segue como mensagem escrita; uma vez só', async () => {
    const { db, tabelas, storage } = criarDb({ ...base, ti_agente_mensagens: [recebida('a1')] }, { 'ti-agente-midias/m1/a1.ogg': new Uint8Array([1, 2, 3]) });
    const deps = ia(respondeu('terminei o IT-045'));
    expect(await processarMidia(db, deps, 'a1', AGORA)).toEqual({ acao: 'transcrita', resposta: 'Anotado!' });

    expect(deps.claude.chamar).not.toHaveBeenCalled();
    // Temperatura 0: no teste real com áudio mudo, o Gemini inventava fala com a temperatura padrão.
    expect(deps.gemini.chamar).toHaveBeenCalledWith(expect.objectContaining({ anexos: [{ mimetype: 'audio/ogg', base64: 'AQID' }], temperatura: 0 }));
    expect(tabelas.ti_agente_mensagens[0]).toMatchObject({ texto: 'terminei o IT-045', midia_status: 'processada', midia_path: null });
    expect(storage.has('ti-agente-midias/m1/a1.ogg')).toBe(false);
    // A resposta começa com o que a EVA ouviu.
    expect(processarRecebida).toHaveBeenCalledWith(db, deps, 'a1', AGORA, { prefixo: '🎤 Entendi: "terminei o IT-045"' });

    // A VPS e o relógio juntos: a segunda chamada não trata de novo.
    expect(await processarMidia(db, deps, 'a1', AGORA)).toEqual({ acao: 'ja_tratada' });
  });

  it('o eco da transcrição é curto', async () => {
    const { ouvi } = await import('./midia.js');
    expect(ouvi('a'.repeat(400))).toBe(`🎤 Entendi: "${'a'.repeat(299)}…"`);
  });

  it('sem fala compreensível: pede para repetir, sem chamar o roteador', async () => {
    const { db, tabelas } = criarDb({ ...base, ti_agente_mensagens: [recebida('a1')] }, { 'ti-agente-midias/m1/a1.ogg': new Uint8Array([1]) });
    expect(await processarMidia(db, ia(respondeu('', false)), 'a1', AGORA)).toMatchObject({ acao: 'nao_entendeu' });
    expect(respostas(tabelas)).toEqual([AUDIO_NAO_ENTENDI]);
    expect(tabelas.ti_agente_mensagens[0]).toMatchObject({ midia_status: 'erro' });
    expect(processarRecebida).not.toHaveBeenCalled();
  });

  it('a VPS não baixou (passou de 10 MB): a EVA explica', async () => {
    const { db, tabelas } = criarDb({ ...base, ti_agente_mensagens: [recebida('a1', { midia_status: 'nao_baixou', midia_path: null, erro: 'Arquivo de 12.0 MB, acima do limite de 10 MB.' })] });
    expect(await processarMidia(db, ia(respondeu('x')), 'a1', AGORA)).toMatchObject({ acao: 'nao_baixou' });
    expect(respostas(tabelas)).toEqual([MIDIA_GRANDE]);
    expect(tabelas.ti_agente_mensagens[0]).toMatchObject({ midia_status: 'erro' });
  });
});

describe('imagem (D43)', () => {
  const imagem = (id: string, texto: string) => recebida(id, { texto, midia_tipo: 'imagem', midia_mimetype: 'image/jpeg', midia_path: `m1/${id}.jpg` });
  const arquivo = (id: string) => ({ [`ti-agente-midias/m1/${id}.jpg`]: new Uint8Array([9, 9]) });

  it('só o código: anexa no card, num comentário de quem mandou, e confirma', async () => {
    const { db, tabelas, storage } = criarDb({ ...base, ti_agente_mensagens: [imagem('i1', 'IT-045')] }, arquivo('i1'));
    expect(await processarMidia(db, ia(respondeu('x')), 'i1', AGORA)).toEqual({ acao: 'anexada', codigos: ['IT-045'], resposta: '📎 Anexei a imagem ao IT-045.' });

    const [comentario] = tabelas.it_task_comments;
    expect(comentario).toMatchObject({ task_id: 'c45', user_id: 'u-ana', content: 'via WhatsApp: IT-045' });
    expect(comentario.attachments).toEqual([expect.objectContaining({ name: 'whatsapp-24-11-2026-1159.jpg', size: 2, type: 'image/jpeg' })]);
    expect(String((comentario.attachments as { url: string }[])[0].url)).toMatch(/\/it-attachments\/u-ana\/c45\/\d+_whatsapp-24-11-2026-1159\.jpg$/);
    expect(tabelas.ti_agente_mensagens[0]).toMatchObject({ midia_status: 'processada', card_ids: ['c45'] });
    expect(storage.has('ti-agente-midias/m1/i1.jpg')).toBe(false);
    expect(respostas(tabelas)).toEqual(['📎 Anexei a imagem ao IT-045.']);
    expect(processarRecebida).not.toHaveBeenCalled();
  });

  it('código e mais texto: anexa e segue como mensagem escrita, sem repetir o comentário', async () => {
    const { db } = criarDb({ ...base, ti_agente_mensagens: [imagem('i1', 'IT-045 deu esse erro de novo')] }, arquivo('i1'));
    const deps = ia(respondeu('x'));
    await processarMidia(db, deps, 'i1', AGORA);
    expect(processarRecebida).toHaveBeenCalledWith(db, deps, 'i1', AGORA, { prefixo: '📎 Anexei a imagem ao IT-045.', semComentarioEm: ['c45'] });
  });

  it('card de outra pessoa (sem ser da gestão): não anexa, e a imagem espera o código certo', async () => {
    const { db, tabelas } = criarDb({ ...base, ti_agente_mensagens: [imagem('i1', 'IT-046')] }, arquivo('i1'));
    expect(await processarMidia(db, ia(respondeu('x')), 'i1', AGORA)).toMatchObject({ acao: 'aguardando_card' });
    expect(tabelas.it_task_comments).toBeUndefined();
    expect(respostas(tabelas)).toEqual([`${CARD_NAO_ACHADO(['IT-046'])} A imagem fica guardada por 2 h.`]);
    expect(tabelas.ti_agente_mensagens[0]).toMatchObject({ midia_status: 'aguardando_card' });
  });

  it('sem legenda: pergunta o card; o código na mensagem seguinte anexa', async () => {
    const { db, tabelas } = criarDb({ ...base, ti_agente_mensagens: [imagem('i1', '(imagem)')] }, arquivo('i1'));
    expect(await processarMidia(db, ia(respondeu('x')), 'i1', AGORA)).toEqual({ acao: 'aguardando_card', resposta: PEDIR_CARD_DA_IMAGEM });
    expect(respostas(tabelas)).toEqual([PEDIR_CARD_DA_IMAGEM]);

    const r = await anexarAguardando(db, { membro: MEMBRO, usuario: { userId: 'u-ana', permissoes: [] }, codigos: ['IT-045'], agora: AGORA });
    expect(r).toEqual({ codigos: ['IT-045'], imagens: 1 });
    expect(tabelas.it_task_comments).toEqual([expect.objectContaining({ task_id: 'c45', content: 'via WhatsApp: 📎 imagem' })]);
    expect(tabelas.ti_agente_mensagens[0]).toMatchObject({ midia_status: 'processada' });
  });

  it('com legenda sem código: a legenda segue como mensagem, e a imagem espera o código', async () => {
    const { db } = criarDb({ ...base, ti_agente_mensagens: [imagem('i1', 'deu esse erro no apLIS')] }, arquivo('i1'));
    const deps = ia(respondeu('x'));
    await processarMidia(db, deps, 'i1', AGORA);
    expect(processarRecebida).toHaveBeenCalledWith(db, deps, 'i1', AGORA, { sufixo: PEDIR_CARD_DA_IMAGEM });
  });
});

describe('retomarMidias: o que o relógio faz (D43, D44)', () => {
  it('desiste da pendente velha, trata a baixada esquecida, solta a travada e expira a imagem sem card', async () => {
    const { db, tabelas, removidos } = criarDb({
      ...base,
      ti_agente_mensagens: [
        // Pendente há 20 min: a VPS não vai baixar. Vira "não baixou" e a EVA pede de novo.
        recebida('p1', { midia_status: 'pendente', midia_path: null, created_at: '2026-11-24T14:40:00Z' }),
        // Baixada há 5 min, e a chamada da VPS não chegou: o relógio trata.
        recebida('b1', { created_at: '2026-11-24T14:55:00Z' }),
        // Processando há 30 min: a função caiu no meio.
        recebida('t1', { midia_status: 'processando', created_at: '2026-11-24T14:30:00Z' }),
        // Imagem esperando o código há 3 h.
        recebida('e1', { midia_tipo: 'imagem', midia_status: 'aguardando_card', midia_path: 'm1/e1.jpg', created_at: '2026-11-24T12:00:00Z' }),
        // Pendente há 30 s: ainda é da VPS.
        recebida('p2', { midia_status: 'pendente', midia_path: null, created_at: '2026-11-24T14:59:30Z' }),
      ],
    }, { 'ti-agente-midias/m1/b1.ogg': new Uint8Array([1]), 'ti-agente-midias/m1/e1.jpg': new Uint8Array([2]) });

    const r = await retomarMidias(db, ia(respondeu('pode fechar o IT-045')), AGORA);
    expect(r).toEqual({ retomadas: 2, desistidas: 1, travadas: 1, expiradas: 1 });
    const porId = Object.fromEntries(tabelas.ti_agente_mensagens.filter((m) => m.direcao === 'entrada').map((m) => [m.id, m.midia_status]));
    expect(porId).toEqual({ p1: 'erro', b1: 'processada', t1: 'erro', e1: 'expirada', p2: 'pendente' });
    expect(respostas(tabelas)).toEqual([MIDIA_NAO_BAIXOU]);
    expect(removidos).toEqual(expect.arrayContaining(['ti-agente-midias/m1/b1.ogg', 'ti-agente-midias/m1/t1.ogg', 'ti-agente-midias/m1/e1.jpg']));
  });
});
