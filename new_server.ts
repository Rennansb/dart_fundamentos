import path from "path";
import fs from "fs";
import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import { makeWASocket, useMultiFileAuthState, DisconnectReason } from "@whiskeysockets/baileys";
import qrcode from "qrcode";
import pino from "pino";
import { initializeApp, getApps, getApp } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

// Initialize Firebase Admin
initializeApp();
const dbAdmin = getFirestore(getApp());

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
});

async function startServer() {
  const app = express();
  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: { origin: "*" },
    pingTimeout: 60000,
    pingInterval: 25000
  });
  const PORT = 3000;

  // WhatsApp state per company
  interface CompanySession {
    sock: any;
    qrCodeData: string | null;
    connectionWatchdog: NodeJS.Timeout | null;
    lastConnectAttempt: number;
    isConnecting: boolean;
    conflictCount: number;
    reconnectTimer: NodeJS.Timeout | null;
  }
  const sessions = new Map<string, CompanySession>();

  function getSession(companyId: string): CompanySession {
    if (!sessions.has(companyId)) {
      sessions.set(companyId, {
        sock: null,
        qrCodeData: null,
        connectionWatchdog: null,
        lastConnectAttempt: 0,
        isConnecting: false,
        conflictCount: 0,
        reconnectTimer: null
      });
    }
    return sessions.get(companyId)!;
  }

  // API routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  async function clearBaileysSession(companyId: string) {
    console.log(`Clearing Baileys session for company ${companyId}...`);
    const session = getSession(companyId);
    session.isConnecting = false;
    session.conflictCount = 0;
    if (session.reconnectTimer) {
      clearTimeout(session.reconnectTimer);
      session.reconnectTimer = null;
    }
    try {
      if (session.sock) {
        session.sock.ev.removeAllListeners('connection.update');
        session.sock.ev.removeAllListeners('creds.update');
        session.sock.ev.removeAllListeners('messages.upsert');
        session.sock.end();
        session.sock = null;
      }
    } catch (e) {}
    
    const authFolder = `auth_info_baileys_${companyId}`;
    if (fs.existsSync(authFolder)) {
      try {
        const files = fs.readdirSync(authFolder);
        for (const file of files) {
          try {
            fs.unlinkSync(path.join(authFolder, file));
          } catch (e) {}
        }
        fs.rmSync(authFolder, { recursive: true, force: true });
        console.log(`Auth folder ${authFolder} deleted successfully`);
      } catch (e) {
        console.error(`Error deleting auth folder ${authFolder}:`, e);
      }
    }
    
    session.qrCodeData = null;
    io.emit('qr', { companyId, qr: null });
  }

  app.get("/api/whatsapp/clear-session", async (req, res) => {
    const companyId = req.query.companyId as string;
    if (!companyId) return res.status(400).json({ error: "companyId required" });
    console.log(`Manual session clear requested via GET for company ${companyId}`);
    await clearBaileysSession(companyId);
    const session = getSession(companyId);
    session.reconnectTimer = setTimeout(() => connectToWhatsApp(companyId), 2000);
    res.json({ status: "ok", message: "Session cleared" });
  });

  // Gemini Setup
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

  async function connectToWhatsApp(companyId: string) {
    const session = getSession(companyId);

    if (session.isConnecting) {
      console.log(`Already attempting to connect for ${companyId}, skipping...`);
      return;
    }
    
    if (session.reconnectTimer) {
      clearTimeout(session.reconnectTimer);
      session.reconnectTimer = null;
    }

    const now = Date.now();
    if (now - session.lastConnectAttempt < 5000) {
      console.log(`Connection attempt too soon for ${companyId}, waiting...`);
      if (!session.reconnectTimer) {
        session.reconnectTimer = setTimeout(() => connectToWhatsApp(companyId), 5000);
      }
      return;
    }
    session.lastConnectAttempt = now;

    session.isConnecting = true;
    console.log(`Starting WhatsApp connection attempt for ${companyId}...`);
    
    if (session.connectionWatchdog) clearTimeout(session.connectionWatchdog);
    session.connectionWatchdog = setTimeout(() => {
      if (!session.sock?.user && session.qrCodeData === null) {
        console.log(`Connection watchdog triggered for ${companyId}: no progress in 2 minutes. Restarting...`);
        connectToWhatsApp(companyId);
      }
    }, 120000);
    
    if (session.sock) {
      try {
        console.log(`Closing existing socket for ${companyId} before new connection...`);
        const oldSock = session.sock;
        session.sock = null; 
        oldSock.ev.removeAllListeners('connection.update');
        oldSock.ev.removeAllListeners('creds.update');
        oldSock.ev.removeAllListeners('messages.upsert');
        oldSock.end();
        await new Promise(resolve => setTimeout(resolve, 2000)); // Wait for cleanup
      } catch (e) {
        console.error(`Error cleaning up existing socket for ${companyId}:`, e);
      }
    }

    try {
      const authFolder = `auth_info_baileys_${companyId}`;
      const { state, saveCreds } = await useMultiFileAuthState(authFolder);
      
      const version: any = [2, 3000, 1015901307]; 
      console.log(`Using stable WhatsApp version ${version.join('.')} for ${companyId}`);
      
      session.sock = makeWASocket({
        version,
        auth: state,
        printQRInTerminal: false,
        logger: pino({ level: 'silent' }),
        browser: ['Mac OS', 'Chrome', '114.0.5735.198'],
        connectTimeoutMs: 120000,
        defaultQueryTimeoutMs: 120000,
        keepAliveIntervalMs: 60000,
        generateHighQualityLinkPreview: false,
        syncFullHistory: false,
        markOnlineOnConnect: false,
        retryRequestDelayMs: 15000,
        transactionOpts: { maxCommitRetries: 10, delayBetweenTriesMs: 3000 },
      });

      session.sock.ev.on('creds.update', async () => {
        await saveCreds();
      });

      session.sock.ev.on('connection.update', async (update: any) => {
        const { connection, lastDisconnect, qr } = update;
        
        if (connection || lastDisconnect || qr) {
          console.log(`Connection update for ${companyId}: ${connection || 'status'} ${qr ? '(QR generated)' : ''}`);
        }

        const error = lastDisconnect?.error;
        const statusCode = error?.output?.statusCode;
        const errorMsg = error?.message || error?.output?.payload?.message || '';
        const errorPayload = error?.output?.payload?.error || '';
        
        const isConflict = errorMsg.toLowerCase().includes('conflict') || 
                          errorPayload.toLowerCase().includes('conflict') || 
                          statusCode === 409 || statusCode === 440;
                          
        const isStreamError = errorMsg.includes('Stream Errored') || 
                             errorPayload.includes('Stream Errored') || 
                             statusCode === 515;
                             
        const isInitError = (errorMsg.includes('content') && errorMsg.includes('undefined')) ||
                           (errorMsg.includes('init') && errorMsg.includes('query'));

        if (isConflict || isStreamError || isInitError) {
          const type = isConflict ? 'Conflict (Logged in elsewhere)' : (isInitError ? 'Initialization Error' : 'Stream Error');
          console.error(`[WhatsApp ${companyId}] ${type} detected. Status: ${statusCode}. Message: ${errorMsg}`);
          
          session.isConnecting = false;
          
          if (isConflict) {
            session.conflictCount++;
            if (session.conflictCount > 3) {
              console.log(`[WhatsApp ${companyId}] Persistent conflict. Clearing session to force new login...`);
              await clearBaileysSession(companyId);
              session.reconnectTimer = setTimeout(() => connectToWhatsApp(companyId), 5000);
              return;
            }
          }

          if (session.sock) {
            try {
              const s = session.sock;
              session.sock = null;
              s.ev.removeAllListeners('connection.update');
              s.ev.removeAllListeners('creds.update');
              s.ev.removeAllListeners('messages.upsert');
              s.end(undefined);
            } catch (e) {}
          }

          const delay = (isConflict || isInitError) ? Math.min(120000, 30000 * session.conflictCount) : 5000;
          console.log(`Scheduling reconnection for ${companyId} in ${delay/1000} seconds due to ${type}...`);
          session.reconnectTimer = setTimeout(() => connectToWhatsApp(companyId), delay || 5000);
          return;
        }
        
        if (qr) {
          if (session.connectionWatchdog) clearTimeout(session.connectionWatchdog);
          try {
            session.qrCodeData = await qrcode.toDataURL(qr);
            io.emit('qr', { companyId, qr: session.qrCodeData });
          } catch (err) {
            console.error(`Error generating QR DataURL for ${companyId}:`, err);
          }
        }

        if (connection === 'close') {
          session.isConnecting = false;
          const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
          
          if (shouldReconnect) {
            const delay = (isConflict || isInitError) ? Math.min(120000, 30000 * session.conflictCount) : 5000;
            console.log(`[WhatsApp ${companyId}] Connection closed. Reconnecting in ${delay/1000}s...`);
            session.reconnectTimer = setTimeout(() => connectToWhatsApp(companyId), delay || 5000);
          } else {
            console.log(`[WhatsApp ${companyId}] Logged out. Session cleared.`);
            session.conflictCount = 0;
            session.qrCodeData = null;
            io.emit('qr', { companyId, qr: null });
            io.emit('whatsapp-disconnected', { companyId });
          }
        } else if (connection === 'open') {
          session.isConnecting = false;
          session.conflictCount = 0;
          if (session.connectionWatchdog) clearTimeout(session.connectionWatchdog);
          console.log(`WhatsApp connection successfully opened for ${companyId}!`);
          session.qrCodeData = null;
          io.emit('whatsapp-ready', { companyId, user: session.sock?.user });
        }
      });

      session.sock.ev.on('messages.upsert', async (m: any) => {
        const msg = m.messages[0];
        if (!msg.message || msg.key.fromMe) return;

        const remoteJid = msg.key.remoteJid;
        const content = msg.message.conversation || msg.message.extendedTextMessage?.text;
        
        if (!content) return;

        try {
          // 1. Find conversation
          const convQuery = await dbAdmin.collection('conversations')
            .where('companyId', '==', companyId)
            .where('customerPhone', '==', remoteJid.split('@')[0])
            .get();
          
          let convDoc: any;
          if (convQuery.empty) {
            convDoc = await dbAdmin.collection('conversations').add({
              companyId: companyId,
              customerPhone: remoteJid.split('@')[0],
              lastMessage: content,
              lastMessageAt: FieldValue.serverTimestamp(),
              unreadCount: 1
            });
          } else {
            convDoc = convQuery.docs[0];
            await convDoc.ref.update({
              lastMessage: content,
              lastMessageAt: FieldValue.serverTimestamp(),
              unreadCount: FieldValue.increment(1)
            });
          }

          // 2. Check botPausedUntil
          const convData = convDoc.data ? convDoc.data() : (await convDoc.get()).data();
          if (convData.botPausedUntil && convData.botPausedUntil.toDate() > new Date()) {
            return;
          }

          // 3. Call Gemini with retry logic
          async function generateWithRetry(prompt: string, retries = 3, delay = 2000): Promise<string> {
            try {
              const response = await ai.models.generateContent({
                model: "gemini-3-flash-preview",
                contents: prompt,
              });
              return response.text || "Olá! Em que posso ajudar?";
            } catch (error: any) {
              const isRateLimit = error.message?.includes('429') || 
                                 error.message?.toLowerCase().includes('rate') ||
                                 error.message?.includes('quota');
              
              if (retries > 0 && isRateLimit) {
                console.log(`Rate limit hit, retrying in ${delay/1000}s... (${retries} retries left)`);
                await new Promise(resolve => setTimeout(resolve, delay));
                return generateWithRetry(prompt, retries - 1, delay * 2);
              }
              throw error;
            }
          }

          const prompt = `Responda a esta mensagem de cliente de uma oficina mecânica: "${content}". Seja profissional e prestativo.`;
          const reply = await generateWithRetry(prompt);

          // 4. Data Extraction
          try {
            const extractionPrompt = `Analise a mensagem do cliente: "${content}". 
            Extraia as seguintes informações se estiverem presentes (se não, deixe nulo):
            - nome_cliente
            - cpf_cliente
            - marca_veiculo
            - modelo_veiculo
            - placa_veiculo
            - problema_relatado

            Responda APENAS em JSON no formato:
            {
              "extracted": boolean,
              "data": {
                "customerName": string | null,
                "customerCpf": string | null,
                "vehicleBrand": string | null,
                "vehicleModel": string | null,
                "vehiclePlate": string | null,
                "problem": string | null
              }
            }`;
            
            const extractionResponse = await ai.models.generateContent({
              model: "gemini-3-flash-preview",
              contents: extractionPrompt,
              config: { responseMimeType: "application/json" }
            });
            
            const extraction = JSON.parse(extractionResponse.text || '{}');
            
            if (extraction.extracted && extraction.data) {
              console.log(`Extracted data from message for ${companyId}:`, extraction.data);
              const data = extraction.data;
              
              if (data.customerName || data.customerCpf) {
                const customerQuery = await dbAdmin.collection('customers')
                  .where('companyId', '==', companyId)
                  .where('phone', '==', remoteJid.split('@')[0])
                  .get();
                
                if (customerQuery.empty) {
                  await dbAdmin.collection('customers').add({
                    companyId: companyId,
                    name: data.customerName || 'Cliente WhatsApp',
                    cpf: data.customerCpf || '',
                    phone: remoteJid.split('@')[0],
                    createdAt: FieldValue.serverTimestamp()
                  });
                } else {
                  const customerDoc = customerQuery.docs[0];
                  const updateData: any = {};
                  if (data.customerName && !customerDoc.data().name) updateData.name = data.customerName;
                  if (data.customerCpf && !customerDoc.data().cpf) updateData.cpf = data.customerCpf;
                  if (Object.keys(updateData).length > 0) {
                    await customerDoc.ref.update(updateData);
                  }
                }
              }
              
              if (data.vehiclePlate || data.vehicleModel) {
                const vehicleQuery = await dbAdmin.collection('vehicles')
                  .where('companyId', '==', companyId)
                  .where('plate', '==', data.vehiclePlate || '')
                  .get();
                
                if (vehicleQuery.empty && data.vehiclePlate) {
                  await dbAdmin.collection('vehicles').add({
                    companyId: companyId,
                    plate: data.vehiclePlate,
                    brand: data.vehicleBrand || '',
                    model: data.vehicleModel || '',
                    createdAt: FieldValue.serverTimestamp()
                  });
                }
              }
            }
          } catch (e) {
            console.error('Error in data extraction:', e);
          }

          // 5. Send response via WhatsApp API
          await session.sock.sendMessage(remoteJid, { text: reply });

          // 6. Update Firestore
          const batch = dbAdmin.batch();
          
          const customerMsgRef = convDoc.ref.collection('messages').doc();
          batch.set(customerMsgRef, {
            content: content,
            senderType: 'customer',
            createdAt: FieldValue.serverTimestamp()
          });
          
          const companyMsgRef = convDoc.ref.collection('messages').doc();
          batch.set(companyMsgRef, {
            content: reply,
            senderType: 'company',
            createdAt: FieldValue.serverTimestamp()
          });
          
          batch.update(convDoc.ref, {
            lastMessage: reply,
            lastMessageAt: FieldValue.serverTimestamp()
          });
          
          await batch.commit();
          console.log(`Conversation and messages updated in Firestore for ${companyId}`);
        } catch (error) {
          console.error(`Error processing message for ${companyId}:`, error);
        }
      });

    } catch (error) {
      session.isConnecting = false;
      console.error(`Critical error in connectToWhatsApp for ${companyId}:`, error);
      session.reconnectTimer = setTimeout(() => connectToWhatsApp(companyId), 15000);
    }
  }

  // Socket.io Logic
  io.on('connection', (socket) => {
    console.log('Client connected to socket.io:', socket.id);
    
    socket.on('get-status', ({ companyId }) => {
      if (!companyId) return;
      console.log(`Client requested status for company ${companyId}`);
      
      // Initialize connection if it doesn't exist
      if (!sessions.has(companyId)) {
        connectToWhatsApp(companyId);
      }
      
      const session = getSession(companyId);
      if (session.qrCodeData) {
        socket.emit('qr', { companyId, qr: session.qrCodeData });
      } else if (session.sock?.user) {
        socket.emit('whatsapp-ready', { companyId, user: session.sock.user });
      }
    });
    
    socket.on('reconnect-whatsapp', async ({ companyId }) => {
      if (!companyId) return;
      console.log(`Reconnecting WhatsApp and clearing session for ${companyId}...`);
      await clearBaileysSession(companyId);
      const session = getSession(companyId);
      session.reconnectTimer = setTimeout(() => connectToWhatsApp(companyId), 1000);
    });

    socket.on('send-message', async ({ companyId, conversationId, to, message }) => {
      if (!companyId) return;
      const session = getSession(companyId);
      
      if (!session.sock?.user) {
        console.error(`Cannot send message: WhatsApp not connected for ${companyId}`);
        return;
      }

      try {
        await session.sock.sendMessage(to + '@s.whatsapp.net', { text: message });

        const convRef = dbAdmin.collection('conversations').doc(conversationId);
        const msgRef = convRef.collection('messages').doc();
        
        const batch = dbAdmin.batch();
        batch.set(msgRef, {
          content: message,
          senderType: 'company',
          createdAt: FieldValue.serverTimestamp()
        });
        batch.update(convRef, {
          lastMessage: message,
          lastMessageAt: FieldValue.serverTimestamp()
        });
        await batch.commit();
        console.log(`Message sent to ${to} and saved to Firestore for ${companyId}`);
      } catch (e) {
        console.error(`Error sending message for ${companyId}:`, e);
      }
    });
  });

  // Vite middleware
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
