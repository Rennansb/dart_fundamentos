import React, { useState, useEffect } from 'react';
import { Search, User, Mail, Phone, MapPin, Hash, Calendar, ChevronRight, X, Package, Clock, DollarSign, TrendingUp } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { db } from '../firebase';
import { collection, query, where, getDocs, onSnapshot, orderBy, limit } from 'firebase/firestore';
import { useAuth } from '../AuthContext';

export default function SupplierCustomers() {
  const { profile } = useAuth();
  const [shops, setShops] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedShop, setSelectedShop] = useState<any>(null);
  const [shopHistory, setShopHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  useEffect(() => {
    if (!profile?.id) {
      console.log("SupplierCustomers: Profile ID not available yet");
      return;
    }

    console.log("SupplierCustomers: Setting up orders listener for supplierId:", profile.id);

    const qOrders = query(
      collection(db, 'purchase_orders'),
      where('supplierId', '==', profile.id)
    );

    const unsubscribe = onSnapshot(qOrders, 
      async (snapshot) => {
        console.log("SupplierCustomers: Orders snapshot received, docs:", snapshot.docs.length);
        const orders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() as any }));
        const shopIds = Array.from(new Set(orders.map(o => o.shopId)));
        
        if (shopIds.length === 0) {
          setShops([]);
          setLoading(false);
          return;
        }

        try {
          const shopsDataPromises = shopIds.map(async (shopId) => {
            if (!shopId) return null;
            const shopDoc = await getDocs(query(collection(db, 'users'), where('uid', '==', shopId)));
            if (!shopDoc.empty) {
              const shopOrders = orders.filter(o => o.shopId === shopId);
              shopOrders.sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
              
              const totalRevenue = shopOrders.reduce((acc, o) => acc + (o.total || 0), 0);
              
              return {
                id: shopId,
                ...shopDoc.docs[0].data(),
                lastOrderAt: shopOrders[0]?.createdAt,
                orderCount: shopOrders.length,
                totalRevenue
              };
            }
            return null;
          });
          
          const resolvedShops = await Promise.all(shopsDataPromises);
          const shopsData = resolvedShops.filter(Boolean) as any[];
          
          setShops(shopsData);
        } catch (err) {
          console.error("SupplierCustomers: Error fetching shop details:", err);
        } finally {
          setLoading(false);
        }
      }, 
      (error) => {
        console.error("SupplierCustomers: Snapshot listener error:", error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [profile?.id]);

  const fetchShopHistory = async (shopId: string) => {
    if (!profile?.id) return;
    setLoadingHistory(true);
    setShopHistory([]); // Clear previous history
    try {
      const q = query(
        collection(db, 'purchase_orders'),
        where('supplierId', '==', profile.id),
        where('shopId', '==', shopId)
      );
      const snapshot = await getDocs(q);
      const history = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() as any }));
      
      // Sort locally to avoid index requirement
      history.sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
      
      setShopHistory(history);
    } catch (error) {
      console.error("SupplierCustomers: Error fetching shop history:", error);
    } finally {
      setLoadingHistory(false);
    }
  };

  const filteredShops = shops.filter(s => 
    (s.companyName || s.name || '').toLowerCase().includes(search.toLowerCase()) ||
    (s.email || '').toLowerCase().includes(search.toLowerCase()) ||
    (s.phone || '').includes(search)
  );

  if (loading) return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50/50 dark:bg-gray-900/50 p-4 sm:p-6 lg:p-8 space-y-8">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
        >
          <h2 className="text-3xl font-black text-gray-900 dark:text-white tracking-tight">
            Minhas Oficinas (Clientes)
          </h2>
          <p className="text-gray-500 dark:text-gray-400 mt-1 font-medium">
            Visualize as oficinas que compraram com você.
          </p>
        </motion.div>
      </div>

      {/* Filters Section */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative group"
      >
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 group-focus-within:text-indigo-500 transition-colors" />
        <input
          type="text"
          placeholder="Buscar por nome, e-mail ou telefone..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-12 pr-4 py-3.5 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl shadow-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all dark:text-white"
        />
      </motion.div>

      {/* Shops Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        <AnimatePresence mode="popLayout">
          {filteredShops.map((shop, index) => (
            <motion.div
              key={shop.id}
              layout
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ delay: index * 0.05 }}
              onClick={() => {
                setSelectedShop(shop);
                fetchShopHistory(shop.id);
              }}
              className="bg-white dark:bg-gray-800 rounded-3xl p-6 shadow-sm border border-gray-100 dark:border-gray-700 hover:shadow-xl hover:border-indigo-500/50 transition-all group relative overflow-hidden cursor-pointer"
            >
              <div className="absolute -right-4 -top-4 opacity-[0.03] dark:opacity-[0.05] group-hover:scale-110 group-hover:rotate-12 transition-transform duration-500">
                <User size={120} />
              </div>

              <div className="flex justify-between items-start mb-6">
                <div className="flex items-center gap-4">
                  <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-black text-xl shadow-lg shadow-indigo-200 dark:shadow-none">
                    {(shop.companyName || shop.name || 'O').charAt(0)}
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-gray-900 dark:text-white tracking-tight">
                      {shop.companyName || shop.name}
                    </h3>
                    <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 font-medium">
                      <Hash className="w-3.5 h-3.5" />
                      <span className="font-mono text-[10px] uppercase tracking-wider">{shop.role === 'shop' ? 'Oficina Parceira' : 'Cliente'}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-900/50 rounded-2xl">
                  <div className="p-2 bg-white dark:bg-gray-800 rounded-xl shadow-sm text-indigo-600">
                    <TrendingUp className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wider font-bold text-gray-400">Total em Compras</p>
                    <p className="text-sm font-black text-gray-900 dark:text-white">
                      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(shop.totalRevenue || 0)}
                    </p>
                  </div>
                </div>

                <div className="space-y-1 px-1">
                  <div className="flex items-center gap-2 text-sm font-bold text-gray-700 dark:text-gray-200">
                    <Mail className="w-3.5 h-3.5 text-indigo-500" />
                    <span className="truncate">{shop.email}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm font-bold text-gray-700 dark:text-gray-200">
                    <Phone className="w-3.5 h-3.5 text-indigo-500" />
                    <span>{shop.phone || 'Sem telefone'}</span>
                  </div>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-gray-100 dark:border-gray-700 flex items-center justify-between">
                <div className="flex items-center gap-2 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                  <Calendar className="w-3 h-3" />
                  <span>Último: {shop.lastOrderAt?.toDate ? shop.lastOrderAt.toDate().toLocaleDateString('pt-BR') : 'Recente'}</span>
                </div>
                <div className="p-2 bg-gray-50 dark:bg-gray-700 rounded-xl group-hover:bg-indigo-600 group-hover:text-white group-hover:scale-110 transition-all duration-300">
                  <ChevronRight className="w-4 h-4" />
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {filteredShops.length === 0 && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center py-20 bg-white dark:bg-gray-800 rounded-[3rem] border-2 border-dashed border-gray-100 dark:border-gray-700"
        >
          <div className="w-20 h-20 bg-gray-50 dark:bg-gray-900/50 rounded-full flex items-center justify-center mx-auto mb-4 text-gray-300">
            <User className="w-10 h-10" />
          </div>
          <h3 className="text-xl font-black text-gray-900 dark:text-white">Nenhuma oficina parceira</h3>
          <p className="text-gray-500 dark:text-gray-400 max-w-xs mx-auto">As oficinas que realizarem compras com você aparecerão aqui automaticamente.</p>
        </motion.div>
      )}

      {/* Shop Detail Drawer */}
      <AnimatePresence>
        {selectedShop && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedShop(null)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100]"
            />
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed right-0 top-0 h-screen w-full max-w-2xl bg-white dark:bg-gray-900 shadow-2xl z-[101] overflow-hidden flex flex-col"
            >
              <div className="relative h-48 bg-gradient-to-br from-indigo-600 via-purple-600 to-indigo-800 p-8 flex items-end">
                <button 
                  onClick={() => setSelectedShop(null)}
                  className="absolute top-6 left-6 p-2 bg-white/10 hover:bg-white/20 rounded-xl text-white backdrop-blur-md transition-all"
                >
                  <X size={20} />
                </button>
                
                <div className="flex items-center gap-6 w-full">
                  <div className="h-24 w-24 rounded-3xl bg-white flex items-center justify-center text-3xl font-black text-indigo-600 shadow-2xl border-4 border-white/20">
                    {(selectedShop.companyName || selectedShop.name || 'O').charAt(0)}
                  </div>
                  <div className="mb-2">
                    <h2 className="text-3xl font-black text-white tracking-tight truncate max-w-md">
                      {selectedShop.companyName || selectedShop.name}
                    </h2>
                    <div className="flex items-center gap-3 text-white/80 text-sm font-medium mt-1">
                      <span className="bg-white/20 px-3 py-1 rounded-full backdrop-blur-md text-[10px] font-black uppercase tracking-widest border border-white/10">
                        {selectedShop.role === 'shop' ? 'Oficina Parceira' : 'Cliente Especial'}
                      </span>
                      {selectedShop.city && <span>• {selectedShop.city}</span>}
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto no-scrollbar p-8 space-y-8">
                {/* Stats Grid */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-indigo-50 dark:bg-indigo-900/20 p-6 rounded-[2rem] border border-indigo-100 dark:border-indigo-800">
                    <div className="flex items-center gap-3 mb-2 text-indigo-600">
                      <DollarSign size={18} />
                      <span className="text-[10px] font-black uppercase tracking-widest opacity-70">Volume Total</span>
                    </div>
                    <p className="text-2xl font-black text-gray-900 dark:text-white">
                      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(selectedShop.totalRevenue || 0)}
                    </p>
                  </div>
                  <div className="bg-emerald-50 dark:bg-emerald-900/20 p-6 rounded-[2rem] border border-emerald-100 dark:border-emerald-800">
                    <div className="flex items-center gap-3 mb-2 text-emerald-600">
                      <Package size={18} />
                      <span className="text-[10px] font-black uppercase tracking-widest opacity-70">Total Pedidos</span>
                    </div>
                    <p className="text-2xl font-black text-gray-900 dark:text-white">
                      {selectedShop.orderCount || 0} <span className="text-xs font-bold text-gray-400">pedidos</span>
                    </p>
                  </div>
                </div>

                {/* Information */}
                <div className="space-y-4">
                  <h4 className="text-xs font-black text-gray-400 uppercase tracking-[0.2em] px-1">Informações de Contato</h4>
                  <div className="grid grid-cols-1 gap-3">
                    <div className="flex items-center gap-4 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-2xl border border-gray-100 dark:border-gray-700">
                      <div className="p-3 bg-white dark:bg-gray-800 rounded-xl shadow-sm text-indigo-500">
                        <Mail size={18} />
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">E-mail Corporativo</p>
                        <p className="text-sm font-black text-gray-900 dark:text-white">{selectedShop.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-2xl border border-gray-100 dark:border-gray-700">
                      <div className="p-3 bg-white dark:bg-gray-800 rounded-xl shadow-sm text-indigo-500">
                        <Phone size={18} />
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Telefone / WhatsApp</p>
                        <p className="text-sm font-black text-gray-900 dark:text-white">{selectedShop.phone || 'Não informado'}</p>
                      </div>
                    </div>
                    {selectedShop.address && (
                      <div className="flex items-center gap-4 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-2xl border border-gray-100 dark:border-gray-700">
                        <div className="p-3 bg-white dark:bg-gray-800 rounded-xl shadow-sm text-indigo-500">
                          <MapPin size={18} />
                        </div>
                        <div>
                          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Endereço de Entrega</p>
                          <p className="text-sm font-black text-gray-900 dark:text-white leading-tight">{selectedShop.address}</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* History */}
                <div className="space-y-6 pb-20">
                  <div className="flex items-center justify-between px-1">
                    <h4 className="text-xs font-black text-gray-400 uppercase tracking-[0.2em]">Histórico de Peças Vendidas</h4>
                    <span className="text-[10px] font-bold bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 px-2 py-1 rounded-md uppercase">Listando últimos {shopHistory.length} registros</span>
                  </div>

                  {loadingHistory ? (
                    <div className="flex items-center justify-center py-12">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                    </div>
                  ) : shopHistory.length > 0 ? (
                    <div className="space-y-4">
                      {shopHistory.map((order: any) => (
                        <div key={order.id} className="bg-white dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700 overflow-hidden shadow-sm">
                          <div className="px-6 py-4 bg-gray-50 dark:bg-gray-900/50 flex justify-between items-center border-b border-gray-100 dark:border-gray-700">
                            <div className="flex items-center gap-3 text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                              <Calendar size={12} className="text-indigo-500" />
                              <span>{order.createdAt?.toDate ? order.createdAt.toDate().toLocaleDateString('pt-BR') : 'Data não disponível'}</span>
                              <span className="text-gray-300">•</span>
                              <span className="text-indigo-600 font-black">#{order.id.substring(0, 8)}</span>
                            </div>
                            <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-md ${
                              order.status === 'delivered' || order.status === 'recebido' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                            }`}>
                              {order.status}
                            </span>
                          </div>
                          <div className="p-6 space-y-4">
                            {order.items?.map((item: any, idx: number) => (
                              <div key={idx} className="flex items-center justify-between gap-4">
                                <div className="flex items-center gap-4 min-w-0">
                                  <div className="h-10 w-10 rounded-xl bg-gray-100 dark:bg-gray-700 flex items-center justify-center shrink-0">
                                    <Package size={18} className="text-gray-400" />
                                  </div>
                                  <div className="min-w-0">
                                    <p className="text-sm font-black text-gray-900 dark:text-white truncate">{item.name}</p>
                                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{item.brand || 'Original'} • {item.quantity} unidades</p>
                                  </div>
                                </div>
                                <p className="text-sm font-black text-indigo-600 shrink-0">
                                  R$ {(item.price * item.quantity).toFixed(2)}
                                </p>
                              </div>
                            ))}
                          </div>
                          <div className="px-6 py-3 bg-indigo-50/30 dark:bg-indigo-900/10 flex justify-between items-center text-xs border-t border-gray-50 dark:border-gray-700">
                            <span className="font-bold text-gray-400 uppercase tracking-wider">Subtotal do Pedido</span>
                            <span className="font-black text-gray-900 dark:text-white">R$ {order.total?.toFixed(2)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-12 px-6 bg-gray-50 dark:bg-gray-800/50 rounded-[2.5rem] border border-dashed border-gray-100 dark:border-gray-700">
                      <Clock size={32} className="mx-auto text-gray-300 mb-4" />
                      <p className="text-sm font-bold text-gray-500 uppercase tracking-wider">Aguardando seu primeiro pedido</p>
                      <p className="text-xs text-gray-400 mt-1">Este cliente ainda não comprou nenhuma peça através da plataforma.</p>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
