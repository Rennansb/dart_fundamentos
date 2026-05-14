import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  Wrench, 
  ShieldCheck, 
  Zap, 
  BarChart3, 
  Package, 
  Check, 
  ArrowRight, 
  Truck, 
  TrendingUp, 
  Users, 
  Clock, 
  Activity,
  Brain,
  BrainCircuit, 
  X,
  MessageSquare,
  PlayCircle,
  CheckCircle2,
  Settings2,
  Sparkles,
  Layers,
  LayoutGrid
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../AuthContext';
import { auth, db } from '../firebase';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc, serverTimestamp, collection, getDocs } from 'firebase/firestore';

export default function Landing() {
  const [showDemoModal, setShowDemoModal] = useState(false);
  const [loadingDemo, setLoadingDemo] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  const [realStats, setRealStats] = useState({
    shops: "+500",
    sales: "+R$ 15M",
    success: "99.8%"
  });

  React.useEffect(() => {
    const fetchGlobalStats = async () => {
      try {
        const usersSnap = await getDocs(collection(db, 'users'));
        const ordersSnap = await getDocs(collection(db, 'purchase_orders'));
        
        let usersCount = usersSnap.size;
        let totalSales = 0;
        ordersSnap.forEach(doc => {
          totalSales += (doc.data().total || 0);
        });

        if (usersCount > 0) {
          setRealStats({
            shops: `+${usersCount}`,
            sales: totalSales > 1000 ? `R$ ${(totalSales / 1000).toFixed(0)}k` : `R$ ${totalSales.toFixed(0)}`,
            success: "99.9%"
          });
        }
      } catch (err) {
        // Silently fails on missing permissions in offline or restricted rules
      }
    };
    fetchGlobalStats();
  }, []);

  const handleDemoLogin = async (role: 'shop' | 'supplier') => {
    setLoadingDemo(true);
    const email = role === 'shop' ? 'demo.shop@servicehub.com' : 'demo.supplier@servicehub.com';
    const password = 'demo123';

    try {
      await login(email, password);
      navigate('/app');
    } catch (error: any) {
      console.error('Demo login failed', error);
      
      // If login fails, try to create the demo account
      if (error.code === 'auth/invalid-credential' || error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
        try {
          const userCredential = await createUserWithEmailAndPassword(auth, email, password);
          const user = userCredential.user;
          
          const userData = {
            uid: user.uid,
            name: role === 'shop' ? 'Oficina Demo' : 'Fornecedor Demo',
            companyName: role === 'shop' ? 'Oficina Demo LTDA' : 'Fornecedor Demo LTDA',
            tradeName: role === 'shop' ? 'Oficina Demo' : 'Fornecedor Demo',
            email: email,
            role: role === 'shop' ? 'shop' : 'fornecedor',
            status: 'active',
            companyId: user.uid,
            segment: role === 'shop' ? 'automotive' : null,
            docType: 'cnpj',
            cpfCnpj: '00.000.000/0001-00',
            phone: '(11) 99999-9999',
            address: {
              cep: '01001-000',
              street: 'Praça da Sé',
              number: '1',
              complement: 'Lado ímpar',
              neighborhood: 'Sé',
              city: 'São Paulo',
              state: 'SP'
            },
            createdAt: serverTimestamp(),
            plan: role === 'shop' ? 'elite' : 'free',
            planExpiresAt: role === 'shop' ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() : null
          };

          await setDoc(doc(db, 'users', user.uid), userData);
          
          // Login again using context to set states properly
          await login(email, password);
          navigate('/app');
        } catch (createError) {
          console.error('Failed to create demo account', createError);
          alert('Erro ao criar conta de demonstração. Tente novamente.');
        }
      } else {
        alert('Erro ao acessar demonstração. Tente novamente.');
      }
    } finally {
      setLoadingDemo(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0B0F19] relative overflow-hidden transition-colors duration-700">
      <div className="mesh-bg opacity-40" />
      {/* Navigation */}
      <nav className="fixed top-6 left-0 right-0 z-50 px-4">
        <div className="max-w-7xl mx-auto bg-white/70 dark:bg-[#0B0F19]/70 backdrop-blur-2xl border border-white/20 dark:border-white/5 rounded-[2.5rem] shadow-2xl overflow-hidden">
          <div className="max-w-7xl mx-auto px-6 lg:px-10">
            <div className="flex justify-between h-20 items-center">
              <div className="flex items-center gap-12">
                <div className="flex items-center cursor-pointer" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
                  <div className="bg-gradient-to-br from-indigo-500 to-purple-600 p-2 rounded-xl shadow-2xl">
                    <Layers className="h-6 w-6 text-white" />
                  </div>
                  <span className="ml-3 text-xl font-black text-gray-900 dark:text-white tracking-tighter uppercase">Service<span className="text-indigo-500">Hub</span></span>
                </div>
                
                <div className="hidden md:flex items-center space-x-10">
                  {['Recursos', 'Vantagens', 'Fornecedores', 'Preços'].map(item => (
                    <a key={item} href={`#${item.toLowerCase()}`} className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 hover:text-indigo-500 transition-all">{item}</a>
                  ))}
                </div>
              </div>
              
              <div className="flex items-center space-x-4">
                <Link to="/login" className="text-[10px] font-black uppercase tracking-widest text-gray-500 hover:text-indigo-500 px-4 py-2 transition-all">
                  Entrar
                </Link>
                <Link to="/signup" className="bg-indigo-600 text-white hover:bg-indigo-700 px-6 py-2.5 rounded-full text-[10px] font-black uppercase tracking-widest shadow-xl shadow-indigo-500/20 transition-all hover:scale-105 active:scale-95">
                  Começar
                </Link>
              </div>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <div className="relative pt-32 pb-40 overflow-hidden">
        {/* Background Decorative Elements */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full -z-10">
          <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-indigo-500/20 rounded-full blur-[160px] animate-pulse"></div>
          <div className="absolute bottom-[20%] right-[-10%] w-[40%] h-[40%] bg-purple-500/20 rounded-full blur-[140px]"></div>
          <div className="absolute top-[30%] right-[10%] w-[30%] h-[30%] bg-blue-500/10 rounded-full blur-[120px] animate-bounce-slow"></div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          >
            <div className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-indigo-500/10 backdrop-blur-md border border-indigo-500/20 mb-12 shadow-sm">
              <Sparkles className="h-4 w-4 text-indigo-500 animate-pulse" />
              <span className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.3em]">IA, Gestão B2B e Vendas Integradas</span>
            </div>

            <h1 className="text-5xl sm:text-6xl md:text-8xl font-black text-gray-900 dark:text-white tracking-tighter leading-[0.95] mb-12 uppercase flex flex-col items-center">
              <span>O ÚNICO SISTEMA QUE</span> 
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-400 mt-2">
                GERENCIA SUA OFICINA E COMPRA PEÇAS
              </span>
            </h1>
            
            <p className="text-xl sm:text-2xl text-gray-500 dark:text-gray-400 max-w-4xl mx-auto mb-20 leading-relaxed font-medium">
              Esqueça dezenas de mensaleiros caros e ligações infinitas. Atraia clientes no WhatsApp com Inteligência Artificial, feche orçamentos em 1 minuto e conecte-se com fornecedores diretos em tempo real.
            </p>

            <div className="flex flex-col md:flex-row justify-center items-center gap-4 mb-24">
              <Link to="/signup" className="group bg-indigo-600 text-white hover:bg-indigo-700 px-10 py-5 rounded-[2rem] text-xl font-black shadow-2xl shadow-indigo-200 dark:shadow-none transition-all hover:-translate-y-1.5 flex flex-col items-center justify-center border-2 border-indigo-500 w-full md:w-auto relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
                <span className="flex items-center relative z-10">
                  SOU OFICINA: QUERO LUCRAR MAIS
                  <ArrowRight className="ml-3 h-6 w-6 group-hover:translate-x-2 transition-transform" />
                </span>
                <span className="text-[10px] font-bold opacity-70 tracking-widest uppercase mt-2 relative z-10">1º Mês Grátis • Cancele quando quiser</span>
              </Link>

              <Link to="/signup?role=fornecedor" className="group bg-gray-900 dark:bg-black border-2 border-gray-800 text-white hover:border-gray-700 px-10 py-5 rounded-[2rem] text-xl font-black shadow-2xl shadow-gray-900/50 transition-all hover:-translate-y-1.5 flex flex-col items-center justify-center w-full md:w-auto md:ml-4">
                <span className="flex items-center">
                  SOU FORNECEDOR: VENDER AGORA
                  <Package className="ml-3 h-6 w-6 opacity-70 group-hover:rotate-12 transition-transform" />
                </span>
                <span className="text-[10px] font-bold opacity-70 tracking-widest uppercase mt-2 text-indigo-400">Alcance centenas de clientes • Apenas 3%</span>
              </Link>

              <button onClick={() => setShowDemoModal(true)} className="bg-white/5 backdrop-blur-md dark:bg-gray-800/80 text-gray-900 dark:text-white border-2 border-gray-200 dark:border-gray-700 hover:bg-white dark:hover:bg-gray-700 px-8 py-5 rounded-[2rem] text-lg font-black transition-all hover:-translate-y-1.5 flex items-center justify-center shadow-lg w-full md:w-auto md:ml-4">
                <PlayCircle className="mr-3 h-6 w-6 text-indigo-600" /> Demo Express
              </button>
            </div>
          </motion.div>

          {/* Social Proof / Stats */}
          <motion.div 
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="grid grid-cols-2 md:grid-cols-4 gap-8 py-12 border-t border-gray-100 dark:border-gray-800"
          >
            {[
              { label: "Oficinas Parceiras", value: realStats.shops },
              { label: "Vendas Geradas", value: realStats.sales },
              { label: "Atendimentos via IA", value: "24h/7" },
              { label: "Sucesso dos Clientes", value: realStats.success }
            ].map((stat, i) => (
              <div key={stat.label} className="text-center">
                <div className="text-3xl font-black text-gray-900 dark:text-white mb-1">{stat.value}</div>
                <div className="text-xs font-bold text-gray-400 uppercase tracking-widest">{stat.label}</div>
              </div>
            ))}
          </motion.div>
        </div>
      </div>

      {/* Mission & Vision Section */}
      <div className="py-40 bg-indigo-950/50 overflow-hidden relative border-y border-white/5">
        <div className="mesh-bg opacity-20" />
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="grid lg:grid-cols-2 gap-20 items-center">
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
            >
              <h2 className="text-indigo-300 font-bold tracking-widest uppercase text-sm mb-4">Metas e Valores</h2>
              <h3 className="text-4xl sm:text-6xl font-black text-white leading-[1.1] mb-8">
                Nossa Missão é Escalar o seu Sucesso
              </h3>
              <p className="text-xl text-indigo-100 mb-10 leading-relaxed font-medium">
                O Service Hub nasceu com um objetivo claro: democratizar a alta tecnologia para as oficinas do Brasil. 
                Nossos valores são baseados em transparência, eficiência e o uso ético da Inteligência Artificial.
              </p>
              
              <div className="space-y-8">
                {[
                  { title: "Transparência Total", desc: "Clareza absoluta em cada centavo da sua oficina, desde o custo da peça até o lucro líquido." },
                  { title: "Eficiência Máxima", desc: "Eliminamos o trabalho manual repetitivo para você focar no que realmente importa: o motor." },
                  { title: "Apoio ao Ecossistema", desc: "Conectamos oficinas e fornecedores em uma rede de colaboração mútua e crescimento." }
                ].map((item, i) => (
                  <div key={i} className="flex gap-5">
                    <div className="flex-shrink-0 w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center border border-white/20">
                      <CheckCircle2 className="h-6 w-6 text-indigo-400" />
                    </div>
                    <div>
                      <h4 className="text-xl font-bold text-white mb-2">{item.title}</h4>
                      <p className="text-indigo-200 leading-relaxed">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>

            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              className="relative"
            >
              <div className="glass-card rounded-[4rem] p-16 border-white/10 relative shadow-2xl">
                <div className="text-center">
                  <div className="inline-block p-8 bg-indigo-500/20 rounded-[2rem] border border-indigo-500/30 mb-10">
                    <TrendingUp className="w-20 h-20 text-indigo-400" />
                  </div>
                  <h4 className="text-4xl font-black text-white mb-6 uppercase tracking-tight">Escalabilidade Real</h4>
                  <p className="text-3xl font-bold text-indigo-200 leading-tight tracking-tighter">
                    Faturar <span className="text-indigo-400 underline underline-offset-8">3x mais</span> através de processos inteligentes e automação.
                  </p>
                </div>
              </div>
              <div className="absolute -top-10 -right-10 w-32 h-32 bg-indigo-500 rounded-full blur-3xl opacity-50"></div>
            </motion.div>
          </div>
        </div>
      </div>

      {/* WhatsApp Master Agent Section */}
      <div className="py-32 bg-[#0B0F19] overflow-hidden relative border-b border-white/5">
        <div className="mesh-bg opacity-30" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="lg:flex items-center gap-16">
            <motion.div 
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="lg:w-1/2 mb-12 lg:mb-0"
            >
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-100 dark:border-emerald-800 mb-6 font-bold text-emerald-600 dark:text-emerald-400 text-xs uppercase tracking-widest">
                <Sparkles className="w-3 h-3" /> Exclusivo
              </div>
              <h2 className="text-4xl sm:text-5xl font-black text-gray-900 dark:text-white leading-tight mb-6">
                Agente Master <br />
                <span className="text-emerald-600">WhatsApp 24/7</span>
              </h2>
              <p className="text-lg text-gray-600 dark:text-gray-400 mb-8 leading-relaxed">
                Esqueça o atendimento manual lento. Nosso Agente Master atende seus clientes no WhatsApp instantaneamente. Ele analisa fotos de peças, tira dúvidas técnicas, sugere orçamentos e capta leads enquanto você foca no serviço.
              </p>
              
              <div className="space-y-4">
                {[
                  { title: "Atendimento Instantâneo", desc: "Respostas em milissegundos, 24 horas por dia.", icon: Clock },
                  { title: "Visão Computacional", desc: "Analisa fotos de orçamentos e peças via IA.", icon: BrainCircuit },
                  { title: "Conversão em Venda", desc: "Leva o cliente do 'Oi' ao orçamento aprovado.", icon: TrendingUp }
                ].map((item, i) => (
                  <div key={i} className="flex gap-4 p-4 rounded-2xl bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-700">
                    <div className="w-12 h-12 rounded-xl bg-white dark:bg-gray-800 shadow-sm flex items-center justify-center shrink-0">
                      <item.icon className="w-6 h-6 text-emerald-600" />
                    </div>
                    <div>
                      <h4 className="font-bold text-gray-900 dark:text-white">{item.title}</h4>
                      <p className="text-sm text-gray-600 dark:text-gray-400">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
            
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, rotate: 2 }}
              whileInView={{ opacity: 1, scale: 1, rotate: 0 }}
              viewport={{ once: true }}
              className="lg:w-1/2 relative"
            >
              {/* WhatsApp UI Mockup */}
              <div className="bg-emerald-600 rounded-[3rem] p-3 shadow-2xl relative z-10">
                <div className="bg-[#E5DDD5] dark:bg-gray-950 rounded-[2.5rem] h-[600px] overflow-hidden flex flex-col relative font-sans">
                  {/* Header */}
                  <div className="bg-[#075E54] p-4 flex items-center gap-3 text-white">
                    <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center font-bold">SH</div>
                    <div>
                      <div className="font-bold text-sm">Service Hub Agent</div>
                      <div className="text-[10px] opacity-80 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse"></span> online
                      </div>
                    </div>
                  </div>
                  
                  {/* Messages */}
                  <div className="flex-1 p-4 space-y-4 overflow-y-auto">
                    <div className="bg-white dark:bg-gray-800 p-3 rounded-2xl rounded-tl-none text-sm max-w-[80%] shadow-sm">
                      <p className="text-gray-900 dark:text-white">Olá! Como posso ajudar sua oficina hoje?</p>
                      <span className="text-[10px] text-gray-500 block text-right mt-1">10:15</span>
                    </div>
                    
                    <div className="bg-[#DCF8C6] dark:bg-emerald-900/40 p-3 rounded-2xl rounded-tr-none text-sm max-w-[80%] ml-auto shadow-sm">
                      <p className="text-gray-900 dark:text-white">Preciso de um orçamento de kit embreagem pro Corolla 2015.</p>
                      <span className="text-[10px] text-emerald-700 dark:text-emerald-300 block text-right mt-1">10:16</span>
                    </div>

                    <div className="bg-white dark:bg-gray-800 p-3 rounded-2xl rounded-tl-none text-sm max-w-[80%] shadow-sm border-l-4 border-emerald-500">
                      <p className="text-gray-900 dark:text-white font-bold mb-1">Analisando estoque...</p>
                      <p className="text-gray-900 dark:text-white italic">"Identificamos 3 opções. A melhor custo-benefício é LUK (R$ 850,00). Deseja ver o orçamento completo?"</p>
                      <span className="text-[10px] text-gray-500 block text-right mt-1">10:16</span>
                    </div>
                  </div>
                  
                  {/* Input area */}
                  <div className="p-3 bg-white/50 dark:bg-gray-900/50 backdrop-blur-sm flex gap-2 items-center">
                    <div className="flex-1 bg-white dark:bg-gray-800 rounded-full py-2 px-4 text-xs text-gray-400">Escreva uma mensagem...</div>
                    <div className="w-10 h-10 rounded-full bg-emerald-600 flex items-center justify-center text-white">
                      <MessageSquare className="w-5 h-5" />
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Decorative elements */}
              <div className="absolute -top-10 -right-10 w-40 h-40 bg-emerald-500/10 rounded-full blur-3xl -z-10"></div>
              <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-indigo-500/10 rounded-full blur-3xl -z-10"></div>
            </motion.div>
          </div>
        </div>
      </div>

      {/* Segments Section */}
      <div className="py-24 bg-gray-50 dark:bg-gray-800/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-sm font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-widest mb-4">Multi-Segmento</h2>
            <h3 className="text-3xl sm:text-4xl font-black text-gray-900 dark:text-white mb-12">Um Hub único para todo seu negócio</h3>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              {[
                { name: "Mecânica", icon: Wrench, color: "indigo" },
                { name: "Som & Acessórios", icon: MessageSquare, color: "emerald" }, // Using MessageSquare as placeholder for Som
                { name: "Lava-Jato / Estética", icon: ShieldCheck, color: "amber" },
                { name: "Auto Elétrica", icon: Zap, color: "purple" }
              ].map((segment, i) => (
                <motion.div
                  key={i}
                  whileHover={{ y: -5 }}
                  className="bg-white dark:bg-gray-800 p-8 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm hover:shadow-xl transition-all group"
                >
                  <div className={`w-14 h-14 rounded-2xl bg-${segment.color}-100 dark:bg-${segment.color}-900/30 flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform`}>
                    <segment.icon className={`w-7 h-7 text-${segment.color}-600 dark:text-${segment.color}-400`} />
                  </div>
                  <span className="font-bold text-gray-900 dark:text-white">{segment.name}</span>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>

      {/* Bento Grid Features */}
      <div id="recursos" className="py-32 bg-white dark:bg-gray-900 relative">
        <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-gray-200 dark:via-gray-800 to-transparent"></div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <motion.h2 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-indigo-600 dark:text-indigo-400 font-bold tracking-wider uppercase text-sm mb-3"
            >
              Recursos Premium
            </motion.h2>
            <motion.h3 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              className="text-3xl font-bold text-gray-900 dark:text-white sm:text-5xl"
            >
              Tudo o que sua oficina precisa <br className="hidden sm:block" /> em um só lugar
            </motion.h3>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Feature 1: AI Pricing */}
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              whileHover={{ y: -5 }}
              className="md:col-span-2 md:row-span-1 bg-gradient-to-br from-indigo-500 to-indigo-700 rounded-3xl p-8 text-white relative overflow-hidden group shadow-lg shadow-indigo-200 dark:shadow-none"
            >
              <div className="relative z-10 h-full flex flex-col justify-between">
                <div>
                  <div className="bg-white/20 w-10 h-10 rounded-lg flex items-center justify-center mb-4">
                    <BrainCircuit className="h-6 w-6" />
                  </div>
                  <h4 className="text-2xl font-bold mb-2">Consultoria Digital IA</h4>
                  <p className="text-indigo-100 max-w-md">
                    Nossa IA multimodal não apenas atende clientes, ela analisa a **Saúde do seu Negócio**. Identifica gargalos financeiros e sugere planos de ação baseados em lucro real e LTV.
                  </p>
                </div>
                <div className="flex items-center text-sm font-bold">
                  Tecnologia de Ponta <Sparkles className="ml-2 h-4 w-4" />
                </div>
              </div>
              <div className="absolute -right-10 -bottom-10 opacity-20 group-hover:scale-110 transition-transform duration-500">
                <TrendingUp className="w-64 h-64" />
              </div>
            </motion.div>

            {/* Feature 2: WhatsApp */}
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              whileHover={{ y: -5 }}
              className="glass-card rounded-[3rem] p-8 border-white/10 group shadow-sm"
            >
              <div className="bg-purple-100 dark:bg-purple-800 w-10 h-10 rounded-lg flex items-center justify-center mb-4 group-hover:rotate-12 transition-transform">
                <LayoutGrid className="h-6 w-6 text-purple-600 dark:text-purple-400" />
              </div>
              <h4 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Multi-Segmento</h4>
              <p className="text-gray-600 dark:text-gray-400 text-sm">
                Uma interface fluida que se adapta ao seu negócio, seja você uma oficina, um lava-jato ou uma loja de acessórios.
              </p>
            </motion.div>

            {/* Feature 3: Supplier Catalog */}
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2 }}
              whileHover={{ y: -5 }}
              className="glass-card rounded-[3rem] p-8 border-white/10 group shadow-sm"
            >
                <div>
                  <div className="bg-gray-200 dark:bg-gray-700 w-10 h-10 rounded-lg flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                    <Package className="h-6 w-6 text-gray-600 dark:text-gray-400" />
                  </div>
                  <h4 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Reposição Inteligente</h4>
                  <p className="text-gray-600 dark:text-gray-400 text-sm">
                    Nunca mais perca vendas por falta de peças. Nossa IA prevê a demanda e sugere compras baseadas na sua **Curva ABC** de estoque.
                  </p>
                </div>
            </motion.div>

            {/* Feature 4: Financial Control */}
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: 0.3 }}
              whileHover={{ y: -5 }}
              className="md:col-span-2 glass-card bg-indigo-950/40 rounded-[3rem] p-10 text-white relative overflow-hidden group shadow-xl border-white/10 flex flex-col justify-center min-h-[300px]"
            >
              <div className="relative z-10 h-full flex flex-col justify-between">
                <div>
                  <div className="bg-white/10 w-10 h-10 rounded-lg flex items-center justify-center mb-4">
                    <BarChart3 className="h-6 w-6" />
                  </div>
                  <h4 className="text-2xl font-bold mb-2">BI & Radar de Fornecedores</h4>
                  <p className="text-slate-400 max-w-md">
                    Analise o seu LTV e a performance da equipe com métricas de elite. Além disso, o **Radar Integrado** conecta você aos melhores preços de fornecedores reais em segundos.
                  </p>
                </div>
                <div className="flex flex-wrap gap-4">
                  <div className="bg-white/5 px-4 py-2 rounded-full text-xs font-medium border border-white/10">Contas a Pagar</div>
                  <div className="bg-white/5 px-4 py-2 rounded-full text-xs font-medium border border-white/10">Contas a Receber</div>
                  <div className="bg-white/5 px-4 py-2 rounded-full text-xs font-medium border border-white/10">DRE Automático</div>
                </div>
              </div>
              <div className="absolute right-0 bottom-0 p-8 opacity-10 group-hover:rotate-6 transition-transform">
                <BarChart3 className="w-48 h-48" />
              </div>
            </motion.div>
          </div>
        </div>
      </div>

      {/* Why Choose Us Section */}
      <div id="vantagens" className="py-32 bg-gray-50 dark:bg-gray-800/50 relative overflow-hidden">
        <div className="absolute -top-24 -right-24 w-96 h-96 bg-indigo-500/5 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-purple-500/5 rounded-full blur-3xl"></div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="lg:grid lg:grid-cols-2 lg:gap-24 items-center">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
            >
              <h2 className="text-indigo-600 dark:text-indigo-400 font-bold tracking-wider uppercase text-sm mb-3">Vantagens Exclusivas</h2>
              <h3 className="text-3xl font-bold text-gray-900 dark:text-white sm:text-4xl mb-6">
                Por que as melhores oficinas usam o Service Hub?
              </h3>
              <p className="text-lg text-gray-600 dark:text-gray-400 mb-10">
                Não somos apenas um ERP. Somos o parceiro tecnológico que ajuda sua oficina a crescer, reduzir desperdícios e encantar clientes.
              </p>
              
              <div className="space-y-6">
                {[
                  {
                    title: "Redução de 40% no tempo de orçamento",
                    desc: "Com nossa busca inteligente e IA, você monta orçamentos complexos em minutos, não horas.",
                    icon: Clock
                  },
                  {
                    title: "Zero erro na compra de peças",
                    desc: "Integração direta com fornecedores garante que você receba exatamente o que pediu.",
                    icon: ShieldCheck
                  },
                  {
                    title: "Aumento de 25% no Ticket Médio",
                    desc: "Apresentação profissional de orçamentos via PDF e WhatsApp aumenta a taxa de aprovação.",
                    icon: TrendingUp
                  }
                ].map((item, i) => (
                  <motion.div 
                    key={i} 
                    initial={{ opacity: 0, y: 10 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.1 }}
                    className="flex gap-4"
                  >
                    <div className="flex-shrink-0 w-10 h-10 bg-white dark:bg-gray-800 rounded-full shadow-sm flex items-center justify-center border border-gray-100 dark:border-gray-700">
                      <item.icon className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                    </div>
                    <div>
                      <h4 className="font-bold text-gray-900 dark:text-white">{item.title}</h4>
                      <p className="text-sm text-gray-600 dark:text-gray-400">{item.desc}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
            
            <motion.div 
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="mt-16 lg:mt-0 relative"
            >
              <div className="bg-indigo-600 rounded-3xl p-1 overflow-hidden shadow-2xl rotate-2">
                <div className="bg-white dark:bg-gray-900 rounded-[22px] p-6">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 bg-indigo-100 rounded-full"></div>
                      <div className="h-4 w-24 bg-gray-100 rounded"></div>
                    </div>
                    <div className="h-6 w-16 bg-green-100 text-green-700 text-[10px] font-bold flex items-center justify-center rounded">APROVADO</div>
                  </div>
                  <div className="space-y-3">
                    <div className="h-10 w-full bg-gray-50 rounded"></div>
                    <div className="h-10 w-full bg-gray-50 rounded"></div>
                    <div className="h-10 w-full bg-gray-50 rounded"></div>
                    <div className="pt-4 flex justify-between">
                      <div className="h-6 w-20 bg-gray-100 rounded"></div>
                      <div className="h-6 w-24 bg-indigo-600 rounded"></div>
                    </div>
                  </div>
                </div>
              </div>
              <motion.div 
                initial={{ scale: 0.8, opacity: 0 }}
                whileInView={{ scale: 1, opacity: 1 }}
                viewport={{ once: true }}
                transition={{ delay: 0.5 }}
                className="absolute -bottom-6 -left-6 bg-white dark:bg-gray-800 p-4 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700 -rotate-3 max-w-[200px]"
              >
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                  <span className="text-[10px] font-bold text-gray-500">LUCRO REAL</span>
                </div>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">R$ 1.240,00</p>
                <p className="text-[10px] text-green-600 font-bold">+15% vs mês anterior</p>
              </motion.div>
            </motion.div>
          </div>
        </div>
      </div>

      {/* Advantages for Suppliers Section */}
      <div id="fornecedores" className="py-32 bg-gray-900 border-y border-white/10 overflow-hidden relative">
        <div className="absolute top-0 left-0 w-full h-full opacity-20 pointer-events-none">
          <div className="absolute top-[10%] left-[10%] w-[500px] h-[500px] rounded-full bg-indigo-600 blur-[150px] animate-pulse"></div>
          <div className="absolute bottom-[10%] right-[10%] w-[400px] h-[400px] rounded-full bg-purple-600 blur-[150px]"></div>
          <div className="mesh-bg opacity-30"></div>
        </div>
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="text-center mb-20">
            <h2 className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[10px] font-black text-emerald-400 uppercase tracking-[0.3em] mb-6">
              <Package className="w-4 h-4" /> Radar de Fornecedores B2B
            </h2>
            <h3 className="text-4xl sm:text-6xl font-black text-white tracking-tight mb-6">
              O seu estoque na tela <br /> de milhares de oficinas
            </h3>
            <p className="text-xl text-gray-400 max-w-3xl mx-auto font-medium">
              Esqueça o telemarketing e os representantes de vendas caros. Conecte seu sistema ao Service Hub e receba ordens de compra automáticas de oficinas reais.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Bento 1: Access */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="md:col-span-2 bg-indigo-950/40 rounded-[3rem] p-10 border border-indigo-500/20 shadow-2xl relative overflow-hidden group"
            >
              <div className="absolute top-0 right-0 p-10 opacity-30 group-hover:scale-110 transition-transform duration-500">
                <Users className="w-40 h-40 text-indigo-500" />
              </div>
              <div className="relative z-10 w-full md:w-2/3">
                <div className="w-14 h-14 bg-indigo-500/20 rounded-2xl flex items-center justify-center border border-indigo-500/30 mb-6">
                  <TrendingUp className="w-8 h-8 text-indigo-400" />
                </div>
                <h4 className="text-3xl font-black text-white mb-4">Acesso Direto ao Comprador</h4>
                <p className="text-indigo-200 text-lg leading-relaxed mb-8">
                  Quando uma oficina cria uma Ordem de Serviço, a nossa Inteligência Artificial já pesquisa no seu catálogo as peças necessárias e sugere a compra direta com um clique.
                </p>
                <div className="flex gap-4">
                  <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-xl p-4 flex-1">
                    <span className="block text-3xl font-black text-white">+5K</span>
                    <span className="text-[10px] uppercase tracking-widest text-gray-400 font-bold">Oficinas Ativas</span>
                  </div>
                  <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-xl p-4 flex-1">
                    <span className="block text-3xl font-black text-emerald-400">100%</span>
                    <span className="text-[10px] uppercase tracking-widest text-gray-400 font-bold">Conversão Direta</span>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Bento 2: Taxa Justa */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              className="bg-gray-800/40 rounded-[3rem] p-10 border border-white/5 shadow-xl flex flex-col justify-between group hover:border-emerald-500/30 transition-colors"
            >
              <div>
                <div className="inline-flex py-1 px-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-lg text-xs font-black uppercase tracking-widest mb-6">
                  SEM MENSALIDADE
                </div>
                <h4 className="text-2xl font-black text-white mb-4">Apenas 3% na Venda</h4>
                <p className="text-gray-400 leading-relaxed text-sm">
                  Diferente dos marketplaces abertos que cobram 16% a 20%, nós cobramos uma taxa justa e simbólica apenas sobre o que você de fato receber em caixa. Zero custo de setup.
                </p>
              </div>
              <div className="mt-8 text-center pt-8 border-t border-white/10">
                <span className="text-6xl font-black text-white tracking-tighter">3<span className="text-3xl text-emerald-400">%</span></span>
              </div>
            </motion.div>

            {/* Bento 3: Automação Financeira */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2 }}
              className="bg-gray-800/40 rounded-[3rem] p-10 border border-white/5 shadow-xl flex flex-col justify-between"
            >
              <div>
                <div className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center border border-white/10 mb-6">
                  <ShieldCheck className="w-6 h-6 text-gray-300" />
                </div>
                <h4 className="text-xl font-black text-white mb-3">Recebimento Garantido</h4>
                <p className="text-gray-400 text-sm leading-relaxed mb-6">
                  O painel do Service Hub exige que a oficina pague antes de emitir a Ordem de Separação para você. Risco zero de inadimplência no B2B.
                </p>
              </div>
              <div className="p-4 bg-emerald-500/10 rounded-2xl border border-emerald-500/20 flex items-center gap-3">
                <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse shadow-[0_0_10px_#34d399]"></div>
                <span className="text-xs font-bold text-emerald-400">Pagamento Autorizado</span>
              </div>
            </motion.div>

            {/* Bento 4: Integração Rápida CTA */}
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: 0.3 }}
              className="md:col-span-2 bg-gradient-to-r from-emerald-500 to-teal-600 rounded-[3rem] p-10 shadow-2xl relative overflow-hidden flex flex-col md:flex-row items-center justify-between group"
            >
              <div className="relative z-10 w-full md:w-2/3 mb-8 md:mb-0">
                <h4 className="text-3xl font-black text-white mb-2">Pronto para dominar as oficinas?</h4>
                <p className="text-emerald-100 text-lg">Crie seu catálogo e comece a receber pedidos hoje mesmo.</p>
              </div>
              <Link to="/signup?role=fornecedor" className="relative z-10 bg-white text-emerald-700 hover:bg-gray-100 border-4 border-emerald-400/30 px-8 py-5 rounded-full text-lg font-black transition-all hover:-translate-y-1 shadow-2xl w-full md:w-auto text-center whitespace-nowrap">
                Fazer Cadastro Completo
              </Link>
            </motion.div>
          </div>
        </div>
      </div>

      {/* Dashboard Intelligence Showcase */}
      <div className="py-32 bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-20">
            <h2 className="text-sm font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-[0.3em] mb-4">Tecnologia Proprietária</h2>
            <h3 className="text-4xl sm:text-6xl font-black text-gray-900 dark:text-white tracking-tight mb-6">
              O "Painel de Comando" da <br /> sua Oficina
            </h3>
            <p className="text-lg text-gray-600 dark:text-gray-400 max-w-3xl mx-auto font-medium">
              Não se perca em números. Nossa IA analisa tudo silenciosamente e te entrega apenas o que você precisa para crescer.
            </p>
          </div>

          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <motion.div 
              initial={{ opacity: 0, x: -50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="space-y-12"
            >
              <div className="group">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-900/40 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shadow-sm border border-indigo-100 dark:border-indigo-800 group-hover:bg-indigo-600 group-hover:text-white transition-all">
                    <Activity className="w-6 h-6" />
                  </div>
                  <h4 className="text-2xl font-black text-gray-900 dark:text-white uppercase tracking-tighter">Saúde IA em Tempo Real</h4>
                </div>
                <p className="text-gray-600 dark:text-gray-400 text-lg leading-relaxed pl-16">
                  Um score dinâmico que avalia faturamento, despesas e eficiência operacional. Saiba instantaneamente se sua oficina está saudável.
                </p>
              </div>

              <div className="group">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-12 h-12 rounded-2xl bg-purple-50 dark:bg-purple-900/40 flex items-center justify-center text-purple-600 dark:text-purple-400 shadow-sm border border-purple-100 dark:border-purple-800 group-hover:bg-purple-600 group-hover:text-white transition-all">
                    <Brain className="w-6 h-6" />
                  </div>
                  <h4 className="text-2xl font-black text-gray-900 dark:text-white uppercase tracking-tighter">Insights Preditivos</h4>
                </div>
                <p className="text-gray-600 dark:text-gray-400 text-lg leading-relaxed pl-16">
                  Nossa IA identifica clientes em risco de churn, avisa sobre estoque baixo de peças críticas e sugere revisões preventivas.
                </p>
              </div>
            </motion.div>

            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 30 }}
              whileInView={{ opacity: 1, scale: 1, y: 0 }}
              viewport={{ once: true }}
              className="relative p-8 bg-gray-50 dark:bg-gray-800/50 rounded-[3rem] border border-gray-100 dark:border-gray-700 shadow-2xl overflow-hidden"
            >
              <div className="absolute top-0 right-0 p-8 scale-75 opacity-20 pointer-events-none">
                <BrainCircuit className="w-64 h-64 text-indigo-500" />
              </div>
              
              {/* Mockup of Health Score Card */}
              <div className="bg-white dark:bg-gray-900 p-8 rounded-[2rem] shadow-xl border border-gray-100 dark:border-gray-800 mb-8 max-w-sm ml-auto">
                <div className="flex items-center gap-2 mb-6">
                  <div className="w-2 h-2 bg-indigo-500 rounded-full animate-pulse"></div>
                  <span className="text-[10px] font-black text-indigo-500 uppercase tracking-widest">Saúde IA Ativa</span>
                </div>
                <div className="flex justify-between items-end">
                  <div>
                    <span className="text-5xl font-black text-gray-900 dark:text-white tracking-tighter">89%</span>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">Eficiência Ótima</p>
                  </div>
                  <div className="flex -space-x-2">
                    <div className="w-8 h-8 rounded-full bg-indigo-100 border-2 border-white dark:border-gray-900"></div>
                    <div className="w-8 h-8 rounded-full bg-purple-100 border-2 border-white dark:border-gray-900"></div>
                  </div>
                </div>
              </div>

              {/* Mockup of Insight Alert */}
              <div className="bg-indigo-600 p-6 rounded-[2rem] shadow-xl text-white max-w-sm relative">
                <div className="flex items-center gap-3 mb-2">
                  <Sparkles className="h-4 w-4" />
                  <span className="text-[10px] font-black uppercase tracking-[0.2em]">IA Sugere:</span>
                </div>
                <p className="text-sm font-bold leading-snug">"O faturamento deste mês está 15% acima da média. Considere investir R$ 2k em estoque de óleo original."</p>
              </div>
            </motion.div>
          </div>
        </div>
      </div>

      {/* Pricing Section */}
      <div id="precos" className="py-40 bg-gray-50 dark:bg-gray-900/50 relative overflow-hidden">
        {/* Background Blobs */}
        <div className="absolute top-1/2 left-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-[120px] -z-10"></div>
        <div className="absolute bottom-1/2 right-0 w-96 h-96 bg-purple-500/10 rounded-full blur-[120px] -z-10"></div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-24">
            <h2 className="text-sm font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-[0.4em] mb-4">Investimento & ROI</h2>
            <h3 className="text-4xl sm:text-6xl font-black text-gray-900 dark:text-white tracking-tight mb-8">
              Custa muito mais caro <br /> ficar de fora.
            </h3>
            <div className="inline-block bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-100 dark:border-indigo-800 rounded-full px-6 py-3 mb-8">
              <p className="text-sm font-bold text-indigo-700 dark:text-indigo-400">
                🚀 O plano <strong className="font-black text-indigo-900 dark:text-white">Hub Elite</strong> se paga no primeiro desconto de peça comprada no Radar Integrado.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-10 items-stretch">
            {/* Start Plan */}
            <motion.div 
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="glass-card p-12 rounded-[4rem] border-white/5 flex flex-col shadow-lg hover:shadow-2xl transition-all group"
            >
              <div className="mb-10 text-center">
                <span className="text-xs font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-4 block">Entrada Digital</span>
                <h3 className="text-3xl font-black text-gray-900 dark:text-white mb-6">Hub <span className="text-indigo-600">Start</span></h3>
                <div className="flex items-baseline justify-center">
                  <span className="text-5xl font-black text-gray-900 dark:text-white tracking-tighter">R$ 0</span>
                  <span className="text-gray-400 ml-2 font-bold">/mês</span>
                </div>
              </div>
              
              <div className="space-y-5 mb-12 flex-1">
                {[
                  "Até 10 Clientes Ativos",
                  "Até 10 OS mensais",
                  "Gestão de Fornecedores",
                  "❌ Sem PDF de Orçamentos",
                  "❌ Sem Histórico Veicular"
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-4 group/item">
                    <div className="w-5 h-5 rounded-full bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center border border-indigo-100 dark:border-indigo-800 group-hover/item:scale-110 transition-transform">
                      <Check className="h-3 w-3 text-indigo-600 dark:text-indigo-400" />
                    </div>
                    <span className="text-sm font-bold text-gray-600 dark:text-gray-300">{item}</span>
                  </div>
                ))}
              </div>
              <Link to="/signup?plan=start" className="w-full py-5 rounded-[2rem] bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-black text-lg hover:scale-[1.03] transition-all text-center">
                Começar agora
              </Link>
            </motion.div>

            {/* Pro Plan */}
            <motion.div 
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="bg-gradient-to-br from-indigo-500/80 to-indigo-800/80 backdrop-blur-3xl p-12 rounded-[4rem] flex flex-col shadow-2xl border border-indigo-500/30 group"
            >
              <div className="mb-10 text-center text-white">
                <span className="text-xs font-black text-indigo-300 uppercase tracking-widest mb-4 block">Dominando o Mercado</span>
                <h3 className="text-3xl font-black mb-6">Hub <span className="text-white">Pro</span></h3>
                <div className="flex items-baseline justify-center">
                  <span className="text-5xl font-black tracking-tighter">R$ 29,99</span>
                  <span className="text-indigo-300 ml-2 font-bold">/mês</span>
                </div>
              </div>
              <div className="space-y-5 mb-12 flex-1">
                {[
                  "Até 50 Clientes Ativos",
                  "Até 50 OS mensais",
                  "50 Downloads de Orçamentos/mês",
                  "Histórico Veicular Premium",
                  "Gestão Financeira Básica",
                  "Relatórios de Gestão Básicos"
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-4 group/item">
                    <div className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center group-hover/item:scale-110 transition-transform">
                      <Check className="h-3 w-3 text-white" />
                    </div>
                    <span className="text-sm font-black text-white">{item}</span>
                  </div>
                ))}
              </div>
              <Link to="/signup?plan=pro" className="w-full py-5 rounded-[2rem] bg-white text-indigo-700 font-black text-xl hover:scale-[1.05] transition-all text-center shadow-lg hover:shadow-white/20">
                Garantir meu Pro
              </Link>
            </motion.div>

            {/* Elite Plan */}
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              className="glass-card bg-indigo-950/60 p-12 rounded-[4rem] flex flex-col shadow-2xl relative transform md:scale-110 z-20 border-2 border-indigo-500/50"
            >
              <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-amber-500 text-white px-6 py-2 rounded-full text-[10px] font-black uppercase tracking-[0.3em] shadow-xl whitespace-nowrap animate-pulse">
                MELHOR ESCOLHA: INTELIGÊNCIA TOTAL
              </div>
              <div className="mb-10 text-center text-white">
                <span className="text-xs font-black text-slate-500 uppercase tracking-widest mb-4 block">Máxima Escalabilidade</span>
                <h3 className="text-3xl font-black mb-6">Hub <span className="text-indigo-400">Elite</span></h3>
                <div className="flex items-baseline justify-center">
                  <span className="text-5xl font-black tracking-tighter">R$ 79,99</span>
                  <span className="text-slate-500 ml-2 font-bold">/mês</span>
                </div>
              </div>
              <div className="space-y-5 mb-12 flex-1">
                {[
                  "Clientes & OS Ilimitados",
                  "Downloads PDF Ilimitados",
                  "Consultoria Digital IA 24/7",
                  "Agente WhatsApp IA 24/7",
                  "Gestão de Equipe (Multi-usuário)",
                  "Relatórios Operacionais & Full",
                  "Agenda Integrada ao WhatsApp",
                  "BI Avançado & Curva ABC",
                  "Radar de Fornecedores Integrado",
                  "Checklist Digital & Fotos",
                  "Suporte Prioritário VIP"
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-4 group/item">
                    <div className="w-5 h-5 rounded-full bg-slate-800 flex items-center justify-center border border-slate-700 group-hover/item:scale-110 transition-transform">
                      <Check className="h-3 w-3 text-indigo-400" />
                    </div>
                    <span className="text-sm font-black text-slate-300">{item}</span>
                  </div>
                ))}
              </div>
              <Link to="/signup?plan=elite" className="w-full py-5 rounded-[2rem] bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-black text-lg hover:scale-[1.03] transition-all text-center shadow-lg hover:shadow-indigo-500/50 flex items-center justify-center gap-2">
                Começar Acesso Elite Grátis <ArrowRight className="h-5 w-5" />
              </Link>
            </motion.div>
          </div>
        </div>
      </div>
      {/* Demo Modal */}
      <AnimatePresence>
        {showDemoModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl max-w-md w-full overflow-hidden"
            >
              <div className="flex justify-between items-center p-4 border-b border-gray-200 dark:border-gray-700">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Acessar Demonstração</h3>
                <button onClick={() => setShowDemoModal(false)} className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="p-6 space-y-4">
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  Escolha qual perfil você deseja testar. Os dados são fictícios e servem apenas para exemplificar o funcionamento do sistema.
                </p>
                <button
                  onClick={() => handleDemoLogin('shop')}
                  disabled={loadingDemo}
                  className="w-full flex items-center justify-between p-4 rounded-xl border-2 border-gray-200 dark:border-gray-700 hover:border-indigo-500 dark:hover:border-indigo-500 transition-colors group disabled:opacity-50"
                >
                  <div className="flex items-center gap-4">
                    <div className="bg-indigo-100 dark:bg-indigo-900/50 p-3 rounded-lg group-hover:bg-indigo-200 dark:group-hover:bg-indigo-800 transition-colors">
                      <Wrench className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
                    </div>
                    <div className="text-left">
                      <h4 className="font-bold text-gray-900 dark:text-white">Perfil Oficina</h4>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Gerencie OS, orçamentos e clientes</p>
                    </div>
                  </div>
                  {loadingDemo ? (
                    <div className="animate-spin h-5 w-5 border-2 border-indigo-500 border-t-transparent rounded-full"></div>
                  ) : (
                    <ArrowRight className="h-5 w-5 text-gray-400 group-hover:text-indigo-500 transition-colors" />
                  )}
                </button>
                
                <button
                  onClick={() => handleDemoLogin('supplier')}
                  disabled={loadingDemo}
                  className="w-full flex items-center justify-between p-4 rounded-xl border-2 border-gray-200 dark:border-gray-700 hover:border-indigo-500 dark:hover:border-indigo-500 transition-colors group disabled:opacity-50"
                >
                  <div className="flex items-center gap-4">
                    <div className="bg-indigo-100 dark:bg-indigo-900/50 p-3 rounded-lg group-hover:bg-indigo-200 dark:group-hover:bg-indigo-800 transition-colors">
                      <Package className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
                    </div>
                    <div className="text-left">
                      <h4 className="font-bold text-gray-900 dark:text-white">Perfil Fornecedor</h4>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Gerencie pedidos e catálogo de peças</p>
                    </div>
                  </div>
                  {loadingDemo ? (
                    <div className="animate-spin h-5 w-5 border-2 border-indigo-500 border-t-transparent rounded-full"></div>
                  ) : (
                    <ArrowRight className="h-5 w-5 text-gray-400 group-hover:text-indigo-500 transition-colors" />
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12 border-t border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-8">
            <div className="flex items-center">
              <Layers className="h-8 w-8 text-indigo-400" />
              <span className="ml-2 text-xl font-bold uppercase tracking-tighter">Service<span className="text-indigo-400">Hub</span></span>
            </div>
            <div className="flex gap-8 text-gray-400 text-sm">
              <a href="#" className="hover:text-white">Termos de Uso</a>
              <a href="#" className="hover:text-white">Privacidade</a>
              <a href="#" className="hover:text-white">Contato</a>
            </div>
            <div className="text-gray-500 text-sm">
              © 2026 Service Hub. Todos os direitos reservados.
            </div>
          </div>
        </div>
      </footer>

    </div>
  );
}
