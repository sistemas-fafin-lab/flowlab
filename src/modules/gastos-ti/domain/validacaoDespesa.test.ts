import { describe, expect, it } from 'vitest';
import { normalizarDespesa, validarDespesa } from './validacaoDespesa';
import type { DespesaInput } from '../types';

const HOJE = '2026-10-01';

const valida = (campos: Partial<DespesaInput> = {}): DespesaInput => ({
  descricao: 'Microsoft 365',
  categoriaId: 'cat-saas',
  natureza: 'opex',
  quantidade: 40,
  unidade: 'licença',
  fornecedorId: null,
  fornecedorNome: 'Microsoft',
  setor: 'TI',
  responsavelId: null,
  tipoValor: 'fixo',
  valorBase: 2480,
  recorrencia: 'mensal',
  competenciaInicio: '2026-10-01',
  competenciaFim: null,
  diaVencimento: 10,
  formaPagamento: 'cartao_corporativo',
  meioPagamentoDetalhe: null,
  moedaOriginal: null,
  valorOriginal: null,
  numeroContrato: null,
  renovacaoAutomatica: false,
  avisoRenovacaoDias: 30,
  autorizadoPor: 'Diretoria',
  autorizadoEm: null,
  observacoes: null,
  ...campos,
});

describe('normalizarDespesa', () => {
  it('tira espaços extras e transforma vazio em null', () => {
    const n = normalizarDespesa(
      valida({ descricao: '  Microsoft   365 ', autorizadoPor: ' Fulano  de Tal ', unidade: '  ', numeroContrato: '' }),
    );
    expect(n.descricao).toBe('Microsoft 365');
    expect(n.autorizadoPor).toBe('Fulano de Tal');
    expect(n.unidade).toBeNull();
    expect(n.numeroContrato).toBeNull();
  });

  it('moeda em maiúsculas', () => {
    expect(normalizarDespesa(valida({ moedaOriginal: ' usd ' })).moedaOriginal).toBe('USD');
  });

  it('despesa única não tem competência final', () => {
    expect(normalizarDespesa(valida({ recorrencia: 'unica', competenciaFim: '2027-01-01' })).competenciaFim).toBeNull();
  });
});

describe('validarDespesa', () => {
  it('aceita um cadastro completo', () => {
    expect(validarDespesa(valida(), HOJE)).toEqual({});
  });

  it('exige os campos obrigatórios', () => {
    const erros = validarDespesa(
      valida({
        descricao: '',
        categoriaId: '',
        fornecedorNome: '',
        valorBase: null,
        competenciaInicio: null,
        diaVencimento: null,
        autorizadoPor: '',
      }),
      HOJE,
    );
    expect(Object.keys(erros).sort()).toEqual(
      ['autorizadoPor', 'categoriaId', 'competenciaInicio', 'descricao', 'diaVencimento', 'fornecedorNome', 'valorBase'].sort(),
    );
  });

  it('valor precisa ser maior que zero', () => {
    expect(validarDespesa(valida({ valorBase: 0 }), HOJE).valorBase).toBeDefined();
  });

  it('mês final não pode vir antes do inicial', () => {
    expect(validarDespesa(valida({ competenciaFim: '2026-09-01' }), HOJE).competenciaFim).toBeDefined();
    expect(validarDespesa(valida({ competenciaFim: '2026-10-01' }), HOJE).competenciaFim).toBeUndefined();
  });

  it('dia do vencimento entre 1 e 31', () => {
    expect(validarDespesa(valida({ diaVencimento: 0 }), HOJE).diaVencimento).toBeDefined();
    expect(validarDespesa(valida({ diaVencimento: 32 }), HOJE).diaVencimento).toBeDefined();
    expect(validarDespesa(valida({ diaVencimento: 31 }), HOJE).diaVencimento).toBeUndefined();
  });

  it('data da autorização é opcional, mas não pode ser futura (RN09)', () => {
    expect(validarDespesa(valida({ autorizadoEm: null }), HOJE).autorizadoEm).toBeUndefined();
    expect(validarDespesa(valida({ autorizadoEm: '2026-10-01' }), HOJE).autorizadoEm).toBeUndefined();
    expect(validarDespesa(valida({ autorizadoEm: '2026-10-02' }), HOJE).autorizadoEm).toBeDefined();
  });

  it('quantidade inteira e positiva quando informada', () => {
    expect(validarDespesa(valida({ quantidade: 0 }), HOJE).quantidade).toBeDefined();
    expect(validarDespesa(valida({ quantidade: 2.5 }), HOJE).quantidade).toBeDefined();
    expect(validarDespesa(valida({ quantidade: null }), HOJE).quantidade).toBeUndefined();
  });

  it('valor original exige moeda de 3 letras', () => {
    expect(validarDespesa(valida({ valorOriginal: 300, moedaOriginal: null }), HOJE).moedaOriginal).toBeDefined();
    expect(validarDespesa(valida({ valorOriginal: 300, moedaOriginal: 'US' }), HOJE).moedaOriginal).toBeDefined();
    expect(validarDespesa(valida({ valorOriginal: 300, moedaOriginal: 'USD' }), HOJE)).toEqual({});
  });

  it('antecedência do aviso de renovação entre 0 e 365', () => {
    expect(validarDespesa(valida({ avisoRenovacaoDias: 400 }), HOJE).avisoRenovacaoDias).toBeDefined();
    expect(validarDespesa(valida({ avisoRenovacaoDias: null }), HOJE).avisoRenovacaoDias).toBeDefined();
  });
});
