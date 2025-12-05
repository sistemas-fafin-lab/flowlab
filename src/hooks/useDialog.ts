import { useState, useCallback } from 'react';

interface ConfirmDialogState {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  type?: 'danger' | 'warning' | 'info';
  onConfirm?: () => void;
}

interface InputDialogState {
  isOpen: boolean;
  title: string;
  message: string;
  placeholder?: string;
  confirmText?: string;
  cancelText?: string;
  required?: boolean;
  onConfirm?: (value: string) => void;
  onCancel?: () => void;
}

export const useDialog = () => {
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState>({
    isOpen: false,
    title: '',
    message: ''
  });

  const [inputDialog, setInputDialog] = useState<InputDialogState>({
    isOpen: false,
    title: '',
    message: ''
  });

  const showConfirmDialog = useCallback((
    title: string,
    message: string,
    onConfirm: () => void,
    options?: {
      confirmText?: string;
      cancelText?: string;
      type?: 'danger' | 'warning' | 'info';
    }
  ) => {
    setConfirmDialog({
      isOpen: true,
      title,
      message,
      onConfirm,
      ...options
    });
  }, []);

  const hideConfirmDialog = useCallback(() => {
    setConfirmDialog(prev => ({ ...prev, isOpen: false }));
  }, []);

  const showInputDialog = useCallback((
    title: string,
    message: string,
    options?: {
      placeholder?: string;
      confirmText?: string;
      cancelText?: string;
      required?: boolean;
    }
  ): Promise<string | null> => {
    return new Promise((resolve) => {
      setInputDialog({
        isOpen: true,
        title,
        message,
        placeholder: options?.placeholder || '',
        confirmText: options?.confirmText || 'Confirmar',
        cancelText: options?.cancelText || 'Cancelar',
        required: options?.required ?? false,
        onConfirm: (value: string) => resolve(value),
        onCancel: () => resolve(null),
      });
    });
  }, []);

  const hideInputDialog = useCallback(() => {
    setInputDialog(prev => ({ ...prev, isOpen: false }));
  }, []);

  const handleConfirmDialogConfirm = useCallback(() => {
    if (confirmDialog.onConfirm) {
      confirmDialog.onConfirm();
    }
    hideConfirmDialog();
  }, [confirmDialog.onConfirm, hideConfirmDialog]);

  const handleInputDialogConfirm = useCallback((value: string) => {
    if (inputDialog.onConfirm) {
      inputDialog.onConfirm(value);
    }
    hideInputDialog();
  }, [inputDialog.onConfirm, hideInputDialog]);

  return {
    confirmDialog,
    inputDialog,
    showConfirmDialog,
    hideConfirmDialog,
    showInputDialog,
    hideInputDialog,
    handleConfirmDialogConfirm,
    handleInputDialogConfirm
  };
};