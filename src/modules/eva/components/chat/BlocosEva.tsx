import React, { useEffect, useState } from 'react';
import { BarChart3, CalendarClock, CheckCircle2, FolderKanban, Gauge, Users, type LucideIcon } from 'lucide-react';
import type { BlocoChat } from '../../domain/blocos';
import {
  dadosAgenda, dadosDistribuicaoColunas, dadosDistribuicaoPessoas, dadosNumeros, dadosProjeto, dataDaReuniao, decisoesDaReuniao,
  pessoaVisual, type ContextoVisual,
} from '../../domain/respostaVisual';
import { agenteAdmin, type Sugestao } from '../../services/agenteAdmin';
import { StatusBadge } from '../ui';
import { Avatares, CardMini } from './CardsCitados';
import { MOLDURA_BLOCO, TEXTO_DO_TOM } from './tons';

interface PropsBloco {
  ctx: ContextoVisual;
  onOpenCard?: (codigo: string) => void;
  onNavegar?: (para: string) => void;
}

const Cabecalho: React.FC<{ icone: LucideIcon; cor: string; titulo: string; direita?: React.ReactNode }> = ({ icone: Icone, cor, titulo, direita }) => (
  <div className="flex items-center gap-2 mb-2.5">
    <span className={`w-6 h-6 rounded-lg flex items-center justify-center bg-gradient-to-br ${cor} shadow-sm`}>
      <Icone className="w-3.5 h-3.5 text-white" />
    </span>
    <span className="text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">{titulo}</span>
    {direita && <span className="ml-auto text-[11px] text-slate-400 dark:text-slate-500">{direita}</span>}
  </div>
);

// ─── Números ────────────────────────────────────────────────────────────────────

const BlocoNumeros: React.FC<PropsBloco> = ({ ctx }) => {
  const numeros = dadosNumeros(ctx);
  if (!numeros.length) return null;
  return (
    <div className={`${MOLDURA_BLOCO} p-3`}>
      <Cabecalho icone={Gauge} cor="from-blue-500 to-indigo-600" titulo={ctx.visao === 'me' ? 'Seu panorama' : 'Panorama da equipe'} />
      <div className="grid grid-cols-2 gap-2">
        {numeros.map((n) => (
          <div key={n.chave} className="rounded-xl bg-slate-50/80 dark:bg-slate-900/40 px-3 py-2">
            <p className={`text-xl font-bold tabular-nums leading-6 ${n.tom === 'neutro' ? 'text-slate-800 dark:text-slate-100' : TEXTO_DO_TOM[n.tom]}`}>{n.valor}</p>
            <p className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">{n.rotulo}</p>
            {n.dica && <p className="text-[10.5px] text-slate-400 dark:text-slate-500 truncate" title={n.dica}>{n.dica}</p>}
          </div>
        ))}
      </div>
    </div>
  );
};

// ─── Distribuição ───────────────────────────────────────────────────────────────

