import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, X, CheckCircle, Wrench, Clock, FileText, BrainCircuit, DollarSign, Trash2, Calendar, User, Car, AlertCircle, ChevronRight, Filter, MoreVertical, Check, MessageSquare, Sparkles, Loader2, Camera, Download, History as HistoryIcon, Package, Star, MapPin } from 'lucide-react';
import { getRepairTips, recognizePlate } from '../services/aiService';
import { historyService } from '../services/historyService';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../AuthContext';
import { db } from '../firebase';
import { handleFirestoreError, OperationType } from '../utils/firestoreErrors';
import { checkPlanLimit, PLAN_LIMITS } from '../utils/planLimits';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import PlanLimitModal from '../components/PlanLimitModal';
import { notificationService } from '../services/notificationService';
import { whatsappService } from '../services/whatsappService';
import CheckInStep from '../components/CheckInStep';

const getStatusBadge = (status: string) => {
  switch (status) {
    case 'completed':
    case 'service_finished':
    case 'delivered':
      return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/50';
    case 'in_repair':
    case 'in repair':
    case 'repair_started':
      return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 border-blue-200 dark:border-blue-800/50';
    case 'waiting_payment':
      return 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400 border-purple-200 dark:border-purple-800/50';
    case 'payment_received':
      return 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800/50';
    case 'pending':
    case 'waiting for parts':
    case 'waiting_parts':
    case 'awaiting_parts':
    case 'Pendente de Peças':
      return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200 dark:border-amber-800/50';
    default:
      return 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700';
  }
};

const translateStatus = (status: string) => {
  switch (status) {
    case 'completed':
    case 'service_finished': return 'Serviço Finalizado';
    case 'delivered': return 'Entregue';
    case 'in_repair':
    case 'in repair': return 'Em Reparo';
    case 'repair_started': return 'Início de Reparo';
    case 'waiting_payment': return 'Aguardando Pagamento';
    case 'payment_received': return 'Pagamento Realizado';
    case 'pending':
    case 'waiting_parts':
    case 'awaiting_parts':
    case 'waiting for parts': return 'Aguardando Peça';
    case 'received': return 'Recebido';
    case 'diagnosing': return 'Em Diagnóstico';
    default: return status;
  }
};
import { generateProfessionalReport } from '../services/invoiceGenerator';
import { 
  collection, 
  addDoc, 
  updateDoc, 
  doc, 
  onSnapshot, 
  query, 
  where, 
  serverTimestamp,
  orderBy,
  arrayUnion,
  getDocs,
  deleteDoc,
  limit
} from 'firebase/firestore';

