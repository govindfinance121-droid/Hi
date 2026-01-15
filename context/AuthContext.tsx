import React, { createContext, useContext, useState, useEffect } from 'react';
import { UserProfile, UserRole } from '../types';
import { db, ref, onValue, set, update, get, child } from '../services/firebase';

interface AuthContextType {
  user: UserProfile | null;
  loading: boolean;
  login: (email: string, password?: string) => Promise<void>;
  signup: (email: string, username: string, password: string, referralCode?: string) => Promise<void>;
  logout: () => void;
  updateProfile: (data: Partial<UserProfile>) => void;
  isAdmin: boolean;
  isMaster: boolean; // Only true for the real Owner
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Initialize from localStorage immediately to prevent "Loading..." flash or stuck state
  const [user, setUser] = useState<UserProfile | null>(() => {
    const stored = localStorage.getItem('real_esports_user');
    try {
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });
  
  const [loading, setLoading] = useState(true);

  // Helper to clear user session
  const clearSession = () => {
    setUser(null);
    localStorage.removeItem('real_esports_user');
  };

  // Sync user data from Firebase Realtime DB if logged in
  useEffect(() => {
    let unsubscribe: (() => void) | undefined;

    const initAuth = async () => {
      const storedUser = localStorage.getItem('real_esports_user');
      
      if (storedUser) {
        try {
          const parsedUser = JSON.parse(storedUser);
          
          // Force Admin Role if email matches (Security Fallback)
          if (parsedUser.email === 'admin@realesports.com') {
             parsedUser.role = UserRole.ADMIN;
             parsedUser.uid = 'ADMIN_MASTER'; // Ensure UID is consistent
          }

          if (db) {
            // Listen to live changes
            const userRef = ref(db, `users/${parsedUser.uid}`);
            
            // Set up listener
            unsubscribe = onValue(userRef, (snapshot) => {
              const data = snapshot.val();
              
              // 1. Check if user still exists
              if (!data && parsedUser.uid !== 'ADMIN_MASTER') {
                  clearSession();
                  return;
              }

              if (data) {
                // 2. CHECK BLOCK STATUS (Auto Logout)
                if (data.isBlocked) {
                    clearSession();
                    // Optional: You could trigger an alert here, but alerts inside effects can be spammy
                    return;
                }

                const updatedUser = { ...parsedUser, ...data };
                
                // Double check Admin role
                if (updatedUser.email === 'admin@realesports.com') {
                    updatedUser.role = UserRole.ADMIN;
                }

                // CHECK VERIFICATION EXPIRY
                if (updatedUser.isVerified && updatedUser.verificationExpiry) {
                    if (Date.now() > updatedUser.verificationExpiry) {
                        // Expire verification
                        update(userRef, { 
                            isVerified: false, 
                            verificationTier: null, 
                            verificationExpiry: null,
                            verificationStatus: 'NONE'
                        });
                        return; 
                    }
                }

                setUser(updatedUser);
                localStorage.setItem('real_esports_user', JSON.stringify(updatedUser));
                
                // Update Active Status
                update(userRef, { lastActive: Date.now() });
              } else if (parsedUser.uid === 'ADMIN_MASTER') {
                // If master admin isn't in DB yet, keep local state
                setUser(parsedUser);
              }
            });
          } else {
            // If no DB connection, rely on local storage
            setUser(parsedUser);
          }
        } catch (e) {
          console.error("Auth Load Error", e);
          clearSession();
        }
      } else {
        setUser(null);
      }
      
      // CRITICAL: Ensure loading is set to false after init attempt
      setLoading(false);
    };

    initAuth();

    // Cleanup listener on unmount
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  const login = async (email: string, password?: string) => {
    const cleanEmail = email.trim().toLowerCase();
    const cleanPass = password ? password.trim() : '';

    // 1. HARDCODED ADMIN CHECK (Master Key)
    if (cleanEmail === 'admin@realesports.com') {
      if (cleanPass === 'Jhatu&22') {
        const adminUser: UserProfile = {
          uid: 'ADMIN_MASTER',
          email: 'admin@realesports.com',
          username: 'Real Esports Admin',
          role: UserRole.ADMIN,
          balance: 999999,
          isBlocked: false,
          isVerified: true,
          verificationTier: 'GOLD',
          verificationStatus: 'APPROVED',
          createdAt: Date.now()
        };
        setUser(adminUser);
        localStorage.setItem('real_esports_user', JSON.stringify(adminUser));
        return; 
      } else {
        throw new Error("Invalid Admin Password");
      }
    }

    // 2. REAL USER CHECK (Search in DB)
    if (db) {
      const usersRef = ref(db, 'users');
      const snapshot = await get(usersRef);
      if (snapshot.exists()) {
        const users = snapshot.val();
        const foundUserKey = Object.keys(users).find(key => users[key].email === cleanEmail);
        
        if (foundUserKey) {
           const foundUser = users[foundUserKey];
           
           if (foundUser.isBlocked) {
               throw new Error("This account has been banned by Admin.");
           }

           setUser(foundUser);
           localStorage.setItem('real_esports_user', JSON.stringify(foundUser));
           return;
        }
      }
      throw new Error("User not found. Please Sign Up.");
    }

    throw new Error("Connection Error");
  };

  const signup = async (email: string, username: string, password: string, referralCode?: string) => {
    const cleanEmail = email.trim().toLowerCase();
    
    // PREVENT ADMIN SIGNUP
    if (cleanEmail === 'admin@realesports.com') {
      throw new Error("Cannot sign up as Admin. Use Login.");
    }

    // Generate ID
    const newUid = 'user_' + Date.now();

    const newUser: UserProfile = {
      uid: newUid,
      email: cleanEmail,
      username,
      role: UserRole.USER,
      balance: 0, 
      isBlocked: false,
      isVerified: false,
      verificationStatus: 'NONE',
      createdAt: Date.now(),
      referralCount: 0,
      hasDeposited: false
    };

    if (referralCode && db) {
       try {
         const referrerRef = ref(db, `users/${referralCode}`);
         const snap = await get(referrerRef);
         if (snap.exists()) {
           newUser.referredBy = referralCode;
         }
       } catch (e) {
         console.log("Referral check failed", e);
       }
    }
    
    if (db) {
      const usersRef = ref(db, 'users');
      const snapshot = await get(usersRef);
      if (snapshot.exists()) {
        const users = snapshot.val();
        // ONE EMAIL = ONE ID CHECK
        const exists = Object.values(users).some((u: any) => u.email === cleanEmail);
        if (exists) throw new Error("This Email is already registered with another ID.");
      }

      await set(ref(db, `users/${newUser.uid}`), newUser);
    }

    setUser(newUser);
    localStorage.setItem('real_esports_user', JSON.stringify(newUser));
  };

  const logout = () => {
    clearSession();
  };

  const updateProfile = (data: Partial<UserProfile>) => {
    if (user) {
      const updatedUser = { ...user, ...data };
      setUser(updatedUser);
      localStorage.setItem('real_esports_user', JSON.stringify(updatedUser));
      
      if (db && user.uid !== 'ADMIN_MASTER') {
        update(ref(db, `users/${user.uid}`), data);
      }
    }
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      loading, 
      login, 
      signup, 
      logout, 
      updateProfile,
      // Admin includes Master and Sub-Admins
      isAdmin: user?.role === UserRole.ADMIN || user?.role === UserRole.SUB_ADMIN || user?.email === 'admin@realesports.com',
      // Master is only the hardcoded email/uid
      isMaster: user?.email === 'admin@realesports.com' || user?.uid === 'ADMIN_MASTER'
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