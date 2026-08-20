// api/_lib/handlers/qualidade-confirmar-vinculo-ihq.ts
// Ação `confirmar-vinculo-ihq` — grava `cod_requisicao_original` só depois de
// validar contra o LIS que a requisição escolhida existe E pertence ao MESMO
// paciente da solicitação de IHQ (nunca confia só no texto vindo do
// navegador). Sempre server-side (ver cabeçalho de src/modules/qualidade/ihq.ts).
// Confirmação manual vira `vinculo_proveniencia: 'manual'`,
// `vinculo_confianca: 'alta'` — decisão humana explícita, maior confiança
// que qualquer heurística pré-confirmação (nivelConfiancaVinculo só se aplica
// ao estado NÃO confirmado).

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { describeError } from '../errors.js';
import { autorizarQualidade, idDoUsuario, tokenDoHeader } from '../qualidade/autorizacao.js';
import { buscarCodPacientePorRequisicaoLis, ehErroConsulta } from '../qualidade/bdLabQualidade.js';
import { getSupabaseAdminClient, getSupabaseUserClient } from '../supabase.js';

interface CorpoConfirmarVinculo {
  id?: unknown;
  codRequisicaoOriginal?: unknown;
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.status(405).json({ success: false, error: 'Método não permitido.' });
    return;
  }

  const token = tokenDoHeader(req.headers.authorization);
  const erroAuth = await autorizarQualidade(token, 'canManageQualidade');
  if (erroAuth) {
    res.status(erroAuth.status).json(erroAuth.payload);
    return;
  }

  const corpo = req.body as CorpoConfirmarVinculo;
  const id = typeof corpo?.id === 'string' ? corpo.id : null;
  const codRequisicaoOriginal = typeof corpo?.codRequisicaoOriginal === 'string' ? corpo.codRequisicaoOriginal.trim() : null;
  if (!id || !codRequisicaoOriginal) {
    res.status(400).json({ success: false, error: 'Informe "id" e "codRequisicaoOriginal".' });
    return;
  }

  try {
    const supabase = getSupabaseAdminClient();

    const { data: solicitacao, error: erroBusca } = await supabase
      .from('qa_ihq_solicitacoes')
      .select('cod_requisicao_ihq')
      .eq('id', id)
      .maybeSingle();
    if (erroBusca) {
      console.error('[qualidade/confirmar-vinculo-ihq] erro ao buscar solicitação:', describeError(erroBusca));
      res.status(500).json({ success: false, error: 'Falha ao buscar solicitação de IHQ.' });
      return;
    }
    if (!solicitacao) {
      res.status(404).json({ success: false, error: 'Solicitação de IHQ não encontrada.' });
      return;
    }

    const codRequisicaoIhq = (solicitacao as { cod_requisicao_ihq: string }).cod_requisicao_ihq;

    const [origemLis, candidataLis] = await Promise.all([
      buscarCodPacientePorRequisicaoLis(codRequisicaoIhq),
      buscarCodPacientePorRequisicaoLis(codRequisicaoOriginal),
    ]);
    if (ehErroConsulta(origemLis)) {
      res.status(origemLis.erro.status).json({ success: false, error: origemLis.erro.mensagem });
      return;
    }
    if (ehErroConsulta(candidataLis)) {
      res.status(candidataLis.erro.status).json({ success: false, error: candidataLis.erro.mensagem });
      return;
    }
    if (candidataLis.codPaciente === null) {
      res.status(400).json({ success: false, error: `Requisição "${codRequisicaoOriginal}" não encontrada no LIS.` });
      return;
    }
    if (origemLis.codPaciente === null || origemLis.codPaciente !== candidataLis.codPaciente) {
      res.status(400).json({ success: false, error: 'A requisição escolhida não pertence ao mesmo paciente da solicitação de IHQ.' });
      return;
    }

    const usuarioId = await idDoUsuario(token!);
    if (!usuarioId) {
      res.status(401).json({ success: false, error: 'Sessão inválida ou expirada.' });
      return;
    }

    // Client DA SESSÃO (não service_role) para este UPDATE específico: o
    // trigger de auditoria (qa_ihq_solicitacoes_auditoria_trigger, migration
    // 20260820140000) só grava em app_auditoria quando `auth.uid()` não é
    // nulo — uma conexão service_role não tem `auth.uid()`, e confirmar
    // vínculo é uma decisão de curadoria genuína que precisa ficar
    // auditada, como qualquer outra (achado de code review). RLS já libera
    // este UPDATE para quem tem `canManageQualidade` (verificado acima).
    const supabaseComoUsuario = getSupabaseUserClient(token!);
    const { error: erroUpdate } = await supabaseComoUsuario
      .from('qa_ihq_solicitacoes')
      .update({
        cod_requisicao_original: codRequisicaoOriginal,
        vinculo_proveniencia: 'manual',
        vinculo_confianca: 'alta',
        vinculo_confirmado_por: usuarioId,
        vinculo_confirmado_em: new Date().toISOString(),
      })
      .eq('id', id);

    if (erroUpdate) {
      console.error('[qualidade/confirmar-vinculo-ihq] erro ao gravar:', describeError(erroUpdate));
      res.status(500).json({ success: false, error: 'Falha ao confirmar vínculo.' });
      return;
    }

    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({ success: true, data: null });
  } catch (err) {
    console.error('[qualidade/confirmar-vinculo-ihq] erro:', describeError(err));
    res.status(500).json({ success: false, error: 'Erro interno ao confirmar vínculo.' });
  }
}
