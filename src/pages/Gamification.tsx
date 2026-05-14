import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Trophy, 
  Target, 
  Zap, 
  Star, 
  ChevronRight, 
  Medal, 
  TrendingUp, 
  Users,
  Award,
  Crown,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { useAuth } from '../AuthContext';
import { db } from '../firebase';
import { collection, query, where, orderBy, limit, onSnapshot, doc, getDoc } from 'firebase/firestore';

const ACHIEVEMENTS = [
  { id: 'first_os', title: 'Primeira de Muitas', description: 'Concluiu sua primeira Ordem de Serviço', icon: CheckCircle2, color: 'emerald' },
  { id: 'ten_os', title: 'Mestre do Reparo', description: 'Completou 10 Ordens de Serviço', icon: Trophy, color: 'amber' },
  { id: 'fast_fix', title: 'Relâmpago', description: 'Resolveu uma OS em menos de 2 horas', icon: Zap, color: 'blue' },
  { id: 'five_stars', title: 'Excelência Pura', description: 'Recebeu 5 estrelas em uma avaliação', icon: Star, color: 'purple' },
  { id: 'perfect_month', title: 'Mês Imbatível', description: 'Bateu a meta mensal antes do dia 20', icon: Crown, color: 'rose' }
];

export default function Gamification() {
  const { profile } = useAuth();
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ osCount: 0, conversion: 0, rating: 0 });

  useEffect(() => {
    const companyId = profile?.companyId;
    if (!companyId || !profile?.id) return;

    // Fetch user stats
    const qUserWO = query(
      collection(db, 'work_orders'),
      where('companyId', '==', companyId),
      where('employeeId', '==', profile.id)
    );

    const unsubscribeStats = onSnapshot(qUserWO, (snapshot) => {
      const WOs = snapshot.docs.map(d => d.data());
      const completed = WOs.filter((wo: any) => wo.status === 'completed' || wo.status === 'finalizado').length;
      const conversion = WOs.length > 0 ? (completed / WOs.length) * 100 : 0;
      
      // Calculate rating if available in WO or just use a default high value for now
      const totalRating = WOs.reduce((acc, wo: any) => acc + (wo.rating || 5), 0);
      const avgRating = WOs.length > 0 ? totalRating / WOs.length : 5.0;

      setStats({
        osCount: WOs.length,
        conversion: conversion,
        rating: avgRating
      });
    });

    return () => unsubscribeStats();
  }, [profile?.id, profile?.companyId]);

  useEffect(() => {
    if (!profile?.companyId) return;

    // Leaderboard of employees/owners in the same company
    const q = query(
      collection(db, 'users'),
      where('companyId', '==', profile.companyId),
      orderBy('points', 'desc'),
      limit(10)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const usersData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setLeaderboard(usersData);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [profile?.companyId]);

  const getProgressToNextLevel = () => {
    const currentPoints = profile?.points || 0;
    const currentLevel = profile?.level || 1;
    const pointsForNextLevel = currentLevel * 1000;
    const progress = (currentPoints % 1000) / 10; // Simple level logic: 1000 pts per level
    return Math.min(progress, 100);
  };

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-12">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-4xl font-black text-gray-900 dark:text-white tracking-tight uppercase">
            Gamificação <span className="text-indigo-600 dark:text-indigo-400">& Equipe</span>
          </h1>
          <p className="mt-2 text-gray-500 dark:text-gray-400 font-medium">
            Transforme produtividade em conquistas e lidere o ranking da oficina.
          </p>
        </div>
        
        <div className="flex items-center gap-4 bg-white dark:bg-gray-800 p-2 rounded-3xl shadow-xl border border-gray-100 dark:border-gray-700">
          <div className="flex items-center gap-3 px-6 py-3 bg-indigo-600 rounded-2xl text-white shadow-lg shadow-indigo-200 dark:shadow-none">
            <Trophy className="h-6 w-6" />
            <div className="text-left">
              <p className="text-[10px] font-black uppercase opacity-80 leading-none">Nível</p>
              <p className="text-xl font-black leading-none">{profile?.level || 1}</p>
            </div>
          </div>
          <div className="pr-6">
            <p className="text-[10px] font-black uppercase text-gray-400 leading-none mb-1">Total de Pontos</p>
            <p className="text-xl font-black text-gray-900 dark:text-white leading-none">
              {(profile?.points || 0).toLocaleString()} <span className="text-xs text-indigo-500 italic">XP</span>
            </p>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Progress Card */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="lg:col-span-2 space-y-8"
        >
          <div className="bg-white dark:bg-gray-800 p-8 rounded-[3rem] shadow-xl border border-gray-100 dark:border-gray-700 relative overflow-hidden">
            <div className="absolute -right-20 -top-20 w-64 h-64 bg-indigo-50 dark:bg-indigo-900/10 rounded-full blur-3xl"></div>
            
            <div className="relative z-10 space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-2xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                    <Medal className="h-8 w-8 text-amber-600" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-black text-gray-900 dark:text-white uppercase tracking-tighter">Próximo Nível</h3>
                    <p className="text-gray-500 font-medium">Continue concluindo OS para subir no ranking.</p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-sm font-black text-gray-400 uppercase tracking-widest">Progresso</span>
                  <p className="text-2xl font-black text-indigo-600">{Math.round(getProgressToNextLevel())}%</p>
                </div>
              </div>

              <div className="h-4 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${getProgressToNextLevel()}%` }}
                  className="h-full bg-gradient-to-r from-indigo-600 to-purple-600"
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="p-4 bg-gray-50 dark:bg-gray-900/50 rounded-3xl border border-gray-100 dark:border-gray-800">
                  <div className="flex items-center gap-2 text-indigo-600 mb-1">
                    <CheckCircle2 className="h-4 w-4" />
                    <span className="text-[10px] font-black uppercase">OS Feitas</span>
                  </div>
                  <p className="text-xl font-black">{stats.osCount}</p>
                </div>
                <div className="p-4 bg-gray-50 dark:bg-gray-900/50 rounded-3xl border border-gray-100 dark:border-gray-800">
                  <div className="flex items-center gap-2 text-emerald-600 mb-1">
                    <TrendingUp className="h-4 w-4" />
                    <span className="text-[10px] font-black uppercase">Taxa de Conversão</span>
                  </div>
                  <p className="text-xl font-black">{stats.conversion.toFixed(0)}%</p>
                </div>
                <div className="p-4 bg-gray-50 dark:bg-gray-900/50 rounded-3xl border border-gray-100 dark:border-gray-800">
                  <div className="flex items-center gap-2 text-amber-600 mb-1">
                    <Star className="h-4 w-4" />
                    <span className="text-[10px] font-black uppercase">Média Estrelas</span>
                  </div>
                  <p className="text-xl font-black">{stats.rating.toFixed(1)}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Achievements Grid */}
          <div className="space-y-4">
            <h3 className="text-xl font-black text-gray-900 dark:text-white uppercase tracking-tighter flex items-center gap-2">
              <Award className="h-6 w-6 text-indigo-600" />
              Minhas Conquistas
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {ACHIEVEMENTS.map((ach) => {
                const Icon = ach.icon;
                const isUnlocked = profile?.achievements?.includes(ach.id);
                return (
                  <div 
                    key={ach.id}
                    className={`p-6 rounded-[2rem] border transition-all ${
                      isUnlocked 
                        ? 'bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700 shadow-md' 
                        : 'bg-gray-50/50 dark:bg-gray-900/50 border-dashed border-gray-200 dark:border-gray-800 opacity-60 grayscale'
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${
                        isUnlocked ? `bg-${ach.color}-100 dark:bg-${ach.color}-900/30 text-${ach.color}-600` : 'bg-gray-200 dark:bg-gray-700 text-gray-400'
                      }`}>
                        <Icon className="h-7 w-7" />
                      </div>
                      <div>
                        <h4 className="font-bold text-gray-900 dark:text-white">{ach.title}</h4>
                        <p className="text-xs text-gray-500">{ach.description}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </motion.div>

        {/* Leaderboard Card */}
        <motion.div 
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="space-y-4"
        >
          <div className="bg-white dark:bg-gray-800 rounded-[3rem] shadow-xl border border-gray-100 dark:border-gray-700 overflow-hidden">
            <div className="p-8 bg-indigo-600 text-white">
              <h3 className="text-xl font-black uppercase tracking-tighter flex items-center gap-2">
                <Users className="h-6 w-6" />
                Destaques da Equipe
              </h3>
              <p className="text-indigo-100 text-xs mt-1">Ranking atualizado em tempo real.</p>
            </div>
            
            <div className="p-4 space-y-2">
              {leaderboard.map((user, idx) => (
                <div 
                  key={user.id}
                  className={`flex items-center justify-between p-4 rounded-2xl transition-all ${
                    user.id === profile?.id ? 'bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800' : 'hover:bg-gray-50 dark:hover:bg-gray-900/50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`h-8 w-8 rounded-full flex items-center justify-center font-black text-xs ${
                      idx === 0 ? 'bg-amber-100 text-amber-600' :
                      idx === 1 ? 'bg-gray-100 text-gray-600' :
                      idx === 2 ? 'bg-orange-100 text-orange-600' :
                      'bg-gray-50 text-gray-400'
                    }`}>
                      {idx + 1}
                    </div>
                    <div className="h-10 w-10 rounded-xl bg-gray-100 dark:bg-gray-700 overflow-hidden">
                      {user.photoURL ? (
                        <img src={user.photoURL} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <div className="h-full w-full flex items-center justify-center text-gray-400 uppercase font-bold text-xs">
                          {user.name?.[0] || user.email?.[0]}
                        </div>
                      )}
                    </div>
                    <div>
                      <p className="font-bold text-sm text-gray-900 dark:text-white truncate max-w-[120px]">
                        {user.name || user.displayName || user.email.split('@')[0]}
                      </p>
                      <p className="text-[10px] text-gray-500 uppercase font-black">Nível {user.level || 1}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-black text-indigo-600 dark:text-indigo-400">{(user.points || 0).toLocaleString()}</p>
                    <p className="text-[10px] text-gray-400 uppercase font-black tracking-widest">XP</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="p-6 bg-gray-50 dark:bg-gray-900/50 border-t border-gray-100 dark:border-gray-800">
              <button className="w-full py-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl text-[10px] font-black uppercase tracking-widest text-gray-500 hover:text-indigo-600 hover:border-indigo-200 transition-all">
                Ver Ranking Global
              </button>
            </div>
          </div>

          <div className="p-6 bg-gradient-to-br from-indigo-600 to-purple-700 rounded-[2.5rem] shadow-xl text-white relative overflow-hidden">
             <Star className="absolute -right-4 -bottom-4 w-32 h-32 opacity-10 rotate-12" />
             <h4 className="text-lg font-black uppercase tracking-tighter mb-2 italic">Atingiu a Meta?</h4>
             <p className="text-sm text-indigo-100 mb-4 opacity-90">Bater a meta mensal garante bônus de 500 XP para toda a equipe!</p>
             <button className="px-6 py-2.5 bg-white/20 backdrop-blur-md rounded-xl text-xs font-bold hover:bg-white/30 transition-all">
               Ver Desafios
             </button>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
