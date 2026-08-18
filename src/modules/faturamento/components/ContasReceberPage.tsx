import React, { useCallback, useMemo, useState } from 'react';
import { AlertTriangle, BarChart3, ListChecks, RefreshCw, Wallet } from 'lucide-react';
import { useAuth } from '../../../hooks/useAuth';
import { hasPermission } from '../../../utils/permissions';
import { supabase } from '../../../lib/supabase';
import { useContasReceber } from '../hooks/useContasReceber';
import type { DashboardReceberFiltros, SubAbaPendencias, TituloReceber, TituloStatus } from '../types';
import ContasReceberDashboard from './ContasReceberDashboard';
import TitulosList from './TitulosList';
import PendenciasNaoFaturadas from './PendenciasNaoFaturadas';
import PendenciasParticulares from './PendenciasParticulares';
import NovoTituloModal from './NovoTituloModal';
import BaixaModal from './BaixaModal';

// ============================================================================
// COMPONENTE: ContasReceberPage
// Aba Faturamento → Contas a Receber. Substitui o RecebimentosList, que era
// montado sobre as tabelas `notas`/`recebimentos` nunca populadas (o worker
// billing-sync jamais saiu do mock) e por isso sempre mostrou vazio.
//
// O modelo agora é manual e explícito: o operador agrupa lotes do apLIS num
// título e registra sobre ele baixas parciais e glosas.
// ============================================================================

/** Primeiro dia do mês de N meses atrás, em ISO local. */
function mesesAtras(n: number): string {
  const hoje = new Date();
  const alvo = new Date(hoje.getFullYear(), hoje.getMonth() - n, 1);
  return `${alvo.getFullYear()}-${String(alvo.getMonth() + 1).padStart(2, '0')}-01`;
}

function fimDoMes(): string {
  const hoje = new Date();
  const ultimo = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);
  return `${ultimo.getFullYear()}-${String(ultimo.getMonth() + 1).padStart(2, '0')}-${String(ultimo.getDate()).padStart(2, '0')}`;
}

/** Estado inicial do painel, e também o alvo do "Limpar" — uma definição só. */
const filtrosPainelPadrao = (): DashboardReceberFiltros => ({
  desde: mesesAtras(3),
  ate: fimDoMes(),
  operadoraIds: [],
  lotes: [],
  notas: [],
});

type Aba = 'dashboard' | 'titulos' | 'pendencias';

