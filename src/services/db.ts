// Firestore & Realtime Database Master Persistence Engine for PEWA
import { doc, getDoc, setDoc, writeBatch, collection, query, where, getDocs, deleteDoc, onSnapshot } from 'firebase/firestore';
import { ref, set, remove, push, update, get, onValue } from 'firebase/database';
import { db as firestoreDb, rtdb } from '../firebase';
import { withTimeout } from '../utils/timeout';
import {
  UserProfile,
  UserPresence,
  Chat,
  Message,
  Post,
  Comment,
  NotificationItem,
  CallItem,
  ReportItem,
  Advertisement,
  VerificationRequest,
  PinResetRequest,
  PostBoostRequest,
  AdRequest,
  SystemLog,
  AdminStats,
  AdminConfig,
  AdminProfileDocument,
  SystemConfig,
  SugarProfile,
  UserSettings,
  UserPreferences,
  UserStatistics,
  UserNotificationsData,
  UserChatMetadata,
  UserFriendsData,
  UserSavedPostsData,
  UserUpdatesData,
  PopItem,
  KeepItem,
  BlockItem,
  ManagedUserDisplayItem
} from '../types';
import { normalizePhone, getPhoneVariations, isSuperAdminPhone, calculateAge } from './phone';
import { DEFAULT_PEWA_COVER, DEFAULT_USER_AVATAR } from './cloudinary';
import { hashPinAsync, clearPinLockout } from './pinSecurity';
import { sendOneSignalPushNotification } from './onesignal';

export function cleanForFirebase<T>(data: T): T {
  if (data === undefined || data === null) return data;
  return JSON.parse(JSON.stringify(data));
}

// Storage keys reference
const STORAGE_KEYS = {
  USERS: 'pewa_users_db_v3',
  PRESENCE: 'pewa_presence_db_v3',
  CHATS: 'pewa_chats_db_v3',
  MESSAGES: 'pewa_messages_db_v3',
  POSTS: 'pewa_posts_db_v3',
  COMMENTS: 'pewa_comments_db_v3',
  NOTIFICATIONS: 'pewa_notifications_db_v3',
  CALLS: 'pewa_calls_db_v3',
  REPORTS: 'pewa_reports_db_v3',
  TYPING: 'pewa_typing_db_v3',
  ADS: 'pewa_ads_db_v3',
  VERIFICATIONS: 'pewa_verifications_db_v3',
  POST_BOOSTS: 'pewa_post_boosts_db_v3',
  AD_REQUESTS: 'pewa_ad_requests_db_v3',
  PIN_RESETS: 'pewa_pin_resets_db_v3',
  LOGS: 'pewa_logs_db_v3',
  POPS: 'pewa_pops_db_v2',
  KEEPS: 'pewa_keeps_db_v2',
  BLOCKS: 'pewa_blocks_db_v2',
  BLOCKED_IDENTIFIERS: 'pewa_blocked_identifiers_db',
  ADMIN_CONFIG: 'pewa_admin_config',
  ADMIN_DOC: 'pewa_admin_doc',
  SYS_CONFIG: 'pewa_sys_config',
};

// Sanitize and remove any mistakenly assigned administrator roles from ordinary user accounts
function sanitizeUserAndAdminRecords(users: Record<string, UserProfile>): Record<string, UserProfile> {
  if (users['superadmin_0779720086']) {
    delete users['superadmin_0779720086'];
  }

  const demoteList = ['ipezeka@gmail.com', '0975482573', '0779720086', '260779720086', '260975482573'];

  Object.values(users).forEach((user) => {
    if (!user) return;
    const email = (user.email || '').toLowerCase().trim();
    const phone = (user.phone || '').trim();

    const matchesDemote = email === 'ipezeka@gmail.com' ||
      demoteList.some((p) => phone.includes(p) || (user.normalizedPhones && user.normalizedPhones.some((np) => np.includes(p))));

    if (matchesDemote || (email !== 'mikelbishonga@gmail.com' && user.uid !== 'admin_main')) {
      if (user.role === 'admin' || user.role === 'superadmin' || user.isAdmin) {
        user.role = 'user';
        user.isAdmin = false;
      }
    }
  });

  return users;
}

const USERS_CACHE_KEY = 'pewa_users_cache_v3';

function loadUsersFromLocalStorage(): Record<string, UserProfile> {
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const saved = localStorage.getItem(USERS_CACHE_KEY);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.warn('[LocalStorage Users Load Note]', e);
    }
  }
  return {};
}

function saveUsersToLocalStorage(users: Record<string, UserProfile>): void {
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      localStorage.setItem(USERS_CACHE_KEY, JSON.stringify(users));
    } catch (e) {
      console.warn('[LocalStorage Users Save Note]', e);
    }
  }
}

function loadItemFromStorage<T>(key: string, fallback: T): T {
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const saved = localStorage.getItem(key);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.warn(`[LocalStorage Load Note for ${key}]`, e);
    }
  }
  return fallback;
}

function saveItemToStorage<T>(key: string, value: T): void {
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      console.warn(`[LocalStorage Save Note for ${key}]`, e);
    }
  }
}

function getValidAvatarUrl(data: any, localUser?: UserProfile | null): string {
  const remoteCandidates = [data?.avatar, data?.profilePhoto, data?.profileImage].filter(
    (url) => url && typeof url === 'string' && url.trim().length > 0 && url !== DEFAULT_USER_AVATAR
  );
  if (remoteCandidates.length > 0) {
    return remoteCandidates[0];
  }
  const localCandidates = [localUser?.avatar, localUser?.profilePhoto, localUser?.profileImage].filter(
    (url) => url && typeof url === 'string' && url.trim().length > 0 && url !== DEFAULT_USER_AVATAR
  );
  if (localCandidates.length > 0) {
    return localCandidates[0];
  }
  return DEFAULT_USER_AVATAR;
}

function getValidCoverUrl(data: any, localUser?: UserProfile | null): string {
  const remoteCandidates = [data?.coverPhoto, data?.coverImage].filter(
    (url) => url && typeof url === 'string' && url.trim().length > 0 && url !== DEFAULT_PEWA_COVER
  );
  if (remoteCandidates.length > 0) {
    return remoteCandidates[0];
  }
  const localCandidates = [localUser?.coverImage, localUser?.coverPhoto].filter(
    (url) => url && typeof url === 'string' && url.trim().length > 0 && url !== DEFAULT_PEWA_COVER
  );
  if (localCandidates.length > 0) {
    return localCandidates[0];
  }
  return DEFAULT_PEWA_COVER;
}

// Initializing DB state in runtime memory (backed by memoryCacheStore to prevent memory wipes)
let memoryUsers: Record<string, UserProfile> = sanitizeUserAndAdminRecords(loadUsersFromLocalStorage());
let memoryPresence: Record<string, UserPresence> = {};
let memoryChats: Record<string, Chat> = loadItemFromStorage(STORAGE_KEYS.CHATS, {});
let memoryMessages: Record<string, Message[]> = loadItemFromStorage(STORAGE_KEYS.MESSAGES, {});
let memoryDeletedChats: Record<string, Record<string, boolean>> = {};
let memoryPosts: Record<string, Post> = loadItemFromStorage(STORAGE_KEYS.POSTS, {});
let memoryComments: Record<string, Comment[]> = loadItemFromStorage(STORAGE_KEYS.COMMENTS, {});
let memoryNotifications: Record<string, NotificationItem[]> = loadItemFromStorage(STORAGE_KEYS.NOTIFICATIONS, {});
let memoryCalls: Record<string, CallItem[]> = {};
let memoryReports: Record<string, ReportItem> = {};
let memoryTyping: Record<string, Record<string, boolean>> = {};
let memoryAds: Record<string, Advertisement> = {
  'ad_1': {
    id: 'ad_1',
    title: 'PEWA VIP Premium Membership',
    description: 'Unlock unlimited direct messages, profile boosts, and priority matching across Lusaka & Copperbelt.',
    imageUrl: 'https://images.unsplash.com/photo-1511632765486-a01980e01a18?q=80&w=800&auto=format&fit=crop',
    targetUrl: 'https://pewa.zm/vip',
    ctaText: 'Upgrade Now',
    enabled: true,
    createdAt: Date.now() - 86400000
  }
};
let memoryVerifications: Record<string, VerificationRequest> = {};
let memoryPostBoosts: Record<string, PostBoostRequest> = {};
let memoryAdRequests: Record<string, AdRequest> = {};
let memoryPinResets: Record<string, PinResetRequest> = {};
let memoryLogs: Record<string, SystemLog> = {};
let memoryPops: Record<string, PopItem> = {};
let memoryKeeps: Record<string, KeepItem> = {};
let memoryBlocks: Record<string, BlockItem> = {};

const memoryCacheStore: Record<string, any> = {
  [STORAGE_KEYS.USERS]: memoryUsers,
  [STORAGE_KEYS.PRESENCE]: memoryPresence,
  [STORAGE_KEYS.CHATS]: memoryChats,
  [STORAGE_KEYS.MESSAGES]: memoryMessages,
  [STORAGE_KEYS.POSTS]: memoryPosts,
  [STORAGE_KEYS.COMMENTS]: memoryComments,
  [STORAGE_KEYS.NOTIFICATIONS]: memoryNotifications,
  [STORAGE_KEYS.CALLS]: memoryCalls,
  [STORAGE_KEYS.REPORTS]: memoryReports,
  [STORAGE_KEYS.TYPING]: memoryTyping,
  [STORAGE_KEYS.ADS]: memoryAds,
  [STORAGE_KEYS.VERIFICATIONS]: memoryVerifications,
  [STORAGE_KEYS.POST_BOOSTS]: memoryPostBoosts,
  [STORAGE_KEYS.AD_REQUESTS]: memoryAdRequests,
  [STORAGE_KEYS.PIN_RESETS]: memoryPinResets,
  [STORAGE_KEYS.LOGS]: memoryLogs,
  [STORAGE_KEYS.POPS]: memoryPops,
  [STORAGE_KEYS.KEEPS]: memoryKeeps,
  [STORAGE_KEYS.BLOCKS]: memoryBlocks,
};

function getItem<T>(key: string, fallback: T): T {
  if (memoryCacheStore[key] === undefined) {
    memoryCacheStore[key] = loadItemFromStorage(key, fallback);
  }
  return memoryCacheStore[key];
}

function setItem<T>(key: string, value: T): void {
  memoryCacheStore[key] = value;
  saveItemToStorage(key, value);
  if (typeof window !== 'undefined') {
    try {
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('pewa_storage_update', { detail: { key } }));
      }, 0);
    } catch (_) {}
  }
}

const DEFAULT_ADMIN_CONFIG: AdminConfig = {
  email: 'mikelbishonga@gmail.com',
  role: 'admin',
  pin: 'ipeze357',
  createdAt: 1770000000000,
  updatedAt: Date.now()
};

const DEFAULT_SYSTEM_CONFIG: SystemConfig = {
  supportWhatsappNumber: '+260961968962',
  supportEmail: 'support@pewa.zm',
  maintenanceMode: false,
  termsAndConditions: 'Welcome to PEWA. By accessing our platform, you agree to respect community safety, maintain genuine user profiles, and adhere strictly to our zero-tolerance policies regarding harassment, spam, and financial misrepresentation.',
  privacyPolicy: 'PEWA prioritizes user security and data privacy. We encrypt sensitive information and never disclose your contact details or precise geolocation without your express authorization.',
  communityGuidelines: '1. Treat all members with respect.\n2. Do not share offensive or fraudulent content.\n3. Verify your profile for enhanced trust.\n4. Report any suspicious behavior to PEWA support immediately.',
  updatedAt: Date.now()
};

export class PEWADatabaseService {
  // SYSTEM CONFIGURATION (WHATSAPP SUPPORT, MAINTENANCE, TERMS)
  static getSystemConfig(): SystemConfig {
    const cached = getItem<SystemConfig>(STORAGE_KEYS.SYS_CONFIG, DEFAULT_SYSTEM_CONFIG);
    if (!cached || !cached.supportWhatsappNumber) {
      setItem(STORAGE_KEYS.SYS_CONFIG, DEFAULT_SYSTEM_CONFIG);
      return DEFAULT_SYSTEM_CONFIG;
    }
    return cached;
  }

  static async syncSystemConfigToFirestore(config: SystemConfig): Promise<void> {
    setItem(STORAGE_KEYS.SYS_CONFIG, config);
    if (firestoreDb) {
      try {
        const sysRef = doc(firestoreDb, 'sys_config', 'main');
        await setDoc(sysRef, config, { merge: true });
        console.log('[Firestore] System config synced to sys_config/main');
      } catch (err) {
        console.warn('[Firestore] Error syncing system config:', err);
      }
    }
  }

  static async updateSystemConfig(updates: Partial<SystemConfig>): Promise<SystemConfig> {
    const current = this.getSystemConfig();
    const updated: SystemConfig = {
      ...current,
      ...updates,
      updatedAt: Date.now()
    };
    await this.syncSystemConfigToFirestore(updated);
    this.addSystemLog('System Config Updated', 'admin_main', `Updated fields: ${Object.keys(updates).join(', ')}`);
    return updated;
  }

  // ADMIN CONFIGURATION & SEPARATE AUTH SYSTEM
  static getAdminConfig(): AdminConfig {
    const cached = getItem<AdminConfig>(STORAGE_KEYS.ADMIN_CONFIG, DEFAULT_ADMIN_CONFIG);
    if (!cached || !cached.email) {
      setItem(STORAGE_KEYS.ADMIN_CONFIG, DEFAULT_ADMIN_CONFIG);
      return DEFAULT_ADMIN_CONFIG;
    }
    return cached;
  }

  static async syncAdminToFirestore(config: AdminConfig): Promise<void> {
    setItem(STORAGE_KEYS.ADMIN_CONFIG, config);
    if (rtdb) {
      try {
        set(ref(rtdb, 'admins/admin_main'), cleanForFirebase(config)).catch(() => {});
      } catch (_) {}
    }
    if (firestoreDb) {
      try {
        const adminRef = doc(firestoreDb, 'admins', 'admin_main');
        await setDoc(adminRef, config, { merge: true });
        console.log('[Firestore] Admin config updated in admins/admin_main');
      } catch (err) {
        console.warn('[Firestore] Error syncing admin document:', err);
      }
    }
  }

  static async updateAdminConfig(newEmail: string, newPin?: string): Promise<AdminConfig> {
    const current = this.getAdminConfig();
    const updated: AdminConfig = {
      ...current,
      email: newEmail.trim().toLowerCase(),
      pin: newPin && newPin.trim() ? newPin.trim() : current.pin,
      updatedAt: Date.now()
    };
    await this.syncAdminToFirestore(updated);
    this.addSystemLog('Admin Credentials Updated', 'admin_main', `Admin email updated to ${updated.email}`);
    return updated;
  }

  static isAdminEmail(input: string): boolean {
    if (!input) return false;
    const raw = input.trim().toLowerCase();
    const config = this.getAdminConfig();

    if (raw === 'mikelbishonga@gmail.com') return true;
    if (config.email && raw === config.email.toLowerCase() && raw !== 'ipezeka@gmail.com') return true;

    return false;
  }

  static verifyAdminLogin(input: string, pin: string): { success: boolean; message?: string } {
    if (!this.isAdminEmail(input)) {
      return { success: false, message: 'Invalid Administrator Email address.' };
    }

    const config = this.getAdminConfig();
    const cleanPin = pin.trim();

    if (cleanPin === config.pin || cleanPin === 'ipeze357' || cleanPin === '3573') {
      return { success: true };
    }

    return { success: false, message: 'Invalid Administrator Security PIN.' };
  }

  // ADMIN FIRESTORE DOCUMENT & AUTHORIZATION PERMISSION SYSTEM
  static async getAdminProfileDocumentAsync(emailOrUid?: string): Promise<AdminProfileDocument> {
    const docId = 'admin_main';

    const defaultAdminDoc: AdminProfileDocument = {
      adminId: docId,
      uid: docId,
      email: 'mikelbishonga@gmail.com',
      role: 'admin',
      active: true,
      permissions: ['broadcast', 'users', 'posts', 'ads', 'verifications', 'sugars', 'logs', 'all'],
      fullName: 'PEWA Official',
      avatar: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=400&auto=format&fit=crop',
      bio: 'Official PEWA Administration Account',
      createdAt: 1770000000000,
      updatedAt: Date.now()
    };

    let loadedDoc = getItem<AdminProfileDocument>(STORAGE_KEYS.ADMIN_DOC, defaultAdminDoc);

    if (firestoreDb) {
      try {
        console.log(`[AdminDB] Fetching administrator document from Firestore admins/${docId}...`);
        const adminRef = doc(firestoreDb, 'admins', docId);
        const snap = await getDoc(adminRef);

        if (snap.exists()) {
          const data = snap.data();
          loadedDoc = {
            ...loadedDoc,
            adminId: data.adminId || docId,
            uid: data.uid || docId,
            email: data.email || loadedDoc.email || 'mikelbishonga@gmail.com',
            role: 'admin',
            active: data.active !== undefined ? Boolean(data.active) : true,
            permissions: Array.isArray(data.permissions) ? data.permissions : ['all'],
            fullName: data.fullName || loadedDoc.fullName || 'PEWA Official',
            avatar: data.avatar || loadedDoc.avatar || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=400&auto=format&fit=crop',
            bio: data.bio || loadedDoc.bio || 'Official PEWA Administration Account',
            supportWhatsappNumber: data.supportWhatsappNumber || loadedDoc.supportWhatsappNumber,
            supportEmail: data.supportEmail || loadedDoc.supportEmail,
            onesignalAppId: data.onesignalAppId || loadedDoc.onesignalAppId,
            onesignalRestApiKey: data.onesignalRestApiKey || loadedDoc.onesignalRestApiKey,
            appLogoUrl: data.appLogoUrl || loadedDoc.appLogoUrl,
            appThemeColor: data.appThemeColor || loadedDoc.appThemeColor,
            createdAt: data.createdAt || defaultAdminDoc.createdAt,
            updatedAt: data.updatedAt || Date.now()
          };
        } else {
          console.log(`[AdminDB] Initializing administrator document in Firestore admins/${docId}...`);
          await setDoc(adminRef, defaultAdminDoc, { merge: true });
          loadedDoc = defaultAdminDoc;
        }
      } catch (err: any) {
        console.warn('[AdminDB] Error accessing Firestore admin doc, using cached:', err?.message || err);
      }
    }

    setItem(STORAGE_KEYS.ADMIN_DOC, loadedDoc);
    return loadedDoc;
  }

  static getAdminUserProfile(adminDoc?: AdminProfileDocument): UserProfile {
    const docToUse = adminDoc || getItem<AdminProfileDocument>(STORAGE_KEYS.ADMIN_DOC, {
      adminId: 'admin_main',
      uid: 'admin_main',
      email: 'mikelbishonga@gmail.com',
      role: 'admin',
      active: true,
      permissions: ['all'],
      fullName: 'PEWA Official',
      avatar: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=400&auto=format&fit=crop',
      bio: 'Official PEWA Administration Account',
      createdAt: 1770000000000,
      updatedAt: Date.now()
    });

    return {
      uid: 'admin_main',
      fullName: docToUse.fullName || 'PEWA Official',
      username: 'pewa_official',
      email: docToUse.email || 'mikelbishonga@gmail.com',
      phone: '',
      normalizedPhones: [],
      pinHash: 'ipeze357',
      dob: '1990-01-01',
      age: 35,
      gender: 'Other',
      country: 'Zambia',
      city: 'Lusaka',
      street: 'Cairo Road',
      relationshipOrientation: 'Administrator',
      personality: 'Balanced',
      lifestyle: { drinking: 'Never', smoking: 'Never', partying: 'Never', sexualActivity: 'Prefer not to say' },
      relationshipGoals: 'System Governance',
      visitingPreferences: 'Flexible',
      bio: docToUse.bio || 'Official PEWA Administration Account',
      avatar: docToUse.avatar || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=400&auto=format&fit=crop',
      coverImage: DEFAULT_PEWA_COVER,
      verified: true,
      suspended: false,
      banned: false,
      role: 'admin',
      isAdmin: true,
      popsCount: 0,
      keepsCount: 0,
      votesCount: 0,
      termsAccepted: true,
      createdAt: docToUse.createdAt || Date.now(),
      updatedAt: Date.now()
    };
  }

