# Gera a migration do backfill Jan–Jun/2026 a partir de h1/classificadas.json.
import json, uuid, datetime as D, collections, sys

SAIDA = sys.argv[1]
C = [c for c in json.load(open('h1/classificadas.json')) if c['acao'] == 'importar']
STLOT = {1: 'Em Processamento', 2: 'Conciliação', 3: 'Faturado', 4: 'Recebido', 5: 'Cancelado',
         6: 'Exportado TOTVS', 7: 'Recebido - parcial', 8: 'Prejuízo'}
MES = {'JANEIRO': 1, 'FEVEREIRO': 2, 'MARÇO': 3, 'ABRIL': 4, 'MAIO': 5, 'JUNHO': 6}
TRI = {'JANEIRO': 'Q1', 'FEVEREIRO': 'Q1', 'MARÇO': 'Q1', 'ABRIL': 'Q2', 'MAIO': 'Q2', 'JUNHO': 'Q2'}
NS = uuid.UUID('6f1c2b1e-4a7d-4c55-9a51-2b9e8f0d1a01')  # uuid5 → o arquivo sai igual a cada geração

# Linhas que ficam de fora além das já excluídas na classificação.
EXCLUIR = {'JUNHO:204': 'SIS SENADO devolvido com Valor Enviado 0 (apLIS 439,13)'}

def q(s):
    return 'NULL' if s is None else "'" + str(s).replace("'", "''") + "'"

def dt(s):
    return 'NULL' if not s else f"DATE '{s}'"

def m(v):
    return f'{round(v + 0.0, 2):.2f}'

def ano2026(iso, fech=None):
    """Datas com ano digitado errado (2023/2025) → 2026. Só quando o ano é < 2026."""
    if not iso:
        return iso, False
    d = D.date.fromisoformat(iso)
    if d.year < 2026:
        return d.replace(year=2026).isoformat(), True
    return iso, False

linhas_sql, rel = [], collections.defaultdict(list)
excluidas_extra = []
ops = set()
blocos = []
aba_tot = collections.defaultdict(collections.Counter)
tot = collections.Counter()

