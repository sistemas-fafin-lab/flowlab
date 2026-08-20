-- ═══════════════════════════════════════════════════════════════════════════════
-- Módulo Qualidade — bucket de Storage para exportações RHC (Registro de Câncer)
-- Migration: 20260820160000_qualidade_exportacoes_rhc_bucket.sql
--
-- api/_lib/handlers/qualidade-gerar-exportacao-cancer.ts sobe um CSV com PII
-- completa de paciente (nome, CPF, mãe, nascimento — ver a issue
-- .scratch/qualidade/issues/01-api-qualidade-dispatcher.md) a este bucket.
-- PRIVADO sempre: nenhuma policy de storage.objects é criada para
-- `authenticated` de propósito — todo acesso passa pelo dispatcher
-- /api/qualidade/{gerar-exportacao-cancer,baixar-exportacao-cancer}, que usa
-- o client service_role (bypassa RLS/storage policies) e devolve uma signed
-- URL de curta duração (5 min). Espelha o bucket `ac-apoio-requisicoes`
-- (20260723120000_ac_envio_apoio.sql), mas sem nenhuma policy de
-- authenticated — aqui não há upload nem leitura direto do navegador.
--
-- NÃO aplicado ainda em nenhum ambiente — revisar antes de rodar no SQL Editor.
-- ═══════════════════════════════════════════════════════════════════════════════

BEGIN;

INSERT INTO storage.buckets (id, name, public)
VALUES ('qualidade-exportacoes-rhc', 'qualidade-exportacoes-rhc', false)
ON CONFLICT (id) DO UPDATE SET public = false;

COMMIT;
