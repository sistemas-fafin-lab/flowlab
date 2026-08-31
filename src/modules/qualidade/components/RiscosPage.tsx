// Matriz de Riscos — cadastro + listagem/filtro
// (.scratch/qualidade-riscos-indicadores/issues/01-riscos-cadastro-matriz-origem.md).

import { useQuery } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { RiscoDTO } from '../types';
import { buscarSetoresRisco, listarRiscos } from '../riscos.js';
import { useCanManageQualidade } from '../hooks/useCanManageQualidade.js';
import { NovoRiscoDrawer } from './riscos/NovoRiscoDrawer.js';
import { BADGE_NIVEL, ROTULO_NIVEL } from './riscos/rotulos.js';
import { ComboboxBusca } from './ui/ComboboxBusca.js';
import { ErrorState } from './ui/ErrorState.js';
import { Skeleton } from './ui/Skeleton.js';
import type { ColunaTabela } from './ui/TabelaExpansivel.js';
import { TabelaExpansivel } from './ui/TabelaExpansivel.js';

const colunas: ColunaTabela<RiscoDTO>[] = [
  { chave: 'setor', titulo: 'Setor', valor: (r) => r.setorNome ?? '', filtravel: true, larguraMin: 'min-w-[9rem]' },
  { chave: 'processo', titulo: 'Processo', valor: (r) => r.processo, filtravel: true, larguraMin: 'min-w-[10rem]' },
  {
    chave: 'risco',
    titulo: 'Risco identificado',
    valor: (r) => r.riscoIdentificado,
    quebrarLinha: true,
    larguraMin: 'min-w-[18rem]',
  },
  { chave: 'p', titulo: 'P', valor: (r) => r.probabilidade ?? '', larguraMin: 'min-w-[3rem]' },
  { chave: 's', titulo: 'S', valor: (r) => r.severidade ?? '', larguraMin: 'min-w-[3rem]' },
  { chave: 'score', titulo: 'Score', valor: (r) => r.score ?? '', larguraMin: 'min-w-[4rem]' },
  {
    chave: 'nivel',
    titulo: 'Classificação',
    valor: (r) => r.nivel ?? '',
    filtravel: true,
    tipoFiltro: 'select',
    render: (r) =>
      r.nivel ? (
        <span className={`rounded-full px-2 py-1 text-xs font-medium ${BADGE_NIVEL[r.nivel]}`}>{ROTULO_NIVEL[r.nivel]}</span>
      ) : (
        <span className="text-xs text-gray-400">Sem classificação</span>
      ),
    larguraMin: 'min-w-[9rem]',
  },
];

export function Riscos() {
  const canManage = useCanManageQualidade();
  const [setorId, setSetorId] = useState('');
  const [novoAberto, setNovoAberto] = useState(false);

  const { data: setores } = useQuery({ queryKey: ['riscos-setores'], queryFn: buscarSetoresRisco });

  const filtro = useMemo(() => ({ setorId: setorId || undefined }), [setorId]);
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['riscos', filtro],
    queryFn: () => listarRiscos(filtro),
  });

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Matriz de Riscos</h1>
          <p className="text-sm text-gray-600 dark:text-slate-400">
            Cadastro e classificação de riscos por setor e processo (Probabilidade × Severidade).
          </p>
        </div>
        {canManage && (
          <button
            type="button"
            onClick={() => setNovoAberto(true)}
            className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-500 to-blue-600 px-4 py-2.5 text-sm font-medium text-white shadow-md shadow-blue-500/25 transition-all duration-200 hover:from-blue-600 hover:to-blue-700"
          >
            <Plus className="h-4 w-4" aria-hidden />
            Cadastrar novo risco
          </button>
        )}
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-xs font-medium text-gray-500 dark:text-slate-400">
          Setor
          <ComboboxBusca itens={setores} valor={setorId} onMudar={setSetorId} placeholder="Todos os setores" className="w-56" />
        </label>
      </div>

      {isLoading && (
        <div className="space-y-2">
          {[1, 2, 3].map((n) => (
            <Skeleton key={n} className="h-12 w-full" />
          ))}
        </div>
      )}

      {isError && <ErrorState titulo="Não foi possível carregar os riscos" aoTentarNovamente={() => refetch()} />}

      {!isLoading && !isError && data && data.length === 0 && (
        <p className="glass-surface rounded-2xl p-8 text-center text-sm text-gray-500 dark:text-slate-400">
          Nenhum risco cadastrado ainda.
          {canManage ? ' Use "Cadastrar novo risco" para começar.' : ''}
        </p>
      )}

      {!isLoading && !isError && data && data.length > 0 && (
        <TabelaExpansivel
          titulo="Riscos"
          caption="Matriz de riscos"
          colunas={colunas}
          dados={data}
          chaveLinha={(r) => r.id}
          cor="rose"
        />
      )}

      {novoAberto && <NovoRiscoDrawer onFechar={() => setNovoAberto(false)} />}
    </div>
  );
}
