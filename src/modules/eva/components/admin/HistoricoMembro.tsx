import React, { useEffect, useState } from 'react';
import { StatusBadge } from '../ui';
import { agenteAdmin } from '../../services/agenteAdmin';
import type { BadgeTone } from '../../types';

type Linha = Awaited<ReturnType<typeof agenteAdmin.historicoMembro>>[number];

const ROTULO: Record<string, { texto: string; tom: BadgeTone }> = {
  pendente: { texto: 'Agendada', tom: 'neutral' },
  enviada: { texto: 'Enviada', tom: 'info' },
  entregue: { texto: 'Entregue', tom: 'success' },
  lida: { texto: 'Lida', tom: 'info' },
  falhou: { texto: 'Falhou', tom: 'danger' },
  recebida: { texto: 'Recebida', tom: 'success' },
  ignorada: { texto: 'Ignorada', tom: 'neutral' },
  cancelada: { texto: 'Cancelado', tom: 'neutral' },
};
const TIPO: Record<string, string> = {
  cobranca: 'Cobrança diária', cobranca_manual: 'Cobrança', teste: 'Teste', confirmacao: 'Resposta da EVA', recebida: 'Mensagem', lembrete: 'Lembrete',
};
const quando = (iso: string) => new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });

/** Histórico de mensagens de um membro (RF21): enviadas, falhas (com o erro) e recebidas. */
const HistoricoMembro: React.FC<{ membroId: string; versao: number }> = ({ membroId, versao }) => {
  const [linhas, setLinhas] = useState<Linha[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    agenteAdmin.historicoMembro(membroId)
      .then((l) => { if (vivo) { setLinhas(l); setErro(null); } })
      .catch((e) => { if (vivo) setErro(e instanceof Error ? e.message : 'Falha ao carregar.'); });
    return () => { vivo = false; };
  }, [membroId, versao]);

  if (erro) return <p className="text-xs text-red-600 dark:text-red-400">Não consegui carregar o histórico: {erro}</p>;
  if (!linhas) return <p className="text-xs text-slate-400">Carregando…</p>;
  if (linhas.length === 0) return <p className="text-xs text-slate-400">Nenhuma mensagem ainda.</p>;
  return (
    <ul className="flex flex-col gap-1.5">
      {linhas.map((m) => {
        const r = ROTULO[m.status] ?? { texto: m.status, tom: 'neutral' as BadgeTone };
        return (
          <li key={m.id} className={`rounded-xl px-3 py-2 text-xs ${m.direcao === 'entrada' ? 'bg-emerald-500/[.06]' : 'bg-white/70 dark:bg-slate-900/50'}`}>
            <div className="flex items-center justify-between gap-2">
              <span className="font-semibold text-slate-600 dark:text-slate-300">
                {m.direcao === 'entrada' ? '← ' : '→ '}{TIPO[m.tipo] ?? m.tipo} · {quando(m.enviada_em ?? m.created_at)}
              </span>
              <StatusBadge tone={r.tom}>{r.texto}</StatusBadge>
            </div>
            <p className="mt-1 text-slate-500 dark:text-slate-400 whitespace-pre-line line-clamp-3 [overflow-wrap:anywhere]">{m.texto}</p>
            {m.erro && <p className="mt-1 text-red-600 dark:text-red-400 [overflow-wrap:anywhere]">{m.erro}</p>}
          </li>
        );
      })}
    </ul>
  );
};

export default HistoricoMembro;
