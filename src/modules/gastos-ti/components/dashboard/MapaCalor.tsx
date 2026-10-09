import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Grid } from 'lucide-react';
import { formatCurrency } from '../../../../utils/paymentUtils';
import { formatarCompetencia } from '../../domain/competencia';
import { RAMPA_SEQUENCIAL, faixaPedeTextoClaro, type TemaGrafico } from '../../domain/coresCategorias';
import { faixaSequencial, type MapaCalor as DadosMapaCalor } from '../../domain/detalhamento';
import { BalaoFlutuante } from '../ui/Flutuante';
import Vazio from '../ui/Vazio';
import { CURVA_SAIDA, ROLAGEM, TABELA, TABELA_CAIXA, TABELA_TD, TABELA_TH, TABELA_THEAD, TABELA_TR } from '../ui/estilos';

const compacto = (v: number): string =>
  v >= 1000 ? `${(v / 1000).toLocaleString('pt-BR', { maximumFractionDigits: v >= 10000 ? 0 : 1 })} mil` : Math.round(v).toLocaleString('pt-BR');

const mesCurto = (c: string) => formatarCompetencia(c).replace('/20', '/');

interface Celula {
  linha: number;
  coluna: number;
  el: HTMLElement;
}

/**
 * Mapa de calor categoria × mês (dataviz: magnitude numa grade → um único tom,
 * claro → escuro, com legenda de escala). Célula sem gasto fica neutra, não no
 * tom mais claro: "nada" não é "pouco". O valor aparece na célula (md+) e, por
 * extenso, num balão que segue o mouse de célula em célula. As células entram
 * em onda, coluna a coluna.
 */
