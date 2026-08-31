import React, { useEffect, useState } from 'react';
import { AlertTriangle, Loader2, X } from 'lucide-react';
import type { TituloReceber } from '../types';

// Modal de edição do título (issue 33): escopo restrito a um único campo, o
// número da nota — decisão explícita da sessão de grilling, para não abrir uma
// superfície de edição maior do título sem necessidade. `titulo` presente é o
// que abre o modal; `null` fecha, sem estado próprio de "aberto".

interface Props {
  titulo: TituloReceber | null;
  onFechar: () => void;
  onSalvar: (idNota: string, numeroNota: string) => Promise<string | null>;
}

const EditarTituloModal: React.FC<Props> = ({ titulo, onFechar, onSalvar }) => {
  const [numeroNota, setNumeroNota] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // Reabre sempre com o número atual do título — inclusive se o operador fechar
  // e reabrir sobre outro título sem desmontar o componente.
  useEffect(() => {
    setNumeroNota(titulo?.numeroNota ?? '');
    setErro(null);
  }, [titulo]);

  const fechar = () => {
    setErro(null);
    onFechar();
  };

  const submeter = async (evento: React.FormEvent) => {
    evento.preventDefault();
    if (!titulo) return;

    const valor = numeroNota.trim();
    if (!valor) {
      setErro('Informe o número da nota.');
      return;
    }

    setErro(null);
    setSalvando(true);
    const erroRetornado = await onSalvar(titulo.id, valor);
    setSalvando(false);

    if (erroRetornado) setErro(erroRetornado);
    else fechar();
  };

  if (!titulo) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-sm flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Editar título</h2>
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
            Número da nota
            <input
              type="text"
              autoFocus
              value={numeroNota}
              onChange={(e) => setNumeroNota(e.target.value)}
              placeholder="Ex.: 12345"
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

export default EditarTituloModal;
