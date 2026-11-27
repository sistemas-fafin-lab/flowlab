// Leitura do pedido médico por IA no modo Tabela Colaborador — regras do lado da tela.
// Puro, para testar sem DOM. Ver .scratch/tabela-colaborador/spec.md → "Tela e PDF".
//
// O servidor casa os exames lidos com a lista do modo colaborador (com os Exames de uso
// interno) e devolve, para cada exame casado, o resultado da regra com os parâmetros do
// momento da leitura. Aqui o resultado volta para os exames que a tela carregou e os
// reconhecidos se dividem por esse resultado: os com Valor colaborador podem ir ao
// carrinho (com o valor do servidor); os "consultar a gestão" ficam numa lista à parte,
// com o motivo, e nunca vão ao carrinho.

import { chaveExame } from './carrinho';
import { resolverLeituraDoPedido, type ExameLidoNoPedido, type ExameNaoEncontrado } from './pedidoMedico';
import type { PrecoColaborador } from './tabelaColaborador';
import { motivoSemValor } from './carrinhoColaborador';
import type { ItemColaboradorDisponivel, ItemTabelaColaborador } from '../types';

export interface LeituraDoPedidoColaborador {
  /** Reconhecidos com Valor colaborador: os que podem ir ao carrinho. */
  disponiveis: { nomeNoPedido: string; exame: ItemColaboradorDisponivel }[];
  /** Reconhecidos sem Valor colaborador, com o motivo para a tela. Não vão ao carrinho. */
  consultarGestao: { nomeNoPedido: string; exame: ItemTabelaColaborador; motivo: string }[];
  /** Exames lidos sem exame correspondente na lista: o usuário busca à mão. */
  semCorrespondencia: ExameNaoEncontrado[];
}

/**
 * Liga o resultado do servidor aos exames da Tabela Colaborador que a tela carregou e
 * separa disponíveis e "consultar a gestão" pelo resultado da regra que o servidor
 * devolveu: se os parâmetros mudaram depois que a tela carregou a lista, vale o da
 * leitura. Sem esse resultado (servidor de antes da mudança), vale o da lista da tela.
 */
export function resolverLeituraColaborador(
  exames: readonly ExameLidoNoPedido[],
  lista: readonly ItemTabelaColaborador[],
): LeituraDoPedidoColaborador {
  const { reconhecidos, semCorrespondencia } = resolverLeituraDoPedido(exames, lista);
  const precoDaLeitura = new Map<string, PrecoColaborador>();
  for (const { item } of exames) {
    const chave = item && chaveExame(item);
    if (chave && item.precoColaborador && !precoDaLeitura.has(chave)) precoDaLeitura.set(chave, item.precoColaborador);
  }

  const leitura: LeituraDoPedidoColaborador = { disponiveis: [], consultarGestao: [], semCorrespondencia };
  for (const reconhecido of reconhecidos) {
    const { nomeNoPedido } = reconhecido;
    const preco = precoDaLeitura.get(chaveExame(reconhecido.exame)) ?? reconhecido.exame.precoColaborador;
    const exame = { ...reconhecido.exame, precoColaborador: preco };
    // Por `'motivo' in`: o tsconfig da api (que também compila este módulo) não é strict
    // e não estreita a união pelo `disponivel`.
    if ('motivo' in preco) {
      leitura.consultarGestao.push({ nomeNoPedido, exame, motivo: motivoSemValor(preco.motivo) });
    } else {
      leitura.disponiveis.push({ nomeNoPedido, exame: { ...exame, precoColaborador: preco } });
    }
  }
  return leitura;
}
