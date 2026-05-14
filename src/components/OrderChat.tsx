import React, { useState, useEffect, useRef } from 'react';
import { Send, User, MessageCircle, Clock, CheckCheck } from 'lucide-react';
import { db } from '../firebase';
import { collection, query, where, orderBy, onSnapshot, addDoc, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '../AuthContext';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { motion, AnimatePresence } from 'framer-motion';

interface Message {
  id: string;
  text: string;
  senderId: string;
  senderName: string;
  senderRole: string;
  createdAt: any;
}

interface OrderChatProps {
  orderId: string;
  partnerName: string;
}

export default function OrderChat({ orderId, partnerName }: OrderChatProps) {
  const { profile } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!orderId) return;

    const q = query(
      collection(db, 'order_chats'),
      where('orderId', '==', orderId),
      orderBy('createdAt', 'asc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Message[];
      setMessages(data);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [orderId]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !profile) return;

    try {
      await addDoc(collection(db, 'order_chats'), {
        orderId,
        text: newMessage,
        senderId: profile.uid,
        senderName: profile.name,
        senderRole: profile.role,
        createdAt: serverTimestamp()
      });
      setNewMessage('');
    } catch (error) {
      console.error("Error sending message:", error);
    }
  };

  return (
    <div className="flex flex-col h-[500px] bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 overflow-hidden shadow-sm">
      {/* Header */}
      <div className="p-4 border-b border-gray-50 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/50 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-indigo-600 flex items-center justify-center text-white">
            <User className="h-5 w-5" />
          </div>
          <div>
            <h4 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-tight">{partnerName}</h4>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
              <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Chat em Tempo Real</span>
            </div>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar bg-gray-50/30 dark:bg-gray-900/30"
      >
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center space-y-3 opacity-50">
            <MessageCircle className="h-12 w-12 text-gray-300" />
            <p className="text-sm font-medium text-gray-500">Inicie uma conversa sobre este pedido.</p>
          </div>
        ) : (
          <AnimatePresence>
            {messages.map((msg) => {
              const isMe = msg.senderId === profile?.uid;
              return (
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  key={msg.id}
                  className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`max-w-[80%] flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                    <div className={`px-4 py-2.5 rounded-2xl text-sm font-medium shadow-sm transition-all ${
                      isMe 
                        ? 'bg-indigo-600 text-white rounded-tr-none' 
                        : 'bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 border border-gray-100 dark:border-gray-700 rounded-tl-none'
                    }`}>
                      {msg.text}
                    </div>
                    <div className="flex items-center gap-1.5 mt-1 px-1">
                      <span className="text-[9px] font-black uppercase tracking-widest text-gray-400">
                        {msg.createdAt?.toDate?.() ? format(msg.createdAt.toDate(), 'HH:mm') : '...'}
                      </span>
                      {isMe && <CheckCheck className="h-3 w-3 text-indigo-400" />}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        )}
      </div>

      {/* Input */}
      <form onSubmit={handleSendMessage} className="p-4 bg-white dark:bg-gray-800 border-t border-gray-50 dark:border-gray-700">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Digite sua mensagem..."
            className="flex-1 bg-gray-50 dark:bg-gray-900 border-none rounded-xl px-4 py-2.5 text-sm font-medium focus:ring-2 focus:ring-indigo-500 outline-none placeholder:text-gray-400"
          />
          <button
            type="submit"
            disabled={!newMessage.trim()}
            className="p-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl transition-all shadow-lg shadow-indigo-200 dark:shadow-none disabled:opacity-50 disabled:translate-y-0 hover:-translate-y-0.5"
          >
            <Send className="h-5 w-5" />
          </button>
        </div>
      </form>
    </div>
  );
}
