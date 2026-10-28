import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  CalendarCheck,
  CalendarClock,
  CalendarDays,
  CalendarX,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Plus,
  RefreshCw,
  Repeat,
} from 'lucide-react';
import ConfirmDialog from '../../../components/ConfirmDialog';
import { useAuth } from '../../../hooks/useAuth';
import { hasPermission } from '../../../utils/permissions';
import { desmarcarEnvio, removerAgendamento, useCalendarioEnvios } from '../hooks/useCalendarioEnvios';
import type { AgendamentoEnvio, FeriadoEnvio, RegraEnvio, StatusAgendamento } from '../types';
import { formatData, formatDataHora } from '../utils/formato';
import AgendamentoAvulsoModal from './AgendamentoAvulsoModal';
import { ESTILO_STATUS } from './estiloStatusEnvio';
import SeloForaDaJanela from './SeloForaDaJanela';
import DetalheAgendamentoModal from './DetalheAgendamentoModal';
import MarcarEnvioModal from './MarcarEnvioModal';
import ReagendarEnvioModal from './ReagendarEnvioModal';

// ============================================================================
// COMPONENTE: CalendarioEnvios
// Faturamento → Calendário de envios (.scratch/faturamento-calendario-envios/spec.md):
// os painéis Hoje e Amanhã (o próximo dia útil, vindo do servidor) com os
// Agendamentos de envio de cada dia, e a grade do mês de segunda a sexta com os
// feriados destacados, o bloco Atrasados (de qualquer mês, até serem resolvidos) e a
// lista lateral "Pode enviar qualquer dia". O status de cada agendamento vem
// classificado do servidor; aqui só vira cor. Clicar num agendamento abre o detalhe
// (observação, membros, quem marcou, histórico). Quem tem canManageCalendarioEnvios
// marca e desmarca o envio (com a data), move, remove e cria agendamentos avulsos;
// os demais só veem. Fora da janela da regra nunca é bloqueado, só ganha o selo.
// ============================================================================

const CARD = 'bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700';
const DIAS_SEMANA = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex'];

const NOME_MES = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric', timeZone: 'UTC' });
const NOME_DIA = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit', timeZone: 'UTC' });

const dataUtc = (iso: string): Date => new Date(`${iso}T00:00:00Z`);
const somarDias = (iso: string, dias: number): string => {
  const d = dataUtc(iso);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
};
const somarMeses = (mes: string, meses: number): string => {
  const [ano, numero] = mes.split('-').map(Number);
  const d = new Date(Date.UTC(ano, numero - 1 + meses, 1));
  return d.toISOString().slice(0, 7);
};
const nomeMes = (mes: string): string => {
  const nome = NOME_MES.format(dataUtc(`${mes}-01`));
  return nome.charAt(0).toUpperCase() + nome.slice(1);
};

/**
 * Semanas do mês só de segunda a sexta: cada semana tem 5 dias, e os que caem
 * fora do mês ficam null (a primeira e a última semana podem ter buracos).
 */
function semanasDoMes(mes: string): (string | null)[][] {
  const primeiro = `${mes}-01`;
  // Volta até a segunda-feira da semana do dia 1 (getUTCDay: 0 = domingo).
  let segunda = somarDias(primeiro, -((dataUtc(primeiro).getUTCDay() + 6) % 7));
  const semanas: (string | null)[][] = [];
  while (segunda.slice(0, 7) <= mes) {
    const dias = DIAS_SEMANA.map((_, i) => somarDias(segunda, i)).map((d) => (d.slice(0, 7) === mes ? d : null));
    if (dias.some(Boolean)) semanas.push(dias);
    segunda = somarDias(segunda, 7);
  }
  return semanas;
}

/** Segunda a sexta fora dos feriados do calendário; o dia útil de verdade é do servidor. */
const ehDiaUtilNaTela = (iso: string, feriados: Map<string, FeriadoEnvio>): boolean => {
  const semana = dataUtc(iso).getUTCDay();
  return semana !== 0 && semana !== 6 && !feriados.has(iso);
};