const ContasReceberPage: React.FC = () => {
  const { userProfile } = useAuth();
  // Gate de escrita. A leitura já foi barrada pela rota (canViewBilling) e pela
  // RLS; aqui é só a diferença entre ver e poder mexer.
  const podeEditar = hasPermission(userProfile?.permissions || [], 'canManageBilling');

  const [aba, setAba] = useState<Aba>('dashboard');
  const [subAbaPendencias, setSubAbaPendencias] = useState<SubAbaPendencias>('lotes');
  const [filtros, setFiltros] = useState({
    // Três meses cobrem o ciclo típico de pagamento de convênio sem trazer a
    // base inteira na primeira abertura.
    desde: mesesAtras(3),
    ate: fimDoMes(),
    status: '' as TituloStatus | '',
    operadoraId: '',
    busca: '',
    pagina: 1,
    tamanho: 25,
  });

  // O painel tem filtros próprios (lote e nota fiscal não existem na listagem, e
  // status não faz sentido num indicador que já separa recebido de glosado), por
  // isso o estado é separado do da aba Títulos em vez de compartilhado.
  const [filtrosPainel, setFiltrosPainel] = useState<DashboardReceberFiltros>(filtrosPainelPadrao);

  const [novoAberto, setNovoAberto] = useState(false);
  const [tituloBaixa, setTituloBaixa] = useState<TituloReceber | null>(null);
  const [modoModal, setModoModal] = useState<'baixa' | 'glosa'>('baixa');
  const [sincronizando, setSincronizando] = useState(false);
  // Tipado para o card poder distinguir sucesso de falha — antes os dois caíam
  // no mesmo card azul de informação, e "Falha ao sincronizar operadoras" saía
  // com cara de aviso positivo.
  const [aviso, setAviso] = useState<{ tipo: 'sucesso' | 'erro'; texto: string } | null>(null);

  const parametros = useMemo(() => ({
    desde: filtros.desde,
    ate: filtros.ate,
    status: filtros.status,
    operadoraId: filtros.operadoraId,
    busca: filtros.busca,
    pagina: filtros.pagina,
    tamanho: filtros.tamanho,
  }), [filtros]);

  const {
    titulos, operadoras, total, loading, error, refetch, refetchOperadoras,
    buscarGuias, criarTitulo, registrarBaixa, lancarGlosas, cancelarTitulo,
  } = useContasReceber(parametros);

  const aplicarFiltro = useCallback((patch: Partial<typeof filtros>) => {
    setFiltros((atual) => ({ ...atual, ...patch }));
  }, []);

  // O painel devolve o recorte inteiro (o modal de filtros aplica de uma vez),
  // então aqui não há merge: o que veio É o novo estado.
  const aplicarFiltroPainel = useCallback((novos: DashboardReceberFiltros) => {
    setFiltrosPainel(novos);
  }, []);

  const limparFiltroPainel = useCallback(() => setFiltrosPainel(filtrosPainelPadrao()), []);

  // Alvo dos widgets-resumo de pendências do Dashboard: troca de aba E de
  // sub-aba numa só chamada, para o clique cair já na lista certa.
  const navegarParaPendencias = useCallback((subAba: SubAbaPendencias) => {
    setAba('pendencias');
    setSubAbaPendencias(subAba);
  }, []);

  // Recalculado só na montagem: as datas do padrão dependem de "hoje", e um
  // literal novo a cada render invalidaria o memo do painel a cada digitação.
  const padraoPainel = useMemo(filtrosPainelPadrao, []);

  // Espelha as fontes pagadoras do apLIS para que o financeiro possa cadastrar o
  // prazo de pagamento antes do primeiro título daquela operadora.
  const sincronizarOperadoras = async () => {
    setSincronizando(true);
    setAviso(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error('Sessão expirada. Faça login novamente.');

      const res = await fetch('/api/faturamento/operadoras-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({}),
      });
      const body = (await res.json().catch(() => ({}))) as {
        success?: boolean; error?: string; sincronizadas?: number;
      };
      if (!res.ok || !body.success) throw new Error(body.error || 'Falha ao sincronizar operadoras.');
      setAviso({ tipo: 'sucesso', texto: `${body.sincronizadas ?? 0} operadora(s) sincronizada(s) do apLIS.` });
      // refetch() só relê os títulos da página atual; o seletor de operadoras vem
      // de uma consulta à parte que só rodava na montagem — sem isto, as fontes
      // pagadoras recém-importadas ficavam de fora do <select> até um F5.
      await Promise.all([refetch(), refetchOperadoras()]);
    } catch (err) {
      setAviso({
        tipo: 'erro',
        texto: err instanceof Error ? err.message : 'Falha ao sincronizar operadoras.',
      });
    } finally {
      setSincronizando(false);
    }
  };

  // O mesmo modal atende os dois casos: o formulário de glosa é idêntico, muda
  // só o caminho de escrita (ver o comentário de `modo` no BaixaModal).
  const abrirBaixa = (titulo: TituloReceber) => {
    setModoModal('baixa');
    setTituloBaixa(titulo);
  };
  const abrirGlosa = (titulo: TituloReceber) => {
    setModoModal('glosa');
    setTituloBaixa(titulo);
  };

  const confirmarCancelamento = async (titulo: TituloReceber) => {
    const ok = window.confirm(
      `Cancelar o título ${titulo.numeroNota}? Os lotes voltam a ficar disponíveis para um novo título.`,
    );
    if (!ok) return;
    const erro = await cancelarTitulo(titulo.id);
    if (erro) setAviso({ tipo: 'erro', texto: erro });
  };

  return (
    <div className="p-6 max-w-[1600px] mx-auto space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white">
            <Wallet className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Contas a Receber</h1>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Títulos formados por lotes do apLIS, com baixas e glosas registradas aqui
            </p>
          </div>
        </div>

        {podeEditar && (
          <button
            type="button"
            onClick={sincronizarOperadoras}
            disabled={sincronizando}
            className="px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${sincronizando ? 'animate-spin' : ''}`} />
            Sincronizar operadoras
          </button>
        )}
      </div>

      {aviso && (
        <div
          className={`p-3 rounded-xl border text-sm flex items-center justify-between gap-2 ${
            aviso.tipo === 'erro'
              ? 'border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300'
              : 'border-blue-200 dark:border-blue-900/50 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
          }`}
        >
          <span>{aviso.texto}</span>
          <button type="button" onClick={() => setAviso(null)} className="text-xs underline">fechar</button>
        </div>
      )}

      <div className="flex gap-1 border-b border-gray-100 dark:border-gray-700">
        {([
          { id: 'dashboard' as Aba, rotulo: 'Dashboard', icone: BarChart3 },
          { id: 'titulos' as Aba, rotulo: 'Títulos', icone: ListChecks },
          { id: 'pendencias' as Aba, rotulo: 'Pendências', icone: AlertTriangle },
        ]).map(({ id, rotulo, icone: Icone }) => (
          <button
            key={id}
            type="button"
            onClick={() => setAba(id)}
            className={`px-4 py-2 text-sm font-medium flex items-center gap-2 border-b-2 -mb-px ${
              aba === id
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
            }`}
          >
            <Icone className="w-4 h-4" /> {rotulo}
          </button>
        ))}
      </div>

      {aba === 'dashboard' && (
        <ContasReceberDashboard
          filtros={filtrosPainel}
          onFiltrar={aplicarFiltroPainel}
          onLimpar={limparFiltroPainel}
          padrao={padraoPainel}
          operadoras={operadoras}
          onNavegarPendencias={navegarParaPendencias}
        />
      )}

      {aba === 'titulos' && (
        <TitulosList
          titulos={titulos}
          operadoras={operadoras}
          total={total}
          loading={loading}
          error={error}
          podeEditar={podeEditar}
          filtros={filtros}
          onFiltrar={aplicarFiltro}
          onAtualizar={() => void refetch()}
          onNovoTitulo={() => setNovoAberto(true)}
          onBaixa={abrirBaixa}
          onGlosa={abrirGlosa}
          onCancelar={(titulo) => void confirmarCancelamento(titulo)}
          buscarGuias={buscarGuias}
        />
      )}

      {aba === 'pendencias' && (
        <div className="space-y-4">
          <div className="flex gap-1">
            {([
              { id: 'lotes' as SubAbaPendencias, rotulo: 'Sem NF (lotes)' },
              { id: 'particulares' as SubAbaPendencias, rotulo: 'Particulares' },
            ]).map(({ id, rotulo }) => (
              <button
                key={id}
                type="button"
                onClick={() => setSubAbaPendencias(id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium ${
                  subAbaPendencias === id
                    ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                    : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
              >
                {rotulo}
              </button>
            ))}
          </div>

          {subAbaPendencias === 'lotes'
            ? <PendenciasNaoFaturadas operadoras={operadoras} />
            : <PendenciasParticulares />}
        </div>
      )}

      <NovoTituloModal
        aberto={novoAberto}
        onFechar={() => setNovoAberto(false)}
        onCriar={criarTitulo}
      />

      <BaixaModal
        titulo={tituloBaixa}
        modo={modoModal}
        onFechar={() => setTituloBaixa(null)}
        onRegistrar={registrarBaixa}
        onLancarGlosas={lancarGlosas}
        buscarGuias={buscarGuias}
      />
    </div>
  );
};

export default ContasReceberPage;
