import React from 'react';
import { formatCurrency } from '../../../../utils/paymentUtils';
import type { GrupoGasto } from '../../domain/finops';
import BarraAnimada from '../ui/BarraAnimada';
import Dica from '../ui/Flutuante';
import Vazio from '../ui/Vazio';
import { ANEL_FOCO_INTERNO, TABELA, TABELA_CAIXA, TABELA_TD, TABELA_TH, TABELA_THEAD, TABELA_TR } from '../ui/estilos';

interface BarrasRankingProps {
  grupos: GrupoGasto[];
  /**
   * Cor de cada barra. Fornecedor/setor: uma cor só (uma série — o nome no
   * rótulo identifica o grupo). Categoria: a cor da própria categoria, a mesma
   * da evolução mensal (a cor segue a entidade), cinza da 9ª em diante.
   */
  corDe: (chave: string) => string;
  mostrarAcumulado?: boolean;
  vazio: string;
  /** Drill-down (RF26): clicar (ou Enter/Espaço) aplica o item como filtro. Sem isso, as barras são só leitura. */
  onSelecionar?: (g: GrupoGasto) => void;
  /** Quais itens aceitam o clique ("Outros" e "sem setor" não viram filtro). */
  podeSelecionar?: (g: GrupoGasto) => boolean;
}

/**
 * Barras horizontais ordenadas, em HTML: nome e valor sempre visíveis (rótulo
 * direto na ponta), então nada depende do hover; a dica repete o detalhe.
 * Barra fina (10px, abaixo do teto de 24px), ponta arredondada, base reta.
 * Com `onSelecionar`, cada linha é um botão: o foco do teclado mostra o mesmo
 * destaque do hover e Enter aplica o filtro.
 */
const BarrasRanking: React.FC<BarrasRankingProps> = ({ grupos, corDe, mostrarAcumulado = false, vazio, onSelecionar, podeSelecionar = () => true }) => {
  if (grupos.length === 0) return <Vazio>{vazio}</Vazio>;
  const maior = Math.max(...grupos.map((g) => g.valor));
  const pct = (v: number, casas: number) => `${v.toLocaleString('pt-BR', { maximumFractionDigits: casas })}%`;
  return (
    <ol className="space-y-1">
      {grupos.map((g, i) => {
        const selecionavel = Boolean(onSelecionar && podeSelecionar(g));
        const detalhe = `${g.nome}: ${formatCurrency(g.valor)} · ${pct(g.percentual, 1)} do total${mostrarAcumulado ? ` · ${pct(g.acumulado, 0)} acumulado` : ''}`;
        const dica = (
          <>
            <p className="font-semibold text-white">{g.nome}</p>
            <p className="tabular-nums">
              {formatCurrency(g.valor)} · {pct(g.percentual, 1)} do total
            </p>
            {mostrarAcumulado && <p className="tabular-nums text-slate-300">{pct(g.acumulado, 0)} acumulado até aqui</p>}
            {selecionavel && <p className="mt-1 text-violet-300">Clique para filtrar o painel</p>}
          </>
        );
        const conteudo = (
          <>
            <div className="flex items-baseline justify-between gap-3 text-xs">
              <span className="text-slate-700 dark:text-slate-200 truncate">{g.nome}</span>
              <span className="flex-shrink-0 tabular-nums">
                <span className="font-semibold text-slate-900 dark:text-white">{formatCurrency(g.valor)}</span>
                <span className="text-slate-400 dark:text-slate-500"> · {pct(g.percentual, 1)}</span>
                {mostrarAcumulado && <span className="text-slate-400 dark:text-slate-500"> · {pct(g.acumulado, 0)} acum.</span>}
              </span>
            </div>
            <div className="mt-1.5 h-2.5 rounded-r-full bg-slate-100 dark:bg-slate-800/80 overflow-hidden">
              <BarraAnimada largura={Math.max(1, (g.valor / maior) * 100)} cor={corDe(g.chave)} indice={i} className="rounded-r-full" />
            </div>
          </>
        );
        return (
          <li key={g.chave}>
            <Dica conteudo={dica} bloco>
              {selecionavel ? (
                <button
                  type="button"
                  aria-label={`${detalhe}. Filtrar o painel por ${g.nome}`}
                  onClick={() => onSelecionar?.(g)}
                  className={`group block w-full text-left rounded-xl px-2 py-1.5 transition-colors hover:bg-slate-100/70 dark:hover:bg-slate-800/50 focus-visible:bg-slate-100/70 dark:focus-visible:bg-slate-800/50 ${ANEL_FOCO_INTERNO}`}
                >
                  {conteudo}
                </button>
              ) : (
                <div className="px-2 py-1.5">{conteudo}</div>
              )}
            </Dica>
          </li>
        );
      })}
    </ol>
  );
};

/** Tabela equivalente das barras. */
export const TabelaRanking: React.FC<{ grupos: GrupoGasto[]; rotulo: string }> = ({ grupos, rotulo }) => (
  <div className={TABELA_CAIXA}>
    <table className={TABELA}>
      <thead className={TABELA_THEAD}>
        <tr>
          <th scope="col" className={`${TABELA_TH} text-left`}>{rotulo}</th>
          <th scope="col" className={`${TABELA_TH} text-right`}>Valor</th>
          <th scope="col" className={`${TABELA_TH} text-right`}>%</th>
          <th scope="col" className={`${TABELA_TH} text-right`}>% acum.</th>
        </tr>
      </thead>
      <tbody>
        {grupos.map((g) => (
          <tr key={g.chave} className={TABELA_TR}>
            <td className={TABELA_TD}>{g.nome}</td>
            <td className={`${TABELA_TD} text-right tabular-nums whitespace-nowrap`}>{formatCurrency(g.valor)}</td>
            <td className={`${TABELA_TD} text-right tabular-nums`}>{g.percentual.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%</td>
            <td className={`${TABELA_TD} text-right tabular-nums`}>{g.acumulado.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}%</td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

export default BarrasRanking;
