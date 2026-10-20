-- ============================================================================
-- Controle de Custos — pré-preenchimento do vínculo com o apLIS pela ASSEFAZ
--
-- Gerada por supabase/scripts/pre-vinculo-aplis-assefaz.ts com o catálogo
-- (custo_exames) e o apLIS (backup MySQL, fattabelaprocedimento ativos da tabela
-- de preço 1) lidos em 2026-10-20. Issue 02 de
-- .scratch/controle-custos-vinculo-aplis-tuss.
--
-- Liga a cobrança cujos códigos no catálogo se resumem a um TUSS, com um exame
-- só (escolherVinculosAssefaz). Precisa de 20261020210000_custo_exames_vinculo_aplis.
-- Cada UPDATE só vale se o exame e a cobrança ainda estiverem sem vínculo:
-- vínculo feito à mão na tela não é sobrescrito. Ids do catálogo lido: em
-- outro ambiente os UPDATEs não acham o exame e não mudam nada.
--
-- Ligou (3):
--   3 CITOLOGIA DE LÍQUIDO → 40601129 CITOLOGIA DE LIQUIDOS
--   7 COLORAÇÃO → 40601269 BIÓPSIA COM COLORAÇÃO ESPECIAL
--   23 CITOLOGIA EM MEIO LÍQUIDO → 40601323 CITOLOGIA EM MEIO LÍQUIDO
--
-- Ficou de fora (17), para a tela:
--   1 BIÓPSIA: mais de um TUSS no catálogo (40601110, 40601196, 40601200, 40601226)
--   2 PEÇA CIRÚRGICA SIMPLES: mais de um TUSS no catálogo (40601110, 40601200, 40601226)
--   4 PER-OPERATÓRIO: nenhum TUSS da cobrança está no catálogo (40601021, 40601030)
--   5 PER-OPERATÓRIO SEM DESLOCAMENTO: nenhum TUSS da cobrança está no catálogo (40601080)
--   6 REVISÃO DE LÂMINA: nenhum TUSS da cobrança está no catálogo (40601153)
--   8 IMUNOISTOQUÍMICA: nenhum TUSS da cobrança está no catálogo (40601170, 40601188)
--   12 PUNÇÃO BIOPSIA ASPIRATIVA: mais de um TUSS no catálogo (40601129, 40601250)
--   13 CITOLOGIA CONVENCIONAL: mais de um TUSS no catálogo (40601137, 41301188)
--   15 CITOLOGIA HORMONAL ISOLADA: nenhum TUSS da cobrança está no catálogo (40601161)
--   17 IMUNOFLUORESCÊNCIA: nenhum TUSS da cobrança está no catálogo (40601277)
--   18 PAINEL DE HIBRIDIZAÇÃO: 40601285 está em 4 exames do catálogo (HPV DETECÇÃO E GENOTIPAGEM DE ALTO RISCO; PCR HPV ALTO RISCO; PCR HPV GENOTIPAGEM 28 TIPOS; PCR PARA HPV A/B)
--   19 CAPTURA HIBRIDA: mais de um TUSS no catálogo (40314057, 40314154, 40319326, 40601293)
--   20 PUNÇÃO BIÓPSIA ASPIRATIVA C/ DESLOCAMENTO: nenhum TUSS da cobrança está no catálogo (40601099, 40601102)
--   22 BIOLOGIA MOLECULAR: os outros TUSS da cobrança faltam no catálogo; ligar na tela
--   25 PEÇA CIRÚRGICA COMPLEXA: mais de um TUSS no catálogo (40601218, 40601226)
--   28 MEDICINA LABORATORIAL: mais de um TUSS no catálogo (40302504, 40305767, 40307271, 40310060, 40310124, 40310426, 40310558)
--   30 PCR: nenhum TUSS da cobrança está no catálogo (99902034)
-- ============================================================================

BEGIN;

UPDATE public.custo_exames
   SET aplis_id_exame_tipo = 3
 WHERE id = '4e0c405b-1624-46f6-be42-81b6e1bc9a68'
   AND aplis_id_exame_tipo IS NULL
   AND NOT EXISTS (SELECT 1 FROM public.custo_exames WHERE aplis_id_exame_tipo = 3); -- CITOLOGIA DE LIQUIDOS

UPDATE public.custo_exames
   SET aplis_id_exame_tipo = 7
 WHERE id = '001b3cde-12a2-46f5-9ae2-42abbd2387e2'
   AND aplis_id_exame_tipo IS NULL
   AND NOT EXISTS (SELECT 1 FROM public.custo_exames WHERE aplis_id_exame_tipo = 7); -- BIÓPSIA COM COLORAÇÃO ESPECIAL

UPDATE public.custo_exames
   SET aplis_id_exame_tipo = 23
 WHERE id = 'cbb6f469-43ec-4e37-b30e-cc679f8f1afe'
   AND aplis_id_exame_tipo IS NULL
   AND NOT EXISTS (SELECT 1 FROM public.custo_exames WHERE aplis_id_exame_tipo = 23); -- CITOLOGIA EM MEIO LÍQUIDO

COMMIT;
