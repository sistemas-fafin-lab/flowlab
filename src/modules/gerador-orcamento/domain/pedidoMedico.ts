// Leitura do pedido médico por IA no Gerador de Orçamento — regras do lado da tela.
// Puro, para testar sem DOM. A leitura e o casamento com a lista de preços ficam no
// servidor (api/_lib/atendimento/leituraPedidoMedico.ts); aqui só a validação dos
// arquivos antes do upload e a volta do resultado para os exames que a tela carregou.

import { chaveExame } from './carrinho';
import type { ItemGeradorOrcamento } from '../types';

export const MAX_ARQUIVOS_PEDIDO = 5;
export const MAX_MB_POR_ARQUIVO = 10;

/** O que a tela olha de um File (dá para testar sem File). */
type ArquivoSelecionado = Pick<File, 'name' | 'type' | 'size'>;

const ehImagemOuPdf = (a: ArquivoSelecionado) => {
  const tipo = a.type.toLowerCase();
  return tipo.startsWith('image/') || tipo === 'application/pdf' || a.name.toLowerCase().endsWith('.pdf');
};

/** Mensagem para a tela quando os arquivos não podem ir à análise; null quando podem. */
export function problemaNosArquivosDoPedido(arquivos: readonly ArquivoSelecionado[]): string | null {
  if (arquivos.length === 0) return 'Selecione ao menos um arquivo do pedido médico.';
  if (arquivos.length > MAX_ARQUIVOS_PEDIDO) {
    return `Envie até ${MAX_ARQUIVOS_PEDIDO} arquivos por análise. Remova ${arquivos.length - MAX_ARQUIVOS_PEDIDO}.`;
  }
  const naoSuportado = arquivos.find((a) => !ehImagemOuPdf(a));
  if (naoSuportado) return `“${naoSuportado.name}” não é imagem nem PDF. Envie apenas imagens ou PDF.`;
  const grande = arquivos.find((a) => a.size > MAX_MB_POR_ARQUIVO * 1024 * 1024);
  if (grande) return `“${grande.name}” passa de ${MAX_MB_POR_ARQUIVO}MB. Envie uma foto ou PDF menor.`;
  return null;
}

/** Um exame do pedido como o servidor devolve: o item da lista por tuss + nome, ou nenhum. */
export interface ExameLidoNoPedido {
  nomeNoPedido: string;
  item: { tuss: string; nome: string } | null;
}

export interface LeituraDoPedido {
  /** Exames lidos que têm exame na lista da tela (um por exame da lista). */
  reconhecidos: { nomeNoPedido: string; exame: ItemGeradorOrcamento }[];
  /** Nomes lidos no pedido sem exame correspondente: o atendente busca à mão. */
  semCorrespondencia: string[];
}

/**
 * Liga o resultado do servidor aos exames que a tela carregou (são eles que vão ao
 * carrinho, com o custo quando o usuário pode vê-lo).
 */
export function resolverLeituraDoPedido(
  exames: readonly ExameLidoNoPedido[],
  lista: readonly ItemGeradorOrcamento[],
): LeituraDoPedido {
  const porChave = new Map(lista.map((exame) => [chaveExame(exame), exame]));
  const leitura: LeituraDoPedido = { reconhecidos: [], semCorrespondencia: [] };
  const vistos = new Set<string>();

  for (const { nomeNoPedido, item } of exames) {
    const chave = item ? chaveExame(item) : null;
    const exame = chave ? porChave.get(chave) : undefined;
    if (!exame) {
      leitura.semCorrespondencia.push(nomeNoPedido);
    } else if (!vistos.has(chave)) {
      vistos.add(chave);
      leitura.reconhecidos.push({ nomeNoPedido, exame });
    }
  }
  return leitura;
}
