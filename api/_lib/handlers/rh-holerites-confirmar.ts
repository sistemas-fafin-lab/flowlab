// api/_lib/handlers/rh-holerites-confirmar.ts
// Ação `holerites-confirmar` — efetiva o lote revisado na tela de conferência.
//
// Reprocessa o PDF do zero a partir do `tempPath` (mesmo algoritmo
// determinístico de rh-holerites-preview) em vez de confiar em blocos vindos
// do cliente: o corpo da requisição só carrega o `tempPath`, nunca páginas ou
// IDs de colaborador — isso fecha o risco que a própria reunião do RH
// levantou ("colaborador receber holerite de outro"), já que um cliente
// comprometido não tem como injetar um bloco que o parsing não encontrou de
// verdade no PDF.
//
// Blocos não casados (CPF sem colaborador, ou colaborador sem competência
// legível) NÃO bloqueiam o restante do lote — ficam no resultado para
// tratamento manual, igual ao preview.

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sendTemplatedEmail } from '../email.js';
import { describeError } from '../errors.js';
import { autorizarRhERetornarUsuario, tokenDoHeader } from '../rh/autorizacao.js';
import { extrairTextoPorPagina, fatiarPdf } from '../rh/holeritesPdf.js';
import { processarHolerites, type BlocoIdentificado } from '../rh/holeritesProcessamento.js';
import { BUCKET_HOLERITES, pathHoleriteIndividual, tempPathValido } from '../rh/holeritesStorage.js';
import { getSupabaseAdminClient } from '../supabase.js';
import { APP_BASE_URL } from '../appUrl.js';

const TEMPLATE_SLUG = 'holerite_disponivel';

interface CorpoConfirmar {
  tempPath?: unknown;
}

interface ColaboradorComVinculo {
  id: string;
  nome: string;
  cpf: string;
  user_profile_id: string | null;
  user_profiles: { name: string; email: string } | null;
}