/** O que a tela mostra de um agendamento: o agendamento e o convênio da regra. */
interface ItemAgendado {
  agendamento: AgendamentoEnvio;
  regra: RegraEnvio | undefined;
}

type Acao =
  | { tipo: 'detalhe'; item: ItemAgendado }
  | { tipo: 'marcar'; item: ItemAgendado }
  | { tipo: 'desmarcar'; item: ItemAgendado }
  | { tipo: 'reagendar'; item: ItemAgendado }
  | { tipo: 'remover'; item: ItemAgendado }
  | { tipo: 'avulso'; data: string; regraId?: string };

const nomeConvenio = (item: ItemAgendado): string => item.regra?.convenio ?? 'Convênio removido';

// ─── Painel Hoje / Amanhã ─────────────────────────────────────────────────────

const LinhaPainel: React.FC<{
  item: ItemAgendado;
  podeGerenciar: boolean;
  onAcao: (acao: Acao) => void;
}> = ({ item, podeGerenciar, onAcao }) => {
  const { agendamento, regra } = item;
  const enviado = agendamento.dataEnvio !== null;
  return (
    <li className="flex items-start gap-3 py-2.5">
      <button
        type="button"
        role="checkbox"
        aria-checked={enviado}
        aria-label={enviado ? `Desmarcar ${nomeConvenio(item)}` : `Marcar ${nomeConvenio(item)} como enviado`}
        disabled={!podeGerenciar}
        onClick={() => onAcao({ tipo: enviado ? 'desmarcar' : 'marcar', item })}
        className={`mt-0.5 w-5 h-5 shrink-0 rounded-md border-2 flex items-center justify-center ${
          enviado
            ? 'bg-green-500 border-green-500 text-white'
            : 'border-gray-300 dark:border-gray-600 hover:border-blue-500 dark:hover:border-blue-400'
        } ${podeGerenciar ? 'cursor-pointer' : 'cursor-default'}`}
      >
        {enviado && <Check className="w-3.5 h-3.5" strokeWidth={3} />}
      </button>
      <div className="min-w-0">
        <button
          type="button"
          onClick={() => onAcao({ tipo: 'detalhe', item })}
          className={`text-sm font-medium text-left hover:underline ${enviado ? 'text-gray-500 dark:text-gray-400 line-through decoration-gray-400/60' : 'text-gray-900 dark:text-gray-100'}`}
        >
          {nomeConvenio(item)}
        </button>
        {agendamento.foraDaJanela && <div className="mt-0.5"><SeloForaDaJanela /></div>}
        {regra?.observacao && <p className="text-xs text-gray-500 dark:text-gray-400">{regra.observacao}</p>}
        {enviado && (
          <p className="text-xs text-green-700 dark:text-green-400">
            Enviado em {formatData(agendamento.dataEnvio)}
            {agendamento.marcadoPorNome && <> · marcado por {agendamento.marcadoPorNome}</>}
            {agendamento.marcadoEm && <> em {formatDataHora(agendamento.marcadoEm)}</>}
          </p>
        )}
      </div>
    </li>
  );
};

const PainelDia: React.FC<{
  titulo: string;
  data: string;
  itens: ItemAgendado[];
  feriado: FeriadoEnvio | undefined;
  podeGerenciar: boolean;
  onAcao: (acao: Acao) => void;
}> = ({ titulo, data, itens, feriado, podeGerenciar, onAcao }) => {
  const enviados = itens.filter((i) => i.agendamento.dataEnvio !== null).length;
  const semana = dataUtc(data).getUTCDay();
  const naoUtil = feriado ? `Feriado: ${feriado.descricao}` : semana === 0 || semana === 6 ? 'Fim de semana' : null;
  return (
    <section className={`${CARD} p-5`} aria-label={titulo}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100">{titulo}</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 capitalize">{NOME_DIA.format(dataUtc(data))}</p>
        </div>
        {itens.length > 0 && (
          <span
            className={`px-2.5 py-1 text-xs font-medium rounded-full ${
              enviados === itens.length
                ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                : 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
            }`}
          >
            {enviados}/{itens.length} enviados
          </span>
        )}
      </div>
      {naoUtil && <p className="mt-2 text-sm text-amber-700 dark:text-amber-300">{naoUtil}</p>}
      {itens.length === 0 ? (
        <p className="mt-4 text-sm text-gray-400 dark:text-gray-500">Nenhum convênio agendado.</p>
      ) : (
        <ul className="mt-2 divide-y divide-gray-100 dark:divide-gray-700">
          {itens.map((item) => (
            <LinhaPainel key={item.agendamento.id} item={item} podeGerenciar={podeGerenciar} onAcao={onAcao} />
          ))}
        </ul>
      )}
    </section>
  );
};

