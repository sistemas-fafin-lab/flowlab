import React, { useMemo, useState } from 'react';
import {
  CalendarClock,
  MapPin,
  Phone,
  RefreshCw,
  Filter,
  X,
  User,
  Inbox,
} from 'lucide-react';
import { useAgendamentos } from '../hooks/useAgendamentos';
import { usePostos } from '../hooks/usePostos';
import type { AcAgendamentoStatus } from '../types';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmtDataHora = (iso: string) =>
  new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  recebido: { label: 'Recebido', className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' },
  em_coleta: { label: 'Em coleta', className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' },
  coletado: { label: 'Coletado', className: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' },
  cancelado: { label: 'Cancelado', className: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400' },
};

const statusBadge = (status: AcAgendamentoStatus) => {
  const cfg = STATUS_BADGE[status] ?? {
    label: status,
    className: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${cfg.className}`}>
      {cfg.label}
    </span>
  );
};

// ─── Página ───────────────────────────────────────────────────────────────────
const AgendamentosPage: React.FC = () => {
  const [postoId, setPostoId] = useState('');
  const [data, setData] = useState('');

  const filtros = useMemo(
    () => ({ postoId: postoId || undefined, data: data || undefined }),
    [postoId, data],
  );

  const { agendamentos, loading, error, refetch } = useAgendamentos(filtros);
  const { postos } = usePostos();

  const temFiltro = Boolean(postoId || data);

  return (
    <div className="max-w-7xl mx-auto pt-4 sm:pt-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/25">
            <CalendarClock className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Agendamentos</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Coletas agendadas recebidas do portal do paciente
            </p>
          </div>
        </div>
        <button
          onClick={() => void refetch()}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-gray-600 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Atualizar
        </button>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-end gap-3 mb-5 p-4 bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700">
        <div className="flex items-center gap-2 text-gray-400">
          <Filter className="w-4 h-4" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-500 dark:text-gray-400">Posto</label>
          <select
            value={postoId}
            onChange={(e) => setPostoId(e.target.value)}
            className="px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Todos os postos</option>
            {postos.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nome}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-500 dark:text-gray-400">Data</label>
          <input
            type="date"
            value={data}
            onChange={(e) => setData(e.target.value)}
            className="px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 [color-scheme:light] dark:[color-scheme:dark]"
          />
        </div>
        {temFiltro && (
          <button
            onClick={() => {
              setPostoId('');
              setData('');
            }}
            className="inline-flex items-center gap-1 px-3 py-2 text-sm text-gray-500 hover:text-red-500 transition-colors"
          >
            <X className="w-4 h-4" />
            Limpar
          </button>
        )}
        <div className="ml-auto text-sm text-gray-400 dark:text-gray-500 self-center">
          {agendamentos.length} {agendamentos.length === 1 ? 'agendamento' : 'agendamentos'}
        </div>
      </div>

      {/* Erro */}
      {error && (
        <div className="mb-4 p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-sm">
          Falha ao carregar agendamentos: {error}
        </div>
      )}

      {/* Loading */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-10 w-10 border-4 border-blue-600 border-t-transparent" />
        </div>
      ) : agendamentos.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-4">
            <Inbox className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-medium text-gray-700 dark:text-gray-300">Nenhum agendamento</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {temFiltro ? 'Tente ajustar os filtros.' : 'Os agendamentos recebidos aparecerão aqui.'}
          </p>
        </div>
      ) : (
        <>
          {/* Tabela (desktop) */}
          <div className="hidden md:block overflow-hidden rounded-2xl border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-900/50 text-left text-gray-500 dark:text-gray-400">
                  <th className="px-5 py-3 font-medium">Paciente</th>
                  <th className="px-5 py-3 font-medium">Posto</th>
                  <th className="px-5 py-3 font-medium">Data / Hora</th>
                  <th className="px-5 py-3 font-medium">Contato</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {agendamentos.map((ag) => (
                  <tr key={ag.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/40 transition-colors">
                    <td className="px-5 py-3 font-medium text-gray-900 dark:text-gray-100">{ag.paciente_nome}</td>
                    <td className="px-5 py-3 text-gray-600 dark:text-gray-300">{ag.local_posto || '—'}</td>
                    <td className="px-5 py-3 text-gray-600 dark:text-gray-300">{fmtDataHora(ag.data_hora)}</td>
                    <td className="px-5 py-3 text-gray-600 dark:text-gray-300">{ag.paciente_telefone || '—'}</td>
                    <td className="px-5 py-3">{statusBadge(ag.status)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Cards (mobile) */}
          <div className="md:hidden space-y-3">
            {agendamentos.map((ag) => (
              <div
                key={ag.id}
                className="p-4 rounded-2xl border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800"
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2 font-medium text-gray-900 dark:text-gray-100">
                    <User className="w-4 h-4 text-gray-400" />
                    {ag.paciente_nome}
                  </div>
                  {statusBadge(ag.status)}
                </div>
                <div className="space-y-1 text-sm text-gray-600 dark:text-gray-300">
                  <div className="flex items-center gap-2">
                    <CalendarClock className="w-4 h-4 text-gray-400" />
                    {fmtDataHora(ag.data_hora)}
                  </div>
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-gray-400" />
                    {ag.local_posto || '—'}
                  </div>
                  {ag.paciente_telefone && (
                    <div className="flex items-center gap-2">
                      <Phone className="w-4 h-4 text-gray-400" />
                      {ag.paciente_telefone}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default AgendamentosPage;
