-- Cortesias: "Autorizado por" mostrava quem digitou o pedido no apLIS
-- (`requisicaoautorizacao.Solicitante` — qualquer atendente de qualquer
-- setor, sempre igual a quem criou a linha), não quem de fato autoriza
-- (`IdAutorizador`, só 8 pessoas no LIS inteiro). Confirmado ao vivo em
-- 2026-09-09 — motivo de várias pessoas de setores variados aparecerem
-- "autorizando" cortesias. `autorizado_por_lis` passa a vir de
-- `IdAutorizador`; `Solicitante` continua disponível, agora como coluna
-- separada (`solicitado_por_lis`), nunca mais confundido com autorização.
--
-- A query também passou a filtrar `Autorizado = 1` — autorizações
-- rejeitadas/sem decisão paravam de contar como cortesia concedida.

ALTER TABLE qa_cortesias ADD COLUMN IF NOT EXISTS solicitado_por_lis text;
COMMENT ON COLUMN qa_cortesias.solicitado_por_lis IS 'requisicaoautorizacao.Solicitante — quem deu entrada no pedido (qualquer setor). Informativo; NUNCA usar como "quem autorizou" (ver autorizado_por_lis).';
