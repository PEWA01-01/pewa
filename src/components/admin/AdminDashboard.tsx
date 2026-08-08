import React, { useState, useEffect, useRef } from 'react';
import { ref, onValue } from 'firebase/database';
import { rtdb } from '../../firebase';
import {
  ShieldAlert, Users, Radio, MessageSquare, FileText, CheckCircle2, Ban, ShieldCheck, RefreshCw, AlertTriangle, Send, Search, TrendingUp,
  Megaphone, BadgeCheck, Trash2, Eye, EyeOff, Star, UserX, Plus, Check, X, Clock, ExternalLink, Activity, Filter, Lock, Unlock, FileCheck, Crown, KeyRound, AlertCircle,
  Camera, Upload, Image, Palette, Bell, HelpCircle, Move, Edit3, LogOut
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { PEWADatabaseService } from '../../services/db';
import { UserProfile, AdminStats, ReportItem, Post, Advertisement, VerificationRequest, SystemLog, PinResetRequest } from '../../types';
import { ChatRoom } from '../chat/ChatRoom';
import { ImageCropModal } from './ImageCropModal';

export const AdminDashboard: React.FC = () => {
  const { currentUser, isAdminLoggedIn, isSuperAdmin, logout, refreshCurrentUser } = useAuth();
  const [adminSubTab, setAdminSubTab] = useState<'dashboard' | 'pin_resets' | 'users' | 'posts' | 'chats' | 'ads' | 'verifications' | 'reports' | 'logs' | 'sugars' | 'settings'>('dashboard');
  const [chatTab, setChatTab] = useState<'global' | 'individual'>('global');
  const [selectedIndividualUser, setSelectedIndividualUser] = useState<UserProfile | null>(null);
  const [individualChatSearch, setIndividualChatSearch] = useState('');

  const [stats, setStats] = useState<AdminStats | null>(null);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [ads, setAds] = useState<Advertisement[]>([]);
  const [verifications, setVerifications] = useState<VerificationRequest[]>([]);
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [logs, setLogs] = useState<SystemLog[]>([]);
  const [pinResets, setPinResets] = useState<PinResetRequest[]>([]);

  // Reset PIN modal state
  const [resetModalReq, setResetModalReq] = useState<PinResetRequest | null>(null);
  const [newPinInput, setNewPinInput] = useState('1234');
  const [isSubmittingReset, setIsSubmittingReset] = useState(false);
  const [resetModalMsg, setResetModalMsg] = useState('');

  // Admin Settings Form State
  const [adminNameForm, setAdminNameForm] = useState('PEWA Official');
  const [adminEmailForm, setAdminEmailForm] = useState(() => PEWADatabaseService.getAdminConfig().email);
  const [adminPinForm, setAdminPinForm] = useState(() => PEWADatabaseService.getAdminConfig().pin);
  const [adminAvatarForm, setAdminAvatarForm] = useState('https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=400&auto=format&fit=crop');
  const [adminBioForm, setAdminBioForm] = useState('Official PEWA Administration Account');
  const [onesignalAppIdForm, setOnesignalAppIdForm] = useState('');
  const [onesignalRestApiKeyForm, setOnesignalRestApiKeyForm] = useState('');
  const [appLogoUrlForm, setAppLogoUrlForm] = useState('');
  const [appThemeColorForm, setAppThemeColorForm] = useState('amber');
  const [adminSettingsMsg, setAdminSettingsMsg] = useState('');

  // Image Cropper & File Input States
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [cropModalOpen, setCropModalOpen] = useState(false);
  const [cropImageSrc, setCropImageSrc] = useState<string | null>(null);

  // System Configuration Form State
  const [sysConfig, setSysConfigState] = useState(() => PEWADatabaseService.getSystemConfig());
  const [supportWhatsappInput, setSupportWhatsappInput] = useState(sysConfig.supportWhatsappNumber || '+260961968962');
  const [supportEmailInput, setSupportEmailInput] = useState(sysConfig.supportEmail || 'support@pewa.zm');
  const [maintenanceModeToggle, setMaintenanceModeToggle] = useState(sysConfig.maintenanceMode || false);
  const [termsInput, setTermsInput] = useState(sysConfig.termsAndConditions || '');
  const [privacyInput, setPrivacyInput] = useState(sysConfig.privacyPolicy || '');
  const [guidelinesInput, setGuidelinesInput] = useState(sysConfig.communityGuidelines || '');

  // User Filter State
  const [userSearch, setUserSearch] = useState('');
  const [userStatusFilter, setUserStatusFilter] = useState<'all' | 'verified' | 'suspended' | 'banned' | 'disabled'>('all');
  const [selectedUserDetail, setSelectedUserDetail] = useState<UserProfile | null>(null);

  // Ad Form State
  const [showAdModal, setShowAdModal] = useState(false);
  const [adForm, setAdForm] = useState<{ id?: string; title: string; description: string; imageUrl: string; targetUrl: string; ctaText: string; enabled: boolean }>({
    title: '',
    description: '',
    imageUrl: '',
    targetUrl: '',
    ctaText: 'Learn More',
    enabled: true
  });

  // Ban Modal State
  const [showBanModal, setShowBanModal] = useState<string | null>(null);
  const [banDuration, setBanDuration] = useState<number>(0); // 0 = permanent, 30 = 30 days

  // Edit Post State for Administrator
  const [editingPost, setEditingPost] = useState<Post | null>(null);
  const [editPostContent, setEditPostContent] = useState('');
  const [editPostMediaUrl, setEditPostMediaUrl] = useState('');

  useEffect(() => {
    loadAdminData();

    if (rtdb) {
      try {
        const usersUnsub = onValue(ref(rtdb, 'users'), (snapshot) => {
          const val = snapshot.val();
          if (val && typeof val === 'object') {
            const list = Object.keys(val).map((uid) => PEWADatabaseService.mapFirestoreDocToUserProfile(val[uid], uid));
            setUsers(list.filter((u) => u.role !== 'superadmin'));
            setStats(PEWADatabaseService.getAdminStats());
          }
        });

        const postsUnsub = onValue(ref(rtdb, 'posts'), (snapshot) => {
          const val = snapshot.val();
          if (val && typeof val === 'object') {
            setPosts(Object.values(val));
          }
        });

        const verifUnsub = onValue(ref(rtdb, 'verification_requests'), (snapshot) => {
          const val = snapshot.val();
          if (val && typeof val === 'object') {
            setVerifications(Object.values(val));
          }
        });

        return () => {
          usersUnsub();
          postsUnsub();
          verifUnsub();
        };
      } catch (err) {
        console.warn('[AdminDashboard RTDB listener warning]', err);
      }
    }
  }, [currentUser]);

  const loadAdminData = async () => {
    setStats(PEWADatabaseService.getAdminStats());
    setUsers(PEWADatabaseService.getAllUsers(false));
    setPosts(PEWADatabaseService.getPosts(true));
    setAds(PEWADatabaseService.getAdvertisements());
    setVerifications(PEWADatabaseService.getVerificationRequests());
    setReports(PEWADatabaseService.getReports());
    setLogs(PEWADatabaseService.getSystemLogs());
    setPinResets(PEWADatabaseService.getPinResetRequests());

    try {
      const adminDoc = await PEWADatabaseService.getAdminProfileDocumentAsync();
      if (adminDoc) {
        setAdminNameForm(adminDoc.fullName || 'PEWA Official');
        setAdminEmailForm(adminDoc.email || 'mikelbishonga@gmail.com');
        setAdminAvatarForm(adminDoc.avatar || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=400&auto=format&fit=crop');
        setAdminBioForm(adminDoc.bio || 'Official PEWA Administration Account');
        setOnesignalAppIdForm(adminDoc.onesignalAppId || '');
        setOnesignalRestApiKeyForm(adminDoc.onesignalRestApiKey || '');
        setAppLogoUrlForm(adminDoc.appLogoUrl || '');
        setAppThemeColorForm(adminDoc.appThemeColor || 'amber');
        if (adminDoc.supportWhatsappNumber) setSupportWhatsappInput(adminDoc.supportWhatsappNumber);
        if (adminDoc.supportEmail) setSupportEmailInput(adminDoc.supportEmail);
      }
    } catch (_) {}
  };

  const handleImageFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (reader.result) {
        setCropImageSrc(reader.result as string);
        setCropModalOpen(true);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleCropComplete = (croppedUrl: string) => {
    setAdminAvatarForm(croppedUrl);
    setAdminSettingsMsg('Image cropped and ready. Click "Save Administrator Profile" below to persist.');
  };

  const handleRemoveImage = () => {
    const defaultAvatar = 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=400&auto=format&fit=crop';
    setAdminAvatarForm(defaultAvatar);
    setAdminSettingsMsg('Profile picture reset to default official avatar. Click "Save Administrator Profile" to save.');
  };

  if (!isSuperAdmin) {
    return (
      <div className="p-12 text-center text-rose-400 font-bold bg-[#121216]/90 border border-rose-500/30 rounded-3xl my-8 max-w-md mx-auto shadow-2xl">
        <ShieldAlert className="w-12 h-12 text-rose-500 mx-auto mb-3" />
        <h3 className="text-xl font-black text-rose-300">Access Denied</h3>
        <p className="text-xs text-slate-400 mt-2">
          Administrator privileges are required to access this system. Normal accounts are strictly prohibited.
        </p>
      </div>
    );
  }

  // User Actions
  const currentAdminId = currentUser?.uid || 'admin_main';

  const handleToggleVerify = (uid: string, currentStatus: boolean) => {
    PEWADatabaseService.setVerificationStatus(uid, !currentStatus, currentAdminId);
    loadAdminData();
  };

  const handleToggleSuspend = (uid: string, currentStatus: boolean) => {
    PEWADatabaseService.setUserSuspended(uid, !currentStatus);
    loadAdminData();
  };

  const handleToggleDisable = (uid: string, currentStatus: boolean) => {
    PEWADatabaseService.setUserDisabled(uid, !currentStatus);
    loadAdminData();
  };

  const handleExecuteBan = (uid: string) => {
    PEWADatabaseService.setUserBanned(uid, true, banDuration > 0 ? banDuration : undefined);
    setShowBanModal(null);
    loadAdminData();
  };

  const handleUnbanUser = (uid: string) => {
    PEWADatabaseService.setUserBanned(uid, false);
    loadAdminData();
  };

  const handleDeleteUserCompletely = async (uid: string, userName: string) => {
    if (confirm(`CRITICAL WARNING: Are you sure you want to PERMANENTLY delete user "${userName}"? This action is completely irreversible and wipes all Firebase Auth, Firestore profiles, posts, comments, chats, and records.`)) {
      try {
        await PEWADatabaseService.deleteUserAccountCompletelyAsync(uid);
        alert(`✅ User "${userName}" has been permanently purged from Firebase and all system records.`);
      } catch (err) {
        console.error('[Admin User Delete Error]:', err);
        alert(`⚠️ User deletion completed with warnings. Please verify Firebase console if needed.`);
      }
      if (selectedUserDetail?.uid === uid) setSelectedUserDetail(null);
      loadAdminData();
    }
  };

  const handleBlockCatfish = (uid: string, userName: string) => {
    const reason = prompt(
      `Enter catfish ban reason for (${userName}):`,
      'Confirmed catfish account / heavy artificial filters / duplicate stolen photos'
    );
    if (!reason) return;

    PEWADatabaseService.permanentlyBlockCatfishAccount(uid, reason, currentAdminId);
    alert(`✅ Account "${userName}" has been permanently blocked. Email, phone number, and UID added to anti-catfish ban list.`);
    if (selectedUserDetail?.uid === uid) setSelectedUserDetail(null);
    loadAdminData();
  };

  // Posts Actions
  const handleToggleHidePost = (postId: string) => {
    PEWADatabaseService.togglePostHidden(postId);
    loadAdminData();
  };

  const handleToggleFeaturePost = (postId: string) => {
    PEWADatabaseService.togglePostFeatured(postId);
    loadAdminData();
  };

  const handleDeletePostAdmin = (postId: string) => {
    if (confirm('Delete post as Administrator?')) {
      PEWADatabaseService.deletePost(postId);
      loadAdminData();
    }
  };

  // Ads Actions
  const handleSaveAd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!adForm.title.trim() || !adForm.imageUrl.trim()) return;

    PEWADatabaseService.saveAdvertisement(adForm);
    setShowAdModal(false);
    setAdForm({ title: '', description: '', imageUrl: '', targetUrl: '', ctaText: 'Learn More', enabled: true });
    loadAdminData();
  };

  const handleToggleAd = (id: string) => {
    PEWADatabaseService.toggleAdvertisementEnabled(id);
    loadAdminData();
  };

  const handleDeleteAd = (id: string) => {
    if (confirm('Delete this advertisement campaign?')) {
      PEWADatabaseService.deleteAdvertisement(id);
      loadAdminData();
    }
  };

  // Verification Requests
  const handleApproveVerification = (reqId: string) => {
    PEWADatabaseService.approveVerificationRequest(reqId, currentAdminId);
    loadAdminData();
  };

  const handleRejectVerification = (reqId: string) => {
    PEWADatabaseService.rejectVerificationRequest(reqId, undefined, currentAdminId);
    loadAdminData();
  };

  // Reports Actions
  const handleResolveReport = (reportId: string) => {
    PEWADatabaseService.resolveReport(reportId);
    loadAdminData();
  };

  const handleDismissReport = (reportId: string) => {
    PEWADatabaseService.dismissReport(reportId);
    loadAdminData();
  };

  // Sugar Profile Actions
  const handleApproveSugar = (userId: string) => {
    PEWADatabaseService.approveSugarProfile(userId);
    alert('Sugar Profile approved and Golden Verification Badge granted!');
    loadAdminData();
  };

  const handleRejectSugar = (userId: string) => {
    PEWADatabaseService.rejectSugarProfile(userId);
    loadAdminData();
  };

  const handleSuspendSugar = (userId: string) => {
    PEWADatabaseService.suspendSugarProfile(userId);
    loadAdminData();
  };

  const handleSaveFullAdminProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdminSettingsMsg('');

    if (!adminEmailForm || !adminEmailForm.includes('@')) {
      setAdminSettingsMsg('Please enter a valid administrator email address.');
      return;
    }
    if (!adminPinForm || adminPinForm.trim().length < 4) {
      setAdminSettingsMsg('Administrator Security PIN must be at least 4 characters long.');
      return;
    }

    try {
      await PEWADatabaseService.updateAdminFullProfile({
        fullName: adminNameForm,
        avatar: adminAvatarForm,
        email: adminEmailForm,
        bio: adminBioForm,
        supportWhatsappNumber: supportWhatsappInput,
        supportEmail: supportEmailInput,
        onesignalAppId: onesignalAppIdForm,
        onesignalRestApiKey: onesignalRestApiKeyForm,
        appLogoUrl: appLogoUrlForm,
        appThemeColor: appThemeColorForm,
        pin: adminPinForm
      });

      await PEWADatabaseService.updateSystemConfig({
        supportWhatsappNumber: supportWhatsappInput.trim(),
        supportEmail: supportEmailInput.trim(),
        maintenanceMode: maintenanceModeToggle,
        termsAndConditions: termsInput,
        privacyPolicy: privacyInput,
        communityGuidelines: guidelinesInput
      });

      setAdminSettingsMsg('✅ Administrator profile, profile picture, credentials, support contacts, and system configuration updated live across PEWA!');
      await loadAdminData();
      if (refreshCurrentUser) refreshCurrentUser();
    } catch (err: any) {
      setAdminSettingsMsg(`❌ Error updating administrator settings: ${err.message}`);
    }
  };

  const handleSaveSystemSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdminSettingsMsg('');
    try {
      const updated = await PEWADatabaseService.updateSystemConfig({
        supportWhatsappNumber: supportWhatsappInput.trim(),
        supportEmail: supportEmailInput.trim(),
        maintenanceMode: maintenanceModeToggle,
        termsAndConditions: termsInput,
        privacyPolicy: privacyInput,
        communityGuidelines: guidelinesInput
      });
      setSysConfigState(updated);
      setAdminSettingsMsg('✅ System configuration & support WhatsApp number updated live in database!');
    } catch (err: any) {
      setAdminSettingsMsg(`❌ Error updating system config: ${err.message}`);
    }
  };

  // PIN Reset Actions
  const handleExecutePinReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetModalReq) return;
    if (newPinInput.length !== 4 || !/^\d{4}$/.test(newPinInput)) {
      setResetModalMsg('PIN must be exactly 4 digits.');
      return;
    }

    setIsSubmittingReset(true);
    setResetModalMsg('');

    try {
      const adminUid = currentUser?.uid || 'admin_main';
      const res = await PEWADatabaseService.resolvePinResetRequest(resetModalReq.id, newPinInput, adminUid);
      if (res.success) {
        alert(`✅ PIN successfully reset for user ${resetModalReq.name}! New PIN is active and lockouts cleared.`);
        setResetModalReq(null);
        setNewPinInput('1234');
        loadAdminData();
      } else {
        setResetModalMsg(res.message || 'Failed to reset PIN.');
      }
    } catch (err: any) {
      setResetModalMsg(err.message || 'Error resolving PIN reset request.');
    } finally {
      setIsSubmittingReset(false);
    }
  };

  const handleMarkPinResetCompleted = async (reqId: string) => {
    try {
      const adminUid = currentUser?.uid || 'admin_main';
      await PEWADatabaseService.markPinResetRequestCompleted(reqId, adminUid);
      loadAdminData();
    } catch (err: any) {
      alert(`Error updating request: ${err.message}`);
    }
  };

  const sugarApplications = users.filter((u) => u.sugarProfile && u.sugarProfile.active);
  const pendingSugarApplications = sugarApplications.filter((u) => u.sugarProfile?.status === 'pending');

  // User Filtering Logic
  const filteredUsers = users.filter((u) => {
    const matchesSearch =
      u.fullName.toLowerCase().includes(userSearch.toLowerCase()) ||
      u.phone.includes(userSearch) ||
      (u.email && u.email.toLowerCase().includes(userSearch.toLowerCase())) ||
      u.city.toLowerCase().includes(userSearch.toLowerCase());

    if (!matchesSearch) return false;

    if (userStatusFilter === 'verified') return u.verified;
    if (userStatusFilter === 'suspended') return u.suspended;
    if (userStatusFilter === 'banned') return u.banned;
    if (userStatusFilter === 'disabled') return u.disabled;
    return true;
  });

  return (
    <div className="pb-28 pt-3 px-3 max-w-md mx-auto sm:max-w-5xl animate-fadeIn space-y-4 text-white">
      {/* Admin Identity Highlight Card */}
      <div className="bg-gradient-to-r from-[#1c1505] via-[#121218] to-[#0c0d12] border border-amber-500/40 rounded-3xl p-5 shadow-2xl backdrop-blur-xl relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/10 rounded-full filter blur-3xl pointer-events-none -mr-10 -mt-10"></div>
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 relative z-10">
          <div className="flex items-center gap-4 text-center sm:text-left">
            <div className="relative shrink-0">
              <img
                src={adminAvatarForm || currentUser?.avatar || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=400&auto=format&fit=crop'}
                alt="Administrator Profile"
                className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl object-cover border-2 border-amber-500/80 shadow-2xl shadow-amber-500/30"
              />
              <div className="absolute -bottom-1 -right-1 bg-amber-500 text-slate-950 p-1 rounded-full shadow-lg">
                <ShieldCheck className="w-4 h-4" />
              </div>
            </div>
            <div>
              <div className="flex items-center justify-center sm:justify-start gap-2 flex-wrap">
                <h2 className="text-lg sm:text-xl font-black text-amber-300">{adminNameForm || 'PEWA Official'}</h2>
                <span className="bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"></span>
                  LIVE GOVERNANCE
                </span>
              </div>
              <p className="text-xs text-amber-200/80 font-medium mt-1">
                Admin Account • <span className="font-mono text-amber-300">{adminEmailForm || 'mikelbishonga@gmail.com'}</span>
              </p>
              <p className="text-[11px] text-slate-400 mt-1 max-w-md line-clamp-1">
                {adminBioForm || 'Official PEWA Administration Account'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={loadAdminData}
              className="px-3.5 py-2.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-2xl transition-all flex items-center gap-2 text-xs font-bold active:scale-95"
              title="Refresh / Sync System Data"
            >
              <RefreshCw className="w-4 h-4 text-amber-400" />
              <span>Refresh Sync</span>
            </button>
            <button
              onClick={logout}
              className="px-3.5 py-2.5 bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 rounded-2xl transition-all flex items-center gap-2 text-xs font-bold active:scale-95"
              title="Logout Admin Session"
            >
              <LogOut className="w-4 h-4 text-rose-400" />
              <span>Logout</span>
            </button>
          </div>
        </div>
      </div>

      {/* Quick Navigation Grid */}
      <div className="bg-[#121217]/90 p-2 rounded-3xl border border-white/10 backdrop-blur-xl shadow-2xl">
        <div className="grid grid-cols-4 sm:grid-cols-11 gap-1.5 text-[10px] font-extrabold text-center">
          {[
            { id: 'dashboard', label: 'Overview', icon: TrendingUp },
            { id: 'pin_resets', label: 'PIN Resets', icon: KeyRound, badge: pinResets.filter((r) => r.status === 'Pending').length },
            { id: 'sugars', label: 'Sugars', icon: Crown, badge: pendingSugarApplications.length },
            { id: 'users', label: 'Users', icon: Users, badge: users.length },
            { id: 'posts', label: 'Posts', icon: FileText, badge: posts.length },
            { id: 'chats', label: 'Chats', icon: MessageSquare },
            { id: 'ads', label: 'Ads', icon: Radio, badge: ads.length },
            { id: 'verifications', label: 'Verify', icon: BadgeCheck, badge: verifications.filter((v) => v.status === 'pending').length },
            { id: 'reports', label: 'Reports', icon: AlertTriangle, badge: reports.filter((r) => r.status === 'pending').length },
            { id: 'logs', label: 'Logs', icon: Activity },
            { id: 'settings', label: 'Settings', icon: Lock }
          ].map((t) => {
            const IconComponent = t.icon;
            const isActive = adminSubTab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setAdminSubTab(t.id as any)}
                className={`py-2.5 px-1 rounded-2xl flex flex-col items-center gap-1 transition-all relative ${
                  isActive
                    ? 'bg-gradient-to-r from-amber-500 via-amber-600 to-orange-600 text-slate-950 shadow-lg shadow-amber-500/30 font-black scale-[1.02]'
                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <IconComponent className="w-4 h-4 shrink-0" />
                <span className="truncate w-full text-[10px]">{t.label}</span>
                {t.badge !== undefined && t.badge > 0 && (
                  <span className={`absolute -top-1 -right-1 px-1.5 py-0.5 text-[9px] rounded-full font-mono font-bold ${
                    isActive ? 'bg-slate-950 text-amber-400' : 'bg-rose-500 text-white shadow-md'
                  }`}>
                    {t.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* MODULE 1: OVERVIEW DASHBOARD */}
      {adminSubTab === 'dashboard' && stats && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-4 bg-[#121217]/90 border border-white/10 hover:border-amber-500/40 rounded-2xl backdrop-blur-xl shadow-xl transition-all">
              <div className="flex items-center justify-between text-slate-400 mb-1">
                <span className="text-[11px] font-bold">Total Accounts</span>
                <Users className="w-4 h-4 text-amber-400" />
              </div>
              <span className="text-2xl font-black text-amber-400 block">{stats.totalUsers}</span>
            </div>

            <div className="p-4 bg-[#121217]/90 border border-white/10 hover:border-emerald-500/40 rounded-2xl backdrop-blur-xl shadow-xl transition-all">
              <div className="flex items-center justify-between text-slate-400 mb-1">
                <span className="text-[11px] font-bold">Active Users</span>
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              </div>
              <span className="text-2xl font-black text-emerald-400 block">{stats.activeUsers}</span>
            </div>

            <div className="p-4 bg-[#121217]/90 border border-white/10 hover:border-pink-500/40 rounded-2xl backdrop-blur-xl shadow-xl transition-all">
              <div className="flex items-center justify-between text-slate-400 mb-1">
                <span className="text-[11px] font-bold">Verified Users</span>
                <ShieldCheck className="w-4 h-4 text-pink-400" />
              </div>
              <span className="text-2xl font-black text-pink-400 block">{stats.verifiedUsers}</span>
            </div>

            <div className="p-4 bg-[#121217]/90 border border-white/10 hover:border-rose-500/40 rounded-2xl backdrop-blur-xl shadow-xl transition-all">
              <div className="flex items-center justify-between text-slate-400 mb-1">
                <span className="text-[11px] font-bold">Restricted Accounts</span>
                <Ban className="w-4 h-4 text-rose-400" />
              </div>
              <span className="text-2xl font-black text-rose-400 block">
                {stats.bannedUsers + stats.suspendedUsers + stats.disabledUsers}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-4 bg-[#121217]/90 border border-white/10 hover:border-teal-500/40 rounded-2xl backdrop-blur-xl shadow-xl transition-all">
              <div className="flex items-center justify-between text-slate-400 mb-1">
                <span className="text-[11px] font-bold">Pending Verification</span>
                <BadgeCheck className="w-4 h-4 text-teal-400" />
              </div>
              <span className="text-2xl font-black text-teal-400 block">{stats.pendingVerificationsCount}</span>
            </div>

            <div className="p-4 bg-[#121217]/90 border border-white/10 hover:border-orange-500/40 rounded-2xl backdrop-blur-xl shadow-xl transition-all">
              <div className="flex items-center justify-between text-slate-400 mb-1">
                <span className="text-[11px] font-bold">Pending Reports</span>
                <AlertTriangle className="w-4 h-4 text-orange-400" />
              </div>
              <span className="text-2xl font-black text-orange-400 block">{stats.totalReports}</span>
            </div>

            <div className="p-4 bg-[#121217]/90 border border-white/10 hover:border-indigo-500/40 rounded-2xl backdrop-blur-xl shadow-xl transition-all">
              <div className="flex items-center justify-between text-slate-400 mb-1">
                <span className="text-[11px] font-bold">Advertisements</span>
                <Radio className="w-4 h-4 text-indigo-400" />
              </div>
              <span className="text-2xl font-black text-indigo-400 block">{stats.adsCount}</span>
            </div>

            <div className="p-4 bg-[#121217]/90 border border-white/10 hover:border-amber-500/40 rounded-2xl backdrop-blur-xl shadow-xl transition-all">
              <div className="flex items-center justify-between text-slate-400 mb-1">
                <span className="text-[11px] font-bold font-mono">PIN Resets</span>
                <KeyRound className="w-4 h-4 text-amber-300" />
              </div>
              <span className="text-2xl font-black text-amber-300 block">
                {pinResets.filter((r) => r.status === 'Pending').length}
              </span>
            </div>
          </div>

          <div className="p-5 bg-[#121216]/90 border border-white/10 rounded-3xl space-y-3 text-xs backdrop-blur-xl shadow-xl">
            <h4 className="font-extrabold text-amber-300 text-sm flex items-center gap-2">
              <Activity className="w-4 h-4 text-amber-400" /> System Health & Demographics Breakdown
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 border-t border-white/10 pt-3">
              <div className="flex justify-between py-1 border-b border-white/5">
                <span className="text-slate-400">Sugar Babies (20-34 Male)</span>
                <span className="font-bold text-pink-400">{stats.sugarBabies}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-white/5">
                <span className="text-slate-400">Sugar Mamas (45-65 Female)</span>
                <span className="font-bold text-red-400">{stats.sugarMamas}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-white/5">
                <span className="text-slate-400">Suspended Users</span>
                <span className="font-bold text-amber-400">{stats.suspendedUsers}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-white/5">
                <span className="text-slate-400">Banned Accounts</span>
                <span className="font-bold text-rose-500">{stats.bannedUsers}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-white/5">
                <span className="text-slate-400">Disabled Accounts</span>
                <span className="font-bold text-slate-400">{stats.disabledUsers}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-white/5">
                <span className="text-slate-400">Pending Verification Queue</span>
                <span className="font-bold text-emerald-400">{stats.pendingVerificationsCount}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODULE: PIN RESET REQUESTS */}
      {adminSubTab === 'pin_resets' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between bg-[#121216]/90 border border-white/10 rounded-2xl p-4 backdrop-blur-xl">
            <div>
              <h3 className="text-base font-extrabold text-amber-300 flex items-center gap-2">
                <KeyRound className="w-5 h-5 text-amber-400" /> Secure Support: PIN Reset Requests
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Users requesting a Security PIN reset without exposing their original encrypted PIN.
              </p>
            </div>
            <div className="px-3 py-1.5 bg-amber-500/20 border border-amber-500/40 rounded-xl text-amber-300 font-mono font-bold text-xs shrink-0">
              {pinResets.filter((r) => r.status === 'Pending').length} Pending
            </div>
          </div>

          {pinResets.length === 0 ? (
            <div className="text-center py-16 bg-[#121216]/80 border border-white/10 rounded-3xl text-slate-400 space-y-2">
              <KeyRound className="w-10 h-10 text-amber-500/50 mx-auto" />
              <p className="text-xs font-bold text-slate-200">No PIN Reset Requests</p>
              <p className="text-[11px] text-slate-400 max-w-sm mx-auto">
                When users request a PIN reset via the Forgot PIN flow, support tickets will appear here for Administrator action.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {pinResets.map((req) => (
                <div
                  key={req.id}
                  className="p-5 bg-[#121216]/90 border border-white/10 hover:border-amber-500/40 rounded-3xl space-y-3 backdrop-blur-xl shadow-xl text-xs"
                >
                  <div className="flex items-start justify-between gap-3 border-b border-white/10 pb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-extrabold text-white text-base">{req.name}</h4>
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase ${
                          req.status === 'Pending'
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse'
                            : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                        }`}>
                          {req.status}
                        </span>
                      </div>
                      <p className="text-slate-400 text-[11px] mt-1 font-mono">
                        UID: <span className="text-slate-200">{req.uid}</span>
                      </p>
                    </div>
                    <span className="text-[11px] text-slate-400 font-mono">
                      {new Date(req.requestTime).toLocaleString()}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] bg-white/5 p-3 rounded-2xl border border-white/5 font-mono">
                    <div><span className="text-slate-400 font-sans">Registered Email:</span> <span className="text-pink-300">{req.registeredEmail || 'N/A'}</span></div>
                    <div><span className="text-slate-400 font-sans">Registered Phone:</span> <span className="text-amber-300">{req.registeredPhone || 'N/A'}</span></div>
                    <div className="col-span-1 sm:col-span-2"><span className="text-slate-400 font-sans">Device Context:</span> <span className="text-slate-300">{req.deviceInfo || 'Standard Mobile Browser'}</span></div>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-1">
                    {req.status === 'Pending' ? (
                      <button
                        onClick={() => {
                          setResetModalReq(req);
                          setNewPinInput('1234');
                          setResetModalMsg('');
                        }}
                        className="px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-slate-950 font-black text-xs rounded-xl shadow-lg flex items-center gap-1.5 transition-all"
                      >
                        <KeyRound className="w-3.5 h-3.5" />
                        <span>Reset User PIN</span>
                      </button>
                    ) : (
                      <button
                        onClick={() => handleMarkPinResetCompleted(req.id)}
                        className="px-3 py-1.5 bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-300 text-xs font-bold rounded-xl transition-all"
                      >
                        Resolved ✓
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* MODULE: PEWA SUGARS MODERATION */}
      {adminSubTab === 'sugars' && (
        <div className="space-y-4">
          <div className="p-5 bg-gradient-to-r from-amber-950/60 to-slate-900/90 border border-amber-500/30 rounded-3xl flex items-center justify-between">
            <div className="space-y-1">
              <h3 className="text-lg font-black text-amber-300 flex items-center gap-2">
                <Crown className="w-5 h-5 text-amber-400" /> PEWA Sugars Applications & Moderation
              </h3>
              <p className="text-xs text-slate-300">
                Review submitted Sugar Baby, Sugar Mama, and Sugar Daddy profile applications. Approved profiles receive the Golden Verification Badge and are visible in search.
              </p>
            </div>
            <div className="px-3 py-1.5 bg-amber-500/20 border border-amber-500/40 rounded-xl text-amber-300 font-mono font-bold text-xs shrink-0">
              {pendingSugarApplications.length} Pending Approval
            </div>
          </div>

          <div className="space-y-3">
            {sugarApplications.length === 0 ? (
              <div className="text-center py-16 bg-[#121216]/80 border border-white/10 rounded-3xl text-slate-400 space-y-2">
                <Crown className="w-10 h-10 text-amber-500/50 mx-auto" />
                <p className="text-xs font-bold text-slate-200">No Sugar Applications Submitted Yet</p>
                <p className="text-[11px] text-slate-400 max-w-sm mx-auto">
                  When users fill out the PEWA Sugars application, their submissions will appear here for admin review.
                </p>
              </div>
            ) : (
              sugarApplications.map((u) => {
                const s = u.sugarProfile!;
                return (
                  <div
                    key={u.uid}
                    className="p-5 bg-[#121216]/90 border border-white/10 hover:border-amber-500/30 rounded-3xl space-y-4 backdrop-blur-xl shadow-xl text-xs"
                  >
                    {/* Header */}
                    <div className="flex items-start justify-between gap-3 border-b border-white/10 pb-3">
                      <div className="flex items-center gap-3">
                        <img src={s.photos?.face || u.avatar} alt={u.fullName} className="w-14 h-14 rounded-2xl object-cover border border-amber-500/30" />
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="font-extrabold text-white text-base">{u.fullName}, {u.age}</h4>
                            <span className="bg-amber-500/20 text-amber-300 border border-amber-500/40 px-2 py-0.5 rounded-full font-bold text-[10px]">
                              {s.type}
                            </span>
                          </div>
                          <p className="text-slate-400 text-[11px] mt-0.5">
                            📍 {s.city || u.city}, {s.country || u.country} • Phone: <span className="font-mono text-white">{u.phone}</span>
                          </p>
                        </div>
                      </div>

                      <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase ${
                        s.status === 'approved'
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                          : s.status === 'pending'
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse'
                          : 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
                      }`}>
                        {s.status}
                      </span>
                    </div>

                    {/* Content Details */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="p-3 bg-white/5 rounded-2xl border border-white/10 space-y-1">
                        <span className="text-[10px] uppercase font-bold text-amber-400">Support / Allowance Expectation</span>
                        <div className="font-black text-amber-200 font-mono text-xs">
                          {s.monthlySupportBudget || s.monthlyIncomeRange || s.expectationOrAllowance || 'Mutual Support'}
                        </div>
                      </div>

                      <div className="p-3 bg-white/5 rounded-2xl border border-white/10 space-y-1">
                        <span className="text-[10px] uppercase font-bold text-slate-400">Relationship Preferences</span>
                        <div className="text-slate-200 font-semibold">
                          {(s.relationshipPreferences || []).join(', ') || 'General Companionship'}
                        </div>
                      </div>

                      <div className="p-3 bg-white/5 rounded-2xl border border-white/10 space-y-1">
                        <span className="text-[10px] uppercase font-bold text-slate-400">Occupation & Height</span>
                        <div className="text-slate-200 font-semibold">
                          {s.occupation} • {s.height}
                        </div>
                      </div>
                    </div>

                    {/* Bio */}
                    <div className="bg-white/5 p-3 rounded-2xl border border-white/10 italic text-slate-300">
                      "{s.bio || u.bio || 'Seeking companionship.'}"
                    </div>

                    {/* Photo Previews */}
                    {s.photos && (
                      <div className="flex gap-2.5">
                        {s.photos.face && (
                          <div className="text-center space-y-1">
                            <img src={s.photos.face} alt="Face" className="w-20 h-20 object-cover rounded-xl border border-white/10" />
                            <span className="text-[9px] text-slate-400 block font-bold">Face Photo</span>
                          </div>
                        )}
                        {s.photos.fullBody && (
                          <div className="text-center space-y-1">
                            <img src={s.photos.fullBody} alt="Full Body" className="w-20 h-20 object-cover rounded-xl border border-white/10" />
                            <span className="text-[9px] text-slate-400 block font-bold">Full Body Photo</span>
                          </div>
                        )}
                        {s.photos.additional && (
                          <div className="text-center space-y-1">
                            <img src={s.photos.additional} alt="Additional" className="w-20 h-20 object-cover rounded-xl border border-white/10" />
                            <span className="text-[9px] text-slate-400 block font-bold">Additional Photo</span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Admin Action Bar */}
                    <div className="flex items-center justify-end gap-2 pt-3 border-t border-white/10">
                      {s.status === 'pending' && (
                        <>
                          <button
                            onClick={() => handleRejectSugar(u.uid)}
                            className="px-4 py-2 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 rounded-xl font-bold transition-all flex items-center gap-1.5"
                          >
                            <X className="w-4 h-4" /> Reject Application
                          </button>
                          <button
                            onClick={() => handleApproveSugar(u.uid)}
                            className="px-5 py-2 bg-gradient-to-r from-amber-400 to-amber-600 text-slate-950 font-black rounded-xl shadow-lg shadow-amber-500/25 transition-all flex items-center gap-1.5 hover:opacity-95"
                          >
                            <Check className="w-4 h-4" /> Approve & Grant Verified Badge
                          </button>
                        </>
                      )}

                      {s.status === 'approved' && (
                        <button
                          onClick={() => handleSuspendSugar(u.uid)}
                          className="px-4 py-2 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 rounded-xl font-bold transition-all flex items-center gap-1.5"
                        >
                          Suspend Sugar Access
                        </button>
                      )}

                      {s.status === 'rejected' && (
                        <button
                          onClick={() => handleApproveSugar(u.uid)}
                          className="px-4 py-2 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 rounded-xl font-bold transition-all flex items-center gap-1.5"
                        >
                          Re-Approve Profile
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* MODULE 2: USER MANAGEMENT */}
      {adminSubTab === 'users' && (
        <div className="space-y-3">
          {/* Controls Bar */}
          <div className="flex flex-col sm:flex-row gap-2.5">
            <div className="relative flex-1">
              <input
                type="text"
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                placeholder="Search by name, phone, email, city..."
                className="w-full bg-[#121216]/90 border border-white/10 rounded-2xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-amber-500/60 transition-all backdrop-blur-xl"
              />
              <Search className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
            </div>
            <div className="flex gap-1 overflow-x-auto pb-1 sm:pb-0">
              {(['all', 'verified', 'suspended', 'banned', 'disabled'] as const).map((st) => (
                <button
                  key={st}
                  onClick={() => setUserStatusFilter(st)}
                  className={`px-3 py-2 rounded-xl text-[11px] font-bold capitalize transition-all whitespace-nowrap ${
                    userStatusFilter === st
                      ? 'bg-amber-500 text-slate-950 font-black shadow-md'
                      : 'bg-white/5 border border-white/10 text-slate-400 hover:text-white'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>
          </div>

          {/* Users List */}
          <div className="space-y-2.5 max-h-[65vh] overflow-y-auto pr-1">
            {filteredUsers.length === 0 ? (
              <div className="text-center py-12 bg-[#121216]/80 border border-white/10 rounded-3xl text-slate-400">
                <Users className="w-10 h-10 mx-auto mb-2 text-slate-500" />
                <p className="text-xs font-semibold">No users matching search filter.</p>
              </div>
            ) : (
              filteredUsers.map((user) => (
                <div
                  key={user.uid}
                  className="p-3.5 bg-[#121216]/90 border border-white/10 hover:border-amber-500/30 rounded-2xl space-y-2.5 text-xs backdrop-blur-xl shadow-xl transition-all"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-3 cursor-pointer" onClick={() => setSelectedUserDetail(user)}>
                      <img src={user.avatar} alt={user.fullName} className="w-11 h-11 rounded-2xl object-cover border border-white/10" />
                      <div>
                        <div className="flex items-center gap-1.5">
                          <h4 className="font-extrabold text-white text-sm hover:text-amber-300">{user.fullName}</h4>
                          {user.verified && <span title="Verified Member"><ShieldCheck className="w-4 h-4 text-pink-500" /></span>}
                          {user.banned && <span className="bg-rose-500/20 text-rose-400 text-[9px] font-bold px-1.5 py-0.5 rounded">BANNED</span>}
                          {user.suspended && <span className="bg-amber-500/20 text-amber-400 text-[9px] font-bold px-1.5 py-0.5 rounded">SUSPENDED</span>}
                          {user.disabled && <span className="bg-slate-500/20 text-slate-400 text-[9px] font-bold px-1.5 py-0.5 rounded">DISABLED</span>}
                        </div>
                        <p className="text-[11px] text-slate-400">
                          {user.phone} {user.email ? `• ${user.email}` : ''} • {user.city}, {user.country}
                        </p>
                      </div>
                    </div>

                    <button
                      onClick={() => setSelectedUserDetail(user)}
                      className="px-2.5 py-1.5 bg-white/5 hover:bg-white/10 text-slate-300 rounded-xl border border-white/10 text-[11px] font-semibold"
                    >
                      Inspect
                    </button>
                  </div>

                  {/* Actions Row */}
                  <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-white/5">
                    {/* Verify Toggle */}
                    <button
                      onClick={() => handleToggleVerify(user.uid, user.verified)}
                      className={`px-2.5 py-1.5 rounded-xl border text-[10px] font-bold flex items-center gap-1 transition-all ${
                        user.verified ? 'bg-pink-500/20 border-pink-500/50 text-pink-300' : 'bg-white/5 border-white/10 text-slate-400 hover:text-white'
                      }`}
                    >
                      <ShieldCheck className="w-3.5 h-3.5" />
                      {user.verified ? 'Verified' : 'Verify'}
                    </button>

                    {/* Suspend Toggle */}
                    <button
                      onClick={() => handleToggleSuspend(user.uid, user.suspended)}
                      className={`px-2.5 py-1.5 rounded-xl border text-[10px] font-bold flex items-center gap-1 transition-all ${
                        user.suspended ? 'bg-amber-500/30 border-amber-500/60 text-amber-300' : 'bg-white/5 border-white/10 text-slate-400 hover:text-white'
                      }`}
                    >
                      <Clock className="w-3.5 h-3.5" />
                      {user.suspended ? 'Unsuspend' : 'Suspend'}
                    </button>

                    {/* Disable Toggle */}
                    <button
                      onClick={() => handleToggleDisable(user.uid, user.disabled)}
                      className={`px-2.5 py-1.5 rounded-xl border text-[10px] font-bold flex items-center gap-1 transition-all ${
                        user.disabled ? 'bg-slate-500/30 border-slate-500/60 text-slate-300' : 'bg-white/5 border-white/10 text-slate-400 hover:text-white'
                      }`}
                    >
                      {user.disabled ? <Unlock className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
                      {user.disabled ? 'Enable' : 'Disable'}
                    </button>

                    {/* Ban Toggle */}
                    {user.banned ? (
                      <button
                        onClick={() => handleUnbanUser(user.uid)}
                        className="px-2.5 py-1.5 rounded-xl bg-emerald-500/20 border border-emerald-500/50 text-emerald-300 text-[10px] font-bold flex items-center gap-1"
                      >
                        <Check className="w-3.5 h-3.5" /> Unban
                      </button>
                    ) : (
                      <button
                        onClick={() => setShowBanModal(user.uid)}
                        className="px-2.5 py-1.5 rounded-xl bg-rose-500/20 border border-rose-500/50 text-rose-300 text-[10px] font-bold flex items-center gap-1 hover:bg-rose-500/30"
                      >
                        <Ban className="w-3.5 h-3.5" /> Ban
                      </button>
                    )}

                    {/* Permanently Block Catfish Account */}
                    <button
                      onClick={() => handleBlockCatfish(user.uid, user.fullName)}
                      className="px-2.5 py-1.5 rounded-xl bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/50 text-purple-300 text-[10px] font-bold flex items-center gap-1"
                      title="Block Catfish Account & Identifiers Permanently"
                    >
                      <UserX className="w-3.5 h-3.5" /> Catfish Block
                    </button>

                    {/* Complete Irreversible Account Deletion */}
                    <button
                      onClick={() => handleDeleteUserCompletely(user.uid, user.fullName)}
                      className="px-2.5 py-1.5 rounded-xl bg-red-600/30 hover:bg-red-600/50 border border-red-500/60 text-rose-200 text-[10px] font-extrabold flex items-center gap-1 ml-auto"
                      title="Permanently Delete Account"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Delete Account
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* MODULE 3: POSTS MODERATION */}
      {adminSubTab === 'posts' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-bold text-xs text-slate-400 uppercase tracking-wider">Moderate Social Feed Posts</h4>
            <span className="text-[11px] text-slate-400">Total: {posts.length} posts</span>
          </div>

          <div className="space-y-3 max-h-[65vh] overflow-y-auto">
            {posts.map((post) => (
              <div
                key={post.id}
                className={`p-4 bg-[#121216]/90 border rounded-2xl text-xs space-y-2.5 backdrop-blur-xl shadow-xl ${
                  post.hidden ? 'border-rose-500/40 bg-rose-950/10' : post.featured ? 'border-amber-500/50 bg-amber-950/10' : 'border-white/10'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <img src={post.author?.avatar} alt={post.author?.fullName} className="w-8 h-8 rounded-full object-cover" />
                    <div>
                      <span className="font-bold text-white block">{post.author?.fullName}</span>
                      <span className="text-[10px] text-slate-400">{new Date(post.createdAt).toLocaleString()}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    {post.featured && (
                      <span className="bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[9px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                        <Star className="w-3 h-3 fill-current" /> FEATURED
                      </span>
                    )}
                    {post.hidden && (
                      <span className="bg-rose-500/20 text-rose-300 border border-rose-500/40 text-[9px] font-bold px-2 py-0.5 rounded-full">
                        HIDDEN
                      </span>
                    )}
                  </div>
                </div>

                <p className="text-slate-200 leading-relaxed whitespace-pre-line">{post.content}</p>

                {post.mediaUrl && (
                  <img src={post.mediaUrl} alt="Post media" className="w-full max-h-48 object-cover rounded-xl border border-white/10" />
                )}

                <div className="flex items-center justify-between pt-2 border-t border-white/5 text-[11px]">
                  <span className="text-slate-400">👍 {post.upVotes.length} Up Votes • 💬 {post.commentsCount} Comments</span>

                  <div className="flex items-center gap-1.5">
                    {/* Feature Button */}
                    <button
                      onClick={() => handleToggleFeaturePost(post.id)}
                      className={`px-2.5 py-1 rounded-lg border text-[10px] font-bold flex items-center gap-1 ${
                        post.featured ? 'bg-amber-500/20 border-amber-500/50 text-amber-300' : 'bg-white/5 border-white/10 text-slate-400'
                      }`}
                    >
                      <Star className="w-3 h-3" /> {post.featured ? 'Unfeature' : 'Feature'}
                    </button>

                    {/* Edit Button */}
                    <button
                      onClick={() => {
                        setEditingPost(post);
                        setEditPostContent(post.content);
                        setEditPostMediaUrl(post.mediaUrl || '');
                      }}
                      className="px-2.5 py-1 rounded-lg bg-sky-500/20 hover:bg-sky-500/40 border border-sky-500/50 text-sky-200 text-[10px] font-bold flex items-center gap-1"
                    >
                      <Edit3 className="w-3 h-3" /> Edit
                    </button>

                    {/* Hide Button */}
                    <button
                      onClick={() => handleToggleHidePost(post.id)}
                      className={`px-2.5 py-1 rounded-lg border text-[10px] font-bold flex items-center gap-1 ${
                        post.hidden ? 'bg-rose-500/20 border-rose-500/50 text-rose-300' : 'bg-white/5 border-white/10 text-slate-400'
                      }`}
                    >
                      {post.hidden ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                      {post.hidden ? 'Unhide' : 'Hide'}
                    </button>

                    {/* Delete Button */}
                    <button
                      onClick={() => handleDeletePostAdmin(post.id)}
                      className="px-2.5 py-1 rounded-lg bg-red-600/30 hover:bg-red-600/50 border border-red-500/50 text-rose-200 text-[10px] font-bold flex items-center gap-1"
                    >
                      <Trash2 className="w-3 h-3" /> Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* MODULE 4: ADMINISTRATOR CHATS (GLOBAL & INDIVIDUAL) */}
      {adminSubTab === 'chats' && (
        <div className="space-y-4">
          {/* Sub-tab navigation: Global Chat vs Individual Chats */}
          <div className="p-3 bg-[#121216]/90 border border-white/10 rounded-2xl flex items-center gap-2 backdrop-blur-xl shadow-xl">
            <button
              onClick={() => {
                setChatTab('global');
                setSelectedIndividualUser(null);
              }}
              className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 ${
                chatTab === 'global'
                  ? 'bg-gradient-to-r from-pink-500 to-red-600 text-white shadow-lg'
                  : 'bg-white/5 text-slate-400 hover:text-white border border-white/10'
              }`}
            >
              <Radio className="w-4 h-4 text-pink-300" />
              <span>1. Global Chat (All Registered Users)</span>
            </button>

            <button
              onClick={() => setChatTab('individual')}
              className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 ${
                chatTab === 'individual'
                  ? 'bg-gradient-to-r from-pink-500 to-red-600 text-white shadow-lg'
                  : 'bg-white/5 text-slate-400 hover:text-white border border-white/10'
              }`}
            >
              <MessageSquare className="w-4 h-4 text-sky-300" />
              <span>2. Individual Chats ({users.length})</span>
            </button>
          </div>

          {/* TAB 1: GLOBAL CHAT */}
          {chatTab === 'global' && (
            <div className="space-y-2">
              <div className="p-3 bg-pink-950/30 border border-pink-500/30 rounded-2xl text-xs text-pink-300 flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-pink-400 shrink-0" />
                <p>
                  Global Chat messages are delivered into every registered user's chat list as <strong>PEWA Official</strong>. Users can read, react, and view attachments, but cannot post messages.
                </p>
              </div>

              <div className="h-[70vh] relative rounded-3xl overflow-hidden border border-white/10 shadow-2xl bg-[#0a0a0b]">
                <ChatRoom
                  chatId="chat_global_pewa"
                  partner={{
                    uid: 'pewa_official',
                    fullName: 'PEWA Official Broadcast Channel',
                    avatar: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=400&auto=format&fit=crop',
                    verified: true,
                    email: 'admin@pewa.zm',
                    phone: '+260 PEWA OFFICIAL',
                    city: 'Lusaka',
                    country: 'Zambia',
                    gender: 'Male',
                    age: 30,
                    relationshipGoals: 'Community Announcements'
                  } as UserProfile}
                  onBack={() => setChatTab('individual')}
                />
              </div>
            </div>
          )}

          {/* TAB 2: INDIVIDUAL CHATS */}
          {chatTab === 'individual' && (
            <div className="space-y-3">
              {selectedIndividualUser ? (
                <div className="space-y-2">
                  <button
                    onClick={() => setSelectedIndividualUser(null)}
                    className="px-4 py-2 bg-white/10 hover:bg-white/20 text-slate-200 text-xs font-bold rounded-xl border border-white/10 flex items-center gap-2 transition-all"
                  >
                    ← Back to User Chat Directory
                  </button>

                  <div className="h-[70vh] relative rounded-3xl overflow-hidden border border-white/10 shadow-2xl bg-[#0a0a0b]">
                    <ChatRoom
                      chatId={PEWADatabaseService.getOrCreateChat(currentUser!.uid, selectedIndividualUser.uid).id}
                      partner={selectedIndividualUser}
                      onBack={() => setSelectedIndividualUser(null)}
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Search Bar for Individual Chats */}
                  <div className="relative">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                    <input
                      type="text"
                      value={individualChatSearch}
                      onChange={(e) => setIndividualChatSearch(e.target.value)}
                      placeholder="Search user by name, phone number, city..."
                      className="w-full bg-[#121216]/90 border border-white/10 rounded-2xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-pink-500"
                    />
                  </div>

                  <div className="space-y-2 max-h-[65vh] overflow-y-auto pr-1">
                    {users
                      .filter(u => u.uid !== currentUser?.uid && (
                        u.fullName.toLowerCase().includes(individualChatSearch.toLowerCase()) ||
                        u.phone.includes(individualChatSearch) ||
                        u.city.toLowerCase().includes(individualChatSearch.toLowerCase())
                      ))
                      .map((u) => {
                        const presence = PEWADatabaseService.getPresence(u.uid);
                        return (
                          <div
                            key={u.uid}
                            className="p-3 bg-[#121216]/90 border border-white/10 hover:border-pink-500/40 rounded-2xl flex items-center justify-between gap-3 text-xs backdrop-blur-xl transition-all"
                          >
                            <div className="flex items-center gap-3">
                              <div className="relative">
                                <img src={u.avatar} alt={u.fullName} className="w-11 h-11 rounded-2xl object-cover border border-white/10" />
                                <span className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-[#121216] ${
                                  presence.status === 'online' ? 'bg-emerald-500' : 'bg-slate-600'
                                }`} />
                              </div>

                              <div>
                                <h4 className="font-extrabold text-white text-sm flex items-center gap-1.5">
                                  <span>{u.fullName}</span>
                                  {u.verified && <ShieldCheck className="w-4 h-4 text-pink-500" />}
                                </h4>
                                <p className="text-[11px] text-slate-400">
                                  📞 {u.phone} • 📍 {u.city}, {u.country}
                                </p>
                              </div>
                            </div>

                            <button
                              onClick={() => setSelectedIndividualUser(u)}
                              className="px-3.5 py-2 bg-gradient-to-r from-pink-500 to-red-600 hover:from-pink-600 hover:to-red-700 text-white font-bold text-xs rounded-xl shadow-md flex items-center gap-1.5 transition-all"
                            >
                              <MessageSquare className="w-3.5 h-3.5" /> Chat
                            </button>
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* MODULE 5: ADVERTISEMENT MANAGEMENT */}
      {adminSubTab === 'ads' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-bold text-xs text-slate-400 uppercase tracking-wider">Promotional & Banner Ads</h4>
            <button
              onClick={() => {
                setAdForm({ title: '', description: '', imageUrl: '', targetUrl: '', ctaText: 'Learn More', enabled: true });
                setShowAdModal(true);
              }}
              className="px-3 py-1.5 bg-gradient-to-r from-amber-500 to-orange-600 text-slate-950 font-black text-xs rounded-xl flex items-center gap-1.5 shadow-md"
            >
              <Plus className="w-3.5 h-3.5" /> Create Ad Campaign
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {ads.map((ad) => (
              <div key={ad.id} className="p-3.5 bg-[#121216]/90 border border-white/10 rounded-2xl space-y-2 text-xs backdrop-blur-xl shadow-xl">
                <img src={ad.imageUrl} alt={ad.title} className="w-full h-32 object-cover rounded-xl border border-white/10" />
                <div className="flex items-center justify-between">
                  <h4 className="font-extrabold text-amber-300">{ad.title}</h4>
                  <span className={`px-2 py-0.5 text-[9px] font-bold rounded-full ${ad.enabled ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}`}>
                    {ad.enabled ? 'ACTIVE' : 'DISABLED'}
                  </span>
                </div>
                <p className="text-slate-400 text-[11px]">{ad.description}</p>

                <div className="flex items-center justify-between pt-2 border-t border-white/5">
                  <span className="text-[10px] text-slate-500 font-mono truncate max-w-[150px]">{ad.targetUrl}</span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleToggleAd(ad.id)}
                      className={`px-2 py-1 rounded-lg text-[10px] font-bold ${ad.enabled ? 'bg-amber-500/20 text-amber-300' : 'bg-emerald-500/20 text-emerald-300'}`}
                    >
                      {ad.enabled ? 'Disable' : 'Enable'}
                    </button>
                    <button
                      onClick={() => handleDeleteAd(ad.id)}
                      className="p-1 text-rose-400 hover:text-rose-300"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* MODULE 6: VERIFICATION REQUESTS */}
      {adminSubTab === 'verifications' && (
        <div className="space-y-3">
          <h4 className="font-bold text-xs text-slate-400 uppercase tracking-wider">Identity Verification Submissions</h4>
          {verifications.length === 0 ? (
            <div className="text-center py-12 bg-[#121216]/80 border border-white/10 rounded-3xl text-slate-400">
              <CheckCircle2 className="w-10 h-10 mx-auto mb-2 text-emerald-400" />
              <p className="text-xs font-bold text-slate-200">No verification requests pending.</p>
            </div>
          ) : (
            verifications.map((req) => (
              <div key={req.id} className="p-4 bg-[#121216]/90 border border-white/10 rounded-2xl space-y-3 text-xs backdrop-blur-xl shadow-xl">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <img src={req.userAvatar} alt={req.userName} className="w-10 h-10 rounded-2xl object-cover border border-pink-500/40" />
                    <div>
                      <h4 className="font-bold text-white text-sm flex items-center gap-2">
                        <span>{req.userName}</span>
                        {req.plan && (
                          <span className="px-2 py-0.5 bg-amber-500/20 text-amber-300 border border-amber-500/40 rounded-full font-mono text-[9px] uppercase">
                            {req.plan}
                          </span>
                        )}
                      </h4>
                      <p className="text-[11px] text-slate-400">
                        UID: <span className="font-mono text-slate-300">{req.userId}</span> • Phone: <span className="text-slate-200 font-medium">{req.userPhone || 'N/A'}</span>
                      </p>
                    </div>
                  </div>
                  <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase border ${
                    req.status === 'pending' ? 'bg-amber-500/20 border-amber-500/40 text-amber-400' : req.status === 'approved' ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400' : 'bg-rose-500/20 border-rose-500/40 text-rose-400'
                  }`}>
                    {req.status}
                  </span>
                </div>

                {/* Document & Payment Images Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                  {(req.idFrontUrl || req.documentUrl) && (
                    <div className="space-y-1">
                      <span className="text-[10px] text-slate-400 font-bold uppercase block">Front of ID</span>
                      <a href={req.idFrontUrl || req.documentUrl} target="_blank" rel="noopener noreferrer">
                        <img src={req.idFrontUrl || req.documentUrl} alt="ID Front" className="w-full h-28 object-cover rounded-xl border border-white/10 hover:border-amber-400 transition-all cursor-pointer" />
                      </a>
                    </div>
                  )}

                  {req.idBackUrl && (
                    <div className="space-y-1">
                      <span className="text-[10px] text-slate-400 font-bold uppercase block">Back of ID</span>
                      <a href={req.idBackUrl} target="_blank" rel="noopener noreferrer">
                        <img src={req.idBackUrl} alt="ID Back" className="w-full h-28 object-cover rounded-xl border border-white/10 hover:border-amber-400 transition-all cursor-pointer" />
                      </a>
                    </div>
                  )}

                  {req.selfieUrl && (
                    <div className="space-y-1">
                      <span className="text-[10px] text-slate-400 font-bold uppercase block">Selfie Holding ID</span>
                      <a href={req.selfieUrl} target="_blank" rel="noopener noreferrer">
                        <img src={req.selfieUrl} alt="Selfie" className="w-full h-28 object-cover rounded-xl border border-white/10 hover:border-amber-400 transition-all cursor-pointer" />
                      </a>
                    </div>
                  )}

                  {req.paymentScreenshotUrl && (
                    <div className="space-y-1">
                      <span className="text-[10px] font-extrabold text-emerald-400 uppercase block">Payment Proof</span>
                      <a href={req.paymentScreenshotUrl} target="_blank" rel="noopener noreferrer">
                        <img src={req.paymentScreenshotUrl} alt="Payment Screenshot" className="w-full h-28 object-cover rounded-xl border border-emerald-500/40 hover:border-emerald-300 transition-all cursor-pointer" />
                      </a>
                    </div>
                  )}
                </div>

                {req.rejectionReason && (
                  <p className="text-rose-400 text-[11px] bg-rose-500/10 border border-rose-500/20 p-2.5 rounded-xl">
                    <strong>Rejection Reason:</strong> {req.rejectionReason}
                  </p>
                )}

                {req.status === 'pending' && (
                  <div className="flex gap-2 pt-2 border-t border-white/5">
                    <button
                      onClick={() => handleApproveVerification(req.id)}
                      className="flex-1 py-2.5 bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/50 text-emerald-300 font-bold rounded-xl flex items-center justify-center gap-1.5 transition-all"
                    >
                      <Check className="w-4 h-4" /> Approve & Grant Verified Blue Tick
                    </button>
                    <button
                      onClick={() => handleRejectVerification(req.id)}
                      className="flex-1 py-2.5 bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/50 text-rose-300 font-bold rounded-xl flex items-center justify-center gap-1.5 transition-all"
                    >
                      <X className="w-4 h-4" /> Reject Submission
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* MODULE 7: REPORTS & SAFETY */}
      {adminSubTab === 'reports' && (
        <div className="space-y-3">
          <h4 className="font-bold text-xs text-slate-400 uppercase tracking-wider">Safety Reports & User Complaints</h4>
          {reports.length === 0 ? (
            <div className="text-center py-12 bg-[#121216]/80 border border-white/10 rounded-3xl text-slate-400">
              <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto mb-2" />
              <p className="text-xs font-bold text-slate-200">No reports pending investigation.</p>
            </div>
          ) : (
            reports.map((r) => (
              <div key={r.id} className="p-4 bg-[#121216]/90 border border-white/10 rounded-2xl text-xs space-y-2.5 backdrop-blur-xl shadow-xl">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-rose-400">Reason: {r.reason}</span>
                  <span className="text-[10px] text-slate-500">{new Date(r.createdAt).toLocaleString()}</span>
                </div>
                <p className="text-slate-300">Reporter: <span className="font-bold text-white">{r.reporterName}</span></p>
                {r.details && <p className="text-slate-400 text-[11px] bg-white/5 p-2 rounded-xl">{r.details}</p>}

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/5">
                  <button
                    onClick={() => handleDismissReport(r.id)}
                    className="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-slate-300 rounded-xl text-[11px] font-bold border border-white/10"
                  >
                    Dismiss
                  </button>
                  <button
                    onClick={() => handleResolveReport(r.id)}
                    className="px-3 py-1.5 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 rounded-xl text-[11px] font-bold border border-emerald-500/50"
                  >
                    Mark Resolved
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* MODULE 8: SYSTEM LOGS */}
      {adminSubTab === 'logs' && (
        <div className="space-y-3">
          <h4 className="font-bold text-xs text-slate-400 uppercase tracking-wider">System Audit & Governance Logs</h4>
          <div className="space-y-2 max-h-[60vh] overflow-y-auto">
            {logs.length === 0 ? (
              <p className="text-xs text-slate-500 italic">No system audit logs recorded.</p>
            ) : (
              logs.map((log) => (
                <div key={log.id} className="p-3 bg-[#121216]/90 border border-white/10 rounded-xl text-[11px] space-y-0.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-amber-300">{log.action}</span>
                    <span className="text-slate-500 font-mono text-[10px]">{new Date(log.timestamp).toLocaleString()}</span>
                  </div>
                  <p className="text-slate-400">{log.details}</p>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* MODULE 9: ADMIN SETTINGS & PROFILE MANAGEMENT */}
      {adminSubTab === 'settings' && (
        <div className="bg-[#121216]/90 border border-white/10 rounded-3xl p-6 shadow-2xl backdrop-blur-xl space-y-6">
          {/* File Input for Administrator Picture Upload */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleImageFileSelect}
          />

          {/* Image Crop Modal */}
          {cropModalOpen && cropImageSrc && (
            <ImageCropModal
              isOpen={cropModalOpen}
              imageSrc={cropImageSrc}
              onClose={() => setCropModalOpen(false)}
              onCropComplete={handleCropComplete}
            />
          )}

          <div className="flex items-center gap-3 border-b border-white/10 pb-4">
            <div className="p-3 bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 rounded-2xl shadow-lg shadow-amber-500/30">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-black text-amber-300">Administrator Profile & System Settings</h3>
              <p className="text-xs text-slate-400">Manage Administrator Profile, Credentials, Support WhatsApp, OneSignal, Logo, and Themes</p>
            </div>
          </div>

          {adminSettingsMsg && (
            <div className={`p-4 rounded-2xl text-xs font-bold border ${
              adminSettingsMsg.includes('✅')
                ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                : 'bg-rose-500/20 border-rose-500/40 text-rose-300'
            }`}>
              {adminSettingsMsg}
            </div>
          )}

          <form onSubmit={handleSaveFullAdminProfile} className="space-y-6">
            {/* 1. ADMINISTRATOR PROFILE PICTURE & DETAILS */}
            <div className="bg-white/5 border border-amber-500/30 rounded-3xl p-5 space-y-5 shadow-xl">
              <h4 className="text-sm font-extrabold text-amber-300 uppercase tracking-wider flex items-center gap-2">
                <Camera className="w-4 h-4 text-amber-400" />
                1. Administrator Profile & Live Picture
              </h4>

              <div className="flex flex-col sm:flex-row items-center gap-5 p-4 bg-slate-900/80 rounded-2xl border border-white/10">
                {/* Live Avatar Preview */}
                <div className="relative group shrink-0">
                  <img
                    src={adminAvatarForm || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=400&auto=format&fit=crop'}
                    alt="Administrator Profile"
                    className="w-24 h-24 rounded-3xl object-cover border-4 border-amber-500/80 shadow-2xl"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="absolute inset-0 bg-slate-950/70 opacity-0 group-hover:opacity-100 transition-opacity rounded-3xl flex flex-col items-center justify-center text-amber-300 font-bold text-[10px] gap-1 cursor-pointer"
                  >
                    <Camera className="w-5 h-5" />
                    <span>Change Picture</span>
                  </button>
                  <div className="absolute -bottom-2 -right-2 bg-amber-500 text-slate-950 p-1 rounded-full shadow-lg">
                    <ShieldCheck className="w-4 h-4" />
                  </div>
                </div>

                {/* Avatar Controls */}
                <div className="space-y-2 text-center sm:text-left flex-1">
                  <h5 className="font-bold text-sm text-white">{adminNameForm || 'PEWA Official'}</h5>
                  <p className="text-[11px] text-slate-400">
                    Your picture propagates automatically across all official posts, announcements, and global chat messages.
                  </p>
                  <div className="flex flex-wrap gap-2 pt-1 justify-center sm:justify-start">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="px-3 py-1.5 bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 font-bold text-xs rounded-xl shadow-md hover:brightness-110 flex items-center gap-1.5"
                    >
                      <Upload className="w-3.5 h-3.5" /> Upload & Crop Picture
                    </button>
                    <button
                      type="button"
                      onClick={handleRemoveImage}
                      className="px-3 py-1.5 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 font-bold text-xs rounded-xl border border-rose-500/40 transition-colors flex items-center gap-1.5"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Reset Default
                    </button>
                  </div>
                </div>
              </div>

              {/* Profile Details Inputs */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    Administrator Official Display Name
                  </label>
                  <input
                    type="text"
                    required
                    value={adminNameForm}
                    onChange={(e) => setAdminNameForm(e.target.value)}
                    placeholder="PEWA Official"
                    className="w-full bg-slate-900 border border-white/10 rounded-2xl px-4 py-2.5 text-xs text-white focus:border-amber-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    Administrator Account Email Address
                  </label>
                  <input
                    type="email"
                    required
                    value={adminEmailForm}
                    onChange={(e) => setAdminEmailForm(e.target.value)}
                    placeholder="mikelbishonga@gmail.com"
                    className="w-full bg-slate-900 border border-white/10 rounded-2xl px-4 py-2.5 text-xs text-amber-300 font-mono focus:border-amber-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Administrator Biography / Official Statement
                </label>
                <textarea
                  rows={2}
                  value={adminBioForm}
                  onChange={(e) => setAdminBioForm(e.target.value)}
                  placeholder="Official PEWA Administration Account for Safety & Support"
                  className="w-full bg-slate-900 border border-white/10 rounded-2xl p-3 text-xs text-slate-200 focus:border-amber-500 focus:outline-none"
                />
              </div>
            </div>

            {/* 2. SUPPORT CONTACTS & ONESIGNAL PUSH CONFIGURATION */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Support Contacts */}
              <div className="bg-white/5 border border-emerald-500/30 rounded-3xl p-5 space-y-4 shadow-xl">
                <h4 className="text-sm font-extrabold text-emerald-400 uppercase tracking-wider flex items-center gap-2">
                  <HelpCircle className="w-4 h-4 text-emerald-400" />
                  2. Support Contacts & WhatsApp
                </h4>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    Support WhatsApp Phone Number (Global for All Users)
                  </label>
                  <input
                    type="text"
                    required
                    value={supportWhatsappInput}
                    onChange={(e) => setSupportWhatsappInput(e.target.value)}
                    placeholder="+260961968962"
                    className="w-full bg-slate-900 border border-emerald-500/40 rounded-2xl px-4 py-2.5 text-xs text-emerald-300 font-mono focus:border-emerald-400 focus:outline-none"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">
                    Default: <span className="text-emerald-400 font-mono">+260961968962</span> (Updates Help & Support buttons)
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    Support Email Address
                  </label>
                  <input
                    type="email"
                    required
                    value={supportEmailInput}
                    onChange={(e) => setSupportEmailInput(e.target.value)}
                    placeholder="support@pewa.zm"
                    className="w-full bg-slate-900 border border-white/10 rounded-2xl px-4 py-2.5 text-xs text-white focus:border-emerald-400 focus:outline-none"
                  />
                </div>

                <div className="flex items-center justify-between p-3 bg-slate-900 rounded-2xl border border-white/10">
                  <div>
                    <span className="font-bold text-xs text-slate-200 block">Maintenance Mode</span>
                    <span className="text-[10px] text-slate-400">Lock platform for system maintenance</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setMaintenanceModeToggle(!maintenanceModeToggle)}
                    className={`px-3 py-1.5 rounded-xl font-bold text-xs transition-all ${
                      maintenanceModeToggle ? 'bg-rose-500 text-white shadow-md' : 'bg-white/10 text-slate-400'
                    }`}
                  >
                    {maintenanceModeToggle ? 'ENABLED' : 'DISABLED'}
                  </button>
                </div>
              </div>

              {/* OneSignal Push Notifications */}
              <div className="bg-white/5 border border-indigo-500/30 rounded-3xl p-5 space-y-4 shadow-xl">
                <h4 className="text-sm font-extrabold text-indigo-400 uppercase tracking-wider flex items-center gap-2">
                  <Bell className="w-4 h-4 text-indigo-400" />
                  3. OneSignal Push Notifications
                </h4>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    OneSignal App ID
                  </label>
                  <input
                    type="text"
                    value={onesignalAppIdForm}
                    onChange={(e) => setOnesignalAppIdForm(e.target.value)}
                    placeholder="e.g. 1a2b3c4d-5e6f-7a8b-9c0d-1e2f3a4b5c6d"
                    className="w-full bg-slate-900 border border-white/10 rounded-2xl px-4 py-2.5 text-xs font-mono text-indigo-300 focus:border-indigo-400 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    OneSignal REST API Key
                  </label>
                  <input
                    type="password"
                    value={onesignalRestApiKeyForm}
                    onChange={(e) => setOnesignalRestApiKeyForm(e.target.value)}
                    placeholder="e.g. os_v2_app_..."
                    className="w-full bg-slate-900 border border-white/10 rounded-2xl px-4 py-2.5 text-xs font-mono text-indigo-300 focus:border-indigo-400 focus:outline-none"
                  />
                </div>
                <p className="text-[11px] text-slate-400">
                  Allows broadcasting push notifications directly to user mobile devices upon account approval or announcements.
                </p>
              </div>
            </div>

            {/* 3. LOGO & THEME CUSTOMIZATION */}
            <div className="bg-white/5 border border-pink-500/30 rounded-3xl p-5 space-y-4 shadow-xl">
              <h4 className="text-sm font-extrabold text-pink-400 uppercase tracking-wider flex items-center gap-2">
                <Palette className="w-4 h-4 text-pink-400" />
                4. Application Logo & Visual Theme
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    Application Logo Image URL
                  </label>
                  <input
                    type="text"
                    value={appLogoUrlForm}
                    onChange={(e) => setAppLogoUrlForm(e.target.value)}
                    placeholder="https://example.com/logo.png"
                    className="w-full bg-slate-900 border border-white/10 rounded-2xl px-4 py-2.5 text-xs text-white focus:border-pink-400 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    Primary Accent Theme
                  </label>
                  <select
                    value={appThemeColorForm}
                    onChange={(e) => setAppThemeColorForm(e.target.value)}
                    className="w-full bg-slate-900 border border-white/10 rounded-2xl px-4 py-2.5 text-xs text-amber-300 font-bold focus:border-pink-400 focus:outline-none"
                  >
                    <option value="amber">Warm Gold (Default)</option>
                    <option value="emerald">Emerald Green</option>
                    <option value="indigo">Royal Indigo</option>
                    <option value="rose">Crimson Rose</option>
                  </select>
                </div>
              </div>
            </div>

            {/* 4. SECURITY PIN & SUBMIT */}
            <div className="bg-white/5 border border-amber-500/40 rounded-3xl p-5 space-y-4 shadow-xl">
              <h4 className="text-sm font-extrabold text-amber-300 uppercase tracking-wider flex items-center gap-2">
                <Lock className="w-4 h-4 text-amber-400" />
                5. Administrator Security PIN
              </h4>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Administrator Security PIN
                </label>
                <input
                  type="text"
                  required
                  minLength={4}
                  value={adminPinForm}
                  onChange={(e) => setAdminPinForm(e.target.value)}
                  placeholder="ipeze357"
                  className="w-full bg-slate-900 border border-white/10 rounded-2xl px-4 py-2.5 text-xs font-mono text-amber-300 focus:border-amber-500 focus:outline-none tracking-widest"
                />
                <p className="text-[11px] text-slate-400 mt-1">Default PIN: <span className="font-mono text-amber-300 font-bold">ipeze357</span></p>
              </div>

              <button
                type="submit"
                className="w-full py-3.5 bg-gradient-to-r from-amber-500 via-amber-600 to-amber-500 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-black text-xs rounded-2xl shadow-xl transition-all uppercase tracking-wider"
              >
                Save Administrator Profile & System Settings
              </button>
            </div>
          </form>

          {/* Legal & Policy Documents Form */}
          <form onSubmit={handleSaveSystemSettings} className="bg-white/5 border border-white/10 rounded-3xl p-5 space-y-4 shadow-xl">
            <h4 className="text-sm font-extrabold text-slate-300 uppercase tracking-wider">
              6. Platform Legal & Policy Texts
            </h4>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">
                Terms & Conditions Text
              </label>
              <textarea
                rows={3}
                value={termsInput}
                onChange={(e) => setTermsInput(e.target.value)}
                className="w-full bg-slate-900 border border-white/10 rounded-2xl p-3 text-xs text-slate-200 focus:border-amber-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">
                Privacy Policy Text
              </label>
              <textarea
                rows={3}
                value={privacyInput}
                onChange={(e) => setPrivacyInput(e.target.value)}
                className="w-full bg-slate-900 border border-white/10 rounded-2xl p-3 text-xs text-slate-200 focus:border-amber-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">
                Community Guidelines Text
              </label>
              <textarea
                rows={3}
                value={guidelinesInput}
                onChange={(e) => setGuidelinesInput(e.target.value)}
                className="w-full bg-slate-900 border border-white/10 rounded-2xl p-3 text-xs text-slate-200 focus:border-amber-500 focus:outline-none"
              />
            </div>

            <button
              type="submit"
              className="w-full py-3 bg-white/10 hover:bg-white/20 text-white font-extrabold text-xs rounded-2xl shadow-lg transition-all"
            >
              Update Terms, Privacy & Guidelines
            </button>
          </form>
        </div>
      )}

      {/* USER INSPECTION MODAL */}
      {selectedUserDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0a0a0b]/80 backdrop-blur-xl">
          <div className="relative w-full max-w-lg bg-[#121216] border border-white/10 rounded-3xl p-6 text-white space-y-4 shadow-2xl">
            <button
              onClick={() => setSelectedUserDetail(null)}
              className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white bg-white/5 rounded-full"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-4 border-b border-white/10 pb-4">
              <img src={selectedUserDetail.avatar} alt={selectedUserDetail.fullName} className="w-16 h-16 rounded-2xl object-cover border border-white/10" />
              <div>
                <h3 className="text-xl font-bold flex items-center gap-2">
                  {selectedUserDetail.fullName}
                  {selectedUserDetail.verified && <ShieldCheck className="w-5 h-5 text-pink-500" />}
                </h3>
                <p className="text-xs text-slate-400">{selectedUserDetail.phone} • {selectedUserDetail.email || 'No Email'}</p>
                <p className="text-xs text-amber-300 font-semibold mt-1">
                  {selectedUserDetail.city}, {selectedUserDetail.country} • {selectedUserDetail.gender}, {selectedUserDetail.age} yrs
                </p>
              </div>
            </div>

            <div className="space-y-2 text-xs">
              <p><span className="text-slate-400">Bio:</span> {selectedUserDetail.bio || 'None'}</p>
              <p><span className="text-slate-400">Relationship Goals:</span> {selectedUserDetail.relationshipGoals}</p>
              <p><span className="text-slate-400">Account Role:</span> <span className="uppercase font-mono font-bold text-amber-400">{selectedUserDetail.role || 'User'}</span></p>
              <p><span className="text-slate-400">Member Since:</span> {selectedUserDetail.createdAt ? new Date(selectedUserDetail.createdAt).toLocaleDateString() : 'N/A'}</p>
            </div>

            <div className="pt-3 border-t border-white/10 flex justify-end">
              <button
                onClick={() => setSelectedUserDetail(null)}
                className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white font-bold text-xs rounded-xl"
              >
                Close Profile
              </button>
            </div>
          </div>
        </div>
      )}

      {/* BAN DURATION SELECTION MODAL */}
      {showBanModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0a0a0b]/80 backdrop-blur-xl">
          <div className="w-full max-w-sm bg-[#121216] border border-rose-500/40 rounded-3xl p-6 text-white space-y-4 shadow-2xl">
            <h3 className="text-lg font-black text-rose-400 flex items-center gap-2">
              <Ban className="w-5 h-5" /> Ban User Account
            </h3>
            <p className="text-xs text-slate-400">Select ban duration for this account:</p>

            <div className="space-y-2">
              <button
                onClick={() => setBanDuration(30)}
                className={`w-full p-3 rounded-2xl border text-xs font-bold text-left transition-all ${
                  banDuration === 30 ? 'bg-amber-500/20 border-amber-500 text-amber-300' : 'bg-white/5 border-white/10 text-slate-300'
                }`}
              >
                ⏱️ Temporary 30 Days Ban
              </button>
              <button
                onClick={() => setBanDuration(0)}
                className={`w-full p-3 rounded-2xl border text-xs font-bold text-left transition-all ${
                  banDuration === 0 ? 'bg-rose-500/20 border-rose-500 text-rose-300' : 'bg-white/5 border-white/10 text-slate-300'
                }`}
              >
                🚫 Permanent Account Ban
              </button>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setShowBanModal(null)}
                className="flex-1 py-2.5 bg-white/10 text-slate-300 font-bold text-xs rounded-xl"
              >
                Cancel
              </button>
              <button
                onClick={() => handleExecuteBan(showBanModal)}
                className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl shadow-lg"
              >
                Confirm Ban
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AD CREATE / EDIT MODAL */}
      {showAdModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0a0a0b]/80 backdrop-blur-xl">
          <form onSubmit={handleSaveAd} className="w-full max-w-md bg-[#121216] border border-white/10 rounded-3xl p-6 text-white space-y-3.5 shadow-2xl">
            <h3 className="text-lg font-black text-amber-300">Create Promotional Campaign</h3>

            <div>
              <label className="block text-[11px] font-bold text-slate-300 mb-1">Campaign Title</label>
              <input
                type="text"
                required
                value={adForm.title}
                onChange={(e) => setAdForm({ ...adForm, title: e.target.value })}
                placeholder="e.g. Copperbelt PEWA Meetup 2026"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-300 mb-1">Campaign Description</label>
              <textarea
                rows={2}
                value={adForm.description}
                onChange={(e) => setAdForm({ ...adForm, description: e.target.value })}
                placeholder="Brief promotional description..."
                className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-xs text-white"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-300 mb-1">Banner Image URL</label>
              <input
                type="url"
                required
                value={adForm.imageUrl}
                onChange={(e) => setAdForm({ ...adForm, imageUrl: e.target.value })}
                placeholder="https://images.unsplash.com/..."
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-300 mb-1">Target Link / URL</label>
              <input
                type="text"
                value={adForm.targetUrl}
                onChange={(e) => setAdForm({ ...adForm, targetUrl: e.target.value })}
                placeholder="https://pewa.zm/promo"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-300 mb-1">CTA Button Text</label>
              <input
                type="text"
                value={adForm.ctaText}
                onChange={(e) => setAdForm({ ...adForm, ctaText: e.target.value })}
                placeholder="e.g. Join Event"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowAdModal(false)}
                className="flex-1 py-2.5 bg-white/10 text-slate-300 font-bold text-xs rounded-xl"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs rounded-xl shadow-lg"
              >
                Save Campaign
              </button>
            </div>
          </form>
        </div>
      )}

      {/* RESET USER PIN MODAL */}
      {resetModalReq && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0a0a0b]/80 backdrop-blur-xl">
          <form onSubmit={handleExecutePinReset} className="w-full max-w-sm bg-[#121216] border border-amber-500/50 rounded-3xl p-6 text-white space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="text-base font-black text-amber-300 flex items-center gap-2">
                <KeyRound className="w-5 h-5 text-amber-400" /> Administrator PIN Reset
              </h3>
              <button
                type="button"
                onClick={() => setResetModalReq(null)}
                className="p-1.5 text-slate-400 hover:text-white bg-white/5 rounded-full"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-300">
              Reset Security PIN for user <strong className="text-white">{resetModalReq.name}</strong> ({resetModalReq.registeredPhone || resetModalReq.registeredEmail}).
            </p>

            {resetModalMsg && (
              <div className="p-3 bg-rose-500/20 border border-rose-500/40 rounded-2xl text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{resetModalMsg}</span>
              </div>
            )}

            <div>
              <label className="block text-[11px] font-bold text-slate-300 mb-1">New 4-Digit Security PIN</label>
              <input
                type="password"
                maxLength={4}
                required
                value={newPinInput}
                onChange={(e) => setNewPinInput(e.target.value.replace(/\D/g, ''))}
                placeholder="1234"
                className="w-full bg-white/5 border border-amber-500/60 rounded-2xl py-3 text-center text-2xl font-mono tracking-widest text-amber-300 focus:outline-none focus:border-amber-400 shadow-inner"
              />
              <p className="text-[10px] text-slate-400 mt-1 text-center">
                This PIN will be securely hashed with SHA-256 before saving to Firebase.
              </p>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setResetModalReq(null)}
                className="flex-1 py-2.5 bg-white/10 text-slate-300 font-bold text-xs rounded-xl"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmittingReset || newPinInput.length !== 4}
                className="flex-1 py-2.5 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 font-black text-xs text-slate-950 rounded-xl shadow-lg disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                {isSubmittingReset ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Resetting...</span>
                  </>
                ) : (
                  <span>Set New PIN</span>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* EDIT POST MODAL */}
      {editingPost && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0a0a0b]/80 backdrop-blur-xl">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!editingPost) return;
              PEWADatabaseService.editPost(editingPost.id, {
                content: editPostContent,
                mediaUrl: editPostMediaUrl || undefined
              });
              setEditingPost(null);
              loadAdminData();
            }}
            className="w-full max-w-lg bg-[#121216] border border-sky-500/50 rounded-3xl p-6 text-white space-y-4 shadow-2xl animate-fadeIn"
          >
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="text-base font-black text-sky-300 flex items-center gap-2">
                <Edit3 className="w-5 h-5 text-sky-400" /> Administrator Edit Post
              </h3>
              <button
                type="button"
                onClick={() => setEditingPost(null)}
                className="p-1.5 text-slate-400 hover:text-white bg-white/5 rounded-full"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">Post Content</label>
              <textarea
                rows={4}
                required
                value={editPostContent}
                onChange={(e) => setEditPostContent(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-2xl p-3 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-sky-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">Media URL (Optional Image/Video)</label>
              <input
                type="text"
                value={editPostMediaUrl}
                onChange={(e) => setEditPostMediaUrl(e.target.value)}
                placeholder="https://..."
                className="w-full bg-white/5 border border-white/10 rounded-2xl p-3 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-sky-500"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEditingPost(null)}
                className="flex-1 py-2.5 bg-white/10 text-slate-300 font-bold text-xs rounded-xl"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 py-2.5 bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-600 hover:to-blue-700 font-black text-xs text-white rounded-xl shadow-lg flex items-center justify-center gap-1.5"
              >
                <span>Save Post Changes</span>
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
