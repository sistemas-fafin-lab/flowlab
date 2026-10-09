import { describe, expect, it } from 'vitest';
import {
  COLUNAS_MODELO,
  PREFIXO_CATEGORIA_NOVA,
  analisarPlanilha,
  categoriasDesconhecidas,
  dataDoSerialExcel,
  lerCompetencia,
  lerData,
  mapearCabecalhos,
  type ContextoImportacao,
} from './importacao';

const contexto: ContextoImportacao = {
  hoje: '2026-10-15',
  categorias: [
    { id: 'cat-ia', nome: 'Inteligência Artificial', ativo: true, naturezaPadrao: 'opex' },
    { id: 'cat-hw', nome: 'Hardware e Equipamentos', ativo: true, naturezaPadrao: 'capex' },
    { id: 'cat-velha', nome: 'Legado', ativo: false, naturezaPadrao: 'opex' },
  ],
  fornecedores: [
    { id: 'f-ms', nome: 'Microsoft', cnpj: '04712500000107' },
    { id: 'f-dell', nome: 'Dell Computadores', cnpj: null },
  ],
  despesasExistentes: [{ descricao: 'Copilot', fornecedorNome: 'Microsoft', competenciaInicio: '2026-10-01' }],
  setores: ['TI', 'Financeiro'],
};

const cabecalhos = COLUNAS_MODELO.map((c) => c.cabecalho);
const { mapa } = mapearCabecalhos(cabecalhos);

const linha = (campos: Record<string, unknown>): Record<string, unknown> => ({
  'Descrição': 'Claude Team',
  Categoria: 'Inteligência Artificial',
  Fornecedor: 'Anthropic',
  'CNPJ do fornecedor': '',
  Valor: '1.500,00',
  'Tipo de valor': '',
  'Recorrência': 'Mensal',
  'Início': '10/2026',
  Fim: '',
  'Dia de vencimento': 10,
  'Forma de pagamento': 'Cartão corporativo',
  'Detalhe do pagamento': '',
  'Autorizado por': 'Diretoria',
  'Data da autorização': '',
  Setor: '',
  Natureza: '',
  Quantidade: '',
  Unidade: '',
  'Nº do contrato': '',
  'Renovação automática': '',
  'Aviso de renovação (dias)': '',
  'Moeda original': '',
  'Valor original': '',
  'Observações': '',
  ...campos,
});

const analisar = (linhas: Record<string, unknown>[], criarCategorias = false) =>
  analisarPlanilha(linhas, mapa, contexto, { criarCategorias });

describe('mapearCabecalhos', () => {
  it('casa os 24 cabeçalhos do modelo', () => {
    expect(mapa.size).toBe(24);
    expect(mapearCabecalhos(cabecalhos).faltando).toEqual([]);
  });

  it('aceita cabeçalho sem acento, em maiúsculas, com * e espaços', () => {
    const r = mapearCabecalhos(['DESCRICAO*', ' categoria ', 'fornecedor', 'VALOR', 'recorrencia', 'inicio', 'dia de vencimento', 'forma de pagamento', 'autorizado por']);
    expect(r.faltando).toEqual([]);
    expect(r.mapa.get('descricao')).toBe('DESCRICAO*');
  });

  it('lista as colunas obrigatórias que faltam', () => {
    expect(mapearCabecalhos(['Descrição', 'Categoria']).faltando).toContain('Autorizado por');
  });
});

describe('leitura de células', () => {
  it('competência em vários formatos', () => {
    expect(lerCompetencia('10/2026')).toBe('2026-10-01');
    expect(lerCompetencia('1-2027')).toBe('2027-01-01');
    expect(lerCompetencia('out/2026')).toBe('2026-10-01');
    expect(lerCompetencia('Outubro de 2026')).toBe('2026-10-01');
    expect(lerCompetencia('MARÇO/2027')).toBe('2027-03-01');
    expect(lerCompetencia('15/10/2026')).toBe('2026-10-01');
    expect(lerCompetencia('2026-10-15')).toBe('2026-10-01');
    expect(lerCompetencia(46310)).toBe('2026-10-01'); // serial do Excel para 15/10/2026
    expect(lerCompetencia('13/2026')).toBeNull();
    expect(lerCompetencia('xyz/2026')).toBeNull();
  });

  it('data serial do Excel e datas em texto', () => {
    expect(dataDoSerialExcel(46310)).toBe('2026-10-15');
    expect(lerData('5/1/2026')).toBe('2026-01-05');
    expect(lerData('2026-01-05')).toBe('2026-01-05');
    expect(lerData('ontem')).toBeNull();
  });
});

