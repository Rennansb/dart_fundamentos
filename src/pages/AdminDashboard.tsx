import React, { useState, useEffect, useMemo } from 'react';
import { collection, getDocs, doc, updateDoc, deleteDoc, query, where, onSnapshot, orderBy, limit } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../AuthContext';
import { 
  Shield, 
  ShieldAlert, 
  ShieldCheck, 
  Trash2, 
  UserX, 
  UserCheck, 
  Search, 
  Mail, 
  DollarSign, 
  Package, 
  ChevronRight, 
  ChevronDown, 
  UserCircle, 
  ExternalLink, 
  MessageSquare, 
  BrainCircuit, 
  Key,
  Users,
  TrendingUp,
  Activity,
  ArrowUpRight,
  Zap,
  Clock,
  PieChart as PieChartIcon,
  BarChart3,
  Wrench
} from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  AreaChart, Area, PieChart, Pie, Cell
} from 'recharts';
import { motion, AnimatePresence } from 'framer-motion';
import { Navigate, useNavigate } from 'react-router-dom';
import ProfileModal from '../components/ProfileModal';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../firebase';
import { format, subDays, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function AdminDashboard() {
  const { profile, user } = useAuth();
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [orders, setOrders] = useState<any[]>([]);
  const [totalCommissions, setTotalCommissions] = useState(0);
  const [expandedShops, setExpandedShops] = useState<Set<string>>(new Set());
  const [editingUser, setEditingUser] = useState<any>(null);
  const { setSelectedCompanyId } = useAuth();
  const navigate = useNavigate();
  const [unreadSupportCount, setUnreadSupportCount] = useState(0);
  const [aiUsage, setAiUsage] = useState<any[]>([]);
  const [totalAiCost, setTotalAiCost] = useState(0);
  const [workOrders, setWorkOrders] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'analytics' | 'users' | 'support'>('analytics');
  const [userTypeFilter, setUserTypeFilter] = useState<'all' | 'shop' | 'fornecedor'>('all');
  const [showEditModal, setShowEditModal] = useState(false);
  const [userToEdit, setUserToEdit] = useState<any>(null);
  const [internalChats, setInternalChats] = useState<any[]>([]);
  const [loadingSupport, setLoadingSupport] = useState(false);
  
  
  // Date-based Analytics Logic
  const stats = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now.setHours(0,0,0,0));
    const startOfMonthDate = startOfMonth(new Date());

    const filterByDate = (items: any[], start: Date) => items.filter(item => {
      const d = item.createdAt?.toDate ? item.createdAt.toDate() : new Date(item.createdAt);
      return d >= start;
    });

    // Sub-Stats
    const ordersToday = filterByDate(orders, startOfToday);
    const ordersMonth = filterByDate(orders, startOfMonthDate);
    const woToday = filterByDate(workOrders, startOfToday);
    const woMonth = filterByDate(workOrders, startOfMonthDate);

    // GMV & Income
    const gmvToday = ordersToday.reduce((acc, o) => acc + (o.total || 0), 0) + woToday.reduce((acc, wo) => acc + (wo.totalCost || 0), 0);
    const gmvMonth = ordersMonth.reduce((acc, o) => acc + (o.total || 0), 0) + woMonth.reduce((acc, wo) => acc + (wo.totalCost || 0), 0);
    
    const incomeToday = ordersToday.reduce((acc, o) => acc + (o.commissionAmount || 0), 0);
    const incomeMonth = ordersMonth.reduce((acc, o) => acc + (o.commissionAmount || 0), 0);

    const supplierSalesToday = ordersToday.reduce((acc, o) => acc + (o.total || 0), 0);
    const supplierSalesMonth = ordersMonth.reduce((acc, o) => acc + (o.total || 0), 0);

    // Commissions (All time for accurate ledger)
    const validOrders = orders.filter(o => o.status !== 'cancelado' && o.status !== 'cancelled');
    const getCommission = (o: any) => o.commissionAmount || o.platformCommission || ((o.total || 0) * 0.03);
    const commissionPaidTotal = validOrders.filter(o => o.paymentStatus === 'pago').reduce((acc, o) => acc + getCommission(o), 0);
    const commissionPendingTotal = validOrders.filter(o => o.paymentStatus !== 'pago').reduce((acc, o) => acc + getCommission(o), 0);

    const woPendingToday = woToday.filter(wo => !['completed', 'finished', 'cancelado', 'cancelled'].includes(wo.status)).length;
    const woFinishedToday = woToday.filter(wo => ['completed', 'finished'].includes(wo.status)).length;
    const woPendingMonth = woMonth.filter(wo => !['completed', 'finished', 'cancelado', 'cancelled'].includes(wo.status)).length;
    const woFinishedMonth = woMonth.filter(wo => ['completed', 'finished'].includes(wo.status)).length;

    // Leaderboard (Shop Ranking)
    const shopVolume: Record<string, number> = {};
    validOrders.forEach(o => { 
      const id = o.userId || o.companyId;
      if (!id) return;
      shopVolume[id] = (shopVolume[id] || 0) + (o.total || 0); 
    });
    workOrders.forEach(wo => { 
      if (wo.status === 'cancelado' || wo.status === 'cancelled' || wo.status === 'waiting_payment') return;
      if (!wo.companyId) return;
      shopVolume[wo.companyId] = (shopVolume[wo.companyId] || 0) + (wo.totalCost || 0); 
    });

    const userMap = new Map(users.map(u => [u.id, u]));
    
    const leaderboard = Object.entries(shopVolume)
      .map(([id, volume]) => {
        const u = userMap.get(id);
        return {
          id,
          volume,
          name: u?.shopName || u?.name || 'Oficina Parceira'
        };
      })
      .sort((a, b) => b.volume - a.volume)
      .slice(0, 5);

    return {
      gmvToday,
      gmvMonth,
      incomeToday,
      incomeMonth,
      supplierSalesToday,
      supplierSalesMonth,
      commissionPaidTotal,
      commissionPendingTotal,
      woPendingToday,
      woFinishedToday,
      woPendingMonth,
      woFinishedMonth,
      totalCustomers: customers.length,
      activeShops: users.filter(u => u.role === 'shop' && u.status === 'active').length,
      pendingShops: users.filter(u => u.role === 'shop' && u.status === 'pending').length,
      leaderboard,
      planCounts: {
        free: users.filter(u => u.plan === 'free' || !u.plan).length,
        pro: users.filter(u => u.plan === 'pro').length,
        elite: users.filter(u => u.plan === 'elite').length
      }
    };
  }, [users, orders, workOrders, customers]);

  const chartData = useMemo(() => {
    // Generate data for the last 15 days
    const days = eachDayOfInterval({
      start: subDays(new Date(), 14),
      end: new Date()
    });

    return days.map(day => {
      const dayOrders = orders.filter(o => {
        const d = o.createdAt?.toDate ? o.createdAt.toDate() : new Date(o.createdAt);
        return isSameDay(d, day);
      });
      const dayWOs = workOrders.filter(wo => {
        const d = wo.createdAt?.toDate ? wo.createdAt.toDate() : new Date(wo.createdAt);
        return isSameDay(d, day);
      });

      return {
        date: format(day, 'dd/MM'),
        revenue: dayOrders.reduce((acc, o) => acc + (o.total || 0), 0) + dayWOs.reduce((acc, wo) => acc + (wo.totalCost || 0), 0),
        commissions: dayOrders.reduce((acc, o) => acc + (o.commissionAmount || 0), 0),
        orders: dayOrders.length + dayWOs.length
      };
    });
  }, [orders, workOrders]);

  const planData = [
    { name: 'Gratuito', value: stats.planCounts.free, color: '#94a3b8' },
    { name: 'Oficina Pro', value: stats.planCounts.pro, color: '#6366f1' },
    { name: 'Oficina Elite', value: stats.planCounts.elite, color: '#8b5cf6' }
  ];

  const recentActivity = useMemo(() => {
    const combined = [
      ...users.map(u => ({ ...u, type: 'user', time: u.createdAt })),
      ...orders.map(o => ({ ...o, type: 'order', time: o.createdAt })),
      ...workOrders.map(wo => ({ ...wo, type: 'wo', time: wo.createdAt }))
    ].filter(item => item.time);

    return combined
      .sort((a, b) => {
        const tA = a.time?.toDate ? a.time.toDate() : new Date(a.time);
        const tB = b.time?.toDate ? b.time.toDate() : new Date(b.time);
        return tB - tA;
      })
      .slice(0, 10);
  }, [users, orders, workOrders]);

  // Only admins can access this page
  if (profile?.role !== 'admin') {
    return <Navigate to="/app" />;
  }

  useEffect(() => {
    fetchUsers();
    fetchOrders();
    const unsubSupportCount = fetchUnreadSupport();
    const unsubAiUsage = fetchAiUsage();
    const unsubInternalChats = fetchInternalChats();
    
    // Global Work Orders for BI
    const qWO = query(collection(db, 'work_orders'), orderBy('createdAt', 'desc'), limit(5000));
    const unsubWO = onSnapshot(qWO, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setWorkOrders(data);
    });

    // Global Customers Count for Ecosystem stats
    const qCust = query(collection(db, 'customers'), limit(10000));
    const unsubCust = onSnapshot(qCust, (snapshot) => {
      setCustomers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    return () => {
      unsubSupportCount?.();
      unsubAiUsage?.();
      unsubWO?.();
      unsubCust?.();
      unsubInternalChats?.();
    };
  }, []);

  const fetchAiUsage = () => {
    const q = query(collection(db, 'ai_usage'), orderBy('timestamp', 'desc'), limit(5000));
    return onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setAiUsage(data);
      const total = data.reduce((acc, curr: any) => acc + (curr.costBRL || 0), 0);
      setTotalAiCost(total);
    });
  };

  const fetchInternalChats = () => {
    setLoadingSupport(true);
    const q = query(
      collection(db, 'internal_chats'),
      orderBy('lastMessageAt', 'desc'),
      limit(50)
    );

    return onSnapshot(q, (snapshot) => {
      const chats = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setInternalChats(chats);
      setLoadingSupport(false);
    });
  };

  const fetchUnreadSupport = () => {
    const q = query(
      collection(db, 'internal_chats'),
      where('status', '==', 'open')
    );
    
    return onSnapshot(q, (snapshot) => {
      const count = snapshot.docs.reduce((acc, doc) => acc + (doc.data().unreadCountAdmin || 0), 0);
      setUnreadSupportCount(count);
    });
  };

  const fetchUsers = async () => {
    try {
      const q = query(collection(db, 'users'), limit(5000));
      const usersSnapshot = await getDocs(q);
      const usersList = usersSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setUsers(usersList);
    } catch (error) {
      console.error("Error fetching users:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchOrders = async () => {
    try {
      const q = query(collection(db, 'purchase_orders'), limit(10000));
      const ordersSnapshot = await getDocs(q);
      const ordersList = ordersSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as any[];
      setOrders(ordersList);
      
      const total = ordersList.reduce((acc, order) => acc + (order.commissionAmount || 0), 0);
      setTotalCommissions(total);
    } catch (error) {
      console.error("Error fetching orders:", error);
    }
  };

  const approveUser = async (userId: string) => {
    try {
      await updateDoc(doc(db, 'users', userId), {
        status: 'active'
      });
      setUsers(users.map(u => u.id === userId ? { ...u, status: 'active' } : u));
    } catch (error) {
      console.error("Error approving user:", error);
      alert("Erro ao aprovar usuário.");
    }
  };

  const toggleUserStatus = async (userId: string, currentStatus: string) => {
    try {
      const newStatus = currentStatus === 'blocked' ? 'active' : 'blocked';
      await updateDoc(doc(db, 'users', userId), {
        status: newStatus
      });
      setUsers(users.map(u => u.id === userId ? { ...u, status: newStatus } : u));
    } catch (error) {
      console.error("Error updating user status:", error);
      alert("Erro ao atualizar o status do usuário.");
    }
  };

  const toggleUserRole = async (userId: string, currentRole: string) => {
    if (currentRole === 'fornecedor') {
      alert("Fornecedores não podem ser promovidos a admin.");
      return;
    }
    try {
      const newRole = currentRole === 'admin' ? 'shop' : 'admin';
      await updateDoc(doc(db, 'users', userId), {
        role: newRole
      });
      setUsers(users.map(u => u.id === userId ? { ...u, role: newRole } : u));
    } catch (error) {
      console.error("Error updating user role:", error);
      alert("Erro ao atualizar a permissão do usuário.");
    }
  };

  const updateUserPlan = async (userId: string, newPlan: string) => {
    try {
      await updateDoc(doc(db, 'users', userId), {
        plan: newPlan,
        planExpiresAt: newPlan === 'free' ? null : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
      });
      setUsers(users.map(u => u.id === userId ? { ...u, plan: newPlan } : u));
    } catch (error) {
      console.error("Error updating user plan:", error);
      alert("Erro ao atualizar o plano do usuário.");
    }
  };

  const deleteUser = async (userId: string) => {
    if (!window.confirm("Certeza que deseja excluir este usuário? Esta ação é irreversível.")) return;
    try {
      await deleteDoc(doc(db, 'users', userId));
      setUsers(users.filter(u => u.id !== userId));
    } catch (error) {
      console.error("Error deleting user:", error);
      alert("Erro ao excluir usuário.");
    }
  };

  const sendResetEmail = async (email: string) => {
    if (!email) return;
    if (!window.confirm(`Deseja enviar um email de redefinição de senha para ${email}?`)) return;
    
    try {
      await sendPasswordResetEmail(auth, email);
      alert(`Email de redefinição enviado com sucesso para ${email}`);
    } catch (error: any) {
      console.error("Error sending reset email:", error);
      alert("Erro ao enviar email: " + error.message);
    }
  };

  const hardResetPassword = async (userId: string, userEmail: string) => {
    if (!userId || !userEmail) return;
    if (!window.confirm(`ATENÇÃO: Isso irá gerar uma senha ALEATÓRIA para ${userEmail} e substituirá a senha atual imediatamente. O usuário será forçado a trocar a senha no próximo login. Continuar?`)) return;

    try {
      const response = await fetch('/api/admin/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid: userId, adminUid: user?.uid })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Erro ao resetar senha');

      alert(`SENHA ALTERADA COM SUCESSO!\n\nNova Senha Temporária: ${data.newPassword}\n\nCopie esta senha e envie ao usuário. No próximo acesso, o sistema exigirá que ele crie uma nova senha.`);
    } catch (error: any) {
      console.error("Error hard resetting password:", error);
      alert("Erro: " + error.message);
    }
  };

  const manageShop = (shopId: string) => {
    setSelectedCompanyId(shopId);
    setTimeout(() => {
      navigate('/app');
      window.location.reload();
    }, 100);
  };

  const toggleShopExpansion = (shopId: string) => {
    const newExpanded = new Set(expandedShops);
    if (newExpanded.has(shopId)) {
      newExpanded.delete(shopId);
    } else {
      newExpanded.add(shopId);
    }
    setExpandedShops(newExpanded);
  };

  const filteredUsers = useMemo(() => {
    return users.filter(u => {
      const matchesSearch = (u.displayName || u.shopName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                          u.email?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesType = userTypeFilter === 'all' || u.role === userTypeFilter;
      return matchesSearch && matchesType;
    });
  }, [users, searchTerm, userTypeFilter]);

  // Grouping logic
  const others = filteredUsers.filter(u => u.role !== 'shop' && u.role !== 'employee');
  const matchingEmployees = filteredUsers.filter(u => u.role === 'employee');
  const matchingShops = filteredUsers.filter(u => u.role === 'shop');
  
  // Shops to display: those that match OR those that have a matching employee
  const shopIdsWithMatchingEmployees = new Set(matchingEmployees.map(emp => emp.companyId));
  const shopsToDisplay = users.filter(u => 
    u.role === 'shop' && (matchingShops.find(ms => ms.id === u.id) || shopIdsWithMatchingEmployees.has(u.id))
  );

  const getEmployeesForShop = (shopId: string) => {
    // If searching, only show matching employees. If not searching, show all.
    const shopEmployees = users.filter(u => u.role === 'employee' && u.companyId === shopId);
    if (searchTerm) {
      return shopEmployees.filter(emp => 
        emp.email?.toLowerCase().includes(searchTerm.toLowerCase()) || 
        emp.displayName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        emp.name?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    return shopEmployees;
  };

  return (
    <div className="relative z-10 max-w-[1600px] mx-auto px-6 py-10 space-y-10">
        {/* Superior Header & Activity Ticker */}
        <div className="flex flex-col gap-6">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8">
            <motion.div 
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
            >
              <div className="flex items-center gap-4 mb-2">
                <div className="p-2.5 bg-indigo-500/20 rounded-xl border border-indigo-500/30">
                  <Shield className="h-7 w-7 text-indigo-400" />
                </div>
                <span className="text-[10px] font-black uppercase tracking-[0.3em] text-indigo-400">Hub Master Control</span>
              </div>
              <h1 className="text-5xl font-black text-white tracking-tighter">
                Command <span className="text-indigo-400">Center</span>
              </h1>
              <p className="mt-2 text-gray-400 font-medium">Gestão global de ecossistema em tempo real.</p>
            </motion.div>

            <div className="flex flex-wrap gap-2 bg-white/5 p-1.5 rounded-2xl border border-white/10 backdrop-blur-md">
              {[
                { id: 'analytics', label: 'Painel Central', icon: Activity },
                { id: 'users', label: 'Lojas & Parceiros', icon: Users },
                { id: 'support', label: 'Tickets & Ouvidoria', icon: MessageSquare }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex items-center gap-2 px-6 py-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
                    activeTab === tab.id 
                      ? 'bg-white text-gray-900 shadow-xl' 
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  <tab.icon className="h-4 w-4" />
                  {tab.label}
                  {tab.id === 'support' && unreadSupportCount > 0 && (
                    <span className="ml-1 px-1.5 py-0.5 bg-rose-500 text-white text-[8px] rounded-full animate-bounce">
                      {unreadSupportCount}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Activity Ticker */}
          <div className="overflow-hidden bg-white/5 border border-white/5 rounded-3xl py-3 whitespace-nowrap">
            <motion.div 
              animate={{ x: [0, -1000] }}
              transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
              className="flex gap-12 px-6"
            >
              {[...recentActivity, ...recentActivity].map((item, i) => (
                <div key={i} className="flex items-center gap-3 text-xs font-bold">
                  <div className={`w-2 h-2 rounded-full ${item.type === 'order' ? 'bg-emerald-500' : item.type === 'user' ? 'bg-indigo-500' : 'bg-blue-500'}`} />
                  <span className="text-gray-500 uppercase tracking-widest">{format(item.time?.toDate ? item.time.toDate() : new Date(item.time), 'HH:mm')}</span>
                  <span className="text-white">
                     {item.type === 'order' ? `Venda de ${(item.total || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} na plataforma` :
                     item.type === 'user' ? `Novo parceiro: ${item.shopName || item.displayName || item.name || 'Oficina Associada'}` :
                     `Serviço OS#${String(item.id || '').slice(-6).toUpperCase()} iniciado em ${item.shopName || 'uma oficina'}`}
                  </span>
                </div>
              ))}
            </motion.div>
          </div>
        </div>

        <AnimatePresence mode="wait">
          {activeTab === 'analytics' ? (
            <motion.div 
              key="analytics"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -30 }}
              className="space-y-10"
            >
              {/* Primary KPI Grid (Financial) */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {/* Entradas Card */}
                <div className="glass-card p-8 rounded-[4rem] relative group border-indigo-500/20">
                  <div className="flex justify-between items-start mb-10">
                    <div className="p-4 bg-emerald-500/10 rounded-2xl text-emerald-400 border border-emerald-500/20">
                      <TrendingUp className="h-8 w-8" />
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] font-black uppercase text-emerald-500 tracking-widest bg-emerald-500/10 px-3 py-1 rounded-full">Entradas Hoje</span>
                      <h4 className="text-3xl font-black text-white mt-2 tabular-nums">R$ {stats.gmvToday.toLocaleString('pt-BR')}</h4>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <p className="text-xs text-gray-400 font-bold uppercase tracking-widest">Faturamento do Mês</p>
                    <div className="flex items-end gap-3">
                      <h3 className="text-5xl font-black text-white tracking-tighter tabular-nums">R$ {stats.gmvMonth.toLocaleString('pt-BR')}</h3>
                      <div className="mb-2 flex items-center text-emerald-400 text-xs font-black">
                        <ArrowUpRight className="h-4 w-4" /> 14%
                      </div>
                    </div>
                  </div>
                </div>

                {/* Saídas Card */}
                <div className="glass-card p-8 rounded-[4rem] border-rose-500/20">
                  <div className="flex justify-between items-start mb-10">
                    <div className="p-4 bg-rose-500/10 rounded-2xl text-rose-400 border border-rose-500/20">
                      <Zap className="h-8 w-8" />
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] font-black uppercase text-rose-500 tracking-widest bg-rose-500/10 px-3 py-1 rounded-full">Custos Operacionais IA</span>
                      <h4 className="text-3xl font-black text-white mt-2 tabular-nums">R$ {totalAiCost.toLocaleString('pt-BR')}</h4>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <p className="text-xs text-gray-400 font-bold uppercase tracking-widest">Taxa de Rentabilidade AI</p>
                    <div className="w-full bg-white/5 h-2.5 rounded-full overflow-hidden">
                      <div className="h-full bg-indigo-500 w-[78%] shadow-[0_0_15px_rgba(99,102,241,0.5)]" />
                    </div>
                    <p className="text-[10px] text-indigo-400 font-bold uppercase tracking-tighter">Performance de tokens otimizada em 78%</p>
                  </div>
                </div>

                {/* Ecosystem Scale Card */}
                <div className="glass-card p-8 rounded-[4rem] border-indigo-500/20">
                  <div className="flex justify-between items-start mb-10">
                    <div className="p-4 bg-indigo-500/10 rounded-2xl text-indigo-400 border border-indigo-500/20">
                      <Users className="h-8 w-8" />
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] font-black uppercase text-indigo-400 tracking-widest bg-indigo-500/10 px-3 py-1 rounded-full">Base Global de Clientes</span>
                      <h4 className="text-5xl font-black text-white mt-2 tabular-nums tracking-tighter">{stats.totalCustomers}</h4>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 rounded-3xl bg-white/5 border border-white/5">
                      <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest mb-1">Lojas Ativas</p>
                      <p className="text-2xl font-black text-white tabular-nums">{stats.activeShops}</p>
                    </div>
                    <div className="p-4 rounded-3xl bg-white/5 border border-white/5">
                      <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest mb-1">Aguardando</p>
                      <p className="text-2xl font-black text-white tabular-nums">{stats.pendingShops}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Secondary KPI Grid (Marketplace & Operations) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Marketplace & Suppliers Card */}
                <div className="glass-card p-8 rounded-[4rem] border-blue-500/20">
                  <div className="flex justify-between items-start mb-10">
                    <div className="p-4 bg-blue-500/10 rounded-2xl text-blue-400 border border-blue-500/20">
                      <Package className="h-8 w-8" />
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] font-black uppercase text-blue-400 tracking-widest bg-blue-500/10 px-3 py-1 rounded-full">Mercado de Peças (Hoje)</span>
                      <h4 className="text-3xl font-black text-white mt-2 tabular-nums">R$ {stats.supplierSalesToday.toLocaleString('pt-BR')}</h4>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 rounded-3xl bg-white/5 border border-white/5">
                      <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest mb-1">Comissão (3%) - Recebida</p>
                      <p className="text-xl font-black text-emerald-400 tabular-nums">R$ {stats.commissionPaidTotal.toLocaleString('pt-BR')}</p>
                    </div>
                    <div className="p-4 rounded-3xl bg-white/5 border border-white/5">
                      <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest mb-1">Comissão (3%) - Ag. Pag</p>
                      <p className="text-xl font-black text-amber-400 tabular-nums">R$ {stats.commissionPendingTotal.toLocaleString('pt-BR')}</p>
                    </div>
                  </div>
                </div>

                {/* Operations & Repairs Card */}
                <div className="glass-card p-8 rounded-[4rem] border-orange-500/20">
                  <div className="flex justify-between items-start mb-10">
                    <div className="p-4 bg-orange-500/10 rounded-2xl text-orange-400 border border-orange-500/20">
                      <Wrench className="h-8 w-8" />
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] font-black uppercase text-orange-400 tracking-widest bg-orange-500/10 px-3 py-1 rounded-full">Reparos & Serviços (Mês)</span>
                      <h4 className="text-3xl font-black text-white mt-2 tabular-nums">{stats.woPendingMonth + stats.woFinishedMonth}</h4>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 rounded-3xl bg-white/5 border border-white/5">
                      <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest mb-1">Finalizados hoje</p>
                      <p className="text-2xl font-black text-emerald-400 tabular-nums">{stats.woFinishedToday}</p>
                    </div>
                    <div className="p-4 rounded-3xl bg-white/5 border border-white/5">
                      <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest mb-1">Pendentes Gerais</p>
                      <p className="text-2xl font-black text-amber-400 tabular-nums">{stats.woPendingMonth}</p>
                    </div>
                  </div>
                </div>
              </div>



              {/* Main Analytics Row */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
                {/* Evolution Chart */}
                <div className="lg:col-span-2 glass-card p-10 rounded-[4rem] relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-10 opacity-10">
                    <BarChart3 className="w-32 h-32 text-indigo-400" />
                  </div>
                  <div className="flex items-center justify-between mb-12">
                    <div>
                      <h3 className="text-2xl font-black text-white tracking-tight">Performance Financeira Global</h3>
                      <p className="text-sm font-medium text-gray-400">GMV Unificado de todas as operações vinculadas</p>
                    </div>
                    <div className="flex p-1 bg-white/5 rounded-xl">
                      {['Daily', 'Weekly'].map(t => (
                        <button key={t} className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${t === 'Daily' ? 'bg-white text-gray-900' : 'text-gray-500'}`}>{t}</button>
                      ))}
                    </div>
                  </div>
                  <div className="h-[400px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={chartData}>
                        <defs>
                          <linearGradient id="mainGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2}/>
                            <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                        <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fill: '#4b5563', fontSize: 10, fontWeight: 800}} dy={15} />
                        <YAxis axisLine={false} tickLine={false} tick={{fill: '#4b5563', fontSize: 10, fontWeight: 800}} tickFormatter={(v) => `R$${v/1000}k`} />
                        <Tooltip 
                          contentStyle={{ backgroundColor: '#111827', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '1.5rem' }}
                          itemStyle={{ fontSize: 12, fontWeight: 900 }}
                        />
                        <Area type="monotone" dataKey="revenue" stroke="#6366f1" strokeWidth={4} fillOpacity={1} fill="url(#mainGrad)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Top Shops Leaderboard */}
                <div className="glass-card p-10 rounded-[3.5rem]">
                  <h3 className="text-2xl font-black text-white tracking-tight mb-8">Top Oficinas</h3>
                  <div className="space-y-8">
                    {stats.leaderboard.map((shop, i) => (
                      <div key={shop.id} className="flex items-center justify-between group">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-sm font-black text-indigo-400">
                            {i + 1}
                          </div>
                          <div>
                            <p className="text-sm font-black text-white group-hover:text-indigo-400 transition-colors">{shop.name}</p>
                            <p className="text-[9px] font-bold text-gray-500 uppercase tracking-widest">GMV Acumulado</p>
                          </div>
                        </div>
                        <span className="text-sm font-black text-white tabular-nums">R$ {shop.volume.toLocaleString()}</span>
                      </div>
                    ))}
                    {stats.leaderboard.length === 0 && (
                      <p className="text-center py-20 text-gray-600 font-bold uppercase text-[10px] tracking-widest">Sem dados no ranking</p>
                    )}
                  </div>
                  
                  <div className="mt-10 pt-10 border-t border-white/5">
                    <p className="text-xs font-black text-indigo-400 uppercase tracking-widest mb-4">Mix de Planos Ativos</p>
                    <div className="flex gap-1 h-3 rounded-full overflow-hidden">
                      <div className="h-full bg-indigo-500" style={{ width: `${(stats.planCounts.elite / stats.activeShops) * 100}%` }} />
                      <div className="h-full bg-blue-500" style={{ width: `${(stats.planCounts.pro / stats.activeShops) * 100}%` }} />
                      <div className="h-full bg-gray-500" style={{ width: `${(stats.planCounts.free / stats.activeShops) * 100}%` }} />
                    </div>
                    <div className="flex justify-between mt-3 text-[9px] font-bold text-gray-500 uppercase tracking-tighter">
                       <span>Elite</span>
                       <span>Pro</span>
                       <span>Base</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* AI & Infrastructure Performance Section */}
              <div className="glass-card p-10 rounded-[4rem] relative overflow-hidden border-indigo-500/20">
                <div className="flex items-center justify-between mb-8">
                  <div>
                    <h3 className="text-2xl font-black text-white tracking-tight">Inteligência Artificial & Cloud</h3>
                    <p className="text-sm font-medium text-gray-400">Monitoramento de custos e performance de modelos em tempo real</p>
                  </div>
                  <div className="p-3 bg-indigo-500/10 rounded-2xl border border-indigo-500/20 text-indigo-400">
                    <BrainCircuit className="h-6 w-6" />
                  </div>
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-4 gap-8">
                  <div className="xl:col-span-3">
                     <div className="h-[250px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={aiUsage.slice(0, 30).reverse()}>
                            <defs>
                              <linearGradient id="aiGrad" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.2}/>
                                <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                            <XAxis 
                              dataKey="timestamp" 
                              hide={true}
                            />
                            <YAxis axisLine={false} tickLine={false} tick={{fill: '#4b5563', fontSize: 10, fontWeight: 800}} />
                            <Tooltip 
                              contentStyle={{ backgroundColor: '#111827', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '1.5rem' }}
                              itemStyle={{ fontSize: 12, fontWeight: 900 }}
                              labelFormatter={(v) => `Evento: ${v}`}
                            />
                            <Area type="monotone" dataKey="costBRL" stroke="#8b5cf6" strokeWidth={3} fillOpacity={1} fill="url(#aiGrad)" />
                          </AreaChart>
                        </ResponsiveContainer>
                     </div>
                  </div>

                  <div className="space-y-4">
                    <div className="p-6 rounded-[2rem] bg-indigo-500/5 border border-indigo-500/10">
                      <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">Custo Médio/Req</p>
                      <p className="text-2xl font-black text-white">R$ {(totalAiCost / (aiUsage.length || 1)).toFixed(4)}</p>
                    </div>
                    <div className="p-6 rounded-[2rem] bg-emerald-500/5 border border-emerald-500/10">
                      <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">Tokens Processados</p>
                      <p className="text-2xl font-black text-white">~{(aiUsage.length * 450).toLocaleString()}k</p>
                    </div>
                    <div className="p-6 rounded-[2rem] bg-rose-500/5 border border-rose-500/10">
                      <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">Taxa de Sucesso</p>
                      <p className="text-2xl font-black text-white">99.8%</p>
                    </div>
                  </div>
                </div>

                <div className="mt-8 pt-8 border-t border-white/5 grid grid-cols-2 md:grid-cols-4 gap-4">
                  {aiUsage.slice(0, 4).map((usage: any, i) => (
                    <div key={i} className="bg-white/5 p-4 rounded-2xl border border-white/5">
                      <p className="text-[9px] font-black text-indigo-400 uppercase tracking-tighter mb-1 line-clamp-1">{usage.type || 'Assistant'}</p>
                      <p className="text-xs font-bold text-white mb-1">R$ {usage.costBRL?.toFixed(3)}</p>
                      <p className="text-[8px] text-gray-500 truncate">{usage.shopName || 'Global'}</p>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          ) : activeTab === 'support' ? (
            <motion.div
              key="support"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -30 }}
              className="space-y-6"
            >
              <div className="glass-card p-10 rounded-[3.5rem]">
                <div className="flex justify-between items-center mb-10">
                  <div>
                    <h3 className="text-2xl font-black text-white tracking-tight">Ouvidoria & Suporte Técnico</h3>
                    <p className="text-sm font-medium text-gray-400">Gerenciamento de chamados internos da rede</p>
                  </div>
                  <button 
                    onClick={() => navigate('/app/conversations?mode=internal')}
                    className="flex items-center gap-2 px-6 py-3 bg-indigo-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-600 transition-all"
                  >
                    Abrir Chat Completo
                    <ExternalLink className="h-3 w-3" />
                  </button>
                </div>

                <div className="grid grid-cols-1 gap-4">
                  {loadingSupport ? (
                    <div className="py-20 text-center text-gray-500 font-black uppercase tracking-widest animate-pulse">Sincronizando comunicações...</div>
                  ) : internalChats.length === 0 ? (
                    <div className="py-20 text-center text-gray-600 font-bold uppercase text-[10px] tracking-widest">Nenhum chamado ativo no momento</div>
                  ) : (
                    internalChats.map((chat) => (
                      <div 
                        key={chat.id} 
                        className="bg-white/5 border border-white/10 rounded-3xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-6 hover:border-indigo-500/30 transition-all group"
                      >
                        <div className="flex items-center gap-4">
                          <div className="relative">
                            <div className="h-12 w-12 rounded-2xl bg-indigo-500/20 flex items-center justify-center font-black text-indigo-400">
                              {chat.shopName?.charAt(0) || chat.userName?.charAt(0) || 'S'}
                            </div>
                            {chat.unreadCountAdmin > 0 && (
                              <div className="absolute -top-1 -right-1 w-4 h-4 bg-rose-500 rounded-full flex items-center justify-center text-[8px] font-black text-white border-2 border-[#0a0a0a]">
                                {chat.unreadCountAdmin}
                              </div>
                            )}
                          </div>
                          <div>
                            <span className={`text-[9px] px-2 py-0.5 rounded-full font-black uppercase tracking-widest mb-1 inline-block ${
                              chat.status === 'open' ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' : 'bg-gray-500/10 text-gray-500 border border-gray-500/20'
                            }`}>
                              {chat.status === 'open' ? 'Aberto' : 'Resolvido'}
                            </span>
                            <h4 className="text-sm font-black text-white">{chat.shopName || chat.userName || 'Unidade Parceira'}</h4>
                            <p className="text-xs text-gray-500 line-clamp-1">{chat.lastMessage || 'Iniciando atendimento...'}</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-4">
                          <div className="text-right hidden md:block">
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Última Interação</p>
                            <p className="text-xs font-bold text-white">
                              {chat.lastMessageAt?.toDate ? format(chat.lastMessageAt.toDate(), 'HH:mm • dd/MM') : 'Recentemente'}
                            </p>
                          </div>
                          <button 
                            onClick={() => navigate(`/app/conversations?mode=internal&chatId=${chat.id}`)}
                            className="px-6 py-3 bg-white/5 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-white/10 transition-all border border-white/10"
                          >
                            Atender
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div 
              key="users"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.02 }}
              className="space-y-6"
            >
               {/* Transposed User Management from V1 with V2 aesthetics */}
               <div className="glass-card p-10 rounded-[3.5rem]">
                  <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-8 gap-6">
                    <div>
                      <h3 className="text-2xl font-black text-white tracking-tight">Ecossistema de Parceiros</h3>
                      <div className="flex bg-white/5 p-1 rounded-xl mt-4 border border-white/5">
                        {[
                          { id: 'all', label: 'Todas' },
                          { id: 'shop', label: 'Lojas' },
                          { id: 'fornecedor', label: 'Fornecedores' }
                        ].map(t => (
                          <button
                            key={t.id}
                            onClick={() => setUserTypeFilter(t.id as any)}
                            className={`px-6 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
                              userTypeFilter === t.id ? 'bg-indigo-500 text-white shadow-lg' : 'text-gray-500 hover:text-gray-300'
                            }`}
                          >
                            {t.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="relative">
                      <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
                      <input 
                        type="text" 
                        placeholder="Pesquisar rede..."
                        className="bg-white/5 border border-white/10 rounded-2xl pl-12 pr-6 py-3 text-sm focus:ring-2 focus:ring-indigo-500 text-white w-80 shadow-inner"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                      />
                    </div>
                  </div>

                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b border-white/5">
                        <th className="py-6 px-4 text-[10px] font-black uppercase text-gray-500 tracking-[0.2em]">Parceiro</th>
                        <th className="py-6 px-4 text-[10px] font-black uppercase text-gray-500 tracking-[0.2em]">Status/Plano</th>
                        <th className="py-6 px-4 text-right">Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loading ? (
                        <tr><td colSpan={3} className="py-20 text-center text-gray-600 font-bold uppercase tracking-widest">Mapeando rede...</td></tr>
                      ) : (
                        filteredUsers.filter(u => u.role !== 'employee').map(u => (
                          <React.Fragment key={u.id}>
                            <tr className="border-b border-white/5 hover:bg-white/[0.02] transition-colors group">
                              <td className="py-6 px-4">
                                <div className="flex items-center gap-3">
                                  <div className="h-10 w-10 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center font-black text-indigo-400 group-hover:bg-indigo-600 transition-all">
                                    {(u.displayName || u.name || 'P')?.charAt(0).toUpperCase()}
                                  </div>
                                  <div>
                                    <div className="flex items-center gap-2">
                                      <span className="text-sm font-black text-white group-hover:text-indigo-400 transition-colors">
                                        {u.displayName || u.name || 'Parceiro sem nome'}
                                      </span>
                                      <span className={`text-[9px] px-2 py-0.5 rounded-full font-black uppercase tracking-widest ${
                                        u.role === 'fornecedor' ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20' : 'bg-indigo-500/10 text-indigo-500 border border-indigo-500/20'
                                      }`}>
                                        {u.role === 'fornecedor' ? 'FORNECEDOR' : 'OFICINA'}
                                      </span>
                                    </div>
                                    <span className="text-[10px] text-gray-500 block font-medium">{u.email}</span>
                                  </div>
                                </div>
                              </td>
                              <td className="py-6 px-4">
                                <div className="space-y-1">
                                  <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Plano</span>
                                    <span className="text-[10px] font-black text-indigo-400 uppercase">{u.plan || 'free'}</span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Status</span>
                                    <span className={`text-[10px] font-black uppercase ${u.status === 'active' ? 'text-emerald-400' : 'text-rose-400'}`}>
                                      {u.status === 'active' ? 'Ativo' : 'Bloqueado'}
                                    </span>
                                  </div>
                                </div>
                              </td>
                              <td className="py-6 px-4 text-right">
                                <div className="flex items-center justify-end gap-2">
                                  <button 
                                    onClick={() => {
                                      setUserToEdit(u);
                                      setShowEditModal(true);
                                    }}
                                    title="Editar Dados"
                                    className="p-2 text-gray-400 hover:bg-white/10 rounded-xl transition-all"
                                  >
                                    <UserCircle className="h-4 w-4" />
                                  </button>

                                  <button 
                                    onClick={() => hardResetPassword(u.id, u.email)}
                                    title="Resetar para Senha Aleatória (Hard Reset)"
                                    className="p-2 text-rose-500 hover:bg-rose-500/10 rounded-xl transition-all"
                                  >
                                    <ShieldAlert className="h-4 w-4" />
                                  </button>
                                  
                                  <button 
                                    onClick={() => sendResetEmail(u.email)}
                                    title="Resetar Senha"
                                    className="p-2 text-amber-400 hover:bg-amber-400/10 rounded-xl transition-all"
                                  >
                                    <Key className="h-4 w-4" />
                                  </button>
                                  
                                  <button 
                                    onClick={() => toggleUserStatus(u.id, u.status)}
                                    title={u.status === 'active' ? 'Bloquear' : 'Desbloquear'}
                                    className={`p-2 rounded-xl transition-all ${u.status === 'active' ? 'text-rose-400 hover:bg-rose-400/10' : 'text-emerald-400 hover:bg-emerald-400/10'}`}
                                  >
                                    {u.status === 'active' ? <UserX className="h-4 w-4" /> : <UserCheck className="h-4 w-4" />}
                                  </button>

                                  <button 
                                    onClick={() => manageShop(u.id)}
                                    title="Acessar Modo Visualização"
                                    className="p-2 text-indigo-400 hover:bg-indigo-400/10 rounded-xl transition-all"
                                  >
                                    <ExternalLink className="h-4 w-4" />
                                  </button>

                                  <button 
                                    onClick={() => deleteUser(u.id)}
                                    title="Excluir"
                                    className="p-2 text-gray-600 hover:bg-rose-500 hover:text-white rounded-xl transition-all"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </button>

                                  <button 
                                    onClick={() => toggleShopExpansion(u.id)}
                                    className="p-2 text-gray-400 hover:bg-white/10 rounded-xl transition-all"
                                  >
                                    <Users className={`h-4 w-4 transition-transform ${expandedShops.has(u.id) ? 'rotate-180' : ''}`} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                            
                            <AnimatePresence>
                              {expandedShops.has(u.id) && (
                                <motion.tr
                                  initial={{ opacity: 0, height: 0 }}
                                  animate={{ opacity: 1, height: 'auto' }}
                                  exit={{ opacity: 0, height: 0 }}
                                >
                                  <td colSpan={3} className="px-12 py-4 bg-white/[0.02]">
                                    <div className="space-y-4">
                                      <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 flex items-center gap-2">
                                        <Users className="h-3 w-3" />
                                        Funcionários Vinculados ({getEmployeesForShop(u.id).length})
                                      </h4>
                                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {getEmployeesForShop(u.id).map(emp => (
                                          <div key={emp.id} className="bg-white/5 border border-white/10 rounded-2xl p-4 flex items-center justify-between group/emp hover:border-indigo-500/30 transition-all">
                                            <div className="flex items-center gap-3">
                                              <div className="h-8 w-8 rounded-xl bg-indigo-500/20 flex items-center justify-center font-black text-indigo-400 text-xs">
                                                {(emp.displayName || emp.name || 'E')?.charAt(0).toUpperCase()}
                                              </div>
                                              <div>
                                                <p className="text-xs font-black text-white">{emp.displayName || emp.name || 'Funcionário'}</p>
                                                <p className="text-[9px] text-gray-500 font-medium">{emp.email}</p>
                                              </div>
                                            </div>
                                            <div className="flex items-center gap-1 opacity-0 group-hover/emp:opacity-100 transition-opacity">
                                              <button 
                                                onClick={() => {
                                                  setUserToEdit(emp);
                                                  setShowEditModal(true);
                                                }}
                                                className="p-2 text-gray-400 hover:text-white"
                                              >
                                                <UserCircle className="h-3.5 w-3.5" />
                                              </button>
                                              <button 
                                                onClick={() => hardResetPassword(emp.id, emp.email)}
                                                className="p-2 text-rose-500 hover:bg-rose-500/10 rounded-lg transition-all"
                                                title="Hard Reset Senha"
                                              >
                                                <ShieldAlert className="h-3.5 w-3.5" />
                                              </button>
                                              <button 
                                                onClick={() => sendResetEmail(emp.email)}
                                                className="p-2 text-amber-400 hover:text-amber-300"
                                              >
                                                <Key className="h-3.5 w-3.5" />
                                              </button>
                                              <button 
                                                onClick={() => deleteUser(emp.id)}
                                                className="p-2 text-rose-500 hover:bg-rose-500 hover:text-white rounded-lg transition-all"
                                              >
                                                <Trash2 className="h-3.5 w-3.5" />
                                              </button>
                                            </div>
                                          </div>
                                        ))}
                                        {getEmployeesForShop(u.id).length === 0 && (
                                          <p className="text-[10px] text-gray-600 font-bold uppercase italic">Nenhum funcionário cadastrado nesta unidade.</p>
                                        )}
                                      </div>
                                    </div>
                                  </td>
                                </motion.tr>
                              )}
                            </AnimatePresence>
                          </React.Fragment>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

        {/* Global User Edit Modal */}
        <AnimatePresence>
          {showEditModal && userToEdit && (
            <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setShowEditModal(false)}
                className="absolute inset-0 bg-black/80 backdrop-blur-md"
              />
              <motion.div 
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="relative bg-[#0a0a0a] border border-white/10 rounded-[4rem] w-full max-w-2xl overflow-hidden shadow-2xl"
              >
                <div className="p-8 border-b border-white/5 bg-gradient-to-r from-indigo-600/20 to-purple-600/20">
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="text-[10px] font-black uppercase tracking-[0.3em] text-indigo-400">Hub Master Command</span>
                      <h3 className="text-2xl font-black text-white tracking-tight mt-1">Editar Perfil de Usuário</h3>
                      <p className="text-gray-500 text-xs font-medium uppercase tracking-widest mt-1">ID: {userToEdit.id}</p>
                    </div>
                    <button onClick={() => setShowEditModal(false)} className="p-2 hover:bg-white/5 rounded-xl transition-all">
                      <Shield className="h-6 w-6 text-gray-500" />
                    </button>
                  </div>
                </div>

                <div className="p-8 space-y-6 max-h-[60vh] overflow-y-auto custom-scrollbar">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Nome / Display Name</label>
                      <input 
                        type="text" 
                        value={userToEdit.displayName || userToEdit.name || ''} 
                        onChange={(e) => setUserToEdit({...userToEdit, displayName: e.target.value})}
                        className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-white focus:border-indigo-500 outline-none transition-all font-medium"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">E-mail de Acesso</label>
                      <input 
                        type="email" 
                        value={userToEdit.email || ''} 
                        onChange={(e) => setUserToEdit({...userToEdit, email: e.target.value})}
                        className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-white focus:border-indigo-500 outline-none transition-all font-medium"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Telefone / WhatsApp</label>
                      <input 
                        type="text" 
                        value={userToEdit.phone || ''} 
                        onChange={(e) => setUserToEdit({...userToEdit, phone: e.target.value})}
                        className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-white focus:border-indigo-500 outline-none transition-all font-medium"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Cargo / Role</label>
                      <select 
                        value={userToEdit.role || 'shop'} 
                        onChange={(e) => setUserToEdit({...userToEdit, role: e.target.value})}
                        className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-white focus:border-indigo-500 outline-none transition-all font-medium appearance-none"
                      >
                        <option value="shop">Loja / Oficina</option>
                        <option value="fornecedor">Fornecedor</option>
                        <option value="employee">Funcionário</option>
                        <option value="admin">Administrador Hub</option>
                      </select>
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">CNPJ / CPF</label>
                      <input 
                        type="text" 
                        value={userToEdit.cnpj || userToEdit.cpf || userToEdit.cpfCnpj || ''} 
                        onChange={(e) => setUserToEdit({...userToEdit, cpfCnpj: e.target.value})}
                        className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-white focus:border-indigo-500 outline-none transition-all font-medium"
                      />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Plano de Assinatura</label>
                      <select 
                        value={userToEdit.plan || 'free'} 
                        onChange={(e) => setUserToEdit({...userToEdit, plan: e.target.value})}
                        className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-white focus:border-indigo-500 outline-none transition-all font-medium appearance-none"
                      >
                        <option value="free">Start (Grátis)</option>
                        <option value="pro">Pro (Profissional)</option>
                        <option value="elite">Elite (Master)</option>
                      </select>
                    </div>
                  </div>

                  <div className="pt-6 border-t border-white/5">
                    <label className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-4 block">Segurança & Autenticação</label>
                    <div className="flex flex-wrap gap-4">
                      <button 
                        onClick={() => sendResetEmail(userToEdit.email)}
                        className="flex items-center gap-2 px-6 py-3 bg-white/5 border border-white/10 rounded-xl text-[10px] font-black uppercase tracking-widest text-white hover:bg-white/10 transition-all"
                      >
                        <Key className="h-4 w-4 text-indigo-400" />
                        Enviar E-mail de Redefinição
                      </button>
                      <button 
                        onClick={() => hardResetPassword(userToEdit.id, userToEdit.email)}
                        className="flex items-center gap-2 px-6 py-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-[10px] font-black uppercase tracking-widest text-rose-400 hover:bg-rose-500/20 transition-all"
                      >
                        <ShieldAlert className="h-4 w-4" />
                        Reset Forçado (Novo Acesso)
                      </button>
                    </div>
                  </div>
                </div>

                <div className="p-8 border-t border-white/5 bg-white/[0.02] flex gap-4">
                  <button 
                    onClick={() => setShowEditModal(false)}
                    className="flex-1 px-8 py-4 border border-white/10 rounded-2xl text-gray-400 font-black uppercase tracking-widest text-[10px] hover:bg-white/5 transition-all"
                  >
                    Descartar Alterações
                  </button>
                  <button 
                    onClick={async () => {
                      try {
                        await updateDoc(doc(db, 'users', userToEdit.id), {
                          displayName: userToEdit.displayName || userToEdit.name || '',
                          email: userToEdit.email,
                          phone: userToEdit.phone || '',
                          role: userToEdit.role,
                          plan: userToEdit.plan || 'free',
                          cpfCnpj: userToEdit.cpfCnpj || '',
                          updatedAt: new Date().toISOString()
                        });
                        setUsers(prev => prev.map(u => u.id === userToEdit.id ? { ...u, ...userToEdit } : u));
                        setShowEditModal(false);
                        alert("Perfil atualizado com sucesso!");
                      } catch (error) {
                        console.error("Error updating user:", error);
                        alert("Erro ao atualizar perfil.");
                      }
                    }}
                    className="flex-[2] px-8 py-4 bg-indigo-600 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-xl shadow-indigo-500/20 hover:bg-indigo-700 transition-all active:scale-95"
                  >
                    Aplicar Mudanças no Ecossistema
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
  );
}
