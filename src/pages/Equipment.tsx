import React, { useState, useEffect, useRef } from 'react';
import { 
  Plus, Search, X, ChevronDown, ChevronUp, Trash2, 
  Car, Bike, Calendar, User, Hash, Palette, 
  Fuel, FileText, Filter, MoreVertical, Edit2, MessageSquare, Camera, Sparkles, Loader2
} from 'lucide-react';
import { db } from '../firebase';
import { collection, query, where, getDocs, addDoc, serverTimestamp, onSnapshot, orderBy, deleteDoc, doc } from 'firebase/firestore';
import { useAuth } from '../AuthContext';
import { handleFirestoreError, OperationType } from '../utils/firestoreErrors';
import { motion, AnimatePresence } from 'framer-motion';
import { externalApi } from '../services/externalApiService';
import { recognizePlate } from '../services/aiService';

export default function Equipment() {
  const { profile, user, selectedCompanyId } = useAuth();
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [shops, setShops] = useState<any[]>([]);
  const [selectedShopId, setSelectedShopId] = useState<string>('');
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [employees, setEmployees] = useState<any[]>([]);
  const [employeeId, setEmployeeId] = useState('');
  const [filterEmployeeId, setFilterEmployeeId] = useState('');

  // Form state
  const [customerCode, setCustomerCode] = useState('');
  const [customer, setCustomer] = useState<any>(null);
  const [vehicleType, setVehicleType] = useState<'carro' | 'moto'>('carro');
  const [brand, setBrand] = useState('');
  const [model, setModel] = useState('');
  const [year, setYear] = useState('');
  const [modelYear, setModelYear] = useState('');
  const [color, setColor] = useState('');
  const [fuel, setFuel] = useState('');
  const [entryDate, setEntryDate] = useState(new Date().toISOString().split('T')[0]);
  const [observation, setObservation] = useState('');
  const [plate, setPlate] = useState('');
  const [engine, setEngine] = useState('');
  const [isFetchingPlate, setIsFetchingPlate] = useState(false);

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
  }, [profile?.role, user, selectedCompanyId]);

  useEffect(() => {
    if (!user) return;
    const companyId = selectedCompanyId || selectedShopId || profile?.companyId || profile?.id;
    if (!companyId) {
      setEmployees([]);
      return;
    }

    const q = query(collection(db, 'users'), where('companyId', '==', companyId), where('role', '==', 'employee'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setEmployees(data);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'users');
    });
    return () => unsubscribe();
  }, [profile?.companyId, profile?.id, selectedShopId, selectedCompanyId, user]);

  useEffect(() => {
    if (!user) return;
    let q;
    const companyId = selectedCompanyId || selectedShopId || profile?.companyId || profile?.id;
    
    if (profile?.role === 'admin' && !selectedShopId) {
      q = query(collection(db, 'vehicles'), orderBy('createdAt', 'desc'));
    } else {
      if (!companyId) return;
      q = query(
        collection(db, 'vehicles'),
        where('companyId', '==', companyId),
        orderBy('createdAt', 'desc')
      );
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setVehicles(data);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'vehicles');
    });

    return () => unsubscribe();
  }, [profile, selectedShopId, selectedCompanyId, user]);

  const handleCustomerLookup = async () => {
    const companyId = profile?.companyId || profile?.id;
    if (!companyId || !customerCode) return;
    
    const q = query(
      collection(db, 'customers'), 
      where('companyId', '==', companyId), 
      where('code', '==', customerCode.toUpperCase())
    );
    
    try {
      const snapshot = await getDocs(q);
      if (!snapshot.empty) {
        const doc = snapshot.docs[0];
        setCustomer({ id: doc.id, ...doc.data() });
      } else {
        setCustomer(null);
        alert("Cliente não encontrado.");
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, 'customers');
    }
  };

  const handleScanPlate = () => {
    fileInputRef.current?.click();
  };

  const processPlateImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsScanning(true);
    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64 = reader.result as string;
        const result = await recognizePlate(base64, user?.uid || '', profile?.companyId || '');
        
        if (result.error) {
          alert("Não foi possível identificar a placa: " + result.error);
        } else {
          if (result.plate) setPlate(result.plate.toUpperCase());
          if (result.brand) setBrand(result.brand);
          if (result.model) setModel(result.model);
          if (result.year) setYear(result.year.toString());
          if (result.color) setColor(result.color);
        }
        setIsScanning(false);
      };
      reader.readAsDataURL(file);
    } catch (error) {
      console.error("LPR Error:", error);
      alert("Ocorreu um erro ao processar a imagem. Tente preenchimento manual.");
      setIsScanning(false);
    }
  };

  const resetForm = () => {
    setCustomerCode('');
    setCustomer(null);
    setVehicleType('carro');
    setBrand('');
    setModel('');
    setYear('');
    setModelYear('');
    setColor('');
    setFuel('');
    setEntryDate(new Date().toISOString().split('T')[0]);
    setObservation('');
    setPlate('');
    setEngine('');
    setEmployeeId('');
  };

  const handlePlateLookup = async () => {
    if (!plate.trim()) {
      alert("Por favor, digite a placa.");
      return;
    }
    
    setIsFetchingPlate(true);
    try {
      const data = await externalApi.getVehicleByPlate(plate);
      
      const isMoto = data.tipoVeiculo === 2 || data.tipo === 'MOTO';
      
      setBrand(data.marca || '');
      setModel(data.modelo || '');
      setYear(data.anoFabricacao?.toString() || '');
      setModelYear(data.anoModelo?.toString() || '');
      setColor(data.cor || '');
      setFuel(data.combustivel || '');
      if (data.chassi) setEngine(data.chassi);
      setVehicleType(isMoto ? 'moto' : 'carro');
    } catch (error: any) {
      console.error("Erro ao buscar placa:", error);
      alert(error.message || "Erro ao buscar dados da placa. Preencha manualmente.");
    } finally {
      setIsFetchingPlate(false);
    }
  };

  const handleCreateVehicle = async (e: React.FormEvent) => {
    e.preventDefault();
    const companyId = selectedCompanyId || profile?.companyId || profile?.id;
    if (!companyId || !customer) {
      alert("Por favor, selecione um cliente primeiro.");
      return;
    }
    if (!brand.trim() || !model.trim()) {
      alert("Marca e Modelo são obrigatórios.");
      return;
    }
    if (profile?.role !== 'employee' && !employeeId) {
      alert("Por favor, selecione um funcionário.");
      return;
    }

    setLoading(true);
    try {
      const vehicleData = {
        companyId,
        customerId: customer.id,
        customerName: customer.name,
        type: vehicleType,
        brand: brand.trim(),
        model: model.trim(),
        serialNumber: (vehicleType === 'carro' ? plate : engine).trim(),
        plate: plate.trim(),
        notes: observation.trim(),
        entryDate,
        year: year.trim(),
        modelYear: modelYear.trim(),
        color: color.trim(),
        fuel: fuel.trim(),
        employeeId: profile?.role === 'employee' ? profile.id : employeeId,
        createdAt: serverTimestamp()
      };

      await addDoc(collection(db, 'vehicles'), vehicleData);
      setIsModalOpen(false);
      resetForm();
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'vehicles');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Tem certeza que deseja excluir este veículo?")) return;
    try {
      await deleteDoc(doc(db, 'vehicles', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `vehicles/${id}`);
    }
  };

  const filteredVehicles = vehicles.filter(v => {
    const matchesSearch = 
      v.customerName?.toLowerCase().includes(search.toLowerCase()) || 
      v.model?.toLowerCase().includes(search.toLowerCase()) ||
      v.plate?.toLowerCase().includes(search.toLowerCase());
    
    const matchesEmployee = profile?.role === 'employee' 
      ? v.employeeId === profile.id 
      : (filterEmployeeId === '' || v.employeeId === filterEmployeeId) || (filterEmployeeId !== '' && !v.employeeId && profile?.role === 'admin' && !selectedShopId);
    
    const matchesShop = profile?.role === 'admin' && selectedShopId ? v.companyId === selectedShopId : true;

    return matchesSearch && matchesEmployee && matchesShop;
  });

  return (
    <div className="min-h-screen bg-gray-50/50 dark:bg-gray-900/50 p-4 sm:p-6 lg:p-8 space-y-8">
      {/* Hidden File Input for Scan */}
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={processPlateImage} 
        accept="image/*" 
        capture="environment" 
        className="hidden" 
      />

      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
        >
          <h1 className="text-4xl font-black text-gray-900 dark:text-white tracking-tight">
            Veículos
          </h1>
          <p className="mt-2 text-gray-500 dark:text-gray-400 font-medium">
            Gerenciamento de frota e entrada de veículos
          </p>
        </motion.div>

        <motion.button
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => setIsModalOpen(true)}
          className="flex items-center justify-center gap-2 px-6 py-3.5 bg-indigo-600 text-white rounded-2xl font-bold shadow-lg shadow-indigo-200 dark:shadow-none hover:bg-indigo-700 transition-all font-inter"
        >
          <Plus className="w-5 h-5" />
          Novo Veículo
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
            placeholder="Buscar por cliente, modelo ou placa..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-12 pr-4 py-3.5 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl shadow-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all dark:text-white"
          />
        </div>

        {profile?.role === 'admin' && (
          <select
            value={selectedShopId}
            onChange={(e) => setSelectedShopId(e.target.value)}
            className="px-4 py-3.5 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl shadow-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all dark:text-white font-bold"
          >
            <option value="">Todas as Lojas</option>
            {shops.map(shop => (
              <option key={shop.id} value={shop.id}>{shop.name || shop.email}</option>
            ))}
          </select>
        )}

        {profile?.role !== 'employee' && (
          <select
            value={filterEmployeeId}
            onChange={(e) => setFilterEmployeeId(e.target.value)}
            className="px-4 py-3.5 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl shadow-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all dark:text-white font-bold"
          >
            <option value="">Todos os funcionários</option>
            {employees.map(emp => (
              <option key={emp.id} value={emp.id}>{emp.name || emp.displayName}</option>
            ))}
          </select>
        )}
      </motion.div>

      {/* Vehicles Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        <AnimatePresence mode="popLayout">
          {filteredVehicles.map((vehicle, index) => (
            <motion.div
              key={vehicle.id}
              layout
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ delay: index * 0.05 }}
              className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700 hover:shadow-md transition-all group relative overflow-hidden"
            >
              <div className="absolute -right-4 -top-4 opacity-[0.03] dark:opacity-[0.05] group-hover:scale-110 transition-transform duration-500">
                {vehicle.type === 'moto' ? <Bike size={120} /> : <Car size={120} />}
              </div>

              <div className="flex justify-between items-start mb-6">
                <div className="flex items-center gap-4">
                  <div className={`p-3 rounded-2xl ${vehicle.type === 'moto' ? 'bg-orange-50 text-orange-600' : 'bg-blue-50 text-blue-600'} dark:bg-gray-700 relative`}>
                    {vehicle.type === 'moto' ? <Bike className="w-6 h-6" /> : <Car className="w-6 h-6" />}
                    {vehicle.createdBy === 'whatsapp' && (
                      <div className="absolute -bottom-1 -right-1 bg-green-500 p-0.5 rounded-full border-2 border-white dark:border-gray-800 shadow-sm">
                        <MessageSquare className="w-2.5 h-2.5 text-white" />
                      </div>
                    )}
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-gray-900 dark:text-white tracking-tight">
                      {vehicle.brand} {vehicle.model}
                    </h3>
                    <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 font-medium">
                      <Hash className="w-3.5 h-3.5" />
                      <span className="uppercase">{vehicle.plate || 'S/ PLACA'}</span>
                    </div>
                  </div>
                </div>
                
                <div className="flex gap-2">
                  <button 
                    onClick={() => handleDelete(vehicle.id)}
                    className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-xl transition-all"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="space-y-1">
                  <p className="text-[10px] uppercase tracking-wider font-bold text-gray-400">Cliente</p>
                  <div className="flex items-center gap-2 text-sm font-bold text-gray-700 dark:text-gray-200">
                    <User className="w-3.5 h-3.5 text-indigo-500" />
                    <span className="truncate">{vehicle.customerName}</span>
                  </div>
                </div>
                <div className="space-y-1 text-right">
                  <p className="text-[10px] uppercase tracking-wider font-bold text-gray-400">Entrada</p>
                  <div className="flex items-center justify-end gap-2 text-sm font-bold text-gray-700 dark:text-gray-200">
                    <Calendar className="w-3.5 h-3.5 text-indigo-500" />
                    <span>{vehicle.entryDate ? new Date(vehicle.entryDate).toLocaleDateString('pt-BR') : '-'}</span>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 pt-4 border-t border-gray-50 dark:border-gray-700">
                {vehicle.color && (
                  <span className="px-3 py-1 bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-[10px] font-bold rounded-full flex items-center gap-1.5">
                    <Palette className="w-3 h-3" />
                    {vehicle.color}
                  </span>
                )}
                {vehicle.fuel && (
                  <span className="px-3 py-1 bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-[10px] font-bold rounded-full flex items-center gap-1.5">
                    <Fuel className="w-3 h-3" />
                    {vehicle.fuel}
                  </span>
                )}
                {(vehicle.year || vehicle.modelYear) && (
                  <span className="px-3 py-1 bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-[10px] font-bold rounded-full">
                    {vehicle.year}/{vehicle.modelYear}
                  </span>
                )}
              </div>

              {vehicle.notes && (
                <div className="mt-4 p-3 bg-indigo-50/30 dark:bg-indigo-500/5 rounded-xl">
                  <p className="text-xs text-indigo-600 dark:text-indigo-400 italic line-clamp-2">
                    "{vehicle.notes}"
                  </p>
                </div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Empty State */}
      {filteredVehicles.length === 0 && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col items-center justify-center py-20 text-center"
        >
          <div className="w-24 h-24 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-6">
            <Car className="w-10 h-10 text-gray-400" />
          </div>
          <h3 className="text-xl font-bold text-gray-900 dark:text-white">Nenhum veículo encontrado</h3>
          <p className="text-gray-500 dark:text-gray-400 mt-2 max-w-xs">
            Comece adicionando seu primeiro veículo clicando no botão acima.
          </p>
        </motion.div>
      )}

      {/* Modern Modal */}
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
              className="relative bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl overflow-hidden flex flex-col border border-gray-200 dark:border-gray-700"
            >
              <div className="p-8 border-b border-gray-50 dark:border-gray-700 flex justify-between items-center bg-indigo-600">
                <div>
                  <h3 className="text-2xl font-black text-white tracking-tight">Novo Veículo</h3>
                  <p className="text-indigo-100 text-sm font-medium mt-1">Identifique o cliente e o veículo</p>
                </div>
                <button 
                  onClick={() => setIsModalOpen(false)} 
                  className="p-2 bg-white/10 hover:bg-white/20 text-white rounded-xl transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="overflow-y-auto p-8 max-h-[70vh]">
                <form onSubmit={handleCreateVehicle} className="space-y-8">
                  {/* AI Scanner Notification */}
                  <div className="p-4 bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-100 dark:border-indigo-800 rounded-3xl flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-indigo-600 rounded-xl">
                        <Camera className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <p className="text-sm font-black text-indigo-900 dark:text-indigo-200">Entrada Via Foto (IA)</p>
                        <p className="text-xs text-indigo-600 dark:text-indigo-400">Escaneie a placa para preencher tudo instantaneamente.</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleScanPlate}
                      disabled={isScanning}
                      className="whitespace-nowrap px-4 py-2 bg-white dark:bg-indigo-600 text-indigo-600 dark:text-white text-[10px] font-black uppercase tracking-widest rounded-xl shadow-lg shadow-indigo-200/50 dark:shadow-none hover:scale-105 transition-all flex items-center gap-2"
                    >
                      {isScanning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                      {isScanning ? 'Lendo...' : 'Escanear Placa'}
                    </button>
                  </div>

                  {/* Customer Lookup Section */}
                  <div className="space-y-4">
                    <label className="text-xs font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400">Dados do Cliente</label>
                    <div className="flex gap-3">
                      <div className="relative flex-1">
                        <Hash className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input 
                          type="text" 
                          placeholder="Código do Cliente" 
                          value={customerCode} 
                          onChange={e => setCustomerCode(e.target.value)} 
                          className="w-full pl-11 pr-4 py-3.5 bg-gray-50 dark:bg-gray-700/50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all dark:text-white font-bold" 
                        />
                      </div>
                      <button 
                        type="button" 
                        onClick={handleCustomerLookup} 
                        className="px-6 py-3.5 bg-gray-900 dark:bg-white dark:text-gray-900 text-white rounded-2xl font-black text-xs hover:bg-gray-800 transition-all shadow-lg shadow-gray-200 dark:shadow-none"
                      >
                        BUSCAR
                      </button>
                    </div>
                    {customer && (
                      <motion.div 
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="p-4 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-100 dark:border-emerald-500/20 rounded-2xl flex items-center gap-3"
                      >
                        <div className="w-10 h-10 bg-emerald-500 rounded-full flex items-center justify-center text-white font-black">
                          {customer.name.charAt(0)}
                        </div>
                        <div>
                          <p className="text-sm font-black text-emerald-900 dark:text-emerald-400">{customer.name}</p>
                          <p className="text-xs text-emerald-600/70 dark:text-emerald-500/60 font-medium">{customer.phone}</p>
                        </div>
                      </motion.div>
                    )}
                  </div>

                  {/* Vehicle Data Section */}
                  <div className="space-y-6">
                    <label className="text-xs font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400">Dados do Veículo</label>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <button
                        type="button"
                        onClick={() => setVehicleType('carro')}
                        className={`p-4 rounded-2xl border-2 transition-all flex flex-col items-center gap-2 ${vehicleType === 'carro' ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-500/10' : 'border-gray-100 dark:border-gray-700'}`}
                      >
                        <Car className={`w-8 h-8 ${vehicleType === 'carro' ? 'text-indigo-600' : 'text-gray-400'}`} />
                        <span className={`text-xs font-black uppercase tracking-widest ${vehicleType === 'carro' ? 'text-indigo-600' : 'text-gray-400'}`}>Carro</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setVehicleType('moto')}
                        className={`p-4 rounded-2xl border-2 transition-all flex flex-col items-center gap-2 ${vehicleType === 'moto' ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-500/10' : 'border-gray-100 dark:border-gray-700'}`}
                      >
                        <Bike className={`w-8 h-8 ${vehicleType === 'moto' ? 'text-indigo-600' : 'text-gray-400'}`} />
                        <span className={`text-xs font-black uppercase tracking-widest ${vehicleType === 'moto' ? 'text-indigo-600' : 'text-gray-400'}`}>Moto</span>
                      </button>
                    </div>

                    <div className="flex gap-3">
                      <div className="relative flex-1">
                        <Hash className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input 
                          type="text" 
                          placeholder="Placa" 
                          value={plate} 
                          onChange={e => setPlate(e.target.value.toUpperCase())} 
                          className="w-full pl-11 pr-4 py-3.5 bg-gray-50 dark:bg-gray-700/50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all dark:text-white font-bold uppercase" 
                          maxLength={7}
                        />
                      </div>
                      <button 
                        type="button" 
                        onClick={handlePlateLookup} 
                        disabled={isFetchingPlate}
                        className="px-6 py-3.5 bg-gray-900 dark:bg-indigo-600 text-white rounded-2xl font-black text-[10px] hover:bg-gray-800 transition-all disabled:opacity-50 shadow-lg shadow-gray-200 dark:shadow-none"
                      >
                        {isFetchingPlate ? <Loader2 className="w-4 h-4 animate-spin" /> : 'DADOS FIPE'}
                      </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-2">Marca</label>
                        <input type="text" placeholder="Ex: Toyota" value={brand} onChange={e => setBrand(e.target.value)} className="w-full px-4 py-3.5 bg-gray-50 dark:bg-gray-700/50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all dark:text-white font-bold" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-2">Modelo</label>
                        <input type="text" placeholder="Ex: Corolla" value={model} onChange={e => setModel(e.target.value)} className="w-full px-4 py-3.5 bg-gray-50 dark:bg-gray-700/50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all dark:text-white font-bold" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-2">Ano Fab.</label>
                        <input type="text" placeholder="2022" value={year} onChange={e => setYear(e.target.value)} className="w-full px-4 py-3.5 bg-gray-50 dark:bg-gray-700/50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all dark:text-white font-bold" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-2">Ano Modelo</label>
                        <input type="text" placeholder="2023" value={modelYear} onChange={e => setModelYear(e.target.value)} className="w-full px-4 py-3.5 bg-gray-50 dark:bg-gray-700/50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all dark:text-white font-bold" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-2">Cor</label>
                        <input type="text" placeholder="Preto" value={color} onChange={e => setColor(e.target.value)} className="w-full px-4 py-3.5 bg-gray-50 dark:bg-gray-700/50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all dark:text-white font-bold" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-2">Combustível</label>
                        <input type="text" placeholder="Flex" value={fuel} onChange={e => setFuel(e.target.value)} className="w-full px-4 py-3.5 bg-gray-50 dark:bg-gray-700/50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all dark:text-white font-bold" />
                      </div>
                      
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-2">Data de Entrada</label>
                        <div className="relative">
                          <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                          <input type="date" value={entryDate} onChange={e => setEntryDate(e.target.value)} className="w-full pl-11 pr-4 py-3.5 bg-gray-50 dark:bg-gray-700/50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all dark:text-white font-bold" />
                        </div>
                      </div>

                      {profile?.role !== 'employee' && (
                        <div className="space-y-2">
                          <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-2">Responsável</label>
                          <select value={employeeId} onChange={e => setEmployeeId(e.target.value)} className="w-full px-4 py-3.5 bg-gray-50 dark:bg-gray-700/50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all dark:text-white font-bold" required>
                            <option value="">Selecione...</option>
                            {employees.map(emp => <option key={emp.id} value={emp.id}>{emp.name}</option>)}
                          </select>
                        </div>
                      )}
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-2">Observações</label>
                      <textarea 
                        placeholder="Detalhes adicionais, avarias, etc..." 
                        value={observation} 
                        onChange={e => setObservation(e.target.value)} 
                        className="w-full px-4 py-3.5 bg-gray-50 dark:bg-gray-700/50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all dark:text-white font-bold min-h-[100px]" 
                      />
                    </div>
                  </div>

                  <div className="flex gap-4 pt-4">
                    <button 
                      type="button" 
                      onClick={() => setIsModalOpen(false)} 
                      className="flex-1 px-8 py-4 text-sm font-black text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
                    >
                      CANCELAR
                    </button>
                    <button 
                      type="submit" 
                      disabled={loading || !customer} 
                      className="flex-1 px-8 py-4 bg-indigo-600 text-white text-sm font-black rounded-2xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 dark:shadow-none disabled:opacity-50"
                    >
                      {loading ? 'SALVANDO...' : 'CADASTRAR VEÍCULO'}
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
