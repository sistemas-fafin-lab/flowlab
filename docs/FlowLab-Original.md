CREATE SEQUENCE IF NOT EXISTS public.it_request_seq;

CREATE SEQUENCE IF NOT EXISTS public.maintenance_requests_codigo_seq;

CREATE SEQUENCE IF NOT EXISTS public.request_attachments_id_seq;

CREATE TABLE IF NOT EXISTS public.ac_agendamentos (
id uuid NOT NULL DEFAULT gen_random_uuid(),
labhub_id uuid NOT NULL,
paciente_nome text NOT NULL,
paciente_telefone text,
posto_id uuid,
local_posto text NOT NULL DEFAULT ''::text,
data_hora timestamp with time zone NOT NULL,
status text NOT NULL DEFAULT 'recebido'::text,
recebido_em timestamp with time zone NOT NULL DEFAULT now(),
updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ac_dias_excecao (
id uuid NOT NULL DEFAULT gen_random_uuid(),
posto_id uuid NOT NULL,
data date NOT NULL,
fechado boolean NOT NULL DEFAULT false,
horarios jsonb NOT NULL DEFAULT '[]'::jsonb,
created_at timestamp with time zone NOT NULL DEFAULT now(),
updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ac_horarios_padrao (
id uuid NOT NULL DEFAULT gen_random_uuid(),
posto_id uuid NOT NULL,
hora time without time zone NOT NULL,
capacidade integer NOT NULL DEFAULT 1,
created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ac_postos (
id uuid NOT NULL DEFAULT gen_random_uuid(),
nome character varying(120) NOT NULL,
endereco text NOT NULL DEFAULT ''::text,
ativo boolean NOT NULL DEFAULT true,
created_at timestamp with time zone NOT NULL DEFAULT now(),
updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ac_resultados (
id uuid NOT NULL DEFAULT gen_random_uuid(),
agendamento_id uuid NOT NULL,
exame_nome text NOT NULL,
categoria text,
resumo text,
paineis jsonb NOT NULL DEFAULT '[]'::jsonb,
laudo_url text,
declaracao_url text,
liberado_por text,
liberado_em timestamp with time zone NOT NULL DEFAULT now(),
entregue_ao_labhub boolean NOT NULL DEFAULT false,
created_at timestamp with time zone NOT NULL DEFAULT now(),
updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.approval_level_config (
id uuid NOT NULL DEFAULT gen_random_uuid(),
level character varying(20) NOT NULL,
label character varying(100) NOT NULL,
max_amount numeric(15,2) NOT NULL,
description text,
color character varying(50) DEFAULT 'blue'::character varying,
display_order integer NOT NULL DEFAULT 0,
is_active boolean DEFAULT true,
created_at timestamp with time zone DEFAULT now(),
updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.billing_sync_log (
id uuid NOT NULL DEFAULT gen_random_uuid(),
sync_type text NOT NULL,
started_at timestamp with time zone NOT NULL DEFAULT now(),
finished_at timestamp with time zone,
status text NOT NULL DEFAULT 'running'::text,
records_processed integer DEFAULT 0,
records_created integer DEFAULT 0,
records_updated integer DEFAULT 0,
records_failed integer DEFAULT 0,
error_message text,
details jsonb
);

CREATE TABLE IF NOT EXISTS public.custom_roles (
id uuid NOT NULL DEFAULT gen_random_uuid(),
name character varying(100) NOT NULL,
description text,
permissions jsonb NOT NULL DEFAULT '[]'::jsonb,
is_system boolean NOT NULL DEFAULT false,
created_at timestamp with time zone DEFAULT now(),
updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.glosas (
id_glosa uuid NOT NULL DEFAULT gen_random_uuid(),
recebimento_id uuid NOT NULL,
nota_id uuid,
requisicao_id uuid,
valor numeric(15,2) NOT NULL DEFAULT 0,
motivo text NOT NULL,
codigo_glosa text,
status text NOT NULL DEFAULT 'aberta'::text,
recurso boolean DEFAULT false,
data_recurso date,
resultado_recurso text,
responsavel text,
created_at timestamp with time zone DEFAULT now(),
updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.it_project_visions (
id uuid NOT NULL DEFAULT gen_random_uuid(),
project_id uuid NOT NULL,
mission text NOT NULL,
vision text NOT NULL,
in_scope text[] NOT NULL DEFAULT '{}'::text[],
out_of_scope text[] NOT NULL DEFAULT '{}'::text[],
infra_details jsonb NOT NULL DEFAULT '{"os": "", "vps": "", "automation": ""}'::jsonb,
team_details jsonb NOT NULL DEFAULT '{"collaborators": [], "licenses_allocated": 0}'::jsonb,
nodes jsonb,
edges jsonb,
updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.it_projects (
id uuid NOT NULL DEFAULT gen_random_uuid(),
name character varying(100) NOT NULL,
description text,
color character varying(7) NOT NULL DEFAULT '#6366f1'::character varying,
created_by uuid NOT NULL,
created_at timestamp with time zone NOT NULL DEFAULT now(),
updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.it_requests (
id uuid NOT NULL DEFAULT gen_random_uuid(),
codigo character varying(20) NOT NULL DEFAULT ('IT-'::text || lpad((nextval('it_request_seq'::regclass))::text, 3, '0'::text)),
title character varying(255) NOT NULL,
description text,
request_type character varying(30) NOT NULL DEFAULT 'suporte'::character varying,
priority character varying(20) NOT NULL DEFAULT 'medium'::character varying,
status character varying(30) NOT NULL DEFAULT 'pending'::character varying,
kanban_status character varying(30) NOT NULL DEFAULT 'backlog'::character varying,
requested_by uuid NOT NULL,
assigned_to uuid[] NOT NULL DEFAULT ARRAY[]::uuid[],
created_at timestamp with time zone NOT NULL DEFAULT now(),
updated_at timestamp with time zone NOT NULL DEFAULT now(),
is_internal boolean NOT NULL DEFAULT false,
estimated_hours numeric(5,2),
due_date timestamp with time zone,
tags text[] DEFAULT '{}'::text[],
attachments jsonb NOT NULL DEFAULT '[]'::jsonb,
kanban_hidden boolean NOT NULL DEFAULT false,
project_id uuid,
sprint_id uuid,
last_status_email_at timestamp with time zone
);

CREATE TABLE IF NOT EXISTS public.it_sprints (
id uuid NOT NULL DEFAULT gen_random_uuid(),
project_id uuid NOT NULL,
name character varying(100) NOT NULL,
goal text,
start_date date,
end_date date,
status character varying(20) NOT NULL DEFAULT 'planned'::character varying,
created_at timestamp with time zone NOT NULL DEFAULT now(),
updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.it_task_attachments (
id uuid NOT NULL DEFAULT gen_random_uuid(),
task_id uuid NOT NULL,
user_id uuid NOT NULL,
file_url text NOT NULL,
file_name text NOT NULL,
file_size integer,
created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.it_task_comments (
id uuid NOT NULL DEFAULT gen_random_uuid(),
task_id uuid NOT NULL,
user_id uuid NOT NULL,
content text NOT NULL,
created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.lotes (
id_lote uuid NOT NULL DEFAULT gen_random_uuid(),
operadora_id uuid NOT NULL,
codigo_lote text NOT NULL,
data_criacao date NOT NULL DEFAULT CURRENT_DATE,
data_envio date,
status text NOT NULL DEFAULT 'aberto'::text,
valor_total numeric(15,2) DEFAULT 0,
qtd_requisicoes integer DEFAULT 0,
aplis_id text,
created_at timestamp with time zone DEFAULT now(),
updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.maintenance_inventory_items (
id uuid NOT NULL DEFAULT gen_random_uuid(),
maintenance_request_id uuid NOT NULL,
product_id uuid NOT NULL,
movement_id uuid,
quantity integer NOT NULL,
product_name text NOT NULL,
created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.maintenance_requests (
id uuid NOT NULL DEFAULT gen_random_uuid(),
codigo text NOT NULL,
requester_id uuid NOT NULL,
requester_name text NOT NULL,
requester_email text NOT NULL,
department text NOT NULL,
local_ocorrencia text NOT NULL,
descricao text NOT NULL,
impacto_operacional text NOT NULL,
data_identificacao timestamp with time zone NOT NULL,
prioridade text NOT NULL DEFAULT 'common'::text,
status text NOT NULL DEFAULT 'pending'::text,
images text[] DEFAULT '{}'::text[],
assigned_to text,
assigned_at timestamp with time zone,
completed_at timestamp with time zone,
completion_notes text,
cancelled_at timestamp with time zone,
cancellation_reason text,
created_at timestamp with time zone DEFAULT now(),
updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.message_retry_queue (
id uuid NOT NULL DEFAULT gen_random_uuid(),
message_id uuid NOT NULL,
next_retry_at timestamp with time zone NOT NULL,
retry_reason character varying(255),
priority integer DEFAULT 0,
created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.message_templates (
id uuid NOT NULL DEFAULT gen_random_uuid(),
code character varying(50) NOT NULL,
name character varying(100) NOT NULL,
provider_type character varying(30) NOT NULL,
subject character varying(255),
body text NOT NULL,
variables jsonb,
is_active boolean DEFAULT true,
created_at timestamp with time zone DEFAULT now(),
updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.messaging_providers (
id uuid NOT NULL DEFAULT gen_random_uuid(),
code character varying(50) NOT NULL,
name character varying(100) NOT NULL,
type character varying(30) NOT NULL,
config jsonb NOT NULL,
is_active boolean DEFAULT true,
health_status character varying(20) DEFAULT 'unknown'::character varying,
last_health_check timestamp with time zone,
created_at timestamp with time zone DEFAULT now(),
updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.module_categories (
id text NOT NULL,
name character varying(100) NOT NULL,
sort_order integer NOT NULL DEFAULT 0,
items jsonb NOT NULL DEFAULT '[]'::jsonb,
created_at timestamp with time zone DEFAULT now(),
updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.nota_lote (
id_nota uuid NOT NULL,
id_lote uuid NOT NULL,
created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.notas (
id_nota uuid NOT NULL DEFAULT gen_random_uuid(),
operadora_id uuid NOT NULL,
numero_nota text NOT NULL,
data_emissao date NOT NULL DEFAULT CURRENT_DATE,
data_vencimento date,
valor_total numeric(15,2) NOT NULL DEFAULT 0,
valor_recebido numeric(15,2) DEFAULT 0,
valor_glosado numeric(15,2) DEFAULT 0,
status text NOT NULL DEFAULT 'aberta'::text,
competencia text,
observacoes text,
aplis_id text,
created_at timestamp with time zone DEFAULT now(),
updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.notification_templates (
id uuid NOT NULL DEFAULT gen_random_uuid(),
slug character varying(50) NOT NULL,
name character varying(100) NOT NULL,
subject_template text NOT NULL,
body_html text NOT NULL,
created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.operadoras (
id_operadora uuid NOT NULL DEFAULT gen_random_uuid(),
nome text NOT NULL,
cnpj text,
prazo_pagamento_dias integer DEFAULT 30,
contato_email text,
contato_telefone text,
aplis_id text,
created_at timestamp with time zone DEFAULT now(),
updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.payment_requests (
id uuid NOT NULL DEFAULT gen_random_uuid(),
codigo text NOT NULL,
codigo_compacto text NOT NULL,
tipo_solicitacao text NOT NULL,
documento_numero text,
fornecedor text NOT NULL,
cpf_cnpj text,
valor_total numeric(15,2) NOT NULL,
forma_pagamento text NOT NULL,
dados_pagamento text NOT NULL,
descricao_detalhada text NOT NULL,
solicitado_por text NOT NULL,
autorizado_por text,
data_pagamento date NOT NULL,
email_usuario text NOT NULL,
department text,
status text NOT NULL DEFAULT 'pending'::text,
pdf_url text,
approved_by text,
approval_date timestamp with time zone,
rejection_reason text,
created_at timestamp with time zone DEFAULT now(),
updated_at timestamp with time zone DEFAULT now(),
attachment_url text,
attachment_name text,
attachments jsonb NOT NULL DEFAULT '[]'::jsonb
);

CREATE TABLE IF NOT EXISTS public.product_change_logs (
id uuid NOT NULL DEFAULT gen_random_uuid(),
product_id uuid NOT NULL,
product_name text NOT NULL,
changed_by text NOT NULL,
change_reason text NOT NULL,
field_changes jsonb NOT NULL DEFAULT '[]'::jsonb,
change_date date NOT NULL,
change_time text NOT NULL,
created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.product_stock (
product_id uuid NOT NULL,
location_id uuid NOT NULL,
quantity integer NOT NULL DEFAULT 0,
updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.products (
id uuid NOT NULL DEFAULT gen_random_uuid(),
name text NOT NULL,
code text NOT NULL,
category text NOT NULL,
quantity integer NOT NULL DEFAULT 0,
unit text NOT NULL,
supplier text,
batch text,
entry_date date NOT NULL,
expiration_date date NOT NULL,
location text NOT NULL,
min_stock integer NOT NULL DEFAULT 0,
status text NOT NULL DEFAULT 'active'::text,
created_at timestamp with time zone DEFAULT now(),
updated_at timestamp with time zone DEFAULT now(),
unit_price numeric(10,2) NOT NULL DEFAULT 0,
invoicenumber text,
iswithholding boolean DEFAULT false,
supplier_name text
);

CREATE TABLE IF NOT EXISTS public.provider_health_logs (
id uuid NOT NULL DEFAULT gen_random_uuid(),
provider_id uuid NOT NULL,
status character varying(20) NOT NULL,
response_time_ms integer,
details jsonb,
created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.quotation_approvals (
id uuid NOT NULL DEFAULT gen_random_uuid(),
quotation_id uuid NOT NULL,
level character varying(20) NOT NULL,
approver_id uuid NOT NULL,
approver_name character varying(255) NOT NULL,
status character varying(20) DEFAULT 'pending'::character varying,
max_amount numeric(15,2),
comment text,
approved_at timestamp with time zone,
rejected_at timestamp with time zone,
created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.quotation_audit_logs (
id uuid NOT NULL DEFAULT gen_random_uuid(),
quotation_id uuid NOT NULL,
action character varying(50) NOT NULL,
performed_by uuid NOT NULL,
performed_by_name character varying(255) NOT NULL,
performed_at timestamp with time zone DEFAULT now(),
details jsonb,
metadata jsonb,
ip_address inet,
user_agent text,
created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.quotation_invited_suppliers (
id uuid NOT NULL DEFAULT gen_random_uuid(),
quotation_id uuid NOT NULL,
supplier_id uuid NOT NULL,
supplier_name character varying(255) NOT NULL,
supplier_email character varying(255),
supplier_phone character varying(50),
invited_at timestamp with time zone DEFAULT now(),
responded_at timestamp with time zone,
status character varying(20) DEFAULT 'pending'::character varying,
created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.quotation_items (
id uuid NOT NULL DEFAULT gen_random_uuid(),
quotation_id uuid NOT NULL,
supplier_id uuid,
supplier_name text,
unit_price numeric,
delivery_time text,
notes text,
status text NOT NULL DEFAULT 'pending'::text,
created_at timestamp with time zone DEFAULT now(),
submitted_at timestamp with time zone,
total_price numeric,
product_code character varying(100),
description text,
quantity numeric(15,2),
unit character varying(20) DEFAULT 'un'::character varying,
estimated_unit_price numeric(15,2),
product_id uuid,
product_name character varying(255)
);

CREATE TABLE IF NOT EXISTS public.quotation_messages (
id uuid NOT NULL DEFAULT gen_random_uuid(),
quotation_id uuid NOT NULL,
supplier_id uuid NOT NULL,
supplier_name character varying(255) NOT NULL,
provider_id uuid,
provider_type character varying(30) NOT NULL,
template_id uuid,
recipient character varying(255) NOT NULL,
subject character varying(255),
body text NOT NULL,
status character varying(20) DEFAULT 'pending'::character varying,
attempt_count integer DEFAULT 0,
max_attempts integer DEFAULT 3,
sent_at timestamp with time zone,
delivered_at timestamp with time zone,
read_at timestamp with time zone,
failed_at timestamp with time zone,
error_message text,
provider_response jsonb,
metadata jsonb,
created_by uuid,
created_by_name character varying(255),
created_at timestamp with time zone DEFAULT now(),
updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.quotation_proposal_items (
id uuid NOT NULL DEFAULT gen_random_uuid(),
proposal_id uuid NOT NULL,
quotation_item_id uuid NOT NULL,
unit_price numeric(15,2) NOT NULL,
total_price numeric(15,2) NOT NULL,
delivery_days integer,
notes text,
created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.quotation_proposals (
id uuid NOT NULL DEFAULT gen_random_uuid(),
quotation_id uuid NOT NULL,
supplier_id uuid NOT NULL,
supplier_name character varying(255) NOT NULL,
total_amount numeric(15,2) NOT NULL,
average_delivery_days integer,
notes text,
valid_until date,
status character varying(20) DEFAULT 'submitted'::character varying,
submitted_at timestamp with time zone DEFAULT now(),
is_winner boolean DEFAULT false,
selected_at timestamp with time zone,
created_at timestamp with time zone DEFAULT now(),
updated_at timestamp with time zone DEFAULT now(),
payment_method character varying(20),
boleto_due_days integer
);

CREATE TABLE IF NOT EXISTS public.quotations (
id uuid NOT NULL DEFAULT gen_random_uuid(),
product_name text NOT NULL,
requested_quantity integer NOT NULL,
status text NOT NULL DEFAULT 'pending'::text,
created_at timestamp with time zone DEFAULT now(),
created_by text,
product_id uuid,
request_id text,
code character varying(50),
title character varying(255),
description text,
department character varying(100),
cost_center character varying(50),
priority character varying(20) DEFAULT 'medium'::character varying,
deadline timestamp with time zone,
response_deadline timestamp with time zone,
justification text,
required_approval_level character varying(20),
final_total_amount numeric(15,2),
selected_proposal_id uuid,
selected_total_amount numeric(15,2),
purchase_order_id uuid,
converted_to_purchase_at timestamp with time zone,
created_by_name character varying(255),
estimated_total numeric(15,2),
purchase_order_code character varying(50)
);

CREATE TABLE IF NOT EXISTS public.recebimentos (
id_receb uuid NOT NULL DEFAULT gen_random_uuid(),
nota_id uuid,
lote_id uuid,
data_prevista date NOT NULL,
data_receb date,
valor_previsto numeric(15,2) NOT NULL DEFAULT 0,
valor_recebido numeric(15,2) DEFAULT 0,
status text NOT NULL DEFAULT 'previsto'::text,
banco_nome text,
banco_conta text,
comprovante_url text,
observacoes text,
registrado_por text,
created_at timestamp with time zone DEFAULT now(),
updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.request_attachments (
id integer NOT NULL DEFAULT nextval('request_attachments_id_seq'::regclass),
request_id character varying,
file_name character varying NOT NULL,
file_path character varying NOT NULL,
file_size integer NOT NULL,
file_type character varying NOT NULL,
uploaded_at timestamp without time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.request_messages (
id uuid NOT NULL DEFAULT gen_random_uuid(),
request_id text NOT NULL,
author_id uuid,
author_name text NOT NULL,
content text NOT NULL,
created_at timestamp with time zone DEFAULT now(),
read_by uuid[] DEFAULT '{}'::uuid[]
);

CREATE TABLE IF NOT EXISTS public.request_periods (
id uuid NOT NULL DEFAULT gen_random_uuid(),
start_day integer NOT NULL,
end_day integer NOT NULL,
created_at timestamp with time zone DEFAULT now(),
updated_at timestamp with time zone DEFAULT now(),
department character varying(50) DEFAULT 'general'::character varying
);

CREATE TABLE IF NOT EXISTS public.requests (
id text NOT NULL,
reason text NOT NULL,
requested_by text NOT NULL,
request_date date NOT NULL DEFAULT CURRENT_DATE,
status text NOT NULL DEFAULT 'pending'::text,
approved_by text,
approval_date date,
notes text,
created_at timestamp with time zone DEFAULT now(),
updated_at timestamp with time zone DEFAULT now(),
department text,
supplier_id uuid,
supplier_name text,
items jsonb DEFAULT '[]'::jsonb,
priority text DEFAULT 'standard'::text,
type text NOT NULL DEFAULT 'SM'::text,
receiver_signature text,
received_by text,
attachment_url text,
attachment_name text,
attachments jsonb NOT NULL DEFAULT '[]'::jsonb
);

CREATE TABLE IF NOT EXISTS public.requisicoes (
id_requisicao uuid NOT NULL DEFAULT gen_random_uuid(),
lote_id uuid,
numero_guia text NOT NULL,
data_criacao date NOT NULL DEFAULT CURRENT_DATE,
data_execucao date,
valor numeric(15,2) NOT NULL DEFAULT 0,
status text NOT NULL DEFAULT 'pendente'::text,
paciente_nome text,
procedimento_codigo text,
procedimento_descricao text,
aplis_id text,
created_at timestamp with time zone DEFAULT now(),
updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.stock_locations (
id uuid NOT NULL DEFAULT gen_random_uuid(),
nome text NOT NULL,
department text,
posto_id uuid,
is_principal boolean NOT NULL DEFAULT false,
rastreavel boolean NOT NULL DEFAULT true,
controla_consumo boolean NOT NULL DEFAULT false,
ativo boolean NOT NULL DEFAULT true,
created_at timestamp with time zone NOT NULL DEFAULT now(),
updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.stock_movements (
id uuid NOT NULL DEFAULT gen_random_uuid(),
product_id uuid NOT NULL,
product_name text NOT NULL,
type text NOT NULL DEFAULT 'out'::text,
reason text NOT NULL,
quantity integer NOT NULL,
date date NOT NULL DEFAULT CURRENT_DATE,
request_id text,
authorized_by text,
notes text,
created_at timestamp with time zone DEFAULT now(),
unit_price numeric(10,2) DEFAULT 0,
from_location_id uuid,
to_location_id uuid
);

CREATE TABLE IF NOT EXISTS public.suppliers (
id uuid NOT NULL DEFAULT gen_random_uuid(),
name text NOT NULL,
cnpj text NOT NULL,
email text NOT NULL,
phone text NOT NULL,
address text,
contactperson text,
products text[],
status text NOT NULL,
created_at timestamp with time zone DEFAULT now(),
contact_person text,
whatsapp character varying(50)
);

CREATE TABLE IF NOT EXISTS public.user_approval_limits (
id uuid NOT NULL DEFAULT gen_random_uuid(),
user_id uuid NOT NULL,
approval_level character varying(20) NOT NULL DEFAULT 'level_1'::character varying,
max_amount numeric(15,2) NOT NULL DEFAULT 5000.00,
can_approve boolean NOT NULL DEFAULT false,
notes text,
created_at timestamp with time zone DEFAULT now(),
updated_at timestamp with time zone DEFAULT now(),
created_by uuid,
custom_max_amount numeric(15,2)
);

CREATE TABLE IF NOT EXISTS public.user_notifications (
id uuid NOT NULL DEFAULT gen_random_uuid(),
user_id uuid NOT NULL,
title character varying(255) NOT NULL,
content text NOT NULL,
module character varying(50) NOT NULL,
type character varying(50) NOT NULL DEFAULT 'info'::character varying,
link character varying(255),
is_read boolean NOT NULL DEFAULT false,
created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.user_profiles (
id uuid NOT NULL,
email text NOT NULL,
name text NOT NULL,
role text NOT NULL DEFAULT 'requester'::text,
created_at timestamp with time zone DEFAULT now(),
updated_at timestamp with time zone DEFAULT now(),
department text,
custom_role_id uuid,
cpf text,
birth_date date
);

CREATE TABLE IF NOT EXISTS public.user_whitelist (
cpf text NOT NULL,
name text NOT NULL,
activity boolean NOT NULL DEFAULT true,
created_at timestamp with time zone DEFAULT now(),
updated_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.ac_agendamentos ADD CONSTRAINT ac_agendamentos_labhub_id_key UNIQUE (labhub_id);

ALTER TABLE public.ac_agendamentos ADD CONSTRAINT ac_agendamentos_pkey PRIMARY KEY (id);

ALTER TABLE public.ac_dias_excecao ADD CONSTRAINT ac_dias_excecao_pkey PRIMARY KEY (id);

ALTER TABLE public.ac_dias_excecao ADD CONSTRAINT uq_ac_dias_excecao UNIQUE (posto_id, data);

ALTER TABLE public.ac_horarios_padrao ADD CONSTRAINT ac_horarios_padrao_capacidade_check CHECK ((capacidade >= 1));

ALTER TABLE public.ac_horarios_padrao ADD CONSTRAINT ac_horarios_padrao_pkey PRIMARY KEY (id);

ALTER TABLE public.ac_horarios_padrao ADD CONSTRAINT uq_ac_horarios_padrao UNIQUE (posto_id, hora);

ALTER TABLE public.ac_postos ADD CONSTRAINT ac_postos_pkey PRIMARY KEY (id);

ALTER TABLE public.ac_resultados ADD CONSTRAINT ac_resultados_pkey PRIMARY KEY (id);

ALTER TABLE public.approval_level_config ADD CONSTRAINT approval_level_config_level_check CHECK (((level)::text = ANY ((ARRAY['none'::character varying, 'level_1'::character varying, 'level_2'::character varying, 'level_3'::character varying, 'level_4'::character varying])::text[])));

ALTER TABLE public.approval_level_config ADD CONSTRAINT approval_level_config_level_key UNIQUE (level);

ALTER TABLE public.approval_level_config ADD CONSTRAINT approval_level_config_pkey PRIMARY KEY (id);

ALTER TABLE public.billing_sync_log ADD CONSTRAINT billing_sync_log_pkey PRIMARY KEY (id);

ALTER TABLE public.billing_sync_log ADD CONSTRAINT billing_sync_log_status_check CHECK ((status = ANY (ARRAY['running'::text, 'success'::text, 'error'::text, 'partial'::text])));

ALTER TABLE public.billing_sync_log ADD CONSTRAINT billing_sync_log_sync_type_check CHECK ((sync_type = ANY (ARRAY['operadoras'::text, 'notas'::text, 'lotes'::text, 'requisicoes'::text, 'full'::text])));

ALTER TABLE public.custom_roles ADD CONSTRAINT custom_roles_name_key UNIQUE (name);

ALTER TABLE public.custom_roles ADD CONSTRAINT custom_roles_pkey PRIMARY KEY (id);

ALTER TABLE public.glosas ADD CONSTRAINT glosas_pkey PRIMARY KEY (id_glosa);

ALTER TABLE public.glosas ADD CONSTRAINT glosas_status_check CHECK ((status = ANY (ARRAY['aberta'::text, 'em_recurso'::text, 'revertida'::text, 'definitiva'::text])));

ALTER TABLE public.it_project_visions ADD CONSTRAINT it_project_visions_pkey PRIMARY KEY (id);

ALTER TABLE public.it_project_visions ADD CONSTRAINT it_project_visions_project_id_key UNIQUE (project_id);

ALTER TABLE public.it_projects ADD CONSTRAINT it_projects_pkey PRIMARY KEY (id);

ALTER TABLE public.it_requests ADD CONSTRAINT it_requests_codigo_key UNIQUE (codigo);

ALTER TABLE public.it_requests ADD CONSTRAINT it_requests_kanban_status_check CHECK (((kanban_status)::text = ANY ((ARRAY['backlog'::character varying, 'todo'::character varying, 'in_progress'::character varying, 'review'::character varying, 'done'::character varying])::text[])));

ALTER TABLE public.it_requests ADD CONSTRAINT it_requests_pkey PRIMARY KEY (id);

ALTER TABLE public.it_requests ADD CONSTRAINT it_requests_priority_check CHECK (((priority)::text = ANY ((ARRAY['low'::character varying, 'medium'::character varying, 'high'::character varying, 'critical'::character varying])::text[])));

ALTER TABLE public.it_requests ADD CONSTRAINT it_requests_request_type_check CHECK (((request_type)::text = ANY ((ARRAY['suporte'::character varying, 'desenvolvimento'::character varying, 'consultoria'::character varying])::text[])));

ALTER TABLE public.it_requests ADD CONSTRAINT it_requests_status_check CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'in_progress'::character varying, 'resolved'::character varying, 'cancelled'::character varying])::text[])));

ALTER TABLE public.it_sprints ADD CONSTRAINT it_sprints_pkey PRIMARY KEY (id);

ALTER TABLE public.it_sprints ADD CONSTRAINT it_sprints_status_check CHECK (((status)::text = ANY ((ARRAY['planned'::character varying, 'active'::character varying, 'completed'::character varying])::text[])));

ALTER TABLE public.it_task_attachments ADD CONSTRAINT it_task_attachments_pkey PRIMARY KEY (id);

ALTER TABLE public.it_task_comments ADD CONSTRAINT it_task_comments_pkey PRIMARY KEY (id);

ALTER TABLE public.lotes ADD CONSTRAINT lotes_aplis_id_key UNIQUE (aplis_id);

ALTER TABLE public.lotes ADD CONSTRAINT lotes_pkey PRIMARY KEY (id_lote);

ALTER TABLE public.lotes ADD CONSTRAINT lotes_status_check CHECK ((status = ANY (ARRAY['aberto'::text, 'enviado'::text, 'processado'::text, 'fechado'::text])));

ALTER TABLE public.maintenance_inventory_items ADD CONSTRAINT maintenance_inventory_items_pkey PRIMARY KEY (id);

ALTER TABLE public.maintenance_inventory_items ADD CONSTRAINT maintenance_inventory_items_quantity_check CHECK ((quantity > 0));

ALTER TABLE public.maintenance_requests ADD CONSTRAINT maintenance_requests_codigo_key UNIQUE (codigo);

ALTER TABLE public.maintenance_requests ADD CONSTRAINT maintenance_requests_pkey PRIMARY KEY (id);

ALTER TABLE public.maintenance_requests ADD CONSTRAINT maintenance_requests_prioridade_check CHECK ((prioridade = ANY (ARRAY['urgent'::text, 'priority'::text, 'common'::text])));

ALTER TABLE public.maintenance_requests ADD CONSTRAINT maintenance_requests_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'in_progress'::text, 'completed'::text, 'cancelled'::text])));

ALTER TABLE public.message_retry_queue ADD CONSTRAINT message_retry_queue_message_id_key UNIQUE (message_id);

ALTER TABLE public.message_retry_queue ADD CONSTRAINT message_retry_queue_pkey PRIMARY KEY (id);

ALTER TABLE public.message_templates ADD CONSTRAINT message_templates_code_key UNIQUE (code);

ALTER TABLE public.message_templates ADD CONSTRAINT message_templates_pkey PRIMARY KEY (id);

ALTER TABLE public.messaging_providers ADD CONSTRAINT messaging_providers_code_key UNIQUE (code);

ALTER TABLE public.messaging_providers ADD CONSTRAINT messaging_providers_health_status_check CHECK (((health_status)::text = ANY ((ARRAY['online'::character varying, 'offline'::character varying, 'error'::character varying, 'unknown'::character varying])::text[])));

ALTER TABLE public.messaging_providers ADD CONSTRAINT messaging_providers_pkey PRIMARY KEY (id);

ALTER TABLE public.messaging_providers ADD CONSTRAINT messaging_providers_type_check CHECK (((type)::text = ANY ((ARRAY['whatsapp'::character varying, 'email'::character varying, 'sms'::character varying, 'api'::character varying])::text[])));

ALTER TABLE public.module_categories ADD CONSTRAINT module_categories_pkey PRIMARY KEY (id);

ALTER TABLE public.nota_lote ADD CONSTRAINT nota_lote_pkey PRIMARY KEY (id_nota, id_lote);

ALTER TABLE public.notas ADD CONSTRAINT notas_aplis_id_key UNIQUE (aplis_id);

ALTER TABLE public.notas ADD CONSTRAINT notas_pkey PRIMARY KEY (id_nota);

ALTER TABLE public.notas ADD CONSTRAINT notas_status_check CHECK ((status = ANY (ARRAY['aberta'::text, 'parcialmente_recebida'::text, 'recebida'::text, 'glosada'::text, 'cancelada'::text])));

ALTER TABLE public.notification_templates ADD CONSTRAINT notification_templates_pkey PRIMARY KEY (id);

ALTER TABLE public.notification_templates ADD CONSTRAINT notification_templates_slug_key UNIQUE (slug);

ALTER TABLE public.operadoras ADD CONSTRAINT operadoras_aplis_id_key UNIQUE (aplis_id);

ALTER TABLE public.operadoras ADD CONSTRAINT operadoras_cnpj_key UNIQUE (cnpj);

ALTER TABLE public.operadoras ADD CONSTRAINT operadoras_pkey PRIMARY KEY (id_operadora);

ALTER TABLE public.payment_requests ADD CONSTRAINT payment_requests_forma_pagamento_check CHECK ((forma_pagamento = ANY (ARRAY['PIX'::text, 'DINHEIRO'::text, 'BOLETO'::text, 'CAJU'::text, 'SOLIDES'::text])));

ALTER TABLE public.payment_requests ADD CONSTRAINT payment_requests_pkey PRIMARY KEY (id);

ALTER TABLE public.payment_requests ADD CONSTRAINT payment_requests_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text, 'paid'::text, 'cancelled'::text])));

ALTER TABLE public.payment_requests ADD CONSTRAINT payment_requests_tipo_solicitacao_check CHECK ((tipo_solicitacao = ANY (ARRAY['PAGAMENTO'::text, 'REEMBOLSO'::text, 'ADIANTAMENTO'::text])));

ALTER TABLE public.product_change_logs ADD CONSTRAINT product_change_logs_pkey PRIMARY KEY (id);

ALTER TABLE public.product_stock ADD CONSTRAINT product_stock_pkey PRIMARY KEY (product_id, location_id);

ALTER TABLE public.product_stock ADD CONSTRAINT product_stock_quantity_check CHECK ((quantity >= 0));

ALTER TABLE public.products ADD CONSTRAINT products_code_key UNIQUE (code);

ALTER TABLE public.products ADD CONSTRAINT products_pkey PRIMARY KEY (id);

ALTER TABLE public.products ADD CONSTRAINT products_status_check CHECK ((status = ANY (ARRAY['active'::text, 'low-stock'::text, 'expired'::text])));

ALTER TABLE public.provider_health_logs ADD CONSTRAINT provider_health_logs_pkey PRIMARY KEY (id);

ALTER TABLE public.provider_health_logs ADD CONSTRAINT provider_health_logs_status_check CHECK (((status)::text = ANY ((ARRAY['healthy'::character varying, 'degraded'::character varying, 'unhealthy'::character varying])::text[])));

ALTER TABLE public.quotation_approvals ADD CONSTRAINT quotation_approvals_level_check CHECK (((level)::text = ANY ((ARRAY['level_1'::character varying, 'level_2'::character varying, 'level_3'::character varying, 'level_4'::character varying])::text[])));

ALTER TABLE public.quotation_approvals ADD CONSTRAINT quotation_approvals_pkey PRIMARY KEY (id);

ALTER TABLE public.quotation_approvals ADD CONSTRAINT quotation_approvals_status_check CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'approved'::character varying, 'rejected'::character varying])::text[])));

ALTER TABLE public.quotation_audit_logs ADD CONSTRAINT quotation_audit_logs_pkey PRIMARY KEY (id);

ALTER TABLE public.quotation_invited_suppliers ADD CONSTRAINT quotation_invited_suppliers_pkey PRIMARY KEY (id);

ALTER TABLE public.quotation_invited_suppliers ADD CONSTRAINT quotation_invited_suppliers_status_check CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'responded'::character varying, 'declined'::character varying, 'no_response'::character varying])::text[])));

ALTER TABLE public.quotation_invited_suppliers ADD CONSTRAINT quotation_invited_suppliers_unique UNIQUE (quotation_id, supplier_id);

ALTER TABLE public.quotation_items ADD CONSTRAINT quotation_items_pkey PRIMARY KEY (id);

ALTER TABLE public.quotation_items ADD CONSTRAINT quotation_items_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'submitted'::text, 'selected'::text, 'rejected'::text])));

ALTER TABLE public.quotation_messages ADD CONSTRAINT quotation_messages_pkey PRIMARY KEY (id);

ALTER TABLE public.quotation_messages ADD CONSTRAINT quotation_messages_status_check CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'sending'::character varying, 'sent'::character varying, 'failed'::character varying, 'delivered'::character varying, 'read'::character varying])::text[])));

ALTER TABLE public.quotation_proposal_items ADD CONSTRAINT quotation_proposal_items_pkey PRIMARY KEY (id);

ALTER TABLE public.quotation_proposal_items ADD CONSTRAINT quotation_proposal_items_unique UNIQUE (proposal_id, quotation_item_id);

ALTER TABLE public.quotation_proposals ADD CONSTRAINT quotation_proposals_payment_method_check CHECK (((payment_method IS NULL) OR ((payment_method)::text = ANY ((ARRAY['pix'::character varying, 'credit_card'::character varying, 'boleto'::character varying])::text[]))));

ALTER TABLE public.quotation_proposals ADD CONSTRAINT quotation_proposals_pkey PRIMARY KEY (id);

ALTER TABLE public.quotation_proposals ADD CONSTRAINT quotation_proposals_status_check CHECK (((status)::text = ANY ((ARRAY['submitted'::character varying, 'under_review'::character varying, 'selected'::character varying, 'rejected'::character varying])::text[])));

ALTER TABLE public.quotation_proposals ADD CONSTRAINT quotation_proposals_unique UNIQUE (quotation_id, supplier_id);

ALTER TABLE public.quotations ADD CONSTRAINT quotations_approval_level_check CHECK (((required_approval_level IS NULL) OR ((required_approval_level)::text = ANY ((ARRAY['level_1'::character varying, 'level_2'::character varying, 'level_3'::character varying, 'level_4'::character varying])::text[]))));

ALTER TABLE public.quotations ADD CONSTRAINT quotations_code_key UNIQUE (code);

ALTER TABLE public.quotations ADD CONSTRAINT quotations_pkey PRIMARY KEY (id);

ALTER TABLE public.quotations ADD CONSTRAINT quotations_priority_check CHECK (((priority)::text = ANY ((ARRAY['low'::character varying, 'medium'::character varying, 'high'::character varying, 'urgent'::character varying])::text[])));

ALTER TABLE public.quotations ADD CONSTRAINT quotations_unique_request_product UNIQUE (request_id, product_id);

ALTER TABLE public.recebimentos ADD CONSTRAINT recebimentos_pkey PRIMARY KEY (id_receb);

ALTER TABLE public.recebimentos ADD CONSTRAINT recebimentos_status_check CHECK ((status = ANY (ARRAY['previsto'::text, 'recebido'::text, 'parcial'::text, 'cancelado'::text])));

ALTER TABLE public.request_attachments ADD CONSTRAINT request_attachments_pkey PRIMARY KEY (id);

ALTER TABLE public.request_messages ADD CONSTRAINT request_messages_pkey PRIMARY KEY (id);

ALTER TABLE public.request_periods ADD CONSTRAINT request_periods_end_day_check CHECK (((end_day >= 1) AND (end_day <= 31)));

ALTER TABLE public.request_periods ADD CONSTRAINT request_periods_pkey PRIMARY KEY (id);

ALTER TABLE public.request_periods ADD CONSTRAINT request_periods_start_day_check CHECK (((start_day >= 1) AND (start_day <= 31)));

ALTER TABLE public.request_periods ADD CONSTRAINT unique_department UNIQUE (department);

ALTER TABLE public.requests ADD CONSTRAINT requests_pkey PRIMARY KEY (id);

ALTER TABLE public.requests ADD CONSTRAINT requests_priority_check CHECK ((priority = ANY (ARRAY['low'::text, 'standard'::text, 'priority'::text, 'urgent'::text])));

ALTER TABLE public.requests ADD CONSTRAINT requests_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text, 'completed'::text])));

ALTER TABLE public.requests ADD CONSTRAINT requests_type_check CHECK ((type = ANY (ARRAY['SC'::text, 'SM'::text])));

ALTER TABLE public.requisicoes ADD CONSTRAINT requisicoes_aplis_id_key UNIQUE (aplis_id);

ALTER TABLE public.requisicoes ADD CONSTRAINT requisicoes_pkey PRIMARY KEY (id_requisicao);

ALTER TABLE public.requisicoes ADD CONSTRAINT requisicoes_status_check CHECK ((status = ANY (ARRAY['pendente'::text, 'em_lote'::text, 'faturada'::text, 'paga'::text, 'glosada'::text])));

ALTER TABLE public.stock_locations ADD CONSTRAINT ck_stock_locations_consumo_rastreavel CHECK (((NOT controla_consumo) OR rastreavel));

ALTER TABLE public.stock_locations ADD CONSTRAINT stock_locations_pkey PRIMARY KEY (id);

ALTER TABLE public.stock_locations ADD CONSTRAINT uq_stock_locations_nome UNIQUE (nome);

ALTER TABLE public.stock_movements ADD CONSTRAINT stock_movements_pkey PRIMARY KEY (id);

ALTER TABLE public.stock_movements ADD CONSTRAINT stock_movements_quantity_check CHECK ((quantity > 0));

ALTER TABLE public.stock_movements ADD CONSTRAINT stock_movements_reason_check CHECK ((reason = ANY (ARRAY['sale'::text, 'internal-transfer'::text, 'return'::text, 'internal-consumption'::text, 'manutencao'::text, 'other'::text, 'purchase'::text])));

ALTER TABLE public.stock_movements ADD CONSTRAINT stock_movements_type_check CHECK ((type = ANY (ARRAY['out'::text, 'in'::text, 'transfer'::text])));

ALTER TABLE public.suppliers ADD CONSTRAINT suppliers_id_key UNIQUE (id);

ALTER TABLE public.suppliers ADD CONSTRAINT suppliers_pkey PRIMARY KEY (id);

ALTER TABLE public.suppliers ADD CONSTRAINT suppliers_status_check CHECK ((status = ANY (ARRAY['active'::text, 'inactive'::text])));

ALTER TABLE public.user_approval_limits ADD CONSTRAINT user_approval_limits_level_check CHECK (((approval_level)::text = ANY ((ARRAY['none'::character varying, 'level_1'::character varying, 'level_2'::character varying, 'level_3'::character varying, 'level_4'::character varying])::text[])));

ALTER TABLE public.user_approval_limits ADD CONSTRAINT user_approval_limits_pkey PRIMARY KEY (id);

ALTER TABLE public.user_approval_limits ADD CONSTRAINT user_approval_limits_unique_user UNIQUE (user_id);

ALTER TABLE public.user_notifications ADD CONSTRAINT user_notifications_pkey PRIMARY KEY (id);

ALTER TABLE public.user_profiles ADD CONSTRAINT user_profiles_cpf_key UNIQUE (cpf);

ALTER TABLE public.user_profiles ADD CONSTRAINT user_profiles_pkey PRIMARY KEY (id);

ALTER TABLE public.user_profiles ADD CONSTRAINT user_profiles_role_check CHECK ((role = ANY (ARRAY['admin'::text, 'operator'::text, 'requester'::text])));

ALTER TABLE public.user_whitelist ADD CONSTRAINT user_whitelist_pkey PRIMARY KEY (cpf);

ALTER TABLE public.ac_agendamentos ADD CONSTRAINT ac_agendamentos_posto_id_fkey FOREIGN KEY (posto_id) REFERENCES ac_postos(id) ON DELETE SET NULL;

ALTER TABLE public.ac_dias_excecao ADD CONSTRAINT ac_dias_excecao_posto_id_fkey FOREIGN KEY (posto_id) REFERENCES ac_postos(id) ON DELETE CASCADE;

ALTER TABLE public.ac_horarios_padrao ADD CONSTRAINT ac_horarios_padrao_posto_id_fkey FOREIGN KEY (posto_id) REFERENCES ac_postos(id) ON DELETE CASCADE;

ALTER TABLE public.ac_resultados ADD CONSTRAINT ac_resultados_agendamento_id_fkey FOREIGN KEY (agendamento_id) REFERENCES ac_agendamentos(id) ON DELETE CASCADE;

ALTER TABLE public.glosas ADD CONSTRAINT glosas_nota_id_fkey FOREIGN KEY (nota_id) REFERENCES notas(id_nota) ON DELETE SET NULL;

ALTER TABLE public.glosas ADD CONSTRAINT glosas_recebimento_id_fkey FOREIGN KEY (recebimento_id) REFERENCES recebimentos(id_receb) ON DELETE CASCADE;

ALTER TABLE public.glosas ADD CONSTRAINT glosas_requisicao_id_fkey FOREIGN KEY (requisicao_id) REFERENCES requisicoes(id_requisicao) ON DELETE SET NULL;

ALTER TABLE public.it_project_visions ADD CONSTRAINT it_project_visions_project_id_fkey FOREIGN KEY (project_id) REFERENCES it_projects(id) ON DELETE CASCADE;

ALTER TABLE public.it_projects ADD CONSTRAINT it_projects_created_by_fkey FOREIGN KEY (created_by) REFERENCES user_profiles(id) ON DELETE RESTRICT;

ALTER TABLE public.it_requests ADD CONSTRAINT it_requests_project_id_fkey FOREIGN KEY (project_id) REFERENCES it_projects(id) ON DELETE SET NULL;

ALTER TABLE public.it_requests ADD CONSTRAINT it_requests_requested_by_fkey FOREIGN KEY (requested_by) REFERENCES user_profiles(id) ON DELETE RESTRICT;

ALTER TABLE public.it_requests ADD CONSTRAINT it_requests_sprint_id_fkey FOREIGN KEY (sprint_id) REFERENCES it_sprints(id) ON DELETE SET NULL;

ALTER TABLE public.it_sprints ADD CONSTRAINT it_sprints_project_id_fkey FOREIGN KEY (project_id) REFERENCES it_projects(id) ON DELETE CASCADE;

ALTER TABLE public.it_task_attachments ADD CONSTRAINT it_task_attachments_task_id_fkey FOREIGN KEY (task_id) REFERENCES it_requests(id) ON DELETE CASCADE;

ALTER TABLE public.it_task_attachments ADD CONSTRAINT it_task_attachments_user_id_fkey FOREIGN KEY (user_id) REFERENCES user_profiles(id) ON DELETE CASCADE;

ALTER TABLE public.it_task_comments ADD CONSTRAINT it_task_comments_task_id_fkey FOREIGN KEY (task_id) REFERENCES it_requests(id) ON DELETE CASCADE;

ALTER TABLE public.it_task_comments ADD CONSTRAINT it_task_comments_user_id_fkey FOREIGN KEY (user_id) REFERENCES user_profiles(id) ON DELETE CASCADE;

ALTER TABLE public.lotes ADD CONSTRAINT lotes_operadora_id_fkey FOREIGN KEY (operadora_id) REFERENCES operadoras(id_operadora) ON DELETE CASCADE;

ALTER TABLE public.maintenance_inventory_items ADD CONSTRAINT maintenance_inventory_items_maintenance_request_id_fkey FOREIGN KEY (maintenance_request_id) REFERENCES maintenance_requests(id) ON DELETE CASCADE;

ALTER TABLE public.maintenance_inventory_items ADD CONSTRAINT maintenance_inventory_items_movement_id_fkey FOREIGN KEY (movement_id) REFERENCES stock_movements(id) ON DELETE SET NULL;

ALTER TABLE public.maintenance_inventory_items ADD CONSTRAINT maintenance_inventory_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT;

ALTER TABLE public.maintenance_requests ADD CONSTRAINT maintenance_requests_requester_id_fkey FOREIGN KEY (requester_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.message_retry_queue ADD CONSTRAINT message_retry_queue_message_id_fkey FOREIGN KEY (message_id) REFERENCES quotation_messages(id) ON DELETE CASCADE;

ALTER TABLE public.nota_lote ADD CONSTRAINT nota_lote_id_lote_fkey FOREIGN KEY (id_lote) REFERENCES lotes(id_lote) ON DELETE CASCADE;

ALTER TABLE public.nota_lote ADD CONSTRAINT nota_lote_id_nota_fkey FOREIGN KEY (id_nota) REFERENCES notas(id_nota) ON DELETE CASCADE;

ALTER TABLE public.notas ADD CONSTRAINT notas_operadora_id_fkey FOREIGN KEY (operadora_id) REFERENCES operadoras(id_operadora) ON DELETE CASCADE;

ALTER TABLE public.product_stock ADD CONSTRAINT product_stock_location_id_fkey FOREIGN KEY (location_id) REFERENCES stock_locations(id) ON DELETE RESTRICT;

ALTER TABLE public.product_stock ADD CONSTRAINT product_stock_product_id_fkey FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE;

ALTER TABLE public.provider_health_logs ADD CONSTRAINT provider_health_logs_provider_id_fkey FOREIGN KEY (provider_id) REFERENCES messaging_providers(id) ON DELETE CASCADE;

ALTER TABLE public.quotation_approvals ADD CONSTRAINT quotation_approvals_approver_id_fkey FOREIGN KEY (approver_id) REFERENCES user_profiles(id);

ALTER TABLE public.quotation_approvals ADD CONSTRAINT quotation_approvals_quotation_id_fkey FOREIGN KEY (quotation_id) REFERENCES quotations(id) ON DELETE CASCADE;

ALTER TABLE public.quotation_audit_logs ADD CONSTRAINT quotation_audit_logs_quotation_id_fkey FOREIGN KEY (quotation_id) REFERENCES quotations(id) ON DELETE CASCADE;

ALTER TABLE public.quotation_invited_suppliers ADD CONSTRAINT quotation_invited_suppliers_quotation_id_fkey FOREIGN KEY (quotation_id) REFERENCES quotations(id) ON DELETE CASCADE;

ALTER TABLE public.quotation_invited_suppliers ADD CONSTRAINT quotation_invited_suppliers_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE CASCADE;

ALTER TABLE public.quotation_items ADD CONSTRAINT quotation_items_quotation_id_fkey FOREIGN KEY (quotation_id) REFERENCES quotations(id) ON DELETE CASCADE;

ALTER TABLE public.quotation_items ADD CONSTRAINT quotation_items_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE CASCADE;

ALTER TABLE public.quotation_messages ADD CONSTRAINT quotation_messages_provider_id_fkey FOREIGN KEY (provider_id) REFERENCES messaging_providers(id);

ALTER TABLE public.quotation_messages ADD CONSTRAINT quotation_messages_quotation_id_fkey FOREIGN KEY (quotation_id) REFERENCES quotations(id) ON DELETE CASCADE;

ALTER TABLE public.quotation_messages ADD CONSTRAINT quotation_messages_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE CASCADE;

ALTER TABLE public.quotation_messages ADD CONSTRAINT quotation_messages_template_id_fkey FOREIGN KEY (template_id) REFERENCES message_templates(id);

ALTER TABLE public.quotation_proposal_items ADD CONSTRAINT quotation_proposal_items_proposal_id_fkey FOREIGN KEY (proposal_id) REFERENCES quotation_proposals(id) ON DELETE CASCADE;

ALTER TABLE public.quotation_proposals ADD CONSTRAINT quotation_proposals_quotation_id_fkey FOREIGN KEY (quotation_id) REFERENCES quotations(id) ON DELETE CASCADE;

ALTER TABLE public.quotation_proposals ADD CONSTRAINT quotation_proposals_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE CASCADE;

ALTER TABLE public.recebimentos ADD CONSTRAINT recebimentos_lote_id_fkey FOREIGN KEY (lote_id) REFERENCES lotes(id_lote) ON DELETE SET NULL;

ALTER TABLE public.recebimentos ADD CONSTRAINT recebimentos_nota_id_fkey FOREIGN KEY (nota_id) REFERENCES notas(id_nota) ON DELETE SET NULL;

ALTER TABLE public.request_attachments ADD CONSTRAINT request_attachments_request_id_fkey FOREIGN KEY (request_id) REFERENCES requests(id) ON DELETE CASCADE;

ALTER TABLE public.request_messages ADD CONSTRAINT request_messages_author_id_fkey FOREIGN KEY (author_id) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.request_messages ADD CONSTRAINT request_messages_request_id_fkey FOREIGN KEY (request_id) REFERENCES requests(id) ON DELETE CASCADE;

ALTER TABLE public.requisicoes ADD CONSTRAINT requisicoes_lote_id_fkey FOREIGN KEY (lote_id) REFERENCES lotes(id_lote) ON DELETE SET NULL;

ALTER TABLE public.stock_locations ADD CONSTRAINT stock_locations_posto_id_fkey FOREIGN KEY (posto_id) REFERENCES ac_postos(id);

ALTER TABLE public.stock_movements ADD CONSTRAINT stock_movements_from_location_id_fkey FOREIGN KEY (from_location_id) REFERENCES stock_locations(id);

ALTER TABLE public.stock_movements ADD CONSTRAINT stock_movements_product_id_fkey FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE;

ALTER TABLE public.stock_movements ADD CONSTRAINT stock_movements_to_location_id_fkey FOREIGN KEY (to_location_id) REFERENCES stock_locations(id);

ALTER TABLE public.user_approval_limits ADD CONSTRAINT user_approval_limits_created_by_fkey FOREIGN KEY (created_by) REFERENCES user_profiles(id);

ALTER TABLE public.user_approval_limits ADD CONSTRAINT user_approval_limits_user_id_fkey FOREIGN KEY (user_id) REFERENCES user_profiles(id) ON DELETE CASCADE;

ALTER TABLE public.user_notifications ADD CONSTRAINT user_notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES user_profiles(id) ON DELETE CASCADE;

ALTER TABLE public.user_profiles ADD CONSTRAINT fk_user_profiles_cpf FOREIGN KEY (cpf) REFERENCES user_whitelist(cpf);

ALTER TABLE public.user_profiles ADD CONSTRAINT user_profiles_custom_role_id_fkey FOREIGN KEY (custom_role_id) REFERENCES custom_roles(id) ON DELETE SET NULL;

ALTER TABLE public.user_profiles ADD CONSTRAINT user_profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;

CREATE INDEX idx_ac_agendamentos_data_posto ON public.ac_agendamentos USING btree (data_hora, local_posto);

CREATE INDEX idx_ac_dias_excecao_posto_data ON public.ac_dias_excecao USING btree (posto_id, data);

CREATE INDEX idx_ac_horarios_padrao_posto ON public.ac_horarios_padrao USING btree (posto_id);

CREATE INDEX idx_ac_resultados_agendamento ON public.ac_resultados USING btree (agendamento_id);

CREATE INDEX idx_billing_sync_log_started ON public.billing_sync_log USING btree (started_at);

CREATE INDEX idx_billing_sync_log_status ON public.billing_sync_log USING btree (status);

CREATE INDEX idx_billing_sync_log_type ON public.billing_sync_log USING btree (sync_type);

CREATE INDEX idx_custom_roles_is_system ON public.custom_roles USING btree (is_system);

CREATE INDEX idx_custom_roles_name ON public.custom_roles USING btree (name);

CREATE INDEX idx_custom_roles_permissions ON public.custom_roles USING gin (permissions);

CREATE INDEX idx_glosas_nota ON public.glosas USING btree (nota_id);

CREATE INDEX idx_glosas_recebimento ON public.glosas USING btree (recebimento_id);

CREATE INDEX idx_glosas_recurso ON public.glosas USING btree (recurso);

CREATE INDEX idx_glosas_status ON public.glosas USING btree (status);

CREATE INDEX idx_it_project_visions_project_id ON public.it_project_visions USING btree (project_id);

CREATE INDEX idx_it_projects_created_at ON public.it_projects USING btree (created_at DESC);

CREATE INDEX idx_it_projects_created_by ON public.it_projects USING btree (created_by);

CREATE INDEX idx_it_requests_assigned_to ON public.it_requests USING gin (assigned_to);

CREATE INDEX idx_it_requests_created_at ON public.it_requests USING btree (created_at DESC);

CREATE INDEX idx_it_requests_kanban_hidden ON public.it_requests USING btree (kanban_hidden);

CREATE INDEX idx_it_requests_kanban_status ON public.it_requests USING btree (kanban_status);

CREATE INDEX idx_it_requests_priority ON public.it_requests USING btree (priority);

CREATE INDEX idx_it_requests_project_id ON public.it_requests USING btree (project_id);

CREATE INDEX idx_it_requests_requested_by ON public.it_requests USING btree (requested_by);

CREATE INDEX idx_it_requests_sprint_id ON public.it_requests USING btree (sprint_id);

CREATE INDEX idx_it_requests_status ON public.it_requests USING btree (status);

CREATE INDEX idx_it_requests_tags ON public.it_requests USING gin (tags);

CREATE INDEX idx_it_sprints_project_id ON public.it_sprints USING btree (project_id);

CREATE INDEX idx_it_sprints_status ON public.it_sprints USING btree (status);

CREATE INDEX idx_it_task_attachments_task_id ON public.it_task_attachments USING btree (task_id);

CREATE INDEX idx_it_task_attachments_user_id ON public.it_task_attachments USING btree (user_id);

CREATE INDEX idx_it_task_comments_task_id ON public.it_task_comments USING btree (task_id);

CREATE INDEX idx_it_task_comments_user_id ON public.it_task_comments USING btree (user_id);

CREATE INDEX idx_lotes_aplis_id ON public.lotes USING btree (aplis_id);

CREATE INDEX idx_lotes_data_criacao ON public.lotes USING btree (data_criacao);

CREATE INDEX idx_lotes_operadora ON public.lotes USING btree (operadora_id);

CREATE INDEX idx_lotes_status ON public.lotes USING btree (status);

CREATE INDEX idx_maintenance_inventory_items_movement_id ON public.maintenance_inventory_items USING btree (movement_id);

CREATE INDEX idx_maintenance_inventory_items_product_id ON public.maintenance_inventory_items USING btree (product_id);

CREATE INDEX idx_maintenance_inventory_items_request_id ON public.maintenance_inventory_items USING btree (maintenance_request_id);

CREATE INDEX idx_maintenance_requests_created_at ON public.maintenance_requests USING btree (created_at);

CREATE INDEX idx_maintenance_requests_data_identificacao ON public.maintenance_requests USING btree (data_identificacao);

CREATE INDEX idx_maintenance_requests_department ON public.maintenance_requests USING btree (department);

CREATE INDEX idx_maintenance_requests_prioridade ON public.maintenance_requests USING btree (prioridade);

CREATE INDEX idx_maintenance_requests_requester_id ON public.maintenance_requests USING btree (requester_id);

CREATE INDEX idx_maintenance_requests_status ON public.maintenance_requests USING btree (status);

CREATE INDEX idx_message_retry_queue_next_retry ON public.message_retry_queue USING btree (next_retry_at);

CREATE INDEX idx_message_retry_queue_priority ON public.message_retry_queue USING btree (priority DESC, next_retry_at);

CREATE INDEX idx_module_categories_sort ON public.module_categories USING btree (sort_order);

CREATE INDEX idx_nota_lote_lote ON public.nota_lote USING btree (id_lote);

CREATE INDEX idx_nota_lote_nota ON public.nota_lote USING btree (id_nota);

CREATE INDEX idx_notas_aplis_id ON public.notas USING btree (aplis_id);

CREATE INDEX idx_notas_data_emissao ON public.notas USING btree (data_emissao);

CREATE INDEX idx_notas_data_vencimento ON public.notas USING btree (data_vencimento);

CREATE INDEX idx_notas_operadora ON public.notas USING btree (operadora_id);

CREATE INDEX idx_notas_status ON public.notas USING btree (status);

CREATE INDEX idx_notification_templates_slug ON public.notification_templates USING btree (slug);

CREATE INDEX idx_operadoras_aplis_id ON public.operadoras USING btree (aplis_id);

CREATE INDEX idx_operadoras_nome ON public.operadoras USING btree (nome);

CREATE INDEX idx_payment_requests_created_at ON public.payment_requests USING btree (created_at);

CREATE INDEX idx_payment_requests_data_pagamento ON public.payment_requests USING btree (data_pagamento);

CREATE INDEX idx_payment_requests_department ON public.payment_requests USING btree (department);

CREATE INDEX idx_payment_requests_solicitado_por ON public.payment_requests USING btree (solicitado_por);

CREATE INDEX idx_payment_requests_status ON public.payment_requests USING btree (status);

CREATE INDEX idx_product_change_logs_change_date ON public.product_change_logs USING btree (change_date);

CREATE INDEX idx_product_change_logs_created_at ON public.product_change_logs USING btree (created_at);

CREATE INDEX idx_product_change_logs_product_id ON public.product_change_logs USING btree (product_id);

CREATE INDEX idx_product_stock_location ON public.product_stock USING btree (location_id);

CREATE INDEX idx_products_category ON public.products USING btree (category);

CREATE INDEX idx_products_code ON public.products USING btree (code);

CREATE INDEX idx_products_expiration_date ON public.products USING btree (expiration_date);

CREATE INDEX idx_products_status ON public.products USING btree (status);

CREATE INDEX idx_provider_health_logs_provider ON public.provider_health_logs USING btree (provider_id, created_at DESC);

CREATE INDEX idx_quotation_approvals_approver ON public.quotation_approvals USING btree (approver_id);

CREATE INDEX idx_quotation_approvals_quotation ON public.quotation_approvals USING btree (quotation_id);

CREATE INDEX idx_quotation_approvals_status ON public.quotation_approvals USING btree (quotation_id, status);

CREATE INDEX idx_quotation_audit_logs_action ON public.quotation_audit_logs USING btree (action);

CREATE INDEX idx_quotation_audit_logs_performed_at ON public.quotation_audit_logs USING btree (performed_at DESC);

CREATE INDEX idx_quotation_audit_logs_quotation ON public.quotation_audit_logs USING btree (quotation_id);

CREATE INDEX idx_quotation_invited_suppliers_quotation ON public.quotation_invited_suppliers USING btree (quotation_id);

CREATE INDEX idx_quotation_invited_suppliers_supplier ON public.quotation_invited_suppliers USING btree (supplier_id);

CREATE INDEX idx_quotation_messages_failed ON public.quotation_messages USING btree (quotation_id, status) WHERE ((status)::text = 'failed'::text);

CREATE INDEX idx_quotation_messages_quotation ON public.quotation_messages USING btree (quotation_id);

CREATE INDEX idx_quotation_messages_status ON public.quotation_messages USING btree (status, created_at DESC);

CREATE INDEX idx_quotation_messages_supplier ON public.quotation_messages USING btree (supplier_id);

CREATE INDEX idx_quotation_proposal_items_proposal ON public.quotation_proposal_items USING btree (proposal_id);

CREATE INDEX idx_quotation_proposals_quotation ON public.quotation_proposals USING btree (quotation_id);

CREATE INDEX idx_quotation_proposals_supplier ON public.quotation_proposals USING btree (supplier_id);

CREATE INDEX idx_quotation_proposals_winner ON public.quotation_proposals USING btree (quotation_id, is_winner) WHERE (is_winner = true);

CREATE INDEX idx_recebimentos_data_prevista ON public.recebimentos USING btree (data_prevista);

CREATE INDEX idx_recebimentos_data_receb ON public.recebimentos USING btree (data_receb);

CREATE INDEX idx_recebimentos_lote ON public.recebimentos USING btree (lote_id);

CREATE INDEX idx_recebimentos_nota ON public.recebimentos USING btree (nota_id);

CREATE INDEX idx_recebimentos_status ON public.recebimentos USING btree (status);

CREATE INDEX idx_requests_department ON public.requests USING btree (department);

CREATE INDEX idx_requests_priority ON public.requests USING btree (priority);

CREATE INDEX idx_requests_request_date ON public.requests USING btree (request_date);

CREATE INDEX idx_requests_status ON public.requests USING btree (status);

CREATE INDEX idx_requests_supplier_id ON public.requests USING btree (supplier_id);

CREATE INDEX idx_requisicoes_aplis_id ON public.requisicoes USING btree (aplis_id);

CREATE INDEX idx_requisicoes_data_criacao ON public.requisicoes USING btree (data_criacao);

CREATE INDEX idx_requisicoes_lote ON public.requisicoes USING btree (lote_id);

CREATE INDEX idx_requisicoes_status ON public.requisicoes USING btree (status);

CREATE INDEX idx_stock_movements_date ON public.stock_movements USING btree (date);

CREATE INDEX idx_stock_movements_from_location ON public.stock_movements USING btree (from_location_id);

CREATE INDEX idx_stock_movements_product_id ON public.stock_movements USING btree (product_id);

CREATE INDEX idx_stock_movements_reason ON public.stock_movements USING btree (reason);

CREATE INDEX idx_stock_movements_to_location ON public.stock_movements USING btree (to_location_id);

CREATE INDEX idx_user_approval_limits_can_approve ON public.user_approval_limits USING btree (can_approve) WHERE (can_approve = true);

CREATE INDEX idx_user_approval_limits_user ON public.user_approval_limits USING btree (user_id);

CREATE INDEX idx_user_notifications_created_at ON public.user_notifications USING btree (user_id, created_at DESC);

CREATE INDEX idx_user_notifications_user_id ON public.user_notifications USING btree (user_id);

CREATE INDEX idx_user_notifications_user_unread ON public.user_notifications USING btree (user_id, is_read) WHERE (is_read = false);

CREATE INDEX idx_user_profiles_custom_role_id ON public.user_profiles USING btree (custom_role_id);

CREATE INDEX idx_user_profiles_department ON public.user_profiles USING btree (department);

CREATE INDEX idx_user_profiles_email ON public.user_profiles USING btree (email);

CREATE INDEX idx_user_profiles_role ON public.user_profiles USING btree (role);

CREATE INDEX request_messages_created_at_idx ON public.request_messages USING btree (created_at);

CREATE INDEX request_messages_request_id_idx ON public.request_messages USING btree (request_id);

CREATE UNIQUE INDEX idx_it_sprints_one_active_per_project ON public.it_sprints USING btree (project_id) WHERE ((status)::text = 'active'::text);

CREATE UNIQUE INDEX uq_stock_locations_principal ON public.stock_locations USING btree (is_principal) WHERE is_principal;

CREATE OR REPLACE FUNCTION public.ac_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
NEW.updated_at = NOW();
RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.calculate_quotation_savings(quotation_id uuid)
RETURNS numeric
LANGUAGE plpgsql
AS $function$
DECLARE
highest_price DECIMAL;
selected_price DECIMAL;
BEGIN
SELECT
MAX(total_amount),
(SELECT total_amount FROM quotation_proposals WHERE quotation_proposals.quotation_id = $1 AND is_winner = TRUE)
INTO highest_price, selected_price
FROM quotation_proposals
WHERE quotation_proposals.quotation_id = $1;

IF highest_price IS NULL OR selected_price IS NULL OR highest_price = 0 THEN
RETURN 0;
END IF;

RETURN ((highest_price - selected_price) / highest_price) * 100;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.cleanup_retry_queue()
RETURNS void
LANGUAGE plpgsql
AS $function$
BEGIN
DELETE FROM message_retry_queue
WHERE message_id IN (
SELECT mrq.message_id
FROM message_retry_queue mrq
JOIN quotation_messages qm ON qm.id = mrq.message_id
WHERE qm.attempt_count >= qm.max_attempts
OR qm.status IN ('sent', 'delivered', 'read')
);
END;
$function$
;

CREATE OR REPLACE FUNCTION public.create_user_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
begin
insert into public.user_profiles (id, email, name, role, department)
values (
new.id,
new.email,
coalesce(new.raw_user_meta_data->>'name', new.email),
'requester',
coalesce(new.raw_user_meta_data->>'department', 'Estoque')
);
return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.current_user_has_permission(p_permission text)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
RETURN EXISTS (
SELECT 1
FROM user_profiles p
LEFT JOIN custom_roles cr ON cr.id = p.custom_role_id
WHERE p.id = auth.uid()
AND (
p.role = 'admin' -- fallback: admin legado sem custom_role_id
OR cr.permissions @> to_jsonb(ARRAY[p_permission]) -- sistema de roles dinâmicas
)
);
END;
$function$
;

CREATE OR REPLACE FUNCTION public.generate_maintenance_code()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
next_id INTEGER;
BEGIN
next_id := nextval('maintenance_requests_codigo_seq');
NEW.codigo = 'MNT-' || LPAD(next_id::TEXT, 4, '0');
NEW.updated_at = NOW();
RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.generate_request_id()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
next_id integer;
BEGIN
-- Get the next sequential number
SELECT COALESCE(MAX(CAST(SUBSTRING(id FROM 4) AS integer)), 0) + 1
INTO next_id
FROM requests
WHERE id ~ '^REQ[0-9]+$';

-- Generate the new ID
NEW.id = 'REQ' || LPAD(next_id::text, 3, '0');
NEW.updated_at = now();

RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_it_project_dashboard_metrics(p_project_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
v_result JSON;
v_project_exists BOOLEAN;
BEGIN
-- Verifica se o projeto existe e o caller tem acesso
SELECT EXISTS (
SELECT 1 FROM it_projects WHERE id = p_project_id
) INTO v_project_exists;

IF NOT v_project_exists THEN
RETURN json_build_object('error', 'Projeto não encontrado');
END IF;

SELECT json_build_object(
'project', (
SELECT json_build_object(
'id', p.id,
'name', p.name,
'description', p.description,
'color', p.color,
'created_at', p.created_at,
'updated_at', p.updated_at
)
FROM it_projects p
WHERE p.id = p_project_id
),

    'metrics', (
      SELECT json_build_object(
        'total_tasks',        COALESCE(t.total_tasks, 0),
        'completed_tasks',    COALESCE(t.completed_tasks, 0),
        'total_sprints',      COALESCE(s.total_sprints, 0),
        'completed_sprints',  COALESCE(s.completed_sprints, 0),
        'active_sprints',     COALESCE(s.active_sprints, 0),
        'planned_sprints',    COALESCE(s.planned_sprints, 0)
      )
      FROM
        (
          SELECT
            COUNT(*)                          AS total_tasks,
            COUNT(*) FILTER (WHERE kanban_status = 'done') AS completed_tasks
          FROM it_requests
          WHERE project_id = p_project_id
        ) t
      CROSS JOIN
        (
          SELECT
            COUNT(*)                              AS total_sprints,
            COUNT(*) FILTER (WHERE status = 'completed') AS completed_sprints,
            COUNT(*) FILTER (WHERE status = 'active')   AS active_sprints,
            COUNT(*) FILTER (WHERE status = 'planned')  AS planned_sprints
          FROM it_sprints
          WHERE project_id = p_project_id
        ) s
    ),

    'status_distribution', (
      SELECT COALESCE(
        json_agg(
          json_build_object(
            'kanban_status', sd.kanban_status,
            'count', sd.cnt
          ) ORDER BY sd.kanban_status
        ),
        '[]'::JSON
      )
      FROM (
        SELECT kanban_status, COUNT(*) AS cnt
        FROM it_requests
        WHERE project_id = p_project_id
        GROUP BY kanban_status
      ) sd
    ),

    'sprints_timeline', (
      SELECT COALESCE(
        json_agg(
          json_build_object(
            'id',              sp.id,
            'name',            sp.name,
            'goal',            sp.goal,
            'start_date',      sp.start_date,
            'end_date',        sp.end_date,
            'status',          sp.status,
            'total_tasks',     COALESCE(st.task_count, 0),
            'completed_tasks', COALESCE(st.done_count, 0),
            'progress_pct',    CASE
                                 WHEN COALESCE(st.task_count, 0) = 0 THEN 0
                                 ELSE ROUND(
                                   (COALESCE(st.done_count, 0)::NUMERIC / st.task_count::NUMERIC) * 100
                                 )
                               END
          ) ORDER BY sp.start_date ASC, sp.created_at ASC
        ),
        '[]'::JSON
      )
      FROM it_sprints sp
      LEFT JOIN LATERAL (
        SELECT
          COUNT(*) AS task_count,
          COUNT(*) FILTER (WHERE r.kanban_status = 'done') AS done_count
        FROM it_requests r
        WHERE r.sprint_id = sp.id
      ) st ON true
      WHERE sp.project_id = p_project_id
    ),

    'priority_distribution', (
      SELECT COALESCE(
        json_agg(
          json_build_object(
            'priority', pd.priority,
            'count', pd.cnt
          ) ORDER BY
            CASE pd.priority
              WHEN 'critical' THEN 1
              WHEN 'high'     THEN 2
              WHEN 'medium'   THEN 3
              WHEN 'low'      THEN 4
            END
        ),
        '[]'::JSON
      )
      FROM (
        SELECT priority, COUNT(*) AS cnt
        FROM it_requests
        WHERE project_id = p_project_id
        GROUP BY priority
      ) pd
    ),

    'type_distribution', (
      SELECT COALESCE(
        json_agg(
          json_build_object(
            'request_type', td.request_type,
            'count', td.cnt
          ) ORDER BY td.cnt DESC
        ),
        '[]'::JSON
      )
      FROM (
        SELECT request_type, COUNT(*) AS cnt
        FROM it_requests
        WHERE project_id = p_project_id
        GROUP BY request_type
      ) td
    )

) INTO v_result;

RETURN v_result;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_it_request_tags()
RETURNS TABLE(tag text, count bigint)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
AS $function$
BEGIN
RETURN QUERY
SELECT unnest(ir.tags) as tag, COUNT(*) as count
FROM public.it_requests ir
WHERE ir.status != 'cancelled' AND ir.tags IS NOT NULL AND array_length(ir.tags, 1) > 0
GROUP BY tag
ORDER BY count DESC, tag ASC;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_messages_for_retry()
RETURNS TABLE(message_id uuid, quotation_id uuid, supplier_id uuid, recipient character varying, body text, attempt_count integer, next_retry_at timestamp with time zone)
LANGUAGE plpgsql
AS $function$
BEGIN
RETURN QUERY
SELECT
qm.id,
qm.quotation_id,
qm.supplier_id,
qm.recipient,
qm.body,
qm.attempt_count,
mrq.next_retry_at
FROM quotation_messages qm
INNER JOIN message_retry_queue mrq ON mrq.message_id = qm.id
WHERE mrq.next_retry_at <= NOW()
AND qm.status = 'failed'
AND qm.attempt_count < qm.max_attempts
ORDER BY mrq.priority DESC, mrq.next_retry_at ASC
LIMIT 10;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_quotation_status_label(status text)
RETURNS text
LANGUAGE plpgsql
AS $function$
BEGIN
RETURN CASE status
WHEN 'draft' THEN 'Rascunho'
WHEN 'sent_to_suppliers' THEN 'Enviada aos Fornecedores'
WHEN 'waiting_responses' THEN 'Aguardando Respostas'
WHEN 'under_review' THEN 'Em Análise'
WHEN 'awaiting_approval' THEN 'Aguardando Aprovação'
WHEN 'approved' THEN 'Aprovada'
WHEN 'rejected' THEN 'Rejeitada'
WHEN 'cancelled' THEN 'Cancelada'
WHEN 'converted_to_purchase' THEN 'Convertida em Pedido'
ELSE status
END;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_user_approval_limit(p_user_id uuid)
RETURNS TABLE(approval_level character varying, max_amount numeric, can_approve boolean)
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
RETURN QUERY
SELECT
ual.approval_level,
COALESCE(ual.custom_max_amount, alc.max_amount) as max_amount,
ual.can_approve
FROM user_approval_limits ual
LEFT JOIN approval_level_config alc ON alc.level = ual.approval_level
WHERE ual.user_id = p_user_id;

-- If no record found, return defaults based on user role
IF NOT FOUND THEN
RETURN QUERY
SELECT
CASE
WHEN up.role = 'admin' THEN 'level_4'::VARCHAR(20)
WHEN up.role = 'operator' THEN 'level_1'::VARCHAR(20)
ELSE 'none'::VARCHAR(20)
END,
CASE
WHEN up.role = 'admin' THEN (SELECT alc.max_amount FROM approval_level_config alc WHERE alc.level = 'level_4')
WHEN up.role = 'operator' THEN (SELECT alc.max_amount FROM approval_level_config alc WHERE alc.level = 'level_1')
ELSE 0.00::DECIMAL(15,2)
END,
CASE
WHEN up.role IN ('admin', 'operator') THEN TRUE
ELSE FALSE
END
FROM user_profiles up
WHERE up.id = p_user_id;
END IF;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.is_provider_healthy(provider_id_param uuid)
RETURNS boolean
LANGUAGE plpgsql
AS $function$
DECLARE
provider_status VARCHAR(20);
last_check TIMESTAMPTZ;
BEGIN
SELECT health_status, last_health_check
INTO provider_status, last_check
FROM messaging_providers
WHERE id = provider_id_param AND is_active = TRUE;

IF provider_status IS NULL THEN
RETURN FALSE;
END IF;

-- Consider healthy if online and checked within last 5 minutes
IF provider_status = 'online' AND last_check > NOW() - INTERVAL '5 minutes' THEN
RETURN TRUE;
END IF;

RETURN FALSE;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.render_message_template(template_body text, variables jsonb)
RETURNS text
LANGUAGE plpgsql
AS $function$
DECLARE
result TEXT;
key TEXT;
value TEXT;
BEGIN
result := template_body;

FOR key, value IN SELECT * FROM jsonb_each_text(variables)
LOOP
result := REPLACE(result, '{{' || key || '}}', value);
END LOOP;

RETURN result;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.schedule_message_retry(message_id_param uuid, retry_delay_seconds integer DEFAULT 300)
RETURNS void
LANGUAGE plpgsql
AS $function$
BEGIN
INSERT INTO message_retry_queue (message_id, next_retry_at, priority)
VALUES (
message_id_param,
NOW() + (retry_delay_seconds || ' seconds')::INTERVAL,
0
)
ON CONFLICT (message_id) DO UPDATE SET
next_retry_at = NOW() + (retry_delay_seconds || ' seconds')::INTERVAL,
retry_reason = EXCLUDED.retry_reason;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.trigger_quotation_messages()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
default_provider_id UUID;
template_id UUID;
supplier RECORD;
BEGIN
-- Only trigger when status changes to 'sent_to_suppliers'
IF NEW.status = 'sent_to_suppliers' AND (OLD.status IS NULL OR OLD.status != 'sent_to_suppliers') THEN

    -- Get default WhatsApp provider
    SELECT id INTO default_provider_id
    FROM messaging_providers
    WHERE type = 'whatsapp' AND is_active = TRUE
    ORDER BY created_at DESC
    LIMIT 1;

    -- Get default template
    SELECT id INTO template_id
    FROM message_templates
    WHERE code = 'quotation_invitation' AND is_active = TRUE
    LIMIT 1;

    -- Skip if no provider or template configured
    IF default_provider_id IS NULL OR template_id IS NULL THEN
      RETURN NEW;
    END IF;

    -- Create message records for each invited supplier
    FOR supplier IN
      SELECT
        qis.supplier_id,
        qis.supplier_name,
        s.phone,
        s.whatsapp
      FROM quotation_invited_suppliers qis
      LEFT JOIN suppliers s ON s.id = qis.supplier_id
      WHERE qis.quotation_id = NEW.id
        AND qis.status = 'pending'
    LOOP
      -- Only create message if supplier has WhatsApp number
      IF supplier.whatsapp IS NOT NULL AND supplier.whatsapp != '' THEN
        INSERT INTO quotation_messages (
          quotation_id,
          supplier_id,
          supplier_name,
          provider_id,
          provider_type,
          template_id,
          recipient,
          body,
          status,
          created_by,
          created_by_name
        ) VALUES (
          NEW.id,
          supplier.supplier_id,
          supplier.supplier_name,
          default_provider_id,
          'whatsapp',
          template_id,
          supplier.whatsapp,
          '', -- Body will be rendered by backend service
          'pending',
          NEW.created_by,
          NEW.created_by_name
        );
      END IF;
    END LOOP;

END IF;

RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_ac_agendamentos_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
NEW.updated_at = NOW();
RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_ac_postos_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
NEW.updated_at = NOW();
RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_ac_resultados_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
NEW.updated_at = NOW();
RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_approval_level_config_timestamp()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
NEW.updated_at = NOW();
RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_billing_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
NEW.updated_at = NOW();
RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_custom_roles_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
NEW.updated_at = now();
RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_it_project_visions_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
NEW.updated_at = NOW();
RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_it_projects_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
NEW.updated_at = NOW();
RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_it_requests_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
NEW.updated_at = NOW();
RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_it_sprints_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
NEW.updated_at = NOW();
RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_maintenance_requests_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
NEW.updated_at = NOW();
RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_module_categories_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
NEW.updated_at = now();
RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_nota_valores()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
-- Atualiza totais na nota relacionada
IF NEW.nota_id IS NOT NULL THEN
UPDATE notas SET
valor_recebido = COALESCE((
SELECT SUM(valor_recebido) FROM recebimentos
WHERE nota_id = NEW.nota_id AND status IN ('recebido', 'parcial')
), 0),
valor_glosado = COALESCE((
SELECT SUM(valor) FROM glosas
WHERE nota_id = NEW.nota_id AND status IN ('aberta', 'em_recurso', 'definitiva')
), 0),
status = CASE
WHEN (SELECT SUM(valor_recebido) FROM recebimentos WHERE nota_id = NEW.nota_id AND status IN ('recebido', 'parcial')) >= valor_total THEN 'recebida'
WHEN (SELECT SUM(valor_recebido) FROM recebimentos WHERE nota_id = NEW.nota_id AND status IN ('recebido', 'parcial')) > 0 THEN 'parcialmente_recebida'
WHEN (SELECT COUNT(*) FROM glosas WHERE nota_id = NEW.nota_id AND status = 'definitiva') > 0 THEN 'glosada'
ELSE 'aberta'
END,
updated_at = NOW()
WHERE id_nota = NEW.nota_id;
END IF;

RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_payment_requests_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
NEW.updated_at = NOW();
RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_product_status()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
-- Check if product is expired
IF NEW.expiration_date <= CURRENT_DATE THEN
NEW.status = 'expired';
-- Check if product has low stock
ELSIF NEW.quantity <= NEW.min_stock THEN
NEW.status = 'low-stock';
ELSE
NEW.status = 'active';
END IF;

NEW.updated_at = now();
RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_quotation_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
NEW.updated_at = NOW();
RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_stock_on_movement()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
-- Update product quantity
UPDATE products
SET quantity = quantity - NEW.quantity,
updated_at = now()
WHERE id = NEW.product_id;

RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_user_approval_limits_timestamp()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
NEW.updated_at = NOW();
RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.user_has_permission(user_id uuid, permission_key text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
has_perm BOOLEAN;
BEGIN
SELECT EXISTS (
SELECT 1
FROM user_profiles up
JOIN custom_roles cr ON cr.id = up.custom_role_id
WHERE up.id = user_id
AND cr.permissions ? permission_key
) INTO has_perm;

-- Fallback para sistema antigo (role column)
IF has_perm IS NULL OR has_perm = false THEN
SELECT CASE
WHEN up.role = 'admin' THEN true
WHEN up.role = 'operator' AND permission_key NOT IN ('canViewDashboard', 'canManageUsers', 'canManageRoles') THEN true
WHEN up.role = 'requester' AND permission_key IN ('canViewRequests', 'canAddRequests') THEN true
ELSE false
END INTO has_perm
FROM user_profiles up
WHERE up.id = user_id;
END IF;

RETURN COALESCE(has_perm, false);
END;
$function$
;

CREATE TRIGGER trg_ac_agendamentos_updated_at BEFORE UPDATE ON public.ac_agendamentos FOR EACH ROW EXECUTE FUNCTION update_ac_agendamentos_updated_at();

CREATE TRIGGER trg_ac_dias_excecao_updated_at BEFORE UPDATE ON public.ac_dias_excecao FOR EACH ROW EXECUTE FUNCTION ac_set_updated_at();

CREATE TRIGGER trg_ac_postos_updated_at BEFORE UPDATE ON public.ac_postos FOR EACH ROW EXECUTE FUNCTION update_ac_postos_updated_at();

CREATE TRIGGER trg_ac_resultados_updated_at BEFORE UPDATE ON public.ac_resultados FOR EACH ROW EXECUTE FUNCTION update_ac_resultados_updated_at();

CREATE TRIGGER trg_it_project_visions_updated_at BEFORE UPDATE ON public.it_project_visions FOR EACH ROW EXECUTE FUNCTION update_it_project_visions_updated_at();

CREATE TRIGGER trg_it_projects_updated_at BEFORE UPDATE ON public.it_projects FOR EACH ROW EXECUTE FUNCTION update_it_projects_updated_at();

CREATE TRIGGER trg_it_requests_updated_at BEFORE UPDATE ON public.it_requests FOR EACH ROW EXECUTE FUNCTION update_it_requests_updated_at();

CREATE TRIGGER trg_it_sprints_updated_at BEFORE UPDATE ON public.it_sprints FOR EACH ROW EXECUTE FUNCTION update_it_sprints_updated_at();

CREATE TRIGGER trigger_custom_roles_updated_at BEFORE UPDATE ON public.custom_roles FOR EACH ROW EXECUTE FUNCTION update_custom_roles_updated_at();

CREATE TRIGGER trigger_generate_maintenance_code BEFORE INSERT ON public.maintenance_requests FOR EACH ROW WHEN (((new.codigo IS NULL) OR (new.codigo = ''::text))) EXECUTE FUNCTION generate_maintenance_code();

CREATE TRIGGER trigger_generate_request_id BEFORE INSERT ON public.requests FOR EACH ROW WHEN (((new.id IS NULL) OR (new.id = ''::text))) EXECUTE FUNCTION generate_request_id();

CREATE TRIGGER trigger_glosa_update_nota AFTER INSERT OR UPDATE ON public.glosas FOR EACH ROW EXECUTE FUNCTION update_nota_valores();

CREATE TRIGGER trigger_glosas_updated_at BEFORE UPDATE ON public.glosas FOR EACH ROW EXECUTE FUNCTION update_billing_updated_at();

CREATE TRIGGER trigger_lotes_updated_at BEFORE UPDATE ON public.lotes FOR EACH ROW EXECUTE FUNCTION update_billing_updated_at();

CREATE TRIGGER trigger_module_categories_updated_at BEFORE UPDATE ON public.module_categories FOR EACH ROW EXECUTE FUNCTION update_module_categories_updated_at();

CREATE TRIGGER trigger_notas_updated_at BEFORE UPDATE ON public.notas FOR EACH ROW EXECUTE FUNCTION update_billing_updated_at();

CREATE TRIGGER trigger_operadoras_updated_at BEFORE UPDATE ON public.operadoras FOR EACH ROW EXECUTE FUNCTION update_billing_updated_at();

CREATE TRIGGER trigger_recebimento_update_nota AFTER INSERT OR UPDATE ON public.recebimentos FOR EACH ROW EXECUTE FUNCTION update_nota_valores();

CREATE TRIGGER trigger_recebimentos_updated_at BEFORE UPDATE ON public.recebimentos FOR EACH ROW EXECUTE FUNCTION update_billing_updated_at();

CREATE TRIGGER trigger_requisicoes_updated_at BEFORE UPDATE ON public.requisicoes FOR EACH ROW EXECUTE FUNCTION update_billing_updated_at();

CREATE TRIGGER trigger_send_quotation_messages AFTER INSERT OR UPDATE OF status ON public.quotations FOR EACH ROW EXECUTE FUNCTION trigger_quotation_messages();

CREATE TRIGGER trigger_update_approval_level_config_timestamp BEFORE UPDATE ON public.approval_level_config FOR EACH ROW EXECUTE FUNCTION update_approval_level_config_timestamp();

CREATE TRIGGER trigger_update_maintenance_requests_updated_at BEFORE UPDATE ON public.maintenance_requests FOR EACH ROW EXECUTE FUNCTION update_maintenance_requests_updated_at();

CREATE TRIGGER trigger_update_payment_requests_updated_at BEFORE UPDATE ON public.payment_requests FOR EACH ROW EXECUTE FUNCTION update_payment_requests_updated_at();

CREATE TRIGGER trigger_update_product_status BEFORE INSERT OR UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION update_product_status();

CREATE TRIGGER trigger_update_stock_on_movement AFTER INSERT ON public.stock_movements FOR EACH ROW EXECUTE FUNCTION update_stock_on_movement();

CREATE TRIGGER trigger_update_user_approval_limits_timestamp BEFORE UPDATE ON public.user_approval_limits FOR EACH ROW EXECUTE FUNCTION update_user_approval_limits_timestamp();

CREATE TRIGGER update_quotation_proposals_updated_at BEFORE UPDATE ON public.quotation_proposals FOR EACH ROW EXECUTE FUNCTION update_quotation_updated_at();

ALTER TABLE public.ac_agendamentos ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.ac_dias_excecao ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.ac_horarios_padrao ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.ac_postos ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.ac_resultados ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.approval_level_config ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.billing_sync_log ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.custom_roles ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.glosas ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.it_project_visions ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.it_projects ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.it_requests ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.it_sprints ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.it_task_attachments ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.it_task_comments ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.lotes ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.maintenance_inventory_items ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.maintenance_requests ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.message_retry_queue ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.message_templates ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.messaging_providers ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.module_categories ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.nota_lote ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.notas ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.notification_templates ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.operadoras ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.payment_requests ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.product_change_logs ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.product_stock ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.provider_health_logs ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.quotation_approvals ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.quotation_audit_logs ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.quotation_invited_suppliers ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.quotation_items ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.quotation_messages ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.quotation_proposal_items ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.quotation_proposals ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.quotations ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.recebimentos ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.request_attachments ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.request_messages ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.request_periods ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.requests ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.requisicoes ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.stock_locations ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.user_approval_limits ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.user_notifications ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.user_whitelist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ALL" ON public.request_attachments AS PERMISSIVE FOR ALL TO public USING (true) WITH CHECK (true);

CREATE POLICY "ALL" ON public.request_periods AS PERMISSIVE FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Admins and operators can create maintenance inventory items" ON public.maintenance_inventory_items AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
FROM user_profiles
WHERE ((user_profiles.id = auth.uid()) AND (user_profiles.role = ANY (ARRAY['admin'::text, 'operator'::text]))))));

CREATE POLICY "Admins and operators can update maintenance inventory items" ON public.maintenance_inventory_items AS PERMISSIVE FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1
FROM user_profiles
WHERE ((user_profiles.id = auth.uid()) AND (user_profiles.role = ANY (ARRAY['admin'::text, 'operator'::text]))))));

