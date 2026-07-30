# Sistema de Inventário - Resumo Técnico

## Visão Geral
Sistema web de gestão de inventário e requisições empresariais construído com React, TypeScript e Supabase. Oferece controle completo de estoque, geração de relatórios, gestão de usuários e processos de requisição com fluxos de aprovação.

## Tecnologias Principais
- Frontend: React 18 + TypeScript + Vite
- Banco de dados: Supabase (PostgreSQL)
- UI: TailwindCSS + Lucide React icons
- Autenticação: Supabase Auth (email/senha)
- Armazenamento: Supabase Storage
- Gerenciamento de estado: React Hooks + Context

## Funcionalidades Principais

### Gestão de Inventário
- CRUD completo de produtos
- Controle de estoque (quantidade, lotes, localização)
- Categorização dinâmica de produtos
- Valores unitário e total calculados
- Status de produtos: ativo, estoque baixo, vencido
- Controle de fornecedores com vinculação a produtos

### Requisições
- Fluxo de requisição com categorias de serviço (SC) e materiais (SM)
- Estados: pendente, aprovado, rejeitado, em andamento, completado
- Prioridades: normal, prioritário, urgente
- Sistema de justificativas e comentários
- Assinatura digital para recebimento

### Financeiro
- Custos por categorias (geral e técnico)
- Rastreamento de preços unitários
- Comparativo de compras
- Relatórios financeiros mensais
- Controle de impostos e retenções

### Gestão de Usuários
- Sistema de roles e permissões
- Departamentos organizacionais
- Autenticação segura
- Registro de atividades do usuário
- Configurações de perfil

### Relatórios
- Extrato de estoque (produto, quantidade, unidade, valor)
- Movimentações (data, tipo, quantidade, fornecedor, valor)
- Produtos vencidos ou próximos ao vencimento
- Exportação em PDF e XLSX
- Impressão formatada

## Modelos de Dados

### Produto
- ID, nome, código, categoria (dinâmica do banco)
- Quantidades e unidades
- Dados de fornecedor
- Preço unitário e total
- Datas de entrada e vencimento
- Localização e mínimo de estoque
- Status de produto

### Requisição
- ID, tipo (SC/SM), status, prioridade
- Items da requisição com produtos relacionados
- Solicitante, departamento, fornecedor
- Fluxo de aprovação e assinaturas
- Chat e histórico de alterações

### Movimentação
- ID, produto, tipo (entrada/saída)
- Razão da movimentação (venda, consumo, etc.)
- Quantidades e valores unitário/total
- Data da movimentação
- Autorização por usuários
- Nota fiscal quando aplicável

## Segurança e Permissões
- RLS (Row Level Security) habilitado em todas as tabelas
- Políticas de acesso baseadas em funções do usuário
- Verificação de autenticidade
- Log de atividades sensíveis
- Mascaramento de dados sensíveis

## Integração com o Banco de Dados
- Conexão com Supabase usando @supabase/supabase-js
- Todas as queries tipadas com TypeScript
- Funções de Banco de Dados para validações
- Triggers e políticas RLS para integridade

## Funcionalidades Extras
- Sistema de chat em tempo real para requisições
- Geração de relatórios customizados
- Painel em Português com i18n pronto
- Design responsivo para desktop e mobile
- Logs de alterações de produtos
- Sistema de assinaturas eletrônicas
- Controle de orçamentos e cotações
- Emissão de notas fiscais