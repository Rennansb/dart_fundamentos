import React, { useState, useEffect, useMemo } from 'react';
import { 
  Plus, Search, TrendingUp, TrendingDown, DollarSign, X, 
  Calendar, Filter, Download, ChevronRight, ArrowUpRight, 
  ArrowDownRight, Wallet, Receipt, PieChart, Activity,
  FilterX, Loader2, Trash2, Edit2
} from 'lucide-react';
import { db } from '../firebase';
import { collection, query, where, onSnapshot, addDoc, serverTimestamp, deleteDoc, doc, orderBy } from 'firebase/firestore';
import { useAuth } from '../AuthContext';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { motion, AnimatePresence } from 'framer-motion';
import { handleFirestoreError, OperationType } from '../utils/firestoreErrors';
import { formatDateSafe } from '../utils/dateUtils';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart as RePieChart, Pie, Cell
} from 'recharts';
import { analyzeFinancialPerformance } from '../services/aiService';
import { BrainCircuit, Sparkles, TrendingUp as TrendUpIcon, Info } from 'lucide-react';

export default function Finance() {
  const { profile, user, selectedCompanyId } = useAuth();
  const [activeTab, setActiveTab] = useState<'payable' | 'receivable'>('payable');
  const [expenses, setExpenses] = useState<any[]>([]);
  const [workOrders, setWorkOrders] = useState<any[]>([]);
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiInsight, setAiInsight] = useState<string | null>(null);
  const [newExpense, setNewExpense] = useState({
    description: '',
    amount: '',
    category: 'Peças',
    date: new Date().toISOString().split('T')[0]
  });

  useEffect(() => {
    const companyId = selectedCompanyId || profile?.companyId;
    if (!user || !companyId) return;

    // Fetch Expenses
    const qExpenses = query(
      collection(db, 'expenses'), 
      where('companyId', '==', companyId),
      orderBy('date', 'desc')
    );
    const unsubscribeExpenses = onSnapshot(qExpenses, (snapshot) => {
      setExpenses(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'expenses');
    });

    // Fetch Work Orders
    const qWO = query(
      collection(db, 'work_orders'), 
      where('companyId', '==', companyId),
      orderBy('createdAt', 'desc')
    );
    const unsubscribeWO = onSnapshot(qWO, (snapshot) => {
      setWorkOrders(snapshot.docs.map(doc => ({ 
        id: doc.id, 
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate?.() || (doc.data().createdAt ? new Date(doc.data().createdAt) : new Date())
      })));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'work_orders');
    });

    return () => {
      unsubscribeExpenses();
      unsubscribeWO();
    };
  }, [profile, user, selectedCompanyId]);

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    const companyId = selectedCompanyId || profile?.companyId;
    if (!companyId) return;
    if (!newExpense.description || !newExpense.amount) return;

    setIsSaving(true);
    try {
      await addDoc(collection(db, 'expenses'), {
        ...newExpense,
        companyId: companyId,
        amount: parseFloat(newExpense.amount.toString()),
        createdAt: serverTimestamp()
      });
      setIsExpenseModalOpen(false);
      setNewExpense({ description: '', amount: '', category: 'Peças', date: new Date().toISOString().split('T')[0] });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'expenses');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteExpense = async (id: string) => {
    if (!window.confirm('Tem certeza que deseja excluir esta despesa?')) return;
    try {
      await deleteDoc(doc(db, 'expenses', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `expenses/${id}`);
    }
  };

  // Calculate totals
  const totalExpenses = expenses.reduce((acc, curr) => acc + (curr.amount || 0), 0);
  const totalPartsFromWO = workOrders.reduce((acc, curr) => acc + (curr.partsCost || 0), 0);
  const totalPayable = totalExpenses + totalPartsFromWO;

  const totalReceivable = workOrders.reduce((acc, curr) => acc + (curr.laborCost || 0), 0);

  // Process data for charts
  const chartData = useMemo(() => {
    const start = startOfMonth(new Date());
    const end = endOfMonth(new Date());
    const days = eachDayOfInterval({ start, end });

    return days.map(day => {
      const dayExpenses = expenses.filter(e => isSameDay(new Date(e.date + 'T12:00:00'), day))
        .reduce((sum, e) => sum + (e.amount || 0), 0);
      
      const dayReceivables = workOrders.filter(wo => {
        const d = wo.createdAt;
        return isSameDay(d, day);
      }).reduce((sum, wo) => sum + (wo.laborCost || 0), 0);

      const dayPartsCost = workOrders.filter(wo => {
        const d = wo.createdAt;
        return isSameDay(d, day);
      }).reduce((sum, wo) => sum + (wo.partsCost || 0), 0);

      return {
        date: format(day, 'dd/MM'),
        saidas: dayExpenses + dayPartsCost,
        entradas: dayReceivables,
        total: dayReceivables - (dayExpenses + dayPartsCost)
      };
    });
  }, [expenses, workOrders]);

  const handleGetAIInsight = async () => {
    if (isAnalyzing) return;
    setIsAnalyzing(true);
    try {
      // Combine expenses and work orders into a generic transaction list for the AI
      const txList = [
        ...expenses.map(e => ({ type: 'despesa', ...e })),
        ...workOrders.map(wo => ({ type: 'receita', ...wo }))
      ];
      const insight = await analyzeFinancialPerformance(txList, 'Este Mês', user?.uid || '', profile?.companyId || '');
      setAiInsight(insight);
    } catch (error) {
      console.error("Error getting AI insight:", error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const filteredExpenses = useMemo(() => {
    return expenses.filter(exp => 
      exp.description.toLowerCase().includes(search.toLowerCase()) ||
      exp.category.toLowerCase().includes(search.toLowerCase())
    );
  }, [expenses, search]);

  const filteredWorkOrders = useMemo(() => {
    return workOrders.filter(wo => 
      (wo.customerName || '').toLowerCase().includes(search.toLowerCase()) ||
      (wo.vehicleInfo || '').toLowerCase().includes(search.toLowerCase())
    );
  }, [workOrders, search]);

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <motion.div 
          initial={{ x: -20, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          className="space-y-1"
        >
          <div className="flex items-center gap-3">
            <div className="p-3 bg-indigo-600 rounded-2xl shadow-lg shadow-indigo-200 dark:shadow-none">
              <Wallet className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-3xl font-black text-gray-900 dark:text-white tracking-tight">Financeiro</h1>
          </div>
          <p className="text-gray-500 dark:text-gray-400 font-medium ml-1">Gerencie suas contas a pagar e a receber</p>
        </motion.div>

        <motion.div 
          initial={{ x: 20, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          className="flex flex-wrap gap-3"
        >
          <button
            onClick={() => {
              setNewExpense({...newExpense, category: 'Peças'});
              setIsExpenseModalOpen(true);
            }}
            className="flex-1 sm:flex-none inline-flex items-center justify-center px-6 py-3 bg-indigo-600 text-white rounded-2xl font-bold shadow-lg shadow-indigo-200 dark:shadow-none hover:bg-indigo-700 hover:-translate-y-0.5 transition-all active:scale-95 gap-2"
          >
            <Plus className="w-5 h-5" />
            Compra de Estoque
          </button>
          <button
            onClick={() => {
              setNewExpense({...newExpense, category: 'Outros'});
              setIsExpenseModalOpen(true);
            }}
            className="flex-1 sm:flex-none inline-flex items-center justify-center px-6 py-3 bg-red-600 text-white rounded-2xl font-bold shadow-lg shadow-red-200 dark:shadow-none hover:bg-red-700 hover:-translate-y-0.5 transition-all active:scale-95 gap-2"
          >
            <Plus className="w-5 h-5" />
            Nova Despesa
          </button>
        </motion.div>
      </div>

      {/* Summary Cards */}
      <motion.div 
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="grid grid-cols-1 md:grid-cols-3 gap-6"
      >
        <motion.div variants={itemVariants} className="bg-white dark:bg-gray-800 p-6 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm hover:shadow-md transition-all group relative overflow-hidden">
          <div className="absolute inset-0 opacity-10 pointer-events-none">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData.slice(-7)}>
                <Area type="monotone" dataKey="saidas" stroke="#ef4444" strokeWidth={0} fill="#ef4444" fillOpacity={1} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-2xl group-hover:scale-110 transition-transform">
                <TrendingDown className="w-6 h-6 text-red-600 dark:text-red-400" />
              </div>
              <span className="text-[10px] font-black uppercase tracking-widest text-red-500 bg-red-50 dark:bg-red-900/20 px-2 py-1 rounded-lg">Saídas</span>
            </div>
            <p className="text-sm font-bold text-gray-400 uppercase tracking-wider">Contas a Pagar</p>
            <h3 className="text-3xl font-black text-gray-900 dark:text-white mt-1">
              R$ {totalPayable.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </h3>
            <div className="mt-4 flex items-center gap-2 text-xs font-bold text-gray-400">
              <Activity className="w-3 h-3 text-red-500" />
              <span>Despesas + Peças da semana atual</span>
            </div>
          </div>
        </motion.div>

        <motion.div variants={itemVariants} className="bg-white dark:bg-gray-800 p-6 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm hover:shadow-md transition-all group relative overflow-hidden">
          <div className="absolute inset-0 opacity-10 pointer-events-none">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData.slice(-7)}>
                <Area type="monotone" dataKey="entradas" stroke="#10b981" strokeWidth={0} fill="#10b981" fillOpacity={1} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-2xl group-hover:scale-110 transition-transform">
                <TrendingUp className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
              </div>
              <span className="text-[10px] font-black uppercase tracking-widest text-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 px-2 py-1 rounded-lg">Entradas</span>
            </div>
            <p className="text-sm font-bold text-gray-400 uppercase tracking-wider">Contas a Receber</p>
            <h3 className="text-3xl font-black text-gray-900 dark:text-white mt-1">
              R$ {totalReceivable.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </h3>
            <div className="mt-4 flex items-center gap-2 text-xs font-bold text-gray-400">
              <Activity className="w-3 h-3 text-emerald-500" />
              <span>Receitas dos últimos 7 dias</span>
            </div>
          </div>
        </motion.div>

        <motion.div variants={itemVariants} className="bg-white dark:bg-gray-800 p-6 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm hover:shadow-md transition-all group relative overflow-hidden">
          <div className="absolute inset-0 opacity-10 pointer-events-none">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData.slice(-7)}>
                <Area type="monotone" dataKey="total" stroke="#4f46e5" strokeWidth={0} fill="#4f46e5" fillOpacity={1} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-indigo-50 dark:bg-indigo-900/20 rounded-2xl group-hover:scale-110 transition-transform">
                <DollarSign className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
              </div>
              <span className="text-[10px] font-black uppercase tracking-widest text-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 px-2 py-1 rounded-lg">Saldo</span>
            </div>
            <p className="text-sm font-bold text-gray-400 uppercase tracking-wider">Saldo Previsto</p>
            <h3 className={`text-3xl font-black mt-1 ${totalReceivable - totalPayable >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
              R$ {(totalReceivable - totalPayable).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </h3>
            <div className="mt-4 flex items-center gap-2 text-xs font-bold text-gray-400">
              <Activity className="w-3 h-3 text-indigo-500" />
              <span>Evolução do Saldo Atual</span>
            </div>
          </div>
        </motion.div>
      </motion.div>

      {/* AI Insights and Main Chart Card */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Chart Card */}
        <motion.div 
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="lg:col-span-2 bg-white dark:bg-gray-800 p-8 rounded-[2.5rem] border border-gray-100 dark:border-gray-700 shadow-xl shadow-gray-200/50 dark:shadow-none"
        >
          <div className="flex items-center justify-between mb-8">
            <div>
              <h3 className="text-xl font-black text-gray-900 dark:text-white uppercase tracking-tight">Fluxo de Caixa Mensal</h3>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mt-1">Comparativo de entradas e saídas</p>
            </div>
            <div className="flex gap-4">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-emerald-500 shadow-sm shadow-emerald-200"></div>
                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Entradas</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-red-500 shadow-sm shadow-red-200"></div>
                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Saídas</span>
              </div>
            </div>
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorEntradas" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorSaidas" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis 
                  dataKey="date" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 700 }}
                  dy={10}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 700 }}
                  tickFormatter={(value) => `R$${value >= 1000 ? (value/1000).toFixed(0)+'k' : value}`}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#fff', 
                    borderRadius: '20px', 
                    border: 'none', 
                    boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)',
                    padding: '12px'
                  }}
                  itemStyle={{ fontSize: '12px', fontWeight: 800, textTransform: 'uppercase' }}
                />
                <Area 
                  type="monotone" 
                  dataKey="entradas" 
                  stroke="#10b981" 
                  strokeWidth={4}
                  fillOpacity={1} 
                  fill="url(#colorEntradas)" 
                />
                <Area 
                  type="monotone" 
                  dataKey="saidas" 
                  stroke="#ef4444" 
                  strokeWidth={4}
                  fillOpacity={1} 
                  fill="url(#colorSaidas)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* AI Insight Card */}
        <motion.div 
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="bg-gradient-to-br from-indigo-600 to-indigo-800 p-8 rounded-[2.5rem] text-white shadow-xl shadow-indigo-200 dark:shadow-none flex flex-col relative overflow-hidden group"
        >
          <div className="absolute top-0 right-0 p-12 -mr-12 -mt-12 bg-white/10 rounded-full blur-3xl group-hover:bg-white/20 transition-all"></div>
          
          <div className="relative z-10 flex flex-col h-full">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-white/20 rounded-xl backdrop-blur-md">
                <BrainCircuit className="w-5 h-5 text-white" />
              </div>
              <h3 className="text-lg font-black uppercase tracking-tight">Smart Advisor IA</h3>
            </div>

            <div className="flex-1 overflow-y-auto max-h-48 pr-2 custom-scrollbar">
              {aiInsight ? (
                <div className="text-sm font-medium leading-relaxed text-indigo-50">
                  {aiInsight}
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-sm font-medium text-indigo-100">
                    Clique abaixo para analisar seu desempenho financeiro e receber dicas estratégicas da nossa IA.
                  </p>
                  <div className="flex gap-2">
                    <span className="w-2 h-2 rounded-full bg-white/30 animate-pulse"></span>
                    <span className="w-2 h-2 rounded-full bg-white/30 animate-pulse delay-75"></span>
                    <span className="w-2 h-2 rounded-full bg-white/30 animate-pulse delay-150"></span>
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={handleGetAIInsight}
              disabled={isAnalyzing}
              className="mt-6 w-full py-4 bg-white text-indigo-600 rounded-2xl font-black text-sm uppercase tracking-widest shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all active:scale-95 flex items-center justify-center gap-2"
            >
              {isAnalyzing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Analisando...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Gerar Insights
                </>
              )}
            </button>
          </div>
        </motion.div>
      </div>

      {/* Main Content Card */}
      <motion.div 
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="bg-white dark:bg-gray-800 rounded-[2.5rem] border border-gray-100 dark:border-gray-700 shadow-xl shadow-gray-200/50 dark:shadow-none overflow-hidden"
      >
        {/* Tabs and Search */}
        <div className="p-8 border-b border-gray-50 dark:border-gray-700 space-y-6">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="flex p-1.5 bg-gray-50 dark:bg-gray-900/50 rounded-2xl w-fit">
              <button
                onClick={() => setActiveTab('payable')}
                className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${
                  activeTab === 'payable'
                    ? 'bg-white dark:bg-gray-800 text-indigo-600 dark:text-indigo-400 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                }`}
              >
                Contas a Pagar
              </button>
              <button
                onClick={() => setActiveTab('receivable')}
                className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${
                  activeTab === 'receivable'
                    ? 'bg-white dark:bg-gray-800 text-indigo-600 dark:text-indigo-400 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                }`}
              >
                Contas a Receber
              </button>
            </div>

            <div className="relative group max-w-md w-full">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 group-focus-within:text-indigo-500 transition-colors" />
              <input
                type="text"
                placeholder={`Buscar em ${activeTab === 'payable' ? 'saídas' : 'entradas'}...`}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-12 pr-4 py-3.5 bg-gray-50 dark:bg-gray-900/50 border border-transparent focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 rounded-2xl outline-none transition-all dark:text-white font-medium"
              />
            </div>
          </div>
        </div>

        {/* List Content */}
        <div className="overflow-x-auto">
          <table className="w-full border-collapse min-w-[800px]">
            <thead>
              <tr className="bg-gray-50/50 dark:bg-gray-900/20">
                <th className="px-8 py-5 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Data</th>
                <th className="px-8 py-5 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Descrição</th>
                <th className="px-8 py-5 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Categoria</th>
                <th className="px-8 py-5 text-right text-[10px] font-black text-gray-400 uppercase tracking-widest">Valor</th>
                <th className="px-8 py-5 text-right text-[10px] font-black text-gray-400 uppercase tracking-widest">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-gray-700/50">
              <AnimatePresence mode="popLayout">
                {activeTab === 'payable' ? (
                  filteredExpenses.length > 0 ? (
                    filteredExpenses.map((exp) => (
                      <motion.tr
                        key={exp.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="group hover:bg-gray-50/50 dark:hover:bg-gray-900/20 transition-colors"
                      >
                        <td className="px-8 py-5 whitespace-nowrap">
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-red-50 dark:bg-red-900/20 rounded-lg">
                              <Calendar className="w-4 h-4 text-red-600 dark:text-red-400" />
                            </div>
                            <span className="text-sm font-bold text-gray-700 dark:text-gray-200">
                              {formatDateSafe(exp.date)}
                            </span>
                          </div>
                        </td>
                        <td className="px-8 py-5">
                          <span className="text-sm font-bold text-gray-900 dark:text-white">{exp.description}</span>
                        </td>
                        <td className="px-8 py-5">
                          <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                            exp.category === 'Peças' 
                              ? 'bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400'
                              : 'bg-indigo-50 text-indigo-600 dark:bg-indigo-900/20 dark:text-indigo-400'
                          }`}>
                            {exp.category}
                          </span>
                        </td>
                        <td className="px-8 py-5 text-right">
                          <span className="text-sm font-black text-red-600 dark:text-red-400">
                            R$ {exp.amount?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </span>
                        </td>
                        <td className="px-8 py-5 text-right">
                          <button
                            onClick={() => handleDeleteExpense(exp.id)}
                            className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-xl transition-all"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </motion.tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="px-8 py-20 text-center">
                        <div className="flex flex-col items-center gap-3">
                          <div className="p-4 bg-gray-50 dark:bg-gray-900/50 rounded-full">
                            <FilterX className="w-8 h-8 text-gray-300" />
                          </div>
                          <p className="text-gray-500 dark:text-gray-400 font-bold">Nenhuma despesa encontrada</p>
                        </div>
                      </td>
                    </tr>
                  )
                ) : (
                  filteredWorkOrders.length > 0 ? (
                    filteredWorkOrders.map((wo) => (
                      <motion.tr
                        key={wo.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="group hover:bg-gray-50/50 dark:hover:bg-gray-900/20 transition-colors"
                      >
                        <td className="px-8 py-5 whitespace-nowrap">
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg">
                              <Calendar className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                            </div>
                            <span className="text-sm font-bold text-gray-700 dark:text-gray-200">
                              {formatDateSafe(wo.createdAt)}
                            </span>
                          </div>
                        </td>
                        <td className="px-8 py-5">
                          <div className="flex flex-col">
                            <span className="text-sm font-bold text-gray-900 dark:text-white">{wo.customerName}</span>
                            <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">{wo.vehicleInfo}</span>
                          </div>
                        </td>
                        <td className="px-8 py-5">
                          <span className="px-3 py-1 bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400 rounded-full text-[10px] font-black uppercase tracking-widest">
                            Mão de Obra
                          </span>
                        </td>
                        <td className="px-8 py-5 text-right">
                          <span className="text-sm font-black text-emerald-600 dark:text-emerald-400">
                            R$ {wo.laborCost?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </span>
                        </td>
                        <td className="px-8 py-5 text-right">
                          <div className="p-2 bg-gray-50 dark:bg-gray-900/50 rounded-xl group-hover:bg-indigo-600 group-hover:text-white transition-all inline-flex">
                            <ChevronRight className="w-4 h-4" />
                          </div>
                        </td>
                      </motion.tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="px-8 py-20 text-center">
                        <div className="flex flex-col items-center gap-3">
                          <div className="p-4 bg-gray-50 dark:bg-gray-900/50 rounded-full">
                            <FilterX className="w-8 h-8 text-gray-300" />
                          </div>
                          <p className="text-gray-500 dark:text-gray-400 font-bold">Nenhuma entrada encontrada</p>
                        </div>
                      </td>
                    </tr>
                  )
                )}
              </AnimatePresence>
            </tbody>
          </table>
        </div>
      </motion.div>

      {/* Expense Modal */}
      <AnimatePresence>
        {isExpenseModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsExpenseModalOpen(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative bg-white dark:bg-gray-800 rounded-[2.5rem] shadow-2xl w-full max-w-lg overflow-hidden flex flex-col border border-gray-200 dark:border-gray-700"
            >
              <div className={`p-8 border-b border-gray-50 dark:border-gray-700 flex justify-between items-center ${
                newExpense.category === 'Peças' ? 'bg-indigo-600' : 'bg-red-600'
              }`}>
                <div>
                  <h3 className="text-2xl font-black text-white tracking-tight">
                    {newExpense.category === 'Peças' ? 'Compra de Estoque' : 'Nova Despesa'}
                  </h3>
                  <p className="text-white/80 text-sm font-medium mt-1">Registre a saída financeira</p>
                </div>
                <button 
                  onClick={() => setIsExpenseModalOpen(false)} 
                  className="p-2 bg-white/10 hover:bg-white/20 text-white rounded-xl transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <form onSubmit={handleAddExpense} className="p-8 space-y-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Descrição</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Compra de Óleo, Aluguel, etc"
                    value={newExpense.description}
                    onChange={(e) => setNewExpense({...newExpense, description: e.target.value})}
                    className="w-full px-4 py-3.5 bg-gray-50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-700 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all dark:text-white font-medium"
                  />
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Valor (R$)</label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      placeholder="0,00"
                      value={newExpense.amount}
                      onChange={(e) => setNewExpense({...newExpense, amount: e.target.value})}
                      className="w-full px-4 py-3.5 bg-gray-50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-700 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all dark:text-white font-medium"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Data</label>
                    <input
                      type="date"
                      required
                      value={newExpense.date}
                      onChange={(e) => setNewExpense({...newExpense, date: e.target.value})}
                      className="w-full px-4 py-3.5 bg-gray-50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-700 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all dark:text-white font-medium"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Categoria</label>
                  <select
                    value={newExpense.category}
                    onChange={(e) => setNewExpense({...newExpense, category: e.target.value})}
                    className="w-full px-4 py-3.5 bg-gray-50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-700 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all dark:text-white font-medium appearance-none"
                  >
                    <option value="Peças">Peças / Estoque</option>
                    <option value="Aluguel">Aluguel</option>
                    <option value="Energia">Energia / Água</option>
                    <option value="Salários">Salários</option>
                    <option value="Marketing">Marketing</option>
                    <option value="Ferramentas">Ferramentas</option>
                    <option value="Outros">Outros</option>
                  </select>
                </div>

                <div className="pt-4 flex gap-4">
                  <button
                    type="button"
                    onClick={() => setIsExpenseModalOpen(false)}
                    className="flex-1 px-6 py-4 bg-gray-50 dark:bg-gray-900/50 text-gray-700 dark:text-gray-200 rounded-2xl font-bold border border-gray-100 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-900 transition-all"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving}
                    className={`flex-[2] px-6 py-4 text-white rounded-2xl font-bold shadow-lg transition-all disabled:opacity-50 flex items-center justify-center gap-2 ${
                      newExpense.category === 'Peças' 
                        ? 'bg-indigo-600 shadow-indigo-200 dark:shadow-none hover:bg-indigo-700' 
                        : 'bg-red-600 shadow-red-200 dark:shadow-none hover:bg-red-700'
                    }`}
                  >
                    {isSaving ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Salvando...
                      </>
                    ) : (
                      'Salvar Lançamento'
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
