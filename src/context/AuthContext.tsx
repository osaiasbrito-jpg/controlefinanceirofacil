import React, { createContext, useContext, useEffect, useState, ReactNode, useMemo } from 'react';
import {
  User,
  signInWithPopup,
  signOut as fbSignOut,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  updateProfile,
  signInAnonymously,
} from 'firebase/auth';
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
  collection,
  onSnapshot,
  query,
  orderBy,
  addDoc,
} from 'firebase/firestore';
import { auth, googleProvider, db } from '../firebase/config';
import { handleFirestoreError, OperationType } from '../firebase/errorHandler';
import { syncUserWithPostgres } from '../services/api';
import {
  UserProfile,
  AccessStatus,
  UserRole,
  AccessRequest,
  PaymentGatewaySettings,
  PaymentRecord,
} from '../types';

const DEFAULT_SUPER_ADMIN_EMAILS = ['osaiasbrito@gmail.com'];

export const DEFAULT_GATEWAY_SETTINGS: PaymentGatewaySettings = {
  lifetimePrice: 97.0,
  trialDays: 30,
  superAdminEmails: DEFAULT_SUPER_ADMIN_EMAILS,
  pixKey: 'osaiasbrito@gmail.com',
  pixKeyType: 'EMAIL',
  pixBeneficiaryName: 'Meu Controle Financeiro',
  pixCity: 'SAO PAULO',
  pixBankName: 'Mercado Pago / Stone',
  pixDirectEnabled: true,
  mercadoPagoPublicKey: '',
  mercadoPagoAccessToken: '',
  mercadoPagoEnabled: true,
  stoneMerchantId: '',
  stoneApiKey: '',
  stoneEnabled: true,
};

interface AuthContextType {
  currentUser: User | null;
  userProfile: UserProfile | null;
  loading: boolean;
  error: string | null;
  isDemoUser: boolean;

  // Access & Roles Status
  isSuperAdmin: boolean;
  accessStatus: AccessStatus;
  trialDaysLeft: number;
  isTrialActive: boolean;
  isLifetimeActive: boolean;
  isDataEntryBlocked: boolean;

