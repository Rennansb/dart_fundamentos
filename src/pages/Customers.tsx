import { useState, useEffect } from 'react';
import { Plus, Search, X, Copy, Loader2, Download, Trash2, User, Mail, Phone, MapPin, Hash, Calendar, MessageSquare, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { db } from '../firebase';
import { collection, query, where, getDocs, addDoc, serverTimestamp, onSnapshot, orderBy, deleteDoc, doc, limit } from 'firebase/firestore';
import { useAuth } from '../AuthContext';
import { handleFirestoreError, OperationType } from '../utils/firestoreErrors';
import { checkPlanLimit, PLAN_LIMITS } from '../utils/planLimits';
import PlanLimitModal from '../components/PlanLimitModal';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { externalApi } from '../services/externalApiService';
export default function Customers() {
  const { profile, effectiveProfile, user, selectedCompanyId } = useAuth();
  const [customers, setCustomers] = useState<any[]>([]);
  const [quotes, setQuotes] = useState<any[]>([]);
  const [shops, setShops] = useState<any[]>([]);
  const [selectedShopId, setSelectedShopId] = useState<string>('');
  const [employees, setEmployees] = useState<any[]>([]);
  const [filterEmployeeId, setFilterEmployeeId] = useState<string>('');
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isFetchingCpf, setIsFetchingCpf] = useState(false);
  const [isFetchingCep, setIsFetchingCep] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showLimitModal, setShowLimitModal] = useState(false);
  const [newCustomer, setNewCustomer] = useState({
    name: '',
    cpf: '',
    cep: '',
    birthDate: '',
    phone: '',
    email: '',
    address: ''
  });

  useEffect(() => {
    if (!user) return;
    if (profile?.role === 'admin' && !selectedCompanyId) {
      const fetchShops = async () => {
        try {
          const shopsSnapshot = await getDocs(query(collection(db, 'users'), where('role', '==', 'shop'), limit(20)));
          const shopsList = shopsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          setShops(shopsList);
        } catch (error) {
          handleFirestoreError(error, OperationType.LIST, 'users (shops)', 'global');
        }
      };
      fetchShops();
    }
  }, [profile?.role]);

  useEffect(() => {
    if (!user) return;
    const companyId = selectedCompanyId || selectedShopId || profile?.companyId;
    if (!companyId) {
      setEmployees([]);
      return;
    }

    const fetchEmployees = async () => {
      try {
        const employeesSnapshot = await getDocs(query(collection(db, 'users'), where('companyId', '==', companyId), where('role', '==', 'employee'), limit(50)));
        const employeesList = employeesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setEmployees(employeesList);
      } catch (error) {
        handleFirestoreError(error, OperationType.LIST, 'users (employees)', companyId);
      }
    };
    fetchEmployees();
  }, [profile?.companyId, profile?.id, selectedShopId]);

  useEffect(() => {
    if (!user) return;
    const companyId = selectedCompanyId || profile?.companyId;
    if (!companyId) return;

    const unsubscribe = onSnapshot(query(collection(db, 'customers'), where('companyId', '==', companyId)), (snapshot) => {
      const data = snapshot.docs.map(doc => {
        const d = doc.data();
        return {
          id: doc.id,
          ...d,
          createdAt: d.createdAt?.toDate?.() || (d.createdAt ? new Date(d.createdAt) : new Date())
        };
      });
      setCustomers(data.sort((a, b) => {
        const tA = (a.createdAt instanceof Date) ? a.createdAt.getTime() : 0;
        const tB = (b.createdAt instanceof Date) ? b.createdAt.getTime() : 0;
        return tB - tA;
      }));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'customers', companyId);
    });

    // V10: SWITCHED TO 'quotes' TO MATCH firestore.rules AUTHORIZATION
    const unsubscribeQuotes = onSnapshot(query(collection(db, 'quotes'), where('companyId', '==', companyId)), (snapshot) => {
      const data = snapshot.docs.map(doc => {
        const d = doc.data();
        return {
          id: doc.id,
          ...d,
          createdAt: d.createdAt?.toDate?.() || (d.createdAt ? new Date(d.createdAt) : new Date())
        };
      });
      setQuotes(data.sort((a, b) => {
        const tA = (a.createdAt instanceof Date) ? a.createdAt.getTime() : 0;
        const tB = (b.createdAt instanceof Date) ? b.createdAt.getTime() : 0;
        return tB - tA;
      }));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'quotes', companyId);
    });

    return () => {
      unsubscribe();
      unsubscribeQuotes();
    };
  }, [user, profile, selectedCompanyId]);

  const handleCpfChange = async (cpf: string) => {
    const value = cpf.replace(/\D/g, '').slice(0, 14);
    let masked = value;
    if (value.length <= 11) {
      masked = value
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d{1,2})/, '$1-$2');
    } else {
      masked = value
        .replace(/(\d{2})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d)/, '$1/$2')
        .replace(/(\d{4})(\d{1,2})/, '$1-$2');
    }
    
    setNewCustomer(prev => ({ ...prev, cpf: masked }));

    if (value.length === 14) {
      setIsFetchingCpf(true);
      try {
        const data = await externalApi.getCnpj(value);
        setNewCustomer(prev => ({
          ...prev,
          name: data.razao_social || data.nome_fantasia || prev.name,
          phone: data.ddd_telefone_1 || prev.phone,
          email: data.email || prev.email,
          cep: data.cep || prev.cep,
          address: `${data.logradouro}, ${data.numero} - ${data.bairro}, ${data.municipio} - ${data.uf}`
        }));
      } catch (error) {
        console.error("CNPJ fetch error:", error);
      } finally {
        setIsFetchingCpf(false);
      }
    }
  };

  const handleCepChange = async (cep: string) => {
    const value = cep.replace(/\D/g, '').slice(0, 8);
    const masked = value.length > 5 ? value.replace(/(\d{5})(\d)/, '$1-$2') : value;
    setNewCustomer(prev => ({ ...prev, cep: masked }));
    
    if (value.length === 8) {
      setIsFetchingCep(true);
      try {
        const data = await externalApi.getCep(value);
        setNewCustomer(prev => ({
          ...prev,
          address: `${data.street}, bairro ${data.neighborhood}, ${data.city} - ${data.state}`
        }));
      } catch (error) {
        console.error("CEP fetch error:", error);
      } finally {
        setIsFetchingCep(false);
      }
    }
  };

  const handleAddCustomer = async () => {
    const companyId = selectedCompanyId || profile?.companyId || profile?.id;
    if (!companyId) return;
    
    // Check plan limit
    const limitCheck = await checkPlanLimit(companyId, profile.plan, 'customers', profile?.role);
    if (!limitCheck.allowed) {
      setShowLimitModal(true);
      return;
    }

    if (!newCustomer.name || !newCustomer.cpf) {
      alert('Por favor, preencha o CPF e o Nome.');
      return;
    }

    setIsSaving(true);
    const customerCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    try {
      await addDoc(collection(db, 'customers'), {
        ...newCustomer,
        companyId: companyId,
        code: customerCode,
        createdAt: serverTimestamp()
      });

      setIsModalOpen(false);
      setNewCustomer({ name: '', cpf: '', cep: '', birthDate: '', phone: '', email: '', address: '' });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'customers');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'customers', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `customers/${id}`);
    }
  };

  const copyToClipboard = (code: string) => {
    navigator.clipboard.writeText(code);
    alert('Código copiado: ' + code);
  };

  const generatePDF = (quoteData: any, customerData: any) => {
    const canGeneratePDF = PLAN_LIMITS[profile?.plan || 'free'].pdf;
    if (!canGeneratePDF) {
      alert("A geração de PDF está disponível nos planos Oficina Pro e Oficina Elite. Faça um upgrade para liberar esta função.");
      return;
    }

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    
    // Identidade Profissional - Lógica de Fallback
    const hasRazao = profile?.companyName && profile?.companyName !== profile?.tradeName;
    const businessMainName = hasRazao ? profile.companyName : (profile?.fullName || profile?.name || 'Service Hub Pro');
    const businessSubName = profile?.tradeName && profile?.tradeName !== businessMainName ? profile.tradeName : '';
    const businessDoc = profile?.cnpj ? `CNPJ: ${profile.cnpj}` : (profile?.ownerCpf ? `CPF: ${profile.ownerCpf}` : (profile?.cpfCnpj ? `DOC: ${profile.cpfCnpj}` : ''));
    const businessAddress = profile?.address ? `${profile.address.street}, ${profile.address.number} - ${profile.address.city}/${profile.address.state}` : '';
    const businessContact = profile?.phone ? `Tel: ${profile.phone}` : (profile?.email ? `Email: ${profile.email}` : '');

    // Cabeçalho Executivo
    doc.setFillColor(15, 23, 42); // Slate-900
    doc.rect(0, 0, pageWidth, 50, 'F');
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.setFont('helvetica', 'bold');
    doc.text('ORÇAMENTO / DAV', 14, 22);
    
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(148, 163, 184); // Slate-400
    doc.text(`TIPO: DOCUMENTO AUXILIAR DE VENDA`, 14, 32);
    doc.text(`GERADO EM: ${new Date().toLocaleDateString('pt-BR')} ${new Date().toLocaleTimeString('pt-BR')}`, 14, 38);

    // Dados da Empresa (Lado Direito)
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text(businessMainName.toUpperCase(), pageWidth - 14, 22, { align: 'right' });
    
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    if (businessSubName) doc.text(businessSubName, pageWidth - 14, 28, { align: 'right' });
    doc.text(businessDoc, pageWidth - 14, 33, { align: 'right' });
    
    doc.setFontSize(8);
    doc.setTextColor(203, 213, 225); // Slate-300
    if (businessAddress) doc.text(businessAddress, pageWidth - 14, 39, { align: 'right' });
    if (businessContact) doc.text(businessContact, pageWidth - 14, 44, { align: 'right' });

    // Destinatário Info
    doc.setFillColor(248, 250, 252);
    doc.rect(14, 60, pageWidth - 28, 30, 'F');
    doc.setDrawColor(226, 232, 240);
    doc.rect(14, 60, pageWidth - 28, 30, 'D');

    doc.setTextColor(71, 85, 105);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text('DADOS DO CLIENTE', 20, 68);
    
    doc.setTextColor(15, 23, 42);
    doc.setFontSize(10);
    doc.text(customerData?.name || quoteData.customerName || 'Não informado', 20, 75);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(`${customerData?.cpf ? 'CPF: ' + customerData.cpf : ''} | ${customerData?.phone ? 'Tel: ' + customerData.phone : ''}`, 20, 82);

    // Items Table
    const partsList = quoteData.parts || [];
    const labor = quoteData.laborPrice || 0;
    const tableData = [
      ...partsList.map((p: any) => [p.name, 'PEÇA', '1', `R$ ${p.price.toFixed(2)}`, `R$ ${p.price.toFixed(2)}`]),
      ...(labor > 0 ? [['MÃO DE OBRA', 'SERVIÇO', '1', `R$ ${labor.toFixed(2)}`, `R$ ${labor.toFixed(2)}`]] : [])
    ];

    autoTable(doc, {
      startY: 100,
      head: [['DESCRIÇÃO DO ITEM', 'TIPO', 'QTD', 'VALOR UNIT', 'VALOR TOTAL']],
      body: tableData,
      theme: 'striped',
      headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: 'bold' },
      columnStyles: {
        3: { halign: 'right' },
        4: { halign: 'right' }
      }
    });

    const finalY = (doc as any).lastAutoTable.finalY || 100;
    
    // Totals
    doc.setFillColor(15, 23, 42);
    doc.rect(pageWidth - 70, finalY + 10, 56, 20, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(15);
    doc.setFont('helvetica', 'bold');
    doc.text(`TOTAL: R$ ${(quoteData.total || 0).toFixed(2)}`, pageWidth - 65, finalY + 23);

    doc.save(`Orcamento_${customerData?.name || quoteData.customerName || 'Cliente'}.pdf`);
  };

  const filteredCustomers = customers.filter(c => {
    const matchesSearch = c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.phone?.includes(search) ||
      c.email?.toLowerCase().includes(search.toLowerCase()) ||
      c.code?.includes(search);
    
    const matchesEmployee = (filterEmployeeId === '' || c.employeeId === filterEmployeeId) || (filterEmployeeId !== '' && !c.employeeId && profile?.role === 'admin' && !selectedShopId);
    
    // If filtering by shop as admin, ensure customer belongs to shop
    const matchesShop = profile?.role === 'admin' && selectedShopId ? c.companyId === selectedShopId : true;

    return matchesSearch && matchesEmployee && matchesShop;
  });

  return (
    <div className="min-h-screen bg-transparent p-4 sm:p-6 lg:p-10 space-y-10  mx-auto">
      <PlanLimitModal
        isOpen={showLimitModal}
        onClose={() => setShowLimitModal(false)}
        currentPlan={profile?.plan || 'free'}
        feature="clientes"
      />

      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
        >
          <h2 className="text-3xl font-black text-gray-900 dark:text-white tracking-tight">
            Clientes
          </h2>
          <p className="text-gray-500 dark:text-gray-400 mt-1 font-medium">
            Gerencie sua base de clientes e contatos.
          </p>
        </motion.div>

        <motion.button
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => setIsModalOpen(true)}
          className="flex items-center justify-center gap-2 px-6 py-3.5 bg-indigo-600 text-white rounded-2xl font-bold shadow-lg shadow-indigo-200 dark:shadow-none hover:bg-indigo-700 transition-all"
        >
          <Plus className="w-5 h-5" />
          Novo Cliente
        </motion.button>
      </div>

      {/* Filters Section */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4"
      >
        <div className="md:col-span-2 relative group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 group-focus-within:text-indigo-500 transition-colors" />
          <input
            type="text"
            placeholder="Buscar por nome, CPF, e-mail ou código..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-12 pr-4 py-3.5 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl shadow-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all dark:text-white"
          />
        </div>

        {profile?.role === 'admin' && (
          <select
            value={selectedShopId}
            onChange={(e) => {
              setSelectedShopId(e.target.value);
              setFilterEmployeeId('');
            }}
            className="px-4 py-3.5 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl shadow-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all dark:text-white font-medium"
          >
            <option value="">Todas as Lojas</option>
            {shops.map(shop => (
              <option key={shop.id} value={shop.id}>{shop.name || shop.displayName || shop.email}</option>
            ))}
          </select>
        )}

        {profile?.role !== 'employee' && (
          <select
            value={filterEmployeeId}
            onChange={(e) => setFilterEmployeeId(e.target.value)}
            className="px-4 py-3.5 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl shadow-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all dark:text-white font-medium"
          >
            <option value="">Todos os funcionários</option>
            {employees.map(emp => <option key={emp.id} value={emp.id}>{emp.name || emp.displayName}</option>)}
          </select>
        )}
      </motion.div>

      {/* Customers Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-8 2xl:gap-12">
        <AnimatePresence mode="popLayout">
          {filteredCustomers.map((customer, index) => (
            <motion.div
              key={customer.id}
              layout
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ delay: index * 0.05 }}
              className="bg-white dark:bg-gray-800 rounded-[3rem] 2xl:rounded-[4rem] p-8 2xl:p-12 shadow-2xl shadow-gray-300/20 dark:shadow-none border border-gray-100 dark:border-gray-700 hover:border-indigo-500 dark:hover:border-indigo-500 transition-all cursor-pointer group flex flex-col justify-between min-h-fit 2xl:min-h-[450px]"
            >
              {/* Icon Background */}
              <div className="absolute -right-4 -top-4 opacity-[0.03] dark:opacity-[0.05] group-hover:scale-110 transition-transform duration-500">
                <User size={120} />
              </div>

              <div className="flex justify-between items-start mb-6">
                <div className="w-16 h-16 2xl:w-24 2xl:h-24 rounded-[2.5rem] bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400 border-4 border-white dark:border-gray-800 shadow-xl shrink-0">
                  <User className="w-8 h-8 2xl:w-12 2xl:h-12" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="font-black text-xl lg:text-3xl 2xl:text-4xl text-gray-900 dark:text-white truncate tracking-tighter">{customer.name}</h3>
                  <p className="text-sm 2xl:text-lg font-black text-gray-400 group-hover:text-indigo-500 transition-colors uppercase tracking-[0.2em] mt-2">
                    ID: {customer.code}
                  </p>
                </div>
                </div>
                
                <div className="flex gap-2">
                  {quotes.find(q => q.customerId === customer.id) && (
                    <button 
                      onClick={() => generatePDF(quotes.find(q => q.customerId === customer.id), customer)} 
                      className="p-2 text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 rounded-xl transition-all"
                      title="Baixar último orçamento"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                  )}
                  <button 
                    onClick={() => copyToClipboard(customer.code)}
                    className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 rounded-xl transition-all"
                    title="Copiar código"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={() => handleDelete(customer.id)}
                    className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-xl transition-all"
                    title="Excluir cliente"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <p className="text-xs 2xl:text-sm uppercase tracking-[0.2em] font-black text-gray-400 mb-2">Documento</p>
                    <div className="flex items-center gap-3 text-lg lg:text-xl 2xl:text-2xl font-black text-gray-700 dark:text-gray-200 truncate">
                      <Hash className="w-5 h-5 2xl:w-6 2xl:h-6 text-indigo-500 shrink-0" />
                      <span className="truncate">{customer.cpf || '-'}</span>
                    </div>
                  </div>
                  <div className="space-y-1 text-right">
                    <p className="text-xs 2xl:text-sm uppercase tracking-[0.2em] font-black text-gray-400 mb-2">TELEFONE</p>
                    <div className="flex items-center justify-end gap-3 text-lg lg:text-xl 2xl:text-2xl font-black text-gray-700 dark:text-gray-200">
                      <Phone className="w-5 h-5 2xl:w-6 2xl:h-6 text-indigo-500 shrink-0" />
                      <span className="truncate">{customer.phone || '-'}</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-1">
                  <p className="text-xs 2xl:text-sm uppercase tracking-[0.2em] font-black text-gray-400 mb-2">E-MAIL</p>
                  <div className="flex items-center gap-3 text-lg lg:text-xl font-black text-gray-700 dark:text-gray-200 truncate">
                    <Mail className="w-5 h-5 text-indigo-500 shrink-0" />
                    <span className="truncate">{customer.email || '-'}</span>
                  </div>
                </div>

                {customer.address && (
                  <div className="space-y-1">
                    <p className="text-xs uppercase tracking-widest font-black text-gray-400">Endereço</p>
                    <div className="flex items-center gap-2 text-sm font-bold text-gray-700 dark:text-gray-200">
                      <MapPin className="w-3.5 h-3.5 text-indigo-500" />
                      <span className="truncate">{customer.address}</span>
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-6 pt-4 border-t border-gray-50 dark:border-gray-700 flex items-center justify-between">
                <div className="flex items-center gap-2 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                  <Calendar className="w-3 h-3" />
                  <span>Desde {customer.createdAt?.toDate ? customer.createdAt.toDate().toLocaleDateString('pt-BR') : 'Recente'}</span>
                </div>
                <div className="p-2 bg-gray-50 dark:bg-gray-700 rounded-xl group-hover:bg-indigo-600 group-hover:text-white transition-all">
                  <ChevronRight className="w-4 h-4" />
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {filteredCustomers.length === 0 && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center py-20 bg-slate-50 dark:bg-gray-800 rounded-[3rem] border-2 border-dashed border-gray-100 dark:border-gray-700"
        >
          <div className="w-20 h-20 bg-gray-50 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
            <User className="w-10 h-10 text-gray-300" />
          </div>
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">Nenhum cliente encontrado</h3>
          <p className="text-gray-500 dark:text-gray-400">Tente ajustar sua busca ou adicione um novo cliente.</p>
        </motion.div>
      )}

      {/* Modal Section */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative bg-[#0B0F19] rounded-[3rem] shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col border border-white/5"
            >
              <div className="p-8 border-b border-gray-50 dark:border-gray-700 flex justify-between items-center bg-indigo-600">
                <div>
                  <h3 className="text-2xl font-black text-white tracking-tight">Novo Cliente</h3>
                  <p className="text-indigo-100 text-sm font-medium mt-1">Preencha os dados para cadastro</p>
                </div>
                <button 
                  onClick={() => setIsModalOpen(false)} 
                  className="p-2 bg-white/10 hover:bg-white/20 text-white rounded-xl transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="overflow-y-auto p-8 max-h-[70vh]">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">CPF</label>
                    <div className="relative">
                      <input 
                        type="text" 
                        placeholder="000.000.000-00" 
                        value={newCustomer.cpf} 
                        onChange={e => handleCpfChange(e.target.value)} 
                        className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-100 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all dark:text-white font-medium" 
                      />
                      {isFetchingCpf && (
                        <div className="absolute right-3 top-1/2 -translate-y-1/2">
                          <Loader2 className="h-4 w-4 animate-spin text-indigo-600" />
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Nome Completo / Razão Social</label>
                    <input 
                      type="text" 
                      placeholder="Nome completo ou Razão Social" 
                      value={newCustomer.name}  
                      onChange={e => setNewCustomer({...newCustomer, name: e.target.value})} 
                      className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-100 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all dark:text-white font-medium" 
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Data de Nascimento</label>
                    <input 
                      type="text" 
                      placeholder="DD/MM/AAAA" 
                      value={newCustomer.birthDate} 
                      onChange={e => setNewCustomer({...newCustomer, birthDate: e.target.value})} 
                      className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-100 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all dark:text-white font-medium" 
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Telefone</label>
                    <input 
                      type="text" 
                      placeholder="Telefone" 
                      value={newCustomer.phone} 
                      onChange={e => setNewCustomer({...newCustomer, phone: e.target.value})} 
                      className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-100 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all dark:text-white font-medium" 
                    />
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">E-mail</label>
                    <input 
                      type="email" 
                      placeholder="E-mail" 
                      value={newCustomer.email} 
                      onChange={e => setNewCustomer({...newCustomer, email: e.target.value})} 
                      className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-100 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all dark:text-white font-medium" 
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">CEP</label>
                    <div className="relative">
                      <input 
                        type="text" 
                        placeholder="00000-000" 
                        value={newCustomer.cep || ''} 
                        onChange={e => handleCepChange(e.target.value)} 
                        className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-100 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all dark:text-white font-medium" 
                      />
                      {isFetchingCep && (
                        <div className="absolute right-3 top-1/2 -translate-y-1/2">
                          <Loader2 className="h-4 w-4 animate-spin text-indigo-600" />
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Endereço</label>
                    <input 
                      type="text" 
                      placeholder="Endereço completo" 
                      value={newCustomer.address} 
                      onChange={e => setNewCustomer({...newCustomer, address: e.target.value})} 
                      className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-100 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all dark:text-white font-medium" 
                    />
                  </div>
                </div>
              </div>

              <div className="p-8 bg-gray-50 dark:bg-gray-800/50 border-t border-gray-100 dark:border-gray-700 flex gap-4">
                <button 
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 px-6 py-3.5 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-xl font-bold border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600 transition-all"
                >
                  Cancelar
                </button>
                <button 
                  onClick={handleAddCustomer} 
                  disabled={isSaving || isFetchingCpf}
                  className="flex-[2] px-6 py-3.5 bg-indigo-600 text-white rounded-xl font-bold shadow-lg shadow-indigo-200 dark:shadow-none hover:bg-indigo-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" />
                      Salvando...
                    </>
                  ) : (
                    'Salvar Cliente'
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
