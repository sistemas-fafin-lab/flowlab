import React from 'react';
import { LoadingSpinner } from 'inventory-system';

// Centered spinner overlay with an optional message.
export const Default = () => <LoadingSpinner />;

export const WithMessage = () => <LoadingSpinner message="Carregando movimentações..." />;
