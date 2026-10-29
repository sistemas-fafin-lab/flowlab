import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Info, X } from 'lucide-react';
import type { NaoFaturaveisResumo } from '../types';
import { formatCurrency } from '../utils/formato';

// "Observação" dos widgets de Pendências do Dashboard: as requisições que
// ficaram FORA do total por estarem num status que não pode ser faturado
// (cancelada, devolvida, aguardando devolução/retirada, descarte). O link fica
// dentro do card e abre um painel com a quebra por status.
//
// O painel vai por portal e com posição fixa porque o card (overflow-hidden) e
// o widget (overflow-y-auto) cortariam um popover absoluto. Fecha com clique
// fora, Esc ou rolagem — reposicionar a cada scroll não vale para um painel
// que só se consulta e fecha.

interface Props {
  resumo: NaoFaturaveisResumo | undefined;
}

const LARGURA_PAINEL = 320;

const ObservacaoNaoFaturaveis: React.FC<Props> = ({ resumo }) => {
  const [posicao, setPosicao] = useState<{ top: number; left: number } | null>(null);
  const botaoRef = useRef<HTMLButtonElement>(null);
  const painelRef = useRef<HTMLDivElement>(null);

  const fechar = useCallback(() => setPosicao(null), []);

  useEffect(() => {
    if (!posicao) return undefined;
    const aoClicar = (e: MouseEvent) => {
      const alvo = e.target as Node;
      if (painelRef.current?.contains(alvo) || botaoRef.current?.contains(alvo)) return;
      fechar();
    };
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === 'Escape') fechar();
    };
    document.addEventListener('mousedown', aoClicar);
    document.addEventListener('keydown', aoTeclar);
    window.addEventListener('scroll', fechar, true);
    window.addEventListener('resize', fechar);
    return () => {
      document.removeEventListener('mousedown', aoClicar);
      document.removeEventListener('keydown', aoTeclar);
      window.removeEventListener('scroll', fechar, true);
      window.removeEventListener('resize', fechar);
    };
  }, [posicao, fechar]);

  if (!resumo || resumo.qtdRequisicoes === 0) return null;

  const alternar = (e: React.MouseEvent) => {
    // O card inteiro é um atalho para a aba Pendências: o clique aqui não pode
    // subir até ele.
    e.stopPropagation();
    if (posicao) {
      fechar();
      return;
    }
    const rect = botaoRef.current?.getBoundingClientRect();
    if (!rect) return;
    const left = Math.max(8, Math.min(rect.left, window.innerWidth - LARGURA_PAINEL - 8));
    setPosicao({ top: rect.bottom + 6, left });
  };

  const plural = resumo.qtdRequisicoes === 1 ? '' : 's';

  return (
    <>
      <button
        ref={botaoRef}
        type="button"
        onClick={alternar}
        onKeyDown={(e) => e.stopPropagation()}
        aria-expanded={Boolean(posicao)}
        className="mt-1 inline-flex max-w-full items-center gap-1 rounded-md bg-amber-50 dark:bg-amber-900/30 px-1.5 py-0.5 text-[11px] font-medium text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/50"
      >
        <Info className="h-3 w-3 flex-shrink-0" />
        <span className="truncate">
          {resumo.qtdRequisicoes} não faturáve{resumo.qtdRequisicoes === 1 ? 'l' : 'is'} fora do total ·{' '}
          {formatCurrency(resumo.valor)}
        </span>
      </button>
      {posicao &&
        createPortal(
          <div
            ref={painelRef}
            role="dialog"
            aria-label="Requisições não faturáveis"
            onClick={(e) => e.stopPropagation()}
            style={{ top: posicao.top, left: posicao.left, width: LARGURA_PAINEL }}
            className="fixed z-50 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-3 shadow-xl"
          >
            <div className="mb-2 flex items-start justify-between gap-2">
              <div>
                <p className="text-xs font-semibold text-gray-800 dark:text-gray-100">
                  Requisições que não podem ser faturadas
                </p>
                <p className="mt-0.5 text-[11px] text-gray-500 dark:text-gray-400">
                  {resumo.qtdRequisicoes} requisiç{plural ? 'ões' : 'ão'} fora do valor pendente, pelo
                  status da requisição no apLIS.
                </p>
              </div>
              <button
                type="button"
                onClick={fechar}
                aria-label="Fechar"
                className="rounded p-0.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-200"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            <ul className="divide-y divide-gray-100 dark:divide-gray-700">
              {resumo.porEvento.map((evento) => (
                <li key={evento.codigo} className="flex items-center justify-between gap-3 py-1.5 text-xs">
                  <span className="min-w-0 text-gray-700 dark:text-gray-200">
                    {evento.label}
                    <span className="ml-1 text-gray-400 dark:text-gray-500">({evento.qtd})</span>
                  </span>
                  <span className="flex-shrink-0 font-semibold tabular-nums text-gray-900 dark:text-gray-100">
                    {formatCurrency(evento.valor)}
                  </span>
                </li>
              ))}
            </ul>
            <div className="mt-1 flex items-center justify-between border-t border-gray-200 dark:border-gray-700 pt-1.5 text-xs">
              <span className="font-medium text-gray-600 dark:text-gray-300">Total</span>
              <span className="font-bold tabular-nums text-gray-900 dark:text-gray-100">
                {formatCurrency(resumo.valor)}
              </span>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
};

export default ObservacaoNaoFaturaveis;
