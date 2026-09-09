import { describe, expect, it } from 'vitest';
import {
  construirMapaParceiros,
  extrairLinhasBrutas,
  identificarTipoAba,
  localizarCabecalho,
  resolverFonteTabela,
} from './migracaoPlanilhaLegada';

describe('identificarTipoAba', () => {
  it('reconhece as abas de referência/rascunho como excluídas', () => {
    expect(identificarTipoAba('Convenios aceitos')).toBe('excluida');
    expect(identificarTipoAba('Custo Alvaro')).toBe('excluida');
    expect(identificarTipoAba('TABELA REF')).toBe('excluida');
    expect(identificarTipoAba('PESQUISAR CUSTOS')).toBe('excluida');
  });

  it('reconhece GAMA (códigos AMB/92/CBHPM, cadastro manual)', () => {
    expect(identificarTipoAba('GAMA')).toBe('gama');
  });

  it('reconhece a ASSEFAZ antiga (com espaço sobrando no nome da aba) como descartada', () => {
    expect(identificarTipoAba('ASSEFAZ ')).toBe('assefaz-antiga');
  });

  it('não confunde ASSEFAZ REAJUSTE com a ASSEFAZ antiga', () => {
    expect(identificarTipoAba('ASSEFAZ REAJUSTE')).toBe('migrar');
  });

  it('qualquer outra aba de convênio é pra migrar', () => {
    expect(identificarTipoAba('AMH-AFFEGO')).toBe('migrar');
    expect(identificarTipoAba('PMDF')).toBe('migrar');
  });
});

describe('construirMapaParceiros', () => {
  const linhas = [
    [null, null, null],
    [null, null, 'Parceiro'],
    [1, 'AFFEGO', 'AMH'],
    [2, 'ASSEFAZ', null],
    [3, 'BACEN', 'AMH'],
  ];

  it('mapeia convênio → Parceiro (chave normalizada)', () => {
    const mapa = construirMapaParceiros(linhas);
    expect(mapa.get('AFFEGO')).toBe('AMH');
    expect(mapa.get('BACEN')).toBe('AMH');
  });

  it('convênio sem Parceiro cadastrado entra no mapa com null (não fica ausente)', () => {
    const mapa = construirMapaParceiros(linhas);
    expect(mapa.has('ASSEFAZ')).toBe(true);
    expect(mapa.get('ASSEFAZ')).toBeNull();
  });

  it('ignora linhas em branco (sem convênio na coluna 1)', () => {
    const mapa = construirMapaParceiros(linhas);
    expect(mapa.size).toBe(3);
  });
});

describe('resolverFonteTabela', () => {
  const parceiros = new Map<string, string | null>([
    ['AFFEGO', 'AMH'],
    ['BACEN', 'AMH'],
    ['CBMDF', null],
    ['ASSEFAZ', null],
  ]);

  it('aba no formato <Parceiro>-<Convênio>: usa o prefixo como Tabela Associada', () => {
    expect(resolverFonteTabela('AMH-AFFEGO', parceiros)).toEqual({
      fontePagadora: 'AFFEGO',
      tabelaAssociada: 'AMH',
    });
  });

  it('prefixo da aba vence a lista Convenios aceitos quando eles divergem', () => {
    // BACEN está listado com Parceiro "AMH", mas a aba usa "AMHP-BACEN" —
    // o prefixo da própria aba é a fonte da verdade nesse caso.
    expect(resolverFonteTabela('AMHP-BACEN', parceiros)).toEqual({
      fontePagadora: 'BACEN',
      tabelaAssociada: 'AMHP',
    });
  });

  it('aba sem hífen com Parceiro cadastrado: Tabela Associada vem de Convenios aceitos', () => {
    expect(resolverFonteTabela('AFFEGO', parceiros)).toEqual({
      fontePagadora: 'AFFEGO',
      tabelaAssociada: 'AMH',
    });
  });

  it('aba sem hífen e sem Parceiro cadastrado: Tabela Associada repete a fonte pagadora', () => {
    expect(resolverFonteTabela('CBMDF', parceiros)).toEqual({
      fontePagadora: 'CBMDF',
      tabelaAssociada: 'CBMDF',
    });
  });

  it('aba não encontrada em Convenios aceitos: Tabela Associada repete a fonte pagadora', () => {
    expect(resolverFonteTabela('AMPLA', parceiros)).toEqual({
      fontePagadora: 'AMPLA',
      tabelaAssociada: 'AMPLA',
    });
  });

  it('ASSEFAZ REAJUSTE migra como fonte pagadora "ASSEFAZ"', () => {
    expect(resolverFonteTabela('ASSEFAZ REAJUSTE', parceiros)).toEqual({
      fontePagadora: 'ASSEFAZ',
      tabelaAssociada: 'ASSEFAZ',
    });
  });
});

