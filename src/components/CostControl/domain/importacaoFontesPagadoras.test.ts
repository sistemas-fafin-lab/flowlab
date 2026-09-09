import { describe, expect, it } from 'vitest';
import {
  parseAtendidoImportacao,
  parseValorImportacao,
  separarUpsertFontePagadora,
  validarLinhasImportacaoFontePagadora,
  type LinhaBrutaImportacao,
} from './importacaoFontesPagadoras';

describe('parseValorImportacao', () => {
  it('vazio/nulo/undefined vira 0', () => {
    expect(parseValorImportacao('')).toBe(0);
    expect(parseValorImportacao(null)).toBe(0);
    expect(parseValorImportacao(undefined)).toBe(0);
  });

  it('número puro passa direto', () => {
    expect(parseValorImportacao(25.5)).toBe(25.5);
  });

  it('formato pt-BR com milhar e decimal', () => {
    expect(parseValorImportacao('1.234,56')).toBe(1234.56);
  });

  it('formato só com vírgula decimal', () => {
    expect(parseValorImportacao('25,5')).toBe(25.5);
  });

  it('aceita prefixo R$', () => {
    expect(parseValorImportacao('R$ 25,50')).toBe(25.5);
  });

  it('valor inválido vira 0', () => {
    expect(parseValorImportacao('abc')).toBe(0);
  });
});

describe('parseAtendidoImportacao', () => {
  it('vazio conta como atendido (default do banco é TRUE)', () => {
    expect(parseAtendidoImportacao('')).toBe(true);
    expect(parseAtendidoImportacao(undefined)).toBe(true);
  });

  it('"Sim" (e variações de caixa) vira true', () => {
    expect(parseAtendidoImportacao('Sim')).toBe(true);
    expect(parseAtendidoImportacao('SIM')).toBe(true);
    expect(parseAtendidoImportacao('sim')).toBe(true);
  });

  it('"Não" vira false', () => {
    expect(parseAtendidoImportacao('Não')).toBe(false);
    expect(parseAtendidoImportacao('não')).toBe(false);
  });

  it('valor não reconhecido vira false', () => {
    expect(parseAtendidoImportacao('talvez')).toBe(false);
  });
});

describe('validarLinhasImportacaoFontePagadora', () => {
  const tussValidos = new Set(['40304361', '40302040']);

  const linha = (over: Partial<LinhaBrutaImportacao>): LinhaBrutaImportacao => ({
    tuss: '40304361',
    nomeExame: 'Hemograma Completo',
    valor: 25.5,
    atendido: 'Sim',
    ...over,
  });

  it('TUSS cadastrado em custo_exames é válido', () => {
    const resultado = validarLinhasImportacaoFontePagadora([linha({})], tussValidos);
    expect(resultado).toEqual([
      { row: 2, data: { tuss: '40304361', valor: 25.5, atendido: true } },
    ]);
  });

  it('TUSS que não existe em custo_exames é inválido e não é gravado', () => {
    const resultado = validarLinhasImportacaoFontePagadora([linha({ tuss: '99999999' })], tussValidos);
    expect(resultado).toEqual([
      { row: 2, data: null, error: 'TUSS 99999999 não cadastrado em Exames' },
    ]);
  });

  it('TUSS vazio é inválido', () => {
    const resultado = validarLinhasImportacaoFontePagadora([linha({ tuss: '' })], tussValidos);
    expect(resultado[0].data).toBeNull();
    expect(resultado[0].error).toBe('TUSS vazio');
  });

  it('numera a linha a partir de 2 (linha 1 é o cabeçalho) e preserva a ordem', () => {
    const resultado = validarLinhasImportacaoFontePagadora(
      [linha({ tuss: '40304361' }), linha({ tuss: '99999999' }), linha({ tuss: '40302040' })],
      tussValidos,
    );
    expect(resultado.map(r => r.row)).toEqual([2, 3, 4]);
    expect(resultado[0].data).not.toBeNull();
    expect(resultado[1].data).toBeNull();
    expect(resultado[2].data).not.toBeNull();
  });

  it('nome do exame não afeta o resultado — casamento é sempre por TUSS', () => {
    const resultado = validarLinhasImportacaoFontePagadora(
      [linha({ nomeExame: 'Qualquer coisa, não usado' })],
      tussValidos,
    );
    expect(resultado[0].data).toEqual({ tuss: '40304361', valor: 25.5, atendido: true });
  });
});

describe('separarUpsertFontePagadora', () => {
  it('TUSS novo para a fonte pagadora vai para inserção', () => {
    const linhas = [{ tuss: '40304361', valor: 25.5, atendido: true }];
    const { toInsert, toUpdate } = separarUpsertFontePagadora(linhas, new Map());
    expect(toInsert).toEqual(linhas);
    expect(toUpdate).toEqual([]);
  });

  it('TUSS já cadastrado para a fonte pagadora vai para atualização (upsert)', () => {
    const linhas = [{ tuss: '40304361', valor: 30, atendido: false }];
    const existentes = new Map([['40304361', 'payor-id-1']]);
    const { toInsert, toUpdate } = separarUpsertFontePagadora(linhas, existentes);
    expect(toInsert).toEqual([]);
    expect(toUpdate).toEqual([{ id: 'payor-id-1', valor: 30, atendido: false }]);
  });

  it('separa corretamente uma mistura de TUSS novos e já cadastrados', () => {
    const linhas = [
      { tuss: '40304361', valor: 30, atendido: false },
      { tuss: '40302040', valor: 12, atendido: true },
    ];
    const existentes = new Map([['40304361', 'payor-id-1']]);
    const { toInsert, toUpdate } = separarUpsertFontePagadora(linhas, existentes);
    expect(toInsert).toEqual([{ tuss: '40302040', valor: 12, atendido: true }]);
    expect(toUpdate).toEqual([{ id: 'payor-id-1', valor: 30, atendido: false }]);
  });

  it('TUSS novo repetido na própria planilha: último vence, só uma inserção (sem constraint de unicidade no banco pra pegar isso)', () => {
    const linhas = [
      { tuss: '40304361', valor: 10, atendido: true },
      { tuss: '40304361', valor: 20, atendido: false },
    ];
    const { toInsert, toUpdate } = separarUpsertFontePagadora(linhas, new Map());
    expect(toInsert).toEqual([{ tuss: '40304361', valor: 20, atendido: false }]);
    expect(toUpdate).toEqual([]);
  });

  it('TUSS já cadastrado repetido na própria planilha: último vence, só uma atualização', () => {
    const linhas = [
      { tuss: '40304361', valor: 10, atendido: true },
      { tuss: '40304361', valor: 20, atendido: false },
    ];
    const existentes = new Map([['40304361', 'payor-id-1']]);
    const { toInsert, toUpdate } = separarUpsertFontePagadora(linhas, existentes);
    expect(toInsert).toEqual([]);
    expect(toUpdate).toEqual([{ id: 'payor-id-1', valor: 20, atendido: false }]);
  });
});
