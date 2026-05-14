import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { getAveragePrice, getLaborSuggestions, getRepairTips } from '../services/aiService';
import { useAuth } from '../AuthContext';
import { db } from '../firebase';
import { format } from 'date-fns';
import { 
  collection, query, where, getDocs, addDoc, getDoc,
  serverTimestamp, onSnapshot, orderBy, deleteDoc, 
  doc, limit, startAt, endAt, updateDoc
} from 'firebase/firestore';
import { 
  Search, Plus, Trash2, Edit2, FileText, Check, X, Shield, Clock, BrainCircuit, Loader2, Package, MapPin, ShoppingCart, Image as ImageIcon,
  User, DollarSign, AlertCircle, CheckCircle, Download, ChevronRight, ArrowRight, Filter, MoreVertical, Printer, Send, Wrench, MessageSquare, History as HistoryIcon, Star
} from 'lucide-react';
import { handleFirestoreError, OperationType } from '../utils/firestoreErrors';
import { checkPlanLimit, PLAN_LIMITS } from '../utils/planLimits';
import PlanLimitModal from '../components/PlanLimitModal';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { motion, AnimatePresence } from 'framer-motion';
import { notificationService } from '../services/notificationService';
import { paymentService } from '../services/paymentService';
import { generateProfessionalReport } from '../services/invoiceGenerator';
import AiDiagnosisModal from '../components/AiDiagnosisModal';
import { formatDateBRT } from '../utils/dateUtils';

interface PartItem {
  id: string;
  name: string;
  price: number;
  brand?: string;
  model?: string;
  year?: string;
  color?: string;
  photoURL?: string;
  productURL?: string;
  supplierId?: string;
  supplierName?: string;
  quantity?: number;
}

interface ServiceItem {
  id: string;
  name: string;
  price: number;
  foundMatch: boolean;
}

interface Quote {
  id: string;
  customerId: string;
  customerName: string;
  employeeId: string;
  employeeName: string;
  parts: (PartItem & { isService?: boolean })[];
  services?: ServiceItem[];
  laborPrice?: number;
  total: number;
  status: string;
  createdAt: any;
  createdBy?: string;
  source?: 'budgets' | 'quotes';
  vehicleId?: string;
  vehicleInfo?: string;
}

