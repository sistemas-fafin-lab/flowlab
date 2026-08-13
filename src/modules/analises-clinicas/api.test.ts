import { afterEach, describe, expect, it, vi } from 'vitest';
import { buscarPacientes, chamarAcClinicasApi, getToken } from './api';

vi.mock('../../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn(async () => ({ data: { session: { access_token: 'jwt-teste' } } })),
    },
  },
}));

import { supabase } from '../../lib/supabase';

const authMock = supabase.auth.getSession as ReturnType<typeof vi.fn>;

const respostaJson = (payload: unknown, ok = true, status = 200) => ({
  ok,
  status,
  json: async () => payload,
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('getToken', () => {
  it('devolve o access_token da sessão', async () => {
    await expect(getToken()).resolves.toBe('jwt-teste');
  });

  it('devolve null sem sessão', async () => {
    authMock.mockResolvedValueOnce({ data: { session: null } });
    await expect(getToken()).resolves.toBeNull();
  });
});

describe('chamarAcClinicasApi', () => {
  it('faz POST JSON com Authorization Bearer e devolve o payload', async () => {
    const fetchMock = vi.fn(async () => respostaJson({ success: true, valor: 42 }));
    vi.stubGlobal('fetch', fetchMock);

    const resultado = await chamarAcClinicasApi<{ valor: number }>('acao-teste', { x: 1 });

    expect(resultado).toEqual({ success: true, valor: 42 });
    expect(fetchMock).toHaveBeenCalledWith('/api/analises-clinicas/acao-teste', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer jwt-teste' },
      body: JSON.stringify({ x: 1 }),
    });
  });

  it('lança "Sessão expirada" sem token', async () => {
    authMock.mockResolvedValueOnce({ data: { session: null } });
    await expect(chamarAcClinicasApi('acao-teste', {})).rejects.toThrow('Sessão expirada');
  });

  it('lança a mensagem do servidor quando success é false', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => respostaJson({ success: false, error: 'Motivo do erro' })));
    await expect(chamarAcClinicasApi('acao-teste', {})).rejects.toThrow('Motivo do erro');
  });

  it('lança quando a resposta 200 vem sem success', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => respostaJson({ valor: 1 })));
    await expect(chamarAcClinicasApi('acao-teste', {})).rejects.toThrow('HTTP 200');
  });

  it('lança a falha genérica informada pelo chamador', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => respostaJson({}, false, 500)));
    await expect(chamarAcClinicasApi('acao-teste', {}, 'Não foi possível criar o agendamento.'))
      .rejects.toThrow('Não foi possível criar o agendamento.');
  });

  it('lança erro com o status HTTP quando o servidor falha sem mensagem', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => respostaJson({}, false, 500)));
    await expect(chamarAcClinicasApi('acao-teste', {})).rejects.toThrow('HTTP 500');
  });
});

describe('buscarPacientes', () => {
  const paciente = {
    id: 'p1',
    nome: 'João Silva',
    cpfMascarado: '***',
    dataNascimento: '1990-01-01',
  };

  it('não busca com termo menor que 2 caracteres', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    await expect(buscarPacientes(' a ')).resolves.toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('devolve a lista de pacientes em sucesso', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => respostaJson({ success: true, pacientes: [paciente] })),
    );
    await expect(buscarPacientes('joao')).resolves.toEqual([paciente]);
  });

  it('devolve [] quando a resposta não é ok', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => respostaJson({ success: false }, false, 401)));
    await expect(buscarPacientes('joao')).resolves.toEqual([]);
  });

  it('devolve [] quando o fetch lança (rede fora)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline'); }));
    await expect(buscarPacientes('joao')).resolves.toEqual([]);
  });
});
