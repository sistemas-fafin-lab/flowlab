-- ═══════════════════════════════════════════════════════════════════════════════
-- Controle de Custos — contração: o cadastro de tabela associada é a única
-- fonte da verdade
-- Migration: 20261022150000_custo_tabelas_associadas_contracao.sql
--
-- Spec: .scratch/controle-custos-tabela-associada/spec.md (ticket 07).
--
-- Último passo do expand–contract começado em 20261021170000. Com todo o
-- código lendo a tabela pelo id (tickets 02 e 04, e o 07 para a tela e o
-- payload da Admissão), o banco passa a garantir:
--   - nome de tabela único por fonte sem diferenciar maiúsculas nem espaços
--     nas pontas (índice custo_tabelas_associadas_fonte_nome_ci_key), e não
--     vazio — não nasce mais um "PART" ao lado de "Part";
--   - toda linha com tabela cadastrada (tabela_associada_id NOT NULL, já
--     desde 20261021170000 — reafirmado aqui);
--   - uma linha geral por (tabela, TUSS) e uma linha de exame por (tabela,
--     exame), no lugar da UNIQUE (fonte, texto, tuss, exame_id) — que, com
--     exame_id nulo, nem impedia duas linhas gerais do mesmo TUSS;
--   - o texto tabela_associada fica só como compatibilidade (scripts e
--     integrações antigas que gravam só o texto): é sempre a cópia do nome do
--     cadastro. Gravação com id: o id manda e o texto é copiado. Gravação só
--     com texto: o texto precisa ser de uma tabela JÁ cadastrada na fonte
--     (sem diferenciar maiúsculas) — não cria mais cadastro. Nenhum código lê
--     o texto.
--
-- Depende de 20261022140000 (coluna nome_exame_convenio).
--
-- IMPORTANTE: só aplicar DEPOIS da migração da unificação (ticket 06,
-- gerada por supabase/scripts/unificar-tabelas-associadas.ts). Em produção
-- (backup de 2026-10-21) a fonte Particular tem "Particular"/"PARTICULAR",
-- "part"/"PART" e uma tabela de nome vazio — a conferência abaixo aborta
-- listando o que ainda impede a contração. Se a migração da unificação for
-- gerada com um timestamp posterior a este arquivo, renomeie este arquivo
-- para um timestamp depois dela.
--
-- Conferência manual depois de aplicar (todas devem voltar vazias, menos a
-- primeira, que lista os índices novos):
--
--   SELECT indexname, indexdef FROM pg_indexes
--   WHERE indexname IN ('custo_tabelas_associadas_fonte_nome_ci_key',
--                       'custo_fontes_pagadoras_tabela_tuss_key',
--                       'custo_fontes_pagadoras_tabela_exame_key');
--
--   -- texto divergente do cadastro
--   SELECT f.id FROM custo_fontes_pagadoras f
--   JOIN custo_tabelas_associadas t ON t.id = f.tabela_associada_id
--   WHERE f.tabela_associada <> t.nome OR f.fonte_pagadora <> t.fonte_pagadora;
--
--   -- em transação + ROLLBACK, cada uma deve falhar:
--   INSERT INTO custo_tabelas_associadas (fonte_pagadora, nome) VALUES ('Particular', ' PARTICULAR ');  -- 23505
--   INSERT INTO custo_tabelas_associadas (fonte_pagadora, nome) VALUES ('Particular', '  ');           -- 23514
--   INSERT INTO custo_fontes_pagadoras (fonte_pagadora, tabela_associada, tuss, valor)
--     VALUES ('Particular', 'Tabela que não existe', '40601129', 1);                                    -- 23503
--   UPDATE custo_fontes_pagadoras SET tabela_associada = 'Outra tabela'
--     WHERE id = (SELECT id FROM custo_fontes_pagadoras LIMIT 1);                                       -- 23514
--   INSERT INTO custo_fontes_pagadoras (fonte_pagadora, tabela_associada_id, tuss, valor)
--     SELECT fonte_pagadora, tabela_associada_id, tuss, valor FROM custo_fontes_pagadoras
--     WHERE exame_id IS NULL AND nome_exame_convenio IS NULL LIMIT 1;                                                                  -- 23505
-- ═══════════════════════════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════════════════════════════════════════
-- 0. CONFERÊNCIA — aborta antes de mexer em qualquer coisa
-- ═══════════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  problemas TEXT;
BEGIN
  SELECT string_agg(item, E'\n') INTO problemas FROM (
    SELECT format('  - fonte "%s": tabelas %s têm o mesmo nome', fonte_pagadora,
                  string_agg(format('"%s"', nome), ', ' ORDER BY nome)) AS item
    FROM public.custo_tabelas_associadas
    GROUP BY fonte_pagadora, lower(btrim(nome))
    HAVING count(*) > 1
    UNION ALL
    SELECT format('  - fonte "%s": tabela de nome vazio (id %s)', fonte_pagadora, id)
    FROM public.custo_tabelas_associadas
    WHERE btrim(nome) = ''
    UNION ALL
    SELECT format('  - %s linha(s) sem tabela cadastrada', count(*))
    FROM public.custo_fontes_pagadoras
    WHERE tabela_associada_id IS NULL
    HAVING count(*) > 0
    UNION ALL
    SELECT format('  - tabela %s: %s linhas gerais do TUSS "%s"', tabela_associada_id, count(*), btrim(tuss))
    FROM public.custo_fontes_pagadoras
    WHERE exame_id IS NULL AND nome_exame_convenio IS NULL
    GROUP BY tabela_associada_id, btrim(tuss)
    HAVING count(*) > 1
    UNION ALL
    SELECT format('  - tabela %s: %s linhas do exame %s', tabela_associada_id, count(*), exame_id)
    FROM public.custo_fontes_pagadoras
    WHERE exame_id IS NOT NULL
    GROUP BY tabela_associada_id, exame_id
    HAVING count(*) > 1
  ) p;

  IF problemas IS NOT NULL THEN
    RAISE EXCEPTION E'Contração das tabelas associadas abortada — aplique antes a unificação (ticket 06):\n%', problemas;
  END IF;
