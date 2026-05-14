import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Plus, Search, AlertTriangle, X, Edit2, Trash2, 
  ArrowUpCircle, ArrowDownCircle, Package, Tag, 
  DollarSign, Layers, ShoppingBag, Filter, 
  AlertCircle, CheckCircle2, TrendingDown, Camera, Sparkles, Loader2, 
  CheckSquare, Square, FileText, MessageSquare
} from 'lucide-react';
import { generateProfessionalReport } from '../services/invoiceGenerator';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../AuthContext';
import { db } from '../firebase';
import { handleFirestoreError, OperationType } from '../utils/firestoreErrors';
import { 
  collection, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  onSnapshot, 
  query, 
  where, 
  serverTimestamp,
  orderBy,
  getDocs
} from 'firebase/firestore';
import { identifyPartFromImage } from '../services/aiService';
import { checkPlanLimit } from '../utils/planLimits';
import { formatDateBRT } from '../utils/dateUtils';
import PlanLimitModal from '../components/PlanLimitModal';

export default function Inventory() {
  const { profile, user, selectedCompanyId } = useAuth();
  const [inventory, setInventory] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isStockModalOpen, setIsStockModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [stockAction, setStockAction] = useState<'in' | 'out'>('in');
  const [stockAmount, setStockAmount] = useState(0);
  const [isScanning, setIsScanning] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showLimitModal, setShowLimitModal] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Form State
  const [formData, setFormData] = useState({
    partName: '',
    category: '',
    supplier: '',
    costPrice: 0,
    salePrice: 0,
    stockQuantity: 0,
    minimumStockLevel: 5,
    totalInvestment: 0,
    totalRevenue: 0
  });
  
  useEffect(() => {
    if (!user) return;
    const companyId = selectedCompanyId || profile?.companyId;
    if (!companyId) return;

    const q = query(
      collection(db, 'inventory'),
      where('companyId', '==', companyId),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setInventory(data);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'inventory');
    });

    return () => unsubscribe();
  }, [profile, selectedCompanyId, user]);

  const inventoryStats = useMemo(() => {
    const totalItems = inventory.length;
    const lowStockItems = inventory.filter(i => i.stockQuantity > 0 && i.stockQuantity <= (i.minimumStockLevel || 5)).length;
    const outOfStockItems = inventory.filter(i => i.stockQuantity <= 0).length;
    const totalValue = inventory.reduce((acc, item) => acc + (item.costPrice * item.stockQuantity || 0), 0);
    
    return {
      totalItems,
      lowStockItems,
      outOfStockItems,
      totalValue
    };
  }, [inventory]);

  const handleScanPart = () => {
    fileInputRef.current?.click();
  };

  const processPartImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsScanning(true);
    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64 = reader.result as string;
        const result = await identifyPartFromImage(base64, user?.uid || '', profile?.companyId || '');
        
        if (result.error) {
          alert("Erro na leitura: " + result.error);
        } else {
          setFormData(prev => ({
            ...prev,
            partName: result.name || prev.partName,
            category: result.category || prev.category,
            supplier: result.brand || prev.supplier,
            costPrice: result.priceSuggestion ? result.priceSuggestion * 0.7 : prev.costPrice,
            salePrice: result.priceSuggestion || prev.salePrice
          }));
        }
        setIsScanning(false);
      };
      reader.readAsDataURL(file);
    } catch (error) {
      console.error("Vision Part Error:", error);
      alert("Erro ao identificar peça. Tente manual.");
      setIsScanning(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const companyId = selectedCompanyId || profile?.companyId;
    if (!companyId) return;

    if (!formData.partName.trim()) {
      alert("Nome da peça é obrigatório.");
      return;
    }

    try {
      if (!selectedItem) {
        const limitCheck = await checkPlanLimit(companyId, profile?.plan || 'free', 'inventory', profile?.role);
        if (!limitCheck.allowed && profile?.role !== 'admin') {
          setShowLimitModal(true);
          return;
        }
      }

      if (selectedItem) {
        const itemRef = doc(db, 'inventory', selectedItem.id);
        await updateDoc(itemRef, {
          ...formData,
          partName: formData.partName.trim(),
          category: formData.category.trim(),
          supplier: formData.supplier.trim()
        });
      } else {
        await addDoc(collection(db, 'inventory'), {
          ...formData,
          partName: formData.partName.trim(),
          category: formData.category.trim(),
          supplier: formData.supplier.trim(),
          companyId: companyId,
          totalInvestment: formData.costPrice * formData.stockQuantity,
          totalRevenue: 0,
          createdAt: serverTimestamp()
        });
        
        await addDoc(collection(db, 'expenses'), {
          description: `Compra de estoque: ${formData.partName.trim()}`,
          amount: formData.costPrice * formData.stockQuantity,
          category: 'Peças',
          date: formatDateBRT(new Date()),
          companyId: companyId,
          createdAt: serverTimestamp()
        });
      }
      setIsModalOpen(false);
      setSelectedItem(null);
      resetForm();
    } catch (error) {
      handleFirestoreError(error, selectedItem ? OperationType.UPDATE : OperationType.CREATE, 'inventory');
    }
  };

  const handleStockUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItem) return;
    const companyId = selectedCompanyId || profile?.companyId;

    const newQuantity = stockAction === 'in' 
      ? selectedItem.stockQuantity + stockAmount 
      : selectedItem.stockQuantity - stockAmount;

    try {
      const itemRef = doc(db, 'inventory', selectedItem.id);
      const investmentUpdate = stockAction === 'in' ? (selectedItem.costPrice * stockAmount) : 0;
      const revenueUpdate = stockAction === 'out' ? (selectedItem.salePrice * stockAmount) : 0;

      await updateDoc(itemRef, {
        stockQuantity: newQuantity,
        totalInvestment: (selectedItem.totalInvestment || 0) + investmentUpdate,
        totalRevenue: (selectedItem.totalRevenue || 0) + revenueUpdate
      });

      if (stockAction === 'in' && stockAmount > 0) {
        await addDoc(collection(db, 'expenses'), {
          description: `Reposição de estoque: ${selectedItem.partName}`,
          amount: selectedItem.costPrice * stockAmount,
          category: 'Peças',
          date: formatDateBRT(new Date()),
          companyId: companyId,
          createdAt: serverTimestamp()
        });
      }

      setIsStockModalOpen(false);
      setSelectedItem(null);
      setStockAmount(0);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'inventory');
    }
  };

  const handleDelete = async (item: any) => {
    const companyId = selectedCompanyId || profile?.companyId;
    if (!confirm(`Tem certeza que deseja excluir "${item.partName}"?`)) return;
    try {
      await deleteDoc(doc(db, 'inventory', item.id));
      
      const q = query(collection(db, 'expenses'), where('companyId', '==', companyId), where('description', '==', `Compra de estoque: ${item.partName}`));
      const snapshot = await getDocs(q);
      await Promise.all(snapshot.docs.map(async (d) => {
        try {
          await deleteDoc(doc(db, 'expenses', d.id));
        } catch (e) {
          console.error("Error deleting linked expense:", e);
        }
      }));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'inventory');
    }
  };

  const resetForm = () => {
    setFormData({
      partName: '',
      category: '',
      supplier: '',
      costPrice: 0,
      salePrice: 0,
      stockQuantity: 0,
      minimumStockLevel: 5,
      totalInvestment: 0,
      totalRevenue: 0
    });
  };

  const openEditModal = (item: any) => {
    setSelectedItem(item);
    setFormData({
      partName: item.partName,
      category: item.category,
      supplier: item.supplier,
      costPrice: item.costPrice,
      salePrice: item.salePrice,
      stockQuantity: item.stockQuantity,
      minimumStockLevel: item.minimumStockLevel,
      totalInvestment: item.totalInvestment || 0,
      totalRevenue: item.totalRevenue || 0
    });
    setIsModalOpen(true);
  };

  const openStockModal = (item: any, action: 'in' | 'out') => {
    setSelectedItem(item);
    setStockAction(action);
    setIsStockModalOpen(true);
  };

  const filteredInventory = inventory.filter(i => 
    i.partName?.toLowerCase().includes(search.toLowerCase()) ||
    i.category?.toLowerCase().includes(search.toLowerCase())
  );

  const toggleSelectAll = () => {
    if (selectedIds.length === filteredInventory.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredInventory.map(i => i.id));
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleBatchOrder = () => {
    const selectedItems = inventory.filter(i => selectedIds.includes(i.id));
    if (selectedItems.length === 0) return;

    const business = {
      name: profile?.companyName || profile?.fullName || 'Service Hub Pro',
      tradeName: profile?.tradeName,
      doc: profile?.cnpj || profile?.cpfCnpj,
      address: profile?.address ? `${profile.address.street}, ${profile.address.number}` : '',
      contact: profile?.phone || profile?.email,
      logo: profile?.logo
    };

    const itemsForReport = selectedItems.map(item => [
      item.partName,
      item.category,
      item.supplier || '-',
      `${item.stockQuantity} UN`,
      new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.costPrice)
    ]);

    const sections = [
      {
        title: 'Itens Solicitados para Reposição',
        headers: ['Item', 'Categoria', 'Fornecedor Sugerido', 'Qtd Atual', 'Preço Custo Est.'],
        body: itemsForReport
      }
    ];

    generateProfessionalReport('PEDIDO DE REPOSIÇÃO DE ESTOQUE', business, sections);
  };

  const handleWhatsAppOrder = () => {
    const selectedItems = inventory.filter(i => selectedIds.includes(i.id));
    if (selectedItems.length === 0) return;

    let message = `*SOLICITAÇÃO DE ORÇAMENTO/COMPRA* 📦\n\n`;
    message += `Olá! Gostaria de solicitar os seguintes itens:\n\n`;
    
    selectedItems.forEach(item => {
      message += `• *${item.partName}* (Ref: ${item.category})\n`;
    });

    message += `\nFavor confirmar disponibilidade e preços.\n_Enviado via Service Hub Pro_`;

    const text = encodeURIComponent(message);
    window.open(`https://wa.me/?text=${text}`, '_blank');
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-4 md:p-8  mx-auto"
    >
      <PlanLimitModal
        isOpen={showLimitModal}
        onClose={() => setShowLimitModal(false)}
        currentPlan={profile?.plan || 'free'}
        feature="itens de estoque"
      />
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={processPartImage} 
        accept="image/*" 
        capture="environment" 
        className="hidden" 
      />

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-xl">
              <Package className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
            </div>
            <h1 className="text-3xl font-black text-gray-900 dark:text-white tracking-tight">Estoque de Peças</h1>
          </div>
          <p className="text-gray-500 dark:text-gray-400 font-medium tracking-tight">Gestão inteligente de inventário e insumos</p>
        </div>
        
        <div className="flex gap-3">
          {selectedIds.length > 0 && (
            <>
              <button
                onClick={handleWhatsAppOrder}
                className="inline-flex items-center justify-center px-6 py-4 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-2xl font-black transition-all duration-200 active:scale-95 uppercase text-[10px] tracking-widest"
              >
                <MessageSquare className="w-4 h-4 mr-2" />
                WhatsApp ({selectedIds.length})
              </button>
              <button
                onClick={handleBatchOrder}
                className="inline-flex items-center justify-center px-6 py-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-black transition-all duration-200 shadow-xl shadow-emerald-500/20 active:scale-95 uppercase text-[10px] tracking-widest"
              >
                <FileText className="w-4 h-4 mr-2" />
                PDF ({selectedIds.length})
              </button>
            </>
          )}
          <button
            onClick={handleScanPart}
            disabled={isScanning}
            className="inline-flex items-center justify-center px-6 py-4 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-2xl font-black transition-all duration-200 active:scale-95 uppercase text-[10px] tracking-widest"
          >
            {isScanning ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Camera className="w-4 h-4 mr-2" />}
            {isScanning ? 'Lendo...' : 'Scan Rápido'}
          </button>
          <button
            onClick={() => { setSelectedItem(null); resetForm(); setIsModalOpen(true); }}
            className="inline-flex items-center justify-center px-6 py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black transition-all duration-200 shadow-xl shadow-indigo-500/20 active:scale-95 uppercase text-xs tracking-widest"
          >
            <Plus className="w-5 h-5 mr-2" />
            Nova Peça
          </button>
        </div>
      </div>

      {/* Stats Summary Dashboard */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10 mb-12">
        <StatCard 
          title="Total de Itens" 
          value={inventoryStats.totalItems.toString()} 
          icon={<Layers className="h-8 w-8" />} 
          color="indigo" 
        />
        <StatCard 
          title="Valor em Estoque" 
          value={new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(inventoryStats.totalValue)} 
          icon={<DollarSign className="h-8 w-8" />} 
          color="emerald" 
        />
        <StatCard 
          title="Estoque Crítico" 
          value={inventoryStats.lowStockItems.toString()} 
          icon={<AlertTriangle className="h-8 w-8" />} 
          color="amber" 
          highlight={inventoryStats.lowStockItems > 0} 
        />
        <StatCard 
          title="Sem Estoque" 
          value={inventoryStats.outOfStockItems.toString()} 
          icon={<TrendingDown className="h-8 w-8" />} 
          color="rose" 
          highlight={inventoryStats.outOfStockItems > 0}
        />
      </div>

      <div className="mb-8 relative group">
        <Search className="absolute left-5 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 group-focus-within:text-indigo-500 transition-colors" />
        <input
          type="text"
          placeholder="Buscar por nome, categoria ou fornecedor..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-14 pr-6 py-5 bg-white dark:bg-gray-800 border-none rounded-3xl shadow-sm focus:ring-2 focus:ring-indigo-500 dark:text-white text-sm font-bold transition-all outline-none"
        />
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-[2.5rem] shadow-xl border border-gray-100 dark:border-gray-700 overflow-hidden">
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50/50 dark:bg-gray-900/50 border-b border-gray-100 dark:border-gray-700">
                <th className="px-8 py-6 w-10">
                  <button 
                    onClick={toggleSelectAll}
                    className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
                  >
                    {selectedIds.length === filteredInventory.length && filteredInventory.length > 0 ? (
                      <CheckSquare className="w-5 h-5 text-indigo-600" />
                    ) : (
                      <Square className="w-5 h-5 text-gray-400" />
                    )}
                  </button>
                </th>
                <th className="px-8 py-6 text-xs font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest text-left">Peça / Categoria</th>
                <th className="px-8 py-6 text-xs font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest text-center">Disponibilidade</th>
                <th className="px-8 py-6 text-xs font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest text-right">Precificação</th>
                <th className="px-8 py-6 text-xs font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              <AnimatePresence mode="popLayout">
                {filteredInventory.length > 0 ? filteredInventory.map((item) => (
                  <motion.tr 
                    key={item.id}
                    layout
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className={`hover:bg-gray-50/50 dark:hover:bg-gray-900/30 transition-colors group ${
                      selectedIds.includes(item.id) ? 'bg-indigo-50/30 dark:bg-indigo-900/10' : ''
                    }`}
                  >
                    <td className="px-8 py-6">
                      <button 
                        onClick={() => toggleSelect(item.id)}
                        className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
                      >
                        {selectedIds.includes(item.id) ? (
                          <CheckSquare className="w-5 h-5 text-indigo-600" />
                        ) : (
                          <Square className="w-5 h-5 text-gray-400" />
                        )}
                      </button>
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-5">
                        <div className={`w-20 h-20 rounded-[2rem] flex items-center justify-center shadow-inner ${
                          item.stockQuantity <= 0 ? 'bg-rose-50 text-rose-600 dark:bg-rose-900/20 dark:text-rose-400' : 'bg-indigo-50 text-indigo-600 dark:bg-indigo-900/20 dark:text-indigo-400'
                        }`}>
                          <Package className="w-10 h-10" />
                        </div>
                        <div>
                          <div className="font-black text-gray-900 dark:text-white text-2xl tracking-tighter">{item.partName}</div>
                          <div className="flex items-center gap-3 mt-2">
                            <span className="text-sm font-black text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-700/50 px-4 py-1.5 rounded-xl uppercase tracking-widest">
                              {item.category}
                            </span>
                            {item.supplier && (
                              <span className="text-base font-bold text-gray-400">/ {item.supplier}</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex flex-col items-center">
                        <div className="flex items-center gap-4">
                          <span className={`inline-flex items-center px-4 py-2 rounded-2xl text-xs font-black tracking-widest ${
                            item.stockQuantity <= 0
                              ? 'bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-400'
                              : item.stockQuantity <= (item.minimumStockLevel || 5)
                              ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400'
                              : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400'
                          }`}>
                            {item.stockQuantity} UN
                          </span>
                          <div className="flex gap-1.5 opacity-0 group-hover:opacity-100 transition-all transform translate-x-2 group-hover:translate-x-0">
                            <button
                              onClick={() => openStockModal(item, 'in')}
                              className="p-2.5 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 rounded-xl transition-all bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 shadow-sm"
                              title="Entrada"
                            >
                              <ArrowUpCircle className="w-5 h-5" />
                            </button>
                            <button
                              onClick={() => openStockModal(item, 'out')}
                              className="p-2.5 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/30 rounded-xl transition-all bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 shadow-sm"
                              title="Saída"
                            >
                              <ArrowDownCircle className="w-5 h-5" />
                            </button>
                          </div>
                        </div>
                        {item.stockQuantity <= (item.minimumStockLevel || 5) && (
                          <div className="flex flex-col items-center">
                            <span className={`text-[9px] mt-2 font-black flex items-center gap-1 uppercase tracking-widest ${
                               item.stockQuantity <= 0 ? 'text-rose-600' : 'text-amber-600'
                            }`}>
                              <AlertCircle className="w-3 h-3" />
                              {item.stockQuantity <= 0 ? 'Esgotado' : 'Estoque Crítico'}
                            </span>
                            <button 
                              onClick={() => openStockModal(item, 'in')}
                              className="mt-2 text-[8px] font-black bg-indigo-600 text-white px-3 py-1 rounded-full uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-md active:scale-95"
                            >
                              Repor Agora
                            </button>
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-8 py-6 text-right">
                      <div className="font-black text-gray-900 dark:text-white text-2xl mb-1">
                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.salePrice)}
                      </div>
                      <div className="text-xs font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest">
                        Custo: {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.costPrice)}
                      </div>
                    </td>
                    <td className="px-8 py-6 text-right">
                      <div className="flex items-center justify-end gap-3 lg:opacity-0 group-hover:opacity-100 transition-all">
                        <button
                          onClick={() => openEditModal(item)}
                          className="p-3.5 text-indigo-600 bg-indigo-50 dark:bg-indigo-900/20 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 rounded-2xl transition-all"
                        >
                          <Edit2 className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => handleDelete(item)}
                          className="p-3.5 text-rose-600 bg-rose-50 dark:bg-rose-900/20 hover:bg-rose-100 dark:hover:bg-rose-900/40 rounded-2xl transition-all"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    </td>
                  </motion.tr>
                )) : (
                  <motion.tr initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                    <td colSpan={4} className="px-8 py-32 text-center">
                      <div className="w-24 h-24 bg-gray-100 dark:bg-gray-900 rounded-[2rem] flex items-center justify-center mx-auto mb-8 shadow-inner">
                        <Package className="w-12 h-12 text-gray-300" />
                      </div>
                      <h3 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">Nenhum item em estoque</h3>
                      <p className="text-gray-500 dark:text-gray-400 mt-2 font-medium">Tente ajustar sua busca ou cadastre novas peças agora.</p>
                    </td>
                  </motion.tr>
                )}
              </AnimatePresence>
            </tbody>
          </table>
        </div>
      </div>

      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-black/40"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 30 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 30 }}
              className="relative bg-white dark:bg-gray-800 rounded-[3rem] shadow-2xl w-full max-w-2xl overflow-hidden border border-gray-100 dark:border-gray-700"
            >
              <div className="flex justify-between items-center p-10 border-b border-gray-100 dark:border-gray-700">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-indigo-100 dark:bg-indigo-900/30 rounded-2xl">
                    <Package className="h-7 w-7 text-indigo-600 dark:text-indigo-400" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">
                        {selectedItem ? 'Editar Registro' : 'Novo Registro'}
                    </h3>
                    <p className="text-sm text-gray-400 font-medium">Preencha os detalhes técnicos da peça</p>
                  </div>
                </div>
                <button 
                  onClick={() => setIsModalOpen(false)}
                  className="p-3 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-all"
                >
                  <X className="h-7 w-7 text-gray-400" />
                </button>
              </div>

              <form onSubmit={handleSave} className="p-10 space-y-8 max-h-[70vh] overflow-y-auto">
                {/* AI Scanner Notification */}
                <div className="p-4 bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-100 dark:border-indigo-800 rounded-2xl flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-indigo-600 rounded-xl">
                      <Sparkles className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <p className="text-sm font-black text-indigo-900 dark:text-indigo-200">Preenchimento Automático</p>
                      <p className="text-[10px] text-indigo-600 dark:text-indigo-400">Identifique via foto e economize tempo.</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleScanPart}
                    disabled={isScanning}
                    className="px-4 py-2 bg-indigo-600 text-white text-[10px] font-black uppercase tracking-widest rounded-xl shadow-lg hover:scale-105 transition-all flex items-center gap-2"
                  >
                    {isScanning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
                    {isScanning ? 'Lendo...' : 'Usar Foto'}
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="md:col-span-2">
                    <FieldLabel>Nome da Peça</FieldLabel>
                    <input
                      type="text"
                      required
                      value={formData.partName}
                      onChange={e => setFormData({...formData, partName: e.target.value})}
                      className="w-full px-6 py-5 bg-gray-50 dark:bg-gray-900 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 dark:text-white font-bold text-sm transition-all outline-none"
                      placeholder="Ex: Kit de Embreagem LUK"
                    />
                  </div>

                  <div>
                    <FieldLabel>Categoria</FieldLabel>
                    <input
                      type="text"
                      value={formData.category}
                      onChange={e => setFormData({...formData, category: e.target.value})}
                      className="w-full px-6 py-5 bg-gray-50 dark:bg-gray-900 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 dark:text-white font-bold text-sm transition-all outline-none"
                      placeholder="Ex: Transmissão"
                    />
                  </div>
                  <div>
                    <FieldLabel>Fornecedor / Fabricante</FieldLabel>
                    <input
                      type="text"
                      value={formData.supplier}
                      onChange={e => setFormData({...formData, supplier: e.target.value})}
                      className="w-full px-6 py-5 bg-gray-50 dark:bg-gray-900 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 dark:text-white font-bold text-sm transition-all outline-none"
                      placeholder="Ex: LUK / AutoPeças Premium"
                    />
                  </div>

                  <div>
                    <FieldLabel>Custo Unitário (R$)</FieldLabel>
                    <div className="relative">
                        <DollarSign className="absolute left-5 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                        <input
                        type="number"
                        step="0.01"
                        value={formData.costPrice}
                        onChange={e => setFormData({...formData, costPrice: parseFloat(e.target.value) || 0})}
                        className="w-full pl-14 pr-6 py-5 bg-gray-50 dark:bg-gray-900 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 dark:text-white font-bold text-sm transition-all outline-none"
                        />
                    </div>
                  </div>
                  <div>
                    <FieldLabel>Venda Unitária (R$)</FieldLabel>
                    <div className="relative">
                        <DollarSign className="absolute left-5 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                        <input
                        type="number"
                        step="0.01"
                        value={formData.salePrice}
                        onChange={e => setFormData({...formData, salePrice: parseFloat(e.target.value) || 0})}
                        className="w-full pl-14 pr-6 py-5 bg-gray-50 dark:bg-gray-900 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 dark:text-white font-bold text-sm transition-all outline-none"
                        />
                    </div>
                  </div>

                  <div>
                    <FieldLabel>Quantidade Inicial</FieldLabel>
                    <input
                      type="number"
                      disabled={!!selectedItem}
                      value={formData.stockQuantity}
                      onChange={e => setFormData({...formData, stockQuantity: parseInt(e.target.value) || 0})}
                      className="w-full px-6 py-5 bg-gray-50 dark:bg-gray-900 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 dark:text-white font-black text-lg transition-all outline-none disabled:opacity-40"
                    />
                  </div>
                  <div>
                    <FieldLabel>Limite Crítico (Alerta)</FieldLabel>
                    <input
                      type="number"
                      value={formData.minimumStockLevel}
                      onChange={e => setFormData({...formData, minimumStockLevel: parseInt(e.target.value) || 0})}
                      className="w-full px-6 py-5 bg-gray-50 dark:bg-gray-900 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 dark:text-white font-black text-lg transition-all outline-none"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-6 pt-5">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="text-sm font-black text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 uppercase tracking-widest transition-all"
                  >
                    Descartar
                  </button>
                  <button
                    type="submit"
                    className="px-12 py-5 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-[1.5rem] shadow-2xl shadow-indigo-500/20 transition-all active:scale-95 uppercase text-xs tracking-widest"
                  >
                    Finalizar Registro
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isStockModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsStockModalOpen(false)}
              className="absolute inset-0 bg-black/60"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 30 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 30 }}
              className="relative bg-white dark:bg-gray-800 rounded-[3.5rem] shadow-2xl w-full max-w-md overflow-hidden"
            >
              <div className="p-12 text-center">
                <div className={`w-24 h-24 rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-xl ${
                  stockAction === 'in' ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'
                }`}>
                  {stockAction === 'in' ? <ArrowUpCircle className="w-12 h-12" /> : <ArrowDownCircle className="w-12 h-12" />}
                </div>
                <h3 className="text-3xl font-black text-gray-900 dark:text-white mb-2 tracking-tight">
                  {stockAction === 'in' ? 'Entrada' : 'Saída'}
                </h3>
                <p className="text-gray-400 font-bold mb-10 uppercase text-[10px] tracking-[0.2em]">{selectedItem?.partName}</p>
                
                <form onSubmit={handleStockUpdate} className="space-y-8">
                  <div>
                    <input
                      type="number"
                      min="1"
                      required
                      autoFocus
                      value={stockAmount}
                      onChange={e => setStockAmount(parseInt(e.target.value) || 0)}
                      className="w-full px-6 py-6 bg-gray-50 dark:bg-gray-900 border-none rounded-3xl focus:ring-2 focus:ring-indigo-500 dark:text-white text-center text-4xl font-black transition-all outline-none"
                    />
                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mt-4">Informe a Quantidade</label>
                  </div>
                  <div className="flex flex-col gap-4">
                    <button
                      type="submit"
                      className={`w-full py-6 text-white font-black rounded-[2rem] shadow-2xl transition-all active:scale-95 uppercase text-xs tracking-[0.2em] ${
                        stockAction === 'in' 
                          ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-500/30' 
                          : 'bg-rose-600 hover:bg-rose-700 shadow-rose-500/30'
                      }`}
                    >
                      Confirmar Operação
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsStockModalOpen(false)}
                      className="w-full py-4 text-xs font-black text-gray-400 hover:text-gray-600 uppercase tracking-widest transition-all"
                    >
                      Cancelar
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function StatCard({ title, value, icon, color, highlight }: any) {
    const colorClasses: any = {
        indigo: "bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600",
        emerald: "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600",
        amber: "bg-amber-50 dark:bg-amber-900/20 text-amber-600",
        rose: "bg-rose-50 dark:bg-rose-900/20 text-rose-600",
    };
    
    return (
        <motion.div 
            whileHover={{ y: -5 }}
            className={`bg-white dark:bg-gray-800 p-8 rounded-[2.5rem] shadow-lg border border-gray-100 dark:border-gray-700 transition-all ${
                highlight ? 'ring-2 ring-rose-500/20 border-rose-100 dark:border-rose-900/40' : ''
            }`}
        >
            <div className={`p-4 rounded-2xl w-fit mb-6 ${colorClasses[color]}`}>
                {icon}
            </div>
            <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">{title}</h4>
            <div className={`text-2xl font-black tracking-tight ${
              highlight ? 'text-rose-600 animate-pulse' : 'text-gray-900 dark:text-white'
            }`}>
              {value}
            </div>
        </motion.div>
    );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
    return (
        <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 ml-2">
            {children}
        </label>
    );
}
