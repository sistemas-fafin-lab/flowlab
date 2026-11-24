import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./supabase.js', () => ({ getSupabaseAdminClient: vi.fn() }));

import { getSupabaseAdminClient } from './supabase.js';
import { sincronizarNomePacienteLabhub } from './recepcaoAgendamento.js';

const getSupabaseAdminClientMock = getSupabaseAdminClient as ReturnType<typeof vi.fn>;

interface Cenario {
  permissoes?: string[];
  agendamento?: { labhub_id: string | null; paciente_nome: string } | null;
}

function montarSupabase({ permissoes = ['canEditarColeta'], agendamento }: Cenario) {
  const maybeSingle = vi.fn(async () => ({ data: agendamento ?? null, error: null }));
  getSupabaseAdminClientMock.mockReturnValue({
    auth: { getUser: async () => ({ data: { user: { id: 'u1', email: 'ana@lab' } }, error: null }) },
    from: (tabela: string) => {
      if (tabela === 'user_profiles') {
        return {
          select: () => ({
            eq: () => ({
              single: async () => ({
                data: { name: 'Ana', email: 'ana@lab', custom_roles: { permissions: permissoes } },
              }),
            }),
          }),
        };
      }
      return { select: () => ({ eq: () => ({ maybeSingle }) }) };
    },
  });
  return { maybeSingle };
}

const fetchMock = vi.fn();

beforeEach(() => {
  process.env.LABHUB_API_URL = 'https://labhub.test';
  process.env.FLOWLAB_API_KEY = 'chave';
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  fetchMock.mockReset();
});

describe('sincronizarNomePacienteLabhub', () => {
  it('403 sem canEditarColeta, sem ir ao LAB-HUB', async () => {
    montarSupabase({ permissoes: ['canEditarAgendamentos'] });

    const r = await sincronizarNomePacienteLabhub('jwt', { agendamentoId: 'a1' });

    expect(r.status).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('agendamento nativo do FlowLab: sucesso sem sincronizar', async () => {
    montarSupabase({ agendamento: { labhub_id: null, paciente_nome: 'Ireni' } });

    const r = await sincronizarNomePacienteLabhub('jwt', { agendamentoId: 'a1' });

    expect(r).toEqual({ status: 200, payload: { success: true, sincronizado: false, motivo: 'sem_labhub' } });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('envia ao LAB-HUB o nome salvo no FlowLab e quem pediu', async () => {
    montarSupabase({ agendamento: { labhub_id: 'lh-1', paciente_nome: 'Ireni Lousado Barbosa' } });
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ correcaoId: 'c1', pacienteId: 'p1', alterado: true }), { status: 200 }),
    );

    const r = await sincronizarNomePacienteLabhub('jwt', { agendamentoId: 'a1' });

    expect(r).toEqual({ status: 200, payload: { success: true, sincronizado: true, alterado: true } });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://labhub.test/api/v1/integracao/agendamentos/lh-1/paciente-nome');
    expect((init.headers as Record<string, string>)['x-api-key']).toBe('chave');
    expect(JSON.parse(init.body as string)).toEqual({
      nome: 'Ireni Lousado Barbosa',
      solicitadoPor: 'Ana <ana@lab>',
    });
  });

  it('repassa a mensagem de recusa 400 do LAB-HUB', async () => {
    montarSupabase({ agendamento: { labhub_id: 'lh-1', paciente_nome: 'X' } });
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ message: 'Nome longo demais' }), { status: 400 }));

    const r = await sincronizarNomePacienteLabhub('jwt', { agendamentoId: 'a1' });

    expect(r).toEqual({ status: 400, payload: { success: false, error: 'Nome longo demais' } });
  });

  it('504 quando o LAB-HUB não responde', async () => {
    montarSupabase({ agendamento: { labhub_id: 'lh-1', paciente_nome: 'X' } });
    fetchMock.mockRejectedValue(new Error('timeout'));

    const r = await sincronizarNomePacienteLabhub('jwt', { agendamentoId: 'a1' });

    expect(r.status).toBe(504);
  });

  it('404 quando o agendamento não existe', async () => {
    montarSupabase({ agendamento: null });

    const r = await sincronizarNomePacienteLabhub('jwt', { agendamentoId: 'a1' });

    expect(r.status).toBe(404);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
