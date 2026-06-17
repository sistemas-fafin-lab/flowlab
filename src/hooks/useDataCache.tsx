import React, { createContext, useContext, useState, useCallback, useRef } from 'react';

type CacheEntry<T> = {
  data: T;
  timestamp: number;
};

type CacheStore = Record<string, CacheEntry<any>>;

interface DataCacheContextValue {
  getCache: <T>(key: string) => CacheEntry<T> | null;
  setCache: <T>(key: string, data: T) => void;
  invalidate: (key: string) => void;
  invalidateAll: () => void;
}

const DataCacheContext = createContext<DataCacheContextValue | null>(null);

export const DEFAULT_STALE_TIME = 5 * 60 * 1000; // 5 minutos

export function useDataCache() {
  const ctx = useContext(DataCacheContext);
  if (!ctx) {
    throw new Error('useDataCache deve ser usado dentro de um DataCacheProvider');
  }
  return ctx;
}

export const DataCacheProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const cacheRef = useRef<CacheStore>({});

  const getCache = useCallback(<T,>(key: string): CacheEntry<T> | null => {
    return cacheRef.current[key] ?? null;
  }, []);

  const setCache = useCallback(<T,>(key: string, data: T) => {
    cacheRef.current[key] = {
      data,
      timestamp: Date.now(),
    };
  }, []);

  const invalidate = useCallback((key: string) => {
    delete cacheRef.current[key];
  }, []);

  const invalidateAll = useCallback(() => {
    cacheRef.current = {};
  }, []);

  return (
    <DataCacheContext.Provider value={{ getCache, setCache, invalidate, invalidateAll }}>
      {children}
    </DataCacheContext.Provider>
  );
};
