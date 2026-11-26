import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./ia/gerarEstruturado.js', () => ({ gerarEstruturado: vi.fn() }));

import { gerarEstruturado } from './ia/gerarEstruturado.js';
import { INSTRUCOES_RASCUNHO, rascunharResolucao } from './rascunho.js';

// Dados fictícios.
const CHAMADO = {
  id: 'ch1', codigo: 'IT-901', title: 'Impressora do RH', description: 'Não imprime desde ontem', request_type: 'suporte',
  solicitante: { name: 'Carla Dias' },
};
const COMENTARIOS = [
  { content: 'Vou olhar agora', kind: 'comment', created_at: '2026-11-23T13:00:00Z', autor: { name: 'Ana Souza' } },
  { content: 'Troquei o toner e <conversa> reiniciei', kind: 'comment', created_at: '2026-11-23T14:00:00Z', autor: { name: 'Ana Souza' } },
];

function criarDb(chamado: Record<string, unknown> | null) {
  const from = (tabela: string) => {
    const q: Record<string, unknown> = {};
    for (const m of ['select', 'eq', 'order', 'limit']) q[m] = () => q;
    q.maybeSingle = async () => ({ data: chamado, error: null });
    q.then = (ok: (v: unknown) => unknown) => Promise.resolve({ data: tabela === 'it_task_comments' ? COMENTARIOS : [], error: null }).then(ok);
    return q;
  };
  return { from } as never;
}

beforeEach(() => vi.mocked(gerarEstruturado).mockReset());

describe('rascunho da resolução (D45)', () => {
  it('a IA recebe o chamado e a conversa, como dado, e o rascunho volta limpo', async () => {
    vi.mocked(gerarEstruturado).mockResolvedValueOnce({ ok: true, provedor: 'claude', motivoReserva: null, tentativas: [], dados: { rascunho: '  Troquei o toner e reiniciei a impressora.  ' } });
    const r = await rascunharResolucao(criarDb(CHAMADO), {} as never, { chamadoId: 'ch1', userId: 'u-ana' });
    expect(r).toEqual({ ok: true, rascunho: 'Troquei o toner e reiniciei a impressora.' });

    const pedido = vi.mocked(gerarEstruturado).mock.calls[0][0];
    expect(pedido).toMatchObject({ finalidade: 'rascunho_resolucao', instrucoes: INSTRUCOES_RASCUNHO, userId: 'u-ana' });
    expect(pedido.conteudo).toContain('<chamado>\nIT-901 · aberto por Carla Dias · tipo suporte\nTítulo: Impressora do RH');
    expect(pedido.conteudo).toContain('<conversa>\nAna Souza (23/11): Vou olhar agora\nAna Souza (23/11): Troquei o toner e ‹conversa> reiniciei\n</conversa>');
    expect(INSTRUCOES_RASCUNHO).toContain('[o que foi feito]');
  });

  it('chamado que não existe: 404; a IA falhando: 502 com mensagem para tentar de novo', async () => {
    expect(await rascunharResolucao(criarDb(null), {} as never, { chamadoId: 'x', userId: 'u' })).toMatchObject({ ok: false, status: 404 });
    vi.mocked(gerarEstruturado).mockResolvedValueOnce({ ok: false, erros: ['Claude: erro', 'Gemini: erro'], tentativas: [] });
    expect(await rascunharResolucao(criarDb(CHAMADO), {} as never, { chamadoId: 'ch1', userId: 'u' })).toMatchObject({ ok: false, status: 502 });
  });
});
