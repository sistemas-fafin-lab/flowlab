import React from 'react';
import { Headphones } from 'lucide-react';

const ITRequests: React.FC = () => {
  return (
    <div className="flex flex-col items-center justify-center h-[calc(100vh-200px)] gap-4">
      <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg shadow-violet-500/25">
        <Headphones className="w-8 h-8 text-white" />
      </div>
      <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-100">Solicitações de TI</h2>
      <p className="text-sm text-gray-500 dark:text-gray-400">Suporte, Dev e Consultoria</p>
    </div>
  );
};

export default ITRequests;
