import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Check, ArrowRight, ShieldCheck, Zap, Star, X, Crown, Activity } from 'lucide-react';
import { useAuth } from '../AuthContext';
import { db } from '../firebase';
import { doc, updateDoc, onSnapshot } from 'firebase/firestore';
import { paymentService } from '../services/paymentService';
import { QRCodeSVG } from 'qrcode.react';
import { motion, AnimatePresence } from 'framer-motion';

const PLANS = [
  {
    id: 'free',
    name: 'Oficina Start',
    price: 0,
    features: [
      'Até 10 Clientes Ativos', 
      'Até 10 OS mensais', 
      'Cadastro de Peças & Serviços', 
      '❌ Sem Download de Orçamento',
      '❌ Sem Histórico Veicular'
    ],
    icon: ShieldCheck,
    color: 'gray'
  },
  {
    id: 'pro',
    name: 'Oficina Pro',
    price: 29.99,
    features: [
      'Até 50 Clientes Ativos', 
      'Até 50 OS mensais', 
      '50 Downloads de Orçamento/mês',
      'Histórico Veicular Premium',
      'Gestão Financeira Básica',
      'Relatórios de Gestão Básicos'
    ],
    icon: Zap,
    color: 'indigo'
  },
  {
    id: 'elite',
    name: 'Oficina Elite',
    price: 79.99,
    features: [
      'Clientes & OS Ilimitados',
      'Downloads PDF Ilimitados',
      'Gestão de Equipe (Multi-usuário)',
      'Agenda Integrada ao WhatsApp',
      'Relatórios Operacionais & Financeiros',
      'Consultoria Digital IA 24/7',
      'BI Avançado & Curva ABC'
    ],
    icon: Star,
    color: 'purple',
    popular: true
  }
];

