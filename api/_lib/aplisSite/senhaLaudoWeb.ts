// api/_lib/aplisSite/senhaLaudoWeb.ts
// Reset da senha de um usuário do Laudo Web de uma clínica, pelo site do apLIS
// (Cadastro → Instituição). Ver instituicaoForm.ts sobre o salvar que regrava o cadastro
// inteiro. Fluxo, numa sessão só:
//   1. relê o cadastro (instituicao-detail) e monta o corpo atual;
//   2. troca só o Pwd do usuário escolhido e grava (instituicao-ajax.salvar);
//   3. relê o cadastro e confere que o corpo é idêntico ao de antes (a senha não aparece
//      na tela, então qualquer diferença é efeito colateral e é devolvida como alerta).

import { SessaoAplisSite, ErroAplisSite } from './sessao.js';
import {
  lerFormularioInstituicao,
  corpoComSenhaNova,
  corpoParaForm,
  validarSenhaLaudoWeb,
  type FormularioInstituicao,
} from './instituicaoForm.js';

const DETAIL = '/areas/cadastro/instituicao-detail.php';
const AJAX = '/areas/cadastro/instituicao-ajax.php';
const AUTOCOMPLETE = '/areas/shared/autocomplete.php';

export interface ClinicaEncontrada {
  id: number;
  nome: string;
  razaoSocial: string;
}

/** Autocomplete da tela (`f=instituicao`): `[{id, value, razao}]`. */
export async function buscarClinicas(termo: string): Promise<ClinicaEncontrada[]> {
  return SessaoAplisSite.com(async (s) => {
    const resp = await s.get(AUTOCOMPLETE, { f: 'instituicao', term: termo });
    const lista = (await resp.json().catch(() => null)) as { id: number; value: string; razao?: string }[] | null;
    if (!Array.isArray(lista)) throw new ErroAplisSite('Resposta inesperada do autocomplete de instituição.');
    return lista.map((i) => ({ id: Number(i.id), nome: String(i.value ?? ''), razaoSocial: String(i.razao ?? '') }));
  });
}

async function lerCadastro(s: SessaoAplisSite, idInstituicao: string): Promise<FormularioInstituicao> {
  const resp = await s.post(DETAIL, null, { id: idInstituicao });
  const form = lerFormularioInstituicao(await resp.text());
  if (form.idInstituicao !== idInstituicao) throw new ErroAplisSite('O apLIS devolveu outra instituição.');
  return form;
}

export type ClinicaComUsuarios = Omit<FormularioInstituicao, 'corpo'>;

export async function lerClinica(idInstituicao: string): Promise<ClinicaComUsuarios> {
  return SessaoAplisSite.com(async (s) => {
    const { idInstituicao: id, nomeFantasia, razaoSocial, usuariosLaudoWeb, detalhes } = await lerCadastro(s, idInstituicao);
    return { idInstituicao: id, nomeFantasia, razaoSocial, usuariosLaudoWeb, detalhes };
  });
}

export interface ResultadoReset {
  usuario: string;
  nomeClinica: string;
  /** false = gravou, mas a releitura mostrou outra diferença no cadastro além da senha. */
  cadastroIntacto: boolean;
  diferencas: string[];
  /**
   * Login de conferência com o usuário e a senha nova, feito uma vez logo depois de gravar:
   * 'ok' entrou; 'falhou' o apLIS recusou (motivo); 'nao_conferido' não deu para tentar
   * (usuário não liberado no Laudo Web, ou erro de rede — motivo).
   */
  login: { status: 'ok' | 'falhou' | 'nao_conferido'; motivo: string };
}

export class SenhaRecusada extends Error {}

export async function resetarSenhaLaudoWeb(
  idInstituicao: string,
  idUsuario: string,
  senha: string,
): Promise<ResultadoReset> {
  const erroSenha = validarSenhaLaudoWeb(senha);
  if (erroSenha) throw new SenhaRecusada(erroSenha);

  const gravado = await SessaoAplisSite.com(async (s) => {
    const antes = await lerCadastro(s, idInstituicao);
    const usuario = antes.usuariosLaudoWeb.find((u) => u.id === idUsuario);
    if (!usuario) throw new SenhaRecusada('Usuário do Laudo Web não encontrado nesta clínica.');

    const corpo = corpoComSenhaNova(antes.corpo, idUsuario, senha);
    const resp = await s.post(AJAX, 'salvar', corpoParaForm(corpo));
    const r = (await resp.json().catch(() => null)) as { sucesso?: boolean; msg?: string } | null;
    if (!r) throw new ErroAplisSite('Resposta inesperada do apLIS ao salvar a instituição.');
    if (!r.sucesso) throw new SenhaRecusada(limparMsg(r.msg) || 'O apLIS recusou a alteração.');

    const depois = await lerCadastro(s, idInstituicao);
    const diferencas = compararCorpos(antes.corpo, depois.corpo);
    return {
      usuario: usuario.usuario,
      liberado: usuario.liberado,
      nomeClinica: antes.nomeFantasia,
      cadastroIntacto: diferencas.length === 0,
      diferencas,
    };
  });

  const { liberado, ...resto } = gravado;
  return { ...resto, login: await conferirLogin(gravado.usuario, senha, liberado) };
}

/** Uma tentativa só, depois que a sessão de serviço já saiu. Nunca lança: a senha já foi gravada. */
async function conferirLogin(usuario: string, senha: string, liberado: boolean): Promise<ResultadoReset['login']> {
  if (!liberado) return { status: 'nao_conferido', motivo: 'O usuário não está liberado no Laudo Web, então o login seria recusado.' };
  try {
    const r = await SessaoAplisSite.conferirLogin(usuario, senha);
    return r.ok ? { status: 'ok', motivo: '' } : { status: 'falhou', motivo: r.motivo };
  } catch (err) {
    return { status: 'nao_conferido', motivo: err instanceof Error ? err.message : 'Erro ao tentar o login.' };
  }
}

/** "Laudo Web -1Senha deve conter…" — o "-1" vem fixo do servidor. */
function limparMsg(msg: string | undefined): string {
  return (msg ?? '').replace(/^Laudo Web\s*-?\d*/, '').replace(/<[^>]+>/g, ' ').trim();
}

/** Chaves cujo valor mudou entre as duas leituras (sem valores: podem ter CPF). */
export function compararCorpos(
  a: FormularioInstituicao['corpo'],
  b: FormularioInstituicao['corpo'],
): string[] {
  const ma = new Map(corpoParaForm(a));
  const mb = new Map(corpoParaForm(b));
  const chaves = new Set([...ma.keys(), ...mb.keys()]);
  return [...chaves].filter((k) => ma.get(k) !== mb.get(k));
}
