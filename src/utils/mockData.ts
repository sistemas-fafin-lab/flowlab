import { Product, StockMovement, Request } from '../types';

export const mockProducts: Product[] = [
  {
    id: '1',
    name: 'Luvas de Látex',
    code: 'LAT001',
    category: 'general',
    quantity: 150,
    unit: 'caixas',
    supplier: 'MedSupply',
    batch: 'LT240315',
    entryDate: '2024-03-15',
    expirationDate: '2025-03-15',
    location: 'Prateleira A1',
    minStock: 20,
    status: 'active'
  },
  {
    id: '2',
    name: 'Reagente pH Buffer',
    code: 'RBF002',
    category: 'technical',
    quantity: 5,
    unit: 'litros',
    supplier: 'ChemLab',
    batch: 'PH240220',
    entryDate: '2024-02-20',
    expirationDate: '2024-12-20',
    location: 'Geladeira B2',
    minStock: 10,
    status: 'low-stock'
  },
  {
    id: '3',
    name: 'Papel de Filtro',
    code: 'PAP003',
    category: 'general',
    quantity: 80,
    unit: 'pacotes',
    supplier: 'LabSupply',
    batch: 'PF240410',
    entryDate: '2024-04-10',
    expirationDate: '2026-04-10',
    location: 'Armário C3',
    minStock: 15,
    status: 'active'
  },
  {
    id: '4',
    name: 'Solução Salina',
    code: 'SOL004',
    category: 'technical',
    quantity: 3,
    unit: 'frascos',
    supplier: 'BioTech',
    batch: 'SS241101',
    entryDate: '2024-11-01',
    expirationDate: '2024-12-30',
    location: 'Prateleira D1',
    minStock: 8,
    status: 'expired'
  }
];

export const mockMovements: StockMovement[] = [
  {
    id: '1',
    productId: '1',
    productName: 'Luvas de Látex',
    type: 'out',
    reason: 'internal-consumption',
    quantity: 5,
    date: '2024-12-20',
    authorizedBy: 'Dr. Silva',
    notes: 'Uso rotina laboratório'
  },
  {
    id: '2',
    productId: '2',
    productName: 'Reagente pH Buffer',
    type: 'out',
    reason: 'sale',
    quantity: 2,
    date: '2024-12-19',
    requestId: 'REQ001',
    authorizedBy: 'Dr. Santos',
    notes: 'Venda cliente externo'
  }
];

export const mockRequests: Request[] = [
  {
    id: 'REQ001',
    productId: '2',
    productName: 'Reagente pH Buffer',
    quantity: 2,
    reason: 'Venda para cliente externo',
    requestedBy: 'João Silva',
    requestDate: '2024-12-18',
    status: 'completed',
    approvedBy: 'Dr. Santos',
    approvalDate: '2024-12-19'
  },
  {
    id: 'REQ002',
    productId: '3',
    productName: 'Papel de Filtro',
    quantity: 10,
    reason: 'Transferência para filial',
    requestedBy: 'Maria Costa',
    requestDate: '2024-12-20',
    status: 'pending'
  }
];