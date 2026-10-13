import React, { createContext, useContext } from 'react';

interface EvaUISettings {
  /** Borda cônica girando (estilo Siri). false = borda estática */
  animatedGlow: boolean;
  /** Exibe os insights inline da EVA em cada bloco */
  showInsights: boolean;
}

const EvaUIContext = createContext<EvaUISettings>({ animatedGlow: true, showInsights: true });

export const EvaUIProvider: React.FC<React.PropsWithChildren<Partial<EvaUISettings>>> = ({
  animatedGlow = true,
  showInsights = true,
  children,
}) => <EvaUIContext.Provider value={{ animatedGlow, showInsights }}>{children}</EvaUIContext.Provider>;

export const useEvaUI = () => useContext(EvaUIContext);
