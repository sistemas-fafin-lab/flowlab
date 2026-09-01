// Gerenciamento de 1 plano de contingência — status, documento anexado e
// histórico de testes (nunca sobrescreve um teste anterior).
// (.scratch/qualidade-riscos-indicadores/issues/03-riscos-contingencia.md)

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Paperclip, Plus } from 'lucide-react';
import { useState } from 'react';
import { proximaDataPrevistaAtual } from '../../domain/riscosContingencia.js';
import type {
  DocumentoPlanoContingencia,
  NovoTesteContingenciaInput,
  ResultadoTesteContingencia,
  StatusPlanoContingencia,
} from '../../types';
import {
  anexarDocumentoPlanoContingencia,
  atualizarPlanoContingencia,
  buscarPlanoContingencia,
  buscarUrlDocumentoContingencia,
  criarTesteContingencia,
  listarTestesContingencia,
} from '../../contingencias.js';
import { DrawerLateral } from '../ui/DrawerLateral.js';
import { ErrorState } from '../ui/ErrorState.js';
import { Skeleton } from '../ui/Skeleton.js';
import {
  BADGE_RESULTADO_TESTE,
  BADGE_STATUS_CONTINGENCIA,
  ROTULO_RESULTADO_TESTE,
  ROTULO_STATUS_CONTINGENCIA,
  campoInput,
  campoLabel,
} from './rotulos.js';

interface PlanoContingenciaDetalheDrawerProps {
  id: string;
  canManage: boolean;
  onFechar: () => void;
}

const STATUS_OPCOES = Object.keys(ROTULO_STATUS_CONTINGENCIA) as StatusPlanoContingencia[];
const RESULTADO_OPCOES = Object.keys(ROTULO_RESULTADO_TESTE) as ResultadoTesteContingencia[];

function formatarData(iso: string | null): string {
  if (!iso) return '—';
  const [ano, mes, dia] = iso.split('-');
  return dia && mes && ano ? `${dia}/${mes}/${ano}` : iso;
}

function formatarDataHora(iso: string): string {
  const [data, hora] = iso.split('T');
  return `${formatarData(data)} ${hora?.slice(0, 5) ?? ''}`;
}

// ─── Seção: status + documento ─────────────────────────────────────────────

