import React, { useState, useEffect } from 'react';
import { useAuth } from '../AuthContext';
import { Plus, Trash2, Edit2, RotateCcw, X, User, Key, Mail, Phone, Calendar, CreditCard, Shield, ShoppingBag, Crown } from 'lucide-react';
import ProfileModal from '../components/ProfileModal';
import { db, secondaryAuth } from '../firebase';
import { collection, query, where, onSnapshot, doc, setDoc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { motion, AnimatePresence } from 'framer-motion';

interface Employee {
  id: string;
  name: string;
  email: string;
  role: string;
  cpfCnpj?: string;
  birthDate: string;
  phone: string;
  photoURL?: string;
  stats?: {
    count: number;
    volume: number;
    revenue: number;
  };
}

export default function Employees() {
  const { profile, user, selectedCompanyId } = useAuth();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [employeeStats, setEmployeeStats] = useState<Record<string, any>>({});
  
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [cpf, setCpf] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState('employee');

  const [loading, setLoading] = useState(false);
  const [confirmAction, setConfirmAction] = useState<{ type: 'delete' | 'reset', id: string } | null>(null);

  useEffect(() => {
    if (!user) return;
    const companyId = profile?.role === 'fornecedor' ? profile.id : (selectedCompanyId || profile?.companyId);
    if (!companyId) return;

    const q = query(
      collection(db, 'users'),
      where('companyId', '==', companyId)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Employee[];
      setEmployees(data);
    }, (error) => {
      console.error("Error fetching employees:", error);
    });

    return () => unsubscribe();
  }, [profile, selectedCompanyId]);

  // Performance Aggregation Logic
  useEffect(() => {
    if (!user || !profile || employees.length === 0) return;
    const companyId = profile?.role === 'fornecedor' ? profile.id : (selectedCompanyId || profile?.companyId);
    if (!companyId) return;

    const collectionName = profile.role === 'fornecedor' ? 'purchase_orders' : 'work_orders';
    const fieldName = profile.role === 'fornecedor' ? 'supplierId' : 'companyId';
    const attributionField = profile.role === 'fornecedor' ? 'processedBy' : 'employeeId';

    const q = query(
      collection(db, collectionName),
      where(fieldName, '==', companyId)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const stats: Record<string, any> = {};
      
      snapshot.docs.forEach(doc => {
        const data = doc.data();
        const empId = data[attributionField];
        if (!empId) return;

        if (!stats[empId]) {
          stats[empId] = { count: 0, volume: 0, revenue: 0 };
        }

        // Shop logic
        if (profile.role !== 'fornecedor') {
          // Count only completed/delivered for "vehicles repaired"
          if (data.status === 'completed' || data.status === 'delivered') {
            stats[empId].count += 1;
            stats[empId].revenue += (data.totalCost || 0);
            // Parts sold calculation
            const items = data.items || data.parts || [];
            stats[empId].volume += items.reduce((acc: number, item: any) => acc + (item.quantity || 1), 0);
          }
        } 
        // Supplier logic
        else {
          stats[empId].count += 1;
          stats[empId].revenue += (data.total || 0);
          const items = data.items || [];
          stats[empId].volume += items.reduce((acc: number, item: any) => acc + (item.quantity || 1), 0);
        }
      });

      setEmployeeStats(stats);
    });

    return () => unsubscribe();
  }, [employees, profile, selectedCompanyId]);

  const handleOpenModal = (employee?: Employee) => {
    if (employee) {
      setIsEditing(true);
      setSelectedEmployee(employee);
      setName(employee.name || '');
      setEmail(employee.email || '');
      setCpf(employee.cpfCnpj || '');
      setBirthDate(employee.birthDate || '');
      setPhone(employee.phone || '');
      setRole(employee.role || 'employee');
    } else {
      setIsEditing(false);
      setSelectedEmployee(null);
      setName('');
      setEmail('');
      setPassword('');
      setCpf('');
      setBirthDate('');
      setPhone('');
      setRole('employee');
    }
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.companyId) return;
    setLoading(true);
    
    try {
      if (isEditing && selectedEmployee) {
        await updateDoc(doc(db, 'users', selectedEmployee.id), {
          name, email, cpfCnpj: cpf, birthDate, phone, role
        });
        setIsModalOpen(false);
      } else {
        // Create user in Firebase Auth using secondary app
        const userCredential = await createUserWithEmailAndPassword(secondaryAuth, email, password);
        const newUser = userCredential.user;

        // Save user data to Firestore
        const companyId = profile?.role === 'fornecedor' ? profile.id : (selectedCompanyId || profile?.companyId);
        await setDoc(doc(db, 'users', newUser.uid), {
          uid: newUser.uid,
          name,
          email,
          role,
          companyId: companyId,
          companyName: profile.companyName || profile.name,
          cpfCnpj: cpf,
          birthDate,
          phone,
          createdAt: serverTimestamp()
        });
        
        // Sign out the secondary auth so it doesn't interfere
        await secondaryAuth.signOut();
        setIsModalOpen(false);
      }
    } catch (error: any) {
      console.error("Error saving employee:", error);
      alert("Erro ao salvar funcionário: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir este funcionário?")) return;
    try {
      await deleteDoc(doc(db, 'users', id));
    } catch (error) {
      console.error("Error deleting employee:", error);
    }
  };

  const handleResetPassword = async (id: string) => {
    alert("Para resetar a senha, o funcionário deve usar a opção 'Esqueci minha senha' na tela de login.");
  };

  const openProfile = (employee: Employee) => {
    setSelectedEmployee(employee);
    setIsProfileModalOpen(true);
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-4 md:p-8 max-w-7xl mx-auto"
    >
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-xl">
              <User className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            </div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white tracking-tight">Gerenciar Funcionários</h1>
          </div>
          <p className="text-gray-500 dark:text-gray-400">Administre sua equipe e permissões de acesso</p>
        </div>
        
        {(profile?.role === 'admin' || profile?.role === 'shop' || profile?.role === 'fornecedor') && (
          <div className="relative group/btn">
            {profile?.plan !== 'elite' && profile?.role !== 'admin' && profile?.role !== 'fornecedor' && (
              <div className="absolute -top-12 left-1/2 -translate-x-1/2 px-3 py-1.5 bg-amber-600 text-white text-[10px] font-black uppercase tracking-widest rounded-lg opacity-0 group-hover/btn:opacity-100 transition-all whitespace-nowrap pointer-events-none z-10 shadow-xl">
                Gestão de Equipe: Exclusivo Elite
              </div>
            )}
            <button
              onClick={() => {
                if (profile?.plan !== 'elite' && profile?.role !== 'admin' && profile?.role !== 'fornecedor') {
                  window.location.href = '/app/subscription';
                  return;
                }
                handleOpenModal();
              }}
              className={`inline-flex items-center justify-center px-6 py-3.5 ${
                profile?.plan !== 'elite' && profile?.role !== 'admin' && profile?.role !== 'fornecedor'
                  ? 'bg-amber-600 hover:bg-amber-700' 
                  : 'bg-blue-600 hover:bg-blue-700'
              } text-white rounded-2xl font-bold transition-all duration-200 shadow-lg shadow-blue-500/20 active:scale-95`}
            >
              {profile?.plan !== 'elite' && profile?.role !== 'admin' && profile?.role !== 'fornecedor' ? <Crown className="w-5 h-5 mr-2" /> : <Plus className="w-5 h-5 mr-2" />}
              Novo Funcionário
            </button>
          </div>
        )}
      </div>

      {/* Employees List */}
      <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
        {/* Desktop Table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50/50 dark:bg-gray-900/50 border-b border-gray-100 dark:border-gray-700">
                <th className="px-8 py-5 text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-[0.2em]">Funcionário</th>
                <th className="px-8 py-5 text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-[0.2em]">Email</th>
                <th className="px-8 py-5 text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-[0.2em]">Cargo/Nivel</th>
                <th className="px-8 py-5 text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-[0.2em]">Performance Real-time</th>
                <th className="px-8 py-5 text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-[0.2em] text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              <AnimatePresence mode="popLayout">
                {employees.map((emp) => (
                  <motion.tr 
                    key={emp.id}
                    layout
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="hover:bg-gray-50/50 dark:hover:bg-gray-900/30 transition-colors group"
                  >
                    <td className="px-8 py-5">
                      <div className="flex items-center gap-4 cursor-pointer" onClick={() => openProfile(emp)}>
                        <div className="w-12 h-12 rounded-full bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center text-blue-600 dark:text-blue-400 overflow-hidden border-2 border-white dark:border-gray-800 shadow-sm">
                          {emp.photoURL ? (
                            <img src={emp.photoURL} alt={emp.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                          ) : (
                            <User className="w-6 h-6" />
                          )}
                        </div>
                        <div>
                          <div className="font-bold text-gray-900 dark:text-white text-lg">{emp.name}</div>
                          <div className="text-xs font-medium text-gray-400 dark:text-gray-500">
                            {emp.phone || 'Sem telefone'}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-5 text-sm font-medium text-gray-500 dark:text-gray-400">
                      {emp.email}
                    </td>
                    <td className="px-8 py-5">
                      <span className={`inline-flex items-center px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-widest ${
                        emp.role === 'admin' || emp.role === 'shop' || emp.role === 'fornecedor'
                          ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400'
                          : emp.role === 'manager'
                          ? 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400'
                          : 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'
                      }`}>
                        {emp.role === 'admin' ? 'Administrador' : emp.role === 'shop' || emp.role === 'fornecedor' ? 'Dono' : emp.role === 'manager' ? 'Supervisor' : 'Funcionário'}
                      </span>
                    </td>
                    <td className="px-8 py-5">
                      <div className="flex gap-4">
                        <div className="bg-white/5 border border-white/5 rounded-2xl p-3 flex flex-col min-w-[100px]">
                          <span className="text-[9px] font-black text-gray-500 uppercase tracking-widest mb-1">
                            {profile?.role === 'fornecedor' ? 'Vendas' : 'Reparos'}
                          </span>
                          <span className="text-sm font-black text-indigo-400 tabular-nums">
                            {employeeStats[emp.id]?.count || 0}
                          </span>
                        </div>
                        <div className="bg-white/5 border border-white/5 rounded-2xl p-3 flex flex-col min-w-[100px]">
                          <span className="text-[9px] font-black text-gray-500 uppercase tracking-widest mb-1">
                            {profile?.role === 'fornecedor' ? 'Volume' : 'Itens'}
                          </span>
                          <span className="text-sm font-black text-white tabular-nums">
                            {employeeStats[emp.id]?.volume || 0}
                          </span>
                        </div>
                        <div className="bg-white/5 border border-white/5 rounded-2xl p-3 flex flex-col min-w-[120px]">
                          <span className="text-[9px] font-black text-gray-500 uppercase tracking-widest mb-1">Faturamento</span>
                          <span className="text-sm font-black text-emerald-400 tabular-nums">
                            R$ {(employeeStats[emp.id]?.revenue || 0).toLocaleString()}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-5 text-right">
                      {(profile?.role === 'admin' || profile?.role === 'shop' || profile?.role === 'fornecedor') && (
                        <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-all">
                          <button
                            onClick={() => handleOpenModal(emp)}
                            className="p-3 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-xl transition-colors"
                            title="Editar"
                          >
                            <Edit2 className="w-5 h-5" />
                          </button>
                          <button
                            onClick={() => handleResetPassword(emp.id)}
                            className="p-3 text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/30 rounded-xl transition-colors"
                            title="Resetar Senha"
                          >
                            <Key className="w-5 h-5" />
                          </button>
                          <button
                            onClick={() => handleDelete(emp.id)}
                            className="p-3 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-xl transition-colors"
                            title="Excluir"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        </div>
                      )}
                    </td>
                  </motion.tr>
                ))}
              </AnimatePresence>
            </tbody>
          </table>
        </div>

        {/* Mobile List */}
        <div className="md:hidden divide-y divide-gray-100 dark:divide-gray-700">
          <AnimatePresence mode="popLayout">
            {employees.length > 0 ? employees.map((emp) => (
              <motion.div 
                key={emp.id}
                layout
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="p-6 active:bg-gray-50 dark:active:bg-gray-900/50 transition-colors"
              >
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-4 cursor-pointer" onClick={() => openProfile(emp)}>
                    <div className="w-14 h-14 rounded-full bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center text-blue-600 dark:text-blue-400 overflow-hidden border-2 border-white dark:border-gray-800 shadow-sm">
                      {emp.photoURL ? (
                        <img src={emp.photoURL} alt={emp.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      ) : (
                        <User className="w-7 h-7" />
                      )}
                    </div>
                    <div>
                      <div className="font-bold text-gray-900 dark:text-white text-lg">{emp.name}</div>
                      <div className="text-xs font-medium text-gray-400 dark:text-gray-500">{emp.email}</div>
                      <div className="mt-4 flex flex-wrap gap-2">
                        <span className="px-3 py-1 bg-indigo-500/10 text-indigo-400 rounded-lg text-[9px] font-black uppercase tracking-widest border border-indigo-500/20">
                          {employeeStats[emp.id]?.count || 0} {profile?.role === 'fornecedor' ? 'Vendas' : 'Reparos'}
                        </span>
                        <span className="px-3 py-1 bg-emerald-500/10 text-emerald-400 rounded-lg text-[9px] font-black uppercase tracking-widest border border-emerald-500/20">
                          R$ {(employeeStats[emp.id]?.revenue || 0).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>
                  <span className={`inline-flex items-center px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                    emp.role === 'admin' || emp.role === 'shop' || emp.role === 'fornecedor'
                      ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400'
                      : emp.role === 'manager'
                      ? 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400'
                      : 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'
                  }`}>
                    {emp.role === 'admin' ? 'Admin' : emp.role === 'shop' || emp.role === 'fornecedor' ? 'Dono' : emp.role === 'manager' ? 'Superv.' : 'Func.'}
                  </span>
                </div>
                
                {(profile?.role === 'admin' || profile?.role === 'shop' || profile?.role === 'fornecedor') && (
                  <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-50 dark:border-gray-700/50">
                    <button
                      onClick={() => handleOpenModal(emp)}
                      className="flex-1 inline-flex items-center justify-center px-4 py-2.5 text-sm font-bold text-blue-600 bg-blue-50 dark:bg-blue-900/20 rounded-2xl transition-colors"
                    >
                      <Edit2 className="w-4 h-4 mr-2" />
                      Editar
                    </button>
                    <button
                      onClick={() => handleResetPassword(emp.id)}
                      className="p-2.5 text-amber-600 bg-amber-50 dark:bg-amber-900/20 rounded-2xl transition-colors"
                    >
                      <Key className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => handleDelete(emp.id)}
                      className="p-2.5 text-red-600 bg-red-50 dark:bg-red-900/20 rounded-2xl transition-colors"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                )}
              </motion.div>
            )) : (
              <div className="p-12 text-center">
                <div className="w-20 h-20 bg-gray-50 dark:bg-gray-900 rounded-full flex items-center justify-center mx-auto mb-6">
                  <User className="w-10 h-10 text-gray-300" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">Nenhum funcionário encontrado</h3>
                <p className="text-gray-500 dark:text-gray-400 mt-2">Sua equipe aparecerá aqui.</p>
              </div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Add/Edit Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-md"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative bg-white dark:bg-gray-800 rounded-[2.5rem] shadow-2xl w-full max-w-2xl overflow-hidden"
            >
              <div className="flex justify-between items-center p-8 border-b border-gray-100 dark:border-gray-700">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-xl">
                    <User className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                  </div>
                  <h3 className="text-2xl font-bold text-gray-900 dark:text-white">
                    {isEditing ? 'Editar Funcionário' : 'Novo Funcionário'}
                  </h3>
                </div>
                <button 
                  onClick={() => setIsModalOpen(false)}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
                >
                  <X className="h-6 w-6 text-gray-400" />
                </button>
              </div>

              <form onSubmit={handleSave} className="p-8 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 ml-1">Nome Completo</label>
                      <div className="relative">
                        <User className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                        <input
                          type="text"
                          required
                          value={name}
                          onChange={e => setName(e.target.value)}
                          className="w-full pl-12 pr-4 py-4 bg-gray-50 dark:bg-gray-900 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 dark:text-white transition-all outline-none"
                          placeholder="Nome do funcionário"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 ml-1">Email Profissional</label>
                      <div className="relative">
                        <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                        <input
                          type="email"
                          required
                          value={email}
                          onChange={e => setEmail(e.target.value)}
                          className="w-full pl-12 pr-4 py-4 bg-gray-50 dark:bg-gray-900 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 dark:text-white transition-all outline-none"
                          placeholder="email@exemplo.com"
                        />
                      </div>
                    </div>

                    {!isEditing && (
                      <div>
                        <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 ml-1">Senha Inicial</label>
                        <div className="relative">
                          <Key className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                          <input
                            type="password"
                            required
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                            className="w-full pl-12 pr-4 py-4 bg-gray-50 dark:bg-gray-900 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 dark:text-white transition-all outline-none"
                            placeholder="Mínimo 6 caracteres"
                          />
                        </div>
                      </div>
                    )}

                    <div>
                      <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 ml-1">Cargo / Permissão</label>
                      <div className="relative">
                        <Shield className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                        <select
                          value={role}
                          onChange={e => setRole(e.target.value)}
                          className="w-full pl-12 pr-4 py-4 bg-gray-50 dark:bg-gray-900 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 dark:text-white transition-all outline-none appearance-none"
                        >
                          <option value="employee">Funcionário Padrão (Sem Finanças)</option>
                          <option value="manager">Supervisor / Gerente (Hoje Apenas)</option>
                          {profile?.role === 'admin' && <option value="admin">Administrador do Sistema</option>}
                        </select>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 ml-1">CPF / CNPJ</label>
                      <div className="relative">
                        <CreditCard className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                        <input
                          type="text"
                          value={cpf}
                          onChange={e => setCpf(e.target.value)}
                          className="w-full pl-12 pr-4 py-4 bg-gray-50 dark:bg-gray-900 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 dark:text-white transition-all outline-none"
                          placeholder="000.000.000-00"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 ml-1">Data de Nascimento</label>
                      <div className="relative">
                        <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                        <input
                          type="date"
                          value={birthDate}
                          onChange={e => setBirthDate(e.target.value)}
                          className="w-full pl-12 pr-4 py-4 bg-gray-50 dark:bg-gray-900 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 dark:text-white transition-all outline-none"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 ml-1">Telefone / WhatsApp</label>
                      <div className="relative">
                        <Phone className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                        <input
                          type="tel"
                          value={phone}
                          onChange={e => setPhone(e.target.value)}
                          className="w-full pl-12 pr-4 py-4 bg-gray-50 dark:bg-gray-900 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 dark:text-white transition-all outline-none"
                          placeholder="(00) 00000-0000"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end gap-4 pt-6">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-8 py-4 text-sm font-bold text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="px-10 py-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-2xl shadow-lg shadow-blue-500/20 transition-all active:scale-95 disabled:opacity-50 disabled:scale-100"
                  >
                    {loading ? 'Salvando...' : isEditing ? 'Salvar Alterações' : 'Cadastrar Funcionário'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Profile Modal */}
      <AnimatePresence>
        {isProfileModalOpen && selectedEmployee && (
          <ProfileModal
            isOpen={isProfileModalOpen}
            onClose={() => setIsProfileModalOpen(false)}
            profile={selectedEmployee}
            readOnly={true}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}
