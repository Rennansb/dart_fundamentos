import React, { useState, useMemo } from 'react';
import { useAuth } from '../AuthContext';
import { Check, Zap, Crown, CreditCard, QrCode, Copy, AlertCircle, X, Lock, Calendar, Star } from 'lucide-react';
import { paymentService } from '../services/paymentService';
import { QRCodeSVG } from 'qrcode.react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { motion } from 'framer-motion';

const MAIN_PLANS = [
  {
    id: 'start',
    name: 'Hub Start',
    price: '0.00',
    duration: 1,
    features: ['Até 10 Clientes Ativos', 'Até 10 OS mensais', 'Cadastro de Peças & Serviços', 'Catálogo de Fornecedores'],
    color: 'gray'
  },
  {
    id: 'pro',
    name: 'Hub Pro',
    price: '29.99',
    duration: 1,
    features: ['Até 50 Clientes Ativos', 'Até 50 OS mensais', 'Orçamentos em PDF Profissionais', 'Gestão Financeira Básica', 'Relatórios de Gestão Básicos', 'Catálogo de Fornecedores Premium'],
    color: 'indigo'
  },
  {
    id: 'elite',
    name: 'Hub Elite',
    price: '79.99',
    duration: 1,
    features: [
      'Tudo Ilimitado (Clientes/OS)',
      'Consultoria Digital IA 24/7',
      'Agente WhatsApp IA 24/7',
      'Gestão Financeira Full',
      'Relatórios Operacionais',
      'Agenda Integrada ao WhatsApp',
      'Reposição Inteligente de Peças',
      'Curva ABC e BI Avançado',
      'Análise de LTV e Performance',
      'Radar de Fornecedores Integrado',
      'Checklist Digital & Fotos',
      'Suporte Prioritário VIP',
      'Acesso Admin para Equipe'
    ],
    color: 'amber'
  }
];

const PACKAGES = [
  { id: 'pro', name: 'Hub Pro Trimestral', price: '80.97', duration: 3, label: '3 Meses (10% OFF)', color: 'indigo' },
  { id: 'pro', name: 'Hub Pro Anual', price: '287.90', duration: 12, label: 'Anual (20% OFF)', color: 'indigo' },
  { id: 'elite', name: 'Hub Elite Trimestral', price: '215.97', duration: 3, label: '3 Meses (10% OFF)', color: 'amber' },
  { id: 'elite', name: 'Hub Elite Anual', price: '767.90', duration: 12, label: 'Anual (20% OFF)', color: 'amber' }
];

