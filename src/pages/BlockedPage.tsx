import React from 'react';
import { ShieldAlert } from 'lucide-react';
import { useAuth } from '../AuthContext';

export default function BlockedPage() {
  const { logout } = useAuth();

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          <ShieldAlert className="h-16 w-16 text-red-600 dark:text-red-500" />
        </div>
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900 dark:text-white">
          Conta Suspensa
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600 dark:text-gray-400">
          Sua conta foi temporariamente bloqueada. Por favor, entre em contato com o suporte ou administrador do sistema para mais informações.
        </p>
        <div className="mt-8 flex justify-center">
          <button
            onClick={logout}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            Sair e Voltar ao Início
          </button>
        </div>
      </div>
    </div>
  );
}
