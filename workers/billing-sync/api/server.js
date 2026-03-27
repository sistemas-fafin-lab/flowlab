/**
 * Express app factory do billing-sync REST API
 * Recebe o aplisClient compartilhado com o worker cron.
 */

const express = require('express');

module.exports = function createApp(aplisClient) {
  const app = express();

  app.use(express.json());

  // Logger de requests
  app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
      const ms = Date.now() - start;
      console.log(`[API] ${req.method} ${req.originalUrl} ${res.statusCode} ${ms}ms`);
    });
    next();
  });

  // Rotas
  app.use('/api', require('./routes/requisicoes')(aplisClient));

  // Handler de erros
  app.use((err, req, res, next) => {
    const status = err.status ?? (err.aplisCode ? 502 : 500);
    const body = {
      error: err.message ?? 'Erro interno',
    };
    if (err.aplisResponse) body.aplisResponse = err.aplisResponse;
    res.status(status).json(body);
  });

  return app;
};