function SecaoStatusDocumento({
  planoId,
  statusAtual,
  documento,
  canManage,
}: {
  planoId: string;
  statusAtual: StatusPlanoContingencia;
  documento: DocumentoPlanoContingencia | null;
  canManage: boolean;
}) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<StatusPlanoContingencia>(statusAtual);

  const invalidarPlano = () => queryClient.invalidateQueries({ queryKey: ['plano-contingencia', planoId] });

  const mutacaoStatus = useMutation({
    mutationFn: (valor: StatusPlanoContingencia) => atualizarPlanoContingencia(planoId, { status: valor }),
    onSuccess: async () => {
      await invalidarPlano();
      await queryClient.invalidateQueries({ queryKey: ['contingencias'] });
    },
  });

  const mutacaoDocumento = useMutation({
    mutationFn: (arquivo: File) => anexarDocumentoPlanoContingencia(planoId, arquivo),
    onSuccess: invalidarPlano,
  });

  const mutacaoBaixar = useMutation({
    mutationFn: (path: string) => buscarUrlDocumentoContingencia(path),
    onSuccess: (url) => window.open(url, '_blank', 'noopener'),
  });

  return (
    <section aria-label="Status e documento">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-slate-400">Status e documento</h3>
      <div className="mt-2 flex flex-wrap items-end gap-3">
        <select
          className={`${campoInput} mt-0 w-56`}
          value={status}
          disabled={!canManage}
          onChange={(e) => setStatus(e.target.value as StatusPlanoContingencia)}
        >
          {STATUS_OPCOES.map((s) => (
            <option key={s} value={s}>
              {ROTULO_STATUS_CONTINGENCIA[s]}
            </option>
          ))}
        </select>
        {canManage && (
          <button
            type="button"
            disabled={status === statusAtual || mutacaoStatus.isPending}
            onClick={() => mutacaoStatus.mutate(status)}
            className="flex items-center gap-2 rounded-xl bg-blue-100 px-4 py-2 text-sm font-medium text-blue-800 transition-colors hover:bg-blue-200 disabled:opacity-50 dark:bg-blue-900/40 dark:text-blue-300"
          >
            {mutacaoStatus.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />}
            Salvar status
          </button>
        )}
      </div>
      {mutacaoStatus.isError && (
        <p role="alert" className="mt-2 text-xs text-red-600 dark:text-red-400">
          Não foi possível salvar o status.
        </p>
      )}

      <div className="mt-4">
        {documento ? (
          <button
            type="button"
            onClick={() => mutacaoBaixar.mutate(documento.path)}
            className="flex items-center gap-1.5 text-sm text-blue-600 hover:underline dark:text-blue-400"
          >
            <Paperclip className="h-4 w-4" aria-hidden />
            {documento.nome}
          </button>
        ) : (
          <p className="text-sm text-gray-500 dark:text-slate-400">Nenhum documento anexado.</p>
        )}

        {canManage && (
          <label className="mt-2 flex w-fit cursor-pointer items-center gap-1 rounded-lg bg-gray-100 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-200 dark:bg-white/10 dark:text-slate-300">
            <Paperclip className="h-3.5 w-3.5" aria-hidden />
            {mutacaoDocumento.isPending ? 'Enviando…' : documento ? 'Substituir documento' : 'Anexar documento'}
            <input
              type="file"
              className="hidden"
              disabled={mutacaoDocumento.isPending}
              onChange={(e) => {
                const arquivo = e.target.files?.[0];
                if (arquivo) mutacaoDocumento.mutate(arquivo);
                e.target.value = '';
              }}
            />
          </label>
        )}
        {mutacaoDocumento.isError && (
          <p role="alert" className="mt-2 text-xs text-red-600 dark:text-red-400">
            Não foi possível anexar o documento.
          </p>
        )}
      </div>
    </section>
  );
}

// ─── Seção: histórico de testes ────────────────────────────────────────────

