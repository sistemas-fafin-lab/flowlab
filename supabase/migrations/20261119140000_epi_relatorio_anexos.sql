/*
  # Qualidade — Anexo do PDF assinado do Relatório mensal de EPI

  Spec: .scratch/epi-relatorio-mensal/spec.md (issue 06; histórias 37–42; Situação de uma área
  no mês; Esquema → Anexos assinados e armazenamento privado). Depende de
  20261119120000_epi_relatorio_fechamento.sql.

  1. Bucket privado `epi-relatorios-assinados`: só PDF, até 20 MB (o mesmo limite do domínio,
     src/modules/qualidade/domain/epiRelatorioMensal.ts → validarPdfAssinadoEpi). Caminho
     "<fechamento_id>/<uuid>.pdf". Leitura (signed URL) para `canViewEpiReport` ou
     `canCloseEpiReport`; envio só para `canCloseEpiReport` e só na pasta de um fechamento que
     não está aberto. Sem policy de UPDATE nem de DELETE: um PDF enviado não é substituído nem
     apagado. Se a área for reaberta entre o envio e a RPC, a RPC recusa e o arquivo fica no
     bucket sem registro (privado, visível só por quem tem permissão; limpeza manual).

  2. `epi_relatorio_anexos`: um registro por PDF assinado, ligado ao fechamento, com o caminho,
     o nome original do arquivo, quem enviou e quando. Os anexos nunca são apagados; reabrir a
     área mantém os anteriores no histórico. Um anexo pertence ao fechamento atual quando
     `enviado_em >= fechado_em` (o registro de fechamento é reaproveitado ao fechar de novo).

  3. Escrita só pela RPC `epi_anexar_relatorio`, SECURITY DEFINER: confere
     `canCloseEpiReport`, a transição do domínio (transicaoFechamentoEpi → anexar: fechado ou
     assinado → assinado) com a linha travada, que o arquivo está na pasta do fechamento e já
     existe no bucket, grava o usuário da sessão e põe a situação em assinado. Área aberta (ou
     sem fechamento) → SQLSTATE PT409.

  4. Leitura da tabela (RLS): `canViewEpiReport` ou `canCloseEpiReport`.
*/

DO $$
BEGIN
  IF to_regclass('public.epi_relatorio_fechamentos') IS NULL THEN
    RAISE EXCEPTION 'Tabela public.epi_relatorio_fechamentos não existe. Aplique 20261119120000_epi_relatorio_fechamento.sql antes desta migration.';
  END IF;
END $$;

-- ─── Armazenamento privado ───────────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('epi-relatorios-assinados', 'epi-relatorios-assinados', false, 20971520, ARRAY['application/pdf'])
ON CONFLICT (id) DO UPDATE
   SET public = false,
       file_size_limit = EXCLUDED.file_size_limit,
       allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "epi_relatorios_assinados_select" ON storage.objects;
CREATE POLICY "epi_relatorios_assinados_select"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'epi-relatorios-assinados'
  AND (
    public.current_user_has_permission('canViewEpiReport')
    OR public.current_user_has_permission('canCloseEpiReport')
  )
);

-- Envio só na pasta de um fechamento que não está aberto.
DROP POLICY IF EXISTS "epi_relatorios_assinados_insert" ON storage.objects;
CREATE POLICY "epi_relatorios_assinados_insert"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'epi-relatorios-assinados'
  AND public.current_user_has_permission('canCloseEpiReport')
  AND lower(name) LIKE '%.pdf'
  AND EXISTS (
    SELECT 1 FROM public.epi_relatorio_fechamentos f
     WHERE f.id::text = (storage.foldername(name))[1]
       AND f.situacao <> 'aberto'
  )
);

-- ─── Tabela ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.epi_relatorio_anexos (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fechamento_id     UUID NOT NULL REFERENCES public.epi_relatorio_fechamentos(id) ON DELETE RESTRICT,
  caminho           TEXT NOT NULL UNIQUE CHECK (btrim(caminho) <> ''),
  nome_arquivo      TEXT NOT NULL CHECK (btrim(nome_arquivo) <> ''),
  enviado_por       UUID REFERENCES auth.users(id),
  enviado_por_nome  TEXT,
  enviado_em        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_epi_relatorio_anexos_fechamento
  ON public.epi_relatorio_anexos (fechamento_id, enviado_em);

COMMENT ON TABLE public.epi_relatorio_anexos IS 'PDFs assinados e digitalizados do Relatório mensal de EPI (bucket epi-relatorios-assinados), ligados ao fechamento, com quem enviou e quando. Nunca apagados. Escrita só pela RPC epi_anexar_relatorio.';

-- ─── RLS: só leitura; a escrita passa pela RPC ───────────────────────────────
ALTER TABLE public.epi_relatorio_anexos ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE p record;
BEGIN
  FOR p IN SELECT policyname FROM pg_policies
            WHERE schemaname = 'public' AND tablename = 'epi_relatorio_anexos'
  LOOP
    EXECUTE format('DROP POLICY %I ON public.epi_relatorio_anexos', p.policyname);
  END LOOP;
END $$;

CREATE POLICY "epi_relatorio_anexos_select" ON public.epi_relatorio_anexos
  FOR SELECT TO authenticated
  USING (public.current_user_has_permission('canViewEpiReport')
      OR public.current_user_has_permission('canCloseEpiReport'));

-- ─── RPC ─────────────────────────────────────────────────────────────────────
-- Anexar: fechado ou assinado → assinado, registrando o PDF já enviado ao bucket.
CREATE OR REPLACE FUNCTION public.epi_anexar_relatorio(p_area TEXT, p_mes TEXT, p_caminho TEXT, p_nome_arquivo TEXT)
RETURNS public.epi_relatorio_fechamentos
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_atual public.epi_relatorio_fechamentos;
  v_resultado public.epi_relatorio_fechamentos;
BEGIN
  IF NOT public.current_user_has_permission('canCloseEpiReport') THEN
    RAISE EXCEPTION 'Você não tem permissão para anexar relatórios de EPI.' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_atual FROM public.epi_relatorio_fechamentos
   WHERE area = p_area AND mes = p_mes
   FOR UPDATE;

  IF NOT FOUND OR v_atual.situacao = 'aberto' THEN
    RAISE EXCEPTION 'Feche a área antes de anexar o PDF assinado.' USING ERRCODE = 'PT409';
  END IF;
  IF p_caminho IS NULL OR split_part(p_caminho, '/', 1) <> v_atual.id::text THEN
    RAISE EXCEPTION 'O arquivo não pertence a este fechamento.' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM storage.objects o
     WHERE o.bucket_id = 'epi-relatorios-assinados' AND o.name = p_caminho AND o.owner_id = auth.uid()::text
  ) THEN
    RAISE EXCEPTION 'O PDF assinado não foi encontrado no armazenamento.' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.epi_relatorio_anexos (fechamento_id, caminho, nome_arquivo, enviado_por, enviado_por_nome)
  VALUES (v_atual.id, p_caminho, COALESCE(NULLIF(btrim(p_nome_arquivo), ''), 'relatorio-assinado.pdf'),
          auth.uid(), public.epi_nome_usuario_sessao());

  UPDATE public.epi_relatorio_fechamentos
     SET situacao = 'assinado', atualizado_em = NOW()
   WHERE id = v_atual.id
  RETURNING * INTO v_resultado;

  RETURN v_resultado;
END;
$$;

REVOKE ALL ON FUNCTION public.epi_anexar_relatorio(TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.epi_anexar_relatorio(TEXT, TEXT, TEXT, TEXT) TO authenticated;
