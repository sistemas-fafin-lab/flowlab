import { describe, expect, it, vi } from 'vitest';
import { criarClienteGranola } from './granola.js';

const resposta = (status: number, corpo: unknown) =>
  ({ ok: status >= 200 && status < 300, status, json: async () => corpo }) as Response;

const nota = (id: string) => ({ id, title: id, created_at: '2026-10-01T00:00:00Z', updated_at: '2026-10-02T00:00:00Z', deleted_at: null });

describe('cliente do Granola', () => {
  it('lista a pasta seguindo o cursor, com o filtro de data e a chave no cabeçalho', async () => {
    const f = vi.fn()
      .mockResolvedValueOnce(resposta(200, { notes: [nota('not_a')], hasMore: true, cursor: 'c2' }))
      .mockResolvedValueOnce(resposta(200, { notes: [nota('not_b')], hasMore: false, cursor: null }));
    const r = await criarClienteGranola({ apiKey: 'grn_x', fetch: f }).listarNotas({ pastaId: 'fol_1', atualizadasDepois: '2026-10-01T00:00:00Z' });
    expect(r.ok && r.dados.map((n) => n.id)).toEqual(['not_a', 'not_b']);
    const [url1, init1] = f.mock.calls[0];
    expect(url1).toContain('folder_id=fol_1');
    expect(url1).toContain('updated_after=2026-10-01T00%3A00%3A00Z');
    expect(init1.headers.Authorization).toBe('Bearer grn_x');
    expect(f.mock.calls[1][0]).toContain('cursor=c2');
  });

  it.each([
    [401, 'chave do Granola inválida'],
    [429, 'limite de requisições'],
    [500, 'HTTP 500'],
  ])('HTTP %i vira erro legível, sem lançar', async (status, trecho) => {
    const r = await criarClienteGranola({ apiKey: 'grn_x', fetch: vi.fn().mockResolvedValue(resposta(status, {})) }).listarNotas({ pastaId: 'fol_1' });
    expect(r.ok).toBe(false);
    if ('erro' in r) {
      expect(r.status).toBe(status);
      expect(r.erro).toContain(trecho);
    }
  });

  it('falha de rede e JSON inválido não lançam', async () => {
    const semRede = await criarClienteGranola({ apiKey: 'grn_x', fetch: vi.fn().mockRejectedValue(new Error('ECONNRESET')) }).buscarNota('not_abc');
    const jsonRuim = await criarClienteGranola({
      apiKey: 'grn_x',
      fetch: vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => { throw new SyntaxError('Unexpected token'); } } as unknown as Response),
    }).buscarNota('not_abc');
    expect(semRede.ok).toBe(false);
    expect(jsonRuim.ok).toBe(false);
  });

  it('sem chave ou com id inválido, nem chama a API', async () => {
    const f = vi.fn();
    expect((await criarClienteGranola({ apiKey: '', fetch: f }).listarNotas({ pastaId: 'fol_1' })).ok).toBe(false);
    expect((await criarClienteGranola({ apiKey: 'grn_x', fetch: f }).buscarNota('../outra')).ok).toBe(false);
    expect(f).not.toHaveBeenCalled();
  });
});
