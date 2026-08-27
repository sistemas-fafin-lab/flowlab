import { afterEach, describe, expect, it, vi } from 'vitest';
import { enviarSolicitacaoAol } from './aol.js';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

const respostaFetch = (texto: string, status = 200) => ({
  status,
  text: async () => texto,
});

function mockFetch(texto: string, status = 200) {
  const fetchMock = vi.fn(async () => respostaFetch(texto, status));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

describe('enviarSolicitacaoAol', () => {
  it('sucesso (200 + corpo) devolve { httpStatus, texto }', async () => {
    const fetchMock = mockFetch('<solicitacoes/>', 200);

    const resultado = await enviarSolicitacaoAol('<solicitacoes senha="__ENV__"/>');

    expect(resultado).toEqual({ httpStatus: 200, texto: '<solicitacoes/>' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://webservice.alvaro.com.br/webserviceaol/rest/producao');
    expect(init.method).toBe('PUT');
  });

  it('sem AOL_IDAGENTE/AOL_SENHA configuradas não manda header Authorization', async () => {
    vi.stubEnv('AOL_IDAGENTE', '');
    vi.stubEnv('AOL_SENHA', '');
    const fetchMock = mockFetch('ok', 200);

    await enviarSolicitacaoAol('<solicitacoes/>');

    const [, init] = fetchMock.mock.calls[0];
    expect(init.headers).not.toHaveProperty('Authorization');
  });

  it('com AOL_IDAGENTE/AOL_SENHA configuradas manda Authorization Basic', async () => {
    vi.stubEnv('AOL_IDAGENTE', 'agente1');
    vi.stubEnv('AOL_SENHA', 'senha1');
    const fetchMock = mockFetch('ok', 200);

    await enviarSolicitacaoAol('<solicitacoes/>');

    const [, init] = fetchMock.mock.calls[0];
    expect(init.headers.Authorization).toBe(
      'Basic ' + Buffer.from('agente1:senha1').toString('base64'),
    );
  });

  it('timeout (AbortSignal.timeout) propaga como rejeição', async () => {
    const erroAbort = new DOMException('The operation was aborted.', 'TimeoutError');
    const fetchMock = vi.fn(async () => {
      throw erroAbort;
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(enviarSolicitacaoAol('<solicitacoes/>')).rejects.toThrow('The operation was aborted.');
  });
});
