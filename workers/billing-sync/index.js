/**
 * ============================================================================
 * BILLING SYNC WORKER
 * Sincronizador de dados do sistema APLIS para o Supabase
 * ============================================================================
 * 
 * Este worker roda como um processo Node.js separado do frontend e é responsável
 * por sincronizar dados de faturamento do sistema APLIS para o banco de dados.
 * 
 * Execução:
 * - Às 05:00 da manhã (sync completo diário)
 * - A cada 2 horas (sync incremental)
 * 
 * Uso:
 *   node workers/billing-sync/index.js
 * 
 * Variáveis de ambiente requeridas:
 *   SUPABASE_URL - URL do projeto Supabase
 *   SUPABASE_SERVICE_ROLE_KEY - Chave de serviço do Supabase
 *   APLIS_API_URL - URL da API do APLIS
 *   APLIS_API_KEY - Chave de autenticação do APLIS
 */

const cron = require('node-cron');
const { createClient } = require('@supabase/supabase-js');
const config = require('./config');
const AplisClient = require('./aplis-client');

// ============================================================================
// INICIALIZAÇÃO
// ============================================================================

const supabase = createClient(config.supabase.url, config.supabase.serviceRoleKey, {
  auth: { persistSession: false }
});

const aplisClient = new AplisClient(config.aplis.url, config.aplis.apiKey);

// ============================================================================
// FUNÇÕES DE SINCRONIZAÇÃO
// ============================================================================

/**
 * Sincroniza operadoras do APLIS
 */
async function syncOperadoras(logId) {
  console.log('[SYNC] Iniciando sincronização de operadoras...');
  
  try {
    const operadoras = await aplisClient.getOperadoras();
    let created = 0, updated = 0, failed = 0;

    for (const op of operadoras) {
      try {
        const { data, error } = await supabase
          .from('operadoras')
          .upsert({
            aplis_id: op.id,
            nome: op.name,
            cnpj: op.cnpj,
            prazo_pagamento_dias: op.paymentTermDays || 30,
            updated_at: new Date().toISOString()
          }, {
            onConflict: 'aplis_id'
          })
          .select();

        if (error) throw error;
        
        if (data?.[0]?.created_at === data?.[0]?.updated_at) {
          created++;
        } else {
          updated++;
        }
      } catch (err) {
        console.error(`[SYNC] Erro ao sincronizar operadora ${op.id}:`, err.message);
        failed++;
      }
    }

    console.log(`[SYNC] Operadoras: ${created} criadas, ${updated} atualizadas, ${failed} falhas`);
    return { processed: operadoras.length, created, updated, failed };
  } catch (err) {
    console.error('[SYNC] Erro ao buscar operadoras do APLIS:', err.message);
    throw err;
  }
}

/**
 * Sincroniza lotes do APLIS
 */
async function syncLotes(logId) {
  console.log('[SYNC] Iniciando sincronização de lotes...');
  
  try {
    const lotes = await aplisClient.getLotes();
    let created = 0, updated = 0, failed = 0;

    // Primeiro, buscar mapeamento de operadoras
    const { data: operadoras } = await supabase
      .from('operadoras')
      .select('id_operadora, aplis_id');
    
    const operadoraMap = new Map(operadoras?.map(o => [o.aplis_id, o.id_operadora]) || []);

    for (const lote of lotes) {
      try {
        const operadora_id = operadoraMap.get(lote.operadoraId);
        if (!operadora_id) {
          console.warn(`[SYNC] Operadora não encontrada para lote ${lote.id}`);
          failed++;
          continue;
        }

        const statusMap = {
          'open': 'aberto',
          'sent': 'enviado',
          'processed': 'processado',
          'closed': 'fechado'
        };

        const { data, error } = await supabase
          .from('lotes')
          .upsert({
            aplis_id: lote.id,
            operadora_id,
            codigo_lote: lote.batchCode,
            data_criacao: lote.creationDate,
            data_envio: lote.sendDate || null,
            status: statusMap[lote.status] || 'aberto',
            valor_total: lote.totalValue,
            qtd_requisicoes: lote.requisitionCount,
            updated_at: new Date().toISOString()
          }, {
            onConflict: 'aplis_id'
          })
          .select();

        if (error) throw error;
        
        if (data?.[0]?.created_at === data?.[0]?.updated_at) {
          created++;
        } else {
          updated++;
        }
      } catch (err) {
        console.error(`[SYNC] Erro ao sincronizar lote ${lote.id}:`, err.message);
        failed++;
      }
    }

    console.log(`[SYNC] Lotes: ${created} criados, ${updated} atualizados, ${failed} falhas`);
    return { processed: lotes.length, created, updated, failed };
  } catch (err) {
    console.error('[SYNC] Erro ao buscar lotes do APLIS:', err.message);
    throw err;
  }
}

/**
 * Sincroniza requisições do APLIS
 */
