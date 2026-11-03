-- ═══════════════════════════════════════════════════════════════════════════════
-- Módulo Qualidade — planos de contingência: editar e excluir
--
-- Editar já era coberto pela policy de UPDATE (20260831190000); o que muda é a
-- tela, que agora altera todos os campos e não só status/documento.
--
-- Excluir: quem tem canManageQualidade apaga o plano, e o histórico de testes
-- vai junto (ON DELETE CASCADE). Os testes continuam sem policy de DELETE
-- própria — só saem com o plano. Os triggers de auditoria passam a registrar
-- DELETE, então o conteúdo do plano e de cada teste fica em qa_auditoria.antes.
-- ═══════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ─── 1. DELETE do plano ─────────────────────────────────────────────────────

DROP POLICY IF EXISTS qa_planos_contingencia_delete ON qa_planos_contingencia;
CREATE POLICY "qa_planos_contingencia_delete" ON qa_planos_contingencia
  FOR DELETE TO authenticated
  USING (public.current_user_has_permission('canManageQualidade'));

-- ─── 2. Testes saem junto com o plano ───────────────────────────────────────

ALTER TABLE qa_testes_contingencia DROP CONSTRAINT IF EXISTS qa_testes_contingencia_plano_id_fkey;
ALTER TABLE qa_testes_contingencia
  ADD CONSTRAINT qa_testes_contingencia_plano_id_fkey
  FOREIGN KEY (plano_id) REFERENCES qa_planos_contingencia(id) ON DELETE CASCADE;

-- ─── 3. Auditoria também na exclusão ────────────────────────────────────────

DROP TRIGGER IF EXISTS trg_qa_planos_contingencia_auditoria ON qa_planos_contingencia;
CREATE TRIGGER trg_qa_planos_contingencia_auditoria
  AFTER INSERT OR UPDATE OR DELETE ON qa_planos_contingencia
  FOR EACH ROW
  EXECUTE FUNCTION qa_contingencia_modulo_auditoria_trigger();

DROP TRIGGER IF EXISTS trg_qa_testes_contingencia_auditoria ON qa_testes_contingencia;
CREATE TRIGGER trg_qa_testes_contingencia_auditoria
  AFTER INSERT OR DELETE ON qa_testes_contingencia
  FOR EACH ROW
  EXECUTE FUNCTION qa_contingencia_modulo_auditoria_trigger();

COMMIT;
