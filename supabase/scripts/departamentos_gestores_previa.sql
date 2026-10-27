-- ═══════════════════════════════════════════════════════════════════════════════
-- Prévia da carga 20261027150100_departamentos_gestores_carga.sql — SÓ LEITURA
--
-- Rode no SQL Editor do projeto do app ANTES de aplicar as migrations. Uma linha por
-- departamento e papel (gestor que autoriza pagamentos / aprovador de SC). A carga só
-- passa se todas as linhas vierem com ok = true, isto é:
--   • departamento_existe = true;
--   • encontrados = 1 (0: nome diferente do cadastro ou id errado; 2+: homônimos);
--   • situacao_rh = 'ativo';
--   • nas linhas de gestor, usuario = 'ativo' e cargo preenchido (a carga dá "Ser
--     Autorizador de Pagamentos" ao cargo; sem cargo, a pessoa não autoriza).
-- pessoas_no_cargo: quantos usuários ativos têm o cargo do gestor, ou seja, quantos
-- recebem a permissão junto com ele (sozinha, ela não faz ninguém autorizar).
-- Quem tem id é achado por ele (id do colaborador ou do usuário vinculado); os demais
-- pelo nome, sem maiúsculas, acentos nem espaços repetidos, como na carga.
-- ═══════════════════════════════════════════════════════════════════════════════

WITH carga(departamento, gestor, gestor_id, aprovador, aprovador_id) AS (
  VALUES
    ('Área técnica',       'Paulo Vítor',                          NULL::uuid,
                           'Paulo Vítor',                          NULL::uuid),
    ('Atendimento',        'Louise Fontel',                        NULL,
                           'Louise Fontel',                        NULL),
    ('Biologia Molecular', 'Paulo Vítor',                          NULL,
                           'Paulo Vítor',                          NULL),
    ('Comercial',          'Cristiane Lacerda Dos Santos Madeiro', '1c502999-fe20-4aa5-93bd-09c56bd036bd',
                           'Cristiane Lacerda Dos Santos Madeiro', '1c502999-fe20-4aa5-93bd-09c56bd036bd'),
    ('Copa/Limpeza',       'Suane Batista De Oliveira',            NULL,
                           'Suane Batista De Oliveira',            NULL),
    ('Diretoria',          'Mario Gorini',                         NULL,
                           'Mario Gorini',                         NULL),
    ('Equipe Médica',      'Paulo Vítor',                          NULL,
                           'Paulo Vítor',                          NULL),
    ('Estoque',            'Louise Fontel',                        NULL,
                           'Louise Fontel',                        NULL),
    ('Faturamento',        'Raquel Dos Santos Avelino',            '99b8ef9e-1d54-4214-8989-111d481105f6',
                           'Louise Fontel',                        NULL),
    ('Financeiro',         'Louise Fontel',                        NULL,
                           'Louise Fontel',                        NULL),
    ('Qualidade',          'Eduarda Silva Fabri',                  '8a12d83d-cdd6-4e06-84de-92d7c651e1b6',
                           'Eduarda Silva Fabri',                  '8a12d83d-cdd6-4e06-84de-92d7c651e1b6'),
    ('RH',                 'Suane Batista De Oliveira',            NULL,
                           'Suane Batista De Oliveira',            NULL),
    ('TI',                 'Gabriel Queiroz',                      '0ecd17de-b183-4a4d-ae01-a3c13a27462e',
                           'Gabriel Queiroz',                      '0ecd17de-b183-4a4d-ae01-a3c13a27462e'),
    ('Transporte',         'Lucas Moreira',                        '7dda5483-b642-4cb2-a9e4-7f337d786aeb',
                           'Louise Fontel',                        NULL)
),
linhas AS (
  SELECT departamento, 'gestor' AS papel, gestor AS nome, gestor_id AS id FROM carga
  UNION ALL
  SELECT departamento, 'aprovador de SC', aprovador, aprovador_id FROM carga
),
chave AS (
  SELECT l.*,
         regexp_replace(translate(lower(btrim(l.nome)), 'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc'), '\s+', ' ', 'g') AS nome_chave,
         regexp_replace(translate(lower(btrim(l.departamento)), 'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc'), '\s+', ' ', 'g') AS departamento_chave
    FROM linhas l
),
achado AS (
  SELECT k.departamento,
         k.papel,
         k.nome,
         CASE WHEN k.id IS NULL THEN 'nome' ELSE 'id' END AS busca,
         EXISTS (
           SELECT 1 FROM departamentos d
            WHERE regexp_replace(translate(lower(btrim(d.nome)), 'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc'), '\s+', ' ', 'g') = k.departamento_chave
         ) AS departamento_existe,
         count(c.id) AS encontrados,
         string_agg(c.nome, ' | ') AS nome_no_cadastro,
         string_agg(c.status, ' | ') AS situacao_rh,
         string_agg(CASE WHEN c.id IS NULL THEN NULL
                         WHEN c.user_profile_id IS NULL THEN 'sem login'
                         WHEN p.deleted_at IS NOT NULL THEN 'removido em ' || to_char(p.deleted_at, 'DD/MM/YYYY')
                         WHEN p.disabled_at IS NOT NULL THEN 'desativado em ' || to_char(p.disabled_at, 'DD/MM/YYYY')
                         ELSE 'ativo' END, ' | ') AS usuario,
         string_agg(cr.name, ' | ') AS cargo,
         bool_or(COALESCE(cr.permissions ? 'canAuthorizePayments', false)) AS cargo_ja_autoriza,
         max(n.pessoas) AS pessoas_no_cargo
    FROM chave k
    LEFT JOIN colaboradores c
           ON CASE WHEN k.id IS NOT NULL THEN c.id = k.id OR c.user_profile_id = k.id
                   ELSE c.status = 'ativo'
                    AND regexp_replace(translate(lower(btrim(c.nome)), 'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc'), '\s+', ' ', 'g') = k.nome_chave
              END
    LEFT JOIN user_profiles p ON p.id = c.user_profile_id
    LEFT JOIN custom_roles cr ON cr.id = p.custom_role_id
    LEFT JOIN LATERAL (
           SELECT count(*) AS pessoas
             FROM user_profiles u
            WHERE u.custom_role_id = cr.id AND u.deleted_at IS NULL AND u.disabled_at IS NULL
         ) n ON true
   GROUP BY k.departamento, k.papel, k.nome, k.id, k.departamento_chave
)
SELECT COALESCE(a.departamento_existe AND a.encontrados = 1 AND a.situacao_rh = 'ativo'
                AND (a.papel <> 'gestor' OR (a.usuario = 'ativo' AND a.cargo IS NOT NULL)), false) AS ok,
       a.*
  FROM achado a
 ORDER BY a.departamento, a.papel DESC;
