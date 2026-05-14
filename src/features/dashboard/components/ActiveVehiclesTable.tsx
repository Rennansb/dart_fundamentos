import React from 'react';
import { motion } from 'framer-motion';
import { Wrench, ChevronRight, Phone, FileText, Eye } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { whatsappService } from '../../../services/whatsappService';
import { formatDateSafe } from '../../../utils/dateUtils';
import { cn } from '../../../utils/cn';

interface Props {
  activeVehicles: any[];
}

export function ActiveVehiclesTable({ activeVehicles }: Props) {
  const navigate = useNavigate();

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 }}
      className="bg-white dark:bg-gray-800/50 p-8 rounded-[2.5rem] shadow-sm border border-gray-100 dark:border-white/5 h-full backdrop-blur-sm"
    >
      <div className="flex items-center justify-between mb-8">
        <div>
          <h3 className="text-xl font-black text-gray-900 dark:text-white flex items-center gap-2">
            <Wrench className="h-5 w-5 text-amber-600" />
            Veículos em Serviço
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">Ordens de serviço ativas no momento</p>
        </div>
        <button 
          onClick={() => navigate('/app/work-orders')}
          className="p-3 bg-gray-50 dark:bg-gray-700/50 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-2xl transition-all group"
        >
          <ChevronRight className="h-5 w-5 text-gray-400 group-hover:text-indigo-600 transition-colors" />
        </button>
      </div>
      
      <div className="overflow-x-auto selection:bg-indigo-100 dark:selection:bg-indigo-500/20">
        <table className="min-w-full">
          <thead>
            <tr className="text-left border-b border-gray-50 dark:border-white/5">
              <th className="pb-4 text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">Cliente</th>
              <th className="pb-4 text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">Veículo</th>
              <th className="pb-4 text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 text-right">Status / Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50 dark:divide-white/5">
            {activeVehicles.map((wo) => (
              <tr key={wo.id} className="group hover:bg-gray-50/50 dark:hover:bg-white/[0.02] transition-all duration-300 relative">
                <td className="py-4 whitespace-nowrap max-w-[180px]">
                  <div className="flex items-center gap-3 overflow-hidden">
                    <div className="flex-shrink-0 w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-black text-xs ring-1 ring-inset ring-indigo-500/10">
                      {wo.customerName?.charAt(0)}
                    </div>
                    <div className="flex flex-col">
                      <span className="text-sm font-bold text-gray-900 dark:text-white truncate">{wo.customerName}</span>
                      <span className="text-[10px] font-medium text-gray-400">{formatDateSafe(wo.createdAt, 'dd MMM')}</span>
                    </div>
                  </div>
                </td>
                <td className="py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400 font-bold truncate max-w-[150px]">
                  {wo.vehicleInfo || wo.model}
                </td>
                <td className="py-4 whitespace-nowrap text-right relative">
                  <div className="flex items-center justify-end gap-2 px-1">
                    {/* Status Badge - Hidden on hover to show actions */}
                    <span className={cn(
                      "inline-flex items-center px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-wider transition-all duration-500 group-hover:opacity-0 group-hover:scale-90 group-hover:-translate-y-4",
                      wo.status === 'in_repair' ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/20' : 
                      wo.status === 'Pendente de Peças' ? 'bg-amber-50 text-amber-600 dark:bg-amber-900/20' : 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20'
                    )}>
                      {wo.status === 'in_repair' ? 'Reparo' : 
                       wo.status === 'Pendente de Peças' ? 'Peças' : 'Finalizado'}
                    </span>

                    {/* Quick Actions - Visible on hover */}
                    <div className="absolute right-0 flex items-center gap-1 opacity-0 group-hover:opacity-100 group-hover:translate-x-0 translate-x-8 transition-all duration-500 pointer-events-none group-hover:pointer-events-auto">
                      <button 
                         onClick={(e) => {
                           e.stopPropagation();
                           whatsappService.send(wo.customerPhone, `Olá ${wo.customerName}! 🚗 Como podemos ajudar com seu ${wo.vehicleInfo || wo.model}?`);
                         }}
                         className="p-2.5 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 rounded-xl hover:bg-emerald-100 dark:hover:bg-emerald-800/40 transition-all hover:scale-110 active:scale-95"
                         title="WhatsApp"
                      >
                        <Phone className="h-4 w-4" />
                      </button>
                      <button 
                         onClick={(e) => {
                           e.stopPropagation();
                           navigate(`/app/work-orders?id=${wo.id}`);
                         }}
                         className="p-2.5 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 rounded-xl hover:bg-indigo-100 dark:hover:bg-indigo-800/40 transition-all hover:scale-110 active:scale-95"
                         title="Detalhes"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                      <button 
                         onClick={(e) => {
                           e.stopPropagation();
                         }}
                         className="p-2.5 bg-rose-50 dark:bg-rose-900/30 text-rose-600 rounded-xl hover:bg-rose-100 dark:hover:bg-rose-800/40 transition-all hover:scale-110 active:scale-95"
                         title="PDF"
                      >
                        <FileText className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </td>
              </tr>
            ))}
            {activeVehicles.length === 0 && (
              <tr>
                <td colSpan={3} className="py-12 text-center text-gray-500 font-medium">Nenhum veículo em serviço no momento.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </motion.div>
  );
}
