// Gerenciamento de 1 risco — tratamento, plano(s) de ação (com evidência e
// eficácia) e reavaliação (risco inicial × residual, histórico completo).
// (.scratch/qualidade-riscos-indicadores/issues/02-riscos-gerenciamento.md)

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Paperclip, Plus } from 'lucide-react';
import { useState } from 'react';
import { classificarScore } from '../../domain/riscosClassificacao.js';
import { agruparCiclosPlanoAcao, pontaDoCiclo, reavaliacaoMaisRecente } from '../../domain/riscosGerenciamento.js';
import type {
  AvaliarEficaciaPlanoAcaoInput,
  FaixaClassificacaoRisco,
  NovaReavaliacaoInput,
  NovoPlanoAcaoInput,
  PlanoAcaoDTO,
  StatusPlanoAcao,
  TratamentoRisco,
} from '../../types';
import {
  anexarEvidenciaPlanoAcao,
  atualizarPlanoAcao,
  atualizarTratamentoRisco,
  avaliarEficaciaPlanoAcao,
  buscarFaixasClassificacao,
  buscarResponsaveisPlanoAcao,
  buscarRisco,
  buscarUrlEvidencia,
  criarPlanoAcao,
  criarReavaliacaoRisco,
  listarPlanosAcao,
  listarReavaliacoesRisco,
} from '../../riscos.js';
import { ComboboxBusca } from '../ui/ComboboxBusca.js';
import { DrawerLateral } from '../ui/DrawerLateral.js';
import { ErrorState } from '../ui/ErrorState.js';
import { Skeleton } from '../ui/Skeleton.js';
import { OcorrenciasCorrelacionadasRisco } from './OcorrenciasCorrelacionadasRisco.js';
import { SeletorMatrizRisco } from './SeletorMatrizRisco.js';
import {
  BADGE_NIVEL,
  BADGE_STATUS_PLANO,
  ROTULO_NIVEL,
  ROTULO_ORIGEM,
  ROTULO_STATUS_PLANO,
  ROTULO_TRATAMENTO,
  campoInput,
  campoLabel,
} from './rotulos.js';

interface RiscoDetalheDrawerProps {
  id: string;
  canManage: boolean;
  onFechar: () => void;
}

const TRATAMENTOS = Object.keys(ROTULO_TRATAMENTO) as TratamentoRisco[];
const STATUS_PLANO_OPCOES = Object.keys(ROTULO_STATUS_PLANO) as StatusPlanoAcao[];

function formatarData(iso: string | null): string {
  if (!iso) return '—';
  const [ano, mes, dia] = iso.split('-');
  return dia && mes && ano ? `${dia}/${mes}/${ano}` : iso;
}

function formatarDataHora(iso: string): string {
  const [data, hora] = iso.split('T');
  return `${formatarData(data)} ${hora?.slice(0, 5) ?? ''}`;
}

