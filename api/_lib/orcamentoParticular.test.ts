import { afterEach, describe, expect, it } from 'vitest';
import type { VercelRequest } from '@vercel/node';
import type { SupabaseClient } from '@supabase/supabase-js';
import { buildOrcamentoParticular, isTabelaParticularApiKeyValid } from './orcamentoParticular.js';

function criarReq(authorization?: string): VercelRequest {
  return { headers: authorization ? { authorization } : {} } as unknown as VercelRequest;
}

describe('isTabelaParticularApiKeyValid', () => {
  const original = process.env.TABELA_PARTICULAR_API_KEY;

  afterEach(() => {
    process.env.TABELA_PARTICULAR_API_KEY = original;
  });

  it('sem TABELA_PARTICULAR_API_KEY configurada lança erro', () => {
    delete process.env.TABELA_PARTICULAR_API_KEY;
    expect(() => isTabelaParticularApiKeyValid(criarReq('Bearer qualquer'))).toThrow(
      'TABELA_PARTICULAR_API_KEY',
    );
  });

  it('sem header Authorization retorna false', () => {
    process.env.TABELA_PARTICULAR_API_KEY = 'segredo-teste';
    expect(isTabelaParticularApiKeyValid(criarReq())).toBe(false);
  });

  it('header sem prefixo Bearer retorna false', () => {
    process.env.TABELA_PARTICULAR_API_KEY = 'segredo-teste';
    expect(isTabelaParticularApiKeyValid(criarReq('segredo-teste'))).toBe(false);
  });

  it('chave errada retorna false', () => {
    process.env.TABELA_PARTICULAR_API_KEY = 'segredo-teste';
    expect(isTabelaParticularApiKeyValid(criarReq('Bearer chave-errada'))).toBe(false);
  });

  it('chave certa retorna true', () => {
    process.env.TABELA_PARTICULAR_API_KEY = 'segredo-teste';
    expect(isTabelaParticularApiKeyValid(criarReq('Bearer segredo-teste'))).toBe(true);
  });
});

interface FonteRow {
  fonte_pagadora: string;
  tuss: string;
  // number | string: PostgREST pode devolver NUMERIC como string.
  valor: number | string;
  atendido: boolean;
  elegivel_desconto_particular: boolean;
}

interface ExameRow {
  tuss: string;
  nome: string;
  custo_direto: number | string;
  custo_indireto: number | string;
}

function criarSupabaseMock(dados: { custo_fontes_pagadoras: FonteRow[]; custo_exames: ExameRow[] }) {
  return {
    from: (tabela: string) => ({
      select: () => ({
        range: (from: number) => ({
          returns: async () => ({
            data: from === 0 ? (dados as Record<string, unknown[]>)[tabela] ?? [] : [],
            error: null,
          }),
        }),
      }),
    }),
  } as unknown as SupabaseClient;
}

