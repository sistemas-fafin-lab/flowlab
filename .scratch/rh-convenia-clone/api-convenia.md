# API pública da Convenia — catálogo de referência

> Fonte: `import_files/mario - sistema RH/CATALOGO_API_PUBLIC_CONVENIA_V3.json`,
> `DICIONARIO_DADOS_SELECOES_CONVENIA.json` e `SPEC_TECNICA_CONVENIA_PLATAFORMA.md`,
> lidos em 2026-08-20. Diferente das regras de CLT (`regras-de-negocio-clt.md`), este
> material tem alta confiança de ser real: os paths e o formato de resposta batem
> exatamente com o padrão de documentação pública de API (`public-api.convenia.com.br/
> api/v3/...`, envelope `{message, data, redirect, success}`) — não é algo que se
> inventa por acaso. `requisitos-convenia.md` só especulava "REST API própria com
> token" sem detalhe nenhum; isto substitui/complementa essa seção.

## Autenticação e formato

- Header de autenticação: `token: <API_TOKEN_GERADO_NA_CONVENIA>`.
- `Content-Type` / `Accept`: `application/json`.
- Envelope de resposta padrão (confirmado nos exemplos reais do dicionário de enums):
  ```json
  { "message": "", "data": [...], "redirect": null, "success": true }
  ```
- Webhooks assinados com `X-Convenia-Signature: <HMAC_SHA256_HEX_DIGEST>` (chave secreta
  configurada no painel de API — mesma tela `Configurações > Integrações e API > API >
  Tokens/Webhooks` já documentada em `requisitos-convenia.md`).

## Endpoints — Colaboradores

- `GET /employees` — lista colaboradores ativos.
- `GET /employees/dismissed` — lista colaboradores desligados.
- `GET /employees/{id}` — perfil completo.
- `GET /employees/{id}/salaries-historic` — histórico salarial.
- `POST /employees/{id}/salaries-history` / `PUT /employees/{id}/salaries-history/{registroId}` — registra/atualiza vínculo e salário.
- `GET /employees/{id}/dependents` — dependentes.
- `PUT /employees/{id}/dependents/{dependenteId}` — atualiza dependente.
- `PUT /employees/{id}/emergency-contacts/{contatoId}` — atualiza contato de emergência.
- `PUT /employees/{id}/bank-accounts/{contaId}` — atualiza dados bancários.
- `POST/PUT/DELETE /employees/{id}/educations/{formacaoId}` — CRUD de formação acadêmica.
- `GET /employees/{id}/change-histories` (e `/{id}` para um item específico) — histórico de alterações (auditoria).
- `POST /employees/admission` — inicia admissão.
- `POST /employees/{id}/dismissal` — inicia desligamento.
- `PUT /employees/{id}` — atualiza dados cadastrais.
- `POST /employees/{id}/custom-field-value` — atribui campo personalizado.
- `GET /employees/{id}/benefits` — benefícios do colaborador (v2).
- `POST /employees/{id}/{tipoDocumento}/{documentoId}/document-files` — upload de anexo de documento pessoal.

## Endpoints — Férias

- `GET /employees/{id}/vacations/solicitations` — solicitações de férias do colaborador.
- `GET /employees/{id}/vacations/periods` (e `/{periodoId}`) — períodos aquisitivos e saldos.
- `GET /employees/{id}/vacations/solicitations/{id}/files/{arquivoId}` — arquivo anexo de uma solicitação.
- `GET /companies/collective-vacations` (e `/{id}`) — férias coletivas da empresa.

## Endpoints — Faltas e afastamentos

- `GET /employees/absences/motives` — catálogo de motivos.
- `GET /employees/{id}/absences` (e `/{absenceId}`) — listar.
- `POST /employees/{id}/absences` — criar.
- `PUT /employees/{id}/absences/{absenceId}` — atualizar.
- `DELETE /employees/{id}/absences/{absenceId}` — excluir.

## Endpoints — Benefícios

- `GET /companies/benefits` — benefícios da empresa.
- `GET /benefits/{id}` — detalhe de um benefício.
- `GET /benefits/{id}/employees` — colaboradores vinculados.
- `PUT /companies/benefits/{id}/upsert-employees` — vincula/desvincula colaboradores em lote.
- `PUT /companies/benefits/{id}/upsert-dependents` — vincula/desvincula dependentes em lote.

