import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User } from 'firebase/auth';
import { onAuthChange, AuthUser, signOut as authSignOut } from '../services/auth';
import { doc, getDoc } from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../services/firebase';

interface AuthContextType {
  user: AuthUser | null;
  firebaseUser: User | null;
  loading: boolean;
  isAuthenticated: boolean;
  signOut: () => Promise<void>;
  hasRole: (roles: string[]) => boolean;
  canAccessClient: (clientId: string) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Demo mode when Firebase is not configured
    if (!isFirebaseConfigured) {
      // Set demo user for development
      setUser({
        uid: 'demo-user',
        email: 'demo@weaccounting.com',
        displayName: 'Demo User',
        role: 'manager', // Demo with manager role
        staffId: 'demo-user',
        assignedClients: [], // Access all in demo mode
      });
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthChange(async (fbUser) => {
      setFirebaseUser(fbUser);

      if (fbUser && db) {
        try {
          // Fetch staff details
          const staffDoc = await getDoc(doc(db, 'staff', fbUser.uid));
          const staffData = staffDoc.exists() ? staffDoc.data() : {};

          setUser({
            uid: fbUser.uid,
            email: fbUser.email,
            displayName: fbUser.displayName || staffData.name || fbUser.email?.split('@')[0] || 'User',
            role: staffData.role || 'accountant',
            staffId: fbUser.uid,
            assignedClients: staffData.assigned_clients || [],
          });
        } catch (error) {
          console.error('Error fetching user data:', error);
          setUser(null);
        }
      } else {
        setUser(null);
      }

      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleSignOut = async () => {
    await authSignOut();
    setUser(null);
    setFirebaseUser(null);
  };

  const hasRole = (roles: string[]): boolean => {
    if (!user) return false;
    return roles.includes(user.role);
  };

  const canAccessClient = (clientId: string): boolean => {
    if (!user) return false;
    // Demo mode or admin/manager can access all
    if (user.uid === 'demo-user') return true;
    if (['admin', 'manager'].includes(user.role)) return true;
    return user.assignedClients.includes(clientId);
  };

  const value: AuthContextType = {
    user,
    firebaseUser,
    loading,
    isAuthenticated: !!user,
    signOut: handleSignOut,
    hasRole,
    canAccessClient,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext;
