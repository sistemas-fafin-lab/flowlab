import React, { useState } from 'react';
import { Layers, ChevronDown, ChevronUp, Plus, X } from 'lucide-react';
import { IndirectCostItem, formatBRL } from '../../hooks/useCostControl';

interface IndirectComposerProps {
  items: IndirectCostItem[];
  onChange: (items: IndirectCostItem[]) => void;
}

const IndirectComposer: React.FC<IndirectComposerProps> = ({ items, onChange }) => {
  const [open, setOpen] = useState(false);
  const total = items.reduce((s, it) => s + (Number(it.value) || 0), 0);

  const update = (id: string, key: keyof IndirectCostItem, val: string | number) =>
    onChange(items.map(it => (it.id === id ? { ...it, [key]: val } : it)));

  const remove = (id: string) => onChange(items.filter(it => it.id !== id));

  const add = () =>
    onChange([...items, { id: `i${Date.now()}`, label: '', value: 0 }]);

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-slate-50/60 dark:bg-gray-900/30 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-100/60 dark:hover:bg-gray-800/40 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center">
            <Layers className="w-4 h-4" />
          </div>
          <div className="text-left">
            <div className="text-sm font-semibold text-gray-800 dark:text-gray-100">Composição do Custo Indireto</div>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              {items.length} {items.length === 1 ? 'item' : 'itens'} · Soma:{' '}
              <span className="font-semibold tabular-nums">{formatBRL(total)}</span>
            </div>
          </div>
        </div>
        {open
          ? <ChevronUp className="w-4 h-4 text-gray-400" />
          : <ChevronDown className="w-4 h-4 text-gray-400" />}
      </button>

      {open && (
        <div className="px-4 pb-4 pt-1">
          <div className="space-y-2">
            {items.map(it => (
              <div key={it.id} className="flex items-center gap-2">
                <input
                  value={it.label}
                  onChange={e => update(it.id, 'label', e.target.value)}
                  placeholder="Ex: Depreciação de equipamento"
                  className="flex-1 px-3 py-2 text-sm rounded-lg bg-white dark:bg-gray-900/50
                    border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100
                    focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30"
                />
                <div className="relative w-36">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 pointer-events-none">R$</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={it.value}
                    onChange={e => update(it.id, 'value', parseFloat(e.target.value) || 0)}
                    className="w-full pl-9 pr-2 py-2 text-sm tabular-nums rounded-lg bg-white dark:bg-gray-900/50
                      border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100
                      focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => remove(it.id)}
                  title="Remover"
                  className="p-2 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={add}
            className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
          >
            <Plus className="w-3.5 h-3.5" /> Adicionar item
          </button>

          <div className="mt-4 flex items-center justify-between px-3 py-2.5 rounded-lg bg-blue-50 dark:bg-blue-500/10 border border-blue-100 dark:border-blue-500/20">
            <span className="text-xs font-bold uppercase tracking-wider text-blue-700 dark:text-blue-300">Total Indireto</span>
            <span className="text-sm font-bold tabular-nums text-blue-900 dark:text-blue-200">{formatBRL(total)}</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default IndirectComposer;
