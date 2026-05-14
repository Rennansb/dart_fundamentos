import { collection, query, where, getDocs, addDoc, serverTimestamp, orderBy, limit, Timestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { getStartOfTodayBRT, getEndOfTodayBRT } from '../utils/dateUtils';

/**
 * Historical Stats Snapshot Service
 * Captures daily aggregates for dashboard trends.
 */
export const snapshotService = {
  /**
   * Records a snapshot of today's stats for a company if it doesn't already exist.
   */
  async recordDailySnapshot(companyId: string, stats: { 
    revenue: number; 
    orders: number; 
    inventoryValue: number;
    healthScore: number;
  }) {
    if (!companyId) return;

    try {
      const todayStart = getStartOfTodayBRT();
      const todayEnd = getEndOfTodayBRT();

      // Check if snapshot already exists for today
      const q = query(
        collection(db, 'stats_snapshots'),
        where('companyId', '==', companyId),
        where('createdAt', '>=', Timestamp.fromDate(todayStart)),
        where('createdAt', '<=', Timestamp.fromDate(todayEnd)),
        limit(1)
      );

      const snapshot = await getDocs(q);
      if (snapshot.empty) {
        await addDoc(collection(db, 'stats_snapshots'), {
          companyId,
          ...stats,
          createdAt: serverTimestamp()
        });
      }
    } catch (error) {
      console.error("Snapshot Recording Error:", error);
    }
  },

  /**
   * Fetches the last N daily snapshots for a company.
   */
  async getHistoricalSnapshots(companyId: string, days: number = 7) {
    if (!companyId) return [];

    try {
      const q = query(
        collection(db, 'stats_snapshots'),
        where('companyId', '==', companyId),
        orderBy('createdAt', 'desc'),
        limit(days)
      );

      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate?.() || new Date(doc.data().createdAt)
      })).reverse();
    } catch (error) {
      console.error("Snapshot Fetch Error:", error);
      return [];
    }
  }
};
