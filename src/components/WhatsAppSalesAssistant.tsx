import React, { useState } from 'react';
import { MessageSquare, ExternalLink, Sparkles, ChevronDown, Check, Lock } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../AuthContext';
import { useNavigate } from 'react-router-dom';

interface WhatsAppSalesAssistantProps {
  customerName: string;
  customerPhone: string;
  vehicleInfo: string;
  predictionReason: string;
  lastServiceDate?: string;
}

type TemplateType = 'standard' | 'oil' | 'brakes' | 'review';

export default function WhatsAppSalesAssistant({ 
  customerName, 
  customerPhone, 
  vehicleInfo, 
  predictionReason,
  lastServiceDate 
}: WhatsAppSalesAssistantProps) {
  const [template, setTemplate] = useState<TemplateType>('standard');
  const [showTemplates, setShowTemplates] = useState(false);
  const { profile, effectiveProfile } = useAuth();
  const navigate = useNavigate();
  
  const currentPlan = effectiveProfile?.plan || profile?.plan || 'free';
  const isElite = currentPlan === 'elite';

  const templates: Record<TemplateType, { label: string, emoji: string }> = {
    standard: { label: 'Revisão Geral', emoji: '🛠️' },
    oil: { label: 'Troca de Óleo', emoji: '🛢️' },
    brakes: { label: 'Sistema de Freios', emoji: '🛑' },
    review: { label: 'Manutenção Preventiva', emoji: '📋' }
  };

  const generateMessage = () => {
    const hours = new Date().getHours();
    const greeting = hours < 12 ? 'Bom dia' : hours < 18 ? 'Boa tarde' : 'Boa noite';
    const dateFormatted = lastServiceDate ? new Date(lastServiceDate).toLocaleDateString('pt-BR') : 'algum tempo';
    
    switch(template) {
      case 'oil':
        return `${greeting} ${customerName}! 🛢️ Notamos que a última troca de óleo do seu ${vehicleInfo} foi em ${dateFormatted}. Para manter o motor protegido, recomenda-se a troca a cada 6 meses ou 10 mil km. Gostaria de agendar para essa semana?`;
      case 'brakes':
        return `${greeting} ${customerName}! 🛑 Pela nossa última revisão do ${vehicleInfo} em ${dateFormatted}, o sistema de freios pode precisar de uma inspeção agora. A segurança em primeiro lugar! Podemos marcar uma conferência rápida?`;
      case 'review':
        return `${greeting} ${customerName}! 📋 Seu ${vehicleInfo} completou mais um ciclo desde a revisão em ${dateFormatted}. Manutenções preventivas evitam gastos maiores no futuro. Temos horários disponíveis amanhã, que tal?`;
      default:
        return `${greeting} ${customerName}! 🛠️ Aqui é da oficina. Notamos que seu ${vehicleInfo} está na hora de realizar: ${predictionReason}. A última visita foi em ${dateFormatted}. Vamos agendar uma revisão?`;
    }
  };

  const handleOpenWhatsApp = () => {
    const text = encodeURIComponent(generateMessage());
    const phone = customerPhone.replace(/\D/g, '');
    window.open(`https://wa.me/55${phone}?text=${text}`, '_blank');
  };

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="bg-indigo-600 rounded-[2rem] p-6 text-white shadow-xl shadow-indigo-200 dark:shadow-none relative"
    >
      {!isElite && (
        <div className="absolute inset-0 z-10 bg-indigo-900/80 backdrop-blur-sm rounded-[2rem] flex flex-col items-center justify-center p-6 text-center border-2 border-indigo-400/30">
          <Lock className="w-8 h-8 text-indigo-300 mb-2" />
          <h4 className="text-sm font-black text-white uppercase tracking-widest mb-2">Recurso Exclusivo Elite</h4>
          <p className="text-xs text-indigo-100 mb-4 px-2">Assine o plano Elite para que a IA sugira vendas automáticas via WhatsApp.</p>
          <button 
            onClick={() => navigate('/app/subscription')}
            className="px-4 py-2 bg-gradient-to-r from-amber-400 to-orange-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-orange-500/30 hover:scale-105 transition-all"
          >
            Fazer Upgrade Agora
          </button>
        </div>
      )}
      
      <div className={`flex items-center justify-between mb-4 ${!isElite ? 'opacity-20 pointer-events-none' : ''}`}>
        <div className="flex items-center gap-3">
          <div className="p-2 bg-white/20 rounded-xl">
            <Sparkles className="w-5 h-5" />
          </div>
          <h4 className="font-black uppercase tracking-widest text-[10px]">Sugestão de Venda AI</h4>
        </div>
        
        <div className="relative">
          <button 
            onClick={() => setShowTemplates(!showTemplates)}
            className="p-2 bg-black/10 hover:bg-black/20 rounded-xl transition-all"
          >
            <ChevronDown className={`w-4 h-4 transition-transform ${showTemplates ? 'rotate-180' : ''}`} />
          </button>
          
          <AnimatePresence>
            {showTemplates && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="absolute right-0 top-full mt-2 w-48 bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-2 z-50 border border-gray-100 dark:border-gray-700"
              >
                {(Object.entries(templates) as [TemplateType, any][]).map(([key, val]) => (
                  <button
                    key={key}
                    onClick={() => { setTemplate(key); setShowTemplates(false); }}
                    className={`w-full text-left px-4 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-between transition-all ${
                      template === key ? 'bg-indigo-50 text-indigo-600' : 'text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700'
                    }`}
                  >
                    <span>{val.emoji} {val.label}</span>
                    {template === key && <Check className="w-3 h-3" />}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <p className={`text-sm font-medium mb-6 leading-relaxed opacity-90 ${!isElite ? 'opacity-20 pointer-events-none' : ''}`}>
        Que tal entrar em contato com **{customerName}** sobre o **{vehicleInfo}**? 
        A manutenção de **{predictionReason}** parece estar próxima.
      </p>

      <button
        onClick={handleOpenWhatsApp}
        disabled={!isElite}
        className={`w-full flex items-center justify-center gap-3 py-4 bg-white text-indigo-600 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-gray-50 transition-all active:scale-95 group ${!isElite ? 'opacity-20 pointer-events-none' : ''}`}
      >
        <MessageSquare className="w-4 h-4" />
        Iniciar Conversa
        <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-all" />
      </button>
    </motion.div>
  );
}
