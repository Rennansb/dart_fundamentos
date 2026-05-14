import React from 'react';
import { Link } from 'react-router-dom';
import { Home, ArrowLeft } from 'lucide-react';
import { motion } from 'framer-motion';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-md w-full text-center"
      >
        <div className="mb-8 relative inline-block">
          <div className="text-[12rem] font-black text-indigo-600/10 dark:text-indigo-400/10 select-none">404</div>
          <div className="absolute inset-0 flex items-center justify-center">
            <h1 className="text-4xl font-black text-gray-900 dark:text-white">Ops!</h1>
          </div>
        </div>
        
        <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-200 mb-4">
          Página não encontrada
        </h2>
        <p className="text-gray-500 dark:text-gray-400 mb-12">
          Parece que o caminho que você tentou acessar não existe ou foi movido.
        </p>
        
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            to="/"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-2xl transition-all shadow-lg shadow-indigo-500/20 active:scale-95"
          >
            <Home className="h-5 w-5" />
            Ir para Início
          </Link>
          <button
            onClick={() => window.history.back()}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-4 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 font-bold rounded-2xl border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all active:scale-95"
          >
            <ArrowLeft className="h-5 w-5" />
            Voltar
          </button>
        </div>
      </motion.div>
    </div>
  );
}
