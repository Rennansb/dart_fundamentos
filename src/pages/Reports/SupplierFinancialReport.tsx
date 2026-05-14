import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../AuthContext';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, 
  PieChart, Pie, Cell, AreaChart, Area 
} from 'recharts';
import { db } from '../../firebase';
import { collection, query, where, onSnapshot, limit } from 'firebase/firestore';
import { 
  DollarSign, CreditCard, TrendingUp, AlertCircle, 
  Download, Activity, Calendar, ArrowUpRight, ArrowDownRight,
  TrendingDown, Users, Briefcase
} from 'lucide-react';
import { motion } from 'framer-motion';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { exportToExcel } from '../../utils/exportUtils';

const COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#f97316', '#eab308', '#22c55e', '#06b6d4'];

export default function SupplierFinancialReport() {
  const { profile } = useAuth();
  const [orders, setOrders] = useState<any[]>([]);
  const [dateRange, setDateRange] = useState('30');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [loading, setLoading] = useState(true);

  if (profile?.role === 'employee') {
    return (
      <div className="p-12 text-center h-[calc(100vh-200px)] flex flex-col items-center justify-center">
        <h2 className="text-2xl font-black text-gray-900 dark:text-white uppercase tracking-tighter">Acesso Restrito</h2>
        <p className="text-gray-500 dark:text-gray-400 mt-2 max-w-md">Relatórios financeiros não estão disponíveis para o seu nível de acesso.</p>
      </div>
    );
  }

  useEffect(() => {
    if (!profile?.id) return;

    setLoading(true);
    const q = query(
      collection(db, 'purchase_orders'),
      where('supplierId', '==', profile.id),
      limit(500)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate?.() || (doc.data().createdAt ? new Date(doc.data().createdAt) : new Date())
      }));
      setOrders(data);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [profile?.id]);

  const filteredOrders = useMemo(() => {
    let filtered = orders.filter(o => o.status !== 'cancelado');
    
    if (profile?.role === 'manager') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      filtered = filtered.filter(o => o.createdAt >= today);
    } else if (startDate || endDate) {
      if (startDate) {
        const start = new Date(startDate + 'T00:00:00');
        filtered = filtered.filter(o => o.createdAt >= start);
      }
      if (endDate) {
        const end = new Date(endDate + 'T23:59:59');
        filtered = filtered.filter(o => o.createdAt <= end);
      }
    } else {
      const now = new Date();
      const cutoff = new Date();
      cutoff.setDate(now.getDate() - parseInt(dateRange));
      filtered = filtered.filter(o => o.createdAt >= cutoff);
    }
    
    return filtered;
  }, [orders, dateRange, startDate, endDate]);

  const stats = useMemo(() => {
    let totalRevenue = 0;
    let totalPending = 0;
    const paymentStatus: Record<string, { name: string; value: number }> = {};
    const shopRevenue: Record<string, { name: string; revenue: number }> = {};

    filteredOrders.forEach(order => {
      const amount = order.total || 0;
      totalRevenue += amount;

      const status = order.paymentStatus || 'pendente';
      if (!paymentStatus[status]) {
        paymentStatus[status] = { name: status, value: 0 };
      }
      paymentStatus[status].value += amount;

      if (status === 'pendente' || status === 'aguardando') {
        totalPending += amount;
      }

      const shopName = order.shopName || 'Oficina Desconhecida';
      if (!shopRevenue[shopName]) {
        shopRevenue[shopName] = { name: shopName, revenue: 0 };
      }
      shopRevenue[shopName].revenue += amount;
    });

    const averageTicket = filteredOrders.length > 0 ? totalRevenue / filteredOrders.length : 0;

    // Calc Trends
    const now = new Date();
    const rangeDays = parseInt(dateRange);
    const currentCutoff = startDate ? new Date(startDate) : new Date(now.getTime() - rangeDays * 86400000);
    const prevCutoff = new Date(currentCutoff.getTime() - (startDate && endDate ? (new Date(endDate).getTime() - new Date(startDate).getTime()) : rangeDays * 86400000));
    
    const previousOrders = orders.filter(o => o.createdAt >= prevCutoff && o.createdAt < currentCutoff && o.status !== 'cancelado');
    const prevRevenue = previousOrders.reduce((sum, o) => sum + (o.total || 0), 0);
    const prevCount = previousOrders.length;
    const prevAvgTicket = prevCount > 0 ? prevRevenue / prevCount : 0;

    const calcTrend = (curr: number, prev: number) => {
      if (prev === 0) return curr > 0 ? '+100%' : '0%';
      const diff = ((curr - prev) / prev) * 100;
      return `${diff > 0 ? '+' : ''}${diff.toFixed(1)}%`;
    };

    return {
      totalRevenue,
      totalPending,
      averageTicket,
      count: filteredOrders.length,
      paymentData: Object.values(paymentStatus),
      shopData: Object.values(shopRevenue).sort((a, b) => b.revenue - a.revenue).slice(0, 10),
      trends: {
        revenue: calcTrend(totalRevenue, prevRevenue),
        ticket: calcTrend(averageTicket, prevAvgTicket),
        count: calcTrend(filteredOrders.length, prevCount)
      }
    };
  }, [filteredOrders]);

  const dailyData = useMemo(() => {
    const map = new Map();
    const now = new Date();
    let numDays = parseInt(dateRange);
    let referenceDate = endDate ? new Date(endDate) : now;
    
    if (startDate && endDate) {
      numDays = Math.ceil((new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24));
    }

    for (let i = numDays; i >= 0; i--) {
      const d = new Date(referenceDate);
      d.setDate(d.getDate() - i);
      const dateStr = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
      map.set(dateStr, { date: dateStr, revenue: 0, count: 0 });
    }

    filteredOrders.forEach(order => {
      const dateStr = order.createdAt.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
      if (map.has(dateStr)) {
        const entry = map.get(dateStr);
        entry.revenue += order.total || 0;
        entry.count += 1;
      }
    });

    return Array.from(map.values());
  }, [filteredOrders, dateRange, startDate, endDate]);

  const handleExcelExport = () => {
    const exportData = filteredOrders.map(o => ({
      ID: o.id.substring(0, 6),
      Data: format(o.createdAt, 'dd/MM/yyyy'),
      Oficina: o.shopName || 'N/A',
      Total: o.total || 0,
       Pagamento: o.paymentStatus || 'Pendente',
      Status: o.status || 'Pendente'
    }));
    exportToExcel(exportData, 'Fornecedor_Financeiro', 'Vendas');
  };

  const generatePDF = () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    
    const hasRazao = profile?.companyName && profile?.companyName !== profile?.tradeName;
    const businessMainName = hasRazao ? profile.companyName : (profile?.fullName || profile?.name || 'Service Hub Pro');
    const businessDoc = profile?.cnpj ? `CNPJ: ${profile.cnpj}` : (profile?.ownerCpf ? `CPF: ${profile.ownerCpf}` : (profile?.cpfCnpj ? `DOC: ${profile.cpfCnpj}` : ''));

    doc.setFillColor(15, 23, 42); 
    doc.rect(0, 0, pageWidth, 50, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.text('Relatório Financeiro de Parcerias', 14, 22);
    doc.setFontSize(9);
    doc.text(`GERADO EM: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, 14, 38);

    doc.text(businessMainName.toUpperCase(), pageWidth - 14, 22, { align: 'right' });
    doc.text(businessDoc, pageWidth - 14, 33, { align: 'right' });

    autoTable(doc, {
      startY: 60,
      head: [['Indicador', 'Valor']],
      body: [
        ['Faturamento Bruto', stats.totalRevenue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })],
        ['Ticket Médio', stats.averageTicket.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })],
        ['Pedidos Totais', stats.count.toString()],
      ],
      headStyles: { fillColor: [79, 70, 229] },
    });

    doc.save(`Relatorio_Fornecedor_Financeiro_${format(new Date(), 'yyyyMMdd')}.pdf`);
  };

  return (
    <div className="p-6 bg-gray-50 dark:bg-gray-900 min-h-screen">
      <div className="max-w-7xl mx-auto">
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
          <div>
            <h2 className="text-3xl font-black text-gray-900 dark:text-white tracking-tight">Financeiro Parcerias</h2>
            <p className="text-gray-500 dark:text-gray-400">Visão estratégica dos seus recebíveis e vendas</p>
          </div>
          
          {profile?.role !== 'manager' && (
            <div className="flex flex-wrap items-center gap-4">
               <div className="flex flex-col gap-1">
                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Período</span>
                <div className="flex items-center bg-white dark:bg-gray-800 rounded-xl p-1 shadow-sm border border-gray-100 dark:border-gray-700">
                  {['7', '30', '90'].map(range => (
                    <button 
                      key={range}
                      onClick={() => { setDateRange(range); setStartDate(''); setEndDate(''); }}
                      className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-all ${dateRange === range && !startDate ? 'bg-indigo-600 text-white shadow-md' : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'}`}
                    >
                      {range}D
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Filtro Customizado</span>
                <div className="flex items-center gap-2 bg-white dark:bg-gray-800 p-1 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm text-xs font-bold">
                  <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="bg-transparent border-none outline-none text-gray-600 dark:text-gray-300 p-1" />
                  <span className="text-gray-300">|</span>
                  <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="bg-transparent border-none outline-none text-gray-600 dark:text-gray-300 p-1" />
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Arquivo</span>
                <div className="flex items-center gap-2">
                  <button onClick={handleExcelExport} className="bg-emerald-600 hover:bg-emerald-700 text-white p-2.5 rounded-xl shadow-lg transition-all" title="Excel">
                    <Activity className="h-5 w-5" />
                  </button>
                  <button onClick={generatePDF} className="bg-indigo-600 hover:bg-indigo-700 text-white p-2.5 rounded-xl shadow-lg transition-all" title="PDF">
                    <Download className="h-5 w-5" />
                  </button>
                </div>
              </div>
            </div>
          )}
        </header>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <StatCard title="Receita Bruta" value={stats.totalRevenue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} icon={<DollarSign className="h-6 w-6" />} color="emerald" trend={stats.trends.revenue} isUp={!stats.trends.revenue.startsWith('-')} />
          <StatCard title="Ticket Médio" value={stats.averageTicket.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} icon={<TrendingUp className="h-6 w-6" />} color="indigo" trend={stats.trends.ticket} isUp={!stats.trends.ticket.startsWith('-')} />
          <StatCard title="A Receber" value={stats.totalPending.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} icon={<AlertCircle className="h-6 w-6" />} color="amber" trend="Saldo" isUp={false} />
          <StatCard title="Total Pedidos" value={stats.count.toString()} icon={<Briefcase className="h-6 w-6" />} color="purple" trend={stats.trends.count} isUp={!stats.trends.count.startsWith('-')} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
          <div className="lg:col-span-2 bg-white dark:bg-gray-800 p-8 rounded-[2.5rem] shadow-xl border border-gray-100 dark:border-gray-700">
             <h3 className="text-xl font-black text-gray-900 dark:text-white mb-8 flex items-center gap-2 uppercase tracking-tight">
              <Activity className="h-5 w-5 text-indigo-600" /> Curva de Faturamento
            </h3>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={dailyData}>
                  <defs>
                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 700 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 700 }} />
                  <Tooltip contentStyle={{ borderRadius: '20px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)', padding: '12px' }} />
                  <Area type="monotone" dataKey="revenue" stroke="#6366f1" strokeWidth={4} fillOpacity={1} fill="url(#colorRevenue)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 p-8 rounded-[2.5rem] shadow-xl border border-gray-100 dark:border-gray-700">
             <h3 className="text-xl font-black text-gray-900 dark:text-white mb-8 flex items-center gap-2 uppercase tracking-tight">
              <CreditCard className="h-5 w-5 text-purple-600" /> Mix de Pagamento
            </h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={stats.paymentData} cx="50%" cy="50%" innerRadius={65} outerRadius={85} paddingAngle={10} dataKey="value">
                    {stats.paymentData.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} stroke="none" />)}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: '16px', border: 'none' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-8 space-y-4">
                {stats.paymentData.map((item, i) => (
                    <div key={item.name} className="flex items-center justify-between p-3 rounded-2xl bg-gray-50 dark:bg-gray-900/50 text-[10px] font-black text-gray-400 uppercase tracking-widest">
                        <span>{item.name}</span>
                        <span className="text-gray-900 dark:text-white text-sm">{item.value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                    </div>
                ))}
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-[2.5rem] shadow-xl border border-gray-100 dark:border-gray-700 p-8">
            <h3 className="text-xl font-black text-gray-900 dark:text-white mb-8 flex items-center gap-2 uppercase tracking-tight">
                <Users className="h-5 w-5 text-indigo-600" /> Maiores Clientes (Oficinas)
            </h3>
            <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={stats.shopData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 700 }} axisLine={false} tickLine={false} />
                        <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 700 }} />
                        <Tooltip contentStyle={{ borderRadius: '16px', border: 'none' }} />
                        <Bar dataKey="revenue" fill="#6366f1" radius={[10, 10, 0, 0]} name="Receita" barSize={40} />
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, icon, trend, isUp, color }: any) {
    const colorClasses: any = {
        emerald: "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600",
        indigo: "bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600",
        amber: "bg-amber-50 dark:bg-amber-900/20 text-amber-600",
        purple: "bg-purple-50 dark:bg-purple-900/20 text-purple-600",
    };
    return (
        <motion.div whileHover={{ y: -5 }} className="bg-white dark:bg-gray-800 p-6 rounded-3xl shadow-lg border border-gray-100 dark:border-gray-700 transition-all">
            <div className="flex items-center justify-between mb-4">
                <div className={`p-4 rounded-2xl ${colorClasses[color]}`}>{icon}</div>
                <div className={`flex items-center gap-1 text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-xl ${isUp ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                    {trend} {isUp ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                </div>
            </div>
            <h4 className="text-gray-400 text-[10px] font-black uppercase tracking-widest mb-1">{title}</h4>
            <p className="text-2xl font-black text-gray-900 dark:text-white">{value}</p>
        </motion.div>
    );
}