function BadgeNivel({ score, faixas }: { score: number; faixas: readonly FaixaClassificacaoRisco[] }) {
  const nivel = classificarScore(score, faixas);
  if (!nivel) return <span className="text-gray-400">—</span>;
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${BADGE_NIVEL[nivel]}`}>{ROTULO_NIVEL[nivel]}</span>;
}

// ─── Seção: tratamento ──────────────────────────────────────────────────────

function SecaoTratamento({
  riscoId,
  tratamentoAtual,
  canManage,
}: {
  riscoId: string;
  tratamentoAtual: TratamentoRisco | null;
  canManage: boolean;
}) {
  const queryClient = useQueryClient();
  const [tratamento, setTratamento] = useState<TratamentoRisco | ''>(tratamentoAtual ?? '');

  const mutacao = useMutation({
    mutationFn: (valor: TratamentoRisco) => atualizarTratamentoRisco(riscoId, valor),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['risco', riscoId] });
      await queryClient.invalidateQueries({ queryKey: ['riscos'] });
    },
  });

  return (
    <section aria-label="Tratamento">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-slate-400">Tratamento</h3>
      <div className="mt-2 flex flex-wrap items-end gap-3">
        <select
          className={`${campoInput} mt-0 w-56`}
          value={tratamento}
          disabled={!canManage}
          onChange={(e) => setTratamento(e.target.value as TratamentoRisco)}
        >
          <option value="">— selecione —</option>
          {TRATAMENTOS.map((t) => (
            <option key={t} value={t}>
              {ROTULO_TRATAMENTO[t]}
            </option>
          ))}
        </select>
        {canManage && (
          <button
            type="button"
            disabled={!tratamento || tratamento === tratamentoAtual || mutacao.isPending}
            onClick={() => tratamento && mutacao.mutate(tratamento)}
            className="flex items-center gap-2 rounded-xl bg-blue-100 px-4 py-2 text-sm font-medium text-blue-800 transition-colors hover:bg-blue-200 disabled:opacity-50 dark:bg-blue-900/40 dark:text-blue-300"
          >
            {mutacao.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />}
            Salvar tratamento
          </button>
        )}
      </div>
      {mutacao.isError && <p role="alert" className="mt-2 text-xs text-red-600 dark:text-red-400">Não foi possível salvar o tratamento.</p>}
    </section>
  );
}

// ─── Seção: reavaliação (risco inicial × residual) ─────────────────────────

function SecaoReavaliacao({
  riscoId,
  probabilidadeInicial,
  severidadeInicial,
  canManage,
}: {
  riscoId: string;
  probabilidadeInicial: number | null;
  severidadeInicial: number | null;
  canManage: boolean;
}) {
  const queryClient = useQueryClient();
  const [formAberto, setFormAberto] = useState(false);
  const [probabilidade, setProbabilidade] = useState<number | null>(null);
  const [severidade, setSeveridade] = useState<number | null>(null);
  const [observacao, setObservacao] = useState('');

  const { data: faixas } = useQuery({ queryKey: ['riscos-faixas'], queryFn: buscarFaixasClassificacao });
  const { data: reavaliacoes, isLoading, isError, refetch } = useQuery({
    queryKey: ['risco-reavaliacoes', riscoId],
    queryFn: () => listarReavaliacoesRisco(riscoId),
  });

  const mutacao = useMutation({
    mutationFn: (input: NovaReavaliacaoInput) => criarReavaliacaoRisco(input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['risco-reavaliacoes', riscoId] });
      setFormAberto(false);
      setProbabilidade(null);
      setSeveridade(null);
      setObservacao('');
    },
  });

  const scoreInicial = probabilidadeInicial != null && severidadeInicial != null ? probabilidadeInicial * severidadeInicial : null;
  const residualAtual = reavaliacaoMaisRecente(reavaliacoes ?? []);

  return (
    <section aria-label="Reavaliação">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-slate-400">
          Reavaliação — risco inicial × residual
        </h3>
        {canManage && !formAberto && (
          <button
            type="button"
            onClick={() => setFormAberto(true)}
            className="flex items-center gap-1 rounded-lg bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100 dark:bg-blue-900/20 dark:text-blue-300"
          >
            <Plus className="h-3.5 w-3.5" aria-hidden />
            Nova reavaliação
          </button>
        )}
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-slate-200/60 p-3 dark:border-white/10">
          <p className="text-xs font-medium text-gray-500 dark:text-slate-400">Risco inicial (cadastro)</p>
          <div className="mt-1 flex items-center gap-2">
            <span className="text-lg font-bold text-slate-900 dark:text-white">{scoreInicial ?? '—'}</span>
            {scoreInicial != null && faixas && <BadgeNivel score={scoreInicial} faixas={faixas} />}
          </div>
        </div>
        <div className="rounded-xl border border-slate-200/60 p-3 dark:border-white/10">
          <p className="text-xs font-medium text-gray-500 dark:text-slate-400">Risco residual atual</p>
          {residualAtual ? (
            <div className="mt-1 flex items-center gap-2">
              <span className="text-lg font-bold text-slate-900 dark:text-white">{residualAtual.score}</span>
              {faixas && <BadgeNivel score={residualAtual.score} faixas={faixas} />}
              <span className="text-xs text-gray-500 dark:text-slate-400">em {formatarDataHora(residualAtual.reavaliadoEm)}</span>
            </div>
          ) : (
            <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">Ainda não reavaliado — acompanha o inicial.</p>
          )}
        </div>
      </div>

      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="text-xs text-gray-500 dark:text-slate-400">
              <th className="pb-2 pr-3 font-medium">Quando</th>
              <th className="pb-2 pr-3 font-medium">P</th>
              <th className="pb-2 pr-3 font-medium">S</th>
              <th className="pb-2 pr-3 font-medium">Score</th>
              <th className="pb-2 pr-3 font-medium">Classificação</th>
              <th className="pb-2 font-medium">Observação</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-white/5">
            <tr>
              <td className="py-2 pr-3 font-medium text-slate-700 dark:text-slate-300">Inicial (cadastro)</td>
              <td className="py-2 pr-3">{probabilidadeInicial ?? '—'}</td>
              <td className="py-2 pr-3">{severidadeInicial ?? '—'}</td>
              <td className="py-2 pr-3">{scoreInicial ?? '—'}</td>
              <td className="py-2 pr-3">{scoreInicial != null && faixas ? <BadgeNivel score={scoreInicial} faixas={faixas} /> : '—'}</td>
              <td className="py-2 text-gray-500 dark:text-slate-400">—</td>
            </tr>
            {(reavaliacoes ?? []).map((r) => (
              <tr key={r.id}>
                <td className="py-2 pr-3 text-gray-600 dark:text-slate-400">{formatarDataHora(r.reavaliadoEm)}</td>
                <td className="py-2 pr-3">{r.probabilidade}</td>
                <td className="py-2 pr-3">{r.severidade}</td>
                <td className="py-2 pr-3">{r.score}</td>
                <td className="py-2 pr-3">{faixas && <BadgeNivel score={r.score} faixas={faixas} />}</td>
                <td className="py-2 text-gray-600 dark:text-slate-400">{r.observacao || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {isLoading && <Skeleton className="mt-2 h-10 w-full" />}
        {isError && <ErrorState titulo="Não foi possível carregar as reavaliações" aoTentarNovamente={() => refetch()} />}
        {!isLoading && !isError && (reavaliacoes ?? []).length === 0 && (
          <p className="mt-2 text-xs text-gray-500 dark:text-slate-400">Ainda sem reavaliação — o risco residual acompanha o inicial.</p>
        )}
      </div>

      {formAberto && (
        <div className="mt-4 rounded-xl border border-slate-200/60 p-4 dark:border-white/10">
          <SeletorMatrizRisco
            probabilidade={probabilidade}
            severidade={severidade}
            onMudarProbabilidade={setProbabilidade}
            onMudarSeveridade={setSeveridade}
            faixas={faixas ?? []}
          />
          <div className="mt-3">
            <label className={campoLabel}>Observação</label>
            <textarea className={campoInput} rows={2} value={observacao} onChange={(e) => setObservacao(e.target.value)} />
          </div>
          <div className="mt-3 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setFormAberto(false)}
              className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/5"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={probabilidade == null || severidade == null || mutacao.isPending}
              onClick={() =>
                probabilidade != null &&
                severidade != null &&
                mutacao.mutate({ riscoId, probabilidade, severidade, observacao: observacao.trim() || null })
              }
              className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-500 to-blue-600 px-4 py-2 text-sm font-medium text-white shadow-md shadow-blue-500/25 hover:from-blue-600 hover:to-blue-700 disabled:opacity-50"
            >
              {mutacao.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />}
              Salvar reavaliação
            </button>
          </div>
          {mutacao.isError && <p role="alert" className="mt-2 text-xs text-red-600 dark:text-red-400">Não foi possível salvar a reavaliação.</p>}
        </div>
      )}
    </section>
  );
}

// ─── Seção: plano(s) de ação ────────────────────────────────────────────────

function FormularioPlanoAcao({
  riscoId,
  planoAnteriorId,
  onCancelar,
  onCriado,
}: {
  riscoId: string;
  planoAnteriorId: string | null;
  onCancelar: () => void;
  onCriado: () => void;
}) {
  const [acao, setAcao] = useState('');
  const [responsavelId, setResponsavelId] = useState('');
  const [dataPrevista, setDataPrevista] = useState('');

  const { data: responsaveis } = useQuery({ queryKey: ['riscos-responsaveis'], queryFn: buscarResponsaveisPlanoAcao });

  const mutacao = useMutation({
    mutationFn: (input: NovoPlanoAcaoInput) => criarPlanoAcao(input),
    onSuccess: onCriado,
  });

  return (
    <div className="mt-3 rounded-xl border border-slate-200/60 p-4 dark:border-white/10">
      {planoAnteriorId && (
        <p className="mb-3 text-xs text-amber-700 dark:text-amber-300">
          Novo ciclo — vinculado ao plano anterior, marcado como não eficaz.
        </p>
      )}
      <div className="space-y-3">
        <div>
          <label className={campoLabel}>Ação</label>
          <textarea className={campoInput} rows={2} value={acao} onChange={(e) => setAcao(e.target.value)} />
        </div>
        <div>
          <label className={campoLabel}>Responsável</label>
          <div className="mt-1">
            <ComboboxBusca itens={responsaveis} valor={responsavelId} onMudar={setResponsavelId} placeholder="— responsável —" ariaLabel="Responsável" />
          </div>
        </div>
        <div>
          <label className={campoLabel}>Data prevista</label>
          <input type="date" className={campoInput} value={dataPrevista} onChange={(e) => setDataPrevista(e.target.value)} />
        </div>
      </div>
      <div className="mt-3 flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancelar}
          className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/5"
        >
          Cancelar
        </button>
        <button
          type="button"
          disabled={!acao.trim() || !responsavelId || mutacao.isPending}
          onClick={() =>
            mutacao.mutate({
              riscoId,
              acao: acao.trim(),
              responsavelId,
              dataPrevista: dataPrevista || null,
              planoAnteriorId,
            })
          }
          className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-500 to-blue-600 px-4 py-2 text-sm font-medium text-white shadow-md shadow-blue-500/25 hover:from-blue-600 hover:to-blue-700 disabled:opacity-50"
        >
          {mutacao.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />}
          Criar plano de ação
        </button>
      </div>
      {mutacao.isError && <p role="alert" className="mt-2 text-xs text-red-600 dark:text-red-400">Não foi possível criar o plano de ação.</p>}
    </div>
  );
}

function LinhaPlanoAcao({
  plano,
  ehPontaDoCiclo,
  canManage,
  riscoId,
  onPedirProximoCiclo,
}: {
  plano: PlanoAcaoDTO;
  ehPontaDoCiclo: boolean;
  canManage: boolean;
  riscoId: string;
  onPedirProximoCiclo: (planoId: string) => void;
}) {
  const queryClient = useQueryClient();
  const [avaliando, setAvaliando] = useState<boolean | null>(null);
  const [observacaoEficacia, setObservacaoEficacia] = useState('');

  const invalidarPlanos = () => queryClient.invalidateQueries({ queryKey: ['risco-planos', riscoId] });

  const mutacaoStatus = useMutation({
    mutationFn: (status: StatusPlanoAcao) => atualizarPlanoAcao(plano.id, { status }),
    onSuccess: invalidarPlanos,
  });

  const mutacaoDataConclusao = useMutation({
    mutationFn: (dataConclusao: string | null) => atualizarPlanoAcao(plano.id, { dataConclusao }),
    onSuccess: invalidarPlanos,
  });

  const mutacaoEficacia = useMutation({
    mutationFn: (input: AvaliarEficaciaPlanoAcaoInput) => avaliarEficaciaPlanoAcao(plano.id, input),
    onSuccess: async () => {
      await invalidarPlanos();
      setAvaliando(null);
      setObservacaoEficacia('');
    },
  });

  const mutacaoEvidencia = useMutation({
    mutationFn: (arquivo: File) => anexarEvidenciaPlanoAcao(plano.id, arquivo),
    onSuccess: invalidarPlanos,
  });

  const mutacaoBaixar = useMutation({
    mutationFn: (path: string) => buscarUrlEvidencia(path),
    onSuccess: (url) => window.open(url, '_blank', 'noopener'),
  });

  return (
    <li className="rounded-xl border border-slate-200/60 p-3 dark:border-white/10">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{plano.acao}</p>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${BADGE_STATUS_PLANO[plano.status]}`}>
          {ROTULO_STATUS_PLANO[plano.status]}
        </span>
      </div>

      <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-gray-600 dark:text-slate-400 sm:grid-cols-4">
        <div>
          <dt className="font-medium">Responsável</dt>
          <dd>{plano.responsavelNome ?? '—'}</dd>
        </div>
        <div>
          <dt className="font-medium">Prevista</dt>
          <dd>{formatarData(plano.dataPrevista)}</dd>
        </div>
        <div>
          <dt className="font-medium">Conclusão</dt>
          <dd>
            {canManage ? (
              <input
                type="date"
                className="glass-field rounded-lg px-1.5 py-0.5 text-xs text-slate-800 dark:text-slate-200"
                defaultValue={plano.dataConclusao ?? ''}
                onBlur={(e) => {
                  const valor = e.target.value || null;
                  if (valor !== plano.dataConclusao) mutacaoDataConclusao.mutate(valor);
                }}
              />
            ) : (
              formatarData(plano.dataConclusao)
            )}
          </dd>
        </div>
        <div>
          <dt className="font-medium">Eficácia</dt>
          <dd>
            {plano.eficaz === true && <span className="text-green-700 dark:text-green-400">Eficaz</span>}
            {plano.eficaz === false && <span className="text-red-700 dark:text-red-400">Não eficaz</span>}
            {plano.eficaz === null && <span className="text-gray-400">Não avaliada</span>}
          </dd>
        </div>
      </dl>

      {canManage && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <select
            className="glass-field rounded-lg px-2 py-1 text-xs text-slate-800 dark:text-slate-200"
            value={plano.status}
            onChange={(e) => mutacaoStatus.mutate(e.target.value as StatusPlanoAcao)}
          >
            {STATUS_PLANO_OPCOES.map((s) => (
              <option key={s} value={s}>
                {ROTULO_STATUS_PLANO[s]}
              </option>
            ))}
          </select>

          <label className="flex cursor-pointer items-center gap-1 rounded-lg bg-gray-100 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-200 dark:bg-white/10 dark:text-slate-300">
            <Paperclip className="h-3.5 w-3.5" aria-hidden />
            {mutacaoEvidencia.isPending ? 'Enviando…' : 'Anexar evidência'}
            <input
              type="file"
              className="hidden"
              disabled={mutacaoEvidencia.isPending}
              onChange={(e) => {
                const arquivo = e.target.files?.[0];
                if (arquivo) mutacaoEvidencia.mutate(arquivo);
                e.target.value = '';
              }}
            />
          </label>

          {ehPontaDoCiclo && plano.eficaz === null && (
            <>
              <button
                type="button"
                onClick={() => setAvaliando(true)}
                className="rounded-lg bg-green-50 px-2 py-1 text-xs font-medium text-green-700 hover:bg-green-100 dark:bg-green-900/20 dark:text-green-300"
              >
                Marcar eficaz
              </button>
              <button
                type="button"
                onClick={() => setAvaliando(false)}
                className="rounded-lg bg-red-50 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-300"
              >
                Marcar não eficaz
              </button>
            </>
          )}

          {ehPontaDoCiclo && plano.eficaz === false && (
            <button
              type="button"
              onClick={() => onPedirProximoCiclo(plano.id)}
              className="rounded-lg bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100 dark:bg-blue-900/20 dark:text-blue-300"
            >
              Criar próximo plano
            </button>
          )}
        </div>
      )}

      {plano.evidencias.length > 0 && (
        <ul className="mt-2 space-y-1">
          {plano.evidencias.map((ev) => (
            <li key={ev.path}>
              <button
                type="button"
                onClick={() => mutacaoBaixar.mutate(ev.path)}
                className="flex items-center gap-1 text-xs text-blue-600 hover:underline dark:text-blue-400"
              >
                <Paperclip className="h-3 w-3" aria-hidden />
                {ev.nome}
              </button>
            </li>
          ))}
        </ul>
      )}

      {avaliando !== null && (
        <div className="mt-2 rounded-lg bg-gray-50 p-2 dark:bg-white/5">
          <label className={campoLabel}>Observação (opcional)</label>
          <textarea className={campoInput} rows={2} value={observacaoEficacia} onChange={(e) => setObservacaoEficacia(e.target.value)} />
          <div className="mt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setAvaliando(null)}
              className="rounded-lg border border-gray-200 px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-white/10 dark:text-slate-300"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={mutacaoEficacia.isPending}
              onClick={() => mutacaoEficacia.mutate({ eficaz: avaliando, observacaoEficacia: observacaoEficacia.trim() || null })}
              className="rounded-lg bg-blue-600 px-3 py-1 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              Confirmar
            </button>
          </div>
        </div>
      )}
    </li>
  );
}

