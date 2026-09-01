// Sub-aba "Correlação" — grade de cards, um por risco com ao menos 1 vínculo
// N:N a ocorrências, com busca por texto do risco ou de qualquer ocorrência
// vinculada.
// (.scratch/qualidade-riscos-indicadores/issues/05-riscos-correlacao-ocorrencias.md)

import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { listarCardsCorrelacao } from '../correlacaoRiscosOcorrencias.js';
import { filtrarCardsCorrelacao } from '../domain/riscosCorrelacao.js';
import type { CardCorrelacaoRiscoDTO } from '../types';
import { CardCorrelacaoRisco } from './riscos/CardCorrelacaoRisco.js';
import { ModalOcorrenciasDoRisco } from './riscos/ModalOcorrenciasDoRisco.js';
import { ErrorState } from './ui/ErrorState.js';
import { Skeleton } from './ui/Skeleton.js';

export function CorrelacaoRiscosOcorrencias() {
  const [busca, setBusca] = useState('');
  const [cardAberto, setCardAberto] = useState<CardCorrelacaoRiscoDTO | null>(null);

  const { data, isLoading, isError, refetch } = useQuery({ queryKey: ['riscos-correlacao-cards'], queryFn: listarCardsCorrelacao });

  const cardsFiltrados = useMemo(() => filtrarCardsCorrelacao(data ?? [], busca), [data, busca]);

  return (
    <div className="animate-fade-in space-y-6">
      <div>
        <Link
          to="/qualidade/riscos"
          className="mb-2 inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-gray-800 dark:text-slate-400 dark:hover:text-slate-200"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Voltar para Riscos
        </Link>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Correlação com Ocorrências</h1>
        <p className="text-sm text-gray-600 dark:text-slate-400">
          Riscos vinculados a uma ou mais ocorrências — vínculo livre, separado da origem do cadastro.
        </p>
      </div>

      <label className="relative block w-full max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 dark:text-slate-500" aria-hidden />
        <input
          className="glass-field w-full rounded-xl py-2 pl-9 pr-3 text-sm text-slate-800 dark:text-slate-200"
          placeholder="Buscar por risco, processo ou ocorrência…"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
        />
      </label>

      {isLoading && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <Skeleton key={n} className="h-24 w-full" />
          ))}
        </div>
      )}

      {isError && <ErrorState titulo="Não foi possível carregar a correlação" aoTentarNovamente={() => refetch()} />}

      {!isLoading && !isError && cardsFiltrados.length === 0 && (
        <p className="glass-surface rounded-2xl p-8 text-center text-sm text-gray-500 dark:text-slate-400">
          {busca ? 'Nenhum risco encontrado para essa busca.' : 'Nenhum risco vinculado a ocorrências ainda.'}
        </p>
      )}

      {!isLoading && !isError && cardsFiltrados.length > 0 && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {cardsFiltrados.map((card) => (
            <CardCorrelacaoRisco key={card.riscoId} card={card} onClick={() => setCardAberto(card)} />
          ))}
        </div>
      )}

      {cardAberto && <ModalOcorrenciasDoRisco card={cardAberto} onFechar={() => setCardAberto(null)} />}
    </div>
  );
}
