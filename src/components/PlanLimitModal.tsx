import React from 'react';
import { X, Zap, Crown, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface PlanLimitModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentPlan: string;
  feature: string;
}

export default function PlanLimitModal({ isOpen, onClose, currentPlan, feature }: PlanLimitModalProps) {
  const navigate = useNavigate();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
        <div className="flex justify-between items-center p-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">Limite Atingido</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="p-6 text-center">
          <div className="w-16 h-16 bg-indigo-100 dark:bg-indigo-900/50 rounded-full flex items-center justify-center mx-auto mb-4">
            <Zap className="h-8 w-8 text-indigo-600 dark:text-indigo-400" />
          </div>
          <h4 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
            Você atingiu o limite de {feature}
          </h4>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Seu plano atual ({currentPlan === 'free' ? 'Start' : 'Pro'}) atingiu o limite para esta funcionalidade. 
            Faça um upgrade para continuar crescendo sem perder nenhum dado!
          </p>
          
          <div className="space-y-3">
            {currentPlan === 'free' && (
              <button
                onClick={() => { onClose(); navigate('/app/subscription'); }}
                className="w-full py-3 px-4 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-colors flex items-center justify-center"
              >
                <Zap className="h-5 w-5 mr-2" />
                Conhecer Plano Pro
                <ArrowRight className="ml-2 h-5 w-5" />
              </button>
            )}
            <button
              onClick={() => { onClose(); navigate('/app/subscription'); }}
              className={`w-full py-3 px-4 rounded-xl font-bold transition-colors flex items-center justify-center ${
                currentPlan === 'pro' 
                  ? 'bg-amber-500 text-white hover:bg-amber-600' 
                  : 'bg-gray-100 text-gray-900 hover:bg-gray-200 dark:bg-gray-700 dark:text-white dark:hover:bg-gray-600'
              }`}
            >
              <Crown className="h-5 w-5 mr-2" />
              Conhecer Plano Elite
              <ArrowRight className="ml-2 h-5 w-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
