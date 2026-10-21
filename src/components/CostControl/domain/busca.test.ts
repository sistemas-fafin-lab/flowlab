import { describe, expect, it } from 'vitest';
import type { Exam, Payor } from '../../../hooks/useCostControl';
import {
  buscarExamesPorTermo,
  buscarFontesPagadorasPorTermo,
  chaveExclusaoExame,
  examesPorFontePagadora,
  fontesPagadorasPorTuss,
  analisarLinhaFontePagadora,
  examesDoTuss,
  edicaoSeparaDaLinhaGeral,
  fontesPagadorasDoExame,
  irmaosNaLinha,
} from './busca';

const exame = (over: Partial<Exam>): Exam => ({
  id: 'e1',
  code: 'C1',
  tuss: '40304361',
  name: 'Hemograma completo',
  location: 'Unidade Central',
  direct: 10,
  indirect: 2,
  indirectItems: [],
  aplisIdExameTipo: null,
  aplisIdTeste: null,
  ...over,
});

// Sem tabelaId explícito, cada fonte + tabela (grafia exata) é um cadastro.
const fonte = (over: Partial<Payor>): Payor => {
  const linha = {
    id: 'p1',
    payor: 'Unimed',
    table: 'Unimed Coop.',
    tus: '40304361',
    price: 9.2,
    atendido: true,
    elegivelDescontoParticular: false,
    exameId: null,
    ...over,
  };
  return { ...linha, tabelaId: over.tabelaId ?? `${linha.payor}/${linha.table}` };
};

describe('buscarExamesPorTermo', () => {
  const exames = [
    exame({ id: 'e1', name: 'Hemograma completo', tuss: '40304361' }),
    exame({ id: 'e2', name: 'Glicemia de jejum', tuss: '40302040' }),
    exame({ id: 'e3', name: 'Colesterol total', tuss: '40304312' }),
  ];

  it('termo vazio devolve lista vazia', () => {
    expect(buscarExamesPorTermo(exames, '')).toEqual([]);
  });

  it('termo só com espaços devolve lista vazia', () => {
    expect(buscarExamesPorTermo(exames, '   ')).toEqual([]);
  });

  it('termo sem nenhum match devolve lista vazia', () => {
    expect(buscarExamesPorTermo(exames, 'inexistente')).toEqual([]);
  });

  it('casa por nome, parcial e case-insensitive', () => {
    expect(buscarExamesPorTermo(exames, 'HEMOgrama')).toEqual([exames[0]]);
  });

  it('casa ignorando acentos', () => {
    const comAcento = [exame({ id: 'e4', name: 'Colesterol LDL — avaliação', tuss: '40304399' })];
    expect(buscarExamesPorTermo(comAcento, 'avaliacao')).toEqual(comAcento);
  });

  it('NÃO casa de forma fuzzy — precisa ser substring contígua', () => {
    expect(buscarExamesPorTermo(exames, 'hmgcmplt')).toEqual([]);
  });

  it('casa por código TUSS, parcial, não precisa ser o código completo', () => {
    expect(buscarExamesPorTermo(exames, '403043')).toEqual([exames[0], exames[2]]);
  });

  it('devolve múltiplos matches simultâneos', () => {
    expect(buscarExamesPorTermo(exames, '4030')).toEqual(exames);
  });
});

describe('fontesPagadorasPorTuss', () => {
  const fontes = [
    fonte({ id: 'p1', tus: '40304361', price: 12.5 }),
    fonte({ id: 'p2', tus: '40304361', price: 9.2 }),
    fonte({ id: 'p3', tus: '40302040', price: 4.8 }),
    fonte({ id: 'p4', tus: '40304361', price: 8.1 }),
  ];

  it('tuss vazio devolve lista vazia', () => {
    expect(fontesPagadorasPorTuss(fontes, '')).toEqual([]);
  });

  it('tuss sem nenhum match devolve lista vazia', () => {
    expect(fontesPagadorasPorTuss(fontes, '00000000')).toEqual([]);
  });

  it('devolve só as fontes pagadoras do TUSS informado, ordenadas por valor crescente', () => {
    expect(fontesPagadorasPorTuss(fontes, '40304361')).toEqual([
      fontes[3], // 8.10
      fontes[1], // 9.20
      fontes[0], // 12.50
    ]);
  });
});

