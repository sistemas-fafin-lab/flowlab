import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { X } from 'lucide-react';
import ColaboradorResumoCard from './ColaboradorResumoCard';
import EditarCadastroSection from './sections/EditarCadastroSection';
import DadosPessoaisSection from './sections/DadosPessoaisSection';
import VinculoUsuarioSection from './sections/VinculoUsuarioSection';
import GestorSection from './sections/GestorSection';
import RecibosPagamentoLista from './recibos/RecibosPagamentoLista';
import { useRecibosColaborador } from '../hooks/useRecibosColaborador';
import type { AtualizarCadastroInput, Colaborador, Departamento } from '../types';

interface ColaboradorDetalheModalProps {
  colaborador: Colaborador;
  colaboradores: Colaborador[];
  departamentos: Departamento[];
  /** canManageColaboradores: sem ela a ficha é só leitura. */
  podeGerenciar: boolean;
  podeMudarDepartamento: boolean;
  /** canManageHolerites ou canViewAllHolerites: mostra a aba Documentos. */
  podeVerRecibos: boolean;
  onClose: () => void;
  atualizarCadastro: (id: string, dados: AtualizarCadastroInput) => Promise<string | null>;
  vincularUsuario: (colaboradorId: string, userProfileId: string) => Promise<string | null>;
  desvincularUsuario: (colaboradorId: string) => Promise<string | null>;
  definirGestor: (colaboradorId: string, gestorId: string | null) => Promise<string | null>;
}

type Aba = 'dados' | 'documentos';
/** Seção da aba Dados pessoais em edição — uma por vez. */
type SecaoEditavel = 'cadastrais' | 'pessoais' | 'gestor';

const STATUS_BADGE: Record<Colaborador['status'], { label: string; className: string }> = {
  ativo: { label: 'Ativo', className: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300' },
  desligado: { label: 'Desligado', className: 'bg-gray-100 dark:bg-gray-700/60 text-gray-500 dark:text-gray-400' },
};

const RecibosAba: React.FC<{ colaboradorId: string }> = ({ colaboradorId }) => {
  const { recibos, loading, error, refetch, gerarLink } = useRecibosColaborador(colaboradorId);

  if (loading) return <p className="text-sm text-gray-400 dark:text-gray-500">Carregando recibos...</p>;
  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 text-red-700 dark:text-red-300 text-sm flex items-center justify-between gap-4">
        <span>{error}</span>
        <button onClick={() => refetch()} className="shrink-0 px-3 py-1.5 rounded-lg border border-red-300 dark:border-red-700 font-medium">
          Tentar novamente
        </button>
      </div>
    );
  }
  return (
    <section>
      <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">Recibos de pagamento</h3>
      <RecibosPagamentoLista recibos={recibos} visao="rh" gerarLink={gerarLink} />
    </section>
  );
};

/**
 * Ficha do colaborador (protótipo: modal variação A + card variação B).
 * Coluna esquerda com o card de resumo; direita com as abas Dados pessoais
 * (quatro seções empilhadas) e Documentos (recibos).
 */
