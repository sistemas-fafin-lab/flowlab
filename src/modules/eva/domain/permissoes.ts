// Regras da aba Permissões (D33), puras para testar sem tela. As mesmas travas das RPCs
// ti_agente_definir_papeis e ti_agente_voltar_ao_cargo, para o botão já nascer desabilitado.
import type { OrigemPapeis, PapeisEva } from './papeis';

export const PAPEIS_EVA: { chave: keyof PapeisEva; rotulo: string; texto: string }[] = [
  { chave: 'configura', rotulo: 'Configura', texto: 'Abas Membros, Permissões e Configurações; liga e desliga a EVA.' },
  { chave: 'gestor', rotulo: 'Gestor', texto: 'Cobra a equipe, avisa o grupo e as pessoas, vê a fila do WhatsApp.' },
  { chave: 'aprova', rotulo: 'Aprova', texto: 'Aprova e rejeita as sugestões, na tela e pelo WhatsApp.' },
];

interface PessoaComPapeis {
  id: string;
  origem: OrigemPapeis;
  papeis: PapeisEva;
  doCargo: PapeisEva;
}

export const temAlgum = (p: PapeisEva): boolean => p.configura || p.gestor || p.aprova;

/** "Configura, Aprova", ou "nenhuma". */
export const resumoPapeis = (p: PapeisEva): string =>
  PAPEIS_EVA.filter((x) => p[x.chave]).map((x) => x.rotulo).join(', ') || 'nenhuma';

/**
 * Quem a aba lista: quem tem alguma permissão, quem está definido aqui (mesmo sem nenhuma) e o
 * admin; antes de todos, quem acabou de ser escolhido em "Dar permissão a…", o mais recente primeiro.
 */
export function quemAparece<T extends PessoaComPapeis>(pessoas: readonly T[], adicionados: readonly string[]): T[] {
  const porId = new Map(pessoas.map((p) => [p.id, p]));
  const novos = [...adicionados].reverse().map((id) => porId.get(id)).filter((p): p is T => !!p);
  const jaNovos = new Set(novos.map((p) => p.id));
  const resto = pessoas.filter((p) => !jaNovos.has(p.id) && (p.origem !== 'cargo' || temAlgum(p.papeis)));
  return [...novos, ...resto];
}

/** Se a chave pode ser alternada, e o porquê quando não. */
export function travaDaChave(p: PessoaComPapeis, chave: keyof PapeisEva, euId: string | null | undefined): string | null {
  if (p.origem === 'admin') return 'O administrador tem as três, sempre.';
  if (p.origem === 'inativo') return 'Usuário inativo no FlowLab.';
  if (chave === 'configura' && p.id === euId && p.papeis.configura) return 'Você não pode tirar a sua própria permissão de configurar.';
  return null;
}

/** Se "Voltar ao cargo" pode ser usado, e o porquê quando não. */
export function travaDoVoltar(p: PessoaComPapeis, euId: string | null | undefined): string | null {
  if (p.origem !== 'definido') return 'Já segue o cargo.';
  if (p.id === euId && !p.doCargo.configura) return 'Pelo seu cargo você não configura a EVA: voltar ao cargo tiraria o seu acesso a esta tela.';
  return null;
}
