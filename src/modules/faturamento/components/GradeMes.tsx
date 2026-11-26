import { Fragment, type ReactNode } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { DIAS_SEMANA, nomeMes, semanasDoMes, somarMeses } from '../utils/mesCalendario';

// ============================================================================
// COMPONENTE: GradeMes
// A grade do mês de segunda a sexta, com o cabeçalho (nome do mês, navegação e
// "Mês atual") e o dia de hoje destacado. Não sabe o que é um item: o chamador
// entrega os itens de cada dia e como desenhá-los, e, se quiser, o que mais cada
// dia tem (fundo, botões, aviso). Usada pelo Calendário de envios; é a base da
// grade do Calendário de recursos.
// ============================================================================

const CARD = 'bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700';
const FUNDO_PADRAO = 'bg-white border-gray-200 dark:bg-gray-800 dark:border-gray-700';

/** O que um dia tem além dos itens. */
export interface ExtrasDia {
  /** Classes de fundo e borda da célula no lugar do padrão (ex.: feriado). */
  fundo?: string;
  /** Botões ao lado do número do dia. */
  acoes?: ReactNode;
  /** Texto curto abaixo do número, antes dos itens (ex.: nome do feriado). */
  aviso?: ReactNode;
}

interface GradeMesProps<T> {
  /** `YYYY-MM`. */
  mes: string;
  /** `YYYY-MM-DD`: destacado na grade e base do botão "Mês atual". */
  hoje: string;
  carregando?: boolean;
  onMudarMes: (mes: string) => void;
  /** Legenda entre o cabeçalho e a grade. */
  legenda?: ReactNode;
  /**
   * Por data `YYYY-MM-DD`, na ordem em que aparecem. A grade só tem segunda a
   * sexta: item com data no sábado ou domingo não aparece, e cabe ao chamador
   * movê-lo para o dia em que deve ser exibido.
   */
  itensPorDia: Map<string, T[]>;
  chaveItem: (item: T) => string;
  renderItem: (item: T) => ReactNode;
  extrasDoDia?: (dia: string) => ExtrasDia;
}

function GradeMes<T>({
  mes,
  hoje,
  carregando = false,
  onMudarMes,
  legenda,
  itensPorDia,
  chaveItem,
  renderItem,
  extrasDoDia,
}: GradeMesProps<T>) {
  return (
    <section className={`${CARD} p-5 min-w-0`} aria-label="Calendário do mês">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <CalendarDays className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100">{nomeMes(mes)}</h2>
          {carregando && <Loader2 className="h-4 w-4 animate-spin text-gray-400" />}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => onMudarMes(somarMeses(mes, -1))}
            aria-label="Mês anterior"
            className="p-2 rounded-xl text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            onClick={() => onMudarMes(hoje.slice(0, 7))}
            className="px-3 py-1.5 rounded-xl text-sm font-medium text-gray-700 border border-gray-200 hover:bg-gray-50 dark:text-gray-200 dark:border-gray-600 dark:hover:bg-gray-700"
          >
            Mês atual
          </button>
          <button
            onClick={() => onMudarMes(somarMeses(mes, 1))}
            aria-label="Próximo mês"
            className="p-2 rounded-xl text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      </div>
      {legenda && <div className="flex flex-wrap gap-4 mb-3 text-xs text-gray-500 dark:text-gray-400">{legenda}</div>}
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
                  const extras = extrasDoDia?.(dia) ?? {};
                  const ehHoje = dia === hoje;
                  return (
                    <div
                      key={dia}
                      className={`group min-h-[7rem] rounded-xl border p-2 flex flex-col gap-1 ${extras.fundo ?? FUNDO_PADRAO} ${ehHoje ? 'ring-2 ring-blue-500' : ''}`}
                    >
                      <div className="flex items-center justify-between">
                        <span className={`text-sm font-semibold ${ehHoje ? 'text-blue-600 dark:text-blue-400' : 'text-gray-700 dark:text-gray-200'}`}>
                          {Number(dia.slice(8))}
                        </span>
                        {extras.acoes}
                      </div>
                      {extras.aviso}
                      {(itensPorDia.get(dia) ?? []).map((item) => (
                        <Fragment key={chaveItem(item)}>{renderItem(item)}</Fragment>
                      ))}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

export default GradeMes;