function SecaoPlanosAcao({ riscoId, canManage }: { riscoId: string; canManage: boolean }) {
  const [formularioAberto, setFormularioAberto] = useState<{ planoAnteriorId: string | null } | null>(null);

  const { data: planos, isLoading, isError, refetch } = useQuery({
    queryKey: ['risco-planos', riscoId],
    queryFn: () => listarPlanosAcao(riscoId),
  });

  const ciclos = agruparCiclosPlanoAcao(planos ?? []);

  return (
    <section aria-label="Planos de ação">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-slate-400">Planos de ação</h3>
        {canManage && !formularioAberto && (
          <button
            type="button"
            onClick={() => setFormularioAberto({ planoAnteriorId: null })}
            className="flex items-center gap-1 rounded-lg bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100 dark:bg-blue-900/20 dark:text-blue-300"
          >
            <Plus className="h-3.5 w-3.5" aria-hidden />
            Novo plano de ação
          </button>
        )}
      </div>

      {isLoading && <Skeleton className="mt-3 h-16 w-full" />}
      {isError && <ErrorState titulo="Não foi possível carregar os planos de ação" aoTentarNovamente={() => refetch()} />}
      {!isLoading && !isError && ciclos.length === 0 && (
        <p className="mt-2 text-xs text-gray-500 dark:text-slate-400">Nenhum plano de ação cadastrado ainda.</p>
      )}

      <div className="mt-3 space-y-4">
        {ciclos.map((ciclo) => {
          const ponta = pontaDoCiclo(ciclo);
          return (
            <ul key={ciclo[0].id} className="space-y-2">
              {ciclo.map((plano) => (
                <LinhaPlanoAcao
                  key={plano.id}
                  plano={plano}
                  ehPontaDoCiclo={ponta?.id === plano.id}
                  canManage={canManage}
                  riscoId={riscoId}
                  onPedirProximoCiclo={(planoAnteriorId) => setFormularioAberto({ planoAnteriorId })}
                />
              ))}
            </ul>
          );
        })}
      </div>

      {formularioAberto && (
        <FormularioPlanoAcao
          riscoId={riscoId}
          planoAnteriorId={formularioAberto.planoAnteriorId}
          onCancelar={() => setFormularioAberto(null)}
          onCriado={() => setFormularioAberto(null)}
        />
      )}
    </section>
  );
}

