import React from 'react';
import { useSlaStatus } from '../../hooks/useSlaStatus';
import type { ITPriority, ITStatusLike, ITKanbanColumnLike } from '../../utils/itSla';

// Prazo de *primeiro atendimento*: o contador para quando a TI pega o chamado.

type SLABadgeSize = 'kanban' | 'list' | 'header';
type SLABadgeVariant = 'pill' | 'cell' | 'row';

const PILL_SIZE_CLASSES: Record<SLABadgeSize, string> = {
  kanban: 'inline-flex items-center gap-1.5 px-2 py-0.5 text-[11px] font-medium rounded-md',
  list: 'inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-lg',
  header: 'inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-md',
};

interface SLABadgeProps {
  createdAt: string;
  priority: ITPriority;
  status?: ITStatusLike | null;
  kanbanStatus?: ITKanbanColumnLike | null;
  kanbanHidden?: boolean | null;
  variant?: SLABadgeVariant;
  size?: SLABadgeSize;
}

const SLABadge: React.FC<SLABadgeProps> = ({
  createdAt,
  priority,
  status,
  kanbanStatus,
  kanbanHidden,
  variant = 'pill',
  size = 'list',
}) => {
  const sla = useSlaStatus(createdAt, priority, { status, kanbanStatus, kanbanHidden });

  if (variant === 'pill') {
    // Contador parado (atendimento iniciado ou chamado fechado) não vira pílula.
    if (!sla.isRunning) return null;
    return (
      <span className={`${PILL_SIZE_CLASSES[size]} ${sla.badgeClass}`}>
        <span className={`w-1.5 h-1.5 rounded-full ${sla.dotClass}`} />
        {sla.label}
      </span>
    );
  }

  if (variant === 'cell') {
    return (
      <div className="bg-slate-50 dark:bg-slate-800/60 rounded-2xl p-4">
        <p className="text-xs text-slate-400 dark:text-slate-500 mb-1">Prazo para iniciar</p>
        <p className={`text-sm font-semibold flex items-center gap-1.5 ${sla.textClass}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${sla.dotClass}`} />
          {sla.label}
        </p>
      </div>
    );
  }

  return (
    <span className={`inline-flex items-center gap-1.5 text-sm font-medium ${sla.textClass}`}>
      <span className={`w-2 h-2 rounded-full ${sla.dotClass}`} />
      {sla.label}
    </span>
  );
};

export default SLABadge;
