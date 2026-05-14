import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../AuthContext';
import { db } from '../firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { CheckCircle, ArrowRight, Settings, Users, Box, Zap, Sparkles } from 'lucide-react';
import toast from 'react-hot-toast';

const STEPS = [
  {
    id: 'welcome',
    title: 'Bem-vindo ao Service Hub!',
    subtitle: 'Sua oficina no futuro.',
    description: 'Vamos configurar sua conta para que você possa extrair o máximo da plataforma. Leva apenas 1 minuto.',
    icon: Sparkles,
  },
  {
    id: 'company',
    title: 'Dados da Oficina',
    subtitle: 'Profissionalize sua presença.',
    description: 'Confira se os dados da sua empresa estão corretos. Eles aparecerão nos orçamentos e ordens de serviço.',
    icon: Settings,
  },
  {
    id: 'team',
    title: 'Traga sua Equipe',
    subtitle: 'Trabalho colaborativo.',
    description: 'Você pode adicionar mecânicos e atendentes depois, mas lembre-se: o Hub é melhor em equipe.',
    icon: Users,
  },
  {
    id: 'ready',
    title: 'Tudo Pronto!',
    subtitle: 'Decolar.',
    description: 'Sua oficina agora tem inteligência de ponta. Vamos começar a registrar seus serviços.',
    icon: Zap,
  }
];

export default function SetupWizard() {
  const { profile, selectedCompanyId } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Only show to shop owners who haven't completed setup
    // Do not show for app admins impersonating another shop
    if (profile && profile.role === 'shop' && !profile.setupCompleted && !selectedCompanyId) {
      setIsOpen(true);
    }
  }, [profile, selectedCompanyId]);

  const handleComplete = async () => {
    if (!profile) return;
    setLoading(true);
    try {
      await updateDoc(doc(db, 'users', profile.uid), {
        setupCompleted: true
      });
      toast.success('Configuração concluída! Bem-vindo a bordo.', { icon: '🚀' });
      setIsOpen(false);
    } catch (error) {
      console.error('Error updating setup status', error);
      toast.error('Erro ao finalizar configuração.');
    } finally {
      setLoading(false);
    }
  };

  const nextStep = () => {
    if (currentStep < STEPS.length - 1) {
      setCurrentStep(prev => prev + 1);
    } else {
      handleComplete();
    }
  };

  if (!isOpen) return null;

  const StepIcon = STEPS[currentStep].icon;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-gray-900/90 backdrop-blur-xl p-4">
      <AnimatePresence mode="wait">
        <motion.div
          key={currentStep}
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -20, scale: 0.95 }}
          className="bg-white dark:bg-gray-900 w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden border border-gray-100 dark:border-gray-800"
        >
          {/* Header Progress */}
          <div className="px-8 pt-8 pb-4 flex items-center gap-2">
            {STEPS.map((_, idx) => (
              <div 
                key={idx} 
                className={`h-1.5 flex-1 rounded-full transition-colors duration-500 ${
                  idx <= currentStep ? 'bg-indigo-600' : 'bg-gray-100 dark:bg-gray-800'
                }`}
              />
            ))}
          </div>

          <div className="p-8 pt-4">
            <div className="flex justify-center mb-6">
              <div className="p-4 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 rounded-[2rem] shadow-lg shadow-indigo-100 dark:shadow-none animate-pulse-slow">
                <StepIcon className="w-12 h-12" />
              </div>
            </div>

            <div className="text-center space-y-2 mb-8">
              <p className="text-[10px] font-black uppercase tracking-widest text-indigo-500">{STEPS[currentStep].subtitle}</p>
              <h2 className="text-3xl font-black tracking-tight text-gray-900 dark:text-white">
                {STEPS[currentStep].title}
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed max-w-xs mx-auto">
                {STEPS[currentStep].description}
              </p>
            </div>

            <button
              onClick={nextStep}
              disabled={loading}
              className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-2xl transition-all shadow-xl shadow-indigo-200 dark:shadow-none flex items-center justify-center gap-3 active:scale-95"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  {currentStep === STEPS.length - 1 ? 'Iniciar Jornada' : 'Continuar'}
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>

            {currentStep > 0 && currentStep < STEPS.length - 1 && (
              <button
                onClick={() => setCurrentStep(prev => prev - 1)}
                disabled={loading}
                className="w-full mt-3 py-3 text-sm font-bold text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
              >
                Voltar
              </button>
            )}
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
