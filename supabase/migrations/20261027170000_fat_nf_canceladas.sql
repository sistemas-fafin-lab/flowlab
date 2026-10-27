-- ═══════════════════════════════════════════════════════════════════════════════
-- Contas a Receber: histórico de NFs canceladas do título
-- (.scratch/faturamento-nf-cancelada, issue 01).
--
-- "NF cancelada" é a NF emitida e depois cancelada no portal da prefeitura,
-- fora do apLIS — diferente de título cancelado (notas.status = 'cancelada').
-- Ao trocar o número de nota de um título, o operador diz se a NF anterior foi
-- cancelada (com motivo) ou se foi só correção de digitação; no primeiro caso
-- a NF anterior entra em fat_nfs_canceladas na mesma transação da troca.
--
-- Substitui a fat_atualizar_numero_nota de
-- 20260930180000_fat_atualizar_numero_nota_somente_se_vazio.sql. DROP + CREATE
-- pelo mesmo motivo de lá: a assinatura nova criaria um overload, e o
-- PostgREST recusaria por ambiguidade a chamada de 3 argumentos. Os parâmetros
-- novos têm default, então a chamada de sempre (edição comum e "Atualizar do
-- apLIS" com p_somente_se_vazio) continua igual. Aplicar antes do deploy do
-- código.
--
-- Depende de 20260807130000_contas_receber_rpcs.sql (fat_exigir_permissao_gestao).
-- ═══════════════════════════════════════════════════════════════════════════════

-- ─── Tabela ─────────────────────────────────────────────────────────────────
-- Append-only, como notas_lancamentos_audit_logs. nota_id é opcional: as NFs
-- importadas da planilha sem título candidato único ficam ligadas só à
-- operadora (issue 04), e apagar um título não pode apagar o histórico.
CREATE TABLE IF NOT EXISTS fat_nfs_canceladas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nota_id UUID REFERENCES notas(id_nota) ON DELETE SET NULL,
  operadora_id UUID NOT NULL REFERENCES operadoras(id_operadora),
  numero_nota TEXT NOT NULL CHECK (TRIM(numero_nota) <> ''),
  valor DECIMAL(15, 2),
  data_emissao DATE,
  data_cancelamento DATE NOT NULL,
  motivo TEXT NOT NULL CHECK (TRIM(motivo) <> ''),
  origem TEXT NOT NULL CHECK (origem IN ('edicao', 'planilha')),
  registrado_por UUID,
  registrado_por_nome TEXT NOT NULL,
  registrado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- A mesma NF não é cancelada duas vezes.
  CONSTRAINT fat_nfs_canceladas_operadora_numero_key UNIQUE (operadora_id, numero_nota)
);

-- A busca da lista de títulos procura pelo número sem saber a operadora.
CREATE INDEX IF NOT EXISTS idx_fat_nfs_canceladas_numero ON fat_nfs_canceladas(numero_nota);
CREATE INDEX IF NOT EXISTS idx_fat_nfs_canceladas_nota
  ON fat_nfs_canceladas(nota_id, data_cancelamento DESC);

ALTER TABLE fat_nfs_canceladas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "fat_nfs_canceladas_select_billing" ON fat_nfs_canceladas;

CREATE POLICY "fat_nfs_canceladas_select_billing" ON fat_nfs_canceladas
  FOR SELECT TO authenticated
  USING (public.current_user_has_permission('canViewBilling')
      OR public.current_user_has_permission('canManageBilling'));

-- Sem policy de INSERT/UPDATE/DELETE: a escrita é só por RPC SECURITY DEFINER
-- (fat_atualizar_numero_nota abaixo e a importação da planilha).

COMMENT ON TABLE fat_nfs_canceladas IS
  'Histórico append-only das NFs canceladas fora do apLIS (portal da prefeitura). Não confundir com título cancelado (notas.status).';

-- ─── RPC ────────────────────────────────────────────────────────────────────

DROP FUNCTION IF EXISTS public.fat_atualizar_numero_nota(UUID, TEXT, BOOLEAN);

