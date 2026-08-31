// Planos de contingência — cadastro + listagem/filtro, histórico de testes.
// (.scratch/qualidade-riscos-indicadores/issues/03-riscos-contingencia.md).
// Independente de risco: não exige vínculo com um risco existente.

import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Plus } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { PlanoContingenciaDTO } from '../types';
import { buscarSetoresContingencia, listarPlanosContingencia } from '../contingencias.js';
import { useCanManageQualidade } from '../hooks/useCanManageQualidade.js';
import { NovoPlanoContingenciaDrawer } from './riscos/NovoPlanoContingenciaDrawer.js';
import { PlanoContingenciaDetalheDrawer } from './riscos/PlanoContingenciaDetalheDrawer.js';
import { BADGE_STATUS_CONTINGENCIA, ROTULO_STATUS_CONTINGENCIA } from './riscos/rotulos.js';
import { ComboboxBusca } from './ui/ComboboxBusca.js';
import { ErrorState } from './ui/ErrorState.js';
import { Skeleton } from './ui/Skeleton.js';
import type { ColunaTabela } from './ui/TabelaExpansivel.js';
import { TabelaExpansivel } from './ui/TabelaExpansivel.js';

const colunas: ColunaTabela<PlanoContingenciaDTO>[] = [
  { chave: 'codigo', titulo: 'Código', valor: (p) => p.codigo, filtravel: true, larguraMin: 'min-w-[7rem]' },
  { chave: 'setor', titulo: 'Setor', valor: (p) => p.setorNome ?? '', filtravel: true, larguraMin: 'min-w-[9rem]' },
  { chave: 'evento', titulo: 'Evento', valor: (p) => p.evento, quebrarLinha: true, larguraMin: 'min-w-[16rem]' },
  {
    chave: 'status',
    titulo: 'Status',
    valor: (p) => p.status,
    filtravel: true,
    tipoFiltro: 'select',
    render: (p) => (
      <span className={`rounded-full px-2 py-1 text-xs font-medium ${BADGE_STATUS_CONTINGENCIA[p.status]}`}>
        {ROTULO_STATUS_CONTINGENCIA[p.status]}
      </span>
    ),
    larguraMin: 'min-w-[8rem]',
  },
];

export function Contingencias() {
  const canManage = useCanManageQualidade();
  const [setorId, setSetorId] = useState('');
  const [novoAberto, setNovoAberto] = useState(false);
  const [detalheId, setDetalheId] = useState<string | null>(null);

  const { data: setores } = useQuery({ queryKey: ['riscos-setores'], queryFn: buscarSetoresContingencia });

  const filtro = useMemo(() => ({ setorId: setorId || undefined }), [setorId]);
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['contingencias', filtro],
    queryFn: () => listarPlanosContingencia(filtro),
  });

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
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Planos de Contingência</h1>
            <p className="text-sm text-gray-600 dark:text-slate-400">
              Ações e testes previstos para quando um risco vira realidade — independente de vínculo com um risco cadastrado.
            </p>
          </div>
          {canManage && (
            <button
              type="button"
              onClick={() => setNovoAberto(true)}
              className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-500 to-blue-600 px-4 py-2.5 text-sm font-medium text-white shadow-md shadow-blue-500/25 transition-all duration-200 hover:from-blue-600 hover:to-blue-700"
            >
              <Plus className="h-4 w-4" aria-hidden />
              Novo plano de contingência
            </button>
          )}
        </div>
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

      {isError && <ErrorState titulo="Não foi possível carregar os planos de contingência" aoTentarNovamente={() => refetch()} />}

      {!isLoading && !isError && data && data.length === 0 && (
        <p className="glass-surface rounded-2xl p-8 text-center text-sm text-gray-500 dark:text-slate-400">
          Nenhum plano de contingência cadastrado ainda.
          {canManage ? ' Use "Novo plano de contingência" para começar.' : ''}
        </p>
      )}

      {!isLoading && !isError && data && data.length > 0 && (
        <TabelaExpansivel
          titulo="Planos de contingência"
          caption="Planos de contingência"
          colunas={colunas}
          dados={data}
          chaveLinha={(p) => p.id}
          cor="rose"
          onClickLinha={(p) => setDetalheId(p.id)}
        />
      )}

      {novoAberto && <NovoPlanoContingenciaDrawer onFechar={() => setNovoAberto(false)} />}
      {detalheId && <PlanoContingenciaDetalheDrawer id={detalheId} canManage={canManage} onFechar={() => setDetalheId(null)} />}
    </div>
  );
}
