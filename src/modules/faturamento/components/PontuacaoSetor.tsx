import React, { useEffect, useState } from 'react';
import { AlertCircle, Award, CalendarRange, ChevronDown, ChevronRight, Lock, Pencil, Unlock, Users } from 'lucide-react';
import { useAuth } from '../../../hooks/useAuth';
import { hasPermission } from '../../../utils/permissions';
import { fecharPontuacao, lancarPontuacao, reabrirPontuacao } from '../hooks/usePontuacaoSetor';
import type {
  CriterioPontuacao,
  DetalheGuiasSemLotePontuacao,
  DetalheMetaPontuacao,
  DetalheTarefasPontuacao,
  DetalheZeroGlosaPontuacao,
  FrentePontuacao,
  FrentePontuada,
  PontuacaoSetor as Pontuacao,
  PontuacaoSetorMeta,
} from '../types';
import { formatCompetencia, formatCurrency, formatDataHora, formatDiaMesHora, formatPercentual } from '../utils/formato';
import LancamentoPontuacaoModal from './LancamentoPontuacaoModal';
import MembrosPontuacaoModal from './MembrosPontuacaoModal';

// ============================================================================
// COMPONENTE: PontuacaoSetor
// Bloco "Pontuação do setor" de Faturamento → Indicadores
// (.scratch/faturamento-pontuacao/spec.md): um card por Frente, com o total em
// destaque e a tabela de critérios no formato do "RESUMO" das planilhas. Os
// pontos vêm prontos do servidor (api/_lib/faturamento/pontuacaoSetor.ts).
// Os dados são do pai (usePontuacaoSetor), para o "Atualizar" da página
// recarregar os dois blocos. Quem gerencia Faturamento lança os critérios
// manuais (issue 05), fecha e reabre o mês (issue 06), edita os membros das
// Frentes (issue 07), e o bloco pede ao pai para recarregar. Mês fechado mostra
// os números congelados e não aceita lançamento.
// ============================================================================

const CARD = 'bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5';

const formatPontos = (n: number): string => n.toLocaleString('pt-BR', { maximumFractionDigits: 1 });

const pontosBase = (c: CriterioPontuacao): string =>
  `${formatPontos(c.pontosBase)}${c.porConvenio ? ' por convênio' : ''}`;

const formatQtd = (n: number): string => n.toLocaleString('pt-BR');

/** ISO → 'dd/mm' no fuso da operação, para o selo "Fechado em". */
const formatDiaMes = (iso: string): string =>
  new Date(iso).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit' });

// Para a tela "Membros" abrir mesmo quando a pontuação do mês não carregou:
// os membros só dependem do Supabase.
const FRENTES_MEMBROS: { frente: FrentePontuacao; rotulo: string }[] = [
  { frente: 'faturamento', rotulo: 'Faturamento' },
  { frente: 'recursoGlosa', rotulo: 'Recurso de Glosa' },
];

const BOTAO_GESTAO =
  'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50';