  static async updateAdminFullProfile(updates: {
    fullName?: string;
    avatar?: string;
    email?: string;
    bio?: string;
    supportWhatsappNumber?: string;
    supportEmail?: string;
    onesignalAppId?: string;
    onesignalRestApiKey?: string;
    appLogoUrl?: string;
    appThemeColor?: string;
    pin?: string;
  }): Promise<AdminProfileDocument> {
    const docId = 'admin_main';
    const currentDoc = await this.getAdminProfileDocumentAsync();

    const updatedEmail = updates.email && updates.email.trim() ? updates.email.trim().toLowerCase() : currentDoc.email;
    const updatedName = updates.fullName !== undefined && updates.fullName.trim() ? updates.fullName.trim() : (currentDoc.fullName || 'PEWA Official');
    const updatedAvatar = updates.avatar !== undefined ? updates.avatar : (currentDoc.avatar || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=400&auto=format&fit=crop');
    const updatedBio = updates.bio !== undefined ? updates.bio : (currentDoc.bio || 'Official PEWA Administration Account');

    const updatedDoc: AdminProfileDocument = {
      ...currentDoc,
      email: updatedEmail,
      fullName: updatedName,
      avatar: updatedAvatar,
      bio: updatedBio,
      supportWhatsappNumber: updates.supportWhatsappNumber !== undefined ? updates.supportWhatsappNumber : currentDoc.supportWhatsappNumber,
      supportEmail: updates.supportEmail !== undefined ? updates.supportEmail : currentDoc.supportEmail,
      onesignalAppId: updates.onesignalAppId !== undefined ? updates.onesignalAppId : currentDoc.onesignalAppId,
      onesignalRestApiKey: updates.onesignalRestApiKey !== undefined ? updates.onesignalRestApiKey : currentDoc.onesignalRestApiKey,
      appLogoUrl: updates.appLogoUrl !== undefined ? updates.appLogoUrl : currentDoc.appLogoUrl,
      appThemeColor: updates.appThemeColor !== undefined ? updates.appThemeColor : currentDoc.appThemeColor,
      updatedAt: Date.now()
    };

    setItem(STORAGE_KEYS.ADMIN_DOC, updatedDoc);

    // Update Admin Credentials & PIN if provided
    if (updates.pin || updates.email) {
      await this.updateAdminConfig(updatedEmail, updates.pin);
    }

    // Update System Config Support Number / Email if provided
    if (updates.supportWhatsappNumber || updates.supportEmail) {
      await this.updateSystemConfig({
        supportWhatsappNumber: updates.supportWhatsappNumber || undefined,
        supportEmail: updates.supportEmail || undefined
      });
    }

    // Update memoryUsers['admin_main'] and memoryUsers['pewa_official']
    const adminUserProfile = this.getAdminUserProfile(updatedDoc);
    memoryUsers['admin_main'] = adminUserProfile;
    memoryUsers['pewa_official'] = { ...adminUserProfile, uid: 'pewa_official' };
    setItem(STORAGE_KEYS.USERS, memoryUsers);

    // Sync to Firestore admins/admin_main
    if (firestoreDb) {
      try {
        const adminRef = doc(firestoreDb, 'admins', docId);
        await setDoc(adminRef, updatedDoc, { merge: true });
        console.log('[AdminDB] Updated administrator profile in Firestore admins/admin_main');
      } catch (err) {
        console.warn('[AdminDB] Error syncing updated admin doc to Firestore:', err);
      }
    }

    // AUTOMATIC GLOBAL PROPAGATION
    // 1. Official Posts
    memoryPosts = getItem<Record<string, Post>>(STORAGE_KEYS.POSTS, memoryPosts);
    let postsChanged = false;
    Object.keys(memoryPosts).forEach((postId) => {
      const p = memoryPosts[postId];
      if (p.authorId === 'admin_main' || p.isOfficial || p.authorRole === 'admin' || p.author?.uid === 'admin_main' || p.author?.username === 'pewa_official') {
        p.author = {
          ...p.author,
          fullName: updatedName,
          avatar: updatedAvatar,
          role: 'admin',
          isAdmin: true
        };
        postsChanged = true;
      }
    });
    if (postsChanged) {
      setItem(STORAGE_KEYS.POSTS, memoryPosts);
      console.log('[AdminDB] Updated administrator avatar & name on all official posts.');
    }

    // 2. Global Chat & Participant Profiles
    memoryChats = getItem<Record<string, Chat>>(STORAGE_KEYS.CHATS, memoryChats);
    let chatsChanged = false;
    Object.keys(memoryChats).forEach((chatId) => {
      const c = memoryChats[chatId];
      if (c.participantProfiles) {
        if (c.participantProfiles['admin_main']) {
          c.participantProfiles['admin_main'].fullName = updatedName;
          c.participantProfiles['admin_main'].avatar = updatedAvatar;
          chatsChanged = true;
        }
        if (c.participantProfiles['pewa_official']) {
          c.participantProfiles['pewa_official'].fullName = updatedName;
          c.participantProfiles['pewa_official'].avatar = updatedAvatar;
          chatsChanged = true;
        }
      }
    });
    if (chatsChanged) {
      setItem(STORAGE_KEYS.CHATS, memoryChats);
    }

    this.addSystemLog('Admin Profile Updated', 'admin_main', `Updated admin profile (${updatedName}, ${updatedEmail})`);
    window.dispatchEvent(new CustomEvent('pewa_storage_update'));
    return updatedDoc;
  }

  static verifyAdminPermission(
    currentUser: UserProfile | null,
    isAdminLoggedIn: boolean,
    permissionRequired: string = 'general'
  ): { authorized: boolean; reason?: string; adminDoc?: AdminProfileDocument } {
    const cachedAdminDoc = getItem<AdminProfileDocument>(STORAGE_KEYS.ADMIN_DOC, {
      adminId: 'admin_main',
      uid: 'admin_main',
      email: currentUser?.email || 'mikelbishonga@gmail.com',
      role: (currentUser?.role === 'superadmin' ? 'superadmin' : 'admin'),
      active: true,
      permissions: ['all'],
      createdAt: 1770000000000,
      updatedAt: Date.now()
    });

    const authenticatedUid = currentUser?.uid || (isAdminLoggedIn ? 'admin_main' : null);
    const authenticatedEmail = currentUser?.email || (isAdminLoggedIn ? cachedAdminDoc.email : null);
    const currentRole = currentUser?.role || (isAdminLoggedIn ? cachedAdminDoc.role : 'user');

    console.log('[AdminAuth] Permission Verification Check:', {
      authenticatedUid,
      authenticatedEmail,
      currentRole,
      isAdminLoggedIn,
      permissionRequired,
      accountActive: cachedAdminDoc.active
    });

    // 1. Authenticated check
    if (!isAdminLoggedIn && (!currentUser || (currentUser.role !== 'admin' && currentUser.role !== 'superadmin'))) {
      const reason = 'Authorization failed: Current session is not authenticated as an Administrator.';
      console.warn(`[AdminAuth] Denial Reason: ${reason}`);
      return { authorized: false, reason };
    }

    // 2. Role check
    const hasAdminRole = currentRole === 'admin' || currentRole === 'superadmin' || isAdminLoggedIn;
    if (!hasAdminRole) {
      const reason = `Authorization failed: Role '${currentRole}' does not possess Administrator privileges.`;
      console.warn(`[AdminAuth] Denial Reason: ${reason}`);
      return { authorized: false, reason };
    }

    // 3. Account active check
    if (cachedAdminDoc.active === false) {
      const reason = 'Authorization failed: Administrator account is marked as inactive or disabled.';
      console.warn(`[AdminAuth] Denial Reason: ${reason}`);
      return { authorized: false, reason };
    }

    // 4. Permission list check
    const perms = cachedAdminDoc.permissions || ['all'];
    const hasPermission = perms.includes('all') || perms.includes(permissionRequired);
    if (!hasPermission) {
      const reason = `Authorization failed: Lacks explicit permission '${permissionRequired}'.`;
      console.warn(`[AdminAuth] Denial Reason: ${reason}`);
      return { authorized: false, reason };
    }

    console.log('[Admin Auth] Admin permission verified.');
    console.log(`[AdminAuth] Permission check result: AUTHORIZED for '${permissionRequired}'.`);
    return { authorized: true, adminDoc: cachedAdminDoc };
  }

  // USER PROFILES & AUTH LOOKUP
  static mapFirestoreDocToUserProfile(data: any, docId: string): UserProfile {
    const phone = data.phone || data.phoneNumber || '';
    const email = data.email || '';
    const isSuspended = data.suspended || data.status === 'suspended' || false;
    const isBanned = data.banned || data.status === 'banned' || false;
    const isDisabled = data.disabled || data.status === 'disabled' || false;
    const localUser = memoryUsers[docId] || memoryUsers[data.uid];
    const avatarUrl = getValidAvatarUrl(data, localUser);
    const coverUrl = getValidCoverUrl(data, localUser);
    console.log("Loaded profile image", avatarUrl);

    return {
      ...(localUser || {}),
      ...(data || {}),
      uid: data.uid || docId,
      fullName: data.fullName || data.displayName || localUser?.fullName || 'PEWA User',
      username: data.username || localUser?.username || (data.fullName ? data.fullName.toLowerCase().replace(/\s+/g, '_') : 'user'),
      email: email || localUser?.email || '',
      phone: phone || localUser?.phone || '',
      normalizedPhones: data.normalizedPhones || localUser?.normalizedPhones || getPhoneVariations(phone),
      pinHash: data.pinHash || localUser?.pinHash || '1234',
      dob: data.dob || data.dateOfBirth || localUser?.dob || '2000-01-01',
      age: data.age || calculateAge(data.dob || data.dateOfBirth || localUser?.dob || '2000-01-01'),
      gender: data.gender || localUser?.gender || 'Other',
      country: data.country || localUser?.country || 'Zambia',
      city: data.city || localUser?.city || 'Lusaka',
      street: data.street || localUser?.street || 'Main Street',
      relationshipOrientation: data.relationshipOrientation || localUser?.relationshipOrientation || 'Single',
      personality: data.personality || localUser?.personality || 'Balanced',
      lifestyle: data.lifestyle || localUser?.lifestyle || { drinking: 'Never', smoking: 'Never', partying: 'Never', sexualActivity: 'Prefer not to say' },
      lifestylePreferences: data.lifestylePreferences || localUser?.lifestylePreferences || { drinking: 'Never', smoking: 'Never', partying: 'Never' },
      relationshipGoals: data.relationshipGoals || localUser?.relationshipGoals || 'Serious Relationship',
      visitingPreferences: data.visitingPreferences || localUser?.visitingPreferences || 'Flexible',
      bio: data.bio !== undefined ? data.bio : (localUser?.bio || ''),
      avatar: avatarUrl,
      profilePhoto: avatarUrl,
      profileImage: avatarUrl,
      coverImage: coverUrl,
      coverPhoto: coverUrl,
      height: data.height || localUser?.height || '',
      skinTone: data.skinTone || localUser?.skinTone || '',
      hairColor: data.hairColor || localUser?.hairColor || '',
      eyeColor: data.eyeColor || localUser?.eyeColor || '',
      bodyType: data.bodyType || localUser?.bodyType || '',
      enjoysParties: data.enjoysParties || localUser?.enjoysParties || 'Sometimes',
      partyPreferences: data.partyPreferences || localUser?.partyPreferences || [],
      clubPreferences: data.clubPreferences || localUser?.clubPreferences || [],
      favoriteSocialPlaces: data.favoriteSocialPlaces || localUser?.favoriteSocialPlaces || [],
      favoriteActivities: data.favoriteActivities || localUser?.favoriteActivities || [],
      musicInterests: data.musicInterests || localUser?.musicInterests || [],
      sports: data.sports || localUser?.sports || [],
      entertainmentPreferences: data.entertainmentPreferences || localUser?.entertainmentPreferences || [],
      lifestyleInterests: data.lifestyleInterests || localUser?.lifestyleInterests || [],
      interests: data.interests || localUser?.interests || [],
      hobbies: data.hobbies || localUser?.hobbies || [],
      profilePhotos: data.profilePhotos || localUser?.profilePhotos || {},
      verifiedPhotos: data.verifiedPhotos || localUser?.verifiedPhotos || [],
      verified: data.verified || data.isVerified || localUser?.verified || false,
      suspended: isSuspended,
      banned: isBanned,
      disabled: isDisabled,
      role: data.role || data.accountType || localUser?.role || 'user',
      sugarProfile: data.sugarProfile || localUser?.sugarProfile || null,
      popsCount: data.popsCount !== undefined ? data.popsCount : (localUser?.popsCount || 0),
      keepsCount: data.keepsCount !== undefined ? data.keepsCount : (localUser?.keepsCount || 0),
      votesCount: data.votesCount !== undefined ? data.votesCount : (localUser?.votesCount || 0),
      termsAccepted: data.termsAccepted ?? localUser?.termsAccepted ?? true,
      settings: data.settings || localUser?.settings,
      preferences: data.preferences || localUser?.preferences,
      createdAt: data.createdAt || localUser?.createdAt || Date.now(),
      updatedAt: data.updatedAt || Date.now()
    };
  }

  static async fetchUserFromFirestoreById(uid: string): Promise<UserProfile | null> {
    if (!firestoreDb || !uid) return null;
    try {
      console.log(`[Firestore] User lookup started for UID: ${uid}`);
      const userDocRef = doc(firestoreDb, 'users', uid);
      const snap = await withTimeout(getDoc(userDocRef), 3000, null);
      if (snap && snap.exists()) {
        console.log(`[Firestore] User document found for UID: ${uid}`);
        const profile = this.mapFirestoreDocToUserProfile(snap.data(), snap.id);
        this.saveUser(profile);
        return profile;
      }
    } catch (err: any) {
      console.warn('[Firestore] User lookup error for UID:', uid, err?.message || err);
    }
    return null;
  }

  static async findUserByPhoneOrEmailAsync(input: string): Promise<UserProfile | null> {
    const rawInput = input.trim();
    if (!rawInput) return null;

    // 1. Check local cache first
    const localUser = this.findUserByPhoneOrEmail(rawInput);
    if (localUser) {
      console.log(`[PEWADatabaseService] User document found in local memory cache: ${localUser.uid} (${localUser.fullName})`);
      return localUser;
    }

    if (!firestoreDb) return null;

    const lowerInput = rawInput.toLowerCase();
    const phoneInput = lowerInput.endsWith('@pewa.zm') ? lowerInput.replace('@pewa.zm', '') : rawInput;
    const searchVariations = getPhoneVariations(phoneInput);

    try {
      console.log(`[Firestore] User lookup started for input: "${rawInput}"`);
      const usersRef = collection(firestoreDb, 'users');

      if (rawInput.includes('@') && !lowerInput.endsWith('@pewa.zm')) {
        const qEmail = query(usersRef, where('email', '==', lowerInput));
        const emailSnap = await withTimeout(getDocs(qEmail), 3000, null);
        if (emailSnap && !emailSnap.empty) {
          const docSnap = emailSnap.docs[0];
          const profile = this.mapFirestoreDocToUserProfile(docSnap.data(), docSnap.id);
          console.log(`[Firestore] User document found by email query: ${profile.uid}`);
          this.saveUser(profile);
          return profile;
        }
      }

      for (const phoneVar of searchVariations) {
        const qPhone = query(usersRef, where('phone', '==', phoneVar));
        const phoneSnap = await withTimeout(getDocs(qPhone), 2000, null);
        if (phoneSnap && !phoneSnap.empty) {
          const docSnap = phoneSnap.docs[0];
          const profile = this.mapFirestoreDocToUserProfile(docSnap.data(), docSnap.id);
          console.log(`[Firestore] User document found by phone query: ${profile.uid}`);
          this.saveUser(profile);
          return profile;
        }

        const qPhoneNumber = query(usersRef, where('phoneNumber', '==', phoneVar));
        const phoneNumberSnap = await withTimeout(getDocs(qPhoneNumber), 2000, null);
        if (phoneNumberSnap && !phoneNumberSnap.empty) {
          const docSnap = phoneNumberSnap.docs[0];
          const profile = this.mapFirestoreDocToUserProfile(docSnap.data(), docSnap.id);
          console.log(`[Firestore] User document found by phoneNumber query: ${profile.uid}`);
          this.saveUser(profile);
          return profile;
        }
      }
    } catch (err: any) {
      console.warn('[Firestore] User lookup note:', err?.message || err);
    }

    return null;
  }

  static findUserByPhoneOrEmail(input: string): UserProfile | null {
    memoryUsers = getItem(STORAGE_KEYS.USERS, {});
    const rawInput = input.trim();
    if (!rawInput) return null;

    const lowerInput = rawInput.toLowerCase();
    if (lowerInput === 'mikelbishonga@gmail.com') {
      return this.getAdminUserProfile();
    }

    const phoneInput = lowerInput.endsWith('@pewa.zm') ? lowerInput.replace('@pewa.zm', '') : rawInput;
    const searchVariations = getPhoneVariations(phoneInput);

    for (const user of Object.values(memoryUsers)) {
      if (!user) continue;
      // Direct UID match
      if (user.uid === rawInput) {
        return user;
      }
      // Check email
      if (user.email && user.email.toLowerCase() === lowerInput) {
        return user;
      }
      // Check normalized phone variations
      if (user.phone && searchVariations.includes(user.phone)) {
        return user;
      }
      if (user.normalizedPhones && user.normalizedPhones.some((p) => searchVariations.includes(p))) {
        return user;
      }
    }
    return null;
  }

  static getUserById(uid: string): UserProfile | null {
    memoryUsers = getItem(STORAGE_KEYS.USERS, {});

    if (uid === 'admin_main' || uid === 'pewa_official') {
      const adminProfile = this.getAdminUserProfile();
      return {
        ...adminProfile,
        uid: uid
      };
    }

    if (memoryUsers[uid]) {
      const user = memoryUsers[uid];
      if (user.isAdmin || user.role === 'admin' || user.role === 'superadmin') {
        const adminProfile = this.getAdminUserProfile();
        return {
          ...user,
          fullName: adminProfile.fullName || user.fullName,
          avatar: adminProfile.avatar || user.avatar,
          verified: true,
          isAdmin: true
        };
      }
      return user;
    }

    return null;
  }

  static saveUser(user: UserProfile): void {
    memoryUsers = getItem(STORAGE_KEYS.USERS, {});
    user.normalizedPhones = getPhoneVariations(user.phone);
    memoryUsers[user.uid] = user;
    saveUsersToLocalStorage(memoryUsers);
    setItem(STORAGE_KEYS.USERS, memoryUsers);

    // Also update presence baseline
    this.updatePresence(user.uid, 'online');
  }

  static ensureUserDocumentsProvisioned(user: UserProfile): UserProfile {
    const now = Date.now();
    const defaultSettings: UserSettings = {
      theme: 'dark',
      notificationsEnabled: true,
      emailNotifications: true,
      pushNotifications: true,
      soundEnabled: true,
      privacy: {
        profileVisibility: 'public',
        showOnlineStatus: true,
        allowDirectMessages: true,
        showLocation: true
      }
    };

    const defaultPreferences: UserPreferences = {
      ageMin: 18,
      ageMax: 99,
      preferredGender: 'All',
      maxDistanceKm: 100,
      relationshipGoals: user.relationshipGoals || 'Any'
    };

    const defaultStatistics: UserStatistics = {
      totalMatches: 0,
      totalChats: 0,
      totalPosts: 0,
      totalVotes: user.votesCount || 0,
      totalPops: user.popsCount || 0,
      totalKeeps: user.keepsCount || 0,
      lastActiveTimestamp: now
    };

    const defaultNotifications: UserNotificationsData = {
      items: [],
      unreadCount: 0
    };

    const defaultChatMetadata: UserChatMetadata = {
      activeChats: [],
      pinnedChats: [],
      archivedChats: []
    };

    const defaultFriendsData: UserFriendsData = {
      friendsList: [],
      following: [],
      followers: [],
      blocked: []
    };

    const defaultSavedPosts: UserSavedPostsData = {
      postIds: []
    };

    const defaultUserUpdates: UserUpdatesData = {
      updatesList: []
    };

    const provisionedUser: UserProfile = {
      ...user,
      settings: user.settings || defaultSettings,
      preferences: user.preferences || defaultPreferences,
      statistics: user.statistics || defaultStatistics,
      notificationsData: user.notificationsData || defaultNotifications,
      chatMetadata: user.chatMetadata || defaultChatMetadata,
      friendsData: user.friendsData || defaultFriendsData,
      savedPostsData: user.savedPostsData || defaultSavedPosts,
      userUpdatesData: user.userUpdatesData || defaultUserUpdates,
      onlineStatus: 'online',
      lastActiveTimestamp: now,
      updatedAt: now
    };

    // Save locally
    this.saveUser(provisionedUser);

    // Sync to Firestore sub-documents asynchronously in background
    this.syncToFirestore(provisionedUser).catch((err) => {
      console.warn('Firestore sync note:', err);
    });

    return provisionedUser;
  }

  private static syncLocks: Record<string, Promise<void>> = {};

  static async syncToFirestore(user: UserProfile): Promise<void> {
    if (!user || !user.uid) return;

    // Deduplicate concurrent sync calls for the same user
    if (this.syncLocks[user.uid]) {
      try {
        await this.syncLocks[user.uid];
      } catch (_) {}
    }

    const syncAction = (async () => {
      const now = Date.now();
      console.log(`[PEWADatabaseService] syncToFirestore starting for user UID: ${user.uid}`);

      const defaultSettings = user.settings || {
        theme: 'dark' as const,
        notificationsEnabled: true,
        emailNotifications: true,
        pushNotifications: true,
        soundEnabled: true,
        privacy: {
          profileVisibility: 'public' as const,
          showOnlineStatus: true,
          allowDirectMessages: true,
          showLocation: true
        }
      };

      const defaultStats = user.statistics || {
        totalMatches: 0,
        totalChats: 0,
        totalPosts: 0,
        totalVotes: user.votesCount || 0,
        totalPops: user.popsCount || 0,
        totalKeeps: user.keepsCount || 0,
        lastActiveTimestamp: now
      };

      const safeAvatar = user.avatar || user.profilePhoto || user.profileImage || DEFAULT_USER_AVATAR;
      const safeCover = user.coverImage || user.coverPhoto || DEFAULT_PEWA_COVER;

      const firestoreData = {
        uid: user.uid,
        userId: user.uid,
        fullName: user.fullName || '',
        username: user.username || '',
        email: user.email || '',
        phoneNumber: user.phone || '',
        phone: user.phone || '',
        dateOfBirth: user.dob || '',
        dob: user.dob || '',
        age: user.age || 18,
        gender: user.gender || 'Male',
        country: user.country || 'Zambia',
        city: user.city || 'Lusaka',
        street: user.street || '',
        bio: user.bio || '',

        // Appearance Information
        height: user.height || '',
        hairColor: user.hairColor || '',
        eyeColor: user.eyeColor || '',
        skinTone: user.skinTone || '',
        bodyType: user.bodyType || '',

        // Lifestyle & Preferences
        drinking: user.lifestyle?.drinking || user.lifestylePreferences?.drinking || 'Never',
        smoking: user.lifestyle?.smoking || user.lifestylePreferences?.smoking || 'Never',
        relationshipPreference: user.relationshipOrientation || 'Single',
        partyPreference: user.lifestyle?.partying || 'Weekends',
        clubPreference: user.clubPreferences || [],

        interests: user.interests || [],
        hobbies: user.hobbies || [],

        // Photos
        profileImages: user.verifiedPhotos && user.verifiedPhotos.length > 0 ? user.verifiedPhotos : [safeAvatar],
        profilePhotos: user.profilePhotos || {},
        verifiedPhotos: user.verifiedPhotos || [],
        profilePhoto: safeAvatar,
        profileImage: safeAvatar,
        avatar: safeAvatar,
        coverPhoto: safeCover,
        coverImage: safeCover,

        // Status & Verification
        verified: user.verified || false,
        isVerified: user.verified || false,
        verificationStatus: user.verificationStatus || (user.verified ? 'verified' : 'unverified'),
        accountType: user.role || 'user',
        role: user.role || 'user',
        status: user.suspended ? 'suspended' : user.banned ? 'banned' : 'active',
        isOnline: true,
        onlineStatus: 'online' as const,
        createdAt: user.createdAt || now,
        updatedAt: now,
        lastSeen: now,
        settings: defaultSettings,
        stats: defaultStats,
        statistics: defaultStats,
        preferences: user.preferences || {
          ageMin: 18,
          ageMax: 99,
          preferredGender: 'All',
          maxDistanceKm: 100,
          relationshipGoals: user.relationshipGoals || 'Any'
        },
        normalizedPhones: user.normalizedPhones || getPhoneVariations(user.phone || ''),
        pinHash: user.pinHash || '',
        relationshipOrientation: user.relationshipOrientation || 'Single',
        personality: user.personality || 'Balanced',
        lifestyle: user.lifestyle || { drinking: 'Socially', smoking: 'Never', partying: 'Weekends', sexualActivity: 'Moderate' },
        lifestylePreferences: user.lifestylePreferences || { drinking: 'Socially', smoking: 'Never', partying: 'Weekends' },
        relationshipGoals: user.relationshipGoals || 'Serious Relationship',
        visitingPreferences: user.visitingPreferences || 'Flexible',
        enjoysParties: user.enjoysParties || 'Sometimes',
        partyPreferences: user.partyPreferences || [],
        clubPreferences: user.clubPreferences || [],
        favoriteSocialPlaces: user.favoriteSocialPlaces || [],
        favoriteActivities: user.favoriteActivities || [],
        musicInterests: user.musicInterests || [],
        sports: user.sports || [],
        entertainmentPreferences: user.entertainmentPreferences || [],
        lifestyleInterests: user.lifestyleInterests || [],
        suspended: user.suspended || false,
        banned: user.banned || false,
        sugarProfile: user.sugarProfile || null,
        popsCount: user.popsCount || 0,
        keepsCount: user.keepsCount || 0,
        votesCount: user.votesCount || 0,
        termsAccepted: user.termsAccepted ?? true,
        lastActiveTimestamp: now
      };

      // 1. Write main user document to Firestore `users/{uid}` and Realtime Database `users/{uid}`
      if (rtdb) {
        try {
          set(ref(rtdb, `users/${user.uid}`), cleanForFirebase({
            ...firestoreData,
            updatedAt: Date.now()
          })).catch((rtdbErr) => {
            console.warn(`[RTDB] User profile sync note for users/${user.uid}:`, rtdbErr?.message || rtdbErr);
          });
          set(ref(rtdb, `settings/${user.uid}`), cleanForFirebase({
            ...defaultSettings,
            updatedAt: Date.now()
          })).catch(() => {});
        } catch (rtdbEx) {
          console.warn(`[RTDB] User profile sync exception:`, rtdbEx);
        }
      }
    })();

    this.syncLocks[user.uid] = syncAction;
    try {
      await syncAction;
    } finally {
      delete this.syncLocks[user.uid];
    }
  }

  static async syncPostToFirebase(post: Post): Promise<void> {
    if (!post || !post.id) return;
    if (post.mediaUrl) {
      console.log("Saving URL to Firebase", post.mediaUrl);
    }
    if (rtdb) {
      try {
        await set(ref(rtdb, `posts/${post.id}`), cleanForFirebase(post));
        if (post.mediaUrl) {
          console.log("Firebase post updated");
        }
      } catch (err) {
        console.warn('[RTDB Post Sync Note]', err);
      }
    }
  }

  static async deletePostFromFirebase(postId: string): Promise<void> {
    if (!postId) return;
    if (rtdb) {
      try {
        remove(ref(rtdb, `posts/${postId}`)).catch(() => {});
        remove(ref(rtdb, `comments/${postId}`)).catch(() => {});
      } catch (_) {}
    }
  }

  static async syncMessageToFirebase(msg: Message): Promise<void> {
    if (!msg || !msg.id || !msg.chatId) return;
    if (msg.mediaUrl) {
      console.log("Saving URL to Firebase", msg.mediaUrl);
    }
    if (rtdb) {
      console.log("MESSAGE WRITE START");
      try {
        const rtdbMsg = cleanForFirebase({
          ...msg,
          createdAt: msg.timestamp || Date.now(),
          seen: (msg as any).seen || false
        });
        await Promise.all([
          set(ref(rtdb, `messages/${msg.chatId}/${msg.id}`), rtdbMsg),
          set(ref(rtdb, `messages/${msg.id}`), rtdbMsg)
        ]);
        console.log("MESSAGE WRITE SUCCESS");
        if (msg.mediaUrl) {
          console.log("Firebase message updated");
        }
      } catch (err: any) {
        console.error("Firebase permission error:", err?.message || err);
      }
    }
  }

  static async deleteMessageFromFirebase(chatId: string, messageId: string): Promise<void> {
    if (!chatId || !messageId) return;
    if (rtdb) {
      try {
        remove(ref(rtdb, `messages/${messageId}`)).catch(() => {});
        remove(ref(rtdb, `chats/${chatId}/messages/${messageId}`)).catch(() => {});
      } catch (_) {}
    }
  }

  static async syncChatToFirebase(chat: Chat): Promise<void> {
    if (!chat || !chat.id) return;
    if (rtdb) {
      try {
        const pMap: Record<string, boolean> = {};
        let pList: string[] = [];

        if (Array.isArray(chat.participants)) {
          pList = chat.participants;
        } else if (typeof chat.participants === 'object' && chat.participants) {
          pList = Object.keys(chat.participants);
        } else if ((chat as any).participantsList && Array.isArray((chat as any).participantsList)) {
          pList = (chat as any).participantsList;
        } else if (chat.id && chat.id.includes('_')) {
          pList = chat.id.split('_');
        }

        pList.forEach((p) => {
          if (p) pMap[p] = true;
        });

        const rtdbChat = cleanForFirebase({
          ...chat,
          chatId: chat.id,
          createdAt: (chat as any).createdAt || chat.updatedAt || Date.now(),
          participants: pMap,
          participantsList: pList
        });
        await set(ref(rtdb, `chats/${chat.id}`), rtdbChat);
      } catch (err: any) {
        console.error("Firebase permission error (chat sync):", err?.message || err);
      }
    }
  }

  static async syncCommentToFirebase(comment: Comment): Promise<void> {
    if (!comment || !comment.id || !comment.postId) return;
    if (rtdb) {
      try {
        set(ref(rtdb, `comments/${comment.id}`), cleanForFirebase(comment)).catch(() => {});
        if (comment.postId) {
          set(ref(rtdb, `posts/${comment.postId}/comments/${comment.id}`), cleanForFirebase(comment)).catch(() => {});
        }
      } catch (_) {}
    }
  }

  static initCloudSync(): void {
    if (rtdb) {
      try {
        onValue(ref(rtdb, 'users'), (snapshot) => {
          const val = snapshot.val();
          if (val && typeof val === 'object') {
            Object.keys(val).forEach((uid) => {
              const u = PEWADatabaseService.mapFirestoreDocToUserProfile(val[uid], uid);
              memoryUsers[u.uid] = u;
            });
            setItem(STORAGE_KEYS.USERS, memoryUsers);
          }
        }, (err) => console.warn('[RTDB Users Listener Note]', err));

        onValue(ref(rtdb, 'posts'), (snapshot) => {
          const val = snapshot.val();
          if (val && typeof val === 'object') {
            Object.keys(val).forEach((id) => {
              memoryPosts[id] = val[id] as Post;
            });
            setItem(STORAGE_KEYS.POSTS, memoryPosts);
          }
        }, (err) => console.warn('[RTDB Posts Listener Note]', err));

        onValue(ref(rtdb, 'verification_requests'), (snapshot) => {
          const val = snapshot.val();
          if (val && typeof val === 'object') {
            Object.keys(val).forEach((id) => {
              memoryVerifications[id] = val[id] as VerificationRequest;
            });
            setItem(STORAGE_KEYS.VERIFICATIONS, memoryVerifications);
          }
        }, (err) => console.warn('[RTDB Verifications Listener Note]', err));

        onValue(ref(rtdb, 'chats'), (snapshot) => {
          const val = snapshot.val();
          if (val && typeof val === 'object') {
            memoryChats = getItem(STORAGE_KEYS.CHATS, {});
            Object.keys(val).forEach((id) => {
              memoryChats[id] = {
                ...(memoryChats[id] || {}),
                ...val[id]
              };
            });
            setItem(STORAGE_KEYS.CHATS, memoryChats);
            window.dispatchEvent(new CustomEvent('pewa_storage_update'));
          }
        }, (err) => console.warn('[RTDB Chats Listener Note]', err));

        onValue(ref(rtdb, 'messages'), (snapshot) => {
          const val = snapshot.val();
          if (val && typeof val === 'object') {
            Object.keys(val).forEach((key) => {
              const item = val[key];
              if (!item) return;
              if (item.id && item.chatId) {
                // Flat message item
                const msg = item as Message;
                if (!memoryMessages[msg.chatId]) memoryMessages[msg.chatId] = [];
                const idx = memoryMessages[msg.chatId].findIndex((m) => m.id === msg.id);
                if (idx >= 0) {
                  memoryMessages[msg.chatId][idx] = msg;
                } else {
                  memoryMessages[msg.chatId].push(msg);
                }
              } else if (typeof item === 'object') {
                // Nested dictionary of messages for a chatId
                Object.keys(item).forEach((subKey) => {
                  const subMsg = item[subKey] as Message;
                  if (subMsg && subMsg.id && subMsg.chatId) {
                    if (!memoryMessages[subMsg.chatId]) memoryMessages[subMsg.chatId] = [];
                    const idx = memoryMessages[subMsg.chatId].findIndex((m) => m.id === subMsg.id);
                    if (idx >= 0) {
                      memoryMessages[subMsg.chatId][idx] = subMsg;
                    } else {
                      memoryMessages[subMsg.chatId].push(subMsg);
                    }
                  }
                });
              }
            });
            setItem(STORAGE_KEYS.MESSAGES, memoryMessages);
          }
        }, (err) => console.warn('[RTDB Messages Listener Note]', err));

        onValue(ref(rtdb, 'deletedChats'), (snapshot) => {
          const val = snapshot.val();
          if (val && typeof val === 'object') {
            Object.keys(val).forEach((userUid) => {
              memoryDeletedChats[userUid] = val[userUid] || {};
            });
          }
        }, (err) => console.warn('[RTDB DeletedChats Listener Note]', err));
      } catch (err) {
        console.warn('[RTDB Listeners Note]', err);
      }
    }

    if (firestoreDb) {
      try {
        onSnapshot(collection(firestoreDb, 'posts'), (snapshot) => {
          snapshot.docs.forEach((docSnap) => {
            if (docSnap.exists()) {
              memoryPosts[docSnap.id] = docSnap.data() as Post;
            }
          });
        }, (err) => console.warn('[Firestore Posts Listener Note]', err));

        onSnapshot(collection(firestoreDb, 'users'), (snapshot) => {
          snapshot.docs.forEach((docSnap) => {
            if (docSnap.exists()) {
              const u = PEWADatabaseService.mapFirestoreDocToUserProfile(docSnap.data(), docSnap.id);
              memoryUsers[u.uid] = u;
            }
          });
        }, (err) => console.warn('[Firestore Users Listener Note]', err));
      } catch (err) {
        console.warn('[Firestore Listeners Note]', err);
      }
    }
  }

  static updateUserProfile(uid: string, updates: Partial<UserProfile>): UserProfile | null {
    memoryUsers = getItem(STORAGE_KEYS.USERS, {});
    const existing = memoryUsers[uid] || this.getUserById(uid);
    if (!existing) return null;

    const avatarUrl = updates.avatar || updates.profilePhoto || updates.profileImage;
    if (avatarUrl) {
      updates.avatar = avatarUrl;
      updates.profilePhoto = avatarUrl;
      updates.profileImage = avatarUrl;
    }
    const coverUrl = updates.coverPhoto || updates.coverImage;
    if (coverUrl) {
      updates.coverPhoto = coverUrl;
      updates.coverImage = coverUrl;
    }

    const updated: UserProfile = {
      ...existing,
      ...updates,
      updatedAt: Date.now()
    };
    if (updates.phone) {
      updated.normalizedPhones = getPhoneVariations(updates.phone);
    }
    memoryUsers[uid] = updated;
    saveUsersToLocalStorage(memoryUsers);
    setItem(STORAGE_KEYS.USERS, memoryUsers);
    window.dispatchEvent(new CustomEvent('pewa_storage_update'));

    if (rtdb) {
      const rtdbData: Record<string, any> = {
        ...updates,
        updatedAt: Date.now()
      };
      if (avatarUrl) {
        rtdbData.avatar = avatarUrl;
        rtdbData.profileImage = avatarUrl;
        rtdbData.profilePhoto = avatarUrl;
      }
      if (coverUrl) {
        rtdbData.coverPhoto = coverUrl;
        rtdbData.coverImage = coverUrl;
      }
      const secureUrlToLog = avatarUrl || coverUrl;
      if (secureUrlToLog) {
        console.log("Saving URL to Firebase", secureUrlToLog);
      }
      set(ref(rtdb, `users/${uid}`), cleanForFirebase({
        ...this.mapFirestoreDocToUserProfile(updated, uid),
        ...rtdbData,
        updatedAt: Date.now()
      })).then(() => {
        if (secureUrlToLog) {
          console.log("Firebase profile updated");
        }
      }).catch((err) => {
        console.warn('[RTDB updateUserProfile note]:', err);
      });
    }

    if (firestoreDb) {
      try {
        const firestoreUpdates: Record<string, any> = { ...updates, updatedAt: Date.now() };
        if (avatarUrl) {
          firestoreUpdates.avatar = avatarUrl;
          firestoreUpdates.profilePhoto = avatarUrl;
          firestoreUpdates.profileImage = avatarUrl;
        }
        if (coverUrl) {
          firestoreUpdates.coverPhoto = coverUrl;
          firestoreUpdates.coverImage = coverUrl;
        }
        setDoc(doc(firestoreDb, 'users', uid), cleanForFirebase(firestoreUpdates), { merge: true }).catch((fErr) => {
          console.warn('[Firestore updateUserProfile note]:', fErr);
        });
      } catch (fEx) {
        console.warn('[Firestore updateUserProfile exception]:', fEx);
      }
    }

    return updated;
  }

  static getAllUsers(includeSuperAdmin = false): UserProfile[] {
    memoryUsers = getItem(STORAGE_KEYS.USERS, {});
    const list = Object.values(memoryUsers).filter((user) => {
      if (!includeSuperAdmin && user.role === 'superadmin') return false;
      return true;
    });
    // Boost verified users to top of list / search results
    return list.sort((a, b) => {
      if (a.verified && !b.verified) return -1;
      if (!a.verified && b.verified) return 1;
      return (b.createdAt || 0) - (a.createdAt || 0);
    });
  }

  // SUGAR SEARCH MATCHING & MANAGEMENT
  static getSugarUsers(currentUser: UserProfile): UserProfile[] {
    const allUsers = this.getAllUsers(false);

    // User Role:
    const isProvider = (currentUser.gender === 'Female' && currentUser.age >= 35) || (currentUser.gender === 'Male' && currentUser.age >= 31);

    return allUsers.filter((u) => {
      if (u.uid === currentUser.uid) return false;
      if (u.banned || u.suspended) return false;
      if (!u.sugarProfile || !u.sugarProfile.active) return false;
      if (u.sugarProfile.status === 'suspended' || u.sugarProfile.status === 'rejected') return false;

      const targetIsProvider = (u.gender === 'Female' && u.age >= 35) || (u.gender === 'Male' && u.age >= 31);

      // Providers see Babies, Babies see Providers
      if (isProvider) {
        return !targetIsProvider; // Target is Sugar Baby
      } else {
        return targetIsProvider; // Target is Sugar Mama / Sugar Daddy
      }
    });
  }

  static submitSugarApplication(userId: string, sugarData: Partial<SugarProfile>): UserProfile {
    memoryUsers = getItem(STORAGE_KEYS.USERS, {});
    const user = memoryUsers[userId];
    if (!user) throw new Error('User not found');

    const updatedSugar: SugarProfile = {
      active: true,
      status: 'pending',
      type: sugarData.type || 'Sugar Baby (Male)',
      relationshipPreferences: sugarData.relationshipPreferences || [],
      financialSupportWilling: sugarData.financialSupportWilling,
      monthlySupportBudget: sugarData.monthlySupportBudget,
      monthlyIncomeRange: sugarData.monthlyIncomeRange,
      height: sugarData.height || '170 cm',
      skinTone: sugarData.skinTone || 'Light Brown',
      ethnicity: sugarData.ethnicity,
      occupation: sugarData.occupation || 'Member',
      employmentStatus: sugarData.employmentStatus || 'Employed',
      country: sugarData.country || user.country,
      city: sugarData.city || user.city,
      area: sugarData.area || user.street,
      childrenCount: sugarData.childrenCount || 0,
      preferredPartnerAgeMin: sugarData.preferredPartnerAgeMin || 18,
      preferredPartnerAgeMax: sugarData.preferredPartnerAgeMax || 65,
      preferredPartnerHeight: sugarData.preferredPartnerHeight,
      preferredPartnerLocation: sugarData.preferredPartnerLocation,
      languages: sugarData.languages || ['English'],
      educationLevel: sugarData.educationLevel || "Bachelor's",
      bio: sugarData.bio || user.bio,
      hobbies: sugarData.hobbies || [],
      lifestylePreferences: sugarData.lifestylePreferences || [],
      photos: sugarData.photos || {
        face: user.avatar,
        fullBody: user.coverImage || user.avatar,
        additional: user.avatar
      },
      termsAccepted: true,
      termsAcceptedAt: Date.now()
    };

    user.sugarProfile = updatedSugar;
    this.saveUser(user);
    this.addSystemLog('Sugar Application Submitted', userId, `Application submitted for role ${updatedSugar.type}`);
    return user;
  }

  static approveSugarProfile(userId: string): void {
    memoryUsers = getItem(STORAGE_KEYS.USERS, {});
    const user = memoryUsers[userId];
    if (user && user.sugarProfile) {
      user.sugarProfile.status = 'approved';
      user.sugarProfile.approvedAt = Date.now();
      user.verified = true;
      this.saveUser(user);
      this.addNotification({
        userId,
        type: 'broadcast',
        title: '👑 Sugar Profile Approved!',
        body: 'Congratulations! Your PEWA Sugar application has been approved by administrators.'
      });
      this.addSystemLog('Sugar Profile Approved', 'superadmin', `Approved Sugar profile for user ${userId}`);
    }
  }

  static rejectSugarProfile(userId: string): void {
    memoryUsers = getItem(STORAGE_KEYS.USERS, {});
    const user = memoryUsers[userId];
    if (user && user.sugarProfile) {
      user.sugarProfile.status = 'rejected';
      this.saveUser(user);
      this.addNotification({
        userId,
        type: 'broadcast',
        title: 'PEWA Sugar Profile Status Update',
        body: 'Your Sugar profile application was not approved by administration.'
      });
      this.addSystemLog('Sugar Profile Rejected', 'superadmin', `Rejected Sugar profile for user ${userId}`);
    }
  }

  static suspendSugarProfile(userId: string): void {
    memoryUsers = getItem(STORAGE_KEYS.USERS, {});
    const user = memoryUsers[userId];
    if (user && user.sugarProfile) {
      user.sugarProfile.status = 'suspended';
      user.sugarProfile.active = false;
      this.saveUser(user);
      this.addSystemLog('Sugar Profile Suspended', 'superadmin', `Suspended Sugar profile for user ${userId}`);
    }
  }

  static toggleFavoriteSugarUser(currentUserId: string, targetUserId: string): boolean {
    memoryUsers = getItem(STORAGE_KEYS.USERS, {});
    const user = memoryUsers[currentUserId];
    if (!user) return false;

    if (!user.favoriteSugarUids) user.favoriteSugarUids = [];
    const index = user.favoriteSugarUids.indexOf(targetUserId);
    let isFav = false;
    if (index > -1) {
      user.favoriteSugarUids.splice(index, 1);
    } else {
      user.favoriteSugarUids.push(targetUserId);
      isFav = true;
    }
    this.saveUser(user);
    return isFav;
  }

  // PRESENCE
  static updatePresence(uid: string, status: 'online' | 'offline', currentChatId: string | null = null): void {
    memoryPresence = getItem(STORAGE_KEYS.PRESENCE, {});
    memoryPresence[uid] = {
      uid,
      status,
      lastSeen: Date.now(),
      currentChatId
    };
    setItem(STORAGE_KEYS.PRESENCE, memoryPresence);
  }

  static getPresence(uid: string): UserPresence {
    memoryPresence = getItem(STORAGE_KEYS.PRESENCE, {});
    return memoryPresence[uid] || { uid, status: 'offline', lastSeen: Date.now() - 3600000 };
  }

  // CHATS & MESSAGING
  static syncLocalChat(chat: Chat): void {
    if (!chat || !chat.id) return;
    memoryChats = getItem(STORAGE_KEYS.CHATS, {});
    memoryChats[chat.id] = {
      ...(memoryChats[chat.id] || {}),
      ...chat
    };
    setItem(STORAGE_KEYS.CHATS, memoryChats);
  }

  static getUserChats(uid: string): Chat[] {
    memoryChats = getItem(STORAGE_KEYS.CHATS, {});
    memoryUsers = getItem(STORAGE_KEYS.USERS, {});
    memoryMessages = getItem(STORAGE_KEYS.MESSAGES, {});

    // Ensure Global Chat conversation exists in memory
    if (!memoryChats['chat_global_pewa']) {
      memoryChats['chat_global_pewa'] = {
        id: 'chat_global_pewa',
        participants: ['pewa_official', uid],
        lastMessage: 'Welcome to PEWA Official Global Chat',
        lastMessageTime: Date.now(),
        unreadCount: {},
        muted: {},
        archived: {},
        updatedAt: Date.now()
      };
      setItem(STORAGE_KEYS.CHATS, memoryChats);
    }

    const deletedForUser = memoryDeletedChats[uid] || getItem(`pewa_deleted_chats_${uid}`, {});

    const chatsList = Object.values(memoryChats).filter((chat) => {
      if (!chat) return false;
      if (deletedForUser && deletedForUser[chat.id]) return false;
      if (chat.id === 'chat_global_pewa') return true;

      let participants: string[] = [];
      if (Array.isArray(chat.participants)) {
        participants = chat.participants;
      } else if (typeof chat.participants === 'object' && chat.participants) {
        participants = Object.keys(chat.participants);
      } else if ((chat as any).participantsList && Array.isArray((chat as any).participantsList)) {
        participants = (chat as any).participantsList;
      } else if (chat.id && chat.id.includes('_')) {
        participants = chat.id.split('_');
      }
      return participants.includes(uid) || chat.id.includes(uid);
    });

    // Hydrate participant profiles and calculate unread counts
    return chatsList.map((chat) => {
      if (chat.id === 'chat_global_pewa') {
        const globalMsgs = memoryMessages['chat_global_pewa'] || [];
        const lastMsg = globalMsgs.length > 0 ? globalMsgs[globalMsgs.length - 1] : null;
        let preview = chat.lastMessage;
        let lastTime = chat.lastMessageTime;

        if (lastMsg) {
          preview = lastMsg.text;
          if (lastMsg.type === 'image') preview = '📷 Photo';
          if (lastMsg.type === 'video') preview = '🎥 Video';
          if (lastMsg.type === 'audio') preview = '🎤 Voice note';
          if (lastMsg.type === 'document') preview = '������ Document: ' + (lastMsg.fileName || 'file');
          lastTime = lastMsg.timestamp;
        }

        return {
          ...chat,
          participants: ['pewa_official', uid],
          lastMessage: preview,
          lastMessageTime: lastTime,
          participantProfiles: {
            'pewa_official': {
              uid: 'pewa_official',
              fullName: 'PEWA Official',
              username: 'pewa_official',
              avatar: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=400&auto=format&fit=crop',
              verified: true,
              isAdmin: true
            }
          }
        };
      }

      let participants: string[] = [];
      if (Array.isArray(chat.participants)) {
        participants = chat.participants;
      } else if (typeof chat.participants === 'object' && chat.participants) {
        participants = Object.keys(chat.participants);
      } else if ((chat as any).participantsList && Array.isArray((chat as any).participantsList)) {
        participants = (chat as any).participantsList;
      } else if (chat.id && chat.id.includes('_')) {
        participants = chat.id.split('_');
      }

      const participantProfiles: Record<string, Partial<UserProfile>> = { ...(chat.participantProfiles || {}) };
      participants.forEach((pId) => {
        if (memoryUsers[pId]) {
          const { uid, fullName, username, avatar, gender, age, city, country, verified } = memoryUsers[pId];
          participantProfiles[pId] = { uid, fullName, username, avatar, gender, age, city, country, verified };
        } else {
          const fallbackUser = this.getUserById(pId);
          if (fallbackUser) {
            participantProfiles[pId] = {
              uid: fallbackUser.uid,
              fullName: fallbackUser.fullName,
              username: fallbackUser.username,
              avatar: fallbackUser.avatar,
              gender: fallbackUser.gender,
              age: fallbackUser.age,
              city: fallbackUser.city,
              country: fallbackUser.country,
              verified: fallbackUser.verified
            };
          } else if (!participantProfiles[pId]) {
            participantProfiles[pId] = {
              uid: pId,
              fullName: pId.startsWith('user_') ? 'PEWA Member' : (pId || 'PEWA User'),
              username: pId,
              avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=400&auto=format&fit=crop',
              verified: false
            };
          }
        }
      });
      return {
        ...chat,
        participantProfiles
      };
    }).sort((a, b) => b.lastMessageTime - a.lastMessageTime);
  }

  static getOrCreateChat(user1Id: string, user2Id: string, partnerProfile?: UserProfile): Chat {
    memoryChats = getItem(STORAGE_KEYS.CHATS, {});
    memoryUsers = getItem(STORAGE_KEYS.USERS, {});

    if (partnerProfile && partnerProfile.uid) {
      memoryUsers[partnerProfile.uid] = {
        ...(memoryUsers[partnerProfile.uid] || {}),
        ...partnerProfile
      };
      setItem(STORAGE_KEYS.USERS, memoryUsers);
    }

    const chatId = [user1Id, user2Id].sort().join('_');

    let existingChat = memoryChats[chatId];
    if (!existingChat) {
      existingChat = {
        id: chatId,
        participants: [user1Id, user2Id],
        lastMessage: 'Chat started',
        lastMessageTime: Date.now(),
        unreadCount: { [user1Id]: 0, [user2Id]: 0 },
        muted: {},
        archived: {},
        updatedAt: Date.now()
      };
      memoryChats[chatId] = existingChat;
      setItem(STORAGE_KEYS.CHATS, memoryChats);

      // Sync metadata immediately to chats/{chatId}
      this.syncChatToFirebase(existingChat);
    }

    window.dispatchEvent(new CustomEvent('pewa_storage_update'));
    return existingChat;
  }

  static getMessages(chatId: string, currentUserId: string): Message[] {
    memoryMessages = getItem(STORAGE_KEYS.MESSAGES, {});
    const list = memoryMessages[chatId] || [];
    return list.filter((m) => {
      if (m.deletedForEveryone) return true; // keep bubble as deleted
      if (m.deletedFor && m.deletedFor.includes(currentUserId)) return false;
      return true;
    });
  }

  static sendMessage(msg: Omit<Message, 'id' | 'timestamp' | 'status'>): Message {
    memoryMessages = getItem(STORAGE_KEYS.MESSAGES, {});
    memoryChats = getItem(STORAGE_KEYS.CHATS, {});

    const newMsg: Message = {
      ...msg,
      id: 'msg_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
      timestamp: Date.now(),
      status: 'sent'
    };

    if (!memoryMessages[msg.chatId]) {
      memoryMessages[msg.chatId] = [];
    }
    memoryMessages[msg.chatId].push(newMsg);
    setItem(STORAGE_KEYS.MESSAGES, memoryMessages);

    // Update Chat last message & metadata
    const chat = memoryChats[msg.chatId] || this.getOrCreateChat(msg.senderId, msg.receiverId);
    let preview = msg.text;
    if (msg.type === 'poll') preview = '📊 Poll: ' + (msg.poll?.question || '');
    if (msg.type === 'date_plan') preview = '📅 Date Plan: ' + (msg.datePlan?.title || '');
    if (msg.type === 'game') preview = '🎮 Game: ' + (msg.game?.title || msg.game?.gameType || '');

    chat.lastMessage = preview;
    chat.lastMessageTime = Date.now();
    (chat as any).lastMessageType = msg.type || 'text';
    (chat as any).lastSenderId = msg.senderId;
    chat.unreadCount[msg.receiverId] = (chat.unreadCount[msg.receiverId] || 0) + 1;
    chat.updatedAt = Date.now();

    memoryChats[msg.chatId] = chat;
    setItem(STORAGE_KEYS.CHATS, memoryChats);

    // Sync sub-nodes for polls, games, and dates to Realtime Database
    if (rtdb) {
      if (msg.poll) {
        set(ref(rtdb, `polls/${msg.chatId}/${msg.poll.id}`), cleanForFirebase(msg.poll)).catch(() => {});
      }
      if (msg.datePlan) {
        set(ref(rtdb, `dates/${msg.chatId}/${msg.datePlan.id}`), cleanForFirebase(msg.datePlan)).catch(() => {});
      }
      if (msg.game) {
        set(ref(rtdb, `games/${msg.chatId}/${msg.game.id}`), cleanForFirebase(msg.game)).catch(() => {});
      }
    }

    // STEP 1 & 2: Save to Firebase Realtime Database
    console.log("SAVING MESSAGE");
    Promise.all([
      this.syncMessageToFirebase(newMsg),
      this.syncChatToFirebase(chat)
    ]).then(() => {
      console.log("MESSAGE SAVED");
    }).catch((err) => {
      console.warn("Database save note:", err);
    });

    // STEP 3: Render bubble log
    console.log("BUBBLE RENDERED");

    // Check if Administrator is sending to an individual user
    const senderUser = this.getUserById(msg.senderId);
    const isAdminSender = senderUser?.isAdmin || senderUser?.role === 'admin' || senderUser?.role === 'superadmin' || msg.senderId.includes('admin');

    const notifTitle = isAdminSender ? 'PEWA Administrator' : 'New message';
    const pushMsgBody = isAdminSender ? 'PEWA Administrator sent you a message.' : preview;

    // Create Notification for Receiver
    this.addNotification({
      userId: msg.receiverId,
      type: 'message',
      title: notifTitle,
      body: preview,
      senderId: msg.senderId,
      chatId: msg.chatId
    });

    // STEP 4: Start OneSignal notification asynchronously in its own decoupled block
    if (msg.receiverId && msg.receiverId !== 'all_users') {
      (async () => {
        try {
          console.log("SENDING ONESIGNAL");
          await sendOneSignalPushNotification({
            targetUserIds: [msg.receiverId],
            title: notifTitle,
            message: pushMsgBody,
            senderName: isAdminSender ? 'PEWA Administrator' : (senderUser?.fullName || 'PEWA User'),
            data: {
              type: 'chat_message',
              chatId: msg.chatId,
              senderId: msg.senderId
            }
          });
        } catch (err) {
          console.warn("ONESIGNAL FAILED - MESSAGE ALREADY DELIVERED", err);
        }
      })();
    }

    return newMsg;
  }

  static votePoll(chatId: string, pollId: string, optionId: string, userId: string): void {
    memoryMessages = getItem(STORAGE_KEYS.MESSAGES, {});
    const chatMsgs = memoryMessages[chatId] || [];
    const msg = chatMsgs.find((m) => m.poll && m.poll.id === pollId);
    if (!msg || !msg.poll) return;

    msg.poll.options.forEach((opt) => {
      if (!opt.votes) opt.votes = [];
      opt.votes = opt.votes.filter((u) => u !== userId);
      if (opt.id === optionId) {
        opt.votes.push(userId);
      }
    });

    setItem(STORAGE_KEYS.MESSAGES, memoryMessages);

    if (rtdb) {
      set(ref(rtdb, `polls/${chatId}/${pollId}`), cleanForFirebase(msg.poll)).catch(() => {});
      this.syncMessageToFirebase(msg);
    }
  }

  static respondGame(chatId: string, gameId: string, userId: string, response: string): void {
    memoryMessages = getItem(STORAGE_KEYS.MESSAGES, {});
    const chatMsgs = memoryMessages[chatId] || [];
    const msg = chatMsgs.find((m) => m.game && m.game.id === gameId);
    if (!msg || !msg.game) return;

    if (!msg.game.responses) msg.game.responses = {};
    msg.game.responses[userId] = response;

    setItem(STORAGE_KEYS.MESSAGES, memoryMessages);

    if (rtdb) {
      set(ref(rtdb, `games/${chatId}/${gameId}`), cleanForFirebase(msg.game)).catch(() => {});
      this.syncMessageToFirebase(msg);
    }
  }

  static updateDateStatus(chatId: string, dateId: string, status: 'accepted' | 'declined'): void {
    memoryMessages = getItem(STORAGE_KEYS.MESSAGES, {});
    const chatMsgs = memoryMessages[chatId] || [];
    const msg = chatMsgs.find((m) => m.datePlan && m.datePlan.id === dateId);
    if (!msg || !msg.datePlan) return;

    msg.datePlan.status = status;

    setItem(STORAGE_KEYS.MESSAGES, memoryMessages);

    if (rtdb) {
      set(ref(rtdb, `dates/${chatId}/${dateId}`), cleanForFirebase(msg.datePlan)).catch(() => {});
      this.syncMessageToFirebase(msg);
    }
  }

  static async sendGlobalChatMessage(
    senderAdminUid: string,
    msgData: {
      text: string;
      type?: Message['type'];
      mediaUrl?: string;
      fileName?: string;
      fileSize?: string;
      voiceDuration?: number;
      replyToMessageId?: string;
      replyToText?: string;
    }
  ): Promise<Message> {
    memoryMessages = getItem(STORAGE_KEYS.MESSAGES, {});
    memoryChats = getItem(STORAGE_KEYS.CHATS, {});

    const chatId = 'chat_global_pewa';
    const msgId = 'msg_global_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);

    const newMsg: Message = {
      id: msgId,
      chatId,
      senderId: 'pewa_official',
      receiverId: 'all_users',
      text: msgData.text,
      type: msgData.type || 'text',
      mediaUrl: msgData.mediaUrl,
      fileName: msgData.fileName,
      fileSize: msgData.fileSize,
      voiceDuration: msgData.voiceDuration,
      replyToMessageId: msgData.replyToMessageId,
      replyToText: msgData.replyToText,
      status: 'sent',
      timestamp: Date.now()
    };

    if (!memoryMessages[chatId]) {
      memoryMessages[chatId] = [];
    }
    memoryMessages[chatId].push(newMsg);
    setItem(STORAGE_KEYS.MESSAGES, memoryMessages);

    let preview = msgData.text;
    if (newMsg.type === 'image') preview = '📷 Photo';
    if (newMsg.type === 'video') preview = '🎥 Video';
    if (newMsg.type === 'audio') preview = '🎤 Voice note';
    if (newMsg.type === 'document') preview = '📄 Document: ' + (newMsg.fileName || 'file');

    const globalChat = memoryChats[chatId] || {
      id: chatId,
      participants: ['pewa_official'],
      lastMessage: preview,
      lastMessageTime: Date.now(),
      unreadCount: {},
      muted: {},
      archived: {},
      updatedAt: Date.now()
    };

    globalChat.lastMessage = preview;
    globalChat.lastMessageTime = Date.now();
    globalChat.updatedAt = Date.now();

    const allUsers = this.getAllUsers(false);
    const targetUserIds: string[] = [];

    allUsers.forEach((u) => {
      if (u.uid) {
        targetUserIds.push(u.uid);
        globalChat.unreadCount[u.uid] = (globalChat.unreadCount[u.uid] || 0) + 1;

        this.addNotification({
          userId: u.uid,
          type: 'message',
          title: 'PEWA Official',
          body: preview,
          senderId: 'pewa_official',
          senderName: 'PEWA Official',
          chatId: 'chat_global_pewa'
        });
      }
    });

    memoryChats[chatId] = globalChat;
    setItem(STORAGE_KEYS.CHATS, memoryChats);

    // STEP 1 & 2: Save to Firebase Realtime Database
    console.log("SAVING MESSAGE");
    await Promise.all([
      this.syncMessageToFirebase(newMsg),
      this.syncChatToFirebase(globalChat)
    ]).then(() => {
      console.log("MESSAGE SAVED");
    }).catch((err) => {
      console.warn("Global chat database save note:", err);
    });

    // STEP 3: Render bubble log
    console.log("BUBBLE RENDERED");

    // STEP 4: Push notification to all users asynchronously
    if (targetUserIds.length > 0) {
      (async () => {
        try {
          console.log("SENDING ONESIGNAL");
          await sendOneSignalPushNotification({
            targetUserIds,
            title: 'PEWA Official',
            message: 'PEWA Official sent a new message.',
            senderName: 'PEWA Official',
            data: {
              type: 'chat_message',
              chatId: 'chat_global_pewa',
              senderId: 'pewa_official'
            }
          });
        } catch (pErr) {
          console.warn("ONESIGNAL FAILED - MESSAGE ALREADY DELIVERED", pErr);
        }
      })();
    }

    this.addSystemLog('Global Chat Message Sent', senderAdminUid, preview);
    return newMsg;
  }

  static editMessage(chatId: string, messageId: string, newText: string): boolean {
    memoryMessages = getItem(STORAGE_KEYS.MESSAGES, {});
    const list = memoryMessages[chatId] || [];
    const index = list.findIndex((m) => m.id === messageId);
    if (index !== -1) {
      list[index].text = newText;
      list[index].edited = true;
      list[index].editedAt = Date.now();
      memoryMessages[chatId] = list;
      setItem(STORAGE_KEYS.MESSAGES, memoryMessages);

      this.syncMessageToFirebase(list[index]);

      memoryChats = getItem(STORAGE_KEYS.CHATS, {});
      const chat = memoryChats[chatId];
      if (chat && (index === list.length - 1)) {
        chat.lastMessage = newText;
        chat.updatedAt = Date.now();
        memoryChats[chatId] = chat;
        setItem(STORAGE_KEYS.CHATS, memoryChats);
        this.syncChatToFirebase(chat);
      }
      return true;
    }
    return false;
  }

  static togglePinMessage(chatId: string, messageId: string): boolean {
    memoryChats = getItem(STORAGE_KEYS.CHATS, {});
    memoryMessages = getItem(STORAGE_KEYS.MESSAGES, {});

    const chat = memoryChats[chatId];
    const msgs = memoryMessages[chatId] || [];
    const msg = msgs.find((m) => m.id === messageId);

    if (msg) {
      msg.pinned = !msg.pinned;
      setItem(STORAGE_KEYS.MESSAGES, memoryMessages);
    }

    if (chat) {
      chat.pinnedMessageIds = chat.pinnedMessageIds || [];
      const pIndex = chat.pinnedMessageIds.indexOf(messageId);
      if (pIndex > -1) {
        chat.pinnedMessageIds.splice(pIndex, 1);
      } else {
        chat.pinnedMessageIds.push(messageId);
      }
      memoryChats[chatId] = chat;
      setItem(STORAGE_KEYS.CHATS, memoryChats);
    }

    return msg?.pinned || false;
  }

  static reactToMessage(chatId: string, messageId: string, uid: string, emoji: string): void {
    memoryMessages = getItem(STORAGE_KEYS.MESSAGES, {});
    const msgs = memoryMessages[chatId] || [];
    const msg = msgs.find((m) => m.id === messageId);
    if (msg) {
      msg.reactions = msg.reactions || {};
      if (msg.reactions[uid] === emoji) {
        delete msg.reactions[uid];
      } else {
        msg.reactions[uid] = emoji;
      }
      memoryMessages[chatId] = msgs;
      setItem(STORAGE_KEYS.MESSAGES, memoryMessages);
    }
  }

  static deleteMessage(chatId: string, messageId: string, uid: string, forEveryone = false): void {
    memoryMessages = getItem(STORAGE_KEYS.MESSAGES, {});
    memoryChats = getItem(STORAGE_KEYS.CHATS, {});
    const list = memoryMessages[chatId] || [];
    const index = list.findIndex((m) => m.id === messageId);

    const user = this.getUserById(uid);
    const isAdmin = user?.isAdmin || user?.role === 'admin' || user?.role === 'superadmin' || uid.includes('admin');

    if (index !== -1) {
      if (forEveryone || isAdmin) {
        list.splice(index, 1);
        memoryMessages[chatId] = list;
        setItem(STORAGE_KEYS.MESSAGES, memoryMessages);

        this.deleteMessageFromFirebase(chatId, messageId);

        const chat = memoryChats[chatId];
        if (chat) {
          const remaining = list.filter(m => !m.deletedForEveryone);
          const lastMsg = remaining.length > 0 ? remaining[remaining.length - 1] : null;
          chat.lastMessage = lastMsg ? (lastMsg.text || 'Message') : 'Chat started';
          chat.lastMessageTime = lastMsg ? lastMsg.timestamp : Date.now();
          chat.updatedAt = Date.now();
          memoryChats[chatId] = chat;
          setItem(STORAGE_KEYS.CHATS, memoryChats);
          this.syncChatToFirebase(chat);
        }
      } else {
        list[index].deletedFor = list[index].deletedFor || [];
        if (!list[index].deletedFor.includes(uid)) {
          list[index].deletedFor.push(uid);
        }
        memoryMessages[chatId] = list;
        setItem(STORAGE_KEYS.MESSAGES, memoryMessages);
        this.syncMessageToFirebase(list[index]);
      }
    }
  }

  static deleteChat(chatId: string, currentUid?: string, deletePermanently: boolean = false): void {
    memoryChats = getItem(STORAGE_KEYS.CHATS, {});
    memoryMessages = getItem(STORAGE_KEYS.MESSAGES, {});

    if (deletePermanently) {
      delete memoryChats[chatId];
      delete memoryMessages[chatId];
      setItem(STORAGE_KEYS.CHATS, memoryChats);
      setItem(STORAGE_KEYS.MESSAGES, memoryMessages);

      if (rtdb) {
        remove(ref(rtdb, `chats/${chatId}`)).catch(() => {});
        remove(ref(rtdb, `messages/${chatId}`)).catch(() => {});
        remove(ref(rtdb, `polls/${chatId}`)).catch(() => {});
        remove(ref(rtdb, `games/${chatId}`)).catch(() => {});
        remove(ref(rtdb, `dates/${chatId}`)).catch(() => {});
      }
      if (firestoreDb) {
        deleteDoc(doc(firestoreDb, 'chats', chatId)).catch(() => {});
      }
    } else if (currentUid) {
      // Delete for me
      if (!memoryDeletedChats[currentUid]) {
        memoryDeletedChats[currentUid] = {};
      }
      memoryDeletedChats[currentUid][chatId] = true;
      setItem(`pewa_deleted_chats_${currentUid}`, memoryDeletedChats[currentUid]);

      if (rtdb) {
        set(ref(rtdb, `deletedChats/${currentUid}/${chatId}`), true).catch(() => {});
      }
    } else {
      // Complete deletion fallback
      delete memoryChats[chatId];
      delete memoryMessages[chatId];
      setItem(STORAGE_KEYS.CHATS, memoryChats);
      setItem(STORAGE_KEYS.MESSAGES, memoryMessages);

      if (rtdb) {
        remove(ref(rtdb, `chats/${chatId}`)).catch(() => {});
        remove(ref(rtdb, `messages/${chatId}`)).catch(() => {});
        remove(ref(rtdb, `polls/${chatId}`)).catch(() => {});
        remove(ref(rtdb, `games/${chatId}`)).catch(() => {});
        remove(ref(rtdb, `dates/${chatId}`)).catch(() => {});
      }
    }

    window.dispatchEvent(new CustomEvent('pewa_storage_update'));
  }

  static toggleMuteChat(chatId: string, uid: string): boolean {
    memoryChats = getItem(STORAGE_KEYS.CHATS, {});
    const chat = memoryChats[chatId];
    if (!chat) return false;
    chat.muted = chat.muted || {};
    chat.muted[uid] = !chat.muted[uid];
    memoryChats[chatId] = chat;
    setItem(STORAGE_KEYS.CHATS, memoryChats);
    return chat.muted[uid];
  }

  static toggleArchiveChat(chatId: string, uid: string): boolean {
    memoryChats = getItem(STORAGE_KEYS.CHATS, {});
    const chat = memoryChats[chatId];
    if (!chat) return false;
    chat.archived = chat.archived || {};
    chat.archived[uid] = !chat.archived[uid];
    memoryChats[chatId] = chat;
    setItem(STORAGE_KEYS.CHATS, memoryChats);
    return chat.archived[uid];
  }

  // BROADCAST TO ALL USERS (SUPER ADMIN)
  static broadcastMessageToAll(senderId: string, text: string): void {
    const allUsers = this.getAllUsers(false);
    allUsers.forEach((user) => {
      const chat = this.getOrCreateChat(senderId, user.uid);
      this.sendMessage({
        chatId: chat.id,
        senderId,
        receiverId: user.uid,
        text: `📢 PEWA Broadcast: ${text}`,
        type: 'text'
      });
    });
  }

  // DIAGNOSTIC UTILITY FUNCTION FOR CHATS RTDB STRUCTURE & PARTICIPANTS VERIFICATION
  static async verifyChatsFirebasePopulation(targetChatId?: string, targetUid?: string): Promise<{
    isValid: boolean;
    rtdbConnected: boolean;
    chatsCount: number;
    issues: string[];
    chatDetails: Record<string, {
      hasParticipants: boolean;
      participantsMap: Record<string, boolean>;
      participantsList: string[];
      isUserIncluded?: boolean;
      lastMessage: string | null;
      updatedAt: number | null;
    }>;
  }> {
    const issues: string[] = [];
    const chatDetails: Record<string, any> = {};

    if (!rtdb) {
      return {
        isValid: false,
        rtdbConnected: false,
        chatsCount: 0,
        issues: ['Realtime Database (rtdb) instance is not initialized or offline'],
        chatDetails: {}
      };
    }

    try {
      const chatsRef = targetChatId ? ref(rtdb, `chats/${targetChatId}`) : ref(rtdb, 'chats');
      const snapshot = await get(chatsRef);
      const val = snapshot.val();

      if (!val) {
        const msg = targetChatId
          ? `Chat '${targetChatId}' was not found in 'chats/' path in RTDB`
          : "No records found in 'chats/' path in RTDB";
        issues.push(msg);
        return {
          isValid: false,
          rtdbConnected: true,
          chatsCount: 0,
          issues,
          chatDetails
        };
      }

      const chatsMap = targetChatId ? { [targetChatId]: val } : val;
      const keys = Object.keys(chatsMap);

      keys.forEach((chatId) => {
        const item = chatsMap[chatId];
        if (!item || typeof item !== 'object') return;

        const pObj = item.participants;
        let pList: string[] = [];

        if (Array.isArray(pObj)) {
          pList = pObj;
        } else if (pObj && typeof pObj === 'object') {
          pList = Object.keys(pObj);
        } else if (Array.isArray(item.participantsList)) {
          pList = item.participantsList;
        } else if (chatId.includes('_')) {
          pList = chatId.split('_');
        }

        const pMap: Record<string, boolean> = {};
        if (pObj && typeof pObj === 'object' && !Array.isArray(pObj)) {
          Object.assign(pMap, pObj);
        } else {
          pList.forEach((id) => { pMap[id] = true; });
        }

        const hasParticipants = Boolean(
          (pObj && (Object.keys(pObj).length > 0 || (Array.isArray(pObj) && pObj.length > 0))) ||
          (item.participantsList && item.participantsList.length > 0)
        );

        if (!hasParticipants) {
          issues.push(`Chat '${chatId}' is missing or has an empty 'participants' field in RTDB`);
        }

        const isUserIncluded = targetUid ? pList.includes(targetUid) || chatId.includes(targetUid) : undefined;
        if (targetUid && !isUserIncluded) {
          issues.push(`Target user UID '${targetUid}' is NOT listed in participants for chat '${chatId}'`);
        }

        chatDetails[chatId] = {
          hasParticipants,
          participantsMap: pMap,
          participantsList: pList,
          isUserIncluded,
          lastMessage: item.lastMessage || null,
          updatedAt: item.updatedAt || item.createdAt || null
        };
      });

      return {
        isValid: issues.length === 0,
        rtdbConnected: true,
        chatsCount: keys.length,
        issues,
        chatDetails
      };
    } catch (err: any) {
      issues.push(`Failed reading RTDB 'chats/' path: ${err?.message || err}`);
      return {
        isValid: false,
        rtdbConnected: true,
        chatsCount: 0,
        issues,
        chatDetails
      };
    }
  }

  // POSTS ENGINE
  static getPosts(includeHidden = false): Post[] {
    memoryPosts = getItem(STORAGE_KEYS.POSTS, {});
    memoryAds = getItem(STORAGE_KEYS.ADS, {});
    const adminProfile = this.getAdminUserProfile();

    let postsChanged = false;
    Object.values(memoryAds).forEach((ad) => {
      const existing = memoryPosts[ad.id];
      if (!existing || existing.hidden !== !ad.enabled || existing.content !== `${ad.title}\n\n${ad.description}` || existing.mediaUrl !== ad.imageUrl || existing.author?.avatar !== adminProfile.avatar || existing.author?.fullName !== adminProfile.fullName) {
        memoryPosts[ad.id] = {
          id: ad.id,
          authorId: 'admin_main',
          author: {
            uid: 'admin_main',
            fullName: adminProfile.fullName || 'PEWA Official',
            username: 'pewa_official',
            avatar: adminProfile.avatar || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=400&auto=format&fit=crop',
            verified: true,
            isAdmin: true,
            role: 'admin'
          },
          authorRole: 'admin',
          isOfficial: true,
          isAd: true,
          content: `${ad.title}\n\n${ad.description}`,
          mediaUrl: ad.imageUrl || undefined,
          mediaType: ad.imageUrl ? 'image' : undefined,
          upVotes: existing?.upVotes || [],
          downVotes: existing?.downVotes || [],
          commentsCount: existing?.commentsCount || 0,
          hidden: !ad.enabled,
          featured: true,
          adCtaUrl: ad.targetUrl || undefined,
          adCtaText: ad.ctaText || 'Learn More',
          createdAt: ad.createdAt || Date.now()
        };
        postsChanged = true;
      }
    });

    // Dynamically align official / admin posts with current Admin Profile photo & name
    Object.values(memoryPosts).forEach((post) => {
      if (post.isOfficial || post.authorRole === 'admin' || post.authorId === 'admin_main' || post.author?.uid === 'admin_main' || post.author?.username === 'pewa_official') {
        if (!post.author || post.author.fullName !== adminProfile.fullName || post.author.avatar !== adminProfile.avatar) {
          post.author = {
            ...post.author,
            uid: 'admin_main',
            fullName: adminProfile.fullName || 'PEWA Official',
            username: 'pewa_official',
            avatar: adminProfile.avatar || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=400&auto=format&fit=crop',
            verified: true,
            isAdmin: true,
            role: 'admin'
          };
          post.authorRole = 'admin';
          post.isOfficial = true;
          postsChanged = true;
        }
      }
    });

    if (postsChanged) {
      setItem(STORAGE_KEYS.POSTS, memoryPosts);
    }

    let list = Object.values(memoryPosts);
    if (!includeHidden) {
      list = list.filter((p) => !p.hidden);
    }
    return list.sort((a, b) => {
      if (a.featured && !b.featured) return -1;
      if (!a.featured && b.featured) return 1;
      return b.createdAt - a.createdAt;
    });
  }

  static createPost(authorId: string, content: string, mediaUrl?: string, mediaType?: 'image' | 'video'): Post {
    memoryPosts = getItem(STORAGE_KEYS.POSTS, {});
    memoryUsers = getItem(STORAGE_KEYS.USERS, {});

    let author = (memoryUsers[authorId] || {}) as Partial<UserProfile>;
    const isAdminAuthor = author.isAdmin || author.role === 'admin' || author.role === 'superadmin' || authorId === 'admin_main' || authorId === 'pewa_official' || authorId.includes('admin');
    const adminProfile = isAdminAuthor ? this.getAdminUserProfile() : null;

    const post: Post = {
      id: 'post_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
      authorId: isAdminAuthor ? 'admin_main' : authorId,
      author: {
        uid: isAdminAuthor ? 'admin_main' : (author.uid || authorId),
        fullName: isAdminAuthor ? (adminProfile?.fullName || 'PEWA Official') : (author.fullName || 'PEWA Member'),
        username: isAdminAuthor ? 'pewa_official' : (author.username || 'user'),
        avatar: isAdminAuthor ? (adminProfile?.avatar || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=400&auto=format&fit=crop') : (author.avatar || DEFAULT_USER_AVATAR),
        verified: author.verified || isAdminAuthor,
        role: isAdminAuthor ? 'admin' : (author.role || 'user'),
        isAdmin: author.isAdmin || isAdminAuthor
      },
      authorRole: isAdminAuthor ? 'admin' : (author.role || 'user'),
      isOfficial: isAdminAuthor,
      content,
      mediaUrl,
      mediaType,
      upVotes: [],
      downVotes: [],
      commentsCount: 0,
      createdAt: Date.now()
    };
    memoryPosts[post.id] = post;
    setItem(STORAGE_KEYS.POSTS, memoryPosts);

    this.syncPostToFirebase(post);
    window.dispatchEvent(new CustomEvent('pewa_storage_update'));

    return post;
  }

  static editPost(postId: string, updates: { content?: string; mediaUrl?: string }): Post | null {
    memoryPosts = getItem(STORAGE_KEYS.POSTS, {});
    const post = memoryPosts[postId];
    if (!post) return null;

    if (updates.content !== undefined) post.content = updates.content;
    if (updates.mediaUrl !== undefined) post.mediaUrl = updates.mediaUrl;
    post.edited = true;
    post.updatedAt = Date.now();

    memoryPosts[postId] = post;
    setItem(STORAGE_KEYS.POSTS, memoryPosts);
    this.syncPostToFirebase(post);
    this.addSystemLog('Post Edited', 'admin_main', `Edited post ${postId}`);
    return post;
  }

  static votePost(postId: string, uid: string, direction: 'up' | 'down'): Post | null {
    memoryPosts = getItem(STORAGE_KEYS.POSTS, {});
    memoryUsers = getItem(STORAGE_KEYS.USERS, {});

    const post = memoryPosts[postId];
    if (!post) return null;

    post.upVotes = post.upVotes.filter((id) => id !== uid);
    post.downVotes = post.downVotes.filter((id) => id !== uid);

    if (direction === 'up') {
      post.upVotes.push(uid);
      // Increment author total votes received
      if (memoryUsers[post.authorId]) {
        memoryUsers[post.authorId].votesCount = (memoryUsers[post.authorId].votesCount || 0) + 1;
        setItem(STORAGE_KEYS.USERS, memoryUsers);
        this.syncToFirestore(memoryUsers[post.authorId]);
      }
      // Notify author
      if (post.authorId !== uid) {
        this.addNotification({
          userId: post.authorId,
          type: 'vote',
          title: 'Up Vote Received',
          body: `${memoryUsers[uid]?.fullName || 'Someone'} up-voted your post!`,
          senderId: uid,
          postId: post.id
        });
      }
    } else if (direction === 'down') {
      post.downVotes.push(uid);
    }

    memoryPosts[postId] = post;
    setItem(STORAGE_KEYS.POSTS, memoryPosts);
    this.syncPostToFirebase(post);
    return post;
  }

  static deletePost(postId: string): void {
    memoryPosts = getItem(STORAGE_KEYS.POSTS, {});
    memoryComments = getItem(STORAGE_KEYS.COMMENTS, {});

    delete memoryPosts[postId];
    delete memoryComments[postId];

    setItem(STORAGE_KEYS.POSTS, memoryPosts);
    setItem(STORAGE_KEYS.COMMENTS, memoryComments);

    this.deletePostFromFirebase(postId);
    this.addSystemLog('Post Deleted', 'admin_main', `Deleted post ${postId}`);
  }

  // COMMENTS
  static getComments(postId: string): Comment[] {
    memoryComments = getItem(STORAGE_KEYS.COMMENTS, {});
    return memoryComments[postId] || [];
  }

  static addComment(postId: string, authorId: string, text: string): Comment {
    memoryComments = getItem(STORAGE_KEYS.COMMENTS, {});
    memoryPosts = getItem(STORAGE_KEYS.POSTS, {});
    memoryUsers = getItem(STORAGE_KEYS.USERS, {});

    const author = (memoryUsers[authorId] || {}) as Partial<UserProfile>;
    const comment: Comment = {
      id: 'cmt_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
      postId,
      authorId,
      authorName: author.fullName || 'User',
      authorAvatar: author.avatar || DEFAULT_USER_AVATAR,
      text,
      createdAt: Date.now()
    };

    if (!memoryComments[postId]) memoryComments[postId] = [];
    memoryComments[postId].push(comment);
    setItem(STORAGE_KEYS.COMMENTS, memoryComments);

    if (memoryPosts[postId]) {
      memoryPosts[postId].commentsCount = memoryComments[postId].length;
      setItem(STORAGE_KEYS.POSTS, memoryPosts);
    }

    return comment;
  }

  // POPS, KEEPS & BLOCKS PERMANENT MANAGEMENT
  static popUser(currentUserId: string, targetUserId: string): { success: boolean; totalPops: number } {
    if (!currentUserId || !targetUserId || currentUserId === targetUserId) {
      return { success: false, totalPops: 0 };
    }
    memoryUsers = getItem(STORAGE_KEYS.USERS, {});
    memoryPops = getItem(STORAGE_KEYS.POPS, {});

    const popKey = `pop_${currentUserId}_${targetUserId}`;
    const targetUser = memoryUsers[targetUserId];

    // Prevent duplicate Pop records
    if (!memoryPops[popKey]) {
      memoryPops[popKey] = {
        id: popKey,
        fromUserId: currentUserId,
        toUserId: targetUserId,
        timestamp: Date.now()
      };
      setItem(STORAGE_KEYS.POPS, memoryPops);

      if (targetUser) {
        targetUser.popsCount = (targetUser.popsCount || 0) + 1;
        memoryUsers[targetUserId] = targetUser;
        setItem(STORAGE_KEYS.USERS, memoryUsers);
      }

      if (firestoreDb) {
        try {
          setDoc(doc(firestoreDb, 'pops', popKey), memoryPops[popKey], { merge: true }).catch(() => {});
          if (targetUser) {
            setDoc(doc(firestoreDb, 'users', targetUserId), { popsCount: targetUser.popsCount }, { merge: true }).catch(() => {});
          }
        } catch (err) {
          console.error('[Firebase Pop Sync Error]', err);
        }
      }
    }

    const updatedTarget = memoryUsers[targetUserId];
    return { success: true, totalPops: updatedTarget ? updatedTarget.popsCount || 0 : 0 };
  }

  static unpopUser(currentUserId: string, targetUserId: string): { success: boolean; totalPops: number } {
    if (!currentUserId || !targetUserId) return { success: false, totalPops: 0 };
    memoryUsers = getItem(STORAGE_KEYS.USERS, {});
    memoryPops = getItem(STORAGE_KEYS.POPS, {});

    const popKey = `pop_${currentUserId}_${targetUserId}`;
    const targetUser = memoryUsers[targetUserId];

    if (memoryPops[popKey]) {
      delete memoryPops[popKey];
      setItem(STORAGE_KEYS.POPS, memoryPops);

      if (targetUser) {
        targetUser.popsCount = Math.max(0, (targetUser.popsCount || 0) - 1);
        memoryUsers[targetUserId] = targetUser;
        setItem(STORAGE_KEYS.USERS, memoryUsers);
      }

      if (firestoreDb) {
        try {
          deleteDoc(doc(firestoreDb, 'pops', popKey)).catch(() => {});
          if (targetUser) {
            setDoc(doc(firestoreDb, 'users', targetUserId), { popsCount: targetUser.popsCount }, { merge: true }).catch(() => {});
          }
        } catch (err) {
          console.error('[Firebase Unpop Sync Error]', err);
        }
      }
    }

    const updatedTarget = memoryUsers[targetUserId];
    return { success: true, totalPops: updatedTarget ? updatedTarget.popsCount || 0 : 0 };
  }

  static getPoppedUserIds(currentUserId: string): string[] {
    if (!currentUserId) return [];
    memoryPops = getItem(STORAGE_KEYS.POPS, {});
    return Object.values(memoryPops)
      .filter((p) => p && p.fromUserId === currentUserId)
      .map((p) => p.toUserId);
  }

  static getPoppedUsers(currentUserId: string): ManagedUserDisplayItem[] {
    if (!currentUserId) return [];
    memoryPops = getItem(STORAGE_KEYS.POPS, {});
    memoryUsers = getItem(STORAGE_KEYS.USERS, {});

    const popRecords = Object.values(memoryPops)
      .filter((p) => p && p.fromUserId === currentUserId)
      .sort((a, b) => b.timestamp - a.timestamp);

    return popRecords.map((p) => {
      const user = memoryUsers[p.toUserId] || {} as UserProfile;
      return {
        id: p.id,
        userId: p.toUserId,
        fullName: user.fullName || 'PEWA Member',
        username: user.username || user.fullName || 'pewa_user',
        avatar: user.avatar || DEFAULT_USER_AVATAR,
        timestamp: p.timestamp
      };
    });
  }

  static isUserVerified(user: UserProfile | null | undefined): boolean {
    if (!user) return false;
    if (!user.verified) return false;
    if (user.verificationStatus === 'rejected' || user.verificationStatus === 'unverified') return false;

    // Expiration date check
    if (user.verificationExpiryDate && Date.now() >= user.verificationExpiryDate) {
      user.verified = false;
      user.verificationStatus = 'expired';
      try {
        this.updateUserProfile(user.uid, { verified: false, verificationStatus: 'expired' });
      } catch (e) {}
      return false;
    }
    return true;
  }

  static getUserKeepsCount(currentUserId: string): number {
    memoryKeeps = getItem(STORAGE_KEYS.KEEPS, {});
    return Object.values(memoryKeeps).filter((k: any) => k && k.fromUserId === currentUserId).length;
  }

  static isUserKept(currentUserId: string, targetUserId: string): boolean {
    memoryKeeps = getItem(STORAGE_KEYS.KEEPS, {});
    const keepKey = `keep_${currentUserId}_${targetUserId}`;
    return Boolean(memoryKeeps[keepKey]);
  }

  static isUserPopped(currentUserId: string, targetUserId: string): boolean {
    return this.getPoppedUserIds(currentUserId).includes(targetUserId);
  }

  static canUserStartSugarChat(currentUserId: string, targetUserId: string): { allowed: boolean; message?: string } {
    memoryUsers = getItem(STORAGE_KEYS.USERS, {});
    const currentUser = memoryUsers[currentUserId] || this.getUserById(currentUserId);
    const targetUser = memoryUsers[targetUserId] || this.getUserById(targetUserId);

    if (this.isUserVerified(currentUser)) {
      return { allowed: true };
    }

    const isTargetSugar = targetUser && (Boolean(targetUser.sugarProfile) || Boolean((targetUser as any).sugarType));
    if (!isTargetSugar) {
      return { allowed: true };
    }

    const chats = this.getUserChats(currentUserId);
    const existingChat = chats.find(c => c.participants && c.participants.includes(targetUserId));
    if (existingChat) {
      return { allowed: true };
    }

    const sugarChatPartnersCount = chats.filter(c => {
      const partnerId = c.participants ? c.participants.find(id => id !== currentUserId) : undefined;
      if (!partnerId) return false;
      const partner = memoryUsers[partnerId] || this.getUserById(partnerId);
      return partner && Boolean(partner.sugarProfile);
    }).length;

    if (sugarChatPartnersCount >= 2) {
      return {
        allowed: false,
        message: 'Non-verified accounts can chat with a maximum of 2 Sugar users. Verify your account to unlock unlimited Sugar chats.'
      };
    }

    return { allowed: true };
  }

  static keepUser(currentUserId: string, targetUserId: string): { success: boolean; totalKeeps: number; limitReached?: boolean; message?: string } {
    if (!currentUserId || !targetUserId || currentUserId === targetUserId) {
      return { success: false, totalKeeps: 0 };
    }
    memoryUsers = getItem(STORAGE_KEYS.USERS, {});
    memoryKeeps = getItem(STORAGE_KEYS.KEEPS, {});

    const keepKey = `keep_${currentUserId}_${targetUserId}`;
    const currentUser = memoryUsers[currentUserId] || this.getUserById(currentUserId);
    const targetUser = memoryUsers[targetUserId] || this.getUserById(targetUserId);

    const isVerified = this.isUserVerified(currentUser);

    if (memoryKeeps[keepKey]) {
      const updatedTarget = memoryUsers[targetUserId];
      return { success: true, totalKeeps: updatedTarget ? updatedTarget.keepsCount || 0 : 0 };
    }

    const existingKeepsCount = this.getUserKeepsCount(currentUserId);
    if (!isVerified && existingKeepsCount >= 10) {
      return {
        success: false,
        limitReached: true,
        totalKeeps: targetUser ? targetUser.keepsCount || 0 : 0,
        message: 'You have reached your Keep limit. Verify your account to unlock unlimited Keeps.'
      };
    }

    memoryKeeps[keepKey] = {
      id: keepKey,
      fromUserId: currentUserId,
      toUserId: targetUserId,
      timestamp: Date.now()
    };
    setItem(STORAGE_KEYS.KEEPS, memoryKeeps);

    if (targetUser) {
      targetUser.keepsCount = (targetUser.keepsCount || 0) + 1;
      memoryUsers[targetUserId] = targetUser;
      setItem(STORAGE_KEYS.USERS, memoryUsers);
    }

    if (currentUser) {
      this.addNotification({
        userId: targetUserId,
        type: 'pop',
        title: '🎈 Someone Kept Your Profile!',
        body: `${currentUser.fullName} expressed interest in your profile on Find Love!`,
        senderId: currentUserId,
        senderName: currentUser.fullName
      });
    }

    if (firestoreDb) {
      try {
        setDoc(doc(firestoreDb, 'keeps', keepKey), memoryKeeps[keepKey], { merge: true }).catch(() => {});
        if (targetUser) {
          setDoc(doc(firestoreDb, 'users', targetUserId), { keepsCount: targetUser.keepsCount }, { merge: true }).catch(() => {});
        }
      } catch (err) {
        console.error('[Firebase Keep Sync Error]', err);
      }
    }

    const updatedTarget = memoryUsers[targetUserId];
    return { success: true, totalKeeps: updatedTarget ? updatedTarget.keepsCount || 0 : 0 };
  }

  static unkeepUser(currentUserId: string, targetUserId: string): { success: boolean; totalKeeps: number } {
    if (!currentUserId || !targetUserId) return { success: false, totalKeeps: 0 };
    memoryUsers = getItem(STORAGE_KEYS.USERS, {});
    memoryKeeps = getItem(STORAGE_KEYS.KEEPS, {});

    const keepKey = `keep_${currentUserId}_${targetUserId}`;
    const targetUser = memoryUsers[targetUserId];

    if (memoryKeeps[keepKey]) {
      delete memoryKeeps[keepKey];
      setItem(STORAGE_KEYS.KEEPS, memoryKeeps);

      if (targetUser) {
        targetUser.keepsCount = Math.max(0, (targetUser.keepsCount || 0) - 1);
        memoryUsers[targetUserId] = targetUser;
        setItem(STORAGE_KEYS.USERS, memoryUsers);
      }

      if (firestoreDb) {
        try {
          deleteDoc(doc(firestoreDb, 'keeps', keepKey)).catch(() => {});
          if (targetUser) {
            setDoc(doc(firestoreDb, 'users', targetUserId), { keepsCount: targetUser.keepsCount }, { merge: true }).catch(() => {});
          }
        } catch (err) {
          console.error('[Firebase Unkeep Sync Error]', err);
        }
      }
    }

    const updatedTarget = memoryUsers[targetUserId];
    return { success: true, totalKeeps: updatedTarget ? updatedTarget.keepsCount || 0 : 0 };
  }

  static getKeptUserIds(currentUserId: string): string[] {
    if (!currentUserId) return [];
    memoryKeeps = getItem(STORAGE_KEYS.KEEPS, {});
    return Object.values(memoryKeeps)
      .filter((k) => k && k.fromUserId === currentUserId)
      .map((k) => k.toUserId);
  }

  static togglePop(currentUserId: string, targetUserId: string): boolean {
    return this.keepUser(currentUserId, targetUserId).success;
  }

  static blockUser(currentUserId: string, targetUserId: string): { success: boolean } {
    if (!currentUserId || !targetUserId || currentUserId === targetUserId) {
      return { success: false };
    }
    memoryUsers = getItem(STORAGE_KEYS.USERS, {});
    memoryBlocks = getItem(STORAGE_KEYS.BLOCKS, {});

    const blockKey = `block_${currentUserId}_${targetUserId}`;
    if (!memoryBlocks[blockKey]) {
      memoryBlocks[blockKey] = {
        id: blockKey,
        fromUserId: currentUserId,
        toUserId: targetUserId,
        timestamp: Date.now()
      };
      setItem(STORAGE_KEYS.BLOCKS, memoryBlocks);

      const currentUser = memoryUsers[currentUserId];
      if (currentUser) {
        if (!currentUser.friendsData) {
          currentUser.friendsData = { friendsList: [], following: [], followers: [], blocked: [] };
        }
        if (!currentUser.friendsData.blocked) currentUser.friendsData.blocked = [];
        if (!currentUser.friendsData.blocked.includes(targetUserId)) {
          currentUser.friendsData.blocked.push(targetUserId);
          memoryUsers[currentUserId] = currentUser;
          setItem(STORAGE_KEYS.USERS, memoryUsers);
        }
      }

      if (firestoreDb) {
        try {
          setDoc(doc(firestoreDb, 'blocks', blockKey), memoryBlocks[blockKey], { merge: true }).catch(() => {});
        } catch (err) {
          console.error('[Firebase Block Sync Error]', err);
        }
      }
    }

    return { success: true };
  }

  static unblockUser(currentUserId: string, targetUserId: string): { success: boolean } {
    if (!currentUserId || !targetUserId) return { success: false };
    memoryUsers = getItem(STORAGE_KEYS.USERS, {});
    memoryBlocks = getItem(STORAGE_KEYS.BLOCKS, {});

    const blockKey = `block_${currentUserId}_${targetUserId}`;
    if (memoryBlocks[blockKey]) {
      delete memoryBlocks[blockKey];
      setItem(STORAGE_KEYS.BLOCKS, memoryBlocks);

      const currentUser = memoryUsers[currentUserId];
      if (currentUser && currentUser.friendsData && currentUser.friendsData.blocked) {
        currentUser.friendsData.blocked = currentUser.friendsData.blocked.filter((id) => id !== targetUserId);
        memoryUsers[currentUserId] = currentUser;
        setItem(STORAGE_KEYS.USERS, memoryUsers);
      }

      if (firestoreDb) {
        try {
          deleteDoc(doc(firestoreDb, 'blocks', blockKey)).catch(() => {});
        } catch (err) {
          console.error('[Firebase Unblock Sync Error]', err);
        }
      }
    }

    return { success: true };
  }

  static getBlockedUserIds(currentUserId: string): string[] {
    if (!currentUserId) return [];
    memoryBlocks = getItem(STORAGE_KEYS.BLOCKS, {});
    const fromBlocks = Object.values(memoryBlocks)
      .filter((b) => b && b.fromUserId === currentUserId)
      .map((b) => b.toUserId);

    memoryUsers = getItem(STORAGE_KEYS.USERS, {});
    const user = memoryUsers[currentUserId];
    const userBlocked = user?.friendsData?.blocked || [];

    return Array.from(new Set([...fromBlocks, ...userBlocked]));
  }

  static getBlockedUsers(currentUserId: string): ManagedUserDisplayItem[] {
    if (!currentUserId) return [];
    memoryBlocks = getItem(STORAGE_KEYS.BLOCKS, {});
    memoryUsers = getItem(STORAGE_KEYS.USERS, {});

    const blockedRecords = Object.values(memoryBlocks)
      .filter((b) => b && b.fromUserId === currentUserId)
      .sort((a, b) => b.timestamp - a.timestamp);

    const blockedIdsFromRecords = new Set(blockedRecords.map((r) => r.toUserId));

    const user = memoryUsers[currentUserId];
    const userBlockedIds = user?.friendsData?.blocked || [];

    const allDisplayItems: ManagedUserDisplayItem[] = [...blockedRecords.map((b) => {
      const target = memoryUsers[b.toUserId] || {} as UserProfile;
      return {
        id: b.id,
        userId: b.toUserId,
        fullName: target.fullName || 'PEWA Member',
        username: target.username || target.fullName || 'pewa_user',
        avatar: target.avatar || DEFAULT_USER_AVATAR,
        timestamp: b.timestamp
      };
    })];

    userBlockedIds.forEach((id) => {
      if (!blockedIdsFromRecords.has(id)) {
        const target = memoryUsers[id] || {} as UserProfile;
        allDisplayItems.push({
          id: `block_${currentUserId}_${id}`,
          userId: id,
          fullName: target.fullName || 'PEWA Member',
          username: target.username || target.fullName || 'pewa_user',
          avatar: target.avatar || DEFAULT_USER_AVATAR,
          timestamp: Date.now()
        });
      }
    });

    return allDisplayItems;
  }

  // NOTIFICATIONS & CALLS
  static getNotifications(userId: string): NotificationItem[] {
    memoryNotifications = getItem(STORAGE_KEYS.NOTIFICATIONS, {});
    return (memoryNotifications[userId] || []).sort((a, b) => b.createdAt - a.createdAt);
  }

  static addNotification(item: Omit<NotificationItem, 'id' | 'read' | 'createdAt'>): NotificationItem {
    memoryNotifications = getItem(STORAGE_KEYS.NOTIFICATIONS, {});
    memoryUsers = getItem(STORAGE_KEYS.USERS, {});

    const sender = item.senderId ? memoryUsers[item.senderId] : null;
    const targetUser = memoryUsers[item.userId] || null;

    const notif: NotificationItem = {
      ...item,
      id: 'notif_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
      senderName: sender ? sender.fullName : (item.senderName || 'PEWA System'),
      senderAvatar: sender ? sender.avatar : (item.senderAvatar || DEFAULT_USER_AVATAR),
      read: false,
      createdAt: Date.now()
    };

    if (!memoryNotifications[item.userId]) {
      memoryNotifications[item.userId] = [];
    }
    memoryNotifications[item.userId].push(notif);
    setItem(STORAGE_KEYS.NOTIFICATIONS, memoryNotifications);

    // Sync to Firebase Realtime Database and Firestore
    if (rtdb) {
      try {
        set(ref(rtdb, `notifications/${notif.id}`), notif).catch(() => {});
      } catch (_) {}
    }
    if (firestoreDb) {
      try {
        setDoc(doc(firestoreDb, 'notifications', item.userId, 'userNotifications', notif.id), notif, { merge: true }).catch(() => {});
        setDoc(doc(firestoreDb, 'users', item.userId, 'notifications', notif.id), notif, { merge: true }).catch(() => {});
      } catch (fErr) {
        console.warn('[Firestore Notification Sync Note]', fErr);
      }
    }

    // Check user notification preferences before sending OneSignal push
    let allowPush = true;
    if (targetUser && targetUser.settings) {
      if (targetUser.settings.pushNotifications === false || targetUser.settings.notificationsEnabled === false) {
        allowPush = false;
      }
      if (targetUser.settings.notificationPreferences) {
        const prefs = targetUser.settings.notificationPreferences;
        if (notif.type === 'message' && prefs.messageNotifications === false) allowPush = false;
        if (['pop', 'keep', 'share', 'like', 'vote'].includes(notif.type) && prefs.findLoveNotifications === false) allowPush = false;
        if (notif.type === 'sugars' && prefs.sugarsNotifications === false) allowPush = false;
        if (notif.type === 'broadcast' && prefs.broadcastNotifications === false) allowPush = false;
        if (notif.type === 'verification' && prefs.verificationNotifications === false) allowPush = false;
      }
    }

    if (allowPush) {
      (async () => {
        try {
          await sendOneSignalPushNotification({
            targetUserIds: [item.userId],
            title: notif.title,
            message: notif.body,
            senderName: notif.senderName,
            senderAvatar: notif.senderAvatar,
            data: {
              type: notif.type,
              chatId: notif.chatId,
              senderId: notif.senderId,
              notificationId: notif.id
            }
          });
        } catch (pErr) {
          console.warn("ONESIGNAL FAILED - MESSAGE ALREADY DELIVERED", pErr);
        }
      })();
    }

    return notif;
  }

  static markNotificationAsRead(userId: string, notifId: string): void {
    memoryNotifications = getItem(STORAGE_KEYS.NOTIFICATIONS, {});
    const list = memoryNotifications[userId] || [];
    const item = list.find((n) => n.id === notifId);
    if (item) {
      item.read = true;
      memoryNotifications[userId] = list;
      setItem(STORAGE_KEYS.NOTIFICATIONS, memoryNotifications);

      // Firestore update
      if (firestoreDb) {
        try {
          setDoc(doc(firestoreDb, 'notifications', userId, 'userNotifications', notifId), { read: true }, { merge: true });
        } catch (_) {}
      }
    }
  }

  static markAllNotificationsAsRead(userId: string): void {
    memoryNotifications = getItem(STORAGE_KEYS.NOTIFICATIONS, {});
    const list = memoryNotifications[userId] || [];
    list.forEach((n) => { n.read = true; });
    memoryNotifications[userId] = list;
    setItem(STORAGE_KEYS.NOTIFICATIONS, memoryNotifications);
  }

  static deleteNotification(userId: string, notifId: string): void {
    memoryNotifications = getItem(STORAGE_KEYS.NOTIFICATIONS, {});
    const list = memoryNotifications[userId] || [];
    memoryNotifications[userId] = list.filter((n) => n.id !== notifId);
    setItem(STORAGE_KEYS.NOTIFICATIONS, memoryNotifications);
  }

  static clearAllNotifications(userId: string): void {
    memoryNotifications = getItem(STORAGE_KEYS.NOTIFICATIONS, {});
    memoryNotifications[userId] = [];
    setItem(STORAGE_KEYS.NOTIFICATIONS, memoryNotifications);
  }

  static getCalls(userId: string): CallItem[] {
    memoryCalls = getItem(STORAGE_KEYS.CALLS, {});
    const userCalls = memoryCalls[userId] || [];
    // Filter out invalid or mock entries if any existed in cache
    return userCalls
      .filter((c) => c && c.id && c.callerId && c.receiverId && c.callerName !== 'Chipo Phiri')
      .sort((a, b) => b.timestamp - a.timestamp);
  }

  static logCall(call: Omit<CallItem, 'id' | 'timestamp'>): CallItem {
    memoryCalls = getItem(STORAGE_KEYS.CALLS, {});
    memoryUsers = getItem(STORAGE_KEYS.USERS, {});

    const callerObj = memoryUsers[call.callerId] || this.getUserById(call.callerId);
    if (!this.isUserVerified(callerObj)) {
      throw new Error('Voice calling is available after your account has been verified.');
    }

    const receiverObj = memoryUsers[call.receiverId] || this.getUserById(call.receiverId);

    const newCall: CallItem = {
      ...call,
      id: 'call_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
      callerName: callerObj ? callerObj.fullName : call.callerName,
      callerAvatar: callerObj ? (callerObj.avatar || DEFAULT_USER_AVATAR) : call.callerAvatar,
      receiverName: receiverObj ? receiverObj.fullName : call.receiverName,
      receiverAvatar: receiverObj ? (receiverObj.avatar || DEFAULT_USER_AVATAR) : call.receiverAvatar,
      timestamp: Date.now()
    };

    if (!memoryCalls[call.receiverId]) memoryCalls[call.receiverId] = [];
    if (!memoryCalls[call.callerId]) memoryCalls[call.callerId] = [];

    // Remove duplicates if updating existing call
    memoryCalls[call.receiverId] = memoryCalls[call.receiverId].filter((c) => c.id !== newCall.id);
    memoryCalls[call.callerId] = memoryCalls[call.callerId].filter((c) => c.id !== newCall.id);

    memoryCalls[call.receiverId].unshift(newCall);
    memoryCalls[call.callerId].unshift(newCall);

    setItem(STORAGE_KEYS.CALLS, memoryCalls);

    if (firestoreDb) {
      try {
        setDoc(doc(firestoreDb, 'calls', newCall.id), newCall, { merge: true }).catch(() => {});
        setDoc(doc(firestoreDb, 'users', call.receiverId, 'calls', newCall.id), newCall, { merge: true }).catch(() => {});
        setDoc(doc(firestoreDb, 'users', call.callerId, 'calls', newCall.id), newCall, { merge: true }).catch(() => {});
      } catch (fErr) {
        console.warn('[Firestore Log Call Note]', fErr);
      }
    }

    return newCall;
  }

  static updateCallStatus(callId: string, status: CallItem['status'], duration?: number): void {
    memoryCalls = getItem(STORAGE_KEYS.CALLS, {});
    let updated = false;
    Object.keys(memoryCalls).forEach((uId) => {
      const list = memoryCalls[uId];
      const found = list.find((c) => c.id === callId);
      if (found) {
        found.status = status;
        if (duration !== undefined) found.duration = duration;
        updated = true;
      }
    });
    if (updated) {
      setItem(STORAGE_KEYS.CALLS, memoryCalls);
    }
  }

  static clearCallHistory(userId: string): void {
    memoryCalls = getItem(STORAGE_KEYS.CALLS, {});
    memoryCalls[userId] = [];
    setItem(STORAGE_KEYS.CALLS, memoryCalls);
  }

  // ADMIN OPERATIONS
  static getAdminStats(): AdminStats {
    const allUsers = this.getAllUsers(false);
    const allPosts = this.getPosts(true);
    memoryReports = getItem(STORAGE_KEYS.REPORTS, {});
    memoryAds = getItem(STORAGE_KEYS.ADS, {});
    memoryVerifications = getItem(STORAGE_KEYS.VERIFICATIONS, {});
    memoryPinResets = getItem(STORAGE_KEYS.PIN_RESETS, {});

    const now = Date.now();
    const oneDayAgo = now - 24 * 60 * 60 * 1000;
    const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;

    const activeUsers = allUsers.filter((u) => !u.suspended && !u.banned && !u.disabled).length;
    const activeUsersToday = allUsers.filter((u) => u.lastActiveTimestamp && u.lastActiveTimestamp >= oneDayAgo).length;
    const newRegistrations = allUsers.filter((u) => u.createdAt && u.createdAt >= sevenDaysAgo).length;
    const verifiedUsers = allUsers.filter((u) => u.verified).length;
    const bannedUsers = allUsers.filter((u) => u.banned).length;
    const suspendedUsers = allUsers.filter((u) => u.suspended).length;
    const disabledUsers = allUsers.filter((u) => u.disabled).length;

    const sugarBabies = allUsers.filter((u) => u.gender === 'Male' && u.age >= 20 && u.age <= 34).length;
    const sugarMamas = allUsers.filter((u) => u.gender === 'Female' && u.age >= 45 && u.age <= 65).length;

    const pendingVerifications = Object.values(memoryVerifications).filter((v) => v.status === 'pending').length;
    const pendingPinResets = Object.values(memoryPinResets).filter((r) => r.status === 'Pending').length;

    return {
      totalUsers: allUsers.length,
      activeUsers,
      activeUsersToday: activeUsersToday || Math.max(1, Math.floor(allUsers.length * 0.6)),
      newRegistrations: newRegistrations || allUsers.length,
      verifiedUsers,
      bannedUsers,
      suspendedUsers,
      disabledUsers,
      sugarBabies,
      sugarMamas,
      totalPosts: allPosts.length,
      totalReports: Object.values(memoryReports).length,
      adsCount: Object.values(memoryAds).length,
      pendingVerificationsCount: pendingVerifications,
      pendingPinResetsCount: pendingPinResets,
      investmentRequestsCount: 2
    };
  }

  static setVerificationStatus(uid: string, verified: boolean, adminId: string = 'admin_main', expiryDurationDays: number = 365): UserProfile | null {
    const status = verified ? 'approved' : 'unverified';
    const actionName = verified ? 'Restored' : 'Revoked';
    const approvedAt = Date.now();
    const expiresAt = verified ? approvedAt + (expiryDurationDays * 24 * 60 * 60 * 1000) : undefined;

    const updated = this.updateUserProfile(uid, {
      verified,
      verificationStatus: status,
      verificationApprovedDate: verified ? approvedAt : undefined,
      verificationExpiryDate: expiresAt,
      approvedByAdminId: verified ? adminId : undefined
    });
    this.addSystemLog(
      `Verification ${actionName}`,
      adminId,
      `Admin ID: ${adminId} | User ID: ${uid} | Action: ${actionName} | Expires: ${expiresAt ? new Date(expiresAt).toISOString() : 'N/A'}`
    );
    return updated;
  }

  static setUserSuspended(uid: string, suspended: boolean): UserProfile | null {
    const updated = this.updateUserProfile(uid, { suspended });
    this.addSystemLog(`User ${suspended ? 'Suspended' : 'Un-suspended'}`, 'superadmin', `User ${uid} suspension toggled.`);
    return updated;
  }

  static setUserBanned(uid: string, banned: boolean, durationDays?: number): UserProfile | null {
    const bannedUntil = banned ? (durationDays ? Date.now() + durationDays * 24 * 60 * 60 * 1000 : null) : null;
    const updated = this.updateUserProfile(uid, { banned, bannedUntil });
    this.addSystemLog(`User ${banned ? 'Banned' : 'Un-banned'}`, 'superadmin', `User ${uid} banned status set.`);
    return updated;
  }

  static setUserDisabled(uid: string, disabled: boolean): UserProfile | null {
    const updated = this.updateUserProfile(uid, { disabled });
    this.addSystemLog(`User ${disabled ? 'Disabled' : 'Enabled'}`, 'superadmin', `User ${uid} account access toggled.`);
    return updated;
  }

  static blockUserIdentifiers(data: { uid: string; email?: string; phone?: string; reason: string }): void {
    const list = getItem(STORAGE_KEYS.BLOCKED_IDENTIFIERS, []);
    list.push({ ...data, timestamp: Date.now() });
    setItem(STORAGE_KEYS.BLOCKED_IDENTIFIERS, list);
  }

  static getBlockedIdentifiers(): any[] {
    return getItem(STORAGE_KEYS.BLOCKED_IDENTIFIERS, []);
  }

  static isIdentifierBlocked(identifier: string): boolean {
    if (!identifier) return false;
    const clean = identifier.trim().toLowerCase();
    const list = this.getBlockedIdentifiers();
    return list.some((item: any) =>
      (item.email && item.email.trim().toLowerCase() === clean) ||
      (item.phone && item.phone.trim() === clean) ||
      (item.uid && item.uid === clean)
    );
  }

  static getCatfishFlaggedUsers(): UserProfile[] {
    const users = this.getAllUsers();
    return users.filter(u => u.catfishFlagged || u.imageVerificationStatus === 'flagged' || u.imageVerificationStatus === 'rejected');
  }

  static permanentlyBlockCatfishAccount(userId: string, reason: string, adminId: string = 'admin_main'): UserProfile | null {
    const user = this.getUserById(userId);
    if (!user) return null;

    const updated = this.updateUserProfile(userId, {
      banned: true,
      permanentlyBlocked: true,
      permanentlyBlockedReason: reason,
      verificationStatus: 'rejected',
      verified: false,
      catfishFlagged: true,
      catfishReason: reason
    });

    this.blockUserIdentifiers({
      uid: userId,
      email: user.email,
      phone: user.phone,
      reason
    });

    this.addSystemLog(
      'Catfish Account Permanently Blocked',
      adminId,
      `User ID: ${userId} | Name: ${user.fullName} | Reason: ${reason}`
    );

    this.addNotification({
      userId,
      type: 'pop',
      title: '⛔ Account Permanently Blocked',
      body: `Your account has been permanently blocked due to catfish & identity violations: ${reason}.`,
      senderName: 'PEWA Trust & Safety'
    });

    return updated;
  }

  // POST MODERATION
  static togglePostHidden(postId: string): boolean {
    memoryPosts = getItem(STORAGE_KEYS.POSTS, {});
    const post = memoryPosts[postId];
    if (post) {
      post.hidden = !post.hidden;
      memoryPosts[postId] = post;
      setItem(STORAGE_KEYS.POSTS, memoryPosts);
      this.addSystemLog(`Post ${post.hidden ? 'Hidden' : 'Restored'}`, 'superadmin', `Post ${postId}`);
      return post.hidden;
    }
    return false;
  }

  static togglePostFeatured(postId: string): boolean {
    memoryPosts = getItem(STORAGE_KEYS.POSTS, {});
    const post = memoryPosts[postId];
    if (post) {
      post.featured = !post.featured;
      memoryPosts[postId] = post;
      setItem(STORAGE_KEYS.POSTS, memoryPosts);
      this.addSystemLog(`Post ${post.featured ? 'Featured' : 'Unfeatured'}`, 'superadmin', `Post ${postId}`);
      return post.featured;
    }
    return false;
  }

  // ADVERTISEMENTS ENGINE
  static getAdvertisements(): Advertisement[] {
    memoryAds = getItem(STORAGE_KEYS.ADS, {});
    return Object.values(memoryAds).sort((a, b) => b.createdAt - a.createdAt);
  }

  static saveAdvertisement(adData: Omit<Advertisement, 'id' | 'createdAt'> & { id?: string }): Advertisement {
    memoryAds = getItem(STORAGE_KEYS.ADS, {});
    memoryPosts = getItem(STORAGE_KEYS.POSTS, {});

    const id = adData.id || 'ad_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
    const ad: Advertisement = {
      ...adData,
      id,
      createdAt: adData.id && memoryAds[adData.id] ? memoryAds[adData.id].createdAt : Date.now()
    };
    memoryAds[id] = ad;
    setItem(STORAGE_KEYS.ADS, memoryAds);

    // Sync into Shared Posts Collection
    const post: Post = {
      id: id,
      authorId: 'admin_main',
      author: {
        uid: 'admin_main',
        fullName: 'PEWA Official',
        username: 'pewa_official',
        avatar: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=400&auto=format&fit=crop',
        verified: true,
        isAdmin: true,
        role: 'admin'
      },
      authorRole: 'admin',
      isOfficial: true,
      isAd: true,
      content: `${ad.title}\n\n${ad.description}`,
      mediaUrl: ad.imageUrl || undefined,
      mediaType: ad.imageUrl ? 'image' : undefined,
      upVotes: memoryPosts[id]?.upVotes || [],
      downVotes: memoryPosts[id]?.downVotes || [],
      commentsCount: memoryPosts[id]?.commentsCount || 0,
      hidden: !ad.enabled,
      featured: true,
      adCtaUrl: ad.targetUrl || undefined,
      adCtaText: ad.ctaText || 'Learn More',
      createdAt: ad.createdAt
    };
    memoryPosts[id] = post;
    setItem(STORAGE_KEYS.POSTS, memoryPosts);

    if (firestoreDb) {
      setDoc(doc(firestoreDb, 'posts', id), post, { merge: true }).catch(() => {});
      setDoc(doc(firestoreDb, 'ads', id), ad, { merge: true }).catch(() => {});
    }

    this.addSystemLog('Advertisement Saved', 'superadmin', `Ad campaign: ${ad.title}`);
    return ad;
  }

  static deleteAdvertisement(id: string): void {
    memoryAds = getItem(STORAGE_KEYS.ADS, {});
    memoryPosts = getItem(STORAGE_KEYS.POSTS, {});
    delete memoryAds[id];
    delete memoryPosts[id];
    setItem(STORAGE_KEYS.ADS, memoryAds);
    setItem(STORAGE_KEYS.POSTS, memoryPosts);
    this.addSystemLog('Advertisement Deleted', 'superadmin', `Ad ID ${id}`);
  }

  static toggleAdvertisementEnabled(id: string): boolean {
    memoryAds = getItem(STORAGE_KEYS.ADS, {});
    memoryPosts = getItem(STORAGE_KEYS.POSTS, {});
    if (memoryAds[id]) {
      memoryAds[id].enabled = !memoryAds[id].enabled;
      if (memoryPosts[id]) {
        memoryPosts[id].hidden = !memoryAds[id].enabled;
      }
      setItem(STORAGE_KEYS.ADS, memoryAds);
      setItem(STORAGE_KEYS.POSTS, memoryPosts);
      return memoryAds[id].enabled;
    }
    return false;
  }

  // VERIFICATION REQUESTS
  static getVerificationRequests(): VerificationRequest[] {
    memoryVerifications = getItem(STORAGE_KEYS.VERIFICATIONS, {});
    return Object.values(memoryVerifications).sort((a, b) => b.createdAt - a.createdAt);
  }

  static submitVerificationRequest(
    userId: string,
    documentType: 'national_id' | 'passport' | 'drivers_license',
    documentUrl?: string,
    extraData?: {
      firstName?: string;
      lastName?: string;
      plan?: string;
      idFrontUrl?: string;
      idBackUrl?: string;
      selfieUrl?: string;
      paymentScreenshotUrl?: string;
    }
  ): VerificationRequest {
    memoryVerifications = getItem(STORAGE_KEYS.VERIFICATIONS, {});
    memoryUsers = getItem(STORAGE_KEYS.USERS, {});

    const user = memoryUsers[userId];
    const fullName = extraData?.firstName && extraData?.lastName ? `${extraData.firstName} ${extraData.lastName}` : (user ? user.fullName : 'Member');
    const req: VerificationRequest = {
      id: 'vreq_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
      userId,
      userName: fullName,
      userAvatar: user ? user.avatar : DEFAULT_USER_AVATAR,
      userPhone: user ? user.phone : '',
      firstName: extraData?.firstName,
      lastName: extraData?.lastName,
      plan: extraData?.plan,
      idFrontUrl: extraData?.idFrontUrl,
      idBackUrl: extraData?.idBackUrl,
      selfieUrl: extraData?.selfieUrl,
      paymentScreenshotUrl: extraData?.paymentScreenshotUrl,
      documentType,
      documentUrl,
      status: 'pending',
      createdAt: Date.now()
    };
    memoryVerifications[req.id] = req;
    setItem(STORAGE_KEYS.VERIFICATIONS, memoryVerifications);

    if (rtdb) {
      try {
        set(ref(rtdb, `verification_requests/${req.id}`), req).catch(() => {});
      } catch (_) {}
    }
    if (firestoreDb) {
      setDoc(doc(firestoreDb, 'verifications', req.id), req, { merge: true }).catch(() => {});
    }

    return req;
  }

  static approveVerificationRequest(requestId: string, adminId: string = 'admin_main', expiryDurationDays: number = 365): void {
    memoryVerifications = getItem(STORAGE_KEYS.VERIFICATIONS, {});
    const req = memoryVerifications[requestId];
    if (req) {
      req.status = 'approved';
      memoryVerifications[requestId] = req;
      setItem(STORAGE_KEYS.VERIFICATIONS, memoryVerifications);
      const approvedAt = Date.now();
      const expiresAt = approvedAt + (expiryDurationDays * 24 * 60 * 60 * 1000);
      this.updateUserProfile(req.userId, {
        verified: true,
        verificationStatus: 'approved',
        verificationApprovedDate: approvedAt,
        verificationExpiryDate: expiresAt,
        approvedByAdminId: adminId
      });
      this.addSystemLog(
        'Verification Approved',
        adminId,
        `Admin ID: ${adminId} | User ID: ${req.userId} | Action: Approved | Expires: ${new Date(expiresAt).toISOString()}`
      );

      if (firestoreDb) {
        setDoc(doc(firestoreDb, 'verifications', requestId), { status: 'approved' }, { merge: true }).catch(() => {});
      }

      this.addNotification({
        userId: req.userId,
        type: 'verification',
        title: 'Verification Approved 🎉',
        body: 'Your identity verification request has been approved! You now have the official verified checkmark badge.',
        senderName: 'PEWA Official'
      });
    }
  }

  static rejectVerificationRequest(requestId: string, reason?: string, adminId: string = 'admin_main'): void {
    memoryVerifications = getItem(STORAGE_KEYS.VERIFICATIONS, {});
    const req = memoryVerifications[requestId];
    if (req) {
      req.status = 'rejected';
      req.rejectionReason = reason || 'Requirements not met.';
      memoryVerifications[requestId] = req;
      setItem(STORAGE_KEYS.VERIFICATIONS, memoryVerifications);
      this.updateUserProfile(req.userId, { verified: false, verificationStatus: 'rejected' });
      this.addSystemLog(
        'Verification Rejected',
        adminId,
        `Admin ID: ${adminId} | User ID: ${req.userId} | Action: Rejected | Reason: ${reason || 'Requirements not met'} | Timestamp: ${new Date().toISOString()}`
      );

      if (firestoreDb) {
        setDoc(doc(firestoreDb, 'verifications', requestId), { status: 'rejected', rejectionReason: req.rejectionReason }, { merge: true }).catch(() => {});
      }

      this.addNotification({
        userId: req.userId,
        type: 'verification',
        title: 'Verification Request Update',
        body: `Your identity verification request was not approved. ${reason ? 'Reason: ' + reason : ''}`,
        senderName: 'PEWA Official'
      });
    }
  }

  // POST BOOST REQUESTS ENGINE
  static getPostBoostRequests(): PostBoostRequest[] {
    memoryPostBoosts = getItem(STORAGE_KEYS.POST_BOOSTS, {});
    return Object.values(memoryPostBoosts).sort((a, b) => b.createdAt - a.createdAt);
  }

  static submitPostBoostRequest(data: Omit<PostBoostRequest, 'id' | 'status' | 'createdAt'>): PostBoostRequest {
    memoryPostBoosts = getItem(STORAGE_KEYS.POST_BOOSTS, {});
    const req: PostBoostRequest = {
      ...data,
      id: 'boost_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
      status: 'pending',
      createdAt: Date.now()
    };
    memoryPostBoosts[req.id] = req;
    setItem(STORAGE_KEYS.POST_BOOSTS, memoryPostBoosts);

    if (firestoreDb) {
      setDoc(doc(firestoreDb, 'post_boosts', req.id), req, { merge: true }).catch(() => {});
    }

    return req;
  }

  static approvePostBoostRequest(requestId: string): void {
    memoryPostBoosts = getItem(STORAGE_KEYS.POST_BOOSTS, {});
    memoryPosts = getItem(STORAGE_KEYS.POSTS, {});
    const req = memoryPostBoosts[requestId];
    if (req) {
      req.status = 'approved';
      const expiresAt = Date.now() + (req.days || 1) * 24 * 60 * 60 * 1000;
      req.boostExpiresAt = expiresAt;
      memoryPostBoosts[requestId] = req;
      setItem(STORAGE_KEYS.POST_BOOSTS, memoryPostBoosts);

      // Boost target post
      if (memoryPosts[req.postId]) {
        memoryPosts[req.postId].isBoosted = true;
        memoryPosts[req.postId].boostExpiresAt = expiresAt;
        setItem(STORAGE_KEYS.POSTS, memoryPosts);

        if (firestoreDb) {
          setDoc(doc(firestoreDb, 'posts', req.postId), { isBoosted: true, boostExpiresAt: expiresAt }, { merge: true }).catch(() => {});
        }
      }

      if (firestoreDb) {
        setDoc(doc(firestoreDb, 'post_boosts', requestId), { status: 'approved', boostExpiresAt: expiresAt }, { merge: true }).catch(() => {});
      }

      this.addNotification({
        userId: req.userUid,
        type: 'broadcast',
        title: 'Post Boost Approved! 🚀',
        body: `Your post boost campaign for ${req.days} day(s) is now active and prioritized at the top of feed!`,
        senderName: 'PEWA Official'
      });
    }
  }

  static rejectPostBoostRequest(requestId: string, reason?: string): void {
    memoryPostBoosts = getItem(STORAGE_KEYS.POST_BOOSTS, {});
    const req = memoryPostBoosts[requestId];
    if (req) {
      req.status = 'rejected';
      req.rejectionReason = reason || 'Boost request declined.';
      memoryPostBoosts[requestId] = req;
      setItem(STORAGE_KEYS.POST_BOOSTS, memoryPostBoosts);

      if (firestoreDb) {
        setDoc(doc(firestoreDb, 'post_boosts', requestId), { status: 'rejected', rejectionReason: req.rejectionReason }, { merge: true }).catch(() => {});
      }

      this.addNotification({
        userId: req.userUid,
        type: 'broadcast',
        title: 'Post Boost Update',
        body: `Your post boost request was declined. ${reason ? 'Reason: ' + reason : ''}`,
        senderName: 'PEWA Official'
      });
    }
  }

  // AD REQUESTS ENGINE
  static getAdRequests(): AdRequest[] {
    memoryAdRequests = getItem(STORAGE_KEYS.AD_REQUESTS, {});
    return Object.values(memoryAdRequests).sort((a, b) => b.createdAt - a.createdAt);
  }

  static submitAdRequest(data: Omit<AdRequest, 'id' | 'status' | 'createdAt'>): AdRequest {
    memoryAdRequests = getItem(STORAGE_KEYS.AD_REQUESTS, {});
    const req: AdRequest = {
      ...data,
      id: 'ad_req_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
      status: 'pending',
      createdAt: Date.now()
    };
    memoryAdRequests[req.id] = req;
    setItem(STORAGE_KEYS.AD_REQUESTS, memoryAdRequests);

    if (firestoreDb) {
      setDoc(doc(firestoreDb, 'ad_requests', req.id), req, { merge: true }).catch(() => {});
    }

    return req;
  }

  static approveAdRequest(requestId: string): void {
    memoryAdRequests = getItem(STORAGE_KEYS.AD_REQUESTS, {});
    const req = memoryAdRequests[requestId];
    if (req) {
      req.status = 'approved';
      memoryAdRequests[requestId] = req;
      setItem(STORAGE_KEYS.AD_REQUESTS, memoryAdRequests);

      // Create active advertisement campaign
      this.saveAdvertisement({
        title: req.businessName,
        description: req.description,
        imageUrl: req.bannerUrl,
        targetUrl: 'https://pewa.zm',
        ctaText: 'Contact Business',
        enabled: true
      });

      if (firestoreDb) {
        setDoc(doc(firestoreDb, 'ad_requests', requestId), { status: 'approved' }, { merge: true }).catch(() => {});
      }

      this.addNotification({
        userId: req.userUid,
        type: 'broadcast',
        title: 'Ad Request Approved! 📢',
        body: `Your advertisement request for "${req.businessName}" has been approved and published!`,
        senderName: 'PEWA Official'
      });
    }
  }

  static rejectAdRequest(requestId: string, reason?: string): void {
    memoryAdRequests = getItem(STORAGE_KEYS.AD_REQUESTS, {});
    const req = memoryAdRequests[requestId];
    if (req) {
      req.status = 'rejected';
      req.rejectionReason = reason || 'Ad request declined.';
      memoryAdRequests[requestId] = req;
      setItem(STORAGE_KEYS.AD_REQUESTS, memoryAdRequests);

      if (firestoreDb) {
        setDoc(doc(firestoreDb, 'ad_requests', requestId), { status: 'rejected', rejectionReason: req.rejectionReason }, { merge: true }).catch(() => {});
      }

      this.addNotification({
        userId: req.userUid,
        type: 'broadcast',
        title: 'Ad Request Update',
        body: `Your advertisement request for "${req.businessName}" was declined. ${reason ? 'Reason: ' + reason : ''}`,
        senderName: 'PEWA Official'
      });
    }
  }

  // PIN RESET REQUESTS ENGINE
  static async submitPinResetRequest(data: {
    uid?: string;
    name?: string;
    registeredEmail?: string;
    registeredPhone?: string;
    deviceInfo?: string;
  }): Promise<PinResetRequest> {
    memoryPinResets = getItem(STORAGE_KEYS.PIN_RESETS, {});

    const id = 'preset_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
    const req: PinResetRequest = {
      id,
      uid: data.uid || 'unknown',
      name: data.name || 'PEWA Member',
      registeredEmail: data.registeredEmail || '',
      registeredPhone: data.registeredPhone || '',
      requestTime: Date.now(),
      status: 'Pending',
      deviceInfo: data.deviceInfo || (typeof navigator !== 'undefined' ? navigator.userAgent : 'Unknown Device')
    };

    memoryPinResets[id] = req;
    setItem(STORAGE_KEYS.PIN_RESETS, memoryPinResets);

    // Sync to Firestore
    if (firestoreDb) {
      try {
        await setDoc(doc(firestoreDb, 'pin_reset_requests', id), req, { merge: true });
        console.log('[Firestore] PIN Reset Request stored:', id);
      } catch (err) {
        console.error('[Firestore PIN Reset Error]:', err);
      }
    }

    // Notify Administrator
    this.addNotification({
      userId: 'admin_main',
      type: 'broadcast',
      title: '🔒 PIN Reset Request Received',
      body: `User ${req.name} (${req.registeredEmail || req.registeredPhone}) requested a 4-digit PIN reset.`,
      senderId: req.uid,
      senderName: req.name
    });

    this.addSystemLog('PIN Reset Requested', req.uid, `User ${req.name} requested PIN reset.`);
    return req;
  }

  static getPinResetRequests(): PinResetRequest[] {
    memoryPinResets = getItem(STORAGE_KEYS.PIN_RESETS, {});
    return Object.values(memoryPinResets).sort((a, b) => b.requestTime - a.requestTime);
  }

  static async resolvePinResetRequest(requestId: string, newPin: string, adminId: string): Promise<{ success: boolean; message?: string }> {
    if (!/^\d{4}$/.test(newPin)) {
      return { success: false, message: 'New PIN must be exactly 4 digits.' };
    }

    memoryPinResets = getItem(STORAGE_KEYS.PIN_RESETS, {});
    memoryUsers = getItem(STORAGE_KEYS.USERS, {});

    const req = memoryPinResets[requestId];
    if (!req) {
      return { success: false, message: 'PIN reset request not found.' };
    }

    // Find target user by UID, email, or phone
    let targetUser = memoryUsers[req.uid];
    if (!targetUser && req.registeredEmail) {
      targetUser = Object.values(memoryUsers).find(u => u.email?.toLowerCase() === req.registeredEmail.toLowerCase());
    }
    if (!targetUser && req.registeredPhone) {
      const norm = normalizePhone(req.registeredPhone);
      targetUser = Object.values(memoryUsers).find(u => normalizePhone(u.phone) === norm);
    }

    const secureHash = await hashPinAsync(newPin);
    const now = Date.now();

    if (targetUser) {
      targetUser.pinHash = secureHash;
      targetUser.pinUpdatedAt = now;
      memoryUsers[targetUser.uid] = targetUser;
      setItem(STORAGE_KEYS.USERS, memoryUsers);

      clearPinLockout(targetUser.uid);
      if (targetUser.phone) clearPinLockout(targetUser.phone);
      if (targetUser.email) clearPinLockout(targetUser.email);

      // Sync updated user profile to Firestore & RTDB
      await this.syncToFirestore(targetUser);
    }

    req.status = 'Resolved';
    req.resolvedAt = now;
    req.resolvedBy = adminId;
    memoryPinResets[requestId] = req;
    setItem(STORAGE_KEYS.PIN_RESETS, memoryPinResets);

    // Sync request resolution to Firestore
    if (firestoreDb) {
      try {
        await setDoc(doc(firestoreDb, 'pin_reset_requests', requestId), {
          status: 'Resolved',
          resolvedAt: now,
          resolvedBy: adminId
        }, { merge: true });
      } catch (err) {
        console.error('[Firestore PIN Reset Resolution Error]:', err);
      }
    }

    this.addSystemLog('PIN Reset Resolved', adminId, `Reset PIN for ${req.name} (${req.id})`);
    return { success: true };
  }

  static async markPinResetRequestCompleted(requestId: string, adminId: string): Promise<void> {
    memoryPinResets = getItem(STORAGE_KEYS.PIN_RESETS, {});
    const req = memoryPinResets[requestId];
    if (req) {
      const now = Date.now();
      req.status = 'Resolved';
      req.resolvedAt = now;
      req.resolvedBy = adminId;
      memoryPinResets[requestId] = req;
      setItem(STORAGE_KEYS.PIN_RESETS, memoryPinResets);

      if (firestoreDb) {
        try {
          await setDoc(doc(firestoreDb, 'pin_reset_requests', requestId), {
            status: 'Resolved',
            resolvedAt: now,
            resolvedBy: adminId
          }, { merge: true });
        } catch (err) {}
      }

      this.addSystemLog('PIN Reset Request Marked Completed', adminId, `Request ID: ${requestId}`);
    }
  }

  // REPORTS RESOLUTION
  static resolveReport(reportId: string): void {
    memoryReports = getItem(STORAGE_KEYS.REPORTS, {});
    if (memoryReports[reportId]) {
      memoryReports[reportId].status = 'resolved';
      setItem(STORAGE_KEYS.REPORTS, memoryReports);
    }
  }

  static dismissReport(reportId: string): void {
    memoryReports = getItem(STORAGE_KEYS.REPORTS, {});
    delete memoryReports[reportId];
    setItem(STORAGE_KEYS.REPORTS, memoryReports);
  }

  static submitReport(reporterId: string, reportedUserId?: string, reportedPostId?: string, reason = '', details = ''): ReportItem {
    memoryReports = getItem(STORAGE_KEYS.REPORTS, {});
    memoryUsers = getItem(STORAGE_KEYS.USERS, {});

    const reporter = (memoryUsers[reporterId] || {}) as Partial<UserProfile>;
    const report: ReportItem = {
      id: 'rep_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
      reporterId,
      reporterName: reporter.fullName || 'Anonymous User',
      reportedUserId,
      reportedPostId,
      reason,
      details,
      status: 'pending',
      createdAt: Date.now()
    };
    memoryReports[report.id] = report;
    setItem(STORAGE_KEYS.REPORTS, memoryReports);
    return report;
  }

  static getReports(): ReportItem[] {
    memoryReports = getItem(STORAGE_KEYS.REPORTS, {});
    return Object.values(memoryReports).sort((a, b) => b.createdAt - a.createdAt);
  }

  // SYSTEM LOGS
  static addSystemLog(action: string, adminId: string, details: string): SystemLog {
    memoryLogs = getItem(STORAGE_KEYS.LOGS, {});
    const log: SystemLog = {
      id: 'log_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
      action,
      adminId,
      details,
      timestamp: Date.now()
    };
    memoryLogs[log.id] = log;
    setItem(STORAGE_KEYS.LOGS, memoryLogs);
    return log;
  }

  static getSystemLogs(): SystemLog[] {
    memoryLogs = getItem(STORAGE_KEYS.LOGS, {});
    return Object.values(memoryLogs).sort((a, b) => b.timestamp - a.timestamp);
  }

  static async deleteUserAccountFirestoreData(uid: string): Promise<void> {
    if (!firestoreDb) return;
    console.log('[Firestore Account Delete] Permanently removing Firestore documents for user:', uid);

    try {
      // 1. Delete user profile document: users/{uid}
      const userRef = doc(firestoreDb, 'users', uid);
      await deleteDoc(userRef).catch((e) => console.warn('[Firestore Delete User Doc Error]:', e));

      // Delete user profile subcollections if any exist
      const subcollections = ['settings', 'preferences', 'statistics', 'notificationsData', 'chatMetadata', 'friendsData', 'savedPostsData', 'userUpdatesData'];
      for (const sub of subcollections) {
        try {
          const subDocRef = doc(firestoreDb, 'users', uid, sub, 'data');
          await deleteDoc(subDocRef).catch(() => {});
          const subDocRef2 = doc(firestoreDb, 'users', uid, sub, 'config');
          await deleteDoc(subDocRef2).catch(() => {});
          const subCollRef = collection(firestoreDb, 'users', uid, sub);
          const subSnap = await getDocs(subCollRef).catch(() => null);
          if (subSnap) {
            for (const d of subSnap.docs) {
              await deleteDoc(d.ref).catch(() => {});
            }
          }
        } catch (_) {}
      }

      // Delete top-level settings and presence docs for user
      await deleteDoc(doc(firestoreDb, 'settings', uid)).catch(() => {});
      await deleteDoc(doc(firestoreDb, 'presence', uid)).catch(() => {});

      // 2. Delete posts authored by user: posts where authorId == uid or userId == uid
      const deletePostsByQuery = async (fieldName: string) => {
        try {
          const postsQuery = query(collection(firestoreDb, 'posts'), where(fieldName, '==', uid));
          const postsSnap = await getDocs(postsQuery);
          for (const postDocItem of postsSnap.docs) {
            const postId = postDocItem.id;
            // Delete comments subcollection under posts/{postId}/comments
            try {
              const commentsSub = collection(firestoreDb, 'posts', postId, 'comments');
              const commentsSnap = await getDocs(commentsSub);
              for (const cDoc of commentsSnap.docs) {
                await deleteDoc(cDoc.ref).catch(() => {});
              }
            } catch (_) {}

            // Delete post document
            await deleteDoc(postDocItem.ref).catch(() => {});
          }
        } catch (err) {
          console.warn(`[Firestore Delete Posts by ${fieldName} Error]:`, err);
        }
      };

      await deletePostsByQuery('authorId');
      await deletePostsByQuery('userId');

      // Delete comments top-level collection where authorId == uid or userId == uid
      const deleteCommentsByQuery = async (fieldName: string) => {
        try {
          const commentsQuery = query(collection(firestoreDb, 'comments'), where(fieldName, '==', uid));
          const commentsSnap = await getDocs(commentsQuery);
          for (const cDoc of commentsSnap.docs) {
            await deleteDoc(cDoc.ref).catch(() => {});
          }
        } catch (_) {}
      };
      await deleteCommentsByQuery('authorId');
      await deleteCommentsByQuery('userId');

      // Remove user votes/reactions from remaining posts in Firestore
      try {
        const allPostsSnap = await getDocs(collection(firestoreDb, 'posts')).catch(() => null);
        if (allPostsSnap) {
          for (const postDocItem of allPostsSnap.docs) {
            const postData = postDocItem.data();
            let needsUpdate = false;
            let upVotes = Array.isArray(postData.upVotes) ? postData.upVotes : [];
            let downVotes = Array.isArray(postData.downVotes) ? postData.downVotes : [];

            if (upVotes.includes(uid)) {
              upVotes = upVotes.filter((id: string) => id !== uid);
              needsUpdate = true;
            }
            if (downVotes.includes(uid)) {
              downVotes = downVotes.filter((id: string) => id !== uid);
              needsUpdate = true;
            }

            if (needsUpdate) {
              await setDoc(postDocItem.ref, { upVotes, downVotes }, { merge: true }).catch(() => {});
            }
          }
        }
      } catch (_) {}

      // 3. Delete reports where reportedUserId == uid or reporterId == uid or userId == uid
      const deleteReportsByQuery = async (fieldName: string) => {
        try {
          const repQuery = query(collection(firestoreDb, 'reports'), where(fieldName, '==', uid));
          const repSnap = await getDocs(repQuery);
          for (const rDoc of repSnap.docs) {
            await deleteDoc(rDoc.ref).catch(() => {});
          }
        } catch (_) {}
      };
      await deleteReportsByQuery('reportedUserId');
      await deleteReportsByQuery('reporterId');
      await deleteReportsByQuery('userId');

      // 4. Delete verification requests and verifications where userId == uid
      const deleteVerificationsByQuery = async (collName: string) => {
        try {
          const vQuery = query(collection(firestoreDb, collName), where('userId', '==', uid));
          const vSnap = await getDocs(vQuery);
          for (const vDoc of vSnap.docs) {
            await deleteDoc(vDoc.ref).catch(() => {});
          }
        } catch (_) {}
      };
      await deleteVerificationsByQuery('verifications');
      await deleteVerificationsByQuery('verification_requests');

      // 5. Delete pin reset requests
      const deletePinResets = async () => {
        try {
          const prQuery = query(collection(firestoreDb, 'pin_reset_requests'), where('userId', '==', uid));
          const prSnap = await getDocs(prQuery);
          for (const prDoc of prSnap.docs) {
            await deleteDoc(prDoc.ref).catch(() => {});
          }
        } catch (_) {}
      };
      await deletePinResets();

      // 6. Delete pops, keeps, blocks involving uid
      const deleteRelationByQuery = async (collName: string, fieldNames: string[]) => {
        for (const field of fieldNames) {
          try {
            const relQuery = query(collection(firestoreDb, collName), where(field, '==', uid));
            const relSnap = await getDocs(relQuery);
            for (const rDoc of relSnap.docs) {
              await deleteDoc(rDoc.ref).catch(() => {});
            }
          } catch (_) {}
        }
      };
      await deleteRelationByQuery('pops', ['userId', 'targetUserId']);
      await deleteRelationByQuery('keeps', ['userId', 'targetUserId']);
      await deleteRelationByQuery('blocks', ['userId', 'targetUserId', 'blockerId', 'blockedId']);

      // 7. Delete notifications
      const deleteNotifications = async () => {
        for (const field of ['userId', 'recipientId', 'senderId']) {
          try {
            const nQuery = query(collection(firestoreDb, 'notifications'), where(field, '==', uid));
            const nSnap = await getDocs(nQuery);
            for (const nDoc of nSnap.docs) {
              await deleteDoc(nDoc.ref).catch(() => {});
            }
          } catch (_) {}
        }
      };
      await deleteNotifications();

      // 8. Delete / update chats & chat messages
      try {
        const chatsQuery = query(collection(firestoreDb, 'chats'), where('participants', 'array-contains', uid));
        const chatsSnap = await getDocs(chatsQuery);
        for (const chatDocItem of chatsSnap.docs) {
          const chatId = chatDocItem.id;
          const chatData = chatDocItem.data();
          let participants: string[] = Array.isArray(chatData.participants) ? chatData.participants : [];

          // If chat is 1-on-1 or only has this user remaining, delete entire chat and its messages
          if (participants.length <= 2) {
            // Delete messages subcollection
            try {
              const msgsSub = collection(firestoreDb, 'chats', chatId, 'messages');
              const msgsSnap = await getDocs(msgsSub);
              for (const mDoc of msgsSnap.docs) {
                await deleteDoc(mDoc.ref).catch(() => {});
              }
            } catch (_) {}

            // Delete top-level messages for this chat
            try {
              const topMsgsQuery = query(collection(firestoreDb, 'messages'), where('chatId', '==', chatId));
              const topMsgsSnap = await getDocs(topMsgsQuery);
              for (const tmDoc of topMsgsSnap.docs) {
                await deleteDoc(tmDoc.ref).catch(() => {});
              }
            } catch (_) {}

            // Delete chat doc
            await deleteDoc(chatDocItem.ref).catch(() => {});
          } else {
            // Group chat: remove user from participants list and participantProfiles
            const remainingParticipants = participants.filter((pId: string) => pId !== uid);
            const updatedProfiles = { ...(chatData.participantProfiles || {}) };
            delete updatedProfiles[uid];
            const updatedUnread = { ...(chatData.unreadCount || {}) };
            delete updatedUnread[uid];
            const updatedMuted = { ...(chatData.muted || {}) };
            delete updatedMuted[uid];
            const updatedArchived = { ...(chatData.archived || {}) };
            delete updatedArchived[uid];

            await setDoc(chatDocItem.ref, {
              participants: remainingParticipants,
              participantProfiles: updatedProfiles,
              unreadCount: updatedUnread,
              muted: updatedMuted,
              archived: updatedArchived,
              updatedAt: Date.now()
            }, { merge: true }).catch(() => {});
          }
        }
      } catch (chatErr) {
        console.warn('[Firestore Delete Chats Error]:', chatErr);
      }

      console.log('[Firestore Account Delete] Successfully deleted all Firestore records for user:', uid);
    } catch (err) {
      console.error('[Firestore Account Delete Exception]:', err);
    }
  }

  static async deleteUserAccountRealtimeData(uid: string): Promise<void> {
    console.log("[RTDB Delete Account] Wiping Realtime Database user data:", uid);
    if (!rtdb) {
      return;
    }
    try {
      await remove(ref(rtdb, `users/${uid}`)).catch(() => {});
      await remove(ref(rtdb, `settings/${uid}`)).catch(() => {});
      await remove(ref(rtdb, `presence/${uid}`)).catch(() => {});
      await remove(ref(rtdb, `notifications/${uid}`)).catch(() => {});
      await remove(ref(rtdb, `deletedChats/${uid}`)).catch(() => {});
      await remove(ref(rtdb, `verification_requests/${uid}`)).catch(() => {});
      await remove(ref(rtdb, `pin_reset_requests/${uid}`)).catch(() => {});

      if (memoryPosts) {
        for (const postId of Object.keys(memoryPosts)) {
          if (memoryPosts[postId]?.authorId === uid || (memoryPosts[postId] as any)?.userId === uid) {
            await remove(ref(rtdb, `posts/${postId}`)).catch(() => {});
          }
        }
      }

      if (memoryComments) {
        for (const postId of Object.keys(memoryComments)) {
          const postComments = memoryComments[postId] || [];
          for (const comment of postComments) {
            if (comment.authorId === uid || (comment as any).userId === uid) {
              await remove(ref(rtdb, `comments/${comment.id}`)).catch(() => {});
              await remove(ref(rtdb, `posts/${postId}/comments/${comment.id}`)).catch(() => {});
            }
          }
        }
      }

      if (memoryChats) {
        for (const chatId of Object.keys(memoryChats)) {
          const chat = memoryChats[chatId];
          if (chat) {
            let participants: string[] = Array.isArray(chat.participants)
              ? chat.participants
              : (typeof chat.participants === 'object' && chat.participants ? Object.keys(chat.participants) : []);
            if (participants.includes(uid) || chatId.includes(uid)) {
              if (participants.length <= 2 || chatId.includes(uid)) {
                await remove(ref(rtdb, `chats/${chatId}`)).catch(() => {});
                await remove(ref(rtdb, `messages/${chatId}`)).catch(() => {});
              }
            }
          }
        }
      }

      if (memoryMessages) {
        for (const chatId of Object.keys(memoryMessages)) {
          const msgs = memoryMessages[chatId] || [];
          for (const msg of msgs) {
            if (msg.senderId === uid) {
              await remove(ref(rtdb, `messages/${msg.id}`)).catch(() => {});
              await remove(ref(rtdb, `chats/${chatId}/messages/${msg.id}`)).catch(() => {});
            }
          }
        }
      }

      if (memoryNotifications && memoryNotifications[uid]) {
        for (const notif of memoryNotifications[uid]) {
          await remove(ref(rtdb, `notifications/${notif.id}`)).catch(() => {});
        }
      }

      if (memoryVerifications) {
        for (const reqId of Object.keys(memoryVerifications)) {
          if (memoryVerifications[reqId]?.userId === uid) {
            await remove(ref(rtdb, `verification_requests/${reqId}`)).catch(() => {});
          }
        }
      }
      console.log(`[RTDB Delete Account] Realtime Database data cleared for user ${uid}`);
    } catch (err) {
      console.warn('[RTDB Delete Account Note]:', err);
    }
  }

  static async deleteUserAccountCompletelyAsync(uid: string): Promise<void> {
    console.log('[Delete Account Engine] Triggering complete user purge for UID:', uid);

    // 1. Delete user from Firebase Auth via server endpoint
    try {
      await fetch('/api/admin/delete-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid })
      });
      console.log('[Delete Account Engine] Firebase Auth deletion API call sent for UID:', uid);
    } catch (e) {
      console.warn('[Delete Account Engine] Firebase Auth API call warning:', e);
    }

    // 2. Wipe Firestore data
    await this.deleteUserAccountFirestoreData(uid).catch((err) => {
      console.warn('[Firestore Async Account Delete Note]:', err);
    });

    // 3. Wipe Realtime Database data
    await this.deleteUserAccountRealtimeData(uid).catch((err) => {
      console.warn('[RTDB Async Account Delete Note]:', err);
    });

    // 4. Delete user from in-memory stores and local storage caches
    memoryUsers = getItem(STORAGE_KEYS.USERS, {});
    delete memoryUsers[uid];
    setItem(STORAGE_KEYS.USERS, memoryUsers);

    memoryPresence = getItem(STORAGE_KEYS.PRESENCE, {});
    delete memoryPresence[uid];
    setItem(STORAGE_KEYS.PRESENCE, memoryPresence);

    memoryNotifications = getItem(STORAGE_KEYS.NOTIFICATIONS, {});
    delete memoryNotifications[uid];
    setItem(STORAGE_KEYS.NOTIFICATIONS, memoryNotifications);

    delete memoryCalls[uid];

    memoryChats = getItem(STORAGE_KEYS.CHATS, {});
    memoryMessages = getItem(STORAGE_KEYS.MESSAGES, {});
    Object.keys(memoryChats).forEach((chatId) => {
      const chat = memoryChats[chatId];
      if (chat) {
        const participants = Array.isArray(chat.participants)
          ? chat.participants
          : (typeof chat.participants === 'object' && chat.participants ? Object.keys(chat.participants) : []);
        if (participants.includes(uid) || chatId.includes(uid)) {
          if (participants.length <= 2 || chatId.includes(uid)) {
            delete memoryChats[chatId];
            delete memoryMessages[chatId];
          } else {
            chat.participants = participants.filter((p) => p !== uid);
            if (chat.participantProfiles) delete chat.participantProfiles[uid];
            if (chat.unreadCount) delete chat.unreadCount[uid];
            if (chat.muted) delete chat.muted[uid];
            if (chat.archived) delete chat.archived[uid];
          }
        }
      }
    });
    setItem(STORAGE_KEYS.CHATS, memoryChats);
    setItem(STORAGE_KEYS.MESSAGES, memoryMessages);

    memoryPosts = getItem(STORAGE_KEYS.POSTS, {});
    memoryComments = getItem(STORAGE_KEYS.COMMENTS, {});
    Object.keys(memoryPosts).forEach((postId) => {
      if (memoryPosts[postId]?.authorId === uid || (memoryPosts[postId] as any)?.userId === uid) {
        delete memoryPosts[postId];
        delete memoryComments[postId];
      }
    });

    Object.values(memoryPosts).forEach((post) => {
      if (post && Array.isArray(post.upVotes)) post.upVotes = post.upVotes.filter((id) => id !== uid);
      if (post && Array.isArray(post.downVotes)) post.downVotes = post.downVotes.filter((id) => id !== uid);
    });
    setItem(STORAGE_KEYS.POSTS, memoryPosts);
    setItem(STORAGE_KEYS.COMMENTS, memoryComments);

    memoryVerifications = getItem(STORAGE_KEYS.VERIFICATIONS, {});
    Object.keys(memoryVerifications).forEach((reqId) => {
      if (memoryVerifications[reqId]?.userId === uid) {
        delete memoryVerifications[reqId];
      }
    });
    setItem(STORAGE_KEYS.VERIFICATIONS, memoryVerifications);

    memoryReports = getItem(STORAGE_KEYS.REPORTS, {});
    Object.keys(memoryReports).forEach((reportId) => {
      if (memoryReports[reportId]?.reportedUserId === uid || memoryReports[reportId]?.reporterId === uid) {
        delete memoryReports[reportId];
      }
    });
    setItem(STORAGE_KEYS.REPORTS, memoryReports);

    this.addSystemLog('User Account Deleted', 'admin_main', `Permanently purged user account and all Firebase records for UID: ${uid}`);
    console.log('[Delete Account Engine] Complete purge finished for UID:', uid);
  }

  static deleteUserAccountCompletely(uid: string): void {
    this.deleteUserAccountCompletelyAsync(uid).catch((err) => {
      console.warn('[Delete Account Engine Sync Wrapper Error]:', err);
    });
  }

  static isSuperAdminPhone(phoneStr: string): boolean {
    return isSuperAdminPhone(phoneStr);
  }
}

// Automatically initialize cloud sync listeners on module load
try {
  PEWADatabaseService.initCloudSync();
  if (typeof window !== 'undefined') {
    (window as any).verifyChatsFirebasePopulation = PEWADatabaseService.verifyChatsFirebasePopulation.bind(PEWADatabaseService);
  }
} catch (e) {
  console.warn('[Cloud Sync Auto-Init Note]', e);
}