CREATE POLICY "Admins can delete maintenance inventory items" ON public.maintenance_inventory_items AS PERMISSIVE FOR DELETE TO authenticated USING ((EXISTS ( SELECT 1
FROM user_profiles
WHERE ((user_profiles.id = auth.uid()) AND (user_profiles.role = 'admin'::text)))));

CREATE POLICY "Admins can delete maintenance requests" ON public.maintenance_requests AS PERMISSIVE FOR DELETE TO authenticated USING ((EXISTS ( SELECT 1
FROM user_profiles
WHERE ((user_profiles.id = auth.uid()) AND (user_profiles.role = 'admin'::text)))));

CREATE POLICY "Allow admins to update any profile" ON public.user_profiles AS PERMISSIVE FOR UPDATE TO authenticated USING (current_user_has_permission('canManageRoles'::text)) WITH CHECK (current_user_has_permission('canManageRoles'::text));

CREATE POLICY "Allow all operations for authenticated users" ON public.suppliers AS PERMISSIVE FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow authenticated users to delete products" ON public.products AS PERMISSIVE FOR DELETE TO authenticated USING (true);

CREATE POLICY "Allow authenticated users to insert change logs" ON public.product_change_logs AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow authenticated users to insert products" ON public.products AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow authenticated users to insert requests" ON public.requests AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow authenticated users to insert stock movements" ON public.stock_movements AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow authenticated users to read all profiles" ON public.user_profiles AS PERMISSIVE FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated users to read change logs" ON public.product_change_logs AS PERMISSIVE FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated users to read products" ON public.products AS PERMISSIVE FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated users to read requests" ON public.requests AS PERMISSIVE FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated users to read stock movements" ON public.stock_movements AS PERMISSIVE FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated users to update products" ON public.products AS PERMISSIVE FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update requests" ON public.requests AS PERMISSIVE FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow realtime for authenticated" ON public.request_messages AS PERMISSIVE FOR SELECT TO public USING (true);

