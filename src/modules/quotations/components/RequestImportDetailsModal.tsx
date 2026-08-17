import React from 'react';
import ReactDOM from 'react-dom';
import { X, Package, User, Calendar, FileText, ClipboardList } from 'lucide-react';
import { Request, MaintenanceRequest, DepartmentLabels, Department } from '../../../types';
import { formatDate } from '../utils/formatDate';

interface ImportDetailBadge {
  label: string;
  className: string;
}

interface ImportDetailField {
  label: string;
  value: string;
}

interface ImportDetailItem {
  productName: string;
  quantity: number;
  unit?: string;
}

/**
 * Shape-agnostic view model for the modal, so the same component can render
 * both inventory requests (SC/SM, with an item list) and, in a future ticket,
 * maintenance requests (no item list, free-text fields instead).
 */
export interface ImportDetailsData {
  title: string;
  badges?: ImportDetailBadge[];
  fields: ImportDetailField[];
  justification?: { label: string; value: string };
  items?: ImportDetailItem[];
}

interface RequestImportDetailsModalProps {
  isOpen: boolean;
  data: ImportDetailsData;
  onClose: () => void;
  onImport: () => void;
}

const TYPE_BADGE_CLASSNAME: Record<string, string> = {
  SC: 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300',
  SM: 'bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300',
};

const STATUS_BADGE_CLASSNAME: Record<string, string> = {
  approved: 'bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300',
  pending: 'bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300',
  rejected: 'bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300',
  completed: 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300',
};

const STATUS_LABEL: Record<string, string> = {
  pending: 'Pendente',
  approved: 'Aprovada',
  rejected: 'Rejeitada',
  completed: 'Concluída',
};

const PRIORITY_LABEL: Record<string, string> = {
  standard: 'Padrão',
  priority: 'Prioritário',
  urgent: 'Urgente',
};

const MNT_PRIORITY_LABEL: Record<string, string> = {
  common: 'Comum',
  priority: 'Prioritário',
  urgent: 'Urgente',
};

const MNT_PRIORITY_BADGE_CLASSNAME: Record<string, string> = {
  common: 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400',
  priority: 'bg-orange-100 dark:bg-orange-900/50 text-orange-700 dark:text-orange-300',
  urgent: 'bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300',
};

const MNT_STATUS_LABEL: Record<string, string> = {
  pending: 'Aguardando análise',
  in_progress: 'Em andamento',
  completed: 'Concluído',
  cancelled: 'Cancelado',
};

/** Builds the view model for an inventory request (SC/SM). */
export const buildRequestImportDetails = (request: Request): ImportDetailsData => ({
  title: `${request.type} - ${request.id}`,
  badges: [
    { label: request.type, className: TYPE_BADGE_CLASSNAME[request.type] },
    {
      label: STATUS_LABEL[request.status] || request.status,
      className: STATUS_BADGE_CLASSNAME[request.status] || 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400',
    },
  ],
  fields: [
    { label: 'Solicitante', value: request.requestedBy },
    { label: 'Data da solicitação', value: formatDate(request.requestDate) },
    { label: 'Prioridade', value: PRIORITY_LABEL[request.priority] || request.priority },
  ],
  justification: { label: 'Justificativa', value: request.reason },
  items: request.items.map(item => ({
    productName: item.productName,
    quantity: item.quantity,
  })),
});

/** Builds the view model for a maintenance request (MNT) — no item list, free-text fields instead. */
export const buildMaintenanceImportDetails = (mnt: MaintenanceRequest): ImportDetailsData => ({
  title: `MNT - ${mnt.codigo}`,
  badges: [
    {
      label: MNT_PRIORITY_LABEL[mnt.prioridade] || mnt.prioridade,
      className: MNT_PRIORITY_BADGE_CLASSNAME[mnt.prioridade] || 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400',
    },
    { label: MNT_STATUS_LABEL[mnt.status] || mnt.status, className: STATUS_BADGE_CLASSNAME[mnt.status] || 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400' },
  ],
  fields: [
    { label: 'Local da ocorrência', value: mnt.localOcorrencia },
    { label: 'Departamento', value: DepartmentLabels[mnt.department as Department] || mnt.department },
    { label: 'Data de identificação', value: formatDate(mnt.dataIdentificacao) },
  ],
  justification: {
    label: 'Descrição / Impacto operacional',
    value: `${mnt.descricao}\n\n${mnt.impactoOperacional}`,
  },
});

export const RequestImportDetailsModal: React.FC<RequestImportDetailsModalProps> = ({
  isOpen,
  data,
  onClose,
  onImport,
}) => {
  if (!isOpen) return null;

  return ReactDOM.createPortal(
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[60]">
      <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-2xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between flex-shrink-0">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{data.title}</h2>
            {data.badges && data.badges.length > 0 && (
              <div className="flex items-center gap-2 mt-1.5">
                {data.badges.map((badge, idx) => (
                  <span key={idx} className={`text-xs font-medium px-1.5 py-0.5 rounded ${badge.className}`}>
                    {badge.label}
                  </span>
                ))}
              </div>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Fields */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {data.fields.map((field, idx) => (
              <div key={idx} className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4">
                <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 mb-1">
                  {field.label === 'Solicitante' && <User className="w-3.5 h-3.5" />}
                  {field.label === 'Data da solicitação' && <Calendar className="w-3.5 h-3.5" />}
                  {field.label}
                </div>
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{field.value}</p>
              </div>
            ))}
          </div>

          {/* Justification */}
          {data.justification && (
            <div>
              <div className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                <FileText className="w-4 h-4" />
                {data.justification.label}
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4 whitespace-pre-wrap">
                {data.justification.value}
              </p>
            </div>
          )}

          {/* Items */}
          {data.items && (
            <div>
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                <ClipboardList className="w-4 h-4" />
                {data.items.length} Item(ns)
              </h3>
              <div className="space-y-2">
                {data.items.map((item, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl"
                  >
                    <div className="w-8 h-8 bg-white dark:bg-gray-800 rounded-lg flex items-center justify-center border border-gray-200 dark:border-gray-600 flex-shrink-0">
                      <Package className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{item.productName}</p>
                    </div>
                    <span className="text-sm font-medium text-blue-600 dark:text-blue-400 flex-shrink-0">
                      {item.quantity} {item.unit || 'un'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 dark:bg-gray-900/50 border-t border-gray-200 dark:border-gray-700 flex-shrink-0 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-medium rounded-xl border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            Cancelar
          </button>
          <button
            onClick={onImport}
            className="flex-1 px-4 py-2.5 bg-blue-600 text-white font-medium rounded-xl hover:bg-blue-700"
          >
            Importar esta solicitação
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default RequestImportDetailsModal;
