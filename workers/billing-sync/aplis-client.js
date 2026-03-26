/**
 * Cliente para comunicação com a API do sistema APLIS
 * 
 * Este módulo abstrai as chamadas à API externa do APLIS.
 * Em produção, substituir os métodos mock pelos endpoints reais.
 */

const axios = require('axios');
const config = require('./config');

class AplisClient {
  constructor(baseUrl, apiKey) {
    this.baseUrl = baseUrl;
    this.apiKey = apiKey;
    
    this.client = axios.create({
      baseURL: baseUrl,
      timeout: config.sync.timeout,
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });
  }

  /**
   * Busca operadoras do APLIS
   * Em produção: GET /api/operadoras
   */
  async getOperadoras() {
    try {
      // Em produção, descomentar:
      // const response = await this.client.get('/api/operadoras');
      // return response.data;

      // Mock para desenvolvimento
      console.log('[APLIS] Buscando operadoras (MOCK)...');
      return this._mockOperadoras();
    } catch (error) {
      console.error('[APLIS] Erro ao buscar operadoras:', error.message);
      throw error;
    }
  }

  /**
   * Busca lotes do APLIS
   * Em produção: GET /api/lotes
   */
  async getLotes(params = {}) {
    try {
      // Em produção, descomentar:
      // const response = await this.client.get('/api/lotes', { params });
      // return response.data;

      // Mock para desenvolvimento
      console.log('[APLIS] Buscando lotes (MOCK)...');
      return this._mockLotes();
    } catch (error) {
      console.error('[APLIS] Erro ao buscar lotes:', error.message);
      throw error;
    }
  }

  /**
   * Busca requisições do APLIS
   * Em produção: GET /api/requisicoes
   */
  async getRequisicoes(params = {}) {
    try {
      // Em produção, descomentar:
      // const response = await this.client.get('/api/requisicoes', { params });
      // return response.data;

      // Mock para desenvolvimento
      console.log('[APLIS] Buscando requisições (MOCK)...');
      return this._mockRequisicoes();
    } catch (error) {
      console.error('[APLIS] Erro ao buscar requisições:', error.message);
      throw error;
    }
  }

  /**
   * Busca notas fiscais do APLIS
   * Em produção: GET /api/notas
   */
  async getNotas(params = {}) {
    try {
      // Em produção, descomentar:
      // const response = await this.client.get('/api/notas', { params });
      // return response.data;

      // Mock para desenvolvimento
      console.log('[APLIS] Buscando notas (MOCK)...');
      return this._mockNotas();
    } catch (error) {
      console.error('[APLIS] Erro ao buscar notas:', error.message);
      throw error;
    }
  }

  /**
   * Testa conexão com o APLIS
   */
  async healthCheck() {
    try {
      // Em produção, descomentar:
      // const response = await this.client.get('/api/health');
      // return response.data.status === 'ok';

      // Mock
      return true;
    } catch (error) {
      console.error('[APLIS] Health check falhou:', error.message);
      return false;
    }
  }

  // ============================================================================
  // DADOS MOCK PARA DESENVOLVIMENTO
  // Remover em produção e usar as chamadas reais
  // ============================================================================

  _mockOperadoras() {
    return [
      {
        id: 'OP001',
        name: 'Unimed Regional',
        cnpj: '12.345.678/0001-90',
        paymentTermDays: 30
      },
      {
        id: 'OP002',
        name: 'Bradesco Saúde',
        cnpj: '23.456.789/0001-01',
        paymentTermDays: 45
      },
      {
        id: 'OP003',
        name: 'Amil Assistência Médica',
        cnpj: '34.567.890/0001-12',
        paymentTermDays: 30
      },
      {
        id: 'OP004',
        name: 'SulAmérica Saúde',
        cnpj: '45.678.901/0001-23',
        paymentTermDays: 35
      },
      {
        id: 'OP005',
        name: 'NotreDame Intermédica',
        cnpj: '56.789.012/0001-34',
        paymentTermDays: 28
      }
    ];
  }

