-- ═══════════════════════════════════════════════════════════════════════════════
-- Controle de Custos — gerenciar tabelas associadas: renomear, desativar,
-- excluir e proteção da Tabela Particular
-- Migration: 20261021190000_custo_tabelas_associadas_gerenciar.sql
--
-- Spec: .scratch/controle-custos-tabela-associada/spec.md (ticket 03).
--
-- Regras que valem para qualquer gravador (tela, scripts, SQL do painel):
--   - renomear propaga o nome para o texto tabela_associada de todas as
--     linhas da tabela (o texto continua cópia do cadastro); nome em branco
--     ou repetido na fonte (sem diferenciar maiúsculas/espaços nas pontas) é
--     recusado. Só no renomear: a unicidade sem diferenciar maiúsculas para
--     todos os cadastros fica para o ticket 07, depois da unificação;
--   - a tabela não troca de fonte pagadora — as linhas dela ficariam
--     apontando para a tabela de outra fonte;
--   - tabela inativa não recebe linhas novas (insert, ou linha movida para
--     ela); as linhas que já tem continuam valendo e editáveis;
--   - excluir só sem linhas: já garantido pela FK ON DELETE RESTRICT de
--     custo_fontes_pagadoras.tabela_associada_id (20261021170000);
--   - a Tabela Particular — fonte "Particular", nome "particular" sem
--     diferenciar maiúsculas, o mesmo critério do backend do orçamento
--     (api/_lib/orcamentoParticular.ts) — não pode ser renomeada, desativada
--     nem excluída. Enquanto a unificação não roda, "PARTICULAR" também
--     alimenta o orçamento e por isso também é protegida: a migração da
--     unificação (ticket 06) precisa desligar o trigger
--     trigger_custo_tabelas_associadas_regras enquanto junta as duas.
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.custo_tabela_associada_eh_particular(fonte TEXT, nome TEXT)
RETURNS BOOLEAN AS $$
  SELECT fonte = 'Particular' AND lower(btrim(nome)) = 'particular';
$$ LANGUAGE sql IMMUTABLE;

COMMENT ON FUNCTION public.custo_tabela_associada_eh_particular(TEXT, TEXT) IS 'Tabela Particular da fonte Particular — a que o Gerador de Orçamento lê pelo nome. Protegida contra renomear, desativar e excluir.';

-- ═══════════════════════════════════════════════════════════════════════════════
-- 1. REGRAS DO CADASTRO (antes de gravar)
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.custo_tabelas_associadas_regras()
RETURNS TRIGGER AS $$
DECLARE
  existente TEXT;
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF public.custo_tabela_associada_eh_particular(OLD.fonte_pagadora, OLD.nome) THEN
      RAISE EXCEPTION 'A tabela "%" da fonte Particular não pode ser excluída: o Gerador de Orçamento depende dela.', OLD.nome
        USING ERRCODE = '23514';
    END IF;
    RETURN OLD;
  END IF;

  IF public.custo_tabela_associada_eh_particular(OLD.fonte_pagadora, OLD.nome)
     AND (NEW.nome IS DISTINCT FROM OLD.nome
          OR NEW.fonte_pagadora IS DISTINCT FROM OLD.fonte_pagadora
          OR NOT NEW.ativa) THEN
    RAISE EXCEPTION 'A tabela "%" da fonte Particular não pode ser renomeada nem desativada: o Gerador de Orçamento depende dela.', OLD.nome
      USING ERRCODE = '23514';
  END IF;

  IF NEW.fonte_pagadora IS DISTINCT FROM OLD.fonte_pagadora THEN
    RAISE EXCEPTION 'A tabela associada "%" não pode trocar de fonte pagadora.', OLD.nome
      USING ERRCODE = '23514';
  END IF;

  IF NEW.nome IS DISTINCT FROM OLD.nome THEN
    NEW.nome := btrim(NEW.nome);
    IF NEW.nome = '' THEN
      RAISE EXCEPTION 'Informe o nome da tabela.' USING ERRCODE = '23514';
    END IF;
    SELECT t.nome INTO existente
    FROM public.custo_tabelas_associadas t
    WHERE t.fonte_pagadora = NEW.fonte_pagadora
      AND t.id <> NEW.id
      AND lower(btrim(t.nome)) = lower(NEW.nome)
    LIMIT 1;
    IF FOUND THEN
      RAISE EXCEPTION 'Já existe a tabela "%" nesta fonte pagadora.', existente
        USING ERRCODE = '23505';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_custo_tabelas_associadas_regras ON public.custo_tabelas_associadas;
