import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../firebase';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  addDoc, 
  deleteDoc, 
  doc, 
  serverTimestamp, 
  orderBy, 
  updateDoc 
} from 'firebase/firestore';
import { useAuth } from '../AuthContext';
import { handleFirestoreError, OperationType } from '../utils/firestoreErrors';
import { 
  format, 
  startOfMonth, 
  endOfMonth, 
  eachDayOfInterval, 
  isSameMonth, 
  isSameDay, 
  addMonths, 
  subMonths, 
  startOfWeek,
  endOfWeek
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { formatDateSafe } from '../utils/dateUtils';
import { 
  Plus, X, ChevronLeft, ChevronRight, 
  Trash2, Calendar, Clock, 
  CheckCircle2, AlertCircle, 
  CalendarDays, GripVertical, 
  MoreVertical, Bell, Info, Settings, Crown
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  DndContext, 
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  defaultDropAnimationSideEffects
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// --- Sub-components ---

function DraggableAppointment({ app, onApprove, onDelete }: { app: any, onApprove: (app: any) => void, onDelete: (id: string, type: string) => void }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ 
    id: app.id,
    data: {
      type: 'appointment',
      app: app
    }
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 1000 : 1
  };

  return (
    <motion.div 
      ref={setNodeRef}
      style={style}
      layout
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, scale: 0.9 }}
      className={`p-6 bg-gray-50 dark:bg-gray-900/30 rounded-3xl border border-gray-100 dark:border-gray-800 space-y-4 hover:border-indigo-200 dark:hover:border-indigo-900/50 transition-all hover:bg-white dark:hover:bg-gray-800 hover:shadow-xl group mb-4 ${isDragging ? 'ring-2 ring-indigo-500 shadow-2xl' : ''}`}
    >
      <div className="flex justify-between items-start">
        <div className="flex items-center gap-3">
          <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing p-1.5 hover:bg-white dark:hover:bg-gray-700 rounded-xl text-gray-400 hover:text-indigo-500 transition-all">
            <GripVertical className="h-4 w-4" />
          </div>
          <div className="w-10 h-10 rounded-xl bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-gray-500 font-bold">
            {app.customerName?.charAt(0)}
          </div>
          <div>
            <p className="font-black text-gray-900 dark:text-white text-sm">{app.customerName}</p>
            <p className="text-xs text-gray-500 font-black uppercase tracking-widest">{app.vehicleInfo || 'Não especificado'}</p>
          </div>
        </div>
        <span className={`px-3 py-1 rounded-lg text-xs font-black uppercase tracking-widest border border-black/5 ${
          app.status === 'pending' ? 'bg-amber-100 text-amber-600' : 'bg-blue-100 text-blue-600'
        }`}>
          {app.status === 'pending' ? 'Novo' : 'Sugerido'}
        </span>
      </div>
      
      <div className="grid grid-cols-2 gap-2">
        <div className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-gray-800 rounded-xl border border-black/5">
          <Calendar className="w-4 h-4 text-indigo-500" />
          <span className="text-xs font-black text-gray-600 dark:text-gray-300">{formatDateSafe(app.date)}</span>
        </div>
        <div className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-gray-800 rounded-xl border border-black/5">
          <Clock className="w-4 h-4 text-indigo-500" />
          <span className="text-xs font-black text-gray-600 dark:text-gray-300">{app.time}</span>
        </div>
      </div>

      <div className="flex gap-3 pt-2">
        <button 
          onClick={() => onApprove(app)}
          className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-black uppercase tracking-widest py-3 rounded-2xl shadow-lg shadow-indigo-500/20 active:scale-95 transition-all"
        >
          <CheckCircle2 className="w-4 h-4 mx-auto" />
        </button>
        <button 
           onClick={() => onDelete(app.id, 'appointment')}
           className="p-3 text-rose-500 bg-white dark:bg-gray-900 border border-black/5 hover:bg-rose-50 rounded-2xl transition-all"
           title="Recusar"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </motion.div>
  );
}

