import React, { createContext, useContext, useState, useEffect } from 'react';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged, RecaptchaVerifier, signInWithPhoneNumber, ConfirmationResult, deleteUser } from 'firebase/auth';
import { ref, set } from 'firebase/database';
import { auth, rtdb } from '../firebase';
import { UserProfile, SugarProfile } from '../types';
import { PEWADatabaseService, cleanForFirebase } from '../services/db';
import { isSuperAdminPhone, SUPER_ADMIN_PIN, calculateAge, getPhoneVariations, normalizePhone } from '../services/phone';
import { DEFAULT_PEWA_COVER, DEFAULT_USER_AVATAR } from '../services/cloudinary';
import { hashPinAsync, verifyPinAsync, checkPinLockout, recordFailedPinAttempt, clearPinLockout, clearAllAdminLockouts } from '../services/pinSecurity';
import { withTimeout } from '../utils/timeout';

const SESSION_KEY = 'pewa_active_session_uid';
const ADMIN_SESSION_KEY = 'pewa_admin_session';

interface SignupDraft {
  initialInput: string;
  fullName: string;
  username: string;
  email: string;
  phone: string;
  dob: string;
  gender: 'Male' | 'Female' | 'Other';
  country: string;
  city: string;
  street: string;
  bio?: string;

  // Appearance Information
  height?: string;
  hairColor?: string;
  eyeColor?: string;
  skinTone?: string;
  bodyType?: string;

  // Lifestyle & Preferences
  relationshipOrientation: string;
  personality: 'Indoor' | 'Outdoor' | 'Balanced';
  lifestyle: {
    drinking: 'Never' | 'Socially' | 'Regularly';
    smoking: 'Never' | 'Socially' | 'Regularly';
    partying: 'Never' | 'Weekends' | 'Often';
    sexualActivity: 'Low' | 'Moderate' | 'High' | 'Prefer not to say';
  };
  partyPreferences?: string[];
  clubPreferences?: string[];
  favoriteSocialPlaces?: string[];
  hobbies?: string[];
  interests?: string[];

  relationshipGoals: string;
  visitingPreferences: 'Host' | 'Visit' | 'Public Places Only' | 'Flexible';

  // Profile Images (Up to 5)
  avatar: string;
  profilePhotos?: {
    fullBody?: string;
    normalFace?: string;
    naturalPhoto?: string;
    extra1?: string;
    extra2?: string;
  };

  sugarProfile: SugarProfile;
  pin: string;
  termsAccepted: boolean;
}

