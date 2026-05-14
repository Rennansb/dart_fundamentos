import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { 
  Target, 
  TrendingUp, 
  Calendar, 
  DollarSign, 
  ArrowLeft, 
  Save, 
  Info,
  ChevronRight,
  Zap,
  Clock,
  CheckCircle2
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { db } from '../firebase';
import { collection, query, where, onSnapshot, doc, updateDoc, serverTimestamp, limit } from 'firebase/firestore';
import { startOfMonth, endOfMonth, differenceInDays, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer 
} from 'recharts';

export default function MonthlyGoal() {
  const { profile, effectiveProfile, selectedCompanyId } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [goalValue, setGoalValue] = useState(profile?.monthlyGoal || 50000);
  const [isEditing, setIsEditing] = useState(false);
  const [workOrders, setWorkOrders] = useState<any[]>([]);

  useEffect(() => {
    const companyId = selectedCompanyId || profile?.companyId;
    if (!companyId) return;

    const q = query(
      collection(db, 'work_orders'),
      where('companyId', '==', companyId),
      limit(500)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate?.() || (doc.data().createdAt ? new Date(doc.data().createdAt) : new Date())
      }));
      setWorkOrders(data);
    });

    return () => unsubscribe();
  }, [profile, selectedCompanyId]);

  const stats = useMemo(() => {
    const now = new Date();
    const start = startOfMonth(now);
    const end = endOfMonth(now);
    const daysInMonth = differenceInDays(end, start) + 1;
    const dayOfMonth = now.getDate();

    const currentMonthRevenue = workOrders
      .filter(wo => wo.createdAt >= start && wo.createdAt <= end)
      .reduce((acc, wo) => acc + (wo.paidAmount || 0), 0);

    const currentMonthReceivable = workOrders
      .filter(wo => wo.createdAt >= start && wo.createdAt <= end)
      .reduce((acc, wo) => acc + (wo.remainingAmount || 0), 0);

    // Projections
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const last30DaysRevenue = workOrders
      .filter(wo => wo.createdAt >= thirtyDaysAgo)
      .reduce((acc, wo) => acc + (wo.paidAmount || 0), 0);
    const dailyAvg30d = last30DaysRevenue / 30;
    const projection30d = currentMonthRevenue + (dailyAvg30d * (daysInMonth - dayOfMonth));

    const allRevenue = workOrders.reduce((acc, wo) => acc + (wo.paidAmount || 0), 0);
    const firstWO = workOrders.reduce((min, wo) => wo.createdAt < min ? wo.createdAt : min, now);
    const totalDays = Math.max(differenceInDays(now, firstWO), 1);
    const dailyAvgAll = allRevenue / totalDays;
    const projectionAll = currentMonthRevenue + (dailyAvgAll * (daysInMonth - dayOfMonth));

    const progress = (currentMonthRevenue / goalValue) * 100;
    const remaining = Math.max(goalValue - currentMonthRevenue, 0);
    
    const daysToGoal30d = dailyAvg30d > 0 ? Math.ceil(remaining / dailyAvg30d) : Infinity;
    const daysToGoalAll = dailyAvgAll > 0 ? Math.ceil(remaining / dailyAvgAll) : Infinity;

    return {
      currentMonthRevenue,
      currentMonthReceivable,
      projection30d,
      projectionAll,
      progress,
      remaining,
      daysInMonth,
      dayOfMonth,
      daysToGoal30d,
      daysToGoalAll,
      dailyAvg30d,
      dailyAvgAll
    };
  }, [workOrders, goalValue]);

  const handleSaveGoal = async () => {
    setLoading(true);
    try {
      const companyId = profile?.uid || profile?.id;
      if (!companyId) return;

      await updateDoc(doc(db, 'users', companyId), {
        monthlyGoal: goalValue,
        updatedAt: serverTimestamp()
      });
      setIsEditing(false);
    } catch (error) {
      console.error("Error saving goal:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8 pb-12 animate-in fade-in duration-500">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate('/app')}
            className="p-3 bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 hover:bg-gray-50 transition-all shadow-sm"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          </button>
          <div>
            <h1 className="text-3xl font-black text-gray-900 dark:text-white tracking-tight uppercase">Meta Mensal</h1>
            <p className="text-sm text-gray-500 font-bold uppercase tracking-widest text-[10px]">Análise Preditiva de Faturamento</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {isEditing ? (
            <div className="flex items-center gap-2 bg-white dark:bg-gray-800 p-2 rounded-2xl border border-indigo-100 shadow-sm">
              <span className="text-xs font-black text-indigo-600 ml-2">R$</span>
              <input 
                type="number"
                value={goalValue}
                onChange={(e) => setGoalValue(Number(e.target.value))}
                className="w-32 bg-transparent outline-none font-black text-gray-900 dark:text-white px-2"
              />
              <button 
                onClick={handleSaveGoal}
                disabled={loading}
                className="bg-indigo-600 text-white p-2 rounded-xl hover:bg-indigo-700 transition-all font-bold text-xs"
              >
                {loading ? '...' : <Save className="w-4 h-4" />}
              </button>
            </div>
          ) : (
            <button 
              onClick={() => setIsEditing(true)}
              className="bg-indigo-600 text-white px-6 py-3 rounded-2xl hover:bg-indigo-700 transition-all font-black uppercase text-[10px] tracking-widest shadow-xl shadow-indigo-100 dark:shadow-none"
            >
              Ajustar Meta
            </button>
          )}
        </div>
      </header>

      <div className="relative overflow-hidden bg-gradient-to-br from-emerald-600 to-teal-700 rounded-[3rem] p-10 text-white shadow-2xl">
        <div className="absolute top-0 right-0 w-1/3 h-full opacity-10 pointer-events-none">
          <Target className="w-full h-full scale-150 rotate-12" />
        </div>
        
        <div className="relative z-10 flex flex-col md:flex-row items-center gap-10">
          <div className="relative h-48 w-48 shrink-0">
            <svg className="h-full w-full rotate-[-90deg]" viewBox="0 0 100 100">
              <circle className="text-white/20" strokeWidth="6" stroke="currentColor" fill="transparent" r="42" cx="50" cy="50" />
              <motion.circle
                className="text-white"
                strokeWidth="8"
                strokeDasharray={263.89}
                initial={{ strokeDashoffset: 263.89 }}
                animate={{ strokeDashoffset: 263.89 * (1 - Math.min(stats.progress, 100) / 100) }}
                transition={{ duration: 2, ease: "circOut" }}
                strokeLinecap="round"
                stroke="currentColor"
                fill="transparent"
                r="42"
                cx="50"
                cy="50"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-4xl font-black">{Math.round(stats.progress)}%</span>
              <span className="text-[8px] font-black uppercase tracking-[0.2em] opacity-80">Batido</span>
            </div>
          </div>

          <div className="flex-1 space-y-6 text-center md:text-left">
            <div>
              <h2 className="text-5xl font-black tracking-tight mb-2">R$ {stats.currentMonthRevenue.toLocaleString('pt-BR')}</h2>
              <p className="text-emerald-100/80 font-bold uppercase tracking-widest text-xs">Faturamento Realizado em {format(new Date(), 'MMMM', { locale: ptBR })}</p>
            </div>
            
            <div className="grid grid-cols-2 gap-4 max-w-sm">
              <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/20">
                <p className="text-[8px] font-black uppercase tracking-widest opacity-60 mb-1">Restante</p>
                <p className="text-lg font-black tracking-tight">R$ {stats.remaining.toLocaleString('pt-BR')}</p>
              </div>
              <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/20">
                <p className="text-[8px] font-black uppercase tracking-widest opacity-60 mb-1">Meta Total</p>
                <p className="text-lg font-black tracking-tight">R$ {goalValue.toLocaleString('pt-BR')}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <motion.div
              whileHover={{ y: -5 }}
              className="bg-white dark:bg-gray-800 p-8 rounded-[2.5rem] border border-gray-100 dark:border-gray-700 shadow-sm space-y-6"
            >
              <div className="flex items-center justify-between">
                <div className="p-3 bg-indigo-50 dark:bg-indigo-900/30 rounded-2xl text-indigo-600">
                  <TrendingUp className="w-6 h-6" />
                </div>
                <div className="text-right">
                  <span className="text-[9px] font-black bg-indigo-100 text-indigo-700 px-3 py-1 rounded-full uppercase tracking-widest">Base 30 Dias</span>
                </div>
              </div>
              <div>
                <h3 className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">Projeção Final de Mês</h3>
                <div className="text-3xl font-black text-gray-900 dark:text-white tracking-tight">
                  R$ {stats.projection30d.toLocaleString('pt-BR')}
                </div>
                <div className="mt-4 flex items-center gap-2 text-xs font-bold text-gray-500">
                  <Clock className="w-4 h-4 text-indigo-500" />
                  Tempo p/ meta: <span className="text-indigo-600">{stats.daysToGoal30d === Infinity ? 'N/A' : `${stats.daysToGoal30d} dias`}</span>
                </div>
              </div>
            </motion.div>

            <motion.div
              whileHover={{ y: -5 }}
              className="bg-white dark:bg-gray-800 p-8 rounded-[2.5rem] border border-gray-100 dark:border-gray-700 shadow-sm space-y-6"
            >
              <div className="flex items-center justify-between">
                <div className="p-3 bg-purple-50 dark:bg-purple-900/30 rounded-2xl text-purple-600">
                  <Zap className="w-6 h-6" />
                </div>
                <div className="text-right">
                  <span className="text-[9px] font-black bg-purple-100 text-purple-700 px-3 py-1 rounded-full uppercase tracking-widest">Base Histórico</span>
                </div>
              </div>
              <div>
                <h3 className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">Projeção Final de Mês</h3>
                <div className="text-3xl font-black text-gray-900 dark:text-white tracking-tight">
                  R$ {stats.projectionAll.toLocaleString('pt-BR')}
                </div>
                <div className="mt-4 flex items-center gap-2 text-xs font-bold text-gray-500">
                  <Clock className="w-4 h-4 text-purple-500" />
                  Tempo p/ meta: <span className="text-purple-600">{stats.daysToGoalAll === Infinity ? 'N/A' : `${stats.daysToGoalAll} dias`}</span>
                </div>
              </div>
            </motion.div>
          </div>

          <div className="bg-white dark:bg-gray-800 p-8 rounded-[2.5rem] border border-gray-100 dark:border-gray-700 shadow-sm">
            <h3 className="text-lg font-black text-gray-900 dark:text-white mb-8 flex items-center gap-3 underline decoration-indigo-500/30 underline-offset-8">
              <TrendingUp className="h-6 w-6 text-indigo-600" />
              Análise Preditiva de Fluxo
            </h3>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={[
                  { day: 'Início', revenue: 0, projection: 0 },
                  { day: 'Hoje', revenue: stats.currentMonthRevenue, projection: stats.currentMonthRevenue },
                  { day: 'Fim do Mês', revenue: null, projection: stats.projection30d }
                ]}>
                  <defs>
                    <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 'bold'}} />
                  <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 'bold'}} />
                  <Tooltip 
                    contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 20px 40px rgba(0,0,0,0.1)' }}
                  />
                  <Area type="monotone" dataKey="revenue" stroke="#6366f1" strokeWidth={4} fillOpacity={1} fill="url(#colorRev)" />
                  <Area type="monotone" dataKey="projection" stroke="#818cf8" strokeWidth={2} strokeDasharray="5 5" fill="transparent" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <div className="space-y-8">
          <div className="bg-white dark:bg-gray-800 p-8 rounded-[2.5rem] border border-gray-100 dark:border-gray-700 shadow-sm">
            <h3 className="text-lg font-black text-gray-900 dark:text-white mb-6 uppercase tracking-tight">O que falta receber</h3>
            <div className="p-6 bg-amber-50 dark:bg-amber-900/10 rounded-3xl border border-amber-100 dark:border-amber-900/30">
              <div className="flex items-center gap-4 mb-4">
                <div className="p-3 bg-white dark:bg-gray-800 rounded-2xl shadow-sm">
                  <DollarSign className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase text-amber-600 tracking-widest">Contas Pendentes</p>
                  <p className="text-2xl font-black text-gray-900 dark:text-white">R$ {stats.currentMonthReceivable.toLocaleString('pt-BR')}</p>
                </div>
              </div>
              <p className="text-[10px] font-bold text-gray-500 leading-relaxed italic">
                * Este valor já ajudaria em {Math.round((stats.currentMonthReceivable / stats.remaining) * 100 || 0)}% para bater a meta restante.
              </p>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 p-8 rounded-[2.5rem] border border-gray-100 dark:border-gray-700 shadow-sm space-y-6">
            <h3 className="text-lg font-black text-gray-900 dark:text-white mb-2 uppercase tracking-tight">Estratégias de IA</h3>
            
            <div className="space-y-4">
              <div className="p-4 bg-gray-50 dark:bg-gray-900/50 rounded-2xl border border-transparent hover:border-indigo-100 transition-all group">
                <div className="flex items-center gap-3 mb-2">
                  <Zap className="w-4 h-4 text-indigo-600" />
                  <span className="text-[10px] font-black uppercase tracking-widest text-gray-900 dark:text-white">Dica de Conversão</span>
                </div>
                <p className="text-[11px] text-gray-500 font-bold leading-relaxed">
                  Com base no ticket médio de R$ {stats.dailyAvg30d > 0 ? (stats.dailyAvg30d * 30 / (workOrders.length / (differenceInDays(new Date(), new Date(2024,0,1))/30) || 1)).toLocaleString('pt-BR') : '500'}, você precisa fechar mais **{Math.ceil(stats.remaining / (stats.dailyAvg30d * 10 || 500))} ordens de serviço** para bater a meta.
                </p>
              </div>

              <div className="p-4 bg-emerald-50 dark:bg-emerald-900/10 rounded-2xl border border-transparent hover:border-emerald-200 transition-all group">
                <div className="flex items-center gap-3 mb-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span className="text-[10px] font-black uppercase tracking-widest text-emerald-600">Alvo atingível</span>
                </div>
                <p className="text-[11px] text-gray-500 font-bold leading-relaxed">
                  Sua projeção baseada no histórico total (R$ {stats.projectionAll.toLocaleString('pt-BR')}) indica que você está no caminho certo. Mantenha o fluxo atual!
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
