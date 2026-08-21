import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../lib/supabase', () => ({
  supabase: { from: vi.fn() },
}));

import { supabase } from '../../../lib/supabase';
import { buscarColeta } from './useColetas';
import { coletaFixture as coleta } from '../testing/coleta';

const fromMock = supabase.from as unknown as ReturnType<typeof vi.fn>;
const maybeSingleMock = vi.fn();
const eqMock = vi.fn();
const selectMock = vi.fn(() => ({ eq: eqMock }));

afterEach(() => {
  vi.clearAllMocks();
});

describe('buscarColeta', () => {
  it('busca a coleta do agendamento em ac_coletas', async () => {
    eqMock.mockReturnValueOnce({ maybeSingle: maybeSingleMock });
    maybeSingleMock.mockResolvedValueOnce({ data: coleta(), error: null });
    fromMock.mockReturnValueOnce({ select: selectMock });

    await expect(buscarColeta('a1')).resolves.toEqual(coleta());

    expect(fromMock).toHaveBeenCalledWith('ac_coletas');
    expect(selectMock).toHaveBeenCalledWith('*');
    expect(eqMock).toHaveBeenCalledWith('agendamento_id', 'a1');
  });

  it('devolve null quando não há coleta para o agendamento', async () => {
    eqMock.mockReturnValueOnce({ maybeSingle: maybeSingleMock });
    maybeSingleMock.mockResolvedValueOnce({ data: null, error: null });
    fromMock.mockReturnValueOnce({ select: selectMock });

    await expect(buscarColeta('a2')).resolves.toBeNull();
  });

  it('lança o erro do supabase', async () => {
    eqMock.mockReturnValueOnce({ maybeSingle: maybeSingleMock });
    maybeSingleMock.mockResolvedValueOnce({ data: null, error: { message: 'RLS recusou' } });
    fromMock.mockReturnValueOnce({ select: selectMock });

    await expect(buscarColeta('a3')).rejects.toThrow('RLS recusou');
  });
});