describe('buscarFontesPagadorasPorTermo', () => {
  const fontes = [
    fonte({ id: 'p1', payor: 'Unimed', tus: '40304361' }),
    fonte({ id: 'p2', payor: 'Unimed', tus: '40302040' }),
    fonte({ id: 'p3', payor: 'Bradesco Saúde', tus: '40304312' }),
    fonte({ id: 'p4', payor: 'Hemoprev', tus: '99999999' }),
  ];

  it('termo vazio devolve lista vazia', () => {
    expect(buscarFontesPagadorasPorTermo(fontes, '')).toEqual([]);
  });

  it('termo sem nenhum match devolve lista vazia', () => {
    expect(buscarFontesPagadorasPorTermo(fontes, 'inexistente')).toEqual([]);
  });

  it('casa por nome, parcial e case-insensitive', () => {
    expect(buscarFontesPagadorasPorTermo(fontes, 'bradesco')).toEqual(['Bradesco Saúde']);
  });

  it('deduplica fonte pagadora com múltiplas linhas pelo nome', () => {
    expect(buscarFontesPagadorasPorTermo(fontes, 'unimed')).toEqual(['Unimed']);
  });

  it('casa ignorando acentos, nos dois sentidos', () => {
    expect(buscarFontesPagadorasPorTermo(fontes, 'saude')).toEqual(['Bradesco Saúde']);
    expect(buscarFontesPagadorasPorTermo(fontes, 'sAÚDE')).toEqual(['Bradesco Saúde']);
  });

  it('NÃO casa de forma fuzzy — precisa ser substring contígua', () => {
    expect(buscarFontesPagadorasPorTermo(fontes, 'brdscsaude')).toEqual([]);
  });
});