describe('buildOrcamentoParticular', () => {
  it('monta um item por tuss Particular, com nome/custo de custo_exames', async () => {
    const supabase = criarSupabaseMock({
      custo_fontes_pagadoras: [
        {
          fonte_pagadora: 'Particular',
          tuss: '40301060',
          valor: 100,
          atendido: true,
          elegivel_desconto_particular: true,
        },
      ],
      custo_exames: [{ tuss: '40301060', nome: 'Hemograma', custo_direto: 10, custo_indireto: 5 }],
    });

    const itens = await buildOrcamentoParticular(supabase);

    expect(itens).toEqual([
      {
        tuss: '40301060',
        nome: 'Hemograma',
        preco: 100,
        custo: 15,
        elegivelDescontoParticular: true,
        conveniosAceitos: [],
      },
    ]);
  });

  it('tuss sem correspondência em custo_exames: nome e custo ficam null, sem quebrar', async () => {
    const supabase = criarSupabaseMock({
      custo_fontes_pagadoras: [
        {
          fonte_pagadora: 'Particular',
          tuss: '99999999',
          valor: 50,
          atendido: true,
          elegivel_desconto_particular: false,
        },
      ],
      custo_exames: [],
    });

    const itens = await buildOrcamentoParticular(supabase);

    expect(itens).toEqual([
      {
        tuss: '99999999',
        nome: null,
        preco: 50,
        custo: null,
        elegivelDescontoParticular: false,
        conveniosAceitos: [],
      },
    ]);
  });

  it('conveniosAceitos lista só fontes não-Particular com atendido=true pro mesmo tuss', async () => {
    const supabase = criarSupabaseMock({
      custo_fontes_pagadoras: [
        {
          fonte_pagadora: 'Particular',
          tuss: '40301060',
          valor: 100,
          atendido: true,
          elegivel_desconto_particular: false,
        },
        {
          fonte_pagadora: 'Convênio A',
          tuss: '40301060',
          valor: 80,
          atendido: true,
          elegivel_desconto_particular: false,
        },
        {
          fonte_pagadora: 'Convênio B',
          tuss: '40301060',
          valor: 70,
          atendido: false,
          elegivel_desconto_particular: false,
        },
      ],
      custo_exames: [],
    });

    const itens = await buildOrcamentoParticular(supabase);

    expect(itens).toHaveLength(1);
    expect(itens[0].conveniosAceitos).toEqual(['Convênio A']);
  });

  it('linhas não-Particular sem par Particular no mesmo tuss não geram item', async () => {
    const supabase = criarSupabaseMock({
      custo_fontes_pagadoras: [
        {
          fonte_pagadora: 'Convênio A',
          tuss: '11111111',
          valor: 30,
          atendido: true,
          elegivel_desconto_particular: false,
        },
      ],
      custo_exames: [],
    });

    const itens = await buildOrcamentoParticular(supabase);

    expect(itens).toEqual([]);
  });

  it('coage valor/custo_direto/custo_indireto vindos como string (NUMERIC via PostgREST)', async () => {
    const supabase = criarSupabaseMock({
      custo_fontes_pagadoras: [
        {
          fonte_pagadora: 'Particular',
          tuss: '40301060',
          valor: '100.00',
          atendido: true,
          elegivel_desconto_particular: true,
        },
      ],
      custo_exames: [{ tuss: '40301060', nome: 'Hemograma', custo_direto: '10.00', custo_indireto: '5.00' }],
    });

    const itens = await buildOrcamentoParticular(supabase);

    expect(itens).toEqual([
      expect.objectContaining({ preco: 100, custo: 15 }),
    ]);
  });

  it('tuss compartilhado por exames com nomes diferentes: devolve um item por nome distinto (mesmo preço/tuss/elegibilidade)', async () => {
    const supabase = criarSupabaseMock({
      custo_fontes_pagadoras: [
        {
          fonte_pagadora: 'Particular',
          tuss: '40301931',
          valor: 13,
          atendido: true,
          elegivel_desconto_particular: false,
        },
      ],
      custo_exames: [
        { tuss: '40301931', nome: 'FÓSFORO - S', custo_direto: 5, custo_indireto: 2 },
        { tuss: '40301931', nome: 'FÓSFORO - U', custo_direto: 6, custo_indireto: 3 },
      ],
    });

    const itens = await buildOrcamentoParticular(supabase);

    expect(itens).toHaveLength(2);
    expect(itens.map(i => i.nome).sort()).toEqual(['FÓSFORO - S', 'FÓSFORO - U']);
    expect(itens.every(i => i.tuss === '40301931' && i.preco === 13)).toBe(true);
    const porNome = new Map(itens.map(i => [i.nome, i]));
    expect(porNome.get('FÓSFORO - S')?.custo).toBe(7);
    expect(porNome.get('FÓSFORO - U')?.custo).toBe(9);
  });

  it('tuss compartilhado por exames com o MESMO nome (duplicata literal): devolve um item só, com a ÚLTIMA entrada', async () => {
    const supabase = criarSupabaseMock({
      custo_fontes_pagadoras: [
        {
          fonte_pagadora: 'Particular',
          tuss: '40301060',
          valor: 100,
          atendido: true,
          elegivel_desconto_particular: true,
        },
      ],
      custo_exames: [
        { tuss: '40301060', nome: 'Hemograma', custo_direto: 10, custo_indireto: 5 },
        { tuss: '40301060', nome: 'Hemograma', custo_direto: 999, custo_indireto: 999 },
      ],
    });

    const itens = await buildOrcamentoParticular(supabase);

    expect(itens).toHaveLength(1);
    expect(itens[0].nome).toBe('Hemograma');
    expect(itens[0].custo).toBe(1998);
  });

  it('duas linhas Particular pro mesmo tuss: mantém só a primeira, sem duplicar item', async () => {
    const supabase = criarSupabaseMock({
      custo_fontes_pagadoras: [
        {
          fonte_pagadora: 'Particular',
          tuss: '40301060',
          valor: 100,
          atendido: true,
          elegivel_desconto_particular: true,
        },
        {
          fonte_pagadora: 'Particular',
          tuss: '40301060',
          valor: 999,
          atendido: true,
          elegivel_desconto_particular: false,
        },
      ],
      custo_exames: [],
    });

    const itens = await buildOrcamentoParticular(supabase);

    expect(itens).toHaveLength(1);
    expect(itens[0].preco).toBe(100);
  });
});