export default function PlanSelection() {
  const [searchParams] = useSearchParams();
  const initialPlan = searchParams.get('plan');
  const { profile, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  
  const [selectedPlan, setSelectedPlan] = useState<string | null>(initialPlan || null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentStep, setPaymentStep] = useState<'details' | 'qrcode' | 'success'>('details');
  const [loading, setLoading] = useState(false);
  const [paymentData, setPaymentData] = useState<any>(null);
  const initialized = React.useRef(false);

  useEffect(() => {
    if (!authLoading && !profile) {
      navigate('/login');
    } else if (!authLoading && profile?.role === 'fornecedor') {
      navigate('/app');
    }
  }, [authLoading, profile, navigate]);

  useEffect(() => {
    if (profile && !initialized.current) {
      initialized.current = true;
      if (initialPlan === 'free' || initialPlan === 'start') {
        handleSelectPlan('free');
      } else if (initialPlan === 'pro' || initialPlan === 'elite') {
        handleSelectPlan(initialPlan);
      }
    }
  }, [initialPlan, profile]);

  const handleSelectPlan = async (planId: string) => {
    if (planId === 'free') {
      setLoading(true);
      try {
        if (profile?.id) {
          await updateDoc(doc(db, 'users', profile.id), {
            plan: 'free',
            planExpiresAt: null
          });
        }
        navigate('/app');
      } catch (error) {
        console.error("Error setting free plan:", error);
      } finally {
        setLoading(false);
      }
    } else {
      setSelectedPlan(planId);
      setPaymentStep('details');
      setShowPaymentModal(true);
    }
  };

  const handleProcessPayment = async () => {
    if (!selectedPlan || !profile) return;
    
    setLoading(true);
    try {
      const plan = PLANS.find(p => p.id === selectedPlan);
      if (!plan) return;

      const resp = await paymentService.createPayment(
        'subscription',
        plan.price,
        { 
          companyId: profile.companyId || profile.id,
          userId: profile.id,
          planType: plan.id
        },
        {
          name: profile.name || '',
          email: profile.email || '',
          cpf: profile.cpfCnpj || '00000000000'
        }
      );

      setPaymentData(resp);
      setPaymentStep('qrcode');

      // Start listening for plan update in user document
      const unsubscribe = onSnapshot(doc(db, 'users', profile.id), (snap) => {
        const data = snap.data();
        if (data?.plan === selectedPlan) {
          setPaymentStep('success');
          unsubscribe();
          setTimeout(() => {
            navigate('/app');
          }, 3000);
        }
      });

    } catch (error: any) {
      console.error("Error processing payment:", error);
      alert(error.message || "Erro ao gerar PIX");
    } finally {
      setLoading(false);
    }
  };

  const planDetails = PLANS.find(p => p.id === selectedPlan);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0B0F19] py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden transition-colors duration-700">
      <div className="mesh-bg" />
      
      <div className="max-w-7xl mx-auto relative z-10">
        <div className="text-center mb-20">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-500/10 rounded-full border border-indigo-500/20 text-indigo-400 text-[10px] font-black uppercase tracking-widest mb-6"
          >
            <Crown className="w-4 h-4" /> Plano de Expansão
          </motion.div>
          <h2 className="text-5xl font-black text-gray-900 dark:text-white sm:text-7xl tracking-tighter uppercase">
            Potencialize seu <span className="text-indigo-500">Negócio</span>
          </h2>
          <p className="mt-6 text-xl text-gray-600 dark:text-gray-400 font-medium max-w-2xl mx-auto">
            Integre IA, BI e automação avançada com os planos exclusivos Hub Master.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          {PLANS.map((plan) => {
            const Icon = plan.icon;
            return (
              <motion.div 
                key={plan.id}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 * PLANS.indexOf(plan) }}
                className={`relative glass-card rounded-[3rem] p-1 flex flex-col group transition-all duration-500 hover:scale-[1.02] ${
                  plan.popular 
                    ? 'border-indigo-500/50 shadow-2xl shadow-indigo-500/10 md:-translate-y-4' 
                    : 'border-white/5'
                }`}
              >
                {plan.popular && (
                  <div className="absolute top-0 right-10 transform -translate-y-1/2 z-20">
                    <span className="bg-indigo-600 text-white px-5 py-2 rounded-full text-[10px] font-black uppercase tracking-[0.2em] shadow-xl">
                      Mais Popular
                    </span>
                  </div>
                )}
                
                <div className="p-8 sm:p-10 flex-1">
                  <div className={`w-16 h-16 rounded-[1.5rem] flex items-center justify-center mb-8 transition-transform group-hover:scale-110 duration-500 ${
                    plan.color === 'indigo' ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30' :
                    plan.color === 'purple' ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30' :
                    'bg-white/5 text-gray-400 border border-white/10'
                  }`}>
                    <Icon className="h-8 w-8" />
                  </div>
                  
                  <h3 className="text-3xl font-black text-gray-900 dark:text-white mb-2 tracking-tight uppercase">{plan.name}</h3>
                  <div className="flex items-baseline mb-8">
                    <span className="text-5xl font-black text-gray-900 dark:text-white tracking-tighter tabular-nums">
                      R$ {plan.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                    <span className="text-gray-500 dark:text-gray-400 ml-2 font-black uppercase text-[10px] tracking-widest">/ mensal</span>
                  </div>
                  
                  <ul className="space-y-4 mb-10">
                    {plan.features.map((feature, idx) => (
                      <li key={idx} className="flex items-start gap-4">
                        <div className={`mt-1 h-5 w-5 rounded-full flex items-center justify-center flex-shrink-0 ${feature.includes('❌') ? 'bg-rose-500/10 text-rose-500' : 'bg-emerald-500/10 text-emerald-400'}`}>
                          {feature.includes('❌') ? <X className="w-3 h-3" /> : <Check className="w-3 h-3" />}
                        </div>
                        <span className={`text-sm font-medium ${feature.includes('❌') ? 'text-gray-500' : 'text-gray-600 dark:text-gray-300'}`}>{feature.replace('❌ ', '')}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                
                <div className="p-8 sm:p-10 pt-0 mt-auto">
                  <button
                    onClick={() => handleSelectPlan(plan.id)}
                    disabled={loading}
                    className={`w-full py-5 px-4 rounded-[2rem] font-black uppercase tracking-widest text-[10px] transition-all duration-300 flex items-center justify-center gap-2 group/btn ${
                      plan.popular
                        ? 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-xl shadow-indigo-500/20'
                        : 'bg-white/5 dark:bg-white/5 text-gray-900 dark:text-white hover:bg-white/10 border border-white/10'
                    }`}
                  >
                    {plan.price === 0 ? 'Começar Grátis' : 'Assinar Agora'}
                    <ArrowRight className="h-4 w-4 transition-transform group-hover/btn:translate-x-1" />
                  </button>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Payment Modal */}
      {showPaymentModal && planDetails && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0B0F19]/80 backdrop-blur-md p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="glass-card rounded-[3rem] shadow-2xl max-w-md w-full overflow-hidden border-white/10"
          >
            <div className="flex justify-between items-center p-8 border-b border-white/5">
              <h3 className="text-xl font-black text-gray-900 dark:text-white uppercase tracking-tight">
                {paymentStep === 'details' ? 'Carrinho Executivo' : paymentStep === 'qrcode' ? 'Checkout Seguro Pix' : 'Assinatura Ativada'}
              </h3>
              {paymentStep !== 'qrcode' && paymentStep !== 'success' && (
                <button onClick={() => setShowPaymentModal(false)} className="p-2 hover:bg-white/10 rounded-xl transition-all">
                  <X className="h-6 w-6 text-gray-400" />
                </button>
              )}
            </div>
            
            <div className="p-8">
              {paymentStep === 'details' && (
                <div className="space-y-8">
                  <div className="bg-white/5 p-6 rounded-[2rem] border border-white/10 shadow-inner">
                    <h4 className="text-[10px] font-black uppercase text-indigo-400 tracking-widest mb-4">Itens Selecionados</h4>
                    <div className="flex justify-between items-center">
                      <span className="font-black text-white uppercase text-lg">{planDetails.name}</span>
                      <span className="text-xl font-black text-indigo-400 tabular-nums">R$ {planDetails.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h4 className="text-[10px] font-black uppercase text-gray-500 tracking-widest">Credenciais de Assinante</h4>
                    <div className="grid grid-cols-1 gap-4">
                      {[
                        { label: 'Razão Social', value: profile?.companyName || profile?.name },
                        { label: 'Identificação', value: profile?.cpfCnpj },
                        { label: 'Email Direto', value: profile?.email }
                      ].map(item => (
                        <div key={item.label} className="flex justify-between border-b border-white/5 pb-2">
                          <span className="text-[10px] font-bold text-gray-600 uppercase tracking-tighter">{item.label}</span>
                          <span className="text-xs font-black text-white truncate max-w-[200px]">{item.value || 'N/A'}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <button
                    onClick={handleProcessPayment}
                    className="w-full py-5 bg-indigo-600 text-white rounded-[1.5rem] font-black uppercase tracking-widest text-[10px] hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-500/20 active:scale-95"
                  >
                    Consolidar Assinatura via Pix
                  </button>
                </div>
              )}

              {paymentStep === 'qrcode' && (
                <div className="flex flex-col items-center text-center">
                  <div className="bg-white p-6 rounded-[2.5rem] shadow-2xl border border-indigo-100 mb-8 transform hover:scale-105 transition-transform duration-500">
                    <QRCodeSVG value={paymentData?.qrCode || ''} size={220} />
                  </div>
                  <h4 className="text-2xl font-black text-white tracking-tight mb-2">Checkout Instantâneo</h4>
                  <p className="text-sm text-gray-400 font-medium mb-8">
                    Utilize o QR Code acima para ativação imediata do seu ecossistema Hub Master.
                  </p>
                  <div className="w-full space-y-4">
                    <div className="flex gap-2 p-2 bg-white/5 rounded-2xl border border-white/5">
                      <input 
                        type="text" 
                        readOnly 
                        value={paymentData?.qrCode || ''} 
                        className="flex-1 text-xs bg-transparent border-none focus:ring-0 px-3 py-2 text-gray-400 truncate"
                      />
                      <button 
                        onClick={() => {
                          navigator.clipboard.writeText(paymentData?.qrCode || '');
                          alert("PIX Copiado!");
                        }}
                        className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 transition-colors"
                      >
                        Copiar
                      </button>
                    </div>
                  </div>
                  <div className="mt-10 flex items-center justify-center gap-3 py-4 px-6 bg-indigo-500/10 rounded-full border border-indigo-500/20">
                    <div className="animate-spin h-4 w-4 border-2 border-indigo-400 border-t-transparent rounded-full shadow-[0_0_10px_rgba(129,140,248,0.5)]"></div>
                    <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Sincronizando com Banco Central...</span>
                  </div>
                </div>
              )}

              {paymentStep === 'success' && (
                <div className="flex flex-col items-center text-center py-10">
                  <motion.div 
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="w-24 h-24 bg-emerald-500/20 border border-emerald-500/40 rounded-full flex items-center justify-center mb-8 shadow-[0_0_30px_rgba(16,185,129,0.3)]"
                  >
                    <Check className="h-12 w-12 text-emerald-400" />
                  </motion.div>
                  <h3 className="text-3xl font-black text-white tracking-tighter uppercase mb-4">Assinatura Ativa</h3>
                  <p className="text-gray-400 font-medium mb-10 max-w-xs">
                    Bem-vindo à elite. Sua oficina {planDetails.name} foi vinculada com sucesso ao nosso ecossistema.
                  </p>
                  <div className="flex items-center gap-2 text-emerald-400 text-[10px] font-black uppercase tracking-[0.2em] animate-pulse">
                    <Activity className="h-4 w-4" /> Redirecionando para Command Center
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
