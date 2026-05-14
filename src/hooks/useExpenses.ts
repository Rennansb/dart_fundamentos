import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { Expense } from '../types';

export function useExpenses(companyId: string | undefined) {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!companyId) {
      setLoading(false);
      return;
    }
    
    const q = query(
      collection(db, 'expenses'),
      where('companyId', '==', companyId)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        date: doc.data().date?.toDate?.() || (doc.data().date ? new Date(doc.data().date) : new Date()),
      })) as Expense[];
      setExpenses(data);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching expenses:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [companyId]);

  return { expenses, loading };
}
