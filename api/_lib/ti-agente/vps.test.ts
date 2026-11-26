import { describe, expect, it, vi } from 'vitest';
import { baixarMidias, criarChamadorVercel, type MidiaPendente, type RepositorioMidias } from './vps.js';

const AGORA = Date.parse('2026-11-24T15:00:00Z');

const pendente = (id: string, extra: Partial<MidiaPendente> = {}): MidiaPendente => ({
  id, membro_id: 'm1', midia_url: `http://localhost:3000/api/files/eva/${id}.oga`, midia_mimetype: 'audio/ogg; codecs=opus',
  created_at: '2026-11-24T14:59:30Z', ...extra,
});

function repo(itens: MidiaPendente[]) {
  const r = { subidas: [] as { caminho: string; bytes: number; tipo: string }[], baixadas: [] as string[], naoBaixou: [] as { id: string; erro: string }[] };
  const repositorio: RepositorioMidias = {
    pendentes: async () => itens,
    subir: async (caminho, bytes, tipo) => { r.subidas.push({ caminho, bytes: bytes.byteLength, tipo }); },
    marcarBaixada: async (id) => { r.baixadas.push(id); },
    marcarNaoBaixou: async (id, erro) => { r.naoBaixou.push({ id, erro }); },
  };
  return { r, repositorio };
}

const bytes = (n: number) => new Uint8Array(n);

describe('baixarMidias (D43)', () => {
  it('baixa do WAHA pelo caminho, sobe para o bucket com o tipo certo e avisa a Vercel', async () => {
    const { r, repositorio } = repo([pendente('a', { midia_url: 'https://x.ngrok.app/api/files/eva/a.oga' })]);
    const baixar = vi.fn(async () => ({ ok: true as const, bytes: bytes(2048), mimetype: 'audio/ogg' }));
    const avisar = vi.fn(async () => ({ ok: true as const }));
    const res = await baixarMidias(repositorio, { baixarArquivo: baixar }, avisar, { agora: () => AGORA });
    // A URL do ngrok vira o caminho, baixado pelo localhost da VPS (D9).
    expect(baixar).toHaveBeenCalledWith('/api/files/eva/a.oga');
    expect(r.subidas).toEqual([{ caminho: 'm1/a.ogg', bytes: 2048, tipo: 'audio/ogg' }]);
    expect(r.baixadas).toEqual(['a']);
    expect(avisar).toHaveBeenCalledWith('a');
    expect(res).toMatchObject({ baixadas: 1, naoBaixadas: 0, adiadas: 0, avisosFalhos: 0 });
  });

  it('falha recente tenta de novo; depois de 3 min, desiste e avisa a Vercel (que pede para mandar de novo)', async () => {
    const recente = repo([pendente('a')]);
    const falha = async () => ({ ok: false as const, erro: 'WAHA HTTP 404 ao baixar o arquivo.' });
    const avisar = vi.fn(async () => ({ ok: true as const }));
    expect(await baixarMidias(recente.repositorio, { baixarArquivo: falha }, avisar, { agora: () => AGORA })).toMatchObject({ adiadas: 1, naoBaixadas: 0 });
    expect(recente.r.naoBaixou).toEqual([]);
    expect(avisar).not.toHaveBeenCalled();

    const velha = repo([pendente('b', { created_at: '2026-11-24T14:55:00Z' })]);
    expect(await baixarMidias(velha.repositorio, { baixarArquivo: falha }, avisar, { agora: () => AGORA })).toMatchObject({ naoBaixadas: 1 });
    expect(velha.r.naoBaixou).toEqual([{ id: 'b', erro: 'WAHA HTTP 404 ao baixar o arquivo.' }]);
    expect(avisar).toHaveBeenCalledWith('b');
  });

  it('acima de 10 MB não sobe; URL fora do WAHA nem tenta', async () => {
    const { r, repositorio } = repo([pendente('a'), pendente('b', { midia_url: 'https://outro.site/b.oga' })]);
    const baixar = vi.fn(async () => ({ ok: true as const, bytes: bytes(11 * 1024 * 1024), mimetype: 'audio/ogg' }));
    const res = await baixarMidias(repositorio, { baixarArquivo: baixar }, async () => ({ ok: true }), { agora: () => AGORA });
    expect(baixar).toHaveBeenCalledTimes(1);
    expect(r.subidas).toEqual([]);
    expect(r.naoBaixou.map((x) => x.id)).toEqual(['a', 'b']);
    expect(r.naoBaixou[0].erro).toMatch(/acima do limite de 10 MB/);
    expect(res.naoBaixadas).toBe(2);
  });

  it('o aviso à Vercel falhou: a mídia fica baixada, e o relógio retoma', async () => {
    const { r, repositorio } = repo([pendente('a')]);
    const res = await baixarMidias(
      repositorio,
      { baixarArquivo: async () => ({ ok: true, bytes: bytes(10), mimetype: null }) },
      async () => ({ ok: false, erro: 'Vercel HTTP 500' }),
      { agora: () => AGORA },
    );
    expect(r.baixadas).toEqual(['a']);
    expect(res).toMatchObject({ baixadas: 1, avisosFalhos: 1 });
  });
});

describe('criarChamadorVercel (D43, D44)', () => {
  it('chama as rotas com o segredo no cabeçalho; o segredo não vai para o erro', async () => {
    const fetchFalso = vi.fn(async (_url: string, _init?: RequestInit) => new Response('{"success":true}', { status: 202 }));
    const v = criarChamadorVercel({ base: 'https://flow-lab.vercel.app/', segredo: 's3gr3d0' }, fetchFalso);
    expect(await v.midia('id-1')).toEqual({ ok: true });
    expect(fetchFalso.mock.calls[0][0]).toBe('https://flow-lab.vercel.app/api/ti/agente-midia');
    const init = fetchFalso.mock.calls[0][1]!;
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer s3gr3d0');
    expect(init.body).toBe('{"id":"id-1"}');

    const negado = criarChamadorVercel({ base: 'https://app', segredo: 's3gr3d0' }, async () => new Response('', { status: 401 }));
    const r = await negado.relogio();
    expect(r).toEqual({ ok: false, erro: 'Vercel HTTP 401 em /api/ti/agente-relogio (o CRON_SECRET da VPS é diferente do da Vercel?)' });
    expect(JSON.stringify(r)).not.toContain('s3gr3d0');
  });

  it('sem conexão: devolve o erro, sem lançar', async () => {
    const v = criarChamadorVercel({ base: 'https://app', segredo: 'x' }, async () => { throw new TypeError('fetch failed'); });
    expect(await v.relogio()).toEqual({ ok: false, erro: 'Sem conexão com a Vercel em /api/ti/agente-relogio (fetch failed).' });
  });
});
