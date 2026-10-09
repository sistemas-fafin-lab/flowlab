import React, { useMemo, useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { formatCurrency } from '../../../../utils/paymentUtils';
import { dayKey } from '../../../../utils/datas';
import { FORMAS_PAGAMENTO } from '../../constants';
import { validarBaixa, type ErrosBaixa } from '../../domain/baixa';
import { formatarCompetencia } from '../../domain/competencia';
import type { OcorrenciaDoMes } from '../../domain/situacao';
import { formatarValorCampo, parseValorBR } from '../../domain/valores';
import type { BaixaInput, FormaPagamento } from '../../types';
import AnexosSecao from '../ui/AnexosSecao';
import CampoArquivos from '../ui/CampoArquivos';
import ModalFormulario from '../ui/ModalFormulario';
import { campo, classeRotulo } from '../ui/campos';

interface BaixaModalProps {
  ocorrencia: OcorrenciaDoMes;
  /** Arquivos novos (comprovante, NF) sobem depois de gravar a baixa. */
  onSalvar: (input: BaixaInput, arquivos: File[]) => Promise<string | null>;
  /** Só na edição de uma baixa já feita: anexos que já estão no lançamento. */
  onAdicionarAnexos?: (arquivos: File[]) => Promise<string | null>;
  onRemoverAnexo?: (path: string) => Promise<string | null>;
  onFechar: () => void;
}

const formatarData = (iso: string): string => {
  const [ano, mes, dia] = iso.split('-');
  return `${dia}/${mes}/${ano}`;
};

/** Dar baixa (RF12) ou editar uma baixa já feita (RF13). */
const BaixaModal: React.FC<BaixaModalProps> = ({ ocorrencia: o, onSalvar, onAdicionarAnexos, onRemoverAnexo, onFechar }) => {
  const hoje = useMemo(() => dayKey(new Date()), []);
  const editando = o.lancamento?.status === 'pago';
  const [valor, setValor] = useState(() => formatarValorCampo(editando ? o.lancamento?.valorPago : o.valorPrevisto));
  const [pagoEm, setPagoEm] = useState(() => (editando && o.lancamento?.pagoEm) || (o.vencimento < hoje ? o.vencimento : hoje));
  const [forma, setForma] = useState<FormaPagamento>(o.formaPagamento);
  const [notaFiscal, setNotaFiscal] = useState(o.lancamento?.notaFiscal ?? '');
  const [observacao, setObservacao] = useState(o.lancamento?.observacao ?? '');
  const [arquivos, setArquivos] = useState<File[]>([]);
  const [erros, setErros] = useState<ErrosBaixa>({});
  const [erroGeral, setErroGeral] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  const valorPago = parseValorBR(valor);
  const diferenca = valorPago !== null ? valorPago - o.valorPrevisto : 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const input: BaixaInput = { valorPago, pagoEm, formaPagamento: forma, notaFiscal, observacao };
    const errosCampo = validarBaixa(input, hoje);
    if (valor.trim() && valorPago === null) errosCampo.valorPago = 'Valor inválido. Use o formato 2.480,00.';
    setErros(errosCampo);
    if (Object.keys(errosCampo).length > 0) {
      setErroGeral('Confira os campos destacados.');
      return;
    }
    setSalvando(true);
    setErroGeral(null);
    const erro = await onSalvar(input, arquivos);
    setSalvando(false);
    if (erro) setErroGeral(erro);
    else onFechar();
  };

  return (
    <ModalFormulario
      titulo={editando ? 'Editar pagamento' : 'Dar baixa'}
      subtitulo={`${o.despesa.descricao} · ${formatarCompetencia(o.competencia)}`}
      icone={CheckCircle2}
      onFechar={onFechar}
      onSubmit={handleSubmit}
      ocupado={salvando}
      rotuloSalvar={editando ? 'Salvar pagamento' : 'Registrar pagamento'}
      erro={erroGeral}
      largura="md"
    >
      <div className="space-y-4">
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Previsto: <strong className="text-slate-800 dark:text-slate-100">{formatCurrency(o.valorPrevisto)}</strong> · vence{' '}
          {formatarData(o.vencimento)}
          {o.estimada && ' · valor estimado (despesa variável): informe o valor real'}
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={classeRotulo} htmlFor="baixa-valor">
              Valor pago (R$)
            </label>
            <input
              id="baixa-valor"
              type="text"
              inputMode="decimal"
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              onBlur={() => valorPago !== null && setValor(formatarValorCampo(valorPago))}
              className={`${campo(erros.valorPago)} tabular-nums`}
              autoFocus
            />
            {erros.valorPago ? (
              <p className="mt-1 text-xs text-red-600 dark:text-red-400">{erros.valorPago}</p>
            ) : (
              valorPago !== null &&
              Math.abs(diferenca) >= 0.01 && (
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  {diferenca > 0 ? 'Acima' : 'Abaixo'} do previsto em {formatCurrency(Math.abs(diferenca))}
                </p>
              )
            )}
          </div>
          <div>
            <label className={classeRotulo} htmlFor="baixa-data">
              Pago em
            </label>
            <input id="baixa-data" type="date" value={pagoEm} max={hoje} onChange={(e) => setPagoEm(e.target.value)} className={campo(erros.pagoEm)} />
            {erros.pagoEm && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{erros.pagoEm}</p>}
          </div>
          <div>
            <label className={classeRotulo} htmlFor="baixa-forma">
              Forma de pagamento
            </label>
            <select id="baixa-forma" value={forma} onChange={(e) => setForma(e.target.value as FormaPagamento)} className={campo()}>
              {FORMAS_PAGAMENTO.map((f) => (
                <option key={f.valor} value={f.valor}>
                  {f.rotulo}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={classeRotulo} htmlFor="baixa-nf">
              Nota fiscal <span className="font-normal text-gray-400">(opcional)</span>
            </label>
            <input id="baixa-nf" type="text" value={notaFiscal} onChange={(e) => setNotaFiscal(e.target.value)} className={campo()} />
          </div>
        </div>

        <div>
          <label className={classeRotulo} htmlFor="baixa-observacao">
            Observação <span className="font-normal text-gray-400">(opcional)</span>
          </label>
          <textarea
            id="baixa-observacao"
            rows={2}
            value={observacao}
            onChange={(e) => setObservacao(e.target.value)}
            className={`${campo()} resize-none`}
          />
        </div>

        {editando && onAdicionarAnexos && onRemoverAnexo ? (
          <div>
            <span className={classeRotulo}>Comprovantes</span>
            <AnexosSecao
              anexos={o.lancamento?.anexos ?? []}
              podeGerenciar
              onAdicionar={onAdicionarAnexos}
              onRemover={onRemoverAnexo}
              dicaVazio="Anexe o comprovante ou a nota fiscal."
            />
          </div>
        ) : (
          <div>
            <label className={classeRotulo} htmlFor="baixa-anexos">
              Comprovante ou nota fiscal <span className="font-normal text-gray-400">(opcional)</span>
            </label>
            <CampoArquivos id="baixa-anexos" arquivos={arquivos} onMudar={setArquivos} />
          </div>
        )}
      </div>
    </ModalFormulario>
  );
};

export default BaixaModal;
