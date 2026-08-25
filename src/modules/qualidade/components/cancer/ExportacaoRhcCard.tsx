import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Download, FileSpreadsheet } from 'lucide-react';
import { useState } from 'react';
import { anoAtual } from '../../anoAtual.js';
import { buscarLinkDownloadExportacao, gerarExportacaoCancer, listarExportacoesCancer } from '../../cancer.js';
import { Skeleton } from '../ui/Skeleton.js';

interface ExportacaoRhcCardProps {
  canManage: boolean;
}

const campoInput = 'glass-field rounded-lg px-2 py-1.5 text-sm text-slate-800 dark:text-slate-200';

function trimestreAtual(): 1 | 2 | 3 | 4 {
  return (Math.floor(new Date().getMonth() / 3) + 1) as 1 | 2 | 3 | 4;
}

function formatarGeradoEm(iso: string): string {
  const [data, hora] = iso.split('T');
  const [ano, mes, dia] = data.split('-');
  return `${dia}/${mes}/${ano} ${hora?.slice(0, 5) ?? ''}`;
}

/**
 * Exportação RHC — gera o CSV (handler `gerar-exportacao-cancer`, exige
 * `canManageQualidade`) e lista as exportações já feitas com link de
 * download (`baixar-exportacao-cancer`, exige só `canViewQualidade`).
 */
export function ExportacaoRhcCard({ canManage }: ExportacaoRhcCardProps) {
  const queryClient = useQueryClient();
  const [ano, setAno] = useState(anoAtual());
  const [trimestre, setTrimestre] = useState<1 | 2 | 3 | 4>(trimestreAtual());
  // Quem preencheu este lote específico, informado a cada exportação — não
  // é fixo institucional, então não tem valor padrão vindo de qa_parametros
  // (issue 13).
  const [registrador, setRegistrador] = useState('');

  const exportacoes = useQuery({
    queryKey: ['cancer-exportacoes'],
    queryFn: () => listarExportacoesCancer(),
  });

  const gerar = useMutation({
    mutationFn: () => gerarExportacaoCancer({ ano, trimestre, registrador }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cancer-exportacoes'] });
      queryClient.invalidateQueries({ queryKey: ['cancer-funil'] });
    },
  });

  const baixar = useMutation({
    mutationFn: ({ id, formato }: { id: string; formato: 'csv' | 'pdf' }) => buscarLinkDownloadExportacao(id, formato),
    onSuccess: (resposta) => window.open(resposta.url, '_blank', 'noopener'),
  });

  const anos = Array.from({ length: 5 }, (_, i) => anoAtual() - i);

  return (
    <section className="glass-surface rounded-2xl p-6">
      <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Exportação RHC</h2>
      <p className="text-sm text-gray-600 dark:text-slate-400">
        Gera o CSV dos casos elegíveis (confirmado + classificado nos 2 eixos) do trimestre escolhido.
      </p>

      {canManage && (
        <div className="mt-4 flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-xs font-medium text-gray-600 dark:text-slate-400">
            Ano
            <select className={campoInput} value={ano} onChange={(e) => setAno(Number(e.target.value))}>
              {anos.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-gray-600 dark:text-slate-400">
            Trimestre
            <select
              className={campoInput}
              value={trimestre}
              onChange={(e) => setTrimestre(Number(e.target.value) as 1 | 2 | 3 | 4)}
            >
              {[1, 2, 3, 4].map((t) => (
                <option key={t} value={t}>
                  {t}º trimestre
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-gray-600 dark:text-slate-400">
            Registrador
            <input className={campoInput} value={registrador} onChange={(e) => setRegistrador(e.target.value)} />
          </label>
          <button
            type="button"
            disabled={gerar.isPending || !registrador.trim()}
            onClick={() => gerar.mutate()}
            className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-500 to-blue-600 px-4 py-2 text-sm font-medium text-white shadow-md shadow-blue-500/25 transition-all duration-200 hover:from-blue-600 hover:to-blue-700 disabled:opacity-50"
          >
            <FileSpreadsheet className="h-4 w-4" aria-hidden />
            {gerar.isPending ? 'Gerando…' : 'Gerar exportação'}
          </button>
        </div>
      )}

      {gerar.isError && (
        <p role="alert" className="mt-3 text-sm text-red-600 dark:text-red-400">
          {gerar.error instanceof Error ? gerar.error.message : 'Falha ao gerar exportação.'}
        </p>
      )}

      {exportacoes.isLoading && (
        <div className="mt-4 space-y-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      )}
      {exportacoes.isError && (
        <p role="alert" className="mt-4 text-sm text-red-600 dark:text-red-400">
          Falha ao carregar exportações.
        </p>
      )}

      {exportacoes.data && exportacoes.data.length === 0 && (
        <p className="mt-4 text-sm text-gray-500 dark:text-slate-400">Nenhuma exportação gerada ainda.</p>
      )}

      {exportacoes.data && exportacoes.data.length > 0 && (
        <ul className="mt-4 divide-y divide-gray-100 dark:divide-white/5">
          {exportacoes.data.map((exportacao) => (
            <li key={exportacao.id} className="flex flex-wrap items-center gap-3 py-2">
              <span className="text-sm font-medium text-slate-800 dark:text-slate-200">
                {exportacao.ano} · {exportacao.trimestre}º trimestre
              </span>
              <span className="text-xs text-gray-500 dark:text-slate-400">
                {exportacao.totalCasos} caso(s) · {exportacao.registrador || 'sem registrador'} ·{' '}
                {formatarGeradoEm(exportacao.geradoEm)}
              </span>
              <button
                type="button"
                disabled={baixar.isPending && baixar.variables?.id === exportacao.id && baixar.variables?.formato === 'csv'}
                onClick={() => baixar.mutate({ id: exportacao.id, formato: 'csv' })}
                className="ml-auto flex items-center gap-1 rounded-lg bg-blue-100 px-3 py-1.5 text-xs font-medium text-blue-800 transition-colors hover:bg-blue-200 disabled:opacity-50 dark:bg-blue-900/40 dark:text-blue-300"
              >
                <Download className="h-3.5 w-3.5" aria-hidden />
                CSV
              </button>
              <button
                type="button"
                disabled={baixar.isPending && baixar.variables?.id === exportacao.id && baixar.variables?.formato === 'pdf'}
                onClick={() => baixar.mutate({ id: exportacao.id, formato: 'pdf' })}
                className="flex items-center gap-1 rounded-lg bg-blue-100 px-3 py-1.5 text-xs font-medium text-blue-800 transition-colors hover:bg-blue-200 disabled:opacity-50 dark:bg-blue-900/40 dark:text-blue-300"
              >
                <Download className="h-3.5 w-3.5" aria-hidden />
                PDF
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
