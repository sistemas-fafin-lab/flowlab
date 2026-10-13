// Como mostrar uma proposta da EVA: rótulos e o "antes → depois" de cada campo.
// Usado pela fila de sugestões, pelo chat e pelos comentários (diálogo de confirmação).
import { KANBAN_STATUS_LABELS, PRIORITY_CONFIG } from '../../constants';
import { diaDoPrazo, formatarDiaMes } from '../../domain/datas';
import type { CardResumo, PropostaCard, TipoSugestao } from '../../services/agenteAdmin';

export const ROTULO_TIPO: Record<TipoSugestao, string> = {
  criar_card: 'Card novo',
  atualizar_card: 'Mudança no card',
  comentar_card: 'Comentário no card',
};

const rotuloColuna = (c?: string | null) => (c ? KANBAN_STATUS_LABELS[c as keyof typeof KANBAN_STATUS_LABELS] ?? c : '—');
const rotuloPrioridade = (p?: string | null) => (p ? PRIORITY_CONFIG[p as keyof typeof PRIORITY_CONFIG]?.label ?? p : '—');
const rotuloPrazo = (dia?: string | null) => (dia ? formatarDiaMes(dia) : 'sem prazo');

export interface LinhaMudanca {
  campo: string;
  antes?: string;
  depois: string;
}

/** Linhas legíveis do que a proposta faz, com o valor atual do card quando é mudança. */
export function descreverProposta(tipo: TipoSugestao, p: PropostaCard, card: CardResumo | null, nome: (id: string) => string): LinhaMudanca[] {
  const pessoas = (ids?: string[] | null) => (ids && ids.length ? ids.map(nome).join(', ') : 'ninguém');
  if (tipo === 'comentar_card') return [{ campo: 'Comentário', depois: p.comentario ?? '' }];
  if (tipo === 'criar_card') {
    const linhas: LinhaMudanca[] = [{ campo: 'Título', depois: p.titulo ?? '' }];
    if (p.descricao) linhas.push({ campo: 'Descrição', depois: p.descricao });
    linhas.push({ campo: 'Responsáveis', depois: pessoas(p.responsaveis) });
    linhas.push({ campo: 'Prazo', depois: `${rotuloPrazo(p.prazo)}${p.prazo_texto ? ` ("${p.prazo_texto}")` : ''}` });
    linhas.push({ campo: 'Coluna', depois: rotuloColuna(p.kanban_status) });
    linhas.push({ campo: 'Prioridade', depois: rotuloPrioridade(p.prioridade) });
    return linhas;
  }
  const linhas: LinhaMudanca[] = [];
  if (p.kanban_status) linhas.push({ campo: 'Coluna', antes: rotuloColuna(card?.kanban_status), depois: rotuloColuna(p.kanban_status) });
  if ('prazo' in p) {
    linhas.push({
      campo: 'Prazo',
      antes: rotuloPrazo(card?.due_date ? diaDoPrazo(card.due_date) : null),
      depois: `${rotuloPrazo(p.prazo)}${p.prazo_texto ? ` ("${p.prazo_texto}")` : ''}`,
    });
  }
  if (p.responsaveis) linhas.push({ campo: 'Responsáveis', antes: pessoas(card?.assigned_to), depois: pessoas(p.responsaveis) });
  if (p.prioridade) linhas.push({ campo: 'Prioridade', antes: rotuloPrioridade(card?.priority), depois: rotuloPrioridade(p.prioridade) });
  if (p.comentario) linhas.push({ campo: 'Comentário', depois: p.comentario });
  return linhas;
}
