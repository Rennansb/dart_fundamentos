import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { useAuth } from '../AuthContext';
import { format } from 'date-fns';
import { formatDateSafe } from '../utils/dateUtils';
import { TrendingUp, Calendar, Search, Filter, Wrench, ChevronRight, DollarSign, Package, Download, FileText, FileSpreadsheet, Ghost } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { handleFirestoreError, OperationType } from '../utils/firestoreErrors';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import * as XLSX from 'xlsx';

export default function Receivables() {
  const { profile, user, selectedCompanyId } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (!user || !profile) return;
    const isSupplier = profile.role === 'fornecedor';
    const companyId = isSupplier ? profile.uid : (selectedCompanyId || profile?.companyId);
    
    if (!companyId) return;

    const collectionName = isSupplier ? 'purchase_orders' : 'work_orders';
    const filterField = isSupplier ? 'supplierId' : 'companyId';

    const q = query(
      collection(db, collectionName), 
      where(filterField, '==', companyId)
    );
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setItems(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, collectionName);
    });

    return () => unsubscribe();
  }, [profile, user, selectedCompanyId]);

  const isSupplier = profile?.role === 'fornecedor';

  const filteredItems = items
    .filter(item => {
      const value = isSupplier ? (item.totalAmount || 0) : (item.laborCost || 0);
      return value > 0;
    })
    .filter(item => {
      const searchIn = isSupplier ? 
        `${item.shopName} ${item.id}` : 
        `${item.customerName} ${item.id}`;
      return searchIn.toLowerCase().includes(searchTerm.toLowerCase());
    });

  const totalReceivable = items.reduce((acc, curr) => {
    const value = isSupplier ? (curr.totalAmount || 0) : (curr.laborCost || 0);
    return acc + value;
  }, 0);

  const handleExportPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(20);
    doc.text('Relatório de Contas a Receber', 14, 22);
    doc.setFontSize(11);
    doc.text(`Gerado em: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, 14, 30);
    doc.text(`Total Previsto: R$ ${totalReceivable.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 14, 38);

    const tableColumn = ["Data", "Descrição", "Cliente/Oficina", "Categoria", "Valor (R$)"];
    const tableRows: any[] = [];

    filteredItems.forEach(item => {
      const itemData = [
        formatDateSafe(item.createdAt),
        isSupplier ? `Pedido #${item.id.substring(0, 8)}` : `OS #${item.id.substring(0, 8)}`,
        isSupplier ? item.shopName : item.customerName,
        isSupplier ? 'Venda' : 'Serviço',
        (isSupplier ? item.totalAmount : item.laborCost)?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })
      ];
      tableRows.push(itemData);
    });

    (doc as any).autoTable({
      head: [tableColumn],
      body: tableRows,
      startY: 45,
      theme: 'grid',
      styles: { fontSize: 8, font: 'helvetica', cellPadding: 3 },
      headStyles: { fillColor: [16, 185, 129], textColor: [255, 255, 255] }
    });

    doc.save(`recebiveis_${format(new Date(), 'dd-MM-yyyy')}.pdf`);
  };

  const handleExportExcel = () => {
    const tableData = filteredItems.map(item => ({
      Data: formatDateSafe(item.createdAt),
      ID: item.id.substring(0, 8),
      Descricao: isSupplier ? 'Venda de Peças' : 'Mão de Obra',
      ClienteOuOficina: isSupplier ? item.shopName : item.customerName,
      Categoria: isSupplier ? 'Venda' : 'Serviço',
      Valor: isSupplier ? item.totalAmount : item.laborCost
    }));

    const ws = XLSX.utils.json_to_sheet(tableData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Recebíveis");
    XLSX.writeFile(wb, `recebiveis_${format(new Date(), 'dd-MM-yyyy')}.xlsx`);
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white sm:text-3xl tracking-tight">
            Contas a Receber
          </h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {isSupplier ? 'Acompanhe os valores a receber das oficinas.' : 'Acompanhe os valores a receber de ordens de serviço.'}
          </p>
        </div>
      </div>

      {/* Summary Card */}
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.1 }}
        className="bg-gradient-to-br from-emerald-500 to-emerald-700 p-8 rounded-[2.5rem] shadow-xl shadow-emerald-200 dark:shadow-none text-white relative overflow-hidden group"
      >
        <div className="absolute top-0 right-0 p-12 -mr-12 -mt-12 bg-white/10 rounded-full blur-3xl group-hover:bg-white/20 transition-all"></div>
        <div className="relative z-10 flex items-center gap-6">
          <div className="p-4 bg-white/20 rounded-2xl backdrop-blur-md">
            <TrendingUp className="h-8 w-8 text-white" />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-emerald-100">Total a Receber</p>
            <p className="text-4xl font-black tracking-tighter mt-1">
              R$ {totalReceivable.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </p>
          </div>
        </div>
      </motion.div>

      {/* Filters and Search and Export */}
      <div className="flex flex-col sm:flex-row gap-4 items-center">
        <div className="relative flex-1 group w-full">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 group-focus-within:text-emerald-500 transition-colors" />
          <input
            type="text"
            placeholder={isSupplier ? "Buscar por oficina ou pedido..." : "Buscar por cliente ou OS..."}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-4 py-4 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-[1.5rem] shadow-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all outline-none text-sm font-bold text-gray-900 dark:text-white"
          />
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <button
            onClick={handleExportPDF}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40 rounded-[1.5rem] font-bold transition-all"
            title="Exportar como PDF"
          >
            <FileText className="h-5 w-5" />
            <span className="hidden sm:inline">PDF</span>
          </button>
          <button
            onClick={handleExportExcel}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-4 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 rounded-[1.5rem] font-bold transition-all"
            title="Exportar como Excel (XLSX)"
          >
            <FileSpreadsheet className="h-5 w-5" />
            <span className="hidden sm:inline">Excel</span>
          </button>
        </div>
      </div>

      {/* Desktop Table */}
      <div className="hidden md:block overflow-hidden bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-[2rem] shadow-xl shadow-gray-200/50 dark:shadow-none">
        <table className="min-w-full divide-y divide-gray-50 dark:divide-gray-700">
          <thead className="bg-gray-50/50 dark:bg-gray-800/50">
            <tr>
              <th className="px-8 py-5 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Data</th>
              <th className="px-8 py-5 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Descrição</th>
              <th className="px-8 py-5 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Categoria</th>
              <th className="px-8 py-5 text-right text-[10px] font-black text-gray-400 uppercase tracking-widest">Valor</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            <AnimatePresence mode="popLayout">
              {filteredItems.length > 0 ? (
                filteredItems.map((item) => (
                  <motion.tr 
                    key={item.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                  >
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                      {formatDateSafe(item.createdAt)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900 dark:text-white">
                        {isSupplier ? `Venda de Peças - Pedido #${item.id.substring(0, 8)}` : `Mão de Obra - OS #${item.id.substring(0, 8)}`}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">{isSupplier ? item.shopName : item.customerName}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="inline-flex items-center rounded-lg bg-emerald-100 dark:bg-emerald-900/30 px-2.5 py-1 text-xs font-medium text-emerald-800 dark:text-emerald-400 gap-1">
                        {isSupplier ? <Package className="h-3 w-3" /> : <Wrench className="h-3 w-3" />}
                        {isSupplier ? 'Venda' : 'Serviço'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-bold text-emerald-600 dark:text-emerald-400">
                      + R$ {(isSupplier ? item.totalAmount : item.laborCost)?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </td>
                  </motion.tr>
                ))
              ) : (
                <motion.tr
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <td colSpan={4} className="px-8 py-24 text-center">
                    <div className="flex flex-col items-center justify-center space-y-4">
                      <div className="p-6 bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 rounded-full group">
                        <Ghost className="h-12 w-12 text-emerald-300 dark:text-emerald-600 group-hover:animate-bounce-subtle transition-all" />
                      </div>
                      <h3 className="text-xl font-black text-gray-900 dark:text-white tracking-tight">Nenhuma conta a receber</h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400 max-w-sm mx-auto">
                        Que tal criar uma nova {isSupplier ? 'venda' : 'ordem de serviço'} para movimentar o seu negócio?
                      </p>
                    </div>
                  </td>
                </motion.tr>
              )}
            </AnimatePresence>
          </tbody>
        </table>
      </div>

      {/* Mobile List */}
      <div className="md:hidden space-y-4">
        <AnimatePresence mode="popLayout">
          {filteredItems.length > 0 ? (
            filteredItems.map((item) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="bg-white dark:bg-gray-800 p-4 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm space-y-3"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-bold text-gray-900 dark:text-white">#{item.id.substring(0, 8)}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{isSupplier ? item.shopName : item.customerName}</p>
                  </div>
                  <span className="inline-flex items-center rounded-lg bg-emerald-100 dark:bg-emerald-900/30 px-2.5 py-1 text-xs font-medium text-emerald-800 dark:text-emerald-400">
                    {isSupplier ? 'Venda' : 'Serviço'}
                  </span>
                </div>
                <div className="flex justify-between items-center pt-2 border-t border-gray-100 dark:border-gray-700">
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {formatDateSafe(item.createdAt)}
                  </p>
                  <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
                    + R$ {(isSupplier ? item.totalAmount : item.laborCost)?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </p>
                </div>
              </motion.div>
            ))
          ) : (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-center py-12"
            >
               <Ghost className="h-10 w-10 text-emerald-300 mx-auto mb-4" />
               <h3 className="text-sm font-bold text-gray-900 dark:text-white">Nada por aqui.</h3>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
