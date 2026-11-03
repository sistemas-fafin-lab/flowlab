-- ═══════════════════════════════════════════════════════════════════════════════
-- Calendário de envios: Regras de envio de FASCAL, STM e SELECT.
--
-- Os três ficaram fora da carga inicial (20261028160000) porque não estavam na
-- planilha como linhas próprias: FASCAL entrou como "Inclui FASCAL" na CASSI, STM só
-- como membro do AMHPDF – Online, e SELECT nem aparecia. No apLIS os três têm
-- fonte pagadora e lotes próprios (conferido no backup em 03/11/2026):
--   FASCAL  1253  lote todo mês, quase sempre entre os dias 1 e 5 → 1º ao 5º dia útil
--   STM     1067  um lote em 2026 (06/10)                         → todos os dias
--   SELECT  1365  dois lotes em 2026 (10/08 e 06/10)              → todos os dias
-- STM e SELECT ficam sem "envios sugeridos no mês": entram na lista "Pode enviar
-- qualquer dia" e não na sugestão.
--
-- A fonte 1253 sai da CASSI: com ela lá, um lote da FASCAL casava com o agendamento
-- da CASSI e o marcava como enviado (casarLotes, calendarioEnvios.ts).
-- ═══════════════════════════════════════════════════════════════════════════════

INSERT INTO public.fat_envio_regras (convenio, fontes_pagadoras, janelas, envios_sugeridos_mes)
VALUES
  ('FASCAL', '{1253}', '[{"tipo":"dias_uteis","de":1,"ate":5}]', NULL),
  ('STM',    '{1067}', '[{"tipo":"todos_os_dias"}]', NULL),
  ('SELECT', '{1365}', '[{"tipo":"todos_os_dias"}]', NULL)
ON CONFLICT (convenio) DO NOTHING;

UPDATE public.fat_envio_regras
   SET fontes_pagadoras = array_remove(fontes_pagadoras, 1253),
       observacao = NULLIF(btrim(regexp_replace(COALESCE(observacao, ''), 'Inclui FASCAL', '', 'i')), '')
 WHERE convenio = 'CASSI'
   AND 1253 = ANY (fontes_pagadoras);
