import React, { useEffect, useMemo, useState } from 'react';
import { X, Search, Loader2, FileText, RefreshCw, Download, ChevronLeft, Check } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { useDocumentosAgendamento } from '../hooks/useDocumentosAgendamento';
import { isImagem, type AcAgendamentoStatus, type DocumentoCheckin } from '../types';

// Importa documentos já anexados a um agendamento (pedido médico, guia…) para a
// tela de Envio ao Álvaro, sem re-fotografar. Os bytes vivem no LAB-HUB; o proxy
// get-documentos devolve signed URLs (~15min) e o download acontece no navegador —
// os arquivos entram no mesmo fluxo do upload manual (bucket ac-apoio-requisicoes).

const fmtDataHora = (iso: string) =>
  new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });

const normalizarBusca = (texto: string) =>
  texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

// Mesmas cores dos chips do AgendamentosPage — status igual em toda parte.
const STATUS_CHIP: Record<string, { label: string; chip: string }> = {
  recebido: {
    label: 'Recebido',
    chip: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-800/60',
  },
  em_coleta: {
    label: 'Em coleta',
    chip: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-800/60',
  },
  coletado: {
    label: 'Coletado',
    chip: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-300 dark:border-emerald-800/60',
  },
  bloqueado: {
    label: 'Bloqueado',
    chip: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-300 dark:border-red-800/60',
  },
  cancelado: {
    label: 'Cancelado',
    chip: 'bg-gray-100 text-gray-600 border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700',
  },
};

const CHIP_PADRAO = 'bg-gray-100 text-gray-600 border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700';

const TIPO_LABEL: Record<string, string> = {
  identidade: 'Identidade',
  carteirinha: 'Carteirinha',
  pedido_medico: 'Pedido médico',
};

// Só os campos que a listagem usa — evita depender do shape completo de AcAgendamento.
interface AgendamentoResumo {
  id: string;
  paciente_nome: string;
  data_hora: string;
  status: AcAgendamentoStatus;
  local_posto: string;
}

const importavel = (doc: DocumentoCheckin): boolean =>
  isImagem(doc.mimeType) || doc.mimeType === 'application/pdf';

// ─── Passo 2: documentos do agendamento selecionado ─────────────────────────────

