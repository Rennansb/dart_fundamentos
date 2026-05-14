import path from "path";
import fs from "fs";
import "dotenv/config";
import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { createServer as viteCreateServer } from "vite";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion, Browsers, downloadMediaMessage } from "@whiskeysockets/baileys";
import qrcode from "qrcode";
import pino from "pino";
import * as admin from 'firebase-admin';
import { initializeApp as initializeClientApp, getApps as getClientApps, deleteApp as deleteClientApp } from "firebase/app";
import { processAILogic } from "./ai_agent";
import { callAiWithFallback } from "./aiEngine";
import { 
  getFirestore as getClientFirestore, 
  collection, 
  query, 
  where, 
  getDocs, 
  addDoc, 
  updateDoc, 
  doc, 
  getDoc, 
  setDoc, 
  serverTimestamp, 
  increment,
  onSnapshot,
  writeBatch,
  limit,
  arrayUnion
} from "firebase/firestore";
import { getAuth as getClientAuth, signInWithEmailAndPassword } from "firebase/auth";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { subMonths, format, startOfDay, endOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
});

async function startServer() {
  let db: any = null;
  // Load Firebase Config
  const firebaseConfigPath = path.join(process.cwd(), "firebase-applet-config.json");
  let firebaseConfig: any = null;
  if (fs.existsSync(firebaseConfigPath)) {
    try {
      firebaseConfig = JSON.parse(fs.readFileSync(firebaseConfigPath, "utf8"));
    } catch (e) {
      console.error("Error parsing firebase-applet-config.json:", e);
    }
  }

  try {
    if (!admin.apps || admin.apps.length === 0) {
      admin.initializeApp({
        projectId: firebaseConfig?.projectId
      });
      console.log("[Firestore] Admin SDK initialized.");
    }
  } catch (e: any) {
    console.error("[Firestore] Admin SDK low-level init failed, skipping if not needed:", e.message);
  }

  try {
    // Initialize Client SDK for authentication and Firestore on Render
    const clientApp = initializeClientApp(firebaseConfig);
    const clientAuth = getClientAuth(clientApp);
    db = getClientFirestore(clientApp, firebaseConfig?.firestoreDatabaseId || "(default)");
    
    // Auth as system user to gain permissions
    try {
      await signInWithEmailAndPassword(clientAuth, "megga11@hotmail.com", "12345678");
      console.log("[Firestore] Client Auth successful as megga11@hotmail.com");
    } catch (authError: any) {
      console.error("[Firestore] Client Auth failed:", authError.message);
    }

    console.log("[Firestore] Client SDK initialized with database:", firebaseConfig?.firestoreDatabaseId || "(default)");
    console.log("[Firestore] Project ID:", firebaseConfig?.projectId);
    
    // Test connection and DATABASE ID validation
    const testDoc = await getDoc(doc(db, 'test', 'connection'));
    console.log("[Firestore] Connection test read success. Exists:", testDoc.exists());

    await setDoc(doc(db, 'test', 'connection'), {
      lastTest: serverTimestamp(),
      serverStatus: 'online',
      testedBy: 'server-client-sdk-auth',
      dbId: firebaseConfig?.firestoreDatabaseId || "(default)"
    }, { merge: true });
    console.log("[Firestore] Client SDK connection test write successful.");

    // Validate if current user exists in THIS database
    const userTest = await getDoc(doc(db, 'users', '09sGLpwNnqSZC5bGoEKJl0r1myZ2'));
    if (userTest.exists()) {
      console.log("[Firestore] VALIDATION SUCCESS: Admin user found in this database.");
    } else {
      console.warn("[Firestore] VALIDATION WARNING: Admin user NOT found in this database. Are we in the right DB?");
    }
  } catch (e: any) {
    console.error("[Firestore] Admin SDK initialization failed:", e.message);
    console.error(e.stack);
  }

  // WhatsApp state per company
  interface CompanySession {
    sock: any;
    qrCodeData: string | null;
    connectionWatchdog: NodeJS.Timeout | null;
    lastConnectAttempt: number;
    isConnecting: boolean;
    isConnected: boolean;
    conflictCount: number;
    streamErrorCount: number;
    reconnectTimer: NodeJS.Timeout | null;
    timeoutCount: number;
  }
  const sessions = new Map<string, CompanySession>();
  const ADMIN_COMPANY_ID = '09sGLpwNnqSZC5bGoEKJl0r1myZ2';

  // ─── Firestore Auth State para Baileys ────────────────────────────────────
  // Estratégia "Disco + Backup Firestore":
  // 1. Na conexão: se o disco não tem auth, restaura do Firestore
  // 2. No saveCreds: usa o useMultiFileAuthState normal (confiável) + faz backup no Firestore
  // Isso evita reimplementar o protocolo Signal do Baileys e garante estabilidade.
  async function useFirestoreAuthState(companyId: string) {
    const authFolder = `auth_info_baileys_${companyId}`;
    const credsPath = `${authFolder}/creds.json`;
    const docRef = doc(db, 'whatsapp_sessions', companyId);

    // Se a pasta de auth não existe ou está vazia, tenta restaurar do Firestore
    const needsRestore = !fs.existsSync(credsPath);
    if (needsRestore) {
      try {
        console.log(`[WA Auth] Disco vazio para ${companyId}. Tentando restaurar do Firestore...`);
        const snap = await getDoc(docRef);
        if (snap.exists() && snap.data()?.files) {
          const files = snap.data()!.files as Record<string, string>;
          if (!fs.existsSync(authFolder)) fs.mkdirSync(authFolder, { recursive: true });
          for (const [filename, content] of Object.entries(files)) {
            fs.writeFileSync(`${authFolder}/${filename}`, Buffer.from(content, 'base64'));
          }
          console.log(`[WA Auth] Credenciais restauradas do Firestore para ${companyId} (${Object.keys(files).length} arquivos)`);
        } else {
          console.log(`[WA Auth] Nenhuma credencial no Firestore para ${companyId}. Iniciando sessão nova (QR necessário).`);
        }
      } catch (e) {
        console.warn(`[WA Auth] Falha ao restaurar do Firestore, continuando com disco vazio:`, e);
      }
    }

    // Usa o método oficial e confiável do Baileys (baseado em disco)
    const { state, saveCreds: originalSaveCreds } = await useMultiFileAuthState(authFolder);

    // Wrapper do saveCreds: salva no disco E faz backup no Firestore
    const saveCreds = async () => {
      await originalSaveCreds();
      // Faz backup assíncrono dos arquivos para o Firestore (não bloqueia o fluxo)
      setImmediate(async () => {
        try {
          if (!fs.existsSync(authFolder)) return;
          const allFiles = fs.readdirSync(authFolder);
          const fileMap: Record<string, string> = {};
          for (const f of allFiles) {
            const fp = `${authFolder}/${f}`;
            if (fs.statSync(fp).isFile()) {
              fileMap[f] = fs.readFileSync(fp).toString('base64');
            }
          }
          await setDoc(docRef, {
            files: fileMap,
            companyId,
            updatedAt: serverTimestamp()
          }, { merge: true });
          console.log(`[WA Auth] Backup Firestore atualizado para ${companyId} (${Object.keys(fileMap).length} arquivos)`);
        } catch (e) {
          console.warn(`[WA Auth] Falha no backup Firestore para ${companyId}:`, e);
        }
      });
    };

    return { state, saveCreds };
  }


  // HELPER: Create User Account (Unified for Bot and Webhook)
  async function createUserAccount(userData: {
    email: string, 
    name: string, 
    document: string, 
    role: string, 
    phone: string, 
    plan: string,
    shopName?: string,
    dob?: string,
    cep?: string,
    address?: string,
    establishmentType?: string,
    segments?: string
  }) {
    console.log(`[UserCreation] Creating ${userData.role} account for ${userData.email}...`);
    try {
      // Create Firebase Auth user
      const userRecord = await admin.auth().createUser({
        email: userData.email,
        password: '12345678',
        displayName: userData.name
      });
      
      const uid = userRecord.uid;
      
      // Create Firestore User Document
      await setDoc(doc(db, 'users', uid), {
        uid,
        name: userData.name,
        shopName: userData.shopName || userData.name,
        email: userData.email,
        cpfCnpj: userData.document,
        dob: userData.dob || '',
        role: userData.role,
        phone: userData.phone.replace(/\D/g, ''),
        plan: userData.plan || 'start',
        planStatus: 'active',
        planExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        cep: userData.cep || '',
        address: userData.address || '',
        establishmentType: userData.establishmentType || '',
        segments: userData.segments || 'automotivo',
        segment: 'automotivo', 
        createdAt: serverTimestamp()
      });

      console.log(`[UserCreation] Success: ${uid}`);
      return uid;
    } catch (err: any) {
      console.error("[UserCreation Error]:", err.message);
      throw err;
    }
  }

  const app = express();
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));

  console.log(`[AI] GEMINI_API_KEY check: ${process.env.GEMINI_API_KEY ? 'AVAILABLE' : 'MISSING (Please check Render environment variables)'}`);
  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: { origin: "*" },
    pingTimeout: 60000,
    pingInterval: 25000
  });

  const PORT = Number(process.env.PORT) || 3000;

  // IA Visual Endpoint
  app.post("/api/vision/analyze", async (req, res) => {
    const { image } = req.body;
    if (!image) return res.status(400).json({ error: "No image provided" });

    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) throw new Error("GEMINI_API_KEY not set");

      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
      const prompt = `Analise esta imagem de um orçamento de oficina ou foto de veículo. Extraia em JSON: 
                { 
                  "brand": string, 
                  "model": string, 
                  "year": string, 
                  "plate": string, 
                  "suggestions": string[] (lista de peças identificadas)
                } 
                Responda APENAS o JSON puro.`;

      const result = await model.generateContent([
        { text: prompt },
        { inlineData: { data: image.split(",")[1] || image, mimeType: 'image/jpeg' } }
      ]);
      const output = result.response.text();
      const cleanJson = output.replace(/```json|```/g, "").trim();
      res.json(JSON.parse(cleanJson));
    } catch (err: any) {
      console.error("[Vision Error]:", err.message);
      res.status(500).json({ error: "Failed to analyze image" });
    }
  });

  // Business Health Analysis Endpoint (Server-Side to protect API Key and ensure connectivity)
  app.post("/api/ai/analyze-health", async (req, res) => {
    const { data, userId, companyId } = req.body;
    if (!data) return res.status(400).json({ error: "No data provided" });

    try {
      const prompt = `Você é um Consultor de Gestão de Elite, especialista em recuperação e escalonamento de empresas do setor automotivo.
      Sua missão é realizar um diagnóstico profundo com base nos dados reais desta oficina:

      📊 INDICADORES FINANCEIROS:
      - Receita Total: R$ ${data.totalRevenue}
      - Despesas Totais: R$ ${data.totalExpenses}
      - Margem de Lucro: ${(data.profitMargin || 0).toFixed(2)}%
      - Valor Pendente em Orçamentos: R$ ${data.totalBudgetsValue}
      - Orçamentos Pendentes (Leads): ${data.pendingBudgets}

      📦 OPERAÇÕES E ESTOQUE:
      - Valor Total em Estoque: R$ ${data.inventoryValue}
      - Itens abaixo do Mínimo: ${data.lowStockItems}
      - O.S. em Aberto: ${data.activeWorkOrders}
      - O.S. Concluídas: ${data.completedWorkOrders}
      - Agendamentos Futuros: ${data.upcomingAppointments}

      ⭐ TOP PRODUTOS/SERVIÇOS (Giro):
      ${(data.topItems || []).map((i: any) => `- ${i.name}: ${i.qty} unidades`).join('\n')}

      Forneça um diagnóstico estruturado em Markdown com o seguinte tom: Profissional, Pragmático e focado em Lucratividade.
      
      ESTRUTURA DO RELATÓRIO:
      1. **Diagnóstico de Saúde**: Analise a relação Vendas vs Despesas. O negócio está sendo lucrativo? O ticket médio está sustentável?
      2. **Análise de Estoque e Leads**: Avalie se há dinheiro "parado" em estoque ou oportunidades perdidas em orçamentos não fechados.
      3. **Gargalos Operacionais**: Com base no volume de O.S. e agendamentos, onde a operação pode travar?
      4. **Plano de Dominação (Próximos 30 dias)**:
         - **Ação 1 (Venda Ativa)**: Como converter os orçamentos pendentes?
         - **Ação 2 (Gestão)**: O que ajustar nas despesas ou estoque imediatamente?
         - **Ação 3 (Retenção)**: Como usar os agendamentos para garantir fluxo?

      Seja extremamente específico e use os números fornecidos acima.`;

      const response = await callAiWithFallback([{ role: "user", content: prompt }], 'BUSINESS_HEALTH');
      
      res.json({ analysis: response });
    } catch (err: any) {
      console.error("[Health AI Error]:", err.message);
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Global AI Assistant Chat (Stateless for Visitors)
  app.post("/api/ai/chat", async (req, res) => {
    const { message, history } = req.body;
    if (!message) return res.status(400).json({ error: "Mensagem vazia." });

    try {
      const messages = [
        ...(history || []).map((h: any) => ({
          role: h.role === 'user' ? 'user' : 'assistant',
          content: h.content
        })),
        { role: "user", content: message }
      ];

      const responseText = await callAiWithFallback(messages, 'VISITOR');
      res.json({ response: responseText });
    } catch (err: any) {
      console.error("[General AI Chat Error]:", err.message);
      res.status(500).json({ error: "Erro ao processar IA: " + err.message });
    }
  });

  // Specialized AI Assistant for logged-in users (STORE/GENERAL)
  app.post("/api/ai/assistant", async (req, res) => {
    const { message, history, role = 'STORE' } = req.body;
    try {
      const messages = [
        ...(history || []).map((h: any) => ({ role: h.role, content: h.content })),
        { role: "user", content: message }
      ];
      const response = await callAiWithFallback(messages, role as any);
      res.json({ response });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Admin Sales Assistant (ADMIN)
  app.post("/api/ai/sales", async (req, res) => {
    const { message, history } = req.body;
    try {
      const messages = [
        ...(history || []).map((h: any) => ({ role: h.role, content: h.content })),
        { role: "user", content: message }
      ];
      const response = await callAiWithFallback(messages, 'ADMIN');
      res.json({ response });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });


  // Technical Assistant Helper
  app.post("/api/ai/technical-help", async (req, res) => {
    const { vehicleInfo, symptoms, history } = req.body;
    try {
      const messages = [
        ...(history || []).map((h: any) => ({ role: h.role, content: h.content })),
        { role: "user", content: `VEÍCULO: ${vehicleInfo}\nSINTOMAS: ${symptoms}` }
      ];
      const response = await callAiWithFallback(messages, 'TECHNICAL_ADVISOR');
      res.json({ response });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Multimodal Diagnosis Endpoint
  app.post("/api/ai/diagnose", async (req, res) => {
    const { message, images, audioTranscript, vehicleInfo } = req.body;
    try {
      const prompt = `VEÍCULO: ${vehicleInfo || 'Não especificado'}
        DESCRIÇÃO DO CLIENTE: ${message || 'Não especificada'}
        ${audioTranscript ? `TRANSCRIÇÃO DE ÁUDIO: ${audioTranscript}` : ''}
        
        Analise o cenário acima e forneça um diagnóstico técnico, lista de possíveis peças e serviços necessários. 
        Formate como JSON: {"diagnosis": "...", "parts": [{"name": "...", "estimatedPrice": 0}], "services": [{"name": "...", "estimatedPrice": 0}]}`;
      
      const response = await callAiWithFallback([{ role: "user", content: prompt }], 'DIAGNOSIS', undefined, images);
      
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      const result = jsonMatch ? JSON.parse(jsonMatch[0]) : { diagnosis: response };
      
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/debug/status", (req, res) => {
    res.json({
      firebase: !!db,
      sessions: Array.from(sessions.keys()),
      gemini: !!process.env.GEMINI_API_KEY,
      env: process.env.NODE_ENV,
      timestamp: new Date().toISOString()
  });
  });

  // Mercado Pago Configuration
  const MP_ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN;
  
  if (!MP_ACCESS_TOKEN) {
    console.error('CRITICAL: MP_ACCESS_TOKEN is missing in .env');
  } else if (MP_ACCESS_TOKEN.startsWith('APP_USR')) {
    console.log('Using Mercado Pago LIVE Access Token');
  } else if (MP_ACCESS_TOKEN.startsWith('TEST')) {
    console.log('Using Mercado Pago SANDBOX Access Token');
  } else {
    console.warn('Unknown Mercado Pago Access Token format');
  }

  // Create PIX Payment
  app.post("/api/payments/create", async (req, res) => {
    const { type, amount, metadata, payer } = req.body;
    
    if (!amount || !type) return res.status(400).json({ error: "Missing required fields" });

    try {
      console.log(`[MercadoPago] Creating ${type} payment of R$ ${amount}`);
      
        const payload = {
          transaction_amount: Number(amount),
          description: type === 'subscription' ? 'Assinatura Service Hub' : `Pedido #${metadata.orderId}`,
          payment_method_id: 'pix',
          installments: 1,
          binary_mode: true,
          payer: {
            email: payer.email || 'contato@servicehub.com',
            first_name: payer.name?.split(' ')[0] || 'Cliente',
            last_name: payer.name?.split(' ').slice(1).join(' ') || 'Hub',
            identification: {
              type: 'CPF',
              number: payer.cpf.replace(/\D/g, '')
            }
          },
          notification_url: process.env.APP_URL?.startsWith('https') ? `${process.env.APP_URL}/api/payments/webhook` : undefined,
          metadata: {
            ...metadata,
            payment_type: type
          }
        };

      const response = await fetch("https://api.mercadopago.com/v1/payments", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${MP_ACCESS_TOKEN}`,
          "Content-Type": "application/json",
          "X-Idempotency-Key": `${type}_${Date.now()}`
        },
        body: JSON.stringify(payload)
      });

      const data = await response.json();
      
      if (!response.ok) {
          const errorData = data;
          console.error('Mercado Pago Error Details:', JSON.stringify(errorData, null, 2));
          
          let friendlyMessage = errorData.message || 'Erro ao processar pagamento no Mercado Pago';
          
          if (friendlyMessage.includes('Unauthorized use of live credentials') || response.status === 401) {
            friendlyMessage = 'Erro de Credenciais (401): O Mercado Pago recusou seu token de Produção. VÍDEO TUTORIAL: Verifique se você NÃO está tentando pagar com o MESMO CPF ou EMAIL da conta que recebe o dinheiro (autopagamento é proibido). Além disso, sua conta deve estar homologada para PIX no painel do desenvolvedor.';
          }

          return res.status(response.status).json({ 
            error: friendlyMessage,
            details: errorData
          });
        }

      res.json({
        id: data.id,
        status: data.status,
        qrCode: data.point_of_interaction.transaction_data.qr_code,
        qrCodeBase64: data.point_of_interaction.transaction_data.qr_code_base64,
        ticketUrl: data.point_of_interaction.transaction_data.ticket_url
      });
    } catch (err: any) {
      console.error("[Payment Creation Error]:", err.message);
      res.status(500).json({ error: err.message });
    }
  });

  // Reset User Password (Admin only)
  app.post("/api/admin/reset-password", async (req, res) => {
    const { uid, adminUid } = req.body;
    
    if (!uid || !adminUid) return res.status(400).json({ error: "Missing uid or adminUid" });

    try {
      // 1. Verify if requester is actually an admin
      const adminDoc = await getDoc(doc(db, 'users', adminUid));
      if (!adminDoc.exists() || adminDoc.data()?.role !== 'admin') {
        return res.status(403).json({ error: "Forbidden: Only admins can reset passwords." });
      }

      // 2. Generate random 8-char password
      const randomPassword = Math.random().toString(36).slice(-8) + Math.floor(Math.random() * 10);
      
      // 3. Update password via Admin SDK
      await admin.auth().updateUser(uid, {
        password: randomPassword
      });

      // 4. Set forcePasswordChange flag in Firestore
      await updateDoc(doc(db, 'users', uid), {
        forcePasswordChange: true,
        updatedAt: serverTimestamp()
      });

      console.log(`[Admin] Password reset successful for ${uid} by admin ${adminUid}`);
      res.json({ success: true, newPassword: randomPassword });
    } catch (err: any) {
      console.error("[Admin Reset Password Error]:", err.message);
      res.status(500).json({ error: err.message });
    }
  });

  // Webhook for Payment Confirmation
  app.post("/api/payments/webhook", async (req, res) => {
    const { action, data } = req.body;
    
    if (action === "payment.updated" && data?.id) {
      try {
        const response = await fetch(`https://api.mercadopago.com/v1/payments/${data.id}`, {
          headers: { "Authorization": `Bearer ${MP_ACCESS_TOKEN}` }
        });
        const payment = await response.json();

        if (payment.status === "approved" && db) {
          const { payment_type, companyId, orderId, userId } = payment.metadata;
          console.log(`[Webhook] Payment APPROVED for ${payment_type}:`, { companyId, orderId });

          if (payment.metadata.onboarding === 'true' || payment.metadata.onboarding === true) {
            const { email, fullName: name, document, role, phone, plan, shopName, dob, cep, address, establishmentType, segments } = payment.metadata;
            console.log(`[Onboarding Webhook] Payment confirmed for ${email}. Finalizing registration...`);
            
            try {
              const uid = await createUserAccount({
                email, name, document, role, phone, plan, shopName, dob, cep, address, establishmentType, segments
              });

              // Welcome message via WhatsApp
              const adminSession = sessions.get(ADMIN_COMPANY_ID);
              if (adminSession?.isConnected && adminSession.sock) {
                const welcomeMsg = `🎉 *CONTA ATIVA!* 🚀\n\nOlá *${name}*! Seu pagamento foi confirmado e seu acesso ao Service Hub está LIBERADO!\n\n🔗 *Site:* ${process.env.APP_URL || 'https://service-hub-joz0.onrender.com'}\n📧 *Login:* ${email}\n🔑 *Senha Padrão:* 12345678\n\n_⚠️ Por segurança, altere sua senha no primeiro acesso._\n\nSucesso e ótimos negócios! 🏁`;
                await adminSession.sock.sendMessage(phone + '@s.whatsapp.net', { text: welcomeMsg });
              }
            } catch (err: any) {
              console.error("[Onboarding Webhook Error]:", err.message);
            }
          } else if (payment_type === "subscription") {
            // Add 30 days to subscription
            const companyRef = doc(db, 'users', userId || companyId);
            const companySnap = await getDoc(companyRef);
            
            if (companySnap.exists()) {
              const currentExpiry = companySnap.data().planExpiresAt?.toDate() || new Date();
              const months = Number(payment.metadata.durationMonths) || 1;
              const startDate = currentExpiry > new Date() ? currentExpiry : new Date();
              const newExpiry = new Date(startDate.getTime() + (months * 30 * 24 * 60 * 60 * 1000));
              
              await updateDoc(companyRef, {
                plan: payment.metadata.planType || 'pro',
                planExpiresAt: newExpiry,
                planStatus: 'active',
                lastPaymentId: payment.id,
                updatedAt: serverTimestamp()
              });
              console.log(`[Subscription] Extended for ${companyId} until ${newExpiry.toISOString()}`);
            }
          } else if (payment_type === "order") {
            const orderIds = payment.metadata.orderIds ? payment.metadata.orderIds.split(',') : (orderId ? [orderId] : []);
            console.log(`[Webhook] Processing ${orderIds.length} orders for payment ${payment.id}`);

            for (const id of orderIds) {
              const orderRef = doc(db, 'purchase_orders', id);
              const orderSnap = await getDoc(orderRef);
              
              if (orderSnap.exists()) {
                const orderData = orderSnap.data();
                const amount = orderData.total;
                const platformFee = amount * 0.03;
                const supplierPayout = amount - platformFee;

                await updateDoc(orderRef, {
                  status: 'aguardando_entregador', // Funds held by platform
                  paymentStatus: 'pago',
                  paymentId: payment.id,
                  escrowStatus: 'held',
                  platformCommission: platformFee,
                  commissionAmount: platformFee,
                  supplierAmount: supplierPayout,
                  commissionPaid: false,
                  paidAt: serverTimestamp(),
                  updatedAt: serverTimestamp()
                });
                console.log(`[Order] Payment HELD in Escrow for #${id}. Fee: ${platformFee}`);

                // Send notification to supplier
                if (orderData.supplierId) {
                  await addDoc(collection(db, 'notifications'), {
                    companyId: orderData.supplierId,
                    title: 'Pagamento Aprovado 💰',
                    message: `Pagamento do pedido #${id.substring(0,8)} confirmado pela loja. Agora está aguardando você enviar a entrega.`,
                    type: 'INFO',
                    link: '/app/supplier/orders',
                    read: false,
                    createdAt: serverTimestamp(),
                    updatedAt: serverTimestamp()
                  });
                }

                // AUTO-UPDATE LINKED WORK ORDER
                if (orderData.workOrderId) {
                  const woRef = doc(db, 'work_orders', orderData.workOrderId);
                  await updateDoc(woRef, {
                    status: 'pending',
                    timeline: arrayUnion({
                      type: 'status_change',
                      content: `Pagamento aprovado via Mercado Pago (Pedido #${id.substring(0,8)}). OS movida para "Aguardando Peça".`,
                      createdAt: new Date().toISOString()
                    })
                  });
                  console.log(`[Webhook] Linked WorkOrder ${orderData.workOrderId} updated to pending (Aguardando Peça)`);
                }
              }
            }
          }
        }
      } catch (err: any) {
        console.error("[Webhook Processing Error]:", err.message);
      }
    }
    
  res.status(200).send("OK");
  });

  // Endpoints para Fluxo de Entrega e Escrow
  app.post("/api/delivery/send", async (req, res) => {
    const { orderId, supplierId } = req.body;
    if (!orderId || !db) return res.status(400).json({ error: "Missing orderId" });

    try {
      const orderRef = doc(db, 'purchase_orders', orderId);
      const orderSnap = await getDoc(orderRef);
      if (!orderSnap.exists()) return res.status(404).json({ error: "Order not found" });

      const deliveryCode = Math.floor(100000 + Math.random() * 900000).toString(); // 6 digits
      await updateDoc(orderRef, {
        status: 'peça encaminhada',
        deliveryCode,
        shippedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        notified: false // Trigger WhatsApp alert for Shop
      });

      console.log(`[Escrow] Order ${orderId} marked as shipped. Code generated.`);
      res.json({ success: true, deliveryCode });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/delivery/confirm", async (req, res) => {
    const { orderId, code, shopId } = req.body;
    if (!orderId || !code || !db) return res.status(400).json({ error: "Missing data" });

    try {
      const orderRef = doc(db, 'purchase_orders', orderId);
      const orderSnap = await getDoc(orderRef);
      if (!orderSnap.exists()) return res.status(404).json({ error: "Order not found" });

      const order = orderSnap.data();
      if (order.deliveryCode !== code) {
        return res.status(400).json({ error: "Código de entrega inválido." });
      }

      // RELEASE FUNDS Logic: 3% commission
      const amount = order.total || 0;
      const platformFee = amount * 0.03;
      const supplierPayout = amount - platformFee;

      await updateDoc(orderRef, {
        status: 'recebido',
        escrowStatus: 'released',
        receivedAt: serverTimestamp(),
        platformCommission: platformFee,
        supplierAmount: supplierPayout,
        commissionPaid: true,
        updatedAt: serverTimestamp()
      });

      // Notify Supplier via Firestore
      if (order.supplierId) {
        await addDoc(collection(db, 'notifications'), {
          companyId: order.supplierId,
          title: 'Pagamento Liberado! 💰',
          message: `O pedido #${orderId.substring(0,8)} foi entregue e o valor de R$ ${supplierPayout.toFixed(2)} foi liberado em seu saldo.`,
          type: 'SUCCESS',
          read: false,
          createdAt: serverTimestamp()
        });
      }

      console.log(`[Escrow] Funds RELEASED for ${orderId}. Supplier gets R$ ${supplierPayout.toFixed(2)}`);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Monitoramento de Pedidos para Alertas via WhatsApp
  const startOrderMonitor = () => {
    if (!db) return;
    console.log("[Monitor] Iniciando observação de pedidos de compra...");
    const q = query(collection(db, 'purchase_orders'), where('status', '==', 'peça encaminhada'));
    
    onSnapshot(q, (snapshot: any) => {
      snapshot.docChanges().forEach(async (change: any) => {
        const order = change.doc.data();
        const orderId = change.doc.id;
        
        if ((change.type === 'added' || change.type === 'modified') && !order.notified) {
          const shopId = order.shopId;
          const session = sessions.get(shopId);

          if (session?.isConnected && session.sock) {
            try {
              const shopPhone = order.shopPhone || '71988648298';
              const message = `🚀 *Service Hub: Notícia Boa! Peça a Caminho!*\n\nOlá! As peças do seu pedido *#${orderId.substring(0,8)}* acabaram de ser encaminhadas pelo fornecedor *${order.supplierName}*. ✨\n\n🔑 *Código de Recebimento:* ${order.deliveryCode}\n📍 Você pode acompanhar tudo pelo App em tempo real!\n\nEstamos à disposição! 😊`;
              
              await session.sock.sendMessage(shopPhone + '@s.whatsapp.net', { text: message });
              await updateDoc(doc(db, 'purchase_orders', orderId), { notified: true });
              console.log(`[Notification] Alerta enviado para ${shopPhone} (Pedido ${orderId})`);
            } catch (err: any) {
              console.error(`[Notification Error] Falha ao enviar para ${orderId}:`, err.message);
            }
          }
        }
      });
    });
  };

  // Monitoramento de Ordens de Serviço para Alertas via WhatsApp ao Cliente
  const startWorkOrderMonitor = () => {
    if (!db) return;
    console.log("[Monitor] Iniciando observação de mudanças em Ordens de Serviço...");
    const q = query(collection(db, 'work_orders'));
    
    onSnapshot(q, (snapshot: any) => {
      snapshot.docChanges().forEach(async (change: any) => {
        const wo = change.doc.data();
        const woId = change.doc.id;
        
        if (change.type === 'modified' || change.type === 'added') {
          // Detectar mudança de status comparando com a versão anterior no snapshot
          const isNew = change.type === 'added';
          // No Firestore SDK client, o change.doc._snapshot pode não estar disponível da mesma forma
          // Para garantir, vamos usar um campo de controle ou simplesmente aceitar que qualquer 'modified' de status acione
          // Mas aqui em ambiente Node (server.ts) usando o Client SDK, o change.doc._snapshot.oldDoc existe?
          // Se não existir, o check abaixo vai falhar. Vamos usar uma abordagem mais segura:
          
          const companyId = wo.companyId;
          const session = sessions.get(companyId);

          if (session?.isConnected && session.sock) {
            try {
              const rawPhone = wo.customerPhone || '';
              const cleanPhone = rawPhone.replace(/\D/g, '');
              if (!cleanPhone || cleanPhone.length < 10) return;

              // Traduz o status
              const statusLabels: {[key: string]: string} = {
                'waiting_payment': 'Aguardando Pagamento das Peças',
                'pending': 'Aguardando Chegada das Peças',
                'in_repair': 'Seu veículo está em reparo 🔧',
                'completed': 'Reparo concluído! ✅',
                'delivered': 'Veículo entregue!',
                'diagnosing': 'Em diagnóstico técnico'
              };
              const displayStatus = statusLabels[wo.status] || wo.status;
              let message = `🛠️ *Service Hub: Atualização do seu Veículo*\n\nOlá, *${wo.customerName}*! Tudo bem? 😊\nO status do reparo do seu veículo (*${wo.brand} ${wo.model}*) foi atualizado:\n\n📍 *Status:* ${displayStatus}\n\nEstamos cuidando de tudo com o maior carinho para te entregar o melhor resultado possível! 🚗✨\n\nQualquer dúvida, é só nos chamar por aqui!`;
              
              if (wo.status === 'delivered') {
                message = `🌟 *Service Hub: Veículo Entregue com Sucesso!*\n\nOlá *${wo.customerName}*! Ficamos muito felizes em cuidar do seu *${wo.brand} ${wo.model}*. Esperamos que ele esteja rodando perfeitamente! 🚗💨\n\nSua opinião é fundamental para nós! Você poderia tirar um minutinho para nos avaliar com 5 estrelas? Isso nos ajuda muito a continuar oferecendo o melhor serviço:\n\n🔗 *Link de Avaliação:* https://g.page/r/sua-oficina/review\n\n_Muito obrigado pela confiança e dirija com segurança!_ 😊`;
              }

              await session.sock.sendMessage(cleanPhone + '@s.whatsapp.net', { text: message });
              console.log(`[WhatsApp Alert] Status update sent to ${cleanPhone} for WO ${woId}`);
            } catch (err: any) {
              console.error(`[WhatsApp Alert Error] ${woId}:`, err.message);
            }
          }
        }
      });
    });
  };

  // Monitoramento de Agendamentos para Notificar o Cliente
  const startAppointmentMonitor = () => {
    if (!db) return;
    console.log("[Monitor] Iniciando observação de Agendamentos...");
    const q = query(collection(db, 'appointments'));
    
    onSnapshot(q, (snapshot: any) => {
      snapshot.docChanges().forEach(async (change: any) => {
        const app = change.doc.data();
        const appId = change.doc.id;
        
        if (change.type === 'modified' && !app.notifiedStatus) {
          const companyId = app.companyId;
          const session = sessions.get(companyId);

          if (session?.isConnected && session.sock) {
            try {
              const cleanPhone = app.customerPhone;
              let message = "";
              
              if (app.status === 'approved') {
                message = `✅ *Agendamento Confirmado!*\n\nOlá *${app.customerName}*! Seu agendamento para o dia *${app.date.split('-').reverse().join('/')}* às *${app.time}* foi confirmado com sucesso.\n\nTe esperamos na oficina! 🔧🚗`;
              } else if (app.status === 'suggested') {
                message = `📅 *Service Hub: Sugestão de Horário*\n\nOlá *${app.customerName}*! Infelizmente não conseguimos te atender no horário solicitado, mas sugerimos o dia *${app.suggestedDate.split('-').reverse().join('/')}* às *${app.suggestedTime}*.\n\nEste horário funciona para você? Caso precise de outro, basta nos informar por aqui. 😊`;
              } else if (app.status === 'rejected') {
                message = `❌ *Agendamento não disponível*\n\nOlá *${app.customerName}*! Infelizmente não conseguimos realizar seu agendamento para este período. Por favor, entre em contato para verificarmos outras datas disponíveis.`;
              }

              if (message) {
                await session.sock.sendMessage(cleanPhone + '@s.whatsapp.net', { text: message });
                await updateDoc(doc(db, 'appointments', appId), { notifiedStatus: true });
                console.log(`[Appointment Alert] sent to ${cleanPhone} for ID ${appId}`);
              }
            } catch (err: any) {
              console.error(`[Appointment Alert Error] ${appId}:`, err.message);
            }
          }
        }
      });
    });
  };

  // Monitoramento de Reembolsos para Pedidos Cancelados
  const startRefundMonitor = () => {
    if (!db) return;
    console.log("[Monitor] Iniciando observação de reembolsos...");
    const q = query(collection(db, 'purchase_orders'), where('status', '==', 'cancelado'));
    
    onSnapshot(q, (snapshot: any) => {
      snapshot.docChanges().forEach(async (change: any) => {
        const order = change.doc.data();
        const orderId = change.doc.id;
        
        if (change.type === 'modified' && order.paymentStatus === 'pago' && !order.refunded) {
          try {
            console.log(`[Refund] Order ${orderId} cancelled. Processing automatic refund...`);
            
            const response = await fetch(`https://api.mercadopago.com/v1/payments/${order.paymentId}/refunds`, {
              method: "POST",
              headers: { 
                "Authorization": `Bearer ${MP_ACCESS_TOKEN}`,
                "X-Idempotency-Key": `refund_order_${orderId}`
              }
            });

            if (response.ok) {
              await updateDoc(doc(db, 'purchase_orders', orderId), {
                paymentStatus: 'estornado',
                escrowStatus: 'refunded',
                refunded: true,
                refundedAt: serverTimestamp(),
                updatedAt: serverTimestamp()
              });
              console.log(`[Refund] SUCCESS: Order ${orderId} refunded via Mercado Pago.`);
              // Notify shop via Firestore
              if (order.shopId) {
                await addDoc(collection(db, 'notifications'), {
                  companyId: order.shopId,
                  title: 'Pedido Estornado',
                  message: `O valor do pedido #${orderId.substring(0,8)} foi estornado 100% para sua conta.`,
                  type: 'INFO',
                  read: false,
                  createdAt: serverTimestamp()
                });
              }
            } else {
              const errData = await response.json();
              console.error(`[Refund Error] Mercado Pago rejected refund for ${orderId}:`, errData);
            }
          } catch (err: any) {
            console.error(`[Refund Error] Exception during refund for ${orderId}:`, err.message);
          }
        }
      });
    });
  };

  if (db) {
    startOrderMonitor();
    startWorkOrderMonitor();
    startAppointmentMonitor();
    startRefundMonitor();
  }


  function getSession(companyId: string): CompanySession {
    if (!sessions.has(companyId)) {
      sessions.set(companyId, {
        sock: null,
        qrCodeData: null,
        connectionWatchdog: null,
        lastConnectAttempt: 0,
        isConnecting: false,
        isConnected: false,
        conflictCount: 0,
        streamErrorCount: 0,
        reconnectTimer: null,
        timeoutCount: 0
      });
    }
    return sessions.get(companyId)!;
  }

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
        fs.rmSync(authFolder, { recursive: true, force: true });
        console.log(`Auth folder ${authFolder} deleted successfully`);
      } catch (e) {
        console.error(`Error deleting auth folder ${authFolder}:`, e);
      }
    }
    
    // Também remove do Firestore
    try {
      const { deleteDoc } = await import('firebase/firestore');
      await deleteDoc(doc(db, 'whatsapp_sessions', companyId));
      console.log(`[WA Auth] Firestore session cleared for ${companyId}`);
    } catch (e) {
      console.warn(`[WA Auth] Could not clear Firestore session for ${companyId}:`, e);
    }

    
    session.qrCodeData = null;
    io.emit('qr', { companyId, qr: null });
  }

  async function connectToWhatsApp(companyId: string) {
    console.log(`[WhatsApp] connectToWhatsApp called for companyId: ${companyId}`);
    const session = getSession(companyId);

    if (session.isConnecting) return;
    
    if (session.reconnectTimer) {
      clearTimeout(session.reconnectTimer);
      session.reconnectTimer = null;
    }

    const now = Date.now();
    if (now - session.lastConnectAttempt < 5000) {
      session.reconnectTimer = setTimeout(() => connectToWhatsApp(companyId), 5000);
      return;
    }
    console.log(`[WhatsApp] Starting connection for company: ${companyId}`);
    session.lastConnectAttempt = now;
    session.isConnecting = true;

    try {
      const authFolder = `auth_info_baileys_${companyId}`;
      console.log(`[WhatsApp] Using Firestore auth state for: ${companyId}`);
      
      let state: any, saveCreds: any;
      try {
        const firestoreAuth = await useFirestoreAuthState(companyId);
        state = firestoreAuth.state;
        saveCreds = firestoreAuth.saveCreds;
        console.log(`[WhatsApp] Firestore auth state loaded for ${companyId}`);
      } catch (fsErr) {
        // Fallback para disco local se Firestore falhar
        console.warn(`[WhatsApp] Firestore auth failed, falling back to disk for ${companyId}:`, fsErr);
        const diskAuth = await useMultiFileAuthState(authFolder);
        state = diskAuth.state;
        saveCreds = diskAuth.saveCreds;
      }

      let version;

      try {
        console.log(`[WhatsApp] Fetching latest Baileys version...`);
        const v = await fetchLatestBaileysVersion();
        version = v.version;
        console.log(`[WhatsApp] Using Baileys version: ${version}`);
      } catch (e) {
        console.warn("[WhatsApp] Failed to fetch latest Baileys version, using default", e);
        version = [2, 3000, 1015901307]; // Fallback version
      }
      
      console.log(`[WhatsApp] Creating socket for ${companyId}...`);
      session.sock = makeWASocket({
        version,
        auth: state,
        printQRInTerminal: false,
        logger: pino({ level: 'error' }), // Use error level for stability
        browser: ['Service Hub', 'Chrome', '1.0.0'],
        syncFullHistory: false, // Don't sync full history to save memory
        connectTimeoutMs: 60000,
        defaultQueryTimeoutMs: 60000,
        keepAliveIntervalMs: 30000,
      });

      session.sock.ev.on('creds.update', async () => {
        console.log(`[WhatsApp] Credentials updated for ${companyId}`);
        await saveCreds();
      });

      session.sock.ev.on('connection.update', async (update: any) => {
        const { connection, lastDisconnect, qr } = update;
        console.log(`[WhatsApp] Connection update for ${companyId}:`, { connection, qr: !!qr });
        
        if (qr) {
          try {
            console.log(`[WhatsApp] Generating QR DataURL for ${companyId}...`);
            const qrDataUrl = await qrcode.toDataURL(qr);
            session.qrCodeData = qrDataUrl;
            io.emit('qr', { companyId, qr: qrDataUrl });
            console.log(`[WhatsApp] QR Code emitted successfully for ${companyId}`);
          } catch (err) {
            console.error('[WhatsApp] Error generating QR DataURL:', err);
          }
        }

        if (connection === 'close') {
          const statusCode = (lastDisconnect?.error as any)?.output?.statusCode;
          console.warn(`[WhatsApp] Connection closed for ${companyId}. Status: ${statusCode}`);
          
          session.isConnected = false;
          session.isConnecting = false;
          
          // Se for logout explícito, erro de autenticação (401) ou muitos timeouts (408)
          const isLoggedOut = statusCode === DisconnectReason.loggedOut;
          const isAuthError = statusCode === 401;
          
          if (statusCode === 408) {
            session.timeoutCount++;
            console.log(`[WhatsApp] Timeout count for ${companyId}: ${session.timeoutCount}/3`);
          }

          const shouldClearSession = isLoggedOut || isAuthError || session.timeoutCount >= 3;
          
          if (shouldClearSession) {
            console.error(`[WhatsApp] Permanent error or multiple timeouts for ${companyId}. Clearing session.`);
            await clearBaileysSession(companyId);
            io.emit('whatsapp-disconnected', { companyId, error: isAuthError ? 'Erro de Autenticação' : 'Tempo Excedido' });
          } else {
            const delay = statusCode === 408 ? 5000 : 10000; // Reduzi o delay de 408 para ser mais ágil na recuperação
            console.log(`[WhatsApp] Attempting to reconnect ${companyId} in ${delay/1000}s... (Status: ${statusCode})`);
            session.reconnectTimer = setTimeout(() => connectToWhatsApp(companyId), delay);
          }
        } else if (connection === 'open') {
          console.log(`[WhatsApp] Connection opened for ${companyId}`);
          session.isConnected = true;
          session.isConnecting = false;
          session.qrCodeData = null;
          session.timeoutCount = 0; // Reseta contador em caso de sucesso
          io.emit('whatsapp-ready', { companyId, user: session.sock.user });
        }
      });

      session.sock.ev.on('messages.upsert', async (m: any) => {
        if (m.type !== 'notify') return;
        const msg = m.messages[0];
        if (!msg.message || msg.key.fromMe) return;
        const remoteJid = msg.key.remoteJid;
        if (!remoteJid || remoteJid.includes('@g.us')) return;

        console.log(`[WhatsApp] Incoming message payload:`, JSON.stringify(msg.message).substring(0, 200));
        
        // NOVO CÉREBRO FLUIDO DA IA
        let aiExtractedText = msg.message.conversation || msg.message.extendedTextMessage?.text || msg.message.listResponseMessage?.title || msg.message.imageMessage?.caption || msg.message.buttonsResponseMessage?.selectedButtonId || '';
        let isAudio = false; let audioBuffer = null; let imageBuffer = null;
        if (msg.message.audioMessage) {
          try { audioBuffer = await downloadMediaMessage(msg, 'buffer', {}) as Buffer; isAudio = true; aiExtractedText = "[Audio]"; } catch(e){}
        } else if (msg.message.imageMessage) {
          try { imageBuffer = await downloadMediaMessage(msg, 'buffer', {}) as Buffer; } catch(e){}
        }
        if (!aiExtractedText && !isAudio && !imageBuffer) {
           console.warn("[WhatsApp] No text/media content found in message, skipping.");
           return;
        }
        const cliPhone = remoteJid.split('@')[0];
        if (!db) { console.error("[Firestore] db is NULL, cannot save message!"); return; }
        
        try {
           await processAILogic({ msg, text: aiExtractedText, companyId, remoteJid, db, io, session, isAudio, audioBuffer, imageBuffer, phone: cliPhone, ADMIN_COMPANY_ID });
        } catch(e) { console.error("[AI] Call failed", e); }
        
        // Bloqueia a execução das rotinas antigas rígidas (Máquina de Estados)
        return;


        const text = msg.message.conversation || 
                     msg.message.extendedTextMessage?.text || 
                     msg.message.buttonsResponseMessage?.selectedButtonId ||
                     msg.message.listResponseMessage?.title ||
                     msg.message.imageMessage?.caption ||
                     '';
        
        if (!text && !msg.message.imageMessage) {
          console.warn("[WhatsApp] No text/image content found in message, skipping.");
          return;
        }
        
        console.log(`[WhatsApp] Content extracted: "${text}"`);

        if (!db) {
          console.error("[Firestore] db is NULL, cannot save message!");
          return;
        }

        try {
          const phone = remoteJid.split('@')[0];
          console.log(`[Firestore] Querying conversation for phone: ${phone}, company: ${companyId}`);
          
          const q = query(collection(db, 'conversations'), 
            where('companyId', '==', companyId),
            where('customerPhone', '==', phone)
          );
          const convQuery = await getDocs(q);
          console.log(`[Firestore] Conversations found: ${convQuery.size}`);
          let convDocData: any;
          let convDocId: string;

          if (convQuery.empty) {
            console.log(`[Firestore] Creating new conversation for ${phone}`);
            const newConvRef = await addDoc(collection(db, 'conversations'), {
              companyId,
              customerPhone: phone,
              customerName: msg.pushName || 'Cliente WhatsApp',
              lastMessage: text,
              lastMessageAt: serverTimestamp(),
              unreadCount: 1,
              status: 'open',
              createdAt: serverTimestamp()
            });
            convDocId = newConvRef.id;
            convDocData = { id: convDocId };
          } else {
            const docSnap = convQuery.docs[0];
            convDocId = docSnap.id;
            convDocData = { id: convDocId, ...docSnap.data() };
            console.log(`[Firestore] Updating existing conversation ${convDocId}`);
            await updateDoc(doc(db, 'conversations', convDocId), {
              lastMessage: text,
              lastMessageAt: serverTimestamp(),
              unreadCount: increment(1)
            });
          }

          console.log(`[Firestore] Saving customer message to ${convDocId}`);
          await addDoc(collection(db, 'conversations', convDocId, 'messages'), {
            content: text,
            senderType: 'customer',
            createdAt: serverTimestamp()
          });

          // Enviar Notificação Amarela - Apenas se for a PRIMEIRA mensagem não lida
          if ((convDocData?.unreadCount || 0) === 0) {
            try {
              await addDoc(collection(db, 'notifications'), {
                companyId,
                title: "Nova Mensagem WhatsApp",
                message: `O cliente ${msg.pushName || 'WhatsApp'} enviou uma mensagem.`,
                type: "WARNING",
                read: false,
                senderId: phone,
                groupingKey: 'whatsapp_message',
                createdAt: serverTimestamp()
              });
            } catch(e) { console.error("Error creating notification", e); }
          }

          // MASTER AGENT: Humanized, Reliable and Number-Menu Driven
          try {
            if (convDocData?.requiresHuman) return;

            const clientName = msg.pushName || "Cliente";
            const lowText = (text || "").toLowerCase().trim();
            const state = convDocData?.state || 'idle';
            const tempData = convDocData?.tempData || {};
            let reply = "";
            let triggerHandoff = false;
            let newState = state;
            let newTempData = { ...tempData };

            // Store Info Constants
            const storeCEP = "01001-000";
            const storeAddr = "Rua das Oficinas, 123 - Centro, São Paulo";
            const storeInfo = `📍 *Service Hub:* ${storeAddr} (CEP: ${storeCEP}). Aberto Seg-Sex 08h-18h.`;

            // Helper for unique codes
            const generateUniqueCode = () => Math.random().toString(36).substring(2, 8).toUpperCase();

            // PERSONA LOGIC: Service Hub (Admin) vs Local Shop
            const isAdminBot = companyId === ADMIN_COMPANY_ID;

const prices = {
  pro: { monthly: 29.99, trimestral: 80.97, anual: 287.90 },
  elite: { monthly: 79.99, trimestral: 215.97, anual: 767.90 }
};

const plansMessage = `*Escolha o seu plano ideal:*

1️⃣ *HUB PRO* - R$ 29,99/mês
Ideal para oficinas em crescimento.
• 50 Clientes e OS/mês
• Catálogo de Fornecedores
• Orçamentos Profissionais

2️⃣ *HUB ELITE* - R$ 79,99/mês
A experiência completa e definitiva.
• *ILIMITADO*
• *AGENTE WHATSAPP 24/7*
• Radar de Oportunidades

3️⃣ *HUB START* - GRÁTIS
Recursos básicos para começar.

*Qual plano você deseja conhecer melhor? (Responda 1, 2 ou 3)*`;

// Helper: Field Validators
const validators = {
  name: (v: string) => v.length >= 3 || "Por favor, digite seu nome completo (mínimo 3 letras).",
  email: (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) || "Email inválido. Ex: joao@email.com",
  cpfCnpj: (v: string) => {
    const clean = v.replace(/\D/g, '');
    return (clean.length === 11 || clean.length === 14) || "CPF (11 dígitos) ou CNPJ (14 dígitos) inválido.";
  },
  cep: (v: string) => {
    const clean = v.replace(/\D/g, '');
    return clean.length === 8 || "CEP inválido. Deve conter 8 dígitos.";
  },
  phone: (v: string) => {
    const clean = v.replace(/\D/g, '');
    return (clean.length >= 10 && clean.length <= 11) || "Telefone inválido. Ex: 11988887777";
  }
};

            const botName = isAdminBot ? "Service Hub" : (msg.pushName || "Atendente");
            
            const mainMenu = isAdminBot 
              ? `Olá! Que alegria ter você por aqui! 🌟 Eu sou o *Agente Service Hub* e minha missão é ser o parceiro que vai fazer sua oficina ou empresa de peças alcançar outro nível! 🚀🚀\n\nAqui, a tecnologia trabalha para você: de orçamentos instantâneos por foto a agendamentos automáticos. Como podemos transformar o seu futuro hoje? 😊\n\n1️⃣ **Quero turbinar minha Oficina** (Ver Planos e Cadastro)\n2️⃣ **Quero vender mais como Fornecedor**\n3️⃣ **Conhecer a Magia da nossa IA**\n4️⃣ **Falar com um Consultor Humano** 🤝`
              : `Olá! Que prazer te receber! 😊 Seja muito bem-vindo à *${botName}*.\n\nPara que eu possa te dar aquele atendimento especial e agilizar seu orçamento com toda a precisão que você merece, você poderia me informar seu *CPF ou CNPJ*? (Apenas os números, por favor).`;

            const loggedMenu = `Olá, *${clientName}*! Que bom ter você acompanhando seu veículo conosco novamente! 😊✨\n\nComo posso facilitar seu dia hoje? Escolha uma das opções e eu cuido do resto:\n\n1️⃣ **Solicitar um Novo Orçamento**\n2️⃣ **Ver como está o Status da minha OS**\n3️⃣ **Conversar com nossos Consultores**\n4️⃣ **Ver Nossa Localização e Horários**\n5️⃣ **Agendar um Serviço ou Revisão**`;

            // 0. IMAGE PROCESSING (Visual AI Fix)
            if (msg.message.imageMessage) {
              const apiKey = process.env.GEMINI_API_KEY;
              if (apiKey && apiKey !== "COLOQUE_SUA_CHAVE_AQUI") {
                try {
                  const buffer = await downloadMediaMessage(msg, 'buffer', {});
                  const genAI = new GoogleGenerativeAI(apiKey);
                  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
                  const result = await model.generateContent([
                    { text: `Você é o mecânico especialista da Service Hub. 
                      Analise esta imagem (peça ou orçamento). 
                      Identifique os itens e siga a REGRA DE PREÇO: Mão de Obra = Valor da Peça.
                      Responda de forma humanizada, técnica e detalhada em Português-BR.
                      Diga o nome da peça e os valores sugeridos.` },
                    { inlineData: { data: (buffer as Buffer).toString('base64'), mimeType: 'image/jpeg' } }
                  ]);
                  reply = `📸 *Análise Técnica Service Hub:*\n\n${result.response.text() || "Recebemos sua foto! Um de nossos técnicos irá validar os detalhes em breve."}\n\nDeseja que eu gere um orçamento formal com esses itens? Digite o nome da peça ou 'MENU'.`;
                  newState = 'create_quote_part';
                } catch (e) {
                  reply = "📸 Recebemos sua foto! No momento meu sistema de visão está em manutenção, mas já notifiquei a equipe técnica.";
                }
              } else {
                reply = "📸 Foto recebida! Por favor, certifique-se de que a **GEMINI_API_KEY** está configurada no arquivo `.env` para que eu possa analisar imagens.";
              }
            }
            // 1. STATE MACHINE FLOWS (Registration 2.0)
             else if (state === 'reg_customer_name') {
               const nameError = validators.name(text);
               if (nameError !== true) {
                 reply = `⚠️ ${nameError as string}`;
               } else {
                 newTempData.fullName = text;
                 newState = 'reg_customer_cpf';
                 reply = `Prazer em te conhecer, *${text}*! 😊 Para seguirmos com seu atendimento, me conta seu *CPF*? (Só os 11 números).`;
               }
             } 
             else if (state === 'reg_customer_cpf') {
               const cpfError = validators.cpfCnpj(text);
               if (cpfError !== true) {
                 reply = `⚠️ ${cpfError as string}`;
               } else {
                 newTempData.cpf = text.replace(/\D/g, '');
                 newState = 'reg_customer_dob';
                 reply = "Perfeito! E qual sua *Data de Nascimento*? (Ex: 01/01/1990)";
               }
             }
             else if (state === 'reg_customer_dob') {
               newTempData.dob = text;
               newState = 'reg_customer_email';
               reply = "Ótimo! Agora, qual o seu melhor *E-mail*? 📧";
             }
             else if (state === 'reg_customer_email') {
               const emailError = validators.email(text);
               if (emailError !== true) {
                 reply = `⚠️ ${emailError as string}`;
               } else {
                 newTempData.email = text;
                 newState = 'reg_customer_cep';
                 reply = "E pra finalizar essa parte, qual o seu *CEP*? Assim já localizo seu endereço! 📍";
               }
             }
            else if (state === 'reg_customer_cep') {
              const cep = text.replace(/\D/g, '');
              if (cep.length !== 8) {
                reply = "O CEP deve conter 8 números. Tente novamente.";
              } else {
                try {
                  const resp = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
                  const data = (await resp.json()) as any;
                  if (data.erro) throw new Error();
                  newTempData.cep = cep;
                  newTempData.baseAddress = `${data.logradouro}, ${data.bairro}, ${data.localidade}-${data.uf}`;
                  reply = `📍 Endereço localizado: *${newTempData.baseAddress}*.\nEstá correto? Digite **SIM** para confirmar ou o endereço correto caso queira ajustar.`;
                  newState = 'reg_customer_confirm_addr';
                } catch (e) {
                  reply = "Não consegui localizar o CEP. Por favor, digite seu *Endereço Completo* manualmente.";
                  newState = 'reg_customer_confirm_addr'; 
                }
              }
            }
            else if (state === 'reg_customer_confirm_addr') {
              if (lowText === 'sim' || lowText === 's') {
                newState = 'reg_customer_num';
                reply = "Excelente! Agora, por favor, informe o *NÚMERO* da residência e, se houver, o complemento.";
              } else {
                newTempData.baseAddress = text;
                newState = 'reg_customer_num';
                reply = "Endereço atualizado com sucesso. Por gentileza, informe o *NÚMERO* da residência.";
              }
            }
            else if (state === 'reg_customer_num') {
              const finalAddress = `${newTempData.baseAddress}, Nº ${text}`;
              const customerCode = generateUniqueCode();
              await addDoc(collection(db, 'customers'), {
                companyId, name: newTempData.fullName, cpfCnpj: newTempData.cpf, dob: newTempData.dob, 
                email: newTempData.email, address: finalAddress, cep: newTempData.cep,
                phone: phone, code: customerCode, createdBy: 'whatsapp', createdAt: serverTimestamp()
              });
              // Notificação de novo cliente
              await addDoc(collection(db, 'notifications'), {
                companyId, title: "Novo Cliente (WhatsApp)", 
                message: `Cliente ${newTempData.fullName} se cadastrou via bot.`,
                type: "INFO", read: false, createdAt: serverTimestamp()
              });
              reply = `✅ *Cadastro Master Concluído!*\nCódigo: *${customerCode}*.\n\nVamos cadastrar seu veículo agora? Digite a *PLACA* ou 'MENU'.`;
              newState = 'reg_vehicle_plate';
              newTempData = { customerId: customerCode };
            }
            // ... (Vehicle Registration logic stays consistent)
            else if (state === 'reg_vehicle_plate') {
              const plate = text.toUpperCase().replace(/[^A-Z0-9]/g, '');
              newTempData.plate = plate;
              // Plate Lookup Mock
              reply = `🔍 Analisando placa *${plate}*...\nIdentificamos: *Modelo Padrão - 2024*. Está tudo certo?\n\n1️⃣ Sim, está correto\n2️⃣ Não, quero digitar manualmente`;
              newState = 'reg_vehicle_confirm';
            }
            else if (state === 'reg_vehicle_confirm') {
               if (lowText === '1' || lowText === 'sim') {
                 const custQ = query(collection(db, 'customers'), where('companyId', '==', companyId), where('phone', '==', phone), limit(1));
                 const custDocs = await getDocs(custQ);
                 const customerId = custDocs.empty ? "" : custDocs.docs[0].id;
                  await addDoc(collection(db, 'vehicles'), {
                    companyId, customerId, plate: newTempData.plate, model: "Modelo via Placa", year: "2024", 
                    createdBy: 'whatsapp', createdAt: serverTimestamp()
                  });
                  // Notificação de novo veículo
                  await addDoc(collection(db, 'notifications'), {
                    companyId, title: "Novo Veículo (WhatsApp)", 
                    message: `Veículo ${newTempData.plate} cadastrado via bot.`,
                    type: "INFO", read: false, createdAt: serverTimestamp()
                  });
                  reply = "✅ Veículo vinculado! Como posso te ajudar agora? Digite 'MENU'.";
                 newState = 'idle'; newTempData = {};
               } else {
                 reply = "Qual a *Marca e Modelo* do seu carro? (Ex: Toyota Corolla)";
                 newState = 'reg_vehicle_manual_model';
               }
            }
            else if (state === 'reg_vehicle_manual_model') {
              newTempData.model = text;
              newState = 'reg_vehicle_manual_year';
              reply = "Qual o *Ano* do veículo?";
            }
            else if (state === 'reg_vehicle_manual_year') {
              newTempData.year = text;
              const custQ = query(collection(db, 'customers'), where('companyId', '==', companyId), where('phone', '==', phone), limit(1));
              const custDocs = await getDocs(custQ);
              const customerId = custDocs.empty ? "" : custDocs.docs[0].id;
              await addDoc(collection(db, 'vehicles'), {
                 companyId, customerId, plate: newTempData.plate, model: newTempData.model, year: newTempData.year, 
                 createdBy: 'whatsapp', createdAt: serverTimestamp()
              });
              // Notificação de novo veículo
              await addDoc(collection(db, 'notifications'), {
                companyId, title: "Novo Veículo (WhatsApp)", 
                message: `Veículo ${newTempData.model} (${newTempData.plate}) cadastrado via bot.`,
                type: "INFO", read: false, createdAt: serverTimestamp()
              });
              reply = "✅ Cadastro de veículo completo! Deseja um orçamento agora? Digite '3' ou 'MENU'.";
              newState = 'idle'; newTempData = {};
            }
             // 2. NUMBER-BASED MENU AND INTENTS (CPF ENFORCEMENT)
            else if (state === 'idle') {
              if (isAdminBot) {
                if (lowText === '1') {
                   reply = plansMessage;
                   newState = 'onboarding_select_plan';
                   newTempData.role = 'shop';
                } else if (lowText === '2') {
                   reply = "Excelente! Fornecedores têm acesso a um Radar de Oportunidades exclusivo. Para começarmos seu cadastro, qual seu *Nome Completo* ou *Razão Social*?";
                   newState = 'onboarding_collect_name';
                   newTempData.role = 'supplier';
                   newTempData.plan = 'free';
                } else if (lowText === '3') {
                   reply = "O Service Hub é a plataforma mais completa do Brasil para o setor automotivo. Oferecemos:\n\n✅ IA que reconhece placas e fotos\n✅ Bot de WhatsApp que agenda sozinho\n✅ Dashboards de BI para peças\n\nDeseja ver os planos das oficinas? Digite '1'.";
                } else if (lowText === '4') {
                   reply = "Entendido! Um de nossos consultores comerciais já foi avisado e entrará em contato em breve. ⏳";
                   triggerHandoff = true;
                } else {
                   reply = mainMenu;
                }
              } else {
                if (lowText === 'menu' || lowText === 'oi' || lowText === 'olá' || lowText === 'ola') {
                   reply = mainMenu;
                   newState = 'awaiting_cpf_initial';
                } else {
                   reply = mainMenu;
                   newState = 'awaiting_cpf_initial';
                }
              }
            }
            // ONBOARDING ADMIN STATES (NEW REFINED FLOW)
            else if (state === 'onboarding_collect_name') {
                const nameError = validators.name(text);
                if (nameError !== true) {
                  reply = `⚠️ ${nameError as string}`;
                } else {
                  newTempData.fullName = text;
                  reply = `Prazer em te conhecer, *${text}*! 😊 Para seguirmos, qual sua *Data de Nascimento*? (Ex: 01/01/1990)`;
                  newState = 'onboarding_collect_dob';
                }
             }
             else if (state === 'onboarding_collect_dob') {
                newTempData.dob = text;
                reply = `Ótimo! Agora, por favor, me informe seu *${newTempData.role === 'shop' ? 'CPF' : 'CPF ou CNPJ'}* para que eu possa preparar seu contrato (apenas números).`;
                newState = 'onboarding_collect_doc';
             }
             else if (state === 'onboarding_collect_doc') {
                const docError = validators.cpfCnpj(text);
                if (docError !== true) {
                  reply = `⚠️ ${docError as string}`;
                } else {
                  newTempData.document = text.replace(/\D/g, '');
                  reply = `Perfeito! E como se chama a sua ${newTempData.role === 'shop' ? 'Oficina' : 'Empresa'}? (Pode ser o Nome Fantasia).`;
                  newState = 'onboarding_collect_shop_name';
                }
             }
             else if (state === 'onboarding_collect_shop_name') {
                newTempData.shopName = text;
                reply = "Quase lá! Qual o seu melhor *E-mail*? É por lá que você receberá seus relatórios e novidades. 📧";
                newState = 'onboarding_collect_email';
             }
             else if (state === 'onboarding_collect_email') {
                const emailError = validators.email(text);
                if (emailError !== true) {
                  reply = `⚠️ ${emailError as string}`;
                } else {
                  newTempData.email = text.toLowerCase().trim();
                  reply = "Tudo certo! Agora, para finalizar a localização da sua empresa, por favor me informe o seu *CEP* (apenas números).";
                  newState = 'onboarding_collect_cep';
                }
             }
             else if (state === 'onboarding_collect_cep') {
                const cep = text.replace(/\D/g, '');
                if (cep.length !== 8) {
                  reply = "Ops! O CEP precisa ter exatamente 8 números. Pode digitar novamente? 😊";
                } else {
                  try {
                    const resp = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
                    const data = await resp.json() as any;
                    newTempData.cep = cep;
                    newTempData.address = `${data.logradouro}, ${data.bairro}, ${data.localidade}-${data.uf}`;
                    reply = `Show! Localizei aqui: *${newTempData.address}*.\n\nEstá certinho? Se sim, digite **SIM**. Caso precise ajustar, é só mandar o endereço completo aqui. 👇`;
                    newState = 'onboarding_confirm_addr';
                  } catch (e) {
                    reply = "Não consegui consultar o CEP automaticamente, mas sem problemas! Pode digitar seu *Endereço Completo* manualmente para mim?";
                    newState = 'onboarding_confirm_addr';
                  }
                }
             }
             else if (state === 'onboarding_confirm_addr') {
                if (lowText !== 'sim' && lowText !== 's') newTempData.address = text;
                if (newTempData.role === 'shop') {
                  reply = "Excelente! Para eu configurar suas ferramentas da melhor forma, qual o tipo do seu estabelecimento?\n\n1️⃣ Oficina Mecânica (Carro/Moto)\n2️⃣ Som Automotivo\n3️⃣ Lava Jato\n4️⃣ Auto Elétrica";
                  newState = 'onboarding_collect_type_seg';
                } else {
                  reply = "Perfeito! No momento, nosso Hub de Fornecedores opera com o segmento **Automotivo**. Podemos seguir assim? Digite 'OK' para confirmar seu cadastro! 🚀";
                  newState = 'onboarding_collect_type_seg';
                }
            }
            else if (state === 'onboarding_collect_type_seg') {
               if (newTempData.role === 'shop') {
                 const types: {[key: string]: string} = { '1': 'Oficina Mecânica', '2': 'Som Automotivo', '3': 'Lava Jato', '4': 'Auto Elétrica' };
                 newTempData.establishmentType = types[text as keyof typeof types] || text;
                 reply = plansMessage;
                 newState = 'onboarding_select_plan';
               } else {
                 newTempData.segments = 'Automotivo';
                 reply = "Excelente! Estamos ativando seu acesso de Fornecedor AGORA mesmo... ⚙️";
                 newState = 'idle';
                 
                 setTimeout(async () => {
                    try {
                      const uid = await createUserAccount({ ...newTempData, plan: 'free', phone });
                      const welcomeMsg = `🎉 *HUB DE FORNECEDORES ATIVO!* 🚀\n\nOlá *${newTempData.fullName}*! Seu acesso está liberado.\n\n🔗 *Acesse:* ${process.env.APP_URL || 'https://service-hub-joz0.onrender.com'}\n📧 *Login:* ${newTempData.email}\n🔑 *Senha:* 12345678\n\n_Dica: Explore o Radar de Oportunidades para ver o que as oficinas estão buscando!_`;
                      await session.sock.sendMessage(remoteJid, { text: welcomeMsg });
                    } catch (e) {}
                    newTempData = {};
                 }, 1000);
               }
            }
            else if (state === 'onboarding_select_plan') {
               let plan = '';
               if (lowText === '1' || lowText.includes('pro')) plan = 'pro';
               else if (lowText === '2' || lowText.includes('elite')) plan = 'elite';
               else if (lowText === '3' || lowText.includes('start')) plan = 'start';

               if (!plan) {
                 reply = "Por favor, escolha um dos planos: 1️⃣ *PRO*, 2️⃣ *ELITE* ou 3️⃣ *START*.";
               } else {
                 newTempData.plan = plan;
                 if (plan === 'start') {
                    reply = "Ótima escolha! Ativando sua conta START com recursos essenciais. Aguarde um segundo... ⚙️";
                    newState = 'idle';
                    
                    setTimeout(async () => {
                      try {
                        await createUserAccount({ ...newTempData, plan: 'start', phone });
                        const welcomeMsg = `🎉 *PARABÉNS! SUA CONTA ESTÁ NO AR!* 🚀\n\nOlá *${newTempData.fullName}*! É um orgulho ter sua ${newTempData.role === 'shop' ? 'Oficina' : 'Empresa'} no Service Hub!\n\n📊 *Seu Plano:* Start (R$ 0,00)\n✅ *Recursos:* 10 Clientes, 10 OS e 10 Orçamentos.\n🔗 *Acesse agora:* ${process.env.APP_URL || 'https://service-hub-joz0.onrender.com'}\n📧 *Seu Login:* ${newTempData.email}\n🔑 *Sua Senha:* 12345678\n\n_💡 Lembre-se: Você pode migrar para o plano PRO ou ELITE a qualquer momento no painel para desbloquear recursos ilimitados!_`;
                        await session.sock.sendMessage(remoteJid, { text: welcomeMsg });
                      } catch (e: any) {
                        await session.sock.sendMessage(remoteJid, { text: "Tive um pequeno imprevisto técnico ao gerar sua conta, mas nossa equipe já foi avisada! Em instantes falaremos com você por aqui. 😊" });
                      }
                      newTempData = {};
                    }, 1000);
                 } else {
                    const prices = { pro: 19.99, elite: 59.99 };
                    const amount = prices[plan as 'pro' | 'elite'];
                    reply = `Excelente escolha! O plano *${plan.toUpperCase()}* é o combustível que sua oficina precisa para acelerar! 🏁\n\n💰 *Investimento: R$ ${amount.toString().replace('.', ',')}/mês*\n_Gerando seu PIX de ativação com segurança..._`;
                    newState = 'onboarding_awaiting_payment';
                    
                    setTimeout(async () => {
                      try {
                        const pixResp = await fetch(`${process.env.APP_URL || 'http://localhost:3000'}/api/payments/create`, {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            type: 'subscription',
                            amount,
                            metadata: { 
                              onboarding: true,
                              ...newTempData,
                              plan,
                              phone
                            },
                            payer: { email: newTempData.email, name: newTempData.fullName, cpf: newTempData.document }
                          })
                        });
                        const pixData = await pixResp.json();
                        if (pixData.qrCode) {
                          await session.sock.sendMessage(remoteJid, { text: `✅ *Pix Copia e Cola:*\n\n${pixData.qrCode}` });
                          await session.sock.sendMessage(remoteJid, { text: "Assim que o pagamento for confirmado, seu acesso ILIMITADO será liberado na hora! 🎉" });
                        }
                      } catch (e) {}
                    }, 1000);
                 }
               }
            }
            else if (state === 'awaiting_cpf_initial') {
               const cpf = text.replace(/\D/g, '');
               if (cpf.length === 11 || cpf.length === 14) {
                  const custQ = query(collection(db, 'customers'), where('companyId', '==', companyId), where('cpfCnpj', '==', cpf));
                  const custDocs = await getDocs(custQ);
                  if (!custDocs.empty) {
                    const custData = custDocs.docs[0].data();
                    const vQ = query(collection(db, 'vehicles'), where('companyId', '==', companyId), where('customerId', '==', custDocs.docs[0].id));
                    const vDocs = await getDocs(vQ);
                    const vData = !vDocs.empty ? vDocs.docs[0].data() : null;
                    const veiculoStr = vData ? `${vData.brand || ''} ${vData.model || ''} - ${vData.plate || ''}` : "Nenhum veículo cadastrado";
                    
                    reply = `Encontrei seu cadastro!\n👤 Nome: *${custData.name}*\n🚗 Veículo: *${veiculoStr}*\n\nConfirma estes dados? (Sim/Não)`;
                    newState = 'confirm_cpf_data';
                    newTempData = { customerId: custDocs.docs[0].id, customerName: custData.name, cpf: cpf, vehicleId: vData ? vDocs.docs[0].id : null, vehicleInfo: veiculoStr };
                  } else {
                    reply = `Não encontrei um cadastro com esse documento. Qual é o seu *Nome Completo* para eu te cadastrar?`;
                    newState = 'reg_customer_name';
                    newTempData = { cpf };
                  }
               } else {
                  reply = `Ops! O CPF/CNPJ deve ter 11 ou 14 números. Tente novamente.`;
               }
            }
            else if (state === 'confirm_cpf_data') {
               if (lowText === 'sim' || lowText === 's') {
                  reply = loggedMenu;
                  newState = 'main_menu_logged';
               } else {
                  reply = `Entendido. Por favor, digite o *CPF* correto novamente ou digite 'MENU'.`;
                  newState = 'awaiting_cpf_initial';
               }
            }
            else if (state === 'main_menu_logged') {
                if (lowText === '1' || lowText.includes('orçamento') || lowText.includes('orcamento')) {
                   reply = `Com certeza! Por favor, digite o nome da *PEÇA* que você precisa ou, se preferir, envie uma *FOTO* dela para que eu possa analisar para você. 📸`;
                   newState = 'create_quote_part';
                } else if (lowText === '2' || lowText.includes('status')) {
                   const woQ = query(collection(db, 'work_orders'), where('companyId', '==', companyId), where('customerId', '==', tempData.customerId));
                   const woDocs = await getDocs(woQ);
                   if (woDocs.empty) {
                     reply = "No momento, não identifiquei nenhuma Ordem de Serviço em andamento para você. Gostaria de solicitar um novo orçamento? Digite '1'.";
                   } else {
                     reply = "Claro! Aqui está o status atual dos seus serviços:\n";
                     woDocs.forEach(w => reply += `\n🚗 *OS: ${w.id.substring(0,6)}* - ${w.data().status.toUpperCase()}\n💰 Valor: R$ ${w.data().totalValue || '0,00'}\n`);
                     reply += "\nPrecisa de mais alguma informação? Digite 'MENU' para voltar ao início.";
                   }
                } else if (lowText === '3' || lowText.includes('humano') || lowText.includes('consultor')) {
                   reply = "Entendido! Já estou solicitando que um de nossos consultores entre em contato com você. Por favor, aguarde um momento. ⏳😊";
                   triggerHandoff = true;
                } else if (lowText === '4' || lowText.includes('localização') || lowText.includes('endereco') || lowText.includes('endereço')) {
                   reply = `Com prazer! Aqui estão nossas informações de contato e localização:\n\n${storeInfo}\n\nEspero te ver em breve! Digite 'MENU' se precisar de algo mais. 😊`;
                } else if (lowText === '5' || lowText.includes('agendar') || lowText.includes('marcar') || lowText.includes('revisão')) {
                   reply = `Claro! Para qual *DIA* e *HORÁRIO* você gostaria de agendar? (Ex: Amanhã às 14h, Quinta de manhã, etc.)`;
                   newState = 'scheduling_request';
                } else {
                   reply = "Desculpe, não entendi. Por favor, escolha uma das opções (1, 2, 3, 4 ou 5) ou digite 'MENU'.";
                }
             }
             else if (state === 'scheduling_request') {
                const apiKey = process.env.GEMINI_API_KEY;
                if (apiKey) {
                  try {
                    const genAI = new GoogleGenerativeAI(apiKey);
                    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
                    const today = new Date().toISOString().split('T')[0];
                    const prompt = `Você é o assistente de agendamento da Service Hub. O dia de hoje é ${today}.
                    Extraia a data e hora desejada pelo cliente do texto: "${text}".
                    Responda APENAS em JSON: {"date": "YYYY-MM-DD", "time": "HH:mm", "notes": "descrição do serviço ou período"}.
                    Se não conseguir extrair, retorne {"error": "não entendi"}.`;
                    
                    const aiResult = await model.generateContent(prompt);
                    const aiResultText = aiResult.response.text();
                    
                    const data = JSON.parse(aiResultText.replace(/```json|```/g, "").trim());
                    
                    if (data.error) {
                      reply = "Poxa, não consegui entender bem o dia e horário. Poderia repetir de forma mais clara? (Ex: 'Vou na quarta às 10h')";
                    } else {
                      newTempData.scheduling = data;
                      newState = 'scheduling_confirm';
                      reply = `Entendido! Você gostaria de agendar para o dia *${data.date.split('-').reverse().join('/')}* às *${data.time}*?\n\n1️⃣ Sim, confirmar solicitação\n2️⃣ Não, informar outro horário`;
                    }
                  } catch (e) {
                    reply = "Tive um probleminha para processar o agendamento. Pode digitar a data e hora manualmente? (Ex: 25/12 14:00)";
                  }
                } else {
                  reply = "Me desculpe, mas meu sistema de agendamento inteligente está offline. Por favor, fale com um atendente digitando '4'.";
                }
             }
             else if (state === 'scheduling_confirm') {
                if (lowText === '1' || lowText === 'sim' || lowText === 's') {
                  // Save to appointments collection
                  await addDoc(collection(db, 'appointments'), {
                    companyId,
                    customerId: tempData.customerId,
                    customerName: tempData.customerName,
                    customerPhone: phone,
                    vehicleInfo: tempData.vehicleInfo,
                    date: tempData.scheduling.date,
                    time: tempData.scheduling.time,
                    notes: tempData.scheduling.notes || '',
                    status: 'pending',
                    createdAt: serverTimestamp()
                  });

                  // Notify shop
                  await addDoc(collection(db, 'notifications'), {
                    companyId,
                    title: "Nova Solicitação de Agendamento",
                    message: `${tempData.customerName} deseja agendar para ${tempData.scheduling.date} às ${tempData.scheduling.time}.`,
                    type: "INFO",
                    read: false,
                    senderId: phone,
                    groupingKey: 'scheduling_request',
                    createdAt: serverTimestamp()
                  });

                  reply = `✅ *Solicitação Enviada!* Envei seu pedido de agendamento para a equipe da oficina.\n\nAssim que eles confirmarem, eu te aviso por aqui! Fique atento às notificações. 😊`;
                  newState = 'idle';
                  newTempData = {};
                } else {
                  reply = "Sem problemas! Para qual dia e horário você prefere?";
                  newState = 'scheduling_request';
                }
             }
              // AI FALLBACK (Humanized)
              else {
                const apiKey = process.env.GEMINI_API_KEY;
                if (apiKey) {
                  try {
                    // Fetch Company Profile for AI Context
                    const companySnap = await getDoc(doc(db, 'users', companyId));
                    const companyData = companySnap.exists() ? companySnap.data() : null;
                    const businessHours = companyData?.businessHours || {};
                    const description = companyData?.description || "";
                    
                    const genAI = new GoogleGenerativeAI(apiKey);
                    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
                    const sysPrompt = isAdminBot 
                      ? `Você é o *Especialista Sênior em Expansão Digital* da Service Hub. 
                         Sua voz é visionária, altamente profissional e extremamente persuasiva. 
                         
                         MISSÃO:
                         Sua missão é converter interessados em assinantes premium da plataforma Service Hub. 
                         Você não apenas responde dúvidas, você vende o futuro e a organização total.
                         
                         ARGUMENTOS DE VENDA (Use-os naturalmente):
                         1. Gestão Inteligente: Controle total de faturamento, peças e lucratividade.
                         2. IA Conectada: Um gerente digital (como você) que atende clientes 24h por dia no WhatsApp.
                         3. Escabilidade: Ferramentas de Admin para gerenciar múltiplas lojas ou frotas.
                         4. Profissionalismo: Orçamentos em PDF profissionais gerados instantaneamente.
                         
                         Tonalidade: Elegante, executiva e amigável. Use emojis estrategicamente (✨, 🚀, 📈).
                         Jamais mencione que é um robô a menos que perguntem diretamente; aja como o braço direito do Admin.
                         Cliente atual: ${clientName}.`
                      : `Você é o *Concierge Digital Premium* e Consultor Técnico da *${companyData?.companyName || botName}*. 
                         Sua voz representa a elite do atendimento automotivo/serviços. 
                         
                         PERFIL DA LOJA:
                         - Especialidade: ${companyData?.segment || 'Serviços Especializados'}
                         - Biografia: ${description}
                         - Horário: ${JSON.stringify(businessHours)}
                         - Localização: ${storeAddr}
                         
                         DIRETRIZES DE OURO:
                         1. CORTESIA ABSOLUTA: Comece sempre com uma saudação calorosa e use o nome do cliente: ${clientName}.
                         2. CONHECIMENTO: Use a descrição da loja para destacar por que somos os melhores.
                         3. AGILIDADE: Se estivermos fechados (consulte horário), informe o retorno mas diga que você já pode adiantar a triagem técnica.
                         4. PERSUASÃO: Se o cliente pedir orçamento, incentive-o dizendo que usamos peças de alta performance.
                         
                         Menu de Opções Rápidas:
                         1️⃣ Orçamento Personalizado
                         2️⃣ Status do Seu Serviço
                         3️⃣ Dúvidas Técnicas
                         4️⃣ Onde estamos?
                         5️⃣ Agendar Horário Premium
                         
                         Tonalidade: Respeitosa, técnica q.b. (quantum bastis) e muito prestativa.`;
                    
                    const aiResult = await model.generateContent([
                      { text: sysPrompt },
                      { text: `Cliente diz: ${text}` }
                    ]);
                    reply = aiResult.response.text() || (isAdminBot ? "Olá! Como posso ajudar você a crescer hoje? 😊" : mainMenu);
                  } catch (e) {
                    console.error("[AI Error]:", e);
                    reply = isAdminBot ? "Olá! Como posso ajudar você a crescer hoje? 😊" : mainMenu;
                  }
                } else {
                  reply = isAdminBot ? "Olá! Como posso ajudar você a crescer hoje? 😊" : mainMenu;
                }
              }

            // PDF Budget Logic (Detailed, Persistent & Synced with Site)
            if (state === 'create_quote_part' && text.length > 2 && text.toLowerCase() !== 'menu') {
              const partNameFound = text;
              const partQ = query(collection(db, 'parts'), where('nameLower', '>=', partNameFound.toLowerCase()), limit(1));
              const partDocs = await getDocs(partQ);
              let partPrice = 150; 
              let partFullName = partNameFound;
              if (!partDocs.empty) {
                const p = partDocs.docs[0].data();
                partPrice = p.price || 150;
                partFullName = p.name;
              }
              const labor = partPrice; 
              const total = partPrice + labor;
              
              // Find Customer for Quote linking
              const custQ = query(collection(db, 'customers'), where('companyId', '==', companyId), where('phone', '==', phone), limit(1));
              const custDocs = await getDocs(custQ);
              const customer = !custDocs.empty ? custDocs.docs[0].data() : null;
              const customerId = !custDocs.empty ? custDocs.docs[0].id : "";

              // Persist Quote in 'quotes' (Synced with Budgets.tsx structure)
              const quoteData = {
                companyId,
                customerId: customerId,
                customerName: customer?.name || clientName,
                customerPhone: phone,
                parts: [{ name: partFullName, price: partPrice, quantity: 1, total: partPrice }],
                laborPrice: labor,
                total: total,
                status: 'pending',
                createdBy: 'whatsapp',
                createdAt: serverTimestamp()
              };
              const quoteRef = await addDoc(collection(db, 'quotes'), quoteData);

              // Notificação de novo orçamento
              await addDoc(collection(db, 'notifications'), {
                companyId, title: "Novo Orçamento (WhatsApp)", 
                message: `Orçamento de ${partFullName} gerado para ${customer?.name || clientName}.`,
                type: "SUCCESS", read: false, 
                senderId: phone,
                groupingKey: 'new_quote',
                createdAt: serverTimestamp()
              });

              const docPDF = new jsPDF();
              docPDF.setFontSize(22);
              docPDF.setTextColor(44, 62, 80);
              docPDF.text('SERVICE HUB - ORÇAMENTO', 105, 20, { align: 'center' });
              docPDF.setFontSize(10);
              docPDF.setTextColor(100);
              docPDF.text(`Identificador: ${quoteRef.id.toUpperCase()}`, 105, 30, { align: 'center' });
              docPDF.text(`Data: ${new Date().toLocaleDateString('pt-BR')}`, 105, 35, { align: 'center' });

              autoTable(docPDF, {
                startY: 50,
                head: [['PEÇA/SERVIÇO', 'VALOR PEÇA', 'MÃO DE OBRA', 'TOTAL']],
                body: [[partFullName, `R$ ${partPrice.toFixed(2)}`, `R$ ${labor.toFixed(2)}`, `R$ ${total.toFixed(2)}`]],
                theme: 'striped',
                headStyles: { fillColor: [44, 62, 80], textColor: [255, 255, 255] }
              });

              const finalTableY = (docPDF as any).lastAutoTable.finalY + 10;
              docPDF.setFont('helvetica', 'bold');
              docPDF.text('RESUMO GERAL', 140, finalTableY);
              docPDF.setFont('helvetica', 'normal');
              docPDF.text(`Peças: R$ ${partPrice.toFixed(2)}`, 140, finalTableY + 7);
              docPDF.text(`Mão de Obra: R$ ${labor.toFixed(2)}`, 140, finalTableY + 14);
              docPDF.setFontSize(12);
              docPDF.text(`TOTAL: R$ ${total.toFixed(2)}`, 140, finalTableY + 22);
              
              const pdfBuffer = Buffer.from(docPDF.output('arraybuffer'));
              await session.sock.sendMessage(remoteJid, { 
                document: pdfBuffer, mimetype: 'application/pdf', fileName: `Orcamento_${partFullName}.pdf`,
                caption: `Prontinho, *${clientName}*! 🎉 Orçamento gerado para *${partFullName}*.\n\n💰 *Total: R$ ${total.toFixed(2)}*\nO documento foi salvo no sistema.`
              });
              reply = ""; newState = 'idle'; newTempData = {};
            }

            if (reply) {
              await session.sock.sendMessage(remoteJid, { text: reply });
            }

            // Persistence
            const updateBatch = writeBatch(db);
            const msgRef = doc(collection(db, 'conversations', convDocId, 'messages'));
            updateBatch.set(msgRef, { content: reply || "Mensagem Enviada", senderType: 'company', createdAt: serverTimestamp() });
            
            const updateObj: any = {
              lastMessage: reply || "Mídia/Mensagem Enviada",
              lastMessageAt: serverTimestamp(),
              state: newState,
              tempData: newTempData
            };
            if (triggerHandoff) updateObj.requiresHuman = true;
            
            updateBatch.update(doc(db, 'conversations', convDocId), updateObj);
            await updateBatch.commit();

          } catch (masterError) {
            console.error(`[Master Agent Error]:`, masterError);
          }

        } catch (error: any) {
          console.error(`[Firestore] Error processing message:`, error);
          io.emit('system-error', { 
            message: `Erro ao salvar mensagem: ${error.message}`,
            companyId,
            details: error.stack 
          });
        }
      });

    } catch (error) {
      session.isConnecting = false;
      session.reconnectTimer = setTimeout(() => connectToWhatsApp(companyId), 15000);
    }
  }

  io.on('connection', (socket) => {
    socket.on('get-status', (data: any) => {
      const companyId = data?.companyId;
      console.log(`[Socket] get-status for: ${companyId}`);
      if (!companyId) return;
      
      const session = getSession(companyId);
      if (session.isConnected && session.sock?.user) {
        socket.emit('whatsapp-ready', { companyId, user: session.sock.user });
      } else if (session.qrCodeData) {
        socket.emit('qr', { companyId, qr: session.qrCodeData });
      } else if (session.isConnecting) {
        socket.emit('whatsapp-connecting', { companyId });
      } else {
        socket.emit('whatsapp-disconnected', { companyId });
        connectToWhatsApp(companyId);
      }
    });

    socket.on('reconnect-whatsapp', async (data: any) => {
      const companyId = data?.companyId;
      console.log(`[Socket] reconnect-whatsapp for: ${companyId}`);
      if (!companyId) return;
      
      const session = getSession(companyId);
      if (session.sock) {
        try { session.sock.logout(); } catch (e) {}
      }
      await clearBaileysSession(companyId);
      connectToWhatsApp(companyId);
    });

    socket.on('send-message', async ({ companyId, conversationId, to, message }) => {
      if (!companyId || !db) return;
      const session = getSession(companyId);
      if (!session.sock?.user) return;
      try {
        await session.sock.sendMessage(to + '@s.whatsapp.net', { text: message });
        const batch = writeBatch(db);
        const msgRef = doc(collection(db, 'conversations', conversationId, 'messages'));
        batch.set(msgRef, {
          content: message,
          senderType: 'company',
          createdAt: serverTimestamp()
        });
        // Se o humano responde, tira a IA de cena
        batch.update(doc(db, 'conversations', conversationId), {
          lastMessage: message,
          lastMessageAt: serverTimestamp(),
          requiresHuman: true 
        });
        await batch.commit();
      } catch (e) {
        console.error(`Error sending message:`, e);
      }
    });
  });

  if (process.env.NODE_ENV !== "production") {
    // Vite initialization wrapped to ensure async context
    (async () => {
      try {
        const vite = await viteCreateServer({
          server: { middlewareMode: true },
          appType: "spa",
        });
        app.use(vite.middlewares);
        console.log("[Vite] Dev server middleware integrated.");
      } catch (err) {
        console.error("[Vite] Failed to initialize dev server:", err);
      }
    })();
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // Real-time Status Notifications
  const startStatusListeners = () => {
    if (!db) return;
    console.log("[Automations] Starting Real-time Work Order Status Listeners...");
    
    onSnapshot(collection(db, 'work_orders'), (snapshot) => {
      snapshot.docChanges().forEach(async (change) => {
        if (change.type === 'modified' || change.type === 'added') {
          const os = change.doc.data();
          const docId = change.doc.id;
          
          // 1. Status Changes Notifications
          if (os.lastNotifiedStatus !== os.status) {
            const session = getSession(os.companyId);
            if (session?.isConnected && session.sock && os.customerPhone) {
              const phone = os.customerPhone.replace(/\D/g, '') + '@s.whatsapp.net';
              let message = '';

              switch (os.status) {
                case 'waiting_payment':
                  message = `📑 *Service Hub: Ordem de Serviço Gerada*\n\nOlá *${os.customerName}*! Seu orçamento foi aprovado e a OS para o veículo *${os.vehicleInfo || os.model}* foi aberta.\n\n💰 *Total: R$ ${os.totalCost?.toFixed(2)}*\n\nAguardamos a confirmação do pagamento para iniciar os trabalhos.`;
                  break;
                case 'payment_received':
                  message = `✅ *Service Hub: Pagamento Confirmado!*\n\nOlá *${os.customerName}*! Recebemos o pagamento da OS do seu *${os.vehicleInfo || os.model}*. ✨\n\nNossa equipe já está se preparando para iniciar o serviço.`;
                  break;
                case 'awaiting_parts':
                  message = `📦 *Service Hub: Peças Solicitadas*\n\nOlá *${os.customerName}*! O pagamento foi confirmado e já solicitamos as peças necessárias para o reparo do seu *${os.vehicleInfo || os.model}*.\n\nAvisaremos assim que elas chegarem para iniciarmos o reparo!`;
                  break;
                case 'repair_started':
                case 'inicio_reparo':
                  message = `🛠️ *Service Hub: Reparo Iniciado!*\n\nOlá *${os.customerName}*! Ótimas notícias: as peças chegaram e o reparo do seu *${os.vehicleInfo || os.model}* já começou! 🚀\n\nEstamos trabalhando para entregar seu veículo o mais rápido possível e com a máxima qualidade.`;
                  break;
                case 'pending':
                  if (os.lastNotifiedStatus === 'awaiting_parts') {
                    message = `🏁 *Service Hub: Peças Chegaram!*\n\nAs peças para o seu *${os.vehicleInfo || os.model}* chegaram! O veículo já entrou na fila de reparo.`;
                  }
                  break;
                case 'completed':
                case 'service_finished':
                  message = `🎉 *Service Hub: SEU VEÍCULO ESTÁ PRONTO!* 🚀\n\nOlá *${os.customerName}*! O reparo do seu *${os.vehicleInfo || os.model}* foi concluído com sucesso! 🚗✨\n\nEle já está disponível para retirada. Estamos te esperando!`;
                  break;
              }

              if (message) {
                try {
                  await session.sock.sendMessage(phone, { text: message });
                  console.log(`[Automations] Status notification (${os.status}) sent to ${os.customerPhone}`);
                  await updateDoc(change.doc.ref, { lastNotifiedStatus: os.status });
                } catch (err) {
                  console.error(`[Automations Error] Failed to send status message:`, err);
                }
              }
            }
          }

          // 2. Timeline Notes Notifications (Comments)
          const timeline = os.timeline || [];
          const lastNotifiedIndex = os.lastNotifiedTimelineIndex ?? -1;
          
          if (timeline.length > 0 && timeline.length - 1 > lastNotifiedIndex) {
            const session = getSession(os.companyId);
            if (session?.isConnected && session.sock && os.customerPhone) {
              const phone = os.customerPhone.replace(/\D/g, '') + '@s.whatsapp.net';
              
              // Notify all new notes since last notification
              for (let i = lastNotifiedIndex + 1; i < timeline.length; i++) {
                const item = timeline[i];
                if (item.type === 'note' || item.type === 'diagnosis') {
                  const message = `💬 *Service Hub: Novo Comentário na sua OS*\n\nOlá *${os.customerName}*! Nossa equipe adicionou uma nova informação sobre o seu *${os.vehicleInfo || os.model}*:\n\n> _"${item.content}"_\n\nQualquer dúvida, estamos à disposição!`;
                  
                  try {
                    await session.sock.sendMessage(phone, { text: message });
                    console.log(`[Automations] Timeline note notification sent to ${os.customerPhone}`);
                  } catch (err) {
                    console.error(`[Automations Error] Failed to send timeline note:`, err);
                  }
                }
              }
              
              // Update the index to the last one processed
              await updateDoc(change.doc.ref, { lastNotifiedTimelineIndex: timeline.length - 1 });
            }
          }
        }
      });
    });
  };

  startStatusListeners();

  // Automations Logic
  const runAutomations = async () => {
    console.log("[Automations] Running Post-Sale check...");
    try {
      if (!db) return;
      const threeDaysAgo = new Date();
      threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
      
      const q = query(collection(db, 'work_orders'), 
        where('status', '==', 'delivered'),
        where('updatedAt', '<=', threeDaysAgo)
      );
      
      const snapshot = await getDocs(q);
      for (const d of snapshot.docs) {
        const os = d.data();
        if (os.postSaleSent) continue;

        const session = sessions.get(os.companyId);
        if (session?.isConnected && session.sock) {
          try {
            const customerPhone = os.customerPhone;
            if (customerPhone) {
              const message = `🌟 *Service Hub: Como foi sua experiência?*\n\nOlá *${os.customerName}*! Faz 3 dias que entregamos seu veículo (*${os.vehicleInfo || os.model}*).\n\nGostaríamos de saber se ficou tudo como esperado! Sua avaliação é muito importante para nós.\n\nPrecisa de algo mais? Responda aqui!\n\n_Atendimento Automático Service Hub_`;
              await session.sock.sendMessage(customerPhone + '@s.whatsapp.net', { text: message });
              console.log(`[Automations] Mensagem de Pós-Venda enviada para ${customerPhone}`);
            }
            await updateDoc(d.ref, { postSaleSent: true });
          } catch (err: any) {
            console.error(`[Automations Error] Falha ao enviar para ${os.customerPhone}:`, err.message);
          }
        }
      }
    } catch (e) {
      console.error("[Automations Error]:", e);
    }
  };

  const runStockCheck = async () => {
    console.log("[Automations] Running Stock check...");
    try {
      if (!db) return;
      const q = query(collection(db, 'inventory'), where('quantity', '<', 5));
      const snapshot = await getDocs(q);
      for (const d of snapshot.docs) {
        const item = d.data();
        if (item.alertSent) continue;
        
        console.log(`[Stock Alert] Item ${item.name} is low: ${item.quantity}`);
        await addDoc(collection(db, 'notifications'), {
          companyId: item.companyId,
          title: "Alerta de Estoque Baixo",
          message: `O item ${item.name} está com apenas ${item.quantity} unidades em estoque.`,
          notifType: "stock_alert",
          read: false,
          createdAt: serverTimestamp()
        });
        await updateDoc(d.ref, { alertSent: true });
      }
    } catch (e) {
      console.error("[Stock Check Error]:", e);
    }
  };

  const runPreventiveMaintenance = async () => {
    console.log("[CRM] Rodando Verificação de Manutenção Preventiva...");
    try {
      if (!db) return;
      // Busca OSs entregues há aproximadamente 6 meses (180 dias)
      const sixMonthsAgo = subMonths(new Date(), 6);
      const start = startOfDay(sixMonthsAgo);
      const end = endOfDay(sixMonthsAgo);

      const q = query(
        collection(db, 'work_orders'), 
        where('status', '==', 'delivered'),
        where('preventiveNotified', '!=', true)
      );
      
      const snapshot = await getDocs(q);
      for (const d of snapshot.docs) {
        const wo = d.data();
        const woDate = wo.updatedAt?.toDate() || wo.createdAt?.toDate() || new Date(wo.createdAt);
        
        // Verifica se a data de entrega/update cai no intervalo de 6 meses atrás
        if (woDate >= start && woDate <= end) {
          const companyId = wo.companyId;
          const session = sessions.get(companyId);

          if (session?.isConnected && session.sock) {
            const rawPhone = wo.customerPhone || '';
            const cleanPhone = rawPhone.replace(/\D/g, '');
            if (!cleanPhone || cleanPhone.length < 10) continue;

            const message = `🛠️ *Service Hub: Lembrete de Manutenção*\n\nOlá *${wo.customerName}*! Faz 6 meses que cuidamos do seu *${wo.brand} ${wo.model}*.\n\nPara garantir sua segurança e a vida útil do motor, que tal agendar uma revisão preventiva? \n\n📍 *Sugestão:* Troca de óleo e filtro, além de check-up de suspensão.\n\n_Responda esta mensagem para agendar seu horário!_`;
            
            await session.sock.sendMessage(cleanPhone + '@s.whatsapp.net', { text: message });
            await updateDoc(d.ref, { preventiveNotified: true });
            console.log(`[CRM] Lembrete de manutenção enviado para ${cleanPhone} (WO ${d.id})`);
          }
        }
      }
    } catch (e) {
      console.error("[CRM Error]:", e);
    }
  };

  // Run every 12 hours
  setInterval(runAutomations, 12 * 60 * 60 * 1000);
  setInterval(runStockCheck, 6 * 60 * 60 * 1000);
  setInterval(runPreventiveMaintenance, 24 * 60 * 60 * 1000); // Diário
  
  // Initial run
  setTimeout(runAutomations, 60000); 
  setTimeout(runStockCheck, 30000);
  setTimeout(runPreventiveMaintenance, 45000);

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

console.log("Starting server...");
startServer().catch(err => {
  console.error("Failed to start server:", err);
});
