import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import type { DocumentoCheckin } from '../types';

interface UseDocumentosAgendamentoResult {
  documentos: DocumentoCheckin[];
  loading: boolean;
  error: string | null;
  expirado: boolean;
  refetch: () => Promise<void>;
}

// Folga p/ o operador ainda conseguir abrir o que está na tela antes do link morrer.
const MARGEM_EXPIRACAO_MS = 30_000;

// Documentos que o paciente enviou pelo app do LAB-HUB, para a conferência de recepção.
//
// Único hook do módulo que passa por /api em vez de ir ao supabase-js direto: os
// arquivos vivem no Supabase do LAB-HUB, cujo bucket é privado e sem policy de
// storage. O acesso é só via API do LAB-HUB, autenticada pela FLOWLAB_API_KEY — que
// é server-side e não pode chegar ao navegador. Daí o proxy em
// api/analises-clinicas/get-documentos.ts.
export function useDocumentosAgendamento(agendamentoId: string): UseDocumentosAgendamentoResult {
  const [documentos, setDocumentos] = useState<DocumentoCheckin[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expirado, setExpirado] = useState(false);

  // Descarta respostas de buscas antigas: um refetch durante a busca inicial pode
  // voltar fora de ordem e sobrescrever o resultado novo com o velho.
  const buscaAtual = useRef(0);

  const refetch = useCallback(async () => {
    const busca = ++buscaAtual.current;
    setLoading(true);
    setError(null);
    setExpirado(false);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error('Sessão expirada. Faça login novamente.');

      const res = await fetch(
        `/api/analises-clinicas/get-documentos?agendamentoId=${encodeURIComponent(agendamentoId)}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      const body: { success?: boolean; error?: string; documentos?: DocumentoCheckin[] } =
        await res.json().catch(() => ({}));

      if (!res.ok || !body.success) {
        throw new Error(body.error || 'Não foi possível carregar os documentos.');
      }

      if (busca !== buscaAtual.current) return;
      setDocumentos(body.documentos ?? []);
    } catch (err) {
      if (busca !== buscaAtual.current) return;
      setError(err instanceof Error ? err.message : 'Não foi possível carregar os documentos.');
      setDocumentos([]);
    } finally {
      if (busca === buscaAtual.current) setLoading(false);
    }
  }, [agendamentoId]);

  useEffect(() => {
    void refetch();
    // Invalida a busca em voo no unmount. O aviso da regra é sobre refs que apontam
    // p/ nós do DOM; esta guarda um contador, e mutá-la aqui é justamente a intenção.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    return () => { buscaAtual.current++; };
  }, [refetch]);

  // As signed URLs vencem em ~15min. Sem auto-refetch de propósito: um modal
  // esquecido aberto no balcão viraria polling perpétuo contra o LAB-HUB, renovando
  // links de documento de identidade para uma tela sem ninguém na frente. O operador
  // pede a atualização quando voltar.
  useEffect(() => {
    if (documentos.length === 0) return;

    // Deriva o menor expiraEm em vez de confiar que é comum a todos: o LAB-HUB hoje
    // assina tudo junto, mas isso é detalhe de implementação dele.
    const vencimento = Math.min(...documentos.map((d) => new Date(d.expiraEm).getTime()));
    const restante = vencimento - Date.now() - MARGEM_EXPIRACAO_MS;

    if (restante <= 0) {
      setExpirado(true);
      return;
    }
    const timer = setTimeout(() => setExpirado(true), restante);
    return () => clearTimeout(timer);
  }, [documentos]);

  return { documentos, loading, error, expirado, refetch };
}
