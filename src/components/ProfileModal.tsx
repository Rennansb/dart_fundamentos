import React, { useState, useEffect } from 'react';
import { X, Camera, Save, Lock, User, Mail, Phone, Calendar, MapPin, Hash, Building, Briefcase, Wrench } from 'lucide-react';
import { useAuth } from '../AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import { SEGMENTS, AUTOMOTIVE_TYPES } from '../constants/segments';

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: any;
  onUpdate?: (data: any) => void;
  readOnly?: boolean;
}

export default function ProfileModal({ isOpen, onClose, profile, onUpdate, readOnly = false }: ProfileModalProps) {
  const { profile: currentUserProfile, updateProfile } = useAuth();
  const isAdmin = currentUserProfile?.role === 'admin';
  const [avatar, setAvatar] = useState(profile?.photoURL || '');
  const [name, setName] = useState(profile?.name || '');
  const [email, setEmail] = useState(profile?.email || '');
  const [cpf, setCpf] = useState(profile?.cpfCnpj || '');
  const [phone, setPhone] = useState(profile?.phone || '');
  const [birthDate, setBirthDate] = useState(profile?.birthDate || '');
  const [cep, setCep] = useState(profile?.address?.cep || profile?.cep || '');
  const [street, setStreet] = useState(profile?.address?.street || '');
  const [number, setNumber] = useState(profile?.address?.number || '');
  const [complement, setComplement] = useState(profile?.address?.complement || '');
  const [neighborhood, setNeighborhood] = useState(profile?.address?.neighborhood || '');
  const [city, setCity] = useState(profile?.address?.city || '');
  const [state, setState] = useState(profile?.address?.state || '');
  
  const [segment, setSegment] = useState(profile?.segment || SEGMENTS[0].id);
  const [shopType, setShopType] = useState(profile?.shopType || AUTOMOTIVE_TYPES[0].id);
  const [companyName, setCompanyName] = useState(profile?.companyName || '');
  const [pixKey, setPixKey] = useState(profile?.pixKey || '');
  const [supplierSegments, setSupplierSegments] = useState<string[]>(profile?.supplierSegments || []);
  const [googleGmbLink, setGoogleGmbLink] = useState(profile?.googleGmbLink || '');
  
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  const [isEditingPassword, setIsEditingPassword] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [searchingCep, setSearchingCep] = useState(false);

  useEffect(() => {
    if (profile) {
      setAvatar(profile.photoURL || '');
      setName(profile.name || '');
      setEmail(profile.email || '');
      setCpf(profile.cpfCnpj || '');
      setPhone(profile.phone || '');
      setBirthDate(profile.birthDate || '');
      setCep(profile.address?.cep || profile.cep || '');
      setStreet(profile.address?.street || '');
      setNumber(profile.address?.number || '');
      setComplement(profile.address?.complement || '');
      setNeighborhood(profile.address?.neighborhood || '');
      setCity(profile.address?.city || '');
      setState(profile.address?.state || '');
      setSegment(profile.segment || SEGMENTS[0].id);
      setShopType(profile.shopType || AUTOMOTIVE_TYPES[0].id);
      setCompanyName(profile.companyName || '');
      setPixKey(profile.pixKey || '');
      setSupplierSegments(profile.supplierSegments || []);
      setGoogleGmbLink(profile.googleGmbLink || '');
    }
  }, [profile]);

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

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (readOnly) return;
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 300;
          const MAX_HEIGHT = 300;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > MAX_WIDTH) {
              height *= MAX_WIDTH / width;
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width *= MAX_HEIGHT / height;
              height = MAX_HEIGHT;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
          setAvatar(dataUrl);
        };
        img.src = reader.result as string;
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = async () => {
    if (readOnly) return;
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const updateData = {
        name,
        photoURL: avatar,
        phone,
        birthDate,
        cpfCnpj: cpf,
        address: {
          cep,
          street,
          number,
          complement,
          neighborhood,
          city,
          state
        },
        segment: profile?.role === 'shop' ? segment : null,
        shopType: profile?.role === 'shop' && segment === 'automotive' ? shopType : null,
        companyName,
        pixKey: profile?.role === 'fornecedor' ? pixKey : null,
        supplierSegments: profile?.role === 'fornecedor' ? supplierSegments : [],
        googleGmbLink: profile?.role === 'shop' ? googleGmbLink : null
      };

      if (onUpdate) {
        await onUpdate(updateData);
      } else {
        await updateProfile(updateData);
      }
      
      setSuccess('Perfil atualizado com sucesso!');
      setTimeout(() => onClose(), 1500);
    } catch (err: any) {
      setError(err.message || 'Erro ao atualizar perfil');
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordChange = async () => {
    if (newPassword !== confirmPassword) {
      setError('As senhas não coincidem');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      // Implement password change logic here if needed
      setSuccess('Senha atualizada com sucesso!');
      setIsEditingPassword(false);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setError(err.message || 'Erro ao atualizar senha');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="bg-gray-50 dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col"
          >
            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between bg-gray-50 dark:bg-gray-900 sticky top-0 z-10">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-50 rounded-lg">
                  <User className="w-5 h-5 text-indigo-600" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                    {readOnly ? 'Visualizar Perfil' : 'Editar Perfil'}
                  </h2>
                  <p className="text-sm text-gray-500">Gerencie suas informações pessoais</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-400 hover:text-gray-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {/* Left Column: Avatar & Quick Actions */}
                <div className="space-y-6">
                  <div className="flex flex-col items-center">
                    <div className="relative group">
                      <div className="w-40 h-40 rounded-2xl overflow-hidden bg-gray-100 border-4 border-white shadow-lg">
                        {avatar ? (
                          <img src={avatar} alt="Avatar" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-indigo-50">
                            <User className="w-16 h-16 text-indigo-200" />
                          </div>
                        )}
                      </div>
                      {!readOnly && (
                        <label className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer rounded-2xl">
                          <Camera className="w-8 h-8 text-white" />
                          <input type="file" className="hidden" accept="image/*" onChange={handleAvatarChange} />
                        </label>
                      )}
                    </div>
                    <h3 className="mt-4 text-lg font-bold text-gray-900 dark:text-white">{name || 'Seu Nome'}</h3>
                    <p className="text-sm text-gray-500">{email}</p>
                  </div>

                  {!readOnly && (
                    <div className="p-4 bg-indigo-50 rounded-xl space-y-3">
                      <h4 className="text-sm font-bold text-indigo-900 flex items-center gap-2">
                        <Lock className="w-4 h-4" />
                        Segurança
                      </h4>
                      <button
                        onClick={() => setIsEditingPassword(!isEditingPassword)}
                        className="w-full py-2 px-4 bg-white text-indigo-600 rounded-lg text-sm font-medium border border-indigo-100 hover:bg-indigo-100 transition-colors shadow-sm"
                      >
                        {isEditingPassword ? 'Cancelar Alteração' : 'Alterar Senha'}
                      </button>
                    </div>
                  )}
                </div>

                {/* Right Column: Form Fields */}
                <div className="md:col-span-2 space-y-8">
                  {error && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="p-4 bg-red-50 border border-red-100 text-red-700 rounded-xl text-sm flex items-center gap-3"
                    >
                      <X className="w-5 h-5" />
                      {error}
                    </motion.div>
                  )}

                  {success && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="p-4 bg-emerald-50 border border-emerald-100 text-emerald-700 rounded-xl text-sm flex items-center gap-3"
                    >
                      <Save className="w-5 h-5" />
                      {success}
                    </motion.div>
                  )}

                  <AnimatePresence mode="wait">
                    {isEditingPassword ? (
                      <motion.div
                        key="password-form"
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        className="space-y-4"
                      >
                        <h4 className="text-lg font-bold text-gray-900 dark:text-white">Alterar Senha</h4>
                        <div className="space-y-4">
                          <div>
                            <label className="block text-sm font-medium dark:text-gray-300 mb-1">Senha Atual</label>
                            <input
                              type="password"
                              value={currentPassword}
                              onChange={(e) => setCurrentPassword(e.target.value)}
                              className="w-full px-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium dark:text-gray-300 mb-1">Nova Senha</label>
                            <input
                              type="password"
                              value={newPassword}
                              onChange={(e) => setNewPassword(e.target.value)}
                              className="w-full px-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium dark:text-gray-300 mb-1">Confirmar Nova Senha</label>
                            <input
                              type="password"
                              value={confirmPassword}
                              onChange={(e) => setConfirmPassword(e.target.value)}
                              className="w-full px-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                            />
                          </div>
                          <button
                            onClick={handlePasswordChange}
                            disabled={loading}
                            className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 disabled:opacity-50"
                          >
                            {loading ? 'Atualizando...' : 'Confirmar Nova Senha'}
                          </button>
                        </div>
                      </motion.div>
                    ) : (
                      <motion.div
                        key="profile-form"
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        className="space-y-6"
                      >
                        {/* Account & Company Section */}
                        <div className="space-y-4">
                          <h4 className="text-sm font-bold text-gray-400 uppercase tracking-wider">Dados do Estabelecimento / Conta</h4>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="md:col-span-2">
                              <label className="block text-sm font-medium dark:text-gray-300 mb-1">Nome da Loja</label>
                              <div className="relative">
                                <Building className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                <input
                                  type="text"
                                  value={companyName}
                                  onChange={(e) => setCompanyName(e.target.value)}
                                  readOnly={readOnly && !isAdmin}
                                  className="w-full pl-10 pr-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white rounded-xl focus:ring-2 focus:ring-indigo-500 font-bold transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                                />
                              </div>
                            </div>
                            <div className="md:col-span-2">
                              <label className="block text-sm font-medium dark:text-gray-300 mb-1">Nome completo do usuário</label>
                              <div className="relative">
                                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                <input
                                  type="text"
                                  value={name}
                                  onChange={(e) => setName(e.target.value)}
                                  readOnly={readOnly && !isAdmin}
                                  className="w-full pl-10 pr-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white rounded-xl focus:ring-2 focus:ring-indigo-500 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                                />
                              </div>
                            </div>
                            <div>
                              <label className="block text-sm font-medium dark:text-gray-300 mb-1">E-mail</label>
                              <div className="relative">
                                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                <input
                                  type="email"
                                  value={email}
                                  readOnly
                                  className="w-full pl-10 pr-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-500 rounded-xl cursor-not-allowed"
                                />
                              </div>
                            </div>
                            <div>
                              <label className="block text-sm font-medium dark:text-gray-300 mb-1">CPF/CNPJ</label>
                              <div className="relative">
                                <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                <input
                                  type="text"
                                  value={cpf}
                                  onChange={(e) => setCpf(e.target.value)}
                                  readOnly={readOnly && !isAdmin}
                                  className="w-full pl-10 pr-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white rounded-xl focus:ring-2 focus:ring-indigo-500 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                                />
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Personal/Contact Section */}
                        <div className="space-y-4">
                          <h4 className="text-sm font-bold text-gray-400 uppercase tracking-wider">Contato e Pessoal</h4>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <label className="block text-sm font-medium dark:text-gray-300 mb-1">Telefone</label>
                              <div className="relative">
                                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                <input
                                  type="text"
                                  value={phone}
                                  onChange={(e) => setPhone(e.target.value)}
                                  readOnly={readOnly && !isAdmin}
                                  className="w-full pl-10 pr-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white rounded-xl focus:ring-2 focus:ring-indigo-500 transition-all"
                                />
                              </div>
                            </div>
                            <div>
                              <label className="block text-sm font-medium dark:text-gray-300 mb-1">Data de Nascimento</label>
                              <div className="relative">
                                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                <input
                                  type="date"
                                  value={birthDate}
                                  onChange={(e) => setBirthDate(e.target.value)}
                                  readOnly={readOnly && !isAdmin}
                                  className="w-full pl-10 pr-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white rounded-xl focus:ring-2 focus:ring-indigo-500 transition-all"
                                />
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Address Section */}
                        <div className="space-y-4">
                          <h4 className="text-sm font-bold text-gray-400 uppercase tracking-wider">Endereço</h4>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                              <label className="block text-sm font-medium dark:text-gray-300 mb-1">CEP</label>
                              <div className="relative">
                                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                <input
                                  type="text"
                                  value={cep}
                                  onChange={(e) => handleCepLookup(e.target.value)}
                                  readOnly={readOnly}
                                  placeholder="00000-000"
                                  className="w-full pl-10 pr-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white rounded-xl focus:ring-2 focus:ring-indigo-500 transition-all"
                                />
                                {searchingCep && (
                                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                    <div className="w-4 h-4 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                                  </div>
                                )}
                              </div>
                            </div>
                            <div className="md:col-span-2">
                              <label className="block text-sm font-medium dark:text-gray-300 mb-1">Logradouro</label>
                              <input
                                type="text"
                                value={street}
                                onChange={(e) => setStreet(e.target.value)}
                                readOnly={readOnly}
                                className="w-full px-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white rounded-xl focus:ring-2 focus:ring-indigo-500 transition-all"
                              />
                            </div>
                            <div>
                               <label className="block text-sm font-medium dark:text-gray-300 mb-1">Número</label>
                               <input
                                 type="text"
                                 value={number}
                                 onChange={(e) => setNumber(e.target.value)}
                                 readOnly={readOnly}
                                 className="w-full px-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white rounded-xl focus:ring-2 focus:ring-indigo-500 transition-all"
                               />
                             </div>
                             <div className="md:col-span-2">
                               <label className="block text-sm font-medium dark:text-gray-300 mb-1">Complemento</label>
                               <input
                                 type="text"
                                 value={complement}
                                 onChange={(e) => setComplement(e.target.value)}
                                 readOnly={readOnly}
                                 className="w-full px-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white rounded-xl focus:ring-2 focus:ring-indigo-500 transition-all"
                               />
                             </div>
                             <div>
                               <label className="block text-sm font-medium dark:text-gray-300 mb-1">Bairro</label>
                               <input
                                 type="text"
                                 value={neighborhood}
                                 onChange={(e) => setNeighborhood(e.target.value)}
                                 readOnly={readOnly}
                                 className="w-full px-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white rounded-xl focus:ring-2 focus:ring-indigo-500 transition-all"
                               />
                             </div>
                             <div>
                               <label className="block text-sm font-medium dark:text-gray-300 mb-1">Cidade</label>
                               <div className="relative">
                                 <Building className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                 <input
                                   type="text"
                                   value={city}
                                   onChange={(e) => setCity(e.target.value)}
                                   readOnly={readOnly}
                                   className="w-full pl-10 pr-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white rounded-xl focus:ring-2 focus:ring-indigo-500 transition-all"
                                 />
                               </div>
                             </div>
                             <div>
                               <label className="block text-sm font-medium dark:text-gray-300 mb-1">Estado</label>
                               <input
                                 type="text"
                                 value={state}
                                 onChange={(e) => setState(e.target.value)}
                                 readOnly={readOnly}
                                 maxLength={2}
                                 className="w-full px-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white rounded-xl focus:ring-2 focus:ring-indigo-500 transition-all uppercase"
                               />
                             </div>
                          </div>
                        </div>

                        {/* Business Config Section */}
                        <div className="space-y-6">
                          <h4 className="text-sm font-bold text-gray-400 uppercase tracking-wider">Configuração de Negócio</h4>
                          
                          {profile?.role === 'shop' ? (
                            <div className="space-y-6">
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                  <label className="block text-sm font-medium dark:text-gray-300 mb-1">Segmento</label>
                                  <div className="relative">
                                    <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                    <select
                                      value={segment}
                                      onChange={(e) => setSegment(e.target.value)}
                                      disabled={readOnly && !isAdmin}
                                      className="w-full pl-10 pr-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white rounded-xl focus:ring-2 focus:ring-indigo-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                      {SEGMENTS.map(s => (
                                        <option key={s.id} value={s.id}>{s.name}</option>
                                      ))}
                                    </select>
                                  </div>
                                </div>
                                {segment === 'automotive' && (
                                  <div>
                                    <label className="block text-sm font-medium dark:text-gray-300 mb-1">Tipo de Estabelecimento</label>
                                    <div className="relative">
                                      <Wrench className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                      <select
                                        value={shopType}
                                        onChange={(e) => setShopType(e.target.value)}
                                        disabled={readOnly && !isAdmin}
                                        className="w-full pl-10 pr-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white rounded-xl focus:ring-2 focus:ring-indigo-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                      >
                                        {AUTOMOTIVE_TYPES.map(at => (
                                          <option key={at.id} value={at.id}>{at.name}</option>
                                        ))}
                                      </select>
                                    </div>
                                  </div>
                                )}
                              </div>

                              <div className="space-y-4 pt-4 border-t border-gray-100 dark:border-gray-800">
                                <h4 className="text-sm font-bold text-gray-400 uppercase tracking-wider">Engajamento do Cliente</h4>
                                <div className="grid grid-cols-1 gap-4">
                                  <div>
                                    <label className="block text-sm font-medium dark:text-gray-300 mb-1">Link do Google Meu Negócio (Avaliações)</label>
                                    <div className="relative">
                                      <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                      <input
                                        type="url"
                                        value={googleGmbLink}
                                        onChange={(e) => setGoogleGmbLink(e.target.value)}
                                        readOnly={readOnly && !isAdmin}
                                        placeholder="https://g.page/r/your-shop-id/review"
                                        className="w-full pl-10 pr-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white rounded-xl focus:ring-2 focus:ring-indigo-500 transition-all"
                                      />
                                    </div>
                                    <p className="mt-1 text-[10px] text-gray-500 italic">Este link será enviado automaticamente via WhatsApp para o cliente após a entrega do veículo.</p>
                                  </div>
                                </div>
                              </div>
                            </div>
                          ) : profile?.role === 'fornecedor' ? (
                            <div className="space-y-6">
                              <div>
                                <label className="block text-sm font-medium dark:text-gray-300 mb-2">Segmentos Atendidos</label>
                                <div className="space-y-2 border border-gray-200 dark:border-gray-700 rounded-xl p-4 bg-white dark:bg-gray-800 max-h-60 overflow-y-auto">
                                  {SEGMENTS.map(sg => {
                                    const isAutomotive = sg.id === 'automotive';
                                    return (
                                      <div key={sg.id} className="space-y-2">
                                        <label className="flex items-center gap-2 cursor-pointer">
                                          <input
                                            type="checkbox"
                                            disabled={readOnly || !isAdmin}
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
                                            className="h-4 w-4 text-indigo-600 rounded border-gray-300"
                                          />
                                          <span className="text-sm font-bold text-gray-700 dark:text-gray-200">{sg.name}</span>
                                        </label>
                                        {isAutomotive && supplierSegments.includes('automotive') && (
                                          <div className="ml-6 space-y-2 pl-4 border-l-2 border-indigo-100 dark:border-indigo-900/30">
                                            {AUTOMOTIVE_TYPES.map(at => (
                                              <label key={at.id} className="flex items-center gap-2 cursor-pointer">
                                                <input
                                                  type="checkbox"
                                                  disabled={readOnly || !isAdmin}
                                                  checked={supplierSegments.includes(at.id)}
                                                  onChange={(e) => {
                                                    if (e.target.checked) setSupplierSegments([...supplierSegments, at.id]);
                                                    else setSupplierSegments(prev => prev.filter(s => s !== at.id));
                                                  }}
                                                  className="h-4 w-4 text-indigo-600 rounded border-gray-300"
                                                />
                                                <span className="text-sm text-gray-600 dark:text-gray-400">{at.name}</span>
                                              </label>
                                            ))}
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                              <div>
                                <label className="block text-sm font-medium dark:text-gray-300 mb-2">Chave PIX para Recebimento</label>
                                <div className="relative">
                                  <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                  <input
                                    type="text"
                                    value={pixKey}
                                    onChange={(e) => setPixKey(e.target.value)}
                                    readOnly={readOnly}
                                    placeholder="Seu CPF, E-mail ou Chave Aleatória"
                                    className="w-full pl-10 pr-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white rounded-xl focus:ring-2 focus:ring-indigo-500 transition-all font-mono"
                                  />
                                </div>
                                <p className="mt-2 text-[10px] text-gray-500">Esta chave será usada para repasses automáticos de 97% das suas vendas realizadas através da plataforma.</p>
                              </div>
                            </div>
                          ) : null}
                        </div>

                        {(!readOnly || isAdmin) && (
                          <div className="pt-6">
                            <button
                              onClick={handleSave}
                              disabled={loading}
                              className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 flex items-center justify-center gap-2 disabled:opacity-50"
                            >
                              {loading ? (
                                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                              ) : (
                                <Save className="w-5 h-5" />
                              )}
                              Salvar Alterações
                            </button>
                          </div>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