describe('localizarCabecalho', () => {
  it('acha o cabeçalho padrão (com linha em branco antes)', () => {
    const linhas = [
      [null, null, null, null, null, null, null],
      ['Codigo TUSS', 'Nome do Exame', 'Valor convênio', 'Custo Alvaro', 'Convenio x Alvaro', '%CSP', 'OBS'],
      ['40305015', 'Exame X', '73,84', 46.5, 27.34, 0.63, null],
    ];
    expect(localizarCabecalho(linhas)).toEqual({ headerIdx: 1, tussCol: 0, nomeCol: 1, valorCol: 2, atendidoCol: 6 });
  });

  it('acha o cabeçalho quando não há linha em branco antes (AMHP-BACEN)', () => {
    const linhas = [
      ['Codigo TUSS', 'Nome do Exame', 'Valor convênio', 'Custo Alvaro', 'Convenio x Alvaro', '%CSP', 'OBS'],
      [40310140, 'Cultura para fungos', 31.9, 29.04, 2.86, 0.91, null],
    ];
    expect(localizarCabecalho(linhas)).toEqual({ headerIdx: 0, tussCol: 0, nomeCol: 1, valorCol: 2, atendidoCol: 6 });
  });

  it('acha o cabeçalho num layout diferente (FASCAL: só 3 colunas, com acento)', () => {
    const linhas = [
      ['CÓDIGO', 'DESCRIÇÃO', 'VALOR FINAL'],
      [40301010, '3-metil histidina, dosagem no soro', 'R$  46,22'],
    ];
    expect(localizarCabecalho(linhas)).toEqual({ headerIdx: 0, tussCol: 0, nomeCol: 1, valorCol: 2, atendidoCol: -1 });
  });

  it('reconhece "Atendemos" (PMDF) como coluna de atendido', () => {
    const linhas = [
      [null, null, null, null, null, null, null],
      ['Codigo TUSS', 'Nome do Exame', 'Valor convênio', 'Custo Alvaro', 'Convenio x Alvaro', '%CSP', 'Atendemos'],
      ['40322386', 'Exame Y', 317.36, 9365.64, -9048.28, 29.51, 'Não atendemos'],
    ];
    expect(localizarCabecalho(linhas)?.atendidoCol).toBe(6);
  });

  it('retorna null quando não acha coluna de TUSS/código e valor juntas (GAMA)', () => {
    const linhas = [
      ['AMB/92', 'CBHPM 5º', 'DESCRIÇÃO', 'VALOR'],
      [28010027, 40301060, 'ACIDO ASCORBICO', 7.7],
    ];
    expect(localizarCabecalho(linhas)).toBeNull();
  });
});

describe('extrairLinhasBrutas', () => {
  const colunas = { headerIdx: 1, tussCol: 0, nomeCol: 1, valorCol: 2, atendidoCol: 6 };

  it('extrai as linhas de dados após o cabeçalho', () => {
    const linhas = [
      [null],
      ['Codigo TUSS', 'Nome do Exame', 'Valor convênio', null, null, null, 'OBS'],
      ['40305015', 'Exame X', '73,84', null, null, null, null],
      ['40305740', 'Exame Y', 60.77, null, null, null, 'Não atendemos pelo Plano'],
    ];
    expect(extrairLinhasBrutas(linhas, colunas)).toEqual([
      { tuss: '40305015', nomeExame: 'Exame X', valor: '73,84', atendido: null },
      { tuss: '40305740', nomeExame: 'Exame Y', valor: 60.77, atendido: 'Não atendemos pelo Plano' },
    ]);
  });

  it('ignora linhas em branco (TUSS vazio/nulo) — sobra de fórmula arrastada', () => {
    const linhas = [
      [null],
      ['Codigo TUSS', 'Nome do Exame', 'Valor convênio', null, null, null, 'OBS'],
      ['40305015', 'Exame X', 73.84, null, null, null, null],
      [null, null, null, null, null, null, null],
      ['', null, null, null, null, null, null],
    ];
    expect(extrairLinhasBrutas(linhas, colunas)).toEqual([
      { tuss: '40305015', nomeExame: 'Exame X', valor: 73.84, atendido: null },
    ]);
  });

  it('coluna de nome/atendido ausente (aba sem essas colunas) vira null', () => {
    const semNomeSemAtendido = { headerIdx: 0, tussCol: 0, nomeCol: -1, valorCol: 2, atendidoCol: -1 };
    const linhas = [
      ['CÓDIGO', 'DESCRIÇÃO', 'VALOR FINAL'],
      [40301010, '3-metil histidina, dosagem no soro', 'R$  46,22'],
    ];
    expect(extrairLinhasBrutas(linhas, semNomeSemAtendido)).toEqual([
      { tuss: 40301010, nomeExame: null, valor: 'R$  46,22', atendido: null },
    ]);
  });
});