function SortableReminder({ reminder, onDelete }: { reminder: any, onDelete: (id: string) => void }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ 
    id: reminder.id,
    data: {
      type: 'reminder',
      reminder: reminder
    }
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : 'auto',
    opacity: isDragging ? 0.3 : 1
  };

  return (
    <div 
      ref={setNodeRef} 
      style={style}
      className={`group relative bg-white dark:bg-gray-800 p-3 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm hover:shadow-md transition-all flex items-center gap-3 ${isDragging ? 'ring-2 ring-indigo-500' : ''}`}
    >
      <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing p-1 text-gray-300 hover:text-indigo-500 transition-colors">
        <GripVertical className="w-4 h-4" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[11px] font-black text-gray-900 dark:text-white truncate tracking-tight">{reminder.title}</p>
        <div className="flex items-center gap-1.5 mt-0.5">
          <Clock className="w-2.5 h-2.5 text-gray-400" />
          <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">{reminder.time || 'Sem hora'}</span>
        </div>
      </div>
      <button 
        onClick={() => onDelete(reminder.id)}
        className="opacity-0 group-hover:opacity-100 p-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg transition-all"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

function CalendarCell({ id, day, isCurrentMonth, isToday, reminders, onDelete }: any) {
  const { setNodeRef, isOver } = useSortable({ id });

  return (
    <div 
      ref={setNodeRef}
      className={`min-h-[160px] p-4 bg-white dark:bg-gray-800 transition-all border-none relative flex flex-col ${
        !isCurrentMonth ? 'opacity-20 pointer-events-none' : ''
      } ${isOver ? 'ring-4 ring-indigo-500/20 z-10' : ''}`}
    >
      <div className="flex justify-between items-center mb-4">
        <span className={`text-xs font-black tracking-tight ${
          isToday ? 'bg-indigo-600 text-white w-7 h-7 flex items-center justify-center rounded-lg shadow-lg shadow-indigo-200 dark:shadow-none' : 'text-gray-400'
        }`}>
          {format(day, 'd')}
        </span>
      </div>

      <div className="space-y-2 flex-1 relative">
        <SortableContext 
          items={reminders.map((r: any) => r.id)}
          strategy={verticalListSortingStrategy}
        >
          {reminders.map((r: any) => (
            <SortableReminder key={r.id} reminder={r} onDelete={onDelete} />
          ))}
        </SortableContext>
      </div>

      {isOver && (
        <div className="absolute inset-2 bg-indigo-500/5 rounded-2xl border-2 border-dashed border-indigo-500/30 pointer-events-none" />
      )}
    </div>
  );
}

function Sparkles({ className }: { className?: string }) {
  return (
    <svg className={className} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/>
      <path d="M5 3v4"/><path d="M19 17v4"/><path d="M3 5h4"/><path d="M17 19h4"/>
    </svg>
  );
}

// --- Main Component ---

export default function Schedule() {
  const { profile } = useAuth();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [reminders, setReminders] = useState<any[]>([]);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeItem, setActiveItem] = useState<any>(null);
  const [newReminder, setNewReminder] = useState({ 
    title: '', 
    date: format(new Date(), 'yyyy-MM-dd'),
    time: format(new Date(), 'HH:mm'),
    priority: 'medium'
  });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  useEffect(() => {
    if (!profile?.companyId) return;
    
    // Listen for reminders
    const qReminders = query(
      collection(db, 'reminders'), 
      where('companyId', '==', profile.companyId), 
      orderBy('date', 'asc')
    );
    
    const unsubReminders = onSnapshot(qReminders, (snapshot) => {
      setReminders(snapshot.docs.map(doc => ({ 
        id: doc.id, 
        ...doc.data(), 
        type: 'reminder' 
      })));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'reminders'));

    // Listen for appointments
    const qAppointments = query(
      collection(db, 'appointments'), 
      where('companyId', '==', profile.companyId), 
      orderBy('date', 'asc')
    );
    
    const unsubAppointments = onSnapshot(qAppointments, (snapshot) => {
      setAppointments(snapshot.docs.map(doc => ({ 
        id: doc.id, 
        ...doc.data(), 
        type: 'appointment' 
      })));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'appointments'));

    return () => {
      unsubReminders();
      unsubAppointments();
    };
  }, [profile]);

  const calendarDays = useMemo(() => {
    const start = startOfWeek(startOfMonth(currentDate));
    const end = endOfWeek(endOfMonth(currentDate));
    return eachDayOfInterval({ start, end });
  }, [currentDate]);

  const handleDragStart = (event: any) => {
    const { active } = event;
    setActiveId(active.id);
    setActiveItem(active.data.current);
  };

  const handleDragEnd = async (event: any) => {
    const { active, over } = event;
    setActiveId(null);
    setActiveItem(null);

    if (over && active.id !== over.id) {
       if (over.id.startsWith('day-')) {
         const newDateStr = over.id.replace('day-', '');
         
         if (active.data.current?.type === 'reminder') {
           try {
             await updateDoc(doc(db, 'reminders', active.id), {
               date: newDateStr,
               updatedAt: serverTimestamp()
             });
           } catch (error) {
             console.error("Reminder drag update error:", error);
           }
         } 
         else if (active.data.current?.type === 'appointment') {
           const app = active.data.current.app;
           try {
             await updateDoc(doc(db, 'appointments', app.id), { 
               status: 'approved', 
               date: newDateStr,
               updatedAt: serverTimestamp() 
             });
             
             await addDoc(collection(db, 'reminders'), {
               title: `🔧 ${app.customerName} (${app.vehicleInfo || 'Serviço'})`,
               date: newDateStr,
               time: app.time,
               companyId: profile?.companyId,
               appointmentId: app.id,
               createdAt: serverTimestamp()
             });
           } catch (error) {
             console.error("Appointment drag-approval error:", error);
           }
         }
       }
    }
  };

  const handleAddReminder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.companyId) return;
    try {
      await addDoc(collection(db, 'reminders'), { 
        ...newReminder, 
        companyId: profile.companyId, 
        createdAt: serverTimestamp() 
      });
      setIsModalOpen(false);
      setNewReminder({ 
        title: '', 
        date: format(new Date(), 'yyyy-MM-dd'),
        time: format(new Date(), 'HH:mm'),
        priority: 'medium'
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'reminders');
    }
  };

  const handleApproveAppointment = async (app: any) => {
    if (!confirm(`Aprovar agendamento para ${app.customerName}?`)) return;
    try {
      await updateDoc(doc(db, 'appointments', app.id), { 
        status: 'approved', 
        updatedAt: serverTimestamp() 
      });
      await addDoc(collection(db, 'reminders'), {
        title: `🔧 ${app.customerName} (${app.vehicleInfo || 'Serviço'})`,
        date: app.date,
        time: app.time,
        companyId: profile?.companyId,
        appointmentId: app.id,
        createdAt: serverTimestamp()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `appointments/${app.id}`);
    }
  };

  const handleDelete = async (id: string, type: string) => {
    if (!confirm("Excluir este item da agenda?")) return;
    try {
      await deleteDoc(doc(db, type === 'reminder' ? 'reminders' : 'appointments', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `${type}/${id}`);
    }
  };

  return (
    <>
      <div className="p-4 sm:p-8 space-y-10 bg-transparent min-h-screen transition-colors">
        <div className=" mx-auto space-y-10">
          
          {/* Modern Header */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2.5 bg-indigo-100 dark:bg-indigo-900/30 rounded-2xl">
                    <CalendarDays className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
                  </div>
                  <h1 className="text-4xl font-black text-gray-900 dark:text-white tracking-tight">Agenda Integrada</h1>
                </div>
                <p className="text-gray-500 dark:text-gray-400 font-medium tracking-tight">Central de agendamentos WhatsApp e operacionais</p>
              </div>

              <div className="flex items-center gap-3 bg-white dark:bg-gray-800 p-2 pl-4 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm">
                <div className="flex items-center gap-2">
                  <Settings className="w-3.5 h-3.5 text-gray-400" />
                  <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest whitespace-nowrap">Recorrência:</span>
                </div>
                <select 
                  value={profile?.maintenanceRecurrence || 180}
                  onChange={async (e) => {
                    if (!profile?.id) return;
                    try {
                      await updateDoc(doc(db, 'users', profile.id), {
                        maintenanceRecurrence: parseInt(e.target.value)
                      });
                    } catch (err) {
                      console.error("Error updating recurrence:", err);
                    }
                  }}
                  className="bg-transparent text-[10px] font-black text-indigo-600 focus:outline-none cursor-pointer pr-2"
                >
                  <option value={90}>3 meses</option>
                  <option value={180}>6 meses</option>
                  <option value={365}>1 ano</option>
                  <option value={730}>2 anos</option>
                </select>
              </div>
            </div>
            
            <div className="flex flex-wrap items-center gap-4">
              <div className="hidden md:flex bg-white dark:bg-gray-800 rounded-2xl p-1.5 shadow-sm border border-gray-100 dark:border-gray-700">
                 <button onClick={() => setCurrentDate(new Date())} className="px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-all">Hoje</button>
              </div>
              <button 
                onClick={() => setIsModalOpen(true)} 
                className="flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-4 rounded-[1.5rem] font-black transition-all shadow-xl shadow-indigo-500/20 active:scale-95 uppercase text-xs tracking-widest"
              >
                <Plus className="w-5 h-5" /> Novo Compromisso
              </button>
            </div>
          </div>
  
          <DndContext 
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-10">
              
              {/* Calendar View - Span 8 */}
              <div className="xl:col-span-8 space-y-8">
                <div className="bg-white dark:bg-gray-800 rounded-[3rem] p-8 shadow-2xl border border-gray-100 dark:border-gray-700 overflow-hidden relative">
                  <div className="flex justify-between items-center mb-10">
                    <div className="flex items-center gap-6">
                      <div className="flex gap-2">
                        <button onClick={() => setCurrentDate(subMonths(currentDate, 1))} className="p-3 bg-gray-50 dark:bg-gray-900/50 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-2xl transition-all"><ChevronLeft className="w-5 h-5 text-gray-500" /></button>
                        <button onClick={() => setCurrentDate(addMonths(currentDate, 1))} className="p-3 bg-gray-50 dark:bg-gray-900/50 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-2xl transition-all"><ChevronRight className="w-5 h-5 text-gray-500" /></button>
                      </div>
                      <h3 className="text-3xl font-black capitalize text-gray-900 dark:text-white tracking-tighter" style={{ minWidth: "150px" }}>
                        {format(currentDate, 'MMMM yyyy', { locale: ptBR })}
                      </h3>
                    </div>
                  </div>
  
                  <div className="grid grid-cols-7 gap-px bg-gray-100 dark:bg-gray-700 rounded-[3rem] overflow-hidden border-8 border-gray-100 dark:border-gray-700 shadow-2xl">
                    {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(day => (
                      <div key={day} className="bg-gray-50 dark:bg-gray-900/50 text-center py-8 text-sm uppercase font-black text-gray-400 tracking-[0.3em]">{day}</div>
                    ))}
                    {calendarDays.map((day, idx) => {
                      const dayStr = format(day, 'yyyy-MM-dd');
                      const dayReminders = reminders.filter(r => r.date === dayStr);
                      const isToday = isSameDay(day, new Date());
                      const isCurrentMonth = isSameMonth(day, currentDate);
  
                      return (
                        <CalendarCell 
                          key={idx}
                          id={`day-${dayStr}`}
                          day={day}
                          isCurrentMonth={isCurrentMonth}
                          isToday={isToday}
                          reminders={dayReminders}
                          onDelete={(id) => handleDelete(id, 'reminder')}
                        />
                      );
                    })}
                  </div>
                </div>
              </div>
  
              {/* Side Panel: WhatsApp Requests - Span 4 */}
              <div className="xl:col-span-4 space-y-8 relative">
                <section className="bg-white dark:bg-gray-800 rounded-[3rem] p-8 shadow-xl border border-gray-100 dark:border-gray-700 min-h-[600px] flex flex-col relative overflow-hidden">
                  {/* Elite Plan Lock */}
                  {profile?.plan !== 'elite' && profile?.role !== 'admin' && (
                    <div className="absolute inset-0 z-20 bg-white/60 dark:bg-gray-800/80 backdrop-blur-[2px] flex flex-col items-center justify-center p-8 text-center animate-in fade-in duration-500">
                      <div className="w-16 h-16 bg-amber-100 dark:bg-amber-900/30 rounded-2xl flex items-center justify-center mb-4">
                        <Crown className="w-8 h-8 text-amber-600" />
                      </div>
                      <h4 className="text-lg font-black text-gray-900 dark:text-white mb-2 uppercase tracking-tight">Agenda IA WhatsApp</h4>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mb-6 font-medium">
                        A integração automática de agendamentos via WhatsApp é exclusiva para o plano **Elite**.
                      </p>
                      <button 
                        onClick={() => window.location.href = '/app/subscription'}
                        className="px-6 py-3 bg-indigo-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 dark:shadow-none"
                      >
                        Fazer Upgrade
                      </button>
                    </div>
                  )}

                  <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-4">
                      <div className="p-3 bg-amber-50 dark:bg-amber-900/20 text-amber-600 rounded-2xl">
                        <Bell className="w-6 h-6" />
                      </div>
                      <div>
                        <h3 className="text-xl font-black text-gray-900 dark:text-white tracking-tight">WhatsApp Web</h3>
                        <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest">Aprovações Pendentes</p>
                      </div>
                    </div>
                    <span className="px-3 py-1 bg-amber-100 text-amber-600 rounded-full text-[10px] font-black uppercase tracking-widest animate-pulse">
                      {appointments.filter(a => a.status === 'pending').length} Novos
                    </span>
                  </div>
                  <div className="flex-1 space-y-4 overflow-y-auto pr-2 custom-scrollbar">
                    <SortableContext 
                      items={appointments.filter(a => a.status === 'pending' || a.status === 'suggested').map(a => a.id)}
                      strategy={verticalListSortingStrategy}
                    >
                      <AnimatePresence mode="popLayout">
                        {appointments.filter(a => a.status === 'pending' || a.status === 'suggested').map((app) => (
                          <DraggableAppointment 
                            key={app.id} 
                            app={app} 
                            onApprove={handleApproveAppointment}
                            onDelete={handleDelete}
                          />
                        ))}
                      </AnimatePresence>
                    </SortableContext>
  
                    {appointments.filter(a => a.status === 'pending' || a.status === 'suggested').length === 0 && (
                      <div className="text-center py-20 flex flex-col items-center">
                        <div className="w-20 h-20 bg-gray-50 dark:bg-gray-900 rounded-[2rem] flex items-center justify-center mb-6">
                          <Info className="w-10 h-10 text-gray-200" />
                        </div>
                        <p className="text-xs font-black text-gray-400 uppercase tracking-widest leading-relaxed">Fila de espera vazia.<br/>Foco total na produção!</p>
                      </div>
                    )}
                  </div>
  
                  <div className="mt-8 pt-6 border-t border-gray-100 dark:border-gray-800">
                    <div className="p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-2xl flex items-center gap-3">
                      <Sparkles className="w-5 h-5 text-indigo-500" />
                      <p className="text-[9px] font-bold text-indigo-700 dark:text-indigo-300 leading-relaxed uppercase tracking-tighter">
                        O robô está processando agendamentos. <br/>Mantenha o WhatsApp conectado!
                      </p>
                    </div>
                  </div>
                </section>
              </div>
            </div>
  
            <DragOverlay dropAnimation={{
              sideEffects: defaultDropAnimationSideEffects({
                styles: {
                  active: {
                    opacity: '0.4',
                  },
                },
              }),
            }}>
              {activeId ? (
                <div className={`p-4 rounded-2xl shadow-2xl border-2 border-indigo-500 bg-white dark:bg-gray-800 pointer-events-none ${activeItem?.type === 'appointment' ? 'w-80' : 'w-48'}`}>
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg">
                      <Calendar className="w-4 h-4 text-indigo-600" />
                    </div>
                    <div>
                      <p className="text-[11px] font-black text-gray-900 dark:text-white truncate">
                        {activeItem?.type === 'appointment' ? activeItem.app.customerName : (activeItem?.reminder?.title || reminders.find(r => r.id === activeId)?.title)}
                      </p>
                      <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">
                        {activeItem?.type === 'appointment' ? 'Agendamento WhatsApp' : 'Lembrete Interno'}
                      </p>
                    </div>
                  </div>
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>
        </div>
      </div>
  
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 backdrop-blur-md">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)} 
              className="absolute inset-0 bg-black/60" 
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 30 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 30 }}
              className="relative bg-white dark:bg-gray-800 rounded-[3rem] shadow-2xl w-full max-w-lg border border-gray-100 dark:border-gray-700 overflow-hidden"
            >
              <div className="p-10 border-b border-gray-50 dark:border-gray-700 flex justify-between items-center bg-gray-50/50 dark:bg-gray-900/20">
                <div>
                  <h3 className="text-3xl font-black text-gray-900 dark:text-white tracking-tight">Agendar Serviço</h3>
                  <p className="text-sm font-medium text-gray-400">Insira um novo compromisso interno</p>
                </div>
                <button onClick={() => setIsModalOpen(false)} className="p-3 rounded-full hover:bg-white dark:hover:bg-gray-700 transition-all text-gray-400">
                  <X className="w-8 h-8" />
                </button>
              </div>

              <form onSubmit={handleAddReminder} className="p-10 space-y-8">
                <div className="space-y-3">
                  <label className="text-xs font-black text-gray-400 uppercase tracking-widest ml-1">Descrição do Compromisso</label>
                  <input 
                    type="text" 
                    required 
                    placeholder="Ex: Entrega Corolla do Sr. João" 
                    value={newReminder.title} 
                    onChange={e => setNewReminder({...newReminder, title: e.target.value})} 
                    className="w-full p-6 bg-gray-50 dark:bg-gray-900 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 dark:text-white font-bold text-lg transition-all outline-none" 
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Data</label>
                    <input 
                      type="date" 
                      required 
                      value={newReminder.date} 
                      onChange={e => setNewReminder({...newReminder, date: e.target.value})} 
                      className="w-full p-6 bg-gray-50 dark:bg-gray-900 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 dark:text-white font-bold transition-all outline-none" 
                    />
                  </div>
                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Hora</label>
                    <input 
                      type="time" 
                      required 
                      value={newReminder.time} 
                      onChange={e => setNewReminder({...newReminder, time: e.target.value})} 
                      className="w-full p-6 bg-gray-50 dark:bg-gray-900 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 dark:text-white font-bold transition-all outline-none" 
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-6 pt-6">
                  <button type="button" onClick={() => setIsModalOpen(false)} className="text-xs font-black text-gray-400 uppercase tracking-widest hover:text-gray-600 transition-colors">Descartar</button>
                  <button type="submit" className="px-12 py-6 bg-indigo-600 text-white rounded-3xl font-black uppercase text-xs tracking-widest shadow-2xl shadow-indigo-500/30 hover:bg-indigo-700 active:scale-95 transition-all">Priorizar na Agenda</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
