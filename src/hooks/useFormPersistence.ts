import { useState, useEffect, useRef } from 'react';

/**
 * Hook para persistir estado de formulários no sessionStorage.
 * Salva automaticamente quando os valores mudam e restaura ao montar o componente.
 *
 * @param key - Chave única para identificar o formulário (ex: 'add-product-form')
 * @param initialValues - Valores iniciais do formulário
 * @param ttl - Tempo de vida em ms (padrão: 24 horas)
 *
 * @example
 * ```tsx
 * const [formData, setFormData, clearForm] = useFormPersistence('add-product', {
 *   name: '',
 *   quantity: 0,
 * });
 * ```
 */
export function useFormPersistence<T extends Record<string, any>>(
  key: string,
  initialValues: T,
  ttl: number = 24 * 60 * 60 * 1000 // 24 horas
) {
  const STORAGE_KEY = `form_${key}`;
  const TIMESTAMP_KEY = `form_${key}_timestamp`;

  const [data, setData] = useState<T>(() => {
    try {
      const stored = sessionStorage.getItem(STORAGE_KEY);
      const timestamp = sessionStorage.getItem(TIMESTAMP_KEY);

      if (stored && timestamp) {
        const age = Date.now() - Number(timestamp);
        if (age > ttl) {
          // Dados expirados, limpar
          sessionStorage.removeItem(STORAGE_KEY);
          sessionStorage.removeItem(TIMESTAMP_KEY);
          return initialValues;
        }
        return JSON.parse(stored) as T;
      }
    } catch (error) {
      console.warn(`Erro ao ler formulário "${key}" do sessionStorage:`, error);
    }
    return initialValues;
  });

  const isRestoredRef = useRef(false);

  // Salvar dados quando mudarem
  useEffect(() => {
    if (!isRestoredRef.current) {
      isRestoredRef.current = true;
      return; // Não salvar na primeira montagem (os dados vieram do storage)
    }

    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      sessionStorage.setItem(TIMESTAMP_KEY, String(Date.now()));
    } catch (error) {
      console.warn(`Erro ao salvar formulário "${key}" no sessionStorage:`, error);
    }
  }, [key, data]);

  // Função para limpar o formulário e o storage
  const clearForm = () => {
    try {
      sessionStorage.removeItem(STORAGE_KEY);
      sessionStorage.removeItem(TIMESTAMP_KEY);
    } catch (error) {
      console.warn(`Erro ao limpar formulário "${key}":`, error);
    }
    setData(initialValues);
  };

  // Função para atualizar campos específicos
  const updateField = <K extends keyof T>(field: K, value: T[K]) => {
    setData(prev => ({ ...prev, [field]: value }));
  };

  return [data, setData, clearForm, updateField] as const;
}

/**
 * Hook para detectar se há dados persistidos para uma chave específica.
 * Útil para mostrar avisos como "Você tem um formulário não salvo".
 */
export function useHasPersistedForm(key: string) {
  const STORAGE_KEY = `form_${key}`;
  const TIMESTAMP_KEY = `form_${key}_timestamp`;
  const [hasData, setHasData] = useState(false);

  useEffect(() => {
    try {
      const stored = sessionStorage.getItem(STORAGE_KEY);
      setHasData(!!stored);
    } catch {
      setHasData(false);
    }
  }, [key]);

  const clearData = () => {
    try {
      sessionStorage.removeItem(STORAGE_KEY);
      sessionStorage.removeItem(TIMESTAMP_KEY);
      setHasData(false);
    } catch (error) {
      console.warn(`Erro ao limpar formulário "${key}":`, error);
    }
  };

  return { hasData, clearData };
}
