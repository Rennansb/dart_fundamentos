import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Search, 
  Plus, 
  Users, 
  ClipboardList, 
  Package, 
  DollarSign, 
  PieChart, 
  MessageSquare,
  ChevronRight,
  Command,
  ArrowRight,
  TrendingUp,
  X,
  Columns2,
  Calculator,
  Wrench,
  Calendar,
  Settings,
  History,
  ShieldCheck,
  FileText,
  BarChart3,
  Target,
  Trophy,
  Brain,
  Activity,
  ShoppingCart,
  LayoutDashboard,
  Crown
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { collection, query, where, getDocs, limit } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../AuthContext';
import { cn } from '../utils/cn';

interface SearchResult {
  id: string;
  title: string;
  subtitle: string;
  type: 'customer' | 'order' | 'inventory' | 'action';
  link: string;
  icon?: any;
}

export default function GlobalSearch() {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const { profile, selectedCompanyId } = useAuth();
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // List of all possible quick actions
  const quickActions: SearchResult[] = [
    { id: 'dashboard', title: 'Dashboard Principal', subtitle: 'Visão geral da oficina', type: 'action', link: '/app', icon: LayoutDashboard },
    { id: 'kanban', title: 'Quadro Kanban', subtitle: 'Fluxo de trabalho e OS ativas', type: 'action', link: '/app/kanban', icon: Columns2 },
    { id: 'budgets', title: 'Orçamentos / DAV', subtitle: 'Gerenciar vendas e orçamentos', type: 'action', link: '/app/budgets', icon: FileText },
    { id: 'new-os', title: 'Nova Ordem de Serviço', subtitle: 'Abrir nova OS direta', type: 'action', link: '/app/work-orders', icon: Plus },
    { id: 'customers', title: 'Clientes e Veículos', subtitle: 'Base de contatos e frota', type: 'action', link: '/app/customers', icon: Users },
    { id: 'cash-flow', title: 'Fluxo de Caixa', subtitle: 'Visão diária do financeiro', type: 'action', link: '/app/cash-flow', icon: DollarSign },
    { id: 'payables', title: 'Contas a Pagar', subtitle: 'Gestão de saídas e despesas', type: 'action', link: '/app/finance/payables', icon: Calculator },
    { id: 'receivables', title: 'Contas a Receber', subtitle: 'Gestão de entradas e faturamento', type: 'action', link: '/app/finance/receivables', icon: DollarSign },
    { id: 'inventory', title: 'Estoque de Peças', subtitle: 'Controle de peças e itens', type: 'action', link: '/app/inventory', icon: Package },
    { id: 'services', title: 'Meus Serviços', subtitle: 'Catálogo de mão de obra', type: 'action', link: '/app/services', icon: Wrench },
    { id: 'orders', title: 'Pedidos Loja Hub', subtitle: 'Peças compradas de fornecedores', type: 'action', link: '/app/orders', icon: ShoppingCart },
    { id: 'employees', title: 'Equipe e Funcionários', subtitle: 'Colaboradores e permissões', type: 'action', link: '/app/employees', icon: ShieldCheck },
    { id: 'schedule', title: 'Agenda / Calendário', subtitle: 'Agendamentos e prazos', type: 'action', link: '/app/schedule', icon: Calendar },
    { id: 'history', title: 'Histórico Veicular', subtitle: 'Pastado de placas e revisões', type: 'action', link: '/app/vehicle-history', icon: History },
    { id: 'monthly-goal', title: 'Minha Meta Mensal', subtitle: 'Acompanhar progresso elite', type: 'action', link: '/app/monthly-goal', icon: Target },
    { id: 'gamification', title: 'Recompensas e Ranking', subtitle: 'Conquistas da oficina', type: 'action', link: '/app/gamification', icon: Trophy },
    { id: 'rep-op', title: 'Relatórios Operacionais', subtitle: 'Desempenho da oficina', type: 'action', link: '/app/reports/operational', icon: PieChart },
    { id: 'rep-fin', title: 'Relatórios Financeiros', subtitle: 'DRE e lucratividade', type: 'action', link: '/app/reports/financial', icon: DollarSign },
    { id: 'intel-abc', title: 'Análise ABC (Estoque)', subtitle: 'Curva de giro inteligente', type: 'action', link: '/app/intelligence/abc', icon: BarChart3 },
    { id: 'intel-rep', title: 'Reposição Inteligente', subtitle: 'IA de compra de peças', type: 'action', link: '/app/intelligence/replenishment', icon: Brain },
    { id: 'intel-health', title: 'Saúde da Oficina (IA)', subtitle: 'Insights de inteligência', type: 'action', link: '/app/intelligence/health', icon: Activity },
    { id: 'settings', title: 'Configurações', subtitle: 'Ajustes da oficina e perfil', type: 'action', link: '/app/settings', icon: Settings },
    { id: 'sub', title: 'Assinatura e Planos', subtitle: 'Hub Store e pagamentos', type: 'action', link: '/app/subscription', icon: Crown },
    { id: 'whatsapp', title: 'WhatsApp e Chat Bot', subtitle: 'Comunicar com clientes', type: 'action', link: '/app/conversations', icon: MessageSquare },
  ];

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
      }
      if (e.key === 'Escape') {
        setIsOpen(false);
        inputRef.current?.blur();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Handle click outside to close
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Search Logic with Debounce
  useEffect(() => {
    if (!search.trim() || search.length < 2) {
      setResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      const companyId = selectedCompanyId || profile?.companyId;
      if (!companyId) return;

      try {
        const searchTerms = search.toLowerCase();
        
        // Parallel searches for better performance
        const [customersSnap, ordersSnap, inventorySnap] = await Promise.all([
          getDocs(query(collection(db, 'customers'), where('companyId', '==', companyId), limit(5))),
          getDocs(query(collection(db, 'work_orders'), where('companyId', '==', companyId), limit(5))),
          getDocs(query(collection(db, 'inventory'), where('companyId', '==', companyId), limit(5)))
        ]);

        const customerResults: SearchResult[] = customersSnap.docs
          .map(doc => ({ id: doc.id, data: doc.data() }))
          .filter(item => item.data.name?.toLowerCase().includes(searchTerms) || item.data.phone?.includes(searchTerms))
          .map(item => ({
            id: item.id,
            title: item.data.name,
            subtitle: `Cliente • ${item.data.phone || 'Sem telefone'}`,
            type: 'customer',
            link: `/app/customers`,
            icon: Users
          }));

        const orderResults: SearchResult[] = ordersSnap.docs
          .map(doc => ({ id: doc.id, data: doc.data() }))
          .filter(item => item.data.customerName?.toLowerCase().includes(searchTerms) || item.id.substring(0,6).includes(searchTerms) || item.data.plate?.toLowerCase().includes(searchTerms))
          .map(item => ({
            id: item.id,
            title: item.data.plate ? `${item.data.plate} - ${item.data.customerName}` : `OS #${item.id.substring(0, 6)}`,
            subtitle: `OS • ${item.data.status === 'in_repair' ? 'Em Reparo' : 'Pendente'}`,
            type: 'order',
            link: `/app/work-orders`,
            icon: ClipboardList
          }));

        const inventoryResults: SearchResult[] = inventorySnap.docs
          .map(doc => ({ id: doc.id, data: doc.data() }))
          .filter(item => item.data.partName?.toLowerCase().includes(searchTerms))
          .map(item => ({
            id: item.id,
            title: item.data.partName,
            subtitle: `Estoque • Qtd: ${item.data.stockQuantity || 0}`,
            type: 'inventory',
            link: `/app/inventory`,
            icon: Package
          }));

        setResults([...customerResults, ...orderResults, ...inventoryResults].slice(0, 8));
      } catch (error) {
        console.error("GlobalSearch: Search error", error);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [search, profile?.companyId, selectedCompanyId]);

  const handleSelect = (result: SearchResult) => {
    navigate(result.link);
    setIsOpen(false);
    setSearch('');
    inputRef.current?.blur();
  };

  // Combined and filtered results
  const filteredActions = quickActions.filter(action => 
    action.title.toLowerCase().includes(search.toLowerCase()) || 
    action.subtitle.toLowerCase().includes(search.toLowerCase())
  );

  const displayResults = search.length >= 1 
    ? [...filteredActions, ...results]
    : quickActions;

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => (prev + 1) % displayResults.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => (prev - 1 + displayResults.length) % displayResults.length);
    } else if (e.key === 'Enter' && displayResults[selectedIndex]) {
      handleSelect(displayResults[selectedIndex]);
    }
  };

  return (
    <div ref={containerRef} className="relative flex-1 max-w-xl mx-4 lg:block hidden">
      {/* Search Input Bar */}
      <div className={cn(
        "flex items-center gap-3 px-4 h-11 rounded-2xl transition-all duration-300 ring-1",
        isOpen 
          ? "bg-white dark:bg-gray-800 ring-indigo-500 shadow-lg" 
          : "bg-gray-50/50 dark:bg-gray-900/20 ring-gray-200/50 dark:ring-white/5 hover:ring-indigo-500/50"
      )}>
        <Search className={cn(
          "h-4 w-4 transition-colors",
          isOpen ? "text-indigo-600" : "text-gray-400"
        )} />
        <input
          ref={inputRef}
          type="text"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setSelectedIndex(0);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={onKeyDown}
          placeholder="Busque clientes, placas ou ações... (Cmd+K)"
          className="flex-1 bg-transparent border-none outline-none text-sm font-bold text-gray-900 dark:text-white placeholder:text-gray-400 placeholder:font-medium"
        />
        <div className="flex items-center gap-1">
          <kbd className="hidden sm:inline-flex h-5 items-center gap-1 rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-1.5 font-mono text-[10px] font-black text-gray-400 uppercase">
            <span>⌘</span>K
          </kbd>
          {search && (
            <button 
              onClick={() => { setSearch(''); inputRef.current?.focus(); }}
              className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              <X className="h-3 w-3 text-gray-400" />
            </button>
          )}
        </div>
      </div>

      {/* Results Dropdown */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.98 }}
            className="absolute top-full left-0 right-0 mt-3 p-2 bg-white/90 dark:bg-gray-900/90 backdrop-blur-2xl border border-gray-100 dark:border-white/10 rounded-[2rem] shadow-[0_20px_50px_rgba(0,0,0,0.2)] z-50 overflow-hidden"
          >
            <div className="max-h-[60vh] overflow-y-auto no-scrollbar py-2">
              {/* Contextual Title */}
              <div className="px-4 py-2 flex items-center justify-between">
                <span className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">
                  {search.length >= 1 ? 'Sugestões e Resultados' : 'Centro de Comando / Ações'}
                </span>
                {loading && <TrendingUp className="h-3 w-3 text-indigo-500 animate-pulse" />}
              </div>

              <div className="space-y-1">
                {displayResults.map((item, index) => (
                  <button
                    key={`${item.type}-${item.id}`}
                    onClick={() => handleSelect(item)}
                    onMouseEnter={() => setSelectedIndex(index)}
                    className={cn(
                      "w-full flex items-center justify-between p-3 rounded-2xl transition-all duration-200 group relative overflow-hidden",
                      selectedIndex === index 
                        ? "bg-indigo-600 text-white shadow-xl shadow-indigo-500/20" 
                        : "hover:bg-gray-50 dark:hover:bg-gray-800"
                    )}
                  >
                    <div className="flex items-center gap-3 relative z-10">
                      <div className={cn(
                        "p-2 rounded-xl shrink-0 transition-colors",
                        selectedIndex === index ? "bg-white/20" : 
                        item.type === 'action' ? "bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400" :
                        "bg-gray-100 dark:bg-gray-800"
                      )}>
                        {item.icon && <item.icon className="h-4 w-4" />}
                      </div>
                      <div className="flex flex-col items-start truncate">
                        <span className="text-sm font-bold truncate">
                          {item.type === 'action' && <span className="opacity-50 mr-1">Ir para:</span>}
                          {item.title}
                        </span>
                        <span className={cn(
                          "text-[10px] uppercase font-black tracking-widest",
                          selectedIndex === index ? "text-white/60" : "text-gray-400"
                        )}>{item.subtitle}</span>
                      </div>
                    </div>
                    
                    <div className={cn(
                      "flex items-center gap-2 transition-all duration-300",
                      selectedIndex === index ? "opacity-100 translate-x-0" : "opacity-0 translate-x-4"
                    )}>
                       <span className="text-[10px] font-black uppercase">
                         {item.type === 'action' ? 'Executar' : 'Acessar'}
                       </span>
                       <ChevronRight className="h-4 w-4" />
                    </div>
                  </button>
                ))}

                {search.length >= 2 && displayResults.length === 0 && !loading && (
                   <div className="py-12 text-center">
                      <div className="p-4 bg-gray-50 dark:bg-gray-800 inline-block rounded-[2rem] mb-4">
                        <Search className="h-8 w-8 text-gray-300" />
                      </div>
                      <p className="text-sm font-bold text-gray-500">Nenhum resultado encontrado para "{search}"</p>
                   </div>
                )}
              </div>
            </div>

            {/* Footer with Info */}
            <div className="px-4 py-3 border-t border-gray-100 dark:border-white/5 flex items-center justify-between bg-gray-50/50 dark:bg-gray-950/30">
               <div className="flex items-center gap-4">
                  <div className="flex items-center gap-1">
                     <kbd className="px-1.5 py-0.5 bg-white dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700 text-[10px] font-black text-gray-400">↵</kbd>
                     <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Acessar</span>
                  </div>
                  <div className="flex items-center gap-1">
                     <kbd className="px-1.5 py-0.5 bg-white dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700 text-[10px] font-black text-gray-400">↑↓</kbd>
                     <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Navegar</span>
                  </div>
               </div>
               <div className="flex items-center gap-2">
                  <Command className="h-3 w-3 text-indigo-500" />
                  <span className="text-[10px] font-black text-indigo-500 uppercase tracking-widest italic">Inteligência Operacional</span>
               </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
