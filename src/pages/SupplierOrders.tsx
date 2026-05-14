import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, query, where, onSnapshot, doc, updateDoc, serverTimestamp, orderBy } from 'firebase/firestore';
import { useAuth } from '../AuthContext';
import { Package, Truck, CheckCircle, Clock, Search, ExternalLink, QrCode, MapPin, X, AlertTriangle, ShoppingBag, RotateCcw, MessageSquare, Printer } from 'lucide-react';
import { generateProfessionalReport } from '../services/invoiceGenerator';
import OrderChat from '../components/OrderChat';
import { QRCodeSVG } from 'qrcode.react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { motion, AnimatePresence } from 'framer-motion';
import { notificationService } from '../services/notificationService';

// Fix Leaflet icon issue
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const deliveryIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

type TabType = 'aguardando_pagamento' | 'aguardando_entregador' | 'saiu_entrega' | 'recebidos' | 'devolucoes';

export default function SupplierOrders() {
  const { user, profile, effectiveProfile } = useAuth();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<TabType>('aguardando_pagamento');
  const [qrModalOrder, setQrModalOrder] = useState<any>(null);
  const [mapModalOrder, setMapModalOrder] = useState<any>(null);
  const [confirmModalOrder, setConfirmModalOrder] = useState<any>(null);
  const [deliveryCode, setDeliveryCode] = useState('');
  const [confirmError, setConfirmError] = useState('');
  const [activeChatOrder, setActiveChatOrder] = useState<any>(null);

  useEffect(() => {
    if (!effectiveProfile?.id) return;

    const q = query(
      collection(db, 'purchase_orders'),
      where('supplierId', '==', effectiveProfile.id),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const ordersData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setOrders(ordersData);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching supplier orders:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [effectiveProfile?.id]);

  const updateStatus = async (orderId: string, newStatus: string) => {
    try {
      if (newStatus === 'peça encaminhada') {
        const response = await fetch('/api/delivery/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orderId, supplierId: profile.id })
        });
        
        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || 'Erro ao enviar peça');
        }
        
        const data = await response.json();
        const updatedOrder = orders.find(o => o.id === orderId);
        if (updatedOrder) {
          setQrModalOrder({ ...updatedOrder, deliveryCode: data.deliveryCode });
        }
      } else {
        const orderRef = doc(db, 'purchase_orders', orderId);
        await updateDoc(orderRef, { 
          status: newStatus,
          updatedAt: serverTimestamp(),
          processedBy: user?.uid,
          processedByName: profile?.name || profile?.email?.split('@')[0]
        });
      }
      
      const orderToNotify = orders.find(o => o.id === orderId);
      if (orderToNotify?.shopId) {
        notificationService.info(
          orderToNotify.shopId,
          'Atualização de Pedido',
          `O pedido #${orderId.substring(0, 8).toUpperCase()} mudou para: ${newStatus.replace('_', ' ')}`
        );
      }
    } catch (error: any) {
      console.error("Error updating order status:", error);
      alert(error.message || "Erro ao atualizar status");
    }
  };

  const approveReturn = async (orderId: string) => {
    try {
      await updateDoc(doc(db, 'purchase_orders', orderId), {
        status: 'devolução aprovada',
        updatedAt: serverTimestamp(),
        processedBy: user?.uid,
        processedByName: profile?.name || profile?.email?.split('@')[0]
      });
      
      const orderToNotify = orders.find(o => o.id === orderId);
      if (orderToNotify?.shopId) {
        notificationService.info(
          orderToNotify.shopId,
          'Devolução Aprovada',
          `Sua solicitação de devolução para o pedido #${orderId.substring(0, 8).toUpperCase()} foi aprovada pelo fornecedor.`
        );
      }
    } catch (error) {
      console.error("Error approving return:", error);
    }
  };

  const confirmDelivery = async () => {
    if (!confirmModalOrder || !deliveryCode) return;
    
    setConfirmError('');
    try {
      const response = await fetch('/api/delivery/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: confirmModalOrder.id, code: deliveryCode })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Erro ao confirmar entrega');
      }

      setConfirmModalOrder(null);
      setDeliveryCode('');
    } catch (error: any) {
      console.error("Error confirming delivery:", error);
      setConfirmError(error.message || 'Erro ao confirmar entrega.');
    }
  };

  const finalizeReturn = async (orderId: string) => {
    try {
      await updateDoc(doc(db, 'purchase_orders', orderId), {
        status: 'devolução finalizada',
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      console.error("Error finalizing return:", error);
    }
  };

  const handlePrintOrder = (order: any) => {
    generateProfessionalReport(
      `PEDIDO DE COMPRA #${order.id.substring(0, 8).toUpperCase()}`,
      {
        name: profile?.name || profile?.tradeName || 'FORNECEDOR SERVICE HUB',
        address: typeof profile?.address === 'string' 
          ? profile.address 
          : profile?.address 
            ? `${profile.address.street}, ${profile.address.number} - ${profile.address.city}/${profile.address.state}`
            : 'Endereço não informado',
        contact: profile?.phone || '',
        logo: profile?.logo || undefined
      },
      [
        {
          title: 'DADOS DA OFICINA (CLIENTE)',
          headers: ['OFICINA', 'DATA DO PEDIDO', 'STATUS'],
          body: [[
            order.shopName || 'N/A',
            order.createdAt?.toDate ? order.createdAt.toDate().toLocaleDateString('pt-BR') : 'N/A',
            order.status.toUpperCase()
          ]]
        },
        {
          title: 'ITENS DO PEDIDO',
          headers: ['PRODUTO', 'MARCA', 'QTD', 'UNITÁRIO', 'SUBTOTAL'],
          body: order.items.map((item: any) => [
            item.name,
            item.brand || 'N/A',
            item.quantity,
            `R$ ${item.price.toFixed(2)}`,
            `R$ ${(item.quantity * item.price).toFixed(2)}`
          ])
        },
        {
          title: 'RESUMO FINANCEIRO',
          headers: ['TOTAL BRUTO', 'COMISSÃO HUB', 'LÍQUIDO'],
          body: [[
            `R$ ${order.total.toFixed(2)}`,
            `R$ ${(order.platformCommission || (order.total * 0.03)).toFixed(2)}`,
            `R$ ${(order.supplierAmount || (order.total * 0.97)).toFixed(2)}`
          ]]
        }
      ]
    );
  };

  const getStatusColor = (status: string) => {
    const s = status?.toLowerCase();
    switch (s) {
      case 'pendente':
      case 'pending':
      case 'aguardando envio': 
        return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200';
      case 'pagamento_realizado':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200';
      case 'peça encaminhada': 
        return 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-200';
      case 'recebido': 
        return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200';
      case 'devolução solicitada': 
        return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200';
      case 'devolução aprovada': 
        return 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-200';
      case 'devolução finalizada': 
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-200';
      default: 
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-200';
    }
  };

  const filteredOrders = orders.filter(order => {
    const matchesSearch = order.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (order.shopName || '').toLowerCase().includes(searchTerm.toLowerCase());
    
    if (!matchesSearch) return false;

    switch (activeTab) {
      case 'aguardando_pagamento': 
        return ['aguardando pagamento', 'aguardando_pagamento'].includes(order.status?.toLowerCase()) || !order.status;
      case 'aguardando_entregador':
        return ['aguardando_entregador', 'aguardando envio', 'pagamento_realizado', 'pendente', 'pending'].includes(order.status?.toLowerCase());
      case 'saiu_entrega': 
        return order.status === 'peça encaminhada';
      case 'recebidos': 
        return order.status === 'recebido';
      case 'devolucoes': 
        return order.status?.includes('devolução');
      default: 
        return true;
    }
  }).sort((a, b) => {
    if (activeTab === 'aguardando_pagamento' || activeTab === 'aguardando_entregador') {
      const aPaid = (a.paymentStatus === 'pago') ? 1 : 0;
      const bPaid = (b.paymentStatus === 'pago') ? 1 : 0;
      if (aPaid !== bPaid) return bPaid - aPaid; // Paid first
    }
    const aTime = a.createdAt?.toDate?.()?.getTime() || (a.createdAt ? new Date(a.createdAt).getTime() : 0);
    const bTime = b.createdAt?.toDate?.()?.getTime() || (b.createdAt ? new Date(b.createdAt).getTime() : 0);
    return bTime - aTime;
  });

  if (loading) return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
    </div>
  );

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-4 md:p-8 max-w-7xl mx-auto"
    >
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-xl">
              <ShoppingBag className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
            </div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white tracking-tight">Minhas Entregas</h1>
          </div>
          <p className="text-gray-500 dark:text-gray-400">Gerencie as ordens de compra enviadas pelas oficinas</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex space-x-1 bg-gray-100 dark:bg-gray-800/50 p-1.5 rounded-2xl mb-8 overflow-x-auto no-scrollbar">
        {(['aguardando_pagamento', 'aguardando_entregador', 'saiu_entrega', 'recebidos', 'devolucoes'] as TabType[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`relative flex-1 min-w-[140px] py-3 text-sm font-semibold rounded-xl transition-all duration-200 ${
              activeTab === tab 
                ? 'bg-white dark:bg-gray-700 text-indigo-600 dark:text-indigo-400 shadow-md scale-[1.02]' 
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-white/50 dark:hover:bg-gray-700/30'
            }`}
          >
            {tab === 'aguardando_pagamento' && 'Ag. Pagamento'}
            {tab === 'aguardando_entregador' && 'Ag. Entregador'}
            {tab === 'saiu_entrega' && 'Saiu para Entrega'}
            {tab === 'recebidos' && 'Recebidos'}
            {tab === 'devolucoes' && 'Devoluções'}
            {activeTab === tab && (
              <motion.div
                layoutId="activeTab"
                className="absolute inset-0 bg-white dark:bg-gray-700 rounded-xl -z-10"
                transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
              />
            )}
          </button>
        ))}
      </div>

      <div className="mb-8 relative group">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 group-focus-within:text-indigo-500 transition-colors" />
        <input
          type="text"
          placeholder="Buscar por ID ou nome da oficina..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-12 pr-4 py-4 bg-white dark:bg-gray-800 border-none rounded-2xl shadow-sm focus:ring-2 focus:ring-indigo-500 dark:text-white transition-all"
        />
      </div>

      <div className="grid gap-6">
        <AnimatePresence mode="popLayout">
          {filteredOrders.map((order) => (
            <motion.div
              key={order.id}
              layout
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-gray-800 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden hover:shadow-md transition-shadow"
            >
              <div className="p-6 md:p-8">
                <div className="flex flex-col md:flex-row justify-between items-start gap-6 mb-8">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="px-3 py-1 bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 rounded-full text-xs font-mono font-medium tracking-wider">
                        #{order.id.substring(0, 8).toUpperCase()}
                      </span>
                      <span className={`px-4 py-1 rounded-full text-xs font-bold uppercase tracking-widest ${getStatusColor(order.status)}`}>
                        {order.status.replace('_', ' ')}
                      </span>
                      <span className={`px-4 py-1 rounded-full text-xs font-bold uppercase tracking-widest ${order.paymentStatus === 'pago' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200' : 'bg-rose-100 dark:bg-rose-900/30 text-rose-800 dark:text-rose-200'}`}>
                        {order.paymentStatus === 'pago' ? 'PAGAMENTO OK' : 'AGUAR. PAGAMENTO'}
                      </span>
                    </div>
                    <h3 className="text-2xl font-bold text-gray-900 dark:text-white">
                      {order.shopName || 'Oficina Cliente'}
                    </h3>
                    <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                      <Clock className="h-4 w-4" />
                      {order.createdAt?.toDate ? order.createdAt.toDate().toLocaleString('pt-BR', { dateStyle: 'long', timeStyle: 'short' }) : 'Recente'}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-3 w-full md:w-auto">
                    {order.paymentStatus !== 'pago' && order.status !== 'cancelado' && (
                      <button
                        onClick={async () => {
                           const orderRef = doc(db, 'purchase_orders', order.id);
                           await updateDoc(orderRef, { paymentStatus: 'pago', status: 'aguardando_entregador' });
                        }}
                        className="flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-3 bg-emerald-600 text-white font-semibold rounded-2xl hover:bg-emerald-700 transition-all active:scale-95 shadow-lg shadow-emerald-200 dark:shadow-none"
                      >
                        <CheckCircle className="h-5 w-5" />
                        Aprovar Pagamento
                      </button>
                    )}
                    {(order.status === 'aguardando_entregador' || order.status === 'aguardando envio' || order.status === 'pagamento_realizado') && (
                      <button
                        onClick={() => updateStatus(order.id, 'peça encaminhada')}
                        className="flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-3 bg-indigo-600 text-white font-semibold rounded-2xl hover:bg-indigo-700 transition-all active:scale-95 shadow-lg shadow-indigo-200 dark:shadow-none"
                      >
                        <QrCode className="h-5 w-5" />
                        Gerar QR Code Entrega
                      </button>
                    )}
                    {order.status === 'peça encaminhada' && (
                      <>
                        <button
                          onClick={() => setQrModalOrder(order)}
                          className="flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-3 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 font-semibold rounded-2xl hover:bg-gray-200 dark:hover:bg-gray-600 transition-all active:scale-95"
                        >
                          <QrCode className="h-5 w-5" />
                          Ver QR Code
                        </button>
                        <button
                          onClick={() => setMapModalOrder(order)}
                          className="flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 text-white font-semibold rounded-2xl hover:bg-blue-700 transition-all active:scale-95 shadow-lg shadow-blue-200 dark:shadow-none"
                        >
                          <MapPin className="h-5 w-5" />
                          Ver Localização
                        </button>
                      </>
                    )}
                    <button
                      onClick={() => handlePrintOrder(order)}
                      className="flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-3 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 font-semibold rounded-2xl hover:bg-gray-200 dark:hover:bg-gray-600 transition-all active:scale-95"
                    >
                      <Printer className="h-5 w-5" />
                      Imprimir
                    </button>
                    {order.status === 'devolução solicitada' && (
                      <button
                        onClick={() => approveReturn(order.id)}
                        className="flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-3 bg-orange-600 text-white font-semibold rounded-2xl hover:bg-orange-700 transition-all active:scale-95 shadow-lg shadow-orange-200 dark:shadow-none"
                      >
                        <CheckCircle className="h-5 w-5" />
                        Aprovar Devolução
                      </button>
                    )}
                    {order.status === 'devolução aprovada' && (
                      <button
                        onClick={() => finalizeReturn(order.id)}
                        className="flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-3 bg-emerald-600 text-white font-semibold rounded-2xl hover:bg-emerald-700 transition-all active:scale-95 shadow-lg shadow-emerald-200 dark:shadow-none"
                      >
                        <CheckCircle className="h-5 w-5" />
                        Finalizar Devolução
                      </button>
                    )}
                  </div>
                </div>

                {order.status?.includes('devolução') && order.returnReason && (
                  <div className="mb-8 p-6 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 rounded-3xl">
                    <h4 className="text-sm font-bold text-red-800 dark:text-red-300 mb-2 flex items-center gap-2 uppercase tracking-wider">
                      <AlertTriangle className="h-4 w-4" />
                      Motivo da Devolução
                    </h4>
                    <p className="text-gray-700 dark:text-red-200 leading-relaxed">{order.returnReason}</p>
                  </div>
                )}

                <div className="space-y-4">
                  <h4 className="text-sm font-bold text-gray-400 dark:text-gray-500 uppercase tracking-[0.2em]">Itens do Pedido</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {order.items.map((item: any, idx: number) => (
                      <div key={idx} className="flex items-center gap-4 bg-gray-50 dark:bg-gray-900/50 p-4 rounded-2xl border border-gray-100 dark:border-gray-700/50">
                        <div className="h-14 w-14 bg-white dark:bg-gray-800 rounded-xl overflow-hidden flex-shrink-0 shadow-sm border border-gray-100 dark:border-gray-700">
                          {item.photoURL ? (
                            <img src={item.photoURL} alt={item.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-gray-300">
                              <Package className="h-6 w-6" />
                            </div>
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-gray-900 dark:text-white truncate">{item.name}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                            {item.brand} • {item.quantity}x R$ {item.price.toFixed(2)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-8 pt-8 border-t border-gray-100 dark:border-gray-700">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="p-4 bg-gray-50 dark:bg-gray-900/30 rounded-2xl">
                      <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Total Bruto</p>
                      <p className="text-xl font-bold text-gray-900 dark:text-white">
                        R$ {order.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                    <div className="p-4 bg-red-50 dark:bg-red-900/10 rounded-2xl">
                      <p className="text-xs font-bold text-red-400 uppercase tracking-wider mb-1">Taxa Plataforma (3%)</p>
                      <p className="text-xl font-bold text-red-600 dark:text-red-400">
                        - R$ {(order.platformCommission || (order.total * 0.03)).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                    <div className="p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-2xl border border-indigo-100 dark:border-indigo-800/50">
                      <p className="text-xs font-bold text-indigo-400 uppercase tracking-wider mb-1">Líquido a Receber</p>
                      <p className="text-2xl font-black text-indigo-600 dark:text-indigo-400">
                        R$ {(order.supplierAmount || (order.total * 0.97)).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {filteredOrders.length === 0 && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-20 bg-white dark:bg-gray-800 rounded-3xl border-2 border-dashed border-gray-200 dark:border-gray-700"
          >
            <div className="bg-gray-50 dark:bg-gray-900/50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
              <Clock className="h-10 w-10 text-gray-300" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Nenhum pedido encontrado</h3>
            <p className="text-gray-500 dark:text-gray-400">Não há pedidos nesta categoria no momento.</p>
          </motion.div>
        )}
      </div>

      {/* QR Code Modal */}
      <AnimatePresence>
        {qrModalOrder && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setQrModalOrder(null)}
              className="absolute inset-0 bg-black/60 backdrop-blur-md"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative bg-white dark:bg-gray-800 rounded-[2.5rem] shadow-2xl max-w-md w-full overflow-hidden"
            >
              <div className="flex justify-between items-center p-8 border-b border-gray-100 dark:border-gray-700">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-xl">
                    <QrCode className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white">QR Code de Entrega</h3>
                </div>
                <button 
                  onClick={() => setQrModalOrder(null)}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
                >
                  <X className="h-6 w-6 text-gray-400" />
                </button>
              </div>
              <div className="p-10 flex flex-col items-center">
                <p className="text-gray-600 dark:text-gray-400 text-center mb-10 leading-relaxed">
                  Peça para o entregador escanear este QR Code para iniciar o rastreamento em tempo real da entrega.
                </p>
                <div className="bg-white p-8 rounded-[2rem] shadow-inner border border-gray-100">
                  <QRCodeSVG 
                    value={`${window.location.origin}/delivery/${qrModalOrder.id}`} 
                    size={240} 
                    level="H"
                    includeMargin={true}
                  />
                </div>
                <div className="mt-10 w-full p-4 bg-gray-50 dark:bg-gray-900/50 rounded-2xl border border-gray-100 dark:border-gray-700">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1 text-center">Link de Rastreamento</p>
                  <p className="text-xs text-indigo-500 break-all text-center font-mono">
                    {window.location.origin}/delivery/{qrModalOrder.id}
                  </p>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Map Modal */}
      <AnimatePresence>
        {mapModalOrder && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMapModalOrder(null)}
              className="absolute inset-0 bg-black/60 backdrop-blur-md"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative bg-white dark:bg-gray-800 rounded-[2.5rem] shadow-2xl max-w-4xl w-full overflow-hidden flex flex-col h-[85vh]"
            >
              <div className="flex justify-between items-center p-8 border-b border-gray-100 dark:border-gray-700">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-xl">
                    <MapPin className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white">Rastreamento em Tempo Real</h3>
                    <p className="text-sm text-gray-500">Acompanhe o trajeto do entregador</p>
                  </div>
                </div>
                <button 
                  onClick={() => setMapModalOrder(null)}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
                >
                  <X className="h-6 w-6 text-gray-400" />
                </button>
              </div>
              <div className="flex-1 relative bg-gray-100 dark:bg-gray-900">
                {mapModalOrder.deliveryLocation ? (
                  <MapContainer 
                    center={[mapModalOrder.deliveryLocation.lat, mapModalOrder.deliveryLocation.lng]} 
                    zoom={15} 
                    style={{ height: '100%', width: '100%' }}
                  >
                    <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                    <Marker 
                      position={[mapModalOrder.deliveryLocation.lat, mapModalOrder.deliveryLocation.lng]} 
                      icon={deliveryIcon}
                    >
                      <Popup>Localização do Entregador</Popup>
                    </Marker>
                  </MapContainer>
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-500 dark:text-gray-400 p-10 text-center">
                    <div className="w-24 h-24 bg-gray-200 dark:bg-gray-800 rounded-full flex items-center justify-center mb-6 animate-pulse">
                      <MapPin className="h-12 w-12 opacity-50" />
                    </div>
                    <h4 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Aguardando localização...</h4>
                    <p className="max-w-xs">O entregador precisa abrir o link do QR Code para que o rastreamento seja iniciado.</p>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      {/* Confirm Delivery Modal */}
      <AnimatePresence>
        {confirmModalOrder && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                setConfirmModalOrder(null);
                setDeliveryCode('');
                setConfirmError('');
              }}
              className="absolute inset-0 bg-black/60 backdrop-blur-md"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative bg-white dark:bg-gray-800 rounded-[2.5rem] shadow-2xl max-w-md w-full overflow-hidden"
            >
              <div className="p-8 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center">
                <h3 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
                  <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg">
                    <CheckCircle className="h-6 w-6 text-emerald-600" />
                  </div>
                  Confirmar Entrega
                </h3>
                <button onClick={() => setConfirmModalOrder(null)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full">
                  <X className="h-6 w-6 text-gray-400" />
                </button>
              </div>
              <div className="p-8">
                <p className="text-gray-600 dark:text-gray-400 mb-6 text-center">
                  Solicite o código de 6 dígitos para o cliente para confirmar o recebimento das peças.
                </p>
                <div className="space-y-6">
                  <input
                    type="text"
                    maxLength={6}
                    value={deliveryCode}
                    onChange={(e) => setDeliveryCode(e.target.value.replace(/\D/g, ''))}
                    placeholder="DIGITE O CÓDIGO"
                    className="w-full text-center text-4xl font-black tracking-[0.5em] py-6 border-2 border-gray-100 dark:border-gray-700 rounded-3xl focus:ring-4 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all uppercase placeholder:tracking-normal placeholder:text-lg placeholder:font-bold"
                  />
                  
                  {confirmError && (
                    <div className="flex items-center gap-2 text-red-600 text-sm font-bold justify-center animate-shake">
                      <AlertTriangle className="h-4 w-4" />
                      {confirmError}
                    </div>
                  )}

                  <button
                    onClick={confirmDelivery}
                    disabled={deliveryCode.length < 6}
                    className="w-full py-5 bg-emerald-600 text-white font-bold rounded-2xl hover:bg-emerald-700 transition-all disabled:opacity-50 shadow-lg shadow-emerald-200 dark:shadow-none"
                  >
                    Confirmar Recebimento
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Chat Modal */}
      <AnimatePresence>
        {activeChatOrder && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden border border-gray-200 dark:border-gray-700"
            >
              <div className="flex justify-between items-center p-6 border-b border-gray-100 dark:border-gray-700 bg-indigo-600">
                <h3 className="text-xl font-bold text-white flex items-center gap-3">
                  <MessageSquare className="h-5 w-5" />
                  Chat com Oficina
                </h3>
                <button 
                  onClick={() => setActiveChatOrder(null)} 
                  className="p-2 hover:bg-white/10 rounded-full transition-colors"
                >
                  <X className="h-5 w-5 text-white" />
                </button>
              </div>
              <div className="p-4 bg-gray-50/50 dark:bg-gray-900/50">
                <OrderChat 
                  orderId={activeChatOrder.id} 
                  partnerName={activeChatOrder.shopName || 'Oficina'} 
                />
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
