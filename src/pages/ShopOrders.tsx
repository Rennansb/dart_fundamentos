import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { db } from '../firebase';
import { collection, query, where, onSnapshot, doc, updateDoc, serverTimestamp, arrayUnion } from 'firebase/firestore';
import { useAuth } from '../AuthContext';
import { Package, Truck, CheckCircle, Clock, Search, ShieldCheck, AlertTriangle, RotateCcw, X, MapPin, ShoppingBag, CreditCard, QrCode, Copy, MessageSquare, Star } from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { notificationService } from '../services/notificationService';
import { paymentService } from '../services/paymentService';
import OrderChat from '../components/OrderChat';
import { QRCodeSVG } from 'qrcode.react';
import SupplierRatingModal from '../components/SupplierRatingModal';

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

type TabType = 'todos' | 'aguardando_pagamento' | 'abertos' | 'saiu_entrega' | 'recebidos' | 'devolucoes';

export default function ShopOrders() {
  const { profile, user, selectedCompanyId } = useAuth();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<TabType>('todos');
  const [returnModalOrder, setReturnModalOrder] = useState<any>(null);
  const [returnReason, setReturnReason] = useState('');
  const [activeChatOrder, setActiveChatOrder] = useState<any>(null);
  const [mapModalOrder, setMapModalOrder] = useState<any>(null);
  const [paymentModalOrder, setPaymentModalOrder] = useState<any>(null);
  const [paymentData, setPaymentData] = useState<any>(null);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [ratingModalOrder, setRatingModalOrder] = useState<any>(null);

  // Listen for payment confirmation on open order
  useEffect(() => {
    if (!paymentModalOrder?.id) return;
    const unsubscribe = onSnapshot(doc(db, 'purchase_orders', paymentModalOrder.id), async (snap) => {
      const data = snap.data();
      if (data?.paymentStatus === 'pago') {
        unsubscribe();
        const companyId = selectedCompanyId || profile?.companyId || profile?.id;

        // Update purchase order status to 'aguardando_entregador'
        await updateDoc(doc(db, 'purchase_orders', paymentModalOrder.id), {
          status: 'aguardando_entregador',
          updatedAt: serverTimestamp()
        });

        // Update linked Work Order to 'pending' (Aguardando Peça)
        if (paymentModalOrder.workOrderId) {
          await updateDoc(doc(db, 'work_orders', paymentModalOrder.workOrderId), {
            status: 'awaiting_parts',
            timeline: arrayUnion({
              type: 'status_change',
              content: 'Pagamento confirmado. OS movida para "Aguardando Peças". Fornecedor notificado.',
              createdAt: new Date().toISOString()
            })
          });
        }

        // Notify supplier
        if (paymentModalOrder.supplierId) {
          await notificationService.info(
            paymentModalOrder.supplierId,
            'Pagamento Recebido',
            `Pedido #${paymentModalOrder.id.substring(0, 8)} foi pago. Por favor, prepare e envie as peças.`
          );
        }

        // Notify shop
        if (companyId) {
          await notificationService.info(
            companyId,
            'Pagamento Aprovado!',
            `Pagamento do pedido #${paymentModalOrder.id.substring(0, 8)} confirmado. OS movida para "Aguardando Peça".`
          );
        }

        // 1% Cashback Logic
        const cashbackEarned = (data?.total || 0) * 0.01;
        const currentCredits = profile?.serviceHubCredits || 0;
        
        await updateDoc(doc(db, 'users', user?.uid || ''), {
          serviceHubCredits: currentCredits + cashbackEarned
        });

        setPaymentModalOrder(null);
        setPaymentData(null);
        alert(`✅ Pagamento confirmado!\n\nVocê ganhou R$ ${cashbackEarned.toFixed(2)} em créditos Service Hub!\n\nSua Ordem de Serviço foi movida para "Aguardando Peça". O fornecedor foi notificado para enviar as peças.`);
      }
    });
    return () => unsubscribe();
  }, [paymentModalOrder?.id]);


  useEffect(() => {
    const companyId = selectedCompanyId || profile?.companyId || profile?.id;
    if (!companyId) return;

    // Removed orderBy to avoid composite index requirement; sorting client-side
    const q = query(
      collection(db, 'purchase_orders'),
      where('shopId', '==', companyId)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const ordersData = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .sort((a: any, b: any) => {
          const tA = a.createdAt?.toDate?.()?.getTime() || 0;
          const tB = b.createdAt?.toDate?.()?.getTime() || 0;
          return tB - tA;
        });
      setOrders(ordersData);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching shop orders:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [profile?.companyId, profile?.uid, selectedCompanyId]);

  const requestReturn = async () => {
    const companyId = selectedCompanyId || profile?.companyId;
    if (!returnModalOrder || !returnReason.trim()) return;

    try {
      await updateDoc(doc(db, 'purchase_orders', returnModalOrder.id), {
        status: 'devolução solicitada',
        returnReason: returnReason.trim(),
        updatedAt: serverTimestamp()
      });
      
      if (returnModalOrder.supplierId) {
        await notificationService.warning(
          returnModalOrder.supplierId,
          'Solicitação de Devolução',
          `A oficina ${profile?.companyName || profile?.name || 'Cliente'} solicitou devolução do pedido #${returnModalOrder.id.substring(0, 8).toUpperCase()}.`
        );
      }

      alert('Solicitação de devolução enviada ao fornecedor.');
      setReturnModalOrder(null);
      setReturnReason('');
    } catch (error) {
      console.error("Error requesting return:", error);
      alert('Erro ao solicitar devolução.');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'aguardando pagamento':
      case 'aguardando_pagamento': return 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-200';
      case 'aguardando_entregador': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200';
      case 'aguardando envio': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-200';
      case 'pagamento_realizado': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200';
      case 'peça encaminhada': return 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-200';
      case 'recebido': return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200';
      case 'devolução solicitada': return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200';
      case 'devolução aprovada': return 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-200';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-200';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'aguardando pagamento':
      case 'aguardando_pagamento': return 'Aguardando Pagamento';
      case 'aguardando_entregador': return 'Processando';
      case 'aguardando envio': return 'Aguardando Envio';
      case 'pagamento_realizado': return 'Pagamento Realizado';
      case 'peça encaminhada': return 'Peça Encaminhada';
      case 'recebido': return 'Recebido';
      case 'devolução solicitada': return 'Devolução Solicitada';
      case 'devolução aprovada': return 'Devolução Aprovada';
      default: return status;
    }
  };

  const filteredOrders = orders.filter(order => {
    const matchesSearch = order.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          order.supplierName?.toLowerCase().includes(searchTerm.toLowerCase());
    if (!matchesSearch) return false;
    switch (activeTab) {
      case 'aguardando_pagamento': return order.status === 'aguardando_pagamento' || order.status === 'aguardando pagamento';
      case 'processando': return order.status === 'aguardando_entregador' || order.status === 'aguardando envio' || order.status === 'pagamento_realizado';
      case 'saiu_entrega': return order.status === 'peça encaminhada';
      case 'recebidos': return order.status === 'recebido';
      case 'devolucoes': return order.status?.includes('devolução');
      default: return true;
    }
  });

  if (loading) return <div className="p-8 text-center">Carregando seus pedidos...</div>;

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-8 max-w-7xl mx-auto">
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6"
      >
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-indigo-600 rounded-lg shadow-lg shadow-indigo-200 dark:shadow-none">
              <ShoppingBag className="h-6 w-6 text-white" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-3xl">
              Meus Pedidos de Peças
            </h1>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Acompanhe as peças que você comprou dos fornecedores
          </p>
        </div>
      </motion.div>

      {/* Tabs */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="flex gap-1 overflow-x-auto pb-2 no-scrollbar bg-white dark:bg-gray-800 p-1.5 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-sm"
      >
        {[
          { id: 'todos', label: 'Todos' },
          { id: 'aguardando_pagamento', label: '💳 Ag. Pagamento', urgent: orders.filter(o => o.status === 'aguardando_pagamento' || o.status === 'aguardando pagamento').length > 0 },
          { id: 'processando', label: 'Processando' },
          { id: 'saiu_entrega', label: 'Saiu p/ Entrega' },
          { id: 'recebidos', label: 'Recebidos' },
          { id: 'devolucoes', label: 'Devoluções' }
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as TabType)}
            className={`flex-1 min-w-[120px] py-2.5 text-sm font-bold rounded-xl transition-all relative ${
              activeTab === tab.id 
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100 dark:shadow-none' 
                : 'text-gray-500 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-gray-700'
            }`}
          >
            {tab.label}
            {(tab as any).urgent && activeTab !== tab.id && (
              <span className="absolute top-1.5 right-2 h-2 w-2 bg-rose-500 rounded-full animate-pulse"></span>
            )}
          </button>
        ))}
      </motion.div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="relative group"
      >
        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
          <Search className="h-5 w-5 text-gray-400 group-focus-within:text-indigo-500 transition-colors" />
        </div>
        <input
          type="text"
          placeholder="Buscar por fornecedor ou ID do pedido..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-12 pr-4 py-3 text-sm border border-gray-200 dark:border-gray-700 rounded-2xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 shadow-sm transition-all"
        />
      </motion.div>

      <div className="space-y-6">
        <AnimatePresence mode="popLayout">
          {filteredOrders.map((order, index) => (
            <motion.div 
              layout
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ delay: index * 0.05 }}
              key={order.id} 
              className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden"
            >
              <div className="p-6">
                <div className="flex flex-wrap justify-between items-start gap-4 mb-6">
                  <div className="space-y-1">
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-mono font-bold text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
                        #{order.id.substring(0, 8)}
                      </span>
                      <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${getStatusColor(order.status)}`}>
                        {getStatusLabel(order.status)}
                      </span>
                      {order.workOrderId && (
                        <span className="px-2 py-0.5 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 text-[10px] font-bold rounded-full border border-indigo-100 dark:border-indigo-800">
                          OS Vinculada
                        </span>
                      )}
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                      {order.supplierName || 'Distribuidora de Peças'}
                    </h3>
                    <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                      <Clock className="h-3.5 w-3.5" />
                      <span>{new Date(order.createdAt?.toDate?.() || order.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                  
                  {order.status === 'peça encaminhada' && order.deliveryCode && (
                    <div className="bg-indigo-50 dark:bg-indigo-900/40 border border-indigo-100 dark:border-indigo-800 p-4 rounded-2xl flex flex-col items-center justify-center gap-2 animate-pulse">
                      <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-widest">Código de Entrega</span>
                      <span className="text-3xl font-black text-indigo-700 dark:text-indigo-300 tracking-[0.2em]">{order.deliveryCode}</span>
                      <p className="text-[10px] text-indigo-500 dark:text-indigo-400 text-center max-w-[150px]">
                        Informe este código ao entregador para confirmar o recebimento.
                      </p>
                    </div>
                  )}
                  
                  <div className="flex flex-col items-end gap-3">
                    {/* NOVO: Pagar pedido que veio do orçamento */}
                    {['aguardando_pagamento', 'aguardando pagamento'].includes(order.status) && (
                      <div className="flex flex-col items-end gap-2">
                        <div className="px-3 py-2 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-xl text-xs text-purple-700 dark:text-purple-300 font-medium max-w-xs text-right">
                          Pedido criado via orçamento. Realize o pagamento para liberar o fornecedor.
                        </div>
                        <button
                          onClick={async () => {
                            setPaymentLoading(true);
                            setPaymentModalOrder(order);
                            try {
                              const resp = await paymentService.createPayment(
                                'order',
                                order.total,
                                { orderId: order.id, companyId: selectedCompanyId || profile?.companyId },
                                { name: profile?.name || '', email: profile?.email || '', cpf: profile?.cpfCnpj || '00000000000' }
                              );
                              setPaymentData(resp);
                            } catch (err: any) {
                              alert(err.message || 'Erro ao gerar pagamento');
                              setPaymentModalOrder(null);
                            } finally {
                              setPaymentLoading(false);
                            }
                          }}
                          className="flex items-center gap-2 px-6 py-2.5 bg-purple-600 text-white rounded-xl hover:bg-purple-700 transition-all text-sm font-bold shadow-lg shadow-purple-100 dark:shadow-none"
                        >
                          <CreditCard className="h-4 w-4" />
                          Pagar via PIX
                        </button>
                      </div>
                    )}

                    {/* Status de pagamento realizado aguardando envio */}
                    {order.status === 'pagamento_realizado' && (
                      <div className="flex flex-col items-end gap-2">
                        <div className="flex items-center gap-2 px-4 py-2 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 rounded-xl text-xs font-bold border border-blue-200 dark:border-blue-800">
                          <CheckCircle className="h-4 w-4" />
                          Pagamento Realizado • Aguardando Envio do Fornecedor
                        </div>
                      </div>
                    )}

                    {/* Pagamento confirmado em pedido antigo (aguardando envio) */}
                    {order.status === 'aguardando envio' && order.paymentStatus === 'pago' && (
                      <div className="flex items-center gap-2 px-4 py-2 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 rounded-xl text-xs font-bold border border-emerald-100 dark:border-emerald-800">
                        <CheckCircle className="h-4 w-4" />
                        Pagamento Confirmado
                      </div>
                    )}

                    {/* Pagar pedido manual antigo */}
                    {order.status === 'aguardando envio' && (!order.paymentStatus || order.paymentStatus === 'pendente') && (
                      <button
                        onClick={async () => {
                          setPaymentLoading(true);
                          setPaymentModalOrder(order);
                          try {
                            const resp = await paymentService.createPayment(
                              'order',
                              order.total,
                              { orderId: order.id, companyId: selectedCompanyId || profile?.companyId },
                              { name: profile?.name || '', email: profile?.email || '', cpf: profile?.cpfCnpj || '00000000000' }
                            );
                            setPaymentData(resp);
                          } catch (err: any) {
                            alert(err.message || 'Erro ao gerar pagamento');
                            setPaymentModalOrder(null);
                          } finally {
                            setPaymentLoading(false);
                          }
                        }}
                        className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all text-sm font-bold shadow-lg shadow-indigo-100 dark:shadow-none"
                      >
                        <CreditCard className="h-4 w-4" />
                        Pagar via PIX
                      </button>
                    )}
                    {order.paymentStatus === 'pago' && order.status === 'aguardando envio' && (
                      <div className="flex items-center gap-2 px-4 py-2 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 rounded-xl text-xs font-bold border border-emerald-100 dark:border-emerald-800">
                        <CheckCircle className="h-4 w-4" />
                        Pagamento Confirmado
                      </div>
                    )}
                    <div className="flex flex-col items-end gap-3 flex-wrap">
                      <div className="flex gap-2">
                        <button
                          onClick={() => setActiveChatOrder(order)}
                          className="flex items-center gap-2 px-5 py-2.5 bg-gray-600 text-white rounded-xl hover:bg-gray-700 transition-all text-sm font-bold shadow-lg shadow-gray-100 dark:shadow-none"
                        >
                          <MessageSquare className="h-4 w-4" />
                          Chat
                        </button>
                        {order.status === 'peça encaminhada' && (
                          <button
                            onClick={() => setMapModalOrder(order)}
                            className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all text-sm font-bold shadow-lg shadow-blue-100 dark:shadow-none"
                          >
                            <MapPin className="h-4 w-4" />
                            Acompanhar
                          </button>
                        )}
                        {order.status === 'peça encaminhada' && (
                          <button
                            onClick={async () => {
                              if (!confirm("Confirmar que você recebeu as peças? Isso atualizará a Ordem de Serviço vinculada e liberará o pagamento ao fornecedor.")) return;
                              try {
                                const response = await fetch('/api/delivery/confirm', {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ orderId: order.id, code: order.deliveryCode })
                                });

                                if (!response.ok) {
                                  const data = await response.json();
                                  throw new Error(data.error || 'Erro ao confirmar entrega');
                                }

                                // Update Linked Work Order
                                if (order.workOrderId) {
                                  const woRef = doc(db, 'work_orders', order.workOrderId);
                                  await updateDoc(woRef, {
                                    status: 'repair_started', // "Início de Reparo"
                                    timeline: arrayUnion({
                                      type: 'status_change',
                                      content: `Peças recebidas (Pedido #${order.id.substring(0,8)}). Ordem de serviço movida para Início de Reparo.`,
                                      createdAt: new Date().toISOString()
                                    })
                                  });

                                  await notificationService.info(
                                    order.shopId,
                                    'Peça Recebida',
                                    `As peças do pedido #${order.id.substring(0,8)} chegaram. A OS foi movida para "Início de Reparo".`
                                  );
                                }
                              } catch (err) {
                                console.error("Error confirming receipt:", err);
                              }
                            }}
                            className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-all text-sm font-bold shadow-lg shadow-emerald-100 dark:shadow-none"
                          >
                            <CheckCircle className="h-4 w-4" />
                            Confirmar Recebimento
                          </button>
                        )}
                      </div>
                      {order.status === 'peça encaminhada' && (
                        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-4 rounded-xl max-w-xs shadow-sm">
                          <div className="flex items-start gap-3">
                            <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-500 shrink-0 mt-0.5" />
                            <div>
                              <p className="text-[10px] text-amber-800 dark:text-amber-300 mb-1 font-bold uppercase tracking-wider">
                                Código de Entrega
                              </p>
                              <p className="text-2xl font-black text-gray-900 dark:text-white tracking-[0.2em]">{order.deliveryCode}</p>
                              <p className="text-[10px] text-amber-700 dark:text-amber-400 mt-1">
                                Confira a peça antes de informar o código.
                              </p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                    {order.status === 'recebido' && (
                      <div className="flex flex-col items-end gap-2">
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 rounded-lg text-sm font-bold">
                          <CheckCircle className="h-4 w-4" />
                          Peças Recebidas
                        </div>
                        <button
                          onClick={() => setReturnModalOrder(order)}
                          className="flex items-center gap-2 px-3 py-1.5 text-xs font-bold text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                          Solicitar Devolução
                        </button>
                        {!order.isRated && (
                          <button
                            onClick={() => setRatingModalOrder(order)}
                            className="w-full mt-2 flex items-center justify-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all text-sm font-black shadow-lg shadow-indigo-100 dark:shadow-none"
                          >
                            <Star className="h-4 w-4 fill-white" />
                            Avaliar Fornecedor
                          </button>
                        )}
                        {order.isRated && (
                          <div className="flex items-center gap-1.5 px-3 py-1 bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 rounded-lg text-xs font-black border border-amber-100 dark:border-amber-800">
                            <Star className="h-3 h-3 fill-amber-500" />
                            <span>Avaliação: {order.ratingValue?.toFixed(1)}</span>
                          </div>
                        )}
                      </div>
                    )}
                    {order.status?.includes('devolução') && (
                      <div className="px-4 py-2 bg-red-50 dark:bg-red-900/20 rounded-xl border border-red-100 dark:border-red-800">
                        <p className="text-[10px] font-bold text-red-800 dark:text-red-300 uppercase tracking-wider mb-1">Motivo da Devolução</p>
                        <p className="text-sm text-red-700 dark:text-red-400 italic">"{order.returnReason}"</p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="border-t border-gray-100 dark:border-gray-700 pt-6">
                  <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">Itens do Pedido</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {order.items.map((item: any, idx: number) => (
                      <div key={idx} className="flex items-center gap-4 bg-gray-50 dark:bg-gray-900/50 p-4 rounded-2xl border border-gray-100 dark:border-gray-700/50">
                        <div className="h-12 w-12 bg-white dark:bg-gray-800 rounded-xl shadow-sm flex items-center justify-center overflow-hidden shrink-0 border border-gray-100 dark:border-gray-700">
                          {item.photoURL ? (
                            <img src={item.photoURL} alt={item.name} className="w-full h-full object-cover" />
                          ) : (
                            <Package className="h-6 w-6 text-gray-300" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-gray-900 dark:text-white truncate">{item.name}</p>
                          <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                            {item.brand} • {item.quantity}x {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.price)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="bg-gray-50 dark:bg-gray-900/50 px-6 py-4 flex justify-between items-center border-t border-gray-100 dark:border-gray-700">
                <span className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Total do Pedido</span>
                <span className="text-2xl font-black text-indigo-600 dark:text-indigo-400">
                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(order.total)}
                </span>
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
            <div className="p-4 bg-gray-50 dark:bg-gray-900/50 rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-6">
              <Package className="h-10 w-10 text-gray-300" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Nenhum pedido encontrado</h3>
            <p className="text-gray-500 dark:text-gray-400 max-w-sm mx-auto">Não há pedidos nesta categoria no momento. Tente mudar os filtros ou a busca.</p>
          </motion.div>
        )}
      </div>

      {/* Return Modal */}
      <AnimatePresence>
        {returnModalOrder && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl max-w-md w-full overflow-hidden border border-gray-200 dark:border-gray-700"
            >
              <div className="flex justify-between items-center p-6 border-b border-gray-100 dark:border-gray-700">
                <h3 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
                  <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg">
                    <RotateCcw className="h-5 w-5 text-red-600 dark:text-red-400" />
                  </div>
                  Solicitar Devolução
                </h3>
                <button 
                  onClick={() => setReturnModalOrder(null)} 
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
                >
                  <X className="h-5 w-5 text-gray-500" />
                </button>
              </div>
              <div className="p-6">
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-6 leading-relaxed">
                  Por favor, informe o motivo da devolução para o pedido <span className="font-mono font-bold text-gray-900 dark:text-white">#{returnModalOrder.id.substring(0, 8)}</span>.
                  O fornecedor analisará sua solicitação.
                </p>
                <textarea
                  value={returnReason}
                  onChange={(e) => setReturnReason(e.target.value)}
                  placeholder="Descreva o problema com a peça (ex: defeito, peça errada...)"
                  className="w-full h-40 px-4 py-3 border border-gray-200 dark:border-gray-700 rounded-2xl bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 resize-none mb-6 transition-all"
                ></textarea>
                <div className="flex gap-3">
                  <button
                    onClick={() => setReturnModalOrder(null)}
                    className="flex-1 px-4 py-3 text-sm font-bold text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-xl transition-all"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={requestReturn}
                    disabled={!returnReason.trim()}
                    className="flex-1 px-4 py-3 bg-red-600 text-white text-sm font-bold rounded-xl hover:bg-red-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-red-100 dark:shadow-none"
                  >
                    Enviar Solicitação
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Map Modal */}
      <AnimatePresence>
        {mapModalOrder && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl max-w-4xl w-full overflow-hidden flex flex-col h-[85vh] border border-gray-200 dark:border-gray-700"
            >
              <div className="flex justify-between items-center p-6 border-b border-gray-100 dark:border-gray-700">
                <h3 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
                  <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg">
                    <MapPin className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                  </div>
                  Rastreamento em Tempo Real
                </h3>
                <button 
                  onClick={() => setMapModalOrder(null)} 
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
                >
                  <X className="h-5 w-5 text-gray-500" />
                </button>
              </div>
              <div className="flex-1 relative bg-gray-50 dark:bg-gray-900">
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
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-500 dark:text-gray-400 p-8 text-center">
                    <div className="p-6 bg-white dark:bg-gray-800 rounded-full shadow-sm mb-6">
                      <MapPin className="h-12 w-12 text-gray-300 animate-pulse" />
                    </div>
                    <h4 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Aguardando localização...</h4>
                    <p className="text-sm max-w-xs">O entregador precisa iniciar a rota para que o rastreamento fique disponível.</p>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      {/* Payment Modal */}
      <AnimatePresence>
        {paymentModalOrder && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl max-w-md w-full overflow-hidden border border-gray-200 dark:border-gray-700"
            >
              <div className="flex justify-between items-center p-6 border-b border-gray-100 dark:border-gray-700">
                <h3 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
                  <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg">
                    <QrCode className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                  </div>
                  Pagar Pedido via PIX
                </h3>
                <button 
                  onClick={() => {
                    setPaymentModalOrder(null);
                    setPaymentData(null);
                  }} 
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
                >
                  <X className="h-5 w-5 text-gray-500" />
                </button>
              </div>
              <div className="p-6">
                {paymentLoading ? (
                  <div className="flex flex-col items-center justify-center py-12 gap-4">
                    <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                    <p className="text-sm font-bold text-gray-500">Gerando seu PIX...</p>
                  </div>
                ) : paymentData ? (
                  <div className="space-y-6">
                    <div className="text-center">
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                        Total a pagar: <span className="text-xl font-black text-indigo-600 dark:text-indigo-400">R$ {paymentModalOrder.total.toFixed(2)}</span>
                      </p>
                      <div className="bg-white p-4 rounded-2xl shadow-inner inline-block border-2 border-dashed border-gray-200">
                        <QRCodeSVG value={paymentData.qrCode} size={200} />
                      </div>
                    </div>
                    
                    <div className="space-y-3">
                      <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider">Chave Copia e Cola</label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          readOnly
                          value={paymentData.qrCode}
                          className="flex-1 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 text-[10px] text-gray-500 font-mono focus:outline-none"
                        />
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(paymentData.qrCode);
                            setCopied(true);
                            setTimeout(() => setCopied(false), 2000);
                          }}
                          className="bg-indigo-600 text-white px-4 py-2 rounded-xl hover:bg-indigo-700 transition-colors shrink-0"
                        >
                          {copied ? <CheckCircle className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>

                    <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-100 dark:border-blue-900/30 flex items-start gap-3">
                      <ShieldCheck className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
                      <p className="text-[10px] text-blue-800 dark:text-blue-200 leading-relaxed font-medium">
                        Seu pagamento é processado com segurança via Mercado Pago. O fornecedor será notificado assim que confirmado.
                      </p>
                    </div>

                    <button
                      onClick={() => {
                        setPaymentModalOrder(null);
                        setPaymentData(null);
                      }}
                      className="w-full py-3 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-bold rounded-xl hover:bg-gray-200 dark:hover:bg-gray-600 transition-all text-sm"
                    >
                      Fechar
                    </button>
                  </div>
                ) : (
                  <p className="text-center text-red-500 font-bold">Erro ao carregar dados de pagamento.</p>
                )}
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
                  Chat com Fornecedor
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
                  partnerName={activeChatOrder.supplierName || 'Fornecedor'} 
                />
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Supplier Rating Modal */}
      <SupplierRatingModal
        isOpen={!!ratingModalOrder}
        order={ratingModalOrder}
        onClose={() => setRatingModalOrder(null)}
        onSuccess={() => {
          setRatingModalOrder(null);
          // Show a nice success message or points notification if applicable
        }}
      />
    </div>
  );
}
