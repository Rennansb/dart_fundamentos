import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../AuthContext';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area
} from 'recharts';
import { db } from '../../firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { 
  Wrench, CheckCircle2, AlertCircle, 
  TrendingUp, Users, Calendar, ArrowUpRight, 
  ArrowDownRight, Download, Activity, ClipboardList, Timer
} from 'lucide-react';
import { motion } from 'framer-motion';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import SupplierOperationalReport from './SupplierOperationalReport';
import { exportToExcel } from '../../utils/exportUtils';

const COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#f97316', '#eab308', '#22c55e', '#06b6d4'];

export default function OperationalReports() {
  const { profile } = useAuth();
  const [employees, setEmployees] = useState<any[]>([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [workOrders, setWorkOrders] = useState<any[]>([]);
  const [quotes, setQuotes] = useState<any[]>([]);
  const [dateRange, setDateRange] = useState('30');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  if (profile?.role === 'fornecedor') {
    return <SupplierOperationalReport />;
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
          createdAt: doc.data().createdAt?.toDate?.() || (doc.data().createdAt ? new Date(doc.data().createdAt) : new Date()),
          updatedAt: doc.data().updatedAt?.toDate?.() || (doc.data().updatedAt ? new Date(doc.data().updatedAt) : null)
        }));
        setWorkOrders(data);
        setIsLoading(false);
      });

      const qQuotes = query(collection(db, 'quotes'), where('companyId', '==', profile.companyId));
      const unsubQuotes = onSnapshot(qQuotes, (snapshot) => {
        const data = snapshot.docs.map(doc => ({ 
          id: doc.id, 
          ...doc.data(),
          createdAt: doc.data().createdAt?.toDate?.() || (doc.data().createdAt ? new Date(doc.data().createdAt) : new Date())
        }));
        setQuotes(data);
      });

      return () => {
        unsubEmployees();
        unsubscribe();
        unsubQuotes();
      };
    }
  }, [profile]);

  const filteredWorkOrders = useMemo(() => {
    let filtered = workOrders;
    
    if (selectedEmployeeId) {
      filtered = filtered.filter(wo => String(wo.employeeId) === String(selectedEmployeeId));
    }
    
    if (startDate || endDate) {
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
      map.set(dateStr, { date: dateStr, services: 0, completed: 0, pending: 0 });
    }

    filteredWorkOrders.forEach(wo => {
      const date = wo.createdAt;
      const dateStr = date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
      
      if (map.has(dateStr)) {
        const entry = map.get(dateStr);
        entry.services += (wo.services || []).length;
        if (wo.status === 'completed' || wo.status === 'finalizado') {
          entry.completed += 1;
        } else {
          entry.pending += 1;
        }
      }
    });

    return Array.from(map.values());
  }, [filteredWorkOrders, dateRange, startDate, endDate]);

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
      const date = wo.createdAt;
      return date >= currentCutoff && (!selectedEmployeeId || String(wo.employeeId) === String(selectedEmployeeId));
    });

    const previousPeriodWO = workOrders.filter(wo => {
      const date = wo.createdAt;
      return date >= previousCutoff && date < currentCutoff && (!selectedEmployeeId || String(wo.employeeId) === String(selectedEmployeeId));
    });

    const totalServices = currentPeriodWO.reduce((sum, wo) => sum + (wo.services || []).length, 0);
    const completed = currentPeriodWO.filter(wo => wo.status === 'completed' || wo.status === 'finalizado').length;
    const pending = currentPeriodWO.length - completed;
    const completionRate = currentPeriodWO.length > 0 ? (completed / currentPeriodWO.length) * 100 : 0;

    const completedWOs = currentPeriodWO.filter(wo => (wo.status === 'completed' || wo.status === 'finalizado') && wo.updatedAt && wo.createdAt);
    let totalMinutes = 0;
    completedWOs.forEach(wo => {
      const start = wo.createdAt;
      const end = wo.updatedAt;
      if (!start || !end) return;
      const diffMs = Math.max(0, end.getTime() - start.getTime());
      totalMinutes += diffMs / (1000 * 60);
    });
    const avgHours = completedWOs.length > 0 ? (totalMinutes / completedWOs.length) / 60 : 0;

    const prevTotalServices = previousPeriodWO.reduce((sum, wo) => sum + (wo.services || []).length, 0);
    const prevCompleted = previousPeriodWO.filter(wo => wo.status === 'completed' || wo.status === 'finalizado').length;

    const calcTrend = (curr: number, prev: number) => {
      if (prev === 0) return curr > 0 ? '+100%' : '0%';
      const diff = ((curr - prev) / prev) * 100;
      return `${diff > 0 ? '+' : ''}${diff.toFixed(1)}%`;
    };

    const prevCompletedWOs = previousPeriodWO.filter(wo => (wo.status === 'completed' || wo.status === 'finalizado') && wo.updatedAt && wo.createdAt);
    let prevTotalMinutes = 0;
    prevCompletedWOs.forEach(wo => {
      const start = wo.createdAt;
      const end = wo.updatedAt;
      if (!start || !end) return;
      prevTotalMinutes += Math.max(0, end.getTime() - start.getTime()) / (1000 * 60);
    });
    const prevAvgHours = prevCompletedWOs.length > 0 ? (prevTotalMinutes / prevCompletedWOs.length) / 60 : 0;

    return {
      totalServices,
      completed,
      pending,
      completionRate,
      avgHours: avgHours.toFixed(1) + 'h',
      count: currentPeriodWO.length,
      trends: {
        services: calcTrend(totalServices, prevTotalServices),
        completion: calcTrend(completed, prevCompleted),
        pending: calcTrend(pending, (previousPeriodWO.length - prevCompleted)),
        avgTime: calcTrend(avgHours, prevAvgHours)
      }
    };
  }, [workOrders, selectedEmployeeId, dateRange, startDate, endDate]);

  const serviceTypeData = useMemo(() => {
    const types: Record<string, number> = {};
    filteredWorkOrders.forEach(wo => {
      (wo.services || []).forEach((s: any) => {
        const name = s.description || 'Outros';
        types[name] = (types[name] || 0) + 1;
      });
    });
    return Object.entries(types)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
  }, [filteredWorkOrders]);

  const funnelData = useMemo(() => {
    let periodQuotes = quotes;
    let periodWO = filteredWorkOrders;

    if (startDate || endDate) {
      if (startDate) {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        periodQuotes = periodQuotes.filter(q => q.createdAt >= start);
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        periodQuotes = periodQuotes.filter(q => q.createdAt <= end);
      }
    } else {
      const rangeDays = parseInt(dateRange);
      const cutoff = new Date();
      cutoff.setDate(new Date().getDate() - rangeDays);
      periodQuotes = periodQuotes.filter(q => q.createdAt >= cutoff);
    }

    const activeWO = periodWO.filter(wo => wo.status !== 'completed' && wo.status !== 'finalizado');
    const completedWO = periodWO.filter(wo => wo.status === 'completed' || wo.status === 'finalizado');

    return [
      { name: 'Orçamentos', value: periodQuotes.length, fill: '#6366f1' },
      { name: 'OS Abertas', value: periodWO.length, fill: '#8b5cf6' },
      { name: 'Em Execução', value: activeWO.length, fill: '#ec4899' },
      { name: 'Finalizadas', value: completedWO.length, fill: '#10b981' },
    ];
  }, [quotes, filteredWorkOrders, dateRange, startDate, endDate]);

  const generatePDF = () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const employeeName = selectedEmployeeId ? employees.find(e => e.id === selectedEmployeeId)?.name : 'Todos';

    const hasRazao = profile?.companyName && profile?.companyName !== profile?.tradeName;
    const businessMainName = hasRazao ? profile.companyName : (profile?.fullName || profile?.name || 'Service Hub Pro');
    const businessSubName = profile?.tradeName && profile?.tradeName !== businessMainName ? profile.tradeName : '';
    const businessDoc = profile?.cnpj ? `CNPJ: ${profile.cnpj}` : (profile?.ownerCpf ? `CPF: ${profile.ownerCpf}` : '');
    const businessAddress = profile?.address ? `${profile.address.street}, ${profile.address.number} - ${profile.address.city}/${profile.address.state}` : '';
    const businessContact = profile?.phone ? `Tel: ${profile.phone}` : (profile?.email ? `Email: ${profile.email}` : '');

    doc.setFillColor(30, 41, 59);
    doc.rect(0, 0, pageWidth, 50, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.setFont('helvetica', 'bold');
    doc.text('Relatório de Performance Operacional', 14, 22);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(148, 163, 184);
    doc.text(`TÉCNICO: ${employeeName.toUpperCase()}`, 14, 32);
    doc.text(`PERÍODO: ${startDate || 'Início'} a ${endDate || 'Hoje'}`, 14, 37);
    doc.text(`GERADO EM: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, 14, 42);

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text(businessMainName.toUpperCase(), pageWidth - 14, 22, { align: 'right' });
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    if (businessSubName) doc.text(businessSubName, pageWidth - 14, 28, { align: 'right' });
    doc.text(businessDoc, pageWidth - 14, 33, { align: 'right' });
    doc.setFontSize(8);
    doc.setTextColor(203, 213, 225);
    if (businessAddress) doc.text(businessAddress, pageWidth - 14, 39, { align: 'right' });
    if (businessContact) doc.text(businessContact, pageWidth - 14, 44, { align: 'right' });

    doc.setTextColor(30, 41, 59);
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('1. Indicadores de Produtividade e Conversão', 14, 65);
    
    autoTable(doc, {
      startY: 65,
      head: [['Métrica Operacional', 'Resultado Obtido', 'Impacto']],
      body: [
        ['Volume de Ordens de Serviço', stats.count.toString(), 'Capacidade Produtiva'],
        ['Total de Serviços Executados', stats.totalServices.toString(), 'Volume de Trabalho'],
        ['Taxa de Conclusão (SLA)', `${stats.completionRate.toFixed(1)}%`, 'Eficiência de Entrega'],
        ['Ordens Pendentes/Atrasadas', stats.pending.toString(), 'Risco de Gargalo'],
      ],
      headStyles: { fillColor: [79, 70, 229] },
      styles: { cellPadding: 5 },
    });

    const nextY = (doc as any).lastAutoTable.finalY + 15;
    doc.text('2. Ranking de Serviços (Top 5)', 14, nextY);
    autoTable(doc, {
      startY: nextY + 5,
      head: [['Serviço', 'Quantidade', '% do Total']],
      body: serviceTypeData.map(s => [s.name, s.value.toString(), `${((s.value / (stats.totalServices || 1)) * 100).toFixed(1)}%`]),
      headStyles: { fillColor: [139, 92, 246] },
    });

    doc.save(`Relatorio_Operacional_${format(new Date(), 'yyyyMMdd')}.pdf`);
  };

  const handleExcelExport = () => {
    const exportData = filteredWorkOrders.map(wo => ({
      ID: wo.id.substring(0, 6),
      Data: format(wo.createdAt, 'dd/MM/yyyy'),
      Cliente: wo.customerName || 'N/A',
      Mecânico: employees.find(e => e.id === wo.employeeId)?.name || 'N/A',
      Serviços: (wo.services || []).length,
      Status: wo.status || 'Pendente',
      Criado: format(wo.createdAt, 'dd/MM/yyyy HH:mm'),
      Finalizado: wo.updatedAt ? format(wo.updatedAt, 'dd/MM/yyyy HH:mm') : '-'
    }));
    exportToExcel(exportData, 'Operacional_OS', 'Produtividade');
  };

  return (
    <div className="p-6 bg-gray-50 dark:bg-gray-900 min-h-screen">
      <div className="max-w-7xl mx-auto">
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
          <div>
            <h2 className="text-3xl font-black text-gray-900 dark:text-white tracking-tight">Painel Operacional</h2>
            <p className="text-gray-500 dark:text-gray-400">Eficiência, produtividade e fluxo de trabalho</p>
          </div>
          
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Periodo Sugerido</span>
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
              <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Filtro por Data</span>
              <div className="flex items-center gap-2 bg-white dark:bg-gray-800 p-1 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm text-xs font-bold">
                <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="bg-transparent border-none outline-none text-gray-600 dark:text-gray-300 p-1" />
                <span className="text-gray-300">|</span>
                <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="bg-transparent border-none outline-none text-gray-600 dark:text-gray-300 p-1" />
              </div>
            </div>

            <div className="flex flex-col gap-1">
               <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Exportar</span>
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

        <div className="bg-white dark:bg-gray-800 p-1.5 rounded-full border border-gray-100 dark:border-gray-700 flex items-center shadow-sm mb-8 max-w-md">
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
          <StatCard title="Total de Serviços" value={stats.totalServices.toString()} icon={<ClipboardList className="h-6 w-6 text-indigo-600" />} trend={stats.trends.services} isUp={!stats.trends.services.startsWith('-')} color="indigo" />
          <StatCard title="Taxa de Conclusão" value={`${stats.completionRate.toFixed(1)}%`} icon={<CheckCircle2 className="h-6 w-6 text-emerald-600" />} trend={stats.trends.completion} isUp={!stats.trends.completion.startsWith('-')} color="emerald" />
          <StatCard title="Tempo Médio" value={stats.avgHours} icon={<Timer className="h-6 w-6 text-amber-600" />} trend={stats.trends.avgTime} isUp={stats.trends.avgTime.startsWith('-')} color="amber" />
          <StatCard title="Em Aberto" value={stats.pending.toString()} icon={<AlertCircle className="h-6 w-6 text-rose-600" />} trend={stats.trends.pending} isUp={stats.trends.pending.startsWith('-')} color="rose" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
          <div className="lg:col-span-2 bg-white dark:bg-gray-800 p-8 rounded-[2.5rem] shadow-xl border border-gray-100 dark:border-gray-700">
            <h3 className="text-xl font-black text-gray-900 dark:text-white mb-8 flex items-center gap-2 uppercase tracking-tight">
              <Activity className="h-5 w-5 text-indigo-600" /> Volume de Serviços e Engajamento
            </h3>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={dailyData}>
                  <defs>
                    <linearGradient id="colorServices" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 700 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 700 }} />
                  <Tooltip contentStyle={{ borderRadius: '20px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)', padding: '12px' }} />
                  <Area type="monotone" dataKey="services" stroke="#6366f1" strokeWidth={4} fillOpacity={1} fill="url(#colorServices)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 p-8 rounded-[2.5rem] shadow-xl border border-gray-100 dark:border-gray-700">
            <h3 className="text-xl font-black text-gray-900 dark:text-white mb-8 flex items-center gap-2 uppercase tracking-tight">
              <Wrench className="h-5 w-5 text-purple-600" /> Especialidades
            </h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={serviceTypeData} cx="50%" cy="50%" innerRadius={65} outerRadius={85} paddingAngle={10} dataKey="value">
                    {serviceTypeData.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} stroke="none" />)}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-8 space-y-4">
              {serviceTypeData.map((item, i) => (
                <div key={item.name} className="flex items-center justify-between p-3 rounded-2xl bg-gray-50 dark:bg-gray-900/50 text-[10px] font-black text-gray-400 uppercase tracking-widest uppercase">
                  <span>{item.name}</span>
                  <span className="text-gray-900 dark:text-white text-sm">{item.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="bg-white dark:bg-gray-800 p-8 rounded-[2.5rem] shadow-xl border border-gray-100 dark:border-gray-700">
            <h3 className="text-xl font-black text-gray-900 dark:text-white mb-8 flex items-center gap-2 uppercase tracking-tight">
              <TrendingUp className="h-5 w-5 text-indigo-600" /> Funil de Conversão
            </h3>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart layout="vertical" data={funnelData} margin={{ left: 20 }}>
                  <XAxis type="number" hide />
                  <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 900 }} />
                  <Tooltip cursor={{ fill: 'transparent' }} contentStyle={{ borderRadius: '16px', border: 'none' }} />
                  <Bar dataKey="value" radius={[0, 10, 10, 0]} barSize={40}>
                    {funnelData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.fill} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-[2.5rem] shadow-xl border border-gray-100 dark:border-gray-700 p-8">
            <h3 className="text-xl font-black text-gray-900 dark:text-white mb-8 flex items-center gap-2 uppercase tracking-tight">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" /> Status das Ordens de Serviço
            </h3>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dailyData.slice(-15)}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 700 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 700 }} />
                  <Tooltip contentStyle={{ borderRadius: '20px', border: 'none', padding: '12px' }} />
                  <Legend iconType="circle" />
                  <Bar dataKey="completed" fill="#10b981" radius={[10, 10, 0, 0]} name="Concluídas" barSize={15} />
                  <Bar dataKey="pending" fill="#f43f5e" radius={[10, 10, 0, 0]} name="Pendentes" barSize={15} />
                </BarChart>
              </ResponsiveContainer>
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
    purple: "bg-purple-50 dark:bg-purple-900/20 text-purple-600",
    amber: "bg-amber-50 dark:bg-amber-900/20 text-amber-600",
    rose: "bg-rose-50 dark:bg-rose-900/20 text-rose-600",
  };
  return (
    <motion.div whileHover={{ y: -5 }} className="bg-white dark:bg-gray-800 p-6 rounded-3xl shadow-lg border border-gray-100 dark:border-gray-700 transition-all">
      <div className="flex items-center justify-between mb-4">
        <div className={`p-4 rounded-2xl ${colorClasses[color]}`}>{icon}</div>
        <div className={`flex items-center gap-1 text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-xl ${isUp ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
          {isUp ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />} {trend}
        </div>
      </div>
      <h4 className="text-gray-400 text-[10px] font-black uppercase tracking-widest mb-1">{title}</h4>
      <p className="text-2xl font-black text-gray-900 dark:text-white">{value}</p>
    </motion.div>
  );
}