## Endpoints — Estrutura organizacional

- `GET /companies/teams` — times.
- `GET/POST/PUT/DELETE /companies/departments` — CRUD de departamentos.
- `GET/POST/PUT/DELETE /companies/cost-centers` (nota: create é `POST .../cost-center`, singular — inconsistência do endpoint real) — CRUD de centros de custo.
- `GET/POST/PUT/DELETE /companies/jobs` — CRUD de cargos.
- `GET /companies/custom-fields` — campos personalizados cadastrados.

## Endpoints — Folha

- `GET /payrolls` — todas as folhas.
- `GET /payrolls/{id}` — folha específica.
- `GET /payrolls/{id}/files/{arquivoId}` — arquivo de uma folha.

## Endpoints — Utilitários

- `GET /tokens/permissions` — detalhe de permissões do token atual.

## Webhooks / eventos de domínio nativos

1. `employee.admission.started`
2. `employee.admission.finished`
3. `employee.dismissal.waiting_accounting`
4. `employee.dismissal.finished`
5. `employee.updated`
6. `employee.salary.updated`
7. `employee.birthday.today`
8. `vacation.created`
9. `vacation.approved`
10. `vacation.updated`
11. `absence.created`
12. `absence.updated`
13. `absence.deleted`

Bate com o que já se via indiretamente em `requisitos-convenia.md` (a aba Zapier
menciona "nova admissão", "férias aprovadas", "alteração salarial", "mensagens de
mural" como gatilhos) — esta lista é mais granular e nomeada.

Confirmado por screenshot (`35d_modal_adicionar_webhook.png`, pasta da entrevista): a UI
do modal "Adicionar Webhook" agrupa esses 13 eventos em **3 blocos expansíveis —
Colaboradores / Faltas / Férias** — dá a estrutura de categorização por trás da lista
plana acima.

## Dicionário de enums oficiais (com IDs)

Todos confirmados como `GET /api/v3/<recurso>` retornando
`{ id, name }[]` no envelope padrão. Isto substitui/complementa as listas de opções
soltas em `requisitos-convenia.md` (que não tinham IDs nem confirmação de contagem).

**Etnias** (`/ethnicities`): 1 Indígena · 2 Branca · 3 Preta · 4 Amarela · 5 Parda · 6 Não informado.

**Vínculos empregatícios** (`/relationships`, 15): 1 CLT · 2 Sócio · 3 Diretor Estatutário
· 4 Estágio · 5 Aprendiz · 6 Trabalhador Autônomo · 7 Trabalhador Temporário · 8
Trabalhador Rural · 9 Pessoa Jurídica (PJ) · 10 Contrato Intermitente · 11 Contrato por
Tempo Determinado · 12 Teletrabalho · 13 Cooperado · 14 Associado · 15 Bolsista.

**Estado civil** (`/marital-status`): 1 Solteiro(a) · 2 Casado(a) · 3 Divorciado(a) · 4
Viúvo(a) · 5 Separado(a) · 6 União Estável.

**Escolaridade** (`/educations`, 15 níveis): Analfabeto · até 5º ano incompleto Fund. ·
5º ano completo Fund. · 6º-9º ano incompleto Fund. · Fund. completo · Médio incompleto ·
Médio completo · Superior incompleta · Superior completa · Pós incompleta · Pós completa
· Mestrado incompleto · Mestrado completo · Doutorado incompleto · Doutorado completo.

**Tipo de conta bancária** (`/bank-accounts`): 1 Conta Corrente · 2 Conta Poupança · 3
Conta Salário.

**Tipos de desligamento** (`/dismissal-types`, 10): 1 Demissão sem justa causa fora do
contrato de experiência (pedido da empresa) · 2 Demissão com justa causa fora do
contrato de experiência (falta grave) · 3 Pedido de demissão fora do contrato de
experiência (pedido do empregado) · 4 Término do contrato de experiência no prazo · 5
Rescisão antecipada do contrato de experiência pelo empregado · 6 idem pelo empregador ·
7 Rescisão indireta · 8 Acordo entre as partes (Art. 484-A) · 9 Aposentadoria · 10
Falecimento.

**Tipos de aviso prévio** (`/termination-types`): 1 Trabalhado · 2 Indenizado · 3
Dispensado/Não aplicável.

**Identidade de gênero** (`/gender-identities`, 11): 1 Homem · 2 Mulher · 3 Homem Trans
· 4 Mulher Trans · 5 Não-binário · 6 Gênero Fluido · 7 Transexual · 8 Transgênero · 9
Queer · 10 Outros · 11 Prefiro não responder. *(Diverge do "12 opções" registrado em
`requisitos-convenia.md` — ver nota de divergência em `regras-de-negocio-clt.md`.)*

**Gênero no documento** (`/genders`): 1 Masculino · 2 Feminino.

**Relacionamento de dependentes** (`/dependent-relations`, 9): 1 Cônjuge · 2
Companheiro(a) com filho ou união >5 anos · 3 Filho(a)/enteado(a) até 21 anos · 4
Filho(a)/enteado(a) universitário até 24 anos · 5 Filho(a)/enteado(a) com incapacidade
física ou mental · 6 Irmão(ã)/neto(a)/bisneto(a) sob guarda judicial · 7
Pais/avós/bisavós dependentes econômicos · 8 Menor pobre até 21 anos sob guarda judicial
· 9 Outros.

**Tipos de deficiência (PCD)** (`/disabilities`, 6): 1 Física · 2 Auditiva · 3 Visual · 4
Intelectual/Mental · 5 Múltipla · 6 Reabilitado pelo INSS.

**Formas de pagamento** (`/payment-methods`): 1 Salário · 2 Pró-labore · 3 Bolsa auxílio
· 4 Autônomo (RPA) · 5 Prestador PJ.

**Tipos de salário** (`/salary-types`): 1 Por mês · 2 Por hora · 3 Por dia · 4 Por tarefa
· 5 Comissionado.

**Motivos de falta/afastamento** (`/employees/absences/motives`, 12): 1 Falta
injustificada · 2 Doença/atestado médico (<15 dias) · 3 Doença INSS (>15 dias) · 4
Acidente de trabalho/doença ocupacional · 5 Licença Maternidade (120 ou 180 dias) · 6
Licença Paternidade (5 ou 20 dias) · 7 Licença Casamento/Gala (3 dias) · 8 Licença
Luto/Nojo (2 dias) · 9 Doação de sangue (1x/12 meses) · 10 Alistamento
Militar/Serviço Obrigatório · 11 Convocação Judicial/Júri/Eleitoral · 12 Licença Não
Remunerada.

**Outros catálogos confirmados, sem lista completa de valores no material**: nacionalidades,
bancos, estados/cidades, relacionamentos de contatos de emergência, tipos de admissão,
tipos de estabilidade, categoria de trabalhadores (eSocial), e o bloco "estrangeiro"
(tipos de visto, condições de ingresso, tempo de residência, descrição de logradouro,
países).

## Matriz de permissões (RBAC) — resumo por recurso

| Recurso/Ação | RH/SuperAdmin | Pessoa Gestora | Colaborador (ESS) | Contador Externo |
|---|:---:|:---:|:---:|:---:|
| Ver colaboradores | Todos | Só liderados | Só o próprio perfil | Leitura da folha |
| Ver salário | Sim | Configurável | Só o próprio | Sim |
| Iniciar admissão/desligamento | Sim | Não | Não | Acompanhamento |
| Solicitar férias | Sim | Para liderados | Próprias | Não |
| Aprovar férias | Sim | Liderados diretos/indiretos | Não | Não |
| Upload de holerites em lote | Sim | Não | Não | Sim |
| Ver holerite | Sim | Não | Próprio | Sim |
| Criar metas/OKRs | Sim | Do time | Próprias | Não |
| Fazer 1:1 e avaliar risco | Sim | Dos liderados | Ver as próprias | Não |
| Gerenciar config./API | Sim | Não | Não | Não |

Esta matriz é consistente com os toggles granulares já descritos em
`requisitos-convenia.md` (seção Configurações > Acessos e Permissões), mas dá a versão
tabular resumida por recurso.
