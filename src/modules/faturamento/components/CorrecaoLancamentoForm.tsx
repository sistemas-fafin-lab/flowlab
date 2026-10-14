import React, { useState } from 'react';
import { AlertTriangle, Loader2, Plus, Trash2 } from 'lucide-react';
import Select from '../../../components/Select';
import DatePicker from '../../../components/DatePicker';
import type {
  BaixaCampos,
  CorrecaoLancamentoPayload,
  GlosaLancada,
  TituloGuia,
  TituloLote,
} from '../types';
import { formatCurrency } from '../utils/formato';
import { montarCorrecao, type GlosaEmEdicao } from '../utils/correcaoLancamento';

// Formulário de correção de UM lançamento do título: uma baixa com as glosas
// lançadas junto, ou o grupo das glosas sem baixa (`baixa` null). Um motivo
// por salvamento (.scratch/titulos-edicao-lancamentos, decisão 11). O status
// da glosa existente não aparece: tem fluxo próprio em Glosas & Recursos — só
// a glosa incluída aqui escolhe o dela, como no lançamento.

const FORMAS = ['TED', 'PIX', 'Boleto', 'Depósito', 'Cheque', 'Outro'];
const FORMAS_OPCOES = [
  { value: '', label: '—' },
  ...FORMAS.map((forma) => ({ value: forma, label: forma })),
];
const STATUS_GLOSA_OPCOES = [
  { value: 'aberta', label: 'Aberta' },
  { value: 'em_recurso', label: 'Em recurso' },
  { value: 'definitiva', label: 'Definitiva' },
];
const STATUS_GLOSA_ROTULO: Record<string, string> = {
  aberta: 'Aberta',
  em_recurso: 'Em recurso',
  revertida: 'Revertida',
  definitiva: 'Definitiva',
};

const CAMPO =
  'mt-1 w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-gray-100';
const CAMPO_GRID =
  'w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-gray-100';

interface Props {
  notaId: string;
  recebimentoId: string | null;
  baixa: BaixaCampos | null;
  glosas: GlosaLancada[];
  lotes: TituloLote[];
  guias: TituloGuia[];
  onCancelar: () => void;
  onSalvar: (payload: CorrecaoLancamentoPayload) => Promise<string | null>;
}

interface LinhaGlosa extends GlosaEmEdicao {
  /** Chave estável de render; `id` é null nas glosas incluídas agora. */
  chave: string;
}

let proximaChave = 1;