async function syncRequisicoes(logId) {
  console.log('[SYNC] Iniciando sincronização de requisições...');
  
  try {
    const requisicoes = await aplisClient.getRequisicoes();
    let created = 0, updated = 0, failed = 0;

    // Buscar mapeamento de lotes
    const { data: lotes } = await supabase
      .from('lotes')
      .select('id_lote, aplis_id');
    
    const loteMap = new Map(lotes?.map(l => [l.aplis_id, l.id_lote]) || []);

    for (const req of requisicoes) {
      try {
        const lote_id = req.batchId ? loteMap.get(req.batchId) : null;

        const statusMap = {
          'pending': 'pendente',
          'in_batch': 'em_lote',
          'invoiced': 'faturada',
          'paid': 'paga',
          'denied': 'glosada'
        };

        const { data, error } = await supabase
          .from('requisicoes')
          .upsert({
            aplis_id: req.id,
            lote_id,
            numero_guia: req.guideNumber,
            data_criacao: req.creationDate,
            data_execucao: req.executionDate || null,
            valor: req.value,
            status: statusMap[req.status] || 'pendente',
            paciente_nome: req.patientName || null,
            procedimento_codigo: req.procedureCode || null,
            procedimento_descricao: req.procedureDescription || null,
            updated_at: new Date().toISOString()
          }, {
            onConflict: 'aplis_id'
          })
          .select();

        if (error) throw error;
        
        if (data?.[0]?.created_at === data?.[0]?.updated_at) {
          created++;
        } else {
          updated++;
        }
      } catch (err) {
        console.error(`[SYNC] Erro ao sincronizar requisição ${req.id}:`, err.message);
        failed++;
      }
    }

    console.log(`[SYNC] Requisições: ${created} criadas, ${updated} atualizadas, ${failed} falhas`);
    return { processed: requisicoes.length, created, updated, failed };
  } catch (err) {
    console.error('[SYNC] Erro ao buscar requisições do APLIS:', err.message);
    throw err;
  }
}

/**
 * Sincroniza notas fiscais do APLIS
 */
async function syncNotas(logId) {
  console.log('[SYNC] Iniciando sincronização de notas...');
  
  try {
    const notas = await aplisClient.getNotas();
    let created = 0, updated = 0, failed = 0;

    // Buscar mapeamento de operadoras
    const { data: operadoras } = await supabase
      .from('operadoras')
      .select('id_operadora, aplis_id');
    
    const operadoraMap = new Map(operadoras?.map(o => [o.aplis_id, o.id_operadora]) || []);

    for (const nota of notas) {
      try {
        const operadora_id = operadoraMap.get(nota.operadoraId);
        if (!operadora_id) {
          console.warn(`[SYNC] Operadora não encontrada para nota ${nota.id}`);
          failed++;
          continue;
        }

        const statusMap = {
          'open': 'aberta',
          'partial': 'parcialmente_recebida',
          'received': 'recebida',
          'denied': 'glosada',
          'cancelled': 'cancelada'
        };

        const { data, error } = await supabase
          .from('notas')
          .upsert({
            aplis_id: nota.id,
            operadora_id,
            numero_nota: nota.invoiceNumber,
            data_emissao: nota.issueDate,
            data_vencimento: nota.dueDate || null,
            valor_total: nota.totalValue,
            status: statusMap[nota.status] || 'aberta',
            competencia: nota.competence || null,
            updated_at: new Date().toISOString()
          }, {
            onConflict: 'aplis_id'
          })
          .select();

        if (error) throw error;
        
        if (data?.[0]?.created_at === data?.[0]?.updated_at) {
          created++;
        } else {
          updated++;
        }
      } catch (err) {
        console.error(`[SYNC] Erro ao sincronizar nota ${nota.id}:`, err.message);
        failed++;
      }
    }

    console.log(`[SYNC] Notas: ${created} criadas, ${updated} atualizadas, ${failed} falhas`);
    return { processed: notas.length, created, updated, failed };
  } catch (err) {
    console.error('[SYNC] Erro ao buscar notas do APLIS:', err.message);
    throw err;
  }
}

/**
 * Cria registro de log de sincronização
 */
async function createSyncLog(syncType) {
  const { data, error } = await supabase
    .from('billing_sync_log')
    .insert({
      sync_type: syncType,
      status: 'running'
    })
    .select()
    .single();

  if (error) {
    console.error('[SYNC] Erro ao criar log de sincronização:', error.message);
    return null;
  }

  return data.id;
}

/**
 * Atualiza registro de log de sincronização
 */
async function updateSyncLog(logId, status, stats, errorMessage = null) {
  if (!logId) return;

  const { error } = await supabase
    .from('billing_sync_log')
    .update({
      finished_at: new Date().toISOString(),
      status,
      records_processed: stats.processed || 0,
      records_created: stats.created || 0,
      records_updated: stats.updated || 0,
      records_failed: stats.failed || 0,
      error_message: errorMessage,
      details: stats.details || null
    })
    .eq('id', logId);

  if (error) {
    console.error('[SYNC] Erro ao atualizar log de sincronização:', error.message);
  }
}

/**
 * Executa sincronização completa
 */
