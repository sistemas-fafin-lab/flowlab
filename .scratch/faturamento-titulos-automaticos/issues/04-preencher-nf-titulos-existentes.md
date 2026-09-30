# 04 — Preencher a NF-e dos títulos existentes pela prévia

**What to build:** a prévia passa a listar, numa segunda seção, os títulos
(manuais, do backfill ou automáticos) sem número da nota cujo lote já tem
NF-e no apLIS. Marcados por padrão; ao confirmar, preenche o número via
`titulo-atualizar-numero-nota` com `somenteSeVazio`. O vencimento nunca é
alterado. Ver `../spec.md` — "Backend" (`nfsAPreencher`) e "Frontend".

**Blocked by:** 01, 02, 03 (reaproveita a execução com resultado por linha e o
resumo construídos na 02)

**Status:** done

- [x] `titulos-aplis-previa` preenche `nfsAPreencher`: títulos não cancelados
      com `numero_nota` vazio, independentes da data de corte
- [x] Título com vários lotes: só é preenchível quando **todos** os lotes têm
      `NFeNumero` e é **o mesmo**; lotes com NF-e diferentes → linha
      "NFs divergentes" (não selecionável, lista as NF-e); algum lote ainda sem
      NF-e → o título não aparece
- [x] Seção "NFs a preencher" no modal (operadora, lote, NF-e), marcada por
      padrão, com desmarcar por linha
- [x] Confirmar chama a rota com `somenteSeVazio`; "já preenchido" aparece na
      linha como aviso, não como falha
- [x] Resumo inclui "K NFs preenchidas"; lista de títulos recarrega
- [x] Vencimento do título não é tocado
- [x] Testes vitest do handler para `nfsAPreencher` (inclui: título com
      número não entra; título cancelado não entra; lote sem NF-e não entra;
      multi-lote com NF-e iguais entra; multi-lote com NF-e diferentes vem
      como divergente; multi-lote com um lote sem NF-e não entra)

**Notas da implementação:** `nfesDosLotes` no `bdLab` (fatlote → fatrps, sem
cache; conferida ao vivo: 4828/4898 → 9124, 6526 → 9182). A lista de títulos
sem número vem de `notas` paginada (1.000 por página), `status <> 'cancelada'`
e `numero_nota` nulo ou `''` — número só com espaços não é oferecido (o filtro
do PostgREST não faz TRIM), mas a RPC continua tratando como vazio. Título com
lote sem `aplis_id` fica fora. Falha ao ler as NF-e no apLIS derruba a prévia
inteira com a mesma mensagem clara dos lotes (mesmo túnel da consulta
anterior; decidido não degradar em silêncio). Na tela, NFs e títulos rodam na
mesma fila de 4 (NFs primeiro); "já preenchida" é aviso âmbar, não falha;
`resumoCriacao` virou `resumoExecucao`. Modal validado só por typecheck/testes
das funções puras — falta a conferência manual no app.