CREATE POLICY "Allow select for authenticated" ON public.request_messages AS PERMISSIVE FOR SELECT TO public USING (true);

CREATE POLICY "Allow users to insert their own profile" ON public.user_profiles AS PERMISSIVE FOR INSERT TO public WITH CHECK ((auth.uid() = id));

CREATE POLICY "Allow users to update their own profile" ON public.user_profiles AS PERMISSIVE FOR UPDATE TO authenticated USING ((auth.uid() = id)) WITH CHECK ((auth.uid() = id));

CREATE POLICY "Authenticated users can delete glosas" ON public.glosas AS PERMISSIVE FOR DELETE TO authenticated USING (true);

CREATE POLICY "Authenticated users can delete lotes" ON public.lotes AS PERMISSIVE FOR DELETE TO authenticated USING (true);

CREATE POLICY "Authenticated users can delete nota_lote" ON public.nota_lote AS PERMISSIVE FOR DELETE TO authenticated USING (true);

CREATE POLICY "Authenticated users can delete notas" ON public.notas AS PERMISSIVE FOR DELETE TO authenticated USING (true);

CREATE POLICY "Authenticated users can delete operadoras" ON public.operadoras AS PERMISSIVE FOR DELETE TO authenticated USING (true);

CREATE POLICY "Authenticated users can delete recebimentos" ON public.recebimentos AS PERMISSIVE FOR DELETE TO authenticated USING (true);