// ─── Drawer ─────────────────────────────────────────────────────────────────

export function RiscoDetalheDrawer({ id, canManage, onFechar }: RiscoDetalheDrawerProps) {
  const { data: risco, isLoading, isError, refetch } = useQuery({
    queryKey: ['risco', id],
    queryFn: () => buscarRisco(id),
  });

  return (
    <DrawerLateral titulo="Gerenciamento do risco" subtitulo={risco?.riscoIdentificado} largura="larga" aoFechar={onFechar}>
      {isLoading && (
        <div className="flex-1 space-y-4 overflow-y-auto p-6">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      )}

      {isError && (
        <div className="p-6">
          <ErrorState titulo="Não foi possível carregar o risco" aoTentarNovamente={() => refetch()} />
        </div>
      )}

      {risco && (
        <div className="flex-1 space-y-6 overflow-y-auto p-6">
          <section aria-label="Origem">
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-3">
              <div>
                <dt className="text-xs font-medium text-gray-500 dark:text-slate-400">Setor</dt>
                <dd className="text-slate-800 dark:text-slate-200">{risco.setorNome ?? '—'}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-gray-500 dark:text-slate-400">Processo</dt>
                <dd className="text-slate-800 dark:text-slate-200">{risco.processo}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-gray-500 dark:text-slate-400">Origem</dt>
                <dd className="text-slate-800 dark:text-slate-200">{ROTULO_ORIGEM[risco.origemRisco]}</dd>
              </div>
            </dl>
            <div className="mt-2 text-sm">
              <dt className="text-xs font-medium text-gray-500 dark:text-slate-400">Risco identificado</dt>
              <dd className="text-slate-800 dark:text-slate-200">{risco.riscoIdentificado}</dd>
            </div>
          </section>

          <SecaoTratamento riscoId={risco.id} tratamentoAtual={risco.tratamento} canManage={canManage} />
          <SecaoReavaliacao
            riscoId={risco.id}
            probabilidadeInicial={risco.probabilidade}
            severidadeInicial={risco.severidade}
            canManage={canManage}
          />
          <SecaoPlanosAcao riscoId={risco.id} canManage={canManage} />
          <OcorrenciasCorrelacionadasRisco riscoId={risco.id} ocorrenciaOrigemId={risco.ocorrenciaOrigemId} canManage={canManage} />
        </div>
      )}
    </DrawerLateral>
  );
}
