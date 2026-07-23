#!/usr/bin/env node
// supabase/scripts/migrar-envio-alvaro.mjs
//
// Migração one-shot dos dados do Supabase avulso do projeto envio_alvaro para as
// tabelas ac_apoio_* do FlowLab (migration 20260723120000_ac_envio_apoio.sql):
//
//   lista_alvaro  → ac_apoio_exames       (dedupe por cod_exame; mantém o menor id)
//   fila_envio    → ac_apoio_fila         (preserva id/created_at/updated_at)
//   requisicoes   → ac_apoio_requisicoes  (upsert por codigo_lis)
//
// Idempotente (upserts) — pode rodar de novo sem duplicar. Rode primeiro contra o
// projeto "FlowLab - test" e só depois contra a prod.
//
// Uso:
//   ORIGEM_SUPABASE_URL=https://qme....supabase.co \
//   ORIGEM_SUPABASE_KEY=<service-role-do-envio-alvaro> \
//   DESTINO_SUPABASE_URL=https://....supabase.co \
//   DESTINO_SUPABASE_KEY=<service-role-do-flowlab> \
//   node supabase/scripts/migrar-envio-alvaro.mjs

const ORIGEM_URL = (process.env.ORIGEM_SUPABASE_URL ?? '').replace(/\/+$/, '');
const ORIGEM_KEY = process.env.ORIGEM_SUPABASE_KEY ?? '';
const DESTINO_URL = (process.env.DESTINO_SUPABASE_URL ?? '').replace(/\/+$/, '');
const DESTINO_KEY = process.env.DESTINO_SUPABASE_KEY ?? '';

if (!ORIGEM_URL || !ORIGEM_KEY || !DESTINO_URL || !DESTINO_KEY) {
  console.error(
    'Defina ORIGEM_SUPABASE_URL, ORIGEM_SUPABASE_KEY, DESTINO_SUPABASE_URL e DESTINO_SUPABASE_KEY.',
  );
  process.exit(1);
}

const PAGINA = 500;

function headers(key, extra = {}) {
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
    ...extra,
  };
}

async function lerTudo(tabela, orderBy) {
  const linhas = [];
  for (let offset = 0; ; offset += PAGINA) {
    const url = `${ORIGEM_URL}/rest/v1/${tabela}?select=*&order=${orderBy}&offset=${offset}&limit=${PAGINA}`;
    const res = await fetch(url, { headers: headers(ORIGEM_KEY) });
    if (!res.ok) throw new Error(`Leitura de ${tabela} falhou: HTTP ${res.status} ${await res.text()}`);
    const pagina = await res.json();
    linhas.push(...pagina);
    if (pagina.length < PAGINA) break;
  }
  return linhas;
}

async function upsert(tabela, linhas, onConflict) {
  if (linhas.length === 0) return;
  const url = `${DESTINO_URL}/rest/v1/${tabela}?on_conflict=${onConflict}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: headers(DESTINO_KEY, { Prefer: 'resolution=merge-duplicates' }),
    body: JSON.stringify(linhas),
  });
  if (!res.ok) throw new Error(`Upsert em ${tabela} falhou: HTTP ${res.status} ${await res.text()}`);
}

async function migrarCatalogo() {
  const origem = await lerTudo('lista_alvaro', 'id.asc');
  // Dedupe por cod_exame (o destino tem UNIQUE): mantém a primeira ocorrência (menor id)
  const porCodigo = new Map();
  let semCodigo = 0;
  for (const row of origem) {
    const cod = String(row.cod_exame ?? '').trim();
    if (!cod) {
      semCodigo++;
      continue;
    }
    if (!porCodigo.has(cod)) {
      porCodigo.set(cod, {
        cod_exame: cod,
        descricao_exame: String(row.descricao_exame ?? '').trim() || cod,
        descricao_material: row.descricao_material ?? null,
        cod_material: row.cod_material ?? null,
        preco: row.preco ?? null,
      });
    }
  }
  await upsert('ac_apoio_exames', [...porCodigo.values()], 'cod_exame');
  console.log(
    `✓ ac_apoio_exames: ${porCodigo.size} de ${origem.length} linhas` +
      (semCodigo ? ` (${semCodigo} sem cod_exame ignoradas)` : '') +
      (origem.length - semCodigo - porCodigo.size
        ? ` (${origem.length - semCodigo - porCodigo.size} duplicadas ignoradas)`
        : ''),
  );
}

async function migrarFila() {
  const origem = await lerTudo('fila_envio', 'created_at.asc');
  const linhas = origem.map((row) => ({
    id: row.id,
    status: row.status,
    numero_requisicao: row.numero_requisicao ?? null,
    filename: row.filename ?? null,
    paciente: row.paciente ?? null,
    medico: row.medico ?? null,
    exames: row.exames ?? null,
    xml_envio: row.xml_envio ?? null,
    alvaro_response: row.alvaro_response ?? null,
    erro_mensagem: row.erro_mensagem ?? null,
    resumo: row.resumo ?? null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }));
  await upsert('ac_apoio_fila', linhas, 'id');
  console.log(`✓ ac_apoio_fila: ${linhas.length} linhas`);
}

async function migrarRequisicoes() {
  const origem = await lerTudo('requisicoes', 'codigo_lis.asc');
  const linhas = origem.map((row) => ({
    codigo_lis: row.codigo_lis,
    codigo_os: row.codigo_os,
    nome: row.nome,
    datanasc: row.datanasc,
    data_coleta: row.data_coleta,
    laudo: row.laudo ?? null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }));
  await upsert('ac_apoio_requisicoes', linhas, 'codigo_lis');
  console.log(`✓ ac_apoio_requisicoes: ${linhas.length} linhas`);
}

console.log(`Origem:  ${ORIGEM_URL}`);
console.log(`Destino: ${DESTINO_URL}`);
await migrarCatalogo();
await migrarFila();
await migrarRequisicoes();
console.log('Migração concluída.');
