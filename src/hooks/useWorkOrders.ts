import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { WorkOrder } from '../types';

export function useWorkOrders(companyId: string | undefined) {
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!companyId) {
      setLoading(false);
      return;
    }
    
    const q = query(
      collection(db, 'work_orders'),
      where('companyId', '==', companyId)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate?.() || (doc.data().createdAt ? new Date(doc.data().createdAt) : new Date()),
        updatedAt: doc.data().updatedAt?.toDate?.() || (doc.data().updatedAt ? new Date(doc.data().updatedAt) : new Date()),
      })) as WorkOrder[];
      setWorkOrders(data);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching work orders:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [companyId]);

  return { workOrders, loading };
}
