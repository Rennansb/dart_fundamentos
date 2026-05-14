import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, query, orderBy, limit, onSnapshot, where, getDocs } from 'firebase/firestore';
import { useAuth } from '../AuthContext';
import { 
  TrendingUp, 
  MapPin, 
  AlertTriangle, 
  Search, 
  BarChart3, 
  ArrowUpRight,
  Package,
  History as HistoryIcon,
  Info
} from 'lucide-react';
import { motion } from 'framer-motion';

interface SearchLog {
  id: string;
  query: string;
  vehicleInfo: string;
  resultsCount: number;
  shopCity: string;
  shopState: string;
  createdAt: any;
}

export default function SupplierBI() {
  const { profile } = useAuth();
  const [logs, setLogs] = useState<SearchLog[]>([]);
  const [topSearches, setTopSearches] = useState<any[]>([]);
  const [lostSales, setLostSales] = useState<any[]>([]);
  const [demandByRegion, setDemandByRegion] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, 'search_logs'), orderBy('createdAt', 'desc'), limit(500));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const logsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as SearchLog[];
      setLogs(logsData);
      processData(logsData);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const processData = (data: SearchLog[]) => {
    // 1. Most Searched
    const counts: Record<string, number> = {};
    const zeroResults: Record<string, number> = {};
    const regions: Record<string, number> = {};

    data.forEach(log => {
      const q = log.query.toLowerCase().trim();
      counts[q] = (counts[q] || 0) + 1;
      
      if (log.resultsCount === 0) {
        zeroResults[q] = (zeroResults[q] || 0) + 1;
      }

      if (log.shopCity) {
        const region = `${log.shopCity}, ${log.shopState}`;
        regions[region] = (regions[region] || 0) + 1;
      }
    });

    setTopSearches(
      Object.entries(counts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([name, count]) => ({ name, count }))
    );

    setLostSales(
      Object.entries(zeroResults)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([name, count]) => ({ name, count }))
    );

    setDemandByRegion(
      Object.entries(regions)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([name, count]) => ({ name, count }))
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-8 bg-gray-50/50 dark:bg-gray-900/50 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <h1 className="text-4xl font-black text-gray-900 dark:text-white tracking-tight">
              Radar de <span className="text-indigo-600 dark:text-indigo-400">Oportunidades</span>
            </h1>
            <p className="mt-2 text-gray-500 dark:text-gray-400 font-medium">Inteligência de mercado baseada em buscas reais de oficinas.</p>
          </div>
          <div className="flex items-center gap-3 px-4 py-2 bg-indigo-50 dark:bg-indigo-900/40 rounded-2xl border border-indigo-100 dark:border-indigo-800">
            <TrendingUp className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            <span className="text-xs font-black text-indigo-700 dark:text-indigo-300 uppercase tracking-widest">IA Market Insights Ativo</span>
          </div>
        </div>

        {/* Top Metrics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <motion.div whileHover={{ y: -5 }} className="bg-white dark:bg-gray-800 p-6 rounded-3xl shadow-xl shadow-gray-200/50 dark:shadow-none border border-gray-100 dark:border-gray-700">
            <div className="flex items-center gap-4 mb-4">
              <div className="p-3 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 rounded-2xl">
                <Search className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">Total de Buscas</p>
                <h3 className="text-2xl font-black text-gray-900 dark:text-white">{logs.length}</h3>
              </div>
            </div>
            <div className="h-2 w-full bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
              <div className="h-full bg-emerald-500 w-[70%]" />
            </div>
            <p className="mt-4 text-[10px] text-gray-400 font-bold uppercase tracking-tight flex items-center gap-1">
              <ArrowUpRight className="w-3 h-3 text-emerald-500" /> +12% em relação à última semana
            </p>
          </motion.div>

          <motion.div whileHover={{ y: -5 }} className="bg-white dark:bg-gray-800 p-6 rounded-3xl shadow-xl shadow-gray-200/50 dark:shadow-none border border-gray-100 dark:border-gray-700">
            <div className="flex items-center gap-4 mb-4">
              <div className="p-3 bg-rose-50 dark:bg-rose-900/20 text-rose-600 rounded-2xl">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">Vendas Perdidas</p>
                <h3 className="text-2xl font-black text-gray-900 dark:text-white">{logs.filter(l => l.resultsCount === 0).length}</h3>
              </div>
            </div>
            <div className="h-2 w-full bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
              <div className="h-full bg-rose-500 w-[45%]" />
            </div>
            <p className="mt-4 text-[10px] text-gray-400 font-bold uppercase tracking-tight">Oportunidades de estoque não atendidas</p>
          </motion.div>

          <motion.div whileHover={{ y: -5 }} className="bg-white dark:bg-gray-800 p-6 rounded-3xl shadow-xl shadow-gray-200/50 dark:shadow-none border border-gray-100 dark:border-gray-700">
            <div className="flex items-center gap-4 mb-4">
              <div className="p-3 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 rounded-2xl">
                <MapPin className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">Regiões Ativas</p>
                <h3 className="text-2xl font-black text-gray-900 dark:text-white">{new Set(logs.map(l => l.shopCity)).size}</h3>
              </div>
            </div>
            <div className="h-2 w-full bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
              <div className="h-full bg-indigo-500 w-[60%]" />
            </div>
            <p className="mt-4 text-[10px] text-gray-400 font-bold uppercase tracking-tight">Cidades buscando seus produtos</p>
          </motion.div>
        </div>

        {/* Detailed Charts/Sections */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Peças Mais Procuradas */}
          <div className="bg-white dark:bg-gray-800 rounded-3xl p-8 shadow-xl border border-gray-100 dark:border-gray-700">
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
                <BarChart3 className="w-5 h-5 text-indigo-500" />
                Peças Mais Procuradas
              </h3>
            </div>
            <div className="space-y-6">
              {topSearches.map((item, idx) => (
                <div key={item.name} className="relative">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-black text-gray-700 dark:text-gray-300 capitalize">{item.name}</span>
                    <span className="text-xs font-bold bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 px-2 py-1 rounded-lg">{item.count} buscas</span>
                  </div>
                  <div className="h-1.5 w-full bg-gray-50 dark:bg-gray-900/50 rounded-full overflow-hidden">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${(item.count / topSearches[0].count) * 100}%` }}
                      className="h-full bg-indigo-500 rounded-full"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Oportunidades de Estoque (Lost Sales) */}
          <div className="bg-white dark:bg-gray-800 rounded-3xl p-8 shadow-xl border border-gray-100 dark:border-gray-700">
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
                <Package className="w-5 h-5 text-rose-500" />
                Oportunidades de Estoque
              </h3>
            </div>
            <div className="space-y-4">
              {lostSales.map((item) => (
                <div key={item.name} className="flex items-center justify-between p-4 bg-rose-50/30 dark:bg-rose-900/10 rounded-2xl border border-rose-100/50 dark:border-rose-900/30">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-rose-100 dark:bg-rose-900/50 rounded-xl flex items-center justify-center text-rose-600">
                      <TrendingUp className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-sm font-black text-gray-900 dark:text-white capitalize">{item.name}</p>
                      <p className="text-[10px] text-rose-500 font-bold uppercase tracking-tight">Vendas não efetuadas por falta de estoque</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-black text-rose-600">{item.count}</p>
                    <p className="text-[10px] text-gray-400 font-bold uppercase">Solicitações</p>
                  </div>
                </div>
              ))}
              {lostSales.length === 0 && <p className="text-gray-500 text-center py-8">Nenhuma oportunidade identificada ainda.</p>}
            </div>
          </div>

          {/* Demanda por Região */}
          <div className="bg-white dark:bg-gray-800 rounded-3xl p-8 shadow-xl border border-gray-100 dark:border-gray-700">
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
                <MapPin className="w-5 h-5 text-emerald-500" />
                Demanda por Região
              </h3>
            </div>
            <div className="space-y-4">
              {demandByRegion.map((region) => (
                <div key={region.name} className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900/50 rounded-2xl border border-gray-100 dark:border-gray-700">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-emerald-100 dark:bg-emerald-900/50 rounded-xl flex items-center justify-center text-emerald-600">
                      <MapPin className="w-5 h-5" />
                    </div>
                    <span className="text-sm font-bold text-gray-900 dark:text-white">{region.name}</span>
                  </div>
                  <span className="text-xs font-black text-emerald-600 bg-emerald-50 dark:bg-emerald-900/30 px-3 py-1 rounded-full">{region.count} atividades</span>
                </div>
              ))}
            </div>
          </div>

          {/* Histórico Recente de Buscas */}
          <div className="bg-white dark:bg-gray-800 rounded-3xl p-8 shadow-xl border border-gray-100 dark:border-gray-700 overflow-hidden">
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
                <HistoryIcon className="w-5 h-5 text-gray-400" />
                Atividade em Tempo Real
              </h3>
            </div>
            <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
              {logs.slice(0, 10).map((log) => (
                <div key={log.id} className="p-3 border-l-4 border-indigo-500 bg-indigo-50/20 dark:bg-indigo-900/10 rounded-r-xl">
                  <p className="text-xs font-bold text-gray-900 dark:text-white">Busca por "<span className="capitalize">{log.query}</span>"</p>
                  <p className="text-[10px] text-gray-500 mt-1">Carro: {log.vehicleInfo} • Cidade: {log.shopCity || 'Não informada'}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Info Banner */}
        <div className="bg-indigo-600 rounded-[2.5rem] p-10 text-white relative overflow-hidden group shadow-2xl shadow-indigo-500/20">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -mr-32 -mt-32 transition-transform duration-1000 group-hover:scale-110"></div>
          <div className="relative z-10 flex flex-col md:flex-row items-center gap-8">
            <div className="p-5 bg-white/20 rounded-3xl backdrop-blur-md">
              <Info className="w-10 h-10 text-white" />
            </div>
            <div className="text-center md:text-left">
              <h3 className="text-2xl font-black mb-2 tracking-tight">Otimização de Estoque Sugerida</h3>
              <p className="text-indigo-100 font-medium max-w-xl">
                Baseado nas buscas com zero resultado, sugerimos aumentar o estoque de <span className="text-white font-bold underline capitalize">{lostSales[0]?.name || 'novas peças'}</span> para capturar oportunidades de venda imediata na região.
              </p>
            </div>
            <button className="md:ml-auto px-8 py-4 bg-white text-indigo-600 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-indigo-50 transition-all shadow-xl active:scale-95">
              Ver Relatório Completo
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
