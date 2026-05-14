import React, { useState, useEffect, useMemo } from 'react';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  doc, 
  updateDoc, 
  getDocs, 
  orderBy 
} from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Clock, 
  Wrench, 
  Package, 
  CheckCircle2, 
  User, 
  Car, 
  AlertCircle,
  MoreVertical,
  ChevronRight,
  Send,
  MessageSquare,
  Filter,
  QrCode,
  MapPin,
  ExternalLink,
  GripVertical,
  Printer,
  History
} from 'lucide-react';
import { whatsappService } from '../services/whatsappService';
import { generateProfessionalReport } from '../services/invoiceGenerator';
import { useNavigate } from 'react-router-dom';

// DnD Kit Imports
import {
  DndContext,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  defaultDropAnimationSideEffects,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

const SHOP_COLUMNS = [
  { id: 'awaiting_parts', title: 'Aguardando Peças', icon: Package, color: 'text-purple-500', bg: 'bg-purple-500/10' },
  { id: 'pending', title: 'Pendente', icon: Clock, color: 'text-amber-500', bg: 'bg-amber-500/10' },
  { id: 'in_progress', title: 'Em Reparo', icon: Wrench, color: 'text-blue-500', bg: 'bg-blue-500/10' },
  { id: 'completed', title: 'Finalizado', icon: CheckCircle2, color: 'text-emerald-500', bg: 'bg-emerald-500/10' }
];

const SUPPLIER_COLUMNS = [
  { id: 'pending_payment', title: 'Pendente de Pagamento', icon: Clock, color: 'text-amber-500', bg: 'bg-amber-500/10' },
  { id: 'aguardando_entregador', title: 'Aguardando Entregador', icon: CheckCircle2, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
  { id: 'shipped', title: 'Saiu para Entrega', icon: Send, color: 'text-blue-500', bg: 'bg-blue-500/10' },
  { id: 'delivered', title: 'Entregue', icon: Package, color: 'text-indigo-500', bg: 'bg-indigo-500/10' }
];

// Draggable Card Component
function KanbanCard({ item, isSupplier, shareSignature, isDragging, onPrintOS, onClick, profile }: { 
  item: any, 
  isSupplier: boolean, 
  shareSignature?: (os: any) => void,
  isDragging?: boolean,
  onPrintOS?: (os: any) => void,
  onClick?: (os: any) => void,
  profile: any
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 1000 : 1
  };

  const timeInStatus = useMemo(() => {
    const start = item.updatedAt?.toDate?.() || (item.updatedAt ? new Date(item.updatedAt) : new Date());
    const diff = Math.floor((new Date().getTime() - start.getTime()) / (1000 * 60 * 60)); // hours
    return diff;
  }, [item.updatedAt]);

  if (!item) return null;

  return (
    <motion.div
      ref={setNodeRef}
      style={style}
      onClick={() => onClick?.(item)}
      className={`bg-slate-50 dark:bg-gray-900/40 p-2.5 rounded-[1.2rem] shadow-[0_8px_30px_rgba(0,0,0,0.06)] dark:shadow-none border border-slate-200/60 dark:border-white/5 cursor-pointer group hover:shadow-2xl hover:border-indigo-200 dark:hover:border-indigo-900 transition-all ${isDragging ? 'rotate-2' : ''}`}
    >
      <div className="flex justify-between items-start mb-4">
        <div className="flex items-center gap-2">
           <div 
             {...attributes} 
             {...listeners} 
             onClick={(e) => e.stopPropagation()}
             className="cursor-grab active:cursor-grabbing p-1.5 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-xl text-gray-400 hover:text-indigo-500 transition-all"
           >
             <GripVertical className="h-5 w-5" />
           </div>
          <span className="text-xs font-black text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 px-3 py-1 rounded-full uppercase tracking-widest">
            #{item.id?.substring(0, 6)}
          </span>
        </div>
        <div className="flex items-center gap-1">
          {!isSupplier && (
            <>
              <button 
                onClick={(e) => { e.stopPropagation(); onPrintOS?.(item); }}
                className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-xl transition-all"
                title="Imprimir OS"
              >
                <Printer className="h-4 w-4" />
              </button>
              <button 
                onClick={(e) => { e.stopPropagation(); shareSignature?.(item); }}
                className="p-2 text-gray-400 hover:text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-xl transition-all"
                title="Enviar Contrato"
              >
                <Send className="h-4 w-4" />
              </button>
            </>
          )}
          <button 
            onClick={(e) => { e.stopPropagation(); }}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-xl transition-all"
          >
            <MoreVertical className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="space-y-1 mb-3">
        <h4 className="font-black text-sm text-gray-900 dark:text-white group-hover:text-indigo-600 transition-colors flex items-center gap-1.5 leading-tight">
          {isSupplier ? item.shopName : (item.customerName || 'Cliente sem nome')}
          {!isSupplier && item.createdBy === 'whatsapp' && (
            <MessageSquare className="w-4 h-4 text-green-500" />
          )}
        </h4>
        <div className="flex items-center gap-2 text-xs font-bold text-gray-500 dark:text-gray-400">
          {isSupplier ? (
            <div className="flex items-center gap-1.5">
              <Package className="h-4 w-4 text-indigo-500" />
              <span className="truncate text-xs">{item.items?.length || 0} itens • R$ {item.total?.toFixed(2)}</span>
            </div>
          ) : (
            <div className="flex items-center gap-1 line-clamp-1">
              <Car className="h-4 w-4 text-indigo-500" />
              <span className="truncate text-[12px] font-bold text-gray-400">{item.vehicleInfo || item.model || 'Veículo não informado'}</span>
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between pt-4 border-t border-gray-50 dark:border-gray-700">
        <div className="flex items-center gap-2">
          {item.employeePhoto ? (
            <img src={item.employeePhoto} alt={item.employeeName} className="h-8 w-8 rounded-xl object-cover border-2 border-white dark:border-gray-800 shadow-sm" />
          ) : (
            <div className="h-8 w-8 rounded-xl bg-gray-100 dark:bg-gray-700 border-2 border-white dark:border-gray-800 flex items-center justify-center text-[10px] font-bold text-gray-400">
              <User className="h-4 w-4" />
            </div>
          )}
          <div className="flex flex-col">
            <span className="text-[12px] font-black text-gray-900 dark:text-white uppercase tracking-tighter">
              {item.employeeName || profile?.name || profile?.companyName || 'Oficina'}
            </span>
            {item.assignedAt && (
              <span className="text-[9px] text-gray-400 font-bold">Desde {new Date(item.assignedAt?.toDate?.() || item.assignedAt).toLocaleDateString()}</span>
            )}
          </div>
        </div>
        
        {timeInStatus > 24 && (
          <div className="flex items-center gap-1 px-2 py-1 bg-rose-50 dark:bg-rose-900/20 text-rose-600 rounded-lg animate-pulse">
            <History className="w-3 h-3" />
            <span className="text-[9px] font-black uppercase tracking-tighter">Parado {timeInStatus}h</span>
          </div>
        )}

        {!isSupplier && profile?.role === 'employee' && !item.employeeId && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              updateDoc(doc(db, 'work_orders', item.id), {
                employeeId: profile.id,
                employeeName: profile.name || profile.displayName,
                employeePhoto: profile.photoURL || null,
                assignedAt: new Date(),
                updatedAt: new Date()
              });
            }}
            className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-black uppercase tracking-widest rounded-lg transition-all transform active:scale-95 shadow-md shadow-indigo-200 dark:shadow-none"
          >
            Assumir
          </button>
        )}
      </div>
    </motion.div>
  );
}

export default function Kanban({ isModal = false }: { isModal?: boolean } = {}) {
  const { profile, user, selectedCompanyId } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [shops, setShops] = useState<any[]>([]);
  const [selectedShopId, setSelectedShopId] = useState<string>('');
  const [employees, setEmployees] = useState<any[]>([]);
  const [filterEmployeeId, setFilterEmployeeId] = useState<string>('');
  const [activeId, setActiveId] = useState<string | null>(null);

  const isSupplier = profile?.role === 'fornecedor';
  const columns = isSupplier ? SUPPLIER_COLUMNS : SHOP_COLUMNS;

  // Sensors for DnD
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const getStatusLabel = (item: any) => {
    if (!item) return 'pending';
    if (isSupplier) {
      if (item.status === 'recebido') return 'delivered';
      if (item.status === 'peça encaminhada') return 'shipped';
      return (item.status === 'aguardando_entregador' || item.status === 'pagamento_realizado' || item.status === 'aguardando envio' || item.paymentStatus === 'pago') ? 'aguardando_entregador' : 'pending_payment';
    }



    const status = item.status;
    switch(status) {
      case 'waiting_parts': return 'awaiting_parts';
      case 'pending': 
      case 'open':
      case 'approved': return 'pending';
      case 'in_repair':
      case 'in_progress': return 'in_progress';
      case 'completed':
      case 'finished':
      case 'delivered': return 'completed';
      default: return 'pending';
    }
  };

  useEffect(() => {
    if (!user) return;
    if (profile?.role === 'admin' && !selectedCompanyId) {
      const fetchShops = async () => {
        try {
          const shopsSnapshot = await getDocs(query(collection(db, 'users'), where('role', '==', 'shop')));
          const shopsList = shopsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          setShops(shopsList);
        } catch (error) {
          console.error("Error fetching shops:", error);
        }
      };
      fetchShops();
    }
  }, [profile?.role, user]);

  useEffect(() => {
    if (!user || isSupplier) return;
    const companyId = selectedCompanyId || selectedShopId || profile?.companyId;
    if (!companyId) {
      setEmployees([]);
      return;
    }

    const q = query(
      collection(db, 'users'), 
      where('companyId', '==', companyId), 
      where('role', '==', 'employee')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const employeesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setEmployees(employeesData);
    });
    return () => unsubscribe();
  }, [profile?.companyId, profile?.id, selectedShopId, user, isSupplier, selectedCompanyId]);

  useEffect(() => {
    if (!user) return;
    let q;
    
    if (isSupplier) {
      q = query(
        collection(db, 'purchase_orders'),
        where('supplierId', '==', profile?.id || profile?.uid),
        orderBy('createdAt', 'desc')
      );
    } else {
      const companyId = selectedCompanyId || selectedShopId || profile?.companyId || profile?.id;
      if (profile?.role === 'admin' && !selectedShopId) {
        q = query(collection(db, 'work_orders'), orderBy('createdAt', 'desc'));
      } else {
        if (!companyId) return;
        q = query(
          collection(db, 'work_orders'),
          where('companyId', '==', companyId),
          orderBy('order', 'asc'),
          orderBy('createdAt', 'desc')
        );
      }
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate?.() || (doc.data().createdAt ? new Date(doc.data().createdAt) : new Date())
      }));
      setData(docsData);
      setLoading(false);
    }, (error) => {
      console.error("Error in Kanban snapshot:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [profile, selectedShopId, user, isSupplier, selectedCompanyId]);

  const updateStatus = async (id: string, newStatus: string) => {
    try {
      const collectionName = isSupplier ? 'purchase_orders' : 'work_orders';
      const item = data.find(i => i.id === id);
      if (!item) return;

      const updateData: any = {
        updatedAt: new Date()
      };
      
      let statusText = '';
      if (isSupplier) {
        if (newStatus === 'paid') {
          updateData.paymentStatus = 'pago';
          statusText = 'Pagamento Realizado';
        }
        else if (newStatus === 'pending_payment') {
          updateData.paymentStatus = 'pendente';
          statusText = 'Pendente de Pagamento';
        }
        else if (newStatus === 'shipped') {
          updateData.status = 'peça encaminhada';
          updateData.deliveryCode = Math.floor(100000 + Math.random() * 900000).toString();
          statusText = 'Saiu para Entrega';
        }
        else if (newStatus === 'delivered') {
          updateData.status = 'recebido';
          statusText = 'Entregue';
        }
      } else {
        // If moving to 'unassigned', we don't clear the employee actually
        // the user wants a column for specifically unassigned.
        // If moving OUT of unassigned, we might need to handle assignment?
        // Let's assume for now it just updates the 'status' field.
        if (newStatus !== 'unassigned') {
           updateData.status = newStatus;
        }
        statusText = SHOP_COLUMNS.find(c => c.id === newStatus)?.title || newStatus;
      }

      await updateDoc(doc(db, collectionName, id), updateData);

      // Automated WhatsApp Notification for Shop
      if (!isSupplier && profile?.role === 'shop' && item.customerPhone) {
        whatsappService.sendStatusUpdate(
          item.customerPhone,
          item.customerName,
          item.vehicleInfo || item.model,
          statusText
        );

        if (newStatus === 'completed' && profile?.googleGmbLink) {
          setTimeout(() => {
            whatsappService.sendGmbReview(
              item.customerPhone,
              item.customerName,
              profile.googleGmbLink!
            );
          }, 2000);
        }
      }
    } catch (error) {
      console.error('Error updating status:', error);
    }
  };

  const handlePrintOS = (os: any) => {
    const formatAddress = (addr: any) => {
      if (typeof addr === 'string') return addr;
      if (addr && typeof addr === 'object') {
        return `${addr.street}, ${addr.number}${addr.complement ? ' - ' + addr.complement : ''}, ${addr.neighborhood}, ${addr.city} - ${addr.state}`;
      }
      return 'Endereço não configurado';
    };

    generateProfessionalReport(
      `ORDEM DE SERVIÇO #${os.id.substring(0, 6).toUpperCase()}`,
      {
        name: profile?.companyName || profile?.name || 'OFICINA SERVICE HUB',
        address: formatAddress(profile?.address),
        contact: profile?.phone || '',
        logo: profile?.logo || undefined
      },
      [
        {
          title: 'DADOS DO CLIENTE',
          headers: ['CLIENTE', 'VEÍCULO', 'CRIADO EM'],
          body: [[
            os.customerName || 'N/A',
            os.vehicleInfo || os.model || 'N/A',
            os.createdAt?.toLocaleDateString('pt-BR') || ''
          ]]
        },
        {
          title: 'DETALHAMENTO TÉCNICO',
          headers: ['DESCRIÇÃO DO SERVIÇO', 'STATUS ATUAL'],
          body: [[
            os.description || 'Sem descrição detalhada',
            columns.find(c => c.id === getStatusLabel(os))?.title || os.status
          ]]
        }
      ]
    );
  };

  const shareSignature = (os: any) => {
    const url = `${window.location.origin}/signature/${os.id}`;
    const text = `Olá ${os.customerName}, sua Ordem de Serviço #${os.id.substring(0, 6)} está pronta para aprovação. Por favor, assine digitalmente aqui: ${url}`;
    window.open(`https://wa.me/${os.customerPhone?.replace(/\D/g, '')}?text=${encodeURIComponent(text)}`, '_blank');
  };

  const filteredData = useMemo(() => {
    return data.filter(item => {
      if (isSupplier) return true;
      const matchesEmployee = profile?.role === 'employee' 
        ? item.employeeId === profile.id 
        : (filterEmployeeId === '' || item.employeeId === filterEmployeeId);
      return matchesEmployee;
    });
  }, [data, filterEmployeeId, isSupplier, profile]);

  const handleDragStart = (event: any) => {
    setActiveId(event.active.id);
  };

  const handleDragEnd = async (event: any) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over) return;

    const itemId = active.id;
    const overId = over.id;

    const item = data.find(i => i.id === itemId);
    if (!item) return;

    let targetStatus = overId as string;
    let targetIndex = -1;

    // Check if dropping over a column or an item
    const isColumn = columns.some(col => col.id === overId);
    
    if (isColumn) {
      const columnItems = filteredData
        .filter(i => getStatusLabel(i) === targetStatus)
        .sort((a, b) => (a.order || 0) - (b.order || 0));
      targetIndex = columnItems.length;
    } else {
      const overItem = data.find(i => i.id === overId);
      if (overItem) {
        targetStatus = getStatusLabel(overItem);
        const columnItems = filteredData
          .filter(i => getStatusLabel(i) === targetStatus)
          .sort((a, b) => (a.order || 0) - (b.order || 0));
        targetIndex = columnItems.findIndex(i => i.id === overId);
      }
    }

    const currentStatus = getStatusLabel(item);

    // If status changed or position changed
    try {
      const collectionName = isSupplier ? 'purchase_orders' : 'work_orders';
      
      // 1. Update status if changed
      if (currentStatus !== targetStatus) {
        await updateStatus(itemId, targetStatus);
      }

      // 2. Update order for all items in the target column
      const columnItems = [...filteredData.filter(i => getStatusLabel(i) === targetStatus && i.id !== itemId)]
        .sort((a, b) => (a.order || 0) - (b.order || 0));
      
      columnItems.splice(targetIndex === -1 ? columnItems.length : targetIndex, 0, { ...item, status: targetStatus });

      // Batch update orders
      const updates = columnItems.map((colItem, idx) => ({
        id: colItem.id,
        order: idx
      }));

      await Promise.all(updates.map(up => updateDoc(doc(db, collectionName, up.id), { order: up.order })));
    } catch (err) {
      console.error("Error in drag end:", err);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-200px)]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className={`${isModal ? 'h-full' : 'h-[calc(100vh-12rem)]'} overflow-hidden flex flex-col p-6`}>
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-gray-900 dark:text-white">
            {isSupplier ? 'Fluxo de Entregas' : 'Fluxo de Trabalho'}
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">
            {isSupplier ? 'Arraste para atualizar status do pedido' : 'Arraste as ordens de serviço entre as colunas'}
          </p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          {profile?.role === 'admin' && (
            <select
              value={selectedShopId}
              onChange={(e) => {
                setSelectedShopId(e.target.value);
                setFilterEmployeeId('');
              }}
              className="p-2.5 text-xs font-bold bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all dark:text-white shadow-sm"
            >
              <option value="">Todas as Lojas</option>
              {shops.map(shop => (
                <option key={shop.id} value={shop.id}>{shop.name || shop.displayName || shop.email}</option>
              ))}
            </select>
          )}

          {!isSupplier && profile?.role !== 'employee' && (
            <select
              value={filterEmployeeId}
              onChange={(e) => setFilterEmployeeId(e.target.value)}
              className="p-2.5 text-xs font-bold bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all dark:text-white shadow-sm"
            >
              <option value="">Todos os funcionários</option>
              {employees.map(emp => (
                <option key={emp.id} value={emp.id}>{emp.name || emp.displayName}</option>
              ))}
            </select>
          )}
        </div>
      </div>

      <DndContext 
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex-1 overflow-x-auto pb-4 custom-scrollbar">
          <div className="flex gap-3 h-full min-w-max px-2">
            {columns.map((col) => (
              <SortableColumn 
                key={col.id} 
                column={col} 
                items={filteredData.filter(item => getStatusLabel(item) === col.id)}
                isSupplier={isSupplier}
                shareSignature={shareSignature}
                onPrintOS={handlePrintOS}
                onCardClick={(os: any) => navigate(`/app/services?id=${os.id}`)}
                profile={profile}
              />
            ))}
          </div>
        </div>

        <DragOverlay dropAnimation={{
          sideEffects: defaultDropAnimationSideEffects({
            styles: {
              active: {
                opacity: '0.5',
              },
            },
          }),
        }}>
          {activeId ? (
            <KanbanCard 
              item={data.find(i => i.id === activeId)} 
              isSupplier={isSupplier} 
              isDragging 
              onPrintOS={handlePrintOS}
              profile={profile}
            />
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}

function SortableColumn({ column, items, isSupplier, shareSignature, onPrintOS, onCardClick, profile }: any) {
  const { setNodeRef } = useSortable({ id: column.id });

  return (
    <div className="w-72 flex flex-col h-full shrink-0">
      <div className="flex items-center justify-between mb-6 px-2">
        <div className="flex items-center gap-3">
          <div className={`p-2.5 rounded-2xl ${column.bg} shadow-sm`}>
            <column.icon className={`h-5 w-5 ${column.color}`} />
          </div>
          <h3 className="font-black text-sm text-gray-900 dark:text-white uppercase tracking-[0.15em]">{column.title}</h3>
        </div>
        <span className="text-[9px] font-black text-gray-500 bg-white dark:bg-gray-800 px-2.5 py-1 rounded-full shadow-sm border border-black/5">
          {items.length}
        </span>
      </div>

      <div 
        ref={setNodeRef}
        className="flex-1 overflow-y-auto space-y-5 p-3 bg-gray-50 dark:bg-gray-900/50 rounded-[2.5rem] border border-gray-100 dark:border-gray-800/50 custom-scrollbar shadow-inner"
      >
        <SortableContext 
          items={items.map((i: any) => i.id)} 
          strategy={verticalListSortingStrategy}
        >
          {items.map((item: any) => (
            <KanbanCard 
              key={item.id} 
              item={item} 
              isSupplier={isSupplier} 
              shareSignature={shareSignature} 
              onPrintOS={onPrintOS}
              onClick={onCardClick}
              profile={profile}
            />
          ))}
        </SortableContext>
        
        {items.length === 0 && (
          <div className="h-32 flex flex-col items-center justify-center opacity-20">
            <AlertCircle className="h-8 w-8 text-gray-400 mb-2" />
            <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Vazio</span>
          </div>
        )}
      </div>
    </div>
  );
}