CREATE POLICY "Authenticated users can delete requisicoes" ON public.requisicoes AS PERMISSIVE FOR DELETE TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert glosas" ON public.glosas AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can insert lotes" ON public.lotes AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can insert nota_lote" ON public.nota_lote AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can insert notas" ON public.notas AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can insert operadoras" ON public.operadoras AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can insert recebimentos" ON public.recebimentos AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can insert requisicoes" ON public.requisicoes AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update glosas" ON public.glosas AS PERMISSIVE FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can update lotes" ON public.lotes AS PERMISSIVE FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can update notas" ON public.notas AS PERMISSIVE FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can update operadoras" ON public.operadoras AS PERMISSIVE FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can update recebimentos" ON public.recebimentos AS PERMISSIVE FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can update requisicoes" ON public.requisicoes AS PERMISSIVE FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can view billing_sync_log" ON public.billing_sync_log AS PERMISSIVE FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can view glosas" ON public.glosas AS PERMISSIVE FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can view lotes" ON public.lotes AS PERMISSIVE FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can view maintenance inventory items" ON public.maintenance_inventory_items AS PERMISSIVE FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can view nota_lote" ON public.nota_lote AS PERMISSIVE FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can view notas" ON public.notas AS PERMISSIVE FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can view operadoras" ON public.operadoras AS PERMISSIVE FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can view recebimentos" ON public.recebimentos AS PERMISSIVE FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can view requisicoes" ON public.requisicoes AS PERMISSIVE FOR SELECT TO authenticated USING (true);

