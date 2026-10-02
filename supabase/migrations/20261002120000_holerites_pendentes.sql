-- ═══════════════════════════════════════════════════════════════════════════════
-- RH — Holerites: guarda holerites de CPF sem colaborador cadastrado
-- Migration: 20261002120000_holerites_pendentes.sql
--
-- Antes: no upload consolidado, o bloco cujo CPF não casava com nenhum
-- colaborador era só reportado ("cpfsNaoCasados") e descartado junto com o PDF
-- temporário — se o colaborador fosse cadastrado depois, o RH tinha que
-- reenviar o PDF da competência.
--
-- Agora: o handler de confirmação (api/_lib/handlers/rh-holerites-confirmar.ts)
-- fatia esses blocos e grava em `holerites_pendentes` (chave CPF+competência),
-- com o PDF no mesmo bucket privado em "_pendentes/<cpf>/<AAAA-MM>.pdf". Quando
-- um colaborador com aquele CPF é cadastrado (ou tem o CPF corrigido), o
-- trigger abaixo move os pendentes para `colaborador_holerites` — o arquivo não
-- muda de lugar, só passa a ser referenciado pelo `arquivo_path` do holerite.
--
-- Como o arquivo vinculado continua fora da pasta "<colaborador_id>/", as
-- policies de leitura de storage do próprio colaborador e da equipe passam a
-- checar o `arquivo_path` do holerite em vez da primeira pasta do path.
-- ═══════════════════════════════════════════════════════════════════════════════

DO $$
BEGIN
  IF to_regprocedure('public.current_user_has_permission(text)') IS NULL THEN
    RAISE EXCEPTION 'Função public.current_user_has_permission(text) não existe. Aplique 20260618010000_ensure_admin_update_policy.sql antes desta migration.';
  END IF;
  IF to_regclass('public.colaborador_holerites') IS NULL THEN
    RAISE EXCEPTION 'Tabela public.colaborador_holerites não existe. Aplique 20260916120000_rh_holerites.sql antes desta migration.';
  END IF;
END $$;

-- ═══════════════════════════════════════════════════════════════════════════════
-- 1. TABELA
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.holerites_pendentes (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Só dígitos (11) — mesmo formato de normalizarCpf() no parsing.
  cpf           text NOT NULL CHECK (cpf ~ '^[0-9]{11}$'),
  -- Sempre dia 1 do mês, como colaborador_holerites.competencia.
  competencia   date NOT NULL,
  arquivo_path  text NOT NULL,
  uploaded_by   uuid NOT NULL REFERENCES public.user_profiles(id),
  created_at    timestamptz NOT NULL DEFAULT now(),

  -- Reenvio da mesma competência para o mesmo CPF substitui o pendente anterior.
  CONSTRAINT holerites_pendentes_cpf_competencia_key UNIQUE (cpf, competencia)
);

COMMENT ON TABLE public.holerites_pendentes IS 'Holerites fatiados do PDF consolidado cujo CPF ainda não tem colaborador cadastrado. Movidos para colaborador_holerites pelo trigger colaboradores_vincular_holerites_pendentes quando o colaborador é cadastrado.';

ALTER TABLE public.holerites_pendentes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS holerites_pendentes_manage ON public.holerites_pendentes;
CREATE POLICY holerites_pendentes_manage ON public.holerites_pendentes
  FOR ALL TO authenticated
  USING (public.current_user_has_permission('canManageHolerites'))
  WITH CHECK (public.current_user_has_permission('canManageHolerites'));

-- ═══════════════════════════════════════════════════════════════════════════════
-- 2. VÍNCULO AUTOMÁTICO — ao cadastrar colaborador ou alterar o CPF dele.
-- SECURITY DEFINER: quem cadastra colaborador (canManageColaboradores, backfill
-- de user_profiles) não precisa ter canManageHolerites para o vínculo acontecer.
-- Se já existir holerite da mesma competência para o colaborador, fica o mais
-- recente (created_at); o pendente é removido de qualquer forma.
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.vincular_holerites_pendentes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cpf text := regexp_replace(coalesce(NEW.cpf, ''), '[^0-9]', '', 'g');
BEGIN
  IF length(v_cpf) <> 11 THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.colaborador_holerites (colaborador_id, competencia, arquivo_path, uploaded_by, created_at)
  SELECT NEW.id, p.competencia, p.arquivo_path, p.uploaded_by, p.created_at
  FROM public.holerites_pendentes p
  WHERE p.cpf = v_cpf
  ON CONFLICT (colaborador_id, competencia) DO UPDATE
    SET arquivo_path = EXCLUDED.arquivo_path,
        uploaded_by  = EXCLUDED.uploaded_by,
        created_at   = EXCLUDED.created_at
    WHERE public.colaborador_holerites.created_at < EXCLUDED.created_at;

  DELETE FROM public.holerites_pendentes WHERE cpf = v_cpf;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.vincular_holerites_pendentes() IS 'Trigger em colaboradores: move holerites_pendentes do CPF do colaborador para colaborador_holerites (ver 20261002120000).';

REVOKE ALL ON FUNCTION public.vincular_holerites_pendentes() FROM PUBLIC;

DROP TRIGGER IF EXISTS colaboradores_vincular_holerites_pendentes ON public.colaboradores;
CREATE TRIGGER colaboradores_vincular_holerites_pendentes
  AFTER INSERT OR UPDATE OF cpf ON public.colaboradores
  FOR EACH ROW
  EXECUTE FUNCTION public.vincular_holerites_pendentes();

-- ═══════════════════════════════════════════════════════════════════════════════
-- 3. STORAGE — leitura do próprio colaborador e da equipe passa a seguir o
-- `arquivo_path` do holerite: quem enxerga a linha em colaborador_holerites
-- (pelas policies dela — própria ou de subordinado) pode gerar a signed URL do
-- arquivo, esteja ele em "<colaborador_id>/" ou em "_pendentes/<cpf>/".
-- Substitui as duas policies por pasta, o que também elimina o cast
-- `foldername(name)[1]::uuid` da policy de equipe (quebraria em "_pendentes").
-- Pendentes ainda não vinculados ficam visíveis só para canManageHolerites e
-- canViewAllHolerites (policies que já cobrem o bucket inteiro).
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS colaborador_holerites_arquivo_path_idx ON public.colaborador_holerites(arquivo_path);

DROP POLICY IF EXISTS "colaborador_holerites_storage_select_own" ON storage.objects;
DROP POLICY IF EXISTS "colaborador_holerites_storage_select_equipe" ON storage.objects;

DROP POLICY IF EXISTS "colaborador_holerites_storage_select_por_holerite" ON storage.objects;
CREATE POLICY "colaborador_holerites_storage_select_por_holerite"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'colaborador-holerites'
  AND EXISTS (
    SELECT 1 FROM public.colaborador_holerites h
    WHERE h.arquivo_path = storage.objects.name
  )
);
