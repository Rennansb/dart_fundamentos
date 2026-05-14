import React, { createContext, useContext, useState, useEffect } from 'react';
import { auth, db } from './firebase';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut, User } from 'firebase/auth';
import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from './services/firestoreService';

interface UserProfile {
  id: string;
  email: string;
  name?: string;
  displayName?: string;
  photoURL?: string;
  role: 'admin' | 'shop' | 'employee' | 'fornecedor' | 'manager';
  plan?: 'free' | 'start' | 'pro' | 'elite';
  planExpiresAt?: any;
  companyId: string;
  companyName?: string;
  segment?: string;
  shopType?: string;
  supplierSegments?: string[];
  cpfCnpj?: string;
  ownerCpf?: string;
  ownerName?: string;
  fullName?: string;
  tradeName?: string;
  cnpj?: string;
  startDate?: string;
  birthDate?: string;
  phone?: string;
  uid?: string;
  status?: string;
  cep?: string;
  googleGmbLink?: string;
  pixKey?: string;
  address?: {
    cep: string;
    street: string;
    number: string;
    complement?: string;
    neighborhood: string;
    city: string;
    state: string;
  };
  businessHours?: {
    open: string;
    close: string;
    days: number[]; // 0 for Sunday, 1 for Monday, etc.
  };
  description?: string;
  forcePasswordChange?: boolean;
  setupCompleted?: boolean;
  logo?: string;
  maintenanceRecurrence?: number;
  monthlyGoal?: number;
  points?: number;
  level?: number;
  achievements?: string[];
  serviceHubCredits?: number;
}

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  effectiveProfile: UserProfile | null;
  impersonatedProfile: UserProfile | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (data: any) => void;
  selectedCompanyId: string | null;
  setSelectedCompanyId: (id: string | null) => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  effectiveProfile: null,
  impersonatedProfile: null,
  loading: true,
  login: async () => {},
  logout: async () => {},
  updateProfile: () => {},
  selectedCompanyId: null,
  setSelectedCompanyId: () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [impersonatedProfile, setImpersonatedProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedCompanyId, setSelectedCompanyIdState] = useState<string | null>(() => {
    return localStorage.getItem('service_hub_impersonated_id');
  });

  const setSelectedCompanyId = (id: string | null) => {
    if (id) {
      localStorage.setItem('service_hub_impersonated_id', id);
    } else {
      localStorage.removeItem('service_hub_impersonated_id');
    }
    setSelectedCompanyIdState(id);
  };

  const effectiveProfile = impersonatedProfile || profile;

  useEffect(() => {
    console.log("AuthContext: Initializing onAuthStateChanged listener");
    let unsubscribeProfile: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, (firebaseUser) => {
      console.log("AuthContext: onAuthStateChanged event fired", { 
        uid: firebaseUser?.uid || "null",
        email: firebaseUser?.email || "null"
      });
      
      // Clean up previous profile listener if it exists
      if (unsubscribeProfile) {
        unsubscribeProfile();
        unsubscribeProfile = null;
      }

      setUser(firebaseUser);
      
      if (firebaseUser) {
        const docRef = doc(db, 'users', firebaseUser.uid);
        console.log("AuthContext: Setting up profile listener for UID:", firebaseUser.uid);
        
        try {
          unsubscribeProfile = onSnapshot(docRef, async (docSnap) => {
            console.log("AuthContext: Profile snapshot received", { 
              exists: docSnap.exists(),
              id: docSnap.id
            });
            
            try {
              const isAdminEmail = ['santosrennan88@gmail.com', 'adm2@admin.com', 'megga11@hotmail.com'].includes(firebaseUser.email || '');
          
          if (docSnap.exists()) {
            const data = docSnap.data() as UserProfile;
            const effectiveRole = (isAdminEmail || data.role === 'admin') ? 'admin' : (data.role || 'shop');

            setProfile({ 
              ...data, 
              id: firebaseUser.uid,
              uid: firebaseUser.uid,
              role: effectiveRole,
              status: data.status || 'active',
              companyId: data.companyId || firebaseUser.uid
            });
          } else if (isAdminEmail) {
            // Emergency bypass for Admins
            console.warn("AuthContext: Admin profile missing, creating virtual profile");
            const virtualProfile: UserProfile = {
              id: firebaseUser.uid,
              uid: firebaseUser.uid,
              email: firebaseUser.email || '',
              role: 'admin',
              status: 'active',
              companyId: firebaseUser.uid,
              name: 'Administrador Hub',
              cpfCnpj: firebaseUser.email === 'megga11@hotmail.com' ? '06390720548' : undefined,
              phone: firebaseUser.email === 'megga11@hotmail.com' ? '71988648298' : undefined,
              cep: firebaseUser.email === 'megga11@hotmail.com' ? '40352140' : undefined,
            };
            setProfile(virtualProfile);
            
            // Try to auto-create the missing document (only once)
            try {
              // We use getDoc here to check once more and avoid race conditions from the snapshot itself
              const checkSnap = await getDoc(docRef);
              if (!checkSnap.exists()) {
                await setDoc(docRef, {
                  ...virtualProfile,
                  number: firebaseUser.email === 'megga11@hotmail.com' ? '24' : undefined,
                  createdAt: new Date().toISOString()
                }, { merge: true });
              }
            } catch (e) {
              console.error("AuthContext: Failed to auto-create admin doc", e);
            }
          } else {
            setProfile(null);
          }
          setLoading(false);
            } catch (innerError) {
              console.error("AuthContext: Error processing profile data", innerError);
              setLoading(false);
            }
          }, (error) => {
            console.error("AuthContext: Profile listener error (onSnapshot)", error);
            // DO NOT set profile to null here. A transient Firestore error or offline mode 
            // should not forcefully log the user out of their active session.
            setLoading(false);
          });
        } catch (setupError) {
          console.error("AuthContext: Error setting up profile listener", setupError);
          setLoading(false);
        }
      } else {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeProfile) unsubscribeProfile();
    };
  }, []);

  useEffect(() => {
    let unsubscribeImpersonation: (() => void) | null = null;

    if (selectedCompanyId && profile?.role === 'admin') {
      const docRef = doc(db, 'users', selectedCompanyId);
      unsubscribeImpersonation = onSnapshot(docRef, (docSnap) => {
        if (docSnap.exists()) {
          setImpersonatedProfile({ ...docSnap.data() as UserProfile, id: docSnap.id });
        } else {
          setImpersonatedProfile(null);
        }
      });
    } else {
      setImpersonatedProfile(null);
    }

    return () => {
      if (unsubscribeImpersonation) unsubscribeImpersonation();
    };
  }, [selectedCompanyId, profile?.role]);

  const updateProfile = async (data: any) => {
    if (!user) return;
    try {
      const targetId = (selectedCompanyId && profile?.role === 'admin') ? selectedCompanyId : user.uid;
      const docRef = doc(db, 'users', targetId);
      const targetBaseProfile = targetId === user.uid ? profile : impersonatedProfile;
      
      const fullData = {
        ...data,
        id: targetId,
        uid: targetId,
        companyId: targetBaseProfile?.companyId || targetId,
        role: targetBaseProfile?.role || 'shop'
      };
      
      await setDoc(docRef, fullData, { merge: true });
      
      if (targetId === user.uid) {
        setProfile(prev => prev ? { ...prev, ...data } : null);
      } else {
        setImpersonatedProfile(prev => prev ? { ...prev, ...data } : null);
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'users/' + user.uid);
    }
  };

  const login = async (email: string, password: string) => {
    try {
      await signInWithEmailAndPassword(auth, email, password);
      // loading state is handled by onAuthStateChanged -> onSnapshot flow
    } catch (error) {
      throw error;
    }
  };

  const logout = async () => {
    await signOut(auth);
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      profile, 
      effectiveProfile,
      impersonatedProfile,
      loading, 
      login, 
      logout, 
      updateProfile,
      selectedCompanyId,
      setSelectedCompanyId
    }}>
      {children}
    </AuthContext.Provider>
  );
};
