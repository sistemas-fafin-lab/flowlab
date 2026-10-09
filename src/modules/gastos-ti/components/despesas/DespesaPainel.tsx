import React, { useMemo, useState } from 'react';
import { CalendarX, ChevronDown, ChevronRight, History, Pencil, Trash2, TrendingUp } from 'lucide-react';
import { formatCurrency } from '../../../../utils/paymentUtils';
import { FORMA_PAGAMENTO_ROTULO, MOTIVO_REAJUSTE_ROTULO, NATUREZA_ROTULO, RECORRENCIA_ROTULO, SITUACAO_DESPESA, TIPO_VALOR_ROTULO } from '../../constants';
import { descreverEntrada, type ContextoAuditoria } from '../../domain/auditoria';
import { competenciaDaData, formatarCompetencia, somarMeses } from '../../domain/competencia';
import type { LinhaDespesa } from '../../domain/listaDespesas';
import { variacao } from '../../domain/reajustes';
import { ocorrenciasNoIntervalo } from '../../domain/recorrencia';
import { useAuditoriaDespesa } from '../../hooks/useAuditoriaDespesa';
import type { CategoriaTI } from '../../types';
import AnexosSecao from '../ui/AnexosSecao';
import PainelLateral from '../ui/PainelLateral';

interface DespesaPainelProps {
  linha: LinhaDespesa;
  categoria: CategoriaTI | undefined;
  corCategoria: string;
  podeGerenciar: boolean;
  /** 'YYYY-MM-DD' */
  hoje: string;
  contextoAuditoria: ContextoAuditoria;
  /** false enquanto um formulário aberto por cima cuida do próprio ESC. */
  escAtivo: boolean;
  onFechar: () => void;
  onEditar: () => void;
  onReajustar: () => void;
  onEncerrar: () => void;
  onExcluir: () => void;
  onRemoverReajuste: (reajusteId: string) => Promise<string | null>;
  onAdicionarAnexos: (arquivos: File[]) => Promise<string | null>;
  onRemoverAnexo: (path: string) => Promise<string | null>;
}

const formatarData = (iso: string): string => {
  const [ano, mes, dia] = iso.slice(0, 10).split('-');
  return `${dia}/${mes}/${ano}`;
};

const formatarDataHora = (iso: string): string =>
  new Date(iso).toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

const botaoAcao =
  'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-violet-300 dark:hover:border-violet-700 hover:text-violet-700 dark:hover:text-violet-300 transition-colors';

const Titulo: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <h3 className="text-xs font-semibold uppercase tracking-wide text-violet-600 dark:text-violet-400 mb-3">{children}</h3>
);

const Dado: React.FC<{ rotulo: string; children: React.ReactNode }> = ({ rotulo, children }) => (
  <div>
    <dt className="text-xs text-slate-500 dark:text-slate-400">{rotulo}</dt>
    <dd className="text-sm text-slate-800 dark:text-slate-100 break-words">{children || '—'}</dd>
  </div>
);

