import React, { useState, useEffect } from 'react';
import { Search, CheckCircle, Clock, Wrench, Package, Truck, AlertCircle, Star, CheckCircle2 } from 'lucide-react';
import { updateDoc, doc, increment, getDoc, serverTimestamp, addDoc } from 'firebase/firestore';
import { motion } from 'framer-motion';
import { db } from '../firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';

export default function PublicTracking() {
  const [searchQuery, setSearchQuery] = useState('');
  const [trackingData, setTrackingData] = useState<any>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setLoading(true);
    setError('');
    try {
      const isPhone = searchQuery.includes('-') || searchQuery.length > 8;
      let q;
      if (isPhone) {
        // Search by customer phone
        const qCustomer = query(collection(db, 'customers'), where('phone', '==', searchQuery));
        const customerSnapshot = await getDocs(qCustomer);
        if (customerSnapshot.empty) throw new Error('Cliente não encontrado');
        const customerId = customerSnapshot.docs[0].id;
        q = query(collection(db, 'work_orders'), where('customerId', '==', customerId));
      } else {
        // Search by work order code
        q = query(collection(db, 'work_orders'), where('code', '==', searchQuery));
      }
      
      const snapshot = await getDocs(q);
      if (snapshot.empty) throw new Error('Ordem de serviço não encontrada');
      
      // Get the most recent work order if multiple
      let latestWO = snapshot.docs[0].data() as any;
      snapshot.docs.forEach(doc => {
        const data = doc.data() as any;
        if (data.createdAt > latestWO.createdAt) {
          latestWO = data;
        }
      });
      
      setTrackingData(latestWO);
    } catch (err: any) {
      setError(err.message);
      setTrackingData(null);
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'received': return <Package className="h-6 w-6 text-gray-500" />;
      case 'diagnosing': return <Search className="h-6 w-6 text-blue-500" />;
      case 'waiting for parts': return <Clock className="h-6 w-6 text-yellow-500" />;
      case 'in repair': return <Wrench className="h-6 w-6 text-indigo-500" />;
      case 'completed': return <CheckCircle className="h-6 w-6 text-green-500" />;
      case 'delivered': return <Truck className="h-6 w-6 text-purple-500" />;
      default: return <AlertCircle className="h-6 w-6 text-gray-500" />;
    }
  };

  const translateStatus = (status: string) => {
    switch (status) {
      case 'received': return 'Recebido';
      case 'diagnosing': return 'Em Diagnóstico';
      case 'waiting for parts': return 'Aguardando Peças';
      case 'in repair': return 'Em Reparo';
      case 'completed': return 'Concluído';
      case 'delivered': return 'Entregue';
      default: return status;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col items-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900 dark:text-white">
            Rastrear Serviço
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600 dark:text-gray-400">
            Acompanhe o status do seu equipamento em tempo real.
          </p>
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleSearch}>
          <div className="rounded-md shadow-sm -space-y-px">
            <div>
              <label htmlFor="search-query" className="sr-only">Telefone ou Código</label>
              <input
                id="search-query"
                name="search"
                type="text"
                required
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 dark:border-gray-700 placeholder-gray-500 dark:placeholder-gray-400 text-gray-900 dark:text-white bg-white dark:bg-gray-800 rounded-t-md rounded-b-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                placeholder="Digite seu telefone ou código do serviço"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={loading}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
            >
              <span className="absolute left-0 inset-y-0 flex items-center pl-3">
                <Search className="h-5 w-5 text-indigo-500 group-hover:text-indigo-400" aria-hidden="true" />
              </span>
              {loading ? 'Buscando...' : 'Rastrear'}
            </button>
          </div>
        </form>

        {error && (
          <div className="rounded-md bg-red-50 dark:bg-red-900/30 p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <AlertCircle className="h-5 w-5 text-red-400" aria-hidden="true" />
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800 dark:text-red-200">{error}</h3>
              </div>
            </div>
          </div>
        )}

        {trackingData && (
          <div className="bg-white dark:bg-gray-800 shadow overflow-hidden sm:rounded-lg border border-gray-200 dark:border-gray-700 mt-8">
            <div className="px-4 py-5 sm:px-6 flex flex-col sm:flex-row justify-between sm:items-center border-b border-gray-200 dark:border-gray-700 gap-4">
              <div>
                <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-white">
                  Ordem #{trackingData.id}
                </h3>
                <p className="mt-1 max-w-2xl text-sm text-gray-500 dark:text-gray-400">
                  {trackingData.brand} {trackingData.model}
                </p>
              </div>
              <div className="flex items-center space-x-2 self-start sm:self-auto">
                {getStatusIcon(trackingData.status)}
                <span className="text-sm font-semibold text-gray-900 dark:text-white">
                  {translateStatus(trackingData.status)}
                </span>
              </div>
            </div>
            <div className="px-4 py-5 sm:p-6">
              <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-4">Linha do Tempo</h4>
              <div className="flow-root">
                <ul role="list" className="-mb-8">
                  {trackingData.timeline.map((event: any, eventIdx: number) => (
                    <li key={event.id}>
                      <div className="relative pb-8">
                        {eventIdx !== trackingData.timeline.length - 1 ? (
                          <span className="absolute top-4 left-4 -ml-px h-full w-0.5 bg-gray-200 dark:bg-gray-700" aria-hidden="true" />
                        ) : null}
                        <div className="relative flex space-x-3">
                          <div>
                            <span className="h-8 w-8 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center ring-8 ring-white dark:ring-gray-800">
                              {event.type === 'status_change' ? <CheckCircle className="h-5 w-5 text-indigo-500" /> : <Wrench className="h-5 w-5 text-gray-500" />}
                            </span>
                          </div>
                          <div className="min-w-0 flex-1 pt-1.5 flex flex-col sm:flex-row sm:justify-between sm:space-x-4 gap-1">
                            <div>
                              <p className="text-sm text-gray-500 dark:text-gray-400">{event.content}</p>
                            </div>
                            <div className="text-left sm:text-right text-xs sm:text-sm whitespace-nowrap text-gray-500 dark:text-gray-500">
                              <time dateTime={event.createdAt?.toDate ? event.createdAt.toDate().toISOString() : new Date(event.createdAt).toISOString()}>
                                {event.createdAt?.toDate ? event.createdAt.toDate().toLocaleDateString('pt-BR') : new Date(event.createdAt).toLocaleDateString('pt-BR')}
                              </time>
                            </div>
                          </div>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}

        {trackingData && trackingData.status === 'delivered' && !trackingData.customerRated && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-indigo-600 rounded-3xl p-8 shadow-2xl text-white text-center space-y-6"
          >
            <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mx-auto border border-white/20 backdrop-blur-md">
              <Star className="h-8 w-8 text-amber-300 fill-amber-300" />
            </div>
            <div>
              <h3 className="text-xl font-black uppercase tracking-tighter">Sua opinião é importante!</h3>
              <p className="text-indigo-100 text-sm mt-2">Como foi o serviço realizado em seu veículo?</p>
            </div>
            
            <div className="flex justify-center gap-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  onClick={async () => {
                    if (!trackingData.id) return;
                    try {
                      // Update OS as rated
                      const woRef = doc(db, 'work_orders', trackingData.id);
                      await updateDoc(woRef, {
                        customerRated: true,
                        customerRating: star,
                        ratedAt: serverTimestamp()
                      });

                      // Award points to employee if 5 stars
                      if (star === 5 && trackingData.employeeId) {
                        const employeeRef = doc(db, 'users', trackingData.employeeId);
                        const empSnap = await getDoc(employeeRef);
                        if (empSnap.exists()) {
                          const empData = empSnap.data();
                          const currentPoints = empData.points || 0;
                          const newPoints = currentPoints + 20;
                          const newLevel = Math.floor(newPoints / 1000) + 1;
                          
                          await updateDoc(employeeRef, {
                            points: newPoints,
                            level: newLevel
                          });
                        }
                      }
                      
                      alert("Obrigado pela sua avaliação! ✅");
                      setTrackingData((prev: any) => ({ ...prev, customerRated: true }));
                    } catch (err) {
                      console.error("Error rating:", err);
                      alert("Erro ao enviar avaliação.");
                    }
                  }}
                  className="p-1 transition-transform hover:scale-125 active:scale-95"
                >
                  <Star className="w-10 h-10 text-amber-300 hover:fill-amber-300" />
                </button>
              ))}
            </div>
          </motion.div>
        )}

        {trackingData && trackingData.customerRated && (
          <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-3xl p-6 text-center text-emerald-700 dark:text-emerald-400 font-bold flex items-center justify-center gap-3">
            <CheckCircle2 className="h-5 w-5" />
            Obrigado pela sua avaliação!
          </div>
        )}
      </div>
    </div>
  );
}
