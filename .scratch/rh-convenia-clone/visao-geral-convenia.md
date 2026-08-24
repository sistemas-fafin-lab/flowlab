# O que é o Convenia

Sistema de RH (HRIS) para empresas brasileiras: centraliza o cadastro dos colaboradores
e digitaliza os principais processos de departamento pessoal (admissão, desligamento,
férias, benefícios, folha, documentos), com fluxos separados para o time de RH e para o
colaborador (self-service). Forte em compliance trabalhista brasileiro (eSocial, CLT,
cotas de PcD/Jovem Aprendiz) e em people analytics/DEI.

Tecnicamente é dividido em três frentes de acesso:
- **Admin (RH/gestão)** — `app.convenia.com.br`, com parte residual em
  `admin.convenia.com.br` (telas antigas ainda não migradas).
- **Colaborador (self-service)** — subdomínio próprio `colaborador.convenia.com.br`.
- **Login** — `login.convenia.com.br`, com e-mail/senha ou "Continuar com Google".

Detalhamento completo (campos, telas, fluxos) está em `requisitos-convenia.md`. Este
arquivo é só o resumo do que o produto faz.

Regras de negócio CLT/compliance (férias, desligamento, jornada, 9box, eNPS) levantadas
via entrevista com RH real estão em `regras-de-negocio-clt.md`. Catálogo de API pública
e dicionário de enums oficiais estão em `api-convenia.md`. Notas especulativas de
arquitetura técnica (não é decisão do flowlab) estão em `notas-implementacao.md`.

## Funcionalidades principais

- **Cadastro de colaboradores** — perfil completo por pessoa (dados pessoais, bancários,
  endereço, dependentes, formação, dados contratuais/salariais, documentos), com
  histórico de auditoria de toda alteração.
- **Admissão e desligamento** — processos guiados em etapas (kanban), com preenchimento
  pelo próprio candidato ou manual pelo RH, e troca de informações com a contabilidade.
- **Férias** — solicitação, aprovação e acompanhamento de saldo, tanto pelo RH quanto
  pelo colaborador.
- **Benefícios** — catálogo de planos (saúde, VR/VA etc.) vinculados aos colaboradores.
- **Reembolsos** — colaborador solicita, RH aprova ou recusa.
- **Folha de pagamento e recibos** — distribuição em massa de holerites e outros
  documentos de folha; fechamento de folha é feito via parceria (BPO), não é self-service.
- **Desenvolvimento** — metas (estilo OKR), avaliação de desempenho (com matriz 9box),
  reuniões 1:1 e PDI (plano de desenvolvimento individual).
- **Engajamento** — pesquisas (eNPS, clima, sentimentos) e mural de comunicados internos.
- **Fale com o RH** — helpdesk interno em formato de ticket (assunto + categoria +
  roteamento para o responsável), acessível pelo colaborador.
- **Relatórios e indicadores** — mais de 50 relatórios prontos e dashboards de people
  analytics (turnover, headcount, diversidade, equidade salarial etc.), com foco em
  compliance trabalhista.
- **Organograma** — árvore da empresa gerada automaticamente a partir da hierarquia de
  gestores.
- **Convenia Sync** — integração com o escritório de contabilidade via token de API,
  expondo eventos de RH (admissão, desligamento, férias, folha).
- **Configurações** — hub central: cargos/departamentos/centros de custo, permissões
  (RBAC granular por papel), campos personalizados, integrações (Zapier, API própria,
  Pontomais, ClickSign etc.), templates de contrato e e-mail, jornadas de trabalho.
- **Recrutamento e seleção** — ATS (vagas + banco de talentos), vendido como add-on à
  parte.
- **Assinatura eletrônica** — add-on via integração com ClickSign, não é nativo.

## Módulos pagos à parte (não inclusos no plano básico)

- Recrutamento e Seleção (ATS)
- Assinatura eletrônica de documentos (ClickSign)
- Fechamento de folha via BPO
