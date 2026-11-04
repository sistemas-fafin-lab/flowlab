import React, { useState } from 'react';
import { AlertTriangle, CheckCircle2, Clock, Loader2, Users } from 'lucide-react';
import { hojeSP } from '../domain/datas';
import { juntarNomes, primeiroNome } from '../domain/pessoas';
import { quandoSera, rotuloDoGrupo } from '../domain/whatsapp';
import type { AvisoEva, PreviaEquipe } from '../types';

interface Props {
  a: AvisoEva;
  onEnviar: (texto: string) => void;
  onDescartar: () => void;
}

/** Até onde o texto do aviso pode ir (o mesmo teto do servidor, api/_lib/ti-agente/aviso.ts). */
const MAX_TEXTO = 1000;

const SEM_PREVIA: PreviaEquipe = { privado: [], citadosNoGrupo: [], grupoNome: null, semDestino: [] };
const nomes = (xs: string[]) => juntarNomes(xs.map((n) => primeiroNome(n) || n));
const pessoas = (n: number) => (n === 1 ? '1 pessoa' : `${n} pessoas`);

/**
 * Aviso para a equipe toda, preparado pela EVA no chat (D36). Mostra quem recebe no privado, quem
 * vai citado no grupo por não ter WhatsApp (D35) e quem fica de fora. O gestor confere (e pode
 * editar) o texto; nada sai antes de "Enviar para todos".
 */
export const AvisoEquipeChatCard: React.FC<Props> = ({ a, onEnviar, onDescartar }) => {
  const [texto, setTexto] = useState(a.texto);
  const enviando = a.estado === 'enviando';
  const aberto = a.estado === 'aberto' || enviando;
  const e = a.equipe ?? SEM_PREVIA;
  const alcance = e.privado.length + e.citadosNoGrupo.length;
  const destinos = [
    e.privado.length ? pessoas(e.privado.length) : null,
    e.citadosNoGrupo.length ? `o ${rotuloDoGrupo(e.grupoNome)}` : null,
  ].filter((x): x is string => !!x);
  const para = destinos.length === 2 ? `${destinos[0]} e ${destinos[1]}` : destinos[0] ?? '';

  return (
    <div className={`mt-1 rounded-2xl border px-3.5 py-3 text-[12px] ${a.estado === 'descartado' ? 'opacity-60 border-slate-200 dark:border-slate-700' : 'border-emerald-200/80 dark:border-emerald-500/30 bg-emerald-50/40 dark:bg-emerald-500/[.06]'}`}>
      <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
        <Users className="w-3.5 h-3.5" />
        Aviso para a equipe{alcance > 0 ? ` · ${pessoas(alcance)}` : ''}
      </p>

      {a.bloqueio ? (
        <p className="mt-1.5 flex items-start gap-1.5 text-[11px] text-amber-700 dark:text-amber-400">
          <AlertTriangle className="w-3.5 h-3.5 mt-px flex-shrink-0" />
          {a.bloqueio}
        </p>
      ) : (
        aberto && (
          <ul className="mt-1.5 flex flex-col gap-0.5 text-[11px] text-slate-500 dark:text-slate-400">
            {e.privado.length > 0 && <li>No WhatsApp de cada um: {nomes(e.privado)}.</li>}
            {e.citadosNoGrupo.length > 0 && (
              <li>
                No {rotuloDoGrupo(e.grupoNome)}, citando {juntarNomes(e.citadosNoGrupo)}, que não {e.citadosNoGrupo.length === 1 ? 'tem' : 'têm'} WhatsApp na aba Membros.
              </li>
            )}
            {e.semDestino.length > 0 && (
              <li className="text-amber-700 dark:text-amber-400">
                Sem WhatsApp e sem grupo escolhido, {e.semDestino.length === 1 ? 'fica' : 'ficam'} de fora: {nomes(e.semDestino)}.
              </li>
            )}
          </ul>
        )
      )}

      {aberto ? (
        <textarea
          value={texto}
          onChange={(ev) => setTexto(ev.target.value.slice(0, MAX_TEXTO))}
          disabled={enviando}
          rows={Math.min(6, Math.max(2, Math.ceil(texto.length / 48)))}
          aria-label="Texto do aviso para a equipe"
          className="mt-2 w-full resize-y rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-[13px] text-slate-800 dark:text-slate-100 outline-none focus:border-emerald-500/60 disabled:opacity-60"
        />
      ) : (
        <p className="mt-2 whitespace-pre-line text-[13px] text-slate-700 dark:text-slate-200">{a.texto}</p>
      )}

      {a.erro && <p className="mt-2 text-[11px] text-red-600 dark:text-red-400">{a.erro}</p>}

      {aberto && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {!a.bloqueio && (
            <button
              type="button"
              onClick={() => onEnviar(texto)}
              disabled={enviando || !texto.trim()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-emerald-500 to-green-600 text-white text-[12px] font-semibold shadow-md shadow-emerald-500/25 active:scale-[.98] transition disabled:opacity-60"
            >
              {enviando && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Enviar para todos{alcance > 0 ? ` (${alcance})` : ''}
            </button>
          )}
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
          <CheckCircle2 className="w-3.5 h-3.5" /> Na fila do WhatsApp: sai em instantes para {para}.
        </p>
      )}
      {a.estado === 'enviado' && a.agendadaPara && (
        <p className="mt-2.5 flex items-center gap-1.5 text-[12px] font-medium text-slate-600 dark:text-slate-300">
          <Clock className="w-3.5 h-3.5" /> Fora do horário da EVA: sai {quandoSera(a.agendadaPara, hojeSP())} para {para}.
        </p>
      )}
      {a.estado === 'enviado' && e.semDestino.length > 0 && (
        <p className="mt-1 text-[11px] text-amber-700 dark:text-amber-400">Ficou de fora, sem WhatsApp e sem grupo: {nomes(e.semDestino)}.</p>
      )}
      {a.estado === 'descartado' && <p className="mt-2 text-[11px] text-slate-500">Descartado. Nada foi enviado.</p>}
    </div>
  );
};
