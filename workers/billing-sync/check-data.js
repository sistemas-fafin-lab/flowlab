/**
 * Script de teste para verificar dados no Supabase
 */
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkData() {
  console.log('\n=== VERIFICAÇÃO DE DADOS NO SUPABASE ===\n');

  // 1. Verificar logs de sincronização
  console.log('--- BILLING SYNC LOG ---');
  const { data: logs, error: logsError } = await supabase
    .from('billing_sync_log')
    .select('*')
    .order('started_at', { ascending: false })
    .limit(5);
  
  if (logsError) {
    console.log('Erro:', logsError.message);
    if (logsError.code === '42P01') {
      console.log('\n⚠️  Tabela billing_sync_log não existe!');
      console.log('Execute a migration: supabase/migrations/20260320_billing_module.sql\n');
      return;
    }
  } else {
    console.log('Registros:', logs?.length || 0);
    if (logs?.length > 0) {
      logs.forEach(log => {
        console.log(`  - [${log.status}] ${log.sync_type} em ${log.started_at}`);
        console.log(`    Processados: ${log.records_processed}, Criados: ${log.records_created}, Falhas: ${log.records_failed}`);
      });
    }
  }

  // 2. Verificar operadoras
  console.log('\n--- OPERADORAS ---');
  const { data: operadoras, error: opError, count: opCount } = await supabase
    .from('operadoras')
    .select('*', { count: 'exact' });
  
  if (opError) {
    console.log('Erro:', opError.message);
  } else {
    console.log('Total:', opCount || operadoras?.length || 0);
    operadoras?.forEach(op => console.log(`  - ${op.nome} (${op.cnpj})`));
  }

  // 3. Verificar lotes
  console.log('\n--- LOTES ---');
  const { data: lotes, error: loteError, count: loteCount } = await supabase
    .from('lotes')
    .select('*', { count: 'exact' });
  
  if (loteError) {
    console.log('Erro:', loteError.message);
  } else {
    console.log('Total:', loteCount || lotes?.length || 0);
    lotes?.forEach(l => console.log(`  - ${l.codigo_lote} [${l.status}] R$ ${l.valor_total}`));
  }

  // 4. Verificar requisições
  console.log('\n--- REQUISIÇÕES ---');
  const { count: reqCount, error: reqError } = await supabase
    .from('requisicoes')
    .select('*', { count: 'exact', head: true });
  
  if (reqError) {
    console.log('Erro:', reqError.message);
  } else {
    console.log('Total:', reqCount || 0);
  }

  // 5. Verificar notas
  console.log('\n--- NOTAS ---');
  const { count: notaCount, error: notaError } = await supabase
    .from('notas')
    .select('*', { count: 'exact', head: true });
  
  if (notaError) {
    console.log('Erro:', notaError.message);
  } else {
    console.log('Total:', notaCount || 0);
  }

  console.log('\n=========================================\n');
}

checkData().catch(console.error);
