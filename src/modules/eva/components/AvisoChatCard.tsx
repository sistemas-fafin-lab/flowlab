import React, { useState } from 'react';
import { CheckCircle2, Clock, Loader2, MessageCircle, Users } from 'lucide-react';
import { hojeSP } from '../domain/datas';
import { primeiroNome } from '../domain/pessoas';
import { quandoSera, rotuloDoGrupo } from '../domain/whatsapp';
import type { AvisoEva } from '../types';

interface Props {
  a: AvisoEva;
  /** A pessoa não tem WhatsApp: o aviso vai para o grupo da equipe, citando o nome (D35). */
  grupo?: { nome: string | null } | null;
  onEnviar: (texto: string) => void;
  onDescartar: () => void;
}

/** Até onde o texto do aviso pode ir (o mesmo teto do servidor, api/_lib/ti-agente/aviso.ts). */
const MAX_TEXTO = 1000;

/**
 * Aviso pelo WhatsApp preparado pela EVA no chat (D32). O gestor confere (e pode editar) o texto;
 * nada sai antes de "Enviar". A mensagem chega como "📢 Aviso de <quem pediu>: …"; no grupo, para
 * quem não tem WhatsApp, "📢 Aviso de <quem pediu> para <pessoa>: …" (D35).
 */
export const AvisoChatCard: React.FC<Props> = ({ a, grupo = null, onEnviar, onDescartar }) => {
  const [texto, setTexto] = useState(a.texto);
  const enviando = a.estado === 'enviando';
  const para = primeiroNome(a.nome) || a.nome;
  // Depois de enviado, vale o que o servidor fez; antes, o que o Início sabe da aba Membros.
  const noGrupo = a.estado === 'enviado' ? !!a.noGrupo : !!grupo;
  const ondeNoGrupo = noGrupo ? `, no ${rotuloDoGrupo(a.estado === 'enviado' ? a.grupoNome : grupo?.nome)}` : '';
  return (
    <div className={`mt-1 rounded-2xl border px-3.5 py-3 text-[12px] ${a.estado === 'descartado' ? 'opacity-60 border-slate-200 dark:border-slate-700' : 'border-emerald-200/80 dark:border-emerald-500/30 bg-emerald-50/40 dark:bg-emerald-500/[.06]'}`}>
      <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
        {noGrupo ? <Users className="w-3.5 h-3.5" /> : <MessageCircle className="w-3.5 h-3.5" />}
        {noGrupo ? 'Aviso no grupo' : 'Aviso pelo WhatsApp'} · para {para}
      </p>
      {noGrupo && (a.estado === 'aberto' || enviando) && (
        <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
          {para} não tem WhatsApp na aba Membros: o aviso vai para o {rotuloDoGrupo(grupo?.nome)}, citando o nome.
        </p>
      )}

      {(a.estado === 'aberto' || enviando) ? (
        <textarea
          value={texto}
          onChange={(e) => setTexto(e.target.value.slice(0, MAX_TEXTO))}
          disabled={enviando}
          rows={Math.min(6, Math.max(2, Math.ceil(texto.length / 48)))}
          aria-label={`Texto do aviso para ${para}`}
          className="mt-2 w-full resize-y rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-[13px] text-slate-800 dark:text-slate-100 outline-none focus:border-emerald-500/60 disabled:opacity-60"
        />
      ) : (
        <p className="mt-2 whitespace-pre-line text-[13px] text-slate-700 dark:text-slate-200">{a.texto}</p>
      )}

      {a.erro && <p className="mt-2 text-[11px] text-red-600 dark:text-red-400">{a.erro}</p>}

      {(a.estado === 'aberto' || enviando) && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => onEnviar(texto)}
            disabled={enviando || !texto.trim()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-emerald-500 to-green-600 text-white text-[12px] font-semibold shadow-md shadow-emerald-500/25 active:scale-[.98] transition disabled:opacity-60"
          >
            {enviando && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {noGrupo ? 'Enviar no grupo' : 'Enviar pelo WhatsApp'}
          </button>
          <button
            type="button"
            onClick={onDescartar}
            disabled={enviando}
            className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-[12px] font-medium text-slate-600 dark:text-slate-300 transition disabled:opacity-60"
          >
            Descartar
          </button>
        </div>
      )}
      {a.estado === 'enviado' && !a.agendadaPara && (
        <p className="mt-2.5 flex items-center gap-1.5 text-[12px] font-medium text-emerald-600 dark:text-emerald-400">
          <CheckCircle2 className="w-3.5 h-3.5" /> Na fila do WhatsApp: sai em instantes{ondeNoGrupo}.
        </p>
      )}
      {a.estado === 'enviado' && a.agendadaPara && (
        <p className="mt-2.5 flex items-center gap-1.5 text-[12px] font-medium text-slate-600 dark:text-slate-300">
          <Clock className="w-3.5 h-3.5" /> Fora do horário da EVA: sai {quandoSera(a.agendadaPara, hojeSP())}{ondeNoGrupo}.
        </p>
      )}
      {a.estado === 'descartado' && <p className="mt-2 text-[11px] text-slate-500">Descartado. Nada foi enviado.</p>}
    </div>
  );
};
