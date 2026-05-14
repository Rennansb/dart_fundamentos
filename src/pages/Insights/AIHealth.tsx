import React, { useState, useEffect } from 'react';
import { 
  Brain, Sparkles, TrendingUp, AlertCircle, 
  Activity, ShieldCheck, Zap, RefreshCcw,
  ArrowRight, Info, Lock
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../../AuthContext';
import { db } from '../../firebase';
import { collection, query, where, getDocs, limit } from 'firebase/firestore';
import { analyzeBusinessHealth, checkAiAvailability } from '../../services/aiService';
import ReactMarkdown from 'react-markdown';

export default function AIHealth() {
  const { profile, user, selectedCompanyId } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [stats, setStats] = useState<any>(null);

  const fetchStats = async () => {
    const companyId = selectedCompanyId || profile?.companyId;
    if (!companyId) return;

    setLoading(true);
    try {
      // 1. Work Orders & Revenue
      let woSnap: any = { docs: [], size: 0 };
      try {
        woSnap = await getDocs(query(collection(db, 'work_orders'), where('companyId', '==', companyId), limit(100)));
      } catch (e) { console.warn("Access denied: work_orders"); }
      
      const revenue = woSnap.docs.reduce((acc: any, doc: any) => acc + (doc.data().total || 0), 0);
      
      // 2. Expenses
      let exSnap: any = { docs: [], size: 0 };
      try {
        exSnap = await getDocs(query(collection(db, 'expenses'), where('companyId', '==', companyId), limit(100)));
      } catch (e) { console.warn("Access denied: expenses"); }
      const expenses = exSnap.docs.reduce((acc: any, doc: any) => acc + (doc.data().amount || 0), 0);

      // 3. Inventory
      let invSnap: any = { docs: [], size: 0 };
      try {
        invSnap = await getDocs(query(collection(db, 'inventory'), where('companyId', '==', companyId), limit(500)));
      } catch (e) { console.warn("Access denied: inventory"); }
      
      const inventoryValue = invSnap.docs.reduce((acc: any, doc: any) => {
        const data = doc.data();
        return acc + ((data.costPrice || 0) * (data.quantity || 0));
      }, 0);
      const lowStockCount = invSnap.docs.filter((doc: any) => {
        const data = doc.data();
        return (data.quantity || 0) <= (data.minQuantity || 5);
      }).length;

      // 4. Budgets
      let budgetSnap: any = { docs: [], size: 0 };
      try {
        budgetSnap = await getDocs(query(collection(db, 'budgets'), where('companyId', '==', companyId), limit(50)));
      } catch (e) { console.warn("Access denied: budgets"); }
      const budgets = budgetSnap.docs.map((d: any) => d.data());
      
      // 5. Customers
      let totalCustomers = 0;
      try {
        const customerSnap = await getDocs(query(collection(db, 'customers'), where('companyId', '==', companyId), limit(500)));
        totalCustomers = customerSnap.size;
      } catch (e) { console.warn("Access denied: customers"); }

      // 6. Appointments
      let appointments = [];
      try {
        const appSnap = await getDocs(query(collection(db, 'appointments'), where('companyId', '==', companyId), limit(500)));
        appointments = appSnap.docs.map((d: any) => d.data());
      } catch (e) { console.warn("Access denied: appointments"); }

      // Identify top selling parts/services
      const itemsMap: Record<string, number> = {};
      woSnap.docs.forEach((doc: any) => {
        (doc.data().services || []).forEach((s: any) => {
          if (s.name) {
            itemsMap[s.name] = (itemsMap[s.name] || 0) + (Number(s.quantity) || 1);
          }
        });
      });
      const topItems = Object.entries(itemsMap)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([name, qty]) => ({ name, qty }));

      const businessData = {
        totalRevenue: revenue,
        totalExpenses: expenses,
        profitMargin: revenue > 0 ? ((revenue - expenses) / revenue) * 100 : 0,
        inventoryValue,
        lowStockItems: lowStockCount,
        activeWorkOrders: woSnap.docs.filter((d: any) => d.data().status !== 'completed' && d.data().status !== 'delivered').length,
        completedWorkOrders: woSnap.docs.filter((d: any) => d.data().status === 'completed' || d.data().status === 'delivered').length,
        totalCustomers,
        pendingBudgets: budgets.filter((b: any) => b.status === 'pending').length,
        totalBudgetsValue: budgets.reduce((acc: any, b: any) => acc + (b.total || 0), 0),
        upcomingAppointments: appointments.filter((a: any) => {
          try {
            const date = a.date?.toDate?.() || new Date(a.date);
            return date > new Date();
          } catch { return false; }
        }).length,
        topItems
      };

      setStats(businessData);

      // Guard: Check if we have enough data (Revenue and WO count are major)
      if (revenue === 0 && woSnap.size === 0 && budgetSnap.size === 0) {
        setAnalysis("📊 **Dados insuficientes para análise estratégica.** \n\nPara gerar um relatório mais preciso, comece cadastrando suas primeiras Ordens de Serviço, Estoque e Orçamentos. A IA precisa de um histórico real de movimentação financeira para identificar tendências, gargalos e oportunidades de lucro.");
        return;
      }
      
      const aiResponse = await analyzeBusinessHealth(businessData, user?.uid || '', companyId);
      setAnalysis(aiResponse);
    } catch (error: any) {
       console.error("AI Health Full Error Object:", error);
       setAnalysis(`🙏 **Ops! Algo deu errado ao processar seus dados.** \n\nErro: ${error.message || 'Falha na comunicação com o servidor'}. \n\nIsso pode acontecer por falta de dados básicos ou permissões de acesso. Tente atualizar a página.`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, [profile, selectedCompanyId]);

  const currentPlan = profile?.plan || 'free';
  const isElite = currentPlan === 'elite';

  if (!isElite) {
    return (
      <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-8 flex flex-col items-center justify-center min-h-[60vh] text-center animate-in fade-in duration-700">
        <div className="bg-gradient-to-br from-indigo-900 via-indigo-800 to-purple-900 rounded-[3rem] p-8 md:p-12 max-w-2xl w-full text-white shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-10">
            <Brain className="w-48 h-48" />
          </div>
          <div className="relative z-10 flex flex-col items-center">
            <div className="w-24 h-24 bg-white/10 rounded-full flex items-center justify-center mb-6 border border-white/20 backdrop-blur-sm">
              <Lock className="w-12 h-12 text-indigo-300" />
            </div>
            <h2 className="text-3xl font-black mb-4">Consultoria de IA Exclusiva</h2>
            <p className="text-indigo-200 mb-8 max-w-md mx-auto text-lg leading-relaxed">
              Descubra para onde está indo o dinheiro do seu negócio. A **Saúde do Negócio IA** cruza todos seus dados e revela estratégias exatas para faturar mais. Recurso exclusivo do plano Elite.
            </p>
            <button
              onClick={() => navigate('/app/subscription')}
              className="px-8 py-4 bg-gradient-to-r from-amber-400 to-orange-500 text-white rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-orange-500/30 hover:scale-105 transition-all w-full md:w-auto flex items-center justify-center gap-3"
            >
              <Sparkles className="w-5 h-5" />
              Desbloquear Elite
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-xl">
              <Sparkles className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
            </div>
            <h1 className="text-3xl font-black text-gray-900 dark:text-white tracking-tight">Saúde do Negócio IA</h1>
          </div>
          <p className="text-gray-500 dark:text-gray-400 font-medium">Análise estratégica em tempo real impulsionada por Inteligência Artificial.</p>
        </div>
        
        <button 
          onClick={fetchStats}
          disabled={loading}
          className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-2xl font-bold shadow-xl shadow-indigo-500/20 hover:scale-105 active:scale-95 transition-all disabled:opacity-50"
        >
          {loading ? <RefreshCcw className="w-5 h-5 animate-spin" /> : <Zap className="w-5 h-5" />}
          Atualizar Diagnóstico
        </button>
      </div>

      {loading ? (
        <div className="py-20 text-center space-y-4">
           <div className="relative w-24 h-24 mx-auto">
             <div className="absolute inset-0 rounded-full border-4 border-indigo-100 dark:border-indigo-900/30 border-t-indigo-600 animate-spin" />
             <Brain className="absolute inset-0 m-auto w-10 h-10 text-indigo-600 animate-pulse" />
           </div>
           <h3 className="text-xl font-black text-gray-900 dark:text-white">O Agente está analisando seus dados...</h3>
           <p className="text-gray-400 text-sm">Avaliando faturamento, estoque e fluxo operacional.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
          
          {/* Quick Metrics Overlay */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
             <div className="bg-white dark:bg-gray-800 p-6 rounded-[2rem] border border-gray-100 dark:border-gray-700 shadow-sm">
               <div className="flex items-center gap-3 mb-4">
                 <div className="p-2 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl text-emerald-600">
                   <Activity className="w-5 h-5" />
                 </div>
                 <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Margem de Lucro</span>
               </div>
               <div className="text-3xl font-black text-gray-900 dark:text-white">
                 {stats?.profitMargin.toFixed(1)}%
               </div>
             </div>

             <div className="bg-white dark:bg-gray-800 p-6 rounded-[2rem] border border-gray-100 dark:border-gray-700 shadow-sm">
               <div className="flex items-center gap-3 mb-4">
                 <div className="p-2 bg-amber-50 dark:bg-amber-900/20 rounded-xl text-amber-600">
                   <AlertCircle className="w-5 h-5" />
                 </div>
                 <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Stock Alert</span>
               </div>
               <div className="text-3xl font-black text-gray-900 dark:text-white">
                 {stats?.lowStockItems} <span className="text-sm font-medium text-gray-400">itens</span>
               </div>
             </div>

             <div className="bg-white dark:bg-gray-800 p-6 rounded-[2rem] border border-gray-100 dark:border-gray-700 shadow-sm">
               <div className="flex items-center gap-3 mb-4">
                 <div className="p-2 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl text-indigo-600">
                   <ShieldCheck className="w-5 h-5" />
                 </div>
                 <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Score IA</span>
               </div>
               <div className="text-3xl font-black text-gray-900 dark:text-white">
                 {stats?.profitMargin > 20 ? 'Excelente' : 'Bom'}
               </div>
             </div>
          </div>

          {/* AI Report */}
          <div className="bg-gradient-to-br from-indigo-600 to-indigo-800 rounded-[3rem] p-1 shadow-2xl overflow-hidden">
            <div className="bg-white dark:bg-gray-900 rounded-[2.8rem] p-8 md:p-12 h-full">
              <div className="flex items-center gap-3 mb-10">
                 <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-indigo-500/30">
                   <Brain className="w-7 h-7" />
                 </div>
                 <div>
                   <h2 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">Relatório de Consultoria Digital</h2>
                   <p className="text-xs font-bold text-indigo-600 uppercase tracking-widest">Gerado em {new Date().toLocaleDateString()}</p>
                 </div>
              </div>

              <div className="prose dark:prose-invert prose-indigo max-w-none prose-headings:font-black prose-headings:tracking-tight prose-p:text-gray-600 dark:prose-p:text-gray-400 prose-p:leading-relaxed prose-li:text-gray-600 dark:prose-li:text-gray-400">
                {analysis ? (
                   <ReactMarkdown>{analysis}</ReactMarkdown>
                ) : (
                  <p>Iniciando processamento estratégico...</p>
                )}
              </div>

              <div className="mt-12 pt-8 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-bold text-gray-400">
                  <Info className="w-4 h-4" />
                  Baseado no Agente de Inteligência Estratégica do Service Hub
                </div>
                <button className="text-indigo-600 font-black text-xs uppercase tracking-widest flex items-center gap-2 hover:gap-3 transition-all">
                  Gerar Plano de Ação em PDF <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
