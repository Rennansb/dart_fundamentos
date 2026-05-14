import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, query, where, onSnapshot, addDoc, deleteDoc, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '../AuthContext';
import { Plus, Trash2, Edit2, Package, Search, Upload, Download, Image as ImageIcon, Sparkles } from 'lucide-react';
import { INITIAL_PARTS_DATA } from '../constants/initialParts';
import { BR_VEHICLES } from '../constants/vehicleData';
import { getPartSuggestions, getPartImageSuggestion, identifyPartFromImage } from '../services/aiService';
import { Camera, Loader2, X } from 'lucide-react';

const PART_BRANDS = [
  "Bosch", "NGK", "Denso", "Magneti Marelli", "Delphi", "Valeo", "Continental", "Mann Filter", "Fram", "Tecfil",
  "Mahle", "Wega", "Brembo", "TRW", "Cobreq", "Ferodo", "Syl", "Cofap", "Monroe", "Nakata", "Axios", "Heliar",
  "Moura", "ACDelco", "LUK", "Sachs", "SKF", "Dayco", "Gates", "INA", "Sabo", "Corteco", "Mobil", "Shell",
  "Castrol", "Ipiranga", "Magnetron", "Condor", "Gauss", "Ikro", "Zouil", "Vedamotors", "Metal Leve", "KMP",
  "Takayama", "Did", "Vaz", "Riffel", "Fischer", "Vini", "Allen", "Fabreck", "Pro Tork", "Scud", "GVS",
  "Chapam", "Roncar"
].sort();

