import React, { useState, useEffect } from 'react';
import { collection, query, where, orderBy, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../AuthContext';
import { Bell, CheckCircle, Info, AlertTriangle, XCircle } from 'lucide-react';

interface AppNotification {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  read: boolean;
  createdAt: any;
  senderId?: string;
  groupingKey?: string;
}

export default function Notifications() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, 'notifications'),
      where('companyId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const notifs: AppNotification[] = [];
      snapshot.forEach((doc) => {
        notifs.push({ id: doc.id, ...doc.data() } as AppNotification);
      });
      setNotifications(notifs);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching notifications:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  const groupNotifications = (notifs: AppNotification[]) => {
    const unread = notifs.filter(n => !n.read);
    const read = notifs.filter(n => n.read);
    
    const groups: { [key: string]: AppNotification[] } = {};
    const ungroupedUnread: AppNotification[] = [];

    unread.forEach(n => {
      if (n.groupingKey && n.senderId) {
        const key = `${n.groupingKey}_${n.senderId}`;
        if (!groups[key]) groups[key] = [];
        groups[key].push(n);
      } else {
        ungroupedUnread.push(n);
      }
    });

    const groupedUnread = Object.keys(groups).map(key => {
      const items = groups[key];
      if (items.length === 1) return items[0];
      
      // Create a virtual grouped notification
      return {
        id: `group_${key}`,
        title: `${items.length} ${items[0].title}`,
        message: `${items[0].message} (e outras ${items.length - 1} interações)`,
        type: items[0].type,
        read: false,
        createdAt: items[0].createdAt,
        isGroup: true,
        ids: items.map(i => i.id)
      } as any;
    });

    return [...groupedUnread, ...ungroupedUnread, ...read].sort((a, b) => {
      if (a.read !== b.read) return a.read ? 1 : -1;
      const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt);
      const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt);
      return dateB.getTime() - dateA.getTime();
    });
  };

  const markAsRead = async (id: string, ids?: string[]) => {
    try {
      if (ids && ids.length > 0) {
        for (const targetId of ids) {
          await updateDoc(doc(db, 'notifications', targetId), { read: true });
        }
      } else {
        await updateDoc(doc(db, 'notifications', id), {
          read: true
        });
      }
    } catch (error) {
      console.error("Error marking notification as read:", error);
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'success': return <CheckCircle className="h-6 w-6 text-green-500 transition-all" />;
      case 'warning': return <AlertTriangle className="h-6 w-6 text-amber-500 transition-all" />;
      case 'error': return <XCircle className="h-6 w-6 text-red-500 transition-all" />;
      default: return <Info className="h-6 w-6 text-indigo-500 transition-all" />;
    }
  };

  if (loading) {
    return (
      <div className="p-6 flex justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  const processedNotifications = groupNotifications(notifications);

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto min-h-screen">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-4xl font-black text-gray-900 dark:text-white flex items-center tracking-tight">
            <Bell className="h-10 w-10 mr-4 text-indigo-600 dark:text-indigo-400" />
            Notificações
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-2 font-medium">Acompanhe as interações e alertas do seu negócio</p>
        </div>
      </div>

      {processedNotifications.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-[2.5rem] shadow-xl p-16 text-center border border-gray-100 dark:border-gray-700">
          <div className="w-24 h-24 bg-gray-50 dark:bg-gray-900 rounded-full flex items-center justify-center mx-auto mb-8">
            <Bell className="h-12 w-12 text-gray-300 dark:text-gray-600" />
          </div>
          <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Tudo em dia!</h3>
          <p className="text-gray-500 dark:text-gray-400 max-w-xs mx-auto text-lg leading-relaxed">Você não tem nenhuma notificação nova no momento.</p>
        </div>
      ) : (
        <div className="grid gap-6">
          {processedNotifications.map((notification) => (
            <div 
              key={notification.id} 
              className={`group overflow-hidden relative bg-white dark:bg-gray-800 rounded-[2rem] shadow-sm hover:shadow-xl transition-all duration-500 border-2 ${
                notification.read 
                  ? 'border-transparent opacity-60 grayscale-[0.5]' 
                  : (notification as any).isGroup 
                    ? 'border-indigo-400 bg-indigo-50/10 dark:bg-indigo-900/10'
                    : 'border-white dark:border-gray-700'
                }`}
            >
              <div className="p-6 md:p-8 flex items-start gap-6">
                <div className={`p-4 rounded-3xl ${
                  notification.read ? 'bg-gray-100 dark:bg-gray-700' : 'bg-gray-50 dark:bg-gray-900 shadow-inner'
                }`}>
                  {getIcon(notification.type)}
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-4 mb-2">
                    <div className="flex items-center gap-3">
                      <h3 className={`text-xl font-bold truncate ${notification.read ? 'text-gray-600 dark:text-gray-400' : 'text-gray-900 dark:text-white'}`}>
                        {notification.title}
                      </h3>
                      {(notification as any).isGroup && (
                        <span className="bg-indigo-600 text-white text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-tighter">
                          Grupo
                        </span>
                      )}
                    </div>
                    <span className="text-xs font-bold text-gray-400 dark:text-gray-500 whitespace-nowrap bg-gray-50 dark:bg-gray-900 px-3 py-1.5 rounded-full">
                      {notification.createdAt?.toDate ? new Intl.DateTimeFormat('pt-BR', {
                        day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
                      }).format(notification.createdAt.toDate()) : 'Agora'}
                    </span>
                  </div>
                  
                  <p className={`text-base leading-relaxed mb-6 ${notification.read ? 'text-gray-500 dark:text-gray-500' : 'text-gray-600 dark:text-gray-300'}`}>
                    {notification.message}
                  </p>

                  {!notification.read && (
                    <button 
                      onClick={() => markAsRead(notification.id, (notification as any).ids)}
                      className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-2xl transition-all shadow-lg shadow-indigo-500/20 active:scale-95"
                    >
                      { (notification as any).isGroup ? 'Marcar todos como lidos' : 'Marcar como lida' }
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
