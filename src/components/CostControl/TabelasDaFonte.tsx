import React, { useEffect, useMemo, useState } from 'react';
import { CalendarClock, Check, Lock, Pencil, Plus, Power, Trash2, X } from 'lucide-react';
import type { TabelaAssociada } from '../../hooks/useCostControl';
import { erroNomeTabela, tabelaProtegida } from './domain/tabelasAssociadas';
import {
  DIAS_AVISO_VENCIMENTO,
  formatarVencimento,
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
// Ticket 03: renomear, desativar/reativar e excluir (só sem linhas); a
// Tabela Particular não tem essas ações. O banco aplica as mesmas regras.
// Ticket 08: criar tabela pelo próprio bloco.
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

const MOTIVO_PROTEGIDA =
  'O Gerador de Orçamento depende desta tabela pelo nome: ela não pode ser renomeada, desativada nem excluída.';

const botaoAcao =
  'p-2 rounded-lg text-gray-400 transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-gray-400';

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

function SeloNome({ tabela }: { tabela: TabelaAssociada }) {
  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 text-[11px] font-semibold rounded-full border bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20">
      <span className="w-1.5 h-1.5 rounded-full bg-current" />
      {tabela.nome || '(sem nome)'}
    </span>
  );
}

// Renomear no próprio lugar: Enter salva, Esc cancela. Nome repetido na fonte
// (sem diferenciar maiúsculas) é recusado antes de ir ao banco.
function RenomearTabela({
  tabela,
  daFonte,
  onSalvar,
  onFechar,
}: {
  tabela: TabelaAssociada;
  daFonte: TabelaAssociada[];
  onSalvar: (tabela: TabelaAssociada, nome: string) => Promise<boolean>;
  onFechar: () => void;
}) {
  const [nome, setNome] = useState(tabela.nome);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  const salvar = async () => {
    if (nome.trim() === tabela.nome) {
      onFechar();
      return;
    }
    const problema = erroNomeTabela(nome, daFonte, tabela.id);
    if (problema) {
      setErro(problema);
      return;
    }
    setSalvando(true);
    const ok = await onSalvar(tabela, nome);
    setSalvando(false);
    if (ok) onFechar();
  };

  return (
    <div className="space-y-1">
      <div className="inline-flex items-center gap-1">
        <input
          autoFocus
          value={nome}
          disabled={salvando}
          onChange={e => {
            setNome(e.target.value);
            setErro(null);
          }}
          onKeyDown={e => {
            if (e.key === 'Enter') {
              e.preventDefault();
              salvar();
            }
            if (e.key === 'Escape') onFechar();
          }}
          aria-label={`Novo nome de ${tabela.nome || '(sem nome)'}`}
          className="px-2 py-1 text-sm rounded-lg bg-white dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30 disabled:opacity-60"
        />
        <button
          type="button"
          onClick={salvar}
          disabled={salvando}
          title="Salvar nome"
          className={`${botaoAcao} hover:text-blue-600 hover:bg-blue-50 dark:hover:text-blue-400 dark:hover:bg-blue-500/10`}
        >
          <Check className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={onFechar}
          disabled={salvando}
          title="Cancelar"
          className={`${botaoAcao} hover:text-gray-600 hover:bg-gray-100 dark:hover:text-gray-200 dark:hover:bg-gray-700`}
        >
          <X className="w-4 h-4" />
        </button>
      </div>
      {erro && <p className="text-xs text-red-600 dark:text-red-400">{erro}</p>}
    </div>
  );
}

