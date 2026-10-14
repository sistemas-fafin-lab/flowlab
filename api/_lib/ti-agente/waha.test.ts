import { describe, expect, it, vi } from 'vitest';
import { criarClienteWaha, idDaMensagem, lerGrupos } from './waha.js';

const resposta = (status: number, corpo: unknown) =>
  new Response(typeof corpo === 'string' ? corpo : JSON.stringify(corpo), { status });

const cfg = { url: 'http://127.0.0.1:3000/', apiKey: 'chave-secreta', sessao: 'ti_agente' };

describe('cliente WAHA', () => {
  it('envia com X-Api-Key e devolve o id serializado', async () => {
    const fetch = vi.fn(async () => resposta(201, { id: { _serialized: 'true_556199924986@c.us_ABC' } }));
    const r = await criarClienteWaha(cfg, fetch).enviarTexto('556199924986@c.us', 'Oi');
    expect(r).toEqual({ ok: true, id: 'true_556199924986@c.us_ABC' });
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('http://127.0.0.1:3000/api/sendText');
    expect((init.headers as Record<string, string>)['X-Api-Key']).toBe('chave-secreta');
    expect(JSON.parse(init.body as string)).toEqual({ session: 'ti_agente', chatId: '556199924986@c.us', text: 'Oi' });
  });

  it('check-exists resolve o chatId sem o 9º dígito', async () => {
    const fetch = vi.fn(async () => resposta(200, { numberExists: true, chatId: '556199924986@c.us' }));
    expect(await criarClienteWaha(cfg, fetch).verificarNumero('+55 61 99992-4986')).toEqual({ ok: true, existe: true, chatId: '556199924986@c.us' });
    expect((fetch.mock.calls[0] as unknown as [string])[0]).toContain('phone=5561999924986&session=ti_agente');
  });

  it('nunca lança: erro HTTP e rede viram { ok: false } sem a chave', async () => {
    const http = criarClienteWaha(cfg, async () => resposta(401, { message: 'Unauthorized' }));
    const r1 = await http.sessao();
    expect(r1).toMatchObject({ ok: false });
    expect(JSON.stringify(r1)).not.toContain('chave-secreta');
    const rede = criarClienteWaha(cfg, async () => { throw new Error('connect ECONNREFUSED 127.0.0.1:3000'); });
    expect(await rede.enviarTexto('x@c.us', 'Oi')).toEqual({ ok: false, erro: 'Sem conexão com o WAHA em http://127.0.0.1:3000 (connect ECONNREFUSED 127.0.0.1:3000).' });
    // O fetch do Node: "fetch failed", com o motivo em `cause`.
    const node = criarClienteWaha(cfg, async () => { throw Object.assign(new TypeError('fetch failed'), { cause: { code: 'ECONNREFUSED' } }); });
    expect(await node.sessao()).toEqual({ ok: false, erro: 'Sem conexão com o WAHA em http://127.0.0.1:3000 (conexão recusada: nada escutando nessa porta).' });
  });

  it('situação da sessão', async () => {
    expect(await criarClienteWaha(cfg, async () => resposta(200, { name: 'ti_agente', status: 'WORKING' })).sessao()).toEqual({ ok: true, status: 'WORKING' });
  });

  it('grupos nos formatos dos engines (WEBJS, NOWEB, GOWS), só @g.us, sem repetir, por nome', async () => {
    expect(lerGrupos([
      { id: { _serialized: '1203630002@g.us' }, name: 'Zeta' },
      { JID: '1203630001@g.us', Name: 'Alfa' },
      { id: '5561999924986@c.us', name: 'contato' },
      { JID: '1203630001@g.us', Name: 'Alfa de novo' },
    ])).toEqual([{ id: '1203630001@g.us', nome: 'Alfa' }, { id: '1203630002@g.us', nome: 'Zeta' }]);
    expect(lerGrupos({ '1203630003@g.us': { id: '1203630003@g.us', subject: 'TI' } })).toEqual([{ id: '1203630003@g.us', nome: 'TI' }]);
    expect(lerGrupos(null)).toEqual([]);
    const fetch = vi.fn(async () => resposta(200, [{ JID: '1203630001@g.us', GroupName: { Name: 'TI FAFIN' } }]));
    expect(await criarClienteWaha(cfg, fetch).listarGrupos()).toEqual({ ok: true, grupos: [{ id: '1203630001@g.us', nome: 'TI FAFIN' }] });
    expect((fetch.mock.calls[0] as unknown as [string])[0]).toBe('http://127.0.0.1:3000/api/ti_agente/groups');
  });

  it('id da mensagem nos formatos dos engines', () => {
    expect(idDaMensagem({ id: 'true_x@c.us_A' })).toBe('true_x@c.us_A');
    expect(idDaMensagem({ id: { id: 'A' } })).toBe('A');
    expect(idDaMensagem({ key: { id: 'B' } })).toBe('B');
    expect(idDaMensagem(null)).toBeNull();
  });
});
