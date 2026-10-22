import { describe, expect, it } from 'vitest';
import type { Payor, TabelaAssociada } from '../../../hooks/useCostControl';
import {
  contarLinhasPorTabela,
  erroNomeTabela,
  fonteDaNovaTabela,
  opcoesDeTabela,
  tabelaEscolhidaDaFonte,
  tabelaProtegida,
  tabelasDaFonte,
} from './tabelasAssociadas';

const tabela = (id: string, fontePagadora: string, nome: string, ativa = true): TabelaAssociada => ({
  id,
  fontePagadora,
  nome,
  vencimento: null,
  ativa,
});

describe('tabelasDaFonte', () => {
  it('traz as tabelas da fonte sem diferenciar maiúsculas, acentos e espaços nas pontas', () => {
    const tabelas = [
      tabela('1', 'AMHP', 'PROASA'),
      tabela('2', 'Unimed', 'CBHPM'),
      tabela('3', 'amhp', 'AFFEGO'),
    ];
    expect(tabelasDaFonte(tabelas, '  Amhp ').map(t => t.id)).toEqual(['1', '3']);
  });

  it('sem fonte informada não traz nenhuma tabela', () => {
    expect(tabelasDaFonte([tabela('1', 'AMHP', 'PROASA')], '   ')).toEqual([]);
  });
});

describe('fonteDaNovaTabela', () => {
  it('usa a grafia da fonte já cadastrada nas tabelas, não a digitada', () => {
    expect(fonteDaNovaTabela([tabela('1', 'AMHP-DF', 'PROASA')], ' amhp-df ')).toBe('AMHP-DF');
  });

  it('fonte ainda sem tabelas fica com a digitada, sem espaços nas pontas', () => {
    expect(fonteDaNovaTabela([], '  AMHP-DF ')).toBe('AMHP-DF');
  });
});

describe('opcoesDeTabela', () => {
  const daFonte = [
    tabela('1', 'AMHP', 'PROASA'),
    tabela('2', 'AMHP', 'antiga', false),
    tabela('3', 'AMHP', 'AFFEGO'),
  ];

  it('oferece só as tabelas ativas, em ordem alfabética', () => {
    expect(opcoesDeTabela(daFonte, null).map(t => t.nome)).toEqual(['AFFEGO', 'PROASA']);
  });

  it('mantém a tabela já escolhida na linha mesmo inativa, para a edição não perdê-la', () => {
    expect(opcoesDeTabela(daFonte, '2').map(t => t.nome)).toEqual(['AFFEGO', 'antiga', 'PROASA']);
  });
});

describe('erroNomeTabela', () => {
  const daFonte = [tabela('1', 'Particular', 'Part'), tabela('2', 'Particular', 'Campanha 2025', false)];

  it('aceita um nome que a fonte ainda não tem', () => {
    expect(erroNomeTabela('PROASA', daFonte)).toBeNull();
  });

  it('recusa nome em branco', () => {
    expect(erroNomeTabela('   ', daFonte)).toBe('Informe o nome da tabela.');
  });

  it('recusa nome que a fonte já tem, mesmo com outras maiúsculas e espaços nas pontas', () => {
    expect(erroNomeTabela('  PART ', daFonte)).toBe('Já existe a tabela "Part" nesta fonte pagadora.');
  });

  it('recusa também o nome de uma tabela inativa, avisando que ela está inativa', () => {
    expect(erroNomeTabela('campanha 2025', daFonte)).toBe(
      'Já existe a tabela "Campanha 2025" nesta fonte pagadora (inativa).'
    );
  });

  it('ao renomear, não conta a própria tabela — dá para só trocar maiúsculas', () => {
    expect(erroNomeTabela('PART', daFonte, '1')).toBeNull();
  });

  it('ao renomear, recusa o nome de outra tabela da fonte', () => {
    expect(erroNomeTabela('Part', daFonte, '2')).toBe('Já existe a tabela "Part" nesta fonte pagadora.');
  });
});

describe('tabelaEscolhidaDaFonte', () => {
  const tabelas = [tabela('1', 'AMHP', 'PROASA'), tabela('2', 'Unimed', 'CBHPM')];

  it('devolve a tabela escolhida quando ela é da fonte digitada', () => {
    expect(tabelaEscolhidaDaFonte(tabelas, 'amhp', '1')?.nome).toBe('PROASA');
  });

  it('trocar a fonte depois de escolher deixa sem tabela', () => {
    expect(tabelaEscolhidaDaFonte(tabelas, 'Unimed', '1')).toBeNull();
  });
});

describe('tabelaProtegida', () => {
  it('protege a tabela Particular da fonte Particular, sem diferenciar maiúsculas', () => {
    expect(tabelaProtegida(tabela('1', 'Particular', 'Particular'))).toBe(true);
    expect(tabelaProtegida(tabela('2', 'Particular', 'PARTICULAR'))).toBe(true);
  });

  it('não protege as outras tabelas da fonte Particular nem a "Particular" de outra fonte', () => {
    expect(tabelaProtegida(tabela('1', 'Particular', 'PART'))).toBe(false);
    expect(tabelaProtegida(tabela('2', 'AMHP', 'Particular'))).toBe(false);
  });
});

describe('contarLinhasPorTabela', () => {
  const linha = (id: string, tabelaId: string): Payor => ({
    id,
    payor: 'AMHP',
    table: '',
    tabelaId,
    tus: '40304361',
    price: 10,
    atendido: true,
    elegivelDescontoParticular: false,
    exameId: null,
  });

  it('conta as linhas de cada tabela pelo id; tabela sem linhas fica com zero', () => {
    const contagem = contarLinhasPorTabela([linha('a', 't1'), linha('b', 't1'), linha('c', 't2')]);
    expect(contagem.get('t1')).toBe(2);
    expect(contagem.get('t2')).toBe(1);
    expect(contagem.get('t3') ?? 0).toBe(0);
  });
});
