import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pencil, Plus, X, Save } from 'lucide-react';
import type { Exam, PayorEditData } from '../../hooks/useCostControl';
import { buscarExamesPorTermo } from './domain/busca';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface PayorFormModalProps {
  open: boolean;
  mode: 'edit' | 'create';
  payor: PayorEditData | null;
  exams: Exam[];
  onClose: () => void;
  onSave: (data: PayorEditData) => void;
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

const EMPTY_FORM: PayorEditData = { payor: '', table: '', tus: '', price: 0 };

const PayorFormModal: React.FC<PayorFormModalProps> = ({ open, mode, payor, exams, onClose, onSave }) => {
  const [form, setForm] = useState<PayorEditData>(EMPTY_FORM);
  const [sugestoesTussAbertas, setSugestoesTussAbertas] = useState(false);
  const [indiceTussDestacado, setIndiceTussDestacado] = useState(0);
  const tussFieldRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      setForm(payor ?? EMPTY_FORM);
      setSugestoesTussAbertas(false);
    }
  }, [open, payor]);

  useEffect(() => {
    setIndiceTussDestacado(0);
  }, [form.tus]);

  // Fecha o dropdown de sugestões de TUSS ao clicar fora do campo.
  useEffect(() => {
    if (!sugestoesTussAbertas) return;
    const handle = (e: MouseEvent) => {
      if (tussFieldRef.current && !tussFieldRef.current.contains(e.target as Node)) {
        setSugestoesTussAbertas(false);
      }
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [sugestoesTussAbertas]);

  const sugestoesTuss = useMemo(() => buscarExamesPorTermo(exams, form.tus), [exams, form.tus]);

  if (!open) return null;

  const handleSelecionarTuss = (exame: Exam) => {
    setForm(f => ({ ...f, tus: exame.tuss }));
    setSugestoesTussAbertas(false);
  };

  const handleTussKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!sugestoesTussAbertas || sugestoesTuss.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setIndiceTussDestacado(i => (i + 1) % sugestoesTuss.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setIndiceTussDestacado(i => (i - 1 + sugestoesTuss.length) % sugestoesTuss.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      handleSelecionarTuss(sugestoesTuss[indiceTussDestacado]);
    } else if (e.key === 'Escape') {
      setSugestoesTussAbertas(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.payor.trim()) return;
    onSave(form);
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
              {mode === 'create' ? <Plus className="w-5 h-5" /> : <Pencil className="w-5 h-5" />}
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                {mode === 'create' ? 'Nova linha de fonte pagadora' : 'Editar fonte pagadora'}
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {mode === 'create'
                  ? 'Preencha os dados da nova linha.'
                  : 'Ajuste os dados desta linha. A próxima reimportação pode sobrescrever esta edição.'}
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
              <label className="block text-sm font-medium text-slate-700 dark:text-gray-300">
                Fonte Pagadora <span className="text-red-500">*</span>
              </label>
              <input
                required
                value={form.payor}
                onChange={e => setForm(f => ({ ...f, payor: e.target.value }))}
                placeholder="Unimed"
                className={inputCls}
              />
            </div>
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-slate-700 dark:text-gray-300">
                Tabela Associada
              </label>
              <input
                value={form.table}
                onChange={e => setForm(f => ({ ...f, table: e.target.value }))}
                placeholder="CBHPM 2022"
                className={inputCls}
              />
            </div>
            <div className="space-y-1.5" ref={tussFieldRef}>
              <label className="block text-sm font-medium text-slate-700 dark:text-gray-300">
                TUSS
              </label>
              <div className="relative">
                <input
                  value={form.tus}
                  onChange={e => {
                    setForm(f => ({ ...f, tus: e.target.value }));
                    setSugestoesTussAbertas(true);
                  }}
                  onFocus={() => setSugestoesTussAbertas(true)}
                  onKeyDown={handleTussKeyDown}
                  placeholder="40304361"
                  autoComplete="off"
                  className={inputCls}
                />
                {sugestoesTussAbertas && form.tus.trim().length > 0 && (
                  <ul className="absolute z-10 mt-1 w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-lg max-h-56 overflow-y-auto">
                    {sugestoesTuss.length === 0 ? (
                      <li className="px-4 py-2.5 text-sm text-gray-500 dark:text-gray-400">
                        Nenhum exame encontrado — TUSS será salvo como digitado.
                      </li>
                    ) : (
                      sugestoesTuss.map((exame, i) => (
                        <li key={exame.id}>
                          <button
                            type="button"
                            onClick={() => handleSelecionarTuss(exame)}
                            onMouseEnter={() => setIndiceTussDestacado(i)}
                            aria-selected={i === indiceTussDestacado}
                            className={`w-full flex items-center justify-between gap-3 px-4 py-2.5 text-left text-sm transition-colors ${
                              i === indiceTussDestacado ? 'bg-blue-50 dark:bg-blue-500/10' : 'hover:bg-blue-50 dark:hover:bg-blue-500/10'
                            }`}
                          >
                            <span className="font-medium text-gray-800 dark:text-gray-100 truncate">{exame.name}</span>
                            <span className="font-mono text-xs text-gray-500 dark:text-gray-400 shrink-0">{exame.tuss}</span>
                          </button>
                        </li>
                      ))
                    )}
                  </ul>
                )}
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-slate-700 dark:text-gray-300">
                Valor Cobrado
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-500 dark:text-gray-400 font-medium pointer-events-none">
                  R$
                </span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.price}
                  onChange={e => setForm(f => ({ ...f, price: parseFloat(e.target.value) || 0 }))}
                  className={`${inputCls} pl-8 tabular-nums`}
                />
              </div>
            </div>
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

export default PayorFormModal;
