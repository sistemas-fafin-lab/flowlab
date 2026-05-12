import React, { useState, useEffect, useMemo } from 'react';
import { Pencil, Plus, X, Save } from 'lucide-react';
import { Exam, IndirectCostItem, formatBRL } from '../../hooks/useCostControl';
import IndirectComposer from './IndirectComposer';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface FormState {
  code: string;
  name: string;
  location: string;
  direct: number;
  indirect: number;
  indirectItems: IndirectCostItem[];
}

interface ExamFormModalProps {
  open: boolean;
  exam: Exam | null;
  onClose: () => void;
  onSave: (data: Omit<Exam, 'id'>) => void;
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

const EMPTY_FORM: FormState = {
  code: '', name: '', location: '', direct: 0, indirect: 0, indirectItems: [],
};

const ExamFormModal: React.FC<ExamFormModalProps> = ({ open, exam, onClose, onSave }) => {
  const [form, setForm] = useState<FormState>(EMPTY_FORM);

  useEffect(() => {
    if (open) {
      setForm(
        exam
          ? {
              code: exam.code,
              name: exam.name,
              location: exam.location,
              direct: exam.direct,
              indirect: exam.indirect,
              indirectItems: exam.indirectItems ?? [],
            }
          : EMPTY_FORM
      );
    }
  }, [open, exam]);

  // Auto-sync indirect total when composer items change
  const indirectFromItems = useMemo(
    () => form.indirectItems.reduce((s, it) => s + (Number(it.value) || 0), 0),
    [form.indirectItems]
  );

  useEffect(() => {
    if (form.indirectItems.length > 0) {
      setForm(f => ({ ...f, indirect: +indirectFromItems.toFixed(2) }));
    }
  }, [indirectFromItems]);

  if (!open) return null;

  const total = (Number(form.direct) || 0) + (Number(form.indirect) || 0);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
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
        className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-2xl max-h-[92vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center shadow-md shadow-blue-500/25">
              {exam ? <Pencil className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                {exam ? 'Editar exame' : 'Novo exame'}
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Cadastre custo direto e composição do custo indireto.
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

        {/* Scrollable body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
          <div className="px-6 py-5 space-y-5">
            {/* Base fields */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-slate-700 dark:text-gray-300">
                  Código <span className="text-red-500">*</span>
                </label>
                <input
                  required
                  value={form.code}
                  onChange={e => setForm(f => ({ ...f, code: e.target.value }))}
                  placeholder="HMG-001"
                  className={inputCls}
                />
              </div>
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-slate-700 dark:text-gray-300">
                  Nome do exame <span className="text-red-500">*</span>
                </label>
                <input
                  required
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="Hemograma Completo"
                  className={inputCls}
                />
              </div>
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-slate-700 dark:text-gray-300">
                  Local de realização <span className="text-red-500">*</span>
                </label>
                <input
                  required
                  value={form.location}
                  onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
                  placeholder="Hematologia"
                  className={inputCls}
                />
              </div>
            </div>

            {/* Direct costs */}
            <div>
              <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
                Custos Diretos
              </h3>
              <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-slate-50/60 dark:bg-gray-900/30 p-4 space-y-1.5">
                <label className="block text-sm font-medium text-slate-700 dark:text-gray-300">
                  Materiais diretos
                </label>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Reagentes, descartáveis e insumos consumidos especificamente neste exame.
                </p>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-500 dark:text-gray-400 font-medium pointer-events-none">
                    R$
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.direct}
                    onChange={e => setForm(f => ({ ...f, direct: parseFloat(e.target.value) || 0 }))}
                    className={`${inputCls} pl-8 tabular-nums`}
                  />
                </div>
              </div>
            </div>

            {/* Indirect costs */}
            <div>
              <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
                Custos Indiretos
              </h3>
              <IndirectComposer
                items={form.indirectItems}
                onChange={items => setForm(f => ({ ...f, indirectItems: items }))}
              />
              {form.indirectItems.length === 0 && (
                <div className="mt-3 space-y-1.5">
                  <label className="block text-sm font-medium text-slate-700 dark:text-gray-300">
                    Valor estimado (custo indireto)
                  </label>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Preencha o valor estimado, ou expanda acima para detalhar.
                  </p>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-500 dark:text-gray-400 font-medium pointer-events-none">
                      R$
                    </span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={form.indirect}
                      onChange={e => setForm(f => ({ ...f, indirect: parseFloat(e.target.value) || 0 }))}
                      className={`${inputCls} pl-8 tabular-nums`}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Total summary card */}
            <div className="rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 p-5 text-white shadow-lg shadow-blue-500/30">
              <div className="text-[11px] font-bold uppercase tracking-wider text-blue-100">
                Custo Total (Direto + Indireto)
              </div>
              <div className="mt-1 text-3xl font-bold tabular-nums">{formatBRL(total)}</div>
              <div className="mt-2 flex items-center gap-4 text-xs text-blue-50">
                <span>Direto: <strong className="tabular-nums">{formatBRL(form.direct)}</strong></span>
                <span className="opacity-50">·</span>
                <span>Indireto: <strong className="tabular-nums">{formatBRL(form.indirect)}</strong></span>
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
              <Save className="w-4 h-4" /> Salvar exame
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ExamFormModal;
