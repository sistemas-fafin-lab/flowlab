import React from 'react';
import { motion } from 'framer-motion';
import { FilterX } from 'lucide-react';
import { formatCurrency } from '../../../../utils/paymentUtils';
import { RECORRENCIA_ROTULO, SITUACAO_DESPESA } from '../../constants';
import { formatarCompetencia, somarMeses } from '../../domain/competencia';
import type { ResumoItem } from '../../domain/visao';
import Dica from '../ui/Flutuante';
import NumeroAnimado from '../ui/NumeroAnimado';
import PainelLateral from '../ui/PainelLateral';
import Vazio from '../ui/Vazio';
import { BOTAO_VIDRO, CURVA_SAIDA } from '../ui/estilos';

export type TipoDrill = 'categoria' | 'fornecedor' | 'setor';

const ROTULO_TIPO: Record<TipoDrill, string> = { categoria: 'Categoria', fornecedor: 'Fornecedor', setor: 'Setor beneficiado' };

interface ResumoDrillDownProps {
  tipo: TipoDrill;
  nome: string;
  resumo: ResumoItem;
  /** Mês atual ('YYYY-MM-01'): fim da série de 12 meses. */
  atual: string;
  cor: string;
  nomeCategoria: (id: string) => string;
  onFechar: () => void;
  onRemoverFiltro: () => void;
}

const Numero: React.FC<{ rotulo: string; valor: React.ReactNode; sufixo?: string; indice: number }> = ({ rotulo, valor, sufixo, indice }) => (
  <motion.div
    initial={{ opacity: 0, y: 8 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.35, ease: CURVA_SAIDA, delay: 0.15 + indice * 0.05 }}
    className="rounded-2xl px-4 py-3 bg-slate-50/80 dark:bg-slate-800/50 ring-1 ring-slate-200/70 dark:ring-slate-700/50"
  >
    <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">{rotulo}</p>
    <p className="mt-1 text-xl font-extrabold tracking-tight tabular-nums text-slate-900 dark:text-white">
      {valor}
      {sufixo && <span className="ml-0.5 text-xs font-semibold tracking-normal text-slate-400">{sufixo}</span>}
    </p>
  </motion.div>
);

/**
 * Resumo do item clicado numa barra (RF26). O filtro já foi aplicado no painel
 * inteiro; aqui ficam os 12 meses do item e as despesas que o compõem.
 */
const ResumoDrillDown: React.FC<ResumoDrillDownProps> = ({ tipo, nome, resumo, atual, cor, nomeCategoria, onFechar, onRemoverFiltro }) => {
  const meses = resumo.serie.map((_, i) => somarMeses(atual, i - 11));
  const maior = Math.max(...resumo.serie, 1);
  const ativas = resumo.despesas.filter((d) => d.situacao === 'ativa').length;

  return (
    <PainelLateral
      titulo={nome}
      subtitulo={`${ROTULO_TIPO[tipo]} · o painel inteiro está filtrado por este item`}
      onFechar={onFechar}
      acoes={
        <button type="button" onClick={onRemoverFiltro} className={`${BOTAO_VIDRO} h-9 px-3 text-xs`}>
          <FilterX className="w-3.5 h-3.5" /> Remover filtro e fechar
        </button>
      }
    >
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Numero rotulo="Pago em 12 meses" valor={<NumeroAnimado valor={resumo.totalDozeMeses} formatar={formatCurrency} />} indice={0} />
        <Numero rotulo="Custo recorrente" valor={<NumeroAnimado valor={resumo.recorrenteMensal} formatar={formatCurrency} />} sufixo="/mês" indice={1} />
        <Numero rotulo="Despesas ativas" valor={`${ativas}`} sufixo={` de ${resumo.despesas.length}`} indice={2} />
      </div>

      <section aria-label="Pago por mês">
        <h3 className="text-sm font-bold tracking-tight text-slate-800 dark:text-slate-100">Pago por mês</h3>
        <p className="text-xs text-slate-500 dark:text-slate-400">Base cobrança, {formatarCompetencia(meses[0])} a {formatarCompetencia(meses[11])}</p>
        {resumo.totalDozeMeses === 0 ? (
          <Vazio>Nenhum pagamento nos últimos 12 meses.</Vazio>
        ) : (
          <>
            {/* Colunas crescem da base, em onda; cada uma tem a dica do mês. */}
            <div className="mt-4 flex items-end gap-1.5 h-28" aria-hidden="true">
              {resumo.serie.map((v, i) => (
                <Dica
                  key={meses[i]}
                  bloco
                  className="flex-1 h-full flex items-end rounded-t-md hover:bg-slate-100/70 dark:hover:bg-slate-800/50 transition-colors"
                  conteudo={
                    <>
                      <p className="font-semibold text-white tabular-nums">{formatCurrency(v)}</p>
                      <p className="text-slate-300">{formatarCompetencia(meses[i])}</p>
                    </>
                  }
                >
                  <motion.div
                    initial={{ scaleY: 0 }}
                    animate={{ scaleY: 1 }}
                    transition={{ duration: 0.55, ease: CURVA_SAIDA, delay: 0.25 + i * 0.03 }}
                    className="w-full rounded-t-md transition-[height] duration-300"
                    style={{ height: `${v > 0 ? Math.max(2, (v / maior) * 100) : 0}%`, backgroundColor: cor, originY: 1 }}
                  />
                </Dica>
              ))}
            </div>
            <div className="mt-1 flex justify-between text-[11px] text-slate-400" aria-hidden="true">
              <span>{formatarCompetencia(meses[0]).replace('/20', '/')}</span>
              <span>{formatarCompetencia(meses[11]).replace('/20', '/')}</span>
            </div>
            <ul className="sr-only">
              {resumo.serie.map((v, i) => (
                <li key={meses[i]}>
                  {formatarCompetencia(meses[i])}: {formatCurrency(v)}
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      <section aria-label="Despesas">
        <h3 className="text-sm font-bold tracking-tight text-slate-800 dark:text-slate-100">Despesas ({resumo.despesas.length})</h3>
        <ul className="mt-3 space-y-2">
          {resumo.despesas.map(({ despesa: d, valor, mensal, situacao }, i) => (
            <motion.li
              key={d.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, ease: CURVA_SAIDA, delay: 0.3 + Math.min(i, 10) * 0.035 }}
              className="flex items-start justify-between gap-3 rounded-2xl px-3 py-2.5 bg-slate-50/60 dark:bg-slate-800/40 hover:bg-slate-100/70 dark:hover:bg-slate-700/40 transition-colors"
            >
              <div className="min-w-0">
                <p className="text-sm text-slate-800 dark:text-slate-100 truncate">{d.descricao}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                  {tipo === 'fornecedor' ? nomeCategoria(d.categoriaId) : d.fornecedorNome} · {RECORRENCIA_ROTULO[d.recorrencia]}
                </p>
              </div>
              <div className="flex-shrink-0 text-right">
                <p className="text-sm font-semibold tabular-nums text-slate-900 dark:text-white">
                  {formatCurrency(valor)}
                  <span className="text-xs font-normal text-slate-400">{mensal ? '/mês' : ' (única)'}</span>
                </p>
                <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-medium ${SITUACAO_DESPESA[situacao].classe}`}>
                  {SITUACAO_DESPESA[situacao].rotulo}
                </span>
              </div>
            </motion.li>
          ))}
        </ul>
      </section>
    </PainelLateral>
  );
};

export default ResumoDrillDown;
