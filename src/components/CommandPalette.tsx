import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Search, 
  User, 
  ClipboardList, 
  Package, 
  X, 
  ChevronRight,
  Command,
  Loader2
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
  type: 'customer' | 'order' | 'inventory';
  link: string;
}

export default function CommandPalette() {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const { profile, selectedCompanyId } = useAuth();
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen(prev => !prev);
      }
      if (e.key === 'Escape') setIsOpen(false);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
      setSearch('');
      setResults([]);
    }
  }, [isOpen]);

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
            link: `/app/customers`
          }));

        const orderResults: SearchResult[] = ordersSnap.docs
          .map(doc => ({ id: doc.id, data: doc.data() }))
          .filter(item => item.data.customerName?.toLowerCase().includes(searchTerms) || item.id.substring(0,6).includes(searchTerms))
          .map(item => ({
            id: item.id,
            title: `OS #${item.id.substring(0, 6)}`,
            subtitle: `Ordem de Serviço • ${item.data.customerName}`,
            type: 'order',
            link: `/app/work-orders`
          }));

        const inventoryResults: SearchResult[] = inventorySnap.docs
          .map(doc => ({ id: doc.id, data: doc.data() }))
          .filter(item => item.data.partName?.toLowerCase().includes(searchTerms))
          .map(item => ({
            id: item.id,
            title: item.data.partName,
            subtitle: `Estoque • Qtd: ${item.data.stockQuantity || 0}`,
            type: 'inventory',
            link: `/app/inventory`
          }));

        setResults([...customerResults, ...orderResults, ...inventoryResults].slice(0, 8));
      } catch (error) {
        console.error("Search error:", error);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [search, profile?.companyId, selectedCompanyId]);

  const handleSelect = (result: SearchResult) => {
    navigate(result.link);
    setIsOpen(false);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => (prev + 1) % results.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => (prev - 1 + results.length) % results.length);
    } else if (e.key === 'Enter' && results[selectedIndex]) {
      handleSelect(results[selectedIndex]);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[1001] flex items-start justify-center pt-[15vh] p-4">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsOpen(false)}
            className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm"
          />
          
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -20 }}
            className="relative w-full max-w-2xl bg-white dark:bg-gray-900 rounded-[2rem] shadow-2xl border border-gray-100 dark:border-gray-800 overflow-hidden"
          >
            <div className="flex items-center gap-4 px-6 py-5 border-b border-gray-100 dark:border-gray-800">
              <div className="p-2 bg-indigo-50 dark:bg-indigo-900/30 rounded-xl">
                <Search className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
              </div>
              <input
                ref={inputRef}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder="Busque clientes, ordens, peças... (CMD+K)"
                className="flex-1 bg-transparent border-none outline-none text-lg font-bold text-gray-900 dark:text-white placeholder:text-gray-400"
              />
              {loading ? (
                <Loader2 className="h-5 w-5 text-gray-400 animate-spin" />
              ) : (
                <div className="flex items-center gap-1.5 px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded-lg">
                  <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">ESC</span>
                </div>
              )}
            </div>

            <div className="max-h-[60vh] overflow-y-auto p-2 custom-scrollbar">
              {results.length > 0 ? (
                <div className="space-y-1">
                  {results.map((result, index) => (
                    <button
                      key={`${result.type}-${result.id}`}
                      onClick={() => handleSelect(result)}
                      onMouseEnter={() => setSelectedIndex(index)}
                      className={cn(
                        "w-full flex items-center justify-between p-4 rounded-2xl transition-all text-left group",
                        index === selectedIndex 
                          ? "bg-indigo-600 text-white shadow-lg shadow-indigo-200 dark:shadow-none" 
                          : "hover:bg-gray-50 dark:hover:bg-gray-800/50"
                      )}
                    >
                      <div className="flex items-center gap-4">
                        <div className={cn(
                          "p-2.5 rounded-xl transition-colors",
                          index === selectedIndex ? "bg-white/20" : "bg-gray-100 dark:bg-gray-800"
                        )}>
                          {result.type === 'customer' && <User className="h-5 w-5" />}
                          {result.type === 'order' && <ClipboardList className="h-5 w-5" />}
                          {result.type === 'inventory' && <Package className="h-5 w-5" />}
                        </div>
                        <div>
                          <div className={cn(
                            "font-bold text-sm",
                            index === selectedIndex ? "text-white" : "text-gray-900 dark:text-white"
                          )}>{result.title}</div>
                          <div className={cn(
                            "text-[10px] font-bold uppercase tracking-wider",
                            index === selectedIndex ? "text-white/60" : "text-gray-500"
                          )}>{result.subtitle}</div>
                        </div>
                      </div>
                      <ChevronRight className={cn(
                        "h-4 w-4 transition-transform group-hover:translate-x-1",
                        index === selectedIndex ? "text-white/40" : "text-gray-300"
                      )} />
                    </button>
                  ))}
                </div>
              ) : search.length >= 2 && !loading ? (
                <div className="py-12 text-center">
                  <div className="p-4 bg-gray-50 dark:bg-gray-800 inline-block rounded-3xl mb-4">
                    <Search className="h-8 w-8 text-gray-300" />
                  </div>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white">Nenhum resultado</h3>
                  <p className="text-sm text-gray-500">Tente buscar por termos diferentes ou verifique a digitação.</p>
                </div>
              ) : !search ? (
                <div className="py-8 px-6 text-center">
                  <div className="flex flex-col items-center gap-4">
                    <div className="flex gap-2">
                       <kbd className="px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700 text-xs font-bold text-gray-500">Ctrl</kbd>
                       <span className="text-gray-300">+</span>
                       <kbd className="px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700 text-xs font-bold text-gray-500">K</kbd>
                    </div>
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-[0.2em]">Pesquisa Ativa Hub</p>
                  </div>
                </div>
              ) : null}
            </div>

            <div className="px-6 py-4 bg-gray-50 dark:bg-gray-950/50 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between">
              <div className="flex items-center gap-4">
                 <div className="flex items-center gap-1.5">
                    <kbd className="px-1.5 py-0.5 bg-white dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700 text-[10px] font-bold text-gray-400">↑↓</kbd>
                    <span className="text-[10px] font-bold text-gray-400 uppercase">Navegar</span>
                 </div>
                 <div className="flex items-center gap-1.5">
                    <kbd className="px-1.5 py-0.5 bg-white dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700 text-[10px] font-bold text-gray-400">Enter</kbd>
                    <span className="text-[10px] font-bold text-gray-400 uppercase">Selecionar</span>
                 </div>
              </div>
              <div className="flex items-center gap-2">
                <Command className="h-3 w-3 text-indigo-500" />
                <span className="text-[10px] font-black text-indigo-500 uppercase tracking-widest">Service Hub Intelligence</span>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
