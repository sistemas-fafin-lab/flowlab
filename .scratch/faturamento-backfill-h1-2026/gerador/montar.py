# Monta uma migration por mês (JANEIRO..JUNHO): cabeçalho + pré-condições +
# blocos do mês (gerar_sql.py → blocos.json) + conferência. Cada arquivo é
# independente: pode rodar sozinho, em qualquer ordem.
import json

B = json.load(open('h1/blocos.json'))
r = json.load(open('h1/resumo.json'))
MESES = [('JANEIRO', 1, 'janeiro', 'Q1'), ('FEVEREIRO', 2, 'fevereiro', 'Q1'), ('MARÇO', 3, 'marco', 'Q1'),
         ('ABRIL', 4, 'abril', 'Q2'), ('MAIO', 5, 'maio', 'Q2'), ('JUNHO', 6, 'junho', 'Q2')]
VERSAO_BASE = 20260929140000  # +100 por mês: 140000, 140100, ..., 140500


def br(v):
    return f"{v:,.2f}".replace(',', 'X').replace('.', ',').replace('X', '.')


def lista(xs, ind):
    return ('\n' + ind).join(', '.join(xs[i:i + 12]) for i in range(0, len(xs), 12))


arquivos = []
for i, (aba, mes, slug, tri) in enumerate(MESES):
    blocos = [b for b in B['blocos'] if b['aba'] == aba]
    t = B['aba_tot'][aba]
    lotes = sorted(b['lote'] for b in blocos)
    ops = sorted({b['op'] for b in blocos})
    valor = sum(b['valor'] for b in blocos)
    nome = f"{VERSAO_BASE + i * 100}_backfill_contas_receber_2026_{mes:02d}_{slug}.sql"
    cab = f"""-- ============================================================================
-- Backfill histórico: Contas a Receber — {aba.capitalize()}/2026 ({i + 1} de 6)
--
-- Parte do backfill Jan–Jun/2026, dividido em uma migration por mês para caber
-- no SQL editor. Cada uma é independente (pré-condições e transação próprias) e
-- pode rodar sozinha. Fonte: aba {aba} de "Faturamento x Recebimentos - 2026 -
-- {tri[1]}° Trimestre.xlsx", recebida em 29/09. Mesmo formato do backfill do 3º tri
-- (20260911100000), já com as correções que aquele precisou depois
-- (20260928120000..150000):
--   - operadora, datas de criação/envio, protocolo, status STLOT, NF-e/RPS e
--     quantidade de guias vêm do apLIS (fatlote/fatrps, lido em 29/09);
--   - valor: soma de fatrequisicaoprocedimento.ValorLiquido no apLIS quando o
--     título não tem baixa nem glosa (regra de 20260928140000); com baixa ou
--     glosa, o "Valor Enviado" da planilha, sobre o qual o pagamento veio;
--   - emissão = "Data Faturamento", vencimento = "Data Provável Pagamento"
--     (não o do RPS, ver 20260928130000), competência = {2026}-{mes:02d};
--   - colisões conferidas contra PRODUÇÃO (jqx), não contra o teste.
--
-- {t['titulos']} títulos, R$ {br(valor)} (1 lote → 1 título → 1 recebimento).
-- Recebimentos: {t.get('recebido', 0)} recebidos, {t.get('parcial', 0)} parciais, {t.get('previsto', 0)} previstos.
-- Glosas: {t.get('glosa_aberta', 0)} abertas, {t.get('glosa_definitiva', 0)} definitivas (refaturadas em outro lote),
-- {t.get('glosa_revertida', 0)} revertidas (recuperadas). Status do título: trigger fat_recalcular_nota.
-- Recebimento sem data válida na planilha usa a última baixa no apLIS ou a
-- data provável, marcado em recebimentos.observacoes.
--
-- Linhas excluídas, correções de lote e datas: ver
-- .scratch/faturamento-backfill-h1-2026/relatorio-importacao.md.
--
-- Guias (requisições) têm PII e não entram aqui: depois das 6 migrations,
--   npx tsx supabase/scripts/backfill-requisicoes-contas-receber-q3-2026.ts \\
--     --lotes=$(cat .scratch/faturamento-backfill-h1-2026/lotes.txt) --dry-run
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 0) Pré-condições. Falha alto em vez de duplicar ou gravar operadora NULL.
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  v_existentes TEXT;
  v_operadoras INTEGER;
BEGIN
  SELECT string_agg(aplis_id, ', ' ORDER BY aplis_id)
    INTO v_existentes
    FROM lotes
   WHERE aplis_id IN (
    {lista(["'%d'" % x for x in lotes], '    ')}
   );
  IF v_existentes IS NOT NULL THEN
    RAISE EXCEPTION 'Lote(s) já cadastrado(s) em lotes: %. Remova-os desta migration antes de rodar.', v_existentes;
  END IF;

  SELECT COUNT(*) INTO v_operadoras
    FROM operadoras
   WHERE aplis_id IN ({', '.join("'%s'" % o for o in ops)});
  IF v_operadoras <> {len(ops)} THEN
    RAISE EXCEPTION 'Esperadas {len(ops)} operadoras do apLIS; encontradas %.', v_operadoras;
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 1) Lotes, notas (títulos), vínculo nota_lote, recebimentos e glosas.
--    UUIDs fixos (gerados no script) para ligar as linhas sem round-trip.
-- ----------------------------------------------------------------------------

"""
    fim = f"""

-- ----------------------------------------------------------------------------
-- 2) Conferência: todos os títulos do mês entraram, com operadora.
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  v_notas INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_notas
    FROM notas
   WHERE observacoes LIKE 'Backfill planilha Faturamento x Recebimentos 2026 {tri} (aba {aba}, %'
     AND competencia = '2026-{mes:02d}'
     AND operadora_id IS NOT NULL;
  IF v_notas <> {t['titulos']} THEN
    RAISE EXCEPTION 'Esperados {t['titulos']} títulos do backfill de {aba.lower()}; encontrados %.', v_notas;
  END IF;
END $$;

COMMIT;
"""
    open(f'h1/{nome}', 'w').write(cab + '\n\n'.join(b['sql'] for b in blocos) + fim)
    arquivos.append(nome)

open('h1/lotes.txt', 'w').write(','.join(map(str, r['lotes'])))
open('h1/arquivos.txt', 'w').write('\n'.join(arquivos) + '\n')
print('\n'.join(arquivos))
