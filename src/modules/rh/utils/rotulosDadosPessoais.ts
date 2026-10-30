import type { CorRaca, DadosPessoais, EstadoCivil, Genero, Nacionalidade, UF } from '../types';

// Valores espelham os CHECKs de colaborador_dados_pessoais (20261030120000_rh_ficha_colaborador.sql).

export const NACIONALIDADE_LABEL: Record<Nacionalidade, string> = {
  brasileira: 'Brasileira',
  brasileira_naturalizada: 'Brasileira naturalizada',
  estrangeira: 'Estrangeira',
};

export const UFS: readonly UF[] = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA',
  'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
];

export const COR_RACA_LABEL: Record<CorRaca, string> = {
  branca: 'Branca',
  preta: 'Preta',
  parda: 'Parda',
  amarela: 'Amarela',
  indigena: 'Indígena',
  nao_declarar: 'Não declarar',
};

export const GENERO_LABEL: Record<Genero, string> = {
  masculino: 'Masculino',
  feminino: 'Feminino',
  nao_declarar: 'Não declarar',
};

export const ESTADO_CIVIL_LABEL: Record<EstadoCivil, string> = {
  solteiro: 'Solteiro(a)',
  casado: 'Casado(a)',
  uniao_estavel: 'União estável',
  divorciado: 'Divorciado(a)',
  separado: 'Separado(a)',
  viuvo: 'Viúvo(a)',
};

export const DADOS_PESSOAIS_VAZIOS: DadosPessoais = {
  nacionalidade: null,
  ufNascimento: null,
  cidadeNascimento: null,
  corRaca: null,
  genero: null,
  estadoCivil: null,
  dataNascimento: null,
  nomeMae: null,
  nomePai: null,
};

/** Rótulo de cada campo, na ordem em que aparece na tela. */
export const CAMPO_DADOS_PESSOAIS_LABEL: Record<keyof DadosPessoais, string> = {
  nacionalidade: 'Nacionalidade',
  ufNascimento: 'UF de nascimento',
  cidadeNascimento: 'Cidade de nascimento',
  corRaca: 'Cor/Raça',
  genero: 'Gênero',
  estadoCivil: 'Estado civil',
  dataNascimento: 'Data de nascimento',
  nomeMae: 'Nome da mãe',
  nomePai: 'Nome do pai',
};
