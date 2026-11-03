// Cadastro e edição de plano de contingência — "Novo plano de contingência" de
// ContingenciasPage e "Editar" do drawer de detalhe. Independente de risco: não
// pede vínculo com qa_riscos. Status fica fora: muda no drawer de detalhe.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { useState } from 'react';
import type { NovoPlanoContingenciaInput, PlanoContingenciaDTO } from '../../types';
import {
  ErroApi,
  atualizarPlanoContingencia,
  buscarSetoresContingencia,
  criarPlanoContingencia,
} from '../../contingencias.js';
import { ComboboxBusca } from '../ui/ComboboxBusca.js';
import { DrawerLateral } from '../ui/DrawerLateral.js';
import { campoInput, campoLabel } from './rotulos.js';

interface PlanoContingenciaFormDrawerProps {
  /** Presente = edição desse plano; ausente = cadastro de um novo. */
  plano?: PlanoContingenciaDTO;
  onFechar: () => void;
  onCriado?: (id: string) => void;
}

export function PlanoContingenciaFormDrawer({ plano, onFechar, onCriado }: PlanoContingenciaFormDrawerProps) {
  const queryClient = useQueryClient();
  const { data: setores } = useQuery({ queryKey: ['riscos-setores'], queryFn: buscarSetoresContingencia });

  const [codigo, setCodigo] = useState(plano?.codigo ?? '');
  const [setorId, setSetorId] = useState(plano?.setorId ?? '');
  const [evento, setEvento] = useState(plano?.evento ?? '');
  const [cenario, setCenario] = useState(plano?.cenario ?? '');
  const [impactos, setImpactos] = useState(plano?.impactos ?? '');
  const [gatilhoAcionamento, setGatilhoAcionamento] = useState(plano?.gatilhoAcionamento ?? '');
  const [acoesImediatas, setAcoesImediatas] = useState(plano?.acoesImediatas ?? '');
  const [responsaveis, setResponsaveis] = useState(plano?.responsaveis ?? '');
  const [comunicacao, setComunicacao] = useState(plano?.comunicacao ?? '');
  const [materiais, setMateriais] = useState(plano?.materiais ?? '');
  const [fornecedorAlternativo, setFornecedorAlternativo] = useState(plano?.fornecedorAlternativo ?? '');
  const [prazoMaximoInterrupcao, setPrazoMaximoInterrupcao] = useState(plano?.prazoMaximoInterrupcao ?? '');

  const podeSalvar = Boolean(
    codigo.trim() && setorId && evento.trim() && cenario.trim() && gatilhoAcionamento.trim() && acoesImediatas.trim(),
  );

  const mutacao = useMutation({
    mutationFn: async () => {
      const input = {
        codigo: codigo.trim(),
        setorId,
        evento: evento.trim(),
        cenario: cenario.trim(),
        impactos: impactos.trim() || null,
        gatilhoAcionamento: gatilhoAcionamento.trim(),
        acoesImediatas: acoesImediatas.trim(),
        responsaveis: responsaveis.trim() || null,
        comunicacao: comunicacao.trim() || null,
        materiais: materiais.trim() || null,
        fornecedorAlternativo: fornecedorAlternativo.trim() || null,
        prazoMaximoInterrupcao: prazoMaximoInterrupcao.trim() || null,
      } satisfies NovoPlanoContingenciaInput;
      if (!plano) return criarPlanoContingencia(input);
      await atualizarPlanoContingencia(plano.id, input);
      return plano.id;
    },
    onSuccess: async (id) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['contingencias'] }),
        queryClient.invalidateQueries({ queryKey: ['plano-contingencia', id] }),
        queryClient.invalidateQueries({ queryKey: ['painel-riscos'] }),
      ]);
      if (!plano) onCriado?.(id);
      onFechar();
    },
  });

  // Código repetido tem mensagem própria (409); o resto cai na genérica.
  const mensagemErro =
    mutacao.error instanceof ErroApi && mutacao.error.status === 409
      ? mutacao.error.message
      : `Não foi possível ${plano ? 'salvar' : 'cadastrar'} o plano de contingência. Tente novamente.`;

  return (
    <DrawerLateral
      titulo={plano ? 'Editar plano de contingência' : 'Novo plano de contingência'}
      subtitulo={plano?.codigo}
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
              {plano ? 'Salvar alterações' : 'Cadastrar plano'}
            </button>
          </div>
          {mutacao.isError && (
            <p role="alert" className="px-4 pb-4 text-sm text-red-600 dark:text-red-400 sm:px-6">
              {mensagemErro}
            </p>
          )}
        </>
      }
    >
      <div className="flex-1 space-y-4 overflow-y-auto p-6">
        <div>
          <label className={campoLabel}>Código</label>
          <input className={campoInput} value={codigo} onChange={(e) => setCodigo(e.target.value)} placeholder="Ex.: PC-001" />
        </div>

        <div>
          <label className={campoLabel}>Setor</label>
          <div className="mt-1">
            <ComboboxBusca itens={setores} valor={setorId} onMudar={setSetorId} placeholder="— setor —" ariaLabel="Setor" />
          </div>
        </div>

        <div>
          <label className={campoLabel}>Evento</label>
          <input
            className={campoInput}
            value={evento}
            onChange={(e) => setEvento(e.target.value)}
            placeholder="Ex.: Queda de energia prolongada"
          />
        </div>

        <div>
          <label className={campoLabel}>Cenário</label>
          <textarea className={campoInput} rows={2} value={cenario} onChange={(e) => setCenario(e.target.value)} />
        </div>

        <div>
          <label className={campoLabel}>Impactos</label>
          <textarea className={campoInput} rows={2} value={impactos} onChange={(e) => setImpactos(e.target.value)} />
        </div>

        <div>
          <label className={campoLabel}>Gatilho de acionamento</label>
          <textarea
            className={campoInput}
            rows={2}
            value={gatilhoAcionamento}
            onChange={(e) => setGatilhoAcionamento(e.target.value)}
          />
        </div>

        <div>
          <label className={campoLabel}>Ações imediatas</label>
          <textarea className={campoInput} rows={2} value={acoesImediatas} onChange={(e) => setAcoesImediatas(e.target.value)} />
        </div>

        <div>
          <label className={campoLabel}>Responsáveis</label>
          <input className={campoInput} value={responsaveis} onChange={(e) => setResponsaveis(e.target.value)} />
        </div>

        <div>
          <label className={campoLabel}>Comunicação</label>
          <textarea className={campoInput} rows={2} value={comunicacao} onChange={(e) => setComunicacao(e.target.value)} />
        </div>

        <div>
          <label className={campoLabel}>Materiais</label>
          <textarea className={campoInput} rows={2} value={materiais} onChange={(e) => setMateriais(e.target.value)} />
        </div>

        <div>
          <label className={campoLabel}>Fornecedor alternativo</label>
          <input
            className={campoInput}
            value={fornecedorAlternativo}
            onChange={(e) => setFornecedorAlternativo(e.target.value)}
          />
        </div>

        <div>
          <label className={campoLabel}>Prazo máximo de interrupção</label>
          <input
            className={campoInput}
            value={prazoMaximoInterrupcao}
            onChange={(e) => setPrazoMaximoInterrupcao(e.target.value)}
            placeholder="Ex.: 4 horas"
          />
        </div>
      </div>
    </DrawerLateral>
  );
}
