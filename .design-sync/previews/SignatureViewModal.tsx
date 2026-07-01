import React from 'react';
import { SignatureViewModal } from 'inventory-system';

const Frame: React.FC<{ children: React.ReactNode; h?: number }> = ({ children, h = 380 }) => (
  <div style={{ position: 'relative', transform: 'translateZ(0)', height: h, overflow: 'hidden', background: '#eef2f7' }}>
    {children}
  </div>
);

const noop = () => {};

// A sample handwritten-signature image (inline SVG data URL) so the card shows a
// realistic signature instead of a broken image.
const SAMPLE_SIGNATURE =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    "<svg xmlns='http://www.w3.org/2000/svg' width='320' height='110'>" +
      "<path d='M8 80 C 36 18, 64 22, 86 66 S 132 110, 162 56 S 214 12, 246 70 S 292 96, 312 40' " +
      "fill='none' stroke='#1e293b' stroke-width='3' stroke-linecap='round' stroke-linejoin='round'/></svg>",
  );

export const Default = () => (
  <Frame>
    <SignatureViewModal receiverName="Maria Oliveira" signature={SAMPLE_SIGNATURE} onClose={noop} />
  </Frame>
);
