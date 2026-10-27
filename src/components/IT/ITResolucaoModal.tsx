import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2, Loader2, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { descartarAnexosIT, enviarAnexosIT } from '../../lib/itStorage';
import { useAuth } from '../../hooks/useAuth';
import { useNotificationCenter } from '../../hooks/useNotificationCenter';
import { IT_REQUESTS_PATH, itRequestUrl } from '../../utils/itRequestLink';
import { juntarAnexos, nomearCapturasColadas } from '../../utils/itAnexos';
import {
  RESOLUCAO_MAX_CARACTERES,
  blocoResolucaoEmail,
  validarResolucao,
} from '../../utils/itResolucao';
import { AnexosPendentes, ZonaAnexos } from './ITAnexos';

// Modal "Resolver chamado": o único caminho das telas para levar um chamado a
// "Resolvido" (tela de Solicitações, drawer e Kanban). Pede o texto de resolução,
// aceita anexos, grava tudo pela RPC it_resolver_chamado e avisa o solicitante.

// Cooldown anti-spam: no máximo 1 email de mudança de status a cada 5 min por chamado.
const STATUS_EMAIL_COOLDOWN_MS = 5 * 60 * 1000;

export interface ChamadoParaResolver {
  id: string;
  codigo: string;
  title: string;
  requested_by: string;
  requester_name?: string | null;
  last_status_email_at?: string | null;
}

export interface ResultadoResolucao {
  status: 'resolved';
  kanban_status: string;
  resolution: string;
  resolved_at: string | null;
  resolved_by: string | null;
  last_status_email_at?: string | null;
}

interface ITResolucaoModalProps {
  /** null = fechado */
  chamado: ChamadoParaResolver | null;
  /** também move o card para "Concluído" (Kanban) */
  concluirCard?: boolean;
  onClose: () => void;
  onResolvido: (resultado: ResultadoResolucao) => void;
}

const ITResolucaoModal: React.FC<ITResolucaoModalProps> = ({ chamado, concluirCard = false, onClose, onResolvido }) =>
  ReactDOM.createPortal(
    <AnimatePresence>
      {chamado && (
        <ConteudoResolucao
          key={chamado.id}
          chamado={chamado}
          concluirCard={concluirCard}
          onClose={onClose}
          onResolvido={onResolvido}
        />
      )}
    </AnimatePresence>,
    document.body,
  );