const DocumentosDoAgendamento: React.FC<{
  agendamento: AgendamentoResumo;
  vagas: number;
  onImportar: (files: File[]) => void;
  onVoltar: () => void;
}> = ({ agendamento, vagas, onImportar, onVoltar }) => {
  const { documentos, loading, error, expirado, refetch } = useDocumentosAgendamento(agendamento.id);
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [baixando, setBaixando] = useState(false);
  const [erroImport, setErroImport] = useState<string | null>(null);

  // Pré-seleciona os pedidos médicos — é o que o OCR precisa; o resto fica à mão.
  useEffect(() => {
    const pedidos = documentos
      .filter((d) => importavel(d) && d.tipo === 'pedido_medico')
      .slice(0, vagas)
      .map((d) => d.id);
    setSelecionados(new Set(pedidos));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documentos]);

  const toggle = (doc: DocumentoCheckin) => {
    setSelecionados((atual) => {
      const novo = new Set(atual);
      if (novo.has(doc.id)) novo.delete(doc.id);
      else if (novo.size < vagas) novo.add(doc.id);
      return novo;
    });
  };

  const importar = async () => {
    setBaixando(true);
    setErroImport(null);
    try {
      const escolhidos = documentos.filter((d) => selecionados.has(d.id));
      const files: File[] = [];
      for (const doc of escolhidos) {
        const resp = await fetch(doc.url);
        if (!resp.ok) {
          throw new Error(`Falha ao baixar ${doc.nomeArquivo} — o link pode ter expirado, atualize.`);
        }
        const blob = await resp.blob();
        files.push(new File([blob], doc.nomeArquivo, { type: doc.mimeType || blob.type }));
      }
      onImportar(files);
    } catch (err) {
      setErroImport(err instanceof Error ? err.message : 'Falha ao baixar os documentos.');
    } finally {
      setBaixando(false);
    }
  };

  return (
    <>
      <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center gap-3">
        <button
          onClick={onVoltar}
          className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500"
          title="Voltar à lista"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div className="min-w-0">
          <div className="font-semibold text-gray-900 dark:text-gray-100 truncate">
            {agendamento.paciente_nome}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">
            {fmtDataHora(agendamento.data_hora)} · {agendamento.local_posto}
          </div>
        </div>
        <button
          onClick={() => void refetch()}
          className="ml-auto p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500"
          title="Atualizar links"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="px-6 py-5 overflow-y-auto flex-1 space-y-3">
        {loading && (
          <div className="flex items-center justify-center py-10 text-gray-400">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
        )}
        {(error || erroImport) && (
          <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 text-sm">
            {error || erroImport}
          </div>
        )}
        {expirado && !loading && (
          <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 text-sm">
            Os links dos documentos expiraram — clique em atualizar.
          </div>
        )}
        {!loading && !error && documentos.length === 0 && (
          <div className="py-10 text-center text-sm text-gray-400">
            Nenhum documento anexado a este agendamento.
          </div>
        )}

        {!loading &&
          documentos.map((doc) => {
            const podeImportar = importavel(doc);
            const marcado = selecionados.has(doc.id);
            return (
              <button
                key={doc.id}
                onClick={() => podeImportar && toggle(doc)}
                disabled={!podeImportar}
                className={`w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-colors ${
                  marcado
                    ? 'border-blue-400 bg-blue-50/60 dark:bg-blue-900/15 dark:border-blue-600'
                    : 'border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-700'
                } ${podeImportar ? '' : 'opacity-50 cursor-not-allowed'}`}
              >
                <span
                  className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition-colors ${
                    marcado
                      ? 'bg-blue-600 border-blue-600 text-white'
                      : 'border-gray-300 dark:border-gray-600 bg-transparent'
                  }`}
                >
                  {marcado && <Check className="w-3.5 h-3.5" strokeWidth={3} />}
                </span>
                {isImagem(doc.mimeType) ? (
                  <img
                    src={doc.url}
                    alt={doc.nomeArquivo}
                    loading="lazy"
                    className="w-12 h-12 rounded-lg object-cover ring-1 ring-gray-200 dark:ring-gray-600 shrink-0"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center shrink-0">
                    <FileText className="w-5 h-5 text-gray-400" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">
                    {doc.nomeArquivo}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    {TIPO_LABEL[doc.tipo] ?? doc.tipo}
                    {!podeImportar && ' · formato não aceito'}
                  </div>
                </div>
              </button>
            );
          })}
      </div>

      <div className="px-6 py-4 bg-gray-50 dark:bg-gray-900/40 rounded-b-2xl flex items-center justify-between gap-3">
        <span className="text-xs text-gray-400 dark:text-gray-500">
          {vagas} vaga(s) restante(s) para arquivos
        </span>
        <button
          onClick={() => void importar()}
          disabled={baixando || selecionados.size === 0}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-blue-500 to-blue-600 shadow-md shadow-blue-500/25 hover:from-blue-600 hover:to-blue-700 transition-all duration-200 disabled:opacity-50"
        >
          {baixando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
          {baixando ? 'Baixando…' : `Importar (${selecionados.size})`}
        </button>
      </div>
    </>
  );
};

// ─── Modal ──────────────────────────────────────────────────────────────────────

const ApoioImportarAgendamentoModal: React.FC<{
  vagas: number;
  onImportar: (files: File[]) => void;
  onClose: () => void;
}> = ({ vagas, onImportar, onClose }) => {
  const [agendamentos, setAgendamentos] = useState<AgendamentoResumo[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [busca, setBusca] = useState('');
  const [selecionado, setSelecionado] = useState<AgendamentoResumo | null>(null);

  useEffect(() => {
    const carregar = async () => {
      setLoading(true);
      setErro(null);
      // Só agendamentos vindos do LAB-HUB podem ter documentos (labhub_id é a chave
      // do bucket de lá); nativos do FlowLab ficariam sempre vazios.
      const { data, error } = await supabase
        .from('ac_agendamentos')
        .select('id, paciente_nome, data_hora, status, local_posto')
        .not('labhub_id', 'is', null)
        .order('data_hora', { ascending: false })
        .limit(50);
      if (error) setErro(error.message);
      else setAgendamentos((data ?? []) as AgendamentoResumo[]);
      setLoading(false);
    };
    void carregar();
  }, []);

  const filtrados = useMemo(() => {
    const q = normalizarBusca(busca.trim());
    if (!q) return agendamentos;
    return agendamentos.filter((a) => normalizarBusca(a.paciente_nome).includes(q));
  }, [agendamentos, busca]);

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[85vh] flex flex-col">
        {selecionado ? (
          <DocumentosDoAgendamento
            agendamento={selecionado}
            vagas={vagas}
            onImportar={onImportar}
            onVoltar={() => setSelecionado(null)}
          />
        ) : (
          <>
            <div className="px-6 py-5 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between gap-3">
              <div>
                <h3 className="font-bold text-gray-900 dark:text-gray-100">Importar do agendamento</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Use documentos já anexados (pedido médico, guia) como imagens da requisição.
                </p>
              </div>
              <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="px-6 pt-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  placeholder="Buscar por nome do paciente…"
                  autoFocus
                  className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Altura fixa de ~5 agendamentos: o modal não pula de tamanho e o resto rola. */}
            <div className="px-6 py-4 overflow-y-auto h-[22rem] space-y-2">
              {loading && (
                <div className="flex items-center justify-center py-10 text-gray-400">
                  <Loader2 className="w-6 h-6 animate-spin" />
                </div>
              )}
              {erro && (
                <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 text-sm">
                  {erro}
                </div>
              )}
              {!loading && !erro && filtrados.length === 0 && (
                <div className="py-10 text-center text-sm text-gray-400">
                  Nenhum agendamento encontrado.
                </div>
              )}
              {!loading &&
                filtrados.map((a) => (
                  <button
                    key={a.id}
                    onClick={() => setSelecionado(a)}
                    className="w-full flex items-center gap-3 p-3 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-700 hover:bg-blue-50/40 dark:hover:bg-blue-900/10 text-left transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">
                        {a.paciente_nome}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        {fmtDataHora(a.data_hora)} · {a.local_posto}
                      </div>
                    </div>
                    <span
                      className={`px-2.5 py-1 text-xs font-semibold rounded-full border whitespace-nowrap shrink-0 ${
                        STATUS_CHIP[a.status]?.chip ?? CHIP_PADRAO
                      }`}
                    >
                      {STATUS_CHIP[a.status]?.label ?? a.status}
                    </span>
                  </button>
                ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default ApoioImportarAgendamentoModal;
