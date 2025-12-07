import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, onAuthStateChanged } from 'firebase/auth';
import { auth, signInWithGoogle, signOutUser, db } from '../firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';

interface AuthContextType {
  user: User | null;
  idToken: string | null;
  playerData: any;
  loading: boolean;
  login: () => Promise<void>;
  logout: () => Promise<void>;
  saveProgress: (data: any) => Promise<void>;
  updatePlayerData: (data: any) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [idToken, setIdToken] = useState<string | null>(null);
  const [playerData, setPlayerData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        try {
          const token = await currentUser.getIdToken();
          setUser(currentUser);
          setIdToken(token);

          // Fetch user data from Firestore
          const userDocRef = doc(db, "users", currentUser.uid);
          const userDoc = await getDoc(userDocRef);

          if (userDoc.exists()) {
            setPlayerData(userDoc.data());
          } else {
            // Create initial user doc if it doesn't exist
            const initialData = {
              email: currentUser.email,
              createdAt: new Date().toISOString(),
            };
            await setDoc(userDocRef, initialData);
            setPlayerData(initialData);
          }

          console.log('User logged in:', currentUser.uid);
        } catch (error) {
          console.error('Error loading user data:', error);
        }
      } else {
        setUser(null);
        setIdToken(null);
        setPlayerData(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const login = async () => {
    try {
      setLoading(true);
      await signInWithGoogle();
    } catch (error) {
      console.error('Login failed:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      await signOutUser();
      console.log('User logged out');
    } catch (error) {
      console.error('Logout failed:', error);
      throw error;
    }
  };

  const saveProgress = async (data: any) => {
    if (!user) {
      throw new Error('Not authenticated');
    }

    try {
      // Allow generic saving to user profile if needed, though specific game saving 
      // is handled in useGamePersistence. 
      // This function might be used for other settings.
      const userDocRef = doc(db, "users", user.uid);
      await setDoc(userDocRef, data, { merge: true });
      setPlayerData((prev: any) => ({ ...prev, ...data }));
      console.log('Progress saved!');
    } catch (error) {
      console.error('Save failed:', error);
      throw error;
    }
  };

  const updatePlayerData = (data: any) => {
    setPlayerData(data);
  };

  return (
    <AuthContext.Provider value={{
      user,
      idToken,
      playerData,
      loading,
      login,
      logout,
      saveProgress,
      updatePlayerData
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
