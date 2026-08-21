import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ParametrosFixosCancerDTO, TriagemCancer } from '../../types';
import { AlertTriangle, Sparkles } from 'lucide-react';
import type { ReactNode } from 'react';
import { Fragment, useState } from 'react';
import { buscarCancerCaso, salvarClassificacaoCancer, salvarTriagemCancer } from '../../cancer.js';
import { DrawerLateral } from '../ui/DrawerLateral.js';
import { ErrorState } from '../ui/ErrorState.js';
import { Skeleton } from '../ui/Skeleton.js';
import { BuscaCido } from './BuscaCido.js';
import { CampoParametroFixo, ORDEM_PARAMETRO_FIXO, ROTULOS_PARAMETRO_FIXO, valorDoParametroFixo } from './CampoParametroFixo.js';

/**
 * O LIS guarda o laudo com marcação HTML solta (`<b>`, `<br>`, entidades
 * como `&gt;`). P9: o texto original não pode ser descartado, só apresentado
 * de forma legível — então convertemos para elementos React (nunca
 * `dangerouslySetInnerHTML`, que executaria HTML arbitrário vindo do LIS).
 * `DOMParser` só percorre a árvore aqui; nada é reinserido como innerHTML.
 */
function formatarLaudo(html: string): ReactNode[] {
  const documento = new DOMParser().parseFromString(html, 'text/html');

  function converterNos(nos: NodeListOf<ChildNode>): ReactNode[] {
    return Array.from(nos).flatMap((no, indice): ReactNode[] => {
      if (no.nodeType === Node.TEXT_NODE) {
        return [<Fragment key={indice}>{no.textContent}</Fragment>];
      }
      if (no.nodeType !== Node.ELEMENT_NODE) return [];

      const elemento = no as Element;
      const tag = elemento.tagName.toLowerCase();
      const filhos = converterNos(elemento.childNodes);

      if (tag === 'br') return [<br key={indice} />];
      if (tag === 'b' || tag === 'strong') return [<strong key={indice}>{filhos}</strong>];
      if (tag === 'i' || tag === 'em') return [<em key={indice}>{filhos}</em>];
      return filhos;
    });
  }

  return converterNos(documento.body.childNodes);
}

interface CasoDrawerProps {
  id: string;
  parametrosFixos: ParametrosFixosCancerDTO;
  canManage: boolean;
  onFechar: () => void;
}

const OPCOES_TRIAGEM: { valor: Exclude<TriagemCancer, 'pendente'>; rotulo: string }[] = [
  { valor: 'cancer_confirmado', rotulo: 'É câncer' },
  { valor: 'nao_cancer', rotulo: 'Não é' },
  { valor: 'inconclusivo', rotulo: 'Inconclusivo' },
];

const campoInput =
  'mt-1 w-full glass-field rounded-xl px-3 py-2 text-sm text-slate-800 dark:text-slate-200';

