-- ═══════════════════════════════════════════════════════════════════════════════
-- Gastos de TI — bucket privado de anexos
-- Migration: 20261009150000_gastos_ti_anexos.sql
-- (.scratch/gastos-ti/issues/05-despesa-anexos.md)
--
-- Plano: docs/plans/gastos-ti/PLANO_GASTOS_TI.md §4.2 (storage), RF09, RNF01.
-- Mesmo desenho do bucket de holerites (20260916120000_rh_holerites.sql §3):
-- privado, download só por signed URL de curta duração, policies de
-- storage.objects espelhando as das tabelas do módulo.
--
-- Caminhos: "despesas/<despesa_id>/<uuid>-<nome>" (contrato, proposta, e-mail
-- de autorização) e, a partir da issue 06, "lancamentos/<lancamento_id>/..."
-- (comprovante, NF). A lista de arquivos de cada registro fica na coluna
-- jsonb `anexos` da própria tabela.
-- ═══════════════════════════════════════════════════════════════════════════════

DO $$
BEGIN
  IF to_regprocedure('public.current_user_has_permission(text)') IS NULL THEN
    RAISE EXCEPTION 'Função public.current_user_has_permission(text) não existe. Aplique 20260618010000_ensure_admin_update_policy.sql antes desta migration.';
  END IF;
END $$;

-- 10 MB, PDF/PNG/JPEG (mesmos limites do bucket request-attachments).
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('ti-gastos-anexos', 'ti-gastos-anexos', false, 10485760, ARRAY['application/pdf', 'image/png', 'image/jpeg'])
ON CONFLICT (id) DO NOTHING;

-- Leitura (gerar signed URL) para quem vê ou gerencia o módulo.
DROP POLICY IF EXISTS "ti_gastos_anexos_select" ON storage.objects;
CREATE POLICY "ti_gastos_anexos_select"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'ti-gastos-anexos'
  AND (
    public.current_user_has_permission('canViewGastosTI')
    OR public.current_user_has_permission('canManageGastosTI')
  )
);

-- Enviar, substituir e remover só para quem gerencia.
DROP POLICY IF EXISTS "ti_gastos_anexos_insert" ON storage.objects;
CREATE POLICY "ti_gastos_anexos_insert"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'ti-gastos-anexos' AND public.current_user_has_permission('canManageGastosTI'));

DROP POLICY IF EXISTS "ti_gastos_anexos_update" ON storage.objects;
CREATE POLICY "ti_gastos_anexos_update"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'ti-gastos-anexos' AND public.current_user_has_permission('canManageGastosTI'))
WITH CHECK (bucket_id = 'ti-gastos-anexos' AND public.current_user_has_permission('canManageGastosTI'));

DROP POLICY IF EXISTS "ti_gastos_anexos_delete" ON storage.objects;
CREATE POLICY "ti_gastos_anexos_delete"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'ti-gastos-anexos' AND public.current_user_has_permission('canManageGastosTI'));
