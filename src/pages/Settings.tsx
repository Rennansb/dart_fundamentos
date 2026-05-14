import React, { useState } from 'react';
import { useAuth } from '../AuthContext';
import { 
  User, 
  Building2, 
  ShieldCheck, 
  Mail, 
  Phone, 
  MapPin, 
  BadgeCheck, 
  CreditCard,
  Save,
  Lock,
  Camera,
  ChevronRight,
  Globe,
  Wallet,
  Clock,
  FileText,
  Calendar,
  AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { sendPasswordResetEmail, reauthenticateWithCredential, EmailAuthProvider } from 'firebase/auth';
import { auth } from '../firebase';

export default function Settings() {
  const { profile, updateProfile, effectiveProfile } = useAuth();
  const [activeTab, setActiveTab] = useState<'profile' | 'company' | 'security'>('profile');
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState({ type: '', text: '' });

  const [formData, setFormData] = useState({
    name: effectiveProfile?.name || '', // Nome do Proprietário
    ownerCpf: effectiveProfile?.ownerCpf || effectiveProfile?.cpfCnpj || '',
    birthDate: effectiveProfile?.birthDate || '',
    displayName: effectiveProfile?.displayName || '',
    email: effectiveProfile?.email || '',
    phone: effectiveProfile?.phone || '',
    
    // Business
    tradeName: effectiveProfile?.tradeName || effectiveProfile?.companyName || '', // Nome Fantasia
    companyName: effectiveProfile?.companyName || '', // Razão Social
    cnpj: effectiveProfile?.cnpj || (effectiveProfile?.cpfCnpj?.length === 18 ? effectiveProfile?.cpfCnpj : ''), // Masked CNPJ length is 18
    startDate: effectiveProfile?.startDate || '',
    
    shopType: effectiveProfile?.shopType || 'centro_automotivo',
    segment: effectiveProfile?.segment || 'automotive',
    cep: effectiveProfile?.cep || '',
    address: effectiveProfile?.address || {
      street: '',
      number: '',
      complement: '',
      neighborhood: '',
      city: '',
      state: ''
    },
    pixKey: effectiveProfile?.pixKey || '',
    googleGmbLink: effectiveProfile?.googleGmbLink || '',
    description: effectiveProfile?.description || '',
    businessHours: effectiveProfile?.businessHours || {
      open: '08:00',
      close: '18:00',
      days: [1, 2, 3, 4, 5]
    },
    logo: effectiveProfile?.logo || ''
  });

  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const [isPixModalOpen, setIsPixModalOpen] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isConfirmingPassword, setIsConfirmingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState('');

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSaveMessage({ type: '', text: '' });

    // PIX Validation check
    if (formData.pixKey && formData.pixKey !== effectiveProfile?.pixKey) {
      const cleanPix = formData.pixKey.replace(/\D/g, '');
      const cleanCpf = (formData.ownerCpf || '').replace(/\D/g, '');
      const cleanCnpj = (formData.cnpj || '').replace(/\D/g, '');
      
      if (cleanPix.length > 0 && cleanPix !== cleanCpf && cleanPix !== cleanCnpj) {
        setSaveMessage({ type: 'error', text: 'A chave PIX deve ser o CPF ou CNPJ atrelado à loja para sua segurança.' });
        setIsSaving(false);
        return;
      }
      
      // If valid, open password confirmation modal
      setIsPixModalOpen(true);
      setIsSaving(false);
      return;
    }

    await persistChanges();
  };

  const persistChanges = async () => {
    setIsSaving(true);
    // Fallback logic
    const finalCompanyName = formData.companyName || formData.tradeName;
    const finalData = {
      ...formData,
      companyName: finalCompanyName,
      displayName: formData.tradeName || formData.name,
      cpfCnpj: formData.cnpj || formData.ownerCpf // For backward compatibility
    };

    try {
      await updateProfile(finalData);
      setSaveMessage({ type: 'success', text: 'Configurações salvas com sucesso!' });
      setIsPixModalOpen(false);
      setConfirmPassword('');
    } catch (error) {
      setSaveMessage({ type: 'error', text: 'Erro ao salvar configurações.' });
    } finally {
      setIsSaving(false);
      setTimeout(() => setSaveMessage({ type: '', text: '' }), 3000);
    }
  };

  const { user } = useAuth();

  const handleConfirmPixPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsConfirmingPassword(true);
    setPasswordError('');

    try {
      if (!user?.email) throw new Error('Email não encontrado');
      const credential = EmailAuthProvider.credential(user.email, confirmPassword);
      await reauthenticateWithCredential(auth.currentUser!, credential);
      await persistChanges();
    } catch (err: any) {
      setPasswordError('Senha incorreta. Tente novamente.');
    } finally {
      setIsConfirmingPassword(false);
    }
  };

  const tabs = [
    { id: 'profile', name: 'Perfil Pessoal', icon: User },
    { id: 'company', name: 'Identidade do Negócio', icon: Building2 },
    { id: 'security', name: 'Segurança', icon: ShieldCheck },
  ];

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-20">
      <header>
        <h1 className="text-4xl font-black text-gray-900 dark:text-white tracking-tight">Configurações</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-2">Gerencie sua conta, empresa e preferências da plataforma.</p>
      </header>

      <div className="flex flex-col lg:flex-row gap-8">
        {/* Sidebar Nav */}
        <aside className="lg:w-64 space-y-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl font-bold transition-all ${
                activeTab === tab.id 
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200 dark:shadow-none' 
                  : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800'
              }`}
            >
              <tab.icon className="h-5 w-5" />
              {tab.name}
            </button>
          ))}
        </aside>

        {/* Content Area */}
        <main className="flex-1 bg-white dark:bg-gray-800 rounded-[2.5rem] border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden">
          <form onSubmit={handleSave} className="p-8 space-y-8">
            <AnimatePresence mode="wait">
              {activeTab === 'profile' && (
                <motion.div
                  key="profile"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-6"
                >
                  <div className="flex items-center gap-6 mb-8">
                    <div className="h-20 w-20 rounded-2xl bg-indigo-100 dark:bg-indigo-900 overflow-hidden border-2 border-indigo-50 dark:border-indigo-800 shadow-lg flex items-center justify-center text-2xl font-black text-indigo-600 dark:text-indigo-400">
                      {effectiveProfile?.name?.[0] || effectiveProfile?.email?.[0].toUpperCase()}
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-gray-900 dark:text-white">{effectiveProfile?.name || 'Seu Nome'}</h3>
                      <p className="text-gray-500 uppercase text-[10px] font-black tracking-widest">{profile?.role === 'fornecedor' ? 'Fornecedor' : profile?.role}</p>
                      <div className="mt-2 flex gap-2">
                        { (profile?.plan === 'elite' || profile?.role === 'fornecedor') && (
                          <span className="bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 text-[10px] font-bold px-2 py-1 rounded-full flex items-center gap-1">
                            <BadgeCheck className="h-3 w-3" /> {profile?.role === 'fornecedor' ? 'Membro Premium' : 'Membro Elite'}
                          </span>
                        )}
                        <span className="bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 text-[10px] font-bold px-2 py-1 rounded-full">
                          {profile?.role === 'fornecedor' ? 'Plano Fornecedor' : `Plano ${profile?.plan || 'Start'}`}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-gray-400 uppercase tracking-widest ml-4">Nome Completo do Proprietário</label>
                      <div className="relative">
                        <User className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-300" />
                        <input
                          type="text"
                          required
                          value={formData.name}
                          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                          className="w-full pl-12 pr-4 py-4 bg-gray-50 dark:bg-gray-900 border border-transparent focus:border-indigo-500 rounded-3xl outline-none transition-all font-medium"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-bold text-gray-400 uppercase tracking-widest ml-4">CPF do Proprietário</label>
                      <div className="relative">
                        <CreditCard className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-300" />
                        <input
                          type="text"
                          readOnly
                          value={formData.ownerCpf}
                          className="w-full pl-12 pr-4 py-4 bg-gray-100 dark:bg-gray-800 border border-transparent text-gray-400 rounded-3xl cursor-not-allowed font-medium"
                          placeholder="000.000.000-00"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-bold text-gray-400 uppercase tracking-widest ml-4">Data de Nascimento</label>
                      <div className="relative">
                        <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-300" />
                        <input
                          type="date"
                          required
                          value={formData.birthDate}
                          onChange={(e) => setFormData({ ...formData, birthDate: e.target.value })}
                          className="w-full pl-12 pr-4 py-4 bg-gray-50 dark:bg-gray-900 border border-transparent focus:border-indigo-500 rounded-3xl outline-none transition-all font-medium"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-bold text-gray-400 uppercase tracking-widest ml-4">Email</label>
                      <div className="relative">
                        <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-300" />
                        <input
                          type="email"
                          disabled
                          value={formData.email}
                          className="w-full pl-12 pr-4 py-4 bg-gray-100 dark:bg-gray-800 border border-transparent text-gray-400 rounded-3xl cursor-not-allowed font-medium"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-bold text-gray-400 uppercase tracking-widest ml-4">Telefone / WhatsApp</label>
                      <div className="relative">
                        <Phone className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-300" />
                        <input
                          type="text"
                          readOnly
                          value={formData.phone}
                          className="w-full pl-12 pr-4 py-4 bg-gray-100 dark:bg-gray-800 border border-transparent text-gray-400 rounded-3xl cursor-not-allowed font-medium"
                          placeholder="(00) 00000-0000"
                        />
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

              {activeTab === 'company' && (
                <motion.div
                  key="company"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-8"
                >
                  <div className="flex items-center gap-6 mb-8">
                    <div className="relative group">
                      <input 
                        type="file" 
                        ref={fileInputRef} 
                        className="hidden" 
                        accept="image/*" 
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            const reader = new FileReader();
                            reader.onloadend = async () => {
                              const base64 = reader.result as string;
                              setFormData(prev => ({ ...prev, logo: base64 }));
                              // Proactively update logo if selected
                              try {
                                await updateProfile({ logo: base64 });
                                setSaveMessage({ type: 'success', text: 'Logo atualizado!' });
                              } catch (err) {
                                setSaveMessage({ type: 'error', text: 'Erro ao subir logo.' });
                              }
                            };
                            reader.readAsDataURL(file);
                          }
                        }}
                      />
                      <div className="h-32 w-32 rounded-[2rem] bg-indigo-100 dark:bg-indigo-900 overflow-hidden border-4 border-indigo-50 dark:border-indigo-800 shadow-xl flex items-center justify-center">
                        {formData.logo || effectiveProfile?.logo ? (
                          <img src={formData.logo || effectiveProfile?.logo} alt="Logo" className="h-full w-full object-contain p-2" />
                        ) : (
                          <div className="h-full w-full flex items-center justify-center text-4xl font-black text-indigo-600 dark:text-indigo-400">
                            {effectiveProfile?.tradeName?.[0] || 'L'}
                          </div>
                        )}
                      </div>
                      <button 
                        type="button" 
                        onClick={() => fileInputRef.current?.click()}
                        className="absolute bottom-1 right-1 p-2 bg-indigo-600 text-white rounded-xl shadow-lg hover:scale-110 transition-transform active:scale-95"
                      >
                        <Camera className="h-4 w-4" />
                      </button>
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-gray-900 dark:text-white">Logotipo / Avatar da Empresa</h3>
                      <p className="text-gray-500 text-xs">Esta imagem aparecerá nos orçamentos e relatórios.</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-gray-400 uppercase tracking-widest ml-4">Nome Fantasia (Obrigatório)</label>
                      <div className="relative">
                        <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-300" />
                        <input
                          type="text"
                          required
                          value={formData.tradeName}
                          onChange={(e) => setFormData({ ...formData, tradeName: e.target.value })}
                          className="w-full pl-12 pr-4 py-4 bg-gray-50 dark:bg-gray-900 border border-transparent focus:border-indigo-500 rounded-3xl outline-none transition-all font-medium"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-bold text-gray-400 uppercase tracking-widest ml-4">Razão Social (Opcional)</label>
                      <div className="relative">
                        <FileText className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-300" />
                        <input
                          type="text"
                          value={formData.companyName}
                          onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                          className="w-full pl-12 pr-4 py-4 bg-gray-50 dark:bg-gray-900 border border-transparent focus:border-indigo-500 rounded-3xl outline-none transition-all font-medium"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-bold text-gray-400 uppercase tracking-widest ml-4">CNPJ (Se possuir)</label>
                      <div className="relative">
                        <BadgeCheck className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-300" />
                        <input
                          type="text"
                          readOnly
                          value={formData.cnpj}
                          className="w-full pl-12 pr-4 py-4 bg-gray-100 dark:bg-gray-800 border border-transparent text-gray-400 rounded-3xl cursor-not-allowed font-medium"
                          placeholder="00.000.000/0000-00"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-bold text-gray-400 uppercase tracking-widest ml-4">Data de Abertura / Início</label>
                      <div className="relative">
                        <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-300" />
                        <input
                          type="date"
                          value={formData.startDate}
                          onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                          className="w-full pl-12 pr-4 py-4 bg-gray-50 dark:bg-gray-900 border border-transparent focus:border-indigo-500 rounded-3xl outline-none transition-all font-medium"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-bold text-gray-400 uppercase tracking-widest ml-4">Chave PIX (Para Recebimentos)</label>
                      <div className="relative">
                        <Wallet className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-300" />
                        <input
                          type="text"
                          value={formData.pixKey}
                          onChange={(e) => setFormData({ ...formData, pixKey: e.target.value })}
                          className="w-full pl-12 pr-4 py-4 bg-gray-50 dark:bg-gray-900 border border-transparent focus:border-indigo-500 rounded-3xl outline-none transition-all font-medium"
                          placeholder="Email, Telefone, CPF ou Aleatória"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-bold text-gray-400 uppercase tracking-widest ml-4">Link Google Meu Negócio</label>
                      <div className="relative">
                        <Globe className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-300" />
                        <input
                          type="text"
                          value={formData.googleGmbLink}
                          onChange={(e) => setFormData({ ...formData, googleGmbLink: e.target.value })}
                          className="w-full pl-12 pr-4 py-4 bg-gray-50 dark:bg-gray-900 border border-transparent focus:border-indigo-500 rounded-3xl outline-none transition-all font-medium"
                          placeholder="https://g.page/r/your-shop..."
                        />
                      </div>
                    </div>
                  </div>

                  <div className="pt-6 border-t border-gray-100 dark:border-gray-700">
                      <h4 className="text-sm font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-indigo-600" />
                        Endereço da Unidade
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <input
                          placeholder="CEP"
                          value={formData.cep}
                          onChange={(e) => setFormData({ ...formData, cep: e.target.value })}
                          className="col-span-1 px-6 py-4 bg-gray-50 dark:bg-gray-900 border border-transparent focus:border-indigo-500 rounded-[1.5rem] outline-none transition-all"
                        />
                        <input
                          placeholder="Rua / Logradouro"
                          value={formData.address.street}
                          onChange={(e) => setFormData({ ...formData, address: { ...formData.address, street: e.target.value }})}
                          className="md:col-span-2 px-6 py-4 bg-gray-50 dark:bg-gray-900 border border-transparent focus:border-indigo-500 rounded-[1.5rem] outline-none transition-all"
                        />
                        <input
                          placeholder="Número"
                          value={formData.address.number}
                          onChange={(e) => setFormData({ ...formData, address: { ...formData.address, number: e.target.value }})}
                          className="px-6 py-4 bg-gray-50 dark:bg-gray-900 border border-transparent focus:border-indigo-500 rounded-[1.5rem] outline-none transition-all"
                        />
                        <input
                          placeholder="Bairro"
                          value={formData.address.neighborhood}
                          onChange={(e) => setFormData({ ...formData, address: { ...formData.address, neighborhood: e.target.value }})}
                          className="px-6 py-4 bg-gray-50 dark:bg-gray-900 border border-transparent focus:border-indigo-500 rounded-[1.5rem] outline-none transition-all"
                        />
                        <input
                          placeholder="Cidade"
                          value={formData.address.city}
                          onChange={(e) => setFormData({ ...formData, address: { ...formData.address, city: e.target.value }})}
                          className="px-6 py-4 bg-gray-50 dark:bg-gray-900 border border-transparent focus:border-indigo-500 rounded-[1.5rem] outline-none transition-all"
                        />
                      </div>
                    </div>

                    <div className="pt-6 border-t border-gray-100 dark:border-gray-700 space-y-6">
                      <div>
                        <h4 className="text-sm font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                          <Clock className="h-4 w-4 text-amber-500" />
                          Horário de Funcionamento
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-4">
                          <div className="space-y-2">
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-4">Abertura</label>
                            <input
                              type="time"
                              value={formData.businessHours.open}
                              onChange={(e) => setFormData({ ...formData, businessHours: { ...formData.businessHours, open: e.target.value }})}
                              className="w-full px-6 py-4 bg-gray-50 dark:bg-gray-900 border border-transparent focus:border-indigo-500 rounded-2xl outline-none transition-all font-medium"
                            />
                          </div>
                          <div className="space-y-2">
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-4">Fechamento</label>
                            <input
                              type="time"
                              value={formData.businessHours.close}
                              onChange={(e) => setFormData({ ...formData, businessHours: { ...formData.businessHours, close: e.target.value }})}
                              className="w-full px-6 py-4 bg-gray-50 dark:bg-gray-900 border border-transparent focus:border-indigo-500 rounded-2xl outline-none transition-all font-medium"
                            />
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((day, index) => (
                            <button
                              key={day}
                              type="button"
                              onClick={() => {
                                const days = [...formData.businessHours.days];
                                if (days.includes(index)) {
                                  setFormData({ ...formData, businessHours: { ...formData.businessHours, days: days.filter(d => d !== index) }});
                                } else {
                                  setFormData({ ...formData, businessHours: { ...formData.businessHours, days: [...days, index].sort() }});
                                }
                              }}
                              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                                formData.businessHours.days.includes(index)
                                  ? 'bg-indigo-600 text-white shadow-md'
                                  : 'bg-gray-50 dark:bg-gray-900 text-gray-400 border border-gray-100 dark:border-gray-800'
                              }`}
                            >
                              {day}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-2">
                        <h4 className="text-sm font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                          <FileText className="h-4 w-4 text-indigo-600" />
                          Descrição da Loja / Biografia
                        </h4>
                        <textarea
                          rows={4}
                          value={formData.description}
                          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                          placeholder="Conte um pouco sobre sua oficina/empresa, especialidades e diferenciais. Esta informação será usada pelo Agente IA para apresentar sua loja aos clientes."
                          className="w-full px-6 py-4 bg-gray-50 dark:bg-gray-900 border border-transparent focus:border-indigo-500 rounded-3xl outline-none transition-all font-medium resize-none"
                        />
                      </div>
                    </div>

                </motion.div>
              )}

              {activeTab === 'security' && (
                <motion.div
                  key="security"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-8"
                >
                  <div className="bg-indigo-50 dark:bg-indigo-900/20 p-6 rounded-3xl border border-indigo-100 dark:border-indigo-900/30">
                    <div className="flex items-center gap-4 mb-4">
                      <div className="p-3 bg-white dark:bg-gray-800 rounded-2xl">
                        <ShieldCheck className="h-6 w-6 text-indigo-600" />
                      </div>
                      <div>
                        <h4 className="font-bold text-gray-900 dark:text-white">Autenticação em Duas Etapas</h4>
                        <p className="text-sm text-gray-500">Adicione uma camada extra de segurança à sua conta.</p>
                      </div>
                    </div>
                    <button type="button" className="px-6 py-2 bg-indigo-600 text-white rounded-xl font-bold text-sm shadow-md hover:scale-105 transition-all">Ativar Agora</button>
                  </div>

                  <div className="space-y-4">
                    <h4 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
                      <Lock className="h-4 w-4 text-rose-600" />
                      Alterar Senha
                    </h4>
                    <p className="text-xs text-gray-500">Para sua segurança, enviaremos um link de redefinição para o seu email cadastrado.</p>
                    <button 
                      type="button" 
                      onClick={() => {
                        if (user?.email) {
                          sendPasswordResetEmail(auth, user.email)
                            .then(() => alert('Email de redefinição enviado!'))
                            .catch(err => alert('Erro ao enviar email: ' + err.message));
                        }
                      }}
                      className="inline-flex items-center gap-2 px-6 py-3 border border-rose-100 dark:border-rose-900/30 text-rose-600 dark:text-rose-400 rounded-2xl font-bold text-sm hover:bg-rose-50 dark:hover:bg-rose-900/10 transition-all"
                    >
                      Enviar Email de Redefinição
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="pt-8 border-t border-gray-100 dark:border-gray-700 flex items-center justify-between">
              <div>
                {saveMessage.text && (
                  <motion.p 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`text-sm font-black ${saveMessage.type === 'success' ? 'text-emerald-600' : 'text-rose-600'}`}
                  >
                    {saveMessage.text}
                  </motion.p>
                )}
              </div>
              <button
                type="submit"
                disabled={isSaving}
                className="flex items-center gap-2 px-10 py-4 bg-indigo-600 text-white rounded-[1.5rem] font-bold shadow-xl shadow-indigo-200 dark:shadow-none hover:scale-105 transition-all active:scale-95 disabled:opacity-50"
              >
                {isSaving ? 'Salvando...' : (
                  <>
                    <Save className="h-5 w-5" />
                    Salvar Alterações
                  </>
                )}
              </button>
            </div>
          </form>
        </main>
      </div>

      {/* PIX Password Confirmation Modal */}
      <AnimatePresence>
        {isPixModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsPixModalOpen(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative bg-white dark:bg-gray-800 rounded-[2rem] shadow-2xl w-full max-w-md p-8 overflow-hidden"
            >
              <div className="text-center space-y-4">
                <div className="h-16 w-16 bg-amber-100 dark:bg-amber-900/30 rounded-2xl flex items-center justify-center mx-auto">
                  <Lock className="h-8 w-8 text-amber-600" />
                </div>
                <div>
                  <h3 className="text-xl font-black text-gray-900 dark:text-white uppercase tracking-tighter">Confirmar Alteração</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Você está alterando sua chave PIX de recebimento. Por segurança, digite sua senha de acesso.</p>
                </div>

                <form onSubmit={handleConfirmPixPassword} className="space-y-4 pt-4 text-left">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-4">Senha de Acesso</label>
                    <input
                      type="password"
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full px-6 py-4 bg-gray-50 dark:bg-gray-900 border border-transparent focus:border-indigo-500 rounded-2xl outline-none transition-all font-medium"
                    />
                    {passwordError && (
                      <p className="text-[10px] text-rose-500 font-bold ml-4 animate-shake">{passwordError}</p>
                    )}
                  </div>

                  <div className="flex flex-col sm:flex-row gap-3 pt-4">
                    <button
                      type="button"
                      onClick={() => setIsPixModalOpen(false)}
                      className="flex-1 py-4 px-6 bg-gray-100 dark:bg-gray-700 text-gray-500 font-bold rounded-2xl hover:bg-gray-200 transition-all"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={isConfirmingPassword}
                      className="flex-1 py-4 px-6 bg-indigo-600 text-white font-bold rounded-2xl hover:bg-indigo-700 shadow-lg shadow-indigo-200 dark:shadow-none transition-all flex items-center justify-center gap-2"
                    >
                      {isConfirmingPassword ? (
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : 'Validar e Salvar'}
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