function SecaoTestes({ planoId, canManage }: { planoId: string; canManage: boolean }) {
  const queryClient = useQueryClient();
  const [formAberto, setFormAberto] = useState(false);
  const [dataTeste, setDataTeste] = useState('');
  const [resultado, setResultado] = useState<ResultadoTesteContingencia>('aprovado');
  const [necessidadeMelhoria, setNecessidadeMelhoria] = useState(false);
  const [descricaoMelhoria, setDescricaoMelhoria] = useState('');
  const [proximaDataPrevista, setProximaDataPrevista] = useState('');
  const [observacoes, setObservacoes] = useState('');

  const { data: testes, isLoading, isError, refetch } = useQuery({
    queryKey: ['plano-contingencia-testes', planoId],
    queryFn: () => listarTestesContingencia(planoId),
  });

  const mutacao = useMutation({
    mutationFn: (input: NovoTesteContingenciaInput) => criarTesteContingencia(input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['plano-contingencia-testes', planoId] });
      setFormAberto(false);
      setDataTeste('');
      setResultado('aprovado');
      setNecessidadeMelhoria(false);
      setDescricaoMelhoria('');
      setProximaDataPrevista('');
      setObservacoes('');
    },
  });

  const proximaData = proximaDataPrevistaAtual(testes ?? []);

  return (
    <section aria-label="Histórico de testes">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-slate-400">Histórico de testes</h3>
        {canManage && !formAberto && (
          <button
            type="button"
            onClick={() => setFormAberto(true)}
            className="flex items-center gap-1 rounded-lg bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100 dark:bg-blue-900/20 dark:text-blue-300"
          >
            <Plus className="h-3.5 w-3.5" aria-hidden />
            Registrar teste
          </button>
        )}
      </div>

      {proximaData && (
        <p className="mt-2 text-xs text-gray-500 dark:text-slate-400">
          Próximo teste previsto para {formatarData(proximaData)}.
        </p>
      )}

      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="text-xs text-gray-500 dark:text-slate-400">
              <th className="pb-2 pr-3 font-medium">Data do teste</th>
              <th className="pb-2 pr-3 font-medium">Resultado</th>
              <th className="pb-2 pr-3 font-medium">Melhoria?</th>
              <th className="pb-2 pr-3 font-medium">Próximo teste</th>
              <th className="pb-2 font-medium">Observações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-white/5">
            {(testes ?? []).map((t) => (
              <tr key={t.id}>
                <td className="py-2 pr-3 text-gray-600 dark:text-slate-400">{formatarData(t.dataTeste)}</td>
                <td className="py-2 pr-3">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${BADGE_RESULTADO_TESTE[t.resultado]}`}>
                    {ROTULO_RESULTADO_TESTE[t.resultado]}
                  </span>
                </td>
                <td className="py-2 pr-3 text-gray-700 dark:text-slate-300">{t.necessidadeMelhoria ? 'Sim' : 'Não'}</td>
                <td className="py-2 pr-3 text-gray-600 dark:text-slate-400">{formatarData(t.proximaDataPrevista)}</td>
                <td className="py-2 text-gray-600 dark:text-slate-400">{t.observacoes || t.descricaoMelhoria || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {isLoading && <Skeleton className="mt-2 h-10 w-full" />}
        {isError && <ErrorState titulo="Não foi possível carregar os testes" aoTentarNovamente={() => refetch()} />}
        {!isLoading && !isError && (testes ?? []).length === 0 && (
          <p className="mt-2 text-xs text-gray-500 dark:text-slate-400">Nenhum teste registrado ainda.</p>
        )}
      </div>

      {formAberto && (
        <div className="mt-4 rounded-xl border border-slate-200/60 p-4 dark:border-white/10">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className={campoLabel}>Data do teste</label>
              <input type="date" className={campoInput} value={dataTeste} onChange={(e) => setDataTeste(e.target.value)} />
            </div>
            <div>
              <label className={campoLabel}>Resultado</label>
              <select
                className={campoInput}
                value={resultado}
                onChange={(e) => setResultado(e.target.value as ResultadoTesteContingencia)}
              >
                {RESULTADO_OPCOES.map((r) => (
                  <option key={r} value={r}>
                    {ROTULO_RESULTADO_TESTE[r]}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <label className="mt-3 flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
            <input
              type="checkbox"
              checked={necessidadeMelhoria}
              onChange={(e) => setNecessidadeMelhoria(e.target.checked)}
              className="rounded"
            />
            Necessidade de melhoria
          </label>

          {necessidadeMelhoria && (
            <div className="mt-3">
              <label className={campoLabel}>Descrição da melhoria</label>
              <textarea
                className={campoInput}
                rows={2}
                value={descricaoMelhoria}
                onChange={(e) => setDescricaoMelhoria(e.target.value)}
              />
            </div>
          )}

          <div className="mt-3">
            <label className={campoLabel}>Próxima data prevista</label>
            <input
              type="date"
              className={campoInput}
              value={proximaDataPrevista}
              onChange={(e) => setProximaDataPrevista(e.target.value)}
            />
          </div>

          <div className="mt-3">
            <label className={campoLabel}>Observações</label>
            <textarea className={campoInput} rows={2} value={observacoes} onChange={(e) => setObservacoes(e.target.value)} />
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
              disabled={!dataTeste || mutacao.isPending}
              onClick={() =>
                mutacao.mutate({
                  planoId,
                  dataTeste,
                  resultado,
                  necessidadeMelhoria,
                  descricaoMelhoria: necessidadeMelhoria ? descricaoMelhoria.trim() || null : null,
                  proximaDataPrevista: proximaDataPrevista || null,
                  observacoes: observacoes.trim() || null,
                })
              }
              className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-500 to-blue-600 px-4 py-2 text-sm font-medium text-white shadow-md shadow-blue-500/25 hover:from-blue-600 hover:to-blue-700 disabled:opacity-50"
            >
              {mutacao.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />}
              Registrar teste
            </button>
          </div>
          {mutacao.isError && (
            <p role="alert" className="mt-2 text-xs text-red-600 dark:text-red-400">
              Não foi possível registrar o teste.
            </p>
          )}
        </div>
      )}
    </section>
  );
}

// ─── Drawer ─────────────────────────────────────────────────────────────────

export function PlanoContingenciaDetalheDrawer({ id, canManage, onFechar }: PlanoContingenciaDetalheDrawerProps) {
  const { data: plano, isLoading, isError, refetch } = useQuery({
    queryKey: ['plano-contingencia', id],
    queryFn: () => buscarPlanoContingencia(id),
  });

  return (
    <DrawerLateral titulo="Plano de contingência" subtitulo={plano?.codigo} largura="larga" aoFechar={onFechar}>
      {isLoading && (
        <div className="flex-1 space-y-4 overflow-y-auto p-6">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      )}

      {isError && (
        <div className="p-6">
          <ErrorState titulo="Não foi possível carregar o plano de contingência" aoTentarNovamente={() => refetch()} />
        </div>
      )}

      {plano && (
        <div className="flex-1 space-y-6 overflow-y-auto p-6">
          <section aria-label="Dados do plano">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${BADGE_STATUS_CONTINGENCIA[plano.status]}`}>
                {ROTULO_STATUS_CONTINGENCIA[plano.status]}
              </span>
              <span className="text-sm text-gray-500 dark:text-slate-400">{plano.setorNome ?? '—'}</span>
            </div>

            <dl className="mt-3 grid grid-cols-1 gap-x-4 gap-y-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-xs font-medium text-gray-500 dark:text-slate-400">Evento</dt>
                <dd className="text-slate-800 dark:text-slate-200">{plano.evento}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-gray-500 dark:text-slate-400">Prazo máximo de interrupção</dt>
                <dd className="text-slate-800 dark:text-slate-200">{plano.prazoMaximoInterrupcao ?? '—'}</dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-xs font-medium text-gray-500 dark:text-slate-400">Cenário</dt>
                <dd className="text-slate-800 dark:text-slate-200">{plano.cenario}</dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-xs font-medium text-gray-500 dark:text-slate-400">Impactos</dt>
                <dd className="text-slate-800 dark:text-slate-200">{plano.impactos ?? '—'}</dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-xs font-medium text-gray-500 dark:text-slate-400">Gatilho de acionamento</dt>
                <dd className="text-slate-800 dark:text-slate-200">{plano.gatilhoAcionamento}</dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-xs font-medium text-gray-500 dark:text-slate-400">Ações imediatas</dt>
                <dd className="text-slate-800 dark:text-slate-200">{plano.acoesImediatas}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-gray-500 dark:text-slate-400">Responsáveis</dt>
                <dd className="text-slate-800 dark:text-slate-200">{plano.responsaveis ?? '—'}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-gray-500 dark:text-slate-400">Comunicação</dt>
                <dd className="text-slate-800 dark:text-slate-200">{plano.comunicacao ?? '—'}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-gray-500 dark:text-slate-400">Materiais</dt>
                <dd className="text-slate-800 dark:text-slate-200">{plano.materiais ?? '—'}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-gray-500 dark:text-slate-400">Fornecedor alternativo</dt>
                <dd className="text-slate-800 dark:text-slate-200">{plano.fornecedorAlternativo ?? '—'}</dd>
              </div>
            </dl>

            {plano.atualizadoEm && (
              <p className="mt-3 text-xs text-gray-400 dark:text-slate-500">Última atualização em {formatarDataHora(plano.atualizadoEm)}</p>
            )}
          </section>

          <SecaoStatusDocumento planoId={plano.id} statusAtual={plano.status} documento={plano.documento} canManage={canManage} />
          <SecaoTestes planoId={plano.id} canManage={canManage} />
        </div>
      )}
    </DrawerLateral>
  );
}