// Ticket 08: "+ Nova tabela" no próprio bloco (nome + vencimento opcional),
// com a mesma regra de nome do campo de escolha. Enter cria, Esc cancela.
function NovaTabela({
  daFonte,
  onCriar,
  onFechar,
}: {
  daFonte: TabelaAssociada[];
  onCriar: (nome: string, vencimento: string | null) => Promise<boolean>;
  onFechar: () => void;
}) {
  const [nome, setNome] = useState('');
  const [vencimento, setVencimento] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  const criar = async () => {
    if (salvando) return;
    const problema = erroNomeTabela(nome, daFonte);
    if (problema) {
      setErro(problema);
      return;
    }
    setSalvando(true);
    const ok = await onCriar(nome, vencimento || null);
    setSalvando(false);
    if (ok) onFechar();
  };

  const campo =
    'px-2 py-1 text-sm rounded-lg bg-white dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30 disabled:opacity-60';

  return (
    <div className="px-5 py-3 border-b border-gray-100 dark:border-gray-700 bg-slate-50 dark:bg-gray-900/40 space-y-1">
      <div className="flex flex-wrap items-center gap-2">
        <input
          autoFocus
          value={nome}
          disabled={salvando}
          onChange={e => {
            setNome(e.target.value);
            setErro(null);
          }}
          onKeyDown={e => {
            if (e.key === 'Enter') {
              e.preventDefault();
              void criar();
            }
            if (e.key === 'Escape') onFechar();
          }}
          placeholder="Nome da nova tabela"
          aria-label="Nome da nova tabela"
          className={`${campo} flex-1 min-w-[12rem]`}
        />
        <input
          type="date"
          value={vencimento}
          disabled={salvando}
          onChange={e => setVencimento(e.target.value)}
          aria-label="Vencimento do contrato (opcional)"
          title="Vencimento do contrato (opcional)"
          className={campo}
        />
        <button
          type="button"
          onClick={criar}
          disabled={salvando}
          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold text-white bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 active:scale-[.98] transition-all disabled:opacity-50"
        >
          <Plus className="w-3.5 h-3.5" /> {salvando ? 'Criando…' : 'Criar tabela'}
        </button>
        <button
          type="button"
          onClick={onFechar}
          disabled={salvando}
          className="px-3 py-1.5 rounded-xl text-xs font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700/60 transition-colors disabled:opacity-50"
        >
          Cancelar
        </button>
      </div>
      {erro ? (
        <p className="text-xs text-red-600 dark:text-red-400">{erro}</p>
      ) : (
        <p className="text-xs text-gray-500 dark:text-gray-400">Vencimento é opcional.</p>
      )}
    </div>
  );
}

