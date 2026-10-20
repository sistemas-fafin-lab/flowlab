import React, { useEffect, useRef, useState } from 'react';
import { Search, SlidersHorizontal, X } from 'lucide-react';
import Select from '../../../components/Select';
import DatePicker from '../../../components/DatePicker';
import { formatCurrency, PAYMENT_METHOD_LABELS, PAYMENT_TYPE_LABELS } from '../../../utils/paymentUtils';
import {
  ABAS,
  contarRecortes,
  proximoDiaDePagamento,
  rotuloDiaCurto,
  temFiltroAtivo,
  type AbaStatus,
  type FiltrosPagamentos,
  type OpcoesRecortes,
  type OrdemPedidos,
  type PeriodoPagamento,
} from '../domain/filtrosPagamentos';
import ModalFiltrosPagamentos from './ModalFiltrosPagamentos';
import { CAMPO, CARTAO } from './estilos';

// Barra única de filtros: abas de status (o único controle de status), busca, data de
// pagamento, o painel "Filtros" com os demais recortes e a ordem. Embaixo, o resumo do
// recorte (quantidade e valor) e uma pílula por recorte ligado.

interface Props {
  filtros: FiltrosPagamentos;
  alterar: (patch: Partial<FiltrosPagamentos>) => void;
  limpar: () => void;
  /** Contagem de cada aba sobre o recorte sem a aba. */
  contagem: Record<AbaStatus, { quantidade: number; valor: number }>;
  /** Pedidos na lista agora, e a soma deles. */
  quantidade: number;
  total: number;
  hoje: string;
  opcoes: OpcoesRecortes;
  mostrarSetor: boolean;
}

const ORDENS: { value: OrdemPedidos; label: string }[] = [
  { value: 'pagamento', label: 'Ordenar por data de pagamento' },
  { value: 'recentes', label: 'Ordenar por mais recentes' },
  { value: 'valor', label: 'Ordenar por maior valor' },
];

const Pilula: React.FC<{ texto: string; onRemover: () => void }> = ({ texto, onRemover }) => (
  <span className="inline-flex items-center gap-1 pl-2.5 pr-1 py-1 rounded-lg bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs font-medium max-w-[240px]">
    <span className="truncate">{texto}</span>
    <button
      type="button"
      onClick={onRemover}
      aria-label={`Remover filtro ${texto}`}
      className="p-0.5 rounded hover:bg-blue-100 dark:hover:bg-blue-800/50 transition-colors"
    >
      <X className="w-3 h-3" />
    </button>
  </span>
);

