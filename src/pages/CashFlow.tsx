import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Plus, TrendingUp, TrendingDown, DollarSign, Search, Calendar, 
  CreditCard, CheckCircle, Clock, ArrowUpRight, ArrowDownRight,
  Filter, Download, ChevronRight, AlertCircle, Trash2, Edit2, X,
  PieChart as PieChartIcon, BarChart3, Activity, Sparkles, Loader2, BrainCircuit
} from 'lucide-react';
import { analyzeFinancialPerformance } from '../services/aiService';
import { useAuth } from '../AuthContext';
import { db } from '../firebase';
import { collection, query, where, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, orderBy } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '../utils/firestoreErrors';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, 
  ResponsiveContainer, LineChart, Line, AreaChart, Area, PieChart, Pie, Cell 
} from 'recharts';
import { format, subMonths, startOfMonth, endOfMonth, isWithinInterval, startOfDay, endOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { motion, AnimatePresence } from 'framer-motion';
import { formatDateSafe } from '../utils/dateUtils';

interface Transaction {
  id: string;
  description: string;
  amount: number;
  type: 'income' | 'expense';
  category: string;
  date: string;
  status: 'paid' | 'pending';
  paymentMethod: string;
  employeeId?: string;
  employeeName?: string;
  createdAt: any;
}

export default function CashFlow() {
  const { profile, selectedCompanyId } = useAuth();
  const navigate = useNavigate();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'income' | 'expense'>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'paid' | 'pending'>('all');
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [filterEmployeeId, setFilterEmployeeId] = useState<string>('all');
  const [employees, setEmployees] = useState<any[]>([]);
  
  // Form State
  const [formData, setFormData] = useState({
    description: '',
    amount: '',
    type: 'income' as 'income' | 'expense',
    category: 'Serviço',
    date: new Date().toISOString().split('T')[0],
    status: 'paid' as 'paid' | 'pending',
    paymentMethod: 'PIX',
    employeeId: '',
    employeeName: ''
  });

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showAiPanel, setShowAiPanel] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);

  useEffect(() => {
    if (!profile) return;
    const isSupplier = profile.role === 'fornecedor';
    const companyId = isSupplier ? profile.uid : (selectedCompanyId || profile?.companyId);
    
    if (!companyId) return;

    const q = query(
      collection(db, 'transactions'),
      where('companyId', '==', companyId),
      orderBy('date', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Transaction[];
      setTransactions(data);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'transactions');
    });

    // Fetch employees for filtering
    const qEmp = query(collection(db, 'users'), where('companyId', '==', companyId), where('role', '==', 'employee'));
    const unsubEmp = onSnapshot(qEmp, (snapshot) => {
      const empData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setEmployees(empData);
    });

    return () => {
      unsubscribe();
      unsubEmp();
    };
  }, [profile, selectedCompanyId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    const isSupplier = profile.role === 'fornecedor';
    const companyId = isSupplier ? profile.uid : (selectedCompanyId || profile?.companyId);
    
    if (!companyId) return;

    try {
      await addDoc(collection(db, 'transactions'), {
        companyId: companyId,
        description: formData.description,
        amount: parseFloat(formData.amount),
        type: formData.type,
        category: formData.category,
        date: formData.date,
        status: formData.status,
        paymentMethod: formData.paymentMethod,
        employeeId: profile.role === 'employee' ? profile.id : (formData.employeeId || profile.id),
        employeeName: profile.role === 'employee' ? profile.name : (formData.employeeName || profile.name),
        createdAt: serverTimestamp()
      });
      setIsModalOpen(false);
      setFormData({
        description: '',
        amount: '',
        type: 'income',
        category: 'Serviço',
        date: new Date().toISOString().split('T')[0],
        status: 'paid',
        paymentMethod: 'PIX',
        employeeId: '',
        employeeName: ''
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'transactions');
    }
  };

  const toggleStatus = async (transaction: Transaction) => {
    try {
      const newStatus = transaction.status === 'paid' ? 'pending' : 'paid';
      await updateDoc(doc(db, 'transactions', transaction.id), {
        status: newStatus
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `transactions/${transaction.id}`);
    }
  };

  const deleteTransaction = async (id: string) => {
    if (!window.confirm('Tem certeza que deseja excluir este lançamento?')) return;
    try {
      await deleteDoc(doc(db, 'transactions', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `transactions/${id}`);
    }
  };

  const exportToCSV = () => {
    const headers = ['Data', 'Descrição', 'Categoria', 'Tipo', 'Valor', 'Status', 'Pagamento'];
    const rows = filteredTransactions.map(t => [
      t.date,
      t.description ? `"${t.description.replace(/"/g, '""')}"` : '""',
      t.category,
      t.type === 'income' ? 'Receita' : 'Despesa',
      t.amount.toString(),
      t.status === 'paid' ? 'Pago' : 'Pendente',
      t.paymentMethod
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(r => r.join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `fluxo-caixa-${selectedMonth}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (profile?.role === 'employee') {
    return (
      <div className="p-12 text-center h-[calc(100vh-200px)] flex flex-col items-center justify-center">
        <div className="w-20 h-20 bg-rose-50 dark:bg-rose-900/20 rounded-full flex items-center justify-center mb-6">
          <AlertCircle className="h-10 w-10 text-rose-600" />
        </div>
        <h2 className="text-2xl font-black text-gray-900 dark:text-white uppercase tracking-tighter">Acesso Restrito</h2>
        <p className="text-gray-500 dark:text-gray-400 mt-2 max-w-md">Você não tem permissão para visualizar o fluxo de caixa da empresa. Entre em contato com o administrador se considerar isso um erro.</p>
        <button onClick={() => navigate('/app')} className="mt-8 px-8 py-3 bg-indigo-600 text-white font-bold rounded-2xl">Voltar ao Início</button>
      </div>
    );
  }

  // Calculations
  const filteredTransactions = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    const isManager = profile?.role === 'manager';
    
    return transactions.filter(t => {
      // If manager, only show today's transactions
      if (isManager && t.date !== todayStr) return false;

      const matchesSearch = t.description.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesType = filterType === 'all' || t.type === filterType;
      const matchesStatus = filterStatus === 'all' || t.status === filterStatus;
      const matchesMonth = t.date.startsWith(selectedMonth);
      const matchesEmployee = filterEmployeeId === 'all' || t.employeeId === filterEmployeeId;
      return matchesSearch && matchesType && matchesStatus && (isManager ? true : matchesMonth) && matchesEmployee;
    });
  }, [transactions, searchTerm, filterType, filterStatus, selectedMonth, profile]);

  const stats = useMemo(() => {
    const currentMonthTransactions = transactions.filter(t => t.date.startsWith(selectedMonth));
    
    const income = currentMonthTransactions
      .filter(t => t.type === 'income' && t.status === 'paid')
      .reduce((acc, curr) => acc + curr.amount, 0);
      
    const expense = currentMonthTransactions
      .filter(t => t.type === 'expense' && t.status === 'paid')
      .reduce((acc, curr) => acc + curr.amount, 0);
      
    const pendingInc = currentMonthTransactions
      .filter(t => t.type === 'income' && t.status === 'pending')
      .reduce((acc, curr) => acc + curr.amount, 0);
      
    const pendingExp = currentMonthTransactions
      .filter(t => t.type === 'expense' && t.status === 'pending')
      .reduce((acc, curr) => acc + curr.amount, 0);

    return {
      income,
      expense,
      balance: income - expense,
      pendingInc,
      pendingExp
    };
  }, [transactions, selectedMonth]);

  const categoryData = useMemo(() => {
    const categories: Record<string, number> = {};
    filteredTransactions.forEach(t => {
      categories[t.category] = (categories[t.category] || 0) + t.amount;
    });
    return Object.entries(categories)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [filteredTransactions]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  const runAiAnalysis = async () => {
    if (profile?.role === 'manager') return; // Managers can't run full AI analysis
    setIsAnalyzing(true);
    setShowAiPanel(true);
    try {
      const isSupplier = profile.role === 'fornecedor';
      const companyId = isSupplier ? profile.uid : (selectedCompanyId || profile?.companyId);
      const result = await analyzeFinancialPerformance(filteredTransactions, selectedMonth, profile?.id || profile?.uid || '', companyId);
      setAiAnalysis(result);
    } catch (error) {
      console.error(error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Chart Data Preparation
  const chartData = useMemo(() => {
    const data = [];
    for (let i = 5; i >= 0; i--) {
      const month = subMonths(new Date(), i);
      const monthKey = format(month, 'yyyy-MM');
      const monthName = format(month, 'MMM', { locale: ptBR });

      const monthIncome = transactions
        .filter(t => t.type === 'income' && t.status === 'paid' && t.date.startsWith(monthKey))
        .reduce((acc, curr) => acc + curr.amount, 0);
        
      const monthExpense = transactions
        .filter(t => t.type === 'expense' && t.status === 'paid' && t.date.startsWith(monthKey))
        .reduce((acc, curr) => acc + curr.amount, 0);

      data.push({
        name: monthName,
        receita: monthIncome,
        despesas: monthExpense,
        saldo: monthIncome - monthExpense
      });
    }
    return data;
  }, [transactions]);

  const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#f43f5e', '#8b5cf6', '#ec4899'];

  return (
    <div className="space-y-8 pb-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-gray-900 dark:text-white tracking-tight">Fluxo de Caixa</h1>
          <p className="text-gray-500 dark:text-gray-400">Controle financeiro detalhado da sua oficina</p>
        </div>
        <div className="flex items-center gap-3">
          {profile?.role !== 'manager' && (
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2 text-sm font-bold text-gray-700 dark:text-gray-200 focus:ring-2 focus:ring-indigo-500 outline-none shadow-sm"
            />
          )}
          {profile?.role !== 'manager' && (
            <button
              onClick={runAiAnalysis}
              disabled={isAnalyzing || filteredTransactions.length === 0}
              className="bg-indigo-50 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 p-2.5 rounded-xl border border-indigo-100 dark:border-indigo-800 hover:bg-indigo-100 transition-all disabled:opacity-50"
              title="Análise Inteligente (IA)"
            >
              {isAnalyzing ? <Loader2 className="h-5 w-5 animate-spin" /> : <Sparkles className="h-5 w-5" />}
            </button>
          )}
          <button
            onClick={() => setIsModalOpen(true)}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-xl flex items-center gap-2 font-bold shadow-lg shadow-indigo-200 dark:shadow-none transition-all hover:-translate-y-0.5"
          >
            <Plus className="h-5 w-5" />
            <span>Novo Lançamento</span>
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 border border-gray-200 dark:border-gray-700 relative overflow-hidden group"
        >
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-50 dark:bg-emerald-900/10 rounded-full -mr-12 -mt-12 group-hover:scale-150 transition-transform duration-700"></div>
          <div className="flex items-center justify-between mb-4 relative z-10">
            <div className="p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-2xl">
              <TrendingUp className="h-6 w-6 text-emerald-600" />
            </div>
            {stats.pendingInc > 0 && (
              <span className="text-[10px] font-black uppercase tracking-widest text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full">
                + {formatCurrency(stats.pendingInc)} pendente
              </span>
            )}
          </div>
          <div className="relative z-10">
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Receitas (Pagas)</p>
            <h3 className="text-3xl font-black text-emerald-600 tracking-tight">{formatCurrency(stats.income)}</h3>
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 border border-gray-200 dark:border-gray-700 relative overflow-hidden group"
        >
          <div className="absolute top-0 right-0 w-24 h-24 bg-rose-50 dark:bg-rose-900/10 rounded-full -mr-12 -mt-12 group-hover:scale-150 transition-transform duration-700"></div>
          <div className="flex items-center justify-between mb-4 relative z-10">
            <div className="p-3 bg-rose-50 dark:bg-rose-900/20 rounded-2xl">
              <TrendingDown className="h-6 w-6 text-rose-600" />
            </div>
            {stats.pendingExp > 0 && (
              <span className="text-[10px] font-black uppercase tracking-widest text-rose-600 bg-rose-50 px-2 py-1 rounded-full">
                - {formatCurrency(stats.pendingExp)} pendente
              </span>
            )}
          </div>
          <div className="relative z-10">
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Despesas (Pagas)</p>
            <h3 className="text-3xl font-black text-rose-600 tracking-tight">{formatCurrency(stats.expense)}</h3>
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 border border-gray-200 dark:border-gray-700 relative overflow-hidden group"
        >
          <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-50 dark:bg-indigo-900/10 rounded-full -mr-12 -mt-12 group-hover:scale-150 transition-transform duration-700"></div>
          <div className="flex items-center justify-between mb-4 relative z-10">
            <div className="p-3 bg-indigo-50 dark:bg-indigo-900/20 rounded-2xl">
              <DollarSign className="h-6 w-6 text-indigo-600" />
            </div>
          </div>
          <div className="relative z-10">
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Saldo do Período</p>
            <h3 className={`text-3xl font-black tracking-tight ${stats.balance >= 0 ? 'text-indigo-600' : 'text-rose-600'}`}>
              {formatCurrency(stats.balance)}
            </h3>
          </div>
        </motion.div>
      </div>

      <AnimatePresence>
        {aiAnalysis && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="bg-gradient-to-br from-indigo-600 to-purple-700 rounded-3xl p-8 text-white shadow-xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -mr-32 -mt-32 blur-3xl"></div>
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-white/20 rounded-xl">
                      <BrainCircuit className="h-6 w-6 text-white" />
                    </div>
                    <h3 className="text-xl font-black">Análise Estratégica IA</h3>
                  </div>
                  <button 
                    onClick={() => setAiAnalysis(null)}
                    className="p-2 hover:bg-white/10 rounded-full transition-colors"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
                <div className="prose prose-invert max-w-none text-indigo-50">
                  <div dangerouslySetInnerHTML={{ __html: aiAnalysis.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br/>') }} />
                </div>
                <div className="mt-6 pt-6 border-t border-white/10 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-indigo-200 italic">
                  * Insights gerados automaticamente com base no perfil da sua oficina.
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Charts Section */}
      {profile?.role !== 'manager' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <Activity className="h-5 w-5 text-indigo-600" />
                  Evolução Mensal
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">Histórico de receitas e despesas (6 meses)</p>
              </div>
            </div>
            <div className="h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorIncome" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.1}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorExpense" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.1}/>
                      <stop offset="95%" stopColor="#f43f5e" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} tickFormatter={(value) => `R$${value}`} />
                  <Tooltip 
                    contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)' }}
                    formatter={(value: number) => formatCurrency(value)}
                  />
                  <Area type="monotone" dataKey="receita" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorIncome)" name="Receitas" />
                  <Area type="monotone" dataKey="despesas" stroke="#f43f5e" strokeWidth={3} fillOpacity={1} fill="url(#colorExpense)" name="Despesas" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2 flex items-center gap-2">
              <PieChartIcon className="h-5 w-5 text-indigo-600" />
              Categorias
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-8">Distribuição de gastos e ganhos</p>
            
            <div className="h-56 w-full mb-8">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categoryData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={8}
                    dataKey="value"
                  >
                    {categoryData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => formatCurrency(value)} />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="space-y-3 max-h-40 overflow-y-auto pr-2 custom-scrollbar">
              {categoryData.map((item, i) => (
                <div key={item.name} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }}></div>
                    <span className="text-xs font-medium text-gray-600 dark:text-gray-400 truncate max-w-[120px]">{item.name}</span>
                  </div>
                  <span className="text-xs font-bold text-gray-900 dark:text-white">
                    {formatCurrency(item.value)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Transactions List Section */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="p-8 border-b border-gray-50 dark:border-gray-700 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white">Lançamentos</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">Lista detalhada de transações do período</p>
          </div>
          
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 pr-4 py-2 bg-gray-50 dark:bg-gray-900 border-none rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 w-full md:w-48"
              />
            </div>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value as any)}
              className="bg-gray-50 dark:bg-gray-900 border-none rounded-xl text-sm font-bold text-gray-600 dark:text-gray-300 focus:ring-2 focus:ring-indigo-500 px-4 py-2"
            >
              <option value="all">Todos</option>
              <option value="expense">Despesas</option>
            </select>
            <select
              value={filterEmployeeId}
              onChange={(e) => setFilterEmployeeId(e.target.value)}
              className="bg-gray-50 dark:bg-gray-900 border-none rounded-xl text-sm font-bold text-gray-600 dark:text-gray-300 focus:ring-2 focus:ring-indigo-500 px-4 py-2"
            >
              <option value="all">Todos Funcionários</option>
              {employees.map(emp => (
                <option key={emp.id} value={emp.id}>{emp.name}</option>
              ))}
            </select>
            <button 
              onClick={exportToCSV}
              className="p-2 bg-gray-50 dark:bg-gray-900 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl text-gray-600 dark:text-gray-300 transition-colors"
              title="Exportar CSV"
            >
              <Download className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left bg-gray-50/50 dark:bg-gray-900/30">
                <th className="px-8 py-4 text-[10px] font-black uppercase tracking-widest text-gray-400">Data</th>
                <th className="px-8 py-4 text-[10px] font-black uppercase tracking-widest text-gray-400">Descrição</th>
                <th className="px-8 py-4 text-[10px] font-black uppercase tracking-widest text-gray-400">Categoria</th>
                <th className="px-8 py-4 text-[10px] font-black uppercase tracking-widest text-gray-400">Valor</th>
                <th className="px-8 py-4 text-[10px] font-black uppercase tracking-widest text-gray-400">Responsável</th>
                <th className="px-8 py-4 text-[10px] font-black uppercase tracking-widest text-gray-400">Status</th>
                <th className="px-8 py-4 text-[10px] font-black uppercase tracking-widest text-gray-400 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-gray-700">
              <AnimatePresence mode="popLayout">
                {filteredTransactions.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-8 py-12 text-center text-gray-500 dark:text-gray-400">
                      Nenhum lançamento encontrado para este período.
                    </td>
                  </tr>
                ) : (
                  filteredTransactions.map((transaction) => (
                    <motion.tr 
                      layout
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      key={transaction.id} 
                      className="group hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors"
                    >
                      <td className="px-8 py-5 whitespace-nowrap">
                        <div className="flex items-center gap-2 text-sm font-bold text-gray-900 dark:text-white">
                          <Calendar className="h-4 w-4 text-indigo-500" />
                          {formatDateSafe(transaction.date, 'dd MMM')}
                        </div>
                      </td>
                      <td className="px-8 py-5">
                        <div className="text-sm font-bold text-gray-900 dark:text-white">{transaction.description}</div>
                        <div className="text-[10px] text-gray-400 flex items-center mt-0.5 font-bold uppercase tracking-wider">
                          <CreditCard className="h-3 w-3 mr-1" />
                          {transaction.paymentMethod}
                        </div>
                      </td>
                      <td className="px-8 py-5">
                        <span className="px-2.5 py-1 rounded-lg bg-gray-100 dark:bg-gray-700 text-[10px] font-black uppercase tracking-widest text-gray-600 dark:text-gray-400">
                          {transaction.category}
                        </span>
                      </td>
                      <td className="px-8 py-5 whitespace-nowrap">
                        <span className={`text-sm font-black ${transaction.type === 'income' ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {transaction.type === 'income' ? '+' : '-'}{formatCurrency(transaction.amount)}
                        </span>
                      </td>
                      <td className="px-8 py-5 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-[10px] font-black text-gray-500">
                            {(transaction.employeeName || 'S')[0].toUpperCase()}
                          </div>
                          <span className="text-xs font-bold text-gray-600 dark:text-gray-400">
                            {transaction.employeeName || 'Sistema'}
                          </span>
                        </div>
                      </td>
                      <td className="px-8 py-5 whitespace-nowrap">
                        <button
                          onClick={() => toggleStatus(transaction)}
                          className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${
                            transaction.status === 'paid' 
                              ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100' 
                              : 'bg-amber-50 text-amber-700 hover:bg-amber-100'
                          }`}
                        >
                          {transaction.status === 'paid' ? <CheckCircle className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
                          {transaction.status === 'paid' ? (transaction.type === 'income' ? 'Recebido' : 'Pago') : 'Pendente'}
                        </button>
                      </td>
                      <td className="px-8 py-5 text-right">
                        <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => deleteTransaction(transaction.id)}
                            className="p-2 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </motion.tr>
                  ))
                )}
              </AnimatePresence>
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Transaction Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-lg overflow-hidden border border-gray-200 dark:border-gray-700"
          >
            <div className="p-8 border-b border-gray-50 dark:border-gray-700 flex justify-between items-center">
              <h2 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">Novo Lançamento</h2>
              <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors">
                <X className="h-6 w-6 text-gray-400" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-8 space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">Tipo</label>
                  <select
                    required
                    value={formData.type}
                    onChange={(e) => setFormData({...formData, type: e.target.value as any})}
                    className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 border-none rounded-xl text-sm font-bold text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 transition-all"
                  >
                    <option value="income">Receita (+)</option>
                    <option value="expense">Despesa (-)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">Data</label>
                  <input
                    type="date"
                    required
                    value={formData.date}
                    onChange={(e) => setFormData({...formData, date: e.target.value})}
                    className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 border-none rounded-xl text-sm font-bold text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">Descrição</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Troca de Óleo - Placa ABC1234"
                  value={formData.description}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                  className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 border-none rounded-xl text-sm font-bold text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 transition-all"
                />
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">Valor (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    placeholder="0.00"
                    value={formData.amount}
                    onChange={(e) => setFormData({...formData, amount: e.target.value})}
                    className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 border-none rounded-xl text-sm font-black text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">Status</label>
                  <select
                    required
                    value={formData.status}
                    onChange={(e) => setFormData({...formData, status: e.target.value as any})}
                    className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 border-none rounded-xl text-sm font-bold text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 transition-all"
                  >
                    <option value="paid">{formData.type === 'income' ? 'Recebido' : 'Pago'}</option>
                    <option value="pending">Pendente</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">Categoria</label>
                  <select
                    required
                    value={formData.category}
                    onChange={(e) => setFormData({...formData, category: e.target.value})}
                    className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 border-none rounded-xl text-sm font-bold text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 transition-all"
                  >
                    {formData.type === 'income' ? (
                      <>
                        <option value="Serviço">Serviço</option>
                        <option value="Venda de Peças">Venda de Peças</option>
                        <option value="Outros">Outros</option>
                      </>
                    ) : (
                      <>
                        <option value="Peças/Estoque">Peças/Estoque</option>
                        <option value="Salários">Salários</option>
                        <option value="Aluguel/Contas">Aluguel/Contas</option>
                        <option value="Impostos">Impostos</option>
                        <option value="Ferramentas">Ferramentas</option>
                        <option value="Outros">Outros</option>
                      </>
                    )}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">Pagamento</label>
                  <select
                    required
                    value={formData.paymentMethod}
                    onChange={(e) => setFormData({...formData, paymentMethod: e.target.value})}
                    className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 border-none rounded-xl text-sm font-bold text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 transition-all"
                  >
                    <option value="PIX">PIX</option>
                    <option value="Cartão de Crédito">Cartão de Crédito</option>
                    <option value="Cartão de Débito">Cartão de Débito</option>
                    <option value="Dinheiro">Dinheiro</option>
                    <option value="Boleto">Boleto</option>
                    <option value="Transferência">Transferência</option>
                  </select>
                </div>
              </div>

              {profile.role !== 'employee' && (
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">Funcionário Responsável</label>
                  <select
                    value={formData.employeeId}
                    onChange={(e) => {
                      const emp = employees.find(emp => emp.id === e.target.value);
                      setFormData({...formData, employeeId: e.target.value, employeeName: emp?.name || ''});
                    }}
                    className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 border-none rounded-xl text-sm font-bold text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 transition-all"
                  >
                    <option value="">Você ({profile.name})</option>
                    {employees.map(emp => (
                      <option key={emp.id} value={emp.id}>{emp.name}</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-6">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-6 py-3 text-sm font-bold text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-8 py-3 bg-indigo-600 text-white text-sm font-black rounded-xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 dark:shadow-none hover:-translate-y-0.5"
                >
                  Salvar Lançamento
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
      {/* AI Analysis Panel */}
      <AnimatePresence>
        {showAiPanel && (
          <div className="fixed inset-0 z-[100] flex justify-end">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowAiPanel(false)}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="relative w-full max-w-lg bg-white dark:bg-gray-800 h-full shadow-2xl overflow-y-auto"
            >
              <div className="p-8">
                <div className="flex items-center justify-between mb-8">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-indigo-600 rounded-xl shadow-lg shadow-indigo-200 dark:shadow-none">
                      <BrainCircuit className="h-6 w-6 text-white" />
                    </div>
                    <div>
                      <h2 className="text-xl font-black text-gray-900 dark:text-white uppercase tracking-tight">Análise Estratégica IA</h2>
                      <p className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">Service Hub Intelligence</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setShowAiPanel(false)}
                    className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
                  >
                    <X className="h-6 w-6 text-gray-400" />
                  </button>
                </div>

                {isAnalyzing ? (
                  <div className="flex flex-col items-center justify-center py-20 text-center">
                    <div className="relative mb-6">
                      <div className="absolute inset-0 bg-indigo-400 rounded-full blur-xl animate-pulse opacity-20"></div>
                      <Loader2 className="h-12 w-12 text-indigo-600 animate-spin relative z-10" />
                    </div>
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Processando dados...</h3>
                    <p className="text-sm text-gray-500 max-w-xs">Nosso agente está analisando cada centavo para gerar os melhores insights para sua oficina.</p>
                  </div>
                ) : aiAnalysis ? (
                  <div className="space-y-6">
                    <div className="bg-gradient-to-br from-indigo-600 to-violet-700 rounded-3xl p-6 text-white shadow-xl">
                      <div className="flex items-center gap-2 mb-4">
                        <Activity className="h-4 w-4 text-indigo-200" />
                        <span className="text-[10px] font-black uppercase tracking-widest text-indigo-100">Visão Executiva</span>
                      </div>
                      <p className="text-sm leading-relaxed font-medium">
                        {aiAnalysis}
                      </p>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-4 bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-800 rounded-2xl">
                        <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-1">Potencial Lucro</p>
                        <p className="text-xl font-black text-emerald-700 dark:text-emerald-400">{formatCurrency(stats.income - stats.expense)}</p>
                      </div>
                      <div className="p-4 bg-orange-50 dark:bg-orange-900/10 border border-orange-100 dark:border-orange-800 rounded-2xl">
                        <p className="text-[10px] font-black text-orange-600 uppercase tracking-widest mb-1">Pendente</p>
                        <p className="text-xl font-black text-orange-700 dark:text-orange-400">{formatCurrency(stats.pendingInc)}</p>
                      </div>
                    </div>

                    <div className="p-6 bg-indigo-50 dark:bg-indigo-900/10 border border-indigo-100 dark:border-indigo-800 rounded-3xl">
                      <h4 className="text-xs font-black text-indigo-700 dark:text-indigo-300 uppercase tracking-widest mb-3">Dicas do Especialista</h4>
                      <ul className="space-y-3">
                        <li className="flex items-start gap-3 text-xs text-indigo-900 dark:text-indigo-200">
                          <div className="mt-1 h-1.5 w-1.5 rounded-full bg-indigo-600 shrink-0"></div>
                          <span>Foque em converter os R$ {stats.pendingInc.toFixed(2)} pendentes para melhorar o fluxo de caixa imediato.</span>
                        </li>
                        <li className="flex items-start gap-3 text-xs text-indigo-900 dark:text-indigo-200">
                          <div className="mt-1 h-1.5 w-1.5 rounded-full bg-indigo-600 shrink-0"></div>
                          <span>Sua categoria de maior gasto é "{transactions.reduce((prev, current) => (prev.amount > current.amount) ? prev : current, {category: 'Nenhuma', amount: 0}).category}". Considere renegociar com fornecedores.</span>
                        </li>
                      </ul>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-20">
                    <p className="text-gray-500 italic">Ocorreu um erro ao gerar a análise. Tente novamente em instantes.</p>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
