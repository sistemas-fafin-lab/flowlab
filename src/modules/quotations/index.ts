/**
 * Quotations Module - Bounded Context
 * 
 * Este módulo implementa a gestão completa de cotações como um bounded context,
 * separado do sistema de requisições. Inclui:
 * 
 * - Domínio: Tipos e interfaces específicos de cotação
 * - Workflow: Máquina de estados com transições formais
 * - Hooks: Lógica de negócios e gerenciamento de estado
 * - Componentes: Interface do usuário corporativa
 * 
 * Principais funcionalidades:
 * - Criação manual de cotações (independente de requisições)
 * - Convite a fornecedores e coleta de propostas
 * - Comparativo técnico profissional
 * - Sistema de alçadas de aprovação
 * - Logs e auditoria completos
 */

// Types
export * from './types';

// Workflow State Machine
export * from './workflow';

// Hooks
export * from './hooks';

// Components
export * from './components';
