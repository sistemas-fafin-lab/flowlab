import React, { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, ChevronDown, ListTree } from 'lucide-react';
import { formatCurrency } from '../../../../utils/paymentUtils';
import { SITUACAO_OCORRENCIA } from '../../constants';
import { formatarCompetencia } from '../../domain/competencia';
import type { OcorrenciaDoMes } from '../../domain/situacao';
import Dica from '../ui/Flutuante';
import Vazio from '../ui/Vazio';
import { ANEL_FOCO, LINK_ACAO, ROLAGEM, TABELA, TABELA_TD, TABELA_TH, TABELA_TR } from '../ui/estilos';

type Coluna = 'competencia' | 'despesa' | 'fornecedor' | 'categoria' | 'previsto' | 'pago';

interface DetalhamentoTabelaProps {
  ocorrencias: OcorrenciaDoMes[];
  nomeCategoria: (id: string) => string;
}

const formatarData = (iso: string): string => {
  const [, mes, dia] = iso.split('-');
  return `${dia}/${mes}`;
};

const LIMITE = 50;

/** Todas as cobranças do recorte, ordenáveis (RF22). É também a tabela equivalente dos gráficos. */
const DetalhamentoTabela: React.FC<DetalhamentoTabelaProps> = ({ ocorrencias, nomeCategoria }) => {
  const [ordem, setOrdem] = useState<{ coluna: Coluna; asc: boolean }>({ coluna: 'competencia', asc: false });
  const [todas, setTodas] = useState(false);

  const ordenadas = useMemo(() => {
    const valor = (o: OcorrenciaDoMes): string | number => {
      switch (ordem.coluna) {
        case 'competencia':
          return `${o.competencia}${o.vencimento}`;
        case 'despesa':
          return o.despesa.descricao.toLowerCase();
        case 'fornecedor':
          return o.despesa.fornecedorNome.toLowerCase();
        case 'categoria':
          return nomeCategoria(o.despesa.categoriaId).toLowerCase();
        case 'previsto':
          return o.valorPrevisto;
        case 'pago':
          return o.lancamento?.valorPago ?? -1;
      }
    };
    return [...ocorrencias].sort((a, b) => {
      const va = valor(a);
      const vb = valor(b);
      const c = typeof va === 'number' && typeof vb === 'number' ? va - vb : String(va).localeCompare(String(vb), 'pt-BR');
      return ordem.asc ? c : -c;
    });
  }, [ocorrencias, ordem, nomeCategoria]);

  if (ocorrencias.length === 0) return <Vazio icone={ListTree}>Nenhuma cobrança no recorte.</Vazio>;

  const cabecalho = (coluna: Coluna, rotulo: string, direita = false) => {
    const ativa = ordem.coluna === coluna;
    const Seta = ordem.asc ? ArrowUp : ArrowDown;
    return (
      <th scope="col" aria-sort={ativa ? (ordem.asc ? 'ascending' : 'descending') : 'none'} className={`${TABELA_TH} ${direita ? 'text-right' : 'text-left'}`}>
        <button
          type="button"
          onClick={() => setOrdem((o) => (o.coluna === coluna ? { coluna, asc: !o.asc } : { coluna, asc: coluna !== 'previsto' && coluna !== 'pago' }))}
          className={`inline-flex items-center gap-1 rounded-md uppercase tracking-wider hover:text-violet-700 dark:hover:text-violet-300 ${ANEL_FOCO} ${ativa ? 'text-violet-700 dark:text-violet-300' : ''}`}
        >
          {rotulo}
          {ativa && <Seta className="w-3 h-3" />}
        </button>
      </th>
    );
  };

  const visiveis = todas ? ordenadas : ordenadas.slice(0, LIMITE);

  return (
    <div>
      <div className={`overflow-x-auto ${ROLAGEM}`}>
        <table className={`${TABELA} text-sm`}>
          <thead>
            <tr>
              {cabecalho('competencia', 'Mês')}
              {cabecalho('despesa', 'Despesa')}
              {cabecalho('fornecedor', 'Fornecedor')}
              {cabecalho('categoria', 'Categoria')}
              {cabecalho('previsto', 'Previsto', true)}
              {cabecalho('pago', 'Pago', true)}
              <th scope="col" className={`${TABELA_TH} text-left`}>Situação</th>
            </tr>
          </thead>
          <tbody>
            {visiveis.map((o) => (
              <tr key={o.chave} className={TABELA_TR}>
                <td className={`${TABELA_TD} whitespace-nowrap`}>
                  {formatarCompetencia(o.competencia)}
                  <span className="block text-xs text-slate-400">vence {formatarData(o.vencimento)}</span>
                </td>
                <td className={`${TABELA_TD} max-w-[220px]`}>
                  <Dica conteudo={o.despesa.descricao} bloco className="truncate">
                    <span className="font-medium text-slate-800 dark:text-slate-100">{o.despesa.descricao}</span>
                  </Dica>
                </td>
                <td className={`${TABELA_TD} max-w-[160px] truncate`}>{o.despesa.fornecedorNome}</td>
                <td className={`${TABELA_TD} whitespace-nowrap`}>{nomeCategoria(o.despesa.categoriaId)}</td>
                <td className={`${TABELA_TD} text-right tabular-nums whitespace-nowrap`}>{formatCurrency(o.valorPrevisto)}</td>
                <td className={`${TABELA_TD} text-right tabular-nums whitespace-nowrap`}>
                  {o.lancamento?.valorPago !== null && o.lancamento?.valorPago !== undefined ? formatCurrency(o.lancamento.valorPago) : '—'}
                </td>
                <td className={TABELA_TD}>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${SITUACAO_OCORRENCIA[o.situacao].classe}`}>{SITUACAO_OCORRENCIA[o.situacao].rotulo}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {ordenadas.length > LIMITE && (
        <button type="button" onClick={() => setTodas((t) => !t)} className={`mt-3 ${LINK_ACAO}`}>
          {todas ? 'Mostrar menos' : `Mostrar todas as ${ordenadas.length} cobranças`}
          <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${todas ? 'rotate-180' : ''}`} aria-hidden="true" />
        </button>
      )}
    </div>
  );
};

export default DetalhamentoTabela;
