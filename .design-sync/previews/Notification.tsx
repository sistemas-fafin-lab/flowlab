import React from 'react';
import { Notification } from 'inventory-system';

// Notification is a `fixed top-4 right-4` toast — the transform frame becomes its
// containing block so it renders in the card's top-right. autoClose disabled so
// the toast stays mounted for the screenshot.
const Frame: React.FC<{ children: React.ReactNode; h?: number }> = ({ children, h = 130 }) => (
  <div style={{ position: 'relative', transform: 'translateZ(0)', height: h, overflow: 'hidden', background: '#eef2f7' }}>
    {children}
  </div>
);

const noop = () => {};

export const Success = () => (
  <Frame>
    <Notification type="success" title="Produto cadastrado" message="O item foi adicionado ao estoque com sucesso." isVisible autoClose={false} onClose={noop} />
  </Frame>
);

export const ErrorState = () => (
  <Frame>
    <Notification type="error" title="Falha ao salvar" message="Não foi possível concluir a operação. Tente novamente." isVisible autoClose={false} onClose={noop} />
  </Frame>
);

export const Warning = () => (
  <Frame>
    <Notification type="warning" title="Estoque baixo" message="O saldo deste item está abaixo do mínimo configurado." isVisible autoClose={false} onClose={noop} />
  </Frame>
);

export const Info = () => (
  <Frame>
    <Notification type="info" title="Sincronização concluída" isVisible autoClose={false} onClose={noop} />
  </Frame>
);
