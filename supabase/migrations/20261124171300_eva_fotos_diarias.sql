-- EVA — foto diária do painel de gestão (D42, issue 31).
--
-- Uma linha por dia útil, gravada pelo cron do fechamento (18h): quantos cards estavam abertos,
-- atrasados, vencendo e parados, as entregas do dia, os chamados (na fila, fora do prazo, abertos e
-- resolvidos, tempo médio) e os números de cada pessoa. É o que não dá para reconstruir depois;
-- entregas e tempo de resolução por semana saem das datas de resolução (resolved_at).
-- Usada no relatório semanal ("eram 9 atrasados em 06/11"), no bloco das perguntas de gestão e no
-- cartão de tendências do Início. Só o servidor grava (service role); quem vê o Início lê.
--
-- Idempotente.

CREATE TABLE IF NOT EXISTS public.ti_agente_fotos (
  dia        date PRIMARY KEY,
  foto       jsonb NOT NULL,
  criada_em  timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.ti_agente_fotos IS
  'Foto diária do painel de gestão da EVA (D42): uma linha por dia útil, gravada às 18h. foto = FotoDia (src/modules/eva/domain/tendencias.ts).';

ALTER TABLE public.ti_agente_fotos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ti_agente_fotos_select ON public.ti_agente_fotos;
CREATE POLICY ti_agente_fotos_select ON public.ti_agente_fotos
  FOR SELECT TO authenticated
  USING (
    (SELECT public.current_user_has_permission('canManageIT'))
    OR (SELECT public.ti_agente_pode('canManageAgenteTI'))
    OR (SELECT public.ti_agente_pode('canApproveAgenteTI'))
  );
