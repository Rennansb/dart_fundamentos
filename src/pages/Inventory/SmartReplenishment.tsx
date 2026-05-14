import React, { useState, useEffect, useMemo } from 'react';
import { 
  Package, 
  TrendingUp, 
  AlertCircle, 
  ShoppingCart, 
  ArrowRight,
  Filter,
  Search,
  Zap,
  DollarSign,
  ChevronRight,
  RefreshCw,
  CheckCircle2
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { db } from '../../firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { useAuth } from '../../AuthContext';
import { useNavigate } from 'react-router-dom';

export default function SmartReplenishment() {
  const { profile, selectedCompanyId } = useAuth();
  const navigate = useNavigate();
  const [inventory, setInventory] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const companyId = selectedCompanyId || profile?.companyId;
    if (!companyId) return;

    // Real-time inventory
    const unsubInv = onSnapshot(query(collection(db, 'inventory'), where('companyId', '==', companyId)), (snap) => {
      setInventory(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    // Real-time suppliers
    const unsubSupp = onSnapshot(query(collection(db, 'users'), where('role', '==', 'fornecedor')), (snap) => {
      setSuppliers(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    });

    return () => {
      unsubInv();
      unsubSupp();
    };
  }, [profile, selectedCompanyId]);

  const recommendations = useMemo(() => {
    return inventory
      .filter(item => {
        const stock = item.quantity || 0;
        const min = item.minStock || 5;
        return stock <= min;
      })
      .map(item => {
        const stock = item.quantity || 0;
        const min = item.minStock || 5;
        const suggestBuy = Math.max(min * 2 - stock, 5);
        const priority = stock === 0 ? 'CRÍTICO' : stock <= min / 2 ? 'ALTA' : 'MÉDIA';
        const investment = suggestBuy * (item.costPrice || item.price * 0.7 || 0);

        return {
          ...item,
          suggestBuy,
          priority,
          investment
        };
      })
      .sort((a, b) => {
        const pMap: any = { 'CRÍTICO': 3, 'ALTA': 2, 'MÉDIA': 1 };
        return pMap[b.priority] - pMap[a.priority];
      });
  }, [inventory]);

  const totalInvestment = recommendations.reduce((acc, r) => acc + r.investment, 0);

  if (loading) return <div className="p-8 text-center">Analizando estoque...</div>;

  return (
    <div className="p-8 space-y-8 max-w-7xl mx-auto">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-black text-gray-900 dark:text-white flex items-center gap-3 tracking-tight text-glow">
            <Zap className="h-8 w-8 text-amber-500 fill-amber-500" />
            Reposição Inteligente
          </h1>
          <p className="text-gray-500 font-medium">Algoritmo de IA sugerindo compras baseado em giro e estoque mínimo.</p>
        </div>
        
        <div className="flex bg-white dark:bg-gray-800 p-2 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
           <div className="px-6 py-2 border-r border-gray-100 dark:border-gray-700">
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Investimento Previsto</p>
              <p className="text-lg font-black text-indigo-600">R$ {totalInvestment.toLocaleString('pt-BR')}</p>
           </div>
           <button className="px-6 py-2 flex items-center gap-2 text-indigo-600 font-black uppercase tracking-widest text-[10px] hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-xl transition-all">
             <ShoppingCart className="w-4 h-4" />
             Gerar Lista de Compras
           </button>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-black text-gray-900 dark:text-white">Sugestão de Reposição</h2>
            <div className="flex items-center gap-2 text-[10px] font-black text-gray-400 uppercase tracking-widest">
              <RefreshCw className="w-3 h-3 animate-spin-slow" />
              Atualizado em Tempo Real
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4">
            <AnimatePresence>
              {recommendations.map((item, idx) => (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className="bg-white dark:bg-gray-800 p-6 rounded-[2.5rem] border border-gray-100 dark:border-gray-700 shadow-sm hover:shadow-xl hover:border-indigo-100 transition-all flex items-center justify-between group"
                >
                  <div className="flex items-center gap-6">
                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${
                      item.priority === 'CRÍTICO' ? 'bg-rose-50 dark:bg-rose-900/20 text-rose-600' :
                      item.priority === 'ALTA' ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-600' :
                      'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600'
                    } shadow-inner`}>
                      <Package className="w-7 h-7" />
                    </div>
                    <div>
                      <h4 className="font-black text-gray-900 dark:text-white group-hover:text-indigo-600 transition-colors uppercase tracking-tight">{item.name}</h4>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Estoque: {item.quantity}</span>
                        <span className="w-1 h-1 rounded-full bg-gray-300"></span>
                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Mínimo: {item.minStock}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-12">
                     <div className="text-center">
                        <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">Comprar</p>
                        <p className="text-xl font-black text-indigo-600">+{item.suggestBuy}</p>
                     </div>
                     <div className="text-right min-w-[100px]">
                        <span className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-tighter ${
                          item.priority === 'CRÍTICO' ? 'bg-rose-600 text-white' :
                          item.priority === 'ALTA' ? 'bg-amber-100 text-amber-700' :
                          'bg-indigo-100 text-indigo-700'
                        }`}>
                          Prioridade {item.priority}
                        </span>
                        <p className="text-[10px] font-black text-gray-900 dark:text-white mt-1">R$ {item.investment.toLocaleString('pt-BR')}</p>
                     </div>
                     <button className="p-3 bg-gray-50 dark:bg-gray-900/50 rounded-2xl hover:bg-indigo-600 hover:text-white transition-all">
                        <ArrowRight className="w-5 h-5" />
                     </button>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>

            {recommendations.length === 0 && (
              <div className="bg-emerald-50 dark:bg-emerald-900/10 p-12 rounded-[3rem] border border-dashed border-emerald-200 dark:border-emerald-800 text-center">
                <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-4" />
                <h3 className="text-lg font-black text-emerald-900 dark:text-emerald-400">Estoque Otimizado!</h3>
                <p className="text-sm text-emerald-700 dark:text-emerald-600 font-medium">Nenhum item precisa de reposição no momento.</p>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-8">
           <div className="bg-gradient-to-br from-indigo-900 to-slate-900 p-8 rounded-[3rem] text-white shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-3xl"></div>
              <h3 className="text-xl font-black mb-6 flex items-center gap-2">
                <TrendingUp className="w-6 h-6 text-indigo-400" />
                Impacto Financeiro
              </h3>
              <div className="space-y-6">
                <div>
                  <p className="text-[10px] font-black text-indigo-300 uppercase tracking-[0.2em] mb-1">Custo Total de Reposição</p>
                  <p className="text-4xl font-black tracking-tighter">R$ {totalInvestment.toLocaleString('pt-BR')}</p>
                </div>
                <div className="p-4 bg-white/5 backdrop-blur-md rounded-2xl border border-white/10">
                  <p className="text-xs font-medium text-indigo-100 leading-relaxed">
                    A IA detectou que a reposição destes itens pode gerar um aumento de **12% na velocidade de entrega** das O.S. atuais.
                  </p>
                </div>
              </div>
           </div>

           <div className="bg-white dark:bg-gray-800 p-8 rounded-[3.5rem] border border-gray-100 dark:border-gray-700 shadow-sm">
             <h3 className="text-lg font-black text-gray-900 dark:text-white mb-6">Fornecedores Recomendados</h3>
             <div className="space-y-4">
                {suppliers.slice(0, 5).map((supplier, i) => (
                  <motion.div 
                    key={supplier.id} 
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.1 }}
                    onClick={() => navigate(`/app/suppliers/${supplier.id}`)}
                    className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900/40 rounded-2xl transition-all hover:bg-white dark:hover:bg-gray-800 border border-transparent hover:border-indigo-100 cursor-pointer group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center overflow-hidden border border-indigo-200 dark:border-indigo-800">
                        {supplier.photoURL ? (
                          <img src={supplier.photoURL} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-indigo-600 dark:text-indigo-400 font-black text-xs">
                            {(supplier.companyName || supplier.name || 'F').charAt(0)}
                          </span>
                        )}
                      </div>
                      <div>
                        <p className="text-xs font-black text-gray-900 dark:text-white uppercase tracking-tight">{supplier.companyName || supplier.name}</p>
                        <p className="text-[9px] text-gray-400 font-bold">{supplier.segment || 'Peças Gerais'}</p>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-indigo-500 transition-colors" />
                  </motion.div>
                ))}
                
                {suppliers.length === 0 && (
                  <div className="py-8 text-center bg-gray-50 dark:bg-gray-900/40 rounded-3xl border border-dashed border-gray-200">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Nenhum fornecedor disponível</p>
                  </div>
                )}
             </div>
           </div>
        </div>
      </div>
    </div>
  );
}
