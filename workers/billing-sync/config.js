/**
 * Configurações do Worker de Sincronização
 * Carrega variáveis de ambiente e define valores padrão
 */

require("dotenv").config({ path: "../../.env" });

module.exports = {
  supabase: {
    url: process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  },
  aplis: {
    url:
      process.env.APLIS_API_URL ||
      "https://lab.aplis.inf.br/api/integracao.php",
    apiKey: process.env.APLIS_API_KEY || "",
    username: process.env.APLIS_USERNAME || "",
    password: process.env.APLIS_PASSWORD || "",
    concurrency: parseInt(process.env.APLIS_CONCURRENCY) || 5,
  },
  api: {
    port: parseInt(process.env.API_PORT) || 3001,
  },
  sync: {
    // Intervalo entre requisições para não sobrecarregar a API
    requestDelay: parseInt(process.env.SYNC_REQUEST_DELAY) || 100,
    // Tamanho do lote para processamento em batch
    batchSize: parseInt(process.env.SYNC_BATCH_SIZE) || 100,
    // Timeout das requisições (ms)
    timeout: parseInt(process.env.SYNC_TIMEOUT) || 30000,
  },
};