CREATE POLICY "Enable RLS" ON public.request_messages AS PERMISSIVE FOR ALL TO public USING (true) WITH CHECK (true);

CREATE POLICY "RLS SET" ON public.quotation_items AS PERMISSIVE FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "RLS set" ON public.quotations AS PERMISSIVE FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Service role can manage billing_sync_log" ON public.billing_sync_log AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Users can create own maintenance requests" ON public.maintenance_requests AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((requester_id = auth.uid()));

CREATE POLICY "Users can delete payment requests" ON public.payment_requests AS PERMISSIVE FOR DELETE TO authenticated USING (true);

CREATE POLICY "Users can insert payment requests" ON public.payment_requests AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Users can update maintenance requests" ON public.maintenance_requests AS PERMISSIVE FOR UPDATE TO authenticated USING ((((requester_id = auth.uid()) AND (status = 'pending'::text)) OR (EXISTS ( SELECT 1
FROM user_profiles
WHERE ((user_profiles.id = auth.uid()) AND (user_profiles.role = ANY (ARRAY['admin'::text, 'operator'::text])))))));

CREATE POLICY "Users can update payment requests" ON public.payment_requests AS PERMISSIVE FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Users can view own maintenance requests" ON public.maintenance_requests AS PERMISSIVE FOR SELECT TO authenticated USING (((requester_id = auth.uid()) OR (EXISTS ( SELECT 1
FROM user_profiles
WHERE ((user_profiles.id = auth.uid()) AND (user_profiles.role = ANY (ARRAY['admin'::text, 'operator'::text])))))));