END $$;

-- ═══════════════════════════════════════════════════════════════════════════════
-- 1. CADASTRO: nome preenchido e único por fonte sem diferenciar maiúsculas
-- ═══════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.custo_tabelas_associadas
  DROP CONSTRAINT IF EXISTS custo_tabelas_associadas_nome_preenchido;
ALTER TABLE public.custo_tabelas_associadas
  ADD CONSTRAINT custo_tabelas_associadas_nome_preenchido CHECK (btrim(nome) <> '');

ALTER TABLE public.custo_tabelas_associadas
  DROP CONSTRAINT IF EXISTS custo_tabelas_associadas_fonte_nome_key;

CREATE UNIQUE INDEX IF NOT EXISTS custo_tabelas_associadas_fonte_nome_ci_key
  ON public.custo_tabelas_associadas (fonte_pagadora, lower(btrim(nome)));

-- Regras de 20261021190000, agora também no INSERT: o nome é gravado sem
-- espaços nas pontas e o repetido sai com mensagem que diz qual tabela já
-- existe. O índice acima é a garantia (inclusive na corrida entre sessões);
-- a checagem aqui só dá a mensagem.
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

  IF TG_OP = 'UPDATE' THEN
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
  END IF;

  IF TG_OP = 'INSERT' OR NEW.nome IS DISTINCT FROM OLD.nome THEN
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
  BEFORE INSERT OR UPDATE OR DELETE ON public.custo_tabelas_associadas
  FOR EACH ROW EXECUTE FUNCTION public.custo_tabelas_associadas_regras();

COMMENT ON FUNCTION public.custo_tabela_associada_eh_particular(TEXT, TEXT) IS 'Tabela Particular da fonte Particular — a que o Gerador de Orçamento lê pelo nome. Protegida contra renomear, desativar e excluir. Com a unicidade sem diferenciar maiúsculas (20261022150000), é uma só.';

-- ═══════════════════════════════════════════════════════════════════════════════
-- 2. LINHAS: tabela obrigatória e unicidade pelo id da tabela
-- ═══════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.custo_fontes_pagadoras
  ALTER COLUMN tabela_associada_id SET NOT NULL;

ALTER TABLE public.custo_fontes_pagadoras
  DROP CONSTRAINT IF EXISTS custo_fontes_pagadoras_fonte_tabela_tuss_exame_key;

