import React, { useState } from 'react';
import { MinusCircle } from 'lucide-react';
import { formatCurrency } from '../../../../utils/paymentUtils';
import { validarMotivoDispensa } from '../../domain/baixa';
import { formatarCompetencia } from '../../domain/competencia';
import type { OcorrenciaDoMes } from '../../domain/situacao';
import ModalFormulario from '../ui/ModalFormulario';
import { campo, classeRotulo } from '../ui/campos';

interface DispensaModalProps {
  ocorrencia: OcorrenciaDoMes;
  onSalvar: (motivo: string) => Promise<string | null>;
  onFechar: () => void;
}

/** Cobrança que não aconteceu no mês (carência, suspensão, crédito) — RF13. */
const DispensaModal: React.FC<DispensaModalProps> = ({ ocorrencia: o, onSalvar, onFechar }) => {
  const [motivo, setMotivo] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [erroGeral, setErroGeral] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const invalido = validarMotivoDispensa(motivo);
    setErro(invalido);
    if (invalido) return;
    setSalvando(true);
    const resultado = await onSalvar(motivo);
    setSalvando(false);
    if (resultado) setErroGeral(resultado);
    else onFechar();
  };

  return (
    <ModalFormulario
      titulo="Dispensar cobrança"
      subtitulo={`${o.despesa.descricao} · ${formatarCompetencia(o.competencia)}`}
      icone={MinusCircle}
      onFechar={onFechar}
      onSubmit={handleSubmit}
      ocupado={salvando}
      rotuloSalvar="Dispensar"
      erro={erroGeral}
      largura="md"
    >
      <div className="space-y-4">
        <p className="text-sm text-slate-500 dark:text-slate-400">
          A cobrança de {formatCurrency(o.valorPrevisto)} deste mês sai do previsto e do em aberto. A despesa continua
          ativa nos outros meses. Para suspender vários meses, dispense cada um.
        </p>
        <div>
          <label className={classeRotulo} htmlFor="dispensa-motivo">
            Motivo
          </label>
          <textarea
            id="dispensa-motivo"
            rows={3}
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="Ex.: carência de 3 meses no contrato novo"
            className={`${campo(erro)} resize-none`}
            autoFocus
          />
          {erro && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{erro}</p>}
        </div>
      </div>
    </ModalFormulario>
  );
};

export default DispensaModal;