describe('examesPorFontePagadora', () => {
  const exames = [
    exame({ id: 'e1', name: 'Hemograma completo', tuss: '40304361' }),
    exame({ id: 'e2', name: 'Glicemia de jejum', tuss: '40302040' }),
    exame({ id: 'e3', name: 'Colesterol total', tuss: '40304312' }),
  ];

  const fontes = [
    fonte({ id: 'p1', payor: 'Unimed', table: 'Unimed Coop.', tus: '40304361', price: 12.5 }),
    fonte({ id: 'p2', payor: 'Unimed', table: 'Unimed Nacional', tus: '40302040', price: 4.8 }),
    fonte({ id: 'p3', payor: 'Bradesco Saúde', table: 'Bradesco Top', tus: '40304312', price: 20 }),
  ];

  it('nome vazio devolve lista vazia', () => {
    expect(examesPorFontePagadora(exames, fontes, '')).toEqual([]);
  });

  it('nome sem nenhum match devolve lista vazia', () => {
    expect(examesPorFontePagadora(exames, fontes, 'Inexistente')).toEqual([]);
  });

  it('devolve os exames da fonte pagadora, ordenados por valor crescente', () => {
    expect(examesPorFontePagadora(exames, fontes, 'Unimed')).toEqual([
      {
        payorId: 'p2',
        fontePagadora: 'Unimed',
        exameId: 'e2',
        exame: 'Glicemia de jejum',
        tuss: '40302040',
        tabelaId: 'Unimed/Unimed Nacional',
        tabelaAssociada: 'Unimed Nacional',
        valorCobrado: 4.8,
        valorPadraoTuss: 4.8,
        temValorPersonalizado: false,
        custo: 12,
        dif: -7.2,
        percentualCsp: 250,
        atendido: true,
        elegivelDescontoParticular: false,
      },
      {
        payorId: 'p1',
        fontePagadora: 'Unimed',
        exameId: 'e1',
        exame: 'Hemograma completo',
        tuss: '40304361',
        tabelaId: 'Unimed/Unimed Coop.',
        tabelaAssociada: 'Unimed Coop.',
        valorCobrado: 12.5,
        valorPadraoTuss: 12.5,
        temValorPersonalizado: false,
        custo: 12,
        dif: 0.5,
        percentualCsp: 96,
        atendido: true,
        elegivelDescontoParticular: false,
      },
    ]);
  });

  it('atendido reflete o flag da fonte pagadora, e custo/dif/%csp vêm do custo total do exame', () => {
    const fontesComNaoAtendido = [
      fonte({ id: 'p4', payor: 'Amil', table: 'Amil 400', tus: '40304361', price: 15, atendido: false }),
    ];
    expect(examesPorFontePagadora(exames, fontesComNaoAtendido, 'Amil')).toEqual([
      {
        payorId: 'p4',
        fontePagadora: 'Amil',
        exameId: 'e1',
        exame: 'Hemograma completo',
        tuss: '40304361',
        tabelaId: 'Amil/Amil 400',
        tabelaAssociada: 'Amil 400',
        valorCobrado: 15,
        valorPadraoTuss: 15,
        temValorPersonalizado: false,
        custo: 12,
        dif: 3,
        percentualCsp: 80,
        atendido: false,
        elegivelDescontoParticular: false,
      },
    ]);
  });

  it('elegivelDescontoParticular reflete o flag da fonte pagadora', () => {
    const fontesParticular = [
      fonte({
        id: 'p5',
        payor: 'Particular',
        table: 'Tabela Particular',
        tus: '40304361',
        price: 24,
        elegivelDescontoParticular: true,
      }),
    ];
    expect(examesPorFontePagadora(exames, fontesParticular, 'Particular')).toEqual([
      {
        payorId: 'p5',
        fontePagadora: 'Particular',
        exameId: 'e1',
        exame: 'Hemograma completo',
        tuss: '40304361',
        tabelaId: 'Particular/Tabela Particular',
        tabelaAssociada: 'Tabela Particular',
        valorCobrado: 24,
        valorPadraoTuss: 24,
        temValorPersonalizado: false,
        custo: 12,
        dif: 12,
        percentualCsp: 50,
        atendido: true,
        elegivelDescontoParticular: true,
      },
    ]);
  });

  it('TUSS compartilhado por exames com nomes diferentes: devolve uma linha por nome distinto, não só o primeiro/último', () => {
    const examesComTussDuplicado = [
      exame({ id: 'e10', name: 'FÓSFORO - S', tuss: '40301931' }),
      exame({ id: 'e11', name: 'FÓSFORO - U', tuss: '40301931' }),
    ];
    const fontesParticular = [
      fonte({ id: 'p10', payor: 'Particular', table: 'Tabela Particular', tus: '40301931', price: 13 }),
    ];

    const resultado = examesPorFontePagadora(examesComTussDuplicado, fontesParticular, 'Particular');

    expect(resultado).toHaveLength(2);
    expect(resultado.map((r) => r.exame).sort()).toEqual(['FÓSFORO - S', 'FÓSFORO - U']);
    // Mesma linha de preço (payorId) reaproveitada pros dois nomes — é o
    // mesmo registro de custo_fontes_pagadoras, só sem como saber a qual
    // dos dois exames ele realmente se refere.
    expect(resultado.every((r) => r.payorId === 'p10' && r.valorCobrado === 13)).toBe(true);
    expect(resultado.map((r) => r.exameId).sort()).toEqual(['e10', 'e11']);
  });

  it('exame excluído (chaveExclusaoExame) some da lista, mas o irmão de mesmo TUSS continua', () => {
    const examesComTussDuplicado = [
      exame({ id: 'e10', name: 'FÓSFORO - S', tuss: '40301931' }),
      exame({ id: 'e11', name: 'FÓSFORO - U', tuss: '40301931' }),
    ];
    const fontesParticular = [
      fonte({ id: 'p10', payor: 'Particular', table: 'Tabela Particular', tus: '40301931', price: 13 }),
    ];
    const excluidos = new Set([chaveExclusaoExame('p10', 'e10')]);

    const resultado = examesPorFontePagadora(examesComTussDuplicado, fontesParticular, 'Particular', excluidos);

    expect(resultado).toHaveLength(1);
    expect(resultado[0].exameId).toBe('e11');
  });

  it('valor personalizado (valoresPersonalizados) sobrescreve só o exame dono da chave; o irmão continua no valor padrão do TUSS', () => {
    const examesComTussDuplicado = [
      exame({ id: 'e10', name: 'FÓSFORO - S', tuss: '40301931' }),
      exame({ id: 'e11', name: 'FÓSFORO - U', tuss: '40301931' }),
    ];
    const fontesParticular = [
      fonte({ id: 'p10', payor: 'Particular', table: 'Tabela Particular', tus: '40301931', price: 13 }),
    ];
    const valoresPersonalizados = new Map([[chaveExclusaoExame('p10', 'e10'), 20]]);

    const resultado = examesPorFontePagadora(
      examesComTussDuplicado,
      fontesParticular,
      'Particular',
      new Set(),
      valoresPersonalizados,
    );

    const s = resultado.find((r) => r.exameId === 'e10')!;
    const u = resultado.find((r) => r.exameId === 'e11')!;

    expect(s.valorCobrado).toBe(20);
    expect(s.valorPadraoTuss).toBe(13);
    expect(s.temValorPersonalizado).toBe(true);
    // custo/dif/%csp do exame personalizado usam o valor personalizado, não o padrão
    expect(s.dif).toBe(20 - s.custo);

    expect(u.valorCobrado).toBe(13);
    expect(u.valorPadraoTuss).toBe(13);
    expect(u.temValorPersonalizado).toBe(false);
  });

  it('exame sem TUSS: linha só casa com o exame vinculado por exameId, nunca com outros exames sem TUSS', () => {
    const examesSemTuss = [
      exame({ id: 'e30', name: 'Painel de Trombofilias', tuss: '' }),
      exame({ id: 'e31', name: 'Painel Lactobacillus', tuss: '' }),
    ];
    const fontesParticular = [
      fonte({ id: 'p30', payor: 'Particular', table: 'Particular', tus: '', price: 8700, exameId: 'e30' }),
    ];

    const resultado = examesPorFontePagadora(examesSemTuss, fontesParticular, 'Particular');

    expect(resultado).toHaveLength(1);
    expect(resultado[0].exameId).toBe('e30');
    expect(resultado[0].exame).toBe('Painel de Trombofilias');
  });

  it('exame sem TUSS e sem exameId (dado legado não migrado): não aparece em lugar nenhum, em vez de casar com tudo', () => {
    const examesSemTuss = [
      exame({ id: 'e30', name: 'Painel de Trombofilias', tuss: '' }),
      exame({ id: 'e31', name: 'Painel Lactobacillus', tuss: '' }),
    ];
    const fontesParticular = [
      fonte({ id: 'p30', payor: 'Particular', table: 'Particular', tus: '', price: 900, exameId: null }),
    ];

    expect(examesPorFontePagadora(examesSemTuss, fontesParticular, 'Particular')).toEqual([]);
  });

  it('duas linhas sem TUSS pra exames diferentes não se misturam', () => {
    const examesSemTuss = [
      exame({ id: 'e30', name: 'Painel de Trombofilias', tuss: '' }),
      exame({ id: 'e31', name: 'Painel Lactobacillus', tuss: '' }),
    ];
    const fontesParticular = [
      fonte({ id: 'p30', payor: 'Particular', table: 'Particular', tus: '', price: 8700, exameId: 'e30' }),
      fonte({ id: 'p31', payor: 'Particular', table: 'Particular', tus: '', price: 350, exameId: 'e31' }),
    ];

    const resultado = examesPorFontePagadora(examesSemTuss, fontesParticular, 'Particular');

    expect(resultado).toHaveLength(2);
    expect(resultado.map((r) => r.exame).sort()).toEqual(['Painel Lactobacillus', 'Painel de Trombofilias']);
  });

  it('TUSS compartilhado por exames com o MESMO nome (duplicata literal): devolve uma linha só, com a ÚLTIMA entrada (mesma semântica de antes da issue 12)', () => {
    const examesDuplicadosMesmoNome = [
      exame({ id: 'e20', name: 'Hemograma completo', tuss: '40304361' }),
      exame({ id: 'e21', name: 'Hemograma completo', tuss: '40304361' }),
    ];

    const resultado = examesPorFontePagadora(examesDuplicadosMesmoNome, fontes, 'Unimed');

    expect(resultado).toHaveLength(1);
    expect(resultado[0].exame).toBe('Hemograma completo');
    expect(resultado[0].exameId).toBe('e21');
  });
});

