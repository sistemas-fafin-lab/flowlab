import React, { useState } from 'react';
import {
  AlertCircle,
  BarChart3,
  DollarSign,
  FileText,
  FlaskConical,
  RefreshCw,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import { useIndicadoresFaturamento } from '../hooks/useIndicadoresFaturamento';
import type { CardIndicadorFaturamento } from '../types';
import { formatCurrency, formatPercentual, hojeIso } from '../utils/formato';

// ============================================================================
// COMPONENTE: IndicadoresFaturamento
// Faturamento → Indicadores (.scratch/faturamento-indicadores/spec.md): total
// faturado, requisições e exames faturados no mês (pela criação do lote, sem
// os cancelados), com a variação sobre o mês anterior. Os números vêm prontos
// do servidor (api/_lib/faturamento/indicadoresFaturamento.ts).
// ============================================================================

const CARD = 'bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5';
const CAMPO = 'mt-1 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white';

/** 'YYYY-MM' do mês anterior ao de hoje: o último mês fechado. */
function mesAnterior(): string {
  const [ano, mes] = hojeIso().split('-').map(Number);
  return mes === 1 ? `${ano - 1}-12` : `${ano}-${String(mes - 1).padStart(2, '0')}`;
}

/** 'YYYY-MM-DD HH:MM' do banco → 'dd/mm hh:mm', sem converter fuso. */
function formatDiaMesHora(valor: string): string {
  const [data, hora = ''] = valor.split(' ');
  const [, mes, dia] = data.split('-');
  return `${dia}/${mes}${hora ? ` ${hora}` : ''}`;
}

const formatInteiro = (n: number): string => n.toLocaleString('pt-BR');

const Variacao: React.FC<{ variacao: number | null }> = ({ variacao }) => {
  if (variacao === null) return <><span className="font-medium">—</span> sem valor no mês anterior</>;
  if (variacao === 0) return <>Igual ao mês anterior</>;
  const sobe = variacao > 0;
  const Seta = sobe ? TrendingUp : TrendingDown;
  const cor = sobe ? 'text-green-700 dark:text-green-300' : 'text-amber-700 dark:text-amber-300';
  return (
    <>
      <Seta className={`inline h-4 w-4 mr-1 align-[-3px] ${cor}`} />
      <span className={`font-medium ${cor}`}>{sobe ? '+' : ''}{formatPercentual(variacao)}</span>{' '}
      em relação ao mês anterior
    </>
  );
};

interface CardProps {
  titulo: string;
  card: CardIndicadorFaturamento;
  formatar: (n: number) => string;
  icone: React.ReactNode;
  corIcone: string;
}

const CardIndicador: React.FC<CardProps> = ({ titulo, card, formatar, icone, corIcone }) => (
  <div className={CARD}>
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{titulo}</p>
        <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{formatar(card.atual)}</p>
        <p className="text-sm text-gray-500 dark:text-gray-400">Mês anterior: {formatar(card.anterior)}</p>
      </div>
      <div className={`p-3 rounded-lg ${corIcone}`}>{icone}</div>
    </div>
    <div className="mt-3 text-sm text-gray-500 dark:text-gray-400">
      <Variacao variacao={card.variacao} />
    </div>
  </div>
);

const IndicadoresFaturamento: React.FC = () => {
  const [mes, setMes] = useState(mesAnterior);
  const { indicadores, meta, loading, error, refetch } = useIndicadoresFaturamento(mes);

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <BarChart3 className="h-7 w-7 text-blue-600" />
            Indicadores de Faturamento
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Lotes de faturamento criados no mês, sem os cancelados
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            {meta?.dadoAte
              ? <>Dados até {formatDiaMesHora(meta.dadoAte)} (o backup do apLIS atrasa cerca de 1 dia)</>
              : 'Dados do backup do apLIS'}
          </p>
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <label className="text-xs text-gray-500 dark:text-gray-400">
            Mês (criação do lote)
            <input
              type="month"
              value={mes}
              onChange={(e) => e.target.value && setMes(e.target.value)}
              className={`block ${CAMPO}`}
            />
          </label>
          <button
            onClick={() => void refetch(true)}
            disabled={loading}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            Atualizar
          </button>
        </div>
      </div>

      {error ? (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 flex items-start gap-2">
          <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-red-700 dark:text-red-300">
              Os números deste mês não foram carregados.
            </p>
            <p className="text-sm text-red-600 dark:text-red-400 mt-1">{error}</p>
          </div>
        </div>
      ) : !indicadores ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[0, 1, 2].map((i) => <div key={i} className={`${CARD} h-36 animate-pulse`} />)}
        </div>
      ) : (
        <div className={`grid grid-cols-1 md:grid-cols-3 gap-4 transition-opacity ${loading ? 'opacity-60' : ''}`}>
          <CardIndicador
            titulo="Total faturado"
            card={indicadores.cards.totalFaturado}
            formatar={formatCurrency}
            icone={<DollarSign className="h-6 w-6 text-green-600 dark:text-green-400" />}
            corIcone="bg-green-100 dark:bg-green-900/30"
          />
          <CardIndicador
            titulo="Requisições faturadas"
            card={indicadores.cards.requisicoes}
            formatar={formatInteiro}
            icone={<FileText className="h-6 w-6 text-blue-600 dark:text-blue-400" />}
            corIcone="bg-blue-100 dark:bg-blue-900/30"
          />
          <CardIndicador
            titulo="Exames faturados"
            card={indicadores.cards.exames}
            formatar={formatInteiro}
            icone={<FlaskConical className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />}
            corIcone="bg-indigo-100 dark:bg-indigo-900/30"
          />
        </div>
      )}
    </div>
  );
};

export default IndicadoresFaturamento;
