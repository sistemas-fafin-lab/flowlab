import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import ReactDOM from 'react-dom';
import { useNavigate, Link } from 'react-router-dom';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  type Connection,
  MarkerType,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import {
  Brain,
  FolderOpen,
  Loader2,
  AlertTriangle,
  Map,
  RefreshCw,
  X,
  Plus,
  Pencil,
  Save,
  ArrowRight,
  Eye,
  Target,
  ShieldCheck,
  Server,
  Users,
  Layers,
  ChevronRight,
} from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  CentralProjectNode,
  StrategicNode,
  BoundaryNode,
  OperationalNode,
  type CentralProjectNodeData,
  type StrategicNodeData,
  type BoundaryNodeData,
  type OperationalNodeData,
} from '../../components/IT/MindMapNodes';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface ITProject {
  id: string;
  name: string;
  color: string;
  description: string | null;
}

interface ProjectVisionRow {
  id: string;
  project_id: string;
  mission: string;
  vision: string;
  in_scope: string[];
  out_of_scope: string[];
  infra_details: Record<string, unknown>;
  team_details: Record<string, unknown>;
  nodes: unknown;
  edges: unknown;
}

// ═══════════════════════════════════════════════════════════════════════════════
// NODE TYPES REGISTRY
// ═══════════════════════════════════════════════════════════════════════════════

const nodeTypes = {
  centralProject: CentralProjectNode,
  strategic: StrategicNode,
  boundary: BoundaryNode,
  operational: OperationalNode,
};

// ═══════════════════════════════════════════════════════════════════════════════
// GRAPH DATA GENERATOR
// ═══════════════════════════════════════════════════════════════════════════════

function generateGraphData(
  project: ITProject,
  vision: ProjectVisionRow,
  onNavigate: () => void,
): { nodes: Node[]; edges: Edge[] } {
  const status =
    vision.in_scope.length > vision.out_of_scope.length
      ? 'no_prazo'
      : vision.out_of_scope.length > vision.in_scope.length
        ? 'critico'
        : 'atencao';

  const nodes: Node[] = [
    {
      id: 'central',
      type: 'centralProject',
      position: { x: 0, y: 0 },
      data: { projectName: project.name, status, color: project.color, onNavigate } satisfies CentralProjectNodeData,
    },
    {
      id: 'strategic',
      type: 'strategic',
      position: { x: -340, y: -300 },
      data: { title: 'Visão Estratégica', mission: vision.mission, vision: vision.vision } satisfies StrategicNodeData,
    },
    {
      id: 'boundary',
      type: 'boundary',
      position: { x: -360, y: 300 },
      data: { inScope: vision.in_scope, outOfScope: vision.out_of_scope } satisfies BoundaryNodeData,
    },
    {
      id: 'operational-infra',
      type: 'operational',
      position: { x: 380, y: -100 },
      data: { title: 'Infraestrutura', icon: 'infra', details: (vision.infra_details ?? {}) as Record<string, string | number | boolean | null> } satisfies OperationalNodeData,
    },
    {
      id: 'operational-team',
      type: 'operational',
      position: { x: -560, y: 100 },
      data: { title: 'Equipe & Licenças', icon: 'team', details: (vision.team_details ?? {}) as Record<string, string | number | boolean | null> } satisfies OperationalNodeData,
    },
  ];

  const edges: Edge[] = [
    { id: 'e-central-strategic', source: 'central', target: 'strategic', animated: true, style: { stroke: '#3b82f6', strokeWidth: 2 }, markerEnd: { type: MarkerType.ArrowClosed, color: '#3b82f6', width: 16, height: 16 } },
    { id: 'e-central-boundary', source: 'central', target: 'boundary', animated: true, style: { stroke: '#10b981', strokeWidth: 2 }, markerEnd: { type: MarkerType.ArrowClosed, color: '#10b981', width: 16, height: 16 } },
    { id: 'e-central-infra', source: 'central', target: 'operational-infra', animated: true, style: { stroke: '#06b6d4', strokeWidth: 2 }, markerEnd: { type: MarkerType.ArrowClosed, color: '#06b6d4', width: 16, height: 16 } },
    { id: 'e-central-team', source: 'central', target: 'operational-team', animated: true, style: { stroke: '#f59e0b', strokeWidth: 2 }, markerEnd: { type: MarkerType.ArrowClosed, color: '#f59e0b', width: 16, height: 16 } },
  ];

  return { nodes, edges };
}

