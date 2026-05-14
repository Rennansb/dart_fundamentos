import { 
  collection, 
  addDoc, 
  query, 
  where, 
  getDocs, 
  orderBy, 
  serverTimestamp,
  Timestamp 
} from 'firebase/firestore';
import { db } from '../firebase';

export interface VehicleHistoryRecord {
  plate: string;
  brand: string;
  model: string;
  customerName: string;
  customerCpf?: string;
  date: Timestamp | any;
  shopId: string;
  shopName: string;
  reportedProblem: string;
  services: string[];
  parts: string[];
  comments: string[];
  mileage?: string;
  workOrderId: string;
  totalCost: number;
}

export const historyService = {
  /**
   * Saves a snapshot of a completed Work Order to the global vehicle history.
   */
  async saveVehicleHistory(workOrder: any, profile: any) {
    try {
      if (!workOrder.equipmentId || !workOrder.vehicleInfo) {
        console.warn("Work order missing vehicle info for history recording.");
        return;
      }

      // Extract plate from vehicleInfo or from the vehicle record
      // In this system, 'plate' is often part of vehicleInfo or stored in 'equipmentId' docs
      // Let's try to get it from the vehicle doc if not readily available
      let plate = workOrder.plate;
      if (!plate) {
        const vehicleDoc = await getDocs(query(collection(db, 'vehicles'), where('id', '==', workOrder.equipmentId)));
        if (!vehicleDoc.empty) {
          plate = vehicleDoc.docs[0].data().plate;
        }
      }

      if (!plate) {
        console.warn("Could not find plate for vehicle history.");
        return;
      }

      const historyRecord: Omit<VehicleHistoryRecord, 'date'> & { date: any } = {
        plate: plate.toUpperCase().trim(),
        brand: workOrder.brand || '',
        model: workOrder.model || '',
        customerName: workOrder.customerName || 'Cliente',
        customerCpf: workOrder.customerCpf || '',
        date: serverTimestamp(),
        shopId: workOrder.companyId,
        shopName: profile.companyName || profile.displayName || 'Oficina Hub',
        reportedProblem: workOrder.reportedProblem || '',
        services: (workOrder.services || []).map((s: any) => s.name),
        parts: (workOrder.partsUsed || []).map((p: any) => p.name || p),
        comments: (workOrder.timeline || [])
          .filter((t: any) => t.type === 'note' || t.type === 'diagnosis')
          .map((t: any) => t.content),
        mileage: workOrder.mileage || '',
        workOrderId: workOrder.id,
        totalCost: workOrder.totalCost || 0
      };

      await addDoc(collection(db, 'vehicle_history'), historyRecord);
      console.log("Vehicle history recorded successfully.");
    } catch (error) {
      console.error("Error saving vehicle history:", error);
    }
  },

  /**
   * Fetches the global history for a vehicle by its plate.
   */
  async getVehicleHistory(plate: string): Promise<VehicleHistoryRecord[]> {
    try {
      const q = query(
        collection(db, 'vehicle_history'),
        where('plate', '==', plate.toUpperCase().trim()),
        orderBy('date', 'desc')
      );
      
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as any;
    } catch (error) {
      console.error("Error fetching vehicle history:", error);
      return [];
    }
  }
};
