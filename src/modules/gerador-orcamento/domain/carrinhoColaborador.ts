// Busca e total do modo Tabela Colaborador do Gerador de Orçamento. Puro, para testar
// sem DOM. Ver .scratch/tabela-colaborador/spec.md → "Tela e PDF".
//
// O carrinho é o mesmo do modo particular (./carrinho), com exames disponíveis; o
// desconto automático por volume não se aplica: o Valor colaborador já é o preço com
// desconto.

import { filtrarOpcoes } from '../../../components/selectBusca';
import type { ItemCarrinho, ItemColaboradorDisponivel, ItemTabelaColaborador } from '../types';
import type { MotivoSemValorColaborador } from './tabelaColaborador';

/** Se o exame tem Valor colaborador (e pode ir ao carrinho); senão é "consultar a gestão". */
export const exameDisponivel = (exame: ItemTabelaColaborador): exame is ItemColaboradorDisponivel =>
  exame.precoColaborador.disponivel;

const MOTIVOS: Record<MotivoSemValorColaborador, string> = {
  sem_custo: 'Sem custo cadastrado',
  custo_maior_ou_igual_particular: 'Custo maior ou igual ao preço particular',
  pouca_vantagem: 'Pouca vantagem sobre o preço particular',
};

/** Por que o exame está em "consultar a gestão", para a tela. */
export const motivoSemValor = (motivo: MotivoSemValorColaborador): string => MOTIVOS[motivo];

/**
 * Os exames que casam com a busca, na ordem original: cada palavra digitada precisa
 * aparecer no nome ou no código TUSS, sem acento nem maiúsculas (filtrarOpcoes).
 */
export function filtrarExamesColaborador<T extends ItemTabelaColaborador>(exames: readonly T[], busca: string): T[] {
  const opcoes = exames.map((exame) => ({ label: exame.nome, keywords: exame.tuss, exame }));
  return filtrarOpcoes(opcoes, busca).map((o) => o.exame);
}

/** Valor colaborador × quantidade, somado em centavos (sem erro de ponto flutuante). */
export function totalColaborador(carrinho: readonly ItemCarrinho<ItemColaboradorDisponivel>[]): number {
  const centavos = carrinho.reduce(
    (acc, c) => acc + Math.round(c.item.precoColaborador.valor * 100) * c.quantidade,
    0,
  );
  return centavos / 100;
}