for c in sorted(C, key=lambda c: (MES[c['aba']], c['linha'])):
    if c['ref'] in EXCLUIR:
        excluidas_extra.append((c, EXCLUIR[c['ref']]))
        continue
    a = c['aplis']
    obs = list(c['obs'])
    op = str(a['IdFontePagadora'])
    ops.add(op)

    # Datas do título (planilha), com ano corrigido quando o apLIS confirma 2026.
    emissao, fx = ano2026(c['data_fat'])
    if fx:
        obs.append(f"Data Faturamento {c['data_fat']} → {emissao} (fechamento no apLIS {a['DtaFechamento']})")
    if not emissao:
        emissao = a['DtaFechamento']
        obs.append('Data Faturamento vazia → fechamento do lote no apLIS')
    venc, fx = ano2026(c['data_prov'])
    if fx:
        obs.append(f"Data Provável Pagamento {c['data_prov']} → {venc}")
    if not venc:
        venc = emissao
        obs.append('Data Provável Pagamento vazia → data de faturamento')
    if venc < emissao:
        obs.append(f'Data Provável Pagamento {venc} antes do faturamento → data de faturamento')
        venc = emissao

    rec, glosa = c['rec'], c['glosa']
    teve_baixa = rec > 0 or glosa > 0
    # Valor: apLIS quando não há baixa nem glosa (regra de 20260928140000); com
    # baixa/glosa, o da planilha, que é o valor sobre o qual o pagamento veio.
    valor = c['env'] if teve_baixa else c['valor_aplis']
    if abs(c['env'] - c['valor_aplis']) >= 0.005:
        tot['valor_difere'] += 1
        if teve_baixa:
            rel['valor_planilha'].append((c, valor))
        else:
            rel['valor_aplis'].append((c, valor))

    # Data do recebimento: planilha; sem data válida, última baixa no apLIS; senão a prevista.
    data_receb = None
    if rec > 0:
        data_receb, fx = ano2026(c['data_receb'])
        if fx:
            obs.append(f"Data Recebimento {c['data_receb']} → {data_receb}")
        if not data_receb:
            origem = c['data_receb_texto'] or 'vazia'
            if a['MaxDtaRec']:
                data_receb = a['MaxDtaRec']
                obs.append(f'Data Recebimento na planilha: {origem!r} → última baixa no apLIS ({data_receb})')
            else:
                data_receb = venc
                obs.append(f'Data Recebimento na planilha: {origem!r} → data provável de pagamento ({venc})')
            rel['data_receb_estimada'].append(c)

    # Glosa: parte ainda não recebida fica ativa; o que passa disso foi recuperado (revertida).
    refat = str(c['refat'] or '').strip().lower()
    refaturado = refat.startswith('sim') or 'refaturado' in refat
    glosa_ativa = round(min(glosa, max(0.0, valor - rec)), 2) if glosa > 0 else 0.0
    glosa_revertida = round(glosa - glosa_ativa, 2) if glosa > 0 else 0.0
    status_glosa = 'definitiva' if refaturado else 'aberta'

    lote_id = str(uuid.uuid5(NS, f"lote:{c['lote']}"))
    nota_id = str(uuid.uuid5(NS, f"nota:{c['lote']}"))
    nfe = a['NFeNumero'] if a['IdRPS'] else None
    rps = a['NumeroRPS'] if a['IdRPS'] else None
    rps_venc = a['RpsVenc'] if a['IdRPS'] else None
    protocolo = a['Protocolo'] or (str(c['protocolo_planilha']) if c['protocolo_planilha'] else None)
    criacao = a['DtaCriacao'] or emissao
    envio = a['DtaEnvio'] or emissao
    resp = c['responsavel'] or 'Backfill'
    status_pl = c['status_planilha'] or '—'
    nota_obs = (f"Backfill planilha Faturamento x Recebimentos 2026 {TRI[c['aba']]} (aba {c['aba']}, linha {c['linha']}). "
                f"Responsável: {resp}. Status original na planilha: {status_pl}.")
    if refaturado:
        nota_obs += f" Refaturamento: {str(c['refat']).strip()}."
    if c['glosa_devida']:
        nota_obs += f" Glosa devida: {c['glosa_devida']}."

    s = [f"-- {c['aba']} linha {c['linha']} | apLIS lote {c['lote']} | {a['NomFantasia']}"
         + (f" (\"{c['convenio']}\" na planilha)" if c['convenio'].upper() != (a['NomFantasia'] or '').upper() else '')]
    for o in obs:
        s.append(f'-- {o}')
    s.append('INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)')
    s.append(f"VALUES ('{lote_id}', (SELECT id_operadora FROM operadoras WHERE aplis_id = '{op}'), '{c['lote']}', {dt(criacao)}, {dt(envio)}, "
             f"{q(STLOT.get(a['Status'], 'Faturado'))}, {a['Status']}, {q(protocolo)}, {q(nfe)}, {rps if rps is not None else 'NULL'}, {dt(rps_venc)}, "
             f"'{c['lote']}', {m(valor)}, {a['QtdReq']});")
    s.append('INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)')
    s.append(f"VALUES ('{nota_id}', (SELECT id_operadora FROM operadoras WHERE aplis_id = '{op}'), {q(nfe)}, {dt(emissao)}, {dt(venc)}, "
             f"{m(valor)}, '2026-{MES[c['aba']]:02d}', {q(nota_obs)});")
    s.append(f"INSERT INTO nota_lote (id_nota, id_lote) VALUES ('{nota_id}', '{lote_id}');")
    receb_obs = 'Backfill planilha Jan-Jun/2026' + (' — data de recebimento estimada' if c in rel['data_receb_estimada'] else '')
    if rec <= 0:
        s.append('INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)')
        s.append(f"VALUES ('{nota_id}', '{lote_id}', {dt(venc)}, {m(valor)}, 'previsto', {q(resp)}, {q(receb_obs)});")
        tot['previsto'] += 1; aba_tot[c['aba']]['previsto'] += 1
    else:
        st = 'recebido' if rec >= valor - 0.005 else 'parcial'
        tot[st] += 1; aba_tot[c['aba']][st] += 1
        s.append('INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)')
        s.append(f"VALUES ('{nota_id}', '{lote_id}', {dt(venc)}, {dt(data_receb)}, {m(valor)}, {m(rec)}, '{st}', {q(resp)}, {q(receb_obs)});")
    for v, stg in [(glosa_ativa, status_glosa), (glosa_revertida, 'revertida')]:
        if v >= 0.01:
            tot['glosa_' + stg] += 1; aba_tot[c['aba']]['glosa_' + stg] += 1
            motivo = 'Glosa (backfill planilha Jan-Jun/2026 — sem motivo detalhado na origem)'
            if stg == 'revertida':
                motivo = 'Glosa recuperada (backfill planilha Jan-Jun/2026 — recebido + glosa passam do valor enviado)'
            elif stg == 'definitiva':
                motivo = 'Glosa refaturada em outro lote (backfill planilha Jan-Jun/2026)'
            s.append('INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)')
            s.append(f"VALUES ('{nota_id}', '{lote_id}', {m(v)}, {q(motivo)}, '{stg}', {q(resp)});")
    linhas_sql.append('\n'.join(s))
    blocos.append({'aba': c['aba'], 'lote': c['lote'], 'op': op, 'valor': valor, 'sql': '\n'.join(s)})
    aba_tot[c['aba']]['titulos'] += 1
    tot['titulos'] += 1
    tot['valor'] += valor
    rel['importadas'].append((c, valor, emissao))

json.dump({'tot': tot, 'ops': sorted(ops), 'lotes': sorted(c['lote'] for c, _, _ in rel['importadas']),
           'excluidas_extra': [(c['ref'], mo) for c, mo in excluidas_extra],
           'valor_aplis': [(c['ref'], c['lote'], c['env'], v) for c, v in rel['valor_aplis']],
           'valor_planilha': [(c['ref'], c['lote'], c['env'], c['valor_aplis']) for c, v in rel['valor_planilha']],
           'data_receb_estimada': [c['ref'] for c in rel['data_receb_estimada']],
           'por_mes': {k: [sum(1 for c, _, _ in rel['importadas'] if c['aba'] == k),
                           round(sum(v for c, v, _ in rel['importadas'] if c['aba'] == k), 2)] for k in MES}},
          open('h1/resumo.json', 'w'), ensure_ascii=False, indent=1, default=str)
json.dump({'blocos': blocos, 'aba_tot': aba_tot}, open('h1/blocos.json', 'w'), ensure_ascii=False)
open('h1/corpo.sql', 'w').write('\n\n'.join(linhas_sql) + '\n')
print(dict(tot))
