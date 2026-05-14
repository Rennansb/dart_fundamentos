import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { Customer } from '../types';

export function useCustomers(companyId: string | undefined) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!companyId) {
      setLoading(false);
      return;
    }
    
    const q = query(
      collection(db, 'customers'),
      where('companyId', '==', companyId)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate?.() || (doc.data().createdAt ? new Date(doc.data().createdAt) : new Date()),
      })) as Customer[];
      setCustomers(data);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching customers:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [companyId]);

  return { customers, loading };
}
