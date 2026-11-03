SELECT p.name AS usuario,
       p.department AS departamento_em_usuarios,
       d.nome AS departamento_no_rh,
       CASE WHEN c.id IS NULL THEN 'sem colaborador vinculado no RH'
            WHEN d.id IS NULL THEN 'sem departamento no RH'
            ELSE 'diferentes' END AS situacao,
       (SELECT string_agg(a.nome, ', ' ORDER BY a.nome)
          FROM public.departamento_autorizadores_pagamento(c.departamento_id) a) AS quem_autoriza_os_pagamentos_hoje
  FROM public.user_profiles p
  LEFT JOIN public.colaboradores c ON c.user_profile_id = p.id
  LEFT JOIN public.departamentos d ON d.id = c.departamento_id
 WHERE p.deleted_at IS NULL
   AND p.disabled_at IS NULL
   AND (d.id IS NULL
        OR translate(lower(btrim(coalesce(p.department, ''))), 'áàâãéêíóôõúç', 'aaaaeeiooouc')
           IS DISTINCT FROM translate(lower(btrim(d.nome)), 'áàâãéêíóôõúç', 'aaaaeeiooouc'))
 ORDER BY situacao, p.name;