async function runFullSync() {
  console.log('\n========================================');
  console.log('[SYNC] Iniciando sincronização COMPLETA');
  console.log(`[SYNC] Timestamp: ${new Date().toISOString()}`);
  console.log('========================================\n');

  const logId = await createSyncLog('full');
  const stats = {
    processed: 0,
    created: 0,
    updated: 0,
    failed: 0,
    details: {}
  };

  try {
    // 1. Sincronizar operadoras (base)
    const opStats = await syncOperadoras(logId);
    stats.details.operadoras = opStats;
    stats.processed += opStats.processed;
    stats.created += opStats.created;
    stats.updated += opStats.updated;
    stats.failed += opStats.failed;

    // 2. Sincronizar lotes (depende de operadoras)
    const loteStats = await syncLotes(logId);
    stats.details.lotes = loteStats;
    stats.processed += loteStats.processed;
    stats.created += loteStats.created;
    stats.updated += loteStats.updated;
    stats.failed += loteStats.failed;

    // 3. Sincronizar requisições (depende de lotes)
    const reqStats = await syncRequisicoes(logId);
    stats.details.requisicoes = reqStats;
    stats.processed += reqStats.processed;
    stats.created += reqStats.created;
    stats.updated += reqStats.updated;
    stats.failed += reqStats.failed;

    // 4. Sincronizar notas (depende de operadoras)
    const notaStats = await syncNotas(logId);
    stats.details.notas = notaStats;
    stats.processed += notaStats.processed;
    stats.created += notaStats.created;
    stats.updated += notaStats.updated;
    stats.failed += notaStats.failed;

    const finalStatus = stats.failed > 0 ? 'partial' : 'success';
    await updateSyncLog(logId, finalStatus, stats);

    console.log('\n========================================');
    console.log('[SYNC] Sincronização COMPLETA finalizada');
    console.log(`[SYNC] Status: ${finalStatus}`);
    console.log(`[SYNC] Processados: ${stats.processed}`);
    console.log(`[SYNC] Criados: ${stats.created}`);
    console.log(`[SYNC] Atualizados: ${stats.updated}`);
    console.log(`[SYNC] Falhas: ${stats.failed}`);
    console.log('========================================\n');

  } catch (err) {
    console.error('[SYNC] ERRO na sincronização completa:', err.message);
    await updateSyncLog(logId, 'error', stats, err.message);
  }
}

/**
 * Executa sincronização incremental (apenas notas recentes)
 */
async function runIncrementalSync() {
  console.log('\n----------------------------------------');
  console.log('[SYNC] Iniciando sincronização INCREMENTAL');
  console.log(`[SYNC] Timestamp: ${new Date().toISOString()}`);
  console.log('----------------------------------------\n');

  const logId = await createSyncLog('notas');
  const stats = { processed: 0, created: 0, updated: 0, failed: 0 };

  try {
    // Sincronização incremental foca apenas em notas e requisições recentes
    const notaStats = await syncNotas(logId);
    stats.processed = notaStats.processed;
    stats.created = notaStats.created;
    stats.updated = notaStats.updated;
    stats.failed = notaStats.failed;

    const finalStatus = stats.failed > 0 ? 'partial' : 'success';
    await updateSyncLog(logId, finalStatus, stats);

    console.log('[SYNC] Sincronização INCREMENTAL finalizada');
    console.log(`[SYNC] Status: ${finalStatus}`);

  } catch (err) {
    console.error('[SYNC] ERRO na sincronização incremental:', err.message);
    await updateSyncLog(logId, 'error', stats, err.message);
  }
}

// ============================================================================
// AGENDAMENTO COM CRON
// ============================================================================

// Sync completo às 05:00 da manhã
cron.schedule('0 5 * * *', () => {
  console.log('[CRON] Executando sync completo programado (05:00)');
  runFullSync();
}, {
  timezone: 'America/Sao_Paulo'
});

// Sync incremental a cada 2 horas (exceto às 05:00)
cron.schedule('0 */2 * * *', () => {
  const hour = new Date().getHours();
  if (hour !== 5) {
    console.log(`[CRON] Executando sync incremental programado (${hour}:00)`);
    runIncrementalSync();
  }
}, {
  timezone: 'America/Sao_Paulo'
});

// ============================================================================
// INICIALIZAÇÃO
// ============================================================================

console.log('========================================');
console.log('   BILLING SYNC WORKER - FlowLab');
console.log('========================================');
console.log(`Supabase URL: ${config.supabase.url}`);
console.log(`APLIS API URL: ${config.aplis.url}`);
console.log('');
console.log('Agendamentos ativos:');
console.log('  - Sync COMPLETO: 05:00 (diário)');
console.log('  - Sync INCREMENTAL: a cada 2h');
console.log('========================================');
console.log('');

// Executar sync inicial ao iniciar (opcional)
if (process.argv.includes('--run-now')) {
  console.log('[INIT] Flag --run-now detectada, executando sync inicial...');
  runFullSync();
}

// Manter processo rodando
process.on('SIGINT', () => {
  console.log('\n[WORKER] Encerrando worker...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n[WORKER] Encerrando worker...');
  process.exit(0);
});
