import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Info, Layers, Receipt, Wallet, X } from 'lucide-react';
import DatePicker from '../../../../components/DatePicker';
import Select from '../../../../components/Select';
import { DEPARTMENTS } from '../../../../utils/permissions';
import { FORMAS_PAGAMENTO, NATUREZAS } from '../../constants';
import { FILTROS_FINOPS_VAZIOS, type FiltrosFinops, type PeriodoFinops, type PresetPeriodo } from '../../domain/finops';
import type { VisaoGasto } from '../../domain/visao';
import type { CategoriaTI } from '../../types';
import Segmentado, { type OpcaoSegmento } from '../ui/Segmentado';
import { ANEL_FOCO, CURVA_SAIDA, campoVidro } from '../ui/estilos';
import { VIDRO } from '../ui/Widget';

const PRESETS: OpcaoSegmento<PresetPeriodo>[] = [
  { valor: 'mes', rotulo: 'Mês' },
  { valor: 'trimestre', rotulo: 'Trimestre' },
  { valor: 'ano', rotulo: 'Ano' },
  { valor: '12meses', rotulo: '12 meses' },
  { valor: 'personalizado', rotulo: 'Personalizado' },
];

const EXPLICACAO: Record<VisaoGasto, string> = {
  cobranca: 'Cada cobrança no mês a que se refere, como no Mês a mês.',
  caixa: 'No mês em que foi paga; a que ainda não foi paga, no mês do vencimento.',
  diluida: 'Anual dividida pelos 12 meses do ciclo, semestral pelos 6, trimestral pelos 3.',
};

const VISOES: (OpcaoSegmento<VisaoGasto> & { explicacao: string })[] = [
  { valor: 'cobranca', rotulo: 'Cobrança', icone: Receipt, explicacao: EXPLICACAO.cobranca, dica: EXPLICACAO.cobranca },
  { valor: 'caixa', rotulo: 'Caixa', icone: Wallet, explicacao: EXPLICACAO.caixa, dica: EXPLICACAO.caixa },
  { valor: 'diluida', rotulo: 'Diluída', icone: Layers, explicacao: EXPLICACAO.diluida, dica: EXPLICACAO.diluida },
];

interface FiltrosFinopsProps {
  preset: PresetPeriodo;
  onPreset: (p: PresetPeriodo) => void;
  personalizado: PeriodoFinops;
  onPersonalizado: (p: PeriodoFinops) => void;
  filtros: FiltrosFinops;
  onFiltros: (f: FiltrosFinops) => void;
  categorias: CategoriaTI[];
  fornecedores: string[];
  visao: VisaoGasto;
  onVisao: (v: VisaoGasto) => void;
  /** Recarregando os pagamentos: mostra a barrinha de progresso na base do cartão. */
  carregando?: boolean;
}

/**
 * Uma linha de filtros acima de tudo (dataviz): período e visão primeiro, depois
 * as dimensões. Nenhum controle do navegador: listas e calendário são os do
 * design system no tom "vidro". O cartão fica num z acima dos de baixo (z-20) para
 * os menus abertos passarem por cima deles — e abaixo do cabeçalho fixo do
 * celular (z-40) e da gaveta do menu (z-50) do Layout.
 */