export default function TabelasDaFonte({
  tabelas,
  linhasPorTabela,
  podeGerenciar,
  onCriar,
  onSalvarVencimento,
  onRenomear,
  onAlternarAtiva,
  onExcluir,
}: {
  // Já restritas à fonte pagadora selecionada.
  tabelas: TabelaAssociada[];
  // contarLinhasPorTabela — tabela ausente não tem linhas.
  linhasPorTabela: Map<string, number>;
  podeGerenciar: boolean;
  // true = criada; o erro do banco já foi mostrado por quem chama.
  onCriar: (nome: string, vencimento: string | null) => Promise<boolean>;
  onSalvarVencimento: (tabela: TabelaAssociada, vencimento: string | null) => Promise<boolean>;
  onRenomear: (tabela: TabelaAssociada, nome: string) => Promise<boolean>;
  onAlternarAtiva: (tabela: TabelaAssociada) => void;
  onExcluir: (tabela: TabelaAssociada) => void;
}) {
  const [filtro, setFiltro] = useState<FiltroVencimento>('todas');
  const [renomeandoId, setRenomeandoId] = useState<string | null>(null);
  const [criando, setCriando] = useState(false);
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
          {podeGerenciar && (
            <button
              type="button"
              onClick={() => setCriando(true)}
              disabled={criando}
              className="ml-2 inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-500/10 transition-colors disabled:opacity-50"
            >
              <Plus className="w-3.5 h-3.5" /> Nova tabela
            </button>
          )}
        </div>
      </div>
      {podeGerenciar && criando && (
        <NovaTabela
          daFonte={tabelas}
          onCriar={async (nome, vencimento) => {
            const ok = await onCriar(nome, vencimento);
            // A nova tabela pode não ter vencimento: mostra todas para ela aparecer.
            if (ok) setFiltro('todas');
            return ok;
          }}
          onFechar={() => setCriando(false)}
        />
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 dark:bg-gray-900/40 text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400">
            <tr>
              <th className="px-5 py-3 text-left font-bold">Tabela Associada</th>
              <th className="px-5 py-3 text-left font-bold">Vencimento</th>
              <th className="px-5 py-3 text-left font-bold">Situação</th>
              <th className="px-5 py-3 text-right font-bold">Linhas</th>
              {podeGerenciar && <th className="px-5 py-3 text-right font-bold">Ações</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700/60">
            {linhas.length === 0 ? (
              <tr>
                <td colSpan={podeGerenciar ? 5 : 4} className="px-5 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                  {filtro === 'atencao'
                    ? `Nenhuma tabela desta fonte vencida ou vencendo nos próximos ${DIAS_AVISO_VENCIMENTO} dias.`
                    : 'Nenhuma tabela cadastrada para esta fonte pagadora.'}
                </td>
              </tr>
            ) : (
              linhas.map(({ tabela, situacao }) => {
                const { texto, classe } = SITUACAO[situacao];
                const protegida = tabelaProtegida(tabela);
                const qtdLinhas = linhasPorTabela.get(tabela.id) ?? 0;
                return (
                  <tr key={tabela.id} className="hover:bg-blue-50/40 dark:hover:bg-blue-500/[.04] transition-colors">
                    <td className="px-5 py-3">
                      {renomeandoId === tabela.id ? (
                        <RenomearTabela
                          tabela={tabela}
                          daFonte={tabelas}
                          onSalvar={onRenomear}
                          onFechar={() => setRenomeandoId(null)}
                        />
                      ) : (
                        <>
                          <SeloNome tabela={tabela} />
                          {protegida && (
                            <span title={MOTIVO_PROTEGIDA} className="ml-2 inline-flex align-middle text-gray-400 dark:text-gray-500">
                              <Lock className="w-3.5 h-3.5" aria-label={MOTIVO_PROTEGIDA} />
                            </span>
                          )}
                          {!tabela.ativa && (
                            <span
                              title="Some das listas de escolha e não recebe linhas novas; as linhas que já tem continuam valendo."
                              className="ml-2 text-[11px] font-medium text-gray-400 dark:text-gray-500"
                            >
                              inativa
                            </span>
                          )}
                        </>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      {podeGerenciar ? (
                        <CampoVencimento tabela={tabela} onSalvar={onSalvarVencimento} />
                      ) : (
                        <span className="text-gray-700 dark:text-gray-200">
                          {formatarVencimento(tabela.vencimento) || '—'}
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
                    <td className="px-5 py-3 text-right tabular-nums text-gray-700 dark:text-gray-200">{qtdLinhas}</td>
                    {podeGerenciar && (
                      <td className="px-5 py-3">
                        {protegida ? (
                          <p className="text-right text-[11px] text-gray-400 dark:text-gray-500">protegida</p>
                        ) : (
                          <div className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => setRenomeandoId(tabela.id)}
                              disabled={renomeandoId === tabela.id}
                              title="Renomear"
                              className={`${botaoAcao} hover:text-blue-600 hover:bg-blue-50 dark:hover:text-blue-400 dark:hover:bg-blue-500/10`}
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => onAlternarAtiva(tabela)}
                              aria-pressed={!tabela.ativa}
                              title={
                                tabela.ativa
                                  ? 'Desativar: some das listas de escolha e não recebe linhas novas; as linhas atuais continuam valendo'
                                  : 'Reativar'
                              }
                              className={`${botaoAcao} ${
                                tabela.ativa
                                  ? 'hover:text-amber-600 hover:bg-amber-50 dark:hover:text-amber-400 dark:hover:bg-amber-500/10'
                                  : 'text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-500/10'
                              }`}
                            >
                              <Power className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => onExcluir(tabela)}
                              disabled={qtdLinhas > 0}
                              title={
                                qtdLinhas > 0
                                  ? `Não dá para excluir: a tabela tem ${qtdLinhas} linha${qtdLinhas > 1 ? 's' : ''} de preço. Exclua as linhas antes ou desative a tabela.`
                                  : 'Excluir'
                              }
                              className={`${botaoAcao} hover:text-red-600 hover:bg-red-50 dark:hover:text-red-400 dark:hover:bg-red-500/10`}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                      </td>
                    )}
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
