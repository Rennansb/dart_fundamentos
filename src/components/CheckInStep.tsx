import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Car, Bike, Check, AlertCircle, Camera, Navigation, Fuel, Zap, Fan } from 'lucide-react';

interface DamageMarker {
  x: number;
  y: number;
  type: 'scratch' | 'dent' | 'broken';
  notes?: string;
}

interface CheckInStepProps {
  onDataChange: (data: any) => void;
  initialData?: any;
}

export default function CheckInStep({ onDataChange, initialData }: CheckInStepProps) {
  const [vehicleType, setVehicleType] = useState<'car' | 'motorcycle'>('car');
  const [markers, setMarkers] = useState<DamageMarker[]>(initialData?.markers || []);
  const [checklist, setChecklist] = useState<Record<string, boolean>>(initialData?.checklist || {
    lights: true,
    horn: true,
    tires: true,
    fluids: true,
    internal: true,
    spareTire: true
  });
  const [fuelLevel, setFuelLevel] = useState(initialData?.fuelLevel || 50);

  const handleDiagramClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    
    const newMarker: DamageMarker = { x, y, type: 'scratch' };
    const newMarkers = [...markers, newMarker];
    setMarkers(newMarkers);
    updateParent({ markers: newMarkers });
  };

  const removeMarker = (index: number) => {
    const newMarkers = markers.filter((_, i) => i !== index);
    setMarkers(newMarkers);
    updateParent({ markers: newMarkers });
  };

  const toggleChecklist = (item: string) => {
    const newChecklist = { ...checklist, [item]: !checklist[item] };
    setChecklist(newChecklist);
    updateParent({ checklist: newChecklist });
  };

  const updateParent = (updates: any) => {
    onDataChange({
      vehicleType,
      markers,
      checklist,
      fuelLevel,
      ...updates
    });
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Vehicle Toggle */}
      <div className="flex gap-4 p-1 bg-gray-100 dark:bg-gray-800/50 rounded-2xl w-fit">
        <button
          onClick={() => { setVehicleType('car'); updateParent({ vehicleType: 'car', markers: [] }); }}
          className={`flex items-center gap-2 px-6 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all ${
            vehicleType === 'car' ? 'bg-white dark:bg-gray-800 text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <Car className="w-4 h-4" /> Carro
        </button>
        <button
          onClick={() => { setVehicleType('motorcycle'); updateParent({ vehicleType: 'motorcycle', markers: [] }); }}
          className={`flex items-center gap-2 px-6 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all ${
            vehicleType === 'motorcycle' ? 'bg-white dark:bg-gray-800 text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <Bike className="w-4 h-4" /> Moto
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
        {/* Visual Diagram */}
        <div className="space-y-4">
          <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-2">Mapeamento de Avarias (Toque para marcar)</label>
          <div 
            className="relative aspect-square bg-white dark:bg-gray-800 rounded-[2.5rem] border-2 border-dashed border-gray-200 dark:border-gray-700 overflow-hidden cursor-crosshair group shadow-inner"
            onClick={handleDiagramClick}
          >
            <img 
              src={`/assets/diagrams/${vehicleType}_diagram.png`} 
              alt="Vehicle Diagram"
              className="w-full h-full object-contain p-8 opacity-80 group-hover:opacity-100 transition-opacity"
            />
            
            {markers.map((marker, idx) => (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                key={idx}
                className="absolute w-5 h-5 -ml-2.5 -mt-2.5 bg-red-500 border-4 border-white dark:border-gray-900 rounded-full shadow-lg cursor-pointer hover:scale-125 transition-transform"
                style={{ left: `${marker.x}%`, top: `${marker.y}%` }}
                onClick={(e) => { e.stopPropagation(); removeMarker(idx); }}
              />
            ))}

            {markers.length === 0 && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Nenhuma avaria marcada</p>
              </div>
            )}
          </div>
          <div className="flex flex-wrap gap-2 px-2">
            <span className="flex items-center gap-1.5 text-[9px] font-bold text-gray-400 uppercase tracking-widest bg-gray-100 dark:bg-gray-800 px-3 py-1.5 rounded-lg">
              <div className="w-2 h-2 rounded-full bg-red-500" /> Danos/Arranhões
            </span>
          </div>
        </div>

        {/* Checklist & Fuel */}
        <div className="space-y-8">
          <div className="space-y-4">
            <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-2">Checklist de Entrada</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                { id: 'lights', label: 'Iluminação/Faróis', icon: Zap },
                { id: 'horn', label: 'Buzina', icon: AlertCircle },
                { id: 'tires', label: 'Estado dos Pneus', icon: Navigation },
                { id: 'fluids', label: 'Níveis de Fluídos', icon: Fan },
                { id: 'internal', label: 'Interior/Painel', icon: Check },
                { id: 'spareTire', label: vehicleType === 'car' ? 'Estepe/Macaco' : 'Kit Ferramentas', icon: Wrench },
              ].map((item) => {
                const Icon = item.icon;
                const active = checklist[item.id];
                return (
                  <button
                    key={item.id}
                    onClick={() => toggleChecklist(item.id)}
                    className={`flex items-center gap-3 p-4 rounded-2xl border transition-all duration-200 text-left ${
                      active 
                        ? 'bg-indigo-50 border-indigo-100 dark:bg-indigo-900/20 dark:border-indigo-800/50 text-indigo-600 dark:text-indigo-400' 
                        : 'bg-white border-gray-100 dark:bg-gray-800 dark:border-gray-700 text-gray-500'
                    }`}
                  >
                    <div className={`p-2 rounded-xl ${active ? 'bg-indigo-100 dark:bg-indigo-900/40' : 'bg-gray-50 dark:bg-gray-700'}`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <span className="text-[11px] font-black uppercase tracking-tight flex-1">{item.label}</span>
                    {active ? <Check className="w-4 h-4" /> : <div className="w-4 h-4 rounded-full border-2 border-gray-200 dark:border-gray-700" />}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between px-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Nível de Combustível</label>
              <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">{fuelLevel}%</span>
            </div>
            <div className="p-6 bg-white dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm flex items-center gap-6">
              <Fuel className="w-6 h-6 text-gray-400" />
              <input
                type="range"
                min="0"
                max="100"
                step="25"
                value={fuelLevel}
                onChange={(e) => { setFuelLevel(parseInt(e.target.value)); updateParent({ fuelLevel: parseInt(e.target.value) }); }}
                className="flex-1 h-2 bg-gray-100 dark:bg-gray-700 rounded-full appearance-none cursor-pointer accent-indigo-600"
              />
              <div className="flex gap-2">
                {[0, 25, 50, 75, 100].map(v => (
                  <div key={v} className={`w-1 h-3 rounded-full ${fuelLevel >= v ? 'bg-indigo-600' : 'bg-gray-200'} hidden sm:block`} />
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-2">Fotos de Entrada</label>
            <div className="grid grid-cols-3 gap-4">
              {[1, 2, 3].map(i => (
                <button key={i} className="aspect-square rounded-3xl border-2 border-dashed border-gray-200 dark:border-gray-700 flex flex-col items-center justify-center gap-2 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                  <Camera className="w-6 h-6 text-gray-400" />
                  <span className="text-[8px] font-black text-gray-400 uppercase tracking-widest">Foto 0{i}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const Wrench = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
  </svg>
);
