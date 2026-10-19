import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, PencilLine, Loader2, AlertTriangle, Save } from 'lucide-react';
import { useAsyncGuard } from '../hooks/useAsyncGuard';
import type { Quotation } from '../types';
import {
  quotationInfoInputFrom,
  validateQuotationInfo,
  type QuotationInfo,
  type QuotationInfoInput,
} from '../utils/quotationInfo';

interface EditQuotationInfoModalProps {
  quotation: Quotation;
  /** Grava as informações; o erro lançado (ex.: recusa do trigger) aparece no modal. */
  onConfirm: (info: QuotationInfo) => Promise<unknown>;
  onClose: () => void;
}

const PRIORITY_OPTIONS = [
  { value: 'low', label: 'Baixa', color: 'bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-200' },
  { value: 'medium', label: 'Média', color: 'bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-200' },
  { value: 'high', label: 'Alta', color: 'bg-orange-100 dark:bg-orange-900/40 text-orange-800 dark:text-orange-200' },
  { value: 'urgent', label: 'Urgente', color: 'bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-200' },
];

const inputClass =
  'w-full px-3 py-2.5 text-sm rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60';
const labelClass = 'block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1.5';

/**
 * Edita as informações da cotação — título, descrição, justificativa,
 * prioridade, centro de custo e prazos — numa única gravação. Não mexe em
 * aprovações nem envia mensagens; o histórico é gravado pelo banco.
 */
export const EditQuotationInfoModal: React.FC<EditQuotationInfoModalProps> = ({
  quotation,
  onConfirm,
  onClose,
}) => {
  const [form, setForm] = useState<QuotationInfoInput>(() => quotationInfoInputFrom(quotation));
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const { isBusy, begin, reset } = useAsyncGuard();

  const updateField = (field: keyof QuotationInfoInput) => (value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
    setErrorMessage(null);
  };

  const handleSave = async () => {
    const result = validateQuotationInfo(form);
    if ('error' in result) {
      setErrorMessage(result.error);
      return;
    }
    if (!begin()) return;
    try {
      setErrorMessage(null);
      await onConfirm(result.info);
      onClose();
    } catch (err) {
      console.error('Erro ao salvar as informações da cotação.', err);
      setErrorMessage(err instanceof Error ? err.message : 'Erro ao salvar as informações da cotação.');
      reset();
    }
  };

  return createPortal(
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[80] animate-fade-in">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-hidden flex flex-col">
        <div className="px-6 py-4 bg-gradient-to-r from-blue-600 to-blue-500 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center mr-3">
                <PencilLine className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-bold">Editar informações</h3>
                <p className="text-sm text-white/80">{quotation.code}</p>
              </div>
            </div>
            {!isBusy && (
              <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-lg transition-colors">
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          <div>
            <label htmlFor="quotation-info-title" className={labelClass}>
              Título <span className="text-red-500">*</span>
            </label>
            <input
              id="quotation-info-title"
              type="text"
              value={form.title}
              onChange={(e) => updateField('title')(e.target.value)}
              disabled={isBusy}
              className={inputClass}
            />
          </div>

          <div>
            <label htmlFor="quotation-info-description" className={labelClass}>Descrição</label>
            <textarea
              id="quotation-info-description"
              value={form.description}
              onChange={(e) => updateField('description')(e.target.value)}
              disabled={isBusy}
              rows={3}
              className={inputClass}
            />
          </div>

          <div>
            <label htmlFor="quotation-info-justification" className={labelClass}>Justificativa</label>
            <textarea
              id="quotation-info-justification"
              value={form.justification}
              onChange={(e) => updateField('justification')(e.target.value)}
              disabled={isBusy}
              rows={4}
              className={inputClass}
            />
          </div>

          <div>
            <span className={labelClass}>Prioridade</span>
            <div className="flex flex-wrap gap-2">
              {PRIORITY_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => updateField('priority')(opt.value)}
                  disabled={isBusy}
                  className={`px-3 py-1.5 text-sm font-medium rounded-lg border transition-all ${
                    form.priority === opt.value
                      ? `${opt.color} border-transparent ring-2 ring-offset-1 ring-blue-500 dark:ring-offset-gray-800`
                      : 'bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-600'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label htmlFor="quotation-info-cost-center" className={labelClass}>Centro de Custo</label>
            <input
              id="quotation-info-cost-center"
              type="text"
              value={form.costCenter}
              onChange={(e) => updateField('costCenter')(e.target.value)}
              disabled={isBusy}
              className={inputClass}
              placeholder="Ex: CC-001"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="quotation-info-response-deadline" className={labelClass}>Prazo de Resposta</label>
              <input
                id="quotation-info-response-deadline"
                type="date"
                value={form.responseDeadline}
                onChange={(e) => updateField('responseDeadline')(e.target.value)}
                disabled={isBusy}
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="quotation-info-delivery-deadline" className={labelClass}>Prazo de Entrega / Fornecimento</label>
              <input
                id="quotation-info-delivery-deadline"
                type="date"
                value={form.deliveryDeadline}
                onChange={(e) => updateField('deliveryDeadline')(e.target.value)}
                disabled={isBusy}
                className={inputClass}
              />
            </div>
          </div>

          <p className="text-xs text-slate-500 dark:text-slate-400">
            A alteração fica registrada no histórico da cotação. Aprovações já dadas continuam valendo e ninguém é notificado.
          </p>

          {errorMessage && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-800 dark:text-red-300">{errorMessage}</p>
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-700 flex justify-end gap-2.5">
          <button
            onClick={onClose}
            disabled={isBusy}
            className="px-4 py-2.5 text-sm font-semibold rounded-xl text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={isBusy}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white font-semibold text-sm rounded-xl hover:bg-blue-700 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Salvar
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
};