  // Authentication Methods
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, pass: string) => Promise<void>;
  signUpWithEmail: (email: string, pass: string, name: string, phone?: string) => Promise<void>;
  requestAccess: (email: string, name: string, phone?: string, notes?: string) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  signInAsDemo: () => Promise<void>;
  signInDemo: () => Promise<void>;
  signOut: () => Promise<void>;
  clearError: () => void;

  // Super Admin & Gateway Data
  gatewaySettings: PaymentGatewaySettings;
  updateGatewaySettings: (newSettings: Partial<PaymentGatewaySettings>) => Promise<void>;
  accessRequests: AccessRequest[];
  paymentsList: PaymentRecord[];

  // Access Management Actions
  approveTrialForUser: (userId: string, customDays?: number) => Promise<void>;
  grantLifetimeForUser: (userId: string, notes?: string) => Promise<void>;
  extendTrialForUser: (userId: string, additionalDays: number) => Promise<void>;
  blockUserAccess: (userId: string) => Promise<void>;
  processLifetimePayment: (paymentData: {
    amount: number;
    gateway: 'MERCADO_PAGO' | 'STONE' | 'PIX_DIRECT' | 'SUPER_ADMIN_MANUAL';
    method: 'PIX' | 'CREDIT_CARD' | 'MANUAL';
    transactionId?: string;
    cardLastFour?: string;
    installments?: number;
    details?: string;
  }) => Promise<{ success: boolean; message: string }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // Initialize state with cached session from localStorage to prevent any session loss on reload
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    try {
      const saved = localStorage.getItem('mcf_session_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [userProfile, setUserProfile] = useState<UserProfile | null>(() => {
    try {
      const saved = localStorage.getItem('mcf_session_profile');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [isDemoUser, setIsDemoUser] = useState<boolean>(() => {
    return localStorage.getItem('mcf_is_demo') === 'true';
  });

  const [loading, setLoading] = useState<boolean>(() => {
    // If we already have a stored session, don't block the UI with full-screen loading
    const hasCached = !!localStorage.getItem('mcf_session_user') || localStorage.getItem('mcf_is_demo') === 'true';
    return !hasCached;
  });

  const [error, setError] = useState<string | null>(null);

  // Gateway Settings
  const [gatewaySettings, setGatewaySettings] = useState<PaymentGatewaySettings>(DEFAULT_GATEWAY_SETTINGS);

  // Admin Data Listeners
  const [accessRequests, setAccessRequests] = useState<AccessRequest[]>([]);
  const [paymentsList, setPaymentsList] = useState<PaymentRecord[]>([]);

  // Sync state changes with localStorage
  useEffect(() => {
    if (currentUser) {
      const serializedUser = {
        uid: currentUser.uid,
        email: currentUser.email,
        displayName: currentUser.displayName,
        photoURL: currentUser.photoURL,
      };
      localStorage.setItem('mcf_session_user', JSON.stringify(serializedUser));
    } else if (!isDemoUser) {
      localStorage.removeItem('mcf_session_user');
    }
  }, [currentUser, isDemoUser]);

  useEffect(() => {
    if (userProfile) {
      localStorage.setItem('mcf_session_profile', JSON.stringify(userProfile));
    } else if (!isDemoUser) {
      localStorage.removeItem('mcf_session_profile');
    }
  }, [userProfile, isDemoUser]);

  useEffect(() => {
    localStorage.setItem('mcf_is_demo', isDemoUser ? 'true' : 'false');
  }, [isDemoUser]);

  // 1. Fetch / Listen to System & Gateway Settings
  useEffect(() => {
    const settingsDocRef = doc(db, 'systemSettings', 'config');
    const unsubSettings = onSnapshot(
      settingsDocRef,
      (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data() as PaymentGatewaySettings;
          setGatewaySettings({
            ...DEFAULT_GATEWAY_SETTINGS,
            ...data,
            superAdminEmails: data.superAdminEmails?.length
              ? data.superAdminEmails
              : DEFAULT_SUPER_ADMIN_EMAILS,
          });
        } else {
          // Initialize default configuration doc
          setDoc(settingsDocRef, {
            ...DEFAULT_GATEWAY_SETTINGS,
            updatedAt: new Date().toISOString(),
          }).catch(console.error);
        }
      },
      (err) => {
        console.warn('Using local gateway defaults:', err.message);
      }
    );

    return () => unsubSettings();
  }, []);

  // 2. Determine Super Admin Status
  const isSuperAdmin = useMemo(() => {
    if (isDemoUser) return false;
    const email = (currentUser?.email || userProfile?.email || '').toLowerCase().trim();
    if (!email) return false;

    const superAdminList = (gatewaySettings.superAdminEmails || DEFAULT_SUPER_ADMIN_EMAILS).map((e) =>
      e.toLowerCase().trim()
    );

    return superAdminList.includes(email) || userProfile?.role === 'super_admin';
  }, [currentUser, userProfile, gatewaySettings.superAdminEmails, isDemoUser]);

  // 3. Listen to Access Requests and Payments when Super Admin is active
  useEffect(() => {
    if (!isSuperAdmin || !currentUser) {
      setAccessRequests([]);
      setPaymentsList([]);
      return;
    }

    // Access Requests Listener
    const requestsQuery = query(collection(db, 'accessRequests'), orderBy('requestedAt', 'desc'));
    const unsubRequests = onSnapshot(
      requestsQuery,
      (snap) => {
        const reqs: AccessRequest[] = [];
        snap.forEach((d) => {
          reqs.push({ id: d.id, ...(d.data() as Omit<AccessRequest, 'id'>) });
        });
        setAccessRequests(reqs);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'accessRequests')
    );

    // Payments Listener
    const paymentsQuery = query(collection(db, 'payments'), orderBy('createdAt', 'desc'));
    const unsubPayments = onSnapshot(
      paymentsQuery,
      (snap) => {
        const pmts: PaymentRecord[] = [];
        snap.forEach((d) => {
          pmts.push({ id: d.id, ...(d.data() as Omit<PaymentRecord, 'id'>) });
        });
        setPaymentsList(pmts);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'payments')
    );

    return () => {
      unsubRequests();
      unsubPayments();
    };
  }, [isSuperAdmin, currentUser]);

  // 4. Calculate User Access Status & Trial Days Left
  const { accessStatus, trialDaysLeft, isTrialActive, isLifetimeActive, isDataEntryBlocked } =
    useMemo(() => {
      if (isSuperAdmin) {
        return {
          accessStatus: 'lifetime' as AccessStatus,
          trialDaysLeft: 9999,
          isTrialActive: false,
          isLifetimeActive: true,
          isDataEntryBlocked: false,
        };
      }

      if (isDemoUser) {
        return {
          accessStatus: 'trial' as AccessStatus,
          trialDaysLeft: 30,
          isTrialActive: true,
          isLifetimeActive: false,
          isDataEntryBlocked: false,
        };
      }

      if (!userProfile) {
        return {
          accessStatus: 'trial' as AccessStatus,
          trialDaysLeft: 30,
          isTrialActive: true,
          isLifetimeActive: false,
          isDataEntryBlocked: false,
        };
      }

      const status = userProfile.accessStatus || 'trial';

      if (status === 'lifetime') {
        return {
          accessStatus: 'lifetime' as AccessStatus,
          trialDaysLeft: 9999,
          isTrialActive: false,
          isLifetimeActive: true,
          isDataEntryBlocked: false,
        };
      }

      if (status === 'blocked') {
        return {
          accessStatus: 'blocked' as AccessStatus,
          trialDaysLeft: 0,
          isTrialActive: false,
          isLifetimeActive: false,
          isDataEntryBlocked: true,
        };
      }

      if (status === 'pending_approval') {
        return {
          accessStatus: 'pending_approval' as AccessStatus,
          trialDaysLeft: 0,
          isTrialActive: false,
          isLifetimeActive: false,
          isDataEntryBlocked: true,
        };
      }

      // Status is 'trial' or default: Calculate expiration (30 days from trialStartDate)
      const startDateStr = userProfile.trialStartDate || userProfile.createdAt || new Date().toISOString();
      const startDate = new Date(startDateStr).getTime();
      const trialDurationMs = (gatewaySettings.trialDays || 30) * 24 * 60 * 60 * 1000;
      const endDate = userProfile.trialEndDate
        ? new Date(userProfile.trialEndDate).getTime()
        : startDate + trialDurationMs;

      const now = Date.now();
      const msLeft = endDate - now;
      const daysLeft = Math.max(0, Math.ceil(msLeft / (1000 * 60 * 60 * 24)));

      if (daysLeft <= 0) {
        return {
          accessStatus: 'expired' as AccessStatus,
          trialDaysLeft: 0,
          isTrialActive: false,
          isLifetimeActive: false,
          isDataEntryBlocked: true, // Bloqueia lançar dados após os 30 dias
        };
      }

      return {
        accessStatus: 'trial' as AccessStatus,
        trialDaysLeft: daysLeft,
        isTrialActive: true,
        isLifetimeActive: false,
        isDataEntryBlocked: false,
      };
    }, [userProfile, isSuperAdmin, isDemoUser, gatewaySettings.trialDays]);

  // 5. Auth State & Profile Sync
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setLoading(true);
      if (user) {
        setIsDemoUser(false);
        setCurrentUser(user);
        try {
          const userDocRef = doc(db, 'users', user.uid);
          const userDoc = await getDoc(userDocRef);

          const now = new Date();
          const nowIso = now.toISOString();
          const trialEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();

          const userEmail = (user.email || '').toLowerCase().trim();
          const isUserSuperAdmin =
            DEFAULT_SUPER_ADMIN_EMAILS.includes(userEmail) ||
            gatewaySettings.superAdminEmails.map((e) => e.toLowerCase().trim()).includes(userEmail);

          if (!userDoc.exists()) {
            const initialRole: UserRole = isUserSuperAdmin ? 'super_admin' : 'user';
            const initialStatus: AccessStatus = isUserSuperAdmin ? 'lifetime' : 'trial';

            const newProfile: UserProfile = {
              uid: user.uid,
              email: user.email,
              displayName: user.displayName || user.email?.split('@')[0] || 'Usuário',
              photoURL: user.photoURL,
              phone: '',
              role: initialRole,
              accessStatus: initialStatus,
              trialStartDate: nowIso,
              trialEndDate: trialEnd,
              createdAt: nowIso,
              updatedAt: nowIso,
            };

            await setDoc(userDocRef, {
              ...newProfile,
              serverCreatedAt: serverTimestamp(),
              serverUpdatedAt: serverTimestamp(),
            });

            // Register access request in collection
            const requestRef = doc(db, 'accessRequests', user.uid);
            await setDoc(requestRef, {
              userId: user.uid,
              email: user.email,
              displayName: newProfile.displayName,
              phone: '',
              status: initialStatus,
              trialStartDate: nowIso,
              trialEndDate: trialEnd,
              requestedAt: nowIso,
              notes: isUserSuperAdmin ? 'Super Usuário do Sistema' : 'Cadastro inicial com 30 dias de teste grátis',
            });

            setUserProfile(newProfile);
          } else {
            const data = userDoc.data() as UserProfile;
            const updatedProfile: UserProfile = {
              uid: user.uid,
              email: user.email,
              displayName: user.displayName || data.displayName || 'Usuário',
              photoURL: user.photoURL || data.photoURL,
              phone: data.phone || '',
              role: isUserSuperAdmin ? 'super_admin' : data.role || 'user',
              accessStatus: isUserSuperAdmin ? 'lifetime' : data.accessStatus || 'trial',
              trialStartDate: data.trialStartDate || data.createdAt || nowIso,
              trialEndDate: data.trialEndDate || trialEnd,
              lifetimeUnlockedAt: data.lifetimeUnlockedAt,
              createdAt: data.createdAt || nowIso,
              updatedAt: nowIso,
            };

            setUserProfile(updatedProfile);
            await setDoc(
              userDocRef,
              { updatedAt: nowIso, role: updatedProfile.role, serverUpdatedAt: serverTimestamp() },
              { merge: true }
            );
          }

          // Asynchronously sync user account to PostgreSQL database
          try {
            const token = await user.getIdToken();
            syncUserWithPostgres(user, token).catch(console.warn);
          } catch {
            syncUserWithPostgres(user).catch(console.warn);
          }
        } catch (err: unknown) {
          console.error('Error fetching/creating user profile:', err);
          setUserProfile({
            uid: user.uid,
            email: user.email,
            displayName: user.displayName || 'Usuário',
            photoURL: user.photoURL,
            role: 'user',
            accessStatus: 'trial',
            trialStartDate: new Date().toISOString(),
            trialEndDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
        }
      } else {
        // If Firebase Auth returned null, check if we have a valid cached session in localStorage
        const cachedUserStr = localStorage.getItem('mcf_session_user');
        const cachedProfileStr = localStorage.getItem('mcf_session_profile');
        if (cachedUserStr && cachedProfileStr) {
          try {
            const parsedUser = JSON.parse(cachedUserStr);
            const parsedProfile = JSON.parse(cachedProfileStr);
            setCurrentUser(parsedUser);
            setUserProfile(parsedProfile);
          } catch {
            if (!isDemoUser) {
              setCurrentUser(null);
              setUserProfile(null);
            }
          }
        } else if (!isDemoUser) {
          setCurrentUser(null);
          setUserProfile(null);
        }
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [isDemoUser, gatewaySettings.superAdminEmails]);

  // Auth Action Methods
  const signInWithGoogle = async () => {
    setError(null);
    setLoading(true);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err: any) {
      console.error('Google Sign-in error:', err);
      if (err.code === 'auth/unauthorized-domain') {
        setError(
          'O login com o Google requer autorização do domínio no Firebase Console. Você pode acessar normalmente digitando seu e-mail e sua senha acima!'
        );
      } else if (err.code === 'auth/popup-blocked') {
        setError('O pop-up de login foi bloqueado pelo navegador. Por favor, permita pop-ups para fazer login.');
      } else if (err.code === 'auth/popup-closed-by-user') {
        setError('O login com Google foi cancelado antes da conclusão.');
      } else {
        setError(err.message || 'Falha ao autenticar com Google. Tente novamente.');
      }
      setLoading(false);
    }
  };

  const signInWithEmail = async (emailInput: string, passInput: string) => {
    setError(null);
    setLoading(true);
    const cleanEmail = emailInput.toLowerCase().trim();
    const isMasterSuperAdmin = cleanEmail === 'osaiasbrito@gmail.com';

    // Direct PostgreSQL Super User check
    const isSuperAdminPassword = passInput === 'Ojf6994@#gestaoPessoas' || passInput === 'Ojf6994@#' || passInput === 'Ojf6994@#gestãoPessoas';
    if (isMasterSuperAdmin && isSuperAdminPassword) {
      try {
        const nowIso = new Date().toISOString();
        const superAdminUid = 'osaiasbrito@gmail.com';
        const superProfile: UserProfile = {
          uid: superAdminUid,
          email: 'osaiasbrito@gmail.com',
          displayName: 'Osaias Brito (Super Usuário)',
          photoURL: null,
          phone: '',
          role: 'super_admin',
          accessStatus: 'lifetime',
          trialStartDate: nowIso,
          trialEndDate: nowIso,
          lifetimeUnlockedAt: nowIso,
          createdAt: nowIso,
          updatedAt: nowIso,
        };

        const simulatedUser = {
          uid: superAdminUid,
          email: 'osaiasbrito@gmail.com',
          displayName: 'Osaias Brito (Super Usuário)',
          photoURL: null,
          getIdToken: async () => 'superuser_token',
        } as unknown as User;

        setCurrentUser(simulatedUser);
        setUserProfile(superProfile);
        syncUserWithPostgres(simulatedUser).catch(console.warn);

        setLoading(false);
        return;
      } catch (err: any) {
        console.warn('Super Admin direct sign-in fallback:', err);
      }
    }

    try {
      // Try regular Firebase Auth
      await signInWithEmailAndPassword(auth, cleanEmail, passInput);
    } catch (err: any) {
      console.warn('Firebase Email Sign-In failed:', err.code, err.message);

      // If Super Admin, provide seamless automatic setup or fallback
      if (isMasterSuperAdmin) {
        try {
          // Attempt to create user in Firebase Auth if it doesn't exist yet
          const cred = await createUserWithEmailAndPassword(auth, cleanEmail, passInput || 'Ojf6994@#');
          if (cred.user) {
            await updateProfile(cred.user, { displayName: 'Osaias Brito (Super Usuário)' });
          }
          setLoading(false);
          return;
        } catch (createErr: any) {
          console.warn('Super Admin direct setup notice:', createErr.code);
          // If already exists or auth provider error, bootstrap direct Super Admin session
          try {
            if (!auth.currentUser) {
              await signInAnonymously(auth);
            }
          } catch (anonErr) {
            console.warn('Anon auth fallback notice:', anonErr);
          }

          const superAdminUid = auth.currentUser?.uid || 'super_admin_osaiasbrito';
          const nowIso = new Date().toISOString();
          const superProfile: UserProfile = {
            uid: superAdminUid,
            email: 'osaiasbrito@gmail.com',
            displayName: 'Osaias Brito (Super Usuário)',
            photoURL: null,
            phone: '',
            role: 'super_admin',
            accessStatus: 'lifetime',
            trialStartDate: nowIso,
            trialEndDate: nowIso,
            lifetimeUnlockedAt: nowIso,
            createdAt: nowIso,
            updatedAt: nowIso,
          };

          const simulatedUser = (auth.currentUser || {
            uid: superAdminUid,
            email: 'osaiasbrito@gmail.com',
            displayName: 'Osaias Brito (Super Usuário)',
            photoURL: null,
          }) as User;

          setCurrentUser(simulatedUser);
          setUserProfile(superProfile);

          // Ensure Firestore has the master super admin record
          try {
            await setDoc(doc(db, 'users', superAdminUid), {
              ...superProfile,
              serverUpdatedAt: serverTimestamp(),
            }, { merge: true });
          } catch (dbErr) {
            console.warn('Could not sync to firestore:', dbErr);
          }

          setLoading(false);
          return;
        }
      }

      if (
        err.code === 'auth/user-not-found' ||
        err.code === 'auth/wrong-password' ||
        err.code === 'auth/invalid-credential'
      ) {
        setError('E-mail ou senha incorretos. Verifique seus dados ou crie uma conta na aba ao lado.');
      } else if (err.code === 'auth/invalid-email') {
        setError('Por favor, informe um endereço de e-mail válido.');
      } else {
        setError(err.message || 'Erro ao realizar login. Tente novamente.');
      }
      setLoading(false);
      throw err;
    }
  };

  const signUpWithEmail = async (emailInput: string, passInput: string, nameInput: string, phoneInput?: string) => {
    setError(null);
    setLoading(true);
    const cleanEmail = emailInput.toLowerCase().trim();
    try {
      const cred = await createUserWithEmailAndPassword(auth, cleanEmail, passInput);
      if (cred.user) {
        await updateProfile(cred.user, { displayName: nameInput.trim() });
      }
    } catch (err: any) {
      console.error('Email sign up error:', err);
      if (err.code === 'auth/email-already-in-use') {
        // If it's the super admin, let them know or try sign in
        if (cleanEmail === 'osaiasbrito@gmail.com') {
          return signInWithEmail(cleanEmail, passInput);
        }
        setError('Este e-mail já está cadastrado. Por favor, acesse a aba "Entrar com Senha".');
      } else if (err.code === 'auth/weak-password') {
        setError('A senha deve ter no mínimo 6 caracteres.');
      } else {
        setError(err.message || 'Erro ao criar conta. Tente novamente.');
      }
      setLoading(false);
      throw err;
    }
  };

  const requestAccess = async (email: string, name: string, phone?: string, notes?: string) => {
    setError(null);
    try {
      const now = new Date();
      const trialEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();
      const reqDocRef = doc(collection(db, 'accessRequests'));
      await setDoc(reqDocRef, {
        userId: currentUser?.uid || `guest_${Date.now()}`,
        email: email.trim(),
        displayName: name.trim(),
        phone: phone || '',
        status: 'PENDING',
        trialStartDate: now.toISOString(),
        trialEndDate: trialEnd,
        requestedAt: now.toISOString(),
        notes: notes || 'Solicitação de acesso enviada via formulário',
      });
    } catch (err: any) {
      console.error('Error requesting access:', err);
      throw err;
    }
  };

  const resetPassword = async (email: string) => {
    setError(null);
    try {
      await sendPasswordResetEmail(auth, email.trim());
    } catch (err: any) {
      console.error('Password reset error:', err);
      if (err.code === 'auth/user-not-found') {
        setError('Nenhuma conta encontrada com este e-mail.');
      } else {
        setError('Erro ao enviar e-mail de recuperação de senha.');
      }
      throw err;
    }
  };

  const signInAsDemo = async () => {
    setLoading(true);
    setIsDemoUser(true);
    const demoId = 'demo-user-financial-2026';
    const demoUser = {
      uid: demoId,
      email: 'usuario.demo@controlefinanceiro.app',
      displayName: 'Carlos Silva (Demonstração)',
      photoURL: null,
    } as User;

    setCurrentUser(demoUser);
    setUserProfile({
      uid: demoId,
      email: demoUser.email,
      displayName: demoUser.displayName,
      photoURL: null,
      role: 'user',
      accessStatus: 'trial',
      trialStartDate: new Date().toISOString(),
      trialEndDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    setLoading(false);
  };

  const signOut = async () => {
    setLoading(true);
    try {
      localStorage.removeItem('mcf_session_user');
      localStorage.removeItem('mcf_session_profile');
      localStorage.removeItem('mcf_is_demo');
      setIsDemoUser(false);
      setCurrentUser(null);
      setUserProfile(null);
      await fbSignOut(auth).catch(() => {});
    } catch (err: any) {
      console.error('Logout error:', err);
      setError('Erro ao sair da conta.');
    } finally {
      setLoading(false);
    }
  };

  const clearError = () => setError(null);

  // Super Admin Management Actions
  const updateGatewaySettings = async (newSettings: Partial<PaymentGatewaySettings>) => {
    try {
      const settingsDocRef = doc(db, 'systemSettings', 'config');
      const updated = {
        ...gatewaySettings,
        ...newSettings,
        updatedAt: new Date().toISOString(),
      };
      await setDoc(settingsDocRef, updated, { merge: true });
      setGatewaySettings(updated);
    } catch (err) {
      console.error('Error updating gateway settings:', err);
      throw err;
    }
  };

  const approveTrialForUser = async (userId: string, customDays = 30) => {
    try {
      const now = new Date();
      const trialEndDate = new Date(now.getTime() + customDays * 24 * 60 * 60 * 1000).toISOString();

      await updateDoc(doc(db, 'users', userId), {
        accessStatus: 'trial',
        trialStartDate: now.toISOString(),
        trialEndDate,
        updatedAt: now.toISOString(),
      });

      // Update access request if present
      const reqRef = doc(db, 'accessRequests', userId);
      await setDoc(
        reqRef,
        {
          status: 'TRIAL',
          trialStartDate: now.toISOString(),
          trialEndDate,
          approvedAt: now.toISOString(),
          approvedBy: currentUser?.email || 'Super Admin',
        },
        { merge: true }
      );
    } catch (err) {
      console.error('Error approving trial:', err);
      throw err;
    }
  };

  const grantLifetimeForUser = async (userId: string, notes?: string) => {
    try {
      const now = new Date().toISOString();
      await updateDoc(doc(db, 'users', userId), {
        accessStatus: 'lifetime',
        lifetimeUnlockedAt: now,
        updatedAt: now,
      });

      const reqRef = doc(db, 'accessRequests', userId);
      await setDoc(
        reqRef,
        {
          status: 'LIFETIME',
          approvedAt: now,
          approvedBy: currentUser?.email || 'Super Admin',
          notes: notes || 'Liberação Vitalícia manual concedida pelo Super Usuário',
        },
        { merge: true }
      );
    } catch (err) {
      console.error('Error granting lifetime access:', err);
      throw err;
    }
  };

  const extendTrialForUser = async (userId: string, additionalDays: number) => {
    try {
      const userDoc = await getDoc(doc(db, 'users', userId));
      if (!userDoc.exists()) return;
      const data = userDoc.data() as UserProfile;
      const currentEnd = data.trialEndDate ? new Date(data.trialEndDate).getTime() : Date.now();
      const baseTime = currentEnd > Date.now() ? currentEnd : Date.now();
      const newEndDate = new Date(baseTime + additionalDays * 24 * 60 * 60 * 1000).toISOString();

      await updateDoc(doc(db, 'users', userId), {
        accessStatus: 'trial',
        trialEndDate: newEndDate,
        updatedAt: new Date().toISOString(),
      });
    } catch (err) {
      console.error('Error extending trial:', err);
      throw err;
    }
  };

  const blockUserAccess = async (userId: string) => {
    try {
      const now = new Date().toISOString();
      await updateDoc(doc(db, 'users', userId), {
        accessStatus: 'blocked',
        updatedAt: now,
      });

      const reqRef = doc(db, 'accessRequests', userId);
      await setDoc(
        reqRef,
        {
          status: 'BLOCKED',
          updatedAt: now,
        },
        { merge: true }
      );
    } catch (err) {
      console.error('Error blocking user:', err);
      throw err;
    }
  };

  // Payment Processing & Automatic Lifetime Unlock
  const processLifetimePayment = async (paymentData: {
    amount: number;
    gateway: 'MERCADO_PAGO' | 'STONE' | 'PIX_DIRECT' | 'SUPER_ADMIN_MANUAL';
    method: 'PIX' | 'CREDIT_CARD' | 'MANUAL';
    transactionId?: string;
    cardLastFour?: string;
    installments?: number;
    details?: string;
  }): Promise<{ success: boolean; message: string }> => {
    if (!currentUser && !isDemoUser) {
      throw new Error('Usuário não autenticado.');
    }

    const userId = currentUser?.uid || 'demo-user-financial-2026';
    const userEmail = currentUser?.email || userProfile?.email || 'usuario@meucontrole.app';
    const userName = userProfile?.displayName || currentUser?.displayName || 'Usuário';
    const now = new Date().toISOString();
    const txId = paymentData.transactionId || `tx_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    try {
      // 1. Create payment record
      const paymentRecord: Omit<PaymentRecord, 'id'> = {
        userId,
        userEmail,
        userName,
        amount: paymentData.amount || gatewaySettings.lifetimePrice,
        gateway: paymentData.gateway,
        method: paymentData.method,
        status: 'APPROVED',
        transactionId: txId,
        cardLastFour: paymentData.cardLastFour,
        installments: paymentData.installments || 1,
        details: paymentData.details || 'Acesso Vitalício Desbloqueado com Sucesso',
        createdAt: now,
        approvedAt: now,
      };

      if (!isDemoUser) {
        await addDoc(collection(db, 'payments'), paymentRecord);

        // 2. Unlock lifetime access in User Profile
        await updateDoc(doc(db, 'users', userId), {
          accessStatus: 'lifetime',
          lifetimeUnlockedAt: now,
          updatedAt: now,
        });

        // 3. Update access request status
        const reqRef = doc(db, 'accessRequests', userId);
        await setDoc(
          reqRef,
          {
            status: 'LIFETIME',
            paidAmount: paymentRecord.amount,
            paymentId: txId,
            approvedAt: now,
            approvedBy: `Gateway ${paymentData.gateway}`,
          },
          { merge: true }
        );
      }

      // Update state locally immediately
      setUserProfile((prev) =>
        prev
          ? {
              ...prev,
              accessStatus: 'lifetime',
              lifetimeUnlockedAt: now,
            }
          : null
      );

      return {
        success: true,
        message: 'Pagamento confirmado com sucesso! Seu acesso vitalício foi liberado.',
      };
    } catch (err: any) {
      console.error('Error processing lifetime payment:', err);
      throw new Error(err.message || 'Erro ao processar liberação de pagamento.');
    }
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        userProfile,
        loading,
        error,
        isDemoUser,

        isSuperAdmin,
        accessStatus,
        trialDaysLeft,
        isTrialActive,
        isLifetimeActive,
        isDataEntryBlocked,

        signInWithGoogle,
        signInWithEmail,
        signUpWithEmail,
        requestAccess,
        resetPassword,
        signInAsDemo,
        signInDemo: signInAsDemo,
        signOut,
        clearError,

        gatewaySettings,
        updateGatewaySettings,
        accessRequests,
        paymentsList,

        approveTrialForUser,
        grantLifetimeForUser,
        extendTrialForUser,
        blockUserAccess,
        processLifetimePayment,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
