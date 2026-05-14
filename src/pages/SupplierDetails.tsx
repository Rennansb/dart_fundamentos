import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, collection, query, where, getDocs, addDoc, serverTimestamp, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { 
  ArrowLeft, 
  Building2, 
  Package, 
  Search, 
  ShoppingCart,
  MapPin,
  Phone,
  Mail,
  ShieldCheck,
  Star,
  Info
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../AuthContext';

export default function SupplierDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [supplier, setSupplier] = useState<any>(null);
  const [inventory, setInventory] = useState<any[]>([]);
  const [ratings, setRatings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isRatingModalOpen, setIsRatingModalOpen] = useState(false);
  const [newRating, setNewRating] = useState(5);
  const [newComment, setNewComment] = useState('');
  const [isSubmittingRating, setIsSubmittingRating] = useState(false);

  const averageRating = useMemo(() => {
    if (ratings.length === 0) return 0;
    return ratings.reduce((acc, curr) => acc + curr.rating, 0) / ratings.length;
  }, [ratings]);

  useEffect(() => {
    const fetchData = async () => {
      if (!id) return;
      try {
        // Fetch Supplier Info
        const supplierDoc = await getDoc(doc(db, 'users', id));
        if (supplierDoc.exists()) {
          setSupplier({ id: supplierDoc.id, ...supplierDoc.data() });
        }

        // Fetch Supplier Inventory
        const qInv = query(collection(db, 'inventory'), where('companyId', '==', id));
        const invSnapshot = await getDocs(qInv);
        setInventory(invSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));

        // Fetch Ratings
        const ratingsQ = query(
          collection(db, 'supplier_ratings'), 
          where('supplierId', '==', id),
          orderBy('createdAt', 'desc')
        );
        const ratingsSnap = await getDocs(ratingsQ);
        setRatings(ratingsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      } catch (error) {
        console.error("Error fetching supplier data:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [id]);

  const handleSubmitRating = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !profile) return;

    setIsSubmittingRating(true);
    try {
      await addDoc(collection(db, 'supplier_ratings'), {
        supplierId: id,
        shopId: profile.id,
        shopName: profile.companyName || profile.name,
        rating: newRating,
        comment: newComment,
        createdAt: serverTimestamp()
      });

      // Refresh ratings
      const ratingsQ = query(
        collection(db, 'supplier_ratings'), 
        where('supplierId', '==', id),
        orderBy('createdAt', 'desc')
      );
      const ratingsSnap = await getDocs(ratingsQ);
      setRatings(ratingsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      
      setIsRatingModalOpen(false);
      setNewComment('');
      setNewRating(5);
    } catch (error) {
      console.error("Error submitting rating:", error);
    } finally {
      setIsSubmittingRating(false);
    }
  };

  const filteredInventory = inventory.filter(p => 
    (p.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (p.sku || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (!supplier) {
    return (
      <div className="text-center py-20">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Fornecedor não encontrado</h2>
        <button onClick={() => navigate('/app/suppliers')} className="mt-4 text-indigo-600 font-bold">Voltar para listagem</button>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-12">
      <button 
        onClick={() => navigate('/app/suppliers')}
        className="flex items-center gap-2 text-gray-500 hover:text-indigo-600 transition-colors font-bold text-sm uppercase tracking-widest"
      >
        <ArrowLeft className="h-4 w-4" />
        Voltar para lista
      </button>

      {/* Supplier Profile Header */}
      <div className="bg-white dark:bg-gray-800 rounded-[2.5rem] border border-gray-100 dark:border-gray-700 shadow-sm p-8 flex flex-col md:flex-row gap-8 items-start relative overflow-hidden">
        <div className="absolute top-0 right-0 p-12 bg-indigo-50 dark:bg-indigo-900/10 rounded-full translate-x-1/2 -translate-y-1/2 -z-0"></div>
        
        <div className="relative z-10">
          <div className="h-32 w-32 rounded-[2rem] bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center overflow-hidden border-4 border-white dark:border-gray-800 shadow-xl">
            {supplier.photoURL ? (
              <img src={supplier.photoURL} alt="" className="h-full w-full object-cover" />
            ) : (
              <Building2 className="h-12 w-12 text-indigo-600 dark:text-indigo-400" />
            )}
          </div>
        </div>

        <div className="flex-1 space-y-4 relative z-10">
          <div className="flex flex-wrap items-center gap-4">
            <h1 className="text-3xl font-black text-gray-900 dark:text-white">{supplier.companyName || supplier.name || 'Fornecedor Hub'}</h1>
            <div className="flex items-center gap-1 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 px-3 py-1 rounded-full text-xs font-black uppercase tracking-widest border border-emerald-100 dark:border-emerald-800">
              <ShieldCheck className="h-3 w-3" /> Verificado
            </div>
            <div className="flex items-center gap-1 bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 px-3 py-1 rounded-full text-xs font-black uppercase tracking-widest border border-amber-100 dark:border-amber-800">
              <Star className={`h-3 w-3 ${averageRating > 0 ? 'fill-amber-500 text-amber-500' : 'text-gray-300'}`} /> 
              {averageRating > 0 ? averageRating.toFixed(1) : 'S/N'} ({ratings.length} Avaliações)
            </div>
            {profile?.role === 'shop' && (
              <button
                onClick={() => setIsRatingModalOpen(true)}
                className="ml-auto px-4 py-2 bg-indigo-600 shadow-lg shadow-indigo-200 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:scale-105 transition-all active:scale-95"
              >
                Avaliar Fornecedor
              </button>
            )}
          </div>

          <p className="text-gray-500 dark:text-gray-400 max-w-2xl">
            {supplier.bio || 'Distribuidor especializado em componentes de alta performance e peças originais para o setor automotivo. Pronta entrega e suporte técnico especializado.'}
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pt-2">
            <div className="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-gray-900/50 p-3 rounded-2xl">
              <MapPin className="h-4 w-4 text-rose-500" />
              {supplier.address?.city || 'Brasil'} - {supplier.address?.state || 'BR'}
            </div>
            <div className="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-gray-900/50 p-3 rounded-2xl">
              <Phone className="h-4 w-4 text-emerald-500" />
              {supplier.phone || 'Privado'}
            </div>
            <div className="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-gray-900/50 p-3 rounded-2xl">
              <Package className="h-4 w-4 text-indigo-500" />
              {inventory.length} Itens no Catálogo
            </div>
          </div>
        </div>
      </div>

      {/* Inventory Search & List */}
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-black text-gray-900 dark:text-white flex items-center gap-2">
            <Package className="h-6 w-6 text-indigo-600" />
            Catálogo de Produtos
          </h2>
          <div className="relative w-full max-w-xs">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar no catálogo..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl shadow-sm outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-medium"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <AnimatePresence>
            {filteredInventory.map((item, idx) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: idx * 0.03 }}
                className="bg-white dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden flex flex-col group hover:shadow-xl transition-all"
              >
                <div className="aspect-square bg-gray-50 dark:bg-gray-900 relative flex items-center justify-center p-8">
                  <Package className="h-16 w-16 text-gray-200 dark:text-gray-700 group-hover:scale-110 transition-transform" />
                  <div className="absolute top-4 left-4">
                    <span className="bg-indigo-600 text-white text-[10px] font-black px-2 py-1 rounded-lg uppercase tracking-widest">
                      Novo
                    </span>
                  </div>
                </div>

                <div className="p-5 flex-1 flex flex-col gap-3">
                  <div>
                    <h3 className="font-bold text-gray-900 dark:text-white line-clamp-2 leading-snug">{item.name}</h3>
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.15em] mt-1">{item.sku || 'N/A'}</p>
                  </div>

                  <div className="mt-auto">
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-xl font-black text-indigo-600 dark:text-indigo-400">
                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.price || 0)}
                      </span>
                      <span className={`text-[10px] font-bold px-2 py-1 rounded-lg ${item.quantity > 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                        {item.quantity > 0 ? `${item.quantity} em estoque` : 'Esgotado'}
                      </span>
                    </div>

                    <button className="w-full flex items-center justify-center gap-2 py-3 bg-gray-50 dark:bg-gray-900 border border-transparent hover:bg-indigo-600 hover:text-white rounded-xl font-black uppercase tracking-widest text-[10px] transition-all active:scale-95">
                      <ShoppingCart className="h-4 w-4" />
                      Solicitar Cotação
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {filteredInventory.length === 0 && (
          <div className="text-center py-12 text-gray-500 bg-gray-50 dark:bg-gray-900/30 rounded-[2.5rem] border-2 border-dashed border-gray-100 dark:border-gray-800">
            <Info className="h-8 w-8 mx-auto mb-2 opacity-20" />
            <p className="font-medium">Nenhum produto encontrado neste catálogo.</p>
          </div>
        )}
      </div>

      {/* Reviews Section */}
      <div className="space-y-6">
        <h2 className="text-2xl font-black text-gray-900 dark:text-white flex items-center gap-2">
          <Star className="h-6 w-6 text-amber-500" />
          Avaliações dos Clientes
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {ratings.length > 0 ? (
            ratings.map((rating) => (
              <div key={rating.id} className="bg-white dark:bg-gray-800 p-6 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center font-bold text-indigo-600">
                      {rating.shopName?.charAt(0) || 'U'}
                    </div>
                    <div>
                      <p className="font-bold text-gray-900 dark:text-white">{rating.shopName}</p>
                      <p className="text-[10px] text-gray-400 font-bold uppercase">{rating.createdAt?.toDate ? new Date(rating.createdAt.toDate()).toLocaleDateString() : 'Recent'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star key={star} className={`h-3 w-3 ${star <= rating.rating ? 'text-amber-500 fill-amber-500' : 'text-gray-200'}`} />
                    ))}
                  </div>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400">{rating.comment}</p>
              </div>
            ))
          ) : (
            <div className="col-span-2 text-center py-12 bg-gray-50 dark:bg-gray-900/30 rounded-[2.5rem] border-2 border-dashed border-gray-100 dark:border-gray-800">
              <p className="text-gray-500 font-medium">Nenhuma avaliação ainda. Seja o primeiro a avaliar!</p>
            </div>
          )}
        </div>
      </div>

      {/* Rating Modal */}
      <AnimatePresence>
        {isRatingModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white dark:bg-gray-800 w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden border border-white dark:border-gray-700"
            >
              <div className="p-8 space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">Avaliar Fornecedor</h3>
                  <button onClick={() => setIsRatingModalOpen(false)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors">
                    <ArrowLeft className="h-5 w-5 rotate-90" />
                  </button>
                </div>

                <form onSubmit={handleSubmitRating} className="space-y-6">
                  <div className="space-y-3">
                    <label className="text-xs font-black text-gray-400 uppercase tracking-widest">Sua Nota</label>
                    <div className="flex items-center gap-2">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          type="button"
                          onClick={() => setNewRating(star)}
                          className="p-1 group transition-transform active:scale-125"
                        >
                          <Star className={`h-8 w-8 ${star <= newRating ? 'text-amber-500 fill-amber-500' : 'text-gray-200 group-hover:text-amber-200'}`} />
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <label className="text-xs font-black text-gray-400 uppercase tracking-widest">Seu Comentário</label>
                    <textarea
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      placeholder="Conte sua experiência com este fornecedor..."
                      required
                      rows={4}
                      className="w-full p-4 bg-gray-50 dark:bg-gray-900 border border-transparent focus:border-indigo-500 rounded-2xl outline-none transition-all text-sm resize-none dark:text-white"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmittingRating}
                    className="w-full py-4 bg-indigo-600 disabled:bg-gray-400 text-white rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-indigo-200 dark:shadow-none hover:scale-105 transition-all flex items-center justify-center gap-2"
                  >
                    {isSubmittingRating ? <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div> : 'Enviar Avaliação'}
                  </button>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
