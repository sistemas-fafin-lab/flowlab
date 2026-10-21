import { describe, expect, it } from 'vitest';
import type { TabelaAssociada } from '../../../hooks/useCostControl';
import { erroNomeNovaTabela, opcoesDeTabela, tabelaEscolhidaDaFonte, tabelasDaFonte } from './tabelasAssociadas';

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

describe('erroNomeNovaTabela', () => {
  const daFonte = [tabela('1', 'Particular', 'Part'), tabela('2', 'Particular', 'Campanha 2025', false)];

  it('aceita um nome que a fonte ainda não tem', () => {
    expect(erroNomeNovaTabela('PROASA', daFonte)).toBeNull();
  });

  it('recusa nome em branco', () => {
    expect(erroNomeNovaTabela('   ', daFonte)).toBe('Informe o nome da tabela.');
  });

  it('recusa nome que a fonte já tem, mesmo com outras maiúsculas e espaços nas pontas', () => {
    expect(erroNomeNovaTabela('  PART ', daFonte)).toBe('Já existe a tabela "Part" nesta fonte pagadora.');
  });

  it('recusa também o nome de uma tabela inativa, avisando que ela está inativa', () => {
    expect(erroNomeNovaTabela('campanha 2025', daFonte)).toBe(
      'Já existe a tabela "Campanha 2025" nesta fonte pagadora (inativa).'
    );
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
