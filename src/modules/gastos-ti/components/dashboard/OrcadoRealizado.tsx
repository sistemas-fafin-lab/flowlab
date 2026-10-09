import React from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, AlertTriangle, ArrowRight, Target } from 'lucide-react';
import { formatCurrency } from '../../../../utils/paymentUtils';
import type { ConsumoCategoria } from '../../domain/orcamento';
import BarraAnimada from '../ui/BarraAnimada';
import Dica from '../ui/Flutuante';
import Vazio from '../ui/Vazio';
import { LINK_ACAO, TABELA, TABELA_CAIXA, TABELA_TD, TABELA_TH, TABELA_THEAD, TABELA_TR } from '../ui/estilos';

interface OrcadoRealizadoProps {
  consumos: ConsumoCategoria[];
  ano: number;
  corDe: (categoriaId: string) => string;
  podeGerenciar: boolean;
}

const pct = (p: number | null) => (p === null ? '—' : Number.isFinite(p) ? `${p.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}%` : 'sem limite');

/**
 * Orçado × realizado por categoria (bullet): o preenchimento é o pago (na cor
 * da categoria, a cor segue a entidade), o traço vertical marca o orçamento.
 * Status (atenção/estourado) só a partir de 90%, com ícone + texto.
 */
const OrcadoRealizado: React.FC<OrcadoRealizadoProps> = ({ consumos, ano, corDe, podeGerenciar }) => {
  const comOrcamento = consumos.filter((c) => c.orcado !== null);
  const semOrcamento = consumos.filter((c) => c.orcado === null);
  if (comOrcamento.length === 0) {
    return (
      <Vazio icone={Target}>
        {ano} ainda sem orçamento cadastrado.
        {podeGerenciar && (
          <>
            {' '}
            <Link to="/it/gastos/orcamento" className={LINK_ACAO}>
              Cadastrar orçamento <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
            </Link>
          </>
        )}
      </Vazio>
    );
  }
  const escala = Math.max(...comOrcamento.map((c) => Math.max(c.orcado ?? 0, c.realizado)), 1);
  return (
    <div>
      <ul className="space-y-1">
        {comOrcamento.map((c, i) => {
          const saldo = (c.orcado ?? 0) - c.realizado;
          return (
            <li key={c.categoriaId}>
              <Dica
                bloco
                conteudo={
                  <>
                    <p className="font-semibold text-white">{c.nome}</p>
                    <p className="tabular-nums">
                      Pago {formatCurrency(c.realizado)} de {formatCurrency(c.orcado ?? 0)} ({pct(c.percentual)})
                    </p>
                    <p className="tabular-nums text-slate-300">
                      {saldo >= 0 ? `Sobram ${formatCurrency(saldo)} no ano` : `Passou ${formatCurrency(-saldo)} do orçamento`}
                    </p>
                  </>
                }
              >
                <div className="rounded-xl px-2 py-1.5 transition-colors hover:bg-slate-100/70 dark:hover:bg-slate-800/50">
                  <div className="flex items-baseline justify-between gap-3 text-xs">
                    <span className="text-slate-700 dark:text-slate-200 truncate">{c.nome}</span>
                    <span className="flex-shrink-0 tabular-nums">
                      <span className="font-semibold text-slate-900 dark:text-white">{formatCurrency(c.realizado)}</span>
                      <span className="text-slate-400"> de {formatCurrency(c.orcado ?? 0)} · </span>
                      {c.status === 'estourado' ? (
                        <span className="inline-flex items-center gap-0.5 font-semibold text-red-700 dark:text-red-300">
                          <AlertCircle className="w-3 h-3" aria-hidden="true" /> {pct(c.percentual)} estourado
                        </span>
                      ) : c.status === 'atencao' ? (
                        <span className="inline-flex items-center gap-0.5 font-semibold text-amber-700 dark:text-amber-300">
                          <AlertTriangle className="w-3 h-3" aria-hidden="true" /> {pct(c.percentual)}
                        </span>
                      ) : (
                        <span className="text-slate-500 dark:text-slate-400">{pct(c.percentual)}</span>
                      )}
                    </span>
                  </div>
                  <div className="relative mt-1.5 h-2.5 rounded-r-full bg-slate-100 dark:bg-slate-800/80">
                    <div className="absolute inset-0 overflow-hidden rounded-r-full">
                      <BarraAnimada largura={(c.realizado / escala) * 100} cor={corDe(c.categoriaId)} indice={i} className="rounded-r-full" />
                    </div>
                    <span
                      aria-hidden="true"
                      className="absolute -top-1 -bottom-1 w-0.5 rounded-full bg-slate-700 dark:bg-slate-200 transition-[left] duration-300 ease-out"
                      style={{ left: `calc(${((c.orcado ?? 0) / escala) * 100}% - 1px)` }}
                    />
                  </div>
                </div>
              </Dica>
            </li>
          );
        })}
      </ul>
      {semOrcamento.length > 0 && (
        <p className="mt-4 px-2 text-xs text-slate-500 dark:text-slate-400">
          Gasto sem orçamento: {semOrcamento.map((c) => `${c.nome} (${formatCurrency(c.realizado)})`).join(', ')}.
        </p>
      )}
      <p className="mt-3 px-2 inline-flex items-center gap-1.5 text-[11px] text-slate-400">
        <span aria-hidden="true" className="inline-block w-0.5 h-3 rounded-full bg-slate-700 dark:bg-slate-200" /> orçamento do ano
      </p>
    </div>
  );
};

const STATUS_TEXTO: Record<ConsumoCategoria['status'], string> = {
  ok: 'Dentro',
  atencao: 'Perto do limite',
  estourado: 'Estourado',
  sem_orcamento: 'Sem orçamento',
};

/** Tabela equivalente: categoria, orçado, pago, % e situação. */
export const TabelaOrcado: React.FC<{ consumos: ConsumoCategoria[] }> = ({ consumos }) => (
  <div className={TABELA_CAIXA}>
    <table className={TABELA}>
      <thead className={TABELA_THEAD}>
        <tr>
          <th scope="col" className={`${TABELA_TH} text-left`}>Categoria</th>
          <th scope="col" className={`${TABELA_TH} text-right`}>Orçado</th>
          <th scope="col" className={`${TABELA_TH} text-right`}>Pago</th>
          <th scope="col" className={`${TABELA_TH} text-right`}>%</th>
          <th scope="col" className={`${TABELA_TH} text-left`}>Situação</th>
        </tr>
      </thead>
      <tbody>
        {consumos.map((c) => (
          <tr key={c.categoriaId} className={TABELA_TR}>
            <td className={TABELA_TD}>{c.nome}</td>
            <td className={`${TABELA_TD} text-right tabular-nums whitespace-nowrap`}>{c.orcado === null ? '—' : formatCurrency(c.orcado)}</td>
            <td className={`${TABELA_TD} text-right tabular-nums whitespace-nowrap`}>{formatCurrency(c.realizado)}</td>
            <td className={`${TABELA_TD} text-right tabular-nums`}>{pct(c.percentual)}</td>
            <td className={TABELA_TD}>{STATUS_TEXTO[c.status]}</td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

export default OrcadoRealizado;
