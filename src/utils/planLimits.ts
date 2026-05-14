import { collection, query, where, getDocs, Timestamp } from 'firebase/firestore';
import { db } from '../firebase';

export const PLAN_LIMITS = {
  free: {
    customers: 10,
    workOrders: 10,
    budgets: 10,
    inventory: 20,
    pdf: false,
    exportExcel: false,
    suppliers: true,
    whatsapp: false,
    prioritySupport: false,
    vehicleHistory: false,
    conversations: false,
    financeReports: false,
    operationalReports: false,
    whatsappAgenda: false,
    teamCreation: false,
    pdfDownloadLimit: 0,
    monthlyGoal: false,
    gamification: false
  },
  pro: {
    customers: 50,
    workOrders: 50,
    budgets: 50,
    inventory: 500,
    pdf: true,
    exportExcel: true,
    suppliers: true,
    whatsapp: false,
    prioritySupport: false,
    vehicleHistory: true,
    conversations: false,
    financeReports: false,
    operationalReports: false,
    whatsappAgenda: false,
    teamCreation: false,
    pdfDownloadLimit: 50,
    monthlyGoal: false,
    gamification: false
  },
  elite: {
    customers: Infinity,
    workOrders: Infinity,
    budgets: Infinity,
    inventory: Infinity,
    pdf: true,
    exportExcel: true,
    suppliers: true,
    whatsapp: true,
    prioritySupport: true,
    vehicleHistory: true,
    conversations: true,
    financeReports: true,
    operationalReports: true,
    whatsappAgenda: true,
    teamCreation: true,
    pdfDownloadLimit: Infinity,
    monthlyGoal: true,
    gamification: true
  }
};

export async function checkPlanLimit(
  companyId: string, 
  plan: 'free' | 'start' | 'pro' | 'elite' | undefined, 
  type: 'customers' | 'workOrders' | 'budgets' | 'pdfDownloads' | 'inventory',
  role?: string
): Promise<{ allowed: boolean; current: number; limit: number }> {
  if (role === 'admin' || role === 'fornecedor') return { allowed: true, current: 0, limit: Infinity };
  
  let currentPlan = plan || 'free';
  if (currentPlan === 'start') currentPlan = 'free';
  const limit: number = (PLAN_LIMITS as any)[currentPlan]?.[type === 'pdfDownloads' ? 'pdfDownloadLimit' : type] || Infinity;
  
  if (limit === Infinity) return { allowed: true, current: 0, limit: Infinity };

  if (type === 'pdfDownloads') {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const q = query(
      collection(db, 'usage_logs'),
      where('companyId', '==', companyId),
      where('type', '==', 'pdf_download'),
      where('createdAt', '>=', Timestamp.fromDate(startOfMonth))
    );
    const snapshot = await getDocs(q);
    return { allowed: snapshot.size < limit, current: snapshot.size, limit };
  }

  const collectionName = type === 'inventory' ? 'inventory' : (type === 'customers' ? 'customers' : (type === 'workOrders' ? 'work_orders' : 'budgets'));
  
  let q;
  if (type === 'customers' || type === 'inventory') {
    // Total limits
    q = query(
      collection(db, collectionName),
      where('companyId', '==', companyId)
    );
  } else {
    // Monthly transactional limits
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    q = query(
      collection(db, collectionName),
      where('companyId', '==', companyId),
      where('createdAt', '>=', Timestamp.fromDate(startOfMonth))
    );
  }

  const snapshot = await getDocs(q);
  const current = snapshot.size;

  return {
    allowed: current < limit,
    current,
    limit
  };
}
