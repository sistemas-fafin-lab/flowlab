import { describe, expect, it } from 'vitest';
import { despesaDoAvulso, validarVencimentoNoMes, type GastoAvulsoInput } from './avulso';
import { ocorrenciasNoIntervalo } from './recorrencia';
import { validarDespesa } from './validacaoDespesa';

const input = (campos: Partial<GastoAvulsoInput> = {}): GastoAvulsoInput => ({
  descricao: '  Taxa de migração de domínio ',
  categoriaId: 'cat-cloud',
  natureza: 'opex',
  fornecedorId: null,
  fornecedorNome: 'Registro.br',
  valor: 89.9,
  vencimento: '2026-10-22',
  formaPagamento: 'pix',
  autorizadoPor: 'Gerência de TI',
  autorizadoEm: null,
  observacoes: null,
  ...campos,
});

describe('validarVencimentoNoMes', () => {
  it('aceita qualquer dia do mês aberto', () => {
    expect(validarVencimentoNoMes('2026-10-01', '2026-10-01')).toBeNull();
    expect(validarVencimentoNoMes('2026-10-31', '2026-10-01')).toBeNull();
  });

  it('recusa vencimento fora do mês ou vazio', () => {
    expect(validarVencimentoNoMes('2026-11-02', '2026-10-01')).toMatch(/out\/2026/);
    expect(validarVencimentoNoMes('', '2026-10-01')).not.toBeNull();
  });
});

describe('despesaDoAvulso', () => {
  it('vira despesa única na competência, com o dia do vencimento', () => {
    const d = despesaDoAvulso(input(), '2026-10-01');
    expect(d).toMatchObject({
      descricao: 'Taxa de migração de domínio',
      recorrencia: 'unica',
      competenciaInicio: '2026-10-01',
      competenciaFim: null,
      diaVencimento: 22,
      valorBase: 89.9,
      tipoValor: 'fixo',
      renovacaoAutomatica: false,
    });
  });

  it('passa na validação da despesa e gera exatamente uma ocorrência, no mês aberto', () => {
    const d = despesaDoAvulso(input(), '2026-10-01');
    expect(validarDespesa(d, '2026-10-15')).toEqual({});
    const ocorrencias = ocorrenciasNoIntervalo(
      {
        id: 'nova',
        valorBase: d.valorBase as number,
        recorrencia: d.recorrencia,
        competenciaInicio: d.competenciaInicio as string,
        competenciaFim: d.competenciaFim,
        diaVencimento: d.diaVencimento as number,
        reajustes: [],
      },
      '2026-01-01',
      '2027-12-01',
    );
    expect(ocorrencias).toEqual([{ despesaId: 'nova', competencia: '2026-10-01', vencimento: '2026-10-22', valorPrevisto: 89.9 }]);
  });

  it('sem os obrigatórios, a validação da despesa aponta os campos', () => {
    const erros = validarDespesa(despesaDoAvulso(input({ descricao: '', fornecedorNome: '', valor: null, autorizadoPor: '' }), '2026-10-01'), '2026-10-15');
    expect(Object.keys(erros).sort()).toEqual(['autorizadoPor', 'descricao', 'fornecedorNome', 'valorBase']);
  });
});