CREATE POLICY "Users can view payment requests" ON public.payment_requests AS PERMISSIVE FOR SELECT TO authenticated USING (true);

CREATE POLICY "authenticated delete product_stock" ON public.product_stock AS PERMISSIVE FOR DELETE TO authenticated USING (true);

CREATE POLICY "authenticated delete stock_locations" ON public.stock_locations AS PERMISSIVE FOR DELETE TO authenticated USING (true);

CREATE POLICY "authenticated insert product_stock" ON public.product_stock AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "authenticated insert stock_locations" ON public.stock_locations AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "authenticated read product_stock" ON public.product_stock AS PERMISSIVE FOR SELECT TO authenticated USING (true);

CREATE POLICY "authenticated read stock_locations" ON public.stock_locations AS PERMISSIVE FOR SELECT TO authenticated USING (true);

CREATE POLICY "authenticated update product_stock" ON public.product_stock AS PERMISSIVE FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "authenticated update stock_locations" ON public.stock_locations AS PERMISSIVE FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY ac_agendamentos_select_all ON public.ac_agendamentos AS PERMISSIVE FOR SELECT TO authenticated USING (true);

CREATE POLICY ac_dias_excecao_mutate_staff ON public.ac_dias_excecao AS PERMISSIVE FOR ALL TO authenticated USING ((EXISTS ( SELECT 1
FROM user_profiles
WHERE ((user_profiles.id = auth.uid()) AND (user_profiles.role = ANY (ARRAY['admin'::text, 'operator'::text])))))) WITH CHECK ((EXISTS ( SELECT 1
FROM user_profiles
WHERE ((user_profiles.id = auth.uid()) AND (user_profiles.role = ANY (ARRAY['admin'::text, 'operator'::text]))))));

