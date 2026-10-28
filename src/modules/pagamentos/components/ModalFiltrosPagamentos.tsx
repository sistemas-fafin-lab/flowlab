import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { SlidersHorizontal, X } from 'lucide-react';
import MultiSelect from '../../../components/MultiSelect';
import Select from '../../../components/Select';
import DatePicker from '../../../components/DatePicker';
import Switch from '../../../components/Switch';
import { PAYMENT_METHOD_LABELS, PAYMENT_TYPE_LABELS } from '../../../utils/paymentUtils';
import { FORMAS, TIPOS, type FiltrosPagamentos, type OpcoesRecortes, type OrdemPedidos, type PeriodoPagamento } from '../domain/filtrosPagamentos';
import { useTravarRolagem } from '../hooks/useTravarRolagem';
import { ALCA_MODAL, CABECALHO_MODAL, CAMPO, CORPO_MODAL, FUNDO_MODAL, PAINEL_MODAL, RODAPE_MODAL, ROTULO } from './estilos';

// Os recortes que não cabem na barra. Aplica na hora (a lista é filtrada no navegador, sem ida
// ao banco), e o botão do rodapé mostra quantos pedidos sobram. Vai num portal: dentro do
// cartão animado da barra (transform), position: fixed ficaria preso ao cartão.
// No celular sobe do rodapé e traz também a data de pagamento e a ordem, que lá não cabem
// na barra.

export interface Opcao<T extends string> {
  value: T;
  label: string;
  description?: string;
}

const SEM_RECORTES: Partial<FiltrosPagamentos> = {
  setores: [],
  tipos: [],
  formas: [],
  solicitantes: [],
  autorizadores: [],
  soMeus: false,
};

interface Props {
  filtros: FiltrosPagamentos;
  alterar: (patch: Partial<FiltrosPagamentos>) => void;
  opcoes: OpcoesRecortes;
  /** Só quem vê todos os setores escolhe setor. */
  mostrarSetor: boolean;
  quantidade: number;
  /** Data de pagamento e ordem: as mesmas opções da barra (no celular, só aqui). */
  periodos: Opcao<PeriodoPagamento>[];
  ordens: Opcao<OrdemPedidos>[];
  onEscolherPeriodo: (periodo: string) => void;
  onFechar: () => void;
}