describe('examesPorFontePagadora — linha de exame vs. linha geral do TUSS', () => {
  const exames = [
    exame({ id: 'e1', tuss: '40601200', name: 'BIOPSIA SEXTANTE' }),
    exame({ id: 'e2', tuss: '40601200', name: 'BIOPSIA SIMPLES' }),
  ];
  const geral = fonte({ id: 'p1', payor: 'Particular', table: 'Particular', tus: '40601200', price: 250 });
  const soSextante = fonte({ id: 'p2', payor: 'Particular', table: 'Particular', tus: '40601200', price: 450, exameId: 'e1' });

  it('linha de exame vale só pro exame escolhido, mesmo com TUSS compartilhado', () => {
    const r = examesPorFontePagadora(exames, [soSextante], 'Particular');
    expect(r.map((e) => [e.exame, e.valorCobrado])).toEqual([['BIOPSIA SEXTANTE', 450]]);
  });

  it('linha de exame tem precedência sobre a linha geral da mesma tabela', () => {
    const r = examesPorFontePagadora(exames, [geral, soSextante], 'Particular');
    expect(r.map((e) => [e.exame, e.valorCobrado, e.payorId])).toEqual([
      ['BIOPSIA SIMPLES', 250, 'p1'],
      ['BIOPSIA SEXTANTE', 450, 'p2'],
    ]);
  });

  it('linha de exame de OUTRA tabela não tira o exame da linha geral', () => {
    const outraTabela = { ...soSextante, table: 'Outra', tabelaId: 't2' };
    const r = examesPorFontePagadora(exames, [geral, outraTabela], 'Particular');
    expect(r.map((e) => [e.exame, e.tabelaAssociada])).toEqual([
      ['BIOPSIA SEXTANTE', 'Particular'],
      ['BIOPSIA SIMPLES', 'Particular'],
      ['BIOPSIA SEXTANTE', 'Outra'],
    ]);
  });

  it('"Particular" e "PARTICULAR" cadastradas como tabelas diferentes não se misturam', () => {
    const maiusculas = { ...soSextante, table: 'PARTICULAR', tabelaId: 't2' };
    const r = examesPorFontePagadora(exames, [geral, maiusculas], 'Particular');
    expect(r.map((e) => [e.exame, e.tabelaAssociada, e.valorCobrado])).toEqual([
      ['BIOPSIA SEXTANTE', 'Particular', 250],
      ['BIOPSIA SIMPLES', 'Particular', 250],
      ['BIOPSIA SEXTANTE', 'PARTICULAR', 450],
    ]);
  });
});