CREATE TRIGGER trigger_custo_tabelas_associadas_regras
  BEFORE UPDATE OR DELETE ON public.custo_tabelas_associadas
  FOR EACH ROW EXECUTE FUNCTION public.custo_tabelas_associadas_regras();

-- ═══════════════════════════════════════════════════════════════════════════════
-- 2. RENOMEAR PROPAGA O NOME PARA AS LINHAS
--
-- Troca só o texto, mantendo o id: o trigger das linhas toma o caminho
-- texto → id e acha o próprio cadastro (já com o nome novo). Roda como o
-- usuário — quem renomeia tem canManageBilling, que também grava linhas.
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.custo_tabelas_associadas_propaga_nome()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.custo_fontes_pagadoras
  SET tabela_associada = NEW.nome
  WHERE tabela_associada_id = NEW.id
    AND tabela_associada IS DISTINCT FROM NEW.nome;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_custo_tabelas_associadas_propaga_nome ON public.custo_tabelas_associadas;
CREATE TRIGGER trigger_custo_tabelas_associadas_propaga_nome
  AFTER UPDATE OF nome ON public.custo_tabelas_associadas
  FOR EACH ROW
  WHEN (NEW.nome IS DISTINCT FROM OLD.nome)
  EXECUTE FUNCTION public.custo_tabelas_associadas_propaga_nome();

-- ═══════════════════════════════════════════════════════════════════════════════
-- 3. TABELA INATIVA NÃO RECEBE LINHAS NOVAS
--
-- Mesma sincronia de 20261021180000, mais a recusa de linha nova (insert, ou
-- linha que passa a apontar para outra tabela) numa tabela inativa.
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.custo_fontes_pagadoras_sincroniza_tabela_associada()
RETURNS TRIGGER AS $$
DECLARE
  cadastro public.custo_tabelas_associadas%ROWTYPE;
BEGIN
  IF NEW.tabela_associada_id IS NOT NULL
     AND (TG_OP = 'INSERT'
          OR NEW.tabela_associada_id IS DISTINCT FROM OLD.tabela_associada_id
          OR (NEW.tabela_associada IS NOT DISTINCT FROM OLD.tabela_associada
              AND NEW.fonte_pagadora IS NOT DISTINCT FROM OLD.fonte_pagadora)) THEN
    SELECT * INTO cadastro
    FROM public.custo_tabelas_associadas
    WHERE id = NEW.tabela_associada_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Tabela associada % não existe.', NEW.tabela_associada_id
        USING ERRCODE = '23503';
    END IF;

    IF cadastro.fonte_pagadora IS DISTINCT FROM NEW.fonte_pagadora THEN
      RAISE EXCEPTION 'A tabela associada "%" é da fonte pagadora "%", não de "%".',
        cadastro.nome, cadastro.fonte_pagadora, NEW.fonte_pagadora
        USING ERRCODE = '23514';
    END IF;

    NEW.tabela_associada := cadastro.nome;
  ELSE
    -- Gravador legado: o texto manda (comportamento de 20261021170000).
    INSERT INTO public.custo_tabelas_associadas (fonte_pagadora, nome)
    VALUES (NEW.fonte_pagadora, NEW.tabela_associada)
    ON CONFLICT (fonte_pagadora, nome) DO NOTHING;

    SELECT * INTO cadastro
    FROM public.custo_tabelas_associadas
    WHERE fonte_pagadora = NEW.fonte_pagadora
      AND nome = NEW.tabela_associada;

    NEW.tabela_associada_id := cadastro.id;
  END IF;

  IF NOT cadastro.ativa
     AND (TG_OP = 'INSERT' OR NEW.tabela_associada_id IS DISTINCT FROM OLD.tabela_associada_id) THEN
    RAISE EXCEPTION 'A tabela associada "%" está inativa e não recebe linhas novas.', cadastro.nome
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
