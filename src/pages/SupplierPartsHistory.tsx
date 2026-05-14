import React, { useState, useEffect } from 'react';
import { Search, Package, Calendar, DollarSign, Store, Tag, ChevronDown, Filter } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { db } from '../firebase';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { useAuth } from '../AuthContext';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function SupplierPartsHistory() {
  const { profile } = useAuth();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    if (!profile?.id) return;

    const q = query(
      collection(db, 'purchase_orders'),
      where('supplierId', '==', profile.id),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setOrders(data);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [profile?.id]);

  const filteredOrders = orders.filter(order => {
    const matchesSearch = 
      (order.shopName || '').toLowerCase().includes(search.toLowerCase()) ||
      (order.items || []).some((item: any) => (item.name || '').toLowerCase().includes(search.toLowerCase()));
    
    const matchesStatus = statusFilter === 'all' || order.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50/50 dark:bg-gray-900/50 p-4 sm:p-6 lg:p-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
        >
          <h2 className="text-3xl font-black text-gray-900 dark:text-white tracking-tight">
            Histórico de Peças Vendidas
          </h2>
          <p className="text-gray-500 dark:text-gray-400 mt-1 font-medium italic">
            Controle total de todas as vendas e expedições para oficinas parceiras.
          </p>
        </motion.div>

        <div className="flex items-center gap-4">
           <div className="p-4 bg-emerald-100 dark:bg-emerald-900/30 rounded-2xl flex items-center gap-3 border border-emerald-200/50">
              <DollarSign className="w-5 h-5 text-emerald-600" />
              <div>
                <p className="text-[10px] font-black uppercase text-emerald-600/70 tracking-widest">Total Vendido</p>
                <p className="text-xl font-black text-emerald-700 dark:text-emerald-300">
                  R$ {orders.filter(o => o.status === 'delivered' || o.status === 'shipped').reduce((acc, o) => acc + (o.total || 0), 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
              </div>
           </div>
        </div>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="md:col-span-2 relative group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 group-focus-within:text-indigo-500 transition-colors" />
          <input
            type="text"
            placeholder="Buscar por Oficina ou Peça..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-12 pr-4 py-4 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-3xl shadow-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all dark:text-white font-medium"
          />
        </div>
        
        <div className="relative group">
          <Filter className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full pl-12 pr-10 py-4 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-3xl shadow-sm focus:ring-2 focus:ring-indigo-500 outline-none appearance-none transition-all dark:text-white font-bold text-xs uppercase tracking-widest cursor-pointer"
          >
            <option value="all">Todos os Status</option>
            <option value="pending">Pendente</option>
            <option value="shipped">Enviado</option>
            <option value="delivered">Entregue</option>
            <option value="cancelled">Cancelado</option>
          </select>
          <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
        </div>
      </div>

      {/* Results Table */}
      <div className="bg-white dark:bg-gray-800 rounded-[2.5rem] shadow-xl shadow-indigo-500/5 border border-gray-50 dark:border-gray-700/50 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-gray-50 dark:border-gray-700/50 bg-gray-50/50 dark:bg-gray-900/50">
                <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-gray-400">Data</th>
                <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-gray-400">Oficina (Lojista)</th>
                <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-gray-400">Itens / Peças</th>
                <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-gray-400 text-center">Status</th>
                <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-gray-400 text-right">Valor Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-gray-700/50">
              <AnimatePresence mode="popLayout">
                {filteredOrders.map((order, idx) => (
                  <motion.tr 
                    key={order.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.02 }}
                    className="group hover:bg-indigo-50/30 dark:hover:bg-indigo-900/10 transition-colors"
                  >
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-gray-100 dark:bg-gray-700 rounded-xl">
                          <Calendar className="w-4 h-4 text-gray-500" />
                        </div>
                        <span className="text-sm font-bold text-gray-600 dark:text-gray-300">
                          {order.createdAt?.toDate ? format(order.createdAt.toDate(), 'dd/MM/yyyy HH:mm') : 'Agora mesmo'}
                        </span>
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center text-indigo-600 font-black text-xs">
                          {(order.shopName || 'O').charAt(0)}
                        </div>
                        <div>
                          <p className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-tighter">
                            {order.shopName || 'Oficina Parceira'}
                          </p>
                          <p className="text-[10px] font-medium text-gray-500">ID Pedido: #{order.id.slice(0, 6)}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex flex-wrap gap-2">
                        {order.items?.map((item: any, i: number) => (
                          <div key={i} className="px-3 py-1 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-lg flex items-center gap-2 text-xs font-bold text-gray-600 dark:text-gray-400">
                            <Tag className="w-3 h-3 text-indigo-400" />
                            {item.name} ({item.quantity})
                          </div>
                        ))}
                      </div>
                    </td>
                    <td className="px-8 py-6">
                       <div className="flex justify-center">
                          <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest ${
                            order.status === 'delivered' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' :
                            order.status === 'shipped' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                            order.status === 'cancelled' ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400' :
                            'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                          }`}>
                            {
                              order.status === 'delivered' ? 'Entregue' :
                              order.status === 'shipped' ? 'Em Trânsito' :
                              order.status === 'cancelled' ? 'Cancelado' : 'Pendente'
                            }
                          </span>
                       </div>
                    </td>
                    <td className="px-8 py-6 text-right">
                      <div className="flex flex-col items-end">
                        <span className="text-sm font-black text-indigo-600 dark:text-indigo-400">
                          R$ {(order.total || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </span>
                        <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Pago via Escrow</span>
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </AnimatePresence>
            </tbody>
          </table>
        </div>
        
        {filteredOrders.length === 0 && (
          <div className="text-center py-20 opacity-40">
             <Package className="w-16 h-16 mx-auto mb-4 text-gray-400" />
             <p className="text-[10px] font-black uppercase tracking-[0.2em]">Nenhuma expedição encontrada para os filtros aplicados.</p>
          </div>
        )}
      </div>
    </div>
  );
}
