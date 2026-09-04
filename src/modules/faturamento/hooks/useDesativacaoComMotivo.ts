import { useState } from 'react';
import type { OperadoraResumo } from '../types';

// Issue 44: as três modais de exceção de operadora (ClinicasParceirasModal,
// RegraNfModal, ConsideradaMetaModal) pedem motivo só ao desativar uma flag —
// mesmo fluxo de "fica pendente até confirmar com motivo" nas três. Extraído
// aqui pra não triplicar o mesmo bloco de estado/handlers a cada modal novo
// do mesmo padrão.

interface UseDesativacaoComMotivoResult {
  salvandoId: string | null;
  erro: string | null;
  pendente: OperadoraResumo | null;
  motivo: string;
  setMotivo: (motivo: string) => void;
  /** Ativar aplica direto; desativar (valorAtual = true) deixa a operadora pendente de motivo. */
  alternar: (operadora: OperadoraResumo, valorAtual: boolean) => Promise<void>;
  confirmarDesativacao: () => Promise<void>;
  cancelarDesativacao: () => void;
  /** Limpa erro/pendência — chamar ao fechar o modal. */
  resetar: () => void;
}

export function useDesativacaoComMotivo(
  onAlternar: (operadoraId: string, valor: boolean, motivo?: string) => Promise<string | null>,
): UseDesativacaoComMotivoResult {
  const [salvandoId, setSalvandoId] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, setPendente] = useState<OperadoraResumo | null>(null);
  const [motivo, setMotivo] = useState('');

  const aplicar = async (operadora: OperadoraResumo, valor: boolean, motivoDesativacao?: string) => {
    setErro(null);
    setSalvandoId(operadora.id);
    const erroRetornado = await onAlternar(operadora.id, valor, motivoDesativacao);
    setSalvandoId(null);
    if (erroRetornado) setErro(erroRetornado);
  };

  const alternar = async (operadora: OperadoraResumo, valorAtual: boolean) => {
    if (valorAtual) {
      setErro(null);
      setPendente(operadora);
      setMotivo('');
      return;
    }
    await aplicar(operadora, true);
  };

  const confirmarDesativacao = async () => {
    if (!pendente || !motivo.trim()) return;
    await aplicar(pendente, false, motivo.trim());
    setPendente(null);
    setMotivo('');
  };

  const cancelarDesativacao = () => {
    setPendente(null);
    setMotivo('');
  };

  const resetar = () => {
    setErro(null);
    setPendente(null);
    setMotivo('');
  };

  return { salvandoId, erro, pendente, motivo, setMotivo, alternar, confirmarDesativacao, cancelarDesativacao, resetar };
}
