import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Send, Loader2, AlertTriangle, UserCheck, RefreshCw } from 'lucide-react';
import { useAsyncGuard } from '../hooks/useAsyncGuard';
import { useRequesterManagerOptions } from '../hooks/useRequesterManagerOptions';
import type { Quotation, RequesterManager } from '../types';

interface SubmitForApprovalModalProps {
  quotation: Quotation;
  onConfirm: (requesterManager: RequesterManager) => Promise<void>;
  onClose: () => void;
  /**
   * `submit`: envio para aprovação, com o gestor pré-preenchido.
   * `change`: troca do gestor de uma cotação já na etapa do gestor — sem
   * pré-preenchimento e sem oferecer o gestor atual.
   */
  mode?: 'submit' | 'change';
}

const MODE_TEXT = {
  submit: { title: 'Submeter para Aprovação', confirm: 'Enviar para aprovação', error: 'Erro ao enviar para aprovação.' },
  change: { title: 'Trocar gestor do pedido', confirm: 'Trocar gestor', error: 'Erro ao trocar o gestor do pedido.' },
};

export const SubmitForApprovalModal: React.FC<SubmitForApprovalModalProps> = ({
  quotation,
  onConfirm,
  onClose,
  mode = 'submit',
}) => {
  const { users: activeUsers, suggestedId, loading, error: loadError } = useRequesterManagerOptions(quotation);
  const isChange = mode === 'change';
  const users = isChange ? activeUsers.filter(u => u.id !== quotation.requesterManagerId) : activeUsers;
  const text = MODE_TEXT[mode];
  const [managerId, setManagerId] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const { isBusy, begin, reset } = useAsyncGuard();

  // Pré-preenche uma vez, quando a sugestão chega; depois manda a escolha do comprador.
  useEffect(() => {
    if (suggestedId && !isChange) setManagerId(current => current || suggestedId);
  }, [suggestedId, isChange]);

  useEffect(() => {
    if (loadError) setErrorMessage(loadError);
  }, [loadError]);

  const handleConfirm = async () => {
    const manager = users.find(u => u.id === managerId);
    if (!manager) {
      setErrorMessage(isChange ? 'Selecione o novo gestor do pedido' : 'Selecione o gestor do pedido antes de enviar para aprovação');
      return;
    }
    if (!begin()) return;
    try {
      setErrorMessage(null);
      await onConfirm(manager);
      onClose();
    } catch (err) {
      console.error(text.error, err);
      setErrorMessage(err instanceof Error ? err.message : text.error);
      reset();
    }
  };

  return createPortal(
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[80] animate-fade-in">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-lg w-full mx-4 max-h-[90vh] overflow-hidden flex flex-col">
        <div className="px-6 py-4 bg-gradient-to-r from-amber-600 to-amber-500 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center mr-3">
                {isChange ? <RefreshCw className="w-5 h-5 text-white" /> : <Send className="w-5 h-5 text-white" />}
              </div>
              <div>
                <h3 className="text-lg font-bold">{text.title}</h3>
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
            <label htmlFor="requester-manager" className="flex items-center gap-1.5 text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1.5">
              <UserCheck className="w-4 h-4" />
              {isChange ? 'Novo gestor do pedido' : 'Gestor do pedido'} <span className="text-red-500">*</span>
            </label>
            {loading ? (
              <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400 py-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                Carregando usuários...
              </div>
            ) : (
              <select
                id="requester-manager"
                value={managerId}
                onChange={(e) => { setManagerId(e.target.value); setErrorMessage(null); }}
                disabled={isBusy}
                className="w-full px-3 py-2.5 text-sm rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
              >
                <option value="">Selecione o gestor...</option>
                {users.map(u => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
            )}
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5">
              {isChange && quotation.requesterManagerName && <>Gestor atual: <strong>{quotation.requesterManagerName}</strong>. O novo gestor recebe o e-mail de aprovação. </>}
              Quem abriu a {quotation.quotationType === 'contratacao' ? 'solicitação de manutenção' : 'Solicitação de Compras'} e
              confirma que a cotação atende ao pedido.
            </p>
          </div>

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
            onClick={handleConfirm}
            disabled={isBusy || loading}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-amber-600 text-white font-semibold text-sm rounded-xl hover:bg-amber-700 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : isChange ? <RefreshCw className="w-4 h-4" /> : <Send className="w-4 h-4" />}
            {text.confirm}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
};
