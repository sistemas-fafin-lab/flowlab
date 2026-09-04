-- Seed de qa_setores para PRODUÇÃO (jqxeqmeikqclmmongclj).
--
-- Diagnóstico: a Matriz de Riscos (e os seletores de "Setor" em Ocorrências)
-- não mostram nenhum setor porque a tabela qa_setores está vazia em
-- produção — 0 linhas, confirmado com service role (não é RLS).
--
-- Causa: a migration 20260820120000_qualidade_piloto.sql usa
-- `CREATE TABLE IF NOT EXISTS app_setores`, que só cria a tabela quando ela
-- não existe (era no-op no projeto de teste, que já tinha os 23 setores
-- herdados do app flowlab-qualidade antigo). Em produção a tabela nunca
-- havia existido, então foi criada vazia — e nenhuma migration no repo
-- insere dado nela.
--
-- Este script replica os 23 setores ATIVOS hoje no projeto de teste
-- (eqzqkztgzcngnxmihdom), lidos por introspecção em 2026-09-04. Um 24º
-- registro ("Qualidade", minúsculo) existe no teste mas está com
-- ativo=false — deixado de fora de propósito, parece duplicata inativa de
-- "QUALIDADE".
--
-- Idempotente: ON CONFLICT (nome) DO NOTHING — seguro rodar mais de uma vez.
-- Rodar no SQL Editor do projeto de PRODUÇÃO.

INSERT INTO qa_setores (nome, ativo) VALUES
  ('ADMISSÃO', true),
  ('TRIAGEM', true),
  ('MACROSCOPIA', true),
  ('ADMINISTRATIVO', true),
  ('ANÁLISES CLÍNICAS', true),
  ('ÁREA TÉCNICA', true),
  ('ATENDIMENTO', true),
  ('BDR', true),
  ('BIOLOGIA MOLECULAR', true),
  ('COMPRAS', true),
  ('CONTROLE', true),
  ('COORDENAÇÃO', true),
  ('COMERCIAL', true),
  ('QUALIDADE', true),
  ('FATURAMENTO', true),
  ('FINANCEIRO', true),
  ('MICROSCOPIA', true),
  ('NÚCLEO DE NOTIFICAÇÕES', true),
  ('TI', true),
  ('SERVIÇOS GERAIS', true),
  ('RECURSOS HUMANOS', true),
  ('TRANSPORTE', true),
  ('PARCEIRO', true)
ON CONFLICT (nome) DO NOTHING;

-- Conferência: deve retornar 23.
select count(*) from qa_setores where ativo = true;