const ModalFiltrosPagamentos: React.FC<Props> = ({
  filtros,
  alterar,
  opcoes,
  mostrarSetor,
  quantidade,
  periodos,
  ordens,
  onEscolherPeriodo,
  onFechar,
}) => {
  useTravarRolagem();
  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onFechar();
    };
    document.addEventListener('keydown', aoTeclar);
    return () => document.removeEventListener('keydown', aoTeclar);
  }, [onFechar]);

  const campoMultiplo = `${CAMPO} min-h-[44px] !py-1.5`;
  const periodoInvertido = filtros.periodo === 'periodo' && !!filtros.de && !!filtros.ate && filtros.de > filtros.ate;

  return createPortal(
    <div
      className={FUNDO_MODAL}
      onMouseDown={(e) => {
        // Só o clique no fundo fecha: um arraste que começa no painel e termina fora, não.
        if (e.target === e.currentTarget) onFechar();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="titulo-filtros-pagamentos"
        className={`${PAINEL_MODAL} sm:max-w-2xl`}
      >
        <div className={CABECALHO_MODAL}>
          <div className={ALCA_MODAL} />
          <div className="flex items-start justify-between gap-4 px-4 sm:px-6 pt-2 pb-3 sm:py-5">
            <div className="flex items-center gap-3 min-w-0">
              <div className="hidden sm:flex w-10 h-10 flex-shrink-0 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-xl items-center justify-center shadow-md shadow-blue-500/25">
                <SlidersHorizontal className="w-5 h-5 text-white" />
              </div>
              <div className="min-w-0">
                <h2 id="titulo-filtros-pagamentos" className="text-lg font-semibold text-gray-800 dark:text-gray-100">
                  Filtros
                </h2>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Vários valores no mesmo campo valem como “ou”; campos diferentes, como “e”.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onFechar}
              aria-label="Fechar"
              className="-mr-2 flex flex-shrink-0 items-center justify-center w-10 h-10 rounded-xl text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className={`${CORPO_MODAL} grid grid-cols-1 sm:grid-cols-2 content-start gap-4 px-4 sm:px-6 py-5`}>
          {/* Celular: a data e a ordem moram aqui (na barra só cabem a busca e este botão). */}
          <div className="sm:hidden space-y-4 pb-4 border-b border-gray-100 dark:border-gray-700">
            <div>
              <label className={ROTULO}>Data de pagamento</label>
              <Select value={filtros.periodo} onChange={onEscolherPeriodo} options={periodos} controlClass={CAMPO} ariaLabel="Data de pagamento" />
            </div>
            {filtros.periodo === 'periodo' && (
              <div>
                <div className="grid grid-cols-2 gap-3">
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
                {periodoInvertido && <p className="mt-2 text-xs text-red-600 dark:text-red-400">A data inicial está depois da final.</p>}
              </div>
            )}
            <div>
              <label className={ROTULO}>Ordem da lista</label>
              <Select
                value={filtros.ordem}
                onChange={(v) => alterar({ ordem: v as OrdemPedidos })}
                options={ordens}
                controlClass={CAMPO}
                ariaLabel="Ordem da lista"
              />
            </div>
          </div>

          {mostrarSetor && (
            <div>
              <label className={ROTULO}>Setor</label>
              <MultiSelect
                value={filtros.setores}
                onChange={(setores) => alterar({ setores })}
                options={opcoes.setores.map(({ setor, quantidade: n }) => ({
                  value: setor,
                  label: setor,
                  description: `${n} ${n === 1 ? 'pedido' : 'pedidos'}`,
                }))}
                placeholder="Todos os setores"
                searchPlaceholder="Buscar setor"
                emptyText="Nenhum setor com pedidos."
                controlClass={campoMultiplo}
                ariaLabel="Setor"
              />
            </div>
          )}
          <div>
            <label className={ROTULO}>Tipo</label>
            <MultiSelect
              value={filtros.tipos}
              onChange={(tipos) => alterar({ tipos: tipos as FiltrosPagamentos['tipos'] })}
              options={TIPOS.map((t) => ({ value: t, label: PAYMENT_TYPE_LABELS[t] }))}
              placeholder="Todos os tipos"
              controlClass={campoMultiplo}
              ariaLabel="Tipo"
            />
          </div>
          <div>
            <label className={ROTULO}>Forma de pagamento</label>
            <MultiSelect
              value={filtros.formas}
              onChange={(formas) => alterar({ formas: formas as FiltrosPagamentos['formas'] })}
              options={FORMAS.map((f) => ({ value: f, label: PAYMENT_METHOD_LABELS[f] }))}
              placeholder="Todas as formas"
              controlClass={campoMultiplo}
              ariaLabel="Forma de pagamento"
            />
          </div>
          <div>
            <label className={ROTULO}>Solicitante</label>
            <MultiSelect
              value={filtros.solicitantes}
              onChange={(solicitantes) => alterar({ solicitantes })}
              options={opcoes.solicitantes.map((n) => ({ value: n, label: n }))}
              placeholder="Qualquer pessoa"
              searchPlaceholder="Buscar nome"
              emptyText="Ninguém com esse nome."
              controlClass={campoMultiplo}
              ariaLabel="Solicitante"
            />
          </div>
          <div>
            <label className={ROTULO}>Autorizado por</label>
            <MultiSelect
              value={filtros.autorizadores}
              onChange={(autorizadores) => alterar({ autorizadores })}
              options={opcoes.autorizadores.map((n) => ({ value: n, label: n }))}
              placeholder="Qualquer pessoa"
              searchPlaceholder="Buscar nome"
              emptyText="Ninguém com esse nome."
              controlClass={campoMultiplo}
              ariaLabel="Autorizado por"
            />
          </div>
          <label className="sm:col-span-2 flex items-center justify-between gap-4 px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50/50 dark:bg-gray-700/40 cursor-pointer">
            <span>
              <span className="block text-sm font-medium text-gray-800 dark:text-gray-100">Só os meus pedidos</span>
              <span className="block text-xs text-gray-500 dark:text-gray-400">Os que você mesmo criou.</span>
            </span>
            <Switch checked={filtros.soMeus} onChange={(soMeus) => alterar({ soMeus })} />
          </label>
        </div>

        <div className={`${RODAPE_MODAL} flex items-center justify-between gap-3`}>
          <button
            type="button"
            onClick={() => alterar(SEM_RECORTES)}
            className="flex-shrink-0 px-3 py-2 rounded-xl text-sm text-gray-500 dark:text-gray-400 hover:text-red-500 transition-colors"
          >
            Limpar estes filtros
          </button>
          <button
            type="button"
            onClick={onFechar}
            className="flex-1 sm:flex-none px-5 h-11 rounded-xl text-sm font-semibold bg-gradient-to-r from-blue-500 to-indigo-500 text-white shadow-md shadow-blue-500/25 hover:from-blue-600 hover:to-indigo-600 active:scale-[0.98] transition-all"
          >
            Ver {quantidade} {quantidade === 1 ? 'pedido' : 'pedidos'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default ModalFiltrosPagamentos;
