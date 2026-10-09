import { describe, expect, it } from 'vitest';
import {
  FILTROS_VAZIOS,
  chaveTexto,
  custoRecorrenteMensal,
  filtrarLinhas,
  montarLinhas,
  nomesDistintos,
  ordenarLinhas,
} from './listaDespesas';
import type { Despesa } from '../types';

const HOJE = '2026-10-15';

const despesa = (campos: Partial<Despesa>): Despesa => ({
  id: 'x',
  descricao: 'Despesa',
  categoriaId: 'cat-saas',
  natureza: 'opex',
  quantidade: null,
  unidade: null,
  fornecedorId: null,
  fornecedorNome: 'Fornecedor',
  setor: null,
  responsavelId: null,
  responsavelNome: null,
  tipoValor: 'fixo',
  valorBase: 100,
  recorrencia: 'mensal',
  competenciaInicio: '2026-01-01',
  competenciaFim: null,
  diaVencimento: 10,
  formaPagamento: 'pix',
  meioPagamentoDetalhe: null,
  moedaOriginal: null,
  valorOriginal: null,
  numeroContrato: null,
  renovacaoAutomatica: false,
  avisoRenovacaoDias: 30,
  autorizadoPor: 'Diretoria',
  autorizadoEm: null,
  observacoes: null,
  anexos: [],
  reajustes: [],
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  ...campos,
});

const despesas = [
  despesa({ id: 'm365', descricao: 'Microsoft 365', fornecedorNome: 'Microsoft', valorBase: 2480, setor: 'TI', numeroContrato: 'CT-77' }),
  despesa({ id: 'aws', descricao: 'AWS', fornecedorNome: 'Amazon', valorBase: 3200, tipoValor: 'variavel', categoriaId: 'cat-cloud', formaPagamento: 'cartao_corporativo' }),
  despesa({ id: 'dominio', descricao: 'Domínio flowlab.com.br', fornecedorNome: 'Registro.br', valorBase: 120, recorrencia: 'anual', competenciaInicio: '2026-03-01', autorizadoPor: 'Gerência de TI' }),
  despesa({ id: 'notebook', descricao: 'Notebook Dell', fornecedorNome: 'Dell', valorBase: 7000, recorrencia: 'unica', competenciaInicio: '2026-05-01', natureza: 'capex' }),
  despesa({ id: 'claude', descricao: 'Claude Team', fornecedorNome: 'Anthropic', valorBase: 1500, categoriaId: 'cat-ia', competenciaInicio: '2026-12-01' }),
];

const linhas = montarLinhas(despesas, HOJE);
const linha = (id: string) => linhas.find((l) => l.despesa.id === id)!;

describe('montarLinhas', () => {
  it('calcula valor vigente, equivalente mensal, próxima ocorrência e situação', () => {
    expect(linha('m365')).toMatchObject({ valorVigente: 2480, equivalenteMensal: 2480, situacao: 'ativa' });
    expect(linha('m365').proxima?.vencimento).toBe('2026-11-10'); // a de outubro venceu dia 10
    expect(linha('dominio').equivalenteMensal).toBe(10);
    expect(linha('dominio').proxima?.competencia).toBe('2027-03-01');
    expect(linha('notebook')).toMatchObject({ equivalenteMensal: null, situacao: 'encerrada', proxima: null });
    expect(linha('claude').situacao).toBe('futura');
  });
});

describe('filtrarLinhas', () => {
  const ids = (filtros: Partial<typeof FILTROS_VAZIOS>) =>
    filtrarLinhas(linhas, { ...FILTROS_VAZIOS, ...filtros }).map((l) => l.despesa.id);

  it('sem filtro devolve tudo', () => {
    expect(ids({})).toHaveLength(5);
  });

  it('busca em descrição, fornecedor, contrato e autorizador, sem acento nem maiúsculas', () => {
    expect(ids({ busca: 'dominio' })).toEqual(['dominio']);
    expect(ids({ busca: 'AMAZON' })).toEqual(['aws']);
    expect(ids({ busca: 'ct-77' })).toEqual(['m365']);
    expect(ids({ busca: 'gerencia' })).toEqual(['dominio']);
  });

  it('filtra por categoria, situação, recorrência, forma de pagamento e setor', () => {
    expect(ids({ categoriaId: 'cat-ia' })).toEqual(['claude']);
    expect(ids({ situacao: 'encerrada' })).toEqual(['notebook']);
    expect(ids({ recorrencia: 'anual' })).toEqual(['dominio']);
    expect(ids({ formaPagamento: 'cartao_corporativo' })).toEqual(['aws']);
    expect(ids({ setor: 'TI' })).toEqual(['m365']);
  });

  it('fornecedor e autorizador comparam o nome sem diferenciar maiúsculas e acentos', () => {
    expect(ids({ fornecedor: 'registro.BR' })).toEqual(['dominio']);
    expect(ids({ autorizadoPor: 'gerencia de ti' })).toEqual(['dominio']);
  });

  it('combina filtros', () => {
    expect(ids({ situacao: 'ativa', categoriaId: 'cat-saas' })).toEqual(['m365', 'dominio']);
  });
});

describe('ordenarLinhas', () => {
  const nomeCategoria = (id: string) => ({ 'cat-ia': 'Inteligência Artificial', 'cat-saas': 'SaaS', 'cat-cloud': 'Cloud' })[id] ?? '';

  it('por valor, do maior para o menor', () => {
    expect(ordenarLinhas(linhas, 'valor', 'desc', nomeCategoria).map((l) => l.despesa.id)).toEqual([
      'notebook',
      'aws',
      'm365',
      'claude',
      'dominio',
    ]);
  });

  it('equivalente mensal vazio (despesa única) vai para o fim nas duas direções', () => {
    const ultimo = (direcao: 'asc' | 'desc') => {
      const ordenadas = ordenarLinhas(linhas, 'equivalente', direcao, nomeCategoria);
      return ordenadas[ordenadas.length - 1].despesa.id;
    };
    expect(ultimo('asc')).toBe('notebook');
    expect(ultimo('desc')).toBe('notebook');
  });

  it('por categoria usa o nome, não o id', () => {
    expect(ordenarLinhas(linhas, 'categoria', 'asc', nomeCategoria)[0].despesa.id).toBe('aws');
  });

  it('não altera o array recebido', () => {
    const antes = linhas.map((l) => l.despesa.id);
    ordenarLinhas(linhas, 'descricao', 'desc', nomeCategoria);
    expect(linhas.map((l) => l.despesa.id)).toEqual(antes);
  });
});

describe('custoRecorrenteMensal', () => {
  it('soma os equivalentes das ativas: sem única, sem futura', () => {
    // m365 2480 + aws 3200 + domínio 120/12 = 5690
    expect(custoRecorrenteMensal(linhas)).toBeCloseTo(5690, 2);
  });
});

describe('nomesDistintos', () => {
  it('junta grafias iguais ignorando maiúsculas, acentos e espaços, e ordena', () => {
    expect(nomesDistintos(['Diretoria', ' diretoria ', 'Gerência de TI', 'gerencia  de ti', '', null, 'Ana'])).toEqual([
      'Ana',
      'Diretoria',
      'Gerência de TI',
    ]);
  });

  it('chaveTexto normaliza para comparação', () => {
    expect(chaveTexto('  Gerência   de TI ')).toBe('gerencia de ti');
  });
});
