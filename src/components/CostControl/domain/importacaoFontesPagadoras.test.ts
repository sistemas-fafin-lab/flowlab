import { describe, expect, it } from 'vitest';
import type { Exam, Payor } from '../../../hooks/useCostControl';
import { chaveExclusaoExame } from './busca';
import {
  calcularAtendidoImportacao,
  parseLimiteCsp,
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

describe('validarLinhasImportacaoFontePagadora', () => {
  const tussValidos = new Set(['40304361', '40302040']);

  const linha = (over: Partial<LinhaBrutaImportacao>): LinhaBrutaImportacao => ({
    tuss: '40304361',
    nomeExame: 'Hemograma Completo',
    valor: 25.5,
    ...over,
  });

  it('TUSS cadastrado em custo_exames é válido', () => {
    const resultado = validarLinhasImportacaoFontePagadora([linha({})], tussValidos);
    expect(resultado).toEqual([
      { row: 2, data: { tuss: '40304361', valor: 25.5 } },
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

  it('planilha antiga com a coluna Atendido: a coluna é ignorada (o Atendido é calculado pelo % máx CSP)', () => {
    const antiga = { ...linha({}), atendido: 'Não' } as LinhaBrutaImportacao;
    const resultado = validarLinhasImportacaoFontePagadora([antiga], tussValidos);
    expect(resultado[0].data).toEqual({ tuss: '40304361', valor: 25.5 });
  });

  it('nome do exame não afeta o resultado — casamento é sempre por TUSS', () => {
    const resultado = validarLinhasImportacaoFontePagadora(
      [linha({ nomeExame: 'Qualquer coisa, não usado' })],
      tussValidos,
    );
    expect(resultado[0].data).toEqual({ tuss: '40304361', valor: 25.5 });
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
    expect(toUpdate).toEqual([{ id: 'payor-id-1', tuss: '40304361', valor: 30, atendido: false }]);
  });

  it('separa corretamente uma mistura de TUSS novos e já cadastrados', () => {
    const linhas = [
      { tuss: '40304361', valor: 30, atendido: false },
      { tuss: '40302040', valor: 12, atendido: true },
    ];
    const existentes = new Map([['40304361', 'payor-id-1']]);
    const { toInsert, toUpdate } = separarUpsertFontePagadora(linhas, existentes);
    expect(toInsert).toEqual([{ tuss: '40302040', valor: 12, atendido: true }]);
    expect(toUpdate).toEqual([{ id: 'payor-id-1', tuss: '40304361', valor: 30, atendido: false }]);
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
    expect(toUpdate).toEqual([{ id: 'payor-id-1', tuss: '40304361', valor: 20, atendido: false }]);
  });
});

describe('calcularAtendidoImportacao', () => {
  const exame = (over: Partial<Exam>): Exam => ({
    id: 'e1',
    code: '',
    tuss: '40304361',
    name: 'Hemograma Completo',
    location: '',
    direct: 0,
    indirect: 0,
    indirectItems: [],
    aplisIdExameTipo: null,
    aplisIdTeste: null,
    ...over,
  });

  const linhaDePreco = (over: Partial<Payor>): Payor => ({
    id: 'p1',
    payor: 'Unimed',
    table: 'AMB',
    tus: '40304361',
    price: 100,
    atendido: true,
    elegivelDescontoParticular: false,
    exameId: null,
    ...over,
  });

  const calcular = (over: Partial<Parameters<typeof calcularAtendidoImportacao>[0]>) =>
    calcularAtendidoImportacao({
      linhas: [{ tuss: '40304361', valor: 100 }],
      exams: [],
      payors: [],
      fontePagadora: 'Unimed',
      tabelaAssociada: 'AMB',
      excluidos: new Set(),
      limiteCsp: 40,
      ...over,
    });

  it('TUSS com um exame: custo dele / valor da planilha, abaixo do limite é Sim', () => {
    const [resultado] = calcular({ exams: [exame({ direct: 20, indirect: 10 })] });
    expect(resultado).toEqual({
      tuss: '40304361',
      valor: 100,
      custoUsado: 30,
      csp: 30,
      atendido: true,
      exameDefinidor: 'Hemograma Completo',
      examesCobertos: 1,
      custoNaoCadastrado: false,
      examesComLinhaPropria: [],
    });
  });

  it('limite é inclusivo: CSP exatamente igual ao limite é Sim, acima é Não', () => {
    const exams = [exame({ direct: 7 })];
    expect(calcular({ exams, limiteCsp: 7 })[0]).toMatchObject({ csp: 7, atendido: true });
    expect(calcular({ exams, limiteCsp: 6.99 })[0].atendido).toBe(false);
  });

  it('TUSS compartilhado: usa o maior custo entre os exames — Sim só se todos cabem no limite', () => {
    const exams = [
      exame({ id: 'e1', name: 'Biópsia A', direct: 20 }),
      exame({ id: 'e2', name: 'Biópsia B', direct: 30, indirect: 20 }),
    ];
    expect(calcular({ exams })[0]).toMatchObject({ custoUsado: 50, csp: 50, atendido: false });
  });

  it('TUSS compartilhado: aponta o exame que definiu o CSP (o de maior custo entre os cobertos)', () => {
    const exams = [
      exame({ id: 'e1', name: 'Biópsia A', direct: 20 }),
      exame({ id: 'e2', name: 'Biópsia B', direct: 30, indirect: 20 }),
      exame({ id: 'e3', name: 'Biópsia C', direct: 10 }),
    ];
    expect(calcular({ exams })[0]).toMatchObject({ exameDefinidor: 'Biópsia B', examesCobertos: 3 });
  });

  it('TUSS com um exame: ele mesmo define o CSP', () => {
    const [resultado] = calcular({ exams: [exame({ direct: 20 })] });
    expect(resultado).toMatchObject({ exameDefinidor: 'Hemograma Completo', examesCobertos: 1 });
  });

  it('exame excluído da linha geral do TUSS nessa fonte + tabela não entra no maior custo', () => {
    const exams = [
      exame({ id: 'e1', name: 'Biópsia A', direct: 20 }),
      exame({ id: 'e2', name: 'Biópsia B', direct: 90 }),
    ];
    const [resultado] = calcular({
      exams,
      payors: [linhaDePreco({ id: 'p1' })],
      excluidos: new Set([chaveExclusaoExame('p1', 'e2')]),
    });
    expect(resultado).toMatchObject({ custoUsado: 20, atendido: true, exameDefinidor: 'Biópsia A', examesCobertos: 1 });
  });

  it('exame com linha própria na mesma fonte + tabela não entra no maior custo', () => {
    const exams = [
      exame({ id: 'e1', name: 'Biópsia A', direct: 20 }),
      exame({ id: 'e2', name: 'Biópsia Sextante', direct: 90 }),
    ];
    const [resultado] = calcular({
      exams,
      payors: [linhaDePreco({ id: 'p1' }), linhaDePreco({ id: 'p2', exameId: 'e2', price: 450 })],
    });
    expect(resultado).toMatchObject({ custoUsado: 20, atendido: true });
  });

  it('avisa os exames do TUSS com linha própria na mesma fonte + tabela (a importação não os altera)', () => {
    const exams = [
      exame({ id: 'e1', name: 'Biópsia A', direct: 20 }),
      exame({ id: 'e2', name: 'Biópsia Sextante', direct: 90 }),
      exame({ id: 'e3', name: 'Biópsia C', direct: 30 }),
      exame({ id: 'e4', tuss: '40302040', name: 'Outro TUSS', direct: 5 }),
    ];
    const resultado = calcular({
      exams,
      linhas: [
        { tuss: '40304361', valor: 100 },
        { tuss: '40302040', valor: 100 },
      ],
      payors: [
        linhaDePreco({ id: 'p1' }),
        linhaDePreco({ id: 'p2', exameId: 'e2', price: 450 }),
        // Outra tabela: não é linha própria nesta importação.
        linhaDePreco({ id: 'p3', table: 'CBHPM', exameId: 'e3', price: 450 }),
        // Outro TUSS: não aparece no aviso do primeiro.
        linhaDePreco({ id: 'p4', tus: '40302040', exameId: 'e4', price: 10 }),
      ],
    });
    expect(resultado[0].examesComLinhaPropria).toEqual(['Biópsia Sextante']);
    expect(resultado[1].examesComLinhaPropria).toEqual(['Outro TUSS']);
    expect(calcular({ exams: [exame({ direct: 20 })] })[0].examesComLinhaPropria).toEqual([]);
  });

  it('linha própria conta pela mesma fonte + tabela da tela: ignora caixa e acento, mas não outra tabela', () => {
    const exams = [
      exame({ id: 'e1', name: 'Biópsia A', direct: 20 }),
      exame({ id: 'e2', name: 'Biópsia Sextante', direct: 90 }),
      exame({ id: 'e3', name: 'Biópsia C', direct: 30 }),
    ];
    const [resultado] = calcular({
      exams,
      payors: [
        linhaDePreco({ id: 'p1' }),
        linhaDePreco({ id: 'p2', payor: 'UNIMED', table: 'amb', exameId: 'e2', price: 450 }),
        linhaDePreco({ id: 'p3', table: 'CBHPM', exameId: 'e3', price: 450 }),
      ],
    });
    expect(resultado).toMatchObject({ custoUsado: 30, atendido: true });
  });

  it('TUSS novo para a fonte (sem linha geral): só os exames com linha própria ficam fora', () => {
    const exams = [
      exame({ id: 'e1', name: 'Biópsia A', direct: 20 }),
      exame({ id: 'e2', name: 'Biópsia B', direct: 35 }),
      exame({ id: 'e3', name: 'Biópsia Sextante', direct: 90 }),
    ];
    const [resultado] = calcular({
      exams,
      payors: [linhaDePreco({ id: 'p2', exameId: 'e3', price: 450 })],
      // Exclusão de outra linha (de exame) não vale para a linha geral que vai ser criada.
      excluidos: new Set([chaveExclusaoExame('p2', 'e2')]),
    });
    expect(resultado).toMatchObject({ custoUsado: 35, csp: 35, atendido: true });
  });

  it('valor 0 (ou negativo) na planilha é Não, sem CSP', () => {
    const exams = [exame({ direct: 20 })];
    expect(calcular({ exams, linhas: [{ tuss: '40304361', valor: 0 }] })[0]).toMatchObject({ csp: null, atendido: false });
    expect(calcular({ exams, linhas: [{ tuss: '40304361', valor: -5 }] })[0]).toMatchObject({ csp: null, atendido: false });
  });

  it('custo usado 0 (custo não cadastrado) é Não — não vira CSP 0% e Sim', () => {
    const [resultado] = calcular({ exams: [exame({ direct: 0, indirect: 0 })] });
    expect(resultado).toMatchObject({ custoUsado: 0, atendido: false });
  });

  it('custo usado 0 avisa "custo não cadastrado" — também sem nenhum exame coberto; com custo não avisa', () => {
    expect(calcular({ exams: [exame({ direct: 0, indirect: 0 })] })[0]).toMatchObject({
      custoNaoCadastrado: true,
      exameDefinidor: null,
    });
    const soLinhaPropria = calcular({
      exams: [exame({ id: 'e1', direct: 20 })],
      payors: [linhaDePreco({ id: 'p2', exameId: 'e1' })],
    })[0];
    expect(soLinhaPropria).toMatchObject({ custoUsado: 0, custoNaoCadastrado: true, examesCobertos: 0 });
    expect(calcular({ exams: [exame({ direct: 20 })] })[0].custoNaoCadastrado).toBe(false);
  });
});

describe('parseLimiteCsp', () => {
  it('aceita número com vírgula ou ponto decimal', () => {
    expect(parseLimiteCsp('30')).toBe(30);
    expect(parseLimiteCsp('32,5')).toBe(32.5);
    expect(parseLimiteCsp(' 32.5 ')).toBe(32.5);
  });

  it('vazio, texto ou negativo é inválido (null) — não há limite padrão', () => {
    expect(parseLimiteCsp('')).toBeNull();
    expect(parseLimiteCsp('   ')).toBeNull();
    expect(parseLimiteCsp('abc')).toBeNull();
    expect(parseLimiteCsp('30abc')).toBeNull();
    expect(parseLimiteCsp('-1')).toBeNull();
  });
});
