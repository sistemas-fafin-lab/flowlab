import { ChevronDown } from 'lucide-react';
import { useState } from 'react';

interface SeletorPeriodoPorMesProps {
  inicio: string;
  fim: string;
  onMudar: (periodo: { inicio: string; fim: string }) => void;
  /** Ano inicialmente exibido quando nada foi selecionado ainda. */
  anoPadrao: number;
}

const MESES = [
  { numero: 1, rotulo: 'Jan' },
  { numero: 2, rotulo: 'Fev' },
  { numero: 3, rotulo: 'Mar' },
  { numero: 4, rotulo: 'Abr' },
  { numero: 5, rotulo: 'Mai' },
  { numero: 6, rotulo: 'Jun' },
  { numero: 7, rotulo: 'Jul' },
  { numero: 8, rotulo: 'Ago' },
  { numero: 9, rotulo: 'Set' },
  { numero: 10, rotulo: 'Out' },
  { numero: 11, rotulo: 'Nov' },
  { numero: 12, rotulo: 'Dez' },
];

const DIAS_NO_MES = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function ehBissexto(ano: number): boolean {
  return (ano % 4 === 0 && ano % 100 !== 0) || ano % 400 === 0;
}

function ultimoDiaDoMes(ano: number, mes: number): number {
  if (mes === 2 && ehBissexto(ano)) return 29;
  return DIAS_NO_MES[mes - 1]!;
}

function dois(n: number): string {
  return String(n).padStart(2, '0');
}

/** Sem `new Date()` — período de negócio calculado por aritmética simples (P4). */
function periodoDoMes(ano: number, mes: number): { inicio: string; fim: string } {
  return {
    inicio: `${ano}-${dois(mes)}-01`,
    fim: `${ano}-${dois(mes)}-${dois(ultimoDiaDoMes(ano, mes))}`,
  };
}

function paraAnoMes(data: string): { ano: number; mes: number; dia: number } | null {
  if (!data) return null;
  const [ano, mes, dia] = data.split('-').map(Number);
  if (!ano || !mes || !dia) return null;
  return { ano, mes, dia };
}

/**
 * Substitui os campos manuais de início/fim por um seletor de mês inteiro:
 * clicar num mês define início = dia 1, fim = último dia daquele mês.
 * Início/fim continuam opcionais — clicar no mês já selecionado desmarca.
 */
export function SeletorPeriodoPorMes({ inicio, fim, onMudar, anoPadrao }: SeletorPeriodoPorMesProps) {
  const inicioAnoMes = paraAnoMes(inicio);
  const [anoNavegado, setAnoNavegado] = useState(inicioAnoMes?.ano ?? anoPadrao);

  const anoExibido = inicioAnoMes?.ano ?? anoNavegado;

  const fimAnoMes = paraAnoMes(fim);
  const mesSelecionado =
    inicioAnoMes &&
    fimAnoMes &&
    inicioAnoMes.ano === anoExibido &&
    inicioAnoMes.dia === 1 &&
    fimAnoMes.ano === anoExibido &&
    fimAnoMes.mes === inicioAnoMes.mes &&
    fimAnoMes.dia === ultimoDiaDoMes(anoExibido, inicioAnoMes.mes)
      ? inicioAnoMes.mes
      : null;

  const anos = Array.from({ length: 6 }, (_, i) => anoPadrao - 4 + i);

  function selecionarMes(mes: number) {
    if (mesSelecionado === mes) {
      onMudar({ inicio: '', fim: '' });
      return;
    }
    onMudar(periodoDoMes(anoExibido, mes));
  }

  function selecionarAno(novoAno: number) {
    setAnoNavegado(novoAno);
    if (mesSelecionado !== null) {
      onMudar(periodoDoMes(novoAno, mesSelecionado));
    }
  }

  return (
    <div className="w-full glass-surface rounded-2xl p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-slate-400">Período</p>
        <div className="relative">
          <select
            aria-label="Ano"
            value={anoExibido}
            onChange={(e) => selecionarAno(Number(e.target.value))}
            className="glass-field appearance-none rounded-xl py-2 pl-3 pr-8 text-sm font-semibold text-slate-800 dark:text-slate-200"
          >
            {anos.map((ano) => (
              <option key={ano} value={ano}>
                {ano}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 dark:text-slate-400" aria-hidden />
        </div>
      </div>

      <div className="mt-3 flex flex-wrap justify-center gap-2">
        {MESES.map((mes) => (
          <button
            key={mes.numero}
            type="button"
            onClick={() => selecionarMes(mes.numero)}
            aria-pressed={mesSelecionado === mes.numero}
            className={`rounded-full px-4 py-2 text-sm font-medium transition-all duration-200 ${
              mesSelecionado === mes.numero
                ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-md shadow-blue-500/25'
                : 'text-gray-500 hover:bg-gray-100 hover:text-gray-800 dark:text-slate-400 dark:hover:bg-white/5 dark:hover:text-slate-200'
            }`}
          >
            {mes.rotulo}
          </button>
        ))}
      </div>
    </div>
  );
}
