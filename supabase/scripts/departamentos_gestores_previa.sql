-- ═══════════════════════════════════════════════════════════════════════════════
-- Prévia da carga 20261023120100_departamentos_gestores_carga.sql — SÓ LEITURA
--
-- Rode no SQL Editor do projeto do app ANTES de aplicar as migrations. Uma linha por
-- departamento e papel (gestor que autoriza pagamentos / aprovador de SC). A carga só
-- passa se, em todas as linhas:
--   • departamento_existe = true;
--   • colaboradores_ativos_com_o_nome = 1 (0: nome diferente do cadastro; 2+: homônimos);
-- e, nas linhas de gestor, tem_login e usuario_ativo = true e cargo preenchido (a carga
-- dá "Ser Autorizador de Pagamentos" ao cargo; sem cargo, a pessoa não autoriza).
-- Nome comparado sem maiúsculas, acentos nem espaços repetidos, como na carga.
-- ═══════════════════════════════════════════════════════════════════════════════

WITH carga(departamento, gestor, aprovador) AS (
  VALUES
    ('Área técnica',       'Paulo Vítor',               'Paulo Vítor'),
    ('Atendimento',        'Louise Fontel',             'Louise Fontel'),
    ('Biologia Molecular', 'Paulo Vítor',               'Paulo Vítor'),
    ('Comercial',          'Cristiane Madeiro',         'Cristiane Madeiro'),
    ('Copa/Limpeza',       'Suane Batista De Oliveira', 'Suane Batista De Oliveira'),
    ('Diretoria',          'Mario Gorini',              'Mario Gorini'),
    ('Equipe Médica',      'Paulo Vítor',               'Paulo Vítor'),
    ('Estoque',            'Louise Fontel',             'Louise Fontel'),
    ('Faturamento',        'Raquel Dos Santos Avelino', 'Louise Fontel'),
    ('Financeiro',         'Louise Fontel',             'Louise Fontel'),
    ('Qualidade',          'Eduarda Silva Fabri',       'Eduarda Silva Fabri'),
    ('RH',                 'Suane Batista De Oliveira', 'Suane Batista De Oliveira'),
    ('TI',                 'Gabriel Queiroz de Souza',  'Gabriel Queiroz de Souza'),
    ('Transporte',         'Lucas Moreira',             'Louise Fontel')
),
linhas AS (
  SELECT departamento, 'gestor' AS papel, gestor AS nome FROM carga
  UNION ALL
  SELECT departamento, 'aprovador de SC', aprovador FROM carga
),
chave AS (
  SELECT l.*,
         regexp_replace(translate(lower(btrim(l.nome)), 'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc'), '\s+', ' ', 'g') AS nome_chave,
         regexp_replace(translate(lower(btrim(l.departamento)), 'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc'), '\s+', ' ', 'g') AS departamento_chave
    FROM linhas l
)
SELECT k.departamento,
       k.papel,
       k.nome,
       EXISTS (
         SELECT 1 FROM departamentos d
          WHERE regexp_replace(translate(lower(btrim(d.nome)), 'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc'), '\s+', ' ', 'g') = k.departamento_chave
       ) AS departamento_existe,
       count(c.id) AS colaboradores_ativos_com_o_nome,
       string_agg(c.nome, ' | ') AS nome_no_cadastro,
       bool_or(c.user_profile_id IS NOT NULL) AS tem_login,
       bool_or(p.id IS NOT NULL AND p.deleted_at IS NULL AND p.disabled_at IS NULL) AS usuario_ativo,
       string_agg(DISTINCT cr.name, ' | ') AS cargo,
       bool_or(COALESCE(cr.permissions ? 'canAuthorizePayments', false)) AS cargo_ja_autoriza
  FROM chave k
  LEFT JOIN colaboradores c
         ON c.status = 'ativo'
        AND regexp_replace(translate(lower(btrim(c.nome)), 'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc'), '\s+', ' ', 'g') = k.nome_chave
  LEFT JOIN user_profiles p ON p.id = c.user_profile_id
  LEFT JOIN custom_roles cr ON cr.id = p.custom_role_id
 GROUP BY k.departamento, k.papel, k.nome, k.departamento_chave
 ORDER BY k.departamento, k.papel DESC;
