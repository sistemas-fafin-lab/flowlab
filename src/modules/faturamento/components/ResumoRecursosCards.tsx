import React, { useEffect, useRef } from 'react';
import { AlertCircle, CheckCircle, Clock, Layers, MinusCircle, TrendingDown, TrendingUp, XCircle } from 'lucide-react';
import { useResumoRecursos } from '../hooks/useGlosasRecursos';
import type { CardRecursos, RecorteGlosas } from '../types';
import { formatCurrency, plural } from '../utils/formato';

// Acompanhamento dos recursos → cards do topo: Total de recursos (com variação
// sobre o mês de faturamento anterior), Em análise, Deferidos e Indeferidos,
// mais o deferido parcial e a glosa acatada. A classificação é do servidor
// (api/_lib/faturamento/recursoGlosa.ts).

const CARD = 'bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5';

function formatPercentual(valor: number): string {
  return `${valor.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
}

function requisicoes(quantidade: number): string {
  return plural(quantidade, 'requisição', 'requisições');
}

interface CardProps {
  titulo: string;
  quantidade: number;
  valor: number;
  icone: React.ReactNode;
  corIcone: string;
  rodape: React.ReactNode;
}

const Card: React.FC<CardProps> = ({ titulo, quantidade, valor, icone, corIcone, rodape }) => (
  <div className={CARD}>
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{titulo}</p>
        <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{formatCurrency(valor)}</p>
        <p className="text-sm text-gray-500 dark:text-gray-400">{requisicoes(quantidade)}</p>
      </div>
      <div className={`p-3 rounded-lg ${corIcone}`}>{icone}</div>
    </div>
    <div className="mt-3 text-sm text-gray-500 dark:text-gray-400">{rodape}</div>
  </div>
);

const Variacao: React.FC<{ variacao: number | null }> = ({ variacao }) => {
  if (variacao === null) return <>Sem recursos no mês anterior</>;
  if (variacao === 0) return <>Igual ao mês anterior</>;
  const sobe = variacao > 0;
  return (
    <span className="inline-flex items-center gap-1">
      {sobe
        ? <TrendingUp className="h-4 w-4 text-amber-600 dark:text-amber-400" />
        : <TrendingDown className="h-4 w-4 text-green-600 dark:text-green-400" />}
      <span className={sobe ? 'text-amber-700 dark:text-amber-300' : 'text-green-700 dark:text-green-300'}>
        {sobe ? '+' : ''}{formatPercentual(variacao)}
      </span>
      em relação ao mês anterior
    </span>
  );
};

const rodapePercentual = (card: CardRecursos) => `${formatPercentual(card.percentual)} das requisições em recurso`;

interface Props {
  recorte: RecorteGlosas;
  /** Muda a cada sincronização concluída: recarrega os cards. */
  versao: number;
}

const ResumoRecursosCards: React.FC<Props> = ({ recorte, versao }) => {
  const { resumo, loading, error, refetch } = useResumoRecursos(recorte);

  const versaoVista = useRef(versao);
  useEffect(() => {
    if (versaoVista.current === versao) return;
    versaoVista.current = versao;
    void refetch();
  }, [versao, refetch]);

  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 flex items-center gap-2">
        <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 shrink-0" />
        <p className="text-red-700 dark:text-red-300">{error}</p>
      </div>
    );
  }

  if (!resumo) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className={`${CARD} h-36 animate-pulse`} />
        ))}
      </div>
    );
  }

  return (
    <div className={`space-y-4 transition-opacity ${loading ? 'opacity-60' : ''}`}>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <Card
          titulo="Total de recursos"
          quantidade={resumo.total.quantidade}
          valor={resumo.total.valor}
          icone={<Layers className="h-6 w-6 text-blue-600 dark:text-blue-400" />}
          corIcone="bg-blue-100 dark:bg-blue-900/30"
          rodape={<Variacao variacao={resumo.total.variacao} />}
        />
        <Card
          titulo="Em análise"
          quantidade={resumo.emAnalise.quantidade}
          valor={resumo.emAnalise.valor}
          icone={<Clock className="h-6 w-6 text-yellow-600 dark:text-yellow-400" />}
          corIcone="bg-yellow-100 dark:bg-yellow-900/30"
          rodape={rodapePercentual(resumo.emAnalise)}
        />
        <Card
          titulo="Deferidos"
          quantidade={resumo.deferidos.quantidade}
          valor={resumo.deferidos.valor}
          icone={<CheckCircle className="h-6 w-6 text-green-600 dark:text-green-400" />}
          corIcone="bg-green-100 dark:bg-green-900/30"
          rodape={rodapePercentual(resumo.deferidos)}
        />
        <Card
          titulo="Indeferidos"
          quantidade={resumo.indeferidos.quantidade}
          valor={resumo.indeferidos.valor}
          icone={<XCircle className="h-6 w-6 text-red-600 dark:text-red-400" />}
          corIcone="bg-red-100 dark:bg-red-900/30"
          rodape={rodapePercentual(resumo.indeferidos)}
        />
      </div>

      <div className="flex flex-wrap gap-x-8 gap-y-2 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 px-5 py-3 text-sm">
        <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
          <TrendingUp className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
          <span className="font-medium">Deferido parcial (em tratativa):</span>
          <span>
            {formatCurrency(resumo.deferidoParcial.valor)} recebidos, {formatCurrency(resumo.deferidoParcial.pendente)} a
            cobrar · {requisicoes(resumo.deferidoParcial.quantidade)}
          </span>
        </div>
        <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
          <MinusCircle className="h-4 w-4 text-gray-500 dark:text-gray-400" />
          <span className="font-medium">Glosa acatada:</span>
          <span>{formatCurrency(resumo.acatada.valor)} · {requisicoes(resumo.acatada.quantidade)}</span>
        </div>
      </div>
    </div>
  );
};

export default ResumoRecursosCards;