interface AuthContextType {
  currentUser: UserProfile | null;
  isAdminLoggedIn: boolean;
  isSuperAdmin: boolean;
  isLoading: boolean;
  activeTab: 'love' | 'chats' | 'posts' | 'notifications' | 'account' | 'admin';
  setActiveTab: (tab: 'love' | 'chats' | 'posts' | 'notifications' | 'account' | 'admin') => void;
  // Auth actions
  checkInputAccount: (input: string) => Promise<{ exists: boolean; user: UserProfile | null; isSuperAdmin: boolean; isAdminLogin?: boolean }>;
  loginWithPin: (user: UserProfile, pin: string) => Promise<{ success: boolean; message?: string }>;
  completeSignup: (draft: SignupDraft) => Promise<UserProfile>;
  sendPhoneOtpAsync: (phoneNumber: string, containerId?: string) => Promise<{ success: boolean; confirmationResult?: ConfirmationResult; message?: string }>;
  confirmPhoneOtpAsync: (confirmationResult: ConfirmationResult, code: string, rawPhone: string) => Promise<{ success: boolean; user?: UserProfile | null; isNewUser?: boolean; message?: string }>;
  setupNewPinForUserAsync: (user: UserProfile, pin: string) => Promise<{ success: boolean; message?: string }>;
  logout: () => void;
  updateCurrentUserProfile: (updates: Partial<UserProfile>) => UserProfile | null;
  refreshCurrentUser: () => void;
  deleteCurrentAccount: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const ACTIVE_TAB_KEY = 'pewa_active_tab';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(() => {
    const savedAdminSession = localStorage.getItem(ADMIN_SESSION_KEY);
    if (savedAdminSession === 'true') {
      const config = PEWADatabaseService.getAdminConfig();
      return PEWADatabaseService.getAdminUserProfile({
        adminId: 'admin_main',
        uid: 'admin_main',
        email: config.email,
        role: 'admin',
        active: true,
        permissions: ['broadcast', 'users', 'posts', 'ads', 'verifications', 'sugars', 'logs', 'all'],
        fullName: 'PEWA Official',
        avatar: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=400&auto=format&fit=crop',
        bio: 'Official PEWA Administration Account',
        createdAt: 1770000000000,
        updatedAt: Date.now()
      });
    }
    const savedUid = localStorage.getItem(SESSION_KEY);
    if (savedUid) {
      const user = PEWADatabaseService.getUserById(savedUid);
      if (user && !user.banned && !user.disabled && !user.suspended) {
        return user;
      }
    }
    return null;
  });
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState<boolean>(() => localStorage.getItem(ADMIN_SESSION_KEY) === 'true');
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTabState] = useState<'love' | 'chats' | 'posts' | 'notifications' | 'account' | 'admin'>(() => {
    const savedAdminSession = localStorage.getItem(ADMIN_SESSION_KEY);
    if (savedAdminSession === 'true') {
      return 'admin';
    }
    const savedTab = localStorage.getItem(ACTIVE_TAB_KEY);
    if (savedTab && ['love', 'chats', 'posts', 'notifications', 'account', 'admin'].includes(savedTab)) {
      return savedTab as any;
    }
    return 'love';
  });

  const setActiveTab = (tab: 'love' | 'chats' | 'posts' | 'notifications' | 'account' | 'admin') => {
    localStorage.setItem(ACTIVE_TAB_KEY, tab);
    setActiveTabState(tab);
  };

  useEffect(() => {
    // Listen to Firebase Auth state changes & verify Firestore profile existence
    try { console.time('[Perf] Auth Initialization'); } catch(e) {}
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      try { console.timeEnd('[Perf] Auth Initialization'); } catch(e) {}
      const savedAdminSession = localStorage.getItem(ADMIN_SESSION_KEY);
      if (savedAdminSession === 'true') {
        console.log('[AuthObserver] Restoring active administrator session...');
        try {
          const adminDoc = await PEWADatabaseService.getAdminProfileDocumentAsync();
          const adminProfile = PEWADatabaseService.getAdminUserProfile(adminDoc);
          setCurrentUser(adminProfile);
          setIsAdminLoggedIn(true);
          setActiveTabState('admin');
        } catch (err) {
          const fallbackAdmin = PEWADatabaseService.getAdminUserProfile();
          setCurrentUser(fallbackAdmin);
          setIsAdminLoggedIn(true);
          setActiveTabState('admin');
        }
        setIsLoading(false);
        return;
      }

      if (firebaseUser) {
        console.log(`[AuthObserver] Firebase Auth active user: ${firebaseUser.uid}`);
        try { console.time('[Perf] Local Profile Retrieval'); } catch(e) {}
        const localUser = PEWADatabaseService.getUserById(firebaseUser.uid);
        try { console.timeEnd('[Perf] Local Profile Retrieval'); } catch(e) {}

        // INSTANT RESPONSE: If local profile exists, unblock UI immediately (<10ms)
        if (localUser && !localUser.banned && !localUser.disabled && !localUser.suspended) {
          console.log('[AuthObserver] Instant Session Restore from local cache:', localUser.uid);
          const provisioned = PEWADatabaseService.ensureUserDocumentsProvisioned(localUser);
          setCurrentUser(provisioned);
          localStorage.setItem(SESSION_KEY, provisioned.uid);
          PEWADatabaseService.updatePresence(provisioned.uid, 'online');
          setIsLoading(false); // UI IS UNBLOCKED IMMEDIATELY!
        }

        // BACKGROUND FETCH: Refresh profile asynchronously in background without blocking UI
        (async () => {
          try { console.time('[Perf] Remote Firestore Profile Sync'); } catch(e) {}
          let remoteUser = await PEWADatabaseService.fetchUserFromFirestoreById(firebaseUser.uid);
          if (!remoteUser && firebaseUser.email) {
            remoteUser = await PEWADatabaseService.findUserByPhoneOrEmailAsync(firebaseUser.email);
          }
          try { console.timeEnd('[Perf] Remote Firestore Profile Sync'); } catch(e) {}

          let user = remoteUser || localUser;

          // Preserve uploaded custom avatar from local cache if remote user object lacks it
          if (user && localUser?.avatar && localUser.avatar !== DEFAULT_USER_AVATAR && (!user.avatar || user.avatar === DEFAULT_USER_AVATAR)) {
            user.avatar = localUser.avatar;
            user.profilePhoto = localUser.avatar;
            user.profileImage = localUser.avatar;
          }

          // Auto-create Firestore document if authenticated user profile does not exist
          if (!user && firebaseUser.email) {
            console.log(`[AuthObserver] Profile document missing for authenticated user ${firebaseUser.uid}. Creating profile...`);
            const newUser: UserProfile = {
              uid: firebaseUser.uid,
              fullName: firebaseUser.displayName || firebaseUser.email.split('@')[0],
              username: firebaseUser.email.split('@')[0],
              email: firebaseUser.email,
              phone: '',
              normalizedPhones: [],
              pinHash: '1234',
              dob: '2000-01-01',
              age: 26,
              gender: 'Other',
              country: 'Zambia',
              city: 'Lusaka',
              street: 'Main Street',
              relationshipOrientation: 'Single',
              personality: 'Balanced',
              lifestyle: { drinking: 'Never', smoking: 'Never', partying: 'Never', sexualActivity: 'Prefer not to say' },
              relationshipGoals: 'Serious Relationship',
              visitingPreferences: 'Flexible',
              bio: 'Welcome to PEWA!',
              avatar: DEFAULT_USER_AVATAR,
              coverImage: DEFAULT_PEWA_COVER,
              verified: false,
              suspended: false,
              banned: false,
              role: 'user',
              popsCount: 0,
              keepsCount: 0,
              votesCount: 0,
              termsAccepted: true,
              createdAt: Date.now(),
              updatedAt: Date.now()
            };
            const provisioned = PEWADatabaseService.ensureUserDocumentsProvisioned(newUser);
            PEWADatabaseService.saveUser(provisioned);
            withTimeout(PEWADatabaseService.syncToFirestore(provisioned), 3000).catch(() => {});
            user = provisioned;
          }

          if (user && !user.banned && !user.disabled && !user.suspended) {
            const provisioned = PEWADatabaseService.ensureUserDocumentsProvisioned(user);
            PEWADatabaseService.saveUser(provisioned);
            setTimeout(() => {
              setCurrentUser(provisioned);
            }, 0);
            localStorage.setItem(SESSION_KEY, provisioned.uid);
          } else if (user && (user.banned || user.disabled || user.suspended)) {
            setTimeout(() => {
              setCurrentUser(null);
            }, 0);
            localStorage.removeItem(SESSION_KEY);
          }
          setTimeout(() => {
            setIsLoading(false);
          }, 0);
        })();
      } else {
        const savedUid = localStorage.getItem(SESSION_KEY);
        if (savedUid) {
          const user = PEWADatabaseService.getUserById(savedUid);
          if (user && !user.banned && !user.disabled && !user.suspended) {
            setCurrentUser(user);
          } else {
            localStorage.removeItem(SESSION_KEY);
            setCurrentUser(null);
          }
        } else {
          setCurrentUser(null);
        }
        setIsLoading(false);
      }
    });

    const handleStorageUpdate = () => {
      const savedAdminSession = localStorage.getItem(ADMIN_SESSION_KEY);
      if (savedAdminSession === 'true') return;
      const savedUid = localStorage.getItem(SESSION_KEY);
      if (savedUid) {
        const freshUser = PEWADatabaseService.getUserById(savedUid);
        if (freshUser) {
          setTimeout(() => {
            setCurrentUser((prev) => {
              if (prev && prev.uid === freshUser.uid && JSON.stringify(prev) === JSON.stringify(freshUser)) {
                return prev;
              }
              return freshUser;
            });
          }, 0);
        }
      }
    };

    window.addEventListener('pewa_storage_update', handleStorageUpdate);

    return () => {
      unsubscribe();
      window.removeEventListener('pewa_storage_update', handleStorageUpdate);
    };
  }, []);

  const checkInputAccount = async (input: string): Promise<{ exists: boolean; user: UserProfile | null; isSuperAdmin: boolean; isAdminLogin?: boolean }> => {
    const raw = input.trim();
    console.log(`[Auth] User lookup started for input: "${raw}"`);

    if (PEWADatabaseService.isAdminEmail(raw) || isSuperAdminPhone(raw)) {
      const adminDoc = await PEWADatabaseService.getAdminProfileDocumentAsync(raw);
      const adminProfile = PEWADatabaseService.getAdminUserProfile(adminDoc);
      console.log(`[Auth] User document found (Administrator): ${adminProfile.uid}`);
      return { exists: true, user: adminProfile, isSuperAdmin: true, isAdminLogin: true };
    }

    const found = await withTimeout(PEWADatabaseService.findUserByPhoneOrEmailAsync(raw), 3000, null).catch(() => null)
      || PEWADatabaseService.findUserByPhoneOrEmail(raw);

    if (found) {
      console.log(`[Auth] User document found: ${found.uid} (${found.fullName})`);
      return { exists: true, user: found, isSuperAdmin: false, isAdminLogin: false };
    }
    console.log(`[Auth] User lookup completed: No user document found for "${raw}"`);
    return { exists: false, user: null, isSuperAdmin: false, isAdminLogin: false };
  };

  const loginWithPin = async (user: UserProfile, pin: string): Promise<{ success: boolean; message?: string }> => {
    console.log(`[Auth] User lookup started for UID=${user.uid}, Email=${user.email || 'N/A'}, Phone=${user.phone || 'N/A'}`);

    // Admin login attempt check
    const isActualAdminAttempt = user.uid === 'admin_main' || (user.email && PEWADatabaseService.isAdminEmail(user.email));
    if (isActualAdminAttempt) {
      const adminResult = PEWADatabaseService.verifyAdminLogin(user.email || user.phone, pin);
      if (adminResult.success) {
        clearAllAdminLockouts();
        clearPinLockout(user.uid || user.phone || user.email);
        const adminDoc = await PEWADatabaseService.getAdminProfileDocumentAsync(user.email || user.phone);
        const adminProfile = PEWADatabaseService.getAdminUserProfile(adminDoc);

        setIsAdminLoggedIn(true);
        setCurrentUser(adminProfile);
        localStorage.setItem(ADMIN_SESSION_KEY, 'true');
        localStorage.setItem(SESSION_KEY, adminProfile.uid);
        setActiveTab('admin');

        console.log(`[Auth] PIN verification result: MATCHED. Authentication success for Administrator UID=${adminProfile.uid}.`);
        return { success: true };
      }

      // Check lockout if admin PIN attempt failed
      const lockout = checkPinLockout(user.uid || user.email || 'admin_main');
      if (lockout.isLocked) {
        return {
          success: false,
          message: `Account temporarily locked due to 5 consecutive failed PIN attempts. Please wait ${lockout.remainingMinutes} minute(s).`
        };
      }

      const failStatus = recordFailedPinAttempt(user.uid || user.email || 'admin_main');
      console.warn(`[Auth] Administrator PIN verification failed for ${user.email || user.phone}: ${adminResult.message}. Attempt ${failStatus.attemptsCount}/5.`);
      return {
        success: false,
        message: failStatus.isLocked
          ? 'Account locked for 15 minutes due to 5 consecutive failed Administrator PIN attempts.'
          : (adminResult.message || `Incorrect Administrator Security PIN. Attempt ${failStatus.attemptsCount} of 5.`)
      };
    }

    // Rate Limiting & Lockout Check for regular users
    const lockout = checkPinLockout(user.uid || user.phone || user.email);
    if (lockout.isLocked) {
      console.warn(`[Auth] Authentication failure reason: PIN login blocked for ${user.uid} due to active lockout (${lockout.remainingMinutes} min remaining).`);
      return {
        success: false,
        message: `Account temporarily locked due to 5 consecutive failed PIN attempts. Please wait ${lockout.remainingMinutes} minute(s).`
      };
    }

    if (user.banned) {
      console.warn(`[Auth] Authentication failure reason: Account ${user.uid} is banned.`);
      return { success: false, message: 'This account has been banned by system administrator.' };
    }
    if (user.suspended) {
      console.warn(`[Auth] Authentication failure reason: Account ${user.uid} is suspended.`);
      return { success: false, message: 'This account is currently suspended by system administrator.' };
    }
    if (user.disabled) {
      console.warn(`[Auth] Authentication failure reason: Account ${user.uid} is disabled.`);
      return { success: false, message: 'This account has been disabled by system administrator.' };
    }

    // Verify PIN against stored PIN hash (or legacy raw PIN)
    console.log(`[Auth] Verifying 4-digit PIN for user ${user.uid}...`);
    const verification = await verifyPinAsync(pin, user.pinHash);
    console.log(`[Auth] PIN verification result for ${user.uid}: matched=${verification.matched}, isLegacyRaw=${verification.isLegacyRaw}`);

    if (!verification.matched) {
      const failStatus = recordFailedPinAttempt(user.uid || user.phone || user.email);
      console.warn(`[Auth] Authentication failure reason: Incorrect 4-digit PIN for ${user.uid}. Attempt count: ${failStatus.attemptsCount}/5`);
      return {
        success: false,
        message: failStatus.isLocked
          ? 'Account locked for 15 minutes due to 5 consecutive failed PIN attempts.'
          : `Incorrect 4-digit PIN. Attempt ${failStatus.attemptsCount} of 5. Please try again.`
      };
    }

    // Clear lockout on successful PIN match
    clearPinLockout(user.uid || user.phone || user.email);

    // If matching a legacy raw PIN, automatically upgrade user.pinHash to SHA-256 hash!
    let updatedUser = { ...user };
    if (verification.isLegacyRaw) {
      console.log(`[Auth] Auto-upgrading legacy plain PIN to secure SHA-256 hash for ${user.uid}...`);
      const secureHash = await hashPinAsync(pin);
      updatedUser.pinHash = secureHash;
      updatedUser.pinCreatedAt = user.pinCreatedAt || Date.now();
      updatedUser.pinUpdatedAt = Date.now();
    }

    const provisioned = PEWADatabaseService.ensureUserDocumentsProvisioned(updatedUser);

    // Update state locally and save user profile immediately to complete login without hanging
    PEWADatabaseService.saveUser(provisioned);
    setCurrentUser(provisioned);
    localStorage.setItem(SESSION_KEY, provisioned.uid);
    PEWADatabaseService.updatePresence(provisioned.uid, 'online');
    setActiveTab('love');

    console.log(`[Auth] User document found. User profile loaded for ${provisioned.uid} (${provisioned.fullName}).`);
    console.log(`[Auth] Authentication success for UID=${provisioned.uid}.`);
    console.log(`[Auth] Navigation to Home.`);

    // Perform background non-blocking Firebase Auth alignment and Firestore sync with 3-second timeout protection
    const userEmail = (user.email && user.email.trim()) ? user.email.trim() : `${(user.phone || user.uid).replace(/\D/g, '')}@pewa.zm`;
    const derivedPassword = `${pin}PewaPass!`;

    withTimeout(
      signInWithEmailAndPassword(auth, userEmail, derivedPassword).catch(async (authErr: any) => {
        console.warn(`[Auth] Any Firebase errors note (Auth sign-in):`, authErr?.code || authErr?.message);
        if (authErr?.code === 'auth/user-not-found') {
          try {
            await createUserWithEmailAndPassword(auth, userEmail, derivedPassword);
          } catch (createErr: any) {
            console.warn('[Auth] Any Firebase errors note (Auth auto-creation):', createErr?.message || createErr);
          }
        }
      }),
      3000
    ).catch(() => {});

    return { success: true };
  };

  const completeSignup = async (draft: SignupDraft): Promise<UserProfile> => {
    console.log('[Auth] Starting signup flow for:', draft.fullName, draft.email);
    const calculatedAge = calculateAge(draft.dob);
    if (calculatedAge < 18) {
      throw new Error('You must be 18 years or older to register on PEWA.');
    }

    // Hash PIN securely before storing
    const securePinHash = await hashPinAsync(draft.pin);
    const now = Date.now();

    const userEmail = draft.email.trim();
    const userPassword = draft.pin && draft.pin.length >= 4 ? `${draft.pin}PewaPass!` : 'PewaDefault123!';
    let authUid: string | null = null;

    // STEP 1: Firebase Authentication (with timeout protection)
    try {
      console.log(`[Firebase Auth] Creating user with email ${userEmail}...`);
      const userCredential = await withTimeout(
        createUserWithEmailAndPassword(auth, userEmail, userPassword),
        6000
      );
      authUid = userCredential.user.uid;
      console.log(`[Firebase Auth] Authentication successful! UID: ${authUid}`);
    } catch (authErr: any) {
      console.warn(`[Firebase Auth] createUserWithEmailAndPassword note/error:`, authErr?.code, authErr?.message);
      if (authErr?.code === 'auth/email-already-in-use') {
        try {
          console.log(`[Firebase Auth] Email already exists in Auth system. Attempting sign-in...`);
          const userCredential = await withTimeout(
            signInWithEmailAndPassword(auth, userEmail, userPassword),
            4000
          );
          authUid = userCredential.user.uid;
          console.log(`[Firebase Auth] Auth sign-in successful! UID: ${authUid}`);
        } catch (signInErr: any) {
          console.error(`[Firebase Auth] Sign-in after email-in-use failed:`, signInErr?.message);
        }
      }
    }

    // Assign authenticated UID or fallback UID
    const finalUid = authUid || ('usr_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6));
    console.log(`[Auth] Proceeding with profile UID: ${finalUid}`);

    // Extract photos & primary avatar
    const primaryAvatar = draft.profilePhotos?.normalFace || draft.profilePhotos?.fullBody || draft.profilePhotos?.naturalPhoto || draft.avatar || DEFAULT_USER_AVATAR;
    const verifiedPhotoList = [
      draft.profilePhotos?.fullBody,
      draft.profilePhotos?.normalFace,
      draft.profilePhotos?.naturalPhoto,
      draft.profilePhotos?.extra1,
      draft.profilePhotos?.extra2
    ].filter(Boolean) as string[];

    const newUser: UserProfile = {
      uid: finalUid,
      fullName: draft.fullName,
      username: draft.username || draft.fullName.toLowerCase().replace(/\s+/g, '_'),
      email: draft.email,
      phone: draft.phone,
      normalizedPhones: getPhoneVariations(draft.phone),
      pinHash: securePinHash,
      pinCreatedAt: now,
      pinUpdatedAt: now,
      dob: draft.dob,
      age: calculatedAge,
      gender: draft.gender,
      country: draft.country || 'Zambia',
      city: draft.city || 'Lusaka',
      street: draft.street || 'Main Street',
      bio: draft.bio || `Hi there! I am ${draft.fullName}, looking to connect on PEWA in ${draft.city || 'Zambia'}.`,

      // Appearance Information
      height: draft.height || '175 cm',
      hairColor: draft.hairColor || 'Dark Brown',
      eyeColor: draft.eyeColor || 'Brown',
      skinTone: draft.skinTone || 'Medium',
      bodyType: draft.bodyType || 'Average',

      // Lifestyle & Preferences
      relationshipOrientation: draft.relationshipOrientation || 'Single',
      personality: draft.personality || 'Balanced',
      lifestyle: draft.lifestyle,
      lifestylePreferences: {
        drinking: draft.lifestyle?.drinking || 'Never',
        smoking: draft.lifestyle?.smoking || 'Never',
        partying: draft.lifestyle?.partying || 'Weekends',
        relationshipStatus: draft.relationshipOrientation || 'Single'
      },
      enjoysParties: draft.lifestyle?.partying === 'Often' ? 'Yes' : draft.lifestyle?.partying === 'Never' ? 'No' : 'Sometimes',
      partyPreferences: draft.partyPreferences?.length ? draft.partyPreferences : ['House parties', 'Outdoor events'],
      clubPreferences: draft.clubPreferences?.length ? draft.clubPreferences : ['Luxury lounges', 'Bars'],
      favoriteSocialPlaces: draft.favoriteSocialPlaces?.length ? draft.favoriteSocialPlaces : ['Rooftop cafes', 'Lounge bars'],
      hobbies: draft.hobbies?.length ? draft.hobbies : ['Photography', 'Travel'],
      interests: draft.interests?.length ? draft.interests : ['Hiking', 'Music', 'Dining'],
      favoriteActivities: draft.interests?.length ? draft.interests : ['Hiking', 'Dining'],
      musicInterests: ['Afrobeats', 'Pop'],
      sports: ['Football', 'Swimming'],
      entertainmentPreferences: ['Movies', 'Comedy'],
      lifestyleInterests: ['Fashion', 'Fitness'],

      relationshipGoals: draft.relationshipGoals || 'Serious Relationship',
      visitingPreferences: draft.visitingPreferences || 'Flexible',

      avatar: primaryAvatar,
      profilePhoto: primaryAvatar,
      profileImage: primaryAvatar,
      coverImage: DEFAULT_PEWA_COVER,
      profilePhotos: draft.profilePhotos || {
        normalFace: primaryAvatar
      },
      verifiedPhotos: verifiedPhotoList,

      verified: false,
      verificationStatus: 'unverified',
      suspended: false,
      banned: false,
      role: 'user',
      sugarProfile: draft.sugarProfile,
      popsCount: 0,
      keepsCount: 0,
      votesCount: 0,
      termsAccepted: draft.termsAccepted,
      createdAt: now,
      updatedAt: now
    };

    // STEP 2: Save to local memory store IMMEDIATELY so onAuthStateChanged and UI see the user profile right away
    const provisionedUser = PEWADatabaseService.ensureUserDocumentsProvisioned(newUser);
    PEWADatabaseService.saveUser(provisionedUser);

    clearPinLockout(provisionedUser.uid);
    clearPinLockout(provisionedUser.phone);
    clearPinLockout(provisionedUser.email);

    // STEP 3: Create Realtime Database user document users/{uid}
    console.log("Creating Realtime Database user document", finalUid);
    try {
      const safeAvatarUrl = primaryAvatar;
      await set(ref(rtdb, `users/${finalUid}`), cleanForFirebase({
        uid: finalUid,
        userId: finalUid,
        email: draft.email || '',
        fullName: draft.fullName || '',
        username: draft.username || draft.fullName.toLowerCase().replace(/\s+/g, '_'),
        phone: draft.phone || '',
        dateOfBirth: draft.dob || '',
        dob: draft.dob || '',
        age: calculatedAge || 18,
        gender: draft.gender || 'Female',
        city: draft.city || 'Lusaka',
        country: draft.country || 'Zambia',
        bio: provisionedUser.bio,
        height: provisionedUser.height,
        hairColor: provisionedUser.hairColor,
        eyeColor: provisionedUser.eyeColor,
        skinTone: provisionedUser.skinTone,
        bodyType: provisionedUser.bodyType,
        drinking: provisionedUser.lifestyle?.drinking,
        smoking: provisionedUser.lifestyle?.smoking,
        relationshipPreference: provisionedUser.relationshipOrientation,
        partyPreference: provisionedUser.lifestyle?.partying,
        clubPreference: provisionedUser.clubPreferences,
        hobbies: provisionedUser.hobbies,
        interests: provisionedUser.interests,
        profileImage: safeAvatarUrl,
        avatar: safeAvatarUrl,
        profilePhoto: safeAvatarUrl,
        profilePhotos: provisionedUser.profilePhotos,
        profileImages: verifiedPhotoList,
        verified: false,
        verificationStatus: 'unverified',
        status: 'active',
        role: "USER",
        createdAt: Date.now(),
        updatedAt: Date.now()
      }));
      console.log("Realtime Database user document created");
    } catch (rtdbErr) {
      console.error("Realtime Database profile creation failed:", rtdbErr);
    }

    // STEP 4: Activate user session and navigate
    setCurrentUser(provisionedUser);
    localStorage.setItem(SESSION_KEY, provisionedUser.uid);
    setActiveTab('love');
    return provisionedUser;
  };

  const sendPhoneOtpAsync = async (phoneNumber: string, containerId: string = 'recaptcha-container'): Promise<{ success: boolean; confirmationResult?: ConfirmationResult; message?: string }> => {
    try {
      const formatted = normalizePhone(phoneNumber);
      const e164 = formatted.startsWith('+') ? formatted : `+${formatted}`;
      console.log(`[Auth] Requesting SMS OTP for ${e164}...`);

      let recaptchaContainer = document.getElementById(containerId);
      if (recaptchaContainer) {
        recaptchaContainer.innerHTML = '';
      } else {
        recaptchaContainer = document.createElement('div');
        recaptchaContainer.id = containerId;
        document.body.appendChild(recaptchaContainer);
      }

      if ((window as any).pewaRecaptchaVerifier) {
        try {
          (window as any).pewaRecaptchaVerifier.clear();
        } catch (_) {}
        (window as any).pewaRecaptchaVerifier = null;
      }

      const recaptchaVerifier = new RecaptchaVerifier(auth, containerId, {
        size: 'invisible',
        callback: () => {
          console.log('[Auth] reCAPTCHA verified for Phone Auth.');
        }
      });
      (window as any).pewaRecaptchaVerifier = recaptchaVerifier;

      const confirmationResult = await withTimeout(
        signInWithPhoneNumber(auth, e164, recaptchaVerifier),
        5000
      );
      console.log(`[Auth] SMS OTP sent successfully to ${e164}`);
      return { success: true, confirmationResult };
    } catch (err: any) {
      console.warn('[Auth] Any Firebase errors note (SMS OTP):', err?.code || err?.message || err);
      if ((window as any).pewaRecaptchaVerifier) {
        try {
          (window as any).pewaRecaptchaVerifier.clear();
        } catch (_) {}
        (window as any).pewaRecaptchaVerifier = null;
      }

      const fallbackMsg = 'SMS verification is temporarily unavailable in this region/environment. Please log in using your 4-digit Security PIN instead.';

      if (
        err?.code === 'auth/operation-not-allowed' ||
        err?.code === 'auth/quota-exceeded' ||
        err?.code === 'auth/too-many-requests' ||
        err?.message?.includes('timed out') ||
        err?.message?.includes('restricted')
      ) {
        return {
          success: false,
          message: fallbackMsg
        };
      }
      if (err?.code === 'auth/invalid-phone-number') {
        return {
          success: false,
          message: 'Invalid phone number format. Please check the country code and digits entered.'
        };
      }
      return {
        success: false,
        message: fallbackMsg
      };
    }
  };

  const confirmPhoneOtpAsync = async (
    confirmationResult: ConfirmationResult,
    code: string,
    rawPhone: string
  ): Promise<{ success: boolean; user?: UserProfile | null; isNewUser?: boolean; message?: string }> => {
    try {
      console.log(`[Auth] Verifying SMS OTP code...`);
      const result = await confirmationResult.confirm(code);
      console.log(`[Auth] Phone verification successful. Firebase Auth UID: ${result.user?.uid}`);

      const found = await PEWADatabaseService.findUserByPhoneOrEmailAsync(rawPhone);
      if (found) {
        clearPinLockout(found.uid);
        clearPinLockout(found.phone);
        clearPinLockout(found.email);

        const provisioned = PEWADatabaseService.ensureUserDocumentsProvisioned(found);
        PEWADatabaseService.saveUser(provisioned);
        setCurrentUser(provisioned);
        localStorage.setItem(SESSION_KEY, provisioned.uid);
        PEWADatabaseService.updatePresence(provisioned.uid, 'online');
        setActiveTab('love');

        return { success: true, user: provisioned, isNewUser: false };
      } else {
        return { success: true, user: null, isNewUser: true };
      }
    } catch (err: any) {
      console.error('[Auth] Error confirming Phone OTP:', err);
      return { success: false, message: 'Invalid SMS verification code. Please check and try again.' };
    }
  };

  const setupNewPinForUserAsync = async (user: UserProfile, pin: string): Promise<{ success: boolean; message?: string }> => {
    try {
      if (!/^\d{4}$/.test(pin)) {
        return { success: false, message: 'PIN must be exactly 4 digits.' };
      }
      const secureHash = await hashPinAsync(pin);
      const now = Date.now();
      const updated: UserProfile = {
        ...user,
        pinHash: secureHash,
        pinCreatedAt: user.pinCreatedAt || now,
        pinUpdatedAt: now
      };

      const provisioned = PEWADatabaseService.ensureUserDocumentsProvisioned(updated);
      await PEWADatabaseService.syncToFirestore(provisioned);
      PEWADatabaseService.saveUser(provisioned);
      clearPinLockout(provisioned.uid);
      clearPinLockout(provisioned.phone);

      setCurrentUser(provisioned);
      localStorage.setItem(SESSION_KEY, provisioned.uid);
      return { success: true };
    } catch (err: any) {
      console.error('[Auth] Error setting up new PIN:', err);
      return { success: false, message: 'Failed to update PIN. Please try again.' };
    }
  };

  const logout = () => {
    if (currentUser) {
      PEWADatabaseService.updatePresence(currentUser.uid, 'offline');
    }
    setCurrentUser(null);
    setIsAdminLoggedIn(false);
    localStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(ADMIN_SESSION_KEY);
    setActiveTab('love');
    signOut(auth).catch((err) => {
      console.warn('[Auth] Firebase signOut note:', err);
    });
  };

  const updateCurrentUserProfile = (updates: Partial<UserProfile>): UserProfile | null => {
    if (!currentUser) return null;
    const updated = PEWADatabaseService.updateUserProfile(currentUser.uid, updates);
    if (updated) {
      setCurrentUser(updated);
    }
    return updated;
  };

  const refreshCurrentUser = () => {
    if (isAdminLoggedIn) {
      const adminDoc = PEWADatabaseService.getAdminUserProfile();
      setCurrentUser(adminDoc);
    } else if (currentUser) {
      const updated = PEWADatabaseService.getUserById(currentUser.uid);
      if (updated) {
        setCurrentUser(updated);
      }
    }
  };

  const deleteCurrentAccount = async (): Promise<void> => {
    if (!currentUser) return;
    const uid = currentUser.uid;
    console.log("Deleting account:", uid);

    try {
      // 1. Delete Realtime Database and Firestore user data
      console.log("Deleting database data...");
      await PEWADatabaseService.deleteUserAccountRealtimeData(uid);
      await PEWADatabaseService.deleteUserAccountFirestoreData(uid);
      console.log("Database deleted...");

      // Clean local in-memory store
      PEWADatabaseService.deleteUserAccountCompletely(uid);

      // 2. Delete user account from Firebase Auth
      console.log("Deleting authentication...");
      const firebaseUser = auth.currentUser;
      if (firebaseUser) {
        try {
          await deleteUser(firebaseUser);
          console.log("Account deleted...");
        } catch (authError: any) {
          if (authError?.code === 'auth/requires-recent-login') {
            console.error("Delete account failed: auth/requires-recent-login", authError);
            alert("Please login again before deleting your account.");
            await signOut(auth).catch(() => {});
            setCurrentUser(null);
            setIsAdminLoggedIn(false);
            localStorage.removeItem(SESSION_KEY);
            localStorage.removeItem(ADMIN_SESSION_KEY);
            setActiveTab('love');
            return;
          } else {
            console.error("Delete account failed:", authError);
          }
        }
      } else {
        console.log("Account deleted...");
      }

      // 3. Complete sign out and navigate to login screen
      await signOut(auth).catch(() => {});
      setCurrentUser(null);
      setIsAdminLoggedIn(false);
      localStorage.removeItem(SESSION_KEY);
      localStorage.removeItem(ADMIN_SESSION_KEY);
      setActiveTab('love');
    } catch (error) {
      console.error("Delete account failed:", error);
      alert("Account deletion failed. Please try again.");
    }
  };

  const isSuperAdmin = isAdminLoggedIn || (currentUser?.uid === 'admin_main') || (currentUser?.email ? PEWADatabaseService.isAdminEmail(currentUser.email) : false);

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        isAdminLoggedIn,
        isSuperAdmin,
        isLoading,
        activeTab,
        setActiveTab,
        checkInputAccount,
        loginWithPin,
        completeSignup,
        sendPhoneOtpAsync,
        confirmPhoneOtpAsync,
        setupNewPinForUserAsync,
        logout,
        updateCurrentUserProfile,
        refreshCurrentUser,
        deleteCurrentAccount
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

