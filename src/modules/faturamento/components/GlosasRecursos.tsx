import React, { useCallback, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  BarChart3,
  CheckCircle,
  ClipboardList,
  Clock,
  ListChecks,
  RefreshCw,
} from 'lucide-react';
import Select from '../../../components/Select';
import { useAuth } from '../../../hooks/useAuth';
import { hasPermission } from '../../../utils/permissions';
import { sincronizarGlosasRecursos, useConveniosGlosas, useUltimaSincronizacaoGlosas } from '../hooks/useGlosasRecursos';
import type { RecorteGlosas } from '../types';
import { formatData, formatDataHora, hojeIso } from '../utils/formato';
import LotesRecursoLista from './LotesRecursoLista';
import RegrasPrazoConvenios from './RegrasPrazoConvenios';
import ResumoRecursosCards from './ResumoRecursosCards';

// ============================================================================
// COMPONENTE: GlosasRecursos
// Controle de glosas e recursos (.scratch/glosas-recursos-dashboard/spec.md):
// três abas com um cabeçalho comum — período (mês do lote de faturamento
// original), convênio e "Atualizar", que sincroniza a foto do apLIS no recorte.
// ============================================================================

type Aba = 'dashboard' | 'recentes' | 'acompanhamento';
type SubAbaAcompanhamento = 'lotes' | 'fora-de-lote' | 'regras';

const ABAS: { id: Aba; label: string; icone: React.ReactNode }[] = [
  { id: 'dashboard', label: 'Dashboard', icone: <BarChart3 size={16} /> },
  { id: 'recentes', label: 'Glosas recentes', icone: <Clock size={16} /> },
  { id: 'acompanhamento', label: 'Acompanhamento dos recursos', icone: <ListChecks size={16} /> },
];

const SUB_ABAS: { id: SubAbaAcompanhamento; label: string }[] = [
  { id: 'lotes', label: 'Lotes de recurso' },
  { id: 'fora-de-lote', label: 'Recursos fora de lote' },
  { id: 'regras', label: 'Regras de prazo' },
];

const CAMPO = 'mt-1 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white';

/** Recursos anteriores a 2026 não foram organizados em lotes no apLIS. */
const ANO_LOTES_ORGANIZADOS = 2026;

const EmBreve: React.FC<{ titulo: string }> = ({ titulo }) => (
  <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 text-center py-16">
    <ClipboardList className="h-12 w-12 text-gray-400 mx-auto mb-4" />
    <p className="text-gray-700 dark:text-gray-300 font-medium">{titulo}</p>
    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Em breve</p>
  </div>
);