const DetalheTarefas: React.FC<{ detalhe: DetalheTarefasPontuacao }> = ({ detalhe }) => {
  const linhas = [
    ...detalhe.pessoas.map((p) => ({ chave: String(p.idUsuarioAplis), nome: p.nome, pendencias: p.pendencias })),
    { chave: 'setor', nome: 'SETOR', pendencias: detalhe.setor },
  ];
  return (
    <table className="w-full text-xs">
      <thead>
        <tr className="text-gray-500 dark:text-gray-400">
          <th className="pb-1 text-left font-medium">Tarefas abertas no fim do mês</th>
          <th className="pb-1 text-right font-medium">Pendências</th>
        </tr>
      </thead>
      <tbody>
        {linhas.map((l) => (
          <tr key={l.chave}>
            <td className="py-0.5 text-gray-900 dark:text-white">{l.nome}</td>
            <td
              className={`py-0.5 text-right tabular-nums font-medium ${
                l.pendencias > 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-white'
              }`}
            >
              {formatQtd(l.pendencias)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};

const DetalheGuiasSemLote: React.FC<{ detalhe: DetalheGuiasSemLotePontuacao }> = ({ detalhe }) => (
  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
    <div>
      <p className="pb-1 font-medium text-gray-500 dark:text-gray-400">
        Fechados sem pendência ({formatQtd(detalhe.semPendencia.length)})
      </p>
      {detalhe.semPendencia.length > 0 ? (
        <ul className="space-y-0.5">
          {detalhe.semPendencia.map((c) => (
            <li key={c.idFontePagadora} className="text-gray-900 dark:text-white">{c.nome}</li>
          ))}
        </ul>
      ) : (
        <p className="text-gray-500 dark:text-gray-400">Nenhum</p>
      )}
    </div>
    <div>
      <table className="w-full">
        <thead>
          <tr className="text-gray-500 dark:text-gray-400">
            <th className="pb-1 text-left font-medium">Com pendência ({formatQtd(detalhe.comPendencia.length)})</th>
            <th className="pb-1 text-right font-medium">Sem lote</th>
          </tr>
        </thead>
        <tbody>
          {detalhe.comPendencia.map((c) => (
            <tr key={c.idFontePagadora}>
              <td className="py-0.5 text-gray-900 dark:text-white">{c.nome}</td>
              <td className="py-0.5 text-right tabular-nums font-medium text-red-600 dark:text-red-400">{formatQtd(c.pendentes)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {detalhe.comPendencia.length === 0 && <p className="text-gray-500 dark:text-gray-400">Nenhum</p>}
    </div>
  </div>
);

const DetalheZeroGlosa: React.FC<{ detalhe: DetalheZeroGlosaPontuacao }> = ({ detalhe }) => (
  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
    <div>
      <p className="pb-1 font-medium text-gray-500 dark:text-gray-400">
        Recebidos sem glosa ({formatQtd(detalhe.semGlosa.length)})
      </p>
      {detalhe.semGlosa.length > 0 ? (
        <ul className="space-y-0.5">
          {detalhe.semGlosa.map((c) => (
            <li key={c.idFontePagadora} className="text-gray-900 dark:text-white">{c.nome}</li>
          ))}
        </ul>
      ) : (
        <p className="text-gray-500 dark:text-gray-400">Nenhum</p>
      )}
    </div>
    <div>
      <table className="w-full">
        <thead>
          <tr className="text-gray-500 dark:text-gray-400">
            <th className="pb-1 text-left font-medium">Com glosa ({formatQtd(detalhe.comGlosa.length)})</th>
            <th className="pb-1 text-right font-medium">Glosadas</th>
          </tr>
        </thead>
        <tbody>
          {detalhe.comGlosa.map((c) => (
            <tr key={c.idFontePagadora}>
              <td className="py-0.5 text-gray-900 dark:text-white">{c.nome}</td>
              <td className="py-0.5 text-right tabular-nums font-medium text-red-600 dark:text-red-400">{formatQtd(c.glosadas)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {detalhe.comGlosa.length === 0 && <p className="text-gray-500 dark:text-gray-400">Nenhum</p>}
    </div>
  </div>
);

const DetalheMeta: React.FC<{ detalhe: DetalheMetaPontuacao }> = ({ detalhe }) => {
  return (
    <dl className="grid grid-cols-3 gap-3 text-xs">
      <div>
        <dt className="text-gray-500 dark:text-gray-400">Meta</dt>
        <dd className="font-medium text-gray-900 dark:text-white">
          {detalhe.meta === null ? 'Não cadastrada' : formatCurrency(detalhe.meta)}
        </dd>
      </div>
      <div>
        <dt className="text-gray-500 dark:text-gray-400">Faturado (emissão)</dt>
        <dd className="font-medium text-gray-900 dark:text-white">{formatCurrency(detalhe.faturado)}</dd>
      </div>
      <div>
        <dt className="text-gray-500 dark:text-gray-400">Atingido</dt>
        <dd className="font-medium text-gray-900 dark:text-white">
          {detalhe.percentual === null ? '—' : formatPercentual(detalhe.percentual)}
        </dd>
      </div>
    </dl>
  );
};

const DetalheCriterio: React.FC<{ criterio: CriterioPontuacao }> = ({ criterio }) => {
  const { detalhe } = criterio;
  if (!detalhe) return null;
  if (detalhe.tipo === 'tarefas') return <DetalheTarefas detalhe={detalhe} />;
  if (detalhe.tipo === 'guiasSemLote') return <DetalheGuiasSemLote detalhe={detalhe} />;
  if (detalhe.tipo === 'zeroGlosa') return <DetalheZeroGlosa detalhe={detalhe} />;
  return <DetalheMeta detalhe={detalhe} />;
};

const ObservacaoManual: React.FC<{ criterio: CriterioPontuacao; onLancar?: () => void }> = ({ criterio, onLancar }) => {
  const { lancamento } = criterio;
  return (
    <div className="flex items-start justify-between gap-2">
      <div>
        {lancamento ? (
          <>
            <p className="text-gray-600 dark:text-gray-300 whitespace-pre-line">{criterio.observacao}</p>
            <p className="text-xs text-gray-400 dark:text-gray-500">
              {lancamento.por ? `${lancamento.por}, ` : ''}{formatDataHora(lancamento.em)}
            </p>
          </>
        ) : (
          <p className="italic text-gray-400 dark:text-gray-500">{criterio.observacao}</p>
        )}
      </div>
      {onLancar && (
        <button
          onClick={onLancar}
          className="shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30"
        >
          <Pencil className="h-3.5 w-3.5" />
          {lancamento ? 'Alterar' : 'Lançar'}
        </button>
      )}
    </div>
  );
};

const LinhaCriterio: React.FC<{ criterio: CriterioPontuacao; onLancar?: () => void }> = ({ criterio, onLancar }) => {
  const [aberto, setAberto] = useState(false);
  const temDetalhe = criterio.detalhe !== null;
  const Seta = aberto ? ChevronDown : ChevronRight;
  return (
    <>
      <tr className="border-t border-gray-100 dark:border-gray-700/60">
        <td className="py-2 pr-2">
          {temDetalhe ? (
            <button
              onClick={() => setAberto((v) => !v)}
              aria-expanded={aberto}
              className="inline-flex items-center gap-1 text-left text-gray-900 dark:text-gray-100 hover:text-blue-600 dark:hover:text-blue-400"
            >
              <Seta className="h-4 w-4 shrink-0" />
              {criterio.rotulo}
            </button>
          ) : (
            <span className="pl-5 text-gray-900 dark:text-gray-100">{criterio.rotulo}</span>
          )}
        </td>
        <td className="py-2 px-2 text-right tabular-nums text-gray-500 dark:text-gray-400 whitespace-nowrap">{pontosBase(criterio)}</td>
        <td className="py-2 px-2 text-right tabular-nums font-semibold text-gray-900 dark:text-white">{formatPontos(criterio.pontosAtingidos)}</td>
        <td className="py-2 pl-2 text-gray-600 dark:text-gray-300">
          {criterio.tipo === 'manual' ? <ObservacaoManual criterio={criterio} onLancar={onLancar} /> : criterio.observacao}
        </td>
      </tr>
      {aberto && temDetalhe && (
        <tr>
          <td colSpan={4} className="pb-3 pl-5">
            <div className="rounded-lg bg-gray-50 dark:bg-gray-900/40 p-3">
              <DetalheCriterio criterio={criterio} />
            </div>
          </td>
        </tr>
      )}
    </>
  );
};

const CardFrente: React.FC<{ frente: FrentePontuada; onLancar?: (criterio: CriterioPontuacao) => void }> = ({ frente, onLancar }) => (
  <div className={CARD}>
    <div className="flex items-start justify-between gap-3 mb-3">
      <div>
        <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Frente</p>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{frente.rotulo}</h3>
      </div>
      <div className="text-right">
        <p className="text-3xl font-bold text-blue-600 dark:text-blue-400 tabular-nums">{formatPontos(frente.total)}</p>
        <p className="text-xs text-gray-500 dark:text-gray-400">pontos</p>
      </div>
    </div>
    {frente.criterios.length > 0 ? (
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-gray-500 dark:text-gray-400">
              <th className="py-1 pr-2 text-left font-medium">Critério</th>
              <th className="py-1 px-2 text-right font-medium">Pontos base</th>
              <th className="py-1 px-2 text-right font-medium">Atingido</th>
              <th className="py-1 pl-2 text-left font-medium">Observação</th>
            </tr>
          </thead>
          <tbody>
            {frente.criterios.map((c) => (
              <LinhaCriterio key={c.chave} criterio={c} onLancar={onLancar && c.tipo === 'manual' ? () => onLancar(c) : undefined} />
            ))}
          </tbody>
        </table>
      </div>
    ) : (
      <p className="text-sm text-gray-500 dark:text-gray-400">Nenhum critério calculado nesta frente ainda.</p>
    )}
  </div>
);

interface Props {
  /** Mês do cabeçalho; null no modo Período. */
  mes: string | null;
  pontuacao: Pontuacao | null;
  meta: PontuacaoSetorMeta | null;
  loading: boolean;
  error: string | null;
  /** Depois de lançar, fechar, reabrir ou mudar os membros: recarrega a pontuação. */
  onAlterado: () => void;
}

const PontuacaoSetor: React.FC<Props> = ({ mes, pontuacao, meta, loading, error, onAlterado }) => {
  const { userProfile } = useAuth();
  const podeGerenciar = hasPermission(userProfile?.permissions || [], 'canManageBilling');
  const fechado = meta?.situacao === 'fechado';
  const [emLancamento, setEmLancamento] = useState<{ frente: FrentePontuada; criterio: CriterioPontuacao } | null>(null);
  const [alterandoFechamento, setAlterandoFechamento] = useState(false);
  const [editandoMembros, setEditandoMembros] = useState(false);
  const [erroFechamento, setErroFechamento] = useState<string | null>(null);

  // O aviso de uma recusa é do mês em que se tentou fechar ou reabrir.
  useEffect(() => setErroFechamento(null), [mes]);

  const alternarFechamento = async () => {
    if (!mes) return;
    const competencia = formatCompetencia(mes);
    const pergunta = fechado
      ? `Reabrir a pontuação de ${competencia}? Os números voltam a ser calculados ao vivo; os lançamentos continuam.`
      : `Fechar a pontuação de ${competencia}? Os números são recalculados agora e ficam congelados, e os lançamentos não poderão mais ser alterados até reabrir.`;
    if (!window.confirm(pergunta)) return;
    setAlterandoFechamento(true);
    setErroFechamento(null);
    try {
      await (fechado ? reabrirPontuacao(mes) : fecharPontuacao(mes));
      onAlterado();
    } catch (err) {
      setErroFechamento(err instanceof Error ? err.message : 'Não foi possível alterar o fechamento.');
    } finally {
      setAlterandoFechamento(false);
    }
  };

  const salvarLancamento = async (pontos: number, observacao: string): Promise<string | null> => {
    if (!mes || !emLancamento) return 'Nenhum critério selecionado.';
    try {
      await lancarPontuacao({ mes, frente: emLancamento.frente.frente, chave: emLancamento.criterio.chave, pontos, observacao });
      onAlterado();
      return null;
    } catch (err) {
      return err instanceof Error ? err.message : 'Não foi possível gravar o lançamento.';
    }
  };

  let conteudo: React.ReactNode;
  if (mes === null) {
    conteudo = (
      <div className={`${CARD} flex items-center gap-3 text-sm text-gray-600 dark:text-gray-300`}>
        <CalendarRange className="h-5 w-5 text-gray-400 shrink-0" />
        A pontuação é mensal; escolha um mês.
      </div>
    );
  } else if (error) {
    conteudo = (
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 flex items-start gap-2">
        <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
        <div>
          <p className="font-medium text-red-700 dark:text-red-300">A pontuação deste mês não foi carregada.</p>
          <p className="text-sm text-red-600 dark:text-red-400 mt-1">{error}</p>
        </div>
      </div>
    );
  } else if (!pontuacao) {
    conteudo = (
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {[0, 1].map((i) => <div key={i} className={`${CARD} h-64 animate-pulse`} />)}
      </div>
    );
  } else {
    conteudo = (
      <div className={`grid grid-cols-1 xl:grid-cols-2 gap-4 transition-opacity ${loading ? 'opacity-60' : ''}`}>
        {pontuacao.frentes.map((f) => (
          <CardFrente
            key={f.frente}
            frente={f}
            onLancar={podeGerenciar && !fechado ? (criterio) => setEmLancamento({ frente: f, criterio }) : undefined}
          />
        ))}
      </div>
    );
  }

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          <Award className="h-5 w-5 text-blue-600" />
          Pontuação do setor
          {mes && <span className="font-normal text-gray-500 dark:text-gray-400">— {formatCompetencia(mes)}</span>}
        </h2>
        {mes && meta?.situacao === 'previa' && (
          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
            Prévia
          </span>
        )}
        {mes && meta?.situacao === 'fechado' && (
          <span
            title={formatDataHora(meta.fechadoEm)}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300"
          >
            <Lock className="h-3 w-3" />
            Fechado em {formatDiaMes(meta.fechadoEm)}{meta.fechadoPor ? ` por ${meta.fechadoPor}` : ''}
          </span>
        )}
        {mes && meta?.dadoAte && (
          <span className="text-xs text-gray-500 dark:text-gray-400">Dados até {formatDiaMesHora(meta.dadoAte)}</span>
        )}
        {mes && podeGerenciar && (
          <div className="flex items-center gap-2 sm:ml-auto">
            <button onClick={() => setEditandoMembros(true)} className={BOTAO_GESTAO}>
              <Users className="h-4 w-4" />
              Membros
            </button>
            {meta && (
              <button
                onClick={() => void alternarFechamento()}
                disabled={alterandoFechamento || loading}
                className={BOTAO_GESTAO}
              >
                {fechado ? <Unlock className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
                {fechado ? 'Reabrir' : 'Fechar pontuação'}
              </button>
            )}
          </div>
        )}
      </div>
      {erroFechamento && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 flex items-start gap-2 text-sm text-red-700 dark:text-red-300">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          {erroFechamento}
        </div>
      )}
      {conteudo}
      {mes && emLancamento && (
        <LancamentoPontuacaoModal
          mes={mes}
          rotuloFrente={emLancamento.frente.rotulo}
          criterio={emLancamento.criterio}
          pontosBase={pontosBase(emLancamento.criterio)}
          onFechar={() => setEmLancamento(null)}
          onSalvar={salvarLancamento}
        />
      )}
      {editandoMembros && (
        <MembrosPontuacaoModal
          frentes={FRENTES_MEMBROS}
          onFechar={() => setEditandoMembros(false)}
          onAlterado={onAlterado}
        />
      )}
    </section>
  );
};

export default PontuacaoSetor;
