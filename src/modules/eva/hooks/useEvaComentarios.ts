import { useCallback, useRef, useState } from 'react';
import { agenteAdmin } from '../services/agenteAdmin';
import type { AcaoInsight, EvaInsightData } from '../types';

type Proposta = Extract<AcaoInsight, { tipo: 'propor' }>;

interface Opcoes {
  podeAprovar: boolean;
  navegar: (para: string) => void;
  abrirCard: (id: string) => void;
  perguntar: (texto: string) => void;
  /** "Cobrar de novo": a mesma rota do botão Cobrar (janela de 4 h, D22). true = foi para a fila. */
  cobrar: (cardId: string) => Promise<boolean>;
  /** Depois que o gestor aprovou e a EVA executou, para o Início reler o board. */
  onExecutada: () => void;
  /** Proposta concluída (executada ou enviada para a fila), com o texto do que aconteceu. */
  onFeito?: (texto: string) => void;
}

/**
 * O botão principal dos comentários da EVA (issue 17, D21, D28): navega, abre o card ou o
 * chat, ou abre o diálogo de confirmação de uma proposta. Nada escreve direto em it_requests:
 * a mudança passa por ti_agente_propor_sugestao.
 */
export function useEvaComentarios({ podeAprovar, navegar, abrirCard, perguntar, cobrar, onExecutada, onFeito }: Opcoes) {
  /** Texto de "feito" de cada comentário já aceito, pelo id do comentário. */
  const [feitos, setFeitos] = useState<Record<string, string>>({});
  const [dialogo, setDialogo] = useState<{ insightId: string; acao: Proposta } | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const onExecutadaRef = useRef(onExecutada);
  onExecutadaRef.current = onExecutada;
  const onFeitoRef = useRef(onFeito);
  onFeitoRef.current = onFeito;

  const aceitar = useCallback((insight: EvaInsightData) => {
    const a = insight.acao;
    if (a.tipo === 'propor') {
      setErro(null);
      setDialogo({ insightId: insight.id, acao: a });
      return;
    }
    if (a.tipo === 'cobrar') {
      // O "feito" só aparece se a cobrança entrou mesmo na fila; a recusa vem no aviso.
      void cobrar(a.cardId).then((ok) => { if (ok) setFeitos((f) => ({ ...f, [insight.id]: insight.doneText })); });
      return;
    }
    if (a.tipo === 'navegar') navegar(a.para);
    else if (a.tipo === 'abrir_card') abrirCard(a.cardId);
    else perguntar(a.pergunta);
    setFeitos((f) => ({ ...f, [insight.id]: insight.doneText }));
  }, [navegar, abrirCard, perguntar, cobrar]);

  const confirmar = useCallback(async () => {
    if (!dialogo) return;
    setEnviando(true);
    setErro(null);
    const falhas: string[] = [];
    let feitas = 0;
    // Uma proposta por card: se uma falhar, as outras seguem e o diálogo diz qual ficou.
    for (const p of dialogo.acao.propostas) {
      try {
        await agenteAdmin.propor({ tipo: p.tipo, cardId: p.card_id, proposta: p.proposta, trecho: p.trecho, origem: 'comentario', aprovar: podeAprovar });
        feitas += 1;
      } catch (e) {
        falhas.push(`${p.card.codigo}: ${e instanceof Error ? e.message : 'não deu certo'}`);
      }
    }
    setEnviando(false);
    if (podeAprovar && feitas > 0) onExecutadaRef.current();
    if (falhas.length > 0) {
      setErro(`${feitas > 0 ? `${feitas} de ${dialogo.acao.propostas.length} ${podeAprovar ? 'executadas' : 'enviadas'}. ` : ''}Não consegui: ${falhas.join('; ')}`);
      // O que já foi não pode ser enviado de novo: o diálogo fica só com o que falhou.
      if (feitas > 0) {
        const ok = new Set(dialogo.acao.propostas.map((p) => p.card.codigo).filter((c) => !falhas.some((f) => f.startsWith(`${c}:`))));
        setDialogo({ ...dialogo, acao: { ...dialogo.acao, propostas: dialogo.acao.propostas.filter((p) => !ok.has(p.card.codigo)) } });
      }
      return;
    }
    const texto = podeAprovar ? dialogo.acao.feitoGestor : dialogo.acao.feitoFila;
    setFeitos((f) => ({ ...f, [dialogo.insightId]: texto }));
    // O board relido pode tirar o comentário da tela; o aviso garante que a pessoa veja.
    onFeitoRef.current?.(texto);
    setDialogo(null);
  }, [dialogo, podeAprovar]);

  const fechar = useCallback(() => {
    if (!enviando) setDialogo(null);
  }, [enviando]);

  return { feitos, dialogo, enviando, erro, aceitar, confirmar, fechar };
}