-- Mesma chave de "mesma linha" da tela e da unificação (chaveDaLinha em
-- src/components/CostControl/domain/unificacaoTabelas.ts). Só linhas gerais:
-- as não levantadas da importação (nome_exame_convenio, 20261022140000)
-- podem repetir o TUSS e têm a própria unicidade.
CREATE UNIQUE INDEX IF NOT EXISTS custo_fontes_pagadoras_tabela_tuss_key
  ON public.custo_fontes_pagadoras (tabela_associada_id, btrim(tuss))
  WHERE exame_id IS NULL AND nome_exame_convenio IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS custo_fontes_pagadoras_tabela_exame_key
  ON public.custo_fontes_pagadoras (tabela_associada_id, exame_id)
  WHERE exame_id IS NOT NULL;

-- ═══════════════════════════════════════════════════════════════════════════════
-- 3. SINCRONIA: o cadastro manda, o texto é só cópia
--
-- Substitui a de 20261021190000. Com id (sempre, fora o insert de gravador
-- antigo que manda só o texto), o texto é copiado do cadastro. Um update que
-- troca só o texto para o de outra tabela é recusado — a linha não muda de
-- tabela pelo texto, e o gravador antigo fica sabendo em vez de ver o texto
-- desfeito em silêncio. Sem id, o texto precisa casar com uma tabela já
-- cadastrada da fonte, sem diferenciar maiúsculas/espaços; não casa → erro,
-- sem criar cadastro.
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.custo_fontes_pagadoras_sincroniza_tabela_associada()
RETURNS TRIGGER AS $$
DECLARE
  cadastro public.custo_tabelas_associadas%ROWTYPE;
BEGIN
  IF NEW.tabela_associada_id IS NOT NULL THEN
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

    IF TG_OP = 'UPDATE'
       AND NEW.tabela_associada_id = OLD.tabela_associada_id
       AND NEW.tabela_associada IS DISTINCT FROM OLD.tabela_associada
       AND lower(btrim(NEW.tabela_associada)) IS DISTINCT FROM lower(btrim(cadastro.nome)) THEN
      RAISE EXCEPTION 'A tabela associada da linha se troca pelo id (tabela_associada_id), não pelo texto "%".', NEW.tabela_associada
        USING ERRCODE = '23514';
    END IF;
  ELSE
    -- Gravador antigo, só com o texto: compatibilidade, sem criar cadastro.
    SELECT * INTO cadastro
    FROM public.custo_tabelas_associadas
    WHERE fonte_pagadora = NEW.fonte_pagadora
      AND lower(btrim(nome)) = lower(btrim(NEW.tabela_associada));

    IF NOT FOUND THEN
      RAISE EXCEPTION 'A tabela associada "%" não está cadastrada na fonte pagadora "%". Cadastre-a em Fontes Pagadoras → Tabelas desta fonte.',
        NEW.tabela_associada, NEW.fonte_pagadora
        USING ERRCODE = '23503';
    END IF;

    NEW.tabela_associada_id := cadastro.id;
  END IF;

  NEW.tabela_associada := cadastro.nome;

  IF NOT cadastro.ativa
     AND (TG_OP = 'INSERT' OR NEW.tabela_associada_id IS DISTINCT FROM OLD.tabela_associada_id) THEN
    RAISE EXCEPTION 'A tabela associada "%" está inativa e não recebe linhas novas.', cadastro.nome
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Se alguma linha ficou com texto defasado, volta a ser a cópia do cadastro
-- (o trigger acima copia o nome; o id não muda).
UPDATE public.custo_fontes_pagadoras f
SET tabela_associada = t.nome
FROM public.custo_tabelas_associadas t
WHERE t.id = f.tabela_associada_id
  AND f.tabela_associada IS DISTINCT FROM t.nome;

COMMENT ON COLUMN public.custo_fontes_pagadoras.tabela_associada IS 'Compatibilidade: cópia do nome do cadastro (custo_tabelas_associadas), mantida pelo trigger custo_fontes_pagadoras_sincroniza_tabela_associada. Nenhum código lê — use tabela_associada_id.';
COMMENT ON COLUMN public.custo_fontes_pagadoras.tabela_associada_id IS 'Cadastro da tabela associada (custo_tabelas_associadas) — a fonte da verdade. Uma linha geral por (tabela, TUSS) e uma linha de exame por (tabela, exame).';
