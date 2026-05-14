import { useState, useEffect, useMemo } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { collection, query, where, onSnapshot, getDocs, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { updatePassword, EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';
import { auth, db } from '../firebase';
import { 
  LayoutDashboard, 
  Users, 
  Wrench, 
  ClipboardList, 
  Settings,
  Package,
  Briefcase,
  PieChart,
  Calendar,
  DollarSign,
  FileText,
  MessageSquare,
  Bell,
  LogOut,
  ChevronDown,
  Menu,
  X,
  CreditCard,
  Zap,
  Star,
  Shield,
  Search,
  CheckCircle,
  AlertCircle,
  Lock,
  History as HistoryIcon,
  Brain,
  Crown,
  Trophy,
  Save,
  Trophy as TrophyIcon,
  Moon,
  Sun
} from 'lucide-react';
import { cn } from '../utils/cn';
import { PLAN_LIMITS } from '../utils/planLimits';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../AuthContext';
import ProfileModal from './ProfileModal';
import FAB from './FAB';
import GlobalSearch from './GlobalSearch';

export default function Layout() {
  const { user, profile, effectiveProfile, impersonatedProfile, logout, updateProfile, selectedCompanyId, setSelectedCompanyId } = useAuth();
  const [selectedCompanyName, setSelectedCompanyName] = useState<string | null>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(() => document.documentElement.classList.contains('dark'));
  
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDarkMode]);

  useEffect(() => {
    const saved = localStorage.getItem('theme');
    if (saved === 'dark' || (!saved && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      setIsDarkMode(true);
    }
  }, []);

  let hoverTimeout: NodeJS.Timeout;

  const handleMouseEnter = () => {
    clearTimeout(hoverTimeout);
    setIsHovered(true);
  };

  const handleMouseLeave = () => {
    hoverTimeout = setTimeout(() => {
      setIsHovered(false);
    }, 300);
  };
  const [openDropdowns, setOpenDropdowns] = useState<Record<string, boolean>>({});
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const planDaysRemaining = useMemo(() => {
    if (!profile?.planExpiresAt) return null;
    try {
      const expValue = profile.planExpiresAt;
      let expiry: Date;
      
      if (expValue && typeof expValue === 'object' && 'toDate' in expValue && typeof expValue.toDate === 'function') {
        expiry = expValue.toDate();
      } else {
        expiry = new Date(expValue);
      }

      if (isNaN(expiry.getTime())) return null;
      return Math.ceil((expiry.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    } catch (e) {
      console.error("Error calculating plan expiration:", e);
      return null;
    }
  }, [profile?.planExpiresAt]);

  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, 'notifications'),
      where('companyId', '==', selectedCompanyId || user.uid),
      where('read', '==', false)
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setUnreadNotifications(snapshot.docs.length);
    }, (error) => {
      console.error("Layout: Notifications listener error", error);
    });
    return () => unsubscribe();
  }, [user, selectedCompanyId]);

  useEffect(() => {
    if (selectedCompanyId) {
      const fetchSelectedCompany = async () => {
        const docSnap = await getDocs(query(collection(db, 'users'), where('id', '==', selectedCompanyId)));
        if (!docSnap.empty) {
          const data = docSnap.docs[0].data();
          setSelectedCompanyName(data.displayName || data.name || 'Loja');
        }
      };
      fetchSelectedCompany();
    } else {
      setSelectedCompanyName(null);
    }
  }, [selectedCompanyId]);

  const toggleDropdown = (name: string) => {
    setOpenDropdowns(prev => ({ ...prev, [name]: !prev[name] }));
  };

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const ForcePasswordChangeModal = () => {
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (newPassword !== confirmPassword) {
        setError('As senhas não coincidem');
        return;
      }
      if (newPassword.length < 6) {
        setError('A nova senha deve ter pelo menos 6 caracteres');
        return;
      }

      setLoading(true);
      setError('');

      try {
        const user = auth.currentUser;
        if (!user || !user.email) throw new Error('Usuário não autenticado');

        // 1. Re-authenticate
        const credential = EmailAuthProvider.credential(user.email, currentPassword);
        await reauthenticateWithCredential(user, credential);

        // 2. Update Password
        await updatePassword(user, newPassword);

        // 3. Clear flag in Firestore
        await updateDoc(doc(db, 'users', user.uid), {
          forcePasswordChange: false,
          updatedAt: serverTimestamp()
        });

        alert('Senha atualizada com sucesso!');
        window.location.reload(); // Refresh to clear state
      } catch (err: any) {
        console.error('Error forcing password change:', err);
        setError(err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential' ? 'Senha atual incorreta' : err.message);
      } finally {
        setLoading(false);
      }
    };

    return (
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-gray-900/90 backdrop-blur-md p-4">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl w-full max-w-md p-8 border border-white/20"
        >
          <div className="text-center space-y-4 mb-8">
            <div className="h-16 w-16 bg-amber-100 dark:bg-amber-900/30 rounded-2xl flex items-center justify-center mx-auto">
              <Lock className="h-8 w-8 text-amber-600" />
            </div>
            <div>
              <h2 className="text-2xl font-black text-gray-900 dark:text-white uppercase tracking-tighter">Alteração Obrigatória</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">Sua senha foi resetada administrativamente. Defina uma nova senha para continuar acessando a plataforma.</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 bg-red-50 text-red-700 text-xs font-bold rounded-xl border border-red-100 flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                {error}
              </div>
            )}

            <div className="space-y-1">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-4">Senha Temporária / Atual</label>
              <input
                type="password"
                required
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full px-6 py-4 bg-gray-50 dark:bg-gray-900 border border-transparent focus:border-indigo-500 rounded-2xl outline-none transition-all font-medium"
                placeholder="A senha que o admin forneceu"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-4">Nova Senha</label>
              <input
                type="password"
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full px-6 py-4 bg-gray-50 dark:bg-gray-900 border border-transparent focus:border-indigo-500 rounded-2xl outline-none transition-all font-medium"
                placeholder="Mínimo 6 caracteres"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-4">Confirmar Nova Senha</label>
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-6 py-4 bg-gray-50 dark:bg-gray-900 border border-transparent focus:border-indigo-500 rounded-2xl outline-none transition-all font-medium"
                placeholder="Repita a nova senha"
              />
            </div>

            <div className="flex flex-col gap-3 pt-4">
              <button
                type="submit"
                disabled={loading}
                className="w-full py-4 bg-indigo-600 text-white font-bold rounded-2xl hover:bg-indigo-700 shadow-xl shadow-indigo-200 dark:shadow-none transition-all flex items-center justify-center gap-2"
              >
                {loading ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <><Save className="w-5 h-5" /> Atualizar Senha e Entrar</>}
              </button>
              
              <button
                type="button"
                onClick={handleLogout}
                className="w-full py-3 text-sm text-gray-500 font-bold hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
              >
                Sair sem alterar
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    );
  };

  const menuLabels = {
    workOrders: 
      effectiveProfile?.shopType === 'lava_jato' ? 'Serviços de Lavagem' : 
      effectiveProfile?.shopType === 'som_automotivo' ? 'Instalações / Som' :
      effectiveProfile?.shopType === 'auto_eletrica' ? 'Reparos Elétricos' : 
      'Ordens de Serviço',
    inventory:
      effectiveProfile?.shopType === 'lava_jato' ? 'Insumos / Produtos' : 'Estoque',
    equipment:
      effectiveProfile?.segment === 'automotive' || !effectiveProfile?.segment ? 'Veículos' : 'Equipamentos'
  };

  const groupedNavigation = [
    { name: 'Início', href: '/app', icon: LayoutDashboard },
    { name: 'Conversas', href: '/app/conversations', icon: MessageSquare },
    {
      name: 'Operacional',
      icon: ClipboardList,
      children: [
        { name: 'Clientes', href: '/app/customers' },
        { name: menuLabels.equipment, href: '/app/equipment' },
        { name: 'Orçamentos', href: '/app/budgets' },
        { name: menuLabels.workOrders, href: '/app/work-orders' },
        { name: 'Quadro Kanban', href: '/app/kanban' },
        { name: 'Serviços', href: '/app/services' },
        { name: 'Histórico Veicular', href: '/app/vehicle-history', icon: HistoryIcon },
      ]
    },
    {
      name: 'Logística',
      icon: Package,
      children: [
        { name: 'Meus Pedidos', href: '/app/orders' },
        { name: menuLabels.inventory, href: '/app/inventory' },
        ...(effectiveProfile?.role === 'shop' || effectiveProfile?.role === 'admin' ? [{ name: 'Fornecedores', href: '/app/suppliers' }] : []),
      ]
    },
    {
      name: 'Painel do Fornecedor',
      icon: Briefcase,
      children: [
        { name: 'Pedidos Recebidos', href: '/app/supplier/orders' },
        { name: 'Catálogo / Estoque', href: '/app/supplier/inventory' },
        { name: 'Meus Clientes', href: '/app/supplier/customers' },
        { name: 'Quadro Kanban', href: '/app/kanban' },
        { name: 'Business Intelligence', href: '/app/supplier/bi' },
      ],
      showFor: ['fornecedor', 'admin']
    },
    {
      name: 'Financeiro', 
      icon: DollarSign,
      children: [
        { name: 'Fluxo de Caixa', href: '/app/cash-flow' },
        { name: 'Contas a Pagar', href: '/app/finance/payables' },
        { name: 'Contas a Receber', href: '/app/finance/receivables' },
        { name: 'Relatórios', href: '/app/reports/financial' }
      ]
    },
    {
      name: 'Inteligência & Gestão',
      icon: Brain,
      children: [
        { name: 'Curva ABC', href: '/app/intelligence/abc' },
        { name: 'Reposição Inteligente', href: '/app/intelligence/replenishment' },
        { name: 'Insights & Saúde IA', href: '/app/intelligence/health' },
        { name: 'Gamificação', href: '/app/gamification', icon: Trophy },
      ]
    },
    ...((effectiveProfile?.role === 'shop' || effectiveProfile?.role === 'admin' || effectiveProfile?.id === selectedCompanyId ? [
      { 
        name: 'Relatórios Operacionais', 
        icon: PieChart,
        href: '/app/reports/operational'
      }
    ] : [])),
    { 
      name: 'Agenda', 
      icon: Calendar,
      href: '/app/schedule'
    },


    {
      name: 'Equipe',
      icon: Users,
      children: [
        { name: 'Funcionários', href: '/app/employees' },
      ],
      hideFor: ['employee', 'fornecedor']
    },
    ...((effectiveProfile?.role === 'shop' ? [{
      name: 'Assinatura',
      href: '/app/subscription',
      icon: CreditCard
    }] : [])),
    ...((effectiveProfile?.role === 'admin' && !selectedCompanyId ? [{
      name: 'Gestão Global',
      href: '/app/admin',
      icon: Shield
    }] : []))
  ];

  const filteredNavigation = groupedNavigation
    .map(item => {
      const newItem = { ...item };
      const userPlan = effectiveProfile?.plan || 'free';
      const userPlanKey = userPlan === 'start' ? 'free' : userPlan;
      const limits = (PLAN_LIMITS as any)[userPlanKey];

      if (selectedCompanyId) {
        if (newItem.name === 'Gestão Global' || newItem.name === 'Assinatura') return null;
      }

      if (effectiveProfile?.role === 'employee') {
        if (newItem.name === 'Financeiro' || newItem.name === 'Relatórios Operacionais' || newItem.name === 'Inteligência & Gestão') return null;
      }

      // Feature Locking Detection (instead of hiding)
      const isConversationsLocked = newItem.name === 'Conversas' && !limits?.conversations;
      const isOperationalReportsLocked = newItem.name === 'Relatórios Operacionais' && !limits?.operationalReports;
      const isIntelligenceLocked = newItem.name === 'Inteligência & Gestão' && !limits?.monthlyGoal; // Most intelligence features are Elite
      const isTeamLocked = newItem.name === 'Equipe' && !limits?.teamCreation;

      if ((isConversationsLocked || isOperationalReportsLocked || isIntelligenceLocked || isTeamLocked) && effectiveProfile?.role !== 'fornecedor' && effectiveProfile?.role !== 'admin') {
        (newItem as any).isLocked = true;
      }

      if (newItem.children) {
        newItem.children = newItem.children.map((child: any) => {
          const isVehicleHistoryLocked = child.name === 'Histórico Veicular' && !limits?.vehicleHistory;
          const isFinancialReportsLocked = child.name === 'Relatórios' && newItem.name === 'Financeiro' && !limits?.financeReports;
          const isMonthlyGoalLocked = child.name === 'Meta Mensal' && !limits?.monthlyGoal;
          const isGamificationLocked = child.name === 'Gamificação' && !limits?.gamification;
          const isABCAnalysisLocked = child.name === 'Curva ABC' && !limits?.monthlyGoal;
          const isReplenishmentLocked = child.name === 'Reposição Inteligente' && !limits?.monthlyGoal;
          const isAIHealthLocked = child.name === 'Insights & Saúde IA' && !limits?.monthlyGoal;

          if ((isVehicleHistoryLocked || isFinancialReportsLocked || isMonthlyGoalLocked || isGamificationLocked || isABCAnalysisLocked || isReplenishmentLocked || isAIHealthLocked) && effectiveProfile?.role !== 'fornecedor' && effectiveProfile?.role !== 'admin') {
             return { ...child, isLocked: true };
          }
          return child;
        });
      }

      // Unified filtering for Supplier
      if (effectiveProfile?.role === 'fornecedor') {
        const allowedTopLevel = ['Início', 'Painel do Fornecedor', 'Financeiro'];
        if (!allowedTopLevel.includes(newItem.name)) return null;
      }

      // Check explicit showFor and hideFor rules
      if ((newItem as any).showFor && !(newItem as any).showFor.includes(effectiveProfile?.role)) {
        return null;
      }
      if ((newItem as any).hideFor && (newItem as any).hideFor.includes(effectiveProfile?.role)) {
        return null;
      }

      return newItem;
    })

    .filter((item): item is NonNullable<typeof item> => item !== null);

  const renderNavItem = (item: any, isExpanded?: boolean) => {
    if (item.children) {
      const isOpen = openDropdowns[item.name];
      return (
        <div key={item.name} className="space-y-1">
          <button
            onClick={() => toggleDropdown(item.name)}
            className={cn(
              'flex w-full items-center px-4 py-3 text-sm font-bold rounded-2xl transition-all duration-300',
              isOpen 
                ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300' 
                : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800',
              !isExpanded ? 'justify-center shrink-0' : 'justify-between'
            )}
            title={!isExpanded ? item.name : undefined}
          >
            <div className="flex items-center gap-3">
              <item.icon className="h-5 w-5 shrink-0" />
              {isExpanded && (
                <motion.span 
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="whitespace-nowrap"
                >
                  {item.name}
                </motion.span>
              )}
              {isExpanded && item.isLocked && <Lock className="h-3 w-3 text-amber-500" />}
            </div>
            {isExpanded && <ChevronDown className={cn("h-4 w-4 transition-transform duration-300", isOpen && "rotate-180")} />}
          </button>
          
          <AnimatePresence>
            {isOpen && isExpanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="pl-9 space-y-1 overflow-hidden"
              >
                {item.children.map((child: any) => (
                  <NavLink
                    key={child.name}
                    to={child.href}
                    onClick={(e) => {
                      if (child.isLocked) {
                        e.preventDefault();
                        alert(`🚀 Recurso Exclusivo Elite!\n\n${child.name} está disponível apenas no Plano Elite. Deseja fazer upgrade agora para liberar o potencial máximo da sua oficina?`);
                        navigate('/app/subscription');
                        return;
                      }
                      setSidebarOpen(false);
                    }}
                    className={({ isActive }) =>
                      cn(
                        'block px-4 py-2 text-xs font-bold rounded-xl transition-all border-l-2',
                        isActive
                          ? 'border-indigo-600 text-indigo-700 bg-indigo-50/50 dark:bg-indigo-900/20'
                          : 'border-transparent text-gray-500 hover:text-gray-900 dark:hover:text-white',
                        child.isLocked && 'opacity-60 grayscale-[0.5]'
                      )
                    }
                  >
                    <div className="flex items-center justify-between">
                      {child.name}
                      {child.isLocked && <Lock className="h-3 w-3 text-amber-500" />}
                    </div>
                  </NavLink>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      );
    }

    return (
      <NavLink
        key={item.name}
        to={item.href}
        end={item.href === '/app'}
        title={!isExpanded ? item.name : undefined}
        onClick={(e) => {
          if (item.isLocked) {
            e.preventDefault();
            alert(`🚀 Recurso Exclusivo Elite!\n\n${item.name} está disponível apenas no Plano Elite. Deseja fazer upgrade agora para liberar o potencial máximo da sua oficina?`);
            navigate('/app/subscription');
            return;
          }
          setSidebarOpen(false);
        }}
        className={({ isActive }) =>
          cn(
            'flex items-center gap-3 px-4 py-3 text-sm font-bold rounded-2xl transition-all duration-300',
            isActive 
              ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200 dark:shadow-none' 
              : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800',
            item.isLocked && 'opacity-60 grayscale-[0.5]',
            !isExpanded && 'justify-center px-0 shrink-0'
          )
        }
      >
        <item.icon className="h-5 w-5 shrink-0" />
        {isExpanded && (
          <motion.span
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            className="whitespace-nowrap"
          >
            {item.name}
          </motion.span>
        )}
        {isExpanded && item.isLocked && <Lock className="ml-auto h-3 w-3 text-amber-500 shrink-0" />}
      </NavLink>
    );
  };

  const SidebarContent = ({ isExpanded }: { isExpanded?: boolean }) => (
    <>
      <div className={cn(
        "px-6 h-20 flex items-center border-b border-gray-100 dark:border-gray-800 shrink-0 transition-all duration-300",
        !isExpanded ? "justify-center px-0" : "justify-between"
      )}>
        <div className="flex items-center">
          <div className="p-2 bg-indigo-600 rounded-xl shadow-lg shadow-indigo-200 dark:shadow-none shrink-0 cursor-pointer" onClick={() => navigate('/app')}>
            <Wrench className="h-6 w-6 text-white" />
          </div>
          {isExpanded && (
            <motion.h1 
              initial={{ opacity: 0, x: -15 }}
              animate={{ opacity: 1, x: 0 }}
              className="ml-3 text-2xl font-black text-gray-900 dark:text-white tracking-tight whitespace-nowrap overflow-hidden"
            >
              Service Hub
            </motion.h1>
          )}
        </div>
        {!isExpanded && sidebarOpen && (
          <button 
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 bg-gray-50 dark:bg-gray-800 rounded-xl transition-colors"
            title="Fechar menu"
          >
            <X className="h-6 w-6" />
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto overflow-x-hidden py-6 px-4 space-y-2 no-scrollbar scroll-smooth">
        {filteredNavigation.map((item) => renderNavItem(item, isExpanded))}
      </div>

      <div className={cn(
        "p-6 border-t border-gray-100 dark:border-gray-800 space-y-2 shrink-0 transition-all duration-300",
        !isExpanded && "px-2"
      )}>
        <NavLink 
          to="/app/settings" 
          onClick={() => setSidebarOpen(false)}
          className={cn(
            "flex items-center px-4 py-3 text-sm font-bold text-gray-600 dark:text-gray-300 gap-3 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-2xl transition-all",
            !isExpanded && "justify-center px-0 shrink-0"
          )}
          title={!isExpanded ? "Perfil/Configurações" : undefined}
        >
          <Settings className="h-5 w-5 shrink-0" />
          {isExpanded && (
            <motion.span 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }}
              className="whitespace-nowrap"
            >
              Perfil/Configurações
            </motion.span>
          )}
        </NavLink>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-[#0b0e14] relative overflow-hidden flex">
      {/* Background Mesh */}
      <div className="mesh-bg-premium" />

      {profile?.forcePasswordChange && <ForcePasswordChangeModal />}
      
      <AnimatePresence>
        {selectedCompanyId && (
          <motion.div 
            initial={{ y: -100, x: '-50%', opacity: 0 }}
            animate={{ y: 0, x: '-50%', opacity: 1 }}
            exit={{ y: -100, x: '-50%', opacity: 0 }}
            className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] w-[95%] max-w-2xl px-4"
          >
            <div className="bg-indigo-600/90 dark:bg-indigo-900/95 backdrop-blur-2xl border border-white/20 dark:border-indigo-400/30 px-8 py-5 rounded-[2.5rem] shadow-[0_25px_60px_-15px_rgba(79,70,229,0.5)] flex items-center justify-between gap-6 group overflow-hidden relative">
              {/* Dynamic Glow Effect */}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1500"></div>
              
              <div className="flex items-center gap-5 relative z-10">
                <div className="p-3.5 bg-white/15 rounded-2xl ring-1 ring-white/30 shadow-inner">
                  <Shield className="h-6 w-6 text-white animate-pulse" />
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                    <p className="text-[10px] font-black uppercase tracking-[0.25em] text-indigo-100/70">Modo Visualização Ativo</p>
                  </div>
                  <h3 className="text-base font-black text-white tracking-tight">
                    {selectedCompanyName || 'Sincronizando Sessão...'}
                  </h3>
                </div>
              </div>

              <div className="flex items-center gap-3 relative z-10">
                <button 
                  onClick={() => {
                    setSelectedCompanyId(null);
                    setTimeout(() => {
                      window.location.href = '/app/admin';
                    }, 50);
                  }}
                  className="bg-white text-indigo-600 px-8 py-3 rounded-2xl hover:bg-indigo-50 transition-all font-black uppercase tracking-widest text-[10px] shadow-xl shadow-black/10 active:scale-95 flex items-center gap-2 group/btn border-b-2 border-indigo-100"
                >
                  <X className="w-4 h-4 group-hover/btn:rotate-90 transition-transform" />
                  Sair da Visualização
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      {/* Drawer Overlay (Backdrop) */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-md" 
            onClick={() => setSidebarOpen(false)} 
          />
        )}
      </AnimatePresence>

      {/* Persistent Sidebar for Desktop (Hover-Activated Overlay) */}
      <motion.aside 
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        initial={false}
        animate={{ 
          width: isHovered ? '20rem' : '5.5rem',
        }}
        transition={{ type: 'spring', damping: 20, stiffness: 100 }}
        className={cn(
          "hidden lg:flex sticky inset-y-0 left-0 z-40 bg-black/40 backdrop-blur-3xl flex-col border-r border-white/5 shadow-[20px_0_80px_rgba(0,0,0,0.5)] overflow-hidden"
        )}
      >
        <SidebarContent isExpanded={isHovered} />
      </motion.aside>

      {/* Sidebar Drawer for Mobile */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div 
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className={cn(
              "fixed inset-y-0 left-0 z-50 w-full max-w-xs bg-white dark:bg-gray-900 shadow-2xl flex flex-col border-r transition-all duration-500 lg:hidden",
              selectedCompanyId 
                ? "border-indigo-500/50 shadow-[20px_0_60px_-15px_rgba(79,70,229,0.1)]" 
                : "border-gray-100 dark:border-gray-800"
            )}
          >
            <SidebarContent isExpanded={true} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content Area */}
      <div className={cn(
        "flex flex-col min-h-screen transition-all duration-500 ease-in-out lg:pl-20 relative bg-[#0b0e14]"
      )}>
        <div className="mesh-bg" />
        
        {/* Floating Glass Header */}
        <motion.header 
          className="fixed top-4 left-0 lg:left-20 right-0 z-30 px-4 sm:px-6 lg:px-8 pointer-events-none"
        >
          <motion.div 
            animate={{ 
              maxWidth: isHovered ? '95%' : '1536px',
              scale: isHovered ? 0.98 : 1,
              opacity: isHovered ? 0.8 : 1
            }}
            transition={{ type: 'spring', damping: 25, stiffness: 120 }}
            className="mx-auto h-20 flex items-center justify-between px-8 bg-black/20 backdrop-blur-3xl border border-white/5 rounded-[2rem] shadow-[0_20px_50px_rgba(0,0,0,0.3)] pointer-events-auto"
          >
            <div className="flex items-center gap-6">
              <button 
                onClick={() => setSidebarOpen(true)}
                className="lg:hidden p-3 bg-indigo-50 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 rounded-2xl transition-all shadow-sm group"
                title="Abrir menu"
              >
                <Menu className="h-6 w-6 group-hover:scale-110 transition-transform" />
              </button>
              
              <GlobalSearch />
            </div>

            {/* User Actions */}
            <div className="flex items-center gap-4">
              <button
                onClick={() => setIsDarkMode(!isDarkMode)}
                className="p-2 text-gray-400 hover:text-indigo-600 dark:hover:text-amber-400 transition-colors"
                title={isDarkMode ? "Modo Claro" : "Modo Escuro"}
              >
                {isDarkMode ? <Sun className="h-6 w-6" /> : <Moon className="h-6 w-6" />}
              </button>

              <NavLink to="/app/notifications" className="relative p-2 text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400">
                <Bell className="h-6 w-6" />
                {unreadNotifications > 0 && (
                  <span className="absolute top-1 right-1 h-5 w-5 rounded-full bg-rose-500 ring-4 ring-white dark:ring-gray-900 text-[10px] font-black text-white flex items-center justify-center">
                    {unreadNotifications > 9 ? '9+' : unreadNotifications}
                  </span>
                )}
              </NavLink>

              <div 
                className="flex items-center gap-3 p-1 cursor-pointer group"
                onClick={() => navigate('/app/settings')}
              >
                <div className="hidden sm:flex flex-col items-end">
                  <span className="text-xs font-black text-gray-900 dark:text-white">
                    {effectiveProfile?.name || effectiveProfile?.email?.split('@')[0]}
                  </span>
                  <span className={cn(
                    "text-[10px] font-bold uppercase tracking-widest flex items-center gap-1",
                    selectedCompanyId ? "text-indigo-600 dark:text-indigo-400" : "text-gray-500"
                  )}>
                    {selectedCompanyId ? 'Visualizando Loja' : profile?.role === 'admin' ? 'Painel Admin' : profile?.role === 'fornecedor' ? 'Plano Fornecedor' : `Plano ${profile?.plan || 'Start'}`}
                    {profile?.planExpiresAt && profile?.role !== 'admin' && planDaysRemaining !== null && planDaysRemaining <= 10 && planDaysRemaining >= 0 && (
                      <span className="text-rose-500 animate-pulse">(Expira em {planDaysRemaining}d)</span>
                    )}
                    {profile?.planExpiresAt && profile?.role !== 'admin' && planDaysRemaining !== null && planDaysRemaining > 10 && (
                      <span className="text-amber-500">(Expira em {planDaysRemaining}d)</span>
                    )}
                  </span>
                </div>
                <div className="relative">
                  {effectiveProfile?.photoURL ? (
                    <img src={effectiveProfile?.photoURL} alt="" className="h-10 w-10 rounded-2xl object-cover border-2 border-indigo-100 dark:border-indigo-900 group-hover:border-indigo-500 transition-colors" referrerPolicy="no-referrer" />
                  ) : (
                    <div className="h-10 w-10 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-black">{ (effectiveProfile?.name || effectiveProfile?.email || 'U')[0].toUpperCase() }</div>
                  )}
                  <div className="absolute -bottom-1 -right-1 h-4 w-4 rounded-full bg-emerald-500 border-2 border-white dark:border-gray-900 shadow-sm"></div>
                </div>
              </div>

              <button 
                onClick={handleLogout}
                className="p-3 text-gray-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-2xl transition-all"
                title="Sair"
              >
                <LogOut className="h-5 w-5" />
              </button>
            </div>
          </motion.div>
        </motion.header>

        {/* Main Content */}
        <main className="flex-1 overflow-x-hidden pt-24">
          <div className="max-w-[1920px] mx-auto py-10 px-4 sm:px-6 lg:px-8">
            <Outlet />
          </div>
        </main>
      </div>
      
      <FAB />
      {isProfileModalOpen && (
        <ProfileModal 
          isOpen={isProfileModalOpen} 
          onClose={() => setIsProfileModalOpen(false)} 
          profile={effectiveProfile || profile}
          onUpdate={updateProfile}
        />
      )}
    </div>
  );
}
