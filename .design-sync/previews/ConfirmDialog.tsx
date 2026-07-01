import React from 'react';
import { ConfirmDialog } from 'inventory-system';

// ConfirmDialog renders a `fixed inset-0` overlay. Wrapping it in a frame with a
// CSS transform makes the frame the containing block for the fixed overlay, so
// the dialog renders inside the card instead of escaping to the viewport.
const Frame: React.FC<{ children: React.ReactNode; h?: number }> = ({ children, h = 320 }) => (
  <div style={{ position: 'relative', transform: 'translateZ(0)', height: h, overflow: 'hidden', background: '#eef2f7' }}>
    {children}
  </div>
);

const noop = () => {};

export const Danger = () => (
  <Frame>
    <ConfirmDialog
      isOpen
      type="danger"
      title="Excluir produto"
      message="Tem certeza que deseja excluir este produto? Esta ação não pode ser desfeita."
      confirmText="Excluir"
      cancelText="Cancelar"
      onConfirm={noop}
      onCancel={noop}
    />
  </Frame>
);

export const Warning = () => (
  <Frame>
    <ConfirmDialog
      isOpen
      type="warning"
      title="Confirmar saída de estoque"
      message="Esta movimentação irá reduzir o saldo disponível do item. Deseja continuar?"
      confirmText="Confirmar"
      onConfirm={noop}
      onCancel={noop}
    />
  </Frame>
);

export const Info = () => (
  <Frame>
    <ConfirmDialog
      isOpen
      type="info"
      title="Sincronizar dados"
      message="Os dados serão atualizados a partir do servidor. Isso pode levar alguns segundos."
      confirmText="Sincronizar"
      onConfirm={noop}
      onCancel={noop}
    />
  </Frame>
);
