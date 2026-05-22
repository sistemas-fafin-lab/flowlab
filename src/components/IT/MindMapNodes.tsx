import React, { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import {
  TrendingUp,
  Target,
  Eye,
  CheckCircle2,
  XCircle,
  Server,
  Users,
  Layers,
  ShieldCheck,
} from 'lucide-react';

// ═══════════════════════════════════════════════════════════════════════════════
// DATA TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface CentralProjectNodeData {
  projectName: string;
  status: 'no_prazo' | 'atencao' | 'critico';
  color: string;
  onNavigate?: () => void;
}

export interface StrategicNodeData {
  title: string;
  mission?: string;
  vision?: string;
}

export interface BoundaryNodeData {
  inScope: string[];
  outOfScope: string[];
}

export interface OperationalNodeData {
  title: string;
  icon: 'infra' | 'team' | 'scope';
  details: Record<string, string | number | boolean | null>;
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

const STATUS_CONFIG: Record<string, { badge: string; dot: string; label: string }> = {
  no_prazo: {
    label: 'No Prazo',
    badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
    dot: 'bg-emerald-500',
  },
  atencao: {
    label: 'Atenção',
    badge: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
    dot: 'bg-amber-500',
  },
  critico: {
    label: 'Crítico',
    badge: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
    dot: 'bg-red-500',
  },
};

const ICON_MAP = {
  infra: Server,
  team: Users,
  scope: Layers,
};

// ═══════════════════════════════════════════════════════════════════════════════
// 1. CENTRAL PROJECT NODE (Root)
// ═══════════════════════════════════════════════════════════════════════════════

const CentralProjectNode: React.FC<NodeProps<CentralProjectNodeData>> = memo(({ data, isConnectable }) => {
  const statusConf = STATUS_CONFIG[data.status] ?? STATUS_CONFIG.no_prazo;
  const handleClass = '!w-3 !h-3 !bg-violet-500 !border-2 !border-white dark:!border-slate-900 !opacity-100 hover:!opacity-100 hover:!scale-125 transition-transform';

  return (
    <div className="relative min-w-[280px] bg-white/70 dark:bg-slate-900/50 backdrop-blur-xl border-2 border-slate-200/50 dark:border-slate-700/50 rounded-3xl shadow-2xl shadow-slate-900/10 dark:shadow-black/30 overflow-visible group/node">
      {/* Handles — 4 sides */}
      <Handle type="source" position={Position.Top} id="top" isConnectable={isConnectable} className={handleClass} />
      <Handle type="source" position={Position.Bottom} id="bottom" isConnectable={isConnectable} className={handleClass} />
      <Handle type="source" position={Position.Left} id="left" isConnectable={isConnectable} className={handleClass} />
      <Handle type="source" position={Position.Right} id="right" isConnectable={isConnectable} className={handleClass} />

      {/* Glow blob */}
      <div className="absolute -inset-1 bg-gradient-to-r from-violet-500/10 via-blue-500/10 to-cyan-500/10 dark:from-violet-500/20 dark:via-blue-500/20 dark:to-cyan-500/20 rounded-3xl blur-xl -z-10" />

      <div className="p-5">
        {/* Icon + Title */}
        <div className="flex items-center gap-3 mb-3">
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-br from-violet-500 to-blue-600 rounded-xl blur-md opacity-40" />
            <div className="relative w-10 h-10 bg-gradient-to-br from-violet-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg">
              <Layers className="w-5 h-5 text-white" />
            </div>
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-bold tracking-tight bg-gradient-to-r from-violet-600 via-blue-600 to-cyan-600 dark:from-violet-400 dark:via-blue-400 dark:to-cyan-400 bg-clip-text text-transparent truncate">
              {data.projectName}
            </h3>
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${statusConf.badge}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${statusConf.dot}`} />
              {statusConf.label}
            </span>
          </div>
        </div>

        {/* CTA Button */}
        {data.onNavigate && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              data.onNavigate?.();
            }}
            className="w-full mt-2 flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold text-white bg-gradient-to-r from-violet-600 to-blue-600 rounded-xl shadow-lg shadow-violet-500/25 hover:shadow-xl hover:shadow-violet-500/30 hover:from-violet-700 hover:to-blue-700 transition-all duration-200 active:scale-[0.98]"
          >
            <TrendingUp className="w-3.5 h-3.5" />
            Acessar Dashboard
          </button>
        )}
      </div>
    </div>
  );
});

CentralProjectNode.displayName = 'CentralProjectNode';

// ═══════════════════════════════════════════════════════════════════════════════
// 2. STRATEGIC NODE (North — Vision & Mission)
// ═══════════════════════════════════════════════════════════════════════════════

const StrategicNode: React.FC<NodeProps<StrategicNodeData>> = memo(({ data, isConnectable }) => {
  const handleClass = '!w-3 !h-3 !bg-blue-500 !border-2 !border-white dark:!border-slate-900 !opacity-100 hover:!opacity-100 hover:!scale-125 transition-transform';

  return (
    <div className="relative min-w-[260px] max-w-[320px] bg-white/60 dark:bg-slate-900/40 backdrop-blur-xl border border-slate-200/50 dark:border-slate-700/50 rounded-2xl shadow-xl overflow-visible group/node">
      <Handle type="target" position={Position.Top} id="top" isConnectable={isConnectable} className={handleClass} />
      <Handle type="target" position={Position.Bottom} id="bottom" isConnectable={isConnectable} className={handleClass} />
      <Handle type="source" position={Position.Left} id="left" isConnectable={isConnectable} className={handleClass} />
      <Handle type="source" position={Position.Right} id="right" isConnectable={isConnectable} className={handleClass} />

    <div className="p-4">
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <div className="w-7 h-7 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center shadow-md shadow-blue-500/25">
          <Eye className="w-3.5 h-3.5 text-white" />
        </div>
        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200">
          {data.title}
        </h4>
      </div>

      {/* Mission */}
      {data.mission && (
        <div className="mb-3">
          <div className="flex items-center gap-1.5 mb-1">
            <Target className="w-3 h-3 text-violet-500" />
            <span className="text-[10px] font-semibold uppercase tracking-wider text-violet-600 dark:text-violet-400">Missão</span>
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed break-words">
            {data.mission}
          </p>
        </div>
      )}

      {/* Vision */}
      {data.vision && (
        <div>
          <div className="flex items-center gap-1.5 mb-1">
            <Eye className="w-3 h-3 text-blue-500" />
            <span className="text-[10px] font-semibold uppercase tracking-wider text-blue-600 dark:text-blue-400">Visão</span>
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed break-words">
            {data.vision}
          </p>
        </div>
      )}
    </div>
    </div>
  );
});

StrategicNode.displayName = 'StrategicNode';

// ═══════════════════════════════════════════════════════════════════════════════
// 3. BOUNDARY NODE (South — In-Scope / Out-of-Scope)
// ═══════════════════════════════════════════════════════════════════════════════

const BoundaryNode: React.FC<NodeProps<BoundaryNodeData>> = memo(({ data, isConnectable }) => {
  const handleClass = '!w-3 !h-3 !bg-emerald-500 !border-2 !border-white dark:!border-slate-900 !opacity-100 hover:!opacity-100 hover:!scale-125 transition-transform';

  return (
    <div className="relative min-w-[300px] max-w-[400px] bg-white/60 dark:bg-slate-900/40 backdrop-blur-xl border border-slate-200/50 dark:border-slate-700/50 rounded-2xl shadow-xl overflow-visible group/node">
      <Handle type="target" position={Position.Top} id="top" isConnectable={isConnectable} className={handleClass} />
      <Handle type="target" position={Position.Bottom} id="bottom" isConnectable={isConnectable} className={handleClass} />
      <Handle type="source" position={Position.Left} id="left" isConnectable={isConnectable} className={handleClass} />
      <Handle type="source" position={Position.Right} id="right" isConnectable={isConnectable} className={handleClass} />

    <div className="p-4">
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <div className="w-7 h-7 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-lg flex items-center justify-center shadow-md shadow-emerald-500/25">
          <ShieldCheck className="w-3.5 h-3.5 text-white" />
        </div>
        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200">
          Limites do Escopo
        </h4>
      </div>

      {/* Two columns */}
      <div className="grid grid-cols-2 gap-3">
        {/* In-Scope */}
        <div>
          <div className="flex items-center gap-1.5 mb-2">
            <CheckCircle2 className="w-3 h-3 text-emerald-500" />
            <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">In-Scope</span>
          </div>
          <ul className="space-y-1">
            {data.inScope.length === 0 ? (
              <li className="text-[11px] text-slate-400 dark:text-slate-500 italic">Nenhum item</li>
            ) : (
              data.inScope.map((item, i) => (
                <li key={i} className="flex items-start gap-1.5 text-xs text-slate-600 dark:text-slate-300">
                  <CheckCircle2 className="w-3 h-3 text-emerald-500 flex-shrink-0 mt-0.5" />
                  <span className="leading-snug">{item}</span>
                </li>
              ))
            )}
          </ul>
        </div>

        {/* Out-of-Scope */}
        <div>
          <div className="flex items-center gap-1.5 mb-2">
            <XCircle className="w-3 h-3 text-red-500" />
            <span className="text-[10px] font-semibold uppercase tracking-wider text-red-600 dark:text-red-400">Out-of-Scope</span>
          </div>
          <ul className="space-y-1">
            {data.outOfScope.length === 0 ? (
              <li className="text-[11px] text-slate-400 dark:text-slate-500 italic">Nenhum item</li>
            ) : (
              data.outOfScope.map((item, i) => (
                <li key={i} className="flex items-start gap-1.5 text-xs text-slate-600 dark:text-slate-300">
                  <XCircle className="w-3 h-3 text-red-500 flex-shrink-0 mt-0.5" />
                  <span className="leading-snug">{item}</span>
                </li>
              ))
            )}
          </ul>
        </div>
      </div>
    </div>
    </div>
  );
});

BoundaryNode.displayName = 'BoundaryNode';

// ═══════════════════════════════════════════════════════════════════════════════
// 4. OPERATIONAL NODE (East/West — Key/Value from JSON)
// ═══════════════════════════════════════════════════════════════════════════════

const OperationalNode: React.FC<NodeProps<OperationalNodeData>> = memo(({ data, isConnectable }) => {
  const IconComponent = ICON_MAP[data.icon] ?? Layers;

  const gradientMap = {
    infra: 'from-cyan-500 to-blue-600',
    team: 'from-amber-500 to-orange-600',
    scope: 'from-violet-500 to-purple-600',
  };

  const gradient = gradientMap[data.icon] ?? gradientMap.scope;
  const handleClass = `!w-3 !h-3 !bg-${data.icon === 'infra' ? 'cyan' : data.icon === 'team' ? 'amber' : 'violet'}-500 !border-2 !border-white dark:!border-slate-900 !opacity-100 hover:!opacity-100 hover:!scale-125 transition-transform`;

  return (
    <div className="relative min-w-[240px] max-w-[300px] bg-white/60 dark:bg-slate-900/40 backdrop-blur-xl border border-slate-200/50 dark:border-slate-700/50 rounded-2xl shadow-xl overflow-visible group/node">
      <Handle type="target" position={Position.Top} id="top" isConnectable={isConnectable} className={handleClass} />
      <Handle type="target" position={Position.Bottom} id="bottom" isConnectable={isConnectable} className={handleClass} />
      <Handle type="source" position={Position.Left} id="left" isConnectable={isConnectable} className={handleClass} />
      <Handle type="source" position={Position.Right} id="right" isConnectable={isConnectable} className={handleClass} />

      <div className="p-4">
        {/* Header */}
        <div className="flex items-center gap-2 mb-3">
          <div className={`w-7 h-7 bg-gradient-to-br ${gradient} rounded-lg flex items-center justify-center shadow-md`}>
            <IconComponent className="w-3.5 h-3.5 text-white" />
          </div>
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200">
            {data.title}
          </h4>
        </div>

        {/* Key-Value pairs */}
        <div className="space-y-1.5">
          {Object.entries(data.details).map(([key, value]) => {
            const displayValue = value === null || value === ''
              ? <span className="text-slate-400 dark:text-slate-500 italic">Não definido</span>
              : typeof value === 'boolean'
                ? value
                  ? <span className="text-emerald-600 dark:text-emerald-400 font-medium">Sim</span>
                  : <span className="text-red-600 dark:text-red-400 font-medium">Não</span>
                : typeof value === 'number'
                  ? <span className="font-semibold tabular-nums text-slate-800 dark:text-slate-100">{value}</span>
                  : <span className="text-slate-700 dark:text-slate-200">{String(value)}</span>;

            return (
              <div
                key={key}
                className="flex items-start justify-between gap-3 py-1.5 border-b border-slate-100/60 dark:border-slate-700/40 last:border-0"
              >
                <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex-shrink-0">
                  {key.replace(/_/g, ' ')}
                </span>
                <span className="text-xs text-right">{displayValue}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
});

OperationalNode.displayName = 'OperationalNode';

// ═══════════════════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════════════════

export { CentralProjectNode, StrategicNode, BoundaryNode, OperationalNode };