const GlosasRecursos: React.FC = () => {
  const { userProfile } = useAuth();
  const podeEditar = hasPermission(userProfile?.permissions || [], 'canManageBilling');
  const convenios = useConveniosGlosas();
  const [recorte, setRecorte] = useState<RecorteGlosas>(() => ({
    competencia: hojeIso().slice(0, 7),
    fontePagadoraId: null,
  }));
  const [aba, setAba] = useState<Aba>('dashboard');
  const [subAba, setSubAba] = useState<SubAbaAcompanhamento>('lotes');

  const [sincronizando, setSincronizando] = useState(false);
  const [erroSync, setErroSync] = useState<string | null>(null);
  const [avisoSync, setAvisoSync] = useState<string | null>(null);
  // Muda a cada sincronização ou edição (lápis) concluída: as abas recarregam da foto nova.
  const [versao, setVersao] = useState(0);
  const aposEdicao = useCallback(() => setVersao((v) => v + 1), []);
  const ultimaSync = useUltimaSincronizacaoGlosas(recorte, versao);

  const atualizar = useCallback(async () => {
    setSincronizando(true);
    setErroSync(null);
    setAvisoSync(null);
    try {
      const r = await sincronizarGlosasRecursos(recorte);
      setAvisoSync(
        `${r.requisicoes} ${r.requisicoes === 1 ? 'requisição' : 'requisições'} e ${r.lotes} `
        + `${r.lotes === 1 ? 'lote de recurso' : 'lotes de recurso'} sincronizados`
        + (r.dadoAte ? ` — apLIS até ${formatData(r.dadoAte)} (a réplica atrasa cerca de 1 dia).` : '.'),
      );
      setVersao((v) => v + 1);
    } catch (err) {
      setErroSync(err instanceof Error ? err.message : 'Não foi possível sincronizar com o apLIS.');
    } finally {
      setSincronizando(false);
    }
  }, [recorte]);

  const anoPeriodo = Number(recorte.competencia.slice(0, 4));

  return (
    <div className="space-y-6">
      {/* Cabeçalho comum às três abas */}
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <AlertCircle className="h-7 w-7 text-red-600" />
            Glosas e Recursos
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Glosas e recursos junto às operadoras, a partir do apLIS
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            {ultimaSync
              ? <>Última sincronização em {formatDataHora(ultimaSync.sincronizadoEm)}
                  {ultimaSync.dadoAte && <> · dado do apLIS até {formatData(ultimaSync.dadoAte)}</>}</>
              : 'Período ainda não sincronizado — use "Atualizar"'}
          </p>
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <label className="text-xs text-gray-500 dark:text-gray-400">
            Período (mês do lote de faturamento)
            <input
              type="month"
              value={recorte.competencia}
              onChange={(e) => e.target.value && setRecorte((r) => ({ ...r, competencia: e.target.value }))}
              className={`block ${CAMPO}`}
            />
          </label>
          <label className="text-xs text-gray-500 dark:text-gray-400">
            Convênio
            <Select
              value={recorte.fontePagadoraId === null ? '' : String(recorte.fontePagadoraId)}
              onChange={(v) => setRecorte((r) => ({ ...r, fontePagadoraId: v ? Number(v) : null }))}
              options={[
                { value: '', label: 'Todos' },
                ...convenios.map((c) => ({ value: String(c.id), label: c.nome })),
              ]}
              controlClass={CAMPO}
              wrapperClass="w-56"
              searchable
            />
          </label>
          <button
            onClick={() => void atualizar()}
            disabled={sincronizando}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            <RefreshCw size={16} className={sincronizando ? 'animate-spin' : ''} />
            {sincronizando ? 'Sincronizando...' : 'Atualizar'}
          </button>
        </div>
      </div>

      {anoPeriodo < ANO_LOTES_ORGANIZADOS && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4 flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0" />
          <p className="text-sm text-amber-800 dark:text-amber-200">
            Os recursos de anos anteriores a {ANO_LOTES_ORGANIZADOS} não foram organizados em lotes no apLIS: os
            números deste período podem estar incompletos.
          </p>
        </div>
      )}

      {erroSync && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 flex items-center gap-2">
          <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 shrink-0" />
          <p className="text-red-700 dark:text-red-300">{erroSync}</p>
          <button onClick={() => setErroSync(null)} className="ml-auto text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300">×</button>
        </div>
      )}
      {avisoSync && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4 flex items-center gap-2">
          <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400 shrink-0" />
          <p className="text-sm text-green-800 dark:text-green-200">{avisoSync}</p>
          <button onClick={() => setAvisoSync(null)} className="ml-auto text-green-700 dark:text-green-400 hover:text-green-900 dark:hover:text-green-300">×</button>
        </div>
      )}

      {/* Abas */}
      <div className="flex flex-wrap gap-1 border-b border-gray-200 dark:border-gray-700">
        {ABAS.map((a) => (
          <button
            key={a.id}
            onClick={() => setAba(a.id)}
            className={`inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
              aba === a.id
                ? 'border-blue-600 dark:border-blue-400 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
            }`}
          >
            {a.icone}
            {a.label}
          </button>
        ))}
      </div>

      {aba === 'dashboard' && <EmBreve titulo="Dashboard" />}
      {aba === 'recentes' && <EmBreve titulo="Glosas recentes" />}
      {aba === 'acompanhamento' && (
        <div className="space-y-4">
          <ResumoRecursosCards recorte={recorte} versao={versao} />

          <div className="flex flex-wrap gap-1">
            {SUB_ABAS.map((s) => (
              <button
                key={s.id}
                onClick={() => setSubAba(s.id)}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  subAba === s.id
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>

          {subAba === 'lotes' && (
            <LotesRecursoLista recorte={recorte} versao={versao} podeEditar={podeEditar} onEditado={aposEdicao} />
          )}
          {subAba === 'fora-de-lote' && <EmBreve titulo="Recursos fora de lote" />}
          {subAba === 'regras' && <RegrasPrazoConvenios versao={versao} podeEditar={podeEditar} />}
        </div>
      )}
    </div>
  );
};

export default GlosasRecursos;
