import React from 'react';
import { motion } from 'framer-motion';
import { Activity } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface Props {
  data: any[];
  CustomTooltip: React.FC<any>;
}

export function CashFlowChart({ data, CustomTooltip }: Props) {
  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      className="bg-white dark:bg-gray-800 p-8 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700 h-full"
    >
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-10">
        <div>
          <h3 className="text-xl font-black text-gray-900 dark:text-white flex items-center gap-2">
            <Activity className="h-5 w-5 text-indigo-600" />
            Fluxo de Caixa
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">Análise de movimentação financeira</p>
        </div>
        <div className="flex flex-wrap items-center gap-4 text-[10px] font-black uppercase tracking-widest text-gray-400">
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500"></div>
            Entradas
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-indigo-500"></div>
            A Receber
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-rose-500"></div>
            Saídas
          </div>
        </div>
      </div>
      
      <div className="h-80 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
            <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} dy={10} />
            <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} tickFormatter={(value) => `R$${value}`} />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f8fafc', radius: 8 }} />
            <Bar dataKey="entradas" name="Entradas" fill="#10b981" radius={[6, 6, 0, 0]} maxBarSize={24} />
            <Bar dataKey="receber" name="A Receber" fill="#6366f1" radius={[6, 6, 0, 0]} maxBarSize={24} />
            <Bar dataKey="saidas" name="Saídas" fill="#f43f5e" radius={[6, 6, 0, 0]} maxBarSize={24} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </motion.div>
  );
}
