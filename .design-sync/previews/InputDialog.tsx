import React from 'react';
import { InputDialog } from 'inventory-system';

const Frame: React.FC<{ children: React.ReactNode; h?: number }> = ({ children, h = 340 }) => (
  <div style={{ position: 'relative', transform: 'translateZ(0)', height: h, overflow: 'hidden', background: '#eef2f7' }}>
    {children}
  </div>
);

const noop = () => {};

export const Required = () => (
  <Frame>
    <InputDialog
      isOpen
      title="Motivo do cancelamento"
      message="Descreva o motivo do cancelamento desta solicitação."
      placeholder="Digite o motivo..."
      confirmText="Confirmar"
      onConfirm={noop}
      onCancel={noop}
    />
  </Frame>
);

export const Optional = () => (
  <Frame>
    <InputDialog
      isOpen
      required={false}
      title="Observação (opcional)"
      message="Adicione uma observação para este recebimento, se desejar."
      placeholder="Observação..."
      confirmText="Salvar"
      onConfirm={noop}
      onCancel={noop}
    />
  </Frame>
);