const BlocoPessoas: React.FC<PropsBloco> = ({ ctx }) => {
  const d = dadosDistribuicaoPessoas(ctx);
  if (!d.itens.length) return null;
  return (
    <div className={`${MOLDURA_BLOCO} p-3`}>
      <Cabecalho icone={Users} cor="from-violet-500 to-fuchsia-600" titulo="Cards abertos por pessoa" direita={<span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-red-500" />atrasados</span>} />
      <div className="flex flex-col gap-1.5">
        {d.itens.map((i) => {
          const emDia = i.total - i.atrasados;
          return (
            <div key={i.pessoa?.id ?? 'sem'} className="flex items-center gap-2">
              {i.pessoa ? <Avatares pessoas={[i.pessoa]} tamanho={20} /> : <span className="w-5 h-5 rounded-full border border-dashed border-slate-300 dark:border-slate-600 flex-shrink-0" />}
              <span className="w-[86px] flex-shrink-0 truncate text-[12px] font-medium text-slate-700 dark:text-slate-200" title={i.pessoa?.nome ?? 'Sem responsável'}>
                {i.pessoa ? i.pessoa.nome.split(' ')[0] : 'Sem resp.'}
              </span>
              <span className="flex-1 h-2.5 rounded-full bg-slate-100 dark:bg-slate-700/60 overflow-hidden flex">
                {i.atrasados > 0 && <span className="h-full bg-red-500" style={{ width: `${(i.atrasados / d.maximo) * 100}%` }} />}
                {emDia > 0 && <span className="h-full bg-gradient-to-r from-blue-500 to-indigo-500" style={{ width: `${(emDia / d.maximo) * 100}%` }} />}
              </span>
              <span className="w-6 text-right text-[12px] font-bold tabular-nums text-slate-700 dark:text-slate-200">{i.total}</span>
            </div>
          );
        })}
      </div>
      {d.outras.pessoas > 0 && (
        <p className="mt-2 text-[11px] text-slate-400 dark:text-slate-500">+ {d.outras.pessoas} {d.outras.pessoas === 1 ? 'pessoa' : 'pessoas'} com {d.outras.cards} {d.outras.cards === 1 ? 'card' : 'cards'}</p>
      )}
    </div>
  );
};

const BlocoColunas: React.FC<PropsBloco> = ({ ctx }) => {
  const { fatias, total } = dadosDistribuicaoColunas(ctx);
  if (!total) return null;
  return (
    <div className={`${MOLDURA_BLOCO} p-3`}>
      <Cabecalho icone={BarChart3} cor="from-amber-500 to-orange-600" titulo="Kanban por coluna" direita={`${total} cards`} />
      <div className="flex h-3 rounded-full overflow-hidden bg-slate-100 dark:bg-slate-700/60">
        {fatias.filter((f) => f.total).map((f) => (
          <span key={f.coluna} className="h-full" style={{ width: `${(f.total / total) * 100}%`, background: f.cor }} title={`${f.rotulo}: ${f.total}`} />
        ))}
      </div>
      <div className="mt-2.5 grid grid-cols-3 gap-x-2 gap-y-1">
        {fatias.map((f) => (
          <span key={f.coluna} className="flex items-center gap-1.5 text-[11px] text-slate-600 dark:text-slate-300 min-w-0">
            <span className="w-2 h-2 rounded-sm flex-shrink-0" style={{ background: f.cor }} />
            <span className="truncate">{f.rotulo}</span>
            <span className="ml-auto font-bold tabular-nums">{f.total}</span>
          </span>
        ))}
      </div>
      <p className="mt-1.5 text-[10.5px] text-slate-400 dark:text-slate-500">Concluído conta só esta semana.</p>
    </div>
  );
};

// ─── Projeto ────────────────────────────────────────────────────────────────────

const Barra: React.FC<{ rotulo: string; pct: number; fundo: string }> = ({ rotulo, pct, fundo }) => (
  <div className="flex items-center gap-2">
    <span className="w-[92px] flex-shrink-0 text-[11px] text-slate-500 dark:text-slate-400">{rotulo}</span>
    <span className="flex-1 h-2 rounded-full bg-slate-100 dark:bg-slate-700/60 overflow-hidden">
      <span className="block h-full rounded-full transition-[width] duration-700" style={{ width: `${pct}%`, background: fundo }} />
    </span>
    <span className="w-9 text-right text-[12px] font-bold tabular-nums text-slate-700 dark:text-slate-200">{pct}%</span>
  </div>
);

const BlocoProjeto: React.FC<PropsBloco & { projetoId: string }> = ({ ctx, projetoId, onOpenCard }) => {
  const p = dadosProjeto(ctx, projetoId);
  if (!p) return null;
  return (
    <div className={`${MOLDURA_BLOCO} p-3`}>
      <Cabecalho icone={FolderKanban} cor="from-indigo-500 to-violet-600" titulo="Projeto" />
      <div className="flex items-center gap-2 flex-wrap">
        <span aria-hidden className="w-2.5 h-2.5 rounded-full" style={{ background: p.cor ?? '#6366f1' }} />
        <span className="text-[13px] font-bold text-slate-800 dark:text-slate-100">{p.nome}</span>
        <StatusBadge tone={p.situacao.tom}>{p.situacao.rotulo}</StatusBadge>
      </div>
      <p className="mt-0.5 mb-2.5 text-[11px] text-slate-500 dark:text-slate-400">
        {[p.sprint ?? 'Sem sprint ativa', `${p.feitos}/${p.total} cards`, p.prazo ? `prazo ${p.prazo}` : 'sem prazo'].join(' · ')}
      </p>
      <div className="flex flex-col gap-1.5">
        <Barra rotulo="Feito" pct={p.pctFeito} fundo={p.situacao.barra} />
        {p.pctTempo !== null && <Barra rotulo="Tempo da sprint" pct={p.pctTempo} fundo="linear-gradient(to right,#94a3b8,#64748b)" />}
      </div>
      {p.destaques.length > 0 && (
        <div className="mt-2.5 flex flex-col gap-1">
          {p.destaques.map((c) => <CardMini key={c.id} card={c} onOpen={onOpenCard} compacto />)}
          {p.abertos > p.destaques.length && (
            <p className="text-[11px] text-slate-400 dark:text-slate-500">+ {p.abertos - p.destaques.length} abertos no projeto</p>
          )}
        </div>
      )}
    </div>
  );
};

// ─── Agenda ─────────────────────────────────────────────────────────────────────

const PontoDia: React.FC<{ cor: string }> = ({ cor }) => (
  <span aria-hidden className={`absolute -left-[13px] top-[5px] w-2 h-2 rounded-full ring-2 ring-white dark:ring-slate-800 ${cor}`} />
);

const BlocoAgenda: React.FC<PropsBloco & { dias: number }> = ({ ctx, dias, onOpenCard }) => {
  const a = dadosAgenda(ctx, dias);
  if (!a.atrasados.total && !a.dias.length) {
    return (
      <div className={`${MOLDURA_BLOCO} p-3`}>
        <Cabecalho icone={CalendarClock} cor="from-teal-500 to-emerald-600" titulo={`Próximos ${dias} dias`} />
        <p className="text-[12px] text-slate-500 dark:text-slate-400">Nada vence no período e nada está atrasado.</p>
      </div>
    );
  }
  return (
    <div className={`${MOLDURA_BLOCO} p-3`}>
      <Cabecalho icone={CalendarClock} cor="from-teal-500 to-emerald-600" titulo={`Próximos ${dias} dias`} direita={`${a.total} no período`} />
      <div className="relative ml-[9px] pl-3 border-l border-slate-200 dark:border-slate-700 flex flex-col gap-2.5">
        {a.atrasados.total > 0 && (
          <div className="relative">
            <PontoDia cor="bg-red-500" />
            <p className="mb-1 text-[11px] font-bold text-red-600 dark:text-red-400">Atrasadas · {a.atrasados.total}</p>
            <div className="flex flex-col gap-1">
              {a.atrasados.cards.map((c) => <CardMini key={c.id} card={c} onOpen={onOpenCard} compacto />)}
              {a.atrasados.total > a.atrasados.cards.length && (
                <p className="text-[11px] text-slate-400 dark:text-slate-500">+ {a.atrasados.total - a.atrasados.cards.length} atrasadas</p>
              )}
            </div>
          </div>
        )}
        {a.dias.map((d) => (
          <div key={d.dia} className="relative">
            <PontoDia cor={d.rotulo === 'Hoje' ? 'bg-amber-500' : 'bg-teal-500'} />
            <p className="mb-1 text-[11px] font-bold text-slate-600 dark:text-slate-300 capitalize">{d.rotulo}</p>
            <div className="flex flex-col gap-1">
              {d.cards.map((c) => <CardMini key={c.id} card={c} onOpen={onOpenCard} compacto />)}
            </div>
          </div>
        ))}
      </div>
      {a.escondidos > 0 && <p className="mt-2 text-[11px] text-slate-400 dark:text-slate-500">+ {a.escondidos} no período</p>}
    </div>
  );
};

// ─── Reunião ────────────────────────────────────────────────────────────────────

// As sugestões de cada reunião, lidas uma vez por aba.
const sugestoesLidas = new Map<string, Promise<Sugestao[]>>();

const STATUS_SUGESTAO: Record<string, { rotulo: string; tom: 'warning' | 'success' | 'neutral' }> = {
  pendente: { rotulo: 'aguardando', tom: 'warning' },
  aprovada: { rotulo: 'aprovada', tom: 'success' },
  rejeitada: { rotulo: 'rejeitada', tom: 'neutral' },
  substituida: { rotulo: 'substituída', tom: 'neutral' },
};

const BlocoReuniao: React.FC<PropsBloco> = ({ ctx, onNavegar }) => {
  const r = ctx.reuniao;
  const [sugestoes, setSugestoes] = useState<Sugestao[] | null>(null);
  useEffect(() => {
    if (!r?.id) return;
    let vivo = true;
    if (!sugestoesLidas.has(r.id)) sugestoesLidas.set(r.id, agenteAdmin.listarSugestoes({ status: 'todas', reuniaoId: r.id }).catch(() => []));
    void sugestoesLidas.get(r.id)!.then((s) => { if (vivo) setSugestoes(s); });
    return () => { vivo = false; };
  }, [r?.id]);
  if (!r) return null;
  const decisoes = decisoesDaReuniao(r.observacoes);
  const data = dataDaReuniao(r.realizada_em);
  const mostradas = (sugestoes ?? []).slice(0, 4);
  return (
    <div className={`${MOLDURA_BLOCO} p-3`}>
      <Cabecalho icone={CheckCircle2} cor="from-rose-500 to-pink-600" titulo="Última reunião" direita={data ?? undefined} />
      <p className="text-[13px] font-bold text-slate-800 dark:text-slate-100 mb-2">{r.titulo}</p>
      {decisoes.length > 0 && (
        <ul className="flex flex-col gap-1 mb-2.5">
          {decisoes.map((d, i) => (
            <li key={i} className="flex gap-1.5 text-[12px] leading-[1.45] text-slate-700 dark:text-slate-200">
              <CheckCircle2 className="w-3.5 h-3.5 mt-[2px] flex-shrink-0 text-emerald-500" />
              <span>{d}</span>
            </li>
          ))}
        </ul>
      )}
      {mostradas.length > 0 && (
        <div className="flex flex-col gap-1">
          <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Sugestões para o Kanban</p>
          {mostradas.map((s) => {
            const st = STATUS_SUGESTAO[s.status] ?? STATUS_SUGESTAO.pendente;
            const titulo = s.tipo === 'criar_card' ? s.proposta.titulo ?? 'Card novo' : `${s.card?.codigo ?? ''} ${s.card?.title ?? ''}`.trim() || 'Sugestão';
            const ids = s.proposta.responsaveis?.length ? s.proposta.responsaveis : s.card?.assigned_to ?? [];
            return (
              <div key={s.id} className="flex items-center gap-2 rounded-xl bg-slate-50/80 dark:bg-slate-900/40 px-2.5 py-1.5">
                <span className="text-[10px] font-bold uppercase text-indigo-500 flex-shrink-0">
                  {s.tipo === 'criar_card' ? 'Novo' : s.tipo === 'atualizar_card' ? 'Mudar' : 'Nota'}
                </span>
                <span className="flex-1 min-w-0 truncate text-[12px] font-medium text-slate-700 dark:text-slate-200" title={titulo}>{titulo}</span>
                <Avatares pessoas={ids.map((id) => pessoaVisual(id, ctx))} tamanho={18} />
                <StatusBadge tone={st.tom}>{st.rotulo}</StatusBadge>
              </div>
            );
          })}
        </div>
      )}
      {(ctx.pendentesDaReuniao ?? 0) > 0 && onNavegar && (
        <button type="button" onClick={() => onNavegar('/it/eva')} className="mt-2 text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:underline">
          {ctx.pendentesDaReuniao} {ctx.pendentesDaReuniao === 1 ? 'sugestão aguarda' : 'sugestões aguardam'} aprovação · ver
        </button>
      )}
    </div>
  );
};

// ─── Despacho ───────────────────────────────────────────────────────────────────

/** Os blocos que a EVA escolheu (D34), montados com os dados do Início. Sem dados, o bloco some. */
export const BlocosEva: React.FC<PropsBloco & { blocos: BlocoChat[] }> = ({ blocos, ...props }) => {
  if (!blocos.length || !props.ctx.hoje) return null;
  return (
    <div className="flex flex-col gap-2">
      {blocos.map((b, i) => {
        switch (b.tipo) {
          case 'numeros': return <BlocoNumeros key={i} {...props} />;
          case 'distribuicao': return b.por === 'colunas' ? <BlocoColunas key={i} {...props} /> : <BlocoPessoas key={i} {...props} />;
          case 'projeto': return <BlocoProjeto key={i} {...props} projetoId={b.projetoId} />;
          case 'agenda': return <BlocoAgenda key={i} {...props} dias={b.dias} />;
          case 'reuniao': return <BlocoReuniao key={i} {...props} />;
          default: return null;
        }
      })}
    </div>
  );
};
