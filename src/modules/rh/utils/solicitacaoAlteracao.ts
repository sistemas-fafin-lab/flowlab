import type { AlteracaoCampo, DadosPessoais } from '../types';
import { formatDataBR } from './colaboradorFormato';
import {
  CAMPO_DADOS_PESSOAIS_LABEL,
  COR_RACA_LABEL,
  ESTADO_CIVIL_LABEL,
  GENERO_LABEL,
  NACIONALIDADE_LABEL,
} from './rotulosDadosPessoais';

/** Coluna de colaborador_dados_pessoais de cada campo — é o `campo` gravado em `alteracoes`. */
export const COLUNA_DADOS_PESSOAIS: Record<keyof DadosPessoais, string> = {
  nacionalidade: 'nacionalidade',
  ufNascimento: 'uf_nascimento',
  cidadeNascimento: 'cidade_nascimento',
  corRaca: 'cor_raca',
  genero: 'genero',
  estadoCivil: 'estado_civil',
  dataNascimento: 'data_nascimento',
  nomeMae: 'nome_mae',
  nomePai: 'nome_pai',
};

const CAMPO_POR_COLUNA = Object.fromEntries(
  Object.entries(COLUNA_DADOS_PESSOAIS).map(([campo, coluna]) => [coluna, campo]),
) as Record<string, keyof DadosPessoais>;

export const CAMPOS_DADOS_PESSOAIS = Object.keys(COLUNA_DADOS_PESSOAIS) as (keyof DadosPessoais)[];

const normalizar = (valor: string | null | undefined): string | null => valor?.trim() || null;

/**
 * Campos que mudaram, na ordem da tela. Texto é comparado sem espaços nas
 * pontas e vazio vale null — mesma regra da RPC rh_solicitar_alteracao, que
 * continua sendo a fonte da verdade (e recalcula o `de`).
 */
export const calcularAlteracoes = (atuais: DadosPessoais, editados: DadosPessoais): AlteracaoCampo[] =>
  CAMPOS_DADOS_PESSOAIS.flatMap((campo) => {
    const de = normalizar(atuais[campo]);
    const para = normalizar(editados[campo]);
    return de === para ? [] : [{ campo, de, para }];
  });

/** Payload da RPC: `campo` com o nome da coluna. */
export const alteracoesParaRpc = (alteracoes: AlteracaoCampo[]) =>
  alteracoes.map(({ campo, para }) => ({ campo: COLUNA_DADOS_PESSOAIS[campo], para }));

/** Lê `alteracoes` vindas do banco (coluna -> campo); itens desconhecidos são ignorados. */
export const alteracoesDoBanco = (bruto: unknown): AlteracaoCampo[] =>
  Array.isArray(bruto)
    ? bruto.flatMap((item) => {
        const campo = CAMPO_POR_COLUNA[(item as { campo?: string })?.campo ?? ''];
        if (!campo) return [];
        const { de = null, para = null } = item as { de?: string | null; para?: string | null };
        return [{ campo, de, para }];
      })
    : [];

/** Valor legível de um campo ("casado" -> "Casado(a)", data -> dd/mm/aaaa); null -> "Não informado". */
export const formatarValorCampo = (campo: keyof DadosPessoais, valor: string | null): string => {
  if (!valor) return 'Não informado';
  switch (campo) {
    case 'nacionalidade':
      return NACIONALIDADE_LABEL[valor as keyof typeof NACIONALIDADE_LABEL] ?? valor;
    case 'corRaca':
      return COR_RACA_LABEL[valor as keyof typeof COR_RACA_LABEL] ?? valor;
    case 'genero':
      return GENERO_LABEL[valor as keyof typeof GENERO_LABEL] ?? valor;
    case 'estadoCivil':
      return ESTADO_CIVIL_LABEL[valor as keyof typeof ESTADO_CIVIL_LABEL] ?? valor;
    case 'dataNascimento':
      return formatDataBR(valor) ?? valor;
    default:
      return valor;
  }
};

/** "Estado civil: Solteiro(a) → Casado(a)" */
export const descreverAlteracao = ({ campo, de, para }: AlteracaoCampo): string =>
  `${CAMPO_DADOS_PESSOAIS_LABEL[campo]}: ${formatarValorCampo(campo, de)} → ${formatarValorCampo(campo, para)}`;