const BarraFiltrosPagamentos: React.FC<Props> = ({
  filtros,
  alterar,
  limpar,
  contagem,
  quantidade,
  total,
  hoje,
  opcoes,
  mostrarSetor,
}) => {
  const [modalAberto, setModalAberto] = useState(false);
  const campoBusca = useRef<HTMLInputElement>(null);

  // A busca tem rascunho local: o endereço da página só muda 250 ms depois da última tecla.
  // `enviado` separa o que nós mandamos de uma mudança vinda de fora (o "Limpar tudo"), que
  // precisa voltar para o campo.
  const [rascunho, setRascunho] = useState(filtros.busca);
  const enviado = useRef(filtros.busca);
  useEffect(() => {
    if (filtros.busca !== enviado.current) {
      enviado.current = filtros.busca;
      setRascunho(filtros.busca);
    }
  }, [filtros.busca]);
  useEffect(() => {
    if (rascunho === enviado.current) return;
    const espera = setTimeout(() => {
      enviado.current = rascunho;
      alterar({ busca: rascunho });
    }, 250);
    return () => clearTimeout(espera);
  }, [rascunho, alterar]);

  const limparBusca = () => {
    setRascunho('');
    enviado.current = '';
    alterar({ busca: '' });
  };

  // "/" leva à busca, como em outros sistemas; não age enquanto se digita em outro campo.
  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key !== '/' || e.ctrlKey || e.metaKey || e.altKey) return;
      const alvo = e.target as HTMLElement | null;
      if (alvo && (alvo.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(alvo.tagName))) return;
      e.preventDefault();
      campoBusca.current?.focus();
    };
    document.addEventListener('keydown', aoTeclar);
    return () => document.removeEventListener('keydown', aoTeclar);
  }, []);

  const periodos: { value: PeriodoPagamento; label: string; description?: string }[] = [
    { value: 'todas', label: 'Qualquer data de pagamento' },
    { value: 'proximo', label: `Próximo pagamento (${rotuloDiaCurto(proximoDiaDePagamento(hoje))})` },
    { value: 'semana', label: 'Pagamentos desta semana' },
    { value: 'atrasados', label: 'Atrasados', description: 'Ainda não pagos e com a data já passada' },
    { value: 'periodo', label: 'Período…' },
  ];

  const recortes = contarRecortes(filtros);
  const periodoInvertido = filtros.periodo === 'periodo' && !!filtros.de && !!filtros.ate && filtros.de > filtros.ate;

  const tirar = <K extends 'setores' | 'tipos' | 'formas' | 'solicitantes' | 'autorizadores'>(campo: K, valor: string) =>
    alterar({ [campo]: (filtros[campo] as string[]).filter((v) => v !== valor) } as Partial<FiltrosPagamentos>);

  const pilulas = [
    ...filtros.setores.map((v) => ({ chave: `setor-${v}`, texto: `Setor: ${v}`, remover: () => tirar('setores', v) })),
    ...filtros.tipos.map((v) => ({ chave: `tipo-${v}`, texto: PAYMENT_TYPE_LABELS[v], remover: () => tirar('tipos', v) })),
    ...filtros.formas.map((v) => ({ chave: `forma-${v}`, texto: PAYMENT_METHOD_LABELS[v], remover: () => tirar('formas', v) })),
    ...filtros.solicitantes.map((v) => ({ chave: `sol-${v}`, texto: `Solicitante: ${v}`, remover: () => tirar('solicitantes', v) })),
    ...filtros.autorizadores.map((v) => ({ chave: `aut-${v}`, texto: `Autorizado por: ${v}`, remover: () => tirar('autorizadores', v) })),
    ...(filtros.soMeus ? [{ chave: 'meus', texto: 'Só os meus pedidos', remover: () => alterar({ soMeus: false }) }] : []),
  ];

  return (
    <div className={`${CARTAO} p-4 sm:p-5 space-y-4 animate-fade-in-up`}>
      {/* Abas de status */}
      <div role="tablist" aria-label="Status do pedido" className="flex gap-1.5 overflow-x-auto -mx-1 px-1 pb-1">
        {ABAS.map(({ aba, rotulo }) => {
          const ativa = filtros.aba === aba;
          return (
            <button
              key={aba}
              type="button"
              role="tab"
              aria-selected={ativa}
              onClick={() => alterar({ aba })}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all duration-200 ${
                ativa
                  ? 'bg-gradient-to-r from-blue-500 to-indigo-500 text-white shadow-md shadow-blue-500/25'
                  : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              {rotulo}
              <span
                className={`min-w-[1.5rem] px-1.5 rounded-md text-xs tabular-nums text-center ${
                  ativa ? 'bg-white/20' : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
                }`}
              >
                {contagem[aba].quantidade}
              </span>
            </button>
          );
        })}
      </div>

      {/* Busca e controles */}
      <div className="flex flex-col xl:flex-row gap-3">
        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          <input
            ref={campoBusca}
            type="search"
            value={rascunho}
            onChange={(e) => setRascunho(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape' && rascunho) {
                e.preventDefault();
                limparBusca();
              }
            }}
            placeholder="Buscar fornecedor, código, NF, CPF/CNPJ, pessoa…"
            aria-label="Buscar pedidos"
            title="Tecle / para buscar"
            className={`${CAMPO} pl-10 pr-10 [&::-webkit-search-cancel-button]:hidden`}
          />
          {rascunho && (
            <button
              type="button"
              onClick={limparBusca}
              aria-label="Limpar busca"
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] xl:flex gap-3">
          <Select
            value={filtros.periodo}
            onChange={(v) => alterar(v === 'periodo' ? { periodo: 'periodo' } : { periodo: v as PeriodoPagamento, de: '', ate: '' })}
            options={periodos}
            controlClass={CAMPO}
            wrapperClass="xl:w-72"
            ariaLabel="Data de pagamento"
          />
          <button
            type="button"
            onClick={() => setModalAberto(true)}
            className={`inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium border transition-all duration-200 ${
              recortes > 0
                ? 'bg-blue-600 border-blue-600 text-white shadow-md shadow-blue-500/25 hover:bg-blue-700'
                : 'bg-gray-50/50 dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:border-gray-300 dark:hover:border-gray-500'
            }`}
          >
            <SlidersHorizontal className="w-4 h-4" />
            Filtros
            {recortes > 0 && <span className="px-1.5 rounded-md bg-white/25 text-xs tabular-nums">{recortes}</span>}
          </button>
          <Select
            value={filtros.ordem}
            onChange={(v) => alterar({ ordem: v as OrdemPedidos })}
            options={ORDENS}
            controlClass={CAMPO}
            wrapperClass="xl:w-64"
            ariaLabel="Ordem da lista"
          />
        </div>
      </div>

      {filtros.periodo === 'periodo' && (
        <div>
          <div className="grid grid-cols-2 gap-3 sm:max-w-md">
            <label className="text-xs font-medium text-gray-500 dark:text-gray-400">
              De
              <DatePicker
                value={filtros.de}
                onChange={(de) => alterar({ de })}
                allowClear
                placeholder="Sem início"
                controlClass={`mt-1 ${CAMPO}`}
                ariaLabel="Data de pagamento a partir de"
              />
            </label>
            <label className="text-xs font-medium text-gray-500 dark:text-gray-400">
              Até
              <DatePicker
                value={filtros.ate}
                onChange={(ate) => alterar({ ate })}
                allowClear
                placeholder="Sem fim"
                controlClass={`mt-1 ${CAMPO}`}
                ariaLabel="Data de pagamento até"
              />
            </label>
          </div>
          {periodoInvertido && (
            <p className="mt-2 text-xs text-red-600 dark:text-red-400">A data inicial está depois da final.</p>
          )}
        </div>
      )}

      {/* Resumo do recorte e filtros ligados */}
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-gray-600 dark:text-gray-300 mr-1" aria-live="polite">
          <strong className="text-gray-800 dark:text-gray-100 tabular-nums">{quantidade}</strong>{' '}
          {quantidade === 1 ? 'pedido' : 'pedidos'} ·{' '}
          <strong className="text-gray-800 dark:text-gray-100 tabular-nums">{formatCurrency(total)}</strong>
        </span>
        {pilulas.map((p) => (
          <Pilula key={p.chave} texto={p.texto} onRemover={p.remover} />
        ))}
        {temFiltroAtivo(filtros) && (
          <button
            type="button"
            onClick={limpar}
            className="ml-auto inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-gray-500 dark:text-gray-400 hover:text-red-500 transition-colors"
          >
            <X className="w-3.5 h-3.5" /> Limpar tudo
          </button>
        )}
      </div>

      {modalAberto && (
        <ModalFiltrosPagamentos
          filtros={filtros}
          alterar={alterar}
          opcoes={opcoes}
          mostrarSetor={mostrarSetor}
          quantidade={quantidade}
          onFechar={() => setModalAberto(false)}
        />
      )}
    </div>
  );
};

export default BarraFiltrosPagamentos;
