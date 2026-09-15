import React, { useMemo, useState } from 'react';
import { Users, UserCheck, Search } from 'lucide-react';
import { useColaboradores } from '../hooks/useColaboradores';
import { formatCPF, normalizeCPF } from '../../../utils/cpf';
import { SkeletonFilters, SkeletonTableRow } from '../../../components/PageLoadingSkeleton';
import ColaboradorDetalheModal from './ColaboradorDetalheModal';
import type { ColaboradorStatus } from '../types';

const STATUS_CONFIG: Record<ColaboradorStatus, { label: string; badge: string }> = {
  ativo: { label: 'Ativo', badge: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300' },
  desligado: { label: 'Desligado', badge: 'bg-gray-100 dark:bg-gray-700/60 text-gray-500 dark:text-gray-400' },
};

const ColaboradoresPage: React.FC = () => {
  const {
    colaboradores,
    loading,
    error,
    refetch,
    atualizarCadastro,
    vincularUsuario,
    desvincularUsuario,
    definirGestor,
  } = useColaboradores();
  const [busca, setBusca] = useState('');
  const [filtroStatus, setFiltroStatus] = useState<'todos' | ColaboradorStatus>('todos');
  const [selecionadoId, setSelecionadoId] = useState<string | null>(null);
  const colaboradorSelecionado = selecionadoId ? colaboradores.find((c) => c.id === selecionadoId) ?? null : null;

  const colaboradoresFiltrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    const termoDigitos = normalizeCPF(termo);
    return colaboradores.filter((c) => {
      if (filtroStatus !== 'todos' && c.status !== filtroStatus) return false;
      if (!termo) return true;
      return (
        c.nome.toLowerCase().includes(termo) ||
        (termoDigitos !== '' && c.cpf.includes(termoDigitos)) ||
        (c.departamento ?? '').toLowerCase().includes(termo)
      );
    });
  }, [colaboradores, busca, filtroStatus]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 animate-fade-in-up">
        <div>
          <h2 className="text-2xl font-bold bg-gradient-to-r from-gray-800 to-gray-600 dark:from-gray-100 dark:to-gray-300 bg-clip-text text-transparent">Colaboradores</h2>
          <p className="text-gray-500 dark:text-gray-400">Funcionários e ex-funcionários do laboratório, com o vínculo de usuário do sistema quando houver</p>
        </div>
      </div>

      {loading ? (
        <SkeletonFilters />
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-4 flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por nome, CPF ou departamento..."
              className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 text-sm text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
            />
          </div>
          <select
            value={filtroStatus}
            onChange={(e) => setFiltroStatus(e.target.value as 'todos' | ColaboradorStatus)}
            className="px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 text-sm text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
          >
            <option value="todos">Todos os status</option>
            <option value="ativo">Ativo</option>
            <option value="desligado">Desligado</option>
          </select>
        </div>
      )}

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 text-red-700 dark:text-red-300 text-sm flex items-center justify-between gap-4">
          <span>{error}</span>
          <button
            onClick={() => refetch()}
            className="shrink-0 px-3 py-1.5 rounded-lg border border-red-300 dark:border-red-700 text-red-700 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-900/30 font-medium"
          >
            Tentar novamente
          </button>
        </div>
      )}

      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-700 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                <th className="px-4 py-3">Nome</th>
                <th className="px-4 py-3">CPF</th>
                <th className="px-4 py-3">Departamento</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Usuário do sistema</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {loading &&
                Array.from({ length: 6 }).map((_, i) => <SkeletonTableRow key={i} columns={5} />)}

              {!loading && colaboradoresFiltrados.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-gray-400 dark:text-gray-500">
                    <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    {colaboradores.length === 0
                      ? 'Nenhum colaborador cadastrado ainda.'
                      : 'Nenhum colaborador encontrado para esse filtro.'}
                  </td>
                </tr>
              )}

              {!loading &&
                colaboradoresFiltrados.map((colaborador) => (
                  <tr
                    key={colaborador.id}
                    onClick={() => setSelecionadoId(colaborador.id)}
                    className="hover:bg-gray-50 dark:hover:bg-gray-700/40 transition-colors cursor-pointer"
                  >
                    <td className="px-4 py-3 font-medium text-gray-800 dark:text-gray-100">{colaborador.nome}</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{formatCPF(colaborador.cpf)}</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{colaborador.departamento || '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${STATUS_CONFIG[colaborador.status].badge}`}>
                        {STATUS_CONFIG[colaborador.status].label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {colaborador.usuarioVinculado ? (
                        <div className="flex items-center gap-1.5 text-gray-700 dark:text-gray-200">
                          <UserCheck className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                          <div className="min-w-0">
                            <div className="truncate">{colaborador.usuarioVinculado.nome}</div>
                            <div className="text-xs text-gray-400 dark:text-gray-500 truncate">{colaborador.usuarioVinculado.email}</div>
                          </div>
                        </div>
                      ) : (
                        <span className="text-gray-400 dark:text-gray-500">Sem usuário vinculado</span>
                      )}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>

      {colaboradorSelecionado && (
        <ColaboradorDetalheModal
          colaborador={colaboradorSelecionado}
          colaboradores={colaboradores}
          onClose={() => setSelecionadoId(null)}
          atualizarCadastro={atualizarCadastro}
          vincularUsuario={vincularUsuario}
          desvincularUsuario={desvincularUsuario}
          definirGestor={definirGestor}
        />
      )}
    </div>
  );
};

export default ColaboradoresPage;