export default function Budgets() {
  const navigate = useNavigate();
  const { profile, effectiveProfile, user, selectedCompanyId, loading: authLoading } = useAuth();
  const [partName, setPartName] = useState('');
  const [serviceName, setServiceName] = useState('');
  const [showServiceResults, setShowServiceResults] = useState(false);
  const [serviceResults, setServiceResults] = useState<any[]>([]);
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [loadingPrice, setLoadingPrice] = useState(false);
  
  const [parts, setParts] = useState<PartItem[]>([]);
  const [serviceItems, setServiceItems] = useState<ServiceItem[]>([]);
  
  const [customerCode, setCustomerCode] = useState('');
  const [customer, setCustomer] = useState<any>(null);
  const [vehicle, setVehicle] = useState<any>(null);
  
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [shops, setShops] = useState<any[]>([]);
  const [selectedShopId, setSelectedShopId] = useState<string>('');
  const [employees, setEmployees] = useState<any[]>([]);
  const [filterEmployeeId, setFilterEmployeeId] = useState<string>('');
  const [loading, setLoading] = useState(false);
  
  const [editingPartId, setEditingPartId] = useState<string | null>(null);
  const [editingServiceId, setEditingServiceId] = useState<string | null>(null);
  const [editPrice, setEditPrice] = useState<number>(0);
  const [showLimitModal, setShowLimitModal] = useState(false);
  const [showAiDiagnosisModal, setShowAiDiagnosisModal] = useState(false);
  const [isPreliminary, setIsPreliminary] = useState(false);
  const [marketplaceParts, setMarketplaceParts] = useState<any[]>([]);
  const [isSearchingMarketplace, setIsSearchingMarketplace] = useState(false);

  const location = useLocation();

  useEffect(() => {
    const state = location.state as any;
    if (state?.customerCode) {
      setCustomerCode(state.customerCode);
      handleCustomerLookup(state.customerCode, state.vehicleId);
    }
  }, [location.state, profile?.companyId]);

  const getDeliveryTime = (suppCity: string, shopCity: string, suppState: string, shopState: string) => {
    if (!suppCity || !shopCity) return "24-48h";
    if (suppCity.toLowerCase() === shopCity.toLowerCase()) return "1-2h (Express)";
    if (suppState?.toLowerCase() === shopState?.toLowerCase()) return "4-8h (Padrão)";
    return "24-48h (Remessa)";
  };

  useEffect(() => {
    if (partName.length < 3) {
      setMarketplaceParts([]);
      return;
    }

    const searchMarketplace = async () => {
      setIsSearchingMarketplace(true);
      try {
        const q = query(
          collection(db, 'parts'),
          where('nameLower', '>=', partName.toLowerCase()),
          where('nameLower', '<=', partName.toLowerCase() + '\uf8ff'),
          limit(5)
        );
        
        const snapshot = await getDocs(q);
        const partsData = await Promise.all(snapshot.docs.map(async (d) => {
          const data = d.data() as any;
          const ratingsQ = query(collection(db, 'supplier_ratings'), where('supplierId', '==', data.supplierId));
          const ratingsSnap = await getDocs(ratingsQ);
          const ratings = ratingsSnap.docs.map(rd => rd.data() as any);
          const avg = ratings.length > 0 ? ratings.reduce((acc, curr) => acc + (curr.rating || 0), 0) / ratings.length : 0;
          
          return { 
            ...data, 
            id: d.id,
            avgRating: avg,
            totalRatings: ratings.length,
            deliveryTime: getDeliveryTime(data.supplierCity || '', profile?.address?.city || '', data.supplierState || '', profile?.address?.state || '')
          };
        }));

        const sortedParts = partsData.sort((a: any, b: any) => {
          if (b.avgRating !== a.avgRating) return b.avgRating - a.avgRating;
          return (a.price || 0) - (b.price || 0);
        });

        setMarketplaceParts(sortedParts);
      } catch (error) {
        handleFirestoreError(error, OperationType.LIST, 'parts (marketplace)', profile?.companyId || 'global');
      } finally {
        setIsSearchingMarketplace(false);
      }
    };

    const timer = setTimeout(searchMarketplace, 500);
    return () => clearTimeout(timer);
  }, [partName, profile?.address?.city]);
  const [paymentData, setPaymentData] = useState<any>(null);

  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searchingCatalog, setSearchingCatalog] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [availableServices, setAvailableServices] = useState<any[]>([]);
  const [loadingLaborAI, setLoadingLaborAI] = useState(false);

  // Autocomplete state
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const suggestionRef = useRef<HTMLDivElement>(null);

  const [supplierSuggestions, setSupplierSuggestions] = useState<any[]>([]);
  const [showSupplierSuggestions, setShowSupplierSuggestions] = useState(false);
  const [isSearchingSuppliers, setIsSearchingSuppliers] = useState(false);
  const supplierSuggestionRef = useRef<HTMLDivElement>(null);
  const [scanningImage, setScanningImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const historyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (suggestionRef.current && !suggestionRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
      if (supplierSuggestionRef.current && !supplierSuggestionRef.current.contains(event.target as Node)) {
        setShowSupplierSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const searchSuppliers = async (term: string) => {
    if (!term || term.length < 2) {
      setSupplierSuggestions([]);
      setShowSupplierSuggestions(false);
      return;
    }

    setIsSearchingSuppliers(true);
    try {
      // V12: Simplified query to bypass permission blocks on complex filters
      const q = query(collection(db, 'users'), where('role', '==', 'supplier'), limit(50));
      const snapshot = await getDocs(q);
      const results = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter((s: any) => 
          (s.companyName || s.name || s.email || '').toLowerCase().includes(term.toLowerCase())
        );
      setSupplierSuggestions(results);
      setShowSupplierSuggestions(results.length > 0);
    } catch (error) {
      console.error('Supplier search error:', error);
      // Silent fail to avoid intrusive popups during typing
    } finally {
      setIsSearchingSuppliers(false);
    }
  };

  const searchParts = async (term: string) => {
    if (!term || term.length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    setIsSearching(true);
    try {
      // V12: Removed orderBy and strict range to bypass potential permission/index blocks
      const q = query(collection(db, 'parts'), limit(100));
      const snapshot = await getDocs(q);
      const results = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter((p: any) => (p.name || p.partName || '').toLowerCase().includes(term.toLowerCase()));
      
      setSuggestions(results);
      setShowSuggestions(results.length > 0);
    } catch (error) {
      console.error('Parts search error:', error);
    } finally {
      setIsSearching(false);
    }
  };

  const handlePartNameChange = (value: string) => {
    setPartName(value);
    searchParts(value);
  };

  const selectSuggestion = (suggestion: any) => {
    addPartFromCatalog(suggestion);
    setShowSuggestions(false);
  };

  const handleVisionScan = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setScanningImage(true);
    try {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = async () => {
        const base64 = reader.result as string;
        const res = await fetch('/api/vision/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image: base64 })
        });
        
        if (res.ok) {
          const data = await res.json();
          // Pre-fill data
          if (data.model) {
            setVehicle(prev => ({ ...prev, brand: data.brand, model: data.model, year: data.year, plate: data.plate }));
            alert(`Veículo detectado: ${data.brand} ${data.model}`);
          }
          if (data.suggestions && data.suggestions.length > 0) {
            const newParts = data.suggestions.map((s: string) => ({
              id: Math.random().toString(36).substr(2, 9),
              name: s,
              price: 0,
              quantity: 1
            }));
            setParts(prev => [...prev, ...newParts]);
          }
        }
      };
    } catch (error) {
      console.error("Vision scan failed:", error);
    } finally {
      setScanningImage(false);
    }
  };

  useEffect(() => {
    if (!user) return;
    if (profile?.role === 'admin' && !selectedCompanyId) {
      const fetchShops = async () => {
        try {
          const shopsSnapshot = await getDocs(query(collection(db, 'users'), where('role', '==', 'shop'), limit(50)));
          const shopsList = shopsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          setShops(shopsList);
        } catch (error) {
          handleFirestoreError(error, OperationType.LIST, 'users (shops)', 'global');
        }
      };
      fetchShops();
    }
  }, [profile?.role, profile?.companyId]);

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
  }, [profile?.companyId, profile?.id, selectedShopId, selectedCompanyId]);

  useEffect(() => {
    const companyId = selectedCompanyId || profile?.companyId;
    if (!companyId || typeof companyId !== 'string' || companyId.length < 5) return;
    
    const q = query(collection(db, 'services'), where('companyId', '==', companyId), limit(100));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setAvailableServices(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'services', companyId);
    });
    return () => unsubscribe();
  }, [selectedCompanyId, profile?.companyId]);

  useEffect(() => {
    if (!user) return;
    const companyId = selectedCompanyId || profile?.companyId;
    if (!companyId) return;

    // V10: SWITCHED TO 'quotes' TO MATCH firestore.rules AUTHORIZATION
    const unsubQuotes = onSnapshot(query(collection(db, 'quotes'), where('companyId', '==', companyId)), (snapshot) => {
      const quotesData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        source: 'quotes',
        createdAt: doc.data().createdAt?.toDate?.() || (doc.data().createdAt ? new Date(doc.data().createdAt) : new Date())
      })) as Quote[];
      
      setQuotes(quotesData.sort((a, b) => {
        const tA = (a.createdAt instanceof Date) ? a.createdAt.getTime() : 0;
        const tB = (b.createdAt instanceof Date) ? b.createdAt.getTime() : 0;
        return tB - tA;
      }));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'quotes', companyId);
    });

    return () => unsubQuotes();
  }, [user, profile, selectedCompanyId]);

  const handleCustomerLookup = async (forcedCode?: string, forcedVehicleId?: string) => {
    const codeToUse = forcedCode || customerCode;
    const companyId = selectedCompanyId || profile?.companyId;
    if (!companyId || !codeToUse) return;
    
    const q = query(collection(db, 'customers'), where('companyId', '==', companyId), where('code', '==', codeToUse.toUpperCase()));
    try {
      const snapshot = await getDocs(q);
      if (!snapshot.empty) {
        const docSnap = snapshot.docs[0];
        const customerData = { id: docSnap.id, ...docSnap.data() };
        setCustomer(customerData);
        
        if (forcedVehicleId) {
          const vDoc = await getDoc(doc(db, 'vehicles', forcedVehicleId));
          if (vDoc.exists()) {
            setVehicle({ id: vDoc.id, ...vDoc.data() });
          }
        } else {
          // Fetch default vehicle for this customer
          const vq = query(collection(db, 'vehicles'), where('companyId', '==', companyId), where('customerId', '==', docSnap.id));
          const vSnapshot = await getDocs(vq);
          if (!vSnapshot.empty) {
            setVehicle({ id: vSnapshot.docs[0].id, ...vSnapshot.docs[0].data() });
          } else {
            setVehicle(null);
          }
        }
      } else {
        if (!forcedCode) {
          setCustomer(null);
          setVehicle(null);
          alert("Cliente não encontrado.");
        }
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, 'customers');
    }
  };

  const handleSearchCatalog = async () => {
    if (!partName.trim()) return;
    setSearchingCatalog(true);
    setShowResults(true);
    try {
      const searchTerm = partName.toLowerCase();
      const searchWords = searchTerm.split(/\s+/).filter(w => w.length > 1);
      
      let q;
      if (searchWords.length > 0) {
        // Use array-contains-any for the first word if it exists, or stick to range query
        // For better results, we'll try keywords first
        q = query(
          collection(db, 'parts'),
          where('keywords', 'array-contains', searchWords[0])
        );
      } else {
        q = query(
          collection(db, 'parts'),
          where('nameLower', '>=', searchTerm),
          where('nameLower', '<=', searchTerm + '\uf8ff')
        );
      }

      const snapshot = await getDocs(q);
      let results = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() as any }));

      // If we used keywords, filter further client-side for other words
      if (searchWords.length > 1) {
        results = results.filter((part: any) => {
          const name = part.name?.toLowerCase() || '';
          const brand = part.brand?.toLowerCase() || '';
          const model = part.model?.toLowerCase() || '';
          return searchWords.every(word => 
            name.includes(word) || brand.includes(word) || model.includes(word)
          );
        });
      }

      // Fallback for parts created before keywords were added
      if (results.length === 0) {
        const qFallback = query(
          collection(db, 'parts'),
          where('nameLower', '>=', searchTerm),
          where('nameLower', '<=', searchTerm + '\uf8ff')
        );
        const snapshotFallback = await getDocs(qFallback);
        results = snapshotFallback.docs.map(doc => ({ id: doc.id, ...doc.data() as any }));
      }

      // Sort results by price (ascending)
      results.sort((a, b) => (a.price || 0) - (b.price || 0));

      setSearchResults(results);

      // Log search for BI Opportunity Radar (Anonymized for Supplier Intelligence)
      if (searchTerm.length > 2) {
        await addDoc(collection(db, 'search_logs'), {
          query: searchTerm,
          vehicleInfo: vehicle ? `${vehicle.brand} ${vehicle.model}` : 'generic',
          resultsCount: results.length,
          shopCity: profile?.address?.city || '',
          shopState: profile?.address?.state || '',
          createdAt: serverTimestamp()
        });
      }
    } catch (error) {
      console.error("Error searching catalog:", error);
    } finally {
      setSearchingCatalog(false);
    }
  };

  const addPartFromCatalog = (part: any) => {
    console.log("Adding part from catalog:", part);
    const newPart: PartItem = {
      id: part.id,
      name: part.name,
      price: part.price,
      brand: part.brand,
      model: part.model,
      year: part.year,
      color: part.color,
      photoURL: part.photoURL,
      productURL: part.productURL,
      supplierId: part.supplierId,
      supplierName: part.supplierName,
      quantity: 1
    };
    setParts([...parts, newPart]);
    setShowResults(false);
    setPartName('');
  };

  const handleSearchPrice = async () => {
    if (!partName.trim()) return;
    setLoadingPrice(true);
    try {
      const vehicleInfo = vehicle ? `${vehicle.brand} ${vehicle.model} ${vehicle.year}` : 'Veículo não especificado';
      const companyId = selectedCompanyId || profile?.companyId || profile?.id || '';
      const avgPrice = await getAveragePrice(partName, profile?.cep || '', vehicleInfo, profile?.id || '', companyId);
      const newPart: PartItem = {
        id: Date.now().toString(),
        name: partName,
        price: avgPrice,
        quantity: 1
      };
      setParts([...parts, newPart]);
      setPartName('');
    } catch (error) {
      console.error(error);
      alert("Erro ao buscar preço médio.");
    } finally {
      setLoadingPrice(false);
    }
  };

  const handleAddManualPart = () => {
    if (!partName.trim()) return;
    const newPart: PartItem = {
      id: Date.now().toString(),
      name: partName,
      price: 0,
      quantity: 1
    };
    setParts([...parts, newPart]);
    setPartName('');
  };

  const handleLaborAI = async () => {
    if (parts.length === 0) {
      alert("Adicione pelo menos uma peça para que a IA possa sugerir a mão de obra adequada.");
      return;
    }
    setLoadingLaborAI(true);
    try {
      const vehicleInfo = vehicle ? `${vehicle.brand} ${vehicle.model} ${vehicle.year}` : 'Veículo não especificado';
      const companyId = selectedCompanyId || profile?.companyId || profile?.id || '';
      const suggestions = await getLaborSuggestions(parts, vehicleInfo, availableServices, profile?.id || '', companyId);
      
      if (suggestions && Array.isArray(suggestions)) {
        const newServices = suggestions.map((s: any) => ({
          id: Math.random().toString(36).substr(2, 9),
          name: s.serviceName,
          price: s.price,
          foundMatch: s.foundMatch
        }));
        setServiceItems(prev => [...prev, ...newServices]);
        alert(`${newServices.length} sugestões de mão de obra adicionadas.`);
      }
    } catch (error) {
      console.error("Labor AI failed:", error);
      alert("Não foi possível obter sugestão de mão de obra no momento.");
    } finally {
      setLoadingLaborAI(false);
    }
  };

  const removePart = (id: string) => {
    setParts(parts.filter(p => p.id !== id));
  };

  const startEditPart = (part: PartItem) => {
    setEditingPartId(part.id);
    setEditPrice(part.price);
  };

  const saveEditPart = (id: string) => {
    setParts(parts.map(p => p.id === id ? { ...p, price: editPrice } : p));
    setEditingPartId(null);
  };

  const updateQuantity = (id: string, newQuantity: number) => {
    if (newQuantity < 1) return;
    setParts(parts.map(p => p.id === id ? { ...p, quantity: newQuantity } : p));
  };

  const totalParts = parts.reduce((acc, p) => acc + (p.price * (p.quantity || 1)), 0);
  const totalLabor = serviceItems.reduce((acc, s) => acc + s.price, 0);
  const totalQuote = totalParts + totalLabor;

  const handleSaveQuote = async () => {
    const companyId = selectedCompanyId || profile?.companyId;
    if (!companyId || !customer) {
      alert("Selecione um cliente primeiro.");
      return;
    }
    if (parts.length === 0 && serviceItems.length === 0) {
      alert("Adicione peças ou mão de obra.");
      return;
    }

    setLoading(true);
    try {
      // Check plan limit
      const limitCheck = await checkPlanLimit(profile.companyId, profile.plan, 'budgets', effectiveProfile?.role || profile?.role);
      if (!limitCheck.allowed) {
        setShowLimitModal(true);
        setLoading(false);
        return;
      }

      console.log('Attempting to save quote with companyId:', companyId, 'for customer:', customer.id);
      
      const sanitizeData = (obj: any) => {
        const newObj: any = {};
        Object.keys(obj).forEach(key => {
          if (obj[key] !== undefined) {
             if (Array.isArray(obj[key])) {
                newObj[key] = obj[key].map((item: any) => {
                  const newItem: any = {};
                  Object.keys(item).forEach(k => {
                    if (item[k] !== undefined) newItem[k] = item[k];
                  });
                  return newItem;
                });
             } else {
                newObj[key] = obj[key];
             }
          }
        });
        return newObj;
      };

      const laborPrice = serviceItems.reduce((acc, s) => acc + (s.price || 0), 0);
      
      const rawQuoteData = {
        companyId: companyId || profile?.companyId || profile?.id,
        customerId: customer.id,
        customerName: customer.name,
        customerCpf: customer.cpf || '',
        customerPhone: customer.phone || '',
        customerEmail: customer.email || '',
        customerAddress: customer.address || '',
        vehicleId: vehicle?.id || null,
        vehicleInfo: vehicle ? `${vehicle.brand} ${vehicle.model} ${vehicle.year}` : null,
        employeeId: profile?.uid || profile?.id || '',
        employeeName: profile?.name || profile?.displayName || 'Funcionário',
        // Merge pieces and services into parts to satisfy strict schema
        parts: [
          ...parts,
          ...serviceItems.map(s => ({ ...s, isService: true }))
        ],
        laborPrice: laborPrice,
        total: totalQuote,
        status: 'pending',
        createdAt: serverTimestamp()
      };

      const sanitizedData = sanitizeData(rawQuoteData);

      await addDoc(collection(db, 'quotes'), {
        ...sanitizedData,
        createdAt: serverTimestamp()
      });
      
      await notificationService.info(
        companyId, 
        'Novo Orçamento Criado', 
        `Orçamento de R$ ${totalQuote.toFixed(2)} para ${customer.name} foi registrado.`
      );

      if (window.confirm("Orçamento salvo com sucesso! Deseja enviá-lo agora via WhatsApp para o cliente?")) {
        handleWhatsAppShare(sanitizedData);
      }
      
      setParts([]);
      setServiceItems([]);
      setCustomer(null);
      setVehicle(null);
      setCustomerCode('');
      
      alert("Sucesso: Orçamento salvo! Verifique o Histórico abaixo.");
      
      // Rolar para o histórico
      if (historyRef.current) {
        historyRef.current?.scrollIntoView({ behavior: 'smooth' });
      }

    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'budgets');
    } finally {
      setLoading(false);
    }
  };

  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentStep, setPaymentStep] = useState<'qr' | 'processing' | 'success'>('qr');

  const handleFinalizeOrderClick = async () => {
    if (authLoading) {
      alert("Carregando perfil... Por favor, aguarde um momento.");
      return;
    }

    if (!profile) {
      alert("Erro: Perfil de usuário não encontrado. Tente fazer login novamente.");
      return;
    }

    const companyId = selectedCompanyId || profile?.companyId || profile?.id;
    if (!companyId) {
      alert("Erro: ID da empresa não encontrado. Verifique seu perfil.");
      return;
    }

    if (!customer) {
      alert("Selecione um cliente primeiro.");
      return;
    }
    
    if (parts.length === 0) {
      alert("Adicione pelo menos uma peça ao orçamento.");
      return;
    }

    setLoading(true);
    try {
      const limitCheck = await checkPlanLimit(companyId, effectiveProfile?.plan || 'free', 'budgets', effectiveProfile?.role || profile?.role);
      if (!limitCheck.allowed && profile?.role !== 'admin') {
        alert(`Você atingiu o limite do seu plano (${limitCheck.limit} orçamentos). Faça um upgrade para continuar.`);
        setLoading(false);
        return;
      }

      const canAccessSuppliers = profile?.role === 'admin' || PLAN_LIMITS[effectiveProfile?.plan || 'free'].suppliers;
      if (!canAccessSuppliers) {
        alert("O acesso a fornecedores está disponível nos planos Oficina Pro e Oficina Elite.");
        setLoading(false);
        return;
      }

      const laborPrice = serviceItems.reduce((acc, s) => acc + (s.price || 0), 0);

      // 1. Create the Quote (Strict Schema V11)
      const quoteData = {
        companyId,
        customerId: customer.id,
        customerName: customer.name,
        customerCpf: customer.cpf || '',
        customerPhone: customer.phone || '',
        customerEmail: customer.email || '',
        customerAddress: customer.address || '',
        vehicleId: vehicle?.id || null,
        vehicleInfo: vehicle ? `${vehicle.brand} ${vehicle.model} ${vehicle.year}` : null,
        employeeId: effectiveProfile?.id || profile?.id || '',
        employeeName: effectiveProfile?.name || profile?.name || 'Funcionário',
        parts: [
          ...parts,
          ...serviceItems.map(s => ({ ...s, isService: true }))
        ],
        laborPrice: laborPrice,
        total: totalQuote,
        status: 'approved',
        createdAt: serverTimestamp()
      };
      const quoteRef = await addDoc(collection(db, 'quotes'), quoteData);

      // 2. Create Work Order IMMEDIATELY with status 'waiting_payment'
      const osPayload = {
        companyId,
        customerId: customer.id,
        customerCode: customer.code || '',
        equipmentId: vehicle?.id || 'none',
        employeeId: effectiveProfile?.id || profile?.id || 'unknown',
        employeeName: effectiveProfile?.name || profile?.name || 'Funcionário',
        customerName: customer.name,
        vehicleInfo: vehicle ? `${vehicle.brand} ${vehicle.model}` : 'Generic',
        brand: vehicle?.brand || '',
        model: vehicle?.model || '',
        reportedProblem: `Serviço iniciado via Orçamento #${quoteRef.id.substring(0, 6)}`,
        laborCost: totalLabor,
        partsCost: totalParts,
        subtotal: totalQuote,
        discount: 0,
        totalCost: totalQuote,
        paidAmount: 0,
        remainingAmount: totalQuote,
        status: 'waiting_payment',
        budgetId: quoteRef.id,
        services: [
          ...parts.map(p => ({ id: p.id, name: p.name, price: p.price, laborPrice: 0, partPrice: p.price })),
          ...serviceItems.map(s => ({ id: s.id, name: s.name, price: s.price, laborPrice: s.price, partPrice: 0 }))
        ],
        timeline: [{
          type: 'status',
          content: 'OS criada automaticamente. Aguardando pagamento.',
          createdAt: formatDateBRT(new Date())
        }],
        createdAt: serverTimestamp()
      };
      const woRef = await addDoc(collection(db, 'work_orders'), osPayload);

      // 3. Group parts by supplier and create Purchase Orders linked to the OS
      const supplierParts = parts.filter(p => p.supplierId);
      const partsBySupplier: { [key: string]: any[] } = {};
      supplierParts.forEach(part => {
        if (part.supplierId) {
          if (!partsBySupplier[part.supplierId]) partsBySupplier[part.supplierId] = [];
          partsBySupplier[part.supplierId].push(part);
        }
      });

      // Also create one order for manual/unassigned parts if any
      const manualParts = parts.filter(p => !p.supplierId);
      if (manualParts.length > 0) {
        partsBySupplier['_manual'] = manualParts;
      }

      const orderIds: string[] = [];
      for (const supplierId of Object.keys(partsBySupplier)) {
        const items = partsBySupplier[supplierId];
        const total = items.reduce((acc, item) => acc + (item.price * (item.quantity || 1)), 0);
        const isManual = supplierId === '_manual';

        // NEW: Check Supplier Business Hours
        let isClosed = false;
        let nextOpenMsg = "";
        
        if (!isManual) {
          try {
            const supplierSnap = await getDoc(doc(db, 'users', supplierId));
            if (supplierSnap.exists()) {
              const sData = supplierSnap.data();
              const hours = sData.businessHours;
              if (hours && hours.open && hours.close && hours.days) {
                const now = new Date();
                const currentDay = now.getDay();
                const currentHour = now.getHours();
                const currentMinute = now.getMinutes();
                const currentTime = `${currentHour.toString().padStart(2, '0')}:${currentMinute.toString().padStart(2, '0')}`;
                
                const dayActive = (hours.days || []).includes(currentDay);
                const timeActive = currentTime >= hours.open && currentTime <= hours.close;
                
                if (!dayActive || !timeActive) {
                  isClosed = true;
                  nextOpenMsg = `Compra realizada fora do horário comercial (${hours.open} - ${hours.close}). O pedido será agendado para o próximo dia útil às ${hours.open}.`;
                }
              }
            }
          } catch (e) {
            console.warn("Failed to check supplier hours:", e);
          }
        }

        const orderRef = await addDoc(collection(db, 'purchase_orders'), {
          shopId: companyId,
          shopName: profile?.companyName || profile?.name || 'Oficina',
          supplierId: isManual ? 'manual' : supplierId,
          supplierName: isManual ? 'Compra Direta' : (items[0].supplierName || 'Distribuidora'),
          quoteId: quoteRef.id,
          workOrderId: woRef.id,
          items,
          total,
          status: 'aguardando_pagamento',
          paymentStatus: 'pendente',
          customerName: customer.name,
          vehicleInfo: vehicle ? `${vehicle.brand} ${vehicle.model} ${vehicle.year}` : null,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
        orderIds.push(orderRef.id);
      }

      // 4. Update OS with the purchase order IDs
      await updateDoc(doc(db, 'work_orders', woRef.id), {
        purchaseOrderIds: orderIds
      });

      // 5. Notify
      await notificationService.info(
        companyId,
        'Pedido e OS Criados',
        `Peças solicitadas e OS aberta para ${customer.name}. Acesse "Meus Pedidos" para realizar o pagamento.`
      );

      if (orderIds.length > 0) {
        alert(`✅ Pedido de peças criado e OS aberta!\n\n${orderIds.length > 1 ? 'Alguns fornecedores' : 'O fornecedor'} pode estar fora do horário comercial no momento. Você será redirecionado para concluir o pagamento.`);
      } else {
        alert(`✅ Pedido de peças criado e OS aberta!`);
      }
      
      resetForm();
      navigate('/app/orders');

    } catch (error: any) {
      handleFirestoreError(error, OperationType.WRITE, 'quotes/orders');
    } finally {
      setLoading(false);
    }
  };

  const handleStartRepairFromHistory = async (quote: Quote) => {
    if (!profile) return;
    const companyId = selectedCompanyId || profile?.companyId || profile?.id;
    if (!companyId) return;

    setLoading(true);
    try {
      // 1. Data Parsing (V14 Filter)
      const quoteParts = (quote.parts || []).filter((p: any) => !p.isService);
      const quoteServices = (quote.parts || []).filter((p: any) => p.isService);
      
      const tLabor = quoteServices.reduce((acc, s) => acc + (s.price || 0), 0);
      const tParts = quoteParts.reduce((acc, p) => acc + (p.price * (p.quantity || 1)), 0);
      const ttQuote = tLabor + tParts;

      // 2. Create Work Order
      const osPayload = {
        companyId,
        customerId: quote.customerId,
        equipmentId: quote.vehicleId || 'none',
        employeeId: profile.uid || profile.id,
        customerName: quote.customerName,
        vehicleInfo: quote.vehicleInfo || 'Generic',
        brand: '',
        model: '',
        reportedProblem: `Iniciado via Orçamento #${quote.id.substring(0, 6)}`,
        laborCost: tLabor,
        partsCost: tParts,
        subtotal: ttQuote,
        discount: 0,
        totalCost: ttQuote,
        paidAmount: 0,
        remainingAmount: ttQuote,
        status: 'waiting_payment',
        budgetId: quote.id,
        services: [
          ...quoteParts.map(p => ({ id: p.id, name: p.name, price: p.price, laborPrice: 0, partPrice: p.price })),
          ...quoteServices.map(s => ({ id: s.id, name: s.name, price: s.price, laborPrice: s.price, partPrice: 0 }))
        ],
        timeline: [{
          type: 'status',
          content: 'Reparo iniciado via histórico.',
          createdAt: formatDateBRT(new Date())
        }],
        createdAt: serverTimestamp()
      };
      
      const woRef = await addDoc(collection(db, 'work_orders'), osPayload);

      // 3. Create Purchase Orders
      const supplierParts = quoteParts.filter((p: any) => p.supplierId);
      const manualParts = quoteParts.filter((p: any) => !p.supplierId);
      
      const partsBySupplier: { [key: string]: any[] } = {};
      if (manualParts.length > 0) partsBySupplier['_manual'] = manualParts;
      supplierParts.forEach((p: any) => {
        if (!partsBySupplier[p.supplierId]) partsBySupplier[p.supplierId] = [];
        partsBySupplier[p.supplierId].push(p);
      });

      for (const supplierId of Object.keys(partsBySupplier)) {
        const items = partsBySupplier[supplierId];
        const isManual = supplierId === '_manual';
        await addDoc(collection(db, 'purchase_orders'), {
          shopId: companyId,
          shopName: profile?.companyName || profile?.name || 'Oficina',
          supplierId: isManual ? 'manual' : supplierId,
          supplierName: isManual ? 'Compra Direta' : (items[0].supplierName || 'Fornecedor'),
          quoteId: quote.id,
          workOrderId: woRef.id,
          items,
          total: items.reduce((acc, i) => acc + ((i.price || 0) * (i.quantity || 1)), 0),
          status: 'aguardando_pagamento',
          paymentStatus: 'pendente',
          customerName: quote.customerName,
          vehicleInfo: quote.vehicleInfo || null,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      }

      // 4. Update existing Quote
      await updateDoc(doc(db, 'quotes', quote.id), { 
        status: 'approved',
        updatedAt: serverTimestamp()
      });

      alert("✅ Reparo Iniciado!\n\n1. OS Gerada no Kanban\n2. Peças Solicitadas\n3. Redirecionando para Pagamento...");
      navigate('/app/orders');

    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'quotes/repair');
    } finally {
      setLoading(false);
    }
  };


  const resetForm = () => {
    setParts([]);
    setServiceItems([]);
    setCustomer(null);
    setVehicle(null);
    setCustomerCode('');
    setPaymentData(null);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  const generatePDF = async (quoteData: any, isPreview: boolean = false) => {
    if (isPreview && !customer) {
      alert("Selecione um cliente primeiro para gerar o PDF.");
      return;
    }
    if (isPreview && parts.length === 0 && serviceItems.length === 0) {
      alert("Adicione pelo menos uma peça ou serviço para gerar o PDF.");
      return;
    }

    const userPlan = effectiveProfile?.plan || 'free';
    const limitCheck = await checkPlanLimit(profile?.companyId || profile?.id || '', userPlan, 'pdfDownloads', profile?.role || effectiveProfile?.role);
    
    if (!limitCheck.allowed && profile?.role !== 'admin' && !isPreview) {
      alert(`Você atingiu o limite de downloads do seu plano (${limitCheck.limit} PDFs/mês). Faça upgrade para o plano Elite para downloads ilimitados.`);
      return;
    }

    const canGeneratePDF = profile?.role === 'admin' || PLAN_LIMITS[userPlan === 'start' ? 'free' : userPlan].pdf;
    if (!canGeneratePDF && profile?.role !== 'admin') {
      alert("A geração de PDF está disponível nos planos Oficina Pro e Oficina Elite. Faça um upgrade para liberar esta função.");
      return;
    }

    const business = {
      name: profile?.companyName || profile?.fullName || profile?.ownerName || profile?.name || 'Service Hub Pro',
      tradeName: profile?.tradeName || profile?.displayName,
      doc: profile?.cnpj || profile?.ownerCpf || profile?.cpfCnpj,
      address: profile?.address ? `${profile.address.street}, ${profile.address.number} - ${profile.address.city}/${profile.address.state}` : '',
      contact: profile?.phone || profile?.email || '',
      logo: profile?.logo
    };

    const cust = isPreview ? customer : { 
      name: quoteData?.customerName, 
      cpf: quoteData?.customerCpf, 
      phone: quoteData?.customerPhone, 
      email: quoteData?.customerEmail, 
      address: quoteData?.customerAddress 
    };

    const rawItems = isPreview ? parts : (quoteData?.parts || []);
    const rawServices = isPreview ? serviceItems : [];
    
    // V14: Since we merged services into parts with 'isService: true' in V11, 
    // we must filter them back here for the correct PDF sections.
    const quoteParts = isPreview 
      ? rawItems 
      : rawItems.filter((p: any) => !p.isService);
      
    const quoteServices = isPreview 
      ? rawServices 
      : rawItems.filter((p: any) => p.isService);

    const totalPartsValue = quoteParts.reduce((acc: number, p: any) => acc + ((p.price || 0) * (p.quantity || 1)), 0);
    const totalServicesValue = quoteServices.reduce((acc: number, s: any) => acc + (s.price || 0), 0);
    const quoteLabor = isPreview ? totalLabor : totalServicesValue;

    const sections = [
      {
        title: 'Informações do Cliente e Veículo',
        headers: ['Campo', 'Descrição'],
        body: [
          ['Cliente', cust.name],
          ['CPF/CNPJ', cust.cpf || 'Não informado'],
          ['Telefone', cust.phone || 'Não informado'],
          ['Veículo', vehicle ? `${vehicle.brand} ${vehicle.model} ${vehicle.year}` : (quoteData?.vehicleInfo || 'Não especificado')],
          ['Placa', vehicle?.plate || 'Não especificado']
        ]
      },
      {
        title: 'Peças e Itens',
        headers: ['Descrição', 'Qtd', 'Unitário', 'Total'],
        body: quoteParts.map((p: any) => [
          p.name,
          p.quantity || 1,
          `R$ ${(p.price || 0).toFixed(2)}`,
          `R$ ${((p.price || 0) * (p.quantity || 1)).toFixed(2)}`
        ])
      },
      {
        title: 'Mão de Obra e Serviços',
        headers: ['Serviço', 'Preço'],
        body: quoteServices.map((s: any) => [
          s.name,
          `R$ ${(s.price || 0).toFixed(2)}`
        ])
      },
      {
        title: 'Resumo Financeiro',
        headers: ['Descrição', 'Valor'],
        body: [
          ['Total em Peças', `R$ ${totalPartsValue.toFixed(2)}`],
          ['Total em Serviços', `R$ ${totalServicesValue.toFixed(2)}`],
          ['VALOR TOTAL DO ORÇAMENTO', `R$ ${(isPreview ? totalQuote : (quoteData?.total || (totalPartsValue + totalServicesValue))).toFixed(2)}`]
        ]
      }
    ];

    // Plan Limit Check for PDF
    if (profile?.role !== 'admin') {
      const pdfCheck = await checkPlanLimit(profile?.companyId || profile?.id || '', profile?.plan || 'free', 'pdfDownloads', profile?.role);
      if (!pdfCheck.allowed) {
        setShowLimitModal(true);
        return;
      }
    }

    const sourceLabel = isPreview 
      ? '(Loja)' 
      : (quoteData?.createdBy === 'cliente' || quoteData?.createdBy === 'whatsapp' || quoteData?.createdBy === 'whatsapp_bot' 
          ? '(Client)' 
          : '(Loja)');

    const titlePrefix = isPreview ? 'ORÇAMENTO' : `#${quoteData?.id?.substring(0, 8).toUpperCase()}`;
    const finalTitle = `${titlePrefix} ${sourceLabel}`;

    generateProfessionalReport(
      finalTitle,
      business,
      sections,
      isPreliminary || (quoteData?.status === 'initial_diagnosis')
    );

    if (!isPreview && profile?.role !== 'admin') {
      await addDoc(collection(db, 'usage_logs'), {
        companyId: profile?.companyId || profile?.id || '',
        type: 'pdf_download',
        entityType: 'quote',
        entityId: quoteData?.id || 'manual',
        createdAt: serverTimestamp()
      });
    }
  };

  const handleWhatsAppShare = (quoteData: any) => {
    if (!profile) {
      alert("Por favor, faça login para que nosso agente possa processar o envio.");
      return;
    }

    const phone = quoteData.customerPhone?.replace(/\D/g, '');
    if (!phone) {
      alert("Este cliente não possui telefone cadastrado.");
      return;
    }

    // Logic for Agent-Assisted Internal Sending
    const message = `Olá! Estou preparando o envio do orçamento para o cliente ${quoteData.customerName}. Por favor, gere o PDF e envie para o número ${phone}. Valor total: R$ ${quoteData.total.toFixed(2)}.`;
    
    // V12: Integrated Navigation instead of external window.open
    navigate('/app/conversations', { 
      state: { 
        autoSelectPhone: phone,
        autoMessage: message,
        quoteId: quoteData.id 
      } 
    });
  };

  const handleDeleteQuote = async (id: string) => {
    try {
      // Try to delete from both collections as we merged them in the UI
      await Promise.allSettled([
        deleteDoc(doc(db, 'quotes', id)),
        deleteDoc(doc(db, 'budgets', id))
      ]);
      alert("Orçamento excluído com sucesso.");
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'budgets');
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-10 pb-16  mx-auto"
    >
      <PlanLimitModal
        isOpen={showLimitModal}
        onClose={() => setShowLimitModal(false)}
        currentPlan={profile?.plan || 'free'}
        feature="orçamentos"
      />

      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-black text-gray-900 dark:text-white tracking-tight">Orçamentos</h2>
          <p className="text-gray-500 dark:text-gray-400">Crie, gerencie e envie orçamentos para seus clientes.</p>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left Column: Form */}
        <div className="space-y-8">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white dark:bg-gray-800 p-10 rounded-[3rem] shadow-2xl border border-gray-100 dark:border-gray-700 relative overflow-hidden flex flex-col justify-between min-h-[350px]"
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50 dark:bg-indigo-900/20 rounded-full -mr-16 -mt-16 transition-transform duration-700 hover:scale-150"></div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-6 relative z-10 flex items-center gap-2">
              <User className="h-5 w-5 text-indigo-600" />
              Dados do Cliente
            </h3>
            <div className="flex flex-col sm:flex-row gap-3 relative z-10">
              <input 
                type="text" 
                placeholder="Código do Cliente" 
                value={customerCode} 
                onChange={e => setCustomerCode(e.target.value)} 
                className="w-full p-6 text-xl font-bold border-2 border-gray-200 rounded-[2rem] dark:bg-gray-900/50 dark:border-gray-700 dark:text-white focus:ring-4 focus:ring-indigo-500 outline-none transition-all" 
              />
              <button 
                onClick={() => handleCustomerLookup()} 
                className="w-full sm:w-auto bg-indigo-600 text-white px-10 py-6 text-xl font-black rounded-[2rem] hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-500/20 flex items-center justify-center gap-3 active:scale-95"
              >
                <Search className="h-6 w-6" /> BUSCAR
              </button>
            </div>
            {customer && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="mt-6 p-4 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800/50 rounded-2xl relative z-10"
              >
                <p className="text-base font-bold text-emerald-800 dark:text-emerald-400">{customer.name}</p>
                <p className="text-sm text-emerald-600 dark:text-emerald-500 mt-1 flex items-center gap-1">
                  <CheckCircle className="h-3 w-3" /> {customer.phone}
                </p>
                {vehicle && (
                  <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400 mt-2 pt-2 border-t border-emerald-200/50 dark:border-emerald-800/50">
                    Veículo: {vehicle.brand} {vehicle.model} {vehicle.year}
                  </p>
                )}
              </motion.div>
            )}

            {/* AI Diagnosis Button */}
            <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700 relative z-10">
              <button 
                onClick={() => setShowAiDiagnosisModal(true)}
                className="w-full py-4 bg-gradient-to-r from-indigo-600 to-violet-600 text-white font-bold rounded-2xl shadow-xl shadow-indigo-500/20 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-3 group"
              >
                <div className="p-2 bg-white/20 rounded-xl group-hover:rotate-12 transition-transform">
                  <BrainCircuit className="h-5 w-5" />
                </div>
                <span>Iniciar Diagnóstico Real via IA</span>
              </button>
              <p className="text-[10px] text-gray-400 text-center mt-3 font-medium italic">
                * Use fotos, áudio ou mensagens do cliente para um orçamento preliminar imediato.
              </p>
            </div>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 relative"
          >
            <div className="absolute top-0 right-0 w-32 h-32 overflow-hidden rounded-lg pointer-events-none">
              <div className="absolute top-0 right-0 w-32 h-32 bg-amber-50 dark:bg-amber-900/20 rounded-full -mr-16 -mt-16 transition-transform duration-700 hover:scale-150"></div>
            </div>
            <div className="space-y-6 relative z-10">
              {/* Adicionar Peça Section */}
              <div className="space-y-3">
                <label className="text-sm font-bold text-gray-700 dark:text-gray-300 flex items-center gap-2">
                  <Package className="h-4 w-4 text-amber-500" />
                  Adicionar Peça (Buscar Fornecedores)
                </label>
                <div className="flex flex-col sm:flex-row gap-3 relative">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Nome da peça para buscar..."
                      value={partName}
                      onChange={(e) => {
                        setPartName(e.target.value);
                        if (e.target.value.length > 2) handleSearchCatalog();
                      }}
                      className="w-full pl-10 pr-4 py-3 bg-gray-50 dark:bg-gray-900 border-none rounded-xl focus:ring-2 focus:ring-indigo-500 dark:text-white"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button 
                      onClick={handleSearchPrice} 
                      disabled={loadingPrice || !partName.trim()}
                      className="flex-1 sm:flex-none bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 px-4 py-3 rounded-xl font-bold hover:bg-amber-100 transition-colors text-xs flex items-center justify-center gap-2"
                      title="Preço Médio IA"
                    >
                      {loadingPrice ? <Loader2 className="h-4 w-4 animate-spin" /> : <BrainCircuit className="h-4 w-4" />}
                      IA
                    </button>
                    <button 
                      onClick={handleAddManualPart} 
                      disabled={!partName.trim()}
                      className="flex-1 sm:flex-none bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 px-4 py-3 rounded-xl font-bold hover:bg-gray-200 transition-colors text-xs flex items-center justify-center gap-2"
                    >
                      <Plus className="w-4 h-4" /> Manual
                    </button>
                  </div>

                  {showResults && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-2xl z-[100] max-h-64 overflow-y-auto">
                      <div className="p-2 flex justify-between items-center border-b border-gray-100 dark:border-gray-700 sticky top-0 bg-white dark:bg-gray-800">
                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Resultados Fornecedores</span>
                        <button onClick={() => setShowResults(false)} className="text-gray-400 hover:text-gray-600">
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                      {searchResults.map((result) => {
                        const shopCity = profile?.address?.city || "";
                        const isSameCity = result.supplierCity && shopCity && result.supplierCity.toLowerCase() === shopCity.toLowerCase();
                        const isSameState = result.supplierState && profile?.address?.state && result.supplierState.toLowerCase() === profile?.address?.state.toLowerCase();
                        
                        // Simulate "Maps" distance and ETA
                        const distanceKm = isSameCity ? Math.floor(Math.random() * 15) + 2 : (isSameState ? Math.floor(Math.random() * 80) + 20 : Math.floor(Math.random() * 500) + 100);
                        const eta = isSameCity ? `${Math.floor(distanceKm * 1.5 + 30)} min` : (isSameState ? `${Math.floor(distanceKm / 40 + 2)}h` : `${Math.floor(distanceKm / 60) + 12}h`);
                        const displayEta = distanceKm > 100 ? "24-48h" : eta;

                        return (
                          <button
                            key={result.id}
                            onClick={() => { addPartFromCatalog(result); setShowResults(false); }}
                            className="w-full flex items-center gap-3 p-4 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 text-left transition-all border-b border-gray-100 dark:border-gray-700/50 group"
                          >
                            <div className="h-12 w-12 bg-gray-100 dark:bg-gray-700/50 rounded-xl overflow-hidden flex-shrink-0 border border-gray-100 dark:border-gray-600">
                              {result.photoURL ? <img src={result.photoURL} alt={result.name} className="w-full h-full object-cover" /> : <Package className="h-full w-full p-3 text-gray-400" />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-black text-gray-900 dark:text-white truncate group-hover:text-indigo-600 transition-colors">{result.name}</p>
                              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-0.5">
                                <span className="text-xs font-bold text-gray-500 uppercase tracking-tight">{result.brand} {result.model && `• ${result.model}`}</span>
                                <span className="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded-lg text-gray-600 dark:text-gray-400 font-black uppercase tracking-widest">{result.partBrand || 'Original'}</span>
                              </div>
                              <div className="flex items-center gap-2 mt-1.5">
                                <div className="flex items-center gap-1 px-1.5 py-0.5 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 rounded-md">
                                  <MapPin className="h-3 w-3" />
                                  <span className="text-[12px] font-black uppercase tracking-widest">{result.supplierCity || 'S. Paulo'}, {result.supplierState || 'SP'}</span>
                                </div>
                                <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded-md ${isSameCity ? 'bg-indigo-50 text-indigo-600' : 'bg-amber-50 text-amber-600'}`}>
                                  <Clock className="h-3 w-3" />
                                  <span className="text-[11px] font-black uppercase tracking-tighter shrink-0 text-indigo-500 bg-indigo-50 dark:bg-indigo-900/30 px-2 py-0.5 rounded-lg">ETA Maps: {displayEta} ({distanceKm}km)</span>
                                </div>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-md font-black text-indigo-600 dark:text-indigo-400">R$ {result.price.toFixed(2)}</p>
                              {result.stock <= 5 && <p className="text-[8px] font-bold text-rose-500 uppercase mt-1">Estoque Crítico</p>}
                            </div>
                          </button>
                        );
                      })}

                      {(marketplaceParts.length > 0 || isSearchingMarketplace) && (
                        <div className="mt-2 border-t border-gray-100 dark:border-gray-700 pt-2">
                          <div className="flex items-center gap-2 mb-2 px-4 py-2 bg-indigo-50 dark:bg-indigo-900/10">
                            <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                            <span className="text-[9px] font-black uppercase text-indigo-900 dark:text-indigo-200 tracking-widest">Destaques do Marketplace (Fornecedores)</span>
                          </div>
                          
                          {isSearchingMarketplace ? (
                            <div className="p-4 text-center">
                              <Loader2 className="w-5 h-5 animate-spin mx-auto text-indigo-600" />
                            </div>
                          ) : marketplaceParts.map((part) => (
                            <button
                              key={part.id}
                              onClick={() => { addPartFromCatalog(part); setShowResults(false); }}
                              className="w-full flex items-center gap-3 p-4 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 text-left transition-all border-b border-gray-100 dark:border-gray-700/50 group"
                            >
                              <div className="h-12 w-12 bg-gray-100 dark:bg-gray-700 rounded-xl overflow-hidden flex-shrink-0 border border-gray-100/50">
                                {part.photoURL ? <img src={part.photoURL} alt={part.name} className="w-full h-full object-cover" /> : <Package className="h-full w-full p-3 text-gray-400" />}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-black text-gray-900 dark:text-white truncate group-hover:text-emerald-600 transition-colors">{part.name}</p>
                                <div className="flex items-center gap-2 mt-1">
                                  <span className="text-[9px] font-black text-indigo-600 uppercase italic">{part.supplierName}</span>
                                  <div className="flex items-center gap-0.5">
                                    <Star className="w-2.5 h-2.5 text-amber-500 fill-amber-500" />
                                    <span className="text-[8px] font-bold text-gray-500">{part.avgRating?.toFixed(1) || '0.0'}</span>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2 mt-1">
                                  <div className="flex items-center gap-1 text-[8px] text-gray-400 font-bold uppercase">
                                    <MapPin className="h-2.5 w-2.5" />
                                    {part.supplierCity}, {part.supplierState}
                                  </div>
                                  <div className="flex items-center gap-1 text-[8px] text-indigo-500 font-bold uppercase">
                                    <Clock className="h-2.5 w-2.5" />
                                    {(() => {
                                      const isSameCity = part.supplierCity?.toLowerCase() === (profile?.address?.city || "").toLowerCase();
                                      const isSameState = part.supplierState?.toLowerCase() === (profile?.address?.state || "").toLowerCase();
                                      const dist = isSameCity ? Math.floor(Math.random() * 15) + 2 : (isSameState ? Math.floor(Math.random() * 80) + 20 : Math.floor(Math.random() * 500) + 100);
                                      const time = isSameCity ? `${Math.floor(dist * 1.5 + 30)} min` : (isSameState ? `${Math.floor(dist / 40 + 2)}h` : "24-48h");
                                      return `ETA Maps: ${time} (${dist}km)`;
                                    })()}
                                  </div>
                                </div>
                              </div>
                              <div className="text-right">
                                <p className="text-md font-black text-emerald-600">R$ {part.price?.toFixed(2)}</p>
                                <span className="text-[8px] font-black text-gray-400 uppercase tracking-widest">Loja Externa</span>
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Adicionar Serviço Section */}
              <div className="space-y-3 pt-4 border-t border-gray-100 dark:border-gray-700">
                <label className="text-sm font-bold text-gray-700 dark:text-gray-300 flex items-center gap-2">
                  <Wrench className="h-4 w-4 text-indigo-500" />
                  Adicionar Serviço
                  {vehicle && (
                    <span className="ml-auto text-xs font-black px-3 py-1 rounded-full bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 uppercase tracking-widest">
                      {vehicle.type === 'moto' ? '🏍️ Moto' : '🚗 Carro'}
                    </span>
                  )}
                </label>

                {/* Search input + results */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 pointer-events-none z-10" />
                  <input
                    type="text"
                    placeholder="Digite o nome do serviço para buscar..."
                    value={serviceName}
                    onChange={(e) => {
                      const val = e.target.value;
                      setServiceName(val);
                      setShowServiceResults(true);
                      const term = val.toLowerCase();
                      const vType = vehicle?.type || 'carro';
                      setServiceResults(
                        availableServices.filter(s =>
                          (val === '' || s.name?.toLowerCase().includes(term) || s.category?.toLowerCase().includes(term)) &&
                          (s.vehicleType === vType || s.vehicleType === 'all' || !s.vehicleType)
                        )
                      );
                    }}
                    onFocus={() => {
                      setShowServiceResults(true);
                      const term = serviceName.toLowerCase();
                      const vType = vehicle?.type || 'carro';
                      setServiceResults(
                        availableServices.filter(s =>
                          (serviceName === '' || s.name?.toLowerCase().includes(term) || s.category?.toLowerCase().includes(term)) &&
                          (s.vehicleType === vType || s.vehicleType === 'all' || !s.vehicleType)
                        )
                      );
                    }}
                    onBlur={() => setTimeout(() => setShowServiceResults(false), 200)}
                    className="w-full pl-10 pr-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent dark:text-white transition-all"
                  />

                  {/* Dropdown results - usando z-index alto para não ficar escondido */}
                  {showServiceResults && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-2xl z-[200] max-h-60 overflow-y-auto">
                      <div className="px-3 py-2 border-b border-gray-100 dark:border-gray-700 sticky top-0 bg-white dark:bg-gray-800 flex items-center justify-between">
                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                          Catálogo da Oficina • {vehicle?.type === 'moto' ? 'Moto' : 'Carro'}
                        </span>
                        <button
                          onMouseDown={(e) => { e.preventDefault(); setShowServiceResults(false); }}
                          className="text-gray-400 hover:text-gray-600 p-1"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>

                      {serviceResults.length > 0 ? (
                        serviceResults.map((service) => (
                          <button
                            key={service.id}
                            onMouseDown={(e) => {
                              e.preventDefault();
                              const newService = {
                                id: Math.random().toString(36).substr(2, 9),
                                name: service.name,
                                price: service.laborPrice || service.defaultPrice || 0,
                                foundMatch: true
                              };
                              setServiceItems(prev => [...prev, newService]);
                              setServiceName('');
                              setShowServiceResults(false);
                            }}
                            className="w-full flex items-center justify-between px-4 py-3 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 text-left transition-colors border-b border-gray-50 dark:border-gray-800/60 last:border-0"
                          >
                            <div>
                              <p className="text-sm font-bold text-gray-900 dark:text-white">{service.name}</p>
                              {service.category && (
                                <p className="text-[10px] text-indigo-500 dark:text-indigo-400 font-bold uppercase tracking-tight mt-0.5">{service.category}</p>
                              )}
                            </div>
                            <span className="text-sm font-black text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/40 px-2 py-1 rounded-lg ml-3 whitespace-nowrap">
                              R$ {(service.laborPrice || service.defaultPrice || 0).toFixed(2)}
                            </span>
                          </button>
                        ))
                      ) : (
                        <div className="p-4 text-center">
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            {serviceName ? `Nenhum serviço encontrado para "${serviceName}"` : 'Nenhum serviço cadastrado para este tipo de veículo.'}
                          </p>
                          {serviceName && (
                            <button
                              onMouseDown={(e) => {
                                e.preventDefault();
                                const price = parseFloat(window.prompt('Valor da mão de obra (R$):', '150') || '0');
                                if (price >= 0) {
                                  setServiceItems(prev => [...prev, {
                                    id: Math.random().toString(36).substr(2, 9),
                                    name: serviceName,
                                    price,
                                    foundMatch: false
                                  }]);
                                  setServiceName('');
                                  setShowServiceResults(false);
                                }
                              }}
                              className="mt-2 text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
                            >
                              + Adicionar "{serviceName}" manualmente
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="flex gap-2">
                  <button
                    onClick={handleLaborAI}
                    disabled={loadingLaborAI || parts.length === 0}
                    className="flex-1 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 px-4 py-2.5 rounded-xl font-bold hover:bg-indigo-100 transition-colors text-xs flex items-center justify-center gap-2 disabled:opacity-50"
                    title={parts.length === 0 ? 'Adicione peças primeiro' : 'Sugerir serviços com IA baseado nas peças'}
                  >
                    {loadingLaborAI ? <Loader2 className="h-4 w-4 animate-spin" /> : <BrainCircuit className="h-4 w-4" />}
                    Sugerir com IA
                  </button>
                  <button
                    onClick={() => {
                      if (!serviceName.trim()) return;
                      const price = parseFloat(window.prompt('Valor da mão de obra (R$):', '150') || '0');
                      if (price >= 0) {
                        setServiceItems(prev => [...prev, {
                          id: Math.random().toString(36).substr(2, 9),
                          name: serviceName,
                          price,
                          foundMatch: false
                        }]);
                        setServiceName('');
                      }
                    }}
                    disabled={!serviceName.trim()}
                    className="flex-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 px-4 py-2.5 rounded-xl font-bold hover:bg-gray-200 transition-colors text-xs flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    <Plus className="w-4 h-4" /> Manual
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Right Column: Current Quote */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 flex flex-col h-full relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-50 dark:bg-emerald-900/20 rounded-full -mr-16 -mt-16 transition-transform duration-700 hover:scale-150"></div>
          <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-6 relative z-10 flex items-center gap-2">
            <ShoppingCart className="h-5 w-5 text-emerald-600" />
            Resumo do Orçamento
          </h3>
          
          <div className="flex-1 overflow-y-auto space-y-3 mb-6 relative z-10 pr-2 custom-scrollbar">
            <AnimatePresence>
              {parts.map(part => (
                <motion.div 
                  key={part.id} 
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900/50 rounded-2xl border border-gray-100 dark:border-gray-700/50 group hover:border-indigo-200 dark:hover:border-indigo-800 transition-colors"
                >
                <div className="flex items-center gap-3 flex-1">
                  {part.photoURL && (
                    <img src={part.photoURL} alt={part.name} className="h-8 w-8 rounded object-cover" />
                  )}
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{part.name}</p>
                    <div className="flex flex-wrap gap-x-2 text-[10px] text-gray-500 uppercase">
                      {part.brand && <span>{part.brand}</span>}
                      {part.model && <span>• {part.model}</span>}
                      {part.year && <span>• {part.year}</span>}
                      {part.color && part.color !== 'Nao se aplica' && <span>• {part.color}</span>}
                    </div>
                  </div>
                </div>
                
                {editingPartId === part.id ? (
                  <div className="flex items-center gap-2">
                    <input 
                      type="number" 
                      value={editPrice} 
                      onChange={e => setEditPrice(parseFloat(e.target.value) || 0)}
                      className="w-24 p-1 text-sm border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                      placeholder="Preço"
                    />
                    <button onClick={() => saveEditPart(part.id)} className="text-green-600 hover:text-green-700">
                      <Check className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <div className="flex items-center border border-gray-200 dark:border-gray-700 rounded overflow-hidden">
                      <button 
                        onClick={() => updateQuantity(part.id, (part.quantity || 1) - 1)}
                        className="px-2 py-1 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200"
                      >
                        -
                      </button>
                      <span className="px-3 py-1 text-xs font-medium text-gray-900 dark:text-white bg-white dark:bg-gray-700">
                        {part.quantity || 1}
                      </span>
                      <button 
                        onClick={() => updateQuantity(part.id, (part.quantity || 1) + 1)}
                        className="px-2 py-1 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200"
                      >
                        +
                      </button>
                    </div>
                    <span className="text-sm font-bold text-gray-900 dark:text-white">R$ {(part.price * (part.quantity || 1)).toFixed(2)}</span>
                    <button onClick={() => startEditPart(part)} className="text-indigo-600 hover:text-indigo-700 p-1.5 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-colors" title="Editar preço">
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button onClick={() => removePart(part.id)} className="text-rose-600 hover:text-rose-700 p-1.5 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-900/30 transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </motion.div>
            ))}
            </AnimatePresence>
            {parts.length === 0 && (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="w-16 h-16 bg-gray-50 dark:bg-gray-800 rounded-full flex items-center justify-center mb-4">
                  <ShoppingCart className="h-8 w-8 text-gray-300 dark:text-gray-600" />
                </div>
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Nenhuma peça adicionada.</p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Busque no catálogo ou adicione manualmente.</p>
              </div>
            )}
          </div>

          <div className="pt-6 border-t border-gray-100 dark:border-gray-700 space-y-4 relative z-10">
            {/* Services List in Summary */}
            <div className="space-y-2">
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-2">Mão de Obra / Serviços</p>
              {serviceItems.map(service => (
                <div key={service.id} className="flex flex-col md:flex-row items-start md:items-center justify-between p-6 2xl:p-8 bg-indigo-50/30 dark:bg-indigo-900/10 rounded-[2rem] 2xl:rounded-[2.5rem] group/s border-2 border-transparent hover:border-indigo-500/20 transition-all gap-4">
                  <div className="flex-1 min-w-0 w-full">
                    <p className="text-lg lg:text-xl 2xl:text-2xl font-black text-gray-900 dark:text-gray-100 truncate tracking-tighter">{service.name}</p>
                    {service.foundMatch && <p className="text-[10px] 2xl:text-sm text-green-600 font-black uppercase tracking-widest bg-green-50 dark:bg-green-900/30 px-4 py-1.5 2xl:px-6 2xl:py-2 rounded-xl inline-block mt-2">Sugerido via Catálogo</p>}
                  </div>
                  <div className="flex items-center gap-4 2xl:gap-6 w-full md:w-auto justify-between md:justify-end">
                    {editingServiceId === service.id ? (
                      <input 
                        type="number"
                        autoFocus
                        value={editPrice}
                        onChange={e => setEditPrice(parseFloat(e.target.value) || 0)}
                        onBlur={() => {
                          setServiceItems(prev => prev.map(s => s.id === service.id ? { ...s, price: editPrice } : s));
                          setEditingServiceId(null);
                        }}
                        className="w-32 2xl:w-40 p-3 2xl:p-4 text-xl 2xl:text-2xl font-black text-right border-4 border-indigo-500 rounded-2xl dark:bg-gray-700 dark:text-white outline-none"
                      />
                    ) : (
                      <span className="text-2xl lg:text-3xl 2xl:text-4xl font-black text-indigo-600 dark:text-indigo-400 text-glow">R$ {service.price.toFixed(2)}</span>
                    )}
                    <div className="flex gap-3">
                      <button 
                        onClick={() => { setEditingServiceId(service.id); setEditPrice(service.price); }}
                        className="p-1 text-indigo-400 hover:text-indigo-600"
                      >
                        <Edit2 className="w-3 h-3" />
                      </button>
                      <button 
                        onClick={() => setServiceItems(prev => prev.filter(s => s.id !== service.id))}
                        className="p-1 text-rose-400 hover:text-rose-600"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
              {serviceItems.length === 0 && (
                <p className="text-[10px] text-gray-400 italic px-2">Nenhum serviço adicionado.</p>
              )}
            </div>

            <div className="flex items-center justify-between text-2xl font-black text-gray-900 dark:text-white px-2">
              <span>Total</span>
              <span className="text-emerald-600 dark:text-emerald-400">R$ {totalQuote.toFixed(2)}</span>
            </div>

            <div className="grid grid-cols-1 gap-3 pt-2">
              <div className="grid grid-cols-2 gap-3">
                <button 
                  onClick={() => generatePDF(null, true)}
                  className="flex items-center justify-center px-4 py-3 border border-gray-200 dark:border-gray-700 shadow-sm text-sm font-bold rounded-xl text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  <FileText className="w-4 h-4 mr-2" /> Gerar PDF
                </button>
                <button 
                  onClick={handleSaveQuote}
                  className="flex items-center justify-center px-4 py-3 border border-transparent shadow-sm text-sm font-bold rounded-xl text-white bg-gray-800 hover:bg-gray-900 dark:bg-gray-700 dark:hover:bg-gray-600 transition-colors"
                >
                  {loading ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div> : 'Salvar Orçamento'}
                </button>
              </div>
              <button 
                onClick={handleFinalizeOrderClick}
                className="flex items-center justify-center px-4 py-4 border border-transparent shadow-lg shadow-indigo-200 dark:shadow-none text-base font-black rounded-xl text-white bg-indigo-600 hover:bg-indigo-700 transition-all hover:-translate-y-0.5"
              >
                {loading ? <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div> : <ShoppingCart className="w-5 h-5 mr-2" />} 
                {loading ? 'Processando...' : 'Solicitar peça e iniciar reparo'}
              </button>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Payment Modal */}
      {showPaymentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl max-w-md w-full overflow-hidden">
            <div className="flex justify-between items-center p-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Pagamento via Pix</h3>
              {paymentStep === 'qr' && (
                <button onClick={() => setShowPaymentModal(false)} className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
                  <X className="h-5 w-5" />
                </button>
              )}
            </div>
            
            <div className="p-6 flex flex-col items-center text-center">
              {paymentStep === 'qr' && (
                <>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
                    Escaneie o QR Code abaixo com o aplicativo do seu banco para pagar o pedido.
                  </p>
                  <div className="bg-white p-4 rounded-xl border-2 border-indigo-100 dark:border-indigo-900 mb-6">
                    {paymentData?.qrCodeBase64 ? (
                      <img 
                        src={`data:image/png;base64,${paymentData.qrCodeBase64}`} 
                        alt="Pix QR Code" 
                        className="w-48 h-48"
                      />
                    ) : (
                      <div className="w-48 h-48 flex items-center justify-center bg-gray-50 rounded-lg">
                        <Loader2 className="h-8 w-8 text-indigo-600 animate-spin" />
                      </div>
                    )}
                  </div>
                  <div className="w-full mb-6">
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-2 font-medium uppercase tracking-wider">Ou copie o código Pix</p>
                    <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-900 p-2 rounded-lg border border-gray-200 dark:border-gray-700">
                      <input 
                        type="text" 
                        readOnly 
                        value={paymentData?.qrCode || ''} 
                        className="flex-1 bg-transparent text-xs text-gray-600 dark:text-gray-400 outline-none truncate"
                      />
                      <button 
                        onClick={() => {
                          if (paymentData?.qrCode) {
                            navigator.clipboard.writeText(paymentData.qrCode);
                            alert('Código PIX copiado!');
                          }
                        }}
                        className="text-indigo-600 dark:text-indigo-400 text-xs font-semibold px-2 py-1 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded"
                      >
                        Copiar
                      </button>
                    </div>
                  </div>
                  <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800 rounded-xl mb-4 text-left">
                    <div className="flex items-center gap-2 text-amber-800 dark:text-amber-400 font-bold text-xs mb-1">
                      <AlertCircle className="w-4 h-4" />
                      Aviso Importante
                    </div>
                    <p className="text-[10px] text-amber-700 dark:text-amber-500">
                      O sistema identificará o pagamento automaticamente. Não feche esta tela antes da confirmação para garantir a integridade do seu pedido.
                    </p>
                  </div>
                </>
              )}

              {paymentStep === 'processing' && (
                <div key="processing" className="py-12 flex flex-col items-center">
                  <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-indigo-600 mb-4"></div>
                  <h4 className="text-lg font-medium text-gray-900 dark:text-white">Processando pagamento...</h4>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">Aguardando confirmação do banco.</p>
                </div>
              )}

              {paymentStep === 'success' && (
                <div key="success" className="py-12 flex flex-col items-center">
                  <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mb-4">
                    <Check className="w-8 h-8 text-green-600 dark:text-green-400" />
                  </div>
                  <h4 className="text-lg font-medium text-gray-900 dark:text-white">Pagamento Aprovado!</h4>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">Gerando pedido de peças...</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* History */}
      <div className="mt-8" ref={historyRef}>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">Histórico de Orçamentos</h3>
          
          <div className="flex flex-col sm:flex-row gap-2">
            {profile?.role === 'admin' && (
              <select
                value={selectedShopId}
                onChange={(e) => {
                  setSelectedShopId(e.target.value);
                  setFilterEmployeeId('');
                }}
                className="p-2 border rounded dark:bg-gray-800 dark:border-gray-700 dark:text-white text-sm"
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
                className="p-2 border rounded dark:bg-gray-800 dark:border-gray-700 dark:text-white text-sm"
              >
                <option value="">Todos os funcionários</option>
                {employees.map(emp => <option key={emp.id} value={emp.id}>{emp.name || emp.displayName}</option>)}
              </select>
            )}
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 shadow-sm rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          {/* Desktop Table */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-900">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Data</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Cliente</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Total</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Funcionário</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Ações</th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {quotes
                  .filter(q => (filterEmployeeId === '' || q.employeeId === filterEmployeeId) || (filterEmployeeId !== '' && !q.employeeId && profile?.role === 'admin' && !selectedShopId))
                  .map((quote) => (
                  <tr key={quote.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {quote.createdAt ? quote.createdAt.toLocaleDateString('pt-BR') : 'Processando...'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white flex items-center gap-2">
                      {quote.customerName}
                      {quote.createdBy === 'whatsapp' && (
                        <MessageSquare className="w-3 h-3 text-green-500" />
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      R$ {quote.total.toFixed(2)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {quote.employeeName}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2 flex items-center justify-end">
                      <button 
                        onClick={() => handleStartRepairFromHistory(quote)}
                        className="px-2 py-1 bg-indigo-600 text-white text-[10px] font-bold rounded-lg hover:bg-indigo-700 transition-colors shadow-sm flex items-center gap-1"
                        title="Prosseguir com Compra e Reparo"
                      >
                        <ShoppingCart className="w-3 h-3" />
                        <span className="hidden lg:inline">Iniciar Reparo</span>
                      </button>
                      
                      <button 
                        onClick={() => handleWhatsAppShare(quote)}
                        className="p-1.5 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-lg transition-colors border border-emerald-100 dark:border-emerald-800/50"
                        title="Enviar via WhatsApp"
                      >
                        <MessageSquare className="w-4 h-4" />
                      </button>

                      <button 
                        onClick={() => generatePDF(quote, false)} 
                        className="p-1.5 text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-colors border border-indigo-100 dark:border-indigo-800/50"
                        title="Download PDF"
                      >
                        <FileText className="w-4 h-4" />
                      </button>

                      <button 
                        onClick={() => handleDeleteQuote(quote.id)} 
                        className="p-1.5 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg transition-colors border border-rose-100 dark:border-rose-800/50"
                        title="Excluir Orçamento"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
                {quotes.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-6 py-4 text-center text-sm text-gray-500 dark:text-gray-400">
                      Nenhum orçamento salvo.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile Card List */}
          <div className="sm:hidden space-y-4 p-4">
            {quotes
              .filter(q => (filterEmployeeId === '' || q.employeeId === filterEmployeeId) || (filterEmployeeId !== '' && !q.employeeId && profile?.role === 'admin' && !selectedShopId))
              .map((quote) => (
              <div key={quote.id} className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 space-y-3">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
                      {quote.customerName}
                      {quote.createdBy === 'whatsapp' && (
                        <MessageSquare className="w-3 h-3 text-green-500" />
                      )}
                    </h4>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {quote.createdAt instanceof Date ? quote.createdAt.toLocaleDateString('pt-BR') : 'Processando...'}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => handleWhatsAppShare(quote)}
                      className="p-2 text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 hover:bg-emerald-100 rounded-md border border-emerald-100 dark:border-emerald-800"
                      title="Enviar via WhatsApp"
                    >
                      <MessageSquare className="h-4 w-4" />
                    </button>
                    <button 
                      onClick={() => {
                        setCustomerCode(quote.customerId);
                        setParts(quote.parts);
                        setServiceItems(quote.services || []);
                        setCustomer({ id: quote.customerId, name: quote.customerName });
                        handleFinalizeOrderClick();
                      }}
                      className="p-2 text-white bg-indigo-600 hover:bg-indigo-700 rounded-md shadow-sm"
                      title="Prosseguir com Compra e Reparo"
                    >
                      <ShoppingCart className="h-4 w-4" />
                    </button>
                    <button onClick={() => generatePDF(quote, false)} className="p-2 text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-300 bg-indigo-50 dark:bg-indigo-900/20 rounded-md">
                      <FileText className="h-4 w-4" />
                    </button>
                    <button onClick={() => handleDeleteQuote(quote.id)} className="p-2 text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300 bg-red-50 dark:bg-red-900/20 rounded-md">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-gray-500 dark:text-gray-400">Total: R$ {quote.total.toFixed(2)}</span>
                  <span className="text-gray-500 dark:text-gray-400">{quote.employeeName}</span>
                </div>
              </div>
            ))}
            {quotes.length === 0 && (
              <p className="text-center text-sm text-gray-500 dark:text-gray-400 py-4">Nenhum orçamento salvo.</p>
            )}
          </div>
        </div>
      </div>
      <AiDiagnosisModal 
        isOpen={showAiDiagnosisModal}
        onClose={() => setShowAiDiagnosisModal(false)}
        vehicleInfo={vehicle ? `${vehicle.brand} ${vehicle.model} ${vehicle.year}` : undefined}
        onApply={(result) => {
          setIsPreliminary(true);
          if (result.parts) {
            const newParts = result.parts.map((p: any) => ({
              id: Math.random().toString(36).substr(2, 9),
              name: p.name,
              price: p.estimatedPrice || 0,
              quantity: 1
            }));
            setParts(prev => [...prev, ...newParts]);
          }
          if (result.services) {
            const newServices = result.services.map((s: any) => ({
              id: Math.random().toString(36).substr(2, 9),
              name: s.name,
              price: s.estimatedPrice || 0,
              foundMatch: false
            }));
            setServiceItems(prev => [...prev, ...newServices]);
          }
          alert("Diagnóstico IA concluído! Itens adicionados como Orçamento Preliminar.");
        }}
      />
    </motion.div>
  );
}

