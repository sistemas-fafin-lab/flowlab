import React from 'react';
import { ArrowDownRight, ArrowUpRight, Calculator, Minus } from 'lucide-react';
import { formatCurrency } from '../../../../utils/paymentUtils';
import { formatarCompetencia } from '../../domain/competencia';
import type { CustoUnitario } from '../../domain/detalhamento';
import Vazio from '../ui/Vazio';
import { TABELA, TABELA_CAIXA, TABELA_TD, TABELA_TH, TABELA_THEAD, TABELA_TR } from '../ui/estilos';

const Variacao: React.FC<{ c: CustoUnitario; janeiro: string }> = ({ c, janeiro }) => {
  if (c.variacao === null || c.unitarioInicio === null) return <span className="text-slate-400">começou neste mês</span>;
  const desde = c.despesa.competenciaInicio > janeiro ? formatarCompetencia(c.despesa.competenciaInicio) : `jan/${janeiro.slice(0, 4)}`;
  const era = (
    <span className="block text-slate-400 whitespace-nowrap">
      era {formatCurrency(c.unitarioInicio)} em {desde}
    </span>
  );
  if (Math.abs(c.variacao) < 0.05) {
    return (
      <>
        <span className="inline-flex items-center gap-0.5 text-slate-500 dark:text-slate-400">
          <Minus className="w-3.5 h-3.5" aria-hidden="true" /> estável
        </span>
        {era}
      </>
    );
  }
  const subiu = c.variacao > 0;
  return (
    <>
      <span className="inline-flex items-center gap-0.5 whitespace-nowrap">
        {subiu ? (
          <ArrowUpRight className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" aria-hidden="true" />
        ) : (
          <ArrowDownRight className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
        )}
        <span className="font-semibold text-slate-700 dark:text-slate-200">
          {subiu ? '+' : '−'}
          {Math.abs(c.variacao).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%
        </span>
      </span>
      {era}
    </>
  );
};

/** Custo por licença/usuário por mês das despesas recorrentes ativas com quantidade, e a variação no ano. */
const CustoUnitarioTabela: React.FC<{ linhas: CustoUnitario[]; ano: number }> = ({ linhas, ano }) => {
  if (linhas.length === 0) {
    return <Vazio icone={Calculator}>Nenhuma despesa recorrente ativa com quantidade (licenças, usuários) cadastrada.</Vazio>;
  }
  const janeiro = `${ano}-01-01`;
  return (
    <div className={TABELA_CAIXA}>
      <table className={TABELA}>
        <thead className={TABELA_THEAD}>
          <tr>
            <th scope="col" className={`${TABELA_TH} text-left`}>Despesa</th>
            <th scope="col" className={`${TABELA_TH} text-right`}>Quantidade</th>
            <th scope="col" className={`${TABELA_TH} text-right`}>Custo mensal</th>
            <th scope="col" className={`${TABELA_TH} text-right`}>Por unidade/mês</th>
            <th scope="col" className={`${TABELA_TH} text-left`}>Variação em {ano}</th>
          </tr>
        </thead>
        <tbody>
          {linhas.map((c) => (
            <tr key={c.despesa.id} className={TABELA_TR}>
              <td className={TABELA_TD}>
                <span className="block font-medium text-slate-800 dark:text-slate-100">{c.despesa.descricao}</span>
                <span className="block text-slate-400">{c.despesa.fornecedorNome}</span>
              </td>
              <td className={`${TABELA_TD} text-right tabular-nums whitespace-nowrap`}>
                {c.quantidade.toLocaleString('pt-BR')} <span className="text-slate-400">{c.unidade}</span>
              </td>
              <td className={`${TABELA_TD} text-right tabular-nums whitespace-nowrap`}>{formatCurrency(c.mensal)}</td>
              <td className={`${TABELA_TD} text-right tabular-nums whitespace-nowrap font-semibold text-slate-900 dark:text-white`}>
                {formatCurrency(c.unitario)}
                <span className="font-normal text-slate-400">/{c.unidade}</span>
              </td>
              <td className={TABELA_TD}>
                <Variacao c={c} janeiro={janeiro} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default CustoUnitarioTabela;
