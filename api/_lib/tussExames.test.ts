import { afterEach, describe, expect, it } from 'vitest';
import type { VercelRequest } from '@vercel/node';
import type { SupabaseClient } from '@supabase/supabase-js';
import { buildTussExames, isAdmissaoApiKeyValid } from './tussExames.js';

function criarReq(authorization?: string): VercelRequest {
  return { headers: authorization ? { authorization } : {} } as unknown as VercelRequest;
}

describe('isAdmissaoApiKeyValid', () => {
  const original = process.env.ADMISSAO_API_KEY;

  afterEach(() => {
    process.env.ADMISSAO_API_KEY = original;
  });

  it('sem ADMISSAO_API_KEY configurada lança erro', () => {
    delete process.env.ADMISSAO_API_KEY;
    expect(() => isAdmissaoApiKeyValid(criarReq('Bearer qualquer'))).toThrow('ADMISSAO_API_KEY');
  });

  it('sem header Authorization retorna false', () => {
    process.env.ADMISSAO_API_KEY = 'segredo-teste';
    expect(isAdmissaoApiKeyValid(criarReq())).toBe(false);
  });

  it('chave errada retorna false', () => {
    process.env.ADMISSAO_API_KEY = 'segredo-teste';
    expect(isAdmissaoApiKeyValid(criarReq('Bearer chave-errada'))).toBe(false);
  });

  it('chave certa retorna true', () => {
    process.env.ADMISSAO_API_KEY = 'segredo-teste';
    expect(isAdmissaoApiKeyValid(criarReq('Bearer segredo-teste'))).toBe(true);
  });
});

// Linhas como estão no banco, com as colunas que a Admissão não deve receber.
const exameLigado = {
  id: 'e1',
  tuss: '40601285',
  nome: 'Genotipagem HPV 28',
  custo_direto: 10,
  custo_indireto: 5,
  aplis_id_exame_tipo: 30,
  aplis_id_teste: 101,
};
const exameLigadoSemTeste = {
  id: 'e2',
  tuss: '40601129',
  nome: 'Citologia',
  custo_direto: 3,
  custo_indireto: 1,
  aplis_id_exame_tipo: 3,
  aplis_id_teste: null,
};
const exameSemVinculo = {
  id: 'e3',
  tuss: '40601200',
  nome: 'Peça cirúrgica',
  custo_direto: 20,
  custo_indireto: 8,
  aplis_id_exame_tipo: null,
  aplis_id_teste: null,
};
const fonteGeral = {
  id: 'f1',
  fonte_pagadora: 'ASSEFAZ',
  tabela_associada: 'assefaz texto antigo',
  tabela_associada_id: 't1',
  tuss: '40601129',
  exame_id: null,
  valor: 50,
  atendido: true,
  elegivel_desconto_particular: false,
};
const fonteDeExame = {
  id: 'f2',
  fonte_pagadora: 'ASSEFAZ',
  tabela_associada: 'assefaz texto antigo',
  tabela_associada_id: 't2',
  tuss: '40601285',
  exame_id: 'e1',
  valor: '120.00',
  atendido: false,
  elegivel_desconto_particular: false,
};
// O nome que vale é o do cadastro, não o texto da linha.
const tabelaAssefaz = { id: 't1', fonte_pagadora: 'ASSEFAZ', nome: 'ASSEFAZ', vencimento: null, ativa: true };
const tabelaAssefazExpresso = { id: 't2', fonte_pagadora: 'ASSEFAZ', nome: 'ASSEFAZ Expresso', vencimento: null, ativa: true };
const exclusao = { payor_id: 'f1', exame_id: 'e3' };

function criarSupabaseMock(dados: Record<string, Record<string, unknown>[]>, falha?: string) {
  // Como o PostgREST: só as colunas pedidas no select voltam em cada linha.
  return {
    from: (tabela: string) => ({
      select: (colunas: string) => {
        const lista = colunas.split(',').map(c => c.trim());
        return {
          range: (from: number) => ({
            returns: async () =>
              tabela === falha
                ? { data: null, error: { message: 'permission denied' } }
                : {
                    data:
                      from === 0
                        ? (dados[tabela] ?? []).map(linha =>
                            Object.fromEntries(lista.filter(c => c in linha).map(c => [c, linha[c]])),
                          )
                        : [],
                    error: null,
                  },
          }),
        };
      },
    }),
  } as unknown as SupabaseClient;
}

const dadosCompletos = {
  custo_exames: [exameLigado, exameLigadoSemTeste, exameSemVinculo],
  custo_fontes_pagadoras: [fonteGeral, fonteDeExame],
  custo_tabelas_associadas: [tabelaAssefaz, tabelaAssefazExpresso],
  custo_fontes_pagadoras_exclusoes: [exclusao],
};

describe('buildTussExames', () => {
  it('exames: só os ligados ao apLIS, sem nome nem custo', async () => {
    const payload = await buildTussExames(criarSupabaseMock(dadosCompletos));

    expect(payload.exames).toEqual([
      { id: 'e1', tuss: '40601285', aplis_id_exame_tipo: 30, aplis_id_teste: 101 },
      { id: 'e2', tuss: '40601129', aplis_id_exame_tipo: 3, aplis_id_teste: null },
    ]);
  });

  it('fontes_pagadoras: todas as linhas, sem valor nem fonte_pagadora, com a tabela do cadastro', async () => {
    const payload = await buildTussExames(criarSupabaseMock(dadosCompletos));

    expect(payload.fontes_pagadoras).toEqual([
      { id: 'f1', tabela_associada_id: 't1', tabela_associada: 'ASSEFAZ', tuss: '40601129', exame_id: null, atendido: true },
      {
        id: 'f2',
        tabela_associada_id: 't2',
        tabela_associada: 'ASSEFAZ Expresso',
        tuss: '40601285',
        exame_id: 'e1',
        atendido: false,
      },
    ]);
  });

  it('exclusoes: todas, mesmo de exames sem vínculo', async () => {
    const payload = await buildTussExames(criarSupabaseMock(dadosCompletos));

    expect(payload.exclusoes).toEqual([{ payor_id: 'f1', exame_id: 'e3' }]);
  });

  it('gerado_em é um ISO do momento da montagem', async () => {
    const antes = Date.now();
    const payload = await buildTussExames(criarSupabaseMock(dadosCompletos));

    expect(new Date(payload.gerado_em).toISOString()).toBe(payload.gerado_em);
    expect(Date.parse(payload.gerado_em)).toBeGreaterThanOrEqual(antes);
  });

  it('nenhum valor ou custo vaza no payload', async () => {
    const payload = await buildTussExames(criarSupabaseMock(dadosCompletos));
    const json = JSON.stringify(payload);

    for (const chave of ['valor', 'custo_direto', 'custo_indireto', 'nome', 'fonte_pagadora', 'elegivel']) {
      expect(json).not.toContain(`"${chave}`);
    }
  });

  it('falha ao ler uma tabela rejeita a montagem', async () => {
    await expect(
      buildTussExames(criarSupabaseMock(dadosCompletos, 'custo_fontes_pagadoras_exclusoes')),
    ).rejects.toThrow('custo_fontes_pagadoras_exclusoes');
  });
});
