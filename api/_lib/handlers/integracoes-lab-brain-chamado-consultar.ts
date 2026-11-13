// GET /api/integracoes/lab-brain-chamado-consultar?id_externo= — o LAB-BRAIN acompanha um chamado que abriu.
// Lógica, autenticação, limite e auditoria em api/_lib/labBrainChamados.ts.
import { consultarChamadoHandler } from '../labBrainChamados.js';

export default consultarChamadoHandler;
