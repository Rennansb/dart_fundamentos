import React, { useState, useEffect, useRef } from 'react';
import { MessageCircle, X, Send, ChevronRight, HelpCircle, CreditCard, Lightbulb, MessageSquare, Sparkles, Brain, ArrowRight, Wrench, Package, TrendingUp, Zap, Award, LogOut } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../AuthContext';
import { db } from '../firebase';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  addDoc, 
  serverTimestamp, 
  orderBy, 
  doc, 
  updateDoc, 
  deleteDoc,
  getDocs,
  getDoc,
  limit
} from 'firebase/firestore';

const THEMES = [
  { id: 'tech', label: 'Dúvida Técnica', icon: HelpCircle, color: 'text-blue-500' },
  { id: 'billing', label: 'Problema no Pagamento', icon: CreditCard, color: 'text-emerald-500' },
  { id: 'suggest', label: 'Sugestão', icon: Lightbulb, color: 'text-amber-500' },
  { id: 'other', label: 'Outros', icon: MessageSquare, color: 'text-purple-500' },
];

export default function FloatingChat() {
  const { user, profile } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [hasStartedSalesSequence, setHasStartedSalesSequence] = useState(false);
  const [selectedTheme, setSelectedTheme] = useState<string | null>(null);
  const [customTheme, setCustomTheme] = useState('');
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [message, setMessage] = useState('');
  const [activeChat, setActiveChat] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [isResolving, setIsResolving] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [visitorMessages, setVisitorMessages] = useState<any[]>([]);
  const [activeFlow, setActiveFlow] = useState<'selection' | 'shop' | 'supplier'>('selection');
  const [flowStep, setFlowStep] = useState(0);
  const [isStarting, setIsStarting] = useState(false);
  const [isAiThinking, setIsAiThinking] = useState(false);

  // Se estiver na Landing Page, forçamos o modo Assistente de Ferramenta (público)
  const isLandingPage = window.location.pathname === '/' || window.location.pathname === '/index.html';
  const isVisitor = !user || isLandingPage;

  // 1. Snapshot for Active Chat
  useEffect(() => {
    const allowedRoles = ['shop', 'supplier', 'fornecedor', 'admin'];
    if (!profile || !allowedRoles.includes(profile.role) || isClosing) {
      if (!isClosing) {
        setActiveChat(null);
        setSelectedTheme(null);
      }
      return;
    }

    const qCount = query(
      collection(db, 'internal_chats'),
      where('userId', '==', profile.uid || profile.id),
      where('status', '==', 'open'),
      limit(1)
    );

    const unsubscribe = onSnapshot(qCount, (snapshot) => {
      if (isClosing || isStarting) return;
      
      if (!snapshot.empty) {
        const chatDoc = snapshot.docs[0];
        const data = chatDoc.data();
        
        // Guard against recently closed chats still in cache
        const lastClosedId = sessionStorage.getItem('last_closed_chat_id');
        if (lastClosedId === chatDoc.id || data.status === 'closed') {
          setActiveChat(null);
          setSelectedTheme(null);
          return;
        }

        setActiveChat({ id: chatDoc.id, ...data });
        setSelectedTheme(data.theme);
      } else {
        if (!isClosing && !isStarting) {
          setActiveChat(null);
          setSelectedTheme(null);
          setMessages([]);
          setIsResolving(false);
        }
      }
    });

    return () => unsubscribe();
  }, [profile, isClosing, isStarting]);

  // 2. Snapshot for Messages
  useEffect(() => {
    if (activeChat && isOpen && !isClosing) {
      const qMsgs = query(
        collection(db, 'internal_chats', activeChat.id, 'messages'),
        orderBy('createdAt', 'asc')
      );

      const unsubscribe = onSnapshot(qMsgs, (snapshot) => {
        if (isClosing) return;
        const msgs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setMessages(msgs);
        
        // Auto-detect admin/AI reply for Resolution flow
        if (msgs.length > 0) {
          const lastMsg: any = msgs[msgs.length - 1];
          const isExternal = lastMsg.senderRole === 'admin' || lastMsg.senderRole === 'ai';
          if (isExternal) {
            setIsResolving(true);
          }
        }

        if (isOpen && activeChat.unreadCountUser > 0) {
          updateDoc(doc(db, 'internal_chats', activeChat.id), { unreadCountUser: 0 });
        }
      });

      return () => unsubscribe();
    }
  }, [activeChat, isOpen, isClosing]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, visitorMessages]);

  // Visitor Flow Logic
  useEffect(() => {
    if (isVisitor && isOpen && !hasStartedSalesSequence) {
      setHasStartedSalesSequence(true);
      const sequence = [
        { content: "Olá! Sou o Assistente Virtual do Service Hub. 🛠️", delay: 500 },
        { content: "Estou aqui para tirar suas dúvidas sobre a plataforma e ajudar você a otimizar sua oficina ou fornecedora de peças. Como posso auxiliar hoje?", delay: 2000 }
      ];
      sequence.forEach((msg, index) => {
        setTimeout(() => {
          setVisitorMessages(prev => [...prev, {
            id: `v-init-${index}`,
            content: msg.content,
            senderRole: 'ai',
            createdAt: new Date()
          }]);
        }, msg.delay);
      });
    }
  }, [isVisitor, isOpen, hasStartedSalesSequence]);

  const handleFlowAction = (role: 'shop' | 'supplier') => {
    setActiveFlow(role);
    setFlowStep(1);
    const steps = role === 'shop' ? [
      { content: "Com o Service Hub, você centraliza orçamentos, estoque e financeiro em um só lugar. Sabia que nosso Kanban inteligente ajuda a reduzir o tempo de veículo parado em 30%?", delay: 500 },
      { content: "Além disso, você conta com o Agente de Vendas WhatsApp que atende seus clientes automaticamente e faz agendamentos 24/7.", delay: 3500 },
      { content: "Qual área da sua oficina você gostaria de melhorar primeiro?", delay: 7000 }
    ] : [
      { content: "Para fornecedores, o Service Hub oferece integração direta com catálogos de oficinas locais, gerando pedidos automáticos baseados na demanda real. 📦⚡", delay: 500 },
      { content: "Você terá acesso a um painel de oportunidades para ver o que as oficinas da sua região estão buscando no momento. Vamos expandir suas vendas?", delay: 3500 }
    ];

    steps.forEach((s, idx) => {
      setTimeout(() => {
        setVisitorMessages(prev => [...prev, {
          id: `v-flow-${role}-${idx}`,
          content: s.content,
          senderRole: 'ai',
          createdAt: new Date()
        }]);
        setFlowStep(idx + 1);
      }, s.delay);
    });
  };

  const handleStartChat = async (themeLabel: string) => {
    if (!profile) return;
    if (themeLabel === 'Outros' && !showCustomInput) {
      setShowCustomInput(true);
      return;
    }
    const finalTheme = showCustomInput ? customTheme : themeLabel;
    if (showCustomInput && !customTheme.trim()) return;

    // Optimistic UI: Set states immediately before heavy Firestore calls
    setSelectedTheme(finalTheme);
    setIsResolving(false);
    setIsStarting(true);
    setLoading(true);

    try {
      // Clear legacy chats in background
      const q = query(collection(db, 'internal_chats'), 
        where('userId', '==', profile.uid || profile.id), 
        where('status', '==', 'open')
      );
      getDocs(q).then(snap => {
        snap.docs.forEach(d => deleteDoc(doc(db, 'internal_chats', d.id)));
      });

      const newChatData = {
        userId: profile.uid || profile.id,
        userName: profile.name || (profile as any).shopName || 'Usuário',
        role: profile.role,
        theme: finalTheme,
        status: 'open',
        lastMessage: 'Iniciando atendimento...',
        lastMessageAt: serverTimestamp(),
        unreadCountAdmin: 0,
        unreadCountUser: 0,
        createdAt: serverTimestamp()
      };

      const docRef = await addDoc(collection(db, 'internal_chats'), newChatData);
      setActiveChat({ id: docRef.id, ...newChatData });
      setShowCustomInput(false);
      setCustomTheme('');
    } catch (e) {
      console.error("Chat Start Error:", e);
      // Rollback on error
      setSelectedTheme(null);
    } finally {
      setLoading(false);
      setTimeout(() => setIsStarting(false), 3000);
    }
  };

  const VISITOR_SUGGESTIONS = [
    { label: "Quais os planos? 💎", value: "Quais são os planos e preços?" },
    { label: "Como funciona o Kanban? 🛠️", value: "Como o Kanban reduz o tempo parado?" },
    { label: "Agente WhatsApp? 📱", value: "Como funciona o Agente de Vendas WhatsApp?" },
    { label: "Sou Fornecedor 📦", value: "Quais as vantagens para fornecedores?" }
  ];

  const handleSendMessage = async (e: React.FormEvent, overrideText?: string) => {
    if (e) e.preventDefault();
    const content = (overrideText || message).trim();
    if (!content || isAiThinking) return;

    setMessage('');
    setIsAiThinking(true);
    setHasStartedSalesSequence(true); 

    if (isVisitor) {
      const userMsg = { id: `v-user-${Date.now()}`, content, senderRole: 'user', createdAt: new Date() };
      setVisitorMessages(prev => [...prev, userMsg]);

      try {
        const history = visitorMessages.map(m => ({
          role: m.senderRole === 'user' ? 'user' : 'assistant',
          content: m.content
        }));

        const response = await fetch('/api/ai/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: content, history })
        });
        
        if (!response.ok) throw new Error('Falha na resposta da IA');
        const data = await response.json();
        
        if (data.response) {
          setVisitorMessages(prev => [...prev, {
            id: `v-ai-${Date.now()}`,
            content: data.response,
            senderRole: 'ai',
            createdAt: new Date()
          }]);
        }
      } catch (err: any) {
        console.error("Visitor Chat Error:", err);
        setVisitorMessages(prev => [...prev, {
          id: `v-error-${Date.now()}`,
          content: "⚠️ Não consegui processar sua pergunta agora. Vamos tentar de novo?",
          senderRole: 'ai',
          createdAt: new Date()
        }]);
      } finally {
        setIsAiThinking(false);
      }
      return;
    }

    // Authenticated User Logic
    if (!activeChat || !profile) {
      setIsAiThinking(false);
      return;
    }

    try {
      await addDoc(collection(db, 'internal_chats', activeChat.id, 'messages'), {
        content,
        senderId: profile.uid || profile.id,
        senderRole: profile.role,
        createdAt: serverTimestamp()
      });

      const role = profile.role === 'admin' ? 'ADMIN' : 'STORE';
      const endpoint = profile.role === 'admin' ? '/api/ai/sales' : '/api/ai/assistant';

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: content,
          role: role,
          history: messages.slice(-5).map(m => ({
            role: m.senderId === (profile.uid || profile.id) ? 'user' : 'assistant',
            content: m.content
          }))
        })
      });

      const data = await response.json();
      if (data.response) {
        await addDoc(collection(db, 'internal_chats', activeChat.id, 'messages'), {
          content: data.response,
          senderId: 'ai',
          senderRole: 'ai',
          createdAt: serverTimestamp()
        });
      }

      await updateDoc(doc(db, 'internal_chats', activeChat.id), {
        lastMessage: content,
        lastMessageAt: serverTimestamp(),
        unreadCountAdmin: profile.role !== 'admin' ? (activeChat.unreadCountAdmin || 0) + 1 : activeChat.unreadCountAdmin
      });
    } catch (err) {
      console.error("Error sending message:", err);
    } finally {
      setIsAiThinking(false);
    }
  };

  const handleEndChat = async () => {
    const chatId = activeChat?.id;
    
    try {
      setIsClosing(true);
      setLoading(true);
      
      if (chatId) sessionStorage.setItem('last_closed_chat_id', chatId);

      // Immediate Local UI Reset: Hard reset all buffers to ensure Clean Slate
      setActiveChat(null);
      setSelectedTheme(null);
      setMessages([]);
      setVisitorMessages([]);
      setIsResolving(false);
      setMessage('');
      setIsAiThinking(false);
      setHasStartedSalesSequence(false);
      setActiveFlow('selection');
      setFlowStep(0);

      if (isVisitor) {
        setIsClosing(false);
        setLoading(false);
        return;
      }

      // DB Purge: Aggressive Multi-ID Search to ensure NO ghost chats at all
      const userIds = [profile?.uid, profile?.id, profile?.companyId].filter(Boolean);
      for (const idToPurge of userIds) {
        const q = query(collection(db, 'internal_chats'), where('userId', '==', idToPurge), where('status', '==', 'open'));
        const snap = await getDocs(q);
        const tasks = snap.docs.map(async (d) => {
          await updateDoc(doc(db, 'internal_chats', d.id), { status: 'closed' });
          await deleteDoc(doc(db, 'internal_chats', d.id));
        });
        await Promise.all(tasks);
      }

      setIsOpen(true); // Keep open to show themes selection for NEW chat
    } catch (e) {
      console.error("End Chat Error:", e);
    } finally {
      setLoading(false);
      setTimeout(() => {
        setIsClosing(false);
        if (chatId) sessionStorage.removeItem('last_closed_chat_id');
      }, 3000); 
    }
  };

  // Se não estiver logado e não estiver na landing page, não exibe nada (ex: pgs públicas de orçamento)
  if (!user && !isLandingPage) return null;
  
  // Se estiver logado no app (não landing page), verifica se é autorizado a ver suporte
  if (user && !isLandingPage) {
    const isAuthorizedAppUser = profile && ['shop', 'supplier', 'fornecedor', 'admin', 'manager', 'employee'].includes(profile.role);
    if (!isAuthorizedAppUser) return null;
  }

  return (
    <div className="fixed bottom-6 right-6 z-[999]">
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="absolute bottom-20 right-0 w-[min(420px,90vw)] h-[min(650px,85vh)] bg-white dark:bg-gray-900 rounded-[2.5rem] shadow-2xl border border-indigo-50 dark:border-gray-800 overflow-hidden flex flex-col"
          >
            <div className="p-7 bg-gradient-to-br from-indigo-600 to-indigo-800 text-white flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-white/20 rounded-2xl backdrop-blur-md">
                  {isVisitor ? <Sparkles className="w-6 h-6" /> : <MessageSquare className="w-6 h-6" />}
                </div>
                <div>
                  <h3 className="font-black text-xl tracking-tight">{isVisitor ? 'Assistente Hub' : 'Suporte Hub'}</h3>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse shadow-[0_0_8px_rgba(74,222,128,0.5)]" />
                    <span className="text-[10px] text-indigo-100 font-black uppercase tracking-widest opacity-80">Online agora</span>
                  </div>
                </div>
              </div>
              <button onClick={() => setIsOpen(false)} className="p-2 hover:bg-white/10 rounded-2xl transition-all active:scale-90"><X className="w-6 h-6" /></button>
            </div>

            <div className="flex-1 overflow-y-auto p-7 space-y-6 scrollbar-none">
              {isVisitor ? (
                <div className="space-y-6">
                  {visitorMessages.map((msg) => {
                    const isAi = msg.senderRole === 'ai';
                    return (
                      <motion.div 
                        initial={{ opacity: 0, x: isAi ? -20 : 20 }} 
                        animate={{ opacity: 1, x: 0 }} 
                        key={msg.id} 
                        className={`flex ${isAi ? 'justify-start' : 'justify-end'} items-end gap-2`}
                      >
                        {isAi && (
                          <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center border border-indigo-200 dark:border-indigo-800 shrink-0 shadow-sm mb-1">
                            <Sparkles className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                          </div>
                        )}
                        <div className={`max-w-[75%] p-4 rounded-3xl text-sm leading-relaxed whitespace-pre-line font-medium shadow-sm transition-all
                          ${isAi 
                            ? 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 rounded-bl-none border border-gray-100 dark:border-gray-700' 
                            : 'bg-indigo-600 text-white rounded-br-none shadow-indigo-500/10'
                          }`}
                        >
                          {msg.content}
                        </div>
                      </motion.div>
                    );
                  })}
                  {activeFlow === 'selection' && visitorMessages.length === 2 && (
                    <div className="space-y-3 pt-6 border-t border-gray-50 dark:border-gray-800">
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest text-center mb-4">Escolha sua Atividade</p>
                      <div className="grid grid-cols-1 gap-2">
                        <button onClick={() => handleFlowAction('shop')} className="w-full flex items-center justify-between p-5 bg-indigo-600 text-white rounded-[2rem] shadow-xl shadow-indigo-500/20 active:scale-95 transition-all font-bold group">
                          <span>Sou uma Oficina 🛠️</span><ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                        </button>
                        <button onClick={() => handleFlowAction('supplier')} className="w-full flex items-center justify-between p-5 bg-white dark:bg-gray-800 border-2 border-indigo-100 dark:border-gray-700 text-indigo-600 dark:text-indigo-400 rounded-[2rem] active:scale-95 transition-all font-bold group">
                          <span>Sou Fornecedor 📦</span><ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                        </button>
                      </div>
                    </div>
                  )}
                  {isAiThinking && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start items-end gap-2">
                       <div className="w-8 h-8 rounded-full bg-indigo-50 dark:bg-indigo-900/20 flex items-center justify-center shrink-0">
                          <Sparkles className="w-4 h-4 text-indigo-400 animate-pulse" />
                       </div>
                       <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-2xl flex gap-1 shadow-inner">
                        <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce [animation-delay:-0.3s]" />
                        <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce [animation-delay:-0.15s]" />
                        <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" />
                      </div>
                    </motion.div>
                  )}
                </div>
              ) : !selectedTheme ? (
                <div className="space-y-6">
                  <div className="text-center space-y-2">
                    <h2 className="text-xl font-black text-gray-900 dark:text-white tracking-tight">Como podemos ajudar?</h2>
                    <p className="text-xs text-gray-500 font-medium">Selecione um tópico para atendimento prioritário.</p>
                  </div>
                  <div className="grid grid-cols-1 gap-3">
                    {showCustomInput ? (
                      <div className="space-y-4 animate-in zoom-in-95 duration-300">
                        <input value={customTheme} onChange={(e) => setCustomTheme(e.target.value)} placeholder="Qual o assunto do contato?" autoFocus className="w-full p-5 bg-gray-50 dark:bg-gray-800 border-none rounded-3xl text-sm focus:ring-2 focus:ring-indigo-500 dark:text-white shadow-inner" />
                        <div className="flex gap-3">
                          <button onClick={() => { setShowCustomInput(false); setCustomTheme(''); }} className="flex-1 py-4 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-2xl text-xs font-black uppercase">Voltar</button>
                          <button onClick={() => handleStartChat('Outros')} disabled={!customTheme.trim() || loading} className="flex-2 py-4 bg-indigo-600 text-white rounded-2xl text-xs font-black uppercase disabled:opacity-50">Iniciar Atendimento</button>
                        </div>
                      </div>
                    ) : (
                      THEMES.map((t) => (
                        <button 
                          key={t.id} 
                          onClick={() => handleStartChat(t.label)} 
                          disabled={loading}
                          className="flex items-center justify-between p-5 bg-gray-50 dark:bg-gray-800/50 hover:bg-white dark:hover:bg-gray-800 border border-transparent hover:border-indigo-100 dark:hover:border-indigo-900 rounded-[2rem] transition-all group scale-100 active:scale-95 disabled:opacity-50"
                        >
                          <div className="flex items-center gap-4">
                            <div className={`p-3 rounded-2xl bg-white dark:bg-gray-800 shadow-sm ${t.color}`}>
                              {loading ? (
                                <div className="w-6 h-6 border-2 border-current border-t-transparent rounded-full animate-spin" />
                              ) : (
                                <t.icon className="w-6 h-6" />
                              )}
                            </div>
                            <span className="font-bold text-gray-700 dark:text-gray-200">{t.label}</span>
                          </div>
                          <ChevronRight className="w-5 h-5 text-gray-300 group-hover:text-indigo-500 group-hover:translate-x-1 transition-all" />
                        </button>
                      ))
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex flex-col h-full">
                  <div className="flex-1 space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] bg-indigo-50 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-300 px-4 py-1.5 rounded-full font-black uppercase tracking-widest border border-indigo-100 dark:border-indigo-800">Tema: {selectedTheme}</span>
                      
                      {messages.length === 0 && (
                        <button 
                          onClick={async () => {
                            if (activeChat) {
                              await deleteDoc(doc(db, 'internal_chats', activeChat.id));
                            }
                            setSelectedTheme(null);
                            setActiveChat(null);
                          }}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 dark:bg-gray-800 text-[10px] font-black uppercase text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-xl transition-all border border-gray-100 dark:border-gray-700 shadow-sm group"
                        >
                          <ArrowRight className="w-3.5 h-3.5 rotate-180 group-hover:-translate-x-0.5 transition-transform" />
                          Trocar Tema (Voltar)
                        </button>
                      )}
                    </div>
                    {messages.length === 0 && <div className="p-5 bg-blue-50 dark:bg-blue-900/20 rounded-3xl border border-blue-100 dark:border-blue-800/50 text-xs text-blue-700 dark:text-blue-300 font-medium leading-relaxed">Descreva seu problema abaixo. Nossa equipe responderá em breve.</div>}
                    {messages.map((msg: any) => {
                      const isMe = profile && msg.senderId === (profile.uid || profile.id);
                      const isAi = msg.senderRole === 'ai';
                      return (
                        <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'} items-end gap-2`}>
                          {(isAi || msg.senderRole === 'admin') && (
                            <div className="w-8 h-8 rounded-full bg-indigo-50 dark:bg-indigo-900/40 flex items-center justify-center border border-indigo-100 dark:border-indigo-800 shrink-0 shadow-sm mb-1">
                              {isAi ? <Sparkles className="w-4 h-4 text-indigo-600" /> : <MessageSquare className="w-4 h-4 text-indigo-600" />}
                            </div>
                          )}
                          <div className={`max-w-[75%] flex flex-col gap-1 ${isMe ? 'items-end' : 'items-start'}`}>
                            {(isAi || msg.senderRole === 'admin') && (
                              <span className="text-[8px] font-black uppercase tracking-widest text-indigo-500 bg-indigo-50 dark:bg-indigo-900/30 px-2 py-0.5 rounded-full mb-1 border border-indigo-100 dark:border-indigo-800">
                                {isAi ? 'IA Assistant' : 'Suporte Hub'}
                              </span>
                            )}
                            <div className={`p-4 rounded-3xl text-sm font-medium shadow-sm leading-relaxed
                              ${isMe 
                                 ? 'bg-indigo-600 text-white rounded-br-none shadow-indigo-500/10' 
                                 : 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 rounded-bl-none border border-gray-100 dark:border-gray-700'
                              }`}
                            >
                              {msg.content}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    <div ref={messagesEndRef} />
                  </div>
                  <div className="mt-8 pt-4 border-t dark:border-gray-800">
                    {isResolving ? (
                      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
                        <div className="bg-amber-50 dark:bg-amber-900/20 p-4 rounded-3xl border border-amber-100 dark:border-amber-800/50 text-center"><p className="text-sm font-bold text-amber-900 dark:text-amber-200">Atendimento Concluído?</p><p className="text-[10px] text-amber-600 font-medium uppercase mt-1">O administrador enviou uma resposta.</p></div>
                        <div className="flex flex-col gap-2">
                          <button onClick={() => setIsResolving(false)} className="w-full py-4 bg-indigo-600 text-white rounded-2xl text-sm font-black uppercase tracking-wider shadow-lg shadow-indigo-500/20 active:scale-95 transition-all">Continuar Atendimento</button>
                          <button onClick={handleEndChat} className="w-full py-4 bg-white dark:bg-gray-800 text-rose-600 border-2 border-rose-100 dark:border-rose-900/30 rounded-2xl text-sm font-black uppercase tracking-wider active:scale-95 transition-all">Encerrar e Iniciar Novo</button>
                        </div>
                      </motion.div>
                    ) : (
                      <form onSubmit={handleSendMessage} className="flex gap-2 pb-2">
                        <input 
                          value={message} 
                          onChange={(e) => setMessage(e.target.value)} 
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                              handleSendMessage(e);
                            }
                          }}
                          disabled={isAiThinking}
                          placeholder={isVisitor ? "Pergunte sobre a ferramenta..." : "Escreva sua mensagem..."} 
                          className="flex-1 bg-gray-50 dark:bg-gray-800 border-none rounded-[1.5rem] px-5 py-4 text-sm focus:ring-2 focus:ring-indigo-500 dark:text-white shadow-inner font-medium disabled:opacity-50" 
                        />
                        <button 
                          type="submit" 
                          disabled={!message.trim() || isAiThinking} 
                          className="p-4 bg-indigo-600 text-white rounded-[1.5rem] shadow-lg shadow-indigo-500/20 active:scale-90 transition-all disabled:opacity-50"
                        >
                          <Send className="w-6 h-6" />
                        </button>
                      </form>
                    )}
                  </div>
                </div>
              )}
            </div>
            
            {isVisitor && (
              <div className="p-4 border-t dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/50">
                {!selectedTheme && visitorMessages.length >= 2 && (
                  <div className="flex flex-wrap gap-2 mb-4">
                    {VISITOR_SUGGESTIONS.map((chip, i) => (
                      <motion.button
                        key={i}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.1 }}
                        onClick={() => handleSendMessage(null as any, chip.value)}
                        disabled={isAiThinking}
                        className="px-4 py-2 bg-white dark:bg-gray-800 border border-indigo-100 dark:border-indigo-900 rounded-full text-[10px] font-bold text-indigo-600 dark:text-indigo-400 shadow-sm hover:shadow-md hover:border-indigo-300 transition-all active:scale-95"
                      >
                        {chip.label}
                      </motion.button>
                    ))}
                  </div>
                )}
                <form onSubmit={handleSendMessage} className="flex gap-2">
                  <input 
                    value={message} 
                    onChange={(e) => setMessage(e.target.value)} 
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        handleSendMessage(e);
                      }
                    }}
                    disabled={isAiThinking}
                    placeholder="Pergunte sobre a ferramenta..." 
                    className="flex-1 bg-white dark:bg-gray-800 border-none rounded-[1.5rem] px-5 py-4 text-sm focus:ring-2 focus:ring-indigo-500 dark:text-white shadow-inner font-medium disabled:opacity-50" 
                  />
                  <button 
                    type="submit" 
                    disabled={!message.trim() || isAiThinking} 
                    className="p-4 bg-indigo-600 text-white rounded-[1.5rem] shadow-lg shadow-indigo-500/20 active:scale-90 transition-all disabled:opacity-50"
                  >
                    <Send className="w-6 h-6" />
                  </button>
                </form>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
      <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => setIsOpen(!isOpen)} className={`p-5 rounded-[2rem] shadow-[0_20px_50px_rgba(0,0,0,0.2)] flex items-center justify-center transition-all ${isOpen ? 'bg-rose-500 scale-110' : 'bg-indigo-600'}`}>
        {isOpen ? <X className="w-8 h-8 text-white" /> : <MessageCircle className="w-8 h-8 text-white" />}
        {!isOpen && activeChat?.unreadCountUser > 0 && <span className="absolute -top-2 -right-2 w-7 h-7 bg-rose-500 text-white text-xs font-black rounded-full flex items-center justify-center border-4 border-white dark:border-gray-900 shadow-lg">{activeChat.unreadCountUser}</span>}
      </motion.button>
    </div>
  );
}
