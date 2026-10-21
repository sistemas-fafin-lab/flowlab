-- ═══════════════════════════════════════════════════════════════════════════════
-- Controle de Custos — linha de preço grava a tabela associada pelo id
-- Migration: 20261021180000_custo_tabelas_associadas_id_manda.sql
--
-- Spec: .scratch/controle-custos-tabela-associada/spec.md (ticket 02).
--
-- Até aqui (20261021170000) o texto tabela_associada mandava: o trigger achava
-- (ou criava) o cadastro do texto e preenchia tabela_associada_id. Com a
-- tabela escolhida da lista na importação e no modal de linha, a tela passa a
-- gravar tabela_associada_id — então o sentido se inverte:
--   - id informado (insert; update que troca o id; ou update que não mexe
--     no texto nem na fonte — a tela manda só o id): o cadastro manda. O
--     texto é copiado do nome do cadastro e a fonte da linha precisa ser a
--     mesma do cadastro (senão a linha apontaria pra tabela de outra fonte);
--   - sem id, ou update que troca o texto/fonte mantendo o id: gravador
--     legado (scripts, integrações) — continua como antes, texto → id
--     criando o cadastro.
-- Assim id e texto seguem sem divergir em qualquer gravação.
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
    RETURN NEW;
  END IF;

  -- Gravador legado: o texto manda (comportamento de 20261021170000).
  INSERT INTO public.custo_tabelas_associadas (fonte_pagadora, nome)
  VALUES (NEW.fonte_pagadora, NEW.tabela_associada)
  ON CONFLICT (fonte_pagadora, nome) DO NOTHING;

  SELECT id INTO NEW.tabela_associada_id
  FROM public.custo_tabelas_associadas
  WHERE fonte_pagadora = NEW.fonte_pagadora
    AND nome = NEW.tabela_associada;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON COLUMN public.custo_fontes_pagadoras.tabela_associada_id IS 'Cadastro da tabela associada (custo_tabelas_associadas). Quando a gravação informa o id, ele manda e o texto tabela_associada é copiado do cadastro; gravações só com texto continuam achando/criando o cadastro (trigger custo_fontes_pagadoras_sincroniza_tabela_associada).';
