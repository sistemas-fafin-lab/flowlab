-- ═══════════════════════════════════════════════════════════════════════════════
-- RH — Documentos assinados (openspec/changes/rh-documentos-assinados)
--
-- O RH envia o PDF já assinado (contrato, termos, aditivos); não há fluxo de
-- assinatura eletrônica nem status — todo documento cadastrado está assinado.
-- Leitura: canViewColaboradores, canManageColaboradores ou o próprio
-- colaborador. Escrita/exclusão: canManageColaboradores. Gestor de equipe
-- (canViewHoleritesEquipe) não tem acesso: rescisão e LGPD são sensíveis.
-- Sem UPDATE: corrigir = excluir e reenviar.
-- ═══════════════════════════════════════════════════════════════════════════════

-- ─── 1. Tabela ──────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.colaborador_documentos (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  colaborador_id  uuid NOT NULL REFERENCES public.colaboradores(id) ON DELETE CASCADE,
  tipo            text NOT NULL CHECK (tipo IN (
                    'contrato_trabalho', 'termo_confidencialidade_lgpd', 'acordo_compensacao_horas',
                    'termo_responsabilidade_equipamentos', 'adesao_plano_odontologico',
                    'autorizacao_uso_imagem', 'aditivo_contratual', 'termo_rescisao', 'outro')),
  nome_outro      text,
  data_assinatura date NOT NULL CHECK (data_assinatura <= current_date),
  -- Path no bucket privado colaborador-documentos ("<colaborador_id>/<uuid>.pdf").
  arquivo_path    text NOT NULL UNIQUE,
  nome_arquivo    text NOT NULL,
  enviado_por     uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL DEFAULT auth.uid(),
  created_at      timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT colaborador_documentos_nome_outro_check CHECK (
    tipo <> 'outro' OR nullif(btrim(nome_outro), '') IS NOT NULL
  )
);

COMMENT ON TABLE public.colaborador_documentos IS
  'PDFs de documentos já assinados pelo colaborador, enviados pelo RH. Leitura: canViewColaboradores, canManageColaboradores ou o próprio colaborador; escrita: canManageColaboradores.';

CREATE INDEX IF NOT EXISTS colaborador_documentos_colaborador_id_idx
  ON public.colaborador_documentos(colaborador_id, data_assinatura DESC);

-- ─── 2. RLS da tabela ───────────────────────────────────────────────────────────

ALTER TABLE public.colaborador_documentos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS colaborador_documentos_select ON public.colaborador_documentos;
CREATE POLICY colaborador_documentos_select ON public.colaborador_documentos
  FOR SELECT TO authenticated
  USING (
    public.current_user_has_permission('canViewColaboradores')
    OR public.current_user_has_permission('canManageColaboradores')
    OR colaborador_id IN (SELECT c.id FROM public.colaboradores c WHERE c.user_profile_id = auth.uid())
  );

DROP POLICY IF EXISTS colaborador_documentos_insert ON public.colaborador_documentos;
CREATE POLICY colaborador_documentos_insert ON public.colaborador_documentos
  FOR INSERT TO authenticated
  WITH CHECK (public.current_user_has_permission('canManageColaboradores'));

DROP POLICY IF EXISTS colaborador_documentos_delete ON public.colaborador_documentos;
CREATE POLICY colaborador_documentos_delete ON public.colaborador_documentos
  FOR DELETE TO authenticated
  USING (public.current_user_has_permission('canManageColaboradores'));

-- ─── 3. Storage ─────────────────────────────────────────────────────────────────

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('colaborador-documentos', 'colaborador-documentos', false, 20971520, ARRAY['application/pdf'])
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "colaborador_documentos_storage_select" ON storage.objects;
CREATE POLICY "colaborador_documentos_storage_select"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'colaborador-documentos'
  AND (
    public.current_user_has_permission('canViewColaboradores')
    OR public.current_user_has_permission('canManageColaboradores')
    -- Compara como texto: uma pasta que não seja uuid não quebra a policy.
    OR EXISTS (
      SELECT 1 FROM public.colaboradores c
      WHERE c.user_profile_id = auth.uid()
        AND (storage.foldername(name))[1] = c.id::text
    )
  )
);

DROP POLICY IF EXISTS "colaborador_documentos_storage_insert" ON storage.objects;
CREATE POLICY "colaborador_documentos_storage_insert"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'colaborador-documentos' AND public.current_user_has_permission('canManageColaboradores'));

DROP POLICY IF EXISTS "colaborador_documentos_storage_delete" ON storage.objects;
CREATE POLICY "colaborador_documentos_storage_delete"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'colaborador-documentos' AND public.current_user_has_permission('canManageColaboradores'));
