# Notas de implementação técnica — material especulativo (não decisão para o flowlab)

> Fonte: `import_files/mario - sistema RH/SPEC_MESTRE_IMPLEMENTACAO_CODER.md` e
> `SPEC_TECNICA_CONVENIA_PLATAFORMA.md`, lidos em 2026-08-20.
>
> **Proveniência**: diferente dos outros arquivos deste diretório, isto **não** é
> levantamento sobre o Convenia real — é uma proposta de arquitetura de "como
> normalmente se implementa um sistema deste tipo" (inclui DDL SQL de 32 tabelas,
> microsserviços, filas, cache), gerada a partir do domínio, não da entrevista com o
> RH. Um RH não descreve isso. Guardado aqui só como referência de possíveis decisões
> técnicas a avaliar quando o flowlab entrar na fase de design técnico do clone — **não
> é compromisso nem confirmação de nada**, e não deve ser confundido com levantamento
> funcional (esse está em `requisitos-convenia.md`).

## Ideias de arquitetura sugeridas no material (avaliar, não adotar de cara)

- Multi-tenancy rígido por `company_id` (UUID) em toda query, com RLS como alternativa
  ao filtro manual — coerente com o padrão que o flowlab já usa (Supabase + RLS), vale
  reaproveitar o princípio.
- URLs de documentos privados (S3) via pre-signed URL com expiração curta (sugerido: 15
  min).
- Separação em serviços por domínio: Employee Core, Admission & Exit, Vacation &
  Absence, Benefits & Expense, Payroll & Recibos, Performance & OKRs, Engagement/Mural,
  Insights & BI, Webhook & Sync — mapeia razoavelmente aos módulos já identificados no
  levantamento funcional, mesmo que o flowlab não vá construir como microsserviços
  separados.
- Padrão de resposta de API:
  ```json
  { "success": true, "message": "...", "data": {}, "meta": { "page": 1, "limit": 25, "total_records": 120, "total_pages": 5 } }
  ```
  Erros de validação (`422`): `error_code: "VALIDATION_FAILED"` + `errors: { campo: [mensagens] }`.
  Erros de regra de negócio (`400`/`403`): `error_code` específico por regra, ex.
  `"CLT_VACATION_RULE_VIOLATION"` — ideia interessante para o clone: nomear
  error_codes por regra de compliance violada (rastreável, mensagem amigável já
  embutida), em vez de um erro genérico.
- Esquema relacional completo de 32 tabelas (DDL SQL) está no arquivo-fonte
  `SPEC_MESTRE_IMPLEMENTACAO_CODER.md`, não reproduzido aqui — é modelagem "de
  livro-texto" para um HRIS genérico (companies, employees, dependents, addresses,
  bank_accounts, educations, vacations, absences, benefits, payrolls, custom_fields,
  audit_log etc.), útil como checklist de "não esquecer nenhuma entidade" na hora de
  desenhar o schema real do flowlab, mas não deve ser copiado 1:1 sem passar pelo
  desenho de dados próprio do projeto (que já segue os padrões descritos em
  `docs/agents/domain.md` / `CONTEXT.md` do flowlab).

## O que fazer com isso

Não usar como fonte de requisito funcional. Revisitar quando o flowlab for desenhar o
schema e a API do módulo de RH — nesse momento, ler o DDL completo no arquivo-fonte para
não esquecer entidades (ex.: contribuição sindical, período de experiência, jornada de
trabalho como registro separado do texto composto) e decidir o que faz sentido adotar
dado o stack já existente do projeto (Supabase/Postgres + RLS).