/** Detalhe da despesa (RF06): dados, próximas cobranças, histórico de valores e auditoria. */
const DespesaPainel: React.FC<DespesaPainelProps> = ({
  linha,
  categoria,
  corCategoria,
  podeGerenciar,
  hoje,
  contextoAuditoria,
  escAtivo,
  onFechar,
  onEditar,
  onReajustar,
  onEncerrar,
  onExcluir,
  onRemoverReajuste,
  onAdicionarAnexos,
  onRemoverAnexo,
}) => {
  const { despesa: d, valorVigente, quantidadeVigente, equivalenteMensal, proxima, situacao } = linha;
  const [historicoAberto, setHistoricoAberto] = useState(false);
  const [confirmandoRemocao, setConfirmandoRemocao] = useState<string | null>(null);
  const [erroReajuste, setErroReajuste] = useState<string | null>(null);
  const auditoria = useAuditoriaDespesa(d.id, historicoAberto);

  const proximas = useMemo(() => {
    const atual = competenciaDaData(hoje) as string;
    const desde = d.competenciaInicio > atual ? d.competenciaInicio : atual;
    return ocorrenciasNoIntervalo(d, desde, somarMeses(desde, 12 * 12)).slice(0, 12);
  }, [d, hoje]);

  const historicoValores = useMemo(() => {
    let anterior = d.valorBase;
    return d.reajustes.map((r) => {
      const item = { reajuste: r, variacao: variacao(anterior, r.valor) };
      anterior = r.valor;
      return item;
    });
  }, [d]);

  const removerReajuste = async (id: string) => {
    if (confirmandoRemocao !== id) {
      setConfirmandoRemocao(id);
      return;
    }
    setErroReajuste(await onRemoverReajuste(id));
    setConfirmandoRemocao(null);
  };

  const unica = d.recorrencia === 'unica';

  return (
    <PainelLateral
      titulo={d.descricao}
      subtitulo={
        <span className="inline-flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5">
            <span aria-hidden="true" className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: corCategoria }} />
            {categoria?.nome ?? 'Categoria removida'}
          </span>
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${SITUACAO_DESPESA[situacao].classe}`}>
            {SITUACAO_DESPESA[situacao].rotulo}
          </span>
        </span>
      }
      acoes={
        podeGerenciar && (
          <>
            <button type="button" onClick={onEditar} className={botaoAcao}>
              <Pencil className="w-4 h-4" /> Editar
            </button>
            {!unica && (
              <button type="button" onClick={onReajustar} className={botaoAcao}>
                <TrendingUp className="w-4 h-4" /> Reajustar
              </button>
            )}
            {!unica && (
              <button type="button" onClick={onEncerrar} className={botaoAcao}>
                <CalendarX className="w-4 h-4" /> {d.competenciaFim ? 'Alterar encerramento' : 'Encerrar'}
              </button>
            )}
            <button
              type="button"
              onClick={onExcluir}
              className={`${botaoAcao} hover:!border-red-300 hover:!text-red-600 dark:hover:!border-red-800 dark:hover:!text-red-400`}
            >
              <Trash2 className="w-4 h-4" /> Excluir
            </button>
          </>
        )
      }
      onFechar={onFechar}
      escAtivo={escAtivo}
    >
      <div className="grid grid-cols-3 gap-3">
        {[
          { rotulo: unica ? 'Valor' : 'Valor vigente', valor: formatCurrency(valorVigente) },
          { rotulo: 'Por mês', valor: equivalenteMensal === null ? '—' : formatCurrency(equivalenteMensal) },
          { rotulo: 'Próxima cobrança', valor: proxima ? formatarData(proxima.vencimento) : '—' },
        ].map((item) => (
          <div key={item.rotulo} className="rounded-2xl border border-slate-200/70 dark:border-slate-700/60 bg-slate-50/70 dark:bg-slate-800/40 px-3 py-2.5">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">{item.rotulo}</p>
            <p className="mt-0.5 text-base font-bold text-slate-900 dark:text-white">{item.valor}</p>
          </div>
        ))}
      </div>

      <section>
        <Titulo>Dados</Titulo>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
          <Dado rotulo="Fornecedor">
            {d.fornecedorNome}
            {!d.fornecedorId && <span className="block text-xs text-slate-400">não vinculado ao cadastro</span>}
          </Dado>
          <Dado rotulo="Recorrência">
            {RECORRENCIA_ROTULO[d.recorrencia]} · {TIPO_VALOR_ROTULO[d.tipoValor].toLowerCase()}
          </Dado>
          <Dado rotulo={unica ? 'Mês da cobrança' : 'Período'}>
            {unica
              ? formatarCompetencia(d.competenciaInicio)
              : `${formatarCompetencia(d.competenciaInicio)} → ${d.competenciaFim ? formatarCompetencia(d.competenciaFim) : 'sem prazo'}`}
          </Dado>
          <Dado rotulo="Vencimento">dia {d.diaVencimento}</Dado>
          <Dado rotulo="Forma de pagamento">
            {FORMA_PAGAMENTO_ROTULO[d.formaPagamento]}
            {d.meioPagamentoDetalhe && ` · ${d.meioPagamentoDetalhe}`}
          </Dado>
          <Dado rotulo="Natureza">{NATUREZA_ROTULO[d.natureza]}</Dado>
          {quantidadeVigente !== null && (
            <Dado rotulo="Quantidade">
              {quantidadeVigente} {d.unidade ?? ''}
              {equivalenteMensal !== null && quantidadeVigente > 0 && (
                <span className="block text-xs text-slate-400">{formatCurrency(equivalenteMensal / quantidadeVigente)} por unidade/mês</span>
              )}
            </Dado>
          )}
          <Dado rotulo="Setor beneficiado">{d.setor ?? 'Toda a empresa'}</Dado>
          <Dado rotulo="Responsável técnico">{d.responsavelNome}</Dado>
          <Dado rotulo="Autorizado por">
            {d.autorizadoPor}
            {d.autorizadoEm && <span className="block text-xs text-slate-400">em {formatarData(d.autorizadoEm)}</span>}
          </Dado>
          <Dado rotulo="Contrato">{d.numeroContrato}</Dado>
          {!unica && (
            <Dado rotulo="Renovação">
              {d.renovacaoAutomatica ? 'Automática' : 'Manual'} · aviso com {d.avisoRenovacaoDias} dias
            </Dado>
          )}
          {d.moedaOriginal && (
            <Dado rotulo="Valor original">
              {d.valorOriginal !== null
                ? d.valorOriginal.toLocaleString('pt-BR', { style: 'currency', currency: d.moedaOriginal })
                : d.moedaOriginal}
            </Dado>
          )}
        </dl>
        {d.observacoes && (
          <p className="mt-3 text-sm text-slate-600 dark:text-slate-300 whitespace-pre-line rounded-xl bg-slate-50 dark:bg-slate-800/40 px-3 py-2">
            {d.observacoes}
          </p>
        )}
      </section>

      <section>
        <Titulo>Anexos</Titulo>
        <AnexosSecao
          anexos={d.anexos}
          podeGerenciar={podeGerenciar}
          onAdicionar={onAdicionarAnexos}
          onRemover={onRemoverAnexo}
          dicaVazio="Anexe o contrato, a proposta ou o e-mail de autorização."
        />
      </section>

      <section>
        <Titulo>{unica ? 'Cobrança' : 'Próximas cobranças'}</Titulo>
        {proximas.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">Nenhuma cobrança a partir deste mês.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-xs text-slate-500 dark:text-slate-400">
              <tr>
                <th scope="col" className="text-left font-medium pb-1">Competência</th>
                <th scope="col" className="text-left font-medium pb-1">Vencimento</th>
                <th scope="col" className="text-right font-medium pb-1">Previsto</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/70 dark:divide-slate-700/50">
              {proximas.map((o) => (
                <tr key={o.competencia} className="text-slate-700 dark:text-slate-200">
                  <td className="py-1.5">{formatarCompetencia(o.competencia)}</td>
                  <td className="py-1.5">{formatarData(o.vencimento)}</td>
                  <td className="py-1.5 text-right tabular-nums">{formatCurrency(o.valorPrevisto)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {!unica && (
        <section>
          <Titulo>Histórico de valores</Titulo>
          <ol className="space-y-2">
            <li className="flex items-start justify-between gap-3 text-sm">
              <span className="text-slate-600 dark:text-slate-300">Desde {formatarCompetencia(d.competenciaInicio)} (valor inicial)</span>
              <span className="font-medium tabular-nums text-slate-900 dark:text-white">{formatCurrency(d.valorBase)}</span>
            </li>
            {historicoValores.map(({ reajuste: r, variacao: v }) => (
              <li key={r.id} className="rounded-xl border border-slate-200/70 dark:border-slate-700/60 px-3 py-2 text-sm">
                <div className="flex items-start justify-between gap-3">
                  <span className="text-slate-700 dark:text-slate-200">
                    A partir de {formatarCompetencia(r.vigenteDesde)}
                    <span className="block text-xs text-slate-400">
                      {MOTIVO_REAJUSTE_ROTULO[r.motivo]}
                      {r.quantidade ? ` · quantidade ${r.quantidade}` : ''}
                    </span>
                  </span>
                  <span className="text-right">
                    <span className="block font-medium tabular-nums text-slate-900 dark:text-white">{formatCurrency(r.valor)}</span>
                    {v.percentual !== null && (
                      <span className="block text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                        {v.percentual >= 0 ? '+' : '−'}
                        {Math.abs(v.percentual).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%
                      </span>
                    )}
                  </span>
                </div>
                {r.observacao && <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{r.observacao}</p>}
                {podeGerenciar && (
                  <button
                    type="button"
                    onClick={() => removerReajuste(r.id)}
                    onBlur={() => setConfirmandoRemocao(null)}
                    className={`mt-1 text-xs font-medium ${confirmandoRemocao === r.id ? 'text-red-600 dark:text-red-400' : 'text-slate-400 hover:text-red-600 dark:hover:text-red-400'}`}
                  >
                    {confirmandoRemocao === r.id ? 'Clique de novo para remover' : 'Remover reajuste'}
                  </button>
                )}
              </li>
            ))}
          </ol>
          {erroReajuste && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{erroReajuste}</p>}
        </section>
      )}

      <section>
        <button
          type="button"
          onClick={() => setHistoricoAberto((aberto) => !aberto)}
          aria-expanded={historicoAberto}
          className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-violet-600 dark:text-violet-400"
        >
          {historicoAberto ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          <History className="w-4 h-4" /> Histórico de alterações
        </button>
        {historicoAberto && (
          <div className="mt-3">
            {auditoria.loading ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">Carregando...</p>
            ) : auditoria.error ? (
              <p className="text-sm text-red-600 dark:text-red-400">{auditoria.error}</p>
            ) : auditoria.entradas.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">Sem alterações registradas.</p>
            ) : (
              <ol className="relative border-l border-slate-200 dark:border-slate-700 ml-1.5 space-y-3">
                {auditoria.entradas.map((entrada) => {
                  const item = descreverEntrada(entrada, contextoAuditoria);
                  return (
                    <li key={item.id} className="relative ml-4">
                      <span
                        aria-hidden="true"
                        className="absolute -left-[22.5px] top-1.5 w-3 h-3 rounded-full bg-violet-200 dark:bg-violet-800 border-2 border-white dark:border-slate-900"
                      />
                      <p className="text-sm font-medium text-slate-800 dark:text-slate-100">{item.titulo}</p>
                      <p className="text-xs text-slate-400">
                        {formatarDataHora(item.quando)} · {item.autor}
                      </p>
                      {item.detalhes.length > 0 && (
                        <ul className="mt-1 space-y-0.5">
                          {item.detalhes.map((detalhe) => (
                            <li key={detalhe} className="text-xs text-slate-600 dark:text-slate-300">
                              {detalhe}
                            </li>
                          ))}
                        </ul>
                      )}
                    </li>
                  );
                })}
              </ol>
            )}
          </div>
        )}
      </section>
    </PainelLateral>
  );
};

export default DespesaPainel;
