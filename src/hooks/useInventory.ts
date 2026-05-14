import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { InventoryItem } from '../types';

export function useInventory(companyId: string | undefined) {
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!companyId) {
      setLoading(false);
      return;
    }
    
    const q = query(
      collection(db, 'inventory'),
      where('companyId', '==', companyId)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      })) as InventoryItem[];
      setInventory(data);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching inventory:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [companyId]);

  return { inventory, loading };
}