// ═══════════════════════════════════════════════════════════════════════════════
// CREATE/EDIT MINDMAP MODAL
// ═══════════════════════════════════════════════════════════════════════════════

interface MindMapFormProps {
  project: ITProject;
  existingVision: ProjectVisionRow | null;
  onSave: () => void;
  onClose: () => void;
}

const emptyInfra = { vps: '', os: '', automation: '' };
const emptyTeam = { licenses_allocated: 0, collaborators: [] };

const MindMapFormModal: React.FC<MindMapFormProps> = ({ project, existingVision, onSave, onClose }) => {
  const [mission, setMission] = useState(existingVision?.mission ?? '');
  const [vision, setVision] = useState(existingVision?.vision ?? '');
  const [inScope, setInScope] = useState(existingVision?.in_scope.join('\n') ?? '');
  const [outOfScope, setOutOfScope] = useState(existingVision?.out_of_scope.join('\n') ?? '');
  const [vps, setVps] = useState((existingVision?.infra_details?.vps as string) ?? '');
  const [os, setOs] = useState((existingVision?.infra_details?.os as string) ?? '');
  const [automation, setAutomation] = useState((existingVision?.infra_details?.automation as string) ?? '');
  const [licenses, setLicenses] = useState((existingVision?.team_details?.licenses_allocated as number) ?? 0);
  const [collaborators, setCollaborators] = useState(
    Array.isArray(existingVision?.team_details?.collaborators)
      ? (existingVision!.team_details!.collaborators as string[]).join('\n')
      : ''
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const firstInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    firstInputRef.current?.focus();
  }, []);

  const handleSave = async () => {
    if (!mission.trim() || !vision.trim()) {
      setError('Missão e Visão são obrigatórios.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const payload = {
        project_id: project.id,
        mission: mission.trim(),
        vision: vision.trim(),
        in_scope: inScope.split('\n').map(s => s.trim()).filter(Boolean),
        out_of_scope: outOfScope.split('\n').map(s => s.trim()).filter(Boolean),
        infra_details: { vps: vps.trim(), os: os.trim(), automation: automation.trim() },
        team_details: {
          licenses_allocated: Number(licenses) || 0,
          collaborators: collaborators.split('\n').map(s => s.trim()).filter(Boolean),
        },
      };

      if (existingVision) {
        const { error: err } = await supabase
          .from('it_project_visions')
          .update(payload)
          .eq('id', existingVision.id);
        if (err) throw err;
      } else {
        const { error: err } = await supabase
          .from('it_project_visions')
          .insert(payload);
        if (err) throw err;
      }
      onSave();
    } catch (err) {
      console.error('[MindMapForm] save error:', err);
      setError('Erro ao salvar. Tente novamente.');
    } finally {
      setSaving(false);
    }
  };

  const modalContent = (
    <motion.div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      />
      <motion.div
        className="relative z-10 w-full max-w-2xl flex flex-col bg-white dark:bg-gray-800 rounded-2xl shadow-2xl"
        style={{ maxHeight: 'min(90vh, 720px)' }}
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
      >
        {/* Modal Header */}
        <div className="flex-none flex items-center justify-between p-5 border-b border-gray-100 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-blue-600 flex items-center justify-center">
              <Brain className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="font-bold text-gray-900 dark:text-gray-100">
                {existingVision ? 'Editar Mapa Mental' : 'Criar Mapa Mental'}
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">{project.name}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="flex-none flex items-center gap-2 px-5 py-3 bg-red-50 dark:bg-red-900/20 border-b border-red-100 dark:border-red-800 text-sm text-red-700 dark:text-red-300">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Strategic */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Target className="w-4 h-4 text-violet-500" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200">Estratégia</h3>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Missão *</label>
                <input
                  ref={firstInputRef}
                  type="text"
                  value={mission}
                  onChange={e => setMission(e.target.value)}
                  placeholder="Qual é a missão deste projeto?"
                  className="w-full text-sm px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:border-violet-400 dark:focus:border-violet-500 text-gray-800 dark:text-gray-100 placeholder-gray-400"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Visão *</label>
                <input
                  type="text"
                  value={vision}
                  onChange={e => setVision(e.target.value)}
                  placeholder="Qual é a visão de futuro?"
                  className="w-full text-sm px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:border-violet-400 dark:focus:border-violet-500 text-gray-800 dark:text-gray-100 placeholder-gray-400"
                />
              </div>
            </div>
          </div>

          {/* Scope */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <ShieldCheck className="w-4 h-4 text-emerald-500" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200">Escopo</h3>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">In-Scope (um por linha)</label>
                <textarea
                  value={inScope}
                  onChange={e => setInScope(e.target.value)}
                  rows={4}
                  placeholder="Autenticação&#10;Dashboard&#10;API REST"
                  className="w-full text-sm px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:border-emerald-400 text-gray-800 dark:text-gray-100 placeholder-gray-400 resize-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Out-of-Scope (um por linha)</label>
                <textarea
                  value={outOfScope}
                  onChange={e => setOutOfScope(e.target.value)}
                  rows={4}
                  placeholder="Mobile App&#10;Integração SAP"
                  className="w-full text-sm px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:border-red-400 text-gray-800 dark:text-gray-100 placeholder-gray-400 resize-none"
                />
              </div>
            </div>
          </div>

          {/* Infrastructure */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Server className="w-4 h-4 text-cyan-500" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200">Infraestrutura</h3>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">VPS</label>
                <input type="text" value={vps} onChange={e => setVps(e.target.value)} placeholder="AWS EC2" className="w-full text-sm px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:border-cyan-400 text-gray-800 dark:text-gray-100 placeholder-gray-400" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">OS</label>
                <input type="text" value={os} onChange={e => setOs(e.target.value)} placeholder="Ubuntu 24.04" className="w-full text-sm px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:border-cyan-400 text-gray-800 dark:text-gray-100 placeholder-gray-400" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Automação</label>
                <input type="text" value={automation} onChange={e => setAutomation(e.target.value)} placeholder="Docker + CI/CD" className="w-full text-sm px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:border-cyan-400 text-gray-800 dark:text-gray-100 placeholder-gray-400" />
              </div>
            </div>
          </div>

          {/* Team */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Users className="w-4 h-4 text-amber-500" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200">Equipe</h3>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Licenças Alocadas</label>
                <input type="number" value={licenses} onChange={e => setLicenses(Number(e.target.value))} min={0} className="w-full text-sm px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:border-amber-400 text-gray-800 dark:text-gray-100" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Colaboradores (um por linha)</label>
                <textarea
                  value={collaborators}
                  onChange={e => setCollaborators(e.target.value)}
                  rows={1}
                  placeholder="Ana Silva&#10;Carlos Mendes"
                  className="w-full text-sm px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:border-amber-400 text-gray-800 dark:text-gray-100 placeholder-gray-400 resize-none"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex-none flex items-center justify-between p-5 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 rounded-b-2xl">
          <button onClick={onClose} disabled={saving} className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors disabled:opacity-50">
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !mission.trim() || !vision.trim()}
            className="inline-flex items-center gap-2 px-5 py-2 bg-gradient-to-r from-violet-600 to-blue-600 text-white font-semibold rounded-xl shadow-lg shadow-violet-500/25 hover:shadow-xl hover:scale-[1.02] transition-all duration-200 disabled:opacity-50 disabled:hover:scale-100"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {existingVision ? 'Atualizar' : 'Criar Mapa'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );

  return ReactDOM.createPortal(
    <AnimatePresence>{modalContent}</AnimatePresence>,
    document.body,
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

const ITProjectMindMap: React.FC = () => {
  const { userProfile } = useAuth();
  const navigate = useNavigate();

  const [projects, setProjects] = useState<ITProject[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [visionData, setVisionData] = useState<ProjectVisionRow | null>(null);
  const [isLoadingProjects, setIsLoadingProjects] = useState(true);
  const [isLoadingVision, setIsLoadingVision] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);

  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [containerReady, setContainerReady] = useState(false);
  const flowContainerRef = useRef<HTMLDivElement>(null);

  // Wait for container to have dimensions before rendering React Flow
  useEffect(() => {
    setContainerReady(false);
    if (!flowContainerRef.current) return;
    const el = flowContainerRef.current;
    if (el.offsetWidth > 0 && el.offsetHeight > 0) {
      setContainerReady(true);
      return;
    }
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect.width > 0 && entry.contentRect.height > 0) {
          setContainerReady(true);
        }
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [visionData, selectedProjectId]);

  const isManager = userProfile?.role === 'admin' || userProfile?.department === 'TI';

  // Fetch projects
  useEffect(() => {
    let cancelled = false;
    const fetchProjects = async () => {
      setIsLoadingProjects(true);
      setError(null);
      try {
        const { data, error: err } = await supabase.from('it_projects').select('id, name, color, description').order('name');
        if (err) throw err;
        if (!cancelled) setProjects(data ?? []);
      } catch (err) {
        if (!cancelled) { setError('Erro ao carregar projetos.'); }
      } finally {
        if (!cancelled) setIsLoadingProjects(false);
      }
    };
    fetchProjects();
    return () => { cancelled = true; };
  }, []);

  // Fetch vision
  useEffect(() => {
    if (!selectedProjectId) { setVisionData(null); setNodes([]); setEdges([]); return; }
    let cancelled = false;
    const fetchVision = async () => {
      setIsLoadingVision(true);
      setError(null);
      try {
        const { data, error: err } = await supabase.from('it_project_visions').select('*').eq('project_id', selectedProjectId).maybeSingle();
        if (err) throw err;
        if (!cancelled) setVisionData(data);
      } catch (err) {
        if (!cancelled) setError('Erro ao carregar visão do projeto.');
      } finally {
        if (!cancelled) setIsLoadingVision(false);
      }
    };
    fetchVision();
    return () => { cancelled = true; };
  }, [selectedProjectId]);

  // Build graph
  const handleNavigate = useCallback(() => {
    if (selectedProjectId) navigate(`/it/projects/${selectedProjectId}`);
  }, [selectedProjectId, navigate]);

  useEffect(() => {
    if (!visionData || !selectedProjectId) return;
    const project = projects.find(p => p.id === selectedProjectId);
    if (!project) return;
    const { nodes: newNodes, edges: newEdges } = generateGraphData(project, visionData, handleNavigate);
    setNodes(newNodes);
    setEdges(newEdges);
  }, [visionData, selectedProjectId, projects, handleNavigate, setNodes, setEdges]);

  const onConnect = useCallback(
    (params: Connection) => setEdges(eds => [...eds, { ...params, animated: true, style: { stroke: '#8b5cf6', strokeWidth: 2 } }]),
    [setEdges],
  );

  const selectedProject = useMemo(() => projects.find(p => p.id === selectedProjectId) ?? null, [projects, selectedProjectId]);

  const handleFormSave = useCallback(() => {
    setIsFormOpen(false);
    // Refetch vision
    if (selectedProjectId) {
      setVisionData(null);
      setIsLoadingVision(true);
      supabase.from('it_project_visions').select('*').eq('project_id', selectedProjectId).maybeSingle().then(({ data, error: err }) => {
        if (!err) setVisionData(data);
        setIsLoadingVision(false);
      });
    }
  }, [selectedProjectId]);

  // ── Loading ─────────────────────────────────────────────────────────────
  if (isLoadingProjects) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="text-center">
          <div className="relative mx-auto w-16 h-16 mb-4">
            <div className="absolute inset-0 bg-violet-500 rounded-2xl blur-xl opacity-30 animate-pulse" />
            <div className="relative w-16 h-16 bg-gradient-to-br from-violet-500 to-blue-600 rounded-2xl flex items-center justify-center shadow-xl">
              <Loader2 className="w-8 h-8 text-white animate-spin" />
            </div>
          </div>
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Carregando projetos...</p>
        </div>
      </div>
    );
  }

  // ── Error ───────────────────────────────────────────────────────────────
  if (error && projects.length === 0) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="text-center max-w-md px-6">
          <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="w-8 h-8 text-red-500" />
          </div>
          <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-2">Erro ao carregar</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">{error}</p>
          <button onClick={() => window.location.reload()} className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-violet-600 to-blue-600 rounded-xl shadow-lg transition-all">
            <RefreshCw className="w-4 h-4" /> Recarregar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 4rem)' }}>

      {/* ── Page Header ─────────────────────────────────────────────────── */}
      <div className="flex-shrink-0 mb-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="absolute inset-0 bg-violet-500 rounded-xl blur-lg opacity-30" />
              <div className="relative w-10 h-10 bg-gradient-to-br from-violet-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg">
                <Brain className="w-5 h-5 text-white" />
              </div>
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-slate-800 dark:text-slate-100">
                Mapa Mental de Projetos
              </h1>
              <p className="text-xs text-slate-400 dark:text-slate-500">Visão estratégica interativa</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Back to projects */}
            {selectedProjectId && (
              <button
                onClick={() => { setSelectedProjectId(null); setVisionData(null); }}
                className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 bg-white/60 dark:bg-slate-800/60 border border-slate-200/50 dark:border-slate-700/50 rounded-xl hover:border-violet-400 dark:hover:border-violet-500 transition-all"
              >
                <ChevronRight className="w-4 h-4 rotate-180" />
                Projetos
              </button>
            )}

            {/* Create/Edit MindMap button */}
            {selectedProject && isManager && (
              <button
                onClick={() => setIsFormOpen(true)}
                className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-white bg-gradient-to-r from-violet-600 to-blue-600 rounded-xl shadow-lg shadow-violet-500/25 hover:shadow-xl hover:scale-[1.02] transition-all duration-200"
              >
                {visionData ? <Pencil className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                {visionData ? 'Editar' : 'Criar Mapa'}
              </button>
            )}

            {/* Navigate to Dashboard */}
            {selectedProject && (
              <Link
                to={`/it/projects/${selectedProject.id}`}
                className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 bg-white/60 dark:bg-slate-800/60 border border-slate-200/50 dark:border-slate-700/50 rounded-xl hover:border-violet-400 dark:hover:border-violet-500 transition-all"
              >
                <Eye className="w-4 h-4" />
                Dashboard
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* ── Main Content ──────────────────────────────────────────────── */}
      <div className="flex-1 relative" style={{ height: 'calc(100vh - 12rem)' }}>
        {/* No project — Centered Glassmorphism Cards */}
        {!selectedProjectId && !isLoadingVision && (
          <div className="absolute inset-0 flex flex-col items-center justify-center z-10 px-4 overflow-y-auto py-8">
            {/* Header */}
            <div className="text-center mb-10">
              <h2 className="text-3xl sm:text-4xl font-extrabold bg-gradient-to-r from-slate-800 to-slate-600 dark:from-slate-100 dark:to-slate-300 bg-clip-text text-transparent mb-2">
                Hub de Projetos
              </h2>
              <p className="text-base sm:text-lg text-slate-500 dark:text-slate-400">Selecione um projeto para visualizar o mapa mental estratégico</p>
            </div>

            {/* Centered Cards Container */}
            {projects.length > 0 ? (
              <div className="flex flex-wrap justify-center gap-5 max-w-5xl">
                {projects.map((project, index) => (
                  <button
                    key={project.id}
                    onClick={() => setSelectedProjectId(project.id)}
                    className="group relative w-72 bg-white/50 dark:bg-slate-900/40 backdrop-blur-xl rounded-2xl border border-white/50 dark:border-slate-700/40 overflow-hidden cursor-pointer shadow-lg transition-all duration-500 hover:-translate-y-2 text-left"
                    style={{
                      animationDelay: `${index * 0.08}s`,
                      ['--neon-color' as string]: project.color,
                    }}
                  >
                    {/* Neon glow blob — hidden by default, visible on hover */}
                    <div
                      className="absolute -inset-1 rounded-2xl blur-2xl opacity-0 group-hover:opacity-40 transition-opacity duration-500 pointer-events-none"
                      style={{ background: `radial-gradient(circle, ${project.color} 0%, transparent 70%)` }}
                    />

                    {/* Top color accent line */}
                    <div className="absolute top-0 left-0 right-0 h-0.5 opacity-60" style={{ backgroundColor: project.color }} />

                    <div className="relative p-5">
                      {/* Icon with glass container */}
                      <div
                        className="w-14 h-14 rounded-xl flex items-center justify-center mb-4 transition-all duration-500 group-hover:scale-110 group-hover:shadow-lg"
                        style={{
                          backgroundColor: `${project.color}15`,
                          border: `1px solid ${project.color}30`,
                        }}
                      >
                        <FolderOpen className="w-7 h-7 transition-colors duration-300" style={{ color: project.color }} />
                      </div>

                      {/* Content */}
                      <h3
                        className="text-base font-bold text-slate-800 dark:text-slate-100 mb-1.5 truncate transition-colors duration-300"
                        style={{ color: undefined }}
                      >
                        {project.name}
                      </h3>
                      {project.description && (
                        <p className="text-xs text-slate-500 dark:text-slate-400 mb-4 line-clamp-2 leading-relaxed">
                          {project.description}
                        </p>
                      )}

                      {/* Action with neon underline */}
                      <div className="flex items-center gap-2 text-sm font-medium transition-colors duration-300" style={{ color: project.color }}>
                        <span>Visualizar mapa</span>
                        <ArrowRight className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-1.5" />
                      </div>

                      {/* Bottom neon line on hover */}
                      <div
                        className="absolute bottom-0 left-1/2 -translate-x-1/2 w-0 h-0.5 rounded-full transition-all duration-500 group-hover:w-3/4"
                        style={{ backgroundColor: project.color, boxShadow: `0 0 12px ${project.color}` }}
                      />
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="text-center max-w-sm">
                <div className="relative mx-auto w-20 h-20 mb-6">
                  <div className="absolute inset-0 bg-slate-300 dark:bg-slate-700 rounded-3xl blur-xl opacity-20" />
                  <div className="relative w-20 h-20 bg-slate-100 dark:bg-slate-800 rounded-3xl flex items-center justify-center border border-slate-200 dark:border-slate-700">
                    <Map className="w-10 h-10 text-slate-400 dark:text-slate-500" />
                  </div>
                </div>
                <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-2">Nenhum projeto disponível</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">Crie um projeto de TI primeiro para visualizar o mapa mental estratégico.</p>
              </div>
            )}
          </div>
        )}

        {/* Loading vision */}
        {isLoadingVision && (
          <div className="absolute inset-0 flex items-center justify-center z-10">
            <div className="text-center">
              <div className="relative mx-auto w-16 h-16 mb-4">
                <div className="absolute inset-0 bg-violet-500 rounded-2xl blur-xl opacity-30 animate-pulse" />
                <div className="relative w-16 h-16 bg-gradient-to-br from-violet-500 to-blue-600 rounded-2xl flex items-center justify-center shadow-xl">
                  <Loader2 className="w-8 h-8 text-white animate-spin" />
                </div>
              </div>
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Carregando mapa mental...</p>
            </div>
          </div>
        )}

        {/* No vision */}
        {!isLoadingVision && selectedProjectId && !visionData && (
          <div className="absolute inset-0 flex items-center justify-center z-10">
            <div className="text-center">
              <div className="w-16 h-16 bg-amber-100 dark:bg-amber-900/30 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <FolderOpen className="w-8 h-8 text-amber-500" />
              </div>
              <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-2">Mapa mental não criado</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 max-w-sm mb-4">Este projeto ainda não possui uma visão estratégica mapeada.</p>
              {isManager && (
                <button
                  onClick={() => setIsFormOpen(true)}
                  className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-gradient-to-r from-violet-600 to-blue-600 rounded-xl shadow-lg shadow-violet-500/25 hover:shadow-xl hover:scale-[1.02] transition-all"
                >
                  <Plus className="w-4 h-4" />
                  Criar Mapa Mental
                </button>
              )}
            </div>
          </div>
        )}

        {/* React Flow — only render when container has dimensions */}
        {visionData && (
          <div ref={flowContainerRef} className="absolute inset-0 w-full h-full">
            {containerReady && (
              <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
                nodeTypes={nodeTypes}
                nodesDraggable={isManager}
                nodesConnectable={isManager}
                elementsSelectable
                fitView
                fitViewOptions={{ padding: 0.3 }}
                minZoom={0.2}
                maxZoom={2}
                defaultEdgeOptions={{ type: 'smoothstep', animated: true }}
              >
                <Background variant="dots" gap={24} size={1} opacity={0.2} />
                <Controls
                  showInteractive={false}
                  className="!bg-white/80 dark:!bg-slate-800/80 !backdrop-blur-xl !border !border-slate-200/50 dark:!border-slate-700/50 !rounded-xl !shadow-lg"
                >
                  <style>{`
                    .react-flow__controls button {
                      background: transparent !important;
                      border: none !important;
                      border-bottom: 1px solid rgba(148,163,184,0.15) !important;
                      color: #64748b !important;
                      padding: 8px !important;
                      transition: all 0.2s ease !important;
                    }
                    .react-flow__controls button:last-child {
                      border-bottom: none !important;
                    }
                    .react-flow__controls button:hover {
                      background: rgba(139,92,246,0.1) !important;
                      color: #7c3aed !important;
                    }
                    .dark .react-flow__controls button {
                      color: #94a3b8 !important;
                    }
                    .dark .react-flow__controls button:hover {
                      background: rgba(139,92,246,0.15) !important;
                      color: #a78bfa !important;
                    }
                    .react-flow__controls button svg {
                      max-width: 16px !important;
                      max-height: 16px !important;
                    }
                    .react-flow__minimap {
                      border-radius: 12px !important;
                    }
                  `}</style>
                </Controls>
                <MiniMap
                  nodeColor={(node) => {
                    switch (node.type) {
                      case 'centralProject': return '#8b5cf6';
                      case 'strategic': return '#3b82f6';
                      case 'boundary': return '#10b981';
                      case 'operational': return '#06b6d4';
                      default: return '#94a3b8';
                    }
                  }}
                  className="!bg-white/80 dark:!bg-slate-800/80 !backdrop-blur-xl !border !border-slate-200/50 dark:!border-slate-700/50 !rounded-xl !shadow-lg"
                  maskColor="rgba(148,163,184,0.1)"
                />
              </ReactFlow>
            )}
          </div>
        )}
      </div>

      {/* ── Create/Edit Modal ─────────────────────────────────────────── */}
      {isFormOpen && selectedProject && (
        <MindMapFormModal
          project={selectedProject}
          existingVision={visionData}
          onSave={handleFormSave}
          onClose={() => setIsFormOpen(false)}
        />
      )}
    </div>
  );
};

export default ITProjectMindMap;