CREATE POLICY ac_dias_excecao_select_all ON public.ac_dias_excecao AS PERMISSIVE FOR SELECT TO authenticated USING (true);

CREATE POLICY ac_horarios_padrao_mutate_staff ON public.ac_horarios_padrao AS PERMISSIVE FOR ALL TO authenticated USING ((EXISTS ( SELECT 1
FROM user_profiles
WHERE ((user_profiles.id = auth.uid()) AND (user_profiles.role = ANY (ARRAY['admin'::text, 'operator'::text])))))) WITH CHECK ((EXISTS ( SELECT 1
FROM user_profiles
WHERE ((user_profiles.id = auth.uid()) AND (user_profiles.role = ANY (ARRAY['admin'::text, 'operator'::text]))))));

CREATE POLICY ac_horarios_padrao_select_all ON public.ac_horarios_padrao AS PERMISSIVE FOR SELECT TO authenticated USING (true);

CREATE POLICY ac_postos_delete_staff ON public.ac_postos AS PERMISSIVE FOR DELETE TO authenticated USING ((EXISTS ( SELECT 1
FROM user_profiles
WHERE ((user_profiles.id = auth.uid()) AND (user_profiles.role = ANY (ARRAY['admin'::text, 'operator'::text]))))));

CREATE POLICY ac_postos_insert_staff ON public.ac_postos AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
FROM user_profiles
WHERE ((user_profiles.id = auth.uid()) AND (user_profiles.role = ANY (ARRAY['admin'::text, 'operator'::text]))))));

CREATE POLICY ac_postos_select_all ON public.ac_postos AS PERMISSIVE FOR SELECT TO authenticated USING (true);

CREATE POLICY ac_postos_update_staff ON public.ac_postos AS PERMISSIVE FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1
FROM user_profiles
WHERE ((user_profiles.id = auth.uid()) AND (user_profiles.role = ANY (ARRAY['admin'::text, 'operator'::text])))))) WITH CHECK ((EXISTS ( SELECT 1
FROM user_profiles
WHERE ((user_profiles.id = auth.uid()) AND (user_profiles.role = ANY (ARRAY['admin'::text, 'operator'::text]))))));

CREATE POLICY ac_resultados_select_all ON public.ac_resultados AS PERMISSIVE FOR SELECT TO authenticated USING (true);

CREATE POLICY approval_level_config_select ON public.approval_level_config AS PERMISSIVE FOR SELECT TO public USING (true);

CREATE POLICY approval_level_config_update ON public.approval_level_config AS PERMISSIVE FOR UPDATE TO public USING ((EXISTS ( SELECT 1
FROM user_profiles
WHERE ((user_profiles.id = auth.uid()) AND (user_profiles.role = 'admin'::text)))));

CREATE POLICY custom_roles_delete_admin ON public.custom_roles AS PERMISSIVE FOR DELETE TO authenticated USING (((is_system = false) AND (EXISTS ( SELECT 1
FROM user_profiles
WHERE ((user_profiles.id = auth.uid()) AND ((user_profiles.role = 'admin'::text) OR (user_profiles.custom_role_id IN ( SELECT cr.id
FROM custom_roles cr
WHERE (cr.permissions ? 'canManageRoles'::text)))))))));

CREATE POLICY custom_roles_insert_admin ON public.custom_roles AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
FROM user_profiles
WHERE ((user_profiles.id = auth.uid()) AND ((user_profiles.role = 'admin'::text) OR (user_profiles.custom_role_id IN ( SELECT cr.id
FROM custom_roles cr
WHERE (cr.permissions ? 'canManageRoles'::text))))))));

CREATE POLICY custom_roles_select_authenticated ON public.custom_roles AS PERMISSIVE FOR SELECT TO authenticated USING (true);

CREATE POLICY custom_roles_update_admin ON public.custom_roles AS PERMISSIVE FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1
FROM user_profiles
WHERE ((user_profiles.id = auth.uid()) AND ((user_profiles.role = 'admin'::text) OR (user_profiles.custom_role_id IN ( SELECT cr.id
FROM custom_roles cr
WHERE (cr.permissions ? 'canManageRoles'::text)))))))) WITH CHECK ((EXISTS ( SELECT 1
FROM user_profiles
WHERE ((user_profiles.id = auth.uid()) AND ((user_profiles.role = 'admin'::text) OR (user_profiles.custom_role_id IN ( SELECT cr.id
FROM custom_roles cr
WHERE (cr.permissions ? 'canManageRoles'::text))))))));

CREATE POLICY it_project_visions_delete_admin ON public.it_project_visions AS PERMISSIVE FOR DELETE TO authenticated USING ((EXISTS ( SELECT 1
FROM user_profiles
WHERE ((user_profiles.id = auth.uid()) AND (user_profiles.role = 'admin'::text)))));

CREATE POLICY it_project_visions_insert_authorized ON public.it_project_visions AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
FROM user_profiles
WHERE ((user_profiles.id = auth.uid()) AND ((user_profiles.role = 'admin'::text) OR (user_profiles.department = 'TI'::text))))));

CREATE POLICY it_project_visions_select_all ON public.it_project_visions AS PERMISSIVE FOR SELECT TO authenticated USING (true);

CREATE POLICY it_project_visions_update_authorized ON public.it_project_visions AS PERMISSIVE FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1
FROM user_profiles
WHERE ((user_profiles.id = auth.uid()) AND ((user_profiles.role = 'admin'::text) OR (user_profiles.department = 'TI'::text)))))) WITH CHECK ((EXISTS ( SELECT 1
FROM user_profiles
WHERE ((user_profiles.id = auth.uid()) AND ((user_profiles.role = 'admin'::text) OR (user_profiles.department = 'TI'::text))))));

CREATE POLICY it_projects_delete_admin ON public.it_projects AS PERMISSIVE FOR DELETE TO authenticated USING ((EXISTS ( SELECT 1
FROM user_profiles
WHERE ((user_profiles.id = auth.uid()) AND (user_profiles.role = 'admin'::text)))));

CREATE POLICY it_projects_insert_own ON public.it_projects AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((auth.uid() = created_by));

CREATE POLICY it_projects_select_all ON public.it_projects AS PERMISSIVE FOR SELECT TO authenticated USING (true);

CREATE POLICY it_projects_update_it_team ON public.it_projects AS PERMISSIVE FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1
FROM user_profiles
WHERE ((user_profiles.id = auth.uid()) AND ((user_profiles.role = 'admin'::text) OR (user_profiles.department = 'TI'::text)))))) WITH CHECK ((EXISTS ( SELECT 1
FROM user_profiles
WHERE ((user_profiles.id = auth.uid()) AND ((user_profiles.role = 'admin'::text) OR (user_profiles.department = 'TI'::text))))));

CREATE POLICY it_requests_delete_admin ON public.it_requests AS PERMISSIVE FOR DELETE TO authenticated USING ((EXISTS ( SELECT 1
FROM user_profiles
WHERE ((user_profiles.id = auth.uid()) AND (user_profiles.role = 'admin'::text)))));

CREATE POLICY it_requests_insert_all ON public.it_requests AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((auth.uid() = requested_by));

CREATE POLICY it_requests_select_all ON public.it_requests AS PERMISSIVE FOR SELECT TO authenticated USING (true);

CREATE POLICY it_requests_update_it_team ON public.it_requests AS PERMISSIVE FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1
FROM user_profiles
WHERE ((user_profiles.id = auth.uid()) AND ((user_profiles.role = 'admin'::text) OR (user_profiles.department = 'TI'::text)))))) WITH CHECK ((EXISTS ( SELECT 1
FROM user_profiles
WHERE ((user_profiles.id = auth.uid()) AND ((user_profiles.role = 'admin'::text) OR (user_profiles.department = 'TI'::text))))));