const formatCompetencia = (competencia: string): string => {
  const [ano, mes] = competencia.split('-');
  return `${mes}/${ano}`;
};

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.status(405).json({ success: false, error: 'Método não permitido.' });
    return;
  }

  const token = tokenDoHeader(req.headers.authorization);
  const autorizacao = await autorizarRhERetornarUsuario(token);
  if (!('userId' in autorizacao)) {
    res.status(autorizacao.status).json(autorizacao.payload);
    return;
  }
  const uploadedBy = autorizacao.userId;

  const corpo = req.body as CorpoConfirmar;
  if (!tempPathValido(corpo?.tempPath)) {
    res.status(400).json({ success: false, error: 'Parâmetro "tempPath" ausente ou inválido.' });
    return;
  }
  const tempPath = corpo.tempPath;

  const supabase = getSupabaseAdminClient();

  try {
    const { data: arquivo, error: erroDownload } = await supabase.storage.from(BUCKET_HOLERITES).download(tempPath);
    if (erroDownload || !arquivo) {
      res.status(404).json({ success: false, error: 'Arquivo temporário não encontrado. Envie o PDF novamente.' });
      return;
    }
    const bytes = Buffer.from(await arquivo.arrayBuffer());

    let textosPorPagina: string[];
    try {
      textosPorPagina = await extrairTextoPorPagina(bytes);
    } catch (err) {
      console.error('[rh/holerites-confirmar] falha ao ler PDF:', describeError(err));
      res.status(400).json({ success: false, error: 'Não foi possível ler o PDF. Confira se o arquivo não está corrompido ou protegido por senha.' });
      return;
    }

    const [{ data: colaboradores, error: erroColaboradores }, { data: existentes, error: erroExistentes }] =
      await Promise.all([
        supabase.from('colaboradores').select('id, nome, cpf, user_profile_id, user_profiles(name, email)'),
        supabase.from('colaborador_holerites').select('colaborador_id, competencia'),
      ]);
    if (erroColaboradores || erroExistentes) {
      console.error('[rh/holerites-confirmar] erro ao ler colaboradores/holerites existentes:', describeError(erroColaboradores ?? erroExistentes));
      res.status(500).json({ success: false, error: 'Falha ao ler cadastro de colaboradores.' });
      return;
    }
    const colaboradoresComVinculo = (colaboradores ?? []) as unknown as ColaboradorComVinculo[];
    const colaboradorPorId = new Map(colaboradoresComVinculo.map((c) => [c.id, c]));

    const resultado = processarHolerites(
      textosPorPagina,
      colaboradoresComVinculo.map((c) => ({ id: c.id, nome: c.nome, cpf: c.cpf })),
      (existentes ?? []).map((h) => ({ colaboradorId: h.colaborador_id as string, competencia: h.competencia as string })),
    );

    const falhas: { colaboradorId: string; colaboradorNome: string; erro: string }[] = [];
    const processados: BlocoIdentificado[] = [];

    // Sequencial de propósito: mantém no máximo um PDF fatiado em memória por vez
    // (o consolidado pode ter dezenas de colaboradores) e isola a falha de um
    // bloco sem abortar o restante do lote.
    for (const bloco of resultado.blocosIdentificados) {
      try {
        const fatia = await fatiarPdf(bytes, bloco.paginaInicio, bloco.paginaFim);
        const path = pathHoleriteIndividual(bloco.colaboradorId, bloco.competencia);

        const { error: erroUpload } = await supabase.storage
          .from(BUCKET_HOLERITES)
          .upload(path, fatia, { contentType: 'application/pdf', upsert: true });
        if (erroUpload) throw new Error(erroUpload.message);

        const { error: erroUpsert } = await supabase
          .from('colaborador_holerites')
          .upsert(
            { colaborador_id: bloco.colaboradorId, competencia: bloco.competencia, arquivo_path: path, uploaded_by: uploadedBy },
            { onConflict: 'colaborador_id,competencia' },
          );
        if (erroUpsert) throw new Error(erroUpsert.message);

        processados.push(bloco);
      } catch (err) {
        console.error(`[rh/holerites-confirmar] falha ao processar bloco de ${bloco.colaboradorNome}:`, describeError(err));
        falhas.push({ colaboradorId: bloco.colaboradorId, colaboradorNome: bloco.colaboradorNome, erro: describeError(err) });
      }
    }

    // Notificação por email — best-effort: falha de envio não desfaz o upload/gravação
    // já efetivados, e não impede o restante do lote de notificar.
    let notificados = 0;
    await Promise.all(
      processados.map(async (bloco) => {
        const colaborador = colaboradorPorId.get(bloco.colaboradorId);
        const email = colaborador?.user_profiles?.email;
        if (!colaborador?.user_profile_id || !email) return;

        const resultadoEnvio = await sendTemplatedEmail({
          to: email,
          templateSlug: TEMPLATE_SLUG,
          variables: {
            user_name: colaborador.user_profiles?.name || colaborador.nome,
            competencia: formatCompetencia(bloco.competencia),
            action_url: `${APP_BASE_URL}/rh/holerites`,
          },
        });
        if (resultadoEnvio.success) {
          notificados += 1;
        } else {
          console.error(`[rh/holerites-confirmar] falha ao notificar ${colaborador.nome}:`, resultadoEnvio.errorCode, resultadoEnvio.error);
        }
      }),
    );

    const { error: erroRemoverTemp } = await supabase.storage.from(BUCKET_HOLERITES).remove([tempPath]);
    if (erroRemoverTemp) {
      console.error('[rh/holerites-confirmar] falha ao remover PDF temporário (não bloqueia a resposta):', describeError(erroRemoverTemp));
    }

    res.status(200).json({
      success: true,
      data: {
        totalPaginas: resultado.totalPaginas,
        processados: processados.length,
        notificados,
        falhas,
        blocosSemCompetencia: resultado.blocosSemCompetencia,
        cpfsNaoCasados: resultado.cpfsNaoCasados,
        paginasSemCpf: resultado.paginasSemCpf,
      },
    });
  } catch (err) {
    console.error('[rh/holerites-confirmar] erro inesperado:', describeError(err));
    res.status(500).json({ success: false, error: 'Erro interno ao confirmar o lote.' });
  }
}
