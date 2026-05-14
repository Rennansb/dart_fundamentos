import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, query, where, onSnapshot, addDoc, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '../AuthContext';
import { format } from 'date-fns';
import { formatDateSafe } from '../utils/dateUtils';
import { Plus, X, TrendingDown, Calendar, Tag, DollarSign, Search, Filter, MoreVertical, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { handleFirestoreError, OperationType } from '../utils/firestoreErrors';

export default function Payables() {
  const { profile, user, selectedCompanyId } = useAuth();
  const [expenses, setExpenses] = useState<any[]>([]);
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [newExpense, setNewExpense] = useState({
    description: '',
    amount: '',
    category: 'Peças',
    date: new Date().toISOString().split('T')[0]
  });

  useEffect(() => {
    if (!user || !profile) return;
    const isSupplier = profile.role === 'fornecedor';
    const companyId = isSupplier ? profile.uid : (selectedCompanyId || profile?.companyId);
    
    if (!companyId) return;

    const qExpenses = query(
      collection(db, 'expenses'), 
      where('companyId', '==', companyId)
    );
    
    const unsubscribeExpenses = onSnapshot(qExpenses, (snapshot) => {
      setExpenses(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'expenses');
    });

    return () => unsubscribeExpenses();
  }, [profile, user, selectedCompanyId]);

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !profile) return;
    const isSupplier = profile.role === 'fornecedor';
    const companyId = isSupplier ? profile.uid : (selectedCompanyId || profile?.companyId);
    
    if (!companyId) return;

    try {
      await addDoc(collection(db, 'expenses'), {
        ...newExpense,
        companyId: companyId,
        amount: parseFloat(newExpense.amount.toString()),
        createdAt: serverTimestamp()
      });
      setIsExpenseModalOpen(false);
      setNewExpense({ 
        description: '', 
        amount: '', 
        category: 'Peças', 
        date: new Date().toISOString().split('T')[0] 
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'expenses');
    }
  };

  const filteredExpenses = expenses.filter(exp => 
    exp.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
    exp.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalPayable = expenses.reduce((acc, curr) => acc + (curr.amount || 0), 0);

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white sm:text-3xl tracking-tight">
            Contas a Pagar
          </h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Gerencie suas despesas e pagamentos pendentes.
          </p>
        </div>
        <button
          onClick={() => setIsExpenseModalOpen(true)}
          className="inline-flex items-center justify-center rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-red-500 transition-all active:scale-95 gap-2"
        >
          <Plus className="h-5 w-5" />
          Nova Despesa
        </button>
      </div>

      {/* Summary Card */}
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.1 }}
        className="bg-gradient-to-br from-red-500 to-red-700 p-8 rounded-[2.5rem] shadow-xl shadow-red-200 dark:shadow-none text-white relative overflow-hidden group"
      >
        <div className="absolute top-0 right-0 p-12 -mr-12 -mt-12 bg-white/10 rounded-full blur-3xl group-hover:bg-white/20 transition-all"></div>
        <div className="relative z-10 flex items-center gap-6">
          <div className="p-4 bg-white/20 rounded-2xl backdrop-blur-md">
            <TrendingDown className="h-8 w-8 text-white" />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-red-100">Total a Pagar</p>
            <p className="text-4xl font-black tracking-tighter mt-1">
              R$ {totalPayable.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </p>
          </div>
        </div>
      </motion.div>

      {/* Filters and Search */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1 group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 group-focus-within:text-red-500 transition-colors" />
          <input
            type="text"
            placeholder="Buscar despesas por descrição ou categoria..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-4 py-4 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-[1.5rem] shadow-sm focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition-all outline-none text-sm font-bold text-gray-900 dark:text-white"
          />
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
              {filteredExpenses.map((exp) => (
                <motion.tr 
                  key={exp.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                >
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                    {formatDateSafe(exp.date)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                    {exp.description}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="inline-flex items-center rounded-lg bg-red-100 dark:bg-red-900/30 px-2.5 py-1 text-xs font-medium text-red-800 dark:text-red-400">
                      {exp.category}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-bold text-red-600 dark:text-red-400">
                    R$ {exp.amount?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </td>
                </motion.tr>
              ))}
            </AnimatePresence>
          </tbody>
        </table>
      </div>

      {/* Mobile List */}
      <div className="md:hidden space-y-4">
        <AnimatePresence mode="popLayout">
          {filteredExpenses.map((exp) => (
            <motion.div
              key={exp.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="bg-white dark:bg-gray-800 p-4 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm space-y-3"
            >
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-bold text-gray-900 dark:text-white">{exp.description}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{formatDateSafe(exp.date)}</p>
                </div>
                <span className="inline-flex items-center rounded-lg bg-red-100 dark:bg-red-900/30 px-2.5 py-1 text-xs font-medium text-red-800 dark:text-red-400">
                  {exp.category}
                </span>
              </div>
              <div className="flex justify-between items-center pt-2 border-t border-gray-100 dark:border-gray-700">
                <p className="text-lg font-bold text-red-600 dark:text-red-400">
                  R$ {exp.amount?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Add Expense Modal */}
      <AnimatePresence>
        {isExpenseModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white dark:bg-gray-800 rounded-3xl shadow-xl w-full max-w-md overflow-hidden"
            >
              <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">Nova Despesa</h3>
                <button onClick={() => setIsExpenseModalOpen(false)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors">
                  <X className="h-5 w-5 text-gray-500" />
                </button>
              </div>

              <form onSubmit={handleAddExpense} className="p-6 space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Descrição</label>
                  <input
                    required
                    type="text"
                    value={newExpense.description}
                    onChange={(e) => setNewExpense({ ...newExpense, description: e.target.value })}
                    className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-red-500 outline-none transition-all"
                    placeholder="Ex: Aluguel, Luz, Peças..."
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Valor (R$)</label>
                    <input
                      required
                      type="number"
                      step="0.01"
                      value={newExpense.amount}
                      onChange={(e) => setNewExpense({ ...newExpense, amount: e.target.value })}
                      className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-red-500 outline-none transition-all"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Data</label>
                    <input
                      required
                      type="date"
                      value={newExpense.date}
                      onChange={(e) => setNewExpense({ ...newExpense, date: e.target.value })}
                      className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-red-500 outline-none transition-all"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Categoria</label>
                  <select
                    value={newExpense.category}
                    onChange={(e) => setNewExpense({ ...newExpense, category: e.target.value })}
                    className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-red-500 outline-none transition-all"
                  >
                    <option value="Peças">Peças</option>
                    <option value="Aluguel">Aluguel</option>
                    <option value="Luz">Luz</option>
                    <option value="Água">Água</option>
                    <option value="Internet">Internet</option>
                    <option value="Salários">Salários</option>
                    <option value="Marketing">Marketing</option>
                    <option value="Outros">Outros</option>
                  </select>
                </div>

                <div className="pt-4 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setIsExpenseModalOpen(false)}
                    className="flex-1 px-4 py-2.5 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 font-semibold rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-all"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2.5 bg-red-600 text-white font-semibold rounded-xl hover:bg-red-500 shadow-sm transition-all active:scale-95"
                  >
                    Salvar
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
