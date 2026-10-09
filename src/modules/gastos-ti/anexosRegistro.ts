// Anexos guardados no jsonb `anexos` de um registro (despesa ou lançamento):
// sobe para o storage e vincula, ou desvincula e apaga. Compartilhado pelos
// hooks de despesas e de lançamentos.

import { supabase } from '../../lib/supabase';
import { enviarArquivos, removerArquivos } from './storage';
import type { Anexo } from './types';

/** Formato do jsonb `anexos` no banco (snake_case, como as colunas). */
export interface AnexoRow {
  path: string;
  nome: string;
  tamanho: number;
  tipo: string;
  enviado_em: string;
}

export const mapAnexo = (a: AnexoRow): Anexo => ({
  path: a.path,
  nome: a.nome,
  tamanho: a.tamanho,
  tipo: a.tipo,
  enviadoEm: a.enviado_em,
});

const paraAnexoRow = (a: Anexo): AnexoRow => ({
  path: a.path,
  nome: a.nome,
  tamanho: a.tamanho,
  tipo: a.tipo,
  enviado_em: a.enviadoEm,
});

type TabelaComAnexos = 'ti_despesas' | 'ti_lancamentos';

const PREFIXO: Record<TabelaComAnexos, 'despesas' | 'lancamentos'> = {
  ti_despesas: 'despesas',
  ti_lancamentos: 'lancamentos',
};

/**
 * Relê a lista do banco imediatamente antes de gravar (e não a do estado da
 * tela), para dois usuários anexando ao mesmo tempo não apagarem o arquivo um
 * do outro.
 */
async function anexosAtuais(tabela: TabelaComAnexos, id: string): Promise<AnexoRow[] | null> {
  const { data, error } = await supabase.from(tabela).select('anexos').eq('id', id).single();
  if (error) return null;
  return (data as { anexos: AnexoRow[] | null }).anexos ?? [];
}

/** Sobe os arquivos e acrescenta ao registro. Devolve a mensagem do que não subiu, ou null. */
export async function adicionarAnexosAoRegistro(tabela: TabelaComAnexos, id: string, arquivos: File[]): Promise<string | null> {
  const { enviados, erros } = await enviarArquivos(PREFIXO[tabela], id, arquivos);
  if (enviados.length > 0) {
    const atuais = await anexosAtuais(tabela, id);
    const gravou =
      atuais !== null &&
      !(await supabase.from(tabela).update({ anexos: [...atuais, ...enviados.map(paraAnexoRow)] }).eq('id', id)).error;
    if (!gravou) {
      // O registro não aponta para eles: não deixa arquivo órfão no bucket.
      await removerArquivos(enviados.map((a) => a.path));
      return 'Os arquivos subiram, mas não foi possível vinculá-los ao registro. Tente de novo.';
    }
  }
  return erros.length > 0 ? erros.join(' ') : null;
}

/** Tira o arquivo do registro e só então apaga do bucket. */
export async function removerAnexoDoRegistro(tabela: TabelaComAnexos, id: string, path: string): Promise<string | null> {
  const atuais = await anexosAtuais(tabela, id);
  if (atuais === null) return 'Não foi possível carregar os anexos.';
  const { error } = await supabase
    .from(tabela)
    .update({ anexos: atuais.filter((a) => a.path !== path) })
    .eq('id', id);
  if (error) return error.message || 'Não foi possível remover o anexo.';
  await removerArquivos([path]);
  return null;
}

/** Apaga do bucket todos os arquivos de um registro que deixou de existir (ex.: baixa desfeita). */
export async function removerTodosOsAnexos(anexos: readonly Anexo[]): Promise<void> {
  await removerArquivos(anexos.map((a) => a.path));
}