export default function Subscription() {
  const { profile, user, updateProfile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<any>(null);
  const [paymentData, setPaymentData] = useState<any>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');
  const [useCredits, setUseCredits] = useState(false);

  const credits = profile?.serviceHubCredits || 0;

  const planInfo = useMemo(() => {
    if (!profile?.planExpiresAt) return null;
    try {
      const expiry = profile.planExpiresAt.toDate ? profile.planExpiresAt.toDate() : new Date(profile.planExpiresAt);
      const days = Math.ceil((expiry.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
      return {
        date: format(expiry, "dd 'de' MMMM 'de' yyyy", { locale: ptBR }),
        daysRemaining: days
      };
    } catch (e) {
      return null;
    }
  }, [profile?.planExpiresAt]);

  const handleUpgrade = async (plan: any) => {
    setLoading(true);
    setError('');
    setSelectedPlan(plan);
    
    if (Number(plan.price) === 0) {
      try {
        await updateProfile({ plan: 'start', planExpiresAt: null });
        alert('Plano Start ativado com sucesso!');
        setLoading(false);
        return;
      } catch (err: any) {
        setError('Erro ao ativar plano Start');
        setLoading(false);
        return;
      }
    }

    if (!profile?.name || !profile?.email || !profile?.cpfCnpj || profile?.cpfCnpj === '00000000000') {
      setError('Por favor, complete seu perfil com Nome, Email e CPF/CNPJ reais antes de assinar um plano de produção.');
      setLoading(false);
      return;
    }

    const planPrice = Number(plan.price);
    const maxDiscount = planPrice * 0.45;
    const appliedDiscount = useCredits ? Math.min(credits, maxDiscount) : 0;
    const finalAmount = planPrice - appliedDiscount;

    try {
      const resp = await paymentService.createPayment(
        'subscription',
        finalAmount,
        { 
          companyId: profile?.companyId,
          userId: user?.uid,
          planType: plan.id,
          durationMonths: plan.duration,
          creditsUsed: appliedDiscount
        },
        {
          name: profile?.name || '',
          email: profile?.email || '',
          cpf: profile?.cpfCnpj || '00000000000'
        }
      );
      setPaymentData(resp);
    } catch (err: any) {
      setError(err.message || 'Erro ao gerar PIX');
    } finally {
      setLoading(false);
    }
  };

  const copyPix = () => {
    if (paymentData?.qrCode) {
      navigator.clipboard.writeText(paymentData.qrCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="text-center mb-12">
        <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white sm:text-4xl bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-violet-600">
          Escolha o plano ideal para seu negócio
        </h1>
        <p className="mt-4 text-xl text-gray-600 dark:text-gray-400">
          Potencialize sua oficina com inteligência e automação
        </p>
      </div>

      {/* Subscription Status Card */}
      {profile?.plan && profile.plan !== 'free' && (
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-4xl mx-auto mb-6 bg-white dark:bg-gray-800 rounded-[2.5rem] p-8 border border-indigo-100 dark:border-indigo-900/30 shadow-2xl shadow-indigo-100 dark:shadow-none relative overflow-hidden group"
        >
          <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-50 dark:bg-indigo-900/20 rounded-full -mr-32 -mt-32 transition-transform duration-700 group-hover:scale-110"></div>
          
          <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-8">
            <div className="flex items-center gap-6">
              <div className="h-20 w-20 bg-indigo-600 rounded-[2rem] flex items-center justify-center shadow-xl shadow-indigo-200 dark:shadow-none">
                {profile.plan === 'elite' ? <Crown className="h-10 w-10 text-white" /> : <Zap className="h-10 w-10 text-white" />}
              </div>
              <div>
                <p className="text-xs font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400 mb-1">Assinatura Ativa</p>
                <h2 className="text-3xl font-black text-gray-900 dark:text-white">Hub {profile.plan.charAt(0).toUpperCase() + profile.plan.slice(1)}</h2>
                {planInfo && (
                  <div className="flex items-center gap-2 mt-2 text-gray-500 dark:text-gray-400 font-medium text-sm">
                    <Calendar className="w-4 h-4" />
                    Expira em {planInfo.date}
                  </div>
                )}
              </div>
            </div>

            {planInfo && (
              <div className="text-center md:text-right">
                <div className="inline-block px-6 py-4 bg-indigo-50 dark:bg-indigo-900/40 rounded-3xl border border-indigo-100 dark:border-indigo-800/50">
                  <p className="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase mb-1">Tempo Restante</p>
                  <p className="text-4xl font-black text-indigo-700 dark:text-indigo-300">
                    {planInfo.daysRemaining} <span className="text-lg">Dias</span>
                  </p>
                </div>
              </div>
            )}
          </div>
        </motion.div>
      )}

      {/* Store Credits Section */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-4xl mx-auto mb-12 bg-gradient-to-br from-gray-900 to-gray-800 rounded-[2.5rem] p-8 border border-gray-700 shadow-xl relative overflow-hidden"
      >
        <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/10 rounded-full -mr-16 -mt-16"></div>
        <div className="flex flex-col md:flex-row items-center justify-between gap-6 relative z-10">
          <div className="flex items-center gap-4">
            <div className="h-14 w-14 bg-amber-500/20 rounded-2xl flex items-center justify-center border border-amber-500/30">
              <Star className="h-7 w-7 text-amber-500" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-amber-500 mb-1">Créditos de Fidelidade</p>
              <h3 className="text-2xl font-black text-white">Saldo Service Hub: R$ {credits.toFixed(2)}</h3>
              <p className="text-xs text-gray-400 mt-1">Use seus créditos para ganhar até 45% de desconto na renovação.</p>
            </div>
          </div>
          <button 
            onClick={() => setUseCredits(!useCredits)}
            className={`px-8 py-3 rounded-2xl font-black text-xs uppercase tracking-widest transition-all ${useCredits ? 'bg-amber-500 text-gray-900 shadow-lg shadow-amber-500/20' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
          >
            {useCredits ? 'Desconto Aplicado' : 'Aplicar Créditos'}
          </button>
        </div>
      </motion.div>

      {error && (
        <div className="max-w-md mx-auto mb-8 p-4 bg-red-50 text-red-700 rounded-xl flex items-center gap-3 border border-red-100 shadow-sm">
          <AlertCircle className="w-5 h-5" />
          {error}
        </div>
      )}

      {!paymentData ? (
        <div className="space-y-12">
          {/* Main Plans */}
          <div className="flex overflow-x-auto lg:grid lg:grid-cols-3 gap-6 lg:gap-8 max-w-6xl mx-auto pb-8 scrollbar-hide snap-x px-2 lg:px-0">
            {MAIN_PLANS.map((plan) => {
              const isCurrentPlan = profile?.plan === plan.id;
              const isElite = profile?.plan === 'elite';
              const isPro = profile?.plan === 'pro';
              const isBlocked = isElite ? (plan.id !== 'elite') : (isPro ? (plan.id === 'start') : false);
              const needsProfileData = plan.id !== 'start' && (!profile?.name || !profile?.email || !profile?.cpfCnpj || profile?.cpfCnpj === '00000000000');
              
              return (
                <div
                  key={plan.id}
                  className={`relative bg-white dark:bg-gray-800 rounded-[2.5rem] shadow-xl border-2 transition-all hover:scale-[1.02] flex-shrink-0 w-[85%] sm:w-[350px] lg:w-full snap-center ${
                    isCurrentPlan ? 'border-indigo-600 ring-4 ring-indigo-500/10' : 'border-transparent'
                  } ${isBlocked ? 'opacity-95' : ''}`}
                >
                  {isCurrentPlan && (
                    <div className="absolute top-0 right-10 -translate-y-1/2 bg-indigo-600 text-white text-xs font-bold px-4 py-1.5 rounded-full shadow-lg z-10 animate-bounce">
                      Seu Plano Atual
                    </div>
                  )}
                  {isBlocked && !isCurrentPlan && (
                    <div className="absolute inset-0 bg-gray-50/20 dark:bg-gray-900/20 backdrop-blur-[2px] z-20 rounded-[2.5rem] flex items-center justify-center p-6 text-center pointer-events-none">
                      <div className="bg-white/90 dark:bg-gray-800/90 p-6 rounded-3xl shadow-2xl border border-gray-100 dark:border-gray-700 max-w-[200px] transform -rotate-3">
                        <div className="h-12 w-12 bg-gray-100 dark:bg-gray-700 rounded-2xl flex items-center justify-center mx-auto mb-3">
                          <Lock className="w-6 h-6 text-gray-400" />
                        </div>
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Plano Inferior</p>
                        <p className="text-xs font-bold text-gray-500 uppercase">Acesso Bloqueado</p>
                      </div>
                    </div>
                  )}
                  <div className="p-8">
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4 flex items-center">
                      {plan.id === 'elite' ? <Crown className="h-6 w-6 mr-2 text-amber-500" /> : 
                       plan.id === 'pro' ? <Zap className="h-6 w-6 mr-2 text-indigo-500" /> :
                       <Check className="h-6 w-6 mr-2 text-gray-400" />}
                      {plan.name}
                    </h3>
                    <div className="flex items-baseline mb-8">
                      <span className="text-4xl font-extrabold text-gray-900 dark:text-white">R$ {plan.price.replace('.', ',')}</span>
                      <span className="ml-1 text-gray-500">/mês</span>
                    </div>
                    <ul className="space-y-4 mb-8">
                      {plan.features.map((feature, idx) => (
                        <li key={idx} className="flex items-start text-sm text-gray-600 dark:text-gray-400">
                          <Check className="h-5 w-5 text-green-500 mr-2 flex-shrink-0" />
                          {feature}
                        </li>
                      ))}
                    </ul>

                    {needsProfileData && (
                      <p className="text-[10px] text-red-500 mb-4 font-bold flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" /> Complete seu perfil para assinar
                      </p>
                    )}

                    <button
                      onClick={() => handleUpgrade(plan)}
                      disabled={loading || isCurrentPlan || isBlocked}
                      className={`w-full py-4 px-6 rounded-2xl font-bold transition-all flex items-center justify-center gap-2 ${
                        isCurrentPlan
                          ? 'bg-gray-100 text-gray-400 cursor-default dark:bg-gray-700'
                          : needsProfileData
                          ? 'bg-gray-100 text-gray-400 hover:bg-gray-200 cursor-pointer'
                          : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-lg hover:shadow-indigo-500/30'
                      }`}
                    >
                      {loading && selectedPlan?.id === plan.id ? (
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : isCurrentPlan ? (
                        'Ativo'
                      ) : (
                        <>
                          <Zap className="w-5 h-5" />
                          {needsProfileData ? 'Completar Perfil' : 'Assinar Agora'}
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Special Offers Section */}
          <div className="max-w-6xl mx-auto">
            <div className="flex items-center gap-4 mb-8">
              <div className="h-px bg-gray-200 dark:bg-gray-700 flex-1" />
              <h2 className="text-lg font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest flex items-center gap-2">
                <Crown className="w-5 h-5 text-amber-500" />
                Pacotes de Longa Duração - Melhores Preços
                <Crown className="w-5 h-5 text-amber-500" />
              </h2>
              <div className="h-px bg-gray-200 dark:bg-gray-700 flex-1" />
            </div>

            <div className="flex overflow-x-auto lg:grid lg:grid-cols-4 gap-6 pb-8 scrollbar-hide snap-x px-2 lg:px-0">
              {PACKAGES.map((pkg, idx) => {
                const isElite = profile?.plan === 'elite';
                const isBlocked = isElite && pkg.id !== 'elite';
                const needsProfileData = !profile?.name || !profile?.email || !profile?.cpfCnpj || profile?.cpfCnpj === '00000000000';
                return (
                  <div key={idx} className={`bg-white dark:bg-gray-800 p-6 rounded-[2rem] border border-gray-100 dark:border-gray-700 shadow-lg hover:shadow-xl transition-all border-l-4 border-l-indigo-500 flex-shrink-0 w-[240px] lg:w-full snap-center relative ${isBlocked ? 'opacity-95' : ''}`}>
                    {isBlocked && (
                      <div className="absolute inset-0 bg-gray-50/20 dark:bg-gray-900/20 backdrop-blur-[1px] z-20 rounded-[2rem] flex items-center justify-center p-4 text-center pointer-events-none">
                         <div className="bg-white/90 dark:bg-gray-800/90 p-4 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700 w-full transform rotate-3">
                          <Lock className="w-5 h-5 text-gray-400 mx-auto mb-1" />
                          <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest">Bloqueado</p>
                        </div>
                      </div>
                    )}
                    <h4 className="font-bold text-gray-900 dark:text-white text-sm mb-1">{pkg.name}</h4>
                    <span className="inline-block bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 text-[10px] font-bold px-2 py-0.5 rounded-full mb-3">
                      {pkg.label}
                    </span>
                    <div className="text-2xl font-black text-gray-900 dark:text-white mb-4">
                      R$ {pkg.price.replace('.', ',')}
                    </div>
                    <button
                      onClick={() => handleUpgrade(pkg)}
                      disabled={loading || needsProfileData || isBlocked}
                      className={`w-full py-2.5 px-4 rounded-xl text-xs font-bold transition-all bg-slate-900 dark:bg-indigo-600 text-white hover:opacity-90 active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2`}
                    >
                      {loading && selectedPlan?.name === pkg.name ? (
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <>
                          <CreditCard className="w-4 h-4" />
                          Gerar PIX
                        </>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : (
        <div className="max-w-md mx-auto bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-8 border border-gray-200 dark:border-gray-700">
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center h-16 w-16 rounded-full bg-emerald-100 dark:bg-emerald-900/30 mb-4">
              <QrCode className="h-8 w-8 text-emerald-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Pagamento PIX Gerado</h2>
            <p className="text-gray-600 dark:text-gray-400">Escaneie o QR Code para ativar seu plano {selectedPlan?.name}</p>
          </div>

          <div className="bg-white p-6 rounded-2xl mb-6 shadow-inner flex justify-center border-2 border-dashed border-gray-200 dark:border-gray-700">
            <QRCodeSVG value={paymentData.qrCode} size={200} />
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Copia e Cola</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  readOnly
                  value={paymentData.qrCode}
                  className="flex-1 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 text-xs text-gray-600 dark:text-gray-400 focus:outline-none"
                />
                <button
                  onClick={copyPix}
                  className="bg-indigo-600 text-white px-6 py-3 rounded-xl hover:bg-indigo-700 transition-all font-bold shadow-md hover:shadow-indigo-500/30 flex items-center gap-2"
                >
                  {copied ? 'Pronto!' : <Copy className="h-5 w-5" />}
                </button>
              </div>
            </div>

            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-100 dark:border-blue-900/30 flex items-start gap-3">
              <div className="p-2 bg-blue-500 rounded-lg shrink-0">
                <Zap className="h-4 w-4 text-white" />
              </div>
              <p className="text-xs text-blue-800 dark:text-blue-200 leading-relaxed">
                Após o pagamento, o sistema identificará automaticamente a transação e liberará seu acesso em até 5 minutos através do nosso webhook.
              </p>
            </div>

            <button
              onClick={() => setPaymentData(null)}
              className="w-full py-3 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors flex items-center justify-center gap-2"
            >
              <X className="w-4 h-4" />
              Escolher outro plano
            </button>
          </div>
        </div>
      )}

      {/* Benefits Section */}
      <div className="mt-16 bg-gradient-to-br from-indigo-900 to-indigo-800 rounded-3xl p-8 lg:p-12 text-white overflow-hidden relative">
        <div className="relative z-10 lg:flex items-center justify-between">
          <div className="lg:max-w-xl">
            <h2 className="text-3xl font-bold mb-4">Potencialize sua operação com o Service Hub</h2>
            <p className="text-indigo-100 text-lg mb-8 opacity-90">
              Nossa plataforma automatiza processos repetitivos para que você foque no que realmente importa: a qualidade do seu serviço.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="group flex items-center p-3 rounded-xl bg-white/5 hover:bg-white/10 transition-colors">
                <div className="h-10 w-10 rounded-lg bg-indigo-500 flex items-center justify-center mr-4 group-hover:scale-110 transition-transform">
                  <Check className="h-6 w-6 text-white" />
                </div>
                <span className="font-medium text-indigo-50">Controle Total de OS</span>
              </div>
              <div className="group flex items-center p-3 rounded-xl bg-white/5 hover:bg-white/10 transition-colors">
                <div className="h-10 w-10 rounded-lg bg-indigo-500 flex items-center justify-center mr-4 group-hover:scale-110 transition-transform">
                  <CreditCard className="h-6 w-6 text-white" />
                </div>
                <span className="font-medium text-indigo-50">Gestão Financeira Integrada</span>
              </div>
            </div>
          </div>
          <div className="hidden lg:block">
            <div className="relative">
              <div className="absolute inset-0 bg-white/10 blur-3xl rounded-full"></div>
              <Crown className="h-48 w-48 text-white relative z-10 opacity-20 rotate-12" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