  _mockLotes() {
    const today = new Date();
    return [
      {
        id: 'LT001',
        operadoraId: 'OP001',
        batchCode: 'LOT-2026-001',
        creationDate: new Date(today.getFullYear(), today.getMonth() - 1, 15).toISOString().split('T')[0],
        sendDate: new Date(today.getFullYear(), today.getMonth() - 1, 20).toISOString().split('T')[0],
        status: 'processed',
        totalValue: 45780.50,
        requisitionCount: 32
      },
      {
        id: 'LT002',
        operadoraId: 'OP001',
        batchCode: 'LOT-2026-002',
        creationDate: new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0],
        sendDate: new Date(today.getFullYear(), today.getMonth(), 5).toISOString().split('T')[0],
        status: 'sent',
        totalValue: 38920.00,
        requisitionCount: 28
      },
      {
        id: 'LT003',
        operadoraId: 'OP002',
        batchCode: 'LOT-2026-003',
        creationDate: new Date(today.getFullYear(), today.getMonth(), 10).toISOString().split('T')[0],
        sendDate: null,
        status: 'open',
        totalValue: 22150.75,
        requisitionCount: 15
      },
      {
        id: 'LT004',
        operadoraId: 'OP003',
        batchCode: 'LOT-2026-004',
        creationDate: new Date(today.getFullYear(), today.getMonth() - 2, 1).toISOString().split('T')[0],
        sendDate: new Date(today.getFullYear(), today.getMonth() - 2, 5).toISOString().split('T')[0],
        status: 'closed',
        totalValue: 67340.00,
        requisitionCount: 48
      }
    ];
  }

  _mockRequisicoes() {
    const today = new Date();
    return [
      {
        id: 'REQ001',
        batchId: 'LT001',
        guideNumber: 'GUIA-2026-00001',
        creationDate: new Date(today.getFullYear(), today.getMonth() - 1, 10).toISOString().split('T')[0],
        executionDate: new Date(today.getFullYear(), today.getMonth() - 1, 12).toISOString().split('T')[0],
        value: 1250.00,
        status: 'paid',
        patientName: 'Maria Silva Santos',
        procedureCode: '40302040',
        procedureDescription: 'Hemograma completo'
      },
      {
        id: 'REQ002',
        batchId: 'LT001',
        guideNumber: 'GUIA-2026-00002',
        creationDate: new Date(today.getFullYear(), today.getMonth() - 1, 11).toISOString().split('T')[0],
        executionDate: new Date(today.getFullYear(), today.getMonth() - 1, 13).toISOString().split('T')[0],
        value: 890.50,
        status: 'paid',
        patientName: 'João Pedro Oliveira',
        procedureCode: '40302067',
        procedureDescription: 'Glicemia de jejum'
      },
      {
        id: 'REQ003',
        batchId: 'LT002',
        guideNumber: 'GUIA-2026-00003',
        creationDate: new Date(today.getFullYear(), today.getMonth(), 2).toISOString().split('T')[0],
        executionDate: new Date(today.getFullYear(), today.getMonth(), 3).toISOString().split('T')[0],
        value: 2340.00,
        status: 'invoiced',
        patientName: 'Ana Carolina Ferreira',
        procedureCode: '40304361',
        procedureDescription: 'PCR COVID-19'
      },
      {
        id: 'REQ004',
        batchId: 'LT002',
        guideNumber: 'GUIA-2026-00004',
        creationDate: new Date(today.getFullYear(), today.getMonth(), 5).toISOString().split('T')[0],
        executionDate: new Date(today.getFullYear(), today.getMonth(), 6).toISOString().split('T')[0],
        value: 780.00,
        status: 'denied',
        patientName: 'Carlos Roberto Lima',
        procedureCode: '40302580',
        procedureDescription: 'TSH - hormônio'
      },
      {
        id: 'REQ005',
        batchId: 'LT003',
        guideNumber: 'GUIA-2026-00005',
        creationDate: new Date(today.getFullYear(), today.getMonth(), 12).toISOString().split('T')[0],
        executionDate: null,
        value: 1560.00,
        status: 'pending',
        patientName: 'Fernanda Costa',
        procedureCode: '40302750',
        procedureDescription: 'Vitamina D'
      }
    ];
  }

  _mockNotas() {
    const today = new Date();
    return [
      {
        id: 'NF001',
        operadoraId: 'OP001',
        invoiceNumber: 'NF-2026-001234',
        issueDate: new Date(today.getFullYear(), today.getMonth() - 1, 25).toISOString().split('T')[0],
        dueDate: new Date(today.getFullYear(), today.getMonth(), 25).toISOString().split('T')[0],
        totalValue: 45780.50,
        competence: `${today.getFullYear()}-${String(today.getMonth()).padStart(2, '0')}`,
        status: 'partial'
      },
      {
        id: 'NF002',
        operadoraId: 'OP001',
        invoiceNumber: 'NF-2026-001235',
        issueDate: new Date(today.getFullYear(), today.getMonth(), 5).toISOString().split('T')[0],
        dueDate: new Date(today.getFullYear(), today.getMonth() + 1, 5).toISOString().split('T')[0],
        totalValue: 38920.00,
        competence: `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`,
        status: 'open'
      },
      {
        id: 'NF003',
        operadoraId: 'OP002',
        invoiceNumber: 'NF-2026-001236',
        issueDate: new Date(today.getFullYear(), today.getMonth() - 2, 28).toISOString().split('T')[0],
        dueDate: new Date(today.getFullYear(), today.getMonth() - 1, 12).toISOString().split('T')[0],
        totalValue: 67340.00,
        competence: `${today.getFullYear()}-${String(today.getMonth() - 1).padStart(2, '0')}`,
        status: 'received'
      },
      {
        id: 'NF004',
        operadoraId: 'OP003',
        invoiceNumber: 'NF-2026-001237',
        issueDate: new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0],
        dueDate: new Date(today.getFullYear(), today.getMonth() + 1, 1).toISOString().split('T')[0],
        totalValue: 22150.75,
        competence: `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`,
        status: 'open'
      },
      {
        id: 'NF005',
        operadoraId: 'OP004',
        invoiceNumber: 'NF-2026-001238',
        issueDate: new Date(today.getFullYear(), today.getMonth() - 1, 15).toISOString().split('T')[0],
        dueDate: new Date(today.getFullYear(), today.getMonth(), 20).toISOString().split('T')[0],
        totalValue: 15890.00,
        competence: `${today.getFullYear()}-${String(today.getMonth()).padStart(2, '0')}`,
        status: 'denied'
      }
    ];
  }
}

module.exports = AplisClient;