export function CasoDrawer({ id, parametrosFixos, canManage, onFechar }: CasoDrawerProps) {
  const queryClient = useQueryClient();
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['cancer-caso', id],
    queryFn: () => buscarCancerCaso(id),
  });

  const [justificativa, setJustificativa] = useState('');
  const [topografia, setTopografia] = useState<{ codigo: string; descricao: string } | null>(null);
  const [morfologia, setMorfologia] = useState<{ codigo: string; descricao: string } | null>(null);

  const salvarTriagem = useMutation({
    mutationFn: (triagem: Exclude<TriagemCancer, 'pendente'>) => salvarTriagemCancer(id, { triagem, justificativa }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['cancer-funil'] });
      await queryClient.invalidateQueries({ queryKey: ['cancer-caso', id] });
    },
  });

  const salvarClassificacao = useMutation({
    mutationFn: () => {
      if (!topografia || !morfologia) throw new Error('selecione topografia e morfologia');
      return salvarClassificacaoCancer(id, { cidoTopografiaCodigo: topografia.codigo, cidoMorfologiaCodigo: morfologia.codigo });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['cancer-funil'] });
      await queryClient.invalidateQueries({ queryKey: ['cancer-caso', id] });
      onFechar();
    },
  });

  return (
    <DrawerLateral titulo={`Caso — ${data?.codRequisicao ?? '…'}`} aoFechar={onFechar}>
      {isLoading && (
        <div className="flex-1 space-y-6 overflow-y-auto p-6">
          <div className="space-y-3">
            <Skeleton className="h-3 w-32" />
            <Skeleton className="h-40 w-full" />
          </div>
          <div className="space-y-3">
            <Skeleton className="h-3 w-44" />
            <div className="flex gap-2">
              <Skeleton className="h-10 flex-1" />
              <Skeleton className="h-10 flex-1" />
              <Skeleton className="h-10 flex-1" />
            </div>
            <Skeleton className="h-16 w-full" />
          </div>
          <div className="space-y-3">
            <Skeleton className="h-3 w-40" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        </div>
      )}

      {isError && (
        <div className="p-6">
          <ErrorState titulo="Não foi possível carregar o caso" descricao="Verifique sua conexão ou tente novamente." aoTentarNovamente={() => refetch()} />
        </div>
      )}

      {data && (
        <div className="flex-1 space-y-6 overflow-y-auto p-6">
          {data.revisaoPendente && (
            <div className="flex items-start gap-2 rounded-xl bg-red-50 p-3 text-red-800 dark:bg-red-900/20 dark:text-red-300">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              <p className="text-xs font-medium">
                Alerta crítico (R8): o laudo deste caso mudou depois da exportação. Pode exigir notificação
                retificadora à vigilância.
              </p>
            </div>
          )}

          {data.candidatura.candidato && (
            <div
              className={`flex items-start gap-2 rounded-xl p-3 ${
                data.candidatura.confianca === 'alta'
                  ? 'bg-rose-50 text-rose-800 dark:bg-rose-900/20 dark:text-rose-300'
                  : 'bg-amber-50 text-amber-800 dark:bg-amber-900/20 dark:text-amber-300'
              }`}
            >
              <Sparkles className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              <div className="text-xs">
                <p className="font-medium">
                  Candidato a câncer — confiança {data.candidatura.confianca === 'alta' ? 'alta' : 'média'}
                </p>
                <p className="mt-0.5 opacity-90">
                  O sistema encontrou correspondência com o catálogo CID-O: {data.candidatura.indicadores.join(' · ')}.
                  Ainda assim, a decisão final é humana.
                </p>
              </div>
            </div>
          )}

          <section aria-label="Laudo">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-slate-400">
              Laudo completo
            </h3>
            <p className="glass-field mt-2 whitespace-pre-wrap rounded-xl p-4 text-sm text-slate-800 dark:text-slate-200">
              {data.textoLaudo ? formatarLaudo(data.textoLaudo) : '—'}
            </p>
          </section>

          <section aria-label="Triagem">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-slate-400">
              Triagem — é câncer?
            </h3>
            <p className="mt-1 text-xs text-gray-500 dark:text-slate-400">
              O sistema não sugere decisão. A leitura do laudo acima é sua.
            </p>
            <div className="mt-3 flex gap-2">
              {OPCOES_TRIAGEM.map((opcao) => (
                <button
                  key={opcao.valor}
                  type="button"
                  onClick={() => salvarTriagem.mutate(opcao.valor)}
                  disabled={!canManage || !justificativa || salvarTriagem.isPending}
                  className={`flex-1 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200 disabled:opacity-40 ${
                    data.triagem === opcao.valor
                      ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-md shadow-blue-500/25'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-white/5 dark:text-slate-300 dark:hover:bg-white/10'
                  }`}
                >
                  {opcao.rotulo}
                </button>
              ))}
            </div>
            <textarea
              className={campoInput}
              rows={2}
              placeholder="Justificativa (obrigatória para salvar)"
              value={justificativa || data.triagemJustificativa || ''}
              onChange={(e) => setJustificativa(e.target.value)}
              disabled={!canManage}
            />
            {data.triadoPor && (
              <p className="mt-1 text-xs text-gray-500 dark:text-slate-400">Triado por {data.triadoPor} em {data.triadoEm}</p>
            )}
          </section>

          <section aria-label="Classificação CID-O">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-slate-400">
              Classificação CID-O
            </h3>
            {data.triagem !== 'cancer_confirmado' ? (
              <p className="mt-2 text-sm text-gray-500 dark:text-slate-400">
                Confirme a triagem como "É câncer" para classificar.
              </p>
            ) : (
              <div className="mt-3 space-y-3">
                {((!topografia && !data.cidoTopografiaCodigo && data.sugestaoTopografia) ||
                  (!morfologia && !data.cidoMorfologiaCodigo && data.sugestaoMorfologia)) && (
                  <div className="flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-amber-800 dark:bg-amber-900/20 dark:text-amber-300">
                    <Sparkles className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                    <p className="text-xs font-medium">
                      Os campos em amarelo abaixo são <strong>sugestões automáticas</strong>, não uma decisão do
                      sistema — vieram de dados do LIS (código/local do fragmento), não de leitura do laudo.
                      Confira se batem com o laudo acima antes de aceitar. Nada é gravado até você clicar em
                      "usar esta" (ou escolher outro código) e depois em "Salvar classificação".
                    </p>
                  </div>
                )}
                <div>
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Topografia</label>
                  {!topografia && !data.cidoTopografiaCodigo && data.sugestaoTopografia && (
                    <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">
                      Sugestão (não confirmada): <strong>{data.sugestaoTopografia.descricao}</strong> —{' '}
                      {canManage && (
                        <button
                          type="button"
                          onClick={() => setTopografia(data.sugestaoTopografia)}
                          className="underline hover:no-underline"
                        >
                          usar esta
                        </button>
                      )}{' '}
                      ou busque outra.
                    </p>
                  )}
                  {!topografia && !data.cidoTopografiaCodigo && !data.sugestaoTopografia && (
                    <p className="mt-1 text-xs text-gray-400 dark:text-slate-500">
                      Sem sugestão automática — este caso não tem local de fragmento estruturado no LIS
                      compatível com o catálogo CID-O. Selecione manualmente a partir do laudo.
                    </p>
                  )}
                  <BuscaCido
                    tipo="topografia"
                    valorAtual={topografia?.codigo ?? data.cidoTopografiaCodigo ?? data.sugestaoTopografia?.codigo ?? ''}
                    descricaoAtual={topografia?.descricao ?? data.cidoTopografiaDescricao ?? data.sugestaoTopografia?.descricao ?? null}
                    sugerido={!topografia && !data.cidoTopografiaCodigo && !!data.sugestaoTopografia}
                    onEscolher={(e) => setTopografia({ codigo: e.codigo, descricao: e.descricao })}
                    desabilitado={!canManage}
                    className="mt-1"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Morfologia</label>
                  {!morfologia && !data.cidoMorfologiaCodigo && data.sugestaoMorfologia && (
                    <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">
                      Sugestão (não confirmada): <strong>{data.sugestaoMorfologia.descricao}</strong> —{' '}
                      {canManage && (
                        <button
                          type="button"
                          onClick={() => setMorfologia(data.sugestaoMorfologia)}
                          className="underline hover:no-underline"
                        >
                          usar esta
                        </button>
                      )}{' '}
                      ou busque outra.
                    </p>
                  )}
                  {!morfologia && !data.cidoMorfologiaCodigo && !data.sugestaoMorfologia && (
                    <p className="mt-1 text-xs text-gray-400 dark:text-slate-500">
                      Sem sugestão automática — este caso não tem código de diagnóstico estruturado no LIS
                      (`diagnostico.CodDiagnostico`) para bater com o catálogo CID-O. Selecione manualmente a
                      partir do laudo.
                    </p>
                  )}
                  <BuscaCido
                    tipo="morfologia"
                    valorAtual={morfologia?.codigo ?? data.cidoMorfologiaCodigo ?? data.sugestaoMorfologia?.codigo ?? ''}
                    descricaoAtual={morfologia?.descricao ?? data.cidoMorfologiaDescricao ?? data.sugestaoMorfologia?.descricao ?? null}
                    sugerido={!morfologia && !data.cidoMorfologiaCodigo && !!data.sugestaoMorfologia}
                    onEscolher={(e) => setMorfologia({ codigo: e.codigo, descricao: e.descricao })}
                    desabilitado={!canManage}
                    className="mt-1"
                  />
                </div>
                {canManage && (
                  <button
                    type="button"
                    disabled={!topografia || !morfologia || salvarClassificacao.isPending}
                    onClick={() => salvarClassificacao.mutate()}
                    className="rounded-xl bg-gradient-to-r from-blue-500 to-blue-600 px-4 py-2 text-sm font-medium text-white shadow-md shadow-blue-500/25 disabled:opacity-40"
                  >
                    {salvarClassificacao.isPending ? 'Salvando…' : 'Salvar classificação'}
                  </button>
                )}
              </div>
            )}
          </section>

          <section aria-label="Dados fixos institucionais">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-slate-400">
              Dados fixos institucionais (padrão RHC)
            </h3>
            <p className="mt-1 text-xs text-gray-500 dark:text-slate-400">
              Raramente mudam — editar aqui altera o valor para todos os casos do módulo, não só este. Entram no
              relatório em PDF (em breve).
            </p>
            <div className="glass-field mt-2 space-y-1 rounded-xl p-2">
              {ORDEM_PARAMETRO_FIXO.map((chave) => (
                <CampoParametroFixo
                  key={chave}
                  chave={chave}
                  rotulo={ROTULOS_PARAMETRO_FIXO[chave]}
                  valorAtual={valorDoParametroFixo(parametrosFixos, chave)}
                  canManage={canManage}
                />
              ))}
            </div>
          </section>
        </div>
      )}
    </DrawerLateral>
  );
}
