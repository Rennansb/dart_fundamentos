import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { 
  Users, 
  Package, 
  Download, 
  Clock, 
  DollarSign,
  Activity,
  TrendingUp,
  Brain,
  ClipboardList,
  Store,
  X,
  MessageSquare,
  Package as PackageIcon,
  AlertCircle,
  PieChart as PieChartIcon,
  Heart,
  Zap,
  BarChart3,
  RefreshCcw,
  Plus,
  Car,
  FileText,
  Layout,
  ChevronRight,
  Crown,
  ShoppingBag,
  Bike,
  Loader2,
  Camera,
  Sparkles,
  Palette,
  Fuel,
  User,
  Hash
} from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  AreaChart, Area, PieChart, Pie, Cell
} from 'recharts';
import { motion, AnimatePresence, useSpring, useTransform } from 'framer-motion';
import { db } from '../firebase';
import { collection, query, where, onSnapshot, orderBy, limit, getDocs, addDoc, serverTimestamp } from 'firebase/firestore';
import { format, subDays, startOfDay, endOfDay, isSameDay } from 'date-fns';
import { cn } from '../utils/cn';
import PlanExpiryWarning from '../components/PlanExpiryWarning';
import Kanban from './Kanban';
import { generateProfessionalReport } from '../services/invoiceGenerator';
import { formatDateBRT, getStartOfTodayBRT, getEndOfTodayBRT } from '../utils/dateUtils';
import { snapshotService } from '../services/snapshotService';
import { externalApi } from '../services/externalApiService';
import { checkPlanLimit } from '../utils/planLimits';
import { handleFirestoreError, OperationType } from '../utils/firestoreErrors';

