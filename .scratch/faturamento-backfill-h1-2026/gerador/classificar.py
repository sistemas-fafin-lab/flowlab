# Classifica as linhas das planilhas Q1/Q2 (JANEIRO..JUNHO) em importar / excluir,
# resolvendo o lote real no apLIS. Saída: h1/classificadas.json.
import json, re, datetime as D, collections

L = json.load(open('h1/linhas.json'))
txt = open('h1/aplis_lotes.json').read()
A = {r['IdLote']: r for r in json.loads(txt[:txt.rindex(']') + 1])}
PROD = {p['aplis_id'] for p in json.load(open('h1/prod_lotes.json'))}

MES = {'JANEIRO': 1, 'FEVEREIRO': 2, 'MARÇO': 3, 'ABRIL': 4, 'MAIO': 5, 'JUNHO': 6}

# Lote digitado errado na planilha; o protocolo da mesma linha acha o lote real.
CORRECAO_LOTE = {
    'FEVEREIRO:97': 5653,   # PMDF, lote 4900 não existe; protocolo 429266
    'MAIO:210': 5876,       # SAUDE CAIXA, lote 58761 não existe; protocolo 7401124
    'ABRIL:58': 5525,       # AMIL, lote 5524 é Bradesco; protocolo 5701563381
    'MAIO:49': 5762,        # AMHPDF - PROASA, lote 5672 é GEAP; protocolo 44692957
}
# Linhas cujo lote aparece em mais de uma linha: fica a que bate com o apLIS.
DUPLICADA = {
    'JANEIRO:122': 'lote 4818 é da AMIL (linha JANEIRO:41); protocolo 260130009297 não existe no apLIS',
    'JANEIRO:79': 'lote 4919 é da SUL AMERICA (linha JANEIRO:124); linha sem protocolo',
    'FEVEREIRO:113': 'lote 4935 repetido em ABRIL:193 (mesmo valor recebido); fica ABRIL, mês do fechamento no apLIS',
    'ABRIL:119': 'lote 5188 repetido em ABRIL:109 (mesmo protocolo e valor)',
    'ABRIL:227': 'lote 5200 devolvido (protocolo 476016) e reapresentado em MAIO:230 com o protocolo atual',
    'MAIO:156': 'lote 5675 reapresentado em JUNHO:147 com o protocolo atual',
    'MAIO:159': 'lote 5692 reapresentado em JUNHO:148 com o protocolo atual',
    'MAIO:238': 'lote 5699 repetido em MAIO:160 (mesmo protocolo e valor)',
}


def num(v):
    return float(v) if isinstance(v, (int, float)) and not isinstance(v, bool) else None


def data(v):
    """Data da planilha → ISO, corrigindo os formatos malformados conhecidos."""
    if isinstance(v, dict) and 'd' in v:
        return v['d'], None
    if isinstance(v, str):
        m = re.fullmatch(r'\s*(\d{1,2})/(\d{1,2})/(\d{4})\s*', v)
        if m:
            d, mth, y = map(int, m.groups())
            fix = None
            if y in (206, 226, 2026) or str(y).endswith('26'):
                if y != 2026:
                    fix = f'{v!r} → ano 2026'
                y = 2026
            try:
                return D.date(y, mth, d).isoformat(), fix
            except ValueError:
                return None, f'{v!r} inválida'
    return None, None


out = []
for l in L:
    ref = f"{l['aba']}:{l['linha']}"
    c = {'ref': ref, 'aba': l['aba'], 'linha': l['linha'], 'convenio': (l['convenio'] or '').strip(), 'obs': []}
    env = num(l['valor_enviado'])
    lote = int(l['lote']) if isinstance(l['lote'], float) else None
    conv = c['convenio'].upper()

    if not c['convenio'] and env is None:
        c['acao'] = 'vazia'
    elif conv.startswith('PARTICULAR'):
        c['acao'] = 'excluir'; c['motivo'] = 'PARTICULARES: total do mês, não é lote de convênio'
    elif ref in DUPLICADA:
        c['acao'] = 'excluir'; c['motivo'] = DUPLICADA[ref]
    elif isinstance(l['status'], str) and 'CANCELADO' in l['status'].upper():
        c['acao'] = 'excluir'; c['motivo'] = f"cancelado na planilha ({l['status'].strip()})"
    else:
        if ref in CORRECAO_LOTE:
            c['obs'].append(f'lote digitado {lote} → lote real {CORRECAO_LOTE[ref]} (pelo protocolo)')
            lote = CORRECAO_LOTE[ref]
        a = A.get(lote)
        if lote is None or env is None:
            c['acao'] = 'excluir'; c['motivo'] = 'sem lote ou sem valor enviado'
        elif str(lote) in PROD:
            c['acao'] = 'excluir'; c['motivo'] = f'lote {lote} já tem título em produção (reapresentado no 3º tri)'
        elif not a:
            c['acao'] = 'excluir'; c['motivo'] = f'lote {lote} não existe no apLIS e o protocolo não acha outro'
        else:
            c['acao'] = 'importar'
    c['lote'] = lote
    if c['acao'] == 'importar':
        a = A[lote]
        c['aplis'] = a
        c['env'] = env
        c['valor_aplis'] = float(a['Valor'])
        rec = num(l['valor_recebido']) or 0.0
        c['rec'] = rec
        glo = num(l['glosas']) or 0.0
        c['glosa'] = glo
        c['responsavel'] = (l['responsavel'] or '').strip() or None
        c['status_planilha'] = (l['status'] or '').strip() if isinstance(l['status'], str) else None
        c['glosa_devida'] = (l['glosa_devida'] or '').strip().lower() if isinstance(l['glosa_devida'], str) else None
        c['refat'] = l['refaturamento']
        c['recurso1'] = num(l['recurso1']); c['acatado'] = num(l['valor_acatado'])
        c['protocolo_planilha'] = l['protocolo']
        c['data_receb_texto'] = l['data_receb'] if isinstance(l['data_receb'], str) else None
        df, fx = data(l['data_fat'])
        if fx: c['obs'].append(f'Data Faturamento {fx}')
        c['data_fat'] = df
        dp, fx = data(l['data_prov'])
        if fx: c['obs'].append(f'Data Provável Pagamento {fx}')
        c['data_prov'] = dp
        dr, fx = data(l['data_receb'])
        if fx: c['obs'].append(f'Data Recebimento {fx}')
        c['data_receb'] = dr
    out.append(c)

# Um lote só pode virar um título.
cnt = collections.Counter(c['lote'] for c in out if c['acao'] == 'importar')
dup = {k: v for k, v in cnt.items() if v > 1}
assert not dup, dup
json.dump(out, open('h1/classificadas.json', 'w'), ensure_ascii=False, indent=0, default=str)
print(collections.Counter(c['acao'] for c in out))
print(collections.Counter(c.get('motivo', '')[:60] for c in out if c['acao'] == 'excluir'))
