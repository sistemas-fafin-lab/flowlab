import React from 'react';
import { ShieldAlert } from 'lucide-react';

export const BoardAccessDenied: React.FC = () => (
  <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6 text-center">
    <ShieldAlert className="w-8 h-8 text-red-500 dark:text-red-400 mx-auto mb-2" />
    <h3 className="text-lg font-medium text-red-800 dark:text-red-300 mb-2">Acesso Negado</h3>
    <p className="text-red-600 dark:text-red-400">
      Seu cargo não está vinculado a nenhum board. Fale com um administrador se acredita que isso é um engano.
    </p>
  </div>
);

export default BoardAccessDenied;
