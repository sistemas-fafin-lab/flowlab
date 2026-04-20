# Contexto do Banco de Dados: Sistema de Faturamento e Recebimento

Este documento descreve o esquema de banco de dados relacional para um sistema de faturamento médico/empresarial. Ele deve ser usado como contexto para geração de queries SQL, modelos ORM e endpoints de API.

## 1. Diagrama ER (Mermaid)
A IA pode usar este diagrama para entender rapidamente as ligações e cardinalidades.

```mermaid
erDiagram
    OPERADORA ||--o{ NOTA : "1:N"
    OPERADORA ||--o{ LOTE : "1:N"
    LOTE ||--o{ REQUISICAO : "1:N"
    NOTA }|--|{ LOTE : "N:N"
    NOTA }o--o{ FATURAMENTO : "1:N"
    FATURAMENTO }|--|{ RECEBIMENTO : "N:N"
    BANCO ||--o{ RECEBIMENTO : "1:N"
    RECEBIMENTO ||--o{ GLOSAS : "1:N"
    RECEBIMENTO }|--|{ NOTA : "N:N"
    RECEBIMENTO }|--|{ LOTE : "N:N"
    RECEBIMENTO }|--|{ REQUISICAO : "N:N"
2. Dicionário de Dados e Estrutura das Tabelas
Abaixo estão as tabelas principais, suas colunas, tipos de dados e chaves (PK = Primary Key, FK = Foreign Key).

Entidades Base
OPERADORA

id_operadora (int, PK)

nome (string)

BANCO

id_banco (int, PK)

nome_inst (string) - Nome da instituição financeira.

Operacional
LOTE

id_lote (int, PK)

data_criacao (date)

status (string)

id_operadora_FK (int, FK -> OPERADORA)

REQUISICAO

id_req (int, PK)

data_criacao (date)

status (string)

valor (decimal)

id_lote_FK (int, FK -> LOTE, nullable)

NOTA

id_nota (int, PK)

data_emissao (date)

status (string)

valor_total (decimal)

id_operadora_FK (int, FK -> OPERADORA)

id_faturamento_FK (int, FK -> FATURAMENTO, nullable)

Faturamento e Financeiro
FATURAMENTO

id_fat (int, PK)

data_faturamento (date)

protocolo_faturamento (string)

id_requisicao_FK (int, FK -> REQUISICAO)

id_lote_FK (int, FK -> LOTE)

id_nota_FK (int, FK -> NOTA)

RECEBIMENTO

id_receb (int, PK)

data_receb (date)

status (enum)

id_banco_FK (int, FK -> BANCO)

id_lote_FK (int, FK -> LOTE)

id_requisicao_FK (int, FK -> REQUISICAO)

id_nota_FK (int, FK -> NOTA)

GLOSAS

id_glosa (int, PK)

recurso (boolean)

status (enum)

id_receb_FK (int, FK -> RECEBIMENTO)

Tabelas de Associação (Relacionamentos N:M)
Usadas para resolver relacionamentos muitos-para-muitos. Ambas as colunas formam uma chave primária composta (PK, FK).

NOTA_LOTE: Associa Notas a Lotes.

id_nota_FK (int, FK -> NOTA)

id_lote_FK (int, FK -> LOTE)

FATURAMENTO_RECEBIMENTO: Associa Faturamentos a Recebimentos.

id_fat_FK (int, FK -> FATURAMENTO)

id_receb_FK (int, FK -> RECEBIMENTO)

RECEB_NOTA: Associa Recebimentos a Notas.

id_receb_FK (int, FK -> RECEBIMENTO)

id_nota_FK (int, FK -> NOTA)

RECEB_LOTE: Associa Recebimentos a Lotes.

id_receb_FK (int, FK -> RECEBIMENTO)

id_lote_FK (int, FK -> LOTE)

RECEB_REQ: Associa Recebimentos a Requisições.

id_receb_FK (int, FK -> RECEBIMENTO)

id_req_FK (int, FK -> REQUISICAO)

3. Regras de Negócio Importantes para a IA
Tipos Monetários: Ao gerar código para valor_total ou valor, utilize tipos de dados adequados para moeda (ex: DECIMAL(15,2) no SQL, ou tipos seguros para float na linguagem backend).

Enums: Atenção aos campos status nas tabelas RECEBIMENTO e GLOSAS, eles devem ser tratados como Enums na aplicação.

Junções N:M: Sempre que for buscar um Recebimento relacionado a uma Nota, faça o JOIN passando pela tabela associativa RECEB_NOTA (e assim por diante para Lotes e Requisições).