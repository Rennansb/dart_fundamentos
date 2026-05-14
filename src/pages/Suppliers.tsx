import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { 
  Building2, 
  Search, 
  MapPin, 
  ArrowRight, 
  Package, 
  Star,
  ExternalLink,
  ChevronRight,
  ShieldCheck,
  Filter
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';

export default function Suppliers() {
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSegment, setSelectedSegment] = useState('all');
  const navigate = useNavigate();

  useEffect(() => {
    const fetchSuppliers = async () => {
      try {
        const q = query(collection(db, 'users'), where('role', '==', 'fornecedor'));
        const snapshot = await getDocs(q);
        const suppliersData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        // Fetch ratings for each supplier
        const suppliersWithRatings = await Promise.all(suppliersData.map(async (s) => {
          const ratingsQ = query(collection(db, 'supplier_ratings'), where('supplierId', '==', s.id));
          const ratingsSnap = await getDocs(ratingsQ);
          const ratings = ratingsSnap.docs.map(d => d.data());
          const avg = ratings.length > 0 
            ? ratings.reduce((acc, curr) => acc + curr.rating, 0) / ratings.length 
            : 0;
          return { ...s, avgRating: avg || 0, totalRatings: ratings.length };
        }));

        setSuppliers(suppliersWithRatings);
      } catch (error) {
        console.error("Error fetching suppliers:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchSuppliers();
  }, []);

  const segments = ['all', ...new Set(suppliers.map(s => s.segment).filter(Boolean))];

  const filteredSuppliers = suppliers.filter(s => {
    const matchesSearch = (s.companyName || s.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (s.segment || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesSegment = selectedSegment === 'all' || s.segment === selectedSegment;
    return matchesSearch && matchesSegment;
  });

  // NEW: Global Product Search Logic
  const [productOffers, setProductOffers] = useState<any[]>([]);
  const [isSearchingProducts, setIsSearchingProducts] = useState(false);

  useEffect(() => {
    if (searchTerm.length < 3) {
      setProductOffers([]);
      return;
    }

    const searchProducts = async () => {
      setIsSearchingProducts(true);
      try {
        const supplierIds = suppliers.map(s => s.id);
        if (supplierIds.length === 0) return;

        // Query inventory for parts matching search term
        const q = query(
          collection(db, 'inventory')
          // Note: we can't do complex string 'includes' in Firestore easily,
          // so we'll fetch a bit more and filter in memory or use prefix search
        );
        const snapshot = await getDocs(q);
        const products = snapshot.docs
          .map(doc => ({ id: doc.id, ...doc.data() }))
          .filter((p: any) => 
            supplierIds.includes(p.companyId) && 
            (p.name || '').toLowerCase().includes(searchTerm.toLowerCase())
          )
          .sort((a: any, b: any) => (a.price || 0) - (b.price || 0));

        // Attach supplier name to products
        const productsWithSupplier = products.map((p: any) => {
          const supplier = suppliers.find(s => s.id === p.companyId);
          return { ...p, supplierName: supplier?.companyName || supplier?.name || 'Fornecedor' };
        });

        setProductOffers(productsWithSupplier);
      } catch (error) {
        console.error("Error searching products:", error);
      } finally {
        setIsSearchingProducts(false);
      }
    };

    const timer = setTimeout(searchProducts, 500);
    return () => clearTimeout(timer);
  }, [searchTerm, suppliers]);

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-12">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-2">
          <h1 className="text-4xl font-black text-gray-900 dark:text-white tracking-tight">Fornecedores</h1>
          <p className="text-gray-500 dark:text-gray-400">Encontre os melhores parceiros e peças para sua oficina.</p>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-4 w-full md:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar fornecedores ou peças..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl shadow-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-medium"
            />
          </div>
          
          <div className="relative">
            <Filter className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <select
              value={selectedSegment}
              onChange={(e) => setSelectedSegment(e.target.value)}
              className="pl-10 pr-8 py-3 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl shadow-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-bold text-sm appearance-none cursor-pointer"
            >
              <option value="all">Todos os Segmentos</option>
              {segments.filter(s => s !== 'all').map(seg => (
                <option key={seg} value={seg}>{seg}</option>
              ))}
            </select>
            <ChevronRight className="absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 rotate-90 pointer-events-none" />
          </div>
        </div>
      </header>

      {/* NEW: Product Offers Section */}
      <AnimatePresence>
        {productOffers.length > 0 && (
          <motion.section 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-6 bg-indigo-50/50 dark:bg-indigo-900/10 p-8 rounded-[2.5rem] border border-indigo-100 dark:border-indigo-800/50"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-indigo-600 rounded-2xl shadow-lg shadow-indigo-200">
                  <Star className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h2 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">Melhores Preços Encontrados</h2>
                  <p className="text-sm text-gray-500">Peças disponíveis em todos os fornecedores homologados.</p>
                </div>
              </div>
              <span className="bg-indigo-600 text-white text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest animate-pulse">
                Ofertas Imbatíveis
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {productOffers.map((offer) => (
                <motion.div
                  key={offer.id}
                  whileHover={{ y: -5 }}
                  className="bg-white dark:bg-gray-800 p-5 rounded-3xl border border-white dark:border-gray-700 shadow-xl shadow-indigo-100/20 dark:shadow-none"
                >
                  <div className="flex justify-between items-start mb-4">
                    <div className="h-12 w-12 rounded-xl bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
                      <Package className="h-6 w-6 text-indigo-600" />
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-black text-gray-400 uppercase">Preço p/ Oficina</p>
                      <p className="text-lg font-black text-emerald-600">
                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(offer.price)}
                      </p>
                    </div>
                  </div>
                  <h4 className="font-bold text-gray-900 dark:text-white line-clamp-1 mb-1">{offer.name}</h4>
                  <p className="text-[10px] font-black text-indigo-600 uppercase tracking-widest mb-4 flex items-center gap-1">
                    <Building2 className="h-3 w-3" />
                    {offer.supplierName}
                  </p>
                  <button 
                    onClick={() => navigate(`/app/suppliers/${offer.companyId}`)}
                    className="w-full py-3 bg-indigo-600 text-white rounded-xl text-xs font-black uppercase tracking-widest shadow-lg shadow-indigo-200 hover:scale-105 transition-all"
                  >
                    Comprar Agora
                  </button>
                </motion.div>
              ))}
            </div>
          </motion.section>
        )}
      </AnimatePresence>

      <div className="space-y-4">
        <h2 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight flex items-center gap-2">
          <Building2 className="h-6 w-6 text-indigo-600" />
          Nossos Fornecedores
        </h2>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="bg-white dark:bg-gray-800 h-64 rounded-3xl animate-pulse"></div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <AnimatePresence mode="popLayout">
            {filteredSuppliers.map((supplier, idx) => (
              <motion.div
                key={supplier.id}
                layout
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ delay: idx * 0.05 }}
                whileHover={{ y: -8 }}
                className="bg-white dark:bg-gray-800 p-6 rounded-[2rem] border border-gray-100 dark:border-gray-700 shadow-sm hover:shadow-xl hover:shadow-indigo-500/10 transition-all group border-b-4 border-b-transparent hover:border-b-indigo-500"
              >
                <div className="flex items-start justify-between mb-6">
                  <div className="h-16 w-16 rounded-2xl bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center overflow-hidden border border-indigo-100 dark:border-indigo-800 group-hover:scale-110 transition-transform">
                    {supplier.photoURL ? (
                      <img src={supplier.photoURL} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <Building2 className="h-8 w-8 text-indigo-600 dark:text-indigo-400" />
                    )}
                  </div>
                  <div className="flex items-center gap-1 bg-amber-50 dark:bg-amber-900/20 px-2 py-1 rounded-full">
                    <Star className={`h-3 w-3 ${supplier.avgRating > 0 ? 'text-amber-500 fill-amber-500' : 'text-gray-300'}`} />
                    <span className="text-[10px] font-black text-amber-700 dark:text-amber-400">
                      {supplier.avgRating > 0 ? supplier.avgRating.toFixed(1) : 'S/N'}
                    </span>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white line-clamp-1 group-hover:text-indigo-600 transition-colors">
                      {supplier.companyName || supplier.name || 'Fornecedor Hub'}
                    </h3>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] font-black bg-gray-100 dark:bg-gray-700 text-gray-500 px-2 py-0.5 rounded-full uppercase tracking-widest">
                        {supplier.segment || 'Peças Gerais'}
                      </span>
                      {supplier.status === 'active' && (
                        <ShieldCheck className="h-4 w-4 text-emerald-500" />
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 text-sm text-gray-500 dark:text-gray-400">
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-rose-500" />
                      <span className="truncate">{supplier.address?.city || 'Localização Indisponível'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Package className="h-4 w-4 text-indigo-500" />
                      <span>Peças, Acessórios e Consumíveis</span>
                    </div>
                  </div>

                  <button
                    onClick={() => navigate(`/app/suppliers/${supplier.id}`)}
                    className="w-full mt-4 flex items-center justify-center gap-2 py-4 bg-gray-50 dark:bg-gray-900 border border-transparent group-hover:bg-indigo-600 group-hover:text-white rounded-2xl font-black uppercase tracking-widest text-[10px] transition-all active:scale-95"
                  >
                    Ver Catálogo Completo
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {filteredSuppliers.length === 0 && !loading && (
        <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
          <div className="p-6 bg-gray-100 dark:bg-gray-800 rounded-full">
            <Building2 className="h-12 w-12 text-gray-400" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white">Nenhum fornecedor encontrado</h3>
            <p className="text-gray-500">Tente ajustar sua busca ou filtro de segmento.</p>
          </div>
        </div>
      )}
    </div>
  );
}
