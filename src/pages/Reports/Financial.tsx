import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../AuthContext';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, 
  PieChart, Pie, Cell, AreaChart, Area 
} from 'recharts';
import { db } from '../../firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { 
  TrendingUp, TrendingDown, DollarSign, Wrench, Users, Calendar, 
  ArrowUpRight, ArrowDownRight, Filter, Download, ChevronRight,
  PieChart as PieIcon, BarChart3, LineChart as LineIcon, Package, Activity
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { formatDateSafe } from '../../utils/dateUtils';
import SupplierFinancialReport from './SupplierFinancialReport';
import { exportToExcel } from '../../utils/exportUtils';

const COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#f97316', '#eab308', '#22c55e', '#06b6d4'];

export default function FinancialReports() {
  const { profile } = useAuth();
  const [employees, setEmployees] = useState<any[]>([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [workOrders, setWorkOrders] = useState<any[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<any[]>([]);
  const [dateRange, setDateRange] = useState('30'); // days
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  if (profile?.role === 'fornecedor') {
    return <SupplierFinancialReport />;
  }

  if (profile?.role === 'employee') {
    return (
      <div className="p-12 text-center h-[calc(100vh-200px)] flex flex-col items-center justify-center">
        <h2 className="text-2xl font-black text-gray-900 dark:text-white uppercase tracking-tighter">Acesso Restrito</h2>
        <p className="text-gray-500 dark:text-gray-400 mt-2 max-w-md">Relatórios financeiros não estão disponíveis para o seu nível de acesso.</p>
      </div>
    );
  }

  useEffect(() => {
    if (profile?.companyId) {
      setIsLoading(true);
      const qEmployees = query(collection(db, 'users'), where('companyId', '==', profile.companyId));
      const unsubEmployees = onSnapshot(qEmployees, (snapshot) => {
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setEmployees(data);
      });
        
      const q = query(collection(db, 'work_orders'), where('companyId', '==', profile.companyId));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const data = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          createdAt: doc.data().createdAt?.toDate?.() || (doc.data().createdAt ? new Date(doc.data().createdAt) : new Date())
        }));
        setWorkOrders(data);
      });

      const qPO = query(collection(db, 'purchase_orders'), where('shopId', '==', profile.companyId));
      const unsubPO = onSnapshot(qPO, (snapshot) => {
        const data = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          createdAt: doc.data().createdAt?.toDate?.() || (doc.data().createdAt ? new Date(doc.data().createdAt) : new Date())
        }));
        setPurchaseOrders(data);
        setIsLoading(false);
      });

      return () => {
        unsubEmployees();
        unsubscribe();
        unsubPO();
      };
    }
  }, [profile]);

  const filteredWorkOrders = useMemo(() => {
    let filtered = workOrders;
    
    // Filter by employee
    if (selectedEmployeeId) {
      filtered = filtered.filter(wo => String(wo.employeeId) === String(selectedEmployeeId));
    }
    
    // Filter by date range (Custom or Preset)
    if (profile?.role === 'manager') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      filtered = filtered.filter(wo => wo.createdAt >= today);
    } else if (startDate || endDate) {
      if (startDate) {
        const start = new Date(startDate + 'T00:00:00');
        filtered = filtered.filter(wo => wo.createdAt >= start);
      }
      if (endDate) {
        const end = new Date(endDate + 'T23:59:59');
        filtered = filtered.filter(wo => wo.createdAt <= end);
      }
    } else {
      const now = new Date();
      const cutoff = new Date();
      cutoff.setDate(now.getDate() - parseInt(dateRange));
      filtered = filtered.filter(wo => wo.createdAt >= cutoff);
    }
    
    return filtered;
  }, [workOrders, selectedEmployeeId, dateRange, startDate, endDate]);

  // Aggregate data for charts
  const dailyData = useMemo(() => {
    const map = new Map();
    
    // Determine range for plotting
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
      map.set(dateStr, { date: dateStr, parts: 0, labor: 0, total: 0, count: 0 });
    }

    filteredWorkOrders.forEach(wo => {
      const date = wo.createdAt;
      const dateStr = date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
      
      if (map.has(dateStr)) {
        const entry = map.get(dateStr);
        entry.parts += wo.partsCost || 0;
        entry.labor += wo.laborCost || 0;
        entry.total += (wo.partsCost || 0) + (wo.laborCost || 0);
        entry.count += 1;
      }
    });

    return Array.from(map.values());
  }, [filteredWorkOrders, dateRange, startDate, endDate]);

  // Projections (Simple Linear Regression)
  const projections = useMemo(() => {
    if (dailyData.length < 2) return [];
    
    const n = dailyData.length;
    let sumX = 0;
    let sumY = 0;
    let sumXY = 0;
    let sumXX = 0;
    
    dailyData.forEach((d, i) => {
      sumX += i;
      sumY += d.total;
      sumXY += i * d.total;
      sumXX += i * i;
    });
    
    const denominator = (n * sumXX - sumX * sumX);
    if (denominator === 0) return [];
    
    const slope = (n * sumXY - sumX * sumY) / denominator;
    const intercept = (sumY - slope * sumX) / n;
    
    const nextDays = [];
    const lastDate = endDate ? new Date(endDate) : new Date();
    
    for (let i = 1; i <= 7; i++) {
      const d = new Date(lastDate);
      d.setDate(d.getDate() + i);
      const dateStr = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
      const projectedValue = Math.max(0, slope * (n + i - 1) + intercept);
      nextDays.push({ 
        date: dateStr, 
        projectedTotal: projectedValue, 
        isProjection: true 
      });
    }
    
    return nextDays;
  }, [dailyData, endDate]);

  const combinedTrendData = useMemo(() => {
    const data = dailyData.map(d => ({ ...d, realTotal: d.total }));
    if (data.length > 0 && projections.length > 0) {
      const lastReal = data[data.length - 1];
      const firstProj = { ...projections[0], projectedTotal: lastReal.realTotal };
      return [...data, firstProj, ...projections.slice(1)];
    }
    return data;
  }, [dailyData, projections]);

  // Stats
  const stats = useMemo(() => {
    const now = new Date();
    let currentCutoff: Date;
    let previousCutoff: Date;

    if (startDate && endDate) {
      currentCutoff = new Date(startDate);
      const diff = new Date(endDate).getTime() - new Date(startDate).getTime();
      previousCutoff = new Date(currentCutoff.getTime() - diff);
    } else {
      const rangeDays = parseInt(dateRange);
      currentCutoff = new Date();
      currentCutoff.setDate(now.getDate() - rangeDays);
      previousCutoff = new Date();
      previousCutoff.setDate(now.getDate() - (rangeDays * 2));
    }

    const currentPeriodWO = workOrders.filter(wo => {
      const d = wo.createdAt;
      return d >= currentCutoff && (!selectedEmployeeId || String(wo.employeeId) === String(selectedEmployeeId));
    });

    const previousPeriodWO = workOrders.filter(wo => {
      const d = wo.createdAt;
      return d >= previousCutoff && d < currentCutoff && (!selectedEmployeeId || String(wo.employeeId) === String(selectedEmployeeId));
    });

    // Current Period Metrics
    const totalRevenue = currentPeriodWO.reduce((sum, wo) => sum + (wo.partsCost || 0) + (wo.laborCost || 0), 0);
    const totalParts = currentPeriodWO.reduce((sum, wo) => sum + (wo.partsCost || 0), 0);
    const totalLabor = currentPeriodWO.reduce((sum, wo) => sum + (wo.laborCost || 0), 0);
    const avgTicket = currentPeriodWO.length > 0 ? totalRevenue / currentPeriodWO.length : 0;
    
    const completed = currentPeriodWO.filter(wo => wo.status === 'completed' || wo.status === 'finalizado').length;
    const productivity = currentPeriodWO.length > 0 ? (completed / currentPeriodWO.length) * 100 : 0;

    // Previous Period Metrics
    const prevRevenue = previousPeriodWO.reduce((sum, wo) => sum + (wo.partsCost || 0) + (wo.laborCost || 0), 0);
    const prevAvgTicket = previousPeriodWO.length > 0 ? prevRevenue / previousPeriodWO.length : 0;
    const prevCount = previousPeriodWO.length;

    // Parts Cost
    const currentPeriodPO = purchaseOrders.filter(po => {
      const d = po.createdAt;
      return d >= currentCutoff && po.paymentStatus === 'pago';
    });
    const totalPartsCost = currentPeriodPO.reduce((sum, po) => sum + (po.total || 0), 0);
    const partsProfit = totalParts - totalPartsCost;
    const netProfit = totalLabor + partsProfit;

    const calcTrend = (curr: number, prev: number) => {
      if (prev === 0) return curr > 0 ? '+100%' : '0%';
      const diff = ((curr - prev) / prev) * 100;
      return `${diff > 0 ? '+' : ''}${diff.toFixed(1)}%`;
    };

    // Margin Trend calculation
    const currentMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;
    const prevParts = previousPeriodWO.reduce((sum, wo) => sum + (wo.partsCost || 0), 0);
    const prevLabor = previousPeriodWO.reduce((sum, wo) => sum + (wo.laborCost || 0), 0);
    const prevNetProfit = prevLabor + (prevParts * 0.3); // Approximate 30% margin on parts for comparison
    const prevMargin = prevRevenue > 0 ? (prevNetProfit / prevRevenue) * 100 : 0;

    return {
      totalRevenue,
      totalParts,
      totalLabor,
      totalPartsCost,
      partsProfit,
      netProfit,
      avgTicket,
      productivity: productivity.toFixed(0) + '%',
      count: currentPeriodWO.length,
      trends: {
        revenue: calcTrend(totalRevenue, prevRevenue),
        ticket: calcTrend(avgTicket, prevAvgTicket),
        count: calcTrend(currentPeriodWO.length, prevCount),
        margin: calcTrend(currentMargin, prevMargin),
        breakeven: 'Est. Operacional'
      }
    };
  }, [workOrders, purchaseOrders, selectedEmployeeId, dateRange, startDate, endDate]);

  const pieData = [
    { name: 'Peças', value: stats.totalParts },
    { name: 'Mão de Obra', value: stats.totalLabor },
  ];

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  const generatePDF = () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    
    const hasRazao = profile?.companyName && profile?.companyName !== profile?.tradeName;
    const businessMainName = hasRazao ? profile.companyName : (profile?.fullName || profile?.name || 'Service Hub Pro');
    const businessSubName = profile?.tradeName && profile?.tradeName !== businessMainName ? profile.tradeName : '';
    const businessDoc = profile?.cnpj ? `CNPJ: ${profile.cnpj}` : (profile?.ownerCpf ? `CPF: ${profile.ownerCpf}` : '');
    const businessAddress = profile?.address ? `${profile.address.street}, ${profile.address.number} - ${profile.address.city}/${profile.address.state}` : '';
    const businessContact = profile?.phone ? `Tel: ${profile.phone}` : (profile?.email ? `Email: ${profile.email}` : '');

    doc.setFillColor(15, 23, 42); 
    doc.rect(0, 0, pageWidth, 50, 'F');
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.setFont('helvetica', 'bold');
    doc.text('Relatório Financeiro Executivo', 14, 22);
    
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(148, 163, 184);
    doc.text(`PERÍODO: ${startDate || 'Início'} a ${endDate || 'Hoje'}`, 14, 32);
    doc.text(`EMISSÃO: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, 14, 38);

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text(businessMainName.toUpperCase(), pageWidth - 14, 22, { align: 'right' });
    
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    if (businessSubName) doc.text(businessSubName, pageWidth - 14, 28, { align: 'right' });
    doc.text(businessDoc, pageWidth - 14, 34, { align: 'right' });
    
    doc.setFontSize(8);
    doc.setTextColor(203, 213, 225);
    if (businessAddress) doc.text(businessAddress, pageWidth - 14, 40, { align: 'right' });
    if (businessContact) doc.text(businessContact, pageWidth - 14, 45, { align: 'right' });

    doc.setFillColor(248, 250, 252);
    doc.rect(14, 60, pageWidth - 28, 40, 'F');
    doc.setDrawColor(226, 232, 240);
    doc.rect(14, 60, pageWidth - 28, 40, 'D');

    doc.setTextColor(71, 85, 105);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text('RECEITA TOTAL BRUTA', 22, 75);
    doc.text('LUCRO LÍQUIDO ESTIMADO', 85, 75);
    doc.text('TICKET MÉDIO', 155, 75);

    doc.setTextColor(15, 23, 42);
    doc.setFontSize(15);
    doc.text(formatCurrency(stats.totalRevenue), 22, 88);
    doc.text(formatCurrency(stats.netProfit), 85, 88);
    doc.text(formatCurrency(stats.avgTicket), 155, 88);

    doc.setTextColor(31, 41, 55);
    doc.setFontSize(16);
    doc.text('1. Métricas de Performance Financeira', 14, 105);
    
    autoTable(doc, {
      startY: 110,
      head: [['Indicador de Negócio', 'Valor Consolidado', 'Participação']],
      body: [
        ['Faturamento Total', formatCurrency(stats.totalRevenue), '100%'],
        ['Entrada vía Peças', formatCurrency(stats.totalParts), `${((stats.totalParts / (stats.totalRevenue || 1)) * 100).toFixed(1)}%`],
        ['Entrada vía Mão de Obra', formatCurrency(stats.totalLabor), `${((stats.totalLabor / (stats.totalRevenue || 1)) * 100).toFixed(1)}%`],
        ['Ticket Médio por Atendimento', formatCurrency(stats.avgTicket), '-'],
        ['Volume de Transações (OS)', stats.count.toString(), '-'],
      ],
      headStyles: { fillColor: [102, 115, 232] },
      styles: { cellPadding: 5 },
    });

    const nextY = (doc as any).lastAutoTable.finalY + 15;
    doc.text('2. Fluxo de Caixa Diário (Período Selecionado)', 14, nextY);
    
    autoTable(doc, {
      startY: nextY + 5,
      head: [['Data', 'Receita Peças', 'Receita Mão Obra', 'Total Bruto']],
      body: dailyData.slice(-15).reverse().map(d => [
        d.date,
        formatCurrency(d.parts),
        formatCurrency(d.labor),
        formatCurrency(d.total)
      ]),
      headStyles: { fillColor: [139, 92, 246] },
    });

    doc.save(`Relatorio_Financeiro_Hub_${format(new Date(), 'yyyyMMdd')}.pdf`);
  };

  const handleExcelExport = () => {
    const exportData = filteredWorkOrders.map(wo => ({
      ID: wo.id.substring(0, 6),
      Data: format(wo.createdAt, 'dd/MM/yyyy'),
      Cliente: wo.customerName || 'N/A',
      Veículo: wo.vehicleInfo || wo.model || 'N/A',
      'Custo Peças': wo.partsCost || 0,
      'Preço Mão de Obra': wo.laborCost || 0,
      Total: (wo.partsCost || 0) + (wo.laborCost || 0),
      Status: wo.status || 'Pendente'
    }));
    exportToExcel(exportData, 'Financeiro_WorkOrders', 'Vendas');
  };

  return (
    <div className="p-6 bg-gray-50 dark:bg-gray-900 min-h-screen">
      <div className="max-w-7xl mx-auto">
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
          <div>
            <h2 className="text-3xl font-black text-gray-900 dark:text-white tracking-tight">Painel Financeiro</h2>
            <p className="text-gray-500 dark:text-gray-400">Acompanhe o desempenho e projeções da sua oficina</p>
          </div>
          
          {profile?.role !== 'manager' && (
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Período Sugerido</span>
                <div className="flex items-center bg-white dark:bg-gray-800 rounded-2xl p-1 shadow-sm border border-gray-100 dark:border-gray-700">
                  <button 
                    onClick={() => { setDateRange('7'); setStartDate(''); setEndDate(''); }}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${dateRange === '7' && !startDate ? 'bg-indigo-600 text-white shadow-md' : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'}`}
                  >
                    7D
                  </button>
                  <button 
                    onClick={() => { setDateRange('30'); setStartDate(''); setEndDate(''); }}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${dateRange === '30' && !startDate ? 'bg-indigo-600 text-white shadow-md' : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'}`}
                  >
                    30D
                  </button>
                  <button 
                    onClick={() => { setDateRange('90'); setStartDate(''); setEndDate(''); }}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${dateRange === '90' && !startDate ? 'bg-indigo-600 text-white shadow-md' : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'}`}
                  >
                    90D
                  </button>
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Filtro Customizado</span>
                <div className="flex items-center gap-2 bg-white dark:bg-gray-800 p-1 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm">
                  <input 
                    type="date" 
                    value={startDate} 
                    onChange={(e) => setStartDate(e.target.value)}
                    className="bg-transparent border-none text-xs font-bold text-gray-600 dark:text-gray-300 outline-none p-1"
                  />
                  <span className="text-gray-300">|</span>
                  <input 
                    type="date" 
                    value={endDate} 
                    onChange={(e) => setEndDate(e.target.value)}
                    className="bg-transparent border-none text-xs font-bold text-gray-600 dark:text-gray-300 outline-none p-1"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Exportar</span>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={handleExcelExport}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-2xl shadow-lg shadow-emerald-500/20 transition-all font-bold text-xs flex items-center gap-2"
                  >
                    <Activity className="h-4 w-4" /> XLSX
                  </button>
                  <button 
                    onClick={generatePDF}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-2xl shadow-lg shadow-indigo-500/20 transition-all font-bold text-xs flex items-center gap-2"
                  >
                    <Download className="h-4 w-4" /> PDF
                  </button>
                </div>
              </div>
            </div>
          )}
        </header>

        <div className="bg-white dark:bg-gray-800 p-4 rounded-3xl border border-gray-100 dark:border-gray-700 flex items-center shadow-sm mb-8 max-w-md">
            <div className="p-2 bg-indigo-50 dark:bg-indigo-900/30 rounded-full mr-3">
              <Wrench className="h-5 w-5 text-indigo-600" />
            </div>
            <select
              value={selectedEmployeeId}
              onChange={(e) => setSelectedEmployeeId(e.target.value)}
              className="flex-1 bg-transparent border-none text-sm font-bold text-gray-600 dark:text-gray-300 outline-none"
            >
              <option value="">Todos os Mecânicos</option>
              {employees.map(emp => <option key={emp.id} value={emp.id}>{emp.name}</option>)}
            </select>
         </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <StatCard 
            title="Receita Total" 
            value={formatCurrency(stats.totalRevenue)} 
            icon={<DollarSign className="h-6 w-6 text-emerald-600" />}
            trend={stats.trends.revenue}
            isUp={!stats.trends.revenue.startsWith('-')}
            color="emerald"
          />
          <StatCard 
            title="Margem de Contribuição" 
            value={`${((stats.netProfit / (stats.totalRevenue || 1)) * 100).toFixed(1)}%`} 
            icon={<TrendingUp className="h-6 w-6 text-indigo-600" />}
            trend={stats.trends.margin}
            isUp={!stats.trends.margin.startsWith('-')}
            color="indigo"
          />
          <StatCard 
            title="Ponto de Equilíbrio" 
            value={formatCurrency(stats.totalPartsCost * 1.45)} 
            icon={<TrendingDown className="h-6 w-6 text-rose-600" />}
            trend={stats.trends.breakeven}
            isUp={false}
            color="rose"
          />
          <StatCard 
            title="Ticket Médio" 
            value={formatCurrency(stats.avgTicket)} 
            icon={<Wrench className="h-6 w-6 text-amber-600" />}
            trend={stats.trends.ticket}
            isUp={!stats.trends.ticket.startsWith('-')}
            color="amber"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
          <div className="lg:col-span-2 bg-white dark:bg-gray-800 p-8 rounded-[2.5rem] shadow-xl border border-gray-100 dark:border-gray-700">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h3 className="text-xl font-black text-gray-900 dark:text-white flex items-center gap-2 uppercase tracking-tight">
                  <LineIcon className="h-5 w-5 text-indigo-600" /> Performance e Projeções
                </h3>
              </div>
            </div>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={combinedTrendData}>
                  <defs>
                    <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 700 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 700 }} tickFormatter={(value) => `R$ ${value}`} />
                  <Tooltip contentStyle={{ backgroundColor: '#fff', borderRadius: '20px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)' }} formatter={(value: number) => [formatCurrency(value), 'Receita']} />
                  <Area type="monotone" dataKey="realTotal" stroke="#6366f1" strokeWidth={4} fillOpacity={1} fill="url(#colorTotal)" />
                  <Area type="monotone" dataKey="projectedTotal" stroke="#6366f1" strokeWidth={4} strokeDasharray="8 8" fillOpacity={0} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 p-8 rounded-[2.5rem] shadow-xl border border-gray-100 dark:border-gray-700">
            <h3 className="text-xl font-black text-gray-900 dark:text-white mb-8 flex items-center gap-2 uppercase tracking-tight">
              <PieIcon className="h-5 w-5 text-purple-600" /> Mix de Receita
            </h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={65} outerRadius={85} paddingAngle={10} dataKey="value">
                    {pieData.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} stroke="none" />)}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: '16px', border: 'none' }} formatter={(value: number) => formatCurrency(value)} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-8 space-y-4">
              {pieData.map((item, i) => (
                <div key={item.name} className="flex items-center justify-between p-3 rounded-2xl bg-gray-50 dark:bg-gray-900/50">
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[i] }}></div>
                    <span className="text-xs font-black text-gray-400 uppercase tracking-widest">{item.name}</span>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-tighter">
                      {((item.value / stats.totalRevenue) * 100 || 0).toFixed(1)}%
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="bg-white dark:bg-gray-800 rounded-[2.5rem] shadow-xl border border-gray-100 dark:border-gray-700 overflow-hidden p-8">
            <h3 className="text-xl font-black text-gray-900 dark:text-white flex items-center gap-2 uppercase tracking-tight mb-8">
              <BarChart3 className="h-5 w-5 text-amber-600" /> Histórico Diário
            </h3>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dailyData.slice(-15)}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 700 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 700 }} />
                  <Tooltip formatter={(value: number) => formatCurrency(value)} />
                  <Bar dataKey="parts" fill="#818cf8" radius={[10, 10, 0, 0]} name="Peças" barSize={15} />
                  <Bar dataKey="labor" fill="#c084fc" radius={[10, 10, 0, 0]} name="Mão de Obra" barSize={15} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-[2.5rem] shadow-xl border border-gray-100 dark:border-gray-700 overflow-hidden p-8">
            <h3 className="text-xl font-black text-gray-900 dark:text-white flex items-center gap-2 uppercase tracking-tight mb-8">
              <Activity className="h-5 w-5 text-emerald-600" /> DRE - Resumo Executivo
            </h3>
            <div className="space-y-4">
              <DRELine label="Receita Bruta" value={stats.totalRevenue} isMain />
              <DRELine label="(-) Custo de Peças" value={-stats.totalPartsCost} />
              <DRELine label="MARGEM BRUTA" value={stats.totalRevenue - stats.totalPartsCost} isHighlight />
              <DRELine label="LUCRO LÍQUIDO OPERACIONAL" value={stats.netProfit} isTotal />
            </div>
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
    rose: "bg-rose-50 dark:bg-rose-900/20 text-rose-600",
  };
  return (
    <motion.div whileHover={{ y: -5 }} className="bg-white dark:bg-gray-800 p-6 rounded-3xl shadow-lg border border-gray-100 dark:border-gray-700">
      <div className="flex items-center justify-between mb-4">
        <div className={`p-4 rounded-2xl ${colorClasses[color]}`}>{icon}</div>
        <div className={`flex items-center gap-1 text-[10px] font-black uppercase px-2 py-1 rounded-xl ${isUp ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
          {isUp ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />} {trend}
        </div>
      </div>
      <h4 className="text-gray-400 text-[10px] font-black uppercase mb-1">{title}</h4>
      <p className="text-2xl font-black text-gray-900 dark:text-white">{value}</p>
    </motion.div>
  );
}

function DRELine({ label, value, isMain, isHighlight, isTotal }: any) {
  const formatCurrency = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  return (
    <div className={`flex items-center justify-between p-3 rounded-xl ${isTotal ? 'bg-indigo-600 text-white shadow-lg' : isHighlight ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-900 dark:text-indigo-100' : isMain ? 'bg-gray-50 dark:bg-gray-900/50' : 'text-gray-500'}`}>
      <span className="text-xs font-black uppercase tracking-widest">{label}</span>
      <span className="text-sm font-black">{formatCurrency(value)}</span>
    </div>
  );
}
