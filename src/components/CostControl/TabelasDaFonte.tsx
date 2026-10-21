import React, { useEffect, useMemo, useState } from 'react';
import { CalendarClock, X } from 'lucide-react';
import type { TabelaAssociada } from '../../hooks/useCostControl';
import {
  DIAS_AVISO_VENCIMENTO,
  hojeISO,
  pedeAtencao,
  situacaoVencimento,
  type SituacaoVencimento,
} from './domain/vencimento';

// ═══════════════════════════════════════════════════════════════════════════════
// Bloco "Tabelas desta fonte" (.scratch/controle-custos-tabela-associada,
// ticket 01): as tabelas associadas da fonte pagadora selecionada, com o
// vencimento do contrato e o selo de situação. O vencimento é só aviso —
// tabela vencida continua valendo no orçamento e na importação.
// ═══════════════════════════════════════════════════════════════════════════════

type FiltroVencimento = 'todas' | 'atencao';

// classe null = sem selo, só o texto discreto.
const SITUACAO: Record<SituacaoVencimento, { texto: string; classe: string | null }> = {
  vencida: {
    texto: 'vencida',
    classe: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20',
  },
  a_vencer: {
    texto: `vence em até ${DIAS_AVISO_VENCIMENTO} dias`,
    classe: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
  },
  em_dia: { texto: 'em dia', classe: null },
  sem_vencimento: { texto: 'sem vencimento', classe: null },
};

const formatarData = (iso: string): string => {
  const [ano, mes, dia] = iso.split('-');
  return `${dia}/${mes}/${ano}`;
};

function CampoVencimento({
  tabela,
  onSalvar,
}: {
  tabela: TabelaAssociada;
  onSalvar: (tabela: TabelaAssociada, vencimento: string | null) => Promise<boolean>;
}) {
  const [valor, setValor] = useState(tabela.vencimento ?? '');
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    setValor(tabela.vencimento ?? '');
  }, [tabela.vencimento]);

  const salvar = async (novo: string) => {
    const vencimento = novo || null;
    if (vencimento === tabela.vencimento) return;
    setSalvando(true);
    const ok = await onSalvar(tabela, vencimento);
    setSalvando(false);
    if (!ok) setValor(tabela.vencimento ?? '');
  };

  return (
    <div className="inline-flex items-center gap-1">
      <input
        type="date"
        value={valor}
        disabled={salvando}
        onChange={e => setValor(e.target.value)}
        onBlur={() => salvar(valor)}
        onKeyDown={e => {
          if (e.key === 'Enter') e.currentTarget.blur();
        }}
        aria-label={`Vencimento de ${tabela.nome || '(sem nome)'}`}
        className="px-2 py-1 text-sm rounded-lg bg-white dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30 disabled:opacity-60"
      />
      {valor && (
        <button
          type="button"
          onClick={() => {
            setValor('');
            salvar('');
          }}
          disabled={salvando}
          title="Remover vencimento"
          className="p-1 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:text-gray-200 dark:hover:bg-gray-700 transition-colors"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}

export default function TabelasDaFonte({
  tabelas,
  podeGerenciar,
  onSalvarVencimento,
}: {
  // Já restritas à fonte pagadora selecionada.
  tabelas: TabelaAssociada[];
  podeGerenciar: boolean;
  onSalvarVencimento: (tabela: TabelaAssociada, vencimento: string | null) => Promise<boolean>;
}) {
  const [filtro, setFiltro] = useState<FiltroVencimento>('todas');
  const hoje = hojeISO();

  const linhas = useMemo(() => {
    const comSituacao = tabelas.map(t => ({ tabela: t, situacao: situacaoVencimento(t.vencimento, hoje) }));
    return filtro === 'atencao' ? comSituacao.filter(l => pedeAtencao(l.situacao)) : comSituacao;
  }, [tabelas, filtro, hoje]);

  const botaoFiltro = (valor: FiltroVencimento, rotulo: string) => (
    <button
      type="button"
      onClick={() => setFiltro(valor)}
      aria-pressed={filtro === valor}
      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
        filtro === valor
          ? 'bg-blue-600 text-white'
          : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700/60'
      }`}
    >
      {rotulo}
    </button>
  );

  return (
    <div className="rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-800 shadow-sm overflow-hidden">
      <div className="px-5 py-3 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between gap-4">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-800 dark:text-gray-100">
          <CalendarClock className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          Tabelas desta fonte
        </h3>
        <div className="flex items-center gap-1">
          {botaoFiltro('todas', 'Todas')}
          {botaoFiltro('atencao', 'Vencidas / a vencer')}
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 dark:bg-gray-900/40 text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400">
            <tr>
              <th className="px-5 py-3 text-left font-bold">Tabela Associada</th>
              <th className="px-5 py-3 text-left font-bold">Vencimento</th>
              <th className="px-5 py-3 text-left font-bold">Situação</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700/60">
            {linhas.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-5 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                  {filtro === 'atencao'
                    ? `Nenhuma tabela desta fonte vencida ou vencendo nos próximos ${DIAS_AVISO_VENCIMENTO} dias.`
                    : 'Nenhuma tabela cadastrada para esta fonte pagadora.'}
                </td>
              </tr>
            ) : (
              linhas.map(({ tabela, situacao }) => {
                const { texto, classe } = SITUACAO[situacao];
                return (
                  <tr key={tabela.id} className="hover:bg-blue-50/40 dark:hover:bg-blue-500/[.04] transition-colors">
                    <td className="px-5 py-3">
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 text-[11px] font-semibold rounded-full border bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20">
                        <span className="w-1.5 h-1.5 rounded-full bg-current" />
                        {tabela.nome || '(sem nome)'}
                      </span>
                      {!tabela.ativa && (
                        <span className="ml-2 text-[11px] font-medium text-gray-400 dark:text-gray-500">inativa</span>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      {podeGerenciar ? (
                        <CampoVencimento tabela={tabela} onSalvar={onSalvarVencimento} />
                      ) : (
                        <span className="text-gray-700 dark:text-gray-200">
                          {tabela.vencimento ? formatarData(tabela.vencimento) : '—'}
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      {classe ? (
                        <span
                          className={`inline-flex items-center px-2 py-0.5 text-[11px] font-semibold rounded-full border ${classe}`}
                        >
                          {texto}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400 dark:text-gray-500">{texto}</span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
