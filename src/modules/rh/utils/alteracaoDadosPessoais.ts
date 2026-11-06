import type { AlteracaoCampo, DadosPessoais } from '../types';

/** Coluna de colaborador_dados_pessoais de cada campo — é o `campo` enviado à RPC. */
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

export const CAMPOS_DADOS_PESSOAIS = Object.keys(COLUNA_DADOS_PESSOAIS) as (keyof DadosPessoais)[];

const normalizar = (valor: string | null | undefined): string | null => valor?.trim() || null;

/**
 * Campos que mudaram, na ordem da tela. Texto é comparado sem espaços nas
 * pontas e vazio vale null — mesma regra da RPC rh_atualizar_meus_dados_pessoais,
 * que continua sendo a fonte da verdade (e recalcula o `de`).
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
