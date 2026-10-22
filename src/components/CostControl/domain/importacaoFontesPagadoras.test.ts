import { describe, expect, it } from 'vitest';
import type { Exam, Payor } from '../../../hooks/useCostControl';
import {
  lerPlanilhaConvenio,
  parseLimiteCsp,
  planejarImportacao,
  parseValorImportacao,
  separarUpsertFontePagadora,
  validarLinhasImportacaoFontePagadora,
  validarLinhasPlanilhaConvenio,
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

describe('lerPlanilhaConvenio', () => {
  it('lê o modelo: cabeçalho na primeira linha', () => {
    expect(
      lerPlanilhaConvenio([
        ['TUSS', 'Nome do Exame', 'Valor'],
        ['40304361', 'Hemograma', 25.5],
      ]),
    ).toEqual([{ tuss: '40304361', nomeExame: 'Hemograma', valor: 25.5, linha: 2 }]);
  });

  it('lê a planilha do convênio: cabeçalho abaixo do topo, fora da coluna A, outros nomes e colunas a mais', () => {
    expect(
      lerPlanilhaConvenio([
        [],
        ['', 'Codigo TUSS', 'Nome do Exame', 'Valor convênio', 'Custo Alvaro', '%CSP', 'OBS'],
        ['', 40301150, 'Ácido Úrico, Dosagem', 8.12, 1.98, 0.2438, ''],
        ['', '', '', '', '', '', ''],
        ['', 40301222, 'Albumina, Dosagem', 8.12, 2.01, 0.2475, ''],
      ]),
    ).toEqual([
      { tuss: 40301150, nomeExame: 'Ácido Úrico, Dosagem', valor: 8.12, linha: 3 },
      { tuss: 40301222, nomeExame: 'Albumina, Dosagem', valor: 8.12, linha: 5 },
    ]);
  });

  it('sem as três colunas não lê nada', () => {
    expect(lerPlanilhaConvenio([['TUSS', 'Valor'], ['40304361', 1]])).toBeNull();
  });
});

describe('validarLinhasPlanilhaConvenio', () => {
  const linha = (over: Partial<LinhaBrutaImportacao>): LinhaBrutaImportacao & { linha: number } => ({
    tuss: '40304361',
    nomeExame: ' Hemograma ',
    valor: '25,50',
    linha: 2,
    ...over,
  });

  it('guarda TUSS, nome no convênio (sem espaços nas pontas) e valor', () => {
    expect(validarLinhasPlanilhaConvenio([linha({})])).toEqual([
      { row: 2, data: { tuss: '40304361', nomeConvenio: 'Hemograma', valor: 25.5 } },
    ]);
  });

  it('TUSS numérico (célula de número) vira texto', () => {
    expect(validarLinhasPlanilhaConvenio([linha({ tuss: 40301150 })])[0].data?.tuss).toBe('40301150');
  });

  it('TUSS sem exame na aba Exames é válido — sobe como não levantado', () => {
    expect(validarLinhasPlanilhaConvenio([linha({ tuss: '99999999' })])[0].data?.tuss).toBe('99999999');
  });

  it('TUSS ou nome vazio é inválido', () => {
    const [semTuss, semNome] = validarLinhasPlanilhaConvenio([linha({ tuss: '' }), { ...linha({ nomeExame: '  ' }), linha: 3 }]);
    expect(semTuss).toEqual({ row: 2, data: null, error: 'TUSS vazio' });
    expect(semNome).toEqual({ row: 3, data: null, error: 'TUSS 40304361: Nome do Exame vazio' });
  });
});

describe('planejarImportacao', () => {
  const exame = (over: Partial<Exam>): Exam => ({
    id: 'e1',
    code: '',
    tuss: '40304361',
    name: 'HEMOGRAMA COMPLETO',
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
    tabelaId: 't1',
    tus: '40304361',
    price: 100,
    atendido: true,
    elegivelDescontoParticular: false,
    exameId: null,
    nomeConvenio: null,
    ...over,
  });

  const hemograma = { tuss: '40304361', nomeConvenio: 'Hemograma', valor: 100 };

  const planejar = (over: Partial<Parameters<typeof planejarImportacao>[0]>) =>
    planejarImportacao({
      linhas: [hemograma],
      exams: [exame({ direct: 20, indirect: 10 })],
      payors: [],
      tabelaId: 't1',
      limiteCsp: 40,
      ...over,
    });

  it('vincula pelo nome parecido e calcula o CSP pelo custo do exame', () => {
    const { linhas } = planejar({});
    expect(linhas).toEqual([
      {
        ...hemograma,
        existenteId: null,
        exame: exame({ direct: 20, indirect: 10 }),
        origemVinculo: 'semelhanca',
        motivoNaoLevantado: null,
        adotaLinhaPropria: false,
        custo: 30,
        csp: 30,
        atendido: true,
      },
    ]);
  });

  it('limite é inclusivo: CSP igual ao limite é Sim, acima é Não', () => {
    expect(planejar({ limiteCsp: 30 }).linhas[0].atendido).toBe(true);
    expect(planejar({ limiteCsp: 29.99 }).linhas[0].atendido).toBe(false);
  });

  it('TUSS compartilhado: cada linha usa o custo do próprio exame, não o do mais caro', () => {
    const total = exame({ id: 'e1', tuss: '40307271', name: 'IGE TOTAL', direct: 8 });
    const painel = exame({ id: 'e2', tuss: '40307271', name: 'IgE Painel Alimentos (FX5E)', direct: 45.77 });
    const { linhas } = planejar({
      linhas: [
        { tuss: '40307271', nomeConvenio: 'IgE total', valor: 30 },
        { tuss: '40307271', nomeConvenio: 'IgE painel alimentos', valor: 100 },
      ],
      exams: [total, painel],
    });
    expect(linhas.map(l => [l.exame?.id, l.custo, l.atendido])).toEqual([
      ['e1', 8, true],
      ['e2', 45.77, false],
    ]);
  });

  it('exames do TUSS igualmente parecidos: uma linha por exame, todas com o valor do convênio e o custo de cada um', () => {
    const soro = exame({ id: 's', tuss: '40301630', name: 'CREATININA - S', direct: 2 });
    const urina = exame({ id: 'u', tuss: '40301630', name: 'CREATININA - U', direct: 5 });
    const { linhas } = planejar({
      linhas: [{ tuss: '40301630', nomeConvenio: 'Creatinina, Dosagem', valor: 10 }],
      exams: [soro, urina],
      limiteCsp: 40,
    });
    expect(linhas.map(l => [l.nomeConvenio, l.exame?.id, l.valor, l.custo, l.atendido])).toEqual([
      ['Creatinina, Dosagem', 's', 10, 2, true],
      ['Creatinina, Dosagem', 'u', 10, 5, false],
    ]);
  });

  it('custo 0 é custo levantado: CSP 0% e Sim', () => {
    const [linha] = planejar({ exams: [exame({})] }).linhas;
    expect(linha).toMatchObject({ custo: 0, csp: 0, atendido: true });
  });

  it('TUSS sem exame sobe como não levantado: Não, sem custo', () => {
    const [linha] = planejar({ exams: [] }).linhas;
    expect(linha).toMatchObject({ exame: null, motivoNaoLevantado: 'tuss_sem_exame', custo: null, csp: null, atendido: false });
  });

  it('nome muito diferente sobe como não levantado', () => {
    const [linha] = planejar({ linhas: [{ ...hemograma, nomeConvenio: 'Eritrograma' }] }).linhas;
    expect(linha).toMatchObject({ exame: null, motivoNaoLevantado: 'nome_diferente', atendido: false });
  });

  it('exame de outro TUSS nunca é candidato', () => {
    const [linha] = planejar({ exams: [exame({ tuss: '40304362' })] }).linhas;
    expect(linha.motivoNaoLevantado).toBe('tuss_sem_exame');
  });

  it('valor 0 é Não mesmo com custo', () => {
    const [linha] = planejar({ linhas: [{ ...hemograma, valor: 0 }] }).linhas;
    expect(linha).toMatchObject({ custo: 30, csp: null, atendido: false });
  });

  it('dois nomes do convênio para o mesmo exame: o primeiro vincula, o segundo fica não levantado', () => {
    const { linhas } = planejar({
      linhas: [hemograma, { ...hemograma, nomeConvenio: 'Hemograma completo c/ plaquetas' }],
    });
    expect(linhas.map(l => l.motivoNaoLevantado)).toEqual([null, 'exame_ja_vinculado']);
  });

  it('linha repetida na planilha (mesmo TUSS e nome): a última vence', () => {
    const { linhas } = planejar({ linhas: [hemograma, { ...hemograma, nomeConvenio: 'HEMOGRAMA', valor: 200 }] });
    expect(linhas).toHaveLength(1);
    expect(linhas[0].valor).toBe(200);
  });

  describe('reimportação', () => {
    it('mantém o exame da linha já vinculada (à mão ou não) e atualiza valor e Atendido', () => {
      const outro = exame({ id: 'e9', name: 'PAINEL QUALQUER', direct: 90 });
      const [linha] = planejar({
        exams: [exame({ direct: 20, indirect: 10 }), outro],
        payors: [linhaDePreco({ id: 'p7', nomeConvenio: 'HEMOGRAMA', exameId: 'e9' })],
      }).linhas;
      expect(linha).toMatchObject({ existenteId: 'p7', origemVinculo: 'mantido', custo: 90, atendido: false });
      expect(linha.exame?.id).toBe('e9');
    });

    it('mantém todos os exames de uma linha que valia para vários', () => {
      const soro = exame({ id: 's', name: 'CREATININA - S' });
      const urina = exame({ id: 'u', name: 'CREATININA - U' });
      const { linhas } = planejar({
        linhas: [{ ...hemograma, nomeConvenio: 'Creatinina' }],
        exams: [soro, urina, exame({ id: 'u24', name: 'CREATININA - U-24' })],
        payors: [
          linhaDePreco({ id: 'p1', nomeConvenio: 'Creatinina', exameId: 's' }),
          linhaDePreco({ id: 'p2', nomeConvenio: 'Creatinina', exameId: 'u' }),
        ],
      });
      expect(linhas.map(l => [l.existenteId, l.exame?.id, l.origemVinculo])).toEqual([
        ['p1', 's', 'mantido'],
        ['p2', 'u', 'mantido'],
      ]);
    });

    it('não levantada que passa a valer para vários exames: vira a linha do primeiro, os outros são novos', () => {
      const { linhas, naoLevantadasRemovidas } = planejar({
        linhas: [{ ...hemograma, nomeConvenio: 'Creatinina' }],
        exams: [exame({ id: 's', name: 'CREATININA - S' }), exame({ id: 'u', name: 'CREATININA - U' })],
        payors: [linhaDePreco({ id: 'n1', nomeConvenio: 'Creatinina' })],
      });
      expect(linhas.map(l => [l.existenteId, l.exame?.id])).toEqual([
        ['n1', 's'],
        [null, 'u'],
      ]);
      expect(naoLevantadasRemovidas).toEqual([]);
    });

    it('não levantada cujos exames já têm linha própria: as próprias são adotadas e ela sai', () => {
      const naoLevantada = linhaDePreco({ id: 'n1', nomeConvenio: 'Hemograma' });
      const { linhas, naoLevantadasRemovidas } = planejar({
        payors: [naoLevantada, linhaDePreco({ id: 'p5', exameId: 'e1' })],
      });
      expect(linhas.map(l => [l.existenteId, l.adotaLinhaPropria])).toEqual([['p5', true]]);
      expect(naoLevantadasRemovidas).toEqual([naoLevantada]);
    });

    it('tenta vincular de novo uma linha não levantada', () => {
      const [linha] = planejar({ payors: [linhaDePreco({ id: 'p7', nomeConvenio: 'Hemograma' })] }).linhas;
      expect(linha).toMatchObject({ existenteId: 'p7', origemVinculo: 'semelhanca' });
    });

    it('exame vinculado por outra linha importada que não está na planilha não é pego de novo', () => {
      const [linha] = planejar({
        payors: [linhaDePreco({ id: 'p7', nomeConvenio: 'Hemograma antigo', tus: '40304361', exameId: 'e1' })],
      }).linhas;
      expect(linha.motivoNaoLevantado).toBe('exame_ja_vinculado');
    });

    it('casa pela tabela (id): linha de outra tabela da mesma fonte não conta', () => {
      const [linha] = planejar({
        payors: [linhaDePreco({ id: 'p7', tabelaId: 't2', nomeConvenio: 'Hemograma', exameId: 'e1' })],
      }).linhas;
      expect(linha).toMatchObject({ existenteId: null, origemVinculo: 'semelhanca' });
    });
  });

  it('adota a linha própria do exame cadastrada à mão nesta tabela', () => {
    const [linha] = planejar({ payors: [linhaDePreco({ id: 'p5', exameId: 'e1' })] }).linhas;
    expect(linha).toMatchObject({ existenteId: 'p5', adotaLinhaPropria: true });
  });

  it('substitui as linhas gerais (formato antigo) só dos TUSS da planilha', () => {
    const geral = linhaDePreco({ id: 'g1' });
    const outroTuss = linhaDePreco({ id: 'g2', tus: '40302040' });
    const naoLevantada = linhaDePreco({ id: 'n1', nomeConvenio: 'Outro nome' });
    const deOutraTabela = linhaDePreco({ id: 'g3', tabelaId: 't2' });
    const { linhasGeraisSubstituidas } = planejar({ payors: [geral, outroTuss, naoLevantada, deOutraTabela] });
    expect(linhasGeraisSubstituidas.map(p => p.id)).toEqual(['g1']);
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