export default function SupplierInventory() {
  const { user, profile } = useAuth();
  const [parts, setParts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingPart, setEditingPart] = useState<any>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    vehicleType: 'carro' as 'carro' | 'moto',
    brand: '',
    partBrand: '',
    model: '',
    year: '',
    category: '',
    price: '',
    basePrice: '',
    photoURL: '',
    stock: ''
  });
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [brandSearch, setBrandSearch] = useState('');
  const [showBrandSuggestions, setShowBrandSuggestions] = useState(false);

  useEffect(() => {
    if (!profile?.uid) return;

    const q = query(collection(db, 'parts'), where('supplierId', '==', profile.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const partsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setParts(partsData);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [profile?.uid]);

  const generateKeywords = (name: string, brand: string, model: string, partBrand: string) => {
    const words = [
      ...name.toLowerCase().split(/\s+/),
      ...brand.toLowerCase().split(/\s+/),
      ...model.toLowerCase().split(/\s+/),
      ...partBrand.toLowerCase().split(/\s+/)
    ].filter(w => w.length > 1);
    return Array.from(new Set(words));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.uid) return;

    const costPrice = parseFloat(formData.basePrice) || 0;
    const salePrice = parseFloat(formData.price) || 0;

    const partData = {
      ...formData,
      nameLower: formData.name.toLowerCase(),
      brandLower: formData.brand.toLowerCase(),
      partBrandLower: formData.partBrand.toLowerCase(),
      keywords: generateKeywords(formData.name, formData.brand, formData.model, formData.partBrand),
      basePrice: costPrice,
      price: salePrice,
      stock: parseInt(formData.stock) || 0,
      supplierId: profile.uid,
      supplierName: profile.companyName || profile.name,
      supplierEmail: profile.email,
      supplierCity: profile.address?.city || '',
      supplierState: profile.address?.state || '',
      recordedBy: user?.uid,
      recordedByName: profile?.name || profile?.email?.split('@')[0],
      updatedAt: serverTimestamp()
    };

    try {
      if (editingPart) {
        await updateDoc(doc(db, 'parts', editingPart.id), partData);
      } else {
        await addDoc(collection(db, 'parts'), {
          ...partData,
          createdAt: serverTimestamp()
        });
      }
      setShowAddModal(false);
      setEditingPart(null);
      resetForm();
    } catch (error) {
      console.error("Error saving part:", error);
    }
  };

  const resetForm = () => {
    setFormData({ 
      name: '', 
      vehicleType: 'carro',
      brand: '', 
      partBrand: '',
      model: '',
      year: '',
      category: '',
      price: '', 
      basePrice: '',
      photoURL: '', 
      stock: '' 
    });
    setBrandSearch('');
  };

  const handleAISuggestions = async () => {
    if (!formData.name) return;
    setIsSuggesting(true);
    try {
      const companyId = profile?.id || profile?.uid || '';
      const category = await getPartSuggestions(formData.name, companyId, companyId);
      const photoURL = await getPartImageSuggestion(formData.name, category, companyId, companyId);
      setFormData(prev => ({ ...prev, category, photoURL }));
    } catch (error) {
      console.error("AI Preview error:", error);
    } finally {
      setIsSuggesting(false);
    }
  };

  const handlePhotoCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsAnalyzing(true);
    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64 = reader.result as string;
        const companyId = profile?.id || profile?.uid || '';
        const result = await identifyPartFromImage(base64, companyId, companyId);
        
        if (result) {
          setFormData(prev => ({
            ...prev,
            name: result.name || prev.name,
            vehicleType: result.vehicleType || prev.vehicleType,
            brand: result.brand || prev.brand,
            model: result.model || prev.model,
            partBrand: result.partBrand || prev.partBrand,
            category: result.category || prev.category,
            year: result.year || prev.year,
            price: result.priceSuggestion?.toString() || prev.price
          }));
          setBrandSearch(result.partBrand || '');
        }
      };
      reader.readAsDataURL(file);
    } catch (error) {
      alert("Não foi possível identificar a peça pela foto. Tente novamente ou preencha manualmente.");
      console.error(error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Tem certeza que deseja excluir esta peça?')) {
      try {
        await deleteDoc(doc(db, 'parts', id));
      } catch (error) {
        console.error("Error deleting part:", error);
      }
    }
  };

  const handleImportInitialData = async () => {
    if (!profile?.uid) return;
    if (window.confirm('Deseja importar a lista inicial de peças?')) {
      try {
        for (const part of INITIAL_PARTS_DATA) {
          const basePrice = part.price;
          const commissionedPrice = basePrice * 1.03;

          await addDoc(collection(db, 'parts'), {
            ...part,
            partBrand: part.brand, // For initial data, brand is the same as part brand
            nameLower: part.name.toLowerCase(),
            brandLower: part.brand.toLowerCase(),
            partBrandLower: part.brand.toLowerCase(),
            keywords: generateKeywords(part.name, part.brand, part.model || '', part.brand),
            basePrice: basePrice,
            price: commissionedPrice,
            supplierId: profile.uid,
            supplierName: profile.companyName || profile.name,
            supplierEmail: profile.email,
            stock: 10, // Default stock
            recordedBy: user?.uid,
            recordedByName: profile?.name || profile?.email?.split('@')[0],
            createdAt: serverTimestamp()
          });
        }
        alert('Peças importadas com sucesso (com 3% de comissão aplicada)!');
      } catch (error) {
        console.error("Error importing parts:", error);
      }
    }
  };

  const filteredParts = parts.filter(part => 
    part.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    part.brand.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (part.partBrand && part.partBrand.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  if (loading) return <div className="p-8 text-center">Carregando estoque...</div>;

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Catálogo de Peças</h1>
          <p className="text-gray-500 dark:text-gray-400">Gerencie as peças disponíveis para as oficinas</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleImportInitialData}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            <Download className="h-4 w-4" />
            Importar Dados
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Adicionar Peça
          </button>
        </div>
      </div>

      <div className="mb-6 relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
        <input
          type="text"
          placeholder="Buscar por nome ou marca..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {filteredParts.map((part) => (
          <div key={part.id} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden group">
            <div className="aspect-square bg-gray-100 dark:bg-gray-900 relative">
              {part.photoURL ? (
                <img src={part.photoURL} alt={part.name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-400">
                  <ImageIcon className="h-12 w-12" />
                </div>
              )}
              <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => {
                    setEditingPart(part);
                    setFormData({
                      name: part.name,
                      vehicleType: part.vehicleType || 'carro',
                      brand: part.brand,
                      partBrand: part.partBrand || '',
                      model: part.model || '',
                      year: part.year || '',
                      category: part.category || '',
                      price: part.price.toString(),
                      basePrice: part.basePrice?.toString() || '',
                      photoURL: part.photoURL || '',
                      stock: part.stock?.toString() || ''
                    });
                    setBrandSearch(part.partBrand || '');
                    setShowAddModal(true);
                  }}
                  className="p-2 bg-white dark:bg-gray-700 text-indigo-600 dark:text-indigo-400 rounded-full shadow-lg hover:bg-indigo-50"
                >
                  <Edit2 className="h-4 w-4" />
                </button>
                <button
                  onClick={() => handleDelete(part.id)}
                  className="p-2 bg-white dark:bg-gray-700 text-red-600 dark:text-red-400 rounded-full shadow-lg hover:bg-red-50"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div className="p-4">
              <div className="flex justify-between items-start mb-1">
                <h3 className="font-semibold text-gray-900 dark:text-white truncate">{part.name}</h3>
                <span className="text-indigo-600 dark:text-indigo-400 font-bold">
                  R$ {part.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </span>
              </div>
              <p className="text-xs text-gray-400 mb-1">
                Preço Base: R$ {part.basePrice?.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) || '---'}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
                {part.brand} {part.model && `• ${part.model}`} {part.year && `• ${part.year}`}
              </p>
              <div className="flex flex-wrap gap-2 mb-3">
                {part.color && part.color !== 'Nao se aplica' && (
                  <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-[10px] rounded-full text-gray-600 dark:text-gray-400">
                    Cor: {part.color}
                  </span>
                )}
                {part.productURL && (
                  <a 
                    href={part.productURL} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="px-2 py-0.5 bg-blue-50 dark:bg-blue-900/30 text-[10px] rounded-full text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    Ver Produto
                  </a>
                )}
              </div>
              <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                <Package className="h-3 w-3" />
                Estoque: {part.stock || 0} unidades
              </div>
            </div>
          </div>
        ))}
      </div>

      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl max-w-md w-full p-6 shadow-xl">
            <h2 className="text-xl font-bold mb-4 dark:text-white">
              {editingPart ? 'Editar Peça' : 'Adicionar Nova Peça'}
            </h2>
            <form onSubmit={handleSave} className="space-y-4">
              <div className="relative group cursor-pointer">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoCapture}
                  className="hidden"
                  id="part-photo-upload"
                  capture="environment"
                />
                <label
                  htmlFor="part-photo-upload"
                  className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-2xl hover:border-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-all overflow-hidden relative"
                >
                  {isAnalyzing ? (
                    <div className="flex flex-col items-center gap-2">
                      <Loader2 className="h-8 w-8 text-indigo-600 animate-spin" />
                      <span className="text-[10px] font-black uppercase text-indigo-600">Identificando Peça...</span>
                    </div>
                  ) : formData.photoURL ? (
                    <>
                      <img src={formData.photoURL} alt="Preview" className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                        <Camera className="h-8 w-8 text-white" />
                      </div>
                    </>
                  ) : (
                    <div className="flex flex-col items-center gap-1 text-gray-400">
                      <Camera className="h-8 w-8 mb-1" />
                      <span className="text-[10px] font-black uppercase tracking-widest">Tirar Foto (IA)</span>
                    </div>
                  )}
                </label>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Nome da Peça</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="flex-1 rounded-xl border-gray-200 dark:border-gray-700 shadow-sm focus:ring-2 focus:ring-indigo-500 dark:bg-gray-900 dark:text-white transition-all text-sm font-bold"
                    placeholder="Ex: Pastilha de Freio Dianteira"
                  />
                  <button
                    type="button"
                    onClick={handleAISuggestions}
                    disabled={isSuggesting || !formData.name}
                    className="p-2.5 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-xl hover:bg-indigo-100 dark:hover:bg-indigo-900/50 disabled:opacity-50 transition-all group"
                    title="Sugerir Categoria e Foto com IA"
                  >
                    <Sparkles className={`h-5 w-5 ${isSuggesting ? 'animate-pulse' : 'group-hover:scale-110 transition-transform'}`} />
                  </button>
                </div>
              </div>

              <div className="relative">
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Marca da Peça (Fabricante)</label>
                <input
                  type="text"
                  required
                  placeholder="Busque por Bosch, NGK, etc..."
                  value={brandSearch}
                  onFocus={() => setShowBrandSuggestions(true)}
                  onChange={(e) => {
                    setBrandSearch(e.target.value);
                    setFormData({ ...formData, partBrand: e.target.value });
                    setShowBrandSuggestions(true);
                  }}
                  className="w-full rounded-xl border-gray-200 dark:border-gray-700 shadow-sm focus:ring-2 focus:ring-indigo-500 dark:bg-gray-900 dark:text-white transition-all text-sm font-bold"
                />
                {showBrandSuggestions && brandSearch && (
                  <div className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl max-h-48 overflow-y-auto no-scrollbar">
                    {PART_BRANDS.filter(b => b.toLowerCase().includes(brandSearch.toLowerCase()))
                      .map(brand => (
                        <button
                          key={brand}
                          type="button"
                          onClick={() => {
                            setFormData({ ...formData, partBrand: brand });
                            setBrandSearch(brand);
                            setShowBrandSuggestions(false);
                          }}
                          className="w-full text-left px-4 py-2 text-sm hover:bg-indigo-50 dark:hover:bg-indigo-900/40 text-gray-700 dark:text-gray-300 font-bold transition-colors"
                        >
                          {brand}
                        </button>
                      ))}
                  </div>
                )}
              </div>

              <div className="p-4 bg-gray-50 dark:bg-gray-900/40 rounded-2xl space-y-4 border border-gray-100 dark:border-gray-800">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 mb-2 italic">Compatibilidade de Veículo</p>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-500 mb-1">Tipo</label>
                    <select
                      value={formData.vehicleType}
                      onChange={(e) => setFormData({ ...formData, vehicleType: e.target.value as 'carro' | 'moto', brand: '', model: '' })}
                      className="w-full rounded-xl border-gray-200 dark:border-gray-700 shadow-sm focus:ring-2 focus:ring-indigo-500 dark:bg-gray-900 dark:text-white transition-all text-sm font-bold"
                    >
                      <option value="carro">Carro</option>
                      <option value="moto">Moto</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 mb-1">Marca Veículo</label>
                    <select
                      required
                      value={formData.brand}
                      onChange={(e) => setFormData({ ...formData, brand: e.target.value, model: '' })}
                      className="w-full rounded-xl border-gray-200 dark:border-gray-700 shadow-sm focus:ring-2 focus:ring-indigo-500 dark:bg-gray-900 dark:text-white transition-all text-sm font-bold"
                    >
                      <option value="">Selecione...</option>
                      {BR_VEHICLES[formData.vehicleType].brands.map(brand => (
                        <option key={brand} value={brand}>{brand}</option>
                      ))}
                      <option value="Outra">Outra</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-500 mb-1">Modelo</label>
                    {formData.brand && formData.brand !== 'Outra' ? (
                      <select
                        value={formData.model}
                        onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                        className="w-full rounded-xl border-gray-200 dark:border-gray-700 shadow-sm focus:ring-2 focus:ring-indigo-500 dark:bg-gray-900 dark:text-white transition-all text-sm font-bold"
                      >
                        <option value="">Selecione...</option>
                        {BR_VEHICLES[formData.vehicleType].models[formData.brand as keyof typeof BR_VEHICLES.carro.models]?.map(model => (
                          <option key={model} value={model}>{model}</option>
                        ))}
                        <option value="Outro">Outro</option>
                      </select>
                    ) : (
                      <input
                        type="text"
                        value={formData.model}
                        onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                        placeholder="Modelo"
                        className="w-full rounded-xl border-gray-200 dark:border-gray-700 shadow-sm focus:ring-2 focus:ring-indigo-500 dark:bg-gray-900 dark:text-white transition-all text-sm font-bold"
                      />
                    )}
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 mb-1">Ano</label>
                    <input
                      type="text"
                      value={formData.year}
                      onChange={(e) => setFormData({ ...formData, year: e.target.value })}
                      className="w-full rounded-xl border-gray-200 dark:border-gray-700 shadow-sm focus:ring-2 focus:ring-indigo-500 dark:bg-gray-900 dark:text-white transition-all text-sm font-bold"
                      placeholder="Ex: 2023"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Categoria</label>
                  <select
                    required
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full rounded-xl border-gray-200 dark:border-gray-700 shadow-sm focus:ring-2 focus:ring-indigo-500 dark:bg-gray-900 dark:text-white transition-all text-sm font-bold"
                  >
                    <option value="">Selecione...</option>
                    <option value="Motor">Motor</option>
                    <option value="Suspensão">Suspensão</option>
                    <option value="Freios">Freios</option>
                    <option value="Elétrica">Elétrica</option>
                    <option value="Transmissão">Transmissão</option>
                    <option value="Funilaria">Funilaria</option>
                    <option value="Pneus">Pneus</option>
                    <option value="Óleos e Filtros">Óleos e Filtros</option>
                    <option value="Outros">Outros</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Quantidade</label>
                  <input
                    type="number"
                    required
                    value={formData.stock}
                    onChange={(e) => setFormData({ ...formData, stock: e.target.value })}
                    className="w-full rounded-xl border-gray-200 dark:border-gray-700 shadow-sm focus:ring-2 focus:ring-indigo-500 dark:bg-gray-900 dark:text-white transition-all text-sm font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Custo (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={formData.basePrice}
                    onChange={(e) => setFormData({ ...formData, basePrice: e.target.value })}
                    className="w-full rounded-xl border-gray-200 dark:border-gray-700 shadow-sm focus:ring-2 focus:ring-indigo-500 dark:bg-gray-900 dark:text-white transition-all text-sm font-bold"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Venda (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                    className="w-full rounded-xl border-gray-200 dark:border-gray-700 shadow-sm focus:ring-2 focus:ring-indigo-500 dark:bg-gray-900 dark:text-white transition-all text-sm font-bold"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 dark:border-gray-700">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddModal(false);
                    setEditingPart(null);
                  }}
                  className="px-6 py-2.5 text-sm font-bold text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-900 rounded-xl transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-8 py-2.5 bg-indigo-600 text-white text-sm font-black rounded-xl hover:bg-indigo-700 shadow-lg shadow-indigo-200 dark:shadow-none transition-all active:scale-95"
                >
                  {isSuggesting ? 'Aguarde...' : 'Salvar Peça'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
