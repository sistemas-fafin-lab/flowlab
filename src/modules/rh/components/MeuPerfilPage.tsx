import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Lock, UserX, X } from 'lucide-react';
import ColaboradorResumoCard from './ColaboradorResumoCard';
import DadosPessoaisSection from './sections/DadosPessoaisSection';
import RecibosPagamentoLista from './recibos/RecibosPagamentoLista';
import DocumentosAssinadosCard from './documentos/DocumentosAssinadosCard';
import { useMeuColaborador } from '../hooks/useMeuColaborador';
import { useRecibosColaborador } from '../hooks/useRecibosColaborador';
import type { Colaborador } from '../types';

type Aba = 'dados' | 'documentos';

const cardClass = 'bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700';

const RECIBOS_NO_RESUMO = 4;

/** Lista completa de recibos num modal (portal no body — o layout tem ancestral com transform). */
const TodosRecibosModal: React.FC<{ onClose: () => void; children: React.ReactNode }> = ({ onClose, children }) => {
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  return createPortal(
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-stretch sm:items-center justify-center z-50 sm:p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="todos-recibos-titulo"
        className="bg-white dark:bg-slate-900 sm:rounded-3xl shadow-2xl w-full sm:max-w-[880px] sm:max-h-[85vh] flex flex-col overflow-hidden"
      >
        <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-gray-100 dark:border-slate-700/50">
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400">Meus documentos</p>
            <h2 id="todos-recibos-titulo" className="text-lg font-semibold text-gray-900 dark:text-white">Recibos de pagamento</h2>
          </div>
          <button onClick={onClose} title="Fechar" className="p-2 rounded-xl text-slate-500 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">{children}</div>
      </div>
    </div>,
    document.body,
  );
};

const DocumentosAba: React.FC<{ colaborador: Colaborador }> = ({ colaborador }) => {
  const { recibos, loading, error, refetch, gerarLink } = useRecibosColaborador(colaborador.id);
  const [verTodos, setVerTodos] = useState(false);
  const recentes = useMemo(
    () => [...recibos].sort((a, b) => b.competencia.localeCompare(a.competencia)).slice(0, RECIBOS_NO_RESUMO),
    [recibos],
  );

  return (
    <div className="space-y-4">
      <DocumentosAssinadosCard
        colaboradorId={colaborador.id}
        colaboradorNome={colaborador.nome}
        visao="colaborador"
        className={`${cardClass} p-4 sm:p-5`}
      />

      <section className={`${cardClass} p-4 sm:p-5`}>
        <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">Recibos de pagamento</h3>
        {loading ? (
          <p className="text-sm text-gray-400 dark:text-gray-500">Carregando seus recibos...</p>
        ) : error ? (
          <div className="text-sm text-red-600 dark:text-red-400 flex items-center justify-between gap-3">
            <span>{error}</span>
            <button onClick={() => refetch()} className="shrink-0 font-medium hover:underline">Tentar novamente</button>
          </div>
        ) : (
          <>
            <RecibosPagamentoLista recibos={recentes} visao="colaborador" gerarLink={gerarLink} semFiltros />
            {recibos.length > RECIBOS_NO_RESUMO && (
              <button
                type="button"
                onClick={() => setVerTodos(true)}
                className="mt-3 w-full px-4 py-2 rounded-xl text-sm font-medium text-blue-600 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
              >
                Ver todos os recibos ({recibos.length})
              </button>
            )}
          </>
        )}
      </section>

      <p className="flex items-center justify-center gap-1.5 text-xs text-gray-400 dark:text-gray-500">
        <Lock className="w-3.5 h-3.5" />
        Somente você e o RH têm acesso a estes documentos.
      </p>

      {verTodos && (
        <TodosRecibosModal onClose={() => setVerTodos(false)}>
          <RecibosPagamentoLista recibos={recibos} visao="colaborador" gerarLink={gerarLink} />
        </TodosRecibosModal>
      )}
    </div>
  );
};

const PerfilConteudo: React.FC<{ colaborador: Colaborador }> = ({ colaborador }) => {
  const [aba, setAba] = useState<Aba>('dados');
  const abas: { id: Aba; label: string }[] = [
    { id: 'dados', label: 'Dados pessoais' },
    { id: 'documentos', label: 'Documentos' },
  ];

  return (
    <div className="grid gap-6 min-[940px]:grid-cols-[300px_1fr] items-start">
      <ColaboradorResumoCard colaborador={colaborador} recolherAte="min-[940px]" className="min-[940px]:sticky min-[940px]:top-6" />

      <div className="space-y-4 min-w-0">
        <div className="inline-flex p-1 rounded-xl bg-gray-100 dark:bg-slate-800" role="tablist">
          {abas.map((a) => (
            <button
              key={a.id}
              type="button"
              role="tab"
              aria-selected={aba === a.id}
              onClick={() => setAba(a.id)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                aba === a.id
                  ? 'bg-white dark:bg-slate-700 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
              }`}
            >
              {a.label}
            </button>
          ))}
        </div>

        {aba === 'dados' ? (
          <div className={`${cardClass} p-4 sm:p-6`}>
            <DadosPessoaisSection
              colaborador={colaborador}
              podeEditar={false}
              editando={false}
              bloqueada={false}
              onEditandoChange={() => undefined}
            />
          </div>
        ) : (
          <DocumentosAba colaborador={colaborador} />
        )}
      </div>
    </div>
  );
};

/** Meu perfil (rh-meu-perfil): autoatendimento do colaborador — card, dados pessoais (leitura), documentos assinados e recibos. */
const MeuPerfilPage: React.FC = () => {
  const { colaborador, loading, error, semVinculo, refetch } = useMeuColaborador();

  return (
    <div className="space-y-6">
      <div className="animate-fade-in-up">
        <h2 className="text-2xl font-bold bg-gradient-to-r from-gray-800 to-gray-600 dark:from-gray-100 dark:to-gray-300 bg-clip-text text-transparent">
          Meu perfil
        </h2>
        <p className="text-gray-500 dark:text-gray-400">Consulte seus dados pessoais e documentos.</p>
      </div>

      {loading ? (
        <div className={`${cardClass} p-8 text-center text-sm text-gray-400 dark:text-gray-500`}>Carregando seu perfil...</div>
      ) : error ? (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 text-red-700 dark:text-red-300 text-sm flex items-center justify-between gap-4">
          <span>{error}</span>
          <button onClick={() => refetch()} className="shrink-0 px-3 py-1.5 rounded-lg border border-red-300 dark:border-red-700 font-medium">
            Tentar novamente
          </button>
        </div>
      ) : semVinculo || !colaborador ? (
        <div className={`${cardClass} p-8 text-center text-gray-400 dark:text-gray-500`}>
          <UserX className="w-8 h-8 mx-auto mb-2 opacity-50" />
          Seu usuário não está vinculado a um cadastro de colaborador. Fale com o RH.
        </div>
      ) : (
        <PerfilConteudo colaborador={colaborador} />
      )}
    </div>
  );
};

export default MeuPerfilPage;
