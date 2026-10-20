# 03 — Recálculo das SCs sem aprovador quando o RH muda o departamento

**What to build:** quando `colaboradores.departamento_id` ou
`departamentos.aprovador_sc_id` mudarem, recalcular `approver_id` só das
SCs `pending` com `approver_id` nulo; SCs que já têm aprovador não mudam.
O recálculo tem de ser `SECURITY DEFINER` (a proteção da issue 01 barra
`authenticated`). O e-mail ao novo aprovador fica na issue 04. A marca
"aprova SC" na ficha deixou de existir: o aprovador é definido na aba
Departamentos (issue 06).

**Blocked by:** 01, 06

**Status:** ready-for-agent

- [x] Trigger(s) de recálculo em `colaboradores` (`departamento_id`) e `departamentos` (`aprovador_sc_id`), restritos a SCs pendentes sem aprovador, `SECURITY DEFINER`.
- [ ] Validado no projeto de teste (depende da 06 aplicada lá): colocar a Ana Claudia num departamento com aprovador leva a SC pendente dela (REQ868) a esse aprovador; definir o aprovador de um departamento sem aprovador leva as SCs pendentes dos membros a ele.

## Comments

**20/10/2026 — triggers de recálculo.**

- Migration `supabase/migrations/20261020234000_sc_recalculo_aprovador.sql`
  (depois da 01; aborta se `requests_resolver_aprovador` não existir):
  - `requests_recalcular_aprovador_colaborador` — `AFTER INSERT OR UPDATE OF
    departamento_id ON colaboradores`: resolve o aprovador do colaborador
    (`requests_resolver_aprovador`) e grava nas SCs `pending` dele sem
    aprovador. INSERT entra porque a ficha pode nascer já com departamento;
    UPDATE só age se o departamento mudou de fato (re-salvar a ficha não
    recalcula, para não gerar e-mail na 04).
  - `requests_recalcular_aprovador_departamento` — `AFTER UPDATE OF
    aprovador_sc_id ON departamentos`: o mesmo para todos os membros.
  - Ambas `SECURITY DEFINER`, `EXECUTE` revogado do client. Aprovador
    removido (NULL) ou inutilizável não grava nada; SC com aprovador nunca
    muda (nem quando o departamento troca de aprovador).
- Fora do gatilho (spec só pede as duas colunas): vincular login depois
  (`colaboradores.user_profile_id`) ou o aprovador voltar a ficar
  utilizável (status/usuário reativado) não recalculam.
- Validado num Postgres 18 local descartável, com esquema mínimo e a 06
  simulada, aplicando 01 + esta (e esta duas vezes): Ana entra na Área
  técnica → REQ868 vai para o Paulo (SC aprovada, SM e SC que já tinha
  aprovador não mudam); Adm ganha aprovadora → SCs pendentes dos membros vão
  para ela, a SC dela própria fica nula; trocar o aprovador do Adm não muda
  as SCs já atribuídas, mas a SC nula da antiga aprovadora vai para o novo;
  departamento sem aprovador ou com aprovador desligado → nada; ficha nova
  com departamento → SC dela recebe aprovador; tudo como `authenticated`,
  que continua barrado de gravar `approver_id` direto e de executar as
  funções.
- Falta: validar no projeto de teste depois que a 06 estiver aplicada lá. O
  e-mail ao novo aprovador é a issue 04.
- Review: o e-mail da 04 precisa de um sinal de quais SCs ganharam aprovador
  (nota deixada na 04). O filtro `SC/pending/sem aprovador` repetido nos dois
  triggers e no backfill da 01 ficou como está (três UPDATEs curtos).
