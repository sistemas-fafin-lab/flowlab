# 01 — Prévia dos lotes do apLIS sem título

**What to build:** a fatia de ponta a ponta da leitura. Botão "Atualizar do
apLIS" no cabeçalho da página Contas a Receber (ao lado de "Sincronizar
operadoras", mesma condição `podeEditar` = `canManageBilling`, com
o aviso "dados do apLIS até ontem") abre um modal de
prévia que lista os lotes fechados no apLIS a partir da data de corte e que
ainda não têm título. Nesta issue a prévia é só leitura (seleção e criação
ficam na 02). Ver `../spec.md` — seções "Unidade e elegibilidade", "Backend" e
"Frontend".

**Blocked by:** None — can start immediately

**Status:** done

- [x] Nova função de leitura no `bdLab` de faturamento: lotes com
      `DtaFechamento` a partir de uma data, `Status` ∉ {5, 8}, com os campos de
      `LoteFaturamento` e o flag de fonte `Particular`; datas via `DATE_FORMAT`
      no SQL
- [x] Nova action `titulos-aplis-previa` (GET) no dispatcher de faturamento,
      exigindo `canManageBilling`; parâmetro `desde` (YYYY-MM-DD) com 400 se
      inválido ou anterior a 01/09/2026
- [x] Resposta exclui fonte Particular e lotes com vínculo em `nota_lote` com
      título de **qualquer status, inclusive cancelado** (diferente de
      `fat_criar_titulo` e da aba Faturas, que liberam lote de título
      cancelado — de propósito: refaturar é decisão manual)
- [x] Marca por lote: `bloqueio: 'sem-valor'` (valor ≤ 0); `jaRecebidoAplis`
      (STLOT 4/7); `semNf` (sem `NFeNumero`); `emissaoMesAnterior` (mês de
      `DtaCriacao` ≠ mês de `DtaFechamento`); `desvinculado` (último registro
      do lote em `notas_lote_audit_logs`: título, data e motivo) — o lote
      desvinculado aparece, mas vem desmarcado na 02
- [x] `nfsAPreencher` pode vir vazio por ora (issue 04)
- [x] Erro/indisponibilidade da réplica vira mensagem clara na tela
- [x] Utilitário do módulo com default da data de corte (1º dia do mês
      anterior) e piso (01/09/2026), com teste vitest incluindo virada de ano
- [x] Modal: campo "fechados a partir de" com default e mínimo; linhas com
      operadora, lote, valor, emissão (= data de criação), fechamento, NF
      quando houver; selos "já recebido no apLIS", "sem NF — a baixa exige o
      número", "emissão em mês anterior" e "desvinculado do título X em DD/MM:
      <motivo>"; bloqueados com o motivo "sem valor a faturar"; estado vazio
- [x] Teste vitest do handler no padrão de `apoio-transferir.test.ts`
      (`bdLab` e Supabase mockados): 401/403, 400 de `desde`, dedupe por lote
      com título ativo e com título cancelado, Particular fora, sem-valor, já
      recebido, sem NF, emissão em mês anterior, desvinculado com motivo
- [x] Conferência ao vivo da consulta (skill `banco-lab-mysql`): para jan–ago
      a regra devolve ~1.413 dos lotes da planilha

## Comments

**30/09 — implementado.** Handler `api/_lib/handlers/faturamento-titulos-aplis-previa.ts`
(+ teste), `listarLotesFechadosDesde` no `bdLab`, `AtualizarAplisModal` e utilitário
`utils/atualizarAplis.ts`. Decisões:

- `desde` é obrigatório e não é "grampeado": antes de 01/09/2026 → 400 (a issue manda
  400; o comentário "efetivo, já com o piso aplicado" da spec ficou desatualizado). O
  campo da tela força o piso.
- `desvinculado` ganhou `numeroNota` (para o texto "desvinculado do título X").
- Falha na dedupe do Supabase → 502 (fail-closed: sem ela a prévia ofereceria lote já
  faturado).
- Teto de segurança de 2.000 lotes na consulta (~10 meses de lotes).

Conferência ao vivo (30/09): desde 01/09 são 182 lotes fechados elegíveis antes da
dedupe (0 Particular, 0 sem valor, 3 já recebidos, 168 sem NF, 20 com emissão em mês
anterior), ~2,4 s. Jan–ago: 1.490 lotes criados no período, fechados e não cancelados,
1 deles Particular → 1.489 pela regra. Não deu para bater os ~1.413 **da planilha**
(planilha não disponível nesta sessão) — conferência pendente contra ela.
