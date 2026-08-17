import React, { forwardRef, useImperativeHandle, useRef } from 'react';
import SignatureCanvas from 'react-signature-canvas';

export interface SignatureCanvasFieldHandle {
  clear: () => void;
  isEmpty: () => boolean;
  toDataURL: () => string;
}

interface SignatureCanvasFieldProps {
  label?: string;
  disabled?: boolean;
}

const SignatureCanvasField = forwardRef<SignatureCanvasFieldHandle, SignatureCanvasFieldProps>(
  ({ label = 'Assinatura *', disabled = false }, ref) => {
    const sigCanvasRef = useRef<SignatureCanvas>(null);

    useImperativeHandle(ref, () => ({
      clear: () => sigCanvasRef.current?.clear(),
      isEmpty: () => sigCanvasRef.current?.isEmpty() ?? true,
      toDataURL: () => sigCanvasRef.current?.toDataURL() ?? '',
    }));

    return (
      <div>
        <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
          {label}
        </label>
        <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl overflow-hidden bg-white dark:bg-gray-100">
          <SignatureCanvas
            ref={sigCanvasRef}
            penColor="black"
            canvasProps={{
              className: 'w-full h-40 cursor-crosshair',
              style: { touchAction: 'none' }
            }}
          />
        </div>
        <button
          type="button"
          onClick={() => sigCanvasRef.current?.clear()}
          disabled={disabled}
          className="mt-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Limpar assinatura
        </button>
      </div>
    );
  }
);

SignatureCanvasField.displayName = 'SignatureCanvasField';

export default SignatureCanvasField;
