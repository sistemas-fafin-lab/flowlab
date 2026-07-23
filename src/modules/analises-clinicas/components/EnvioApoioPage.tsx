import React, { useMemo, useRef, useState } from 'react';
import {
  Send,
  RefreshCw,
  Loader2,
  X,
  Search,
  Plus,
  Pencil,
  Trash2,
  Upload,
  FileText,
  ScanLine,
  CheckCircle2,
  XCircle,
  Clock,
  RotateCcw,
  Eye,
  ChevronDown,
  ChevronRight,
  BookOpen,
  ListChecks,
  History,
} from 'lucide-react';
import { useApoioFila } from '../hooks/useApoioFila';
import { useApoioCatalogo, type CatalogoInput } from '../hooks/useApoioCatalogo';
import {
  uploadArquivosRequisicao,
  processarRequisicao,
  regerarXml,
} from '../apoioApi';
import { useAuth } from '../../../hooks/useAuth';
import { hasPermission } from '../../../utils/permissions';
import { useDialog } from '../../../hooks/useDialog';
import ConfirmDialog from '../../../components/ConfirmDialog';
import type {
  ApoioExameCatalogo,
  ApoioExameExtraido,
  ApoioFilaItem,
  ApoioLogEntry,
  ApoioPipelineResult,
  ApoioTransferResultado,
} from '../types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmtDataHora = (iso: string) =>
  new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });

const MAX_ARQUIVOS = 4;

const STATUS_STYLE: Record<string, string> = {
  aguardando:
    'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-800',
  enviando:
    'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-800',
  enviado:
    'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-300 dark:border-emerald-800',
  erro:
    'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-300 dark:border-red-800',
};

const STATUS_LABEL: Record<string, string> = {
  aguardando: 'Aguardando',
  enviando: 'Enviando',
  enviado: 'Enviado',
  erro: 'Erro',
};

// Origem do código AOL do exame (badge da revisão) — vem de fonte_codigo.
const FONTE_LABEL: Record<string, string> = {
  gemini_catalogo: 'OCR + catálogo',
  catalogo: 'Catálogo (nome)',
  catalogo_correcao: 'Corrigido',
  gemini_nao_validado: 'Não validado',
  sem_match: 'Sem código',
};

const inputCls =
  'w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500';

const StatusBadge: React.FC<{ status: string }> = ({ status }) => (
  <span
    className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full border ${STATUS_STYLE[status] ?? 'bg-gray-100 text-gray-600 border-gray-200'}`}
  >
    {STATUS_LABEL[status] ?? status}
  </span>
);

const Kpi: React.FC<{ icon: React.ReactNode; label: string; valor: React.ReactNode; cor: string }> = ({
  icon,
  label,
  valor,
  cor,
}) => (
  <div className="p-4 rounded-2xl border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 flex items-center gap-3">
    <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white shrink-0 bg-gradient-to-br ${cor}`}>
      {icon}
    </div>
    <div className="min-w-0">
      <div className="text-xl font-bold text-gray-900 dark:text-gray-100 tabular-nums leading-tight">{valor}</div>
      <div className="text-xs text-gray-500 dark:text-gray-400 truncate">{label}</div>
    </div>
  </div>
);

// ─── Log do pipeline (colapsável) ───────────────────────────────────────────────

const LOG_STYLE: Record<string, string> = {
  OK: 'text-emerald-600 dark:text-emerald-400',
  ERROR: 'text-red-600 dark:text-red-400',
  WARN: 'text-amber-600 dark:text-amber-400',
};

