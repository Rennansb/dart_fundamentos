import { useState, useEffect, useRef } from 'react';
import { Plus, Search, X, Download, Upload, FileSpreadsheet, AlertCircle, Edit2, Trash2, Settings2, Package2 } from 'lucide-react';
import { read, utils, writeFile } from 'xlsx';
import { motion, AnimatePresence } from 'framer-motion';
import { db } from '../firebase';
import { collection, query, where, onSnapshot, addDoc, serverTimestamp, updateDoc, deleteDoc, doc, orderBy, writeBatch } from 'firebase/firestore';
import { useAuth } from '../AuthContext';
import { handleFirestoreError, OperationType } from '../utils/firestoreErrors';
import { FULL_SERVICE_CATALOG } from '../constants/serviceCatalog';
import { PLAN_LIMITS } from '../utils/planLimits';

export default function Services() {
  const { profile, effectiveProfile, user, selectedCompanyId } = useAuth();
  const [services, setServices] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [filterVehicleType, setFilterVehicleType] = useState('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingService, setEditingService] = useState<any>(null);
  const [newService, setNewService] = useState({
    name: '',
    category: '',
    vehicleType: 'carro',
    laborPrice: 0,
    description: ''
  });

  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isExcelImportModalOpen, setIsExcelImportModalOpen] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [excelData, setExcelData] = useState<any[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!user) return;
    console.log("Services useEffect, profile:", profile);
    const companyId = selectedCompanyId || profile?.companyId;
    if (!companyId) return;

    const q = query(
      collection(db, 'services'), 
      where('companyId', '==', companyId),
      orderBy('createdAt', 'desc')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      console.log('Services data:', data);
      setServices(data);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'services');
    });

    return () => unsubscribe();
  }, [effectiveProfile, selectedCompanyId]);

  const confirmImportCatalog = async () => {
    const companyId = selectedCompanyId || profile?.companyId;
    if (!companyId) return;
    setIsImporting(true);

    try {
      // Filtrar catálogo baseado no tipo de estabelecimento
      const filteredCatalog = FULL_SERVICE_CATALOG.filter(service => {
        if (!effectiveProfile?.shopType) return true; // Se não tiver tipo, importa tudo
        
        // Se for oficina, importa carro e moto
        if (effectiveProfile?.shopType === 'oficina') {
          return service.vehicleType === 'carro' || service.vehicleType === 'moto';
        }
        
        // Para os demais, importa apenas o tipo correspondente
        return service.vehicleType === effectiveProfile?.shopType;
      });

      console.log('Starting batch import, catalog size:', filteredCatalog.length);
      const batch = writeBatch(db);
      
      filteredCatalog.forEach((service) => {
        const docRef = doc(collection(db, 'services'));
        batch.set(docRef, {
          ...service,
          companyId: companyId,
          defaultPrice: service.laborPrice || 0,
          createdAt: serverTimestamp()
        });
      });
      
      console.log('Committing batch...');
      await batch.commit();
      console.log('Batch committed successfully.');
      alert('Catálogo importado com sucesso!');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'services');
    } finally {
      setIsImporting(false);
      setIsImportModalOpen(false);
    }
  };

  const handleExcelUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const bstr = evt.target?.result;
      const wb = read(bstr, { type: 'binary' });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      const data = utils.sheet_to_json(ws);
      
      const mappedData = data.map((row: any) => ({
        name: row.Nome || row.name || '',
        category: row.Categoria || row.category || '',
        vehicleType: row.Tipo || row.vehicleType || 'carro',
        laborPrice: parseFloat(row.MãoObjObra || row.laborPrice || 0),
        description: row.Descrição || row.description || ''
      }));
      setExcelData(mappedData);
    };
    reader.readAsBinaryString(file);
  };

  const confirmExcelImport = async () => {
    const companyId = selectedCompanyId || profile?.companyId;
    if (!companyId || excelData.length === 0) return;
    setIsImporting(true);

    try {
      const batch = writeBatch(db);
      excelData.forEach((service) => {
        const docRef = doc(collection(db, 'services'));
        batch.set(docRef, {
          ...service,
          companyId: companyId,
          defaultPrice: service.laborPrice || 0,
          createdAt: serverTimestamp()
        });
      });
      await batch.commit();
      alert(`${excelData.length} serviços importados com sucesso!`);
      setIsExcelImportModalOpen(false);
      setExcelData([]);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'services');
    } finally {
      setIsImporting(false);
    }
  };

  const handleExportExcel = () => {
    if (services.length === 0) {
      alert('Não há serviços para exportar.');
      return;
    }

    const canExport = profile?.role === 'admin' || PLAN_LIMITS[effectiveProfile?.plan || 'free'].exportExcel;
    if (!canExport) {
      alert("A exportação de Excel está disponível nos planos Oficina Pro e Oficina Elite. Faça um upgrade para liberar esta função.");
      return;
    }

    const exportData = services.map(s => ({
      'Nome': s.name,
      'Categoria': s.category,
      'Tipo': s.vehicleType,
      'Mão de Obra': s.laborPrice,
      'Descrição': s.description
    }));

    const ws = utils.json_to_sheet(exportData);
    const wb = utils.book_new();
    utils.book_append_sheet(wb, ws, "Serviços");
    writeFile(wb, `Servicos_${profile?.companyName || 'Hub'}.xlsx`);
  };

  const handleAddService = async (e: React.FormEvent) => {
    e.preventDefault();
    const companyId = selectedCompanyId || profile?.companyId;
    if (!companyId) return;

    const total = newService.laborPrice || 0;
    const payload = {
      ...newService,
      companyId: companyId,
      defaultPrice: total,
      createdAt: serverTimestamp()
    };

    try {
      if (editingService) {
        await updateDoc(doc(db, 'services', editingService.id), payload);
      } else {
        await addDoc(collection(db, 'services'), payload);
      }
      setIsModalOpen(false);
      setEditingService(null);
      setNewService({ name: '', category: '', vehicleType: 'carro', laborPrice: 0, description: '' });
    } catch (error) {
      handleFirestoreError(error, editingService ? OperationType.UPDATE : OperationType.CREATE, 'services');
    }
  };

  const handleEdit = (service: any) => {
    setEditingService(service);
    setNewService({
      name: service.name,
      category: service.category,
      vehicleType: service.vehicleType,
      laborPrice: service.laborPrice,
      description: service.description || ''
    });
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'services', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'services');
    }
  };

  const filteredServices = services.filter(s => {
    const matchesSearch = s.name?.toLowerCase().includes(search.toLowerCase()) ||
      s.category?.toLowerCase().includes(search.toLowerCase());
    const matchesType = filterVehicleType === 'all' || s.vehicleType === filterVehicleType;
    return matchesSearch && matchesType;
  });

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-8 max-w-7xl mx-auto">
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6"
      >
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-indigo-600 rounded-lg shadow-lg shadow-indigo-200 dark:shadow-none">
              <Settings2 className="h-6 w-6 text-white" />
            </div>
            <h2 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-3xl">
              Catálogo de Serviços
            </h2>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Gerencie os serviços que sua empresa oferece e seus respectivos preços.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => setIsExcelImportModalOpen(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-white dark:bg-gray-800 px-4 py-2.5 text-sm font-semibold text-gray-900 dark:text-white shadow-sm ring-1 ring-inset ring-gray-300 dark:ring-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all"
          >
            <FileSpreadsheet className="h-4 w-4 text-blue-600" />
            Importar Excel
          </button>
          <button
            type="button"
            onClick={handleExportExcel}
            className="inline-flex items-center gap-2 rounded-xl bg-white dark:bg-gray-800 px-4 py-2.5 text-sm font-semibold text-gray-900 dark:text-white shadow-sm ring-1 ring-inset ring-gray-300 dark:ring-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all"
          >
            <Download className="h-4 w-4 text-emerald-600" />
            Exportar Excel
          </button>
          <button
            type="button"
            onClick={() => setIsImportModalOpen(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-white dark:bg-gray-800 px-4 py-2.5 text-sm font-semibold text-gray-900 dark:text-white shadow-sm ring-1 ring-inset ring-gray-300 dark:ring-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all"
          >
            <Download className="h-4 w-4 text-indigo-600" />
            Catálogo Padrão
          </button>
          <button
            type="button"
            onClick={() => {
              setEditingService(null);
              setNewService({ name: '', category: '', vehicleType: 'carro', laborPrice: 0, description: '' });
              setIsModalOpen(true);
            }}
            className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-200 dark:shadow-none hover:bg-indigo-500 transition-all"
          >
            <Plus className="h-4 w-4" />
            Novo Serviço
          </button>
        </div>
      </motion.div>

      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto border border-gray-200 dark:border-gray-700"
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                  {editingService ? 'Editar Serviço' : 'Novo Serviço'}
                </h3>
                <button 
                  onClick={() => setIsModalOpen(false)}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
                >
                  <X className="h-5 w-5 text-gray-500" />
                </button>
              </div>
              <form onSubmit={handleAddService} className="space-y-5">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Nome do Serviço</label>
                  <input 
                    type="text" 
                    required 
                    value={newService.name} 
                    onChange={e => setNewService({...newService, name: e.target.value})} 
                    className="w-full px-4 py-2.5 border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 transition-all"
                    placeholder="Ex: Troca de Óleo"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Categoria</label>
                  <input 
                    type="text" 
                    required 
                    value={newService.category} 
                    onChange={e => setNewService({...newService, category: e.target.value})} 
                    className="w-full px-4 py-2.5 border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 transition-all"
                    placeholder="Ex: Motor, Freios"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Aplicação / Tipo</label>
                  <select 
                    value={newService.vehicleType} 
                    onChange={e => setNewService({...newService, vehicleType: e.target.value})} 
                    className="w-full px-4 py-2.5 border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 transition-all"
                  >
                    <option value="carro">Carro</option>
                    <option value="moto">Moto</option>
                    <option value="som_automotivo">Som Automotivo</option>
                    <option value="lava_jato">Lava-Jato</option>
                    <option value="auto_eletrica">Auto Elétrica</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Preço do Serviço (R$)</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 font-medium">R$</span>
                    <input 
                      type="number" 
                      step="0.01" 
                      required 
                      value={newService.laborPrice} 
                      onChange={e => setNewService({...newService, laborPrice: parseFloat(e.target.value) || 0})} 
                      className="w-full pl-12 pr-4 py-2.5 border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 transition-all"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Descrição (opcional)</label>
                  <textarea 
                    value={newService.description} 
                    onChange={e => setNewService({...newService, description: e.target.value})} 
                    className="w-full px-4 py-2.5 border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 transition-all min-h-[100px] resize-none"
                    placeholder="Detalhes sobre o serviço..."
                  />
                </div>
                <div className="pt-4 border-t border-gray-100 dark:border-gray-700">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Valor Sugerido:</span>
                    <span className="text-lg font-bold text-indigo-600 dark:text-indigo-400">
                      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(newService.laborPrice || 0)}
                    </span>
                  </div>
                  <button 
                    type="submit" 
                    className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-200 dark:shadow-none transition-all"
                  >
                    Salvar Serviço
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="flex flex-col lg:flex-row gap-4"
      >
        <div className="flex-1 relative group">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-gray-400 group-focus-within:text-indigo-500 transition-colors" />
          </div>
          <input
            type="text"
            placeholder="Buscar serviços por nome ou categoria..."
            className="block w-full pl-12 pr-4 py-3 border border-gray-200 dark:border-gray-700 rounded-2xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm transition-all"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex flex-wrap items-center gap-1 bg-white dark:bg-gray-800 p-1.5 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-sm">
          {[
            { id: 'all', label: 'Todos' },
            { id: 'carro', label: 'Carro' },
            { id: 'moto', label: 'Moto' },
            { id: 'som_automotivo', label: 'Som Automotivo' },
            { id: 'lava_jato', label: 'Lava-Jato' },
            { id: 'auto_eletrica', label: 'Auto Elétrica' }
          ].map(type => (
            <button
              key={type.id}
              onClick={() => setFilterVehicleType(type.id)}
              className={`px-4 py-2 text-sm font-bold rounded-xl transition-all ${filterVehicleType === type.id ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100 dark:shadow-none' : 'text-gray-500 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-gray-700'}`}
            >
              {type.label}
            </button>
          ))}
        </div>
      </motion.div>

      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="mt-4"
      >
        {/* Desktop Table */}
        <div className="hidden md:block overflow-hidden bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-sm">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-900/50">
              <tr>
                <th scope="col" className="py-4 pl-6 pr-3 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Nome</th>
                <th scope="col" className="px-3 py-4 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Categoria</th>
                <th scope="col" className="px-3 py-4 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Tipo</th>
                <th scope="col" className="px-3 py-4 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Preço</th>
                <th scope="col" className="relative py-4 pl-3 pr-6">
                  <span className="sr-only">Ações</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {filteredServices.length > 0 ? filteredServices.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors group">
                  <td className="whitespace-nowrap py-4 pl-6 pr-3">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-gray-100 dark:bg-gray-700 rounded-lg group-hover:bg-white dark:group-hover:bg-gray-600 transition-colors">
                        <Package2 className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                      </div>
                      <div>
                        <div className="text-sm font-bold text-gray-900 dark:text-white">{item.name}</div>
                        {item.description && (
                          <div className="text-[10px] text-gray-500 dark:text-gray-400 truncate max-w-xs">{item.description}</div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-3 py-4">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                      {item.category}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-3 py-4">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                      item.vehicleType === 'carro' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' :
                      item.vehicleType === 'moto' ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300' :
                      item.vehicleType === 'som_automotivo' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300' :
                      item.vehicleType === 'lava_jato' ? 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300' :
                      item.vehicleType === 'auto_eletrica' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300' :
                      'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
                    }`}>
                      {item.vehicleType.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-3 py-4 text-sm font-black text-indigo-600 dark:text-indigo-400">
                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.laborPrice)}
                  </td>
                  <td className="relative whitespace-nowrap py-4 pl-3 pr-6 text-right text-sm font-medium">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => handleEdit(item)}
                        className="p-2 text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg transition-all"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(item.id)}
                        className="p-2 text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-all"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={5} className="py-12 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <Package2 className="h-12 w-12 text-gray-300 dark:text-gray-600" />
                      <p className="text-sm text-gray-500 dark:text-gray-400">Nenhum serviço encontrado.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Card List */}
        <div className="md:hidden space-y-4">
          {filteredServices.map((item) => (
            <motion.div 
              layout
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              key={item.id} 
              className="bg-white dark:bg-gray-800 p-5 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 space-y-4"
            >
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-gray-100 dark:bg-gray-700 rounded-xl">
                    <Package2 className="h-5 w-5 text-gray-500 dark:text-gray-400" />
                  </div>
                  <div>
                    <h4 className="text-base font-bold text-gray-900 dark:text-white">{item.name}</h4>
                    <div className="mt-1 flex items-center gap-2">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        item.vehicleType === 'carro' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' :
                        item.vehicleType === 'moto' ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300' :
                        item.vehicleType === 'som_automotivo' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300' :
                        item.vehicleType === 'lava_jato' ? 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300' :
                        item.vehicleType === 'auto_eletrica' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300' :
                        'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
                      }`}>
                        {item.vehicleType.replace('_', ' ')}
                      </span>
                      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{item.category}</span>
                    </div>
                  </div>
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => handleEdit(item)}
                    className="p-2 text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg transition-all"
                  >
                    <Edit2 className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(item.id)}
                    className="p-2 text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-all"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <div className="flex items-center justify-between pt-4 border-t border-gray-100 dark:border-gray-700">
                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Preço do Serviço</p>
                <p className="text-xl font-black text-indigo-600 dark:text-indigo-400">
                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.laborPrice)}
                </p>
              </div>
            </motion.div>
          ))}
          {filteredServices.length === 0 && (
            <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-2xl border border-dashed border-gray-300 dark:border-gray-700">
              <Package2 className="h-12 w-12 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
              <p className="text-sm text-gray-500 dark:text-gray-400">Nenhum serviço encontrado.</p>
            </div>
          )}
        </div>
      </motion.div>
      {/* Excel Import Modal */}
      {isExcelImportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-lg overflow-hidden">
            <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <FileSpreadsheet className="h-6 w-6 text-green-600" />
                Importar de Excel
              </h2>
              <button onClick={() => setIsExcelImportModalOpen(false)} className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
                <X className="h-6 w-6" />
              </button>
            </div>
            
            <div className="p-6 space-y-6">
              <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg flex gap-3">
                <AlertCircle className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
                <div className="text-sm text-blue-800 dark:text-blue-200">
                  <p className="font-bold mb-1">Instruções para o arquivo:</p>
                  <p>O arquivo deve conter as colunas: <strong>Nome, Categoria, Tipo (carro/moto), Preço</strong> e <strong>Descrição</strong>.</p>
                </div>
              </div>

              {!excelData.length ? (
                <div 
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-xl p-12 text-center hover:border-indigo-500 dark:hover:border-indigo-400 transition-colors cursor-pointer group"
                >
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    className="hidden" 
                    accept=".xlsx, .xls, .csv" 
                    onChange={handleExcelUpload}
                  />
                  <Upload className="h-12 w-12 text-gray-400 group-hover:text-indigo-500 mx-auto mb-4 transition-colors" />
                  <p className="text-gray-600 dark:text-gray-400 font-medium">Clique para selecionar ou arraste o arquivo Excel</p>
                  <p className="text-xs text-gray-500 mt-2">Suporta .xlsx, .xls e .csv</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      {excelData.length} serviços encontrados no arquivo.
                    </p>
                    <button 
                      onClick={() => setExcelData([])}
                      className="text-xs text-red-600 hover:underline"
                    >
                      Remover arquivo
                    </button>
                  </div>
                  
                  <div className="max-h-60 overflow-y-auto border border-gray-100 dark:border-gray-700 rounded-lg">
                    <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                      <thead className="bg-gray-50 dark:bg-gray-900/50 sticky top-0">
                        <tr>
                          <th className="px-4 py-2 text-left text-[10px] font-bold text-gray-500 uppercase">Nome</th>
                          <th className="px-4 py-2 text-left text-[10px] font-bold text-gray-500 uppercase">Preço</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                        {excelData.slice(0, 10).map((row, i) => (
                          <tr key={i}>
                            <td className="px-4 py-2 text-sm text-gray-900 dark:text-white truncate max-w-[200px]">{row.name}</td>
                            <td className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400">R$ {row.laborPrice.toFixed(2)}</td>
                          </tr>
                        ))}
                        {excelData.length > 10 && (
                          <tr>
                            <td colSpan={2} className="px-4 py-2 text-xs text-gray-500 text-center italic">
                              E mais {excelData.length - 10} itens...
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            <div className="p-6 bg-gray-50 dark:bg-gray-900/50 border-t border-gray-100 dark:border-gray-700 flex justify-end gap-3">
              <button
                onClick={() => setIsExcelImportModalOpen(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button
                disabled={!excelData.length || isImporting}
                onClick={confirmExcelImport}
                className="px-6 py-2 bg-indigo-600 text-white text-sm font-bold rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-indigo-200 dark:shadow-none"
              >
                {isImporting ? 'Importando...' : 'Confirmar Importação'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Import Confirmation Modal */}
      {isImportModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="absolute inset-0 transition-opacity" aria-hidden="true" onClick={() => !isImporting && setIsImportModalOpen(false)}>
              <div className="absolute inset-0 bg-gray-500 dark:bg-gray-900 opacity-75"></div>
            </div>
            <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
            <div className="relative inline-block align-bottom bg-white dark:bg-gray-800 rounded-lg px-4 pt-5 pb-4 text-left shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-md w-full sm:p-6 z-10">
              <div>
                <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-yellow-100 dark:bg-yellow-900/30">
                  <svg className="h-6 w-6 text-yellow-600 dark:text-yellow-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <div className="mt-3 text-center sm:mt-5">
                  <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-white" id="modal-title">
                    Importar Catálogo Completo
                  </h3>
                  <div className="mt-2">
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Tem certeza que deseja importar todo o catálogo de serviços? Isso adicionará muitos itens ao seu banco de dados.
                    </p>
                  </div>
                </div>
              </div>
              <div className="mt-5 sm:mt-6 sm:grid sm:grid-cols-2 sm:gap-3 sm:grid-flow-row-dense">
                <button
                  type="button"
                  disabled={isImporting}
                  className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-indigo-600 text-base font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:col-start-2 sm:text-sm disabled:opacity-50"
                  onClick={confirmImportCatalog}
                >
                  {isImporting ? 'Importando...' : 'Confirmar'}
                </button>
                <button
                  type="button"
                  disabled={isImporting}
                  className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 dark:border-gray-600 shadow-sm px-4 py-2 bg-white dark:bg-gray-800 text-base font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:col-start-1 sm:text-sm disabled:opacity-50"
                  onClick={() => setIsImportModalOpen(false)}
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
