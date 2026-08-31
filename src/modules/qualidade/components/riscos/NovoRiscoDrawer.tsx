// Cadastro de risco — botão "Cadastrar novo risco" de RiscosPage e destino de
// "Gerar risco a partir desta ocorrência" (CuradoriaDrawer), quando `prefill`
// é passado.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { useState } from 'react';
import type { NovoRiscoInput, OrigemRisco } from '../../types';
import { buscarFaixasClassificacao, buscarProcessosSugeridos, buscarSetoresRisco, criarRisco } from '../../riscos.js';
import { ComboboxBusca } from '../ui/ComboboxBusca.js';
import { DrawerLateral } from '../ui/DrawerLateral.js';
import { SeletorMatrizRisco } from './SeletorMatrizRisco.js';
import { ROTULO_ORIGEM, campoInput, campoLabel } from './rotulos.js';

interface NovoRiscoDrawerProps {
  onFechar: () => void;
  onCriado?: (id: string) => void;
  prefill?: Partial<NovoRiscoInput>;
}

const ORIGENS = Object.keys(ROTULO_ORIGEM) as OrigemRisco[];

export function NovoRiscoDrawer({ onFechar, onCriado, prefill }: NovoRiscoDrawerProps) {
  const queryClient = useQueryClient();
  const { data: setores } = useQuery({ queryKey: ['riscos-setores'], queryFn: buscarSetoresRisco });
  const { data: faixas } = useQuery({ queryKey: ['riscos-faixas'], queryFn: buscarFaixasClassificacao });

  const [setorId, setSetorId] = useState(prefill?.setorId ?? '');
  const [processo, setProcesso] = useState('');
  const [riscoIdentificado, setRiscoIdentificado] = useState(prefill?.riscoIdentificado ?? '');
  const [causa, setCausa] = useState('');
  const [consequencia, setConsequencia] = useState('');
  const [controleExistente, setControleExistente] = useState('');
  const [origemRisco, setOrigemRisco] = useState<OrigemRisco>(prefill?.origemRisco ?? 'outro');
  const [probabilidade, setProbabilidade] = useState<number | null>(null);
  const [severidade, setSeveridade] = useState<number | null>(null);

  const { data: processosSugeridos } = useQuery({
    queryKey: ['riscos-processos-sugeridos', setorId],
    queryFn: () => buscarProcessosSugeridos(setorId),
    enabled: Boolean(setorId),
  });

  const podeSalvar = Boolean(setorId && processo.trim() && riscoIdentificado.trim());

  const mutacao = useMutation({
    mutationFn: () =>
      criarRisco({
        setorId,
        processo: processo.trim(),
        riscoIdentificado: riscoIdentificado.trim(),
        causa: causa.trim() || null,
        consequencia: consequencia.trim() || null,
        controleExistente: controleExistente.trim() || null,
        origemRisco,
        ocorrenciaOrigemId: prefill?.ocorrenciaOrigemId ?? null,
        probabilidade,
        severidade,
      }),
    onSuccess: async (id) => {
      await queryClient.invalidateQueries({ queryKey: ['riscos'] });
      onCriado?.(id);
      onFechar();
    },
  });

  return (
    <DrawerLateral
      titulo="Cadastrar novo risco"
      aoFechar={onFechar}
      footer={
        <>
          <div className="flex justify-end gap-3 border-t border-gray-100 bg-gray-50/60 px-4 py-4 dark:border-white/10 dark:bg-white/5 sm:px-6">
            <button
              type="button"
              onClick={onFechar}
              className="rounded-xl border border-gray-200 bg-white px-5 py-2.5 font-medium text-gray-700 transition-all duration-200 hover:bg-gray-50 dark:border-white/10 dark:bg-transparent dark:text-slate-300 dark:hover:bg-white/5"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={!podeSalvar || mutacao.isPending}
              onClick={() => mutacao.mutate()}
              className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-500 to-blue-600 px-5 py-2.5 font-medium text-white shadow-md shadow-blue-500/25 transition-all duration-200 hover:from-blue-600 hover:to-blue-700 disabled:opacity-50"
            >
              {mutacao.isPending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
              Cadastrar risco
            </button>
          </div>
          {mutacao.isError && (
            <p role="alert" className="px-4 pb-4 text-sm text-red-600 dark:text-red-400 sm:px-6">
              Não foi possível cadastrar o risco. Tente novamente.
            </p>
          )}
        </>
      }
    >
      <div className="flex-1 space-y-4 overflow-y-auto p-6">
        {prefill?.ocorrenciaOrigemId && (
          <p className="rounded-xl bg-blue-50 p-3 text-sm text-blue-800 dark:bg-blue-900/20 dark:text-blue-300">
            Pré-preenchido a partir de uma ocorrência — complete probabilidade e impacto para classificar o risco.
          </p>
        )}

        <div>
          <label className={campoLabel}>Setor</label>
          <div className="mt-1">
            <ComboboxBusca itens={setores} valor={setorId} onMudar={setSetorId} placeholder="— setor —" ariaLabel="Setor" />
          </div>
        </div>

        <div>
          <label className={campoLabel}>Processo</label>
          <input
            className={campoInput}
            list="riscos-processos-sugeridos"
            value={processo}
            onChange={(e) => setProcesso(e.target.value)}
            placeholder="Ex.: Microtomia"
          />
          <datalist id="riscos-processos-sugeridos">
            {(processosSugeridos ?? []).map((p) => (
              <option key={p} value={p} />
            ))}
          </datalist>
        </div>

        <div>
          <label className={campoLabel}>Risco identificado</label>
          <textarea
            className={campoInput}
            rows={2}
            value={riscoIdentificado}
            onChange={(e) => setRiscoIdentificado(e.target.value)}
            placeholder="Ex.: perda de material durante o corte"
          />
        </div>

        <div>
          <label className={campoLabel}>Causa do risco</label>
          <textarea className={campoInput} rows={2} value={causa} onChange={(e) => setCausa(e.target.value)} />
        </div>

        <div>
          <label className={campoLabel}>Consequência</label>
          <textarea className={campoInput} rows={2} value={consequencia} onChange={(e) => setConsequencia(e.target.value)} />
        </div>

        <div>
          <label className={campoLabel}>Controle que já existe atualmente</label>
          <textarea
            className={campoInput}
            rows={2}
            value={controleExistente}
            onChange={(e) => setControleExistente(e.target.value)}
          />
        </div>

        <div>
          <label className={campoLabel}>Origem do risco</label>
          <select
            className={campoInput}
            value={origemRisco}
            disabled={Boolean(prefill?.ocorrenciaOrigemId)}
            onChange={(e) => setOrigemRisco(e.target.value as OrigemRisco)}
          >
            {ORIGENS.map((o) => (
              <option key={o} value={o}>
                {ROTULO_ORIGEM[o]}
              </option>
            ))}
          </select>
          {prefill?.ocorrenciaOrigemId && (
            <p className="mt-1 text-xs text-gray-500 dark:text-slate-400">
              Travado como "Ocorrência" — este risco nasceu de uma ocorrência.
            </p>
          )}
        </div>

        <SeletorMatrizRisco
          probabilidade={probabilidade}
          severidade={severidade}
          onMudarProbabilidade={setProbabilidade}
          onMudarSeveridade={setSeveridade}
          faixas={faixas ?? []}
        />
      </div>
    </DrawerLateral>
  );
}