const CorrecaoLancamentoForm: React.FC<Props> = ({
  notaId,
  recebimentoId,
  baixa,
  glosas,
  lotes,
  guias,
  onCancelar,
  onSalvar,
}) => {
  const [valorRecebido, setValorRecebido] = useState(baixa ? String(baixa.valorRecebido) : '');
  const [dataReceb, setDataReceb] = useState(baixa?.dataReceb ?? '');
  const [formaRecebimento, setFormaRecebimento] = useState(baixa?.formaRecebimento ?? '');
  const [bancoNome, setBancoNome] = useState(baixa?.bancoNome ?? '');
  const [bancoConta, setBancoConta] = useState(baixa?.bancoConta ?? '');
  const [observacoes, setObservacoes] = useState(baixa?.observacoes ?? '');
  const [linhas, setLinhas] = useState<LinhaGlosa[]>(() =>
    glosas.map((g) => ({ ...g, chave: g.id })),
  );
  const [motivo, setMotivo] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const atualizar = (chave: string, campo: keyof GlosaEmEdicao, valor: unknown) => {
    setLinhas((atual) => atual.map((l) => (l.chave === chave ? { ...l, [campo]: valor } : l)));
  };

  const incluirGlosa = () => {
    setLinhas((atual) => [
      ...atual,
      {
        chave: `nova-${proximaChave++}`,
        id: null,
        valor: 0,
        motivo: '',
        requisicaoId: null,
        loteId: null,
        status: 'aberta',
      },
    ]);
  };

  const submeter = async (evento: React.FormEvent) => {
    evento.preventDefault();
    const resultado = montarCorrecao({
      notaId,
      recebimentoId,
      motivo,
      original: { baixa, glosas },
      editado: {
        baixa: baixa
          ? {
            // Campo apagado vira NaN (não 0) para montarCorrecao pedir o valor.
            valorRecebido: valorRecebido.trim() === '' ? Number.NaN : Number(valorRecebido.replace(',', '.')),
            dataReceb: dataReceb || null,
            formaRecebimento: formaRecebimento || null,
            bancoNome,
            bancoConta,
            observacoes,
          }
          : null,
        // `chave` é só para o React; montarCorrecao ignora o campo a mais.
        glosas: linhas,
      },
    });
    if ('erro' in resultado) {
      setErro(resultado.erro);
      return;
    }
    setErro(null);
    setSalvando(true);
    const falha = await onSalvar(resultado.payload);
    setSalvando(false);
    if (falha) setErro(falha);
  };

  const opcoesGuia = [
    { value: '', label: 'Sem guia específica' },
    ...guias.map((guia) => ({
      value: guia.id,
      label: `${guia.numeroGuia} · ${formatCurrency(guia.valor)}${guia.pacienteNome ? ` · ${guia.pacienteNome}` : ''}`,
    })),
  ];
  const opcoesLote = [
    { value: '', label: 'Sem lote específico' },
    ...lotes.map((lote) => ({ value: lote.id, label: `Lote ${lote.codigoLote}` })),
  ];

  return (
    <form onSubmit={submeter} className="space-y-4">
      {baixa && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <label className="text-xs text-gray-500 dark:text-gray-400">
            Valor recebido *
            <input
              type="number"
              step="0.01"
              min="0"
              value={valorRecebido}
              onChange={(e) => setValorRecebido(e.target.value)}
              className={`${CAMPO} tabular-nums`}
            />
          </label>
          <label className="text-xs text-gray-500 dark:text-gray-400">
            Data *
            <DatePicker value={dataReceb} onChange={setDataReceb} controlClass={CAMPO} />
          </label>
          <label className="text-xs text-gray-500 dark:text-gray-400">
            Forma
            <Select
              value={formaRecebimento}
              onChange={setFormaRecebimento}
              options={FORMAS_OPCOES}
              placeholder="—"
              controlClass={CAMPO}
            />
          </label>
          <label className="text-xs text-gray-500 dark:text-gray-400">
            Banco
            <input type="text" value={bancoNome} onChange={(e) => setBancoNome(e.target.value)} className={CAMPO} />
          </label>
          <label className="text-xs text-gray-500 dark:text-gray-400">
            Conta
            <input type="text" value={bancoConta} onChange={(e) => setBancoConta(e.target.value)} className={CAMPO} />
          </label>
          <label className="text-xs text-gray-500 dark:text-gray-400 sm:col-span-3">
            Observações
            <textarea
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              rows={2}
              className={CAMPO}
            />
          </label>
        </div>
      )}

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-200">Glosas</h4>
          <button
            type="button"
            onClick={incluirGlosa}
            className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
          >
            <Plus className="w-3.5 h-3.5" /> Adicionar glosa
          </button>
        </div>
        {linhas.length === 0 ? (
          <p className="text-xs text-gray-400 dark:text-gray-500">Nenhuma glosa.</p>
        ) : (
          linhas.map((linha) => (
            <div
              key={linha.chave}
              className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-start p-3 rounded-xl border border-gray-100 dark:border-gray-700"
            >
              <input
                type="number"
                step="0.01"
                min="0"
                value={linha.valor || ''}
                onChange={(e) => atualizar(linha.chave, 'valor', Number(e.target.value))}
                placeholder="Valor"
                aria-label="Valor da glosa"
                className={`sm:col-span-2 ${CAMPO_GRID} tabular-nums`}
              />
              <input
                type="text"
                value={linha.motivo}
                onChange={(e) => atualizar(linha.chave, 'motivo', e.target.value)}
                placeholder="Motivo *"
                aria-label="Motivo da glosa"
                className={`sm:col-span-4 ${CAMPO_GRID}`}
              />
              <Select
                value={linha.requisicaoId ?? ''}
                onChange={(v) => atualizar(linha.chave, 'requisicaoId', v || null)}
                options={opcoesGuia}
                controlClass={CAMPO_GRID}
                wrapperClass="sm:col-span-3"
              />
              {linha.id === null ? (
                <Select
                  value={linha.status}
                  onChange={(v) => atualizar(linha.chave, 'status', v)}
                  options={STATUS_GLOSA_OPCOES}
                  controlClass={CAMPO_GRID}
                  wrapperClass="sm:col-span-2"
                />
              ) : (
                <span className="sm:col-span-2 self-center text-xs text-gray-500 dark:text-gray-400">
                  {STATUS_GLOSA_ROTULO[linha.status] ?? linha.status}
                </span>
              )}
              <button
                type="button"
                onClick={() => setLinhas((atual) => atual.filter((l) => l.chave !== linha.chave))}
                className="sm:col-span-1 p-2 rounded-lg text-gray-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-gray-100 dark:hover:bg-gray-700 justify-self-end"
                aria-label="Excluir glosa"
              >
                <Trash2 className="w-4 h-4" />
              </button>
              {lotes.length > 1 && (
                <Select
                  value={linha.loteId ?? ''}
                  onChange={(v) => atualizar(linha.chave, 'loteId', v || null)}
                  options={opcoesLote}
                  controlClass={CAMPO_GRID}
                  wrapperClass="sm:col-span-4 sm:col-start-7"
                />
              )}
            </div>
          ))
        )}
      </div>

      <label className="block text-xs text-gray-500 dark:text-gray-400">
        Motivo da correção *
        <textarea
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          rows={2}
          placeholder="Ex.: valor digitado errado na baixa"
          className={CAMPO}
        />
      </label>

      {erro && (
        <div className="p-3 rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-900/20 text-sm text-red-700 dark:text-red-300 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{erro}</span>
        </div>
      )}

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancelar}
          className="px-4 py-2 rounded-lg text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={salvando}
          className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {salvando && <Loader2 className="w-4 h-4 animate-spin" />}
          Salvar correção
        </button>
      </div>
    </form>
  );
};

export default CorrecaoLancamentoForm;