describe('analisarPlanilha', () => {
  it('linha completa vira despesa normalizada', () => {
    const [r] = analisar([linha({})]);
    expect(r.erros).toEqual([]);
    expect(r.numero).toBe(2);
    expect(r.despesa).toMatchObject({
      descricao: 'Claude Team',
      categoriaId: 'cat-ia',
      natureza: 'opex',
      valorBase: 1500,
      recorrencia: 'mensal',
      competenciaInicio: '2026-10-01',
      diaVencimento: 10,
      formaPagamento: 'cartao_corporativo',
      tipoValor: 'fixo',
      avisoRenovacaoDias: 30,
      renovacaoAutomatica: false,
    });
    expect(r.avisos).toContain('Fornecedor não cadastrado: a despesa guarda só o nome.');
  });

  it('valor em vários formatos e número do Excel', () => {
    for (const [entrada, esperado] of [['2480', 2480], ['2480,00', 2480], ['2.480,00', 2480], [2480.5, 2480.5]] as const) {
      expect(analisar([linha({ Valor: entrada })])[0].despesa?.valorBase).toBe(esperado);
    }
  });

  it('categoria desconhecida: erro sem a opção, categoria nova com a opção', () => {
    const sem = analisar([linha({ Categoria: 'Segurança' })])[0];
    expect(sem.despesa).toBeNull();
    expect(sem.erros.join()).toMatch(/Segurança" não existe/);
    const com = analisar([linha({ Categoria: 'Segurança' })], true)[0];
    expect(com.erros).toEqual([]);
    expect(com.categoriaNova).toBe('Segurança');
    expect(com.despesa?.categoriaId).toBe(`${PREFIXO_CATEGORIA_NOVA}seguranca`);
  });

  it('categoria casa sem acento e sem maiúsculas; desativada é erro; natureza vem da categoria', () => {
    expect(analisar([linha({ Categoria: 'inteligencia artificial' })])[0].despesa?.categoriaId).toBe('cat-ia');
    expect(analisar([linha({ Categoria: 'Legado' })])[0].erros.join()).toMatch(/desativada/);
    expect(analisar([linha({ Categoria: 'Hardware e Equipamentos' })])[0].despesa?.natureza).toBe('capex');
    expect(analisar([linha({ Categoria: 'Hardware e Equipamentos', Natureza: 'OPEX' })])[0].despesa?.natureza).toBe('opex');
  });

  it('fornecedor casa por CNPJ antes do nome, e pelo nome sem acento', () => {
    const porCnpj = analisar([linha({ Fornecedor: 'MS Brasil', 'CNPJ do fornecedor': '04.712.500/0001-07' })])[0];
    expect(porCnpj.despesa).toMatchObject({ fornecedorId: 'f-ms', fornecedorNome: 'Microsoft' });
    expect(porCnpj.avisos).toEqual([]);
    const porNome = analisar([linha({ Fornecedor: 'DELL computadores' })])[0];
    expect(porNome.despesa?.fornecedorId).toBe('f-dell');
  });

  it('linha repetida na planilha e despesa que já existe geram aviso; a que já existe é marcada', () => {
    const r = analisar([linha({}), linha({}), linha({ 'Descrição': 'Copilot', Fornecedor: 'Microsoft' })]);
    expect(r[1].avisos.join()).toMatch(/Repetida na planilha \(linha 2\)/);
    expect(r[2].jaExiste).toBe(true);
    expect(r[2].avisos.join()).toMatch(/já estar cadastrada/);
    expect(r[0].jaExiste).toBe(false);
  });

  it('recorrência Única com Fim preenchido: Fim ignorado com aviso', () => {
    const [r] = analisar([linha({ 'Recorrência': 'Única', Fim: '12/2026' })]);
    expect(r.erros).toEqual([]);
    expect(r.despesa?.competenciaFim).toBeNull();
    expect(r.avisos).toContain('Fim ignorado: a recorrência é Única.');
  });

  it('erros por campo, com o nome da coluna', () => {
    const [r] = analisar([
      linha({
        'Recorrência': 'Mensalmente',
        'Forma de pagamento': 'Caju',
        Valor: 'abc',
        'Início': 'amanhã',
        'Dia de vencimento': 40,
        Setor: 'Marte',
        'Renovação automática': 'talvez',
        'Data da autorização': '01/01/2030',
        'Autorizado por': '',
      }),
    ]);
    const mensagens = r.erros.join(' | ');
    expect(r.despesa).toBeNull();
    expect(mensagens).toMatch(/Recorrência: "Mensalmente" não reconhecido/);
    expect(mensagens).toMatch(/Forma de pagamento: "Caju" não reconhecido/);
    expect(mensagens).toMatch(/Valor: "abc" não é um valor/);
    expect(mensagens).toMatch(/Início: "amanhã" não é um mês/);
    expect(mensagens).toMatch(/Dia de vencimento: O dia do vencimento vai de 1 a 31/);
    expect(mensagens).toMatch(/Setor: "Marte"/);
    expect(mensagens).toMatch(/Renovação automática: use Sim ou Não/);
    expect(mensagens).toMatch(/Data da autorização: A data da autorização não pode ser futura/);
    expect(mensagens).toMatch(/Autorizado por: Informe quem autorizou/);
  });

  it('linha com erro não impede as outras; linha vazia é ignorada', () => {
    const vazia = Object.fromEntries(cabecalhos.map((c) => [c, '']));
    const r = analisar([linha({ Valor: 'abc' }), vazia, linha({ 'Descrição': 'Outra' })]);
    expect(r).toHaveLength(2);
    expect(r[0].despesa).toBeNull();
    expect(r[1].despesa).not.toBeNull();
    expect(r[1].numero).toBe(4);
  });

  it('opcionais: setor, sim/não, quantidade, moeda e data de autorização', () => {
    const [r] = analisar([
      linha({ Setor: 'ti', 'Renovação automática': 'Sim', Quantidade: '40', Unidade: 'licenças', 'Moeda original': 'usd', 'Valor original': '30', 'Data da autorização': '05/10/2026' }),
    ]);
    expect(r.despesa).toMatchObject({ setor: 'TI', renovacaoAutomatica: true, quantidade: 40, unidade: 'licenças', moedaOriginal: 'USD', valorOriginal: 30, autorizadoEm: '2026-10-05' });
  });
});

describe('categoriasDesconhecidas', () => {
  it('lista os nomes novos uma vez cada, na grafia da primeira linha', () => {
    const linhas = [linha({ Categoria: 'Segurança' }), linha({ Categoria: 'SEGURANCA' }), linha({ Categoria: 'Inteligência Artificial' }), linha({ Categoria: 'Backup' })];
    expect(categoriasDesconhecidas(linhas, mapa, contexto.categorias)).toEqual(['Segurança', 'Backup']);
  });
});