describe('examesDoTuss', () => {
  it('um exame por nome distinto, ordenado por nome; TUSS vazio devolve vazio', () => {
    const exames = [
      exame({ id: 'e1', tuss: '40601200', name: 'BIOPSIA SIMPLES' }),
      exame({ id: 'e2', tuss: '40601200', name: 'BIOPSIA SEXTANTE' }),
      exame({ id: 'e3', tuss: '40601200', name: 'BIOPSIA SEXTANTE' }),
      exame({ id: 'e4', tuss: '40304361', name: 'Hemograma completo' }),
    ];
    expect(examesDoTuss(exames, ' 40601200 ').map((e) => e.id)).toEqual(['e3', 'e1']);
    expect(examesDoTuss(exames, '')).toEqual([]);
  });
});

describe('analisarLinhaFontePagadora', () => {
  const geral = fonte({ id: 'p1', payor: 'Particular', table: 'Particular', tabelaId: 't1', tus: '40601200', price: 250 });
  const soSextante = fonte({ id: 'p2', payor: 'Particular', table: 'Particular', tabelaId: 't1', tus: '40601200', exameId: 'e1' });

  it('linha de exame: aponta a linha geral que deixa de valer pra ele, sem duplicata', () => {
    expect(analisarLinhaFontePagadora([geral], { tabelaId: 't1', tus: '40601200', exameId: 'e1' })).toEqual({
      duplicada: null,
      linhaGeralSubstituida: geral,
    });
  });

  it('linha de exame duplicada: mesmo exame, mesma tabela', () => {
    expect(analisarLinhaFontePagadora([geral, soSextante], { tabelaId: 't1', tus: '40601200', exameId: 'e1' }).duplicada).toBe(
      soSextante,
    );
  });

  it('linha geral duplicada: mesmo TUSS sem exame, ignorando a linha de exame', () => {
    expect(analisarLinhaFontePagadora([soSextante], { tabelaId: 't1', tus: '40601200', exameId: null })).toEqual({
      duplicada: null,
      linhaGeralSubstituida: null,
    });
    expect(analisarLinhaFontePagadora([geral], { tabelaId: 't1', tus: '40601200', exameId: null }).duplicada).toBe(geral);
  });

  it('em edição, ignora a própria linha', () => {
    expect(analisarLinhaFontePagadora([geral], { tabelaId: 't1', tus: '40601200', exameId: null }, 'p1')).toEqual({
      duplicada: null,
      linhaGeralSubstituida: null,
    });
  });

  it('tabela de nome que colide por normalização ("PARTICULAR" × "Particular") é outra tabela: nem duplica nem substitui', () => {
    expect(analisarLinhaFontePagadora([geral, soSextante], { tabelaId: 't2', tus: '40601200', exameId: 'e1' })).toEqual({
      duplicada: null,
      linhaGeralSubstituida: null,
    });
    expect(analisarLinhaFontePagadora([geral], { tabelaId: 't2', tus: '40601200', exameId: null }).duplicada).toBeNull();
  });
});

