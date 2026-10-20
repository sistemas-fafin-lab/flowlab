import React from 'react';
import { FileText, Plus, SearchX } from 'lucide-react';
import type { AbaStatus } from '../domain/filtrosPagamentos';
import { CARTAO } from './estilos';

// Lista vazia por três motivos diferentes, cada um com a sua saída: os filtros esconderam
// tudo (limpar), a pessoa ainda não tem pedidos (criar) ou a aba está vazia (ver todos).

const ABA_VAZIA: Record<Exclude<AbaStatus, 'todos'>, { titulo: string; texto: string }> = {
  aberto: { titulo: 'Nada em aberto', texto: 'Nenhum pedido esperando autorização, aprovação ou pagamento.' },
  autorizacao: { titulo: 'Nada a autorizar', texto: 'Nenhum pedido esperando a decisão de um autorizador.' },
  pendente: { titulo: 'Nenhum pedido pendente', texto: 'Nada autorizado esperando a aprovação do Financeiro.' },
  aprovado: { titulo: 'Nada a pagar', texto: 'Nenhum pedido aprovado esperando pagamento.' },
  pago: { titulo: 'Nenhum pedido pago', texto: 'Os pedidos pagos aparecem aqui.' },
  rejeitado: { titulo: 'Nenhum pedido rejeitado', texto: 'Nem rejeitado, nem cancelado.' },
};

interface Props {
  aba: AbaStatus;
  /** Busca, data ou recortes ligados. */
  filtrando: boolean;
  /** A pessoa não vê nenhum pedido, em nenhuma aba. */
  semPedidos: boolean;
  onLimpar: () => void;
  onNovo: () => void;
  onVerTodos: () => void;
}

const BOTAO_SECUNDARIO =
  'inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors';

const EstadoVazioPedidos: React.FC<Props> = ({ aba, filtrando, semPedidos, onLimpar, onNovo, onVerTodos }) => {
  let icone = <FileText className="w-8 h-8 text-blue-500" />;
  let titulo: string;
  let texto: string;
  let acao: React.ReactNode = null;

  if (filtrando) {
    icone = <SearchX className="w-8 h-8 text-blue-500" />;
    titulo = 'Nenhum pedido com esses filtros';
    texto = 'Tente outra busca ou tire algum filtro.';
    acao = (
      <button type="button" onClick={onLimpar} className={BOTAO_SECUNDARIO}>
        Limpar filtros
      </button>
    );
  } else if (semPedidos || aba === 'todos') {
    titulo = 'Nenhum pedido de pagamento ainda';
    texto = 'Os pedidos de pagamento, reembolso e adiantamento aparecem aqui.';
    acao = (
      <button
        type="button"
        onClick={onNovo}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-gradient-to-r from-blue-500 to-indigo-500 text-white shadow-md shadow-blue-500/25 hover:from-blue-600 hover:to-indigo-600 transition-all"
      >
        <Plus className="w-4 h-4" /> Nova solicitação
      </button>
    );
  } else {
    ({ titulo, texto } = ABA_VAZIA[aba]);
    acao = (
      <button type="button" onClick={onVerTodos} className={BOTAO_SECUNDARIO}>
        Ver todos os pedidos
      </button>
    );
  }

  return (
    <div className={`${CARTAO} p-10 sm:p-12 text-center animate-fade-in-up`}>
      <div className="w-16 h-16 bg-gradient-to-br from-blue-500/10 to-indigo-500/10 dark:from-blue-500/20 dark:to-indigo-500/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
        {icone}
      </div>
      <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1">{titulo}</h3>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">{texto}</p>
      {acao}
    </div>
  );
};

export default EstadoVazioPedidos;
