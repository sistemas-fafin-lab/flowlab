import React, { useState } from 'react';
import { SlidersHorizontal } from 'lucide-react';
import { formatCurrency } from '../../../../utils/paymentUtils';
import { FORMAS_PAGAMENTO, MOTIVOS_REAJUSTE } from '../../constants';
import { validarAjuste, type AjusteInput, type ErrosAjuste, type EscopoAjuste } from '../../domain/ajuste';
import { formatarCompetencia } from '../../domain/competencia';
import type { OcorrenciaDoMes } from '../../domain/situacao';
import { formatarValorCampo, parseValorBR } from '../../domain/valores';
import type { FormaPagamento, MotivoReajuste } from '../../types';
import ModalFormulario from '../ui/ModalFormulario';
import { campo, classeRotulo } from '../ui/campos';

interface AjusteOcorrenciaModalProps {
  ocorrencia: OcorrenciaDoMes;
  onSalvar: (input: AjusteInput) => Promise<string | null>;
  onFechar: () => void;
}

const formatarData = (iso: string): string => {
  const [ano, mes, dia] = iso.split('-');
  return `${dia}/${mes}/${ano}`;
};

/**
 * Ajuste da previsão ao longo do mês (RF11). "Só este mês" grava na
 * ocorrência; "deste mês em diante" vira reajuste da despesa — e por isso só
 * muda o valor: vencimento e forma não têm histórico datado na despesa.
 */
const AjusteOcorrenciaModal: React.FC<AjusteOcorrenciaModalProps> = ({ ocorrencia: o, onSalvar, onFechar }) => {
  const mes = formatarCompetencia(o.competencia);
  const [escopo, setEscopo] = useState<EscopoAjuste>('mes');
  const [valor, setValor] = useState(() => formatarValorCampo(o.valorPrevisto));
  const [vencimento, setVencimento] = useState(o.vencimento);
  const [forma, setForma] = useState<FormaPagamento>(o.formaPagamento);
  const [motivo, setMotivo] = useState<MotivoReajuste>('reajuste_contratual');
  const [observacao, setObservacao] = useState(o.lancamento?.observacao ?? '');
  const [erros, setErros] = useState<ErrosAjuste>({});
  const [erroGeral, setErroGeral] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  const emDiante = escopo === 'em_diante';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const valorPrevisto = parseValorBR(valor);
    const input: AjusteInput = {
      escopo,
      valorPrevisto,
      vencimento: emDiante ? o.vencimento : vencimento,
      formaPagamento: emDiante ? o.formaPagamento : forma,
      observacao: observacao.trim() || null,
      motivo,
    };
    const errosCampo = validarAjuste(input, o);
    if (valor.trim() && valorPrevisto === null) errosCampo.valorPrevisto = 'Valor inválido. Use o formato 2.480,00.';
    setErros(errosCampo);
    if (Object.keys(errosCampo).length > 0) {
      setErroGeral(errosCampo.geral ?? 'Confira os campos destacados.');
      return;
    }
    setSalvando(true);
    setErroGeral(null);
    const resultado = await onSalvar(input);
    setSalvando(false);
    if (resultado) setErroGeral(resultado);
    else onFechar();
  };

  return (
    <ModalFormulario
      titulo="Ajustar previsão"
      subtitulo={`${o.despesa.descricao} · ${mes}`}
      icone={SlidersHorizontal}
      onFechar={onFechar}
      onSubmit={handleSubmit}
      ocupado={salvando}
      rotuloSalvar={emDiante ? 'Registrar reajuste' : 'Salvar ajuste'}
      erro={erroGeral}
      largura="md"
    >
      <div className="space-y-4">
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Calculado pela despesa: {formatCurrency(o.previstoOriginal)}, vence {formatarData(o.vencimentoOriginal)}.
        </p>

        <div role="radiogroup" aria-label="Aplicar o ajuste" className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {[
            { valor: 'mes' as const, rotulo: `Só em ${mes}`, dica: 'Os outros meses continuam como estão.' },
            { valor: 'em_diante' as const, rotulo: `De ${mes} em diante`, dica: 'Vira um reajuste da despesa (só o valor).' },
          ].map((opcao) => {
            const ativo = escopo === opcao.valor;
            return (
              <button
                key={opcao.valor}
                type="button"
                role="radio"
                aria-checked={ativo}
                onClick={() => setEscopo(opcao.valor)}
                className={`text-left rounded-xl border px-3 py-2 transition-colors ${
                  ativo
                    ? 'border-violet-400 dark:border-violet-500 bg-violet-50 dark:bg-violet-900/30 ring-2 ring-violet-500/20'
                    : 'border-gray-200 dark:border-gray-700 hover:border-violet-300'
                }`}
              >
                <span className="block text-sm font-semibold text-slate-800 dark:text-slate-100">{opcao.rotulo}</span>
                <span className="block text-xs text-slate-500 dark:text-slate-400">{opcao.dica}</span>
              </button>
            );
          })}
        </div>
        {erros.escopo && <p className="text-xs text-red-600 dark:text-red-400">{erros.escopo}</p>}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={classeRotulo} htmlFor="ajuste-valor">
              {emDiante ? 'Novo valor por cobrança (R$)' : 'Valor previsto (R$)'}
            </label>
            <input
              id="ajuste-valor"
              type="text"
              inputMode="decimal"
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              onBlur={() => {
                const v = parseValorBR(valor);
                if (v !== null) setValor(formatarValorCampo(v));
              }}
              className={`${campo(erros.valorPrevisto)} tabular-nums`}
              autoFocus
            />
            {erros.valorPrevisto && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{erros.valorPrevisto}</p>}
          </div>
          {emDiante ? (
            <div>
              <label className={classeRotulo} htmlFor="ajuste-motivo">
                Motivo do reajuste
              </label>
              <select id="ajuste-motivo" value={motivo} onChange={(e) => setMotivo(e.target.value as MotivoReajuste)} className={campo()}>
                {MOTIVOS_REAJUSTE.map((m) => (
                  <option key={m.valor} value={m.valor}>
                    {m.rotulo}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div>
              <label className={classeRotulo} htmlFor="ajuste-vencimento">
                Vencimento
              </label>
              <input
                id="ajuste-vencimento"
                type="date"
                value={vencimento}
                onChange={(e) => setVencimento(e.target.value)}
                className={campo(erros.vencimento)}
              />
              {erros.vencimento && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{erros.vencimento}</p>}
            </div>
          )}
          {!emDiante && (
            <div>
              <label className={classeRotulo} htmlFor="ajuste-forma">
                Forma de pagamento
              </label>
              <select id="ajuste-forma" value={forma} onChange={(e) => setForma(e.target.value as FormaPagamento)} className={campo()}>
                {FORMAS_PAGAMENTO.map((f) => (
                  <option key={f.valor} value={f.valor}>
                    {f.rotulo}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {emDiante && (
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Para mudar a forma de pagamento ou o dia de vencimento de vez, edite a despesa. Neste modo, só o valor muda.
          </p>
        )}

        <div>
          <label className={classeRotulo} htmlFor="ajuste-observacao">
            Observação <span className="font-normal text-gray-400">(opcional)</span>
          </label>
          <textarea
            id="ajuste-observacao"
            rows={2}
            value={observacao}
            onChange={(e) => setObservacao(e.target.value)}
            placeholder={emDiante ? 'Ex.: novo plano contratado' : 'Ex.: pico de uso no fechamento do mês'}
            className={`${campo()} resize-none`}
          />
        </div>
      </div>
    </ModalFormulario>
  );
};

export default AjusteOcorrenciaModal;