CREATE POLICY it_sprints_delete_admin ON public.it_sprints AS PERMISSIVE FOR DELETE TO authenticated USING ((EXISTS ( SELECT 1
FROM user_profiles
WHERE ((user_profiles.id = auth.uid()) AND (user_profiles.role = 'admin'::text)))));

CREATE POLICY it_sprints_insert_it_team ON public.it_sprints AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
FROM user_profiles
WHERE ((user_profiles.id = auth.uid()) AND ((user_profiles.role = 'admin'::text) OR (user_profiles.department = 'TI'::text))))));

CREATE POLICY it_sprints_select_all ON public.it_sprints AS PERMISSIVE FOR SELECT TO authenticated USING (true);

CREATE POLICY it_sprints_update_it_team ON public.it_sprints AS PERMISSIVE FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1
FROM user_profiles
WHERE ((user_profiles.id = auth.uid()) AND ((user_profiles.role = 'admin'::text) OR (user_profiles.department = 'TI'::text)))))) WITH CHECK ((EXISTS ( SELECT 1
FROM user_profiles
WHERE ((user_profiles.id = auth.uid()) AND ((user_profiles.role = 'admin'::text) OR (user_profiles.department = 'TI'::text))))));

CREATE POLICY it_task_attachments_delete_own ON public.it_task_attachments AS PERMISSIVE FOR DELETE TO authenticated USING ((user_id = auth.uid()));

CREATE POLICY it_task_attachments_insert ON public.it_task_attachments AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((user_id = auth.uid()));

CREATE POLICY it_task_attachments_select ON public.it_task_attachments AS PERMISSIVE FOR SELECT TO authenticated USING (true);

CREATE POLICY it_task_comments_delete_own ON public.it_task_comments AS PERMISSIVE FOR DELETE TO authenticated USING ((user_id = auth.uid()));

CREATE POLICY it_task_comments_insert ON public.it_task_comments AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((user_id = auth.uid()));

CREATE POLICY it_task_comments_select ON public.it_task_comments AS PERMISSIVE FOR SELECT TO authenticated USING (true);

CREATE POLICY message_retry_queue_delete ON public.message_retry_queue AS PERMISSIVE FOR DELETE TO public USING (true);

CREATE POLICY message_retry_queue_insert ON public.message_retry_queue AS PERMISSIVE FOR INSERT TO public WITH CHECK (true);

CREATE POLICY message_retry_queue_select ON public.message_retry_queue AS PERMISSIVE FOR SELECT TO public USING (true);

CREATE POLICY message_templates_insert ON public.message_templates AS PERMISSIVE FOR INSERT TO public WITH CHECK (true);

CREATE POLICY message_templates_select ON public.message_templates AS PERMISSIVE FOR SELECT TO public USING (true);

CREATE POLICY message_templates_update ON public.message_templates AS PERMISSIVE FOR UPDATE TO public USING (true);

CREATE POLICY messaging_providers_insert ON public.messaging_providers AS PERMISSIVE FOR INSERT TO public WITH CHECK (true);

CREATE POLICY messaging_providers_select ON public.messaging_providers AS PERMISSIVE FOR SELECT TO public USING (true);

CREATE POLICY messaging_providers_update ON public.messaging_providers AS PERMISSIVE FOR UPDATE TO public USING (true);

CREATE POLICY module_categories_admin_write ON public.module_categories AS PERMISSIVE FOR ALL TO authenticated USING ((EXISTS ( SELECT 1
FROM (user_profiles up
LEFT JOIN custom_roles cr ON ((cr.id = up.custom_role_id)))
WHERE ((up.id = auth.uid()) AND ((up.role = 'admin'::text) OR (cr.permissions @> '["canManageUsers"]'::jsonb)))))) WITH CHECK ((EXISTS ( SELECT 1
FROM (user_profiles up
LEFT JOIN custom_roles cr ON ((cr.id = up.custom_role_id)))
WHERE ((up.id = auth.uid()) AND ((up.role = 'admin'::text) OR (cr.permissions @> '["canManageUsers"]'::jsonb))))));

CREATE POLICY module_categories_read ON public.module_categories AS PERMISSIVE FOR SELECT TO authenticated USING (true);

CREATE POLICY notification_templates_admin_delete ON public.notification_templates AS PERMISSIVE FOR DELETE TO authenticated USING ((EXISTS ( SELECT 1
FROM user_profiles up
WHERE ((up.id = auth.uid()) AND (up.role = 'admin'::text)))));

CREATE POLICY notification_templates_admin_insert ON public.notification_templates AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
FROM user_profiles up
WHERE ((up.id = auth.uid()) AND (up.role = 'admin'::text)))));

CREATE POLICY notification_templates_admin_update ON public.notification_templates AS PERMISSIVE FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1
FROM user_profiles up
WHERE ((up.id = auth.uid()) AND (up.role = 'admin'::text))))) WITH CHECK ((EXISTS ( SELECT 1
FROM user_profiles up
WHERE ((up.id = auth.uid()) AND (up.role = 'admin'::text)))));

CREATE POLICY notification_templates_authenticated_select ON public.notification_templates AS PERMISSIVE FOR SELECT TO authenticated USING (true);

CREATE POLICY provider_health_logs_insert ON public.provider_health_logs AS PERMISSIVE FOR INSERT TO public WITH CHECK (true);

CREATE POLICY provider_health_logs_select ON public.provider_health_logs AS PERMISSIVE FOR SELECT TO public USING (true);

CREATE POLICY quotation_approvals_delete ON public.quotation_approvals AS PERMISSIVE FOR DELETE TO public USING (true);

CREATE POLICY quotation_approvals_insert ON public.quotation_approvals AS PERMISSIVE FOR INSERT TO public WITH CHECK (true);

CREATE POLICY quotation_approvals_select ON public.quotation_approvals AS PERMISSIVE FOR SELECT TO public USING (true);

CREATE POLICY quotation_approvals_update ON public.quotation_approvals AS PERMISSIVE FOR UPDATE TO public USING (true);

CREATE POLICY quotation_audit_logs_insert ON public.quotation_audit_logs AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY quotation_audit_logs_select ON public.quotation_audit_logs AS PERMISSIVE FOR SELECT TO authenticated USING (true);

CREATE POLICY quotation_invited_suppliers_delete ON public.quotation_invited_suppliers AS PERMISSIVE FOR DELETE TO public USING (true);

CREATE POLICY quotation_invited_suppliers_insert ON public.quotation_invited_suppliers AS PERMISSIVE FOR INSERT TO public WITH CHECK (true);

CREATE POLICY quotation_invited_suppliers_select ON public.quotation_invited_suppliers AS PERMISSIVE FOR SELECT TO public USING (true);

CREATE POLICY quotation_invited_suppliers_update ON public.quotation_invited_suppliers AS PERMISSIVE FOR UPDATE TO public USING (true);

CREATE POLICY quotation_items_delete ON public.quotation_items AS PERMISSIVE FOR DELETE TO authenticated USING ((EXISTS ( SELECT 1
FROM user_profiles up
WHERE ((up.id = auth.uid()) AND ((up.role = 'admin'::text) OR user_has_permission(auth.uid(), 'canManageRoles'::text))))));

CREATE POLICY quotation_items_insert ON public.quotation_items AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
FROM user_profiles up
WHERE ((up.id = auth.uid()) AND ((up.role = 'admin'::text) OR user_has_permission(auth.uid(), 'canManageRoles'::text))))));

CREATE POLICY quotation_items_select ON public.quotation_items AS PERMISSIVE FOR SELECT TO authenticated USING (true);

CREATE POLICY quotation_items_update ON public.quotation_items AS PERMISSIVE FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1
FROM user_profiles up
WHERE ((up.id = auth.uid()) AND ((up.role = 'admin'::text) OR user_has_permission(auth.uid(), 'canManageRoles'::text)))))) WITH CHECK ((EXISTS ( SELECT 1
FROM user_profiles up
WHERE ((up.id = auth.uid()) AND ((up.role = 'admin'::text) OR user_has_permission(auth.uid(), 'canManageRoles'::text))))));

CREATE POLICY quotation_messages_insert ON public.quotation_messages AS PERMISSIVE FOR INSERT TO public WITH CHECK (true);

CREATE POLICY quotation_messages_select ON public.quotation_messages AS PERMISSIVE FOR SELECT TO public USING (true);

CREATE POLICY quotation_messages_update ON public.quotation_messages AS PERMISSIVE FOR UPDATE TO public USING (true);

CREATE POLICY quotation_proposal_items_delete ON public.quotation_proposal_items AS PERMISSIVE FOR DELETE TO public USING (true);

CREATE POLICY quotation_proposal_items_insert ON public.quotation_proposal_items AS PERMISSIVE FOR INSERT TO public WITH CHECK (true);

CREATE POLICY quotation_proposal_items_select ON public.quotation_proposal_items AS PERMISSIVE FOR SELECT TO public USING (true);

CREATE POLICY quotation_proposal_items_update ON public.quotation_proposal_items AS PERMISSIVE FOR UPDATE TO public USING (true);

CREATE POLICY quotation_proposals_delete ON public.quotation_proposals AS PERMISSIVE FOR DELETE TO public USING (true);

CREATE POLICY quotation_proposals_insert ON public.quotation_proposals AS PERMISSIVE FOR INSERT TO public WITH CHECK (true);

CREATE POLICY quotation_proposals_select ON public.quotation_proposals AS PERMISSIVE FOR SELECT TO public USING (true);

CREATE POLICY quotation_proposals_update ON public.quotation_proposals AS PERMISSIVE FOR UPDATE TO public USING (true);

CREATE POLICY quotations_delete ON public.quotations AS PERMISSIVE FOR DELETE TO authenticated USING (true);

CREATE POLICY quotations_insert ON public.quotations AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY quotations_select ON public.quotations AS PERMISSIVE FOR SELECT TO authenticated USING (true);

CREATE POLICY quotations_update ON public.quotations AS PERMISSIVE FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY user_approval_limits_delete ON public.user_approval_limits AS PERMISSIVE FOR DELETE TO public USING ((EXISTS ( SELECT 1
FROM user_profiles
WHERE ((user_profiles.id = auth.uid()) AND (user_profiles.role = 'admin'::text)))));

CREATE POLICY user_approval_limits_insert ON public.user_approval_limits AS PERMISSIVE FOR INSERT TO public WITH CHECK ((EXISTS ( SELECT 1
FROM user_profiles
WHERE ((user_profiles.id = auth.uid()) AND (user_profiles.role = 'admin'::text)))));

CREATE POLICY user_approval_limits_select ON public.user_approval_limits AS PERMISSIVE FOR SELECT TO public USING (true);

CREATE POLICY user_approval_limits_update ON public.user_approval_limits AS PERMISSIVE FOR UPDATE TO public USING ((EXISTS ( SELECT 1
FROM user_profiles
WHERE ((user_profiles.id = auth.uid()) AND (user_profiles.role = 'admin'::text)))));

CREATE POLICY user_notifications_admin_select ON public.user_notifications AS PERMISSIVE FOR SELECT TO public USING ((EXISTS ( SELECT 1
FROM user_profiles up
WHERE ((up.id = auth.uid()) AND ((up.role = 'admin'::text) OR (EXISTS ( SELECT 1
FROM custom_roles cr
WHERE ((cr.id = up.custom_role_id) AND ((cr.name)::text = 'Desenvolvedor'::text)))))))));

CREATE POLICY user_notifications_delete_own ON public.user_notifications AS PERMISSIVE FOR DELETE TO authenticated USING ((auth.uid() = user_id));

CREATE POLICY user_notifications_insert_authenticated ON public.user_notifications AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY user_notifications_select_own ON public.user_notifications AS PERMISSIVE FOR SELECT TO authenticated USING ((auth.uid() = user_id));

CREATE POLICY user_notifications_update_own ON public.user_notifications AS PERMISSIVE FOR UPDATE TO authenticated USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));

CREATE POLICY users_read_own_profile ON public.user_profiles AS PERMISSIVE FOR SELECT TO authenticated USING ((auth.uid() = id));

CREATE POLICY whitelist_read_anon ON public.user_whitelist AS PERMISSIVE FOR SELECT TO public USING ((auth.role() = 'anon'::text));

CREATE POLICY whitelist_read_authenticated ON public.user_whitelist AS PERMISSIVE FOR SELECT TO public USING ((auth.role() = 'authenticated'::text));

CREATE POLICY whitelist_write_custom_role ON public.user_whitelist AS PERMISSIVE FOR ALL TO public USING ((EXISTS ( SELECT 1
FROM (user_profiles p
LEFT JOIN custom_roles cr ON ((cr.id = p.custom_role_id)))
WHERE ((p.id = auth.uid()) AND (cr.permissions @> '["canManageWhitelist"]'::jsonb)))));

CREATE OR REPLACE VIEW public.quotation_message_status AS SELECT q.id AS quotation_id,
q.code AS quotation_code,
q.title AS quotation_title,
q.status AS quotation_status,
count(qm.id) AS total_messages,
count(qm.id) FILTER (WHERE ((qm.status)::text = 'sent'::text)) AS sent_count,
count(qm.id) FILTER (WHERE ((qm.status)::text = 'failed'::text)) AS failed_count,
count(qm.id) FILTER (WHERE ((qm.status)::text = 'pending'::text)) AS pending_count,
count(qm.id) FILTER (WHERE ((qm.status)::text = 'delivered'::text)) AS delivered_count,
count(qm.id) FILTER (WHERE ((qm.status)::text = 'read'::text)) AS read_count,
max(qm.sent_at) AS last_sent_at,
max(qm.delivered_at) AS last_delivered_at
FROM (quotations q
LEFT JOIN quotation_messages qm ON ((qm.quotation_id = q.id)))
GROUP BY q.id, q.code, q.title, q.status;

CREATE OR REPLACE VIEW public.user_approval_limits_with_details AS SELECT ual.id,
ual.user_id,
up.name AS user_name,
up.email AS user_email,
up.role AS user_role,
up.department,
ual.approval_level,
alc.label AS level_label,
alc.max_amount AS level_max_amount,
ual.custom_max_amount,
COALESCE(ual.custom_max_amount, alc.max_amount) AS effective_max_amount,
ual.can_approve,
ual.notes,
ual.created_at,
ual.updated_at
FROM ((user_approval_limits ual
JOIN user_profiles up ON ((up.id = ual.user_id)))
LEFT JOIN approval_level_config alc ON (((alc.level)::text = (ual.approval_level)::text)));

CREATE OR REPLACE VIEW public.user_approval_limits_with_profile AS SELECT ual.id,
ual.user_id,
up.name AS user_name,
up.email AS user_email,
up.role AS user_role,
up.department,
ual.approval_level,
ual.max_amount,
ual.can_approve,
ual.notes,
ual.created_at,
ual.updated_at
FROM (user_approval_limits ual
JOIN user_profiles up ON ((up.id = ual.user_id)));

CREATE OR REPLACE VIEW public.user_roles_view AS SELECT up.id AS user_id,
up.email,
up.name AS user_name,
up.role AS legacy_role,
up.department,
up.custom_role_id,
cr.name AS role_name,
cr.description AS role_description,
cr.permissions,
cr.is_system
FROM (user_profiles up
LEFT JOIN custom_roles cr ON ((cr.id = up.custom_role_id)));