const MapaCalor: React.FC<{ mapa: DadosMapaCalor; tema: TemaGrafico }> = ({ mapa, tema }) => {
  const [ativa, setAtiva] = useState<Celula | null>(null);
  if (mapa.linhas.length === 0) return <Vazio icone={Grid}>Sem pagamentos na janela.</Vazio>;

  const rampa = RAMPA_SEQUENCIAL[tema];
  const totalDoMes = mapa.meses.map((_, i) => mapa.linhas.reduce((s, l) => s + l.valores[i], 0));
  const linhaAtiva = ativa ? mapa.linhas[ativa.linha] : null;
  const valorAtivo = ativa && linhaAtiva ? linhaAtiva.valores[ativa.coluna] : 0;
  const doMesAtivo = ativa ? totalDoMes[ativa.coluna] : 0;
  const leitura =
    ativa && linhaAtiva
      ? `${valorAtivo > 0 ? formatCurrency(valorAtivo) : 'Sem gasto'}, ${linhaAtiva.nome}, ${formatarCompetencia(mapa.meses[ativa.coluna])}`
      : '';

  return (
    <div onMouseLeave={() => setAtiva(null)}>
      <div className={`overflow-x-auto ${ROLAGEM}`}>
        <table className="w-full border-separate text-[11px]" style={{ borderSpacing: 3 }}>
          <thead>
            <tr className="text-slate-500 dark:text-slate-400">
              <th scope="col" className="sr-only">Categoria</th>
              {mapa.meses.map((m, j) => (
                <th
                  key={m}
                  scope="col"
                  className={`font-semibold pb-1 whitespace-nowrap transition-colors ${ativa?.coluna === j ? 'text-violet-700 dark:text-violet-300' : ''}`}
                >
                  {mesCurto(m)}
                </th>
              ))}
              <th scope="col" className="font-semibold pb-1 pl-2 text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {mapa.linhas.map((l, i) => (
              <tr key={l.chave}>
                <th scope="row" className="pr-2 text-left font-normal text-xs">
                  <span
                    className={`block max-w-[160px] truncate transition-colors ${
                      ativa?.linha === i ? 'text-violet-700 dark:text-violet-300 font-medium' : 'text-slate-700 dark:text-slate-200'
                    }`}
                  >
                    {l.nome}
                  </span>
                </th>
                {l.valores.map((v, j) => {
                  const faixa = faixaSequencial(v, mapa.maximo, rampa.length);
                  const emDestaque = ativa?.linha === i && ativa?.coluna === j;
                  return (
                    <motion.td
                      key={mapa.meses[j]}
                      initial={{ opacity: 0, scale: 0.85 }}
                      whileInView={{ opacity: 1, scale: 1 }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.35, ease: CURVA_SAIDA, delay: j * 0.025 + i * 0.012 }}
                      onMouseEnter={(e: React.MouseEvent<HTMLTableCellElement>) => setAtiva({ linha: i, coluna: j, el: e.currentTarget })}
                      className={`h-8 min-w-[40px] rounded-lg text-center tabular-nums transition-shadow duration-150 ${
                        faixa === null ? 'bg-slate-100/80 dark:bg-slate-800/60 text-slate-400' : ''
                      } ${faixa !== null && faixaPedeTextoClaro(faixa, tema) ? 'text-white' : 'text-slate-900'} ${
                        emDestaque ? 'ring-2 ring-slate-900/80 dark:ring-white/90 shadow-lg' : ''
                      }`}
                      style={faixa === null ? undefined : { backgroundColor: rampa[faixa] }}
                    >
                      <span className="hidden md:inline font-medium">{v > 0 ? compacto(v) : ''}</span>
                      <span className="sr-only md:hidden">{v > 0 ? formatCurrency(v) : 'sem gasto'}</span>
                    </motion.td>
                  );
                })}
                <td className="pl-2 text-right tabular-nums font-semibold text-slate-900 dark:text-white whitespace-nowrap">{compacto(l.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <BalaoFlutuante ancora={ativa?.el ?? null}>
        {ativa && linhaAtiva && (
          <>
            <p className="font-semibold text-white tabular-nums">{valorAtivo > 0 ? formatCurrency(valorAtivo) : 'Sem gasto'}</p>
            <p className="text-slate-300">
              {linhaAtiva.nome} · {formatarCompetencia(mapa.meses[ativa.coluna])}
            </p>
            {valorAtivo > 0 && doMesAtivo > 0 && (
              <p className="text-slate-400 tabular-nums">{((valorAtivo / doMesAtivo) * 100).toLocaleString('pt-BR', { maximumFractionDigits: 0 })}% do gasto do mês</p>
            )}
          </>
        )}
      </BalaoFlutuante>
      <p className="sr-only" aria-live="polite">
        {leitura}
      </p>

      {/* Legenda de escala: as 7 faixas, de "quase zero" ao maior valor da grade. */}
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] text-slate-500 dark:text-slate-400">
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden="true" className="w-3 h-3 rounded bg-slate-100 dark:bg-slate-800/70 ring-1 ring-inset ring-slate-200/70 dark:ring-slate-700/60" /> sem gasto
        </span>
        <span className="inline-flex items-center gap-1.5">
          R$ 0
          <span aria-hidden="true" className="inline-flex overflow-hidden rounded-full">
            {rampa.map((cor) => (
              <span key={cor} className="w-5 h-2.5" style={{ backgroundColor: cor }} />
            ))}
          </span>
          {formatCurrency(mapa.maximo)}
        </span>
        <span className="text-slate-400">Passe o mouse numa célula para ver o valor exato.</span>
      </div>
    </div>
  );
};

/** Tabela equivalente: categoria × mês com o valor exato. */
export const TabelaMapaCalor: React.FC<{ mapa: DadosMapaCalor }> = ({ mapa }) => (
  <div className={TABELA_CAIXA}>
    <table className={TABELA}>
      <thead className={TABELA_THEAD}>
        <tr>
          <th scope="col" className={`${TABELA_TH} text-left`}>Categoria</th>
          {mapa.meses.map((m) => (
            <th key={m} scope="col" className={`${TABELA_TH} text-right`}>{mesCurto(m)}</th>
          ))}
          <th scope="col" className={`${TABELA_TH} text-right`}>Total</th>
        </tr>
      </thead>
      <tbody>
        {mapa.linhas.map((l) => (
          <tr key={l.chave} className={TABELA_TR}>
            <td className={`${TABELA_TD} whitespace-nowrap`}>{l.nome}</td>
            {l.valores.map((v, j) => (
              <td key={mapa.meses[j]} className={`${TABELA_TD} text-right tabular-nums whitespace-nowrap`}>{v > 0 ? formatCurrency(v) : '—'}</td>
            ))}
            <td className={`${TABELA_TD} text-right tabular-nums font-semibold whitespace-nowrap`}>{formatCurrency(l.total)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

export default MapaCalor;
