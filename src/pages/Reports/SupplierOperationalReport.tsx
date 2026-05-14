import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../AuthContext';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, 
  PieChart, Pie, Cell, LineChart, Line, AreaChart, Area 
} from 'recharts';
import { db } from '../../firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { 
  Package, Calendar, TrendingUp, Award, Download, 
  Activity, ArrowUpRight, ArrowDownRight, Users, 
  ShoppingCart, BarChart3, Clock
} from 'lucide-react';
import { motion } from 'framer-motion';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { exportToExcel } from '../../utils/exportUtils';

const COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#f97316', '#eab308', '#22c55e', '#06b6d4'];
const DAYS_OF_WEEK = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

export default function SupplierOperationalReport() {
  const { profile } = useAuth();
  const [orders, setOrders] = useState<any[]>([]);
  const [dateRange, setDateRange] = useState('30');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile?.id) return;

    setLoading(true);
    const q = query(
      collection(db, 'purchase_orders'),
      where('supplierId', '==', profile.id)
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
    
    if (startDate || endDate) {
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
    const partsSales: Record<string, { name: string; quantity: number; revenue: number }> = {};
    const daysSales = DAYS_OF_WEEK.map(day => ({ name: day, orders: 0, revenue: 0, quantity: 0 }));
    const topBuyers: Record<string, { name: string; orders: number; revenue: number; quantity: number }> = {};
    let totalItemsSold = 0;

    filteredOrders.forEach(order => {
      const dayOfWeek = order.createdAt.getDay();
      daysSales[dayOfWeek].orders += 1;
      daysSales[dayOfWeek].revenue += order.total || 0;

      const shopId = order.shopId;
      if (!topBuyers[shopId]) {
        topBuyers[shopId] = { name: order.shopName || 'Oficina Desconhecida', orders: 0, revenue: 0, quantity: 0 };
      }
      topBuyers[shopId].orders += 1;
      topBuyers[shopId].revenue += order.total || 0;

      if (order.items && Array.isArray(order.items)) {
        order.items.forEach((item: any) => {
          const partName = item.partName || 'Peça Desconhecida';
          const qty = Number(item.quantity) || 1;
          const price = Number(item.salePrice) || 0;
          
          if (!partsSales[partName]) {
            partsSales[partName] = { name: partName, quantity: 0, revenue: 0 };
          }
          partsSales[partName].quantity += qty;
          partsSales[partName].revenue += (qty * price);
          totalItemsSold += qty;
          daysSales[dayOfWeek].quantity += qty;
          topBuyers[shopId].quantity += qty;
        });
      }
    });

    const bestDay = [...daysSales].sort((a, b) => b.revenue - a.revenue)[0];

    return {
      totalItemsSold,
      bestDay: bestDay?.name || '-',
      topParts: Object.values(partsSales).sort((a, b) => b.quantity - a.quantity).slice(0, 10),
      topBuyers: Object.values(topBuyers).sort((a, b) => b.revenue - a.revenue).slice(0, 5),
      daysSales,
      count: filteredOrders.length,
      revenue: filteredOrders.reduce((sum, o) => sum + (o.total || 0), 0)
    };
  }, [filteredOrders]);

  const handleExcelExport = () => {
    const exportData = filteredOrders.map(o => ({
      ID: o.id.substring(0, 6),
      Data: format(o.createdAt, 'dd/MM/yyyy'),
       Oficina: o.shopName || 'N/A',
      Itens: (o.items || []).length,
      Total: o.total || 0,
       Status: o.status || 'Pendente'
    }));
    exportToExcel(exportData, 'Fornecedor_Operacional', 'Vendas');
  };

  const generatePDF = () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
     const hasRazao = profile?.companyName && profile?.companyName !== profile?.tradeName;
    const businessMainName = hasRazao ? profile.companyName : (profile?.fullName || profile?.name || 'Service Hub Pro');

    doc.setFillColor(15, 23, 42); 
    doc.rect(0, 0, pageWidth, 50, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.text('Relatório Operacional de Parcerias', 14, 22);
    doc.setFontSize(9);
    doc.text(`GERADO EM: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, 14, 38);
    doc.text(businessMainName.toUpperCase(), pageWidth - 14, 22, { align: 'right' });

    autoTable(doc, {
      startY: 60,
      head: [['Peça / Produto', 'Qtd Vendida', 'Receita Gerada']],
      body: stats.topParts.map(p => [p.name, p.quantity.toString(), p.revenue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })]),
      headStyles: { fillColor: [79, 70, 229] },
    });

    doc.save(`Relatorio_Fornecedor_Operacional_${format(new Date(), 'yyyyMMdd')}.pdf`);
  };

  return (
    <div className="p-6 bg-gray-50 dark:bg-gray-900 min-h-screen">
      <div className="max-w-7xl mx-auto">
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
          <div>
            <h2 className="text-3xl font-black text-gray-900 dark:text-white tracking-tight">Operacional Parcerias</h2>
            <p className="text-gray-500 dark:text-gray-400">Desempenho de produtos, logística e clientes</p>
          </div>
          
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
        </header>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <StatCard title="Peças Vendidas" value={stats.totalItemsSold.toString()} icon={<Package className="h-6 w-6" />} color="indigo" />
          <StatCard title="Volume Pedidos" value={stats.count.toString()} icon={<ShoppingCart className="h-6 w-6" />} color="purple" />
          <StatCard title="Melhor Dia" value={stats.bestDay} icon={<Calendar className="h-6 w-6" />} color="amber" />
          <StatCard title="Faturamento Total" value={stats.revenue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} icon={<Award className="h-6 w-6" />} color="emerald" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          <div className="bg-white dark:bg-gray-800 p-8 rounded-[2.5rem] shadow-xl border border-gray-100 dark:border-gray-700">
             <h3 className="text-xl font-black text-gray-900 dark:text-white mb-8 flex items-center gap-2 uppercase tracking-tight">
              <BarChart3 className="h-5 w-5 text-indigo-600" /> Top 10 Produtos (Volume)
            </h3>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.topParts} layout="vertical" margin={{ left: 20 }}>
                  <XAxis type="number" hide />
                  <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 900 }} width={120} />
                  <Tooltip contentStyle={{ borderRadius: '16px', border: 'none' }} />
                  <Bar dataKey="quantity" fill="#6366f1" radius={[0, 10, 10, 0]} barSize={30} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 p-8 rounded-[2.5rem] shadow-xl border border-gray-100 dark:border-gray-700">
             <h3 className="text-xl font-black text-gray-900 dark:text-white mb-8 flex items-center gap-2 uppercase tracking-tight">
              <Clock className="h-5 w-5 text-purple-600" /> Distribuição Semanal
            </h3>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={stats.daysSales}>
                  <defs>
                    <linearGradient id="colorDays" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 700 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 700 }} />
                  <Tooltip contentStyle={{ borderRadius: '20px', border: 'none' }} />
                  <Area type="monotone" dataKey="orders" stroke="#8b5cf6" strokeWidth={4} fillOpacity={1} fill="url(#colorDays)" name="Pedidos" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-[2.5rem] shadow-xl border border-gray-100 dark:border-gray-700 p-8">
            <h3 className="text-xl font-black text-gray-900 dark:text-white mb-8 flex items-center gap-2 uppercase tracking-tight">
                <Users className="h-5 w-5 text-indigo-600" /> Performance por Cliente (Top 5)
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
                {stats.topBuyers.map((buyer, i) => (
                    <motion.div key={buyer.name} whileHover={{ y: -5 }} className="bg-gray-50 dark:bg-gray-900/50 p-6 rounded-3xl border border-gray-100 dark:border-gray_700 text-center">
                        <div className="w-12 h-12 bg-indigo-100 dark:bg-indigo-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Users className="h-6 w-6 text-indigo-600" />
                        </div>
                        <h4 className="text-xs font-black text-gray-900 dark:text-white uppercase truncate mb-2">{buyer.name}</h4>
                        <p className="text-lg font-black text-indigo-600">{buyer.orders} Pedidos</p>
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{buyer.revenue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                    </motion.div>
                ))}
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
                {trend && (
                  <div className={`flex items-center gap-1 text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-xl ${isUp ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                      {trend} {isUp ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                  </div>
                )}
            </div>
            <h4 className="text-gray-400 text-[10px] font-black uppercase tracking-widest mb-1">{title}</h4>
            <p className="text-2xl font-black text-gray-900 dark:text-white">{value}</p>
        </motion.div>
    );
}
