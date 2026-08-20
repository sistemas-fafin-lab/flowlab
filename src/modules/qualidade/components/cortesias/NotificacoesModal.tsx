import type { NotificacaoCortesiaDTO } from '../../types';
import { Gift, X } from 'lucide-react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';

interface NotificacoesModalProps {
  notificacoes: NotificacaoCortesiaDTO[];
  carregando: boolean;
  agora: number;
  onFechar: () => void;
  /** Marca tudo como lido (zera o badge) sem fechar o modal — diferente de `onFechar`. */
  onLimpar: () => void;
}

/** Puro — recebe "agora" como parâmetro em vez de ler o relógio, só para não esconder a dependência do tempo dentro da função. */
export function formatarTempoRelativo(sincronizadoEm: string, agora: number): string {
  const diffMs = agora - new Date(sincronizadoEm).getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return 'agora mesmo';
  if (diffMin < 60) return `há ${diffMin} min`;
  const diffHoras = Math.floor(diffMin / 60);
  if (diffHoras < 24) return `há ${diffHoras}h`;
  const diffDias = Math.floor(diffHoras / 24);
  return `há ${diffDias}d`;
}

export function NotificacoesModal({ notificacoes, carregando, agora, onFechar, onLimpar }: NotificacoesModalProps) {
  const navigate = useNavigate();

  function abrirCortesia(id: string) {
    onFechar();
    navigate(`/qualidade/cortesias?abrir=${id}`);
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-start justify-center px-4 pt-20 sm:pt-24" role="dialog" aria-modal="true" aria-label="Notificações">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onFechar} />
      <div className="glass-surface relative flex max-h-[70vh] w-full max-w-md flex-col rounded-2xl border border-slate-200/50 bg-white/95 shadow-2xl dark:border-white/10 dark:bg-gray-800/95">
        <div className="flex items-center justify-between gap-3 border-b border-gray-100 px-4 py-3 dark:border-white/10">
          <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Notificações</h2>
          <div className="flex items-center gap-1">
            {notificacoes.length > 0 && (
              <button
                type="button"
                onClick={onLimpar}
                className="rounded-full px-2.5 py-1 text-xs font-medium text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:text-slate-400 dark:hover:bg-white/5 dark:hover:text-slate-200"
              >
                Limpar
              </button>
            )}
            <button
              type="button"
              onClick={onFechar}
              aria-label="Fechar notificações"
              className="flex h-7 w-7 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100 dark:text-slate-400 dark:hover:bg-white/5"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          {carregando && <p className="px-3 py-4 text-sm text-gray-500 dark:text-slate-400">Carregando…</p>}
          {!carregando && notificacoes.length === 0 && (
            <p className="px-3 py-4 text-sm text-gray-500 dark:text-slate-400">Nenhuma cortesia concedida recentemente.</p>
          )}
          {!carregando &&
            notificacoes.map((n) => (
              <button
                key={n.id}
                type="button"
                onClick={() => abrirCortesia(n.id)}
                className="flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-gray-50 dark:hover:bg-white/5"
              >
                <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-blue-400 to-blue-600 shadow-lg shadow-blue-500/30">
                  <Gift className="h-4 w-4 text-white" aria-hidden />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-slate-700 dark:text-slate-200">
                    Cortesia concedida{n.clinicaNome ? ` — ${n.clinicaNome}` : ''}
                  </p>
                  <p className="truncate text-xs text-gray-500 dark:text-slate-400">
                    {n.exameNome ?? '—'} · Requisição {n.codRequisicao}
                  </p>
                  <p className="truncate text-xs text-gray-500 dark:text-slate-400">
                    Autorizado por {n.autorizadoPor ?? '—'}
                  </p>
                  <p className="mt-0.5 text-xs text-gray-400 dark:text-slate-500">{formatarTempoRelativo(n.sincronizadoEm, agora)}</p>
                </div>
              </button>
            ))}
        </div>
      </div>
    </div>,
    document.body,
  );
}
