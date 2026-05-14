import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Wrench, Mail, Lock, AlertCircle, User, Briefcase, CreditCard, Calendar, Phone, Package, MapPin, FileText } from 'lucide-react';
import { useAuth } from '../AuthContext';
import { auth, db } from '../firebase';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { doc, setDoc, serverTimestamp, collection, addDoc } from 'firebase/firestore';
import { motion } from 'framer-motion';

import { SEGMENTS, AUTOMOTIVE_TYPES } from '../constants/segments';


export default function Signup() {
  const [searchParams] = useSearchParams();
  const initialRole = searchParams.get('role') as 'shop' | 'fornecedor' || 'shop';
  const initialPlan = searchParams.get('plan') || 'free';

  const [role, setRole] = useState<'shop' | 'fornecedor'>(initialRole);
  // Owner fields
  const [ownerCpf, setOwnerCpf] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [ownerBirthDate, setOwnerBirthDate] = useState('');
  
  // Business fields
  const [cnpj, setCnpj] = useState('');
  const [tradeName, setTradeName] = useState(''); // Nome Fantasia (Obrigatório)
  const [companyName, setCompanyName] = useState(''); // Razão Social (Opcional)
  const [startDate, setStartDate] = useState(''); // Abertura (Opcional)
  
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  
  // Address fields
  const [cep, setCep] = useState('');
  const [street, setStreet] = useState('');
  const [number, setNumber] = useState('');
  const [complement, setComplement] = useState('');
  const [neighborhood, setNeighborhood] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  
  const [password, setPassword] = useState('');
  const [segment, setSegment] = useState(SEGMENTS?.[0]?.id || 'other');
  const [shopType, setShopType] = useState(AUTOMOTIVE_TYPES?.[0]?.id || 'oficina');
  const [supplierSegments, setSupplierSegments] = useState<string[]>([]);
  const [description, setDescription] = useState('');
  const [businessHours, setBusinessHours] = useState({
    open: '08:00',
    close: '18:00',
    days: [1, 2, 3, 4, 5] // Mon-Fri
  });
  
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [searchingCpf, setSearchingCpf] = useState(false);
  const [searchingCnpj, setSearchingCnpj] = useState(false);
  const [searchingCep, setSearchingCep] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    setRole(initialRole);
  }, [initialRole]);

  const handleCpfChange = (value: string) => {
    let cleanValue = value.replace(/\D/g, '');
    if (cleanValue.length > 11) cleanValue = cleanValue.slice(0, 11);
    const maskedValue = cleanValue
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})/, '$1-$2');
    setOwnerCpf(maskedValue);

    if (cleanValue.length === 11) {
      handleCpfLookup(cleanValue);
    }
  };

  const handleCpfLookup = async (cpf: string) => {
    setSearchingCpf(true);
    try {
      // NOTE: CPF lookup usually requires a paid API (like Serpro or 3rd party).
      // Here we add the hook so the user can see the progress and potentially connect an API.
      await new Promise(resolve => setTimeout(resolve, 1000));
      console.log("CPF lookup simulated for:", cpf);
    } catch (err) {
      console.error('Erro ao buscar CPF:', err);
    } finally {
      setSearchingCpf(false);
    }
  };

  const handleCnpjChange = async (value: string) => {
    let cleanValue = value.replace(/\D/g, '');
    if (cleanValue.length > 14) cleanValue = cleanValue.slice(0, 14);
    const maskedValue = cleanValue
      .replace(/(\d{2})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1/$2')
      .replace(/(\d{4})(\d{1,2})/, '$1-$2');
    
    setCnpj(maskedValue);
    
    if (cleanValue.length === 14) {
      setSearchingCnpj(true);
      try {
        const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cleanValue}`);
        if (response.ok) {
          const data = await response.json();
          if (data.razao_social) setCompanyName(data.razao_social);
          if (data.nome_fantasia) setTradeName(data.nome_fantasia);
          else if (data.razao_social) setTradeName(data.razao_social);
          
          if (data.email) setEmail(data.email);
          if (data.ddd_telefone_1) setPhone(data.ddd_telefone_1);
          if (data.data_inicio_atividade) setStartDate(data.data_inicio_atividade);
          if (data.cep) handleCepLookup(data.cep);
        }
      } catch (err) {
        console.error('Erro ao buscar CNPJ:', err);
      } finally {
        setSearchingCnpj(false);
      }
    }
  };

  const handleCepLookup = async (value: string) => {
    let cleanCep = value.replace(/\D/g, '');
    if (cleanCep.length > 8) cleanCep = cleanCep.slice(0, 8);
    
    const maskedCep = cleanCep.replace(/(\d{5})(\d)/, '$1-$2');
    setCep(maskedCep);

    if (cleanCep.length === 8) {
      setSearchingCep(true);
      try {
        const response = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
        if (response.ok) {
          const data = await response.json();
          if (!data.erro) {
            setStreet(data.logradouro);
            setNeighborhood(data.bairro);
            setCity(data.localidade);
            setState(data.uf);
          }
        }
      } catch (err) {
        console.error('Erro ao buscar CEP:', err);
      } finally {
        setSearchingCep(false);
      }
    }
  };

  const handlePhoneChange = (value: string) => {
    let cleanPhone = value.replace(/\D/g, '');
    if (cleanPhone.length > 11) cleanPhone = cleanPhone.slice(0, 11);
    
    let maskedPhone = cleanPhone;
    if (cleanPhone.length > 2) {
      maskedPhone = `(${cleanPhone.slice(0, 2)}) ${cleanPhone.slice(2)}`;
    }
    if (cleanPhone.length > 7) {
      maskedPhone = `(${cleanPhone.slice(0, 2)}) ${cleanPhone.slice(2, 7)}-${cleanPhone.slice(7)}`;
    }
    setPhone(maskedPhone);
  };

  const handleEmailSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    // Validações básicas
    const cleanCpf = ownerCpf.replace(/\D/g, '');
    if (cleanCpf.length !== 11) {
      setError('CPF inválido. Digite 11 números para identificação do proprietário.');
      return;
    }
    
    const cleanCnpj = cnpj.replace(/\D/g, '');
    if (cleanCnpj && cleanCnpj.length !== 14) {
      setError('CNPJ inválido. Digite 14 números ou deixe em branco se não possuir.');
      return;
    }

    if (ownerBirthDate) {
      const birthYear = new Date(ownerBirthDate).getFullYear();
      const currentYear = new Date().getFullYear();
      if (birthYear < 1900 || birthYear > currentYear) {
        setError('Data de nascimento inválida.');
        return;
      }
    }

    setLoading(true);
    const trimmedEmail = email.trim();
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, trimmedEmail, password);
      const user = userCredential.user;

      const displayName = tradeName || ownerName;
      const finalCompanyName = companyName || tradeName;

      await updateProfile(user, {
        displayName: displayName
      });

      const finalRole = (trimmedEmail === 'adm2@admin.com' || trimmedEmail === 'santosrennan88@gmail.com') ? 'admin' : role;
      const status = finalRole === 'fornecedor' ? 'pending' : 'active';

      const userData = {
        uid: user.uid,
        name: displayName,
        companyName: finalCompanyName,
        tradeName,
        fullName: ownerName,
        email: trimmedEmail,
        role: finalRole,
        status,
        companyId: user.uid,
        segment: role === 'shop' ? segment : null,
        shopType: role === 'shop' && segment === 'automotive' ? shopType : null,
        supplierSegments: role === 'fornecedor' ? supplierSegments : [],
        docType: cnpj ? 'cnpj' : 'cpf',
        cpfCnpj: cnpj || ownerCpf,
        ownerCpf,
        birthDate: ownerBirthDate,
        startDate,
        phone,
        address: {
          cep,
          street,
          number,
          complement,
          neighborhood,
          city,
          state
        },
        createdAt: serverTimestamp(),
        plan: 'free', // Default plan, will be updated in plan selection
        planExpiresAt: null,
        description,
        businessHours
      };

      try {
        await setDoc(doc(db, 'users', user.uid), userData);
        
        // Create Welcome Notification
        await addDoc(collection(db, 'notifications'), {
          companyId: user.uid,
          title: 'Bem-vindo ao Service Hub! 🎉',
          message: 'Estamos muito felizes em ter você conosco! Aqui está um breve resumo do que você pode fazer:\n\n' +
                   '👥 Clientes: Cadastre e gerencie todos os seus clientes.\n' +
                   '🚗 Veículos/Equipamentos: Registre o que será consertado.\n' +
                   '📋 Ordens de Serviço (OS): Crie e acompanhe o status dos serviços.\n' +
                   '💼 Serviços: Cadastre os serviços que você oferece.\n' +
                   '📄 Orçamentos: Gere orçamentos profissionais e envie em PDF.\n' +
                   '📦 Estoque e Pedidos: Controle suas peças e faça pedidos a fornecedores.\n' +
                   '💰 Financeiro: Acompanhe seu fluxo de caixa, contas a pagar e receber.\n' +
                   '📅 Agenda: Organize seus compromissos e serviços.\n' +
                   '📊 Relatórios: Tenha uma visão completa do seu negócio.\n\n' +
                   'Explore o menu lateral para começar!',
          type: 'info',
          read: false,
          createdAt: serverTimestamp()
        });
      } catch (firestoreErr) {
        console.error('Erro ao salvar no Firestore:', firestoreErr);
        await user.delete();
        throw new Error('Erro ao salvar dados do usuário. Tente novamente.');
      }

      if (role === 'shop') {
        if (initialPlan !== 'free') {
           navigate(`/plan-selection?plan=${initialPlan}`);
        } else {
           navigate('/plan-selection');
        }
      } else {
        navigate('/app');
      }
    } catch (err: any) {
      console.error('Erro geral no cadastro:', err);
      if (err.code === 'auth/email-already-in-use') {
        setError('Este email já está em uso. Por favor, faça login.');
      } else {
        setError(err.message || 'Erro ao criar conta');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0B0F19] flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden transition-colors duration-700">
      <div className="mesh-bg" />
      
      <div className="relative z-10 sm:mx-auto sm:w-full sm:max-w-xl">
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex justify-center"
        >
          <div className="p-4 bg-indigo-500/10 rounded-3xl border border-indigo-500/20 backdrop-blur-xl">
            <Wrench className="h-12 w-12 text-indigo-600 dark:text-indigo-400" />
          </div>
        </motion.div>
        <h2 className="mt-6 text-center text-4xl font-black text-gray-900 dark:text-white tracking-tighter uppercase">
          Junte-se ao <span className="text-indigo-500">Hub</span>
        </h2>
        <p className="mt-2 text-center text-xs font-bold text-gray-400 uppercase tracking-widest">A maior rede de gestão automotiva da américa latina</p>
      </div>

      <div className="mt-10 relative z-10 sm:mx-auto sm:w-full sm:max-w-xl">
        <motion.div 
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="glass-card py-10 px-6 sm:rounded-[3rem] sm:px-12 backdrop-blur-2xl"
        >
          {error && (
            <div className="mb-4 rounded-md bg-red-50 dark:bg-red-900/30 p-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <AlertCircle className="h-5 w-5 text-red-400" aria-hidden="true" />
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-red-800 dark:text-red-200">
                    {error}
                    {error.includes('fazer login') && (
                      <Link to="/login" className="ml-2 underline font-bold">
                        Ir para Login
                      </Link>
                    )}
                  </h3>
                </div>
              </div>
            </div>
          )}

          <form className="space-y-6" onSubmit={handleEmailSignup}>
            {/* Role Selection */}
            {!searchParams.get('role') && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Tipo de Conta
                </label>
                <div className="grid grid-cols-2 gap-4">
                  <button
                    type="button"
                    onClick={() => setRole('shop')}
                    className={`flex flex-col items-center p-3 border rounded-lg transition-colors ${
                      role === 'shop' 
                        ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400' 
                        : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-500'
                    }`}
                  >
                    <Wrench className="h-6 w-6 mb-1" />
                    <span className="text-xs font-bold">Oficina / Loja</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setRole('fornecedor')}
                    className={`flex flex-col items-center p-3 border rounded-lg transition-colors ${
                      role === 'fornecedor' 
                        ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400' 
                        : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-500'
                    }`}
                  >
                    <Package className="h-6 w-6 mb-1" />
                    <span className="text-xs font-bold">Fornecedor</span>
                  </button>
                </div>
              </div>
            )}

            {/* Section 1: Owner Info */}
            <div className="space-y-4 border-b border-gray-100 dark:border-gray-700 pb-6">
              <div className="flex items-center gap-2 mb-2">
                <User className="h-5 w-5 text-indigo-600" />
                <h3 className="text-sm font-black uppercase tracking-widest text-gray-900 dark:text-white">Identificação do Proprietário</h3>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="relative">
                  <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1 ml-1">CPF (Obrigatório)</label>
                    <div className="relative rounded-xl shadow-sm">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <CreditCard className={`h-4 w-4 ${searchingCpf ? 'text-indigo-500 animate-pulse' : 'text-gray-400'}`} />
                      </div>
                      <input
                        type="text"
                        required
                        value={ownerCpf}
                        onChange={(e) => handleCpfChange(e.target.value)}
                        className="focus:ring-indigo-500 focus:border-indigo-500 block w-full pl-10 sm:text-sm border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white py-2.5 border"
                        placeholder="000.000.000-00"
                      />
                      {searchingCpf && (
                        <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                          <div className="animate-spin h-4 w-4 border-2 border-indigo-500 border-t-transparent rounded-full"></div>
                        </div>
                      )}
                    </div>
                  <div className="mt-1 flex items-start gap-1 p-2 bg-indigo-50/50 dark:bg-indigo-900/20 rounded-lg">
                    <AlertCircle className="h-3 w-3 text-indigo-600 mt-0.5" />
                    <p className="text-[9px] text-indigo-700 dark:text-indigo-400 font-bold leading-tight">
                      Importante: Tenha uma conta PIX associada a este CPF para recebimentos.
                    </p>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1 ml-1">Data de Nascimento</label>
                  <div className="relative rounded-xl shadow-sm">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Calendar className="h-4 w-4 text-gray-400" />
                    </div>
                    <input
                      type="date"
                      required
                      value={ownerBirthDate}
                      onChange={(e) => setOwnerBirthDate(e.target.value)}
                      className="focus:ring-indigo-500 focus:border-indigo-500 block w-full pl-10 sm:text-sm border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white py-2.5 border"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1 ml-1">Nome Completo do Proprietário</label>
                <div className="relative rounded-xl shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <User className="h-4 w-4 text-gray-400" />
                  </div>
                  <input
                    type="text"
                    required
                    value={ownerName}
                    onChange={(e) => setOwnerName(e.target.value)}
                    className="focus:ring-indigo-500 focus:border-indigo-500 block w-full pl-10 sm:text-sm border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white py-2.5 border"
                    placeholder="Nome completo conforme documento"
                  />
                </div>
              </div>
            </div>

            {/* Section 2: Business Info */}
            <div className="space-y-4 pt-2">
              <div className="flex items-center gap-2 mb-2">
                <Briefcase className="h-5 w-5 text-indigo-600" />
                <h3 className="text-sm font-black uppercase tracking-widest text-gray-900 dark:text-white">Informações do Negócio</h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1 ml-1">CNPJ (Se possuir)</label>
                  <div className="relative rounded-xl shadow-sm">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Briefcase className={`h-4 w-4 ${searchingCnpj ? 'text-indigo-500 animate-pulse' : 'text-gray-400'}`} />
                    </div>
                    <input
                      type="text"
                      value={cnpj}
                      onChange={(e) => handleCnpjChange(e.target.value)}
                      className="focus:ring-indigo-500 focus:border-indigo-500 block w-full pl-10 sm:text-sm border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white py-2.5 border"
                      placeholder="00.000.000/0000-00"
                    />
                    {searchingCnpj && (
                      <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                        <div className="animate-spin h-4 w-4 border-2 border-indigo-500 border-t-transparent rounded-full"></div>
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1 ml-1">Data de Abertura / Início</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="mt-1 focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white py-2.5 px-4 border"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1 ml-1">Nome Fantasia (Como os clientes verão)</label>
                <div className="relative rounded-xl shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Package className="h-4 w-4 text-gray-400" />
                  </div>
                  <input
                    type="text"
                    required
                    value={tradeName}
                    onChange={(e) => setTradeName(e.target.value)}
                    className="focus:ring-indigo-500 focus:border-indigo-500 block w-full pl-10 sm:text-sm border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white py-2.5 border"
                    placeholder="Ex: Mecânica do João / Peças Express"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1 ml-1">Razão Social (Opcional - Usado em Docs/PDFs)</label>
                <div className="relative rounded-xl shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <FileText className="h-4 w-4 text-gray-400" />
                  </div>
                  <input
                    type="text"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    className="focus:ring-indigo-500 focus:border-indigo-500 block w-full pl-10 sm:text-sm border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white py-2.5 border"
                    placeholder="Nome empresarial completo"
                  />
                </div>
              </div>
            </div>

            {/* Contact Data */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Telefone</label>
                <div className="mt-1 relative rounded-md shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Phone className="h-5 w-5 text-gray-400" />
                  </div>
                  <input type="tel" required value={phone} onChange={(e) => handlePhoneChange(e.target.value)} className="focus:ring-indigo-500 focus:border-indigo-500 block w-full pl-10 sm:text-sm border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-white py-2 border" placeholder="(00) 00000-0000" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Email</label>
                <div className="mt-1 relative rounded-md shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Mail className="h-5 w-5 text-gray-400" />
                  </div>
                  <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="focus:ring-indigo-500 focus:border-indigo-500 block w-full pl-10 sm:text-sm border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-white py-2 border" placeholder="seu@email.com" />
                </div>
              </div>
            </div>

            {/* Address Data */}
            <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Endereço</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
                <div className="sm:col-span-1">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">CEP</label>
                  <div className="mt-1 relative rounded-md shadow-sm">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <MapPin className="h-5 w-5 text-gray-400" />
                    </div>
                    <input type="text" required value={cep} onChange={(e) => handleCepLookup(e.target.value)} className="focus:ring-indigo-500 focus:border-indigo-500 block w-full pl-10 sm:text-sm border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-white py-2 border" placeholder="00000-000" />
                    {searchingCep && (
                      <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                        <div className="animate-spin h-4 w-4 border-2 border-indigo-500 border-t-transparent rounded-full"></div>
                      </div>
                    )}
                  </div>
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Rua/Avenida</label>
                  <input type="text" required value={street} onChange={(e) => setStreet(e.target.value)} className="mt-1 focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-white py-2 px-3 border" />
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
                <div className="sm:col-span-1">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Número</label>
                  <input type="text" required value={number} onChange={(e) => setNumber(e.target.value)} className="mt-1 focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-white py-2 px-3 border" />
                </div>
                <div className="sm:col-span-3">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Complemento</label>
                  <input type="text" value={complement} onChange={(e) => setComplement(e.target.value)} className="mt-1 focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-white py-2 px-3 border" />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Bairro</label>
                  <input type="text" required value={neighborhood} onChange={(e) => setNeighborhood(e.target.value)} className="mt-1 focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-white py-2 px-3 border" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Cidade</label>
                  <input type="text" required value={city} onChange={(e) => setCity(e.target.value)} className="mt-1 focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-white py-2 px-3 border" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Estado</label>
                  <input type="text" required value={state} onChange={(e) => setState(e.target.value)} className="mt-1 focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-white py-2 px-3 border" />
                </div>
              </div>
            </div>

            {/* Password */}
            <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Senha</label>
              <div className="mt-1 relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-gray-400" />
                </div>
                <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className="focus:ring-indigo-500 focus:border-indigo-500 block w-full pl-10 sm:text-sm border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-white py-2 border" placeholder="••••••••" />
              </div>
            </div>

            {/* Segments configuration */}
            {role === 'shop' ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Segmento da Loja</label>
                  <div className="mt-1 relative rounded-md shadow-sm">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Briefcase className="h-5 w-5 text-gray-400" />
                    </div>
                    <select required value={segment} onChange={(e) => setSegment(e.target.value)} className="focus:ring-indigo-500 focus:border-indigo-500 block w-full pl-10 sm:text-sm border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-white py-2 border">
                      {SEGMENTS.map(type => (
                        <option key={type.id} value={type.id}>{type.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
                {segment === 'automotive' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Tipo de Estabelecimento Automotivo</label>
                    <div className="mt-1 relative rounded-md shadow-sm">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Wrench className="h-5 w-5 text-gray-400" />
                      </div>
                      <select required value={shopType} onChange={(e) => setShopType(e.target.value)} className="focus:ring-indigo-500 focus:border-indigo-500 block w-full pl-10 sm:text-sm border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-white py-2 border">
                        {AUTOMOTIVE_TYPES.map(type => (
                          <option key={type.id} value={type.id}>{type.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Segmentos Atendidos (Pode selecionar múltiplos)</label>
                <div className="space-y-2 border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-white dark:bg-gray-900 max-h-60 overflow-y-auto w-full">
                  {SEGMENTS.map(sg => {
                    const isAutomotive = sg.id === 'automotive';
                    return (
                      <div key={sg.id} className="space-y-3">
                        <label className="flex items-start">
                          <input
                            type="checkbox"
                            className="mt-1 h-4 w-4 text-indigo-600 rounded border-gray-300"
                            checked={supplierSegments.includes(sg.id)}
                            onChange={(e) => {
                              if (e.target.checked) setSupplierSegments([...supplierSegments, sg.id]);
                              else {
                                setSupplierSegments(prev => prev.filter(s => s !== sg.id));
                                if (isAutomotive) {
                                  setSupplierSegments(prev => prev.filter(s => s !== sg.id && !AUTOMOTIVE_TYPES.some(a => a.id === s)));
                                }
                              }
                            }}
                          />
                          <span className="ml-2 text-sm text-gray-700 dark:text-gray-300 font-bold block">
                            {sg.name}
                          </span>
                        </label>
                        {isAutomotive && supplierSegments.includes('automotive') && (
                          <div className="ml-6 space-y-2 pl-2 border-l-2 border-indigo-100 dark:border-indigo-900/30">
                            {AUTOMOTIVE_TYPES.map(at => (
                              <label key={at.id} className="flex items-start">
                                <input
                                  type="checkbox"
                                  className="mt-1 h-4 w-4 text-indigo-600 rounded border-gray-300"
                                  checked={supplierSegments.includes(at.id)}
                                  onChange={(e) => {
                                    if (e.target.checked) setSupplierSegments([...supplierSegments, at.id]);
                                    else setSupplierSegments(prev => prev.filter(s => s !== at.id));
                                  }}
                                />
                                <span className="ml-2 text-sm text-gray-600 dark:text-gray-400">
                                  {at.name}
                                </span>
                              </label>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Business Hours & Description */}
            <div className="border-t border-gray-200 dark:border-gray-700 pt-6 space-y-6">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Informações de Atendimento</h3>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Descrição da Loja/Fornecedor</label>
                <p className="text-[10px] text-gray-500 mb-1">Essa informação será usada pelo agente de IA para apresentar seu negócio aos clientes.</p>
                <textarea 
                  value={description} 
                  onChange={(e) => setDescription(e.target.value)}
                  className="mt-1 focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-white py-2 px-3 border"
                  rows={3}
                  placeholder="Ex: Oficina especializada em suspensão e freios com mais de 20 anos de tradição..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Horário de Abertura</label>
                  <input 
                    type="time" 
                    value={businessHours.open} 
                    onChange={(e) => setBusinessHours({...businessHours, open: e.target.value})}
                    className="mt-1 focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-white py-2 px-3 border"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Horário de Fechamento</label>
                  <input 
                    type="time" 
                    value={businessHours.close} 
                    onChange={(e) => setBusinessHours({...businessHours, close: e.target.value})}
                    className="mt-1 focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-white py-2 px-3 border"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Dias de Funcionamento</label>
                <div className="flex flex-wrap gap-2">
                  {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((day, index) => (
                    <button
                      key={day}
                      type="button"
                      onClick={() => {
                        const newDays = businessHours.days.includes(index)
                          ? businessHours.days.filter(d => d !== index)
                          : [...businessHours.days, index].sort();
                        setBusinessHours({...businessHours, days: newDays});
                      }}
                      className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${
                        businessHours.days.includes(index)
                          ? 'bg-indigo-600 text-white shadow-md'
                          : 'bg-gray-100 dark:bg-gray-800 text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-700'
                      }`}
                    >
                      {day}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
              >
                {loading ? 'Criando...' : 'Criar Conta'}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </div>
  );
}
