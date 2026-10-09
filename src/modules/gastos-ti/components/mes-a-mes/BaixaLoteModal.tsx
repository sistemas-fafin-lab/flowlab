import React, { useMemo, useState } from 'react';
import { CheckCheck } from 'lucide-react';
import { formatCurrency } from '../../../../utils/paymentUtils';
import { dayKey } from '../../../../utils/datas';
import { formatarCompetencia } from '../../domain/competencia';
import type { OcorrenciaDoMes } from '../../domain/situacao';
import ModalFormulario from '../ui/ModalFormulario';
import { campo, classeRotulo } from '../ui/campos';

interface BaixaLoteModalProps {
  ocorrencias: OcorrenciaDoMes[];
  competencia: string;
  onSalvar: (pagoEm: string) => Promise<string | null>;
  onFechar: () => void;
}

/**
 * Baixa de várias cobranças de uma vez, com o valor pago igual ao previsto
 * (RF12). Variáveis entram com a estimativa — o aviso pede para tirar da
 * seleção as que tiveram valor diferente.
 */
const BaixaLoteModal: React.FC<BaixaLoteModalProps> = ({ ocorrencias, competencia, onSalvar, onFechar }) => {
  const hoje = useMemo(() => dayKey(new Date()), []);
  const [pagoEm, setPagoEm] = useState(hoje);
  const [erro, setErro] = useState<string | null>(null);
  const [erroGeral, setErroGeral] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  const total = ocorrencias.reduce((soma, o) => soma + o.valorPrevisto, 0);
  const variaveis = ocorrencias.filter((o) => o.estimada).length;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pagoEm) return setErro('Informe a data do pagamento.');
    if (pagoEm > hoje) return setErro('A data do pagamento não pode ser futura.');
    setErro(null);
    setSalvando(true);
    const resultado = await onSalvar(pagoEm);
    setSalvando(false);
    if (resultado) setErroGeral(resultado);
    else onFechar();
  };

  return (
    <ModalFormulario
      titulo="Baixa em lote"
      subtitulo={`${ocorrencias.length} ${ocorrencias.length === 1 ? 'cobrança' : 'cobranças'} de ${formatarCompetencia(competencia)}`}
      icone={CheckCheck}
      onFechar={onFechar}
      onSubmit={handleSubmit}
      ocupado={salvando}
      rotuloSalvar={`Registrar ${formatCurrency(total)}`}
      erro={erroGeral}
      largura="md"
    >
      <div className="space-y-4">
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Cada cobrança é registrada como paga pelo valor previsto, na data abaixo. Uma baixa diferente (outro valor,
          nota fiscal, comprovante) pode ser editada depois, uma a uma.
        </p>
        {variaveis > 0 && (
          <p className="text-sm text-amber-800 dark:text-amber-200 bg-amber-50 dark:bg-amber-900/20 rounded-xl px-3 py-2">
            {variaveis} {variaveis === 1 ? 'cobrança variável entra' : 'cobranças variáveis entram'} pelo valor estimado.
            Se o valor real foi outro, tire da seleção e dê baixa individual.
          </p>
        )}
        <ul className="max-h-56 overflow-y-auto divide-y divide-slate-200/70 dark:divide-slate-700/50 rounded-xl border border-slate-200/70 dark:border-slate-700/60">
          {ocorrencias.map((o) => (
            <li key={o.chave} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
              <span className="truncate text-slate-700 dark:text-slate-200">{o.despesa.descricao}</span>
              <span className="tabular-nums text-slate-900 dark:text-white flex-shrink-0">{formatCurrency(o.valorPrevisto)}</span>
            </li>
          ))}
        </ul>
        <div>
          <label className={classeRotulo} htmlFor="lote-data">
            Pago em
          </label>
          <input id="lote-data" type="date" value={pagoEm} max={hoje} onChange={(e) => setPagoEm(e.target.value)} className={campo(erro)} />
          {erro && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{erro}</p>}
        </div>
      </div>
    </ModalFormulario>
  );
};

export default BaixaLoteModal;