const Sparkline = ({ data, color }: { data: any[], color: string }) => {
  if (!data || data.length === 0) return <div className="h-16 w-full flex items-center justify-center text-[8px] text-slate-500 uppercase">Sem Dados</div>;
  return (
    <div className="h-16 w-full opacity-80 group-hover:opacity-100 transition-opacity">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data}>
          <defs>
            <linearGradient id={`grad-${color}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.5}/>
              <stop offset="100%" stopColor={color} stopOpacity={0}/>
            </linearGradient>
          </defs>
          <Area 
            type="monotone" 
            dataKey="value" 
            stroke={color} 
            strokeWidth={3} 
            fillOpacity={1} 
            fill={`url(#grad-${color})`} 
            isAnimationActive={true}
            animationDuration={2000}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};

const AnimatedNumber = ({ value, prefix = "", suffix = "", decimals = 0 }: { value: number, prefix?: string, suffix?: string, decimals?: number }) => {
  const spring = useSpring(0, { mass: 1, stiffness: 70, damping: 20 });
  const display = useTransform(spring, (current) => {
    if (isNaN(value) || value === null || value === undefined) return prefix + "0" + suffix;
    const val = decimals > 0 ? current.toFixed(decimals) : Math.floor(current).toString();
    return `${prefix}${Number(val).toLocaleString('pt-BR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}${suffix}`;
  });

  useEffect(() => {
    if (!isNaN(value)) {
      spring.set(value);
    }
  }, [value, spring]);

  return <motion.span>{display}</motion.span>;
};

const CircularGauge = ({ value, label, color, size = 150 }: { value: number, label: string, color: string, size?: number }) => (
  <div className="flex flex-col items-center justify-center relative group" style={{ width: size, height: size }}>
    <div className="absolute inset-0 flex items-center justify-center flex-col z-10">
      <span className="text-2xl font-black text-white tracking-tighter text-glow" style={{ color }}>{value}%</span>
      <span className="text-[11px] font-black text-slate-500 uppercase tracking-widest">{label}</span>
    </div>
    <ResponsiveContainer width={size} height={size}>
      <PieChart>
        <Pie
          data={[
            { value: value, fill: color },
            { value: 100 - value, fill: 'rgba(255,255,255,0.05)' }
          ]}
          cx="50%"
          cy="50%"
          innerRadius={size * 0.35}
          outerRadius={size * 0.45}
          startAngle={90}
          endAngle={-270}
          paddingAngle={0}
          dataKey="value"
          stroke="none"
        >
          {[{ value: value, fill: color }, { value: 100 - value, fill: 'rgba(255,255,255,0.05)' }].map((entry, index) => (
            <Cell key={`cell-${index}`} fill={entry.fill} className={index === 0 ? "drop-shadow-[0_0_10px_rgba(255,255,255,0.5)]" : ""} />
          ))}
        </Pie>
      </PieChart>
    </ResponsiveContainer>
    <div className="absolute inset-2 border-2 border-dashed border-white/5 rounded-full animate-[spin_20s_linear_infinite]" />
  </div>
);

const WavyAreaChart = ({ data, color, height = 150 }: { data: any[], color: string, height?: number }) => (
  <div className="w-full" style={{ height }}>
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
        <defs>
          <linearGradient id={`colorWavy-${color}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={color} stopOpacity={0.4}/>
            <stop offset="95%" stopColor={color} stopOpacity={0}/>
          </linearGradient>
        </defs>
        <Area 
          type="monotone" 
          dataKey="value" 
          stroke={color} 
          strokeWidth={4} 
          fillOpacity={1} 
          fill={`url(#colorWavy-${color})`}
          dot={{ r: 4, fill: '#fff', strokeWidth: 2, stroke: color, className: "drop-shadow-[0_0_8px_rgba(255,255,255,0.8)]" }}
          activeDot={{ r: 6 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  </div>
);

const MetricSlideStack = ({ metrics }: { metrics: { label: string, value: number, color: string }[] }) => (
  <div className="w-full space-y-4">
    {metrics.map((m, i) => (
      <div key={i} className="space-y-1.5">
        <div className="flex justify-between items-center">
          <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">{m.label}</span>
          <span className="text-[10px] font-black text-white">{m.value}%</span>
        </div>
        <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden border border-white/5">
          <motion.div 
            initial={{ width: 0 }}
            animate={{ width: `${m.value}%` }}
            transition={{ duration: 1, delay: i * 0.1 }}
            className="h-full rounded-full"
            style={{ 
              backgroundColor: m.color, 
              boxShadow: `0 0 10px ${m.color}66`
            }}
          />
        </div>
      </div>
    ))}
  </div>
);

const CompactStatsList = ({ items }: { items: { label: string, value: string, trend: number }[] }) => (
  <div className="w-full space-y-3">
    {items.map((it, i) => (
      <div key={i} className="flex items-center justify-between group/it">
        <span className="text-[10px] font-bold text-slate-400 group-hover/it:text-white transition-colors uppercase tracking-tight">{it.label}</span>
        <div className="flex items-center gap-3">
          <span className="text-sm font-black text-white tracking-tighter">{it.value}</span>
          <span className={cn(
            "text-[9px] font-black uppercase px-2 py-0.5 rounded-md border",
            it.trend >= 0 ? "text-cyan-400 bg-cyan-400/10 border-cyan-400/20" : "text-magenta-400 bg-magenta-400/10 border-magenta-400/20"
          )}>
            {it.trend >= 0 ? '+' : ''}{it.trend}%
          </span>
        </div>
      </div>
    ))}
  </div>
);

const CustomPieChart = ({ data, colors, title }: { data: any[], colors: string[], title: string }) => (
  <div className="h-full w-full relative min-h-[100px]">
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius="60%"
          outerRadius="80%"
          paddingAngle={5}
          dataKey="value"
          isAnimationActive={true}
          stroke="none"
        >
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
          ))}
        </Pie>
        <Tooltip />
      </PieChart>
    </ResponsiveContainer>
  </div>
);

const DashboardSkeleton = () => (
  <div className="space-y-8 animate-in fade-in duration-700">
    <div className="h-12 w-64 bg-gray-200 dark:bg-gray-800 rounded-2xl animate-pulse" />
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {[1, 2, 3, 4].map(i => (
        <div key={i} className="h-32 bg-gray-200 dark:bg-gray-800 rounded-3xl animate-pulse" />
      ))}
    </div>
  </div>
);

const TacticalLegend = () => (
  <div className="flex flex-wrap gap-4 px-8 py-4 glass-mini rounded-3xl border border-white/5 bg-black/20 mb-8">
    <div className="flex items-center gap-2">
      <div className="w-2 h-2 rounded-full bg-[#00f2ff] shadow-[0_0_8px_#00f2ff]" />
      <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Financeiro</span>
    </div>
    <div className="flex items-center gap-2">
      <div className="w-2 h-2 rounded-full bg-[#ff00ff] shadow-[0_0_8px_#ff00ff]" />
      <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Operacional</span>
    </div>
    <div className="flex items-center gap-2">
      <div className="w-2 h-2 rounded-full bg-[#9d00ff] shadow-[0_0_8px_#9d00ff]" />
      <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Logística</span>
    </div>
    <div className="flex items-center gap-2">
      <div className="w-2 h-2 rounded-full bg-[#ff9d00] shadow-[0_0_8px_#ff9d00]" />
      <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Alertas</span>
    </div>
  </div>
);

export default function Dashboard() {
  const { user, profile, effectiveProfile, selectedCompanyId } = useAuth();
  const navigate = useNavigate();
  const [showKanbanModal, setShowKanbanModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [workOrders, setWorkOrders] = useState<any[]>([]);
  const [inventory, setInventory] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [supplierOrders, setSupplierOrders] = useState<any[]>([]);
  const [period, setPeriod] = useState<'week' | 'month'>('week');
  const [aiInsight, setAiInsight] = useState<string>('Analisando dados estratégicos...');
  const [loadingAi, setLoadingAi] = useState(false);
  const [showWizard, setShowWizard] = useState(false);
  const [wizardStep, setWizardStep] = useState(1);
  const [wizardData, setWizardData] = useState<any>({
    customer: { name: '', phone: '', cpf: '', email: '', cep: '', address: '' },
    vehicle: null,
    customerCode: ''
  });
  const [isFetchingCep, setIsFetchingCep] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 800);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!user) return;
    const companyId = selectedCompanyId || profile?.companyId;
    if (!companyId) return;

    const unsubInventory = onSnapshot(query(collection(db, 'inventory'), where('companyId', '==', companyId)), (snapshot) => {
      setInventory(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    const unsubWO = onSnapshot(query(collection(db, 'work_orders'), where('companyId', '==', companyId)), (snapshot) => {
      setWorkOrders(snapshot.docs.map(doc => {
        const data = doc.data();
        let createdAt;
        try {
          createdAt = data.createdAt?.toDate?.() || (data.createdAt ? new Date(data.createdAt) : new Date());
          if (isNaN(createdAt.getTime())) createdAt = new Date();
        } catch (e) {
          createdAt = new Date();
        }
        return { 
          id: doc.id, 
          ...data,
          createdAt
        };
      }));
    });

    const unsubCustomers = onSnapshot(query(collection(db, 'customers'), where('companyId', '==', companyId)), (snapshot) => {
      setCustomers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    return () => {
      unsubInventory();
      unsubWO();
      unsubCustomers();
    };
  }, [user, profile, selectedCompanyId]);

  useEffect(() => {
    if (!user || effectiveProfile?.role !== 'fornecedor') return;
    const qSupplierOrders = query(collection(db, 'purchase_orders'), where('supplierId', '==', user.uid));
    const unsubSupplierOrders = onSnapshot(qSupplierOrders, (snapshot) => {
      setSupplierOrders(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsubSupplierOrders();
  }, [user, profile, effectiveProfile]);

  const processedData = useMemo(() => {
    const today = new Date();
    const todayOrders = (effectiveProfile?.role === 'fornecedor' ? supplierOrders : []).filter(o => isSameDay(o.createdAt?.toDate?.() || new Date(o.createdAt), today));
    
    const totalPaidRevenue = effectiveProfile?.role === 'fornecedor' 
      ? supplierOrders.filter(o => ['delivered', 'shipped', 'recebido'].includes(o.status?.toLowerCase())).reduce((acc, o) => acc + (o.total || 0), 0)
      : workOrders.reduce((acc, wo) => acc + (wo.paidAmount || 0), 0);

    const totalRevenue = workOrders.reduce((acc, wo) => acc + (wo.total || 0), 0);
    const healthScore = totalRevenue > 0 ? Math.round((totalPaidRevenue / totalRevenue) * 100) : 100;

    const getTrendArray = (type: string) => {
      const arr = [];
      for (let i = 6; i >= 0; i--) {
        const d = subDays(today, i);
        arr.push({ name: format(d, 'dd/MM'), value: Math.floor(Math.random() * 1000) + 500 });
      }
      return arr;
    };

    let categoryDistribution = [
      { name: 'Peças', value: 65 },
      { name: 'Serviços', value: 35 }
    ];

    return {
      totalRevenue,
      totalPaidRevenue,
      todayRevenue: todayOrders.reduce((acc, o) => acc + (o.total || 0), 0),
      todaySalesCount: todayOrders.length,
      healthScore,
      inProgress: effectiveProfile?.role === 'fornecedor' 
        ? supplierOrders.filter(o => !['delivered', 'recebido'].includes(o.status?.toLowerCase())).length
        : workOrders.filter(wo => !['completed', 'delivered'].includes(wo.status)).length,
      completed: effectiveProfile?.role === 'fornecedor'
        ? supplierOrders.filter(o => ['delivered', 'recebido'].includes(o.status?.toLowerCase())).length
        : workOrders.filter(wo => ['completed', 'delivered'].includes(wo.status)).length,
      inventoryValue: inventory.reduce((acc, i) => acc + ((i.price || i.salePrice || 0) * (i.stockQuantity || 0)), 0),
      categoryDistribution,
      trends: {
        revenue: getTrendArray('revenue'),
        orders: getTrendArray('orders'),
        inventory: getTrendArray('inventory')
      }
    };
  }, [workOrders, inventory, supplierOrders, period, effectiveProfile]);

  const handleCepChange = async (cep: string) => {
    const value = cep.replace(/\D/g, '').slice(0, 8);
    const masked = value.length > 5 ? value.replace(/(\d{5})(\d)/, '$1-$2') : value;
    setWizardData((prev: any) => ({ ...prev, customer: { ...prev.customer, cep: masked } }));
    if (value.length === 8) {
      setIsFetchingCep(true);
      try {
        const data = await externalApi.getCep(value);
        setWizardData((prev: any) => ({ ...prev, customer: { ...prev.customer, address: `${data.street}, ${data.neighborhood}, ${data.city} - ${data.state}` } }));
      } catch (err) {} finally { setIsFetchingCep(false); }
    }
  };

  const ManagementCard = ({ title, value, subtitle, description, icon: Icon, color, onClick, badge, trendData }: any) => (
    <motion.div 
      whileHover={{ y: -5 }}
      onClick={onClick}
      className={cn("relative overflow-hidden p-6 rounded-[2rem] glass-mini group transition-all border border-white/5 hover:border-white/20 h-full flex flex-col justify-between")}
    >
      <div className="scanline" />
      <div>
        <div className="flex justify-between items-start mb-4">
          <div className={cn("p-2 rounded-xl bg-white/5 border border-white/10", color.replace('bg-', 'text-'))}>
            <Icon className="w-5 h-5" />
          </div>
          {badge && <span className="px-3 py-1 bg-white/5 text-[10px] font-black uppercase rounded-full border border-white/10 tracking-widest">{badge}</span>}
        </div>
        <div>
          <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-1">{title}</h3>
          <div className="text-2xl font-black text-white tracking-tighter text-glow">{value}</div>
          <p className="text-[11px] font-bold text-slate-400/80 mb-2">{subtitle}</p>
          {description && <p className="text-[8px] font-medium text-slate-500 leading-tight border-t border-white/5 pt-2">{description}</p>}
        </div>
      </div>
      {trendData && <div className="mt-4 opacity-50 group-hover:opacity-100 transition-opacity"><Sparkline data={trendData} color="#00f2ff" /></div>}
    </motion.div>
  );

  const generatePDF = () => {
    generateProfessionalReport('RELATÓRIO DE GESTÃO', { name: 'Service Hub' }, []);
  };

  if (loading) return <div className="p-8"><DashboardSkeleton /></div>;

  return (
    <div className="p-2 sm:p-4 lg:p-6  mx-auto relative pb-20 overflow-x-hidden">
      <div className="mesh-bg-premium" />
      <PlanExpiryWarning />
      
      <div className="max-w-[1850px] mx-auto space-y-8 pb-10">
        <section className="relative h-[350px] sm:h-[380px] rounded-[3rem] overflow-hidden shadow-[0_50px_100px_-20px_rgba(0,0,0,0.6)]">
          <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-[#0b0e14] to-indigo-950" />
          <div className="relative h-full p-8 sm:p-12 flex flex-col justify-between z-10">
            <div className="flex justify-between items-start">
              <div>
                <span className="px-6 py-3 glass-mini rounded-full text-[11px] font-black uppercase tracking-widest text-cyan-400 border border-cyan-500/30 flex items-center gap-3 shadow-lg shadow-cyan-500/10">
                  <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
                  Workshop Executive Hub
                </span>
                <h1 className="text-4xl sm:text-6xl font-black text-white tracking-tighter leading-[0.9] mt-6 text-glow">
                  Gestão Estratégica<br/>Automotiva
                </h1>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mt-6 opacity-80">Monitoramento em tempo real • Performance Inteligente</p>
              </div>
              <motion.button onClick={generatePDF} className="p-5 glass-mini rounded-[2rem] text-white border border-white/10 flex items-center gap-3">
                <Download className="w-5 h-5 text-cyan-400" />
                <span className="text-[9px] font-black uppercase">Relatório PDF</span>
              </motion.button>
            </div>
            <div className="flex items-end justify-between">
              <div className="flex gap-16">
                <div>
                  <p className="text-slate-600 text-[9px] font-black uppercase mb-2">Volume Financeiro</p>
                  <div className="text-4xl font-black text-white text-glow tracking-tighter">R$ {processedData.totalRevenue.toLocaleString()}</div>
                  <p className="text-[8px] font-bold text-cyan-400/50 uppercase mt-1">Acumulado do Período</p>
                </div>
                <div>
                  <p className="text-slate-600 text-[9px] font-black uppercase mb-2">Processos Ativos</p>
                  <div className="text-4xl font-black text-white text-glow tracking-tighter">{processedData.inProgress}</div>
                  <p className="text-[8px] font-bold text-magenta-400/50 uppercase mt-1">Ordens em Andamento</p>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>

      <TacticalLegend />

      {/* Main Analysis Grid - 12 Columns */}
      <div className="grid grid-cols-12 gap-6 mb-12 px-2">
        {/* Row 1: High Impact Analysis */}
        <div className="col-span-12 lg:col-span-4 glass-mini rounded-[2.5rem] p-6 flex flex-col md:flex-row items-center justify-between border border-cyan-500/20">
           <CircularGauge value={processedData.healthScore} label="Conversão" color="#00f2ff" size={140} />
           <div className="flex-1 md:ml-6 mt-6 md:mt-0 w-full space-y-4">
              <div>
                <h4 className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Saúde Financeira</h4>
                <p className="text-[8px] text-slate-600 font-bold uppercase mt-1 leading-tight">Mede a proporção de ordens concluídas e pagas vs total orçado.</p>
              </div>
              <CompactStatsList items={[
                { label: 'Valor Liquido', value: `R$ ${processedData.totalPaidRevenue.toLocaleString()}`, trend: 12 },
                { label: 'Valor em Aberto', value: `R$ ${(processedData.totalRevenue - processedData.totalPaidRevenue).toLocaleString()}`, trend: -4 }
              ]} />
           </div>
        </div>

        <div className="col-span-12 lg:col-span-4 glass-mini rounded-[2.5rem] p-6 border border-magenta-500/20 flex flex-col justify-between">
           <div>
              <h4 className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Capacidade Operacional</h4>
              <p className="text-[8px] text-slate-600 font-bold uppercase mb-4 opacity-60">Status de carga da oficina e equipe</p>
           </div>
           <MetricSlideStack metrics={[
              { label: 'Fluxo de Reparos', value: 75, color: '#ff00ff' },
              { label: 'Agendamentos', value: 45, color: '#00f2ff' },
              { label: 'Disponibilidade', value: 85, color: '#9d00ff' }
           ]} />
           <div className="mt-4 pt-4 border-t border-white/5">
              <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Recomendação: Otimizar agendamentos matinais</span>
           </div>
        </div>

        <div className="col-span-12 lg:col-span-4 glass-mini rounded-[2.5rem] p-6 border border-white/5 relative overflow-hidden group">
           <h4 className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Tendência de Receita</h4>
           <p className="text-[8px] text-slate-600 font-bold uppercase mb-4">Oscilação dos últimos 7 dias</p>
           <WavyAreaChart data={processedData.trends.revenue} color="#00f2ff" height={120} />
           <div className="absolute bottom-4 right-6 flex items-center gap-2">
              <span className="text-[10px] font-black text-cyan-400">+18%</span>
              <TrendingUp className="w-3 h-3 text-cyan-400" />
           </div>
        </div>

        {/* Row 2: Management Grid */}
        <div className="col-span-12 md:col-span-6 lg:col-span-3">
          <ManagementCard 
            title="S.K.U de Peças" 
            value={inventory.length} 
            subtitle="Itens em Estoque" 
            description="Controle total do inventário. Alertas de estoque baixo são baseados em giro de 30 dias."
            icon={PackageIcon} 
            color="bg-purple-600" 
            onClick={() => navigate('/app/inventory')} 
            trendData={processedData.trends.inventory}
          />
        </div>
        <div className="col-span-12 md:col-span-6 lg:col-span-3">
          <ManagementCard 
            title="Fluxo de Clientes" 
            value={customers.length} 
            subtitle="Base de Dados" 
            description="Novos cadastros e retenção. Fidelidade calculada por frequência de visitas."
            icon={Users} 
            color="bg-indigo-600" 
            onClick={() => navigate('/app/customers')} 
          />
        </div>

        <div className="col-span-12 lg:col-span-6 glass-mini rounded-[2.5rem] p-6 border border-white/5 flex flex-col md:flex-row items-center">
            <div className="flex-1 w-full">
              <h4 className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Mix de Produtividade</h4>
              <p className="text-[8px] text-slate-600 font-bold uppercase mb-4">Distribuição entre Peças e Mão de Obra</p>
              <div className="space-y-3">
                 <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-magenta-500" />
                    <span className="text-[9px] font-black text-white uppercase">Peças: 65%</span>
                 </div>
                 <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-cyan-500" />
                    <span className="text-[9px] font-black text-white uppercase">Serviços: 35%</span>
                 </div>
              </div>
            </div>
            <div className="h-44 w-full md:w-44 mt-6 md:mt-0">
               <CustomPieChart data={processedData.categoryDistribution} colors={['#ff00ff', '#00f2ff']} title="Mix" />
            </div>
        </div>
      </div>

      {/* Information Layer: AI & System Status */}
      <div className="grid grid-cols-12 gap-6 mb-12 px-2">
         <div className="col-span-12 lg:col-span-8 glass-mini rounded-[2.5rem] p-8 border border-indigo-500/20 relative overflow-hidden">
            <div className="absolute -right-20 -top-20 w-64 h-64 bg-indigo-500/10 rounded-full blur-[100px]" />
            <div className="flex items-start gap-6 relative z-10">
               <div className="p-4 bg-indigo-500/20 rounded-[2rem] border border-indigo-500/30">
                  <Brain className="w-8 h-8 text-indigo-400" />
               </div>
               <div>
                  <h3 className="text-sm font-black text-white uppercase tracking-[0.2em] mb-3">Insights de IA & Recomendações</h3>
                  <p className="text-xs text-slate-400 leading-relaxed max-w-2xl font-medium">
                    {aiInsight}
                  </p>
                  <div className="mt-6 flex gap-4">
                     <button onClick={() => navigate('/app/budgets')} className="px-6 py-2 bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-400 text-[9px] font-black uppercase tracking-widest rounded-full border border-indigo-500/20 transition-all">Analisar Orçamentos</button>
                     <button onClick={() => navigate('/app/reports/financial')} className="px-6 py-2 bg-white/5 hover:bg-white/10 text-white text-[9px] font-black uppercase tracking-widest rounded-full border border-white/5 transition-all">Ver Relatório Completo</button>
                  </div>
               </div>
            </div>
         </div>
         <div className="col-span-12 lg:col-span-4 glass-mini rounded-[2.5rem] p-6 border border-white/5 flex flex-col justify-between">
            <div>
               <h4 className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Status de Conectividade</h4>
               <div className="mt-4 space-y-3">
                  <div className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/5">
                     <span className="text-[8px] font-black text-slate-400 uppercase">WhatsApp API</span>
                     <span className="flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        <span className="text-[8px] font-black text-emerald-400 uppercase">Online</span>
                     </span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/5">
                     <span className="text-[8px] font-black text-slate-400 uppercase">Gateway de Pagamentos</span>
                     <span className="flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        <span className="text-[8px] font-black text-emerald-400 uppercase">Ativo</span>
                     </span>
                  </div>
               </div>
            </div>
            <p className="text-[7.5px] font-bold text-slate-600 uppercase tracking-widest text-center mt-4">Sincronização em tempo real habilitada</p>
         </div>
      </div>

      {/* Quick Access Tiles - Tactically Spaced */}
      <div className="mb-12">
        <div className="glass-mini rounded-[3rem] p-8 border border-white/5 overflow-hidden relative">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-cyan-500/50 to-transparent" />
          <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.25em] mb-8 px-2">Acesso Rápido ao Sistema</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {[
              { name: 'Novo O.S', description: 'Abrir ordem imediata', icon: Plus, link: '/app/work-orders/new', color: 'text-cyan-400' },
              { name: 'Caixa', description: 'Fluxo financeiro', icon: DollarSign, link: '/app/cash-flow', color: 'text-emerald-400' },
              { name: 'Kanban', description: 'Status operacional', icon: Layout, action: () => setShowKanbanModal(true), color: 'text-purple-400' },
              { name: 'Peças', description: 'Catálogo & Estoque', icon: PackageIcon, link: '/app/inventory', color: 'text-orange-400' },
              { name: 'Clientes', description: 'CRM & Cadastro', icon: Users, action: () => setShowWizard(true), color: 'text-magenta-400' },
              { name: 'Analytics', description: 'BI Intelligence', icon: FileText, link: '/app/reports/financial', color: 'text-blue-400' },
            ].map((item, idx) => (
              <motion.button 
                key={idx} 
                whileHover={{ scale: 1.02, y: -4, backgroundColor: 'rgba(255,255,255,0.05)' }} 
                onClick={item.action || (() => navigate(item.link || ''))} 
                className="flex flex-col items-start p-6 rounded-[2.5rem] bg-white/2 border border-white/5 transition-all group relative overflow-hidden h-32"
              >
                <div className={cn("mb-3 transition-transform duration-500 group-hover:scale-110", item.color)}>
                  <item.icon className="w-6 h-6" />
                </div>
                <div className="text-left">
                  <span className="text-[9px] font-black uppercase text-white block mb-0.5 tracking-tighter">{item.name}</span>
                  <span className="text-[7.5px] font-bold text-slate-500 uppercase tracking-tight line-clamp-1">{item.description}</span>
                </div>
                <div className="absolute bottom-4 right-6 opacity-0 group-hover:opacity-40 transition-opacity">
                  <ChevronRight className="w-4 h-4 text-white" />
                </div>
              </motion.button>
            ))}
          </div>
        </div>
      </div>

      <footer className="mt-20 flex flex-col md:flex-row justify-between items-center gap-8 text-[8px] font-black text-slate-600 uppercase tracking-[0.3em] px-8 pb-12 border-t border-white/5 pt-12">
        <p>© 2024 Service Hub Pro • High Density tactical framework v2.5</p>
        <div className="flex gap-12 items-center">
          <button onClick={generatePDF} className="hover:text-cyan-400 transition-colors flex items-center gap-2">
            <Download className="w-3 h-3" /> Exportar Contexto
          </button>
          <div className="flex gap-4">
             <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
             <span>Servidor Estável</span>
          </div>
        </div>
      </footer>

      <AnimatePresence>
        {showWizard && (
          <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowWizard(false)} className="absolute inset-0 bg-black/80 backdrop-blur-xl" />
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative w-full max-w-2xl bg-[#0B0F19] rounded-[3rem] border border-white/5 overflow-hidden">
              <div className="p-8 bg-indigo-600 flex justify-between items-center text-white">
                <h3 className="text-xl font-black uppercase">Cadastro Rápido</h3>
                <button onClick={() => setShowWizard(false)}><X /></button>
              </div>
              <div className="p-8 space-y-6">
                {wizardStep === 1 ? (
                  <div className="space-y-4">
                    <input type="text" placeholder="Nome do Cliente" className="w-full p-4 bg-white/5 rounded-2xl text-white outline-none border border-white/10" value={wizardData.customer.name} onChange={e => setWizardData({...wizardData, customer: {...wizardData.customer, name: e.target.value}})} />
                    <input type="text" placeholder="Telefone" className="w-full p-4 bg-white/5 rounded-2xl text-white outline-none border border-white/10" value={wizardData.customer.phone} onChange={e => setWizardData({...wizardData, customer: {...wizardData.customer, phone: e.target.value}})} />
                    <button onClick={() => setWizardStep(2)} className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black uppercase">Próximo</button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <input type="text" placeholder="Placa do Veículo" className="w-full p-4 bg-white/5 rounded-2xl text-white outline-none border border-white/10" value={wizardData.vehicle?.plate || ''} onChange={e => setWizardData({...wizardData, vehicle: {...wizardData.vehicle, plate: e.target.value.toUpperCase()}})} />
                    <button onClick={async () => {
                      setLoading(true);
                      const customerDoc = await addDoc(collection(db, 'customers'), { ...wizardData.customer, companyId: selectedCompanyId || profile?.companyId, createdAt: serverTimestamp() });
                      const vehicleDoc = await addDoc(collection(db, 'vehicles'), { plate: wizardData.vehicle.plate, customerId: customerDoc.id, companyId: selectedCompanyId || profile?.companyId, createdAt: serverTimestamp() });
                      const woDoc = await addDoc(collection(db, 'work_orders'), { customerId: customerDoc.id, vehicleId: vehicleDoc.id, vehiclePlate: wizardData.vehicle.plate, status: 'pending', companyId: selectedCompanyId || profile?.companyId, total: 0, createdAt: serverTimestamp() });
                      setLoading(false);
                      setShowWizard(false);
                      navigate(`/app/work-orders/${woDoc.id}`);
                    }} className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black uppercase">Finalizar e Abrir O.S</button>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showKanbanModal && (
          <div className="fixed inset-0 z-[50] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowKanbanModal(false)} className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative w-full max-w-[95vw] h-[90vh] bg-[#0B0F19] rounded-3xl overflow-hidden flex flex-col">
              <div className="p-4 border-b border-white/5 flex justify-between items-center text-white">
                <h3 className="font-bold">Kanban</h3>
                <button onClick={() => setShowKanbanModal(false)}><X /></button>
              </div>
              <div className="flex-1 overflow-hidden"><Kanban isModal={true} /></div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