// ─── Bloco Atrasados ──────────────────────────────────────────────────────────

/** Atrasados e fora do prazo de qualquer mês, na ordem do servidor (fora do prazo primeiro). */
const PainelAtrasados: React.FC<{
  itens: ItemAgendado[];
  podeGerenciar: boolean;
  onAcao: (acao: Acao) => void;
}> = ({ itens, podeGerenciar, onAcao }) => {
  const foraDoPrazo = itens.filter((i) => i.agendamento.status === 'fora_do_prazo').length;
  return (
    <section className={`${CARD} p-5 md:col-span-2 xl:col-span-1`} aria-label="Atrasados">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100 flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-yellow-500" />
            Atrasados
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">De qualquer mês, até serem resolvidos</p>
        </div>
        {itens.length > 0 && (
          <span className="px-2.5 py-1 text-xs font-medium rounded-full bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300">
            {itens.length}{foraDoPrazo > 0 && <> · {foraDoPrazo} fora do prazo</>}
          </span>
        )}
      </div>
      {itens.length === 0 ? (
        <p className="mt-4 text-sm text-green-700 dark:text-green-400 flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4" />
          Nenhum envio atrasado.
        </p>
      ) : (
        <ul className="mt-2 divide-y divide-gray-100 dark:divide-gray-700 max-h-80 overflow-y-auto -mr-2 pr-2">
          {itens.map((item) => {
            const { agendamento } = item;
            const estilo = ESTILO_STATUS[agendamento.status];
            return (
              <li key={agendamento.id} className="py-2.5 flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <button
                    type="button"
                    onClick={() => onAcao({ tipo: 'detalhe', item })}
                    className="text-sm font-medium text-left text-gray-900 dark:text-gray-100 hover:underline"
                  >
                    {nomeConvenio(item)}
                  </button>
                  <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                    <span className={`px-1.5 py-px text-[10px] font-semibold rounded-full ${estilo.pilula}`}>{estilo.nome}</span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">previsto para {formatData(agendamento.dataPrevista)}</span>
                    {agendamento.foraDaJanela && <SeloForaDaJanela />}
                  </div>
                </div>
                {podeGerenciar && (
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => onAcao({ tipo: 'marcar', item })}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg text-green-700 bg-green-50 hover:bg-green-100 dark:text-green-300 dark:bg-green-900/20 dark:hover:bg-green-900/40"
                    >
                      <Check className="w-3.5 h-3.5" />
                      Enviado
                    </button>
                    <button
                      type="button"
                      onClick={() => onAcao({ tipo: 'reagendar', item })}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg text-blue-700 bg-blue-50 hover:bg-blue-100 dark:text-blue-300 dark:bg-blue-900/20 dark:hover:bg-blue-900/40"
                    >
                      <CalendarClock className="w-3.5 h-3.5" />
                      Reagendar
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
};

// ─── Grade do mês ─────────────────────────────────────────────────────────────

/** Chip da grade: o tooltip traz a observação e os membros; o clique abre o detalhe. */
const ChipAgendamento: React.FC<{
  item: ItemAgendado;
  onAcao: (acao: Acao) => void;
}> = ({ item, onAcao }) => {
  const { status, foraDaJanela, dataEnvio } = item.agendamento;
  const enviado = dataEnvio !== null;
  const dica = [
    nomeConvenio(item),
    enviado ? `Enviado em ${formatData(dataEnvio)}` : ESTILO_STATUS[status].nome,
    foraDaJanela && 'fora da janela da regra',
    item.regra?.observacao,
  ].filter(Boolean).join(' · ') + (item.regra?.membros ? `\nMembros: ${item.regra.membros}` : '');
  return (
    <button
      type="button"
      title={dica}
      onClick={() => onAcao({ tipo: 'detalhe', item })}
      className={`w-full flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium text-left truncate hover:ring-2 hover:ring-blue-400/40 ${ESTILO_STATUS[status].chip}`}
    >
      {enviado && <Check className="w-3 h-3 shrink-0" strokeWidth={3} />}
      <span className="truncate">{nomeConvenio(item)}</span>
      {foraDaJanela && <CalendarX className="w-3 h-3 shrink-0 ml-auto text-gray-500 dark:text-gray-400" aria-label="fora da janela" />}
    </button>
  );
};

const GradeMes: React.FC<{
  mes: string;
  hoje: string;
  porDia: Map<string, ItemAgendado[]>;
  feriados: Map<string, FeriadoEnvio>;
  podeGerenciar: boolean;
  onAcao: (acao: Acao) => void;
}> = ({ mes, hoje, porDia, feriados, podeGerenciar, onAcao }) => (
  <div className="overflow-x-auto -mx-5 px-5">
    <div className="min-w-[640px]">
      <div className="grid grid-cols-5 gap-2 mb-2">
        {DIAS_SEMANA.map((dia) => (
          <div key={dia} className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase text-center">{dia}</div>
        ))}
      </div>
      <div className="space-y-2">
        {semanasDoMes(mes).map((semana) => (
          <div key={semana.find(Boolean)} className="grid grid-cols-5 gap-2">
            {semana.map((dia, i) => {
              if (!dia) return <div key={i} className="min-h-[7rem] rounded-xl bg-gray-50/50 dark:bg-gray-900/20" />;
              const feriado = feriados.get(dia);
              const itens = porDia.get(dia) ?? [];
              const ehHoje = dia === hoje;
              return (
                <div
                  key={dia}
                  className={`group min-h-[7rem] rounded-xl border p-2 flex flex-col gap-1 ${
                    feriado
                      ? 'bg-amber-50 border-amber-200 dark:bg-amber-900/15 dark:border-amber-800/60'
                      : 'bg-white border-gray-200 dark:bg-gray-800 dark:border-gray-700'
                  } ${ehHoje ? 'ring-2 ring-blue-500' : ''}`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`text-sm font-semibold ${ehHoje ? 'text-blue-600 dark:text-blue-400' : 'text-gray-700 dark:text-gray-200'}`}>
                      {Number(dia.slice(8))}
                    </span>
                    {podeGerenciar && !feriado && (
                      <button
                        type="button"
                        onClick={() => onAcao({ tipo: 'avulso', data: dia })}
                        aria-label={`Novo agendamento em ${formatData(dia)}`}
                        title="Novo agendamento"
                        className="p-0.5 rounded-md text-gray-400 opacity-60 group-hover:opacity-100 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  {feriado && (
                    <p className="text-[11px] leading-tight font-medium text-amber-700 dark:text-amber-300">{feriado.descricao}</p>
                  )}
                  {itens.map((item) => (
                    <ChipAgendamento key={item.agendamento.id} item={item} onAcao={onAcao} />
                  ))}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  </div>
);

// ─── Lista "Pode enviar qualquer dia" ─────────────────────────────────────────

/** As regras ativas de "todos os dias" (ids vindos do servidor); agendar abre o avulso com o convênio escolhido. */
const ListaQualquerDia: React.FC<{
  regras: RegraEnvio[];
  diaSugerido: string;
  podeGerenciar: boolean;
  onAcao: (acao: Acao) => void;
}> = ({ regras, diaSugerido, podeGerenciar, onAcao }) => (
  <aside className={`${CARD} p-5 self-start`} aria-label="Pode enviar qualquer dia">
    <h2 className="text-base font-semibold text-gray-800 dark:text-gray-100 flex items-center gap-2">
      <Repeat className="h-4 w-4 text-blue-600 dark:text-blue-400" />
      Pode enviar qualquer dia
    </h2>
    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Convênios de "todos os dias": agende no dia que preferir.</p>
    {regras.length === 0 ? (
      <p className="mt-3 text-sm text-gray-400 dark:text-gray-500">Nenhum convênio.</p>
    ) : (
      <ul className="mt-2 divide-y divide-gray-100 dark:divide-gray-700">
        {regras.map((regra) => (
          <li key={regra.id} className="py-2 flex items-start justify-between gap-2">
            <div className="min-w-0" title={regra.membros ? `Membros: ${regra.membros}` : undefined}>
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{regra.convenio}</p>
              {regra.observacao && <p className="text-xs text-gray-500 dark:text-gray-400">{regra.observacao}</p>}
              {regra.membros && <p className="text-xs text-gray-400 dark:text-gray-500 truncate">{regra.membros}</p>}
            </div>
            {podeGerenciar && (
              <button
                type="button"
                onClick={() => onAcao({ tipo: 'avulso', data: diaSugerido, regraId: regra.id })}
                aria-label={`Agendar ${regra.convenio}`}
                title="Agendar"
                className="shrink-0 p-1.5 rounded-lg text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/30"
              >
                <Plus className="w-4 h-4" />
              </button>
            )}
          </li>
        ))}
      </ul>
    )}
  </aside>
);

// ─── Página ───────────────────────────────────────────────────────────────────

const CalendarioEnvios: React.FC = () => {
  const { userProfile } = useAuth();
  const podeGerenciar = hasPermission(userProfile?.permissions || [], 'canManageCalendarioEnvios');
  const [mes, setMes] = useState<string | null>(null);
  const { calendario, loading, error, refetch } = useCalendarioEnvios(mes);
  const [acao, setAcao] = useState<Acao | null>(null);
  const [desmarcando, setDesmarcando] = useState(false);
  const [removendo, setRemovendo] = useState(false);
  const [erroAcao, setErroAcao] = useState<string | null>(null);

  const mesExibido = mes ?? calendario?.mes ?? null;

  const { porDia, feriados, atrasados, qualquerDia } = useMemo(() => {
    const regras = new Map((calendario?.regras ?? []).map((r) => [r.id, r]));
    const atrasados = (calendario?.atrasados ?? []).map((agendamento) => ({ agendamento, regra: regras.get(agendamento.regraId) }));
    const mapa = new Map<string, ItemAgendado[]>();
    for (const agendamento of calendario?.agendamentos ?? []) {
      const lista = mapa.get(agendamento.dataPrevista) ?? [];
      lista.push({ agendamento, regra: regras.get(agendamento.regraId) });
      mapa.set(agendamento.dataPrevista, lista);
    }
    for (const lista of mapa.values()) lista.sort((a, b) => nomeConvenio(a).localeCompare(nomeConvenio(b), 'pt-BR'));
    const qualquerDia = (calendario?.podeEnviarQualquerDia ?? []).flatMap((id) => regras.get(id) ?? []);
    return { porDia: mapa, feriados: new Map((calendario?.feriados ?? []).map((f) => [f.data, f])), atrasados, qualquerDia };
  }, [calendario]);

  const concluir = () => {
    setAcao(null);
    void refetch();
  };

  const confirmarDesmarcar = async (item: ItemAgendado) => {
    setDesmarcando(true);
    setErroAcao(null);
    try {
      await desmarcarEnvio(item.agendamento.id);
      concluir();
    } catch (err) {
      setErroAcao(err instanceof Error ? err.message : 'Não foi possível desmarcar o envio.');
      setAcao(null);
    } finally {
      setDesmarcando(false);
    }
  };

  const confirmarRemover = async (item: ItemAgendado) => {
    setRemovendo(true);
    setErroAcao(null);
    try {
      await removerAgendamento(item.agendamento.id);
      concluir();
    } catch (err) {
      setErroAcao(err instanceof Error ? err.message : 'Não foi possível remover o agendamento.');
      setAcao(null);
    } finally {
      setRemovendo(false);
    }
  };

  /** Hoje, se for dia útil, senão o próximo: o dia sugerido para reagendar e agendar. */
  const diaUtilSugerido = calendario ? (ehDiaUtilNaTela(calendario.hoje, feriados) ? calendario.hoje : calendario.amanha) : '';

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <CalendarCheck className="h-7 w-7 text-blue-600" />
            Calendário de envios
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Os convênios a enviar em cada dia útil. Marque o envio assim que o lote sair.
          </p>
        </div>
        <button
          onClick={() => void refetch()}
          disabled={loading}
          className="self-start sm:self-auto inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-500 to-blue-600 text-white font-medium rounded-xl shadow-md shadow-blue-500/25 hover:from-blue-600 hover:to-blue-700 disabled:opacity-50"
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          Atualizar
        </button>
      </div>

      {erroAcao && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-3 text-sm text-red-700 dark:text-red-300 flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {erroAcao}
        </div>
      )}

      {error ? (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl p-4 flex items-start gap-2">
          <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-red-700 dark:text-red-300">O calendário não foi carregado.</p>
            <p className="text-sm text-red-600 dark:text-red-400 mt-1">{error}</p>
          </div>
        </div>
      ) : !calendario ? (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {[0, 1, 2].map((i) => <div key={i} className={`${CARD} h-48 animate-pulse ${i === 2 ? 'md:col-span-2 xl:col-span-1' : ''}`} />)}
          </div>
          <div className={`${CARD} h-96 animate-pulse`} />
        </div>
      ) : (
        <div className={`space-y-6 transition-opacity ${loading ? 'opacity-60' : ''}`}>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            <PainelDia
              titulo="Hoje"
              data={calendario.hoje}
              itens={porDia.get(calendario.hoje) ?? []}
              feriado={feriados.get(calendario.hoje)}
              podeGerenciar={podeGerenciar}
              onAcao={setAcao}
            />
            <PainelDia
              titulo="Amanhã"
              data={calendario.amanha}
              itens={porDia.get(calendario.amanha) ?? []}
              feriado={undefined}
              podeGerenciar={podeGerenciar}
              onAcao={setAcao}
            />
            <PainelAtrasados itens={atrasados} podeGerenciar={podeGerenciar} onAcao={setAcao} />
          </div>

          {mesExibido && (
            <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_18rem] gap-4">
              <section className={`${CARD} p-5 min-w-0`} aria-label="Calendário do mês">
                <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                  <div className="flex items-center gap-2">
                    <CalendarDays className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                    <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100">{nomeMes(mesExibido)}</h2>
                    {loading && <Loader2 className="h-4 w-4 animate-spin text-gray-400" />}
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setMes(somarMeses(mesExibido, -1))}
                      aria-label="Mês anterior"
                      className="p-2 rounded-xl text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
                    >
                      <ChevronLeft className="h-5 w-5" />
                    </button>
                    <button
                      onClick={() => setMes(calendario.hoje.slice(0, 7))}
                      className="px-3 py-1.5 rounded-xl text-sm font-medium text-gray-700 border border-gray-200 hover:bg-gray-50 dark:text-gray-200 dark:border-gray-600 dark:hover:bg-gray-700"
                    >
                      Mês atual
                    </button>
                    <button
                      onClick={() => setMes(somarMeses(mesExibido, 1))}
                      aria-label="Próximo mês"
                      className="p-2 rounded-xl text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
                    >
                      <ChevronRight className="h-5 w-5" />
                    </button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-4 mb-3 text-xs text-gray-500 dark:text-gray-400">
                  {(Object.keys(ESTILO_STATUS) as StatusAgendamento[]).map((status) => (
                    <span key={status} className="flex items-center gap-1.5">
                      <span className={`w-3 h-3 rounded ${ESTILO_STATUS[status].amostra}`} />
                      {ESTILO_STATUS[status].nome}
                    </span>
                  ))}
                  <span className="flex items-center gap-1.5"><CalendarX className="w-3.5 h-3.5" />Fora da janela da regra</span>
                  <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-amber-50 border border-amber-200 dark:bg-amber-900/15 dark:border-amber-800/60" />Feriado</span>
                </div>
                <GradeMes
                  mes={mesExibido}
                  hoje={calendario.hoje}
                  porDia={porDia}
                  feriados={feriados}
                  podeGerenciar={podeGerenciar}
                  onAcao={setAcao}
                />
              </section>
              <ListaQualquerDia
                regras={qualquerDia}
                diaSugerido={diaUtilSugerido}
                podeGerenciar={podeGerenciar}
                onAcao={setAcao}
              />
            </div>
          )}
        </div>
      )}

      {acao?.tipo === 'detalhe' && (
        <DetalheAgendamentoModal
          agendamento={acao.item.agendamento}
          regra={acao.item.regra}
          podeGerenciar={podeGerenciar}
          onFechar={() => setAcao(null)}
          onMarcar={() => setAcao({ tipo: 'marcar', item: acao.item })}
          onDesmarcar={() => setAcao({ tipo: 'desmarcar', item: acao.item })}
          onMover={() => setAcao({ tipo: 'reagendar', item: acao.item })}
          onRemover={() => setAcao({ tipo: 'remover', item: acao.item })}
        />
      )}
      {calendario && acao?.tipo === 'marcar' && (
        <MarcarEnvioModal
          agendamentoId={acao.item.agendamento.id}
          convenio={nomeConvenio(acao.item)}
          dataPrevista={acao.item.agendamento.dataPrevista}
          hoje={calendario.hoje}
          onFechar={() => setAcao(null)}
          onMarcado={concluir}
        />
      )}
      {calendario && acao?.tipo === 'reagendar' && (
        <ReagendarEnvioModal
          agendamentoId={acao.item.agendamento.id}
          convenio={nomeConvenio(acao.item)}
          dataPrevista={acao.item.agendamento.dataPrevista}
          dataInicial={
            acao.item.agendamento.dataPrevista >= calendario.hoje ? acao.item.agendamento.dataPrevista : diaUtilSugerido
          }
          onFechar={() => setAcao(null)}
          onReagendado={concluir}
        />
      )}
      {calendario && acao?.tipo === 'avulso' && (
        <AgendamentoAvulsoModal
          regras={calendario.regras}
          dataInicial={acao.data}
          regraInicial={acao.regraId}
          onFechar={() => setAcao(null)}
          onCriado={concluir}
        />
      )}
      <ConfirmDialog
        isOpen={acao?.tipo === 'desmarcar'}
        title="Desmarcar envio"
        message={
          acao?.tipo === 'desmarcar' && (
            <>
              {nomeConvenio(acao.item)} volta a ficar pendente. A marcação de {formatData(acao.item.agendamento.dataEnvio)} fica no histórico.
            </>
          )
        }
        confirmText={desmarcando ? 'Desmarcando…' : 'Desmarcar'}
        onConfirm={() => { if (acao?.tipo === 'desmarcar' && !desmarcando) void confirmarDesmarcar(acao.item); }}
        onCancel={() => setAcao(null)}
        type="warning"
      />
      <ConfirmDialog
        isOpen={acao?.tipo === 'remover'}
        title="Remover agendamento"
        message={
          acao?.tipo === 'remover' && (
            <>
              {nomeConvenio(acao.item)} sai do dia {formatData(acao.item.agendamento.dataPrevista)}
              {acao.item.agendamento.dataEnvio && <>, junto com a marcação de envio de {formatData(acao.item.agendamento.dataEnvio)}</>}.
              A remoção fica no histórico.
            </>
          )
        }
        confirmText={removendo ? 'Removendo…' : 'Remover'}
        onConfirm={() => { if (acao?.tipo === 'remover' && !removendo) void confirmarRemover(acao.item); }}
        onCancel={() => setAcao(null)}
        type="danger"
      />
    </div>
  );
};

export default CalendarioEnvios;
