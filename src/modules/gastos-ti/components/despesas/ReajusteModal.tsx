import React, { useMemo, useState } from 'react';
import { TrendingUp } from 'lucide-react';
import { formatCurrency } from '../../../../utils/paymentUtils';
import { dayKey } from '../../../../utils/datas';
import { MOTIVOS_REAJUSTE } from '../../constants';
import { competenciaDaData, formatarCompetencia, paraCampoMes } from '../../domain/competencia';
import { validarReajuste, variacao, vigenciaSugerida, type ErrosReajuste } from '../../domain/reajustes';
import { quantidadeVigente, valorVigente } from '../../domain/recorrencia';
import { formatarValorCampo, parseValorBR } from '../../domain/valores';
import type { Despesa, MotivoReajuste, ReajusteInput } from '../../types';
import ModalFormulario from '../ui/ModalFormulario';
import { campo, classeRotulo } from '../ui/campos';

interface ReajusteModalProps {
  despesa: Despesa;
  onSalvar: (input: ReajusteInput) => Promise<string | null>;
  onFechar: () => void;
}

/** Novo valor a partir de uma competência, sem reescrever o passado (RF03). */
const ReajusteModal: React.FC<ReajusteModalProps> = ({ despesa, onSalvar, onFechar }) => {
  const hoje = useMemo(() => dayKey(new Date()), []);
  const [vigencia, setVigencia] = useState(() => paraCampoMes(vigenciaSugerida(despesa.competenciaInicio, hoje)));
  const vigenteDesde = competenciaDaData(vigencia);
  // Valor e quantidade de antes do reajuste: os vigentes no mês anterior à nova vigência.
  const anterior = vigenteDesde ? valorVigente(despesa, vigenteDesde) : despesa.valorBase;
  const [valor, setValor] = useState(() => formatarValorCampo(anterior));
  const [motivo, setMotivo] = useState<MotivoReajuste>('reajuste_contratual');
  const [quantidade, setQuantidade] = useState('');
  const [observacao, setObservacao] = useState('');
  const [erros, setErros] = useState<ErrosReajuste>({});
  const [erroGeral, setErroGeral] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  const valorNovo = parseValorBR(valor);
  const diferenca = valorNovo !== null && valorNovo > 0 ? variacao(anterior, valorNovo) : null;
  const quantidadeAtual = vigenteDesde ? quantidadeVigente(despesa.quantidade, despesa.reajustes, vigenteDesde) : despesa.quantidade;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const input: ReajusteInput = {
      vigenteDesde,
      valor: valorNovo,
      motivo,
      quantidade: quantidade.trim() ? Number(quantidade) : null,
      observacao: observacao.trim() || null,
    };
    const errosCampo = validarReajuste(input, despesa);
    if (valor.trim() && valorNovo === null) errosCampo.valor = 'Valor inválido. Use o formato 2.480,00.';
    setErros(errosCampo);
    if (Object.keys(errosCampo).length > 0) {
      setErroGeral('Confira os campos destacados.');
      return;
    }
    setSalvando(true);
    setErroGeral(null);
    const erro = await onSalvar(input);
    setSalvando(false);
    if (erro) setErroGeral(erro);
    else onFechar();
  };

  return (
    <ModalFormulario
      titulo="Reajustar valor"
      subtitulo={despesa.descricao}
      icone={TrendingUp}
      onFechar={onFechar}
      onSubmit={handleSubmit}
      ocupado={salvando}
      rotuloSalvar="Registrar reajuste"
      erro={erroGeral}
      largura="md"
    >
      <div className="space-y-4">
        <p className="text-sm text-slate-500 dark:text-slate-400">
          O novo valor vale do mês escolhido em diante. Os meses anteriores continuam com o valor antigo. Para corrigir
          um valor digitado errado desde o início, edite a despesa.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={classeRotulo} htmlFor="reajuste-vigencia">
              A partir de
            </label>
            <input id="reajuste-vigencia" type="month" value={vigencia} onChange={(e) => setVigencia(e.target.value)} className={campo(erros.vigenteDesde)} />
            {erros.vigenteDesde && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{erros.vigenteDesde}</p>}
          </div>
          <div>
            <label className={classeRotulo} htmlFor="reajuste-valor">
              Novo valor por cobrança (R$)
            </label>
            <input
              id="reajuste-valor"
              type="text"
              inputMode="decimal"
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              onBlur={() => valorNovo !== null && setValor(formatarValorCampo(valorNovo))}
              className={`${campo(erros.valor)} tabular-nums`}
              autoFocus
            />
            {erros.valor ? (
              <p className="mt-1 text-xs text-red-600 dark:text-red-400">{erros.valor}</p>
            ) : (
              diferenca && (
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Antes: {formatCurrency(anterior)} ·{' '}
                  <span className="font-medium text-slate-700 dark:text-slate-200">
                    {diferenca.absoluta >= 0 ? '+' : '−'}
                    {formatCurrency(Math.abs(diferenca.absoluta))}
                    {diferenca.percentual !== null && ` (${diferenca.percentual >= 0 ? '+' : '−'}${Math.abs(diferenca.percentual).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%)`}
                  </span>
                </p>
              )
            )}
          </div>
          <div>
            <label className={classeRotulo} htmlFor="reajuste-motivo">
              Motivo
            </label>
            <select id="reajuste-motivo" value={motivo} onChange={(e) => setMotivo(e.target.value as MotivoReajuste)} className={campo()}>
              {MOTIVOS_REAJUSTE.map((m) => (
                <option key={m.valor} value={m.valor}>
                  {m.rotulo}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={classeRotulo} htmlFor="reajuste-quantidade">
              Nova quantidade <span className="font-normal text-gray-400">(opcional)</span>
            </label>
            <input
              id="reajuste-quantidade"
              type="number"
              min={1}
              step={1}
              inputMode="numeric"
              value={quantidade}
              onChange={(e) => setQuantidade(e.target.value)}
              placeholder={quantidadeAtual ? `hoje: ${quantidadeAtual}` : 'se mudou'}
              className={campo(erros.quantidade)}
            />
            {erros.quantidade && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{erros.quantidade}</p>}
          </div>
        </div>

        <div>
          <label className={classeRotulo} htmlFor="reajuste-observacao">
            Observação <span className="font-normal text-gray-400">(opcional)</span>
          </label>
          <textarea
            id="reajuste-observacao"
            rows={2}
            value={observacao}
            onChange={(e) => setObservacao(e.target.value)}
            placeholder="Ex.: IPCA de 4,8% previsto no contrato"
            className={`${campo()} resize-none`}
          />
        </div>

        {vigenteDesde && motivo === 'renegociacao' && diferenca && diferenca.absoluta < 0 && (
          <p className="text-xs text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl px-3 py-2">
            Renegociação com redução a partir de {formatarCompetencia(vigenteDesde)}: entra como economia no dashboard.
          </p>
        )}
      </div>
    </ModalFormulario>
  );
};

export default ReajusteModal;
