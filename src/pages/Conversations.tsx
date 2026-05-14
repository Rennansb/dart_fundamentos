import React, { useState, useEffect, useRef } from 'react';
import { Search, Send, User, Phone, MessageSquare, ArrowLeft, Store, MoreVertical, Paperclip, Smile, Check, CheckCheck, Clock, ChevronLeft, AlertCircle, X, Shield, Plus } from 'lucide-react';
import { useAuth } from '../AuthContext';
import { db } from '../firebase';
import { collection, query, where, onSnapshot, doc, setDoc, addDoc, serverTimestamp, orderBy, updateDoc, deleteDoc, getDocs, limit } from 'firebase/firestore';
import { useSearchParams, useLocation } from 'react-router-dom';
import { handleFirestoreError, OperationType } from '../utils/firestoreErrors';
import { io } from 'socket.io-client';
import * as XLSX from 'xlsx';
import { Download } from 'lucide-react';


export default function Conversations() {
  const socketRef = useRef<any>(null);
  if (!socketRef.current) {
    socketRef.current = io();
  }
  const socket = socketRef.current;

  const { profile, loading, selectedCompanyId } = useAuth();
  console.log(`[Conversations] Render: loading=${loading}, profile=${!!profile}, role=${profile?.role}`);
  const [companies, setCompanies] = useState<any[]>([]);
  const [selectedCompany, setSelectedCompany] = useState<any>(null);
  const [conversations, setConversations] = useState<any[]>([]);
  const [activeChat, setActiveChat] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [qr, setQr] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [connectedUser, setConnectedUser] = useState<any>(null);
  const [debugStatus, setDebugStatus] = useState<any>(null);
  const [systemError, setSystemError] = useState<string | null>(null);
  const [searchParams] = useSearchParams();
  const initialMode = (searchParams.get('mode') as 'whatsapp' | 'internal') || 'whatsapp';
  const [chatMode, setChatMode] = useState<'whatsapp' | 'internal'>(initialMode);
  const [internalChats, setInternalChats] = useState<any[]>([]);
  const [isNewInternalChatModalOpen, setIsNewInternalChatModalOpen] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const location = useLocation();
  const [hasAutoLoaded, setHasAutoLoaded] = useState(false);

  const currentCompanyId = selectedCompanyId || (profile?.role === 'admin' ? (selectedCompany?.companyId || selectedCompany?.id) : (profile?.companyId || profile?.id));

  useEffect(() => {
    const fetchDebugStatus = async () => {
      try {
        const res = await fetch('/api/debug/status');
        if (res.ok) {
          const data = await res.json();
          setDebugStatus(data);
        }
      } catch (e) {
        // Silent fail for debug
      }
    };
    fetchDebugStatus();
    const interval = setInterval(fetchDebugStatus, 5000);
    return () => clearInterval(interval);
  }, []);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);


  
    useEffect(() => {
      if (!currentCompanyId) return;
  
      const onConnect = () => {
        socket.emit('get-status', { companyId: currentCompanyId });
      };
      
      socket.on('connect', onConnect);
      
      const handleQr = (data: { companyId: string, qr: string }) => {
        console.log(`[Socket] QR received for ${data.companyId}`);
        if (data.companyId === currentCompanyId) {
          setQr(data.qr);
          setIsReady(false);
          setIsConnecting(false);
        }
      };
  
      const handleReady = (data: { companyId: string, user: any }) => {
        console.log(`[Socket] WhatsApp ready for ${data.companyId}`);
        if (data.companyId === currentCompanyId) {
          setQr(null);
          setIsReady(true);
          setIsConnecting(false);
          setConnectedUser(data.user);
        }
      };
  
      const handleConnecting = (data: { companyId: string }) => {
        console.log(`[Socket] WhatsApp connecting for ${data.companyId}`);
        if (data.companyId === currentCompanyId) {
          setIsConnecting(true);
          setQr(null);
          setIsReady(false);
        }
      };
  
      const handleDisconnected = (data: { companyId: string }) => {
        console.log(`[Socket] WhatsApp disconnected for ${data.companyId}`);
        if (data.companyId === currentCompanyId) {
          setQr(null);
          setIsReady(false);
          setIsConnecting(false);
          setConnectedUser(null);
        }
      };
  
      const handleSystemError = (data: any) => {
        console.error(`[Socket] System Error:`, data);
        if (data.companyId === currentCompanyId) {
          setSystemError(data.message);
          setTimeout(() => setSystemError(null), 10000);
        }
      };
  
      socket.on('qr', handleQr);
      socket.on('whatsapp-ready', handleReady);
      socket.on('whatsapp-connecting', handleConnecting);
      socket.on('whatsapp-disconnected', handleDisconnected);
      socket.on('connected-user', handleReady);
      socket.on('system-error', handleSystemError);
      
      if (socket.connected) {
        socket.emit('get-status', { companyId: currentCompanyId });
      }
  
      return () => {
        socket.off('connect', onConnect);
        socket.off('qr', handleQr);
        socket.off('whatsapp-ready', handleReady);
        socket.off('whatsapp-connecting', handleConnecting);
        socket.off('whatsapp-disconnected', handleDisconnected);
        socket.off('connected-user', handleReady);
        socket.off('system-error', handleSystemError);
      };
    }, [profile, selectedCompany]);

  const handleReconnect = () => {
    const currentCompanyId = profile?.role === 'admin' ? (selectedCompany?.companyId || selectedCompany?.id) : (profile?.companyId || profile?.id);
    if (!currentCompanyId) return;
    
    if (window.confirm('Isso irá desconectar o WhatsApp atual e gerar um novo QR Code. Continuar?')) {
      socket.emit('reconnect-whatsapp', { companyId: currentCompanyId });
      setQr(null);
      setIsReady(false);
      setConnectedUser(null);
    }
  };

  useEffect(() => {
    if (!profile) return;
    
    let unsubscribe: () => void;

    if (profile?.role === 'admin') {
      // Fetch shops AND the admin itself (Service Hub)
      const q = query(collection(db, 'users'), where('role', 'in', ['shop', 'admin']));
      unsubscribe = onSnapshot(q, (snapshot) => {
        const allUsers = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
        const shops = allUsers.filter(u => u.role === 'shop');
        const admins = allUsers.filter(u => u.role === 'admin');
        
        // Prioritize Service Hub Admin by ID
        const serviceHubAdmin = admins.find(a => a.id === '09sGLpwNnqSZC5bGoEKJl0r1myZ2') || admins[0];
        
        const finalCompanies = serviceHubAdmin ? [serviceHubAdmin, ...shops] : shops;
        setCompanies(finalCompanies);
      }, (error) => {
        handleFirestoreError(error, OperationType.LIST, 'users');
      });
    } else {
      const companyId = profile.companyId || profile.id;
      const q = query(
        collection(db, 'conversations'), 
        where('companyId', '==', companyId),
        orderBy('lastMessageAt', 'desc')
      );
      unsubscribe = onSnapshot(q, (snapshot) => {
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        console.log(`[Firestore] Loaded ${data.length} conversations for shop ${companyId}`);
        setConversations(data);
      }, (error) => {
        handleFirestoreError(error, OperationType.LIST, 'conversations');
      });
    }
    
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [profile]);

  useEffect(() => {
    let unsubscribe: () => void;
    if (profile?.role === 'admin' && selectedCompany) {
      const companyId = selectedCompany.companyId || selectedCompany.id;
      const q = query(
        collection(db, 'conversations'), 
        where('companyId', '==', companyId),
        orderBy('lastMessageAt', 'desc')
      );
      unsubscribe = onSnapshot(q, (snapshot) => {
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        console.log(`[Firestore] Loaded ${data.length} conversations for ${companyId} (Admin View)`);
        setConversations(data);
      }, (error) => {
        handleFirestoreError(error, OperationType.LIST, 'conversations');
      });
    }
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [profile?.role, selectedCompany]);

  // Internal Chats Listener (for Admin and Users)
  useEffect(() => {
    if (chatMode !== 'internal' || !profile) return;
    if (profile.role === 'employee') return;

    let q = query(
      collection(db, 'internal_chats'),
      orderBy('lastMessageAt', 'desc')
    );

    // If not admin, only see own chat
    if (profile.role !== 'admin') {
      q = query(
        collection(db, 'internal_chats'),
        where('companyId', '==', currentCompanyId),
        orderBy('lastMessageAt', 'desc')
      );
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setInternalChats(data);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'internal_chats');
    });

    return () => unsubscribe();
  }, [profile, chatMode, currentCompanyId]);

  // V12: Auto-message handling from Budgets.tsx state
  useEffect(() => {
    if (hasAutoLoaded || !conversations.length) return;
    
    const state = location.state as any;
    if (state?.autoMessage) {
      setNewMessage(state.autoMessage);
      setHasAutoLoaded(true);
      
      if (state.autoSelectPhone) {
        const foundChat = conversations.find(c => (c.customerPhone || '').includes(state.autoSelectPhone));
        if (foundChat) {
          setActiveChat(foundChat);
        }
      }
    }
  }, [location, conversations, hasAutoLoaded]);

  useEffect(() => {
    if (activeChat) {
      const collectionName = chatMode === 'internal' ? 'internal_chats' : 'conversations';
      const q = query(
        collection(db, collectionName, activeChat.id, 'messages'),
        orderBy('createdAt', 'asc')
      );
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setMessages(data);
        
        if (activeChat.unreadCount > 0 || activeChat.unreadCountAdmin > 0) {
          const updateField = chatMode === 'internal' ? { unreadCountAdmin: 0 } : { unreadCount: 0 };
          updateDoc(doc(db, collectionName, activeChat.id), updateField).catch(console.error);
        }

        // Mark internal messages as viewed
        if (chatMode === 'internal') {
          snapshot.docs.forEach(msgDoc => {
            const data = msgDoc.data();
            if (data.senderRole !== 'admin' && data.status !== 'viewed') {
              updateDoc(msgDoc.ref, { status: 'viewed' }).catch(console.error);
            }
          });
        }

      }, (error) => {
        handleFirestoreError(error, OperationType.LIST, `${collectionName}/${activeChat.id}/messages`);
      });
      return () => unsubscribe();
    }
  }, [activeChat, chatMode]);

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !activeChat) return;

    if (chatMode !== 'internal' && !currentCompanyId) return;

    try {
      if (chatMode === 'internal') {
        // Internal message logic
        await addDoc(collection(db, 'internal_chats', activeChat.id, 'messages'), {
          content: newMessage,
          senderId: profile.uid || profile.id,
          senderRole: profile.role,
          createdAt: serverTimestamp()
        });

        await updateDoc(doc(db, 'internal_chats', activeChat.id), {
          lastMessage: newMessage,
          lastMessageAt: serverTimestamp(),
          unreadCountUser: (activeChat.unreadCountUser || 0) + 1
        });
      } else {
        // WhatsApp message logic
        socket.emit('send-message', {
          companyId: currentCompanyId,
          conversationId: activeChat.id,
          to: activeChat.customerPhone,
          message: newMessage
        });
      }
      setNewMessage('');
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  const handleEndChat = async () => {
    if (!activeChat || chatMode !== 'internal') return;

    try {
      // Hard reset local state immediately
      const chatId = activeChat.id;
      setActiveChat(null);
      setMessages([]);

      // Mark as closed and delete to ensure clean slate for next time
      await updateDoc(doc(db, 'internal_chats', chatId), { status: 'closed' });
      await deleteDoc(doc(db, 'internal_chats', chatId));

      console.log(`[Conversations] Internal chat ${chatId} definitively closed and purged.`);
    } catch (err) {
      console.error("Error closing internal chat:", err);
      handleFirestoreError(err, OperationType.UPDATE, 'internal_chats');
    }
  };

  const handleStartNewInternalChat = async (company: any) => {
    try {
      const q = query(
        collection(db, 'internal_chats'),
        where('userId', '==', company.id),
        where('status', '==', 'open'),
        limit(1)
      );
      const snap = await getDocs(q);
      
      let chatId;
      if (snap.empty) {
        const newChat = await addDoc(collection(db, 'internal_chats'), {
          userId: company.id,
          userName: company.name || company.shopName || 'Usuário',
          role: company.role,
          theme: 'Comunicação Direta',
          status: 'open',
          lastMessage: 'Conversa iniciada pelo Admin',
          lastMessageAt: serverTimestamp(),
          unreadCountAdmin: 0,
          unreadCountUser: 0,
          createdAt: serverTimestamp()
        });
        chatId = newChat.id;
      } else {
        chatId = snap.docs[0].id;
      }
      
      const chatData = snap.empty ? { id: chatId, userName: company.name || company.shopName, theme: 'Comunicação Direta' } : { id: chatId, ...snap.docs[0].data() };
      setActiveChat(chatData);
      setIsNewInternalChatModalOpen(false);
    } catch (error) {
      console.error('Error starting new internal chat:', error);
    }
  };

  const activeList = chatMode === 'internal' ? internalChats : conversations;

  const filteredConversations = activeList.filter(chat => 
    (chat.customerName || chat.userName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (chat.customerPhone || '').includes(searchQuery)
  );

  const formatTime = (timestamp: any) => {
    if (!timestamp) return '';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (timestamp: any) => {
    if (!timestamp) return '';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const now = new Date();
    if (date.toDateString() === now.toDateString()) return formatTime(timestamp);
    return date.toLocaleDateString();
  };

  const handleExportChat = () => {
    if (!activeChat || messages.length === 0) {
      alert("Nenhuma mensagem para exportar.");
      return;
    }
    
    // Formatting data for Excel
    const dataToExport = messages.map(msg => {
      const isCompany = msg.senderType === 'company' || msg.senderRole === 'admin';
      const sender = isCompany ? 'Nós' : (activeChat.customerName || activeChat.userName || 'Cliente');
      
      let dateStr = '';
      if (msg.createdAt) {
        const d = msg.createdAt.toDate ? msg.createdAt.toDate() : new Date(msg.createdAt);
        dateStr = d.toLocaleString('pt-BR');
      }

      return {
        'Data/Hora': dateStr,
        'Remetente': sender,
        'Mensagem': msg.content || '[Mídia/Documento]'
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    
    // Auto-size columns
    const colWidths = [
      { wch: 20 }, // Data/Hora
      { wch: 15 }, // Remetente
      { wch: 100 } // Mensagem
    ];
    worksheet['!cols'] = colWidths;

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Histórico de Chat");

    const chatName = activeChat.customerName || activeChat.userName || activeChat.customerPhone || 'Chat';
    const safeName = chatName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    XLSX.writeFile(workbook, `chat_${safeName}_${new Date().getTime()}.xlsx`);
  };

  if (loading) return <div className="p-8 text-center">Carregando...</div>;
  if (!profile) return <div className="p-8 text-center">Não autenticado</div>;

  return (
    <div className="flex h-[calc(100vh-100px)] bg-white dark:bg-[#030406] rounded-[3rem] overflow-hidden shadow-2xl border border-gray-100 dark:border-white/5 w-full">
      {/* Sidebar */}
      <div className={`w-full md:w-[450px] lg:w-[550px] xl:w-[650px] flex flex-col bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 transition-all duration-300 ${activeChat ? 'hidden md:flex' : 'flex'} shrink-0`}>
        {/* Sidebar Header */}
        <div className="p-3 bg-[#f0f2f5] dark:bg-gray-800 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            {profile?.role === 'admin' && selectedCompany && (
              <button 
                onClick={() => {
                  setSelectedCompany(null);
                  setActiveChat(null);
                  setConversations([]);
                }}
                className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full mr-1"
                title="Voltar para lista de empresas"
              >
                <ChevronLeft className="h-5 w-5 text-gray-600 dark:text-gray-400" />
              </button>
            )}
            <div className="h-10 w-10 rounded-full bg-gray-300 dark:bg-gray-700 flex items-center justify-center overflow-hidden">
              {profile?.photoURL ? (
                <img src={profile.photoURL} alt="Profile" className="h-full w-full object-cover" />
              ) : (
                <User className="h-6 w-6 text-gray-600 dark:text-gray-400" />
              )}
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-semibold dark:text-white">{profile?.name || profile?.email}</span>
              <div className="flex items-center space-x-1">
                <div className={`h-2 w-2 rounded-full ${isReady ? 'bg-green-500' : isConnecting ? 'bg-blue-500 animate-pulse' : qr ? 'bg-yellow-500' : 'bg-red-500'}`}></div>
                <span className="text-[12px] text-gray-500 dark:text-gray-400 uppercase font-black tracking-widest">
                  {isReady ? 'Conectado' : isConnecting ? 'Conectando...' : qr ? 'Aguardando' : 'Desconectado'}
                </span>
                <span className="text-[10px] text-gray-400 ml-1 font-bold">ID: {profile?.role === 'admin' ? (selectedCompany?.id?.substring(0, 5) || 'N/A') : profile?.id?.substring(0, 5)}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            {profile?.role === 'admin' && (
              <div className="flex bg-white dark:bg-gray-900 rounded-lg p-1 border border-gray-200 dark:border-gray-700 mr-2">
                <button 
                  onClick={() => { setChatMode('whatsapp'); setActiveChat(null); setSelectedCompany(null); }}
                  className={`px-4 py-2 text-[11px] uppercase font-black tracking-widest rounded-xl transition-all ${chatMode === 'whatsapp' ? 'bg-indigo-600 text-white shadow-lg' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  WhatsApp
                </button>
                <button 
                  onClick={() => { setChatMode('internal'); setActiveChat(null); setSelectedCompany(null); }}
                  className={`px-4 py-2 text-[11px] uppercase font-black tracking-widest rounded-xl transition-all relative ${chatMode === 'internal' ? 'bg-rose-600 text-white shadow-lg' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  Ouvidoria
                  {internalChats.reduce((acc, chat) => acc + (chat.unreadCountAdmin || 0), 0) > 0 && (
                    <span className="absolute -top-1 -right-1 bg-rose-500 text-white text-[10px] font-black h-5 w-5 rounded-full flex items-center justify-center shadow-md">
                      {internalChats.reduce((acc, chat) => acc + (chat.unreadCountAdmin || 0), 0)}
                    </span>
                  )}
                </button>
              </div>
            )}
            {chatMode === 'whatsapp' && (
              <button onClick={handleReconnect} title="Reconectar WhatsApp" className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full transition-colors">
                <MessageSquare className="h-5 w-5 text-gray-600 dark:text-gray-400" />
              </button>
            )}
            <button className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full transition-colors">
              <MoreVertical className="h-5 w-5 text-gray-600 dark:text-gray-400" />
            </button>
          </div>
        </div>

        {/* Search & Actions */}
        <div className="p-2 bg-white dark:bg-gray-900 border-b dark:border-gray-800">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Pesquisar..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-1.5 bg-[#f0f2f5] dark:bg-gray-800 border-none rounded-lg text-sm focus:ring-0 dark:text-white placeholder-gray-500"
              />
            </div>
            {profile?.role === 'admin' && chatMode === 'internal' && (
              <button 
                onClick={() => setIsNewInternalChatModalOpen(true)}
                className="p-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg transition-colors flex items-center justify-center"
                title="Nova Conversa Interna"
              >
                <Plus className="h-5 w-5" />
              </button>
            )}
          </div>
        </div>

        {/* Chat List */}
        <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-700">
          {profile?.role === 'admin' && !selectedCompany && chatMode === 'whatsapp' ? (
            companies.map(company => (
              <div 
                key={company.id}
                onClick={() => setSelectedCompany(company)}
                className={`px-4 py-3 flex items-center space-x-3 cursor-pointer hover:bg-[#f5f6f6] dark:hover:bg-gray-800 transition-colors border-b border-gray-100 dark:border-gray-800 ${company.role === 'admin' ? 'bg-indigo-50/50 dark:bg-indigo-900/10' : ''}`}
              >
                <div className={`h-12 w-12 rounded-full flex items-center justify-center ${company.role === 'admin' ? 'bg-indigo-600' : 'bg-indigo-100 dark:bg-indigo-900/30'}`}>
                  {company.role === 'admin' ? (
                    <Shield className="h-6 w-6 text-white" />
                  ) : (
                    <Store className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className={`text-lg font-black truncate ${company.id === '09sGLpwNnqSZC5bGoEKJl0r1myZ2' ? 'text-indigo-700 dark:text-indigo-400' : 'text-gray-900 dark:text-white'}`}>
                    {company.id === '09sGLpwNnqSZC5bGoEKJl0r1myZ2' ? 'Service Hub (ADMIN)' : (company.name || company.shopName || 'Sem Nome')}
                  </h3>
                  <p className="text-sm font-bold text-gray-500 dark:text-gray-400 truncate uppercase tracking-tighter">
                    {company.id === '09sGLpwNnqSZC5bGoEKJl0r1myZ2' ? 'Vendas e Onboarding • Canal Direto' : (company.role === 'admin' ? 'Controle Administrativo' : 'Clique para gerenciar conversas')}
                  </p>
                </div>
              </div>
            ))
          ) : (
            filteredConversations.map(chat => (
              <div 
                key={chat.id}
                onClick={() => setActiveChat(chat)}
                className={`px-4 py-3 flex items-center space-x-3 cursor-pointer transition-colors border-b border-gray-100 dark:border-gray-800 ${activeChat?.id === chat.id ? 'bg-[#f0f2f5] dark:bg-gray-800' : 'hover:bg-[#f5f6f6] dark:hover:bg-gray-800'}`}
              >
                <div className={`h-12 w-12 rounded-full flex items-center justify-center text-gray-500 font-bold text-xl ${chatMode === 'internal' ? 'bg-rose-100 text-rose-600' : 'bg-gray-200 dark:bg-gray-700'}`}>
                  {chat.customerName || chat.userName ? (chat.customerName || chat.userName)[0].toUpperCase() : <User className="h-6 w-6" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-baseline">
                    <h3 className="text-base font-medium text-gray-900 dark:text-white truncate">
                      {chat.customerName || chat.userName || chat.customerPhone}
                    </h3>
                    <span className="text-[10px] text-gray-500 dark:text-gray-400 ml-2">
                      {formatDate(chat.lastMessageAt)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <p className="text-sm text-gray-500 dark:text-gray-400 truncate pr-2">
                      {chatMode === 'internal' && <span className="text-[10px] font-bold text-rose-500 mr-2">[{chat.theme}]</span>}
                      {chat.lastMessage}
                    </p>
                    {(chat.unreadCount > 0 || chat.unreadCountAdmin > 0) && (
                      <span className={`${chatMode === 'internal' ? 'bg-rose-500' : 'bg-[#25d366]'} text-white text-[10px] font-bold h-5 min-w-[20px] px-1 rounded-full flex items-center justify-center`}>
                        {chatMode === 'internal' ? chat.unreadCountAdmin : chat.unreadCount}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
          
          {filteredConversations.length === 0 && (profile?.role !== 'admin' || selectedCompany) && (
            <div className="p-10 text-center flex flex-col items-center justify-center h-full opacity-40">
              <MessageSquare className="h-16 w-16 mb-4" />
              <p className="text-lg font-medium">Nenhuma conversa encontrada</p>
            </div>
          )}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className={`flex-1 flex flex-col bg-[#efeae2] dark:bg-[#0b141a] relative ${activeChat ? 'flex' : 'hidden md:flex'}`}>
        {activeChat ? (
          <>
            {/* Chat Header */}
            <div className="p-3 bg-[#f0f2f5] dark:bg-gray-800 flex items-center justify-between border-b border-gray-200 dark:border-gray-800 z-10">
              <div className="flex items-center space-x-3">
                <button onClick={() => setActiveChat(null)} className="md:hidden p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full">
                  <ArrowLeft className="h-6 w-6 text-gray-600 dark:text-gray-400" />
                </button>
                <div className="h-10 w-10 rounded-full bg-gray-300 dark:bg-gray-700 flex items-center justify-center text-gray-600 font-bold">
                  {activeChat.customerName || activeChat.userName ? (activeChat.customerName || activeChat.userName)[0].toUpperCase() : <User className="h-6 w-6" />}
                </div>
                <div>
                  <h3 className="text-sm font-semibold dark:text-white">{activeChat.customerName || activeChat.userName || activeChat.customerPhone}</h3>
                  <p className="text-[10px] text-gray-500 dark:text-gray-400 flex items-center">
                    {chatMode === 'internal' ? <Shield className="h-2 w-2 mr-1" /> : <Phone className="h-2 w-2 mr-1" />}
                    {chatMode === 'internal' ? `Ouvidoria: ${activeChat.theme}` : activeChat.customerPhone}
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-4">
                {chatMode === 'internal' && (
                  <button 
                    onClick={handleEndChat}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 dark:bg-rose-900/20 dark:hover:bg-rose-900/30 dark:text-rose-400 rounded-xl transition-all text-[10px] font-black uppercase tracking-widest border border-rose-100 dark:border-rose-800/50 group"
                    title="Encerrar Atendimento"
                  >
                    <X className="w-3.5 h-3.5 group-hover:rotate-90 transition-transform" />
                    Encerrar
                  </button>
                )}
                <button className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full transition-colors">
                  <Search className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                </button>
                <button 
                  onClick={handleExportChat}
                  className="p-2 hover:bg-emerald-100 dark:hover:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-full transition-colors flex items-center justify-center"
                  title="Exportar Atendimento (Excel)"
                >
                  <Download className="h-5 w-5" />
                </button>
                <button className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full transition-colors">
                  <MoreVertical className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                </button>
              </div>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 md:px-10 space-y-2 bg-[url('https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png')] dark:bg-none bg-repeat scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-700">
              <div className="flex flex-col space-y-2">
                {messages.map((msg, idx) => {
                  const isCompany = msg.senderType === 'company';
                  const showDate = idx === 0 || formatDate(messages[idx-1].createdAt) !== formatDate(msg.createdAt);
                  
                  return (
                    <React.Fragment key={msg.id}>
                      {showDate && (
                        <div className="flex justify-center my-4">
                          <span className="bg-white dark:bg-gray-800 px-3 py-1 rounded-lg text-[10px] uppercase font-bold text-gray-500 dark:text-gray-400 shadow-sm">
                            {formatDate(msg.createdAt)}
                          </span>
                        </div>
                      )}
                      <div className={`flex ${isCompany || msg.senderRole === 'admin' ? 'justify-end' : 'justify-start'}`}>
                        <div className="flex flex-col gap-1 max-w-[85%] md:max-w-[65%]">
                          {chatMode === 'internal' && (msg.senderRole === 'admin' || msg.senderRole === 'ai') && (
                            <span className={`text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border mb-1 self-end
                              ${msg.senderRole === 'ai' 
                                ? 'text-indigo-500 bg-indigo-50 border-indigo-100 dark:bg-indigo-900/30 dark:border-indigo-800' 
                                : 'text-emerald-600 bg-emerald-50 border-emerald-100 dark:bg-emerald-900/30 dark:border-emerald-800'
                              }`}
                            >
                              {msg.senderRole === 'ai' ? 'IA Assistant' : 'Suporte Hub'}
                            </span>
                          )}
                          <div className={`relative px-4 py-2 2xl:px-6 2xl:py-4 rounded-2xl shadow-sm ${
                            isCompany || msg.senderRole === 'admin'
                              ? 'bg-[#dcf8c6] dark:bg-[#005c4b] text-gray-900 dark:text-gray-100 rounded-tr-none' 
                              : 'bg-white dark:bg-[#202c33] text-gray-900 dark:text-gray-100 rounded-tl-none'
                          }`}>
                            <p className="text-sm lg:text-base 2xl:text-lg leading-relaxed whitespace-pre-wrap break-words">{msg.content}</p>
                            <div className="flex items-center justify-end space-x-2 mt-2">
                              <span className="text-[10px] 2xl:text-xs text-gray-500 dark:text-gray-400">
                                {formatTime(msg.createdAt)}
                              </span>
                              {(isCompany || msg.senderRole === 'admin') && (
                                <CheckCheck className="h-3.5 w-3.5 2xl:h-4 2xl:w-4 text-blue-500" />
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </React.Fragment>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>
            </div>

            {/* Input Area */}
            <div className="p-3 bg-[#f0f2f5] dark:bg-gray-800 flex items-center space-x-3">
              <button className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full transition-colors">
                <Smile className="h-6 w-6 text-gray-600 dark:text-gray-400" />
              </button>
              <button className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full transition-colors">
                <Paperclip className="h-6 w-6 text-gray-600 dark:text-gray-400" />
              </button>
              <form onSubmit={sendMessage} className="flex-1 flex items-center space-x-3">
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Digite uma mensagem"
                  className="flex-1 bg-white dark:bg-gray-700 border-none rounded-lg px-4 py-2 text-sm focus:ring-0 dark:text-white"
                />
                <button
                  type="submit"
                  disabled={!newMessage.trim()}
                  className="p-2 bg-transparent hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full disabled:opacity-30 transition-all"
                >
                  <Send className={`h-6 w-6 ${newMessage.trim() ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-400'}`} />
                </button>
              </form>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-10 text-center bg-[#f8f9fa] dark:bg-[#222e35]">
            <div className="max-w-md flex flex-col items-center">
              <div className="w-64 h-64 mb-8 opacity-80">
                <img src="https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png" alt="WhatsApp" className="w-full h-full object-contain grayscale opacity-20" />
              </div>
              <h2 className="text-3xl font-light text-gray-600 dark:text-gray-300 mb-4">WhatsApp Web</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
                Envie e receba mensagens sem precisar manter seu celular conectado. <br />
                Use o WhatsApp em até 4 aparelhos conectados e 1 telefone ao mesmo tempo.
              </p>
              
              <div className="mt-10 pt-10 border-t border-gray-200 dark:border-gray-800 w-full flex items-center justify-center space-x-2 text-gray-400">
                <Clock className="h-4 w-4" />
                <span className="text-xs uppercase tracking-widest font-bold">Criptografia de ponta a ponta</span>
              </div>
            </div>
          </div>
        )}

        {/* Connection Loading Overlay */}
        {isConnecting && !qr && !isReady && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm p-4">
            <div className="flex flex-col items-center">
              <div className="w-16 h-16 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mb-4"></div>
              <h3 className="text-xl font-medium text-gray-900 dark:text-white">Conectando ao WhatsApp...</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">Isso pode levar alguns segundos.</p>
            </div>
          </div>
        )}

        {/* QR Code Overlay */}
        {qr && !isReady && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm p-4">
            <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl p-8 max-w-sm w-full text-center border border-gray-100 dark:border-gray-800">
              <h3 className="text-2xl font-light text-gray-900 dark:text-white mb-6">Conectar WhatsApp</h3>
              <div className="bg-white p-4 rounded-xl inline-block mb-6 shadow-xl border border-gray-100">
                <img src={qr} alt="WhatsApp QR Code" className="w-64 h-64" />
              </div>
              <div className="text-left space-y-4 mb-8">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  1. Abra o WhatsApp no seu celular
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  2. Toque em <strong>Mais opções</strong> ou <strong>Configurações</strong> e selecione <strong>Aparelhos conectados</strong>
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  3. Toque em <strong>Conectar um aparelho</strong>
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  4. Aponte seu celular para esta tela para capturar o código
                </p>
              </div>
              <button
                onClick={() => setQr(null)}
                className="w-full py-2 bg-[#25d366] hover:bg-[#20bd5b] text-white rounded-lg font-semibold transition-colors"
              >
                Entendi
              </button>
            </div>
          </div>
        )}

        {/* New Internal Chat Modal */}
        {isNewInternalChatModalOpen && (
          <div className="absolute inset-0 z-[70] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[80vh]">
              <div className="p-4 border-b dark:border-gray-800 flex items-center justify-between bg-gray-50 dark:bg-gray-800/50">
                <h3 className="font-bold text-gray-900 dark:text-white">Selecione uma Empresa</h3>
                <button onClick={() => setIsNewInternalChatModalOpen(false)} className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full transition-colors font-bold">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-2 border-b dark:border-gray-800">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Pesquisar empresa..."
                    className="w-full pl-10 pr-4 py-2 bg-gray-100 dark:bg-gray-800 border-none rounded-xl text-sm focus:ring-0 dark:text-white"
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-2">
                {companies.filter(c => c.role === 'shop' || c.role === 'supplier').map(company => (
                  <button
                    key={company.id}
                    onClick={() => handleStartNewInternalChat(company)}
                    className="w-full text-left p-3 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-xl transition-all flex items-center gap-3 group"
                  >
                    <div className="h-10 w-10 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-bold">
                      {company.name ? company.name[0].toUpperCase() : company.shopName ? company.shopName[0].toUpperCase() : <Store className="h-5 w-5" />}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-bold text-gray-900 dark:text-white group-hover:text-indigo-600 transition-colors">
                        {company.name || company.shopName || 'Sem Nome'}
                      </p>
                      <p className="text-[10px] text-gray-500 dark:text-gray-400 uppercase tracking-widest">{company.role}</p>
                    </div>
                    <ChevronLeft className="w-4 h-4 text-gray-300 group-hover:text-indigo-500 rotate-180 transition-all" />
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
