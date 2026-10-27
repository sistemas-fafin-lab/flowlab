import { describe, expect, it } from 'vitest';
import { nfsCanceladasDaBusca, type LinhaNfCanceladaBusca } from './nfCanceladaBusca';

const linha = (parcial: Partial<LinhaNfCanceladaBusca>): LinhaNfCanceladaBusca => ({
  id: 'nf-1',
  nota_id: null,
  numero_nota: '7496',
  valor: null,
  data_emissao: null,
  data_cancelamento: '2026-10-20',
  motivo: 'Convênio trocado',
  operadoras: { nome: 'SIS' },
  ...parcial,
});

describe('nfsCanceladasDaBusca', () => {
  it('agrupa por título os números cancelados que casaram', () => {
    const { porTitulo } = nfsCanceladasDaBusca([
      linha({ id: 'a', nota_id: 't1', numero_nota: '7496' }),
      linha({ id: 'b', nota_id: 't1', numero_nota: '7495' }),
      linha({ id: 'c', nota_id: 't2', numero_nota: '7498' }),
    ]);
    expect(porTitulo.get('t1')).toEqual(['7496', '7495']);
    expect(porTitulo.get('t2')).toEqual(['7498']);
  });

  it('devolve à parte as NFs canceladas sem título, com operadora, valor, emissão e motivo', () => {
    const { porTitulo, semTitulo } = nfsCanceladasDaBusca([
      linha({
        id: 'x', numero_nota: '7831', valor: '1234.50', data_emissao: '2026-06-02',
        motivo: 'Valor bruto errado', operadoras: { nome: 'BRADESCO' },
      }),
      linha({ id: 'y', numero_nota: '7996', operadoras: null }),
      linha({ id: 'z', nota_id: 't1', numero_nota: '7990' }),
    ]);
    expect(porTitulo.has('x')).toBe(false);
    expect(semTitulo).toEqual([
      {
        id: 'x', numeroNota: '7831', operadoraNome: 'BRADESCO', valor: 1234.5,
        dataEmissao: '2026-06-02', dataCancelamento: '2026-10-20', motivo: 'Valor bruto errado',
      },
      {
        id: 'y', numeroNota: '7996', operadoraNome: null, valor: null,
        dataEmissao: null, dataCancelamento: '2026-10-20', motivo: 'Convênio trocado',
      },
    ]);
  });
});
