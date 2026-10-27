import React, { useEffect, useState } from 'react';
import { AlertTriangle, Loader2, X } from 'lucide-react';
import type { CriterioPontuacao } from '../types';
import { formatCompetencia } from '../utils/formato';

// Modal de lançamento de um critério manual da Pontuação do setor
// (.scratch/faturamento-pontuacao/, issue 05): pontos digitados e observação
// obrigatória, com o "Pontos base" de referência. Mesmo esqueleto de
// MetaMensalModal; gate canManageBilling no pai. Lançar de novo substitui.

interface Props {
  mes: string;
  rotuloFrente: string;
  criterio: CriterioPontuacao;
  onFechar: () => void;
  onSalvar: (pontos: number, observacao: string) => Promise<string | null>;
}

const formatPontos = (n: number): string => n.toLocaleString('pt-BR', { maximumFractionDigits: 1 });

const LancamentoPontuacaoModal: React.FC<Props> = ({ mes, rotuloFrente, criterio, onFechar, onSalvar }) => {
  const lancado = !!criterio.lancamento;
  const [pontos, setPontos] = useState(lancado ? String(criterio.pontosAtingidos) : '');
  const [observacao, setObservacao] = useState(lancado ? criterio.observacao : '');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    const fecharNoEsc = (e: KeyboardEvent) => { if (e.key === 'Escape' && !salvando) onFechar(); };
    window.addEventListener('keydown', fecharNoEsc);
    return () => window.removeEventListener('keydown', fecharNoEsc);
  }, [onFechar, salvando]);

  const submeter = async (evento: React.FormEvent) => {
    evento.preventDefault();

    const numero = Number(pontos.replace(',', '.'));
    if (pontos.trim() === '' || !Number.isFinite(numero) || numero < 0) {
      setErro('Informe os pontos (a partir de 0).');
      return;
    }
    if (!observacao.trim()) {
      setErro('A observação é obrigatória.');
      return;
    }

    setErro(null);
    setSalvando(true);
    const erroRetornado = await onSalvar(numero, observacao.trim());
    setSalvando(false);

    if (erroRetornado) setErro(erroRetornado);
    else onFechar();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-md flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-700">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{criterio.rotulo}</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Frente {rotuloFrente} · {formatCompetencia(mes)}
            </p>
          </div>
          <button
            type="button"
            onClick={onFechar}
            className="p-2 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
            aria-label="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={submeter} className="px-6 py-4 space-y-3">
          <div className="flex items-end gap-3">
            <label className="block flex-1 text-xs text-gray-500 dark:text-gray-400">
              Pontos
              <input
                type="number"
                step="0.1"
                min="0"
                autoFocus
                value={pontos}
                onChange={(e) => setPontos(e.target.value)}
                className="mt-1 w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-gray-100 tabular-nums"
              />
            </label>
            <div className="pb-2 text-xs text-gray-500 dark:text-gray-400">
              Pontos base: <span className="font-medium text-gray-900 dark:text-white tabular-nums">{formatPontos(criterio.pontosBase)}</span>
            </div>
          </div>

          <label className="block text-xs text-gray-500 dark:text-gray-400">
            Observação
            <textarea
              rows={3}
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              placeholder="Motivo da nota"
              className="mt-1 w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-gray-100"
            />
          </label>

          {erro && (
            <div className="p-3 rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-900/20 text-sm text-red-700 dark:text-red-300 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{erro}</span>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onFechar}
              className="px-4 py-2 rounded-lg text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={salvando}
              className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {salvando && <Loader2 className="w-4 h-4 animate-spin" />}
              {lancado ? 'Alterar' : 'Lançar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default LancamentoPontuacaoModal;