const ColaboradorDetalheModal: React.FC<ColaboradorDetalheModalProps> = ({
  colaborador,
  colaboradores,
  departamentos,
  podeGerenciar,
  podeMudarDepartamento,
  podeVerRecibos,
  onClose,
  atualizarCadastro,
  vincularUsuario,
  desvincularUsuario,
  definirGestor,
}) => {
  const [aba, setAba] = useState<Aba>('dados');
  const [secaoEmEdicao, setSecaoEmEdicao] = useState<SecaoEditavel | null>(null);
  const emEdicao = secaoEmEdicao !== null;

  // ESC e clique fora não fecham com edição em andamento: o usuário cancela antes.
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !emEdicao) onClose();
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose, emEdicao]);

  const controleEdicao = (secao: SecaoEditavel) => ({
    editando: secaoEmEdicao === secao,
    bloqueada: emEdicao && secaoEmEdicao !== secao,
    onEditandoChange: (editando: boolean) => setSecaoEmEdicao(editando ? secao : null),
  });

  const status = STATUS_BADGE[colaborador.status];
  const subtitulo = [
    colaborador.cargo,
    colaborador.departamentoNome,
    colaborador.matricula ? `Matrícula ${colaborador.matricula}` : null,
  ].filter(Boolean).join(' · ');

  const abas: { id: Aba; label: string }[] = [
    { id: 'dados', label: 'Dados pessoais' },
    ...(podeVerRecibos ? [{ id: 'documentos' as const, label: 'Documentos' }] : []),
  ];

  // Portal no body: algum ancestral do layout tem transform (animação de
  // entrada), o que faria o `fixed inset-0` ficar relativo a ele.
  return createPortal(
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-stretch md:items-center justify-center z-50 animate-fade-in md:p-4"
      onClick={(e) => e.target === e.currentTarget && !emEdicao && onClose()}
    >
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-labelledby="colaborador-modal-titulo"
        initial={{ opacity: 0, scale: 0.96, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.25, ease: [0.32, 0.72, 0, 1] }}
        className="relative bg-white dark:bg-slate-900 md:rounded-3xl md:border border-gray-100 dark:border-slate-700/50 shadow-2xl overflow-hidden flex flex-col w-full md:max-w-[1120px] md:h-[min(840px,90vh)]"
      >
        <div className="flex items-start justify-between gap-3 px-4 py-4 sm:px-6 border-b border-gray-100 dark:border-slate-700/50 flex-shrink-0">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 id="colaborador-modal-titulo" className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white truncate">
                {colaborador.nome}
              </h2>
              <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${status.className}`}>{status.label}</span>
            </div>
            {subtitulo && <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{subtitulo}</p>}
          </div>
          <button
            onClick={onClose}
            disabled={emEdicao}
            title={emEdicao ? 'Conclua ou cancele a edição antes de fechar' : 'Fechar'}
            className="p-2 rounded-xl text-slate-500 dark:text-slate-400 hover:bg-red-50/60 dark:hover:bg-red-900/30 hover:text-red-600 dark:hover:text-red-400 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex-shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto md:overflow-hidden md:grid md:grid-cols-[300px_1fr]">
          <aside className="p-4 bg-gray-50 dark:bg-slate-800/40 md:border-r border-gray-100 dark:border-slate-700/50 md:overflow-y-auto">
            <ColaboradorResumoCard colaborador={colaborador} />
          </aside>

          <div className="flex flex-col md:overflow-y-auto">
            {abas.length > 1 && (
              <div className="px-4 sm:px-6 pt-4">
                <div className="inline-flex p-1 rounded-xl bg-gray-100 dark:bg-slate-800" role="tablist">
                  {abas.map((a) => (
                    <button
                      key={a.id}
                      type="button"
                      role="tab"
                      aria-selected={aba === a.id}
                      onClick={() => setAba(a.id)}
                      disabled={emEdicao && aba !== a.id}
                      className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                        aba === a.id
                          ? 'bg-white dark:bg-slate-700 text-gray-900 dark:text-white shadow-sm'
                          : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                      }`}
                    >
                      {a.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="p-4 sm:p-6">
              {aba === 'dados' ? (
                <div className="space-y-8 divide-y divide-gray-100 dark:divide-slate-700/50 [&>*:not(:first-child)]:pt-8">
                  <EditarCadastroSection
                    colaborador={colaborador}
                    departamentos={departamentos}
                    podeEditar={podeGerenciar}
                    podeMudarDepartamento={podeMudarDepartamento}
                    onSalvar={atualizarCadastro}
                    {...controleEdicao('cadastrais')}
                  />
                  <DadosPessoaisSection colaborador={colaborador} podeEditar={podeGerenciar} {...controleEdicao('pessoais')} />
                  <VinculoUsuarioSection
                    colaborador={colaborador}
                    onVincular={vincularUsuario}
                    onDesvincular={desvincularUsuario}
                    podeEditar={podeGerenciar}
                    bloqueada={emEdicao}
                  />
                  <GestorSection
                    colaborador={colaborador}
                    colaboradores={colaboradores}
                    onDefinirGestor={definirGestor}
                    podeEditar={podeGerenciar}
                    {...controleEdicao('gestor')}
                  />
                </div>
              ) : (
                <RecibosAba colaboradorId={colaborador.id} />
              )}
            </div>
          </div>
        </div>
      </motion.div>
    </div>,
    document.body,
  );
};

export default ColaboradorDetalheModal;
