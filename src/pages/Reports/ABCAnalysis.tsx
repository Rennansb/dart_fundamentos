import React, { useState, useEffect } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts';
import { 
  Package, 
  TrendingUp, 
  AlertTriangle, 
  CheckCircle2, 
  ArrowRight,
  Filter,
  Download,
  Info
} from 'lucide-react';
import { motion } from 'framer-motion';
import { db } from '../../firebase';
import { collection, query, where, getDocs, limit } from 'firebase/firestore';
import { useAuth } from '../../AuthContext';

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#f43f5e', '#8b5cf6'];

export default function ABCAnalysis() {
  const { profile, selectedCompanyId } = useAuth();
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      const companyId = selectedCompanyId || profile?.companyId;
      if (!companyId) return;

      try {
        // Fetch inventory to get current stock and prices
        const invSnap = await getDocs(query(collection(db, 'inventory'), where('companyId', '==', companyId), limit(500)));
        const inventory = invSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        // Fetch completed work orders to calculate consumption
        const woSnap = await getDocs(query(
          collection(db, 'work_orders'), 
          where('companyId', '==', companyId),
          where('status', 'in', ['completed', 'delivered']),
          limit(500)
        ));
        
        const consumption: Record<string, number> = {};
        woSnap.docs.forEach(doc => {
          const wo = doc.data();
          (wo.parts || []).forEach((part: any) => {
            consumption[part.name] = (consumption[part.name] || 0) + (part.quantity || 1);
          });
        });

        // Calculate ABC
        const analyzed = inventory.map((item: any) => {
          const consumedQty = consumption[item.name] || 0;
          const totalValue = consumedQty * (item.price || 0);
          return {
            name: item.name,
            consumedQty,
            unitPrice: item.price || 0,
            totalValue,
            currentStock: item.quantity || 0
          };
        }).sort((a, b) => b.totalValue - a.totalValue);

        const grandTotal = analyzed.reduce((acc, item) => acc + item.totalValue, 0);
        let cumulativeValue = 0;

        const finalData = analyzed.map(item => {
          cumulativeValue += item.totalValue;
          const percentage = grandTotal > 0 ? (cumulativeValue / grandTotal) * 100 : 0;
          let category = 'C';
          if (percentage <= 70) category = 'A';
          else if (percentage <= 90) category = 'B';
          return { ...item, category, percentage };
        });

        setData(finalData);
        setLoading(false);
      } catch (error) {
        console.error("Error calculating ABC:", error);
        setLoading(false);
      }
    };

    fetchData();
  }, [profile, selectedCompanyId]);

  const stats = {
    A: data.filter(d => d.category === 'A').length,
    B: data.filter(d => d.category === 'B').length,
    C: data.filter(d => d.category === 'C').length,
    totalValue: data.reduce((acc, d) => acc + d.totalValue, 0)
  };

  const chartData = [
    { name: 'Classe A (70%)', value: stats.A, color: '#6366f1' },
    { name: 'Classe B (20%)', value: stats.B, color: '#f59e0b' },
    { name: 'Classe C (10%)', value: stats.C, color: '#94a3b8' }
  ];

  if (loading) return <div className="p-8 text-center">Calculando análise...</div>;

  return (
    <div className="p-8 space-y-8 max-w-7xl mx-auto">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-gray-900 dark:text-white flex items-center gap-3 tracking-tight">
            <TrendingUp className="h-8 w-8 text-indigo-600" />
            Curva ABC de Estoque
          </h1>
          <p className="text-gray-500 font-medium">Priorização estratégica baseada no valor de consumo.</p>
        </div>
        <button className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 dark:shadow-none">
          <Download className="w-4 h-4" />
          Exportar Análise
        </button>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {chartData.map((item, idx) => (
          <motion.div 
            key={idx}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.1 }}
            className="bg-white dark:bg-gray-800 p-6 rounded-[2.5rem] border border-gray-100 dark:border-gray-700 shadow-sm"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }}></div>
              <span className="text-xs font-black uppercase tracking-widest text-gray-400">{item.name}</span>
            </div>
            <div className="text-3xl font-black text-gray-900 dark:text-white mb-1">{item.value}</div>
            <div className="text-[10px] font-bold text-gray-500 uppercase">Itens nesta categoria</div>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-white dark:bg-gray-800 p-8 rounded-[2.5rem] border border-gray-100 dark:border-gray-700 shadow-sm">
          <h3 className="text-lg font-black text-gray-900 dark:text-white mb-8 flex items-center gap-2">
            <Package className="h-5 w-5 text-indigo-600" />
            Detalhes dos Itens
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-gray-50 dark:border-gray-700">
                  <th className="pb-4 text-[10px] font-black uppercase tracking-widest text-gray-400">Item</th>
                  <th className="pb-4 text-[10px] font-black uppercase tracking-widest text-gray-400">Cat.</th>
                  <th className="pb-4 text-[10px] font-black uppercase tracking-widest text-gray-400">Consumo</th>
                  <th className="pb-4 text-[10px] font-black uppercase tracking-widest text-gray-400">Vlr. Total</th>
                  <th className="pb-4 text-[10px] font-black uppercase tracking-widest text-gray-400">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-700">
                {data.slice(0, 15).map((item, i) => (
                  <tr key={i} className="group hover:bg-gray-50 dark:hover:bg-gray-900/40 transition-colors">
                    <td className="py-4">
                      <div className="text-sm font-bold text-gray-900 dark:text-white">{item.name}</div>
                      <div className="text-[10px] text-gray-400">Estoque: {item.currentStock} un.</div>
                    </td>
                    <td className="py-4">
                      <span className={`px-2 py-1 rounded-lg text-[10px] font-black ${
                        item.category === 'A' ? 'bg-indigo-100 text-indigo-600' : 
                        item.category === 'B' ? 'bg-amber-100 text-amber-600' : 
                        'bg-gray-100 text-gray-600'
                      }`}>
                        {item.category}
                      </span>
                    </td>
                    <td className="py-4 text-sm font-medium text-gray-600 dark:text-gray-400">{item.consumedQty} un.</td>
                    <td className="py-4 text-sm font-black text-gray-900 dark:text-white">R$ {item.totalValue.toLocaleString('pt-BR')}</td>
                    <td className="py-4">
                      <button className="p-2 hover:bg-white dark:hover:bg-gray-800 rounded-xl transition-all shadow-sm border border-transparent hover:border-gray-100">
                        <ArrowRight className="w-4 h-4 text-indigo-500" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-8">
          <div className="bg-indigo-600 p-8 rounded-[2.5rem] text-white shadow-xl shadow-indigo-200 dark:shadow-none relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-20">
              <Info className="w-12 h-12" />
            </div>
            <h3 className="text-lg font-black mb-4 relative z-10">Dica da IA</h3>
            <p className="text-sm text-indigo-50 leading-relaxed font-medium relative z-10">
              Os itens da **Classe A** representam 70% do seu valor movimentado. 
              Mantenha o monitoramento rigoroso destes itens para evitar ruptura de estoque e capital parado.
            </p>
          </div>

          <div className="bg-white dark:bg-gray-800 p-8 rounded-[2.5rem] border border-gray-100 dark:border-gray-700 shadow-sm">
            <h3 className="text-lg font-black text-gray-900 dark:text-white mb-6">Distribuição</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartData}
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-3 mt-4">
              {chartData.map((item, i) => (
                <div key={i} className="flex items-center justify-between text-xs font-bold">
                  <span className="text-gray-500">{item.name}</span>
                  <span className="text-gray-900 dark:text-white">{Math.round((item.value / data.length) * 100)}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