CREATE FUNCTION public.fat_atualizar_numero_nota(
  p_id_nota UUID,
  p_numero_nota TEXT,
  p_somente_se_vazio BOOLEAN DEFAULT FALSE,
  p_nf_anterior_cancelada BOOLEAN DEFAULT FALSE,
  p_motivo_cancelamento TEXT DEFAULT NULL,
  p_data_cancelamento DATE DEFAULT NULL
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_titulo RECORD;
  v_numero TEXT;
  v_anterior TEXT;
  v_motivo TEXT;
  v_user_id UUID := auth.uid();
  v_user_name TEXT;
BEGIN
  PERFORM fat_exigir_permissao_gestao();

  -- Nunca apaga um número já salvo: só substitui por outro valor não vazio.
  v_numero := NULLIF(TRIM(p_numero_nota), '');
  IF v_numero IS NULL THEN
    RAISE EXCEPTION 'Informe o número da nota.';
  END IF;

  IF COALESCE(p_nf_anterior_cancelada, FALSE) AND COALESCE(p_somente_se_vazio, FALSE) THEN
    RAISE EXCEPTION 'NF anterior cancelada não combina com o preenchimento só se vazio.';
  END IF;

  -- FOR UPDATE: no modo de cancelamento, o número lido aqui é o que vai para o
  -- histórico; uma troca em paralelo não pode registrar a NF errada.
  SELECT status, numero_nota, operadora_id, valor_total, data_emissao
    INTO v_titulo
    FROM notas
   WHERE id_nota = p_id_nota
     FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Título não encontrado.';
  END IF;
  IF v_titulo.status = 'cancelada' THEN
    RAISE EXCEPTION 'Título cancelado não aceita edição do número da nota.';
  END IF;

  IF COALESCE(p_nf_anterior_cancelada, FALSE) THEN
    v_anterior := NULLIF(TRIM(v_titulo.numero_nota), '');
    IF v_anterior IS NULL THEN
      RAISE EXCEPTION 'O título ainda não tem número de nota para cancelar.';
    END IF;
    IF v_anterior = v_numero THEN
      RAISE EXCEPTION 'O número novo é igual ao atual.';
    END IF;
    IF EXISTS (
      SELECT 1 FROM fat_nfs_canceladas
       WHERE nota_id = p_id_nota AND numero_nota = v_numero
    ) THEN
      RAISE EXCEPTION 'A NF % já foi cancelada neste título.', v_numero;
    END IF;
    v_motivo := NULLIF(TRIM(p_motivo_cancelamento), '');
    IF v_motivo IS NULL THEN
      RAISE EXCEPTION 'Informe o motivo do cancelamento da NF anterior.';
    END IF;
    IF EXISTS (
      SELECT 1 FROM fat_nfs_canceladas
       WHERE operadora_id = v_titulo.operadora_id AND numero_nota = v_anterior
    ) THEN
      RAISE EXCEPTION 'A NF % já está registrada como cancelada para esta operadora.', v_anterior;
    END IF;

    SELECT name INTO v_user_name FROM user_profiles WHERE id = v_user_id;
    INSERT INTO fat_nfs_canceladas
      (nota_id, operadora_id, numero_nota, valor, data_emissao, data_cancelamento,
       motivo, origem, registrado_por, registrado_por_nome)
    VALUES
      (p_id_nota, v_titulo.operadora_id, v_anterior, v_titulo.valor_total, v_titulo.data_emissao,
       COALESCE(p_data_cancelamento, CURRENT_DATE), v_motivo, 'edicao', v_user_id,
       COALESCE(v_user_name, 'Desconhecido'));
  END IF;

  -- updated_at fica a cargo do trigger_notas_updated_at (20260320_billing_module.sql).
  IF COALESCE(p_somente_se_vazio, FALSE) THEN
    -- Atômico: a condição de vazio fica no próprio UPDATE, sem ler-e-depois-
    -- gravar, para não sobrescrever um número digitado em paralelo na tela de
    -- edição. Número só com espaços conta como vazio.
    UPDATE notas
       SET numero_nota = v_numero
     WHERE id_nota = p_id_nota
       AND NULLIF(TRIM(numero_nota), '') IS NULL;
    IF NOT FOUND THEN
      RETURN 'ja-preenchido';
    END IF;
  ELSE
    UPDATE notas SET numero_nota = v_numero WHERE id_nota = p_id_nota;
  END IF;
  RETURN 'atualizado';
END;
$$;

COMMENT ON FUNCTION public.fat_atualizar_numero_nota(UUID, TEXT, BOOLEAN, BOOLEAN, TEXT, DATE) IS
  'Preenche ou corrige o número da nota de um título já existente. Rejeita valor vazio e título com status cancelada. '
  'Com p_somente_se_vazio, só grava se o título não tem número e retorna ''ja-preenchido'' caso contrário; senão retorna ''atualizado''. '
  'Com p_nf_anterior_cancelada, grava a NF anterior em fat_nfs_canceladas (motivo obrigatório; data padrão hoje) na mesma transação da troca.';

REVOKE ALL ON FUNCTION public.fat_atualizar_numero_nota(UUID, TEXT, BOOLEAN, BOOLEAN, TEXT, DATE) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fat_atualizar_numero_nota(UUID, TEXT, BOOLEAN, BOOLEAN, TEXT, DATE) TO authenticated;

-- ─── Roteiro de verificação ─────────────────────────────────────────────────
-- Rodar à mão no SQL editor, depois de aplicar. Tudo dentro de BEGIN … ROLLBACK:
-- nada fica gravado. Trocar <usuario> por um usuário com canManageBilling.
--
--   BEGIN;
--   SELECT set_config('request.jwt.claims', '{"sub":"<usuario>","role":"authenticated"}', true);
--
--   -- Dois títulos de teste da mesma operadora: um aberto com NF 'T-100' e um
--   -- cancelado. Entram antes do SET ROLE, como dono do banco.
--   INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, valor_total, status)
--   SELECT '00000000-0000-0000-0000-0000000000a1', id_operadora, 'T-100', DATE '2026-10-01', 150.00, 'aberta'
--     FROM operadoras LIMIT 1;
--   INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, valor_total, status)
--   SELECT '00000000-0000-0000-0000-0000000000a2', id_operadora, 'T-200', DATE '2026-10-01', 80.00, 'cancelada'
--     FROM operadoras LIMIT 1;
--   SET LOCAL ROLE authenticated;
--
--   DO $v$
--   DECLARE
--     a CONSTANT UUID := '00000000-0000-0000-0000-0000000000a1';
--     c CONSTANT UUID := '00000000-0000-0000-0000-0000000000a2';
--     recusou BOOLEAN;
--   BEGIN
--     -- 1. Título cancelado é recusado.
--     BEGIN
--       PERFORM fat_atualizar_numero_nota(c, 'T-201', FALSE, TRUE, 'teste', NULL);
--       recusou := FALSE;
--     EXCEPTION WHEN OTHERS THEN recusou := SQLERRM LIKE 'Título cancelado%';
--     END;
--     ASSERT recusou, 'título cancelado deveria ser recusado';
--
--     -- 2. Motivo vazio é recusado.
--     BEGIN
--       PERFORM fat_atualizar_numero_nota(a, 'T-101', FALSE, TRUE, '   ', NULL);
--       recusou := FALSE;
--     EXCEPTION WHEN OTHERS THEN recusou := SQLERRM LIKE 'Informe o motivo%';
--     END;
--     ASSERT recusou, 'motivo vazio deveria ser recusado';
--
--     -- 3. Número igual ao atual é recusado.
--     BEGIN
--       PERFORM fat_atualizar_numero_nota(a, 'T-100', FALSE, TRUE, 'teste', NULL);
--       recusou := FALSE;
--     EXCEPTION WHEN OTHERS THEN recusou := SQLERRM LIKE '%igual ao atual%';
--     END;
--     ASSERT recusou, 'número igual ao atual deveria ser recusado';
--
--     -- 4. Histórico e troca acontecem juntos.
--     ASSERT fat_atualizar_numero_nota(a, 'T-101', FALSE, TRUE, 'Convênio trocado', DATE '2026-10-20') = 'atualizado';
--     ASSERT (SELECT numero_nota FROM notas WHERE id_nota = a) = 'T-101', 'número novo não gravado';
--     ASSERT EXISTS (
--       SELECT 1 FROM fat_nfs_canceladas
--        WHERE nota_id = a AND numero_nota = 'T-100' AND motivo = 'Convênio trocado'
--          AND data_cancelamento = DATE '2026-10-20' AND valor = 150.00
--          AND data_emissao = DATE '2026-10-01' AND origem = 'edicao'
--     ), 'NF anterior não entrou no histórico';
--
--     -- 5. Número já cancelado no título é recusado (voltar para T-100).
--     BEGIN
--       PERFORM fat_atualizar_numero_nota(a, 'T-100', FALSE, TRUE, 'teste', NULL);
--       recusou := FALSE;
--     EXCEPTION WHEN OTHERS THEN recusou := SQLERRM LIKE '%já foi cancelada neste título%';
--     END;
--     ASSERT recusou, 'número já cancelado deveria ser recusado';
--
--     -- 6. Uma recusa não deixa meio caminho: nem troca, nem histórico.
--     ASSERT (SELECT numero_nota FROM notas WHERE id_nota = a) = 'T-101', 'recusa trocou o número';
--     ASSERT (SELECT COUNT(*) FROM fat_nfs_canceladas WHERE nota_id = a) = 1, 'recusa gravou histórico';
--
--     -- 7. Correção de digitação (sem a flag) troca sem histórico, como antes.
--     ASSERT fat_atualizar_numero_nota(a, 'T-102') = 'atualizado';
--     ASSERT (SELECT COUNT(*) FROM fat_nfs_canceladas WHERE nota_id = a) = 1, 'correção gravou histórico';
--
--     -- 8. somenteSeVazio segue igual: título preenchido não muda.
--     ASSERT fat_atualizar_numero_nota(a, 'T-999', TRUE) = 'ja-preenchido';
--
--     RAISE NOTICE 'fat_nfs_canceladas: roteiro OK';
--   END $v$;
--
--   ROLLBACK;
