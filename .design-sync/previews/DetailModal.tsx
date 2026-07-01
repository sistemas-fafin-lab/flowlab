import React from 'react';
import { MotionConfig } from 'framer-motion';
import { DetailModal } from 'inventory-system';
import { Package } from 'lucide-react';

// DetailModal's open/close transition is framer-motion (RAF-driven), and the
// capture harness freezes the clock for deterministic screenshots — RAF never
// ticks, so the mount would stick at its `initial` (invisible) state without
// this. reducedMotion="always" makes motion components commit straight to
// their `animate` target on mount instead of interpolating toward it.
const Frame: React.FC<{ children: React.ReactNode; h?: number }> = ({ children, h = 470 }) => (
  <div style={{ position: 'relative', transform: 'translateZ(0)', height: h, overflow: 'hidden', background: '#eef2f7' }}>
    <MotionConfig reducedMotion="always">{children}</MotionConfig>
  </div>
);

const noop = () => {};

export const WithContent = () => (
  <Frame>
    <DetailModal title="Detalhes do Produto" accentColor="blue" icon={<Package className="w-5 h-5 text-white" />} onClose={noop}>
      <div className="space-y-5">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-slate-400">Código</p>
            <p className="text-sm font-medium text-slate-800 dark:text-slate-100">PRD-00123</p>
          </div>
          <div>
            <p className="text-xs text-slate-400">Categoria</p>
            <p className="text-sm font-medium text-slate-800 dark:text-slate-100">Reagentes</p>
          </div>
          <div>
            <p className="text-xs text-slate-400">Saldo atual</p>
            <p className="text-sm font-medium text-slate-800 dark:text-slate-100">240 un</p>
          </div>
          <div>
            <p className="text-xs text-slate-400">Validade</p>
            <p className="text-sm font-medium text-slate-800 dark:text-slate-100">12/2026</p>
          </div>
        </div>
        <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">
          Kit completo para análises clínicas, armazenado sob refrigeração entre 2&nbsp;°C e 8&nbsp;°C.
          Última movimentação registrada há 3 dias.
        </p>
      </div>
    </DetailModal>
  </Frame>
);

export const Accent = () => (
  <Frame>
    <DetailModal title="Ordem de compra" accentColor="green" onClose={noop}>
      <div className="space-y-3 text-sm text-slate-600 dark:text-slate-300">
        <p>Fornecedor: <span className="font-medium text-slate-800 dark:text-slate-100">LabSupply Ltda.</span></p>
        <p>Itens: <span className="font-medium text-slate-800 dark:text-slate-100">8</span></p>
        <p>Total: <span className="font-medium text-slate-800 dark:text-slate-100">R$ 12.480,00</span></p>
      </div>
    </DetailModal>
  </Frame>
);
