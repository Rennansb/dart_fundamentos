import React, { useState } from 'react';
import { 
  Search, 
  History as HistoryIcon, 
  Car, 
  User, 
  MapPin, 
  Wrench, 
  Package, 
  MessageSquare, 
  DollarSign,
  Calendar,
  AlertCircle,
  Loader2,
  ChevronRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { historyService, VehicleHistoryRecord } from '../services/historyService';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export default function VehicleHistory() {
  const [plate, setPlate] = useState('');
  const [loading, setLoading] = useState(false);
  const [records, setRecords] = useState<VehicleHistoryRecord[]>([]);
  const [hasSearched, setHasSearched] = useState(false);

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!plate.trim()) return;

    setLoading(true);
    setHasSearched(true);
    try {
      const results = await historyService.getVehicleHistory(plate);
      setRecords(results);
    } catch (error) {
      console.error("Error searching history:", error);
    } finally {
      setLoading(false);
    }
  };

  const vehicleInfo = records.length > 0 ? {
    brand: records[0].brand,
    model: records[0].model,
    customerName: records[0].customerName,
    plate: records[0].plate
  } : null;

  return (
    <div className="min-h-screen bg-gray-50/50 dark:bg-gray-900/50 p-4 sm:p-6 lg:p-8 space-y-8">
      {/* Header Section */}
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col gap-2"
      >
        <h1 className="text-4xl font-black text-gray-900 dark:text-white tracking-tight flex items-center gap-3">
          <HistoryIcon className="w-10 h-10 text-indigo-600" />
          Histórico Veicular
        </h1>
        <p className="text-gray-500 dark:text-gray-400 font-medium">
          Consulte o registro completo de manutenções realizadas em toda a rede.
        </p>
      </motion.div>

      {/* Search Bar */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="max-w-2xl"
      >
        <form onSubmit={handleSearch} className="flex gap-3">
          <div className="relative flex-1 group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 group-focus-within:text-indigo-500 transition-colors" />
            <input
              type="text"
              placeholder="Digite a placa (ex: ABC1234)..."
              value={plate}
              onChange={(e) => setPlate(e.target.value.toUpperCase())}
              className="w-full pl-12 pr-4 py-4 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl shadow-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all dark:text-white font-bold tracking-widest text-lg"
              maxLength={7}
            />
          </div>
          <button
            type="submit"
            disabled={loading || !plate.trim()}
            className="px-8 py-4 bg-indigo-600 text-white rounded-2xl font-black text-sm hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 dark:shadow-none disabled:opacity-50 flex items-center gap-2"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'BUSCAR'}
          </button>
        </form>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Vehicle Summary */}
        <AnimatePresence mode="wait">
          {vehicleInfo && (
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="lg:col-span-1 space-y-6"
            >
              <div className="bg-white dark:bg-gray-800 rounded-[2rem] p-8 shadow-sm border border-gray-100 dark:border-gray-700 sticky top-24">
                <div className="flex items-center gap-4 mb-8">
                  <div className="p-4 bg-indigo-50 dark:bg-indigo-900/30 rounded-2xl text-indigo-600 dark:text-indigo-400">
                    <Car className="w-8 h-8" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight leading-none">
                      {vehicleInfo.brand}
                    </h2>
                    <p className="text-lg font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-widest">
                      {vehicleInfo.model}
                    </p>
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="space-y-1">
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">Placa</p>
                    <div className="flex items-center gap-3 text-xl font-black text-gray-900 dark:text-white bg-gray-50 dark:bg-gray-900/50 p-4 rounded-2xl border border-gray-100 dark:border-gray-800">
                      <div className="w-2 h-8 bg-blue-600 rounded-full" />
                      {vehicleInfo.plate}
                    </div>
                  </div>

                  <div className="space-y-1">
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">Proprietário Principal</p>
                    <div className="flex items-center gap-3 text-gray-700 dark:text-gray-200 font-bold">
                      <User className="w-5 h-5 text-indigo-500" />
                      {vehicleInfo.customerName}
                    </div>
                  </div>

                  <div className="pt-6 border-t border-gray-50 dark:border-gray-700">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-500 dark:text-gray-400 font-bold">Total de Registros</span>
                      <span className="px-3 py-1 bg-indigo-600 text-white rounded-full font-black text-xs">
                        {records.length}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Right Column: Timeline */}
        <div className="lg:col-span-2">
          {!hasSearched ? (
            <div className="flex flex-col items-center justify-center py-20 text-center bg-white dark:bg-gray-800 rounded-[2rem] border-2 border-dashed border-gray-200 dark:border-gray-700">
              <HistoryIcon className="w-16 h-16 text-gray-300 mb-4" />
              <h3 className="text-xl font-bold text-gray-900 dark:text-white">Aguardando Consulta</h3>
              <p className="text-gray-500 dark:text-gray-400 mt-2 max-w-xs px-4">
                Digite uma placa acima para visualizar o histórico de saúde do veículo na plataforma.
              </p>
            </div>
          ) : loading ? (
            <div className="flex flex-col items-center justify-center py-20">
              <Loader2 className="w-12 h-12 text-indigo-600 animate-spin mb-4" />
              <p className="text-gray-500 font-bold">Buscando registros globais...</p>
            </div>
          ) : records.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center bg-white dark:bg-gray-800 rounded-[2rem] border border-gray-100 dark:border-gray-700">
              <AlertCircle className="w-16 h-16 text-rose-500 mb-4" />
              <h3 className="text-xl font-bold text-gray-900 dark:text-white">Nenhum registro encontrado</h3>
              <p className="text-gray-500 dark:text-gray-400 mt-2 max-w-xs px-4">
                Não encontramos manutenções registradas para esta placa em nenhuma loja da plataforma.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {records.map((record, index) => (
                <motion.div
                  key={record.workOrderId || index}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="bg-white dark:bg-gray-800 rounded-[2rem] p-8 shadow-sm border border-gray-100 dark:border-gray-700 group hover:border-indigo-500/50 transition-all overflow-hidden relative"
                >
                  {/* Decorative element */}
                  <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full -mr-16 -mt-16 group-hover:scale-150 transition-transform duration-700" />
                  
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
                    <div className="flex items-center gap-3">
                      <div className="p-3 bg-indigo-600 rounded-2xl text-white shadow-lg shadow-indigo-200 dark:shadow-none">
                        <Calendar className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 leading-none mb-1">DATA DO SERVIÇO</p>
                        <p className="text-lg font-black text-gray-900 dark:text-white">
                          {record.date?.toDate ? record.date.toDate().toLocaleDateString('pt-BR') : new Date(record.date).toLocaleDateString('pt-BR')}
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-3 bg-gray-50 dark:bg-gray-900/50 px-4 py-2.5 rounded-2xl border border-gray-100 dark:border-gray-800">
                      <MapPin className="w-4 h-4 text-indigo-500" />
                      <span className="text-sm font-black text-gray-700 dark:text-white uppercase truncate max-w-[150px]">
                        {record.shopName}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Problem & Services */}
                    <div className="space-y-6">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-600 dark:text-indigo-400">Problema Relatado</label>
                        <p className="text-sm text-gray-600 dark:text-gray-300 font-bold bg-indigo-50/30 dark:bg-indigo-500/5 p-4 rounded-2xl italic border-l-4 border-indigo-500">
                          "{record.reportedProblem || 'Não informado'}"
                        </p>
                      </div>

                      <div className="space-y-3">
                        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">Serviços e Mão de Obra</label>
                        <div className="flex flex-wrap gap-2">
                          {record.services.map((svc, i) => (
                            <span key={i} className="px-4 py-2 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 text-xs font-black rounded-xl border border-gray-100 dark:border-gray-600 flex items-center gap-2">
                              <Wrench className="w-3.5 h-3.5 text-indigo-500" />
                              {svc}
                            </span>
                          ))}
                          {record.services.length === 0 && <span className="text-xs text-gray-500 italic">Nenhum serviço listado</span>}
                        </div>
                      </div>
                    </div>

                    {/* Parts & Comments */}
                    <div className="space-y-6">
                      <div className="space-y-3">
                        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">Peças Substituídas</label>
                        <div className="flex flex-wrap gap-2">
                          {record.parts.map((part, i) => (
                            <span key={i} className="px-4 py-2 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 text-xs font-black rounded-xl border border-emerald-100 dark:border-emerald-500/20 flex items-center gap-2">
                              <Package className="w-3.5 h-3.5" />
                              {part}
                            </span>
                          ))}
                          {record.parts.length === 0 && <span className="text-xs text-gray-500 italic">Nenhuma peça registrada</span>}
                        </div>
                      </div>

                      {record.comments && record.comments.length > 0 && (
                        <div className="space-y-3">
                          <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">Notas do Técnico</label>
                          <div className="space-y-2">
                            {record.comments.map((comment, i) => (
                              <div key={i} className="flex gap-3 items-start bg-gray-50 dark:bg-gray-900/40 p-3 rounded-xl">
                                <MessageSquare className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
                                <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">{comment}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="mt-8 pt-6 border-t border-gray-50 dark:border-gray-700 flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-6">
                      {record.mileage && (
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-lg bg-amber-50 dark:bg-amber-900/30 flex items-center justify-center">
                            <HistoryIcon className="w-4 h-4 text-amber-600" />
                          </div>
                          <div>
                            <p className="text-[9px] font-black text-gray-400 uppercase leading-none">Quilometragem</p>
                            <p className="text-sm font-black text-gray-700 dark:text-gray-200">{record.mileage} KM</p>
                          </div>
                        </div>
                      )}
                      
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center">
                          <DollarSign className="w-4 h-4 text-indigo-600" />
                        </div>
                        <div>
                          <p className="text-[9px] font-black text-gray-400 uppercase leading-none">Valor Total</p>
                          <p className="text-sm font-black text-gray-700 dark:text-gray-200">R$ {record.totalCost?.toFixed(2)}</p>
                        </div>
                      </div>
                    </div>

                    <div className="text-[10px] font-bold text-gray-400 bg-gray-50 dark:bg-gray-900/50 px-3 py-1.5 rounded-lg flex items-center gap-2">
                      REF: #{record.workOrderId?.substring(0, 8).toUpperCase()}
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