export default function WorkOrders() {
  const { user, profile, effectiveProfile, selectedCompanyId } = useAuth();
  const navigate = useNavigate();
  const [workOrders, setWorkOrders] = useState<any[]>([]);
  const [shops, setShops] = useState<any[]>([]);
  const [selectedShopId, setSelectedShopId] = useState<string>('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'waiting_payment' | 'in_repair' | 'completed'>('all');
  const [selectedWO, setSelectedWO] = useState<any>(null);
  const [newNote, setNewNote] = useState('');
  const [aiSuggestions, setAiSuggestions] = useState<any[]>([]);
  const [loadingAi, setLoadingAi] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [employees, setEmployees] = useState<any[]>([]);
  const [employeeId, setEmployeeId] = useState('');
  const [filterEmployeeId, setFilterEmployeeId] = useState('');
  const [showLimitModal, setShowLimitModal] = useState(false);
  const [repairTips, setRepairTips] = useState<string>('');
  const [loadingTips, setLoadingTips] = useState(false);
  const [isLprLoading, setIsLprLoading] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

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
  }, [profile?.role]);

  useEffect(() => {
    if (!user) return;
    const companyId = selectedCompanyId || selectedShopId || profile?.companyId;
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
  }, [profile?.companyId, profile?.id, selectedShopId]);
  const [customerCode, setCustomerCode] = useState('');
  const [foundVehicle, setFoundVehicle] = useState<any>(null);
  const [foundBudget, setFoundBudget] = useState<any>(null); // New state
  const [searchingVehicle, setSearchingVehicle] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null); // New state
  const [serviceSearch, setServiceSearch] = useState('');
  const [availableServices, setAvailableServices] = useState<any[]>([]);
  const [inventory, setInventory] = useState<any[]>([]);
  const [selectedServices, setSelectedServices] = useState<any[]>([]);
  const [reportedProblem, setReportedProblem] = useState('');
  const [discount, setDiscount] = useState<number>(0);
  const [partsPaidAmount, setPartsPaidAmount] = useState<number>(0);
  const [payHalf, setPayHalf] = useState(false);
  const [estimatedDeliveryDate, setEstimatedDeliveryDate] = useState('');
  const [mileage, setMileage] = useState('');
  const [checkInData, setCheckInData] = useState<any>(null);
  const [marketplaceParts, setMarketplaceParts] = useState<any[]>([]);
  const [isSearchingMarketplace, setIsSearchingMarketplace] = useState(false);

  const getDeliveryTime = (suppCity: string, shopCity: string, suppState: string, shopState: string) => {
    if (!suppCity || !shopCity) return "24-48h";
    if (suppCity.toLowerCase() === shopCity.toLowerCase()) return "1-2h (Express)";
    if (suppState?.toLowerCase() === shopState?.toLowerCase()) return "4-8h (Padrão)";
    return "24-48h (Remessa)";
  };

  useEffect(() => {
    if (serviceSearch.length < 3) {
      setMarketplaceParts([]);
      return;
    }

    const searchMarketplace = async () => {
      setIsSearchingMarketplace(true);
      try {
        const q = query(
          collection(db, 'parts'),
          where('nameLower', '>=', serviceSearch.toLowerCase()),
          where('nameLower', '<=', serviceSearch.toLowerCase() + '\uf8ff'),
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
            originalId: d.id,
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
        console.error("Marketplace search error:", error);
      } finally {
        setIsSearchingMarketplace(false);
      }
    };

    const timer = setTimeout(searchMarketplace, 500);
    return () => clearTimeout(timer);
  }, [serviceSearch, profile?.address?.city]);

  useEffect(() => {
    if (foundBudget) {
      // Calculate parts total from budget
      const partsTotal = (foundBudget.parts || []).reduce((acc: number, p: any) => acc + (p.price || 0), 0);
      const laborTotal = foundBudget.laborPrice || 0;
      
      // Combine everything into a single service entry as requested
      const budgetService = {
        id: `budget-${foundBudget.id}`,
        name: `Orçamento #${foundBudget.id.substring(0, 8)} - Completo`,
        laborPrice: laborTotal,
        partPrice: partsTotal,
        price: laborTotal + partsTotal,
        inStock: true,
        isBudget: true
      };

      setSelectedServices([budgetService]);

      // If budget is approved, it means parts are paid/purchased
      if (foundBudget.status === 'approved') {
        setPartsPaidAmount(partsTotal);
      } else {
        setPartsPaidAmount(0);
      }
    }
  }, [foundBudget]);

  const isAutomotive = profile?.segment === 'automotive' || !profile?.segment;
  const equipmentLabel = isAutomotive ? 'Veículo' : 'Equipamento';

  useEffect(() => {
    const companyId = selectedCompanyId || profile?.companyId;
    if (!user || !companyId) return;
    const q = query(collection(db, 'quotes'), where('companyId', '==', companyId));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      snapshot.docChanges().forEach(async (change) => {
        if (change.type === 'modified') {
          const budget = change.doc.data();
          if (budget.status === 'approved') { // Assuming approved means parts purchased
            // Find work orders with this budgetId
            const woQuery = query(collection(db, 'work_orders'), where('budgetId', '==', change.doc.id));
            const woSnapshot = await getDocs(woQuery);
            woSnapshot.forEach(async (woDoc) => {
              if (woDoc.data().status === 'Pendente de Peças') {
                await updateDoc(woDoc.ref, { status: 'Em Reparo' });
              }
            });
          }
        }
      });
    });
    return () => unsubscribe();
  }, [user, selectedCompanyId, profile?.companyId]);

  // Sync selectedWO with real-time data
  const currentSelectedWO = selectedWO ? workOrders.find(wo => wo.id === selectedWO.id) : null;
  const vehicleHistoryFromPlate = useMemo(() => {
    if (!currentSelectedWO?.plate) return [];
    return workOrders.filter(wo => wo.plate === currentSelectedWO.plate && wo.id !== currentSelectedWO.id);
  }, [currentSelectedWO?.plate, workOrders, currentSelectedWO?.id]);

  const vehicleStats = useMemo(() => {
    if (vehicleHistoryFromPlate.length === 0) return { totalSpent: 0, lastMileage: 0 };
    const totalSpent = vehicleHistoryFromPlate.reduce((acc, wo) => acc + (wo.totalCost || 0), 0);
    const lastMileage = Math.max(...vehicleHistoryFromPlate.map(wo => parseInt(wo.mileage) || 0));
    return { totalSpent, lastMileage };
  }, [vehicleHistoryFromPlate]);

  useEffect(() => {
    if (!user) return;
    const companyId = selectedCompanyId || selectedShopId || profile?.companyId || profile?.id;

    let q;
    if (selectedCompanyId) {
      q = query(
        collection(db, 'work_orders'),
        where('companyId', '==', selectedCompanyId),
        orderBy('createdAt', 'desc')
      );
    } else if (profile?.role === 'admin' && !selectedShopId) {
      q = query(collection(db, 'work_orders'), orderBy('createdAt', 'desc'));
    } else {
      if (!companyId) return;
      q = query(
        collection(db, 'work_orders'),
        where('companyId', '==', companyId),
        orderBy('createdAt', 'desc')
      );
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setWorkOrders(data);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'work_orders');
    });

    return () => unsubscribe();
  }, [profile, selectedShopId, user, selectedCompanyId, profile?.companyId]);

  // Fetch real services from Firestore
  useEffect(() => {
    const companyId = selectedCompanyId || profile?.companyId;
    if (!companyId) return;
    const q = query(collection(db, 'services'), where('companyId', '==', companyId));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setAvailableServices(data);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'services');
    });
    return () => unsubscribe();
  }, [profile, selectedCompanyId]);

  // Fetch inventory
  useEffect(() => {
    const companyId = selectedCompanyId || profile?.companyId;
    if (!companyId) return;
    const q = query(collection(db, 'inventory'), where('companyId', '==', companyId));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setInventory(data);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'inventory');
    });
    return () => unsubscribe();
  }, [profile, selectedCompanyId]);

  const handleLpr = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setIsLprLoading(true);
    setSearchError(null);
    setCustomerCode('');

    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = reader.result as string;
        try {
          const companyId = selectedCompanyId || effectiveProfile?.companyId || effectiveProfile?.id || '';
          const result = await recognizePlate(base64, effectiveProfile?.id || '', companyId);
          if (result.error) {
            setSearchError(result.error);
          } else if (result.plate) {
            setCustomerCode(result.plate);
            // Auto trigger search
            const companyId = selectedCompanyId || profile?.companyId;
            const qPlate = query(
              collection(db, 'vehicles'),
              where('companyId', '==', companyId),
              where('plate', '==', result.plate.toUpperCase())
            );
            const snapshotPlate = await getDocs(qPlate);
            if (!snapshotPlate.empty) {
              setFoundVehicle({ id: snapshotPlate.docs[0].id, ...snapshotPlate.docs[0].data() });
            } else {
              setSearchError(`Veículo ${result.plate} identificado, mas não cadastrado. Criando pré-cadastro...`);
              // Optionally populate some fields if we had a "New Vehicle" form here
            }
          }
        } catch (err) {
          setSearchError("Erro ao processar imagem da placa.");
        } finally {
          setIsLprLoading(false);
        }
      };
      reader.readAsDataURL(file);
    } catch (err) {
      setIsLprLoading(false);
      setSearchError("Erro ao ler arquivo.");
    }
  };

  const searchVehicle = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!customerCode.trim() || !user) return;

    setSearchingVehicle(true);
    setSearchError(null);
    setFoundVehicle(null);

    try {
      const searchTerm = customerCode.trim().toUpperCase();
      const companyId = selectedCompanyId || profile?.companyId;
      
      // 1. Try searching by plate directly in vehicles
      const qPlate = query(
        collection(db, 'vehicles'),
        where('companyId', '==', companyId),
        where('plate', '==', searchTerm)
      );
      const snapshotPlate = await getDocs(qPlate);

      if (!snapshotPlate.empty) {
        const data = { id: snapshotPlate.docs[0].id, ...snapshotPlate.docs[0].data() } as any;
        setFoundVehicle(data);
        return;
      }

      // 2. Try searching by customer code
      const qCust = query(
        collection(db, 'customers'),
        where('companyId', '==', companyId),
        where('code', '==', searchTerm)
      );
      const snapshotCust = await getDocs(qCust);

      if (!snapshotCust.empty) {
        const customerData = snapshotCust.docs[0].data();
        const customerId = snapshotCust.docs[0].id;

        // 1. Find vehicles for this customer
        const qVeh = query(
          collection(db, 'vehicles'),
          where('companyId', '==', companyId),
          where('customerId', '==', customerId)
        );
        const snapshotVeh = await getDocs(qVeh);

        if (!snapshotVeh.empty) {
          const data = { id: snapshotVeh.docs[0].id, ...snapshotVeh.docs[0].data() } as any;
          setFoundVehicle(data);
        } else {
          throw new Error('Cliente encontrado, mas não possui veículos cadastrados.');
        }

        // 2. Find budget for this customer
        const qBud = query(
          collection(db, 'quotes'),
          where('companyId', '==', companyId),
          where('customerId', '==', customerId),
          orderBy('createdAt', 'desc'),
          limit(1)
        );
        const snapshotBud = await getDocs(qBud);
        if (!snapshotBud.empty) {
          setFoundBudget({ id: snapshotBud.docs[0].id, ...snapshotBud.docs[0].data() });
        } else {
          setFoundBudget(null);
        }
      } else {
        throw new Error('Nenhum veículo ou cliente encontrado com este código/placa.');
      }
    } catch (error: any) {
      setSearchError(error.message || 'Erro ao buscar veículo.');
    } finally {
      setSearchingVehicle(false);
    }
  };

  const addServiceToOS = (service: any) => {
    if (selectedServices.find(s => s.id === service.id)) return;
    
    // Manual additions only bring the service value (labor)
    // as requested by the user, since budget labor/parts are already summed
    const finalPartPrice = 0;
    const finalLaborPrice = service.laborPrice || service.defaultPrice || 0;

    setSelectedServices([...selectedServices, { 
      ...service, 
      laborPrice: finalLaborPrice, 
      partPrice: finalPartPrice,
      price: finalLaborPrice + finalPartPrice,
      inStock: true,
      matchingPart: null,
      priceFromInventory: false
    }]);
    setServiceSearch('');
  };

  const removeServiceFromOS = (serviceId: string) => {
    setSelectedServices(selectedServices.filter(s => s.id !== serviceId));
  };

  const updateServicePrice = (serviceId: string, field: 'laborPrice' | 'partPrice', value: number) => {
    setSelectedServices(selectedServices.map(s => {
      if (s.id === serviceId) {
        const updated = { ...s, [field]: value };
        return {
          ...updated,
          price: updated.laborPrice + updated.partPrice
        };
      }
      return s;
    }));
  };

  const calculateTotal = () => {
    const subtotal = selectedServices.reduce((acc, s) => acc + (s.price || 0), 0);
    return Math.max(0, subtotal - discount - partsPaidAmount);
  };

  const calculateLaborTotal = () => {
    return selectedServices.reduce((acc, s) => acc + (s.laborPrice || 0), 0);
  };

  const calculatePartsTotal = () => {
    return selectedServices.reduce((acc, s) => acc + (s.partPrice || 0), 0);
  };

  const finalizeOS = async () => {
    if (!foundVehicle || !reportedProblem.trim() || !user) return;
    const companyId = selectedCompanyId || profile?.companyId;

    // Check plan limit
    const limitCheck = await checkPlanLimit(companyId, effectiveProfile?.plan || 'free', 'workOrders', effectiveProfile?.role || profile?.role);
    if (!limitCheck.allowed && profile?.role !== 'admin') {
      setShowLimitModal(true);
      return;
    }

    const laborTotal = calculateLaborTotal();
    const partsTotal = calculatePartsTotal();
    const subtotal = laborTotal + partsTotal;
    const total = Math.max(0, subtotal - discount - partsPaidAmount);
    const initialPayment = payHalf ? total / 2 : 0;

    const payload = {
      companyId: companyId,
      customerId: foundVehicle.customerId,
      customerCode: foundVehicle.customerCode || customerCode, // Link to customer code
      equipmentId: foundVehicle.id,
      employeeId: effectiveProfile?.role === 'employee' ? effectiveProfile.id : (employeeId || effectiveProfile?.id),
      employeeName: effectiveProfile?.role === 'employee' 
        ? (effectiveProfile.name || effectiveProfile.displayName) 
        : (employees.find(e => e.id === employeeId)?.name || employees.find(e => e.id === employeeId)?.displayName || effectiveProfile?.name || effectiveProfile?.companyName || 'Oficina'),
      customerName: foundVehicle.customerName || 'Cliente',
      vehicleInfo: `${foundVehicle.brand} ${foundVehicle.model}`,
      plate: foundVehicle.plate,
      brand: foundVehicle.brand,
      model: foundVehicle.model,
      reportedProblem,
      laborCost: laborTotal,
      partsCost: partsTotal,
      subtotal: subtotal,
      discount: discount,
      partsPaidAmount: partsPaidAmount,
      totalCost: total,
      paidAmount: initialPayment,
      remainingAmount: total - initialPayment,
      status: (foundBudget && foundBudget.status !== 'approved') ? 'Pendente de Peças' : (payHalf ? 'in_repair' : 'waiting_payment'),
      budgetId: foundBudget?.id,
      estimatedDeliveryDate,
      mileage,
      checkIn: checkInData,
      services: selectedServices.map(s => ({ 
        id: s.id, 
        name: s.name, 
        laborPrice: s.laborPrice, 
        partPrice: s.partPrice,
        price: s.price 
      })),
      timeline: [{
        type: 'status',
        content: 'Ordem de Serviço criada',
        createdAt: new Date().toISOString()
      }],
      createdAt: serverTimestamp()
    };

    try {
      const docRef = await addDoc(collection(db, 'work_orders'), payload);
      
      // Calculate parts that were NOT in stock (need to be bought)
      const outOfStockPartsTotal = selectedServices
        .filter(s => s.partPrice > 0 && !s.inStock)
        .reduce((acc, s) => acc + s.partPrice, 0);

      // If there are out-of-stock parts, create an expense record
      if (outOfStockPartsTotal > 0) {
        await addDoc(collection(db, 'expenses'), {
          companyId: companyId,
          description: `Peças compradas para OS #${docRef.id.slice(-4)} - ${foundVehicle.customerName}`,
          amount: outOfStockPartsTotal,
          category: 'Peças',
          date: new Date().toISOString().split('T')[0],
          workOrderId: docRef.id
        });
      }

      // Decrement stock for parts that WERE in stock
      for (const s of selectedServices) {
        if (s.inStock && s.matchingPart) {
          const itemRef = doc(db, 'inventory', s.matchingPart.id);
          await updateDoc(itemRef, {
            stockQuantity: s.matchingPart.stockQuantity - 1
          });
        }
      }

      setIsModalOpen(false);
      resetForm();
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'work_orders');
    }
  };

  const resetForm = () => {
    setCustomerCode('');
    setFoundVehicle(null);
    setSelectedServices([]);
    setReportedProblem('');
    setServiceSearch('');
    setDiscount(0);
    setPartsPaidAmount(0);
    setPayHalf(false);
    setEstimatedDeliveryDate('');
    setMileage('');
    setCheckInData(null);
  };

  const fetchAiSuggestions = async () => {
    if (!currentSelectedWO) return;
    setLoadingTips(true);
    try {
      const vehicleInfo = `${currentSelectedWO.brand} ${currentSelectedWO.model}`;
      const items = (currentSelectedWO.services || []).map((s: any) => s.name);
      const comments = (currentSelectedWO.timeline || [])
        .filter((t: any) => t.type === 'note' || t.type === 'diagnosis')
        .map((t: any) => t.content);
      
      const companyId = selectedCompanyId || effectiveProfile?.companyId || effectiveProfile?.id || '';
      const tips = await getRepairTips(vehicleInfo, items, [currentSelectedWO.reportedProblem, ...comments], effectiveProfile?.id || '', companyId);
      setRepairTips(tips);
    } catch (error) {
      console.error("Error fetching AI tips:", error);
      setRepairTips("Não foi possível carregar as dicas de reparo.");
    } finally {
      setLoadingTips(false);
    }
  };

  const addNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNote.trim() || !selectedWO) return;

    try {
      const woRef = doc(db, 'work_orders', selectedWO.id);
      await updateDoc(woRef, {
        timeline: arrayUnion({
          type: 'note',
          content: newNote,
          createdAt: new Date().toISOString()
        })
      });
      setNewNote('');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `work_orders/${selectedWO.id}`);
    }
  };

  const updateStatus = async (newStatus: string) => {
    if (!currentSelectedWO || !user) return;
    const companyId = selectedCompanyId || profile?.companyId;

    try {
      const woRef = doc(db, 'work_orders', currentSelectedWO.id);
      const statusText = translateStatus(newStatus);
      
      const newTimelineItem = {
        type: 'status_change',
        content: `Status alterado para: ${statusText}`,
        createdAt: new Date().toISOString()
      };

      await updateDoc(woRef, {
        status: newStatus,
        timeline: arrayUnion(newTimelineItem)
      });

      if (companyId) {
        await notificationService.info(
          companyId,
          'Atualização de OS',
          `A OS #${currentSelectedWO.id.substring(0, 8).toUpperCase()} do cliente ${currentSelectedWO.customerName} mudou para: ${statusText}.`
        );
      }

      // Automated WhatsApp Notification
      if (profile?.role === 'shop' && currentSelectedWO.customerPhone) {
        whatsappService.sendStatusUpdate(
          currentSelectedWO.customerPhone,
          currentSelectedWO.customerName,
          currentSelectedWO.vehicleInfo || currentSelectedWO.model,
          statusText
        );

        // GMB Review Request if Delivered
        if (newStatus === 'delivered' && effectiveProfile?.googleGmbLink) {
          setTimeout(() => {
            // Re-check effectiveProfile inside timeout to prevent crash after navigation
            if (!effectiveProfile?.googleGmbLink) return;
            whatsappService.sendGmbReview(
              currentSelectedWO.customerPhone,
              currentSelectedWO.customerName,
              effectiveProfile.googleGmbLink
            );
          }, 2000);
        }

        // Global History Recording
        if (newStatus === 'completed' || newStatus === 'delivered') {
          historyService.saveVehicleHistory(currentSelectedWO, effectiveProfile || profile);
        }
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `work_orders/${currentSelectedWO.id}`);
    }
  };

  const payRemainingAndFinish = async () => {
    if (!currentSelectedWO || !user) return;
    const companyId = selectedCompanyId || profile?.companyId;

    try {
      const woRef = doc(db, 'work_orders', currentSelectedWO.id);
      const newTimelineItem = {
        type: 'status_change',
        content: `Pagamento restante recebido e reparo finalizado.`,
        createdAt: new Date().toISOString()
      };

      await updateDoc(woRef, {
        status: 'completed',
        paidAmount: currentSelectedWO.totalCost,
        remainingAmount: 0,
        timeline: arrayUnion(newTimelineItem)
      });

      if (companyId) {
        await notificationService.info(
          companyId,
          'OS Finalizada',
          `A OS #${currentSelectedWO.id.substring(0, 8).toUpperCase()} foi finalizada com sucesso! Pagamento de R$ ${currentSelectedWO.totalCost.toFixed(2)} recebido.`
        );

        // Automated WhatsApp Notification for Finish
        if (profile?.role === 'shop' && currentSelectedWO.customerPhone) {
          whatsappService.sendStatusUpdate(
            currentSelectedWO.customerPhone,
            currentSelectedWO.customerName,
            currentSelectedWO.vehicleInfo || currentSelectedWO.model,
            'Concluído'
          );
        }

        // Global History Recording
        historyService.saveVehicleHistory({ ...currentSelectedWO, status: 'completed', paidAmount: currentSelectedWO.totalCost, remainingAmount: 0 }, effectiveProfile || profile);
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `work_orders/${currentSelectedWO.id}`);
    }
  };

  const addNewServiceToExistingOS = async (service: any) => {
    if (!currentSelectedWO) return;
    
    // Determine prices
    const laborPrice = service.laborPrice || 0;
    const partPrice = (service.partPrice || service.price) || 0;
    const itemPrice = laborPrice + partPrice;

    const newService = {
      id: service.id || `extra-${Date.now()}`,
      name: service.name,
      laborPrice: laborPrice,
      partPrice: partPrice,
      price: itemPrice
    };

    try {
      const woRef = doc(db, 'work_orders', currentSelectedWO.id);
      
      const updatedServices = [...(currentSelectedWO.services || []), newService];
      const newLaborTotal = updatedServices.reduce((acc, s) => acc + (s.laborPrice || 0), 0);
      const newPartsTotal = updatedServices.reduce((acc, s) => acc + (s.partPrice || 0), 0);
      const newSubtotal = newLaborTotal + newPartsTotal;
      
      // Recalculate total considering discounts and pre-payments
      const currentDiscount = currentSelectedWO.discount || 0;
      const currentPartsPaid = currentSelectedWO.partsPaidAmount || 0;
      const newTotal = Math.max(0, newSubtotal - currentDiscount - currentPartsPaid);

      await updateDoc(woRef, {
        services: updatedServices,
        laborCost: newLaborTotal,
        partsCost: newPartsTotal,
        subtotal: newSubtotal,
        totalCost: newTotal,
        remainingAmount: newTotal - (currentSelectedWO.paidAmount || 0),
        timeline: arrayUnion({
          type: 'item_added',
          content: `Adicionado novo item: ${service.name} (R$ ${itemPrice.toFixed(2)})`,
          createdAt: new Date().toISOString()
        })
      });

      setServiceSearch('');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `work_orders/${currentSelectedWO.id}`);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'work_orders', id));
      if (selectedWO?.id === id) {
        setSelectedWO(null);
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `work_orders/${id}`);
    }
  };

  const filteredWorkOrders = React.useMemo(() => {
    return workOrders.filter(wo => {
      const matchesSearch = wo.customerName?.toLowerCase().includes(search.toLowerCase()) ||
        wo.reportedProblem?.toLowerCase().includes(search.toLowerCase()) ||
        wo.customerCode?.toLowerCase().includes(search.toLowerCase()) ||
        wo.id.toString().includes(search);
      
      const matchesStatus = statusFilter === 'all' || wo.status === statusFilter;
      const matchesEmployee = profile?.role === 'employee' ? wo.employeeId === profile.id : (filterEmployeeId === '' || wo.employeeId === filterEmployeeId) || (filterEmployeeId !== '' && !wo.employeeId && profile?.role === 'admin' && !selectedShopId);
      
      return matchesSearch && matchesStatus && matchesEmployee;
    });
  }, [workOrders, search, statusFilter, filterEmployeeId, profile]);


  const generateOSPDF = async () => {
    if (!currentSelectedWO) return;

    const userPlan = effectiveProfile?.plan || 'free';
    const limitCheck = await checkPlanLimit(profile?.companyId || profile?.id || '', userPlan, 'pdfDownloads', profile?.role || effectiveProfile?.role);
    if (!limitCheck.allowed && profile?.role !== 'admin') {
      alert(`Você atingiu o limite de downloads do seu plano (${limitCheck.limit} PDFs/mês). Faça upgrade para o plano Elite para downloads ilimitados.`);
      return;
    }

    const canGeneratePDF = profile?.role === 'admin' || PLAN_LIMITS[userPlan === 'start' ? 'free' : userPlan].pdf;
    if (!canGeneratePDF && profile?.role !== 'admin') {
      alert("A geração de PDF está disponível nos planos Oficina Pro e Oficina Elite. Faça um upgrade para liberar esta função.");
      return;
    }

    const business = {
      name: profile?.companyName || profile?.fullName || profile?.name || 'Service Hub Pro',
      tradeName: profile?.tradeName || profile?.displayName,
      doc: profile?.cnpj || profile?.ownerCpf || profile?.cpfCnpj,
      address: profile?.address ? `${profile.address.street}, ${profile.address.number} - ${profile.address.city}/${profile.address.state}` : '',
      contact: profile?.phone || profile?.email || '',
      logo: profile?.logo
    };

    const sections = [
      {
        title: 'Informações do Cliente e Veículo',
        headers: ['Campo', 'Descrição'],
        body: [
          ['Cliente', currentSelectedWO.customerName],
          ['Veículo', `${currentSelectedWO.brand} ${currentSelectedWO.model}`],
          ['Placa', currentSelectedWO.plate || 'N/A'],
          ['KM Atual', currentSelectedWO.mileage || 'N/A'],
          ['Data Abertura', format(new Date(currentSelectedWO.createdAt?.toDate?.() || currentSelectedWO.createdAt), 'dd/MM/yyyy')],
          ['Previsão Entrega', currentSelectedWO.estimatedDeliveryDate ? format(new Date(currentSelectedWO.estimatedDeliveryDate), 'dd/MM/yyyy') : 'A confirmar']
        ]
      },
      {
        title: 'Serviços e Peças',
        headers: ['Descrição', 'Mão de Obra', 'Peças', 'Total'],
        body: (currentSelectedWO.services || []).map((s: any) => [
          s.name,
          `R$ ${s.laborPrice?.toFixed(2) || '0.00'}`,
          `R$ ${s.partPrice?.toFixed(2) || '0.00'}`,
          `R$ ${s.price.toFixed(2)}`
        ])
      },
      {
        title: 'Resumo Financeiro',
        headers: ['Descrição', 'Valor'],
        body: [
          ['Subtotal', `R$ ${currentSelectedWO.subtotal.toFixed(2)}`],
          ['Descontos', `- R$ ${currentSelectedWO.discount.toFixed(2)}`],
          ['Valor Total OS', `R$ ${currentSelectedWO.totalCost.toFixed(2)}`],
          ['Status Pagamento', currentSelectedWO.remainingAmount > 0 ? `Pendente: R$ ${currentSelectedWO.remainingAmount.toFixed(2)}` : 'Totalmente Pago']
        ]
      }
    ];

    generateProfessionalReport(`ORDEM DE SERVIÇO #${currentSelectedWO.id.substring(0, 8).toUpperCase()}`, business, sections);

    if (profile?.role !== 'admin') {
      await addDoc(collection(db, 'usage_logs'), {
        companyId: profile?.companyId || profile?.id || '',
        type: 'pdf_download',
        entityType: 'work_order',
        entityId: currentSelectedWO.id,
        createdAt: serverTimestamp()
      });
    }
  };

  if (currentSelectedWO) {
    return (
      <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
        {/* Premium Detail Header */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 bg-white dark:bg-gray-800 p-8 rounded-[2.5rem] shadow-xl border border-gray-100 dark:border-gray-700">
          <div className="flex items-center gap-6">
            <button 
              onClick={() => setSelectedWO(null)} 
              className="w-12 h-12 flex items-center justify-center bg-gray-50 dark:bg-gray-900 rounded-2xl text-gray-400 hover:text-indigo-600 transition-all active:scale-90"
            >
              <ChevronRight className="w-5 h-5 rotate-180" />
            </button>
            <div>
              <div className="flex items-center gap-3 mb-1">
                <h2 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">
                  OS #{currentSelectedWO.id.slice(-6).toUpperCase()}
                </h2>
                <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${getStatusBadge(currentSelectedWO.status)}`}>
                  {translateStatus(currentSelectedWO.status)}
                </span>
              </div>
              <p className="text-sm font-bold text-gray-400 flex items-center gap-2">
                <User className="w-4 h-4" /> {currentSelectedWO.customerName} • <Car className="w-4 h-4" /> {currentSelectedWO.plate}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <button
              onClick={generateOSPDF}
              className="flex items-center gap-2 px-6 py-3 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-2xl text-sm font-black text-gray-700 dark:text-gray-300 hover:shadow-lg transition-all active:scale-95 uppercase tracking-widest"
            >
              <Download className="w-4 h-4" /> Imprimir
            </button>
            <div className="flex gap-2">
              <div className="relative">
                <select
                  value={currentSelectedWO.status}
                  onChange={(e) => updateStatus(e.target.value)}
                  className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-2xl text-[10px] font-black uppercase tracking-widest pl-4 pr-10 py-3 focus:ring-2 focus:ring-indigo-500 appearance-none shadow-sm transition-all"
                >
                  <option value="waiting_payment">Aguardando Pagamento</option>
                  <option value="payment_received">Pagamento Realizado</option>
                  <option value="awaiting_parts">Aguardando Peça</option>
                  <option value="repair_started">Início de Reparo</option>
                  <option value="in_repair">Em Reparo</option>
                  <option value="service_finished">Serviço Finalizado</option>
                  <option value="completed">Concluído</option>
                  <option value="delivered">Entregue</option>
                </select>
                <ChevronRight className="absolute right-3 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400 rotate-90 pointer-events-none" />
              </div>

              {currentSelectedWO.status !== 'completed' && currentSelectedWO.status !== 'delivered' && currentSelectedWO.status !== 'service_finished' && (
                <button
                  onClick={() => updateStatus('service_finished')}
                  className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-2xl text-sm font-black hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-500/20 active:scale-95 uppercase tracking-widest shrink-0"
                >
                  <CheckCircle className="w-4 h-4" /> Finalizar
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Main Info - Left */}
          <div className="lg:col-span-8 space-y-8">
            <div className="bg-white dark:bg-gray-800 p-8 rounded-[2.5rem] shadow-xl border border-gray-100 dark:border-gray-700">
               <div className="flex items-center justify-between mb-8">
                  <h3 className="text-lg font-black text-gray-900 dark:text-white uppercase tracking-widest flex items-center gap-2">
                    <Wrench className="w-5 h-5 text-indigo-600" /> Detalhes do Escopo
                  </h3>
               </div>
               
               <div className="space-y-6">
                 <div className="p-6 bg-gray-50 dark:bg-gray-900/50 rounded-3xl border border-gray-100 dark:border-gray-700">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Relato do Cliente</p>
                    <p className="text-gray-700 dark:text-gray-300 font-bold leading-relaxed">{currentSelectedWO.reportedProblem}</p>
                 </div>

                 <div className="space-y-4">
                    <div className="flex items-center justify-between ml-1">
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Serviços & Peças</p>
                      
                      {/* Quick Add Interface */}
                      <div className="relative w-72 lg:w-80 group">
                        <Plus className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-indigo-500 group-hover:rotate-90 transition-transform duration-300" />
                        <input
                          type="text"
                          value={serviceSearch}
                          onChange={(e) => setServiceSearch(e.target.value)}
                          placeholder="Adicionar serviço ou peça rápida..."
                          className="w-full pl-10 pr-4 py-2.5 bg-indigo-50/50 dark:bg-indigo-900/20 border-2 border-transparent focus:border-indigo-500/30 rounded-2xl text-[11px] font-bold focus:ring-0 placeholder:text-indigo-400/50 transition-all outline-none"
                        />
                        {serviceSearch && (
                          <div className="absolute z-30 mt-2 w-full bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-100 dark:border-gray-700 max-h-60 overflow-y-auto p-2 scrollbar-none animate-in fade-in zoom-in duration-200">
                             {availableServices
                                .filter(s => s.name.toLowerCase().includes(serviceSearch.toLowerCase()))
                                .map(s => (
                                  <button
                                    key={s.id}
                                    onClick={() => addNewServiceToExistingOS(s)}
                                    className="w-full flex items-center justify-between p-3.5 hover:bg-indigo-50 dark:hover:bg-indigo-900/40 rounded-xl transition-all text-left mb-1 group/item"
                                  >
                                    <div className="min-w-0">
                                      <span className="font-bold text-[11px] text-gray-800 dark:text-white truncate group-hover/item:text-indigo-600 transition-colors uppercase">{s.name}</span>
                                      <p className="text-[9px] text-gray-400 font-medium">Serviço Oficina</p>
                                    </div>
                                    <Plus className="w-4 h-4 text-indigo-600 shrink-0 opacity-0 group-hover/item:opacity-100 transition-opacity" />
                                  </button>
                                ))}
                             {marketplaceParts.length > 0 && (
                               <div className="mt-2 pt-2 border-t border-gray-100 dark:border-gray-700">
                                 <div className="px-2 mb-2">
                                  <span className="text-[8px] font-black uppercase text-amber-500 tracking-widest">Marketplace Hub</span>
                                 </div>
                                 {marketplaceParts.map(p => (
                                   <button
                                     key={p.id}
                                     onClick={() => addNewServiceToExistingOS(p)}
                                     className="w-full flex items-center justify-between p-3.5 hover:bg-emerald-50 dark:hover:bg-emerald-900/40 rounded-xl transition-all text-left mb-1 group/item"
                                   >
                                     <div className="min-w-0">
                                       <p className="font-bold text-[11px] text-gray-800 dark:text-white truncate group-hover/item:text-emerald-600 transition-colors uppercase">{p.name}</p>
                                       <p className="text-[9px] text-indigo-600 font-black truncate tracking-tighter uppercase">{p.supplierName}</p>
                                     </div>
                                     <ShoppingBag className="w-4 h-4 text-emerald-600 shrink-0" />
                                   </button>
                                 ))}
                               </div>
                             )}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="grid grid-cols-1 gap-3">
                      {(currentSelectedWO.services || []).map((svc: any, idx: number) => (
                        <div key={idx} className="flex items-center justify-between p-5 bg-white dark:bg-gray-700/50 border border-gray-100 dark:border-gray-700 rounded-2xl hover:border-indigo-200 transition-all">
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 bg-indigo-50 dark:bg-indigo-900/40 rounded-xl flex items-center justify-center">
                              <Package className="w-5 h-5 text-indigo-600" />
                            </div>
                            <span className="font-bold text-gray-900 dark:text-white">{svc.name}</span>
                          </div>
                          <span className="font-black text-gray-900 dark:text-white">R$ {svc.price.toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                 </div>
               </div>
            </div>

            <DiagnosticSection 
              repairTips={repairTips} 
              loadingTips={loadingTips} 
              fetchAiSuggestions={fetchAiSuggestions} 
            />

            <HistorySection 
              history={vehicleHistoryFromPlate} 
              stats={vehicleStats} 
            />
          </div>

          {/* Sidebar - Right */}
          <div className="lg:col-span-4 space-y-8">
            <div className="bg-indigo-600 p-8 rounded-[2.5rem] shadow-xl text-white">
              <h3 className="text-[10px] font-black uppercase tracking-widest opacity-80 mb-6">Resumo Financeiro</h3>
              <div className="space-y-4">
                <div className="flex justify-between items-center text-sm">
                  <span className="font-bold opacity-70">Total Mão de Obra</span>
                  <span className="font-black">R$ {currentSelectedWO.laborCost?.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="font-bold opacity-70">Total Peças</span>
                  <span className="font-black">R$ {currentSelectedWO.partsCost?.toFixed(2)}</span>
                </div>
                {currentSelectedWO.discount > 0 && (
                  <div className="flex justify-between items-center text-sm text-indigo-200">
                    <span className="font-bold">Desconto Applied</span>
                    <span className="font-black">- R$ {currentSelectedWO.discount?.toFixed(2)}</span>
                  </div>
                )}
                <div className="pt-4 border-t border-white/10 mt-4">
                  <div className="flex justify-between items-end">
                    <span className="text-xs font-black uppercase tracking-widest opacity-80">Total Geral</span>
                    <span className="text-3xl font-black">R$ {currentSelectedWO.totalCost?.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </div>

            <TimelineSection 
              timeline={currentSelectedWO.timeline || []} 
              onAddNote={addNote} 
              newNote={newNote} 
              setNewNote={setNewNote} 
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-transparent p-4 sm:p-6 lg:p-10 space-y-10">
      <div className=" mx-auto space-y-10">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
          >
            <h1 className="text-4xl font-black text-gray-900 dark:text-white tracking-tight">
              Ordens de <span className="text-indigo-600 dark:text-indigo-400">Serviço</span>
            </h1>
            <p className="mt-2 text-gray-500 dark:text-gray-400 font-medium">
              Gerencie e acompanhe todos os serviços em execução.
            </p>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex items-center gap-3"
          >
            <button
              onClick={() => setIsModalOpen(true)}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3.5 rounded-2xl font-bold transition-all shadow-lg shadow-indigo-500/20 active:scale-95"
            >
              <Plus className="w-5 h-5" />
              Nova OS
            </button>
          </motion.div>
        </div>

        {/* Filters & Search */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white dark:bg-gray-800 rounded-3xl shadow-xl shadow-gray-200/50 dark:shadow-none border border-gray-100 dark:border-gray-700 p-6"
        >
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            <div className="lg:col-span-4 relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar por cliente, problema ou ID..."
                className="w-full pl-12 pr-4 py-3.5 bg-gray-50 dark:bg-gray-900/50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 transition-all dark:text-white"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <div className="lg:col-span-8 flex flex-wrap items-center gap-3">
              <div className="flex bg-gray-50 dark:bg-gray-900/50 p-1.5 rounded-2xl overflow-x-auto no-scrollbar flex-nowrap max-w-full">
                {[
                  { id: 'all', label: 'Todos' },
                  { id: 'waiting_payment', label: 'Aguardando' },
                  { id: 'in_repair', label: 'Em Reparo' },
                  { id: 'completed', label: 'Finalizado' }
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setStatusFilter(tab.id as any)}
                    className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${
                      statusFilter === tab.id
                        ? 'bg-white dark:bg-gray-800 text-indigo-600 dark:text-indigo-400 shadow-md'
                        : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <div className="flex gap-3 flex-1 lg:flex-none">
                {profile?.role === 'admin' && (
                  <select
                    value={selectedShopId}
                    onChange={(e) => setSelectedShopId(e.target.value)}
                    className="flex-1 lg:w-48 px-4 py-3.5 bg-gray-50 dark:bg-gray-900/50 border-none rounded-2xl text-sm font-bold focus:ring-2 focus:ring-indigo-500 dark:text-white appearance-none"
                  >
                    <option value="">Todas as Lojas</option>
                    {shops.map(shop => (
                      <option key={shop.id} value={shop.id}>{shop.name || shop.displayName}</option>
                    ))}
                  </select>
                )}

                {profile?.role !== 'employee' && (
                  <select
                    value={filterEmployeeId}
                    onChange={(e) => setFilterEmployeeId(e.target.value)}
                    className="flex-1 lg:w-48 px-4 py-3.5 bg-gray-50 dark:bg-gray-900/50 border-none rounded-2xl text-sm font-bold focus:ring-2 focus:ring-indigo-500 dark:text-white appearance-none"
                  >
                    <option value="">Funcionários</option>
                    {employees.map(emp => (
                      <option key={emp.id} value={emp.id}>{emp.name || emp.displayName}</option>
                    ))}
                  </select>
                )}
              </div>
            </div>
          </div>
        </motion.div>

        {/* Work Orders Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-8 2xl:gap-12">
          <AnimatePresence mode="popLayout">
            {filteredWorkOrders.map((wo, index) => (
              <motion.div
                key={wo.id}
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ delay: index * 0.05 }}
                onClick={() => setSelectedWO(wo)}
                className="group bg-white dark:bg-gray-800 rounded-[3rem] 2xl:rounded-[4rem] p-8 2xl:p-12 shadow-2xl shadow-gray-300/20 dark:shadow-none border border-gray-100 dark:border-gray-700 hover:border-indigo-500 dark:hover:border-indigo-500 transition-all cursor-pointer relative overflow-hidden flex flex-col justify-between min-h-fit 2xl:min-h-[450px]"
              >
                <div className="absolute top-0 right-0 p-4">
                  <span className={`px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-widest border shadow-sm ${getStatusBadge(wo.status)}`}>
                    {translateStatus(wo.status)}
                  </span>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-14 h-14 2xl:w-20 2xl:h-20 rounded-2xl 2xl:rounded-[2rem] bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">
                      <Car className="w-7 h-7 2xl:w-10 2xl:h-10" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-black text-xl lg:text-2xl 2xl:text-3xl text-gray-900 dark:text-white truncate flex items-center gap-3">
                        {wo.customerName}
                        {wo.createdBy === 'whatsapp' && (
                          <MessageSquare className="w-3 h-3 text-green-500" />
                        )}
                      </h3>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        #{wo.customerCode || wo.id.substring(0, 6)}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center gap-5 text-xl text-gray-600 dark:text-gray-300">
                      <Wrench className="w-8 h-8 text-indigo-500" />
                      <span className="font-black uppercase tracking-tight">{wo.brand} {wo.model}</span>
                    </div>
                    <div className="flex items-start gap-4 text-lg text-gray-500 dark:text-gray-400">
                      <AlertCircle className="w-6 h-6 text-gray-400 mt-1" />
                      <p className="line-clamp-3 font-medium leading-relaxed italic">"{wo.reportedProblem}"</p>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-gray-50 dark:border-gray-800 flex items-center justify-between">
                    <div>
                      <p className="text-sm uppercase font-black text-gray-400 tracking-[0.2em] mb-2">Valor Total do Reparo</p>
                      <p className="text-2xl md:text-3xl lg:text-4xl 2xl:text-5xl font-black text-gray-900 dark:text-white text-glow transition-all group-hover:text-indigo-600 truncate max-w-full">
                        R$ {wo.totalCost?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(wo.id);
                        }}
                        className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                      <div className="p-2 bg-gray-50 dark:bg-gray-800 rounded-xl group-hover:bg-indigo-600 group-hover:text-white transition-all">
                        <ChevronRight className="w-5 h-5" />
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {filteredWorkOrders.length === 0 && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-20 bg-white dark:bg-gray-800 rounded-3xl border-2 border-dashed border-gray-100 dark:border-gray-700"
          >
            <div className="w-20 h-20 bg-gray-50 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
              <Wrench className="w-10 h-10 text-gray-300" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Nenhuma OS encontrada</h3>
            <p className="text-gray-500 dark:text-gray-400">Tente ajustar seus filtros ou crie uma nova ordem de serviço.</p>
          </motion.div>
        )}
      </div>

      {/* New OS Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm"
            />
            
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-4xl bg-white dark:bg-gray-800 rounded-lg shadow-xl overflow-hidden flex flex-col max-h-[90vh] border border-gray-200 dark:border-gray-700"
            >
              {/* Modal Header */}
              <div className="p-8 border-b border-gray-50 dark:border-gray-700 flex items-center justify-between bg-indigo-600">
                <div>
                  <h2 className="text-2xl font-black text-white tracking-tight">Nova Ordem de Serviço</h2>
                  <p className="text-indigo-100 text-sm font-medium mt-1">Preencha os dados para iniciar o serviço.</p>
                </div>
                <button 
                  onClick={() => setIsModalOpen(false)}
                  className="p-2 bg-white/10 hover:bg-white/20 text-white rounded-xl transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-8 space-y-8">
                {/* Step 1: Lookup */}
                <section className="space-y-4">
                  <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-bold text-sm uppercase tracking-widest">
                    <span className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center text-xs">01</span>
                    Identificação
                  </div>
                  
                  <form onSubmit={searchVehicle} className="grid grid-cols-1 md:grid-cols-12 gap-4">
                    <div className="md:col-span-8 relative">
                      <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                      <input
                        type="text"
                        value={customerCode}
                        onChange={(e) => setCustomerCode(e.target.value)}
                        placeholder="Código do Cliente ou Placa (Ex: CLI-123 ou ABC-1234)"
                        className="w-full pl-12 pr-4 py-4 bg-gray-50 dark:bg-gray-800 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 dark:text-white"
                      />
                    </div>
                    <div className="md:col-span-4 flex gap-2">
                      <button
                        type="submit"
                        disabled={searchingVehicle || isLprLoading}
                        className="flex-1 bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-bold py-4 rounded-2xl hover:opacity-90 transition-all disabled:opacity-50"
                      >
                        {searchingVehicle ? 'Buscando...' : 'Verificar'}
                      </button>
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isLprLoading || searchingVehicle}
                        className="p-4 bg-indigo-50 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 rounded-2xl hover:bg-indigo-100 dark:hover:bg-indigo-900/60 transition-all relative"
                        title="Reconhecimento de Placa (IA)"
                      >
                        {isLprLoading ? (
                          <Loader2 className="w-6 h-6 animate-spin" />
                        ) : (
                          <Camera className="w-6 h-6" />
                        )}
                      </button>
                      <input 
                        type="file" 
                        ref={fileInputRef} 
                        onChange={handleLpr} 
                        accept="image/*" 
                        capture="environment" 
                        className="hidden" 
                      />
                    </div>
                  </form>

                  {searchError && (
                    <motion.div 
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="p-4 bg-red-50 dark:bg-red-900/20 rounded-2xl border border-red-100 dark:border-red-900/30 flex items-center justify-between"
                    >
                      <div className="flex items-center gap-3 text-red-600 dark:text-red-400">
                        <AlertCircle className="w-5 h-5" />
                        <span className="text-sm font-medium">{searchError}</span>
                      </div>
                      <button
                        onClick={() => navigate('/app/budgets')}
                        className="text-xs font-bold underline hover:no-underline"
                      >
                        Criar Orçamento
                      </button>
                    </motion.div>
                  )}

                  {foundVehicle && (
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="p-6 bg-indigo-50 dark:bg-indigo-900/20 rounded-3xl border border-indigo-100 dark:border-indigo-900/30 flex items-center gap-4"
                    >
                      <div className="w-12 h-12 rounded-2xl bg-white dark:bg-gray-800 flex items-center justify-center text-indigo-600 shadow-sm">
                        <User className="w-6 h-6" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-gray-900 dark:text-white">{foundVehicle.customerName}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {foundVehicle.brand} {foundVehicle.model} • {foundVehicle.plate}
                        </p>
                      </div>
                    </motion.div>
                  )}
                </section>

                {foundVehicle && (
                  <>
                    {/* Step 2: Visual Check-in */}
                    <section className="space-y-4">
                      <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-bold text-sm uppercase tracking-widest">
                        <span className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center text-xs">02</span>
                        Check-in Digital Visual
                      </div>
                      <CheckInStep onDataChange={setCheckInData} initialData={checkInData} />
                    </section>

                    {/* Step 3: Problem */}
                    <section className="space-y-4">
                      <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-bold text-sm uppercase tracking-widest">
                        <span className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center text-xs">03</span>
                        Diagnóstico Inicial
                      </div>
                      <textarea
                        rows={3}
                        value={reportedProblem}
                        onChange={(e) => setReportedProblem(e.target.value)}
                        placeholder="Descreva detalhadamente o problema relatado pelo cliente..."
                        className="w-full p-6 bg-gray-50 dark:bg-gray-800 border-none rounded-3xl focus:ring-2 focus:ring-indigo-500 dark:text-white resize-none"
                      />
                    </section>

                    {/* Step 3: Services */}
                    <section className="space-y-4">
                      <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-bold text-sm uppercase tracking-widest">
                        <span className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center text-xs">04</span>
                        Serviços & Peças
                      </div>

                      <div className="relative">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                        <input
                          type="text"
                          value={serviceSearch}
                          onChange={(e) => setServiceSearch(e.target.value)}
                          placeholder="Buscar serviços no catálogo..."
                          className="w-full pl-12 pr-4 py-4 bg-gray-50 dark:bg-gray-800 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 dark:text-white"
                        />
                        {serviceSearch && (
                          <div className="absolute z-20 mt-2 w-full bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-100 dark:border-gray-700 max-h-60 overflow-y-auto p-2">
                            {availableServices
                              .filter(s => s.name.toLowerCase().includes(serviceSearch.toLowerCase()))
                              .map(s => (
                                <button
                                  key={s.id}
                                  onClick={() => addServiceToOS(s)}
                                  className="w-full flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-xl transition-colors text-left"
                                >
                                  <div>
                                    <p className="font-bold text-gray-900 dark:text-white">{s.name}</p>
                                    <p className="text-xs text-gray-500">Mão de obra sugerida: R$ {(s.laborPrice || 0).toFixed(2)}</p>
                                  </div>
                                  <Plus className="w-5 h-5 text-indigo-600" />
                                </button>
                              ))}

                            {(marketplaceParts.length > 0 || isSearchingMarketplace) && (
                              <div className="mt-4 border-t border-gray-100 dark:border-gray-700 pt-4">
                                <div className="flex items-center gap-2 mb-3 px-2">
                                  <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
                                  <span className="text-[10px] font-black uppercase text-gray-400 tracking-widest">Ofertas de Fornecedores (Marketplace)</span>
                                </div>
                                
                                {isSearchingMarketplace ? (
                                  <div className="p-4 text-center">
                                    <Loader2 className="w-5 h-5 animate-spin mx-auto text-indigo-600" />
                                  </div>
                                ) : (
                                  <div className="space-y-2">
                                    {marketplaceParts.map((part) => (
                                      <button
                                        key={part.id}
                                        onClick={() => {
                                          addServiceToOS({
                                            id: part.id,
                                            name: part.name,
                                            laborPrice: 0,
                                            partPrice: part.price,
                                            price: part.price,
                                            inStock: true,
                                            supplierId: part.supplierId,
                                            supplierName: part.supplierName
                                          });
                                          setServiceSearch('');
                                        }}
                                        className="w-full bg-gray-50 dark:bg-gray-900/50 p-4 rounded-2xl hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-all text-left border border-transparent hover:border-indigo-100"
                                      >
                                        <div className="flex justify-between items-start mb-2">
                                          <div>
                                            <p className="font-bold text-gray-900 dark:text-white text-sm">{part.name}</p>
                                            <div className="flex items-center gap-2 mt-1">
                                              <span className="text-[10px] font-black text-indigo-600 uppercase tracking-tighter">{part.supplierName}</span>
                                              <div className="flex items-center gap-0.5">
                                                <Star className="w-2.5 h-2.5 text-amber-500 fill-amber-500" />
                                                <span className="text-[9px] font-bold text-gray-500">{part.avgRating?.toFixed(1) || '0.0'}</span>
                                              </div>
                                            </div>
                                          </div>
                                          <div className="text-right">
                                            <p className="font-black text-emerald-600">R$ {part.price?.toFixed(2)}</p>
                                            <div className="flex items-center gap-1 mt-1 justify-end">
                                              <Clock className="w-2.5 h-2.5 text-gray-400" />
                                              <span className="text-[9px] font-bold text-gray-400">{part.deliveryTime}</span>
                                            </div>
                                          </div>
                                        </div>
                                        <div className="flex items-center gap-2 text-[9px] text-gray-400 uppercase font-bold tracking-widest">
                                          <MapPin className="w-3 h-3" />
                                          {part.supplierCity}, {part.supplierState}
                                        </div>
                                      </button>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="space-y-3">
                        {selectedServices.map((s) => (
                          <motion.div 
                            key={s.id}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            className="p-6 bg-white dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm space-y-4"
                          >
                            <div className="flex justify-between items-start">
                              <h4 className="font-bold text-gray-900 dark:text-white">{s.name}</h4>
                              <button onClick={() => removeServiceFromOS(s.id)} className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-colors">
                                <X className="w-4 h-4" />
                              </button>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-1">
                                <label className="text-[10px] uppercase font-black text-gray-400 tracking-widest">Mão de Obra</label>
                                <div className="relative">
                                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">R$</span>
                                  <input
                                    type="number"
                                    value={s.laborPrice}
                                    onChange={(e) => updateServicePrice(s.id, 'laborPrice', parseFloat(e.target.value) || 0)}
                                    className="w-full pl-9 pr-4 py-3 bg-gray-50 dark:bg-gray-700 border-none rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 dark:text-white"
                                  />
                                </div>
                              </div>
                              <div className="space-y-1">
                                <label className="text-[10px] uppercase font-black text-gray-400 tracking-widest">Peças</label>
                                <div className="relative">
                                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">R$</span>
                                  <input
                                    type="number"
                                    value={s.partPrice}
                                    onChange={(e) => updateServicePrice(s.id, 'partPrice', parseFloat(e.target.value) || 0)}
                                    className="w-full pl-9 pr-4 py-3 bg-gray-50 dark:bg-gray-700 border-none rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 dark:text-white"
                                  />
                                </div>
                              </div>
                            </div>

                            {s.partPrice > 0 && (
                              <div className={`px-4 py-2 rounded-xl text-xs font-medium flex items-center gap-2 ${
                                s.inStock ? 'bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400' : 'bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400'
                              }`}>
                                {s.inStock ? <Check className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
                                {s.inStock ? `Em estoque: ${s.matchingPart?.partName}` : 'Necessário comprar peça'}
                              </div>
                            )}
                          </motion.div>
                        ))}
                      </div>
                    </section>
                    {/* Step 4: Health & Delivery */}
                    <section className="space-y-4">
                      <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-bold text-sm uppercase tracking-widest">
                        <span className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center text-xs">05</span>
                        Entrega & Saúde
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-2">Quilometragem (KM)</label>
                          <div className="relative">
                            <HistoryIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <input 
                              type="number" 
                              placeholder="Ex: 45000" 
                              value={mileage} 
                              onChange={e => setMileage(e.target.value)} 
                              className="w-full pl-11 pr-4 py-3.5 bg-gray-50 dark:bg-gray-800 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 dark:text-white font-bold" 
                            />
                          </div>
                        </div>

                        <div className="space-y-2">
                          <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-2">Previsão de Entrega</label>
                          <div className="relative">
                            <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <input 
                              type="date" 
                              value={estimatedDeliveryDate} 
                              onChange={e => setEstimatedDeliveryDate(e.target.value)} 
                              className="w-full pl-11 pr-4 py-3.5 bg-gray-50 dark:bg-gray-800 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 dark:text-white font-bold" 
                            />
                          </div>
                        </div>
                      </div>
                    </section>
                  </>
                )}
              </div>

              {/* Modal Footer */}
              <div className="p-8 bg-gray-50 dark:bg-gray-800/50 border-t border-gray-100 dark:border-gray-800">
                <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                  <div className="flex items-center gap-6">
                    <div className="text-center md:text-left">
                      <p className="text-[10px] uppercase font-black text-gray-400 tracking-widest">Total Estimado</p>
                      <p className="text-3xl font-black text-gray-900 dark:text-white">
                        R$ {calculateTotal().toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                    <div className="h-10 w-px bg-gray-200 dark:bg-gray-700 hidden md:block" />
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id="payHalf"
                          checked={payHalf}
                          onChange={(e) => setPayHalf(e.target.checked)}
                          className="w-5 h-5 rounded-lg border-gray-300 text-indigo-600 focus:ring-indigo-500"
                        />
                        <label htmlFor="payHalf" className="text-sm font-bold text-gray-700 dark:text-gray-300">Entrada (50%)</label>
                      </div>
                      {payHalf && (
                        <p className="text-xs font-bold text-green-600">R$ {(calculateTotal() / 2).toFixed(2)}</p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-3 w-full md:w-auto">
                    <button
                      onClick={() => setIsModalOpen(false)}
                      className="flex-1 md:flex-none px-8 py-4 font-bold text-gray-500 hover:text-gray-700 transition-colors"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={finalizeOS}
                      disabled={!foundVehicle || !reportedProblem.trim() || selectedServices.length === 0}
                      className="flex-1 md:flex-none px-10 py-4 bg-indigo-600 text-white font-black rounded-2xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-500/25 disabled:opacity-50 disabled:shadow-none active:scale-95"
                    >
                      Gerar OS
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
function HistorySection({ history, stats }: { history: any[], stats: any }) {
  return (
    <div className="bg-gray-50 dark:bg-gray-900/50 rounded-[2.5rem] p-8 border border-gray-100 dark:border-gray-700">
      <div className="flex items-center justify-between mb-8">
        <h4 className="text-sm font-black text-gray-900 dark:text-white flex items-center gap-2 uppercase tracking-widest">
          <HistoryIcon className="w-5 h-5 text-indigo-600" />
          Histórico Veicular 360
        </h4>
        <div className="px-5 py-2 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-full text-[10px] font-black uppercase tracking-widest">
          {history.length} Passagens Anteriores
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div className="p-6 bg-white dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm">
          <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">Investimento Total no Veículo</p>
          <p className="text-2xl font-black text-emerald-600 tracking-tight">
            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(stats.totalSpent)}
          </p>
        </div>
        <div className="p-6 bg-white dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm">
          <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">Última KM Registrada</p>
          <p className="text-2xl font-black text-indigo-600 tracking-tight">
            {(stats.lastMileage || 0).toLocaleString()} KM
          </p>
        </div>
      </div>

      <div className="space-y-4 max-h-80 overflow-y-auto pr-2 custom-scrollbar">
        {history.length > 0 ? history.map((wo: any, i: number) => (
          <div key={i} className="flex items-center justify-between p-6 bg-white dark:bg-gray-800 rounded-[2rem] border border-gray-50 dark:border-gray-700/50 hover:shadow-lg transition-all group">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-gray-50 dark:bg-gray-900 rounded-2xl flex items-center justify-center text-gray-400 font-bold text-xs uppercase group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-colors">
                #{wo.id.slice(-4)}
              </div>
              <div>
                <p className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-tight">
                  {translateStatus(wo.status)}
                </p>
                <p className="text-[10px] font-bold text-gray-400 mt-1 uppercase tracking-widest">
                  {new Date(wo.createdAt?.toDate?.() || wo.createdAt).toLocaleDateString('pt-BR')}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-lg font-black text-gray-900 dark:text-white tracking-tight">
                R$ {wo.totalCost?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
              <p className="text-[9px] font-black text-indigo-600 bg-indigo-50 dark:bg-indigo-900/30 px-2.5 py-1 rounded-lg mt-2 inline-block uppercase tracking-widest">
                {wo.mileage} KM
              </p>
            </div>
          </div>
        )) : (
          <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-[2rem] border-2 border-dashed border-gray-100 dark:border-gray-700">
            <div className="w-16 h-16 bg-gray-50 dark:bg-gray-900 rounded-full flex items-center justify-center mx-auto mb-4">
              <HistoryIcon className="w-8 h-8 text-gray-200" />
            </div>
            <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest">
              Nenhum histórico anterior registrado
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function DiagnosticSection({ repairTips, loadingTips, fetchAiSuggestions }: any) {
  return (
    <div className="bg-indigo-50 dark:bg-indigo-900/10 rounded-[2.5rem] p-8 border border-indigo-100 dark:border-indigo-900/30 relative overflow-hidden group">
      <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-100 dark:bg-indigo-900/20 rounded-full -mr-16 -mt-16 transition-transform duration-700 group-hover:scale-150"></div>
      
      <div className="flex items-center justify-between mb-8 relative z-10">
        <h4 className="text-sm font-black text-indigo-900 dark:text-indigo-200 flex items-center gap-2 uppercase tracking-widest">
          <BrainCircuit className="w-5 h-5 text-indigo-600" />
          Assistente Técnico IA
        </h4>
        <button 
           onClick={fetchAiSuggestions}
           disabled={loadingTips}
           className="px-6 py-2.5 bg-indigo-600 text-white text-[10px] font-black rounded-xl uppercase tracking-widest hover:bg-indigo-700 transition-all flex items-center gap-2 shadow-lg shadow-indigo-500/30"
         >
           {loadingTips ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
           {repairTips ? 'Refinar Análise' : 'Analisar Veículo'}
         </button>
      </div>
      
      <div className="relative z-10">
        {loadingTips ? (
          <div className="flex flex-col items-center justify-center py-12 gap-4">
            <div className="relative">
              <div className="w-16 h-16 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
              <BrainCircuit className="absolute inset-0 m-auto w-6 h-6 text-indigo-600" />
            </div>
            <p className="text-[10px] font-black text-indigo-600 uppercase tracking-widest animate-pulse">Cruzando dados técnicos e histórico...</p>
          </div>
        ) : repairTips ? (
          <div className="prose prose-sm dark:prose-invert max-w-none">
            <div className="text-indigo-900 dark:text-indigo-100 text-[13px] leading-relaxed whitespace-pre-wrap bg-white/70 dark:bg-black/40 p-8 rounded-[2rem] border border-indigo-100/50 shadow-inner">
               <div dangerouslySetInnerHTML={{ __html: repairTips.replace(/\*\*(.*?)\*\*/g, '<strong class="text-indigo-600 dark:text-indigo-400">$1</strong>').replace(/\n/g, '<br/>') }} />
            </div>
          </div>
        ) : (
          <div className="text-center py-12">
            <p className="text-[11px] text-indigo-600/60 font-black uppercase tracking-widest leading-loose max-w-xs mx-auto">
              Clique para receber instruções técnicas, torque de parafusos e procedimentos baseados no modelo do veículo.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function TimelineSection({ timeline, onAddNote, newNote, setNewNote }: any) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-[2.5rem] p-8 border border-gray-100 dark:border-gray-700 shadow-xl overflow-hidden relative">
      <div className="flex items-center justify-between mb-8">
        <h4 className="text-sm font-black text-gray-900 dark:text-white flex items-center gap-2 uppercase tracking-widest">
          <Clock className="w-5 h-5 text-gray-400" />
          Fluxo de Execução
        </h4>
      </div>
      
      <form onSubmit={(e) => { e.preventDefault(); onAddNote(e); }} className="mb-10 relative">
        <input
          type="text"
          value={newNote}
          onChange={(e) => setNewNote(e.target.value)}
          placeholder="Nota ou diagnóstico..."
          className="w-full pl-6 pr-24 py-5 bg-gray-50 dark:bg-gray-900 rounded-2xl border-none focus:ring-2 focus:ring-indigo-500 dark:text-white font-bold text-sm shadow-inner"
        />
        <button
          type="submit"
          disabled={!newNote.trim()}
          className="absolute right-2 top-2 px-4 py-3 bg-indigo-600 text-white font-black rounded-xl text-[10px] uppercase tracking-widest hover:bg-indigo-700 transition-all disabled:opacity-0"
        >
          Salvar
        </button>
      </form>

      <div className="space-y-8 relative before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-0.5 before:bg-gray-100 dark:before:bg-gray-700">
        {timeline.slice().reverse().map((item: any, index: number) => (
          <div key={index} className="flex gap-6 relative">
            <div className="flex-shrink-0 w-6 h-6 rounded-full bg-white dark:bg-gray-800 border-4 border-indigo-500 dark:border-indigo-400 z-10 shadow-sm"></div>
            <div className="pt-0.5 min-w-0">
              <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                <Calendar className="w-3 h-3" />
                {new Date(item.createdAt).toLocaleDateString('pt-BR')} às {new Date(item.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
              </p>
              <div className={`p-5 rounded-2xl text-sm leading-relaxed ${
                item.type === 'status_change' 
                  ? 'bg-blue-50/50 dark:bg-blue-900/10 text-blue-700 dark:text-blue-300 font-black border border-blue-100/50' 
                  : 'bg-gray-50/50 dark:bg-gray-900/30 text-gray-600 dark:text-gray-400 font-bold border border-gray-100/50 shadow-sm'
              }`}>
                {item.content}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

