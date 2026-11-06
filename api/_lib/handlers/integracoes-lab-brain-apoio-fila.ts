// GET /api/integracoes/lab-brain-apoio-fila — consulta do LAB-BRAIN ao Envio ao Álvaro.
// Lógica, autenticação, limite e auditoria em api/_lib/labBrainApoio.ts.
import { criarHandlerLabBrainApoio } from '../labBrainApoio.js';

export default criarHandlerLabBrainApoio('fila');