const FiltrosFinopsBarra: React.FC<FiltrosFinopsProps> = ({
  preset,
  onPreset,
  personalizado,
  onPersonalizado,
  filtros,
  onFiltros,
  categorias,
  fornecedores,
  visao,
  onVisao,
  carregando = false,
}) => {
  const definir = <K extends keyof FiltrosFinops>(chave: K, valor: FiltrosFinops[K]) => onFiltros({ ...filtros, [chave]: valor });
  const aplicados = Object.values(filtros).filter((v) => v !== '').length;
  const visaoAtual = VISOES.find((v) => v.valor === visao) ?? VISOES[0];

  // Mantém "de ≤ até": escolher um início depois do fim (ou o contrário) arrasta a outra ponta junto.
  const mudarDesde = (v: string) => v && onPersonalizado(v > personalizado.ate ? { desde: v, ate: v } : { ...personalizado, desde: v });
  const mudarAte = (v: string) => v && onPersonalizado(v < personalizado.desde ? { desde: v, ate: v } : { ...personalizado, ate: v });

  const campos: { chave: keyof FiltrosFinops; rotulo: string; opcoes: { value: string; label: string }[]; classe?: string }[] = [
    { chave: 'categoriaId', rotulo: 'Categoria', opcoes: [{ value: '', label: 'Todas as categorias' }, ...categorias.map((c) => ({ value: c.id, label: c.nome }))] },
    { chave: 'fornecedor', rotulo: 'Fornecedor', opcoes: [{ value: '', label: 'Todos os fornecedores' }, ...fornecedores.map((f) => ({ value: f, label: f }))] },
    { chave: 'setor', rotulo: 'Setor', opcoes: [{ value: '', label: 'Todos os setores' }, ...(DEPARTMENTS as string[]).map((s) => ({ value: s, label: s }))] },
    { chave: 'natureza', rotulo: 'Natureza', opcoes: [{ value: '', label: 'OPEX e CAPEX' }, ...NATUREZAS.map((n) => ({ value: n.valor, label: n.rotulo }))] },
    {
      chave: 'formaPagamento',
      rotulo: 'Forma de pagamento',
      opcoes: [{ value: '', label: 'Toda forma de pagamento' }, ...FORMAS_PAGAMENTO.map((f) => ({ value: f.valor, label: f.rotulo }))],
      classe: 'col-span-2 md:col-span-1',
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: CURVA_SAIDA, delay: 0.05 }}
      className={`${VIDRO} relative z-20 rounded-3xl p-4 sm:p-5 space-y-4`}
    >
      <div className="flex flex-wrap items-center gap-3">
        <Segmentado opcoes={PRESETS} valor={preset} onMudar={onPreset} ariaLabel="Período" />
        <Segmentado opcoes={VISOES} valor={visao} onMudar={onVisao} ariaLabel="Visão dos valores" />
        <AnimatePresence initial={false}>
          {preset === 'personalizado' && (
            <motion.div
              key="personalizado"
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -8 }}
              transition={{ duration: 0.2, ease: CURVA_SAIDA }}
              className="inline-flex flex-wrap items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400"
            >
              <span>De</span>
              <DatePicker
                value={personalizado.desde}
                onChange={mudarDesde}
                granularity="month"
                tone="vidro"
                ariaLabel="Início do período"
                controlClass={campoVidro(false, 'min-w-[11.5rem]')}
              />
              <span>até</span>
              <DatePicker
                value={personalizado.ate}
                onChange={mudarAte}
                granularity="month"
                tone="vidro"
                ariaLabel="Fim do período"
                controlClass={campoVidro(false, 'min-w-[11.5rem]')}
              />
            </motion.div>
          )}
        </AnimatePresence>
        <AnimatePresence>
          {aplicados > 0 && (
            <motion.button
              key="limpar"
              type="button"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.18, ease: CURVA_SAIDA }}
              onClick={() => onFiltros(FILTROS_FINOPS_VAZIOS)}
              className={`ml-auto inline-flex items-center gap-1.5 h-8 pl-2.5 pr-3 rounded-full text-xs font-semibold text-violet-700 dark:text-violet-200 bg-violet-50 dark:bg-violet-500/15 border border-violet-200/80 dark:border-violet-500/30 hover:bg-violet-100 dark:hover:bg-violet-500/25 ${ANEL_FOCO}`}
            >
              <span className="inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1 rounded-full bg-violet-600 text-white text-[10px] tabular-nums">
                {aplicados}
              </span>
              Limpar filtros
              <X className="w-3.5 h-3.5" aria-hidden="true" />
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      <p className="flex items-start gap-1.5 text-xs text-slate-500 dark:text-slate-400" aria-live="polite">
        <Info className="w-3.5 h-3.5 mt-px flex-shrink-0 text-violet-500 dark:text-violet-400" aria-hidden="true" />
        <AnimatePresence mode="wait" initial={false}>
          <motion.span key={visao} initial={{ opacity: 0, y: 3 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -3 }} transition={{ duration: 0.16 }}>
            <span className="font-semibold text-slate-700 dark:text-slate-200">Visão {visaoAtual.rotulo.toLowerCase()}:</span> {visaoAtual.explicacao}
          </motion.span>
        </AnimatePresence>
      </p>

      {/* 5 colunas só no 2xl: ao lado do menu lateral, em 1280px, cada campo ficaria com ~165px e o rótulo cortaria. */}
      <div className="grid grid-cols-2 md:grid-cols-3 2xl:grid-cols-5 gap-2.5">
        {campos.map((c) => (
          <Select
            key={c.chave}
            value={filtros[c.chave]}
            onChange={(v) => definir(c.chave, v as FiltrosFinops[typeof c.chave])}
            options={c.opcoes}
            ariaLabel={c.rotulo}
            tone="vidro"
            wrapperClass={c.classe ?? ''}
            controlClass={campoVidro(filtros[c.chave] !== '')}
          />
        ))}
      </div>

      {/* Recarga: o painel esmaece e uma luz corre na base do cartão (nada pisca). */}
      <AnimatePresence>
        {carregando && (
          <motion.div
            key="carga"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-x-8 bottom-0 h-0.5 overflow-hidden rounded-full"
            role="progressbar"
            aria-label="Carregando pagamentos"
          >
            <motion.div
              className="h-full w-1/3 rounded-full bg-gradient-to-r from-transparent via-violet-500 to-transparent"
              animate={{ x: ['-100%', '300%'] }}
              transition={{ repeat: Infinity, duration: 1.1, ease: 'easeInOut' }}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default FiltrosFinopsBarra;