const ConteudoResolucao: React.FC<Omit<ITResolucaoModalProps, 'chamado'> & { chamado: ChamadoParaResolver }> = ({
  chamado,
  concluirCard,
  onClose,
  onResolvido,
}) => {
  const { userProfile } = useAuth();
  const userId = userProfile?.id ?? '';
  const { sendNotification } = useNotificationCenter();
  const [texto, setTexto] = useState('');
  const [arquivos, setArquivos] = useState<File[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [tentouEnviar, setTentouEnviar] = useState(false);
  const [salvando, setSalvando] = useState(false);

  const erroTexto = validarResolucao(texto);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !salvando) onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose, salvando]);

  const adicionar = (novos: File[]) => {
    const { arquivos: proximos, erros } = juntarAnexos(arquivos, novos);
    setArquivos(proximos);
    setErro(erros[0] ?? null);
  };

  const notificarSolicitante = async (resolucao: string, qtdAnexos: number): Promise<string | null> => {
    const { data: solicitante } = await supabase
      .from('user_profiles')
      .select('email, name')
      .eq('id', chamado.requested_by)
      .single();

    const ultimoEmail = chamado.last_status_email_at ? new Date(chamado.last_status_email_at).getTime() : 0;
    const enviarEmail = !!solicitante?.email && Date.now() - ultimoEmail >= STATUS_EMAIL_COOLDOWN_MS;
    const trecho = resolucao.length > 140 ? `${resolucao.slice(0, 140).trimEnd()}…` : resolucao;

    await sendNotification({
      userId: chamado.requested_by,
      title: 'Chamado de TI resolvido',
      content: `O chamado ${chamado.codigo} foi resolvido: ${trecho}`,
      module: 'IT',
      type: 'success',
      link: IT_REQUESTS_PATH,
      sendEmail: enviarEmail,
      emailData: enviarEmail
        ? {
            to: solicitante!.email,
            templateSlug: 'it_ticket_resolved',
            variables: {
              user_name: solicitante!.name || chamado.requester_name || 'Usuário',
              ticket_code: chamado.codigo,
              ticket_title: chamado.title,
              status_label: 'Resolvido',
              action_url: itRequestUrl(chamado.id),
              resolution_block: blocoResolucaoEmail(resolucao, qtdAnexos),
            },
          }
        : undefined,
    });

    if (!enviarEmail) return null;
    // Registra o envio para o cooldown (otimista — evita reenvio em rajada)
    const agora = new Date().toISOString();
    await supabase.from('it_requests').update({ last_status_email_at: agora }).eq('id', chamado.id);
    return agora;
  };

  const resolver = async () => {
    setTentouEnviar(true);
    if (erroTexto || !userId) return;
    setSalvando(true);
    setErro(null);
    const resolucao = texto.trim();
    let anexos: Awaited<ReturnType<typeof enviarAnexosIT>> = [];
    try {
      anexos = await enviarAnexosIT(arquivos, userId, chamado.id);
      const { data, error } = await supabase.rpc('it_resolver_chamado', {
        p_id: chamado.id,
        p_resolucao: resolucao,
        p_anexos: anexos,
        p_concluir_card: concluirCard,
      });
      if (error) throw new Error(error.message);
      const linha = (Array.isArray(data) ? data[0] : data) as Partial<ResultadoResolucao> | null;

      let ultimoEmail: string | null = null;
      try {
        ultimoEmail = await notificarSolicitante(resolucao, anexos.length);
      } catch (notifyErr) {
        console.error('Erro ao notificar solicitante sobre a resolução:', notifyErr);
      }

      onResolvido({
        status: 'resolved',
        kanban_status: linha?.kanban_status ?? (concluirCard ? 'done' : ''),
        resolution: linha?.resolution ?? resolucao,
        resolved_at: linha?.resolved_at ?? new Date().toISOString(),
        resolved_by: linha?.resolved_by ?? userId,
        ...(ultimoEmail ? { last_status_email_at: ultimoEmail } : {}),
      });
    } catch (e) {
      await descartarAnexosIT(anexos);
      setErro(e instanceof Error ? e.message : 'Não foi possível resolver o chamado. Tente de novo.');
      setSalvando(false);
    }
  };

  const mostrarErroTexto = tentouEnviar && erroTexto;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={() => !salvando && onClose()}
      style={{ zIndex: 400 }}
      className="fixed inset-0 bg-slate-900/30 dark:bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
    >
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-labelledby="resolver-chamado-titulo"
        initial={{ opacity: 0, scale: 0.96, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 16 }}
        transition={{ duration: 0.22, ease: [0.32, 0.72, 0, 1] }}
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-xl max-h-[90vh] flex flex-col overflow-hidden bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl border border-white/60 dark:border-slate-700/60 rounded-3xl shadow-2xl shadow-black/20"
      >
        <div className="absolute -right-12 -top-12 w-44 h-44 rounded-full blur-3xl opacity-20 bg-emerald-500 pointer-events-none" />

        {/* Cabeçalho */}
        <div className="relative flex items-start gap-4 px-6 pt-6 pb-4">
          <div className="relative flex-shrink-0">
            <div className="absolute inset-0 bg-emerald-500 rounded-2xl blur-lg opacity-40" />
            <div className="relative w-11 h-11 bg-gradient-to-br from-emerald-500 to-green-600 rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-500/30">
              <CheckCircle2 className="w-5 h-5 text-white" />
            </div>
          </div>
          <div className="min-w-0 flex-1">
            <h3 id="resolver-chamado-titulo" className="text-lg font-bold tracking-tight text-slate-900 dark:text-white">
              Resolver chamado
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 truncate">
              <span className="font-mono font-semibold text-violet-600 dark:text-violet-400">{chamado.codigo}</span>
              <span className="mx-1.5 text-slate-300 dark:text-slate-600">·</span>
              {chamado.title}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={salvando}
            aria-label="Fechar"
            className="p-2 -mr-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Corpo */}
        <div className="relative flex-1 overflow-y-auto custom-scrollbar px-6 pb-2 space-y-5">
          <div>
            <div className="flex items-baseline justify-between mb-1.5">
              <label htmlFor="resolucao-texto" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                O que foi feito? <span className="text-red-500">*</span>
              </label>
              <span
                className={`text-[11px] tabular-nums ${
                  texto.trim().length > RESOLUCAO_MAX_CARACTERES ? 'text-red-500' : 'text-slate-400'
                }`}
              >
                {texto.trim().length}/{RESOLUCAO_MAX_CARACTERES}
              </span>
            </div>
            <textarea
              id="resolucao-texto"
              autoFocus
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              onPaste={(e) => {
                const colados = nomearCapturasColadas(Array.from(e.clipboardData.files));
                if (colados.length) {
                  e.preventDefault();
                  adicionar(colados);
                }
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                  e.preventDefault();
                  resolver();
                }
              }}
              disabled={salvando}
              rows={5}
              placeholder="Ex.: Reinstalei o driver da impressora e testei a impressão com o usuário."
              aria-invalid={!!mostrarErroTexto}
              className={`w-full resize-none min-h-[130px] bg-slate-50/60 dark:bg-slate-800/50 border rounded-2xl px-4 py-3 text-sm text-slate-800 dark:text-slate-100 placeholder-slate-400 leading-relaxed focus:outline-none focus:bg-white dark:focus:bg-slate-900 focus:ring-4 transition-all ${
                mostrarErroTexto
                  ? 'border-red-400 focus:ring-red-500/10 focus:border-red-500'
                  : 'border-slate-200 dark:border-slate-700 focus:ring-emerald-500/10 focus:border-emerald-500'
              }`}
            />
            {mostrarErroTexto ? (
              <p className="text-xs text-red-600 dark:text-red-400 mt-1.5">{erroTexto}</p>
            ) : (
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-1.5">
                O solicitante vê este texto no chamado e no e-mail de conclusão.
              </p>
            )}
          </div>

          <div className="space-y-2.5">
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Anexos <span className="text-slate-400 font-normal">(opcional)</span>
            </p>
            <ZonaAnexos onArquivos={adicionar} disabled={salvando} />
            <AnexosPendentes
              arquivos={arquivos}
              onRemover={(i) => setArquivos((atuais) => atuais.filter((_, j) => j !== i))}
              disabled={salvando}
            />
          </div>

          {erro && (
            <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200/70 dark:border-red-800/50 rounded-xl px-3 py-2">
              {erro}
            </p>
          )}
        </div>

        {/* Rodapé */}
        <div className="relative flex items-center justify-between gap-3 px-6 py-4 mt-2 border-t border-slate-200/60 dark:border-slate-800/60 bg-slate-50/40 dark:bg-slate-900/40">
          <span className="hidden sm:inline text-[11px] text-slate-400">Ctrl + Enter para confirmar</span>
          <div className="flex items-center gap-2 ml-auto">
            <button
              type="button"
              onClick={onClose}
              disabled={salvando}
              className="px-4 py-2.5 text-sm font-medium text-slate-600 dark:text-slate-300 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50 transition-all"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={resolver}
              disabled={salvando}
              className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white rounded-xl bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 shadow-lg shadow-emerald-500/25 disabled:opacity-60 transition-all"
            >
              {salvando ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              {salvando ? 'Resolvendo…' : 'Marcar como resolvido'}
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default ITResolucaoModal;
