import React, { useEffect, useState } from 'react';
import { AlertTriangle, Loader2, X } from 'lucide-react';
import type { MetaMensal } from '../types';
import { formatCompetencia } from '../utils/formato';

// Modal de cadastro/edição da meta mensal (issue 43): campo único de valor
// (R$) para o mês/ano corrente — mesmo esqueleto de EditarTituloModal (issue
// 33), escopo restrito a um campo só, gate canManageBilling. Sem tela de
// histórico: só o mês corrente é editável nesta entrega (decisão assumida do
// spec), então não há seletor de mês/ano aqui.

interface Props {
  aberto: boolean;
  meta: MetaMensal;
  onFechar: () => void;
  onSalvar: (valor: number) => Promise<string | null>;
}

const MetaMensalModal: React.FC<Props> = ({ aberto, meta, onFechar, onSalvar }) => {
  const [valor, setValor] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // Reabre sempre com o valor atual (ou vazio, se a meta ainda não foi definida).
  useEffect(() => {
    setValor(meta.valorMeta !== null ? String(meta.valorMeta) : '');
    setErro(null);
  }, [aberto, meta.valorMeta]);

  const fechar = () => {
    setErro(null);
    onFechar();
  };

  const submeter = async (evento: React.FormEvent) => {
    evento.preventDefault();

    const numero = Number(valor.replace(',', '.'));
    if (!Number.isFinite(numero) || numero < 0) {
      setErro('Informe um valor válido para a meta.');
      return;
    }

    setErro(null);
    setSalvando(true);
    const erroRetornado = await onSalvar(numero);
    setSalvando(false);

    if (erroRetornado) setErro(erroRetornado);
    else fechar();
  };

  if (!aberto) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-sm flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-700">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Meta mensal</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {formatCompetencia(meta.competencia)}
            </p>
          </div>
          <button
            type="button"
            onClick={fechar}
            className="p-2 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
            aria-label="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={submeter} className="px-6 py-4 space-y-3">
          <label className="block text-xs text-gray-500 dark:text-gray-400">
            Valor da meta (R$)
            <input
              type="number"
              step="0.01"
              min="0"
              autoFocus
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              placeholder="Ex.: 500000"
              className="mt-1 w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-gray-100 tabular-nums"
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
              onClick={fechar}
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
              Salvar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default MetaMensalModal;