const LogPipeline: React.FC<{ log: ApoioLogEntry[] }> = ({ log }) => {
  const [aberto, setAberto] = useState(false);
  if (log.length === 0) return null;
  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
      <button
        onClick={() => setAberto((v) => !v)}
        className="w-full flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-900/40 hover:bg-gray-100 dark:hover:bg-gray-900/60 transition-colors"
      >
        {aberto ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        Log do processamento ({log.length} etapas)
      </button>
      {aberto && (
        <div className="px-4 py-3 max-h-64 overflow-y-auto bg-white dark:bg-gray-800 text-xs font-mono space-y-1">
          {log.map((entrada, i) => (
            <div key={i} className={LOG_STYLE[entrada.level] ?? 'text-gray-600 dark:text-gray-400'}>
              [{entrada.level}] {entrada.msg}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ─── Visualização de XML/resposta (colapsável) ──────────────────────────────────

const BlocoTexto: React.FC<{ titulo: string; texto: string }> = ({ titulo, texto }) => {
  const [aberto, setAberto] = useState(false);
  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
      <button
        onClick={() => setAberto((v) => !v)}
        className="w-full flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-900/40 hover:bg-gray-100 dark:hover:bg-gray-900/60 transition-colors"
      >
        {aberto ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        {titulo}
      </button>
      {aberto && (
        <pre className="px-4 py-3 max-h-72 overflow-auto bg-white dark:bg-gray-800 text-xs text-gray-700 dark:text-gray-300 whitespace-pre-wrap break-all">
          {texto}
        </pre>
      )}
    </div>
  );
};

// ─── Modal de detalhes de um item da fila/histórico ─────────────────────────────

const DetalheItemModal: React.FC<{ item: ApoioFilaItem; onClose: () => void }> = ({ item, onClose }) => (
  <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col">
      <div className="px-6 py-5 border-b border-gray-100 dark:border-gray-700 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-bold text-gray-900 dark:text-gray-100 truncate">
            {item.paciente?.nome || 'Paciente não identificado'}
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Requisição {item.numero_requisicao || '—'} · <StatusBadge status={item.status} />
          </p>
        </div>
        <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700">
          <X className="w-5 h-5 text-gray-500" />
        </button>
      </div>

      <div className="px-6 py-5 overflow-y-auto space-y-4">
        {item.erro_mensagem && (
          <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 text-sm">
            {item.erro_mensagem}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          <div>
            <span className="text-gray-500 dark:text-gray-400">Médico:</span>{' '}
            <span className="text-gray-800 dark:text-gray-200">
              {item.medico?.nome || '—'} {item.medico?.crm ? `(${item.medico.crm})` : ''}
            </span>
          </div>
          <div>
            <span className="text-gray-500 dark:text-gray-400">Criado em:</span>{' '}
            <span className="text-gray-800 dark:text-gray-200">{fmtDataHora(item.created_at)}</span>
          </div>
        </div>

        {(item.exames?.length ?? 0) > 0 && (
          <div>
            <div className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
              Exames ({item.exames!.length})
            </div>
            <div className="flex flex-wrap gap-1.5">
              {item.exames!.map((ex, i) => (
                <span
                  key={i}
                  className="px-2 py-0.5 text-xs font-medium bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300 rounded-full"
                >
                  {ex.codigo_aol_sugerido || ex.nome_normalizado || ex.nome_original || '?'}
                </span>
              ))}
            </div>
          </div>
        )}

        {item.xml_envio && <BlocoTexto titulo="XML de envio" texto={item.xml_envio} />}
        {item.alvaro_response && <BlocoTexto titulo="Resposta do Álvaro" texto={item.alvaro_response} />}
      </div>
    </div>
  </div>
);

// ─── Modal de edição/criação do catálogo ────────────────────────────────────────

const CatalogoModal: React.FC<{
  inicial: ApoioExameCatalogo | null;
  onClose: () => void;
  onSave: (input: CatalogoInput) => Promise<string | null>;
}> = ({ inicial, onClose, onSave }) => {
  const [codExame, setCodExame] = useState(inicial?.cod_exame ?? '');
  const [descricao, setDescricao] = useState(inicial?.descricao_exame ?? '');
  const [descMaterial, setDescMaterial] = useState(inicial?.descricao_material ?? '');
  const [codMaterial, setCodMaterial] = useState(inicial?.cod_material ?? '');
  const [preco, setPreco] = useState(inicial?.preco != null ? String(inicial.preco) : '');
  const [saving, setSaving] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const handleSave = async () => {
    setErro(null);
    const precoNum = preco.trim() ? Number(preco.replace(',', '.')) : null;
    if (preco.trim() && Number.isNaN(precoNum)) {
      setErro('Preço inválido.');
      return;
    }
    setSaving(true);
    const msg = await onSave({
      cod_exame: codExame,
      descricao_exame: descricao,
      descricao_material: descMaterial,
      cod_material: codMaterial,
      preco: precoNum,
    });
    setSaving(false);
    if (msg) setErro(msg);
    else onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full max-h-[90vh] flex flex-col">
        <div className="px-6 py-5 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
          <h3 className="font-bold text-gray-900 dark:text-gray-100">
            {inicial ? `Editar ${inicial.cod_exame}` : 'Novo exame no catálogo'}
          </h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="px-6 py-5 overflow-y-auto space-y-4">
          {erro && (
            <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 text-sm">
              {erro}
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Código AOL</label>
            <input
              value={codExame}
              onChange={(e) => setCodExame(e.target.value.toUpperCase())}
              placeholder="Ex.: TSH"
              disabled={Boolean(inicial)}
              className={`${inputCls} disabled:opacity-60`}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Descrição</label>
            <input
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Nome do exame"
              className={inputCls}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Material</label>
              <input
                value={descMaterial}
                onChange={(e) => setDescMaterial(e.target.value)}
                placeholder="Ex.: soro"
                className={inputCls}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Cód. material</label>
              <input
                value={codMaterial}
                onChange={(e) => setCodMaterial(e.target.value)}
                placeholder="Ex.: 543"
                className={inputCls}
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Preço <span className="text-gray-400">(opcional)</span>
            </label>
            <input
              value={preco}
              onChange={(e) => setPreco(e.target.value)}
              placeholder="Ex.: 7,85"
              className={inputCls}
            />
          </div>
        </div>

        <div className="px-6 py-4 bg-gray-50 dark:bg-gray-900/40 rounded-b-2xl flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-5 py-2.5 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-all duration-200 font-medium"
          >
            Cancelar
          </button>
          <button
            onClick={() => void handleSave()}
            disabled={saving}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-blue-500 to-blue-600 shadow-md shadow-blue-500/25 hover:from-blue-600 hover:to-blue-700 transition-all duration-200 disabled:opacity-60"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            Salvar
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Página ─────────────────────────────────────────────────────────────────────

type Aba = 'nova' | 'fila' | 'historico' | 'catalogo';

const EnvioApoioPage: React.FC = () => {
  const { userProfile } = useAuth();
  const canManage = hasPermission(userProfile?.permissions || [], 'canManageColetas');
  const { confirmDialog, showConfirmDialog, hideConfirmDialog, handleConfirmDialogConfirm } = useDialog();

  const filaHook = useApoioFila();
  const { catalogo, upsertExame, deleteExame } = useApoioCatalogo();

  const [aba, setAba] = useState<Aba>('nova');

  // ── Nova requisição ──
  const inputArquivosRef = useRef<HTMLInputElement>(null);
  const [arquivos, setArquivos] = useState<File[]>([]);
  const [numeroReq, setNumeroReq] = useState('');
  const [processando, setProcessando] = useState(false);
  const [erroNova, setErroNova] = useState<string | null>(null);
  const [resultado, setResultado] = useState<ApoioPipelineResult | null>(null);
  const [pathsUpload, setPathsUpload] = useState<string[]>([]);
  const [selecionados, setSelecionados] = useState<Set<number>>(new Set());
  const [ovSexo, setOvSexo] = useState('');
  const [ovDatanasc, setOvDatanasc] = useState('');
  const [ovCpf, setOvCpf] = useState('');
  const [salvando, setSalvando] = useState(false);

  // ── Fila / histórico ──
  const [selFila, setSelFila] = useState<Set<string>>(new Set());
  const [enviando, setEnviando] = useState(false);
  const [resultadosEnvio, setResultadosEnvio] = useState<ApoioTransferResultado[] | null>(null);
  const [detalhe, setDetalhe] = useState<ApoioFilaItem | null>(null);

  // ── Catálogo ──
  const [buscaCatalogo, setBuscaCatalogo] = useState('');
  const [catalogoModal, setCatalogoModal] = useState<{ aberto: boolean; item: ApoioExameCatalogo | null }>({
    aberto: false,
    item: null,
  });

  const catalogoFiltrado = useMemo(() => {
    const q = buscaCatalogo.trim().toLowerCase();
    if (!q) return catalogo;
    return catalogo.filter(
      (e) =>
        e.cod_exame.toLowerCase().includes(q) ||
        e.descricao_exame.toLowerCase().includes(q) ||
        (e.descricao_material ?? '').toLowerCase().includes(q),
    );
  }, [catalogo, buscaCatalogo]);

  // ── Nova requisição: handlers ──

  const escolherArquivos = (lista: FileList | null) => {
    if (!lista) return;
    setArquivos(Array.from(lista).slice(0, MAX_ARQUIVOS));
    setResultado(null);
    setErroNova(null);
  };

  const processar = async () => {
    if (arquivos.length === 0) return;
    setProcessando(true);
    setErroNova(null);
    setResultado(null);
    try {
      const paths = await uploadArquivosRequisicao(arquivos);
      setPathsUpload(paths);
      const res = await processarRequisicao(paths, numeroReq.trim() || null);
      setResultado(res);
      // Pré-seleciona todos os exames que já têm código AOL
      const pre = new Set<number>();
      (res.exames_imagem ?? []).forEach((ex, i) => {
        if (ex.codigo_aol_sugerido) pre.add(i);
      });
      setSelecionados(pre);
      setOvSexo('');
      setOvDatanasc('');
      setOvCpf('');
    } catch (err) {
      setErroNova(err instanceof Error ? err.message : 'Falha ao processar a requisição.');
    } finally {
      setProcessando(false);
    }
  };

  const overridesAtuais = (): Record<string, string> => {
    const ov: Record<string, string> = {};
    if (ovSexo) ov.sexo = ovSexo;
    if (ovDatanasc) ov.datanasc = ovDatanasc;
    if (ovCpf.trim()) ov.cpf = ovCpf.trim();
    return ov;
  };

  const examesSelecionados = (): ApoioExameExtraido[] =>
    (resultado?.exames_imagem ?? []).filter((_, i) => selecionados.has(i));

  const salvarFila = async () => {
    if (!resultado) return;
    const exames = examesSelecionados();
    if (exames.length === 0) {
      setErroNova('Selecione ao menos um exame para enviar.');
      return;
    }
    setSalvando(true);
    setErroNova(null);
    try {
      // Regenera o XML com a seleção/correções atuais — garante consistência
      // entre o que está na tela e o que vai para a fila.
      const rebuild = await regerarXml(resultado, exames, overridesAtuais());
      const ov = overridesAtuais();
      const paciente = { ...(resultado.paciente ?? {}), ...ov };
      const msg = await filaHook.salvarNaFila({
        numero_requisicao: resultado.numero_requisicao ?? numeroReq.trim() ?? null,
        filename: pathsUpload.join(', ') || resultado.filename,
        paciente,
        medico: resultado.medico ?? null,
        exames,
        xml_envio: rebuild.xml,
        resumo: resultado.resumo ?? null,
      });
      if (msg) {
        setErroNova(msg);
      } else {
        // Limpa a tela e mostra a fila
        setResultado(null);
        setArquivos([]);
        setPathsUpload([]);
        setNumeroReq('');
        if (inputArquivosRef.current) inputArquivosRef.current.value = '';
        setAba('fila');
      }
    } catch (err) {
      setErroNova(err instanceof Error ? err.message : 'Falha ao salvar na fila.');
    } finally {
      setSalvando(false);
    }
  };

  // ── Fila: handlers ──

  const toggleFila = (id: string) => {
    setSelFila((atual) => {
      const novo = new Set(atual);
      if (novo.has(id)) novo.delete(id);
      else novo.add(id);
      return novo;
    });
  };

  const confirmarEnvio = () => {
    const ids = [...selFila];
    if (ids.length === 0) return;
    showConfirmDialog(
      'Enviar ao Álvaro',
      <span>
        Enviar <strong className="text-gray-900 dark:text-gray-100">{ids.length}</strong> requisição(ões) ao
        laboratório de apoio? <strong>Isso cria OS reais no Álvaro.</strong>
      </span>,
      async () => {
        setEnviando(true);
        setResultadosEnvio(null);
        try {
          const resultados = await filaHook.enviarAoAlvaro(ids);
          setResultadosEnvio(resultados);
          setSelFila(new Set());
        } catch (err) {
          window.alert(err instanceof Error ? err.message : 'Falha no envio.');
        } finally {
          setEnviando(false);
        }
      },
      { type: 'danger', confirmText: 'Enviar' },
    );
  };

  const confirmarExclusao = (item: ApoioFilaItem) => {
    showConfirmDialog(
      'Remover da fila',
      <span>
        Remover a requisição{' '}
        <strong className="text-gray-900 dark:text-gray-100">{item.numero_requisicao || 'sem número'}</strong>
        {item.paciente?.nome ? ` de ${item.paciente.nome}` : ''}?
      </span>,
      async () => {
        const msg = await filaHook.excluirItem(item.id);
        if (msg) window.alert(`Não foi possível remover: ${msg}`);
      },
      { type: 'danger', confirmText: 'Remover' },
    );
  };

  const confirmarReenvio = (item: ApoioFilaItem) => {
    showConfirmDialog(
      'Voltar para a fila',
      <span>
        Devolver a requisição{' '}
        <strong className="text-gray-900 dark:text-gray-100">{item.numero_requisicao || 'sem número'}</strong> para a
        fila de envio? O erro anterior será limpo.
      </span>,
      async () => {
        const msg = await filaHook.reenviarParaFila(item.id);
        if (msg) window.alert(`Não foi possível reenviar: ${msg}`);
        else setAba('fila');
      },
      { confirmText: 'Voltar para a fila' },
    );
  };

  const confirmarExclusaoCatalogo = (item: ApoioExameCatalogo) => {
    showConfirmDialog(
      'Remover do catálogo',
      <span>
        Remover <strong className="text-gray-900 dark:text-gray-100">{item.cod_exame}</strong> —{' '}
        {item.descricao_exame}?
      </span>,
      async () => {
        const msg = await deleteExame(item.id);
        if (msg) window.alert(`Não foi possível remover: ${msg}`);
      },
      { type: 'danger', confirmText: 'Remover' },
    );
  };

  // ── Abas ──
  const ABAS: { key: Aba; label: string; icon: React.ReactNode; badge?: number }[] = [
    { key: 'nova', label: 'Nova requisição', icon: <ScanLine className="w-4 h-4" /> },
    { key: 'fila', label: 'Fila', icon: <ListChecks className="w-4 h-4" />, badge: filaHook.fila.length },
    { key: 'historico', label: 'Histórico', icon: <History className="w-4 h-4" /> },
    { key: 'catalogo', label: 'Catálogo', icon: <BookOpen className="w-4 h-4" />, badge: catalogo.length },
  ];

  const kpis = useMemo(() => {
    const enviados = filaHook.historico.filter((i) => i.status === 'enviado').length;
    const erros = filaHook.historico.filter((i) => i.status === 'erro').length;
    return { aguardando: filaHook.fila.length, enviados, erros };
  }, [filaHook.fila, filaHook.historico]);

  return (
    <div className="max-w-6xl mx-auto pt-4 sm:pt-6 pb-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center shadow-lg shadow-blue-500/25">
            <Send className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Envio ao Apoio</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Requisições para o laboratório de apoio (Álvaro) · OCR + fila de envio
            </p>
          </div>
        </div>
        <button
          onClick={() => void filaHook.refetch()}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-gray-600 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors self-start"
        >
          <RefreshCw className={`w-4 h-4 ${filaHook.loading ? 'animate-spin' : ''}`} />
          Atualizar
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <Kpi icon={<Clock className="w-5 h-5" />} label="Na fila" valor={kpis.aguardando} cor="from-amber-500 to-orange-500" />
        <Kpi icon={<CheckCircle2 className="w-5 h-5" />} label="Enviados" valor={kpis.enviados} cor="from-emerald-500 to-green-600" />
        <Kpi icon={<XCircle className="w-5 h-5" />} label="Com erro" valor={kpis.erros} cor="from-rose-500 to-red-600" />
      </div>

      {/* Abas */}
      <div className="flex flex-wrap gap-2 mb-6">
        {ABAS.map((a) => (
          <button
            key={a.key}
            onClick={() => setAba(a.key)}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${
              aba === a.key
                ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-md shadow-blue-500/25'
                : 'text-gray-600 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'
            }`}
          >
            {a.icon}
            {a.label}
            {a.badge !== undefined && a.badge > 0 && (
              <span
                className={`px-1.5 py-0.5 text-xs rounded-full ${
                  aba === a.key ? 'bg-white/20' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
                }`}
              >
                {a.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {filaHook.error && (
        <div className="mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 text-sm">
          {filaHook.error}
        </div>
      )}

      {/* ── Aba: Nova requisição ── */}
      {aba === 'nova' && (
        <div className="space-y-5">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
            <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-4">
              Digitalizar requisição médica
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_auto] gap-3 items-end">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Arquivos (foto ou PDF, até {MAX_ARQUIVOS})
                </label>
                <input
                  ref={inputArquivosRef}
                  type="file"
                  multiple
                  accept="image/*,.pdf"
                  onChange={(e) => escolherArquivos(e.target.files)}
                  className="block w-full text-sm text-gray-600 dark:text-gray-300 file:mr-3 file:px-4 file:py-2 file:rounded-xl file:border-0 file:bg-blue-50 file:text-blue-700 dark:file:bg-blue-900/30 dark:file:text-blue-300 file:font-medium file:cursor-pointer hover:file:bg-blue-100 transition-colors"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Nº requisição <span className="text-gray-400">(opcional)</span>
                </label>
                <input
                  value={numeroReq}
                  onChange={(e) => setNumeroReq(e.target.value)}
                  placeholder="Detectado no OCR se vazio"
                  className={inputCls}
                />
              </div>
              <button
                onClick={() => void processar()}
                disabled={!canManage || processando || arquivos.length === 0}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-blue-500 to-blue-600 shadow-md shadow-blue-500/25 hover:from-blue-600 hover:to-blue-700 transition-all duration-200 disabled:opacity-50"
              >
                {processando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                {processando ? 'Processando…' : 'Processar'}
              </button>
            </div>
            {arquivos.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {arquivos.map((f) => (
                  <span
                    key={f.name}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-full"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    {f.name}
                  </span>
                ))}
              </div>
            )}
            {processando && (
              <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">
                OCR via Gemini + conferência no apLIS — pode levar até um minuto…
              </p>
            )}
            {erroNova && (
              <div className="mt-3 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 text-sm">
                {erroNova}
              </div>
            )}
          </div>

          {/* Revisão do resultado */}
          {resultado && (
            <div className="space-y-5 animate-fade-in">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Paciente */}
                <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-5">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Paciente</h3>
                    <span className="px-2 py-0.5 text-xs font-medium bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300 rounded-full">
                      fonte: {resultado.paciente?.fonte ?? '—'}
                    </span>
                  </div>
                  <div className="text-sm text-gray-800 dark:text-gray-200 font-medium mb-3">
                    {resultado.paciente?.nome || 'Não identificado'}
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Sexo</label>
                      <select value={ovSexo} onChange={(e) => setOvSexo(e.target.value)} className={inputCls}>
                        <option value="">{resultado.paciente?.sexo || '—'}</option>
                        <option value="M">M</option>
                        <option value="F">F</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Nascimento</label>
                      <input
                        type="date"
                        value={ovDatanasc}
                        onChange={(e) => setOvDatanasc(e.target.value)}
                        className={inputCls}
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">CPF</label>
                      <input
                        value={ovCpf}
                        onChange={(e) => setOvCpf(e.target.value)}
                        placeholder={resultado.paciente?.cpf || '—'}
                        className={inputCls}
                      />
                    </div>
                  </div>
                  <p className="mt-2 text-xs text-gray-400 dark:text-gray-500">
                    Preencha só o que precisar corrigir — vazio mantém o detectado.
                  </p>
                </div>

                {/* Médico + requisição */}
                <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-5">
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Médico e requisição</h3>
                  <div className="space-y-2 text-sm">
                    <div>
                      <span className="text-gray-500 dark:text-gray-400">Médico:</span>{' '}
                      <span className="text-gray-800 dark:text-gray-200">
                        {resultado.medico?.nome || '—'} {resultado.medico?.crm ? `(${resultado.medico.crm})` : ''}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500 dark:text-gray-400">Nº requisição:</span>{' '}
                      <span className="text-gray-800 dark:text-gray-200">{resultado.numero_requisicao || '—'}</span>
                    </div>
                    <div>
                      <span className="text-gray-500 dark:text-gray-400">Conferência apLIS:</span>{' '}
                      {resultado.resumo?.aplis_consultado ? (
                        <span className="text-emerald-600 dark:text-emerald-400 font-medium">encontrada</span>
                      ) : (
                        <span className="text-amber-600 dark:text-amber-400 font-medium">não encontrada</span>
                      )}
                    </div>
                    {resultado.convenio ? (
                      <div>
                        <span className="text-gray-500 dark:text-gray-400">Convênio:</span>{' '}
                        <span className="text-gray-800 dark:text-gray-200">{String(resultado.convenio)}</span>
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>

              {/* Exames */}
              <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                    Exames extraídos ({resultado.exames_imagem?.length ?? 0}) · selecionados: {selecionados.size}
                  </h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <thead className="bg-gray-50 dark:bg-gray-900/40">
                      <tr>
                        <th className="px-4 py-3 w-10"></th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Exame (imagem)</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Código AOL</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Material</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Origem</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Certeza</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                      {(resultado.exames_imagem ?? []).map((ex, i) => (
                        <tr
                          key={i}
                          onClick={() =>
                            setSelecionados((atual) => {
                              const novo = new Set(atual);
                              if (novo.has(i)) novo.delete(i);
                              else novo.add(i);
                              return novo;
                            })
                          }
                          className={`cursor-pointer transition-colors ${
                            selecionados.has(i)
                              ? 'bg-blue-50/60 dark:bg-blue-900/10 hover:bg-blue-50 dark:hover:bg-blue-900/20'
                              : 'hover:bg-gray-50 dark:hover:bg-gray-700/40 opacity-60'
                          }`}
                        >
                          <td className="px-4 py-3">
                            <input type="checkbox" readOnly checked={selecionados.has(i)} className="rounded" />
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-800 dark:text-gray-200">
                            {ex.nome_original || ex.nome_normalizado || '—'}
                            {ex.nome_pardini && (
                              <div className="text-xs text-gray-400 dark:text-gray-500">{ex.nome_pardini}</div>
                            )}
                          </td>
                          <td className="px-4 py-3 text-sm font-mono text-gray-800 dark:text-gray-200">
                            {ex.codigo_aol_sugerido || <span className="text-red-500">sem código</span>}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                            {ex.desc_material || ex.material || '—'}
                            {ex.cod_material ? ` (${ex.cod_material})` : ''}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                                ex.fonte_codigo === 'sem_match' || ex.fonte_codigo === 'gemini_nao_validado'
                                  ? 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300'
                                  : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300'
                              }`}
                            >
                              {FONTE_LABEL[ex.fonte_codigo ?? ''] ?? ex.fonte_codigo ?? '—'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-right tabular-nums text-gray-600 dark:text-gray-400">
                            {ex.certeza != null ? `${ex.certeza}%` : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {resultado.alvaro_xml_sugerido && (
                <BlocoTexto titulo="XML AOL sugerido (antes das correções)" texto={resultado.alvaro_xml_sugerido} />
              )}
              <LogPipeline log={resultado.log ?? []} />

              <div className="flex justify-end gap-3">
                <button
                  onClick={() => {
                    setResultado(null);
                    setArquivos([]);
                    if (inputArquivosRef.current) inputArquivosRef.current.value = '';
                  }}
                  className="px-5 py-2.5 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-all duration-200 font-medium"
                >
                  Descartar
                </button>
                <button
                  onClick={() => void salvarFila()}
                  disabled={!canManage || salvando || selecionados.size === 0}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-blue-500 to-blue-600 shadow-md shadow-blue-500/25 hover:from-blue-600 hover:to-blue-700 transition-all duration-200 disabled:opacity-50"
                >
                  {salvando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  {salvando ? 'Salvando…' : `Salvar na fila (${selecionados.size})`}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Aba: Fila ── */}
      {aba === 'fila' && (
        <div className="space-y-4">
          {resultadosEnvio && (
            <div className="p-4 rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 space-y-2">
              <div className="text-sm font-semibold text-gray-700 dark:text-gray-300">Resultado do envio</div>
              {resultadosEnvio.map((r) => (
                <div key={r.id} className="flex items-center gap-2 text-sm">
                  {r.ok ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  ) : (
                    <XCircle className="w-4 h-4 text-red-500 shrink-0" />
                  )}
                  <span className="text-gray-700 dark:text-gray-300">
                    {r.ok ? 'Enviado com sucesso' : r.erro || 'Falha no envio'}
                    {r.requisicoes_salvo === false && (
                      <span className="text-amber-600 dark:text-amber-400"> · vínculo da OS não salvo</span>
                    )}
                  </span>
                </div>
              ))}
              <button
                onClick={() => setResultadosEnvio(null)}
                className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                Fechar
              </button>
            </div>
          )}

          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-500 dark:text-gray-400">
              {filaHook.fila.length} item(ns) aguardando envio
            </div>
            {canManage && (
              <button
                onClick={confirmarEnvio}
                disabled={enviando || selFila.size === 0}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-blue-600 to-indigo-700 shadow-md shadow-blue-500/25 hover:scale-[1.02] transition-all duration-200 disabled:opacity-50"
              >
                {enviando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                {enviando ? 'Enviando…' : `Enviar ao Álvaro (${selFila.size})`}
              </button>
            )}
          </div>

          <TabelaFila
            itens={filaHook.fila}
            loading={filaHook.loading}
            vazio="Fila vazia — processe uma requisição na aba “Nova requisição”."
            selecao={selFila}
            onToggle={toggleFila}
            onDetalhe={setDetalhe}
            onExcluir={canManage ? confirmarExclusao : undefined}
          />
        </div>
      )}

      {/* ── Aba: Histórico ── */}
      {aba === 'historico' && (
        <TabelaFila
          itens={filaHook.historico}
          loading={filaHook.loading}
          vazio="Nenhum envio realizado ainda."
          onDetalhe={setDetalhe}
          onReenviar={canManage ? confirmarReenvio : undefined}
        />
      )}

      {/* ── Aba: Catálogo ── */}
      {aba === 'catalogo' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                value={buscaCatalogo}
                onChange={(e) => setBuscaCatalogo(e.target.value)}
                placeholder="Buscar por código, exame ou material…"
                className={`${inputCls} pl-9`}
              />
            </div>
            {canManage && (
              <button
                onClick={() => setCatalogoModal({ aberto: true, item: null })}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-blue-500 to-blue-600 shadow-md shadow-blue-500/25 hover:from-blue-600 hover:to-blue-700 transition-all duration-200"
              >
                <Plus className="w-4 h-4" />
                Novo exame
              </button>
            )}
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-900/40">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Código</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Exame</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Material</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Preço</th>
                    {canManage && <th className="px-4 py-3 w-24"></th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {catalogoFiltrado.map((e) => (
                    <tr key={e.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/40 transition-colors">
                      <td className="px-4 py-3 text-sm font-mono font-medium text-gray-800 dark:text-gray-200">{e.cod_exame}</td>
                      <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{e.descricao_exame}</td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                        {e.descricao_material || '—'}
                        {e.cod_material ? ` (${e.cod_material})` : ''}
                      </td>
                      <td className="px-4 py-3 text-sm text-right tabular-nums text-gray-600 dark:text-gray-400">
                        {e.preco != null ? `R$ ${Number(e.preco).toFixed(2).replace('.', ',')}` : '—'}
                      </td>
                      {canManage && (
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => setCatalogoModal({ aberto: true, item: e })}
                              className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                              title="Editar"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => confirmarExclusaoCatalogo(e)}
                              className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                              title="Remover"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                  {catalogoFiltrado.length === 0 && (
                    <tr>
                      <td colSpan={canManage ? 5 : 4} className="px-4 py-10 text-center text-sm text-gray-400">
                        Nenhum exame encontrado.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Modais */}
      {detalhe && <DetalheItemModal item={detalhe} onClose={() => setDetalhe(null)} />}
      {catalogoModal.aberto && (
        <CatalogoModal
          inicial={catalogoModal.item}
          onClose={() => setCatalogoModal({ aberto: false, item: null })}
          onSave={upsertExame}
        />
      )}

      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        title={confirmDialog.title}
        message={confirmDialog.message}
        confirmText={confirmDialog.confirmText}
        cancelText={confirmDialog.cancelText}
        type={confirmDialog.type}
        onConfirm={handleConfirmDialogConfirm}
        onCancel={hideConfirmDialog}
      />
    </div>
  );
};

// ─── Tabela compartilhada da fila/histórico ─────────────────────────────────────

const TabelaFila: React.FC<{
  itens: ApoioFilaItem[];
  loading: boolean;
  vazio: string;
  selecao?: Set<string>;
  onToggle?: (id: string) => void;
  onDetalhe: (item: ApoioFilaItem) => void;
  onExcluir?: (item: ApoioFilaItem) => void;
  onReenviar?: (item: ApoioFilaItem) => void;
}> = ({ itens, loading, vazio, selecao, onToggle, onDetalhe, onExcluir, onReenviar }) => {
  if (loading && itens.length === 0) {
    return (
      <div className="flex items-center justify-center py-16 text-gray-400">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }
  if (itens.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 py-14 text-center text-sm text-gray-400">
        {vazio}
      </div>
    );
  }
  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-900/40">
            <tr>
              {onToggle && <th className="px-4 py-3 w-10"></th>}
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Requisição</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Paciente</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Exames</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Status</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Atualizado</th>
              <th className="px-4 py-3 w-28"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {itens.map((item) => (
              <tr
                key={item.id}
                onClick={onToggle ? () => onToggle(item.id) : undefined}
                className={`transition-colors ${onToggle ? 'cursor-pointer' : ''} ${
                  selecao?.has(item.id)
                    ? 'bg-blue-50/60 dark:bg-blue-900/10 hover:bg-blue-50 dark:hover:bg-blue-900/20'
                    : 'hover:bg-gray-50 dark:hover:bg-gray-700/40'
                }`}
              >
                {onToggle && (
                  <td className="px-4 py-3">
                    <input type="checkbox" readOnly checked={selecao?.has(item.id) ?? false} className="rounded" />
                  </td>
                )}
                <td className="px-4 py-3 text-sm font-mono text-gray-800 dark:text-gray-200">
                  {item.numero_requisicao || '—'}
                </td>
                <td className="px-4 py-3 text-sm text-gray-800 dark:text-gray-200">{item.paciente?.nome || '—'}</td>
                <td className="px-4 py-3 text-sm tabular-nums text-gray-600 dark:text-gray-400">
                  {item.exames?.length ?? 0}
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={item.status} />
                  {item.erro_mensagem && (
                    <div className="mt-1 text-xs text-red-500 max-w-56 truncate" title={item.erro_mensagem}>
                      {item.erro_mensagem}
                    </div>
                  )}
                </td>
                <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">{fmtDataHora(item.updated_at)}</td>
                <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center justify-end gap-1">
                    <button
                      onClick={() => onDetalhe(item)}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                      title="Ver detalhes"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    {onReenviar && item.status === 'erro' && (
                      <button
                        onClick={() => onReenviar(item)}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors"
                        title="Voltar para a fila"
                      >
                        <RotateCcw className="w-4 h-4" />
                      </button>
                    )}
                    {onExcluir && (
                      <button
                        onClick={() => onExcluir(item)}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                        title="Remover"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default EnvioApoioPage;