describe('edicaoSeparaDaLinhaGeral', () => {
  const exames = [
    exame({ id: 'e1', tuss: '40503801', name: 'Exame antigo' }),
    exame({ id: 'e2', tuss: '40503801', name: 'Exame novo' }),
    exame({ id: 'e3', tuss: '40304361', name: 'Hemograma completo' }),
  ];

  it('linha geral de TUSS compartilhado + um exame escolhido: separa (não atualiza a geral)', () => {
    expect(edicaoSeparaDaLinhaGeral({ tus: '40503801', exameId: null }, { exameId: 'e2' }, exames)).toBe(true);
  });

  it('continua atualizando quando segue geral, já era linha de exame ou o TUSS tem um exame só', () => {
    expect(edicaoSeparaDaLinhaGeral({ tus: '40503801', exameId: null }, { exameId: null }, exames)).toBe(false);
    expect(edicaoSeparaDaLinhaGeral({ tus: '40503801', exameId: 'e1' }, { exameId: 'e2' }, exames)).toBe(false);
    expect(edicaoSeparaDaLinhaGeral({ tus: '40304361', exameId: null }, { exameId: 'e3' }, exames)).toBe(false);
  });
});

describe('fontesPagadorasDoExame', () => {
  // Caso real: TUSS 40503801 com dois exames; a linha Particular é só do
  // PAINEL — buscar o CFTR não pode mostrá-la.
  const exames = [
    exame({ id: 'painel', tuss: '40503801', name: 'PAINEL PARA CÂNCER HEREDITÁRIO EXPANDIDO' }),
    exame({ id: 'cftr', tuss: '40503801', name: 'Sequenciamento NGS do Gene CFTR' }),
  ];
  const soPainel = fonte({ id: 'p1', payor: 'Particular', table: 'Particular', tus: '40503801', price: 5381.9, exameId: 'painel' });
  const geralUnimed = fonte({ id: 'p2', payor: 'Unimed', table: 'Unimed Coop.', tus: '40503801', price: 3000 });
  const outroTuss = fonte({ id: 'p3', payor: 'Unimed', table: 'Unimed Coop.', tus: '40304361', price: 9 });

  it('linha de exame de outro exame do mesmo TUSS não aparece', () => {
    expect(fontesPagadorasDoExame(exames, [soPainel, geralUnimed, outroTuss], 'cftr').map((f) => f.payorId)).toEqual(['p2']);
    expect(fontesPagadorasDoExame(exames, [soPainel, geralUnimed, outroTuss], 'painel').map((f) => f.payorId)).toEqual([
      'p2',
      'p1',
    ]);
  });

  it('linha própria tem precedência sobre a geral da mesma fonte + tabela, e vale o valor por exame', () => {
    const geralParticular = fonte({ id: 'p4', payor: 'Particular', table: 'Particular', tus: '40503801', price: 100 });
    const linhas = fontesPagadorasDoExame(
      exames,
      [soPainel, geralParticular, geralUnimed],
      'painel',
      new Set(),
      new Map([[chaveExclusaoExame('p2', 'painel'), 3500]]),
    );
    expect(linhas.map((f) => [f.payorId, f.fontePagadora, f.valorCobrado])).toEqual([
      ['p2', 'Unimed', 3500],
      ['p1', 'Particular', 5381.9],
    ]);
  });

  it('exame excluído da linha geral some', () => {
    expect(
      fontesPagadorasDoExame(exames, [geralUnimed], 'cftr', new Set([chaveExclusaoExame('p2', 'cftr')])),
    ).toEqual([]);
  });
});

describe('irmaosNaLinha', () => {
  const exames = [
    exame({ id: 'e1', tuss: '40503801', name: 'Exame A' }),
    exame({ id: 'e2', tuss: '40503801', name: 'Exame B' }),
  ];
  const geral = fonte({ id: 'p1', payor: 'Particular', table: 'Particular', tus: '40503801', price: 100 });

  it('linha geral compartilhada: os outros exames do TUSS', () => {
    expect(irmaosNaLinha(exames, [geral], { payorId: 'p1', exameId: 'e1', fontePagadora: 'Particular' }).map((e) => e.exameId)).toEqual([
      'e2',
    ]);
  });

  it('sem irmãos quando o outro exame tem linha própria ou foi excluído', () => {
    const soE2 = fonte({ id: 'p2', payor: 'Particular', table: 'Particular', tus: '40503801', price: 200, exameId: 'e2' });
    const item = { payorId: 'p1', exameId: 'e1', fontePagadora: 'Particular' };
    expect(irmaosNaLinha(exames, [geral, soE2], item)).toEqual([]);
    expect(irmaosNaLinha(exames, [geral], item, new Set([chaveExclusaoExame('p1', 'e2')]))).toEqual([]);
  });
});
