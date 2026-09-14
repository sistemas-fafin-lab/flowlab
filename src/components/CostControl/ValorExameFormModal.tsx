import React, { useEffect, useState } from 'react';
import { RotateCcw, Save, Tag, X } from 'lucide-react';
import { formatBRL } from '../../hooks/useCostControl';
import type { ExameDaFontePagadora } from './domain/busca';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface ValorExameFormModalProps {
  open: boolean;
  // Linha de custo_fontes_pagadoras_valores_exame (ver examesPorFontePagadora
  // em domain/busca.ts) — este exame compartilha o TUSS com irmãos, então só
  // o valor dele muda aqui, nunca fonte/tabela/TUSS (esses são da linha
  // compartilhada, editados via PayorFormModal noutra tela).
  item: ExameDaFontePagadora | null;
  onClose: () => void;
  onSave: (valor: number) => void;
  onRestaurarPadrao: () => void;
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

const ValorExameFormModal: React.FC<ValorExameFormModalProps> = ({
  open,
  item,
  onClose,
  onSave,
  onRestaurarPadrao,
}) => {
  const [valor, setValor] = useState(0);

  useEffect(() => {
    if (open && item) setValor(item.valorCobrado);
  }, [open, item]);

  if (!open || !item) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(valor);
  };

  const inputCls =
    'w-full px-3 py-2.5 text-sm rounded-xl bg-white dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30 transition-all';

  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-lg max-h-[92vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center shadow-md shadow-blue-500/25">
              <Tag className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Valor deste exame</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                TUSS {item.tuss} é compartilhado por mais de um exame — só o valor de "{item.exame}" muda aqui.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700 dark:hover:text-gray-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
          <div className="px-6 py-5 space-y-4">
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-slate-700 dark:text-gray-300">Exame</label>
              <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">{item.exame}</p>
            </div>
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-slate-700 dark:text-gray-300">
                Valor de venda para este exame
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-500 dark:text-gray-400 font-medium pointer-events-none">
                  R$
                </span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  autoFocus
                  value={valor}
                  onChange={e => setValor(parseFloat(e.target.value) || 0)}
                  className={`${inputCls} pl-8 tabular-nums`}
                />
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Valor padrão do TUSS (vale pros demais irmãos): {formatBRL(item.valorPadraoTuss)}
              </p>
            </div>
            {item.temValorPersonalizado && (
              <button
                type="button"
                onClick={onRestaurarPadrao}
                className="inline-flex items-center gap-2 text-sm font-medium text-amber-600 dark:text-amber-400 hover:underline"
              >
                <RotateCcw className="w-3.5 h-3.5" /> Restaurar valor padrão do TUSS
              </button>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 bg-slate-50 dark:bg-gray-900/50 border-t border-gray-100 dark:border-gray-700 flex items-center justify-end gap-3 rounded-b-2xl">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/60 active:scale-[.98] transition-all"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 shadow-md shadow-blue-500/25 active:scale-[.98] transition-all"
            >
              <Save className="w-4 h-4" /> Salvar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ValorExameFormModal;
