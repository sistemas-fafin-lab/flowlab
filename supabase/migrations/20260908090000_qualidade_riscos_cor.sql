-- Riscos: cor customizável por risco no gráfico de incidência (unificação
-- Matriz de Riscos + Mapa de Riscos por Setor).
--
-- Compartilhada entre todos os usuários (não é preferência local/localStorage) —
-- decisão de produto: é uma ferramenta de auditoria em equipe, todo mundo deve
-- ver o mesmo código de cor pro mesmo risco. NULL = usa paleta default
-- determinística (hash do id) até alguém escolher manualmente.

ALTER TABLE qa_riscos ADD COLUMN IF NOT EXISTS cor text;
COMMENT ON COLUMN qa_riscos.cor IS 'Cor escolhida manualmente para o risco no gráfico de incidência (hex, ex: #3b82f6). NULL = usa paleta default determinística (hash do id).';

-- Sem policy nova: qa_riscos_update (20260831180000_qualidade_riscos_gerenciamento.sql)
-- já cobre qualquer UPDATE em qa_riscos via canManageQualidade, cor incluída.
