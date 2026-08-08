import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  User,
  Shield,
  Lock,
  MessageSquare,
  Bell,
  Sun,
  Moon,
  Globe,
  HelpCircle,
  Info,
  ChevronRight,
  Camera,
  Check,
  Smartphone,
  MessageCircle,
  ExternalLink,
  Trash2,
  Key,
  ShieldCheck,
  Eye,
  EyeOff,
  Download,
  LogOut,
  Laptop,
  CheckCircle2,
  Sparkles,
  Volume2,
  Radio,
  FileText,
  Rocket,
  Megaphone,
  Copy,
  Upload,
  X,
  Plus,
  AlertTriangle,
  ZoomIn
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { PEWADatabaseService } from '../../services/db';
import { ImageVerificationService } from '../../services/imageVerification';
import { uploadImageWithProgress, DEFAULT_USER_AVATAR } from '../../services/cloudinary';
import { SystemConfig, ManagedUserDisplayItem, UserProfile } from '../../types';
import { calculateAge } from '../../services/phone';
import { BalloonIcon } from '../common/BalloonIcon';
import { ChatSettingsService, CustomChatSettings } from '../../services/chatSettings';
import { requestOneSignalPushPermission } from '../../services/onesignal';

interface SettingsPageProps {
  onBack: () => void;
}

type SettingsSection =
  | 'main'
  | 'verify-account'
  | 'promote'
  | 'boost-posts'
  | 'advertise-with-us'
  | 'account'
  | 'privacy'
  | 'security'
  | 'chat'
  | 'notifications'
  | 'theme'
  | 'language'
  | 'help'
  | 'about'
  | 'pops';

export const SettingsPage: React.FC<SettingsPageProps> = ({ onBack }) => {
  const { currentUser, updateCurrentUserProfile, logout, deleteCurrentAccount } = useAuth();
  const [activeSection, setActiveSection] = useState<SettingsSection>('main');

  // Pops & Blocked Users State
  const [popsTab, setPopsTab] = useState<'popped' | 'blocked'>('popped');
  const [poppedUsersList, setPoppedUsersList] = useState<ManagedUserDisplayItem[]>(() => {
    return currentUser ? PEWADatabaseService.getPoppedUsers(currentUser.uid) : [];
  });
  const [blockedUsersList, setBlockedUsersList] = useState<ManagedUserDisplayItem[]>(() => {
    return currentUser ? PEWADatabaseService.getBlockedUsers(currentUser.uid) : [];
  });

  useEffect(() => {
    if (currentUser) {
      setPoppedUsersList(PEWADatabaseService.getPoppedUsers(currentUser.uid));
      setBlockedUsersList(PEWADatabaseService.getBlockedUsers(currentUser.uid));
    }
  }, [currentUser?.uid, activeSection, popsTab]);

  const handleUnpop = (targetUserId: string) => {
    if (!currentUser) return;
    const res = PEWADatabaseService.unpopUser(currentUser.uid, targetUserId);
    updateCurrentUserProfile({ popsCount: res.totalPops });
    setPoppedUsersList(PEWADatabaseService.getPoppedUsers(currentUser.uid));
    window.dispatchEvent(new Event('pewa_pops_updated'));
  };

  const handleUnblock = (targetUserId: string) => {
    if (!currentUser) return;
    PEWADatabaseService.unblockUser(currentUser.uid, targetUserId);
    setBlockedUsersList(PEWADatabaseService.getBlockedUsers(currentUser.uid));
    window.dispatchEvent(new Event('pewa_pops_updated'));
  };

  // System config from DB (for WhatsApp support number, support email, terms, etc.)
  const [sysConfig, setSysConfig] = useState<SystemConfig>(() => PEWADatabaseService.getSystemConfig());

  // Theme state
  const [themeMode, setThemeMode] = useState<'light' | 'dark' | 'system'>(() => {
    const saved = localStorage.getItem('pewa_theme_mode');
    return (saved as 'light' | 'dark' | 'system') || 'dark';
  });

  // Language state
  const [currentLang, setCurrentLang] = useState<string>(() => {
    return localStorage.getItem('pewa_language') || 'English';
  });

  // Account editing states
  const [accountFullName, setAccountFullName] = useState(currentUser?.fullName || '');
  const [accountUsername, setAccountUsername] = useState(currentUser?.username || '');
  const [accountEmail, setAccountEmail] = useState(currentUser?.email || '');
  const [accountPhone, setAccountPhone] = useState(currentUser?.phone || '');
  const [accountDob, setAccountDob] = useState(currentUser?.dob || '');
  const [accountGender, setAccountGender] = useState(currentUser?.gender || 'Male');
  const [accountBio, setAccountBio] = useState(currentUser?.bio || '');
  const [accountAvatar, setAccountAvatar] = useState(currentUser?.avatar || '');

  // Physical Information
  const [accountHeight, setAccountHeight] = useState(currentUser?.height || '175 cm');
  const [accountSkinTone, setAccountSkinTone] = useState(currentUser?.skinTone || 'Fair');
  const [accountHairColor, setAccountHairColor] = useState(currentUser?.hairColor || 'Dark Brown');
  const [accountEyeColor, setAccountEyeColor] = useState(currentUser?.eyeColor || 'Brown');
  const [accountBodyType, setAccountBodyType] = useState(currentUser?.bodyType || 'Average');
  const [accountCountry, setAccountCountry] = useState(currentUser?.country || 'Zambia');
  const [accountCity, setAccountCity] = useState(currentUser?.city || 'Lusaka');

  // Lifestyle & Party/Club Preferences
  const [accountDrinking, setAccountDrinking] = useState<string>(currentUser?.lifestylePreferences?.drinking || currentUser?.lifestyle?.drinking || 'Never');
  const [accountSmoking, setAccountSmoking] = useState<string>(currentUser?.lifestylePreferences?.smoking || currentUser?.lifestyle?.smoking || 'Never');
  const [accountEnjoysParties, setAccountEnjoysParties] = useState<'Yes' | 'No' | 'Sometimes'>(currentUser?.enjoysParties || 'Sometimes');
  const [accountPartyPrefs, setAccountPartyPrefs] = useState<string[]>(currentUser?.partyPreferences || ['House parties', 'Outdoor events']);
  const [accountClubPrefs, setAccountClubPrefs] = useState<string[]>(currentUser?.clubPreferences || ['Luxury lounges', 'Bars']);
  const [accountSocialPlaces, setAccountSocialPlaces] = useState<string>(currentUser?.favoriteSocialPlaces?.join(', ') || 'Rooftop cafes, Lounge bars');

  // Interests
  const [accountHobbies, setAccountHobbies] = useState<string>(currentUser?.hobbies?.join(', ') || 'Photography, Travel');
  const [accountActivities, setAccountActivities] = useState<string>(currentUser?.favoriteActivities?.join(', ') || 'Hiking, Dining');
  const [accountMusic, setAccountMusic] = useState<string>(currentUser?.musicInterests?.join(', ') || 'Afrobeats, Pop');
  const [accountSports, setAccountSports] = useState<string>(currentUser?.sports?.join(', ') || 'Football, Swimming');
  const [accountEntertainment, setAccountEntertainment] = useState<string>(currentUser?.entertainmentPreferences?.join(', ') || 'Movies, Comedy');
  const [accountLifestyleInterests, setAccountLifestyleInterests] = useState<string>(currentUser?.lifestyleInterests?.join(', ') || 'Fashion, Fitness');

  // Profile Photos (5 Max: 3 Main required + 2 Additional)
  const [photosFullBody, setPhotosFullBody] = useState<string>(currentUser?.profilePhotos?.fullBody || '');
  const [photosNormalFace, setPhotosNormalFace] = useState<string>(currentUser?.profilePhotos?.normalFace || currentUser?.avatar || '');
  const [photosNaturalPhoto, setPhotosNaturalPhoto] = useState<string>(currentUser?.profilePhotos?.naturalPhoto || '');
  const [photosExtra1, setPhotosExtra1] = useState<string>(currentUser?.profilePhotos?.extra1 || '');
  const [photosExtra2, setPhotosExtra2] = useState<string>(currentUser?.profilePhotos?.extra2 || '');
  const [photoUploadingSlot, setPhotoUploadingSlot] = useState<string | null>(null);

  // Filter Verification Error Modal / Message
  const [imageVerificationError, setImageVerificationError] = useState<string | null>(null);

  // Privacy Controls
  const [profileVis, setProfileVis] = useState<'everyone' | 'verified_only' | 'hidden'>(
    (currentUser?.settings?.privacy?.profileVisibility as any) || 'everyone'
  );
  const [photosVis, setPhotosVis] = useState<'everyone' | 'verified_only' | 'hidden'>(
    currentUser?.settings?.privacy?.photosVisibility || 'everyone'
  );

  // Change Password / PIN State
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [pinChangeMsg, setPinChangeMsg] = useState('');

  // Privacy states
  const [whoCanMessage, setWhoCanMessage] = useState<'everyone' | 'matched' | 'verified'>('everyone');
  const [whoCanSeeProfile, setWhoCanSeeProfile] = useState<'everyone' | 'matched' | 'none'>('everyone');
  const [whoCanSeeOnline, setWhoCanSeeOnline] = useState<'everyone' | 'matched' | 'nobody'>('everyone');
  const [lastSeenVis, setLastSeenVis] = useState<'everyone' | 'matched' | 'nobody'>('everyone');
  const [profilePhotoVis, setProfilePhotoVis] = useState<'everyone' | 'matched' | 'nobody'>('everyone');
  const [isPrivateAccount, setIsPrivateAccount] = useState(false);

  // Security states
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);

  // Chat settings states
  const [chatSettings, setChatSettings] = useState<CustomChatSettings>(() => ChatSettingsService.getSettings());

  const handleUpdateChatSetting = <K extends keyof CustomChatSettings>(key: K, value: CustomChatSettings[K]) => {
    const updated = ChatSettingsService.saveSettings({ [key]: value });
    setChatSettings(updated);
  };

  // Notifications states
  const [pushNotifications, setPushNotifications] = useState(
    currentUser?.settings?.pushNotifications !== false
  );
  const [msgNotifs, setMsgNotifs] = useState(
    currentUser?.settings?.notificationPreferences?.messageNotifications !== false
  );
  const [findLoveNotifs, setFindLoveNotifs] = useState(
    currentUser?.settings?.notificationPreferences?.findLoveNotifications !== false
  );
  const [sugarsNotifs, setSugarsNotifs] = useState(
    currentUser?.settings?.notificationPreferences?.sugarsNotifications !== false
  );
  const [broadcastNotifs, setBroadcastNotifs] = useState(
    currentUser?.settings?.notificationPreferences?.broadcastNotifications !== false
  );
  const [verificationNotifs, setVerificationNotifs] = useState(
    currentUser?.settings?.notificationPreferences?.verificationNotifications !== false
  );
  const [pushPermStatus, setPushPermStatus] = useState<'default' | 'granted' | 'denied'>('default');

  // --- VERIFICATION FORM DRAFT STATE & PERSISTENCE ---
  const [verifyStep, setVerifyStep] = useState<1 | 2 | 3 | 4>(() => {
    try {
      const saved = sessionStorage.getItem('pewa_draft_verification');
      if (saved) return JSON.parse(saved).step || 1;
    } catch (_) {}
    return 1;
  });
  const [verifyFirstName, setVerifyFirstName] = useState<string>(() => {
    try {
      const saved = sessionStorage.getItem('pewa_draft_verification');
      if (saved) return JSON.parse(saved).firstName || '';
    } catch (_) {}
    return currentUser?.fullName?.split(' ')[0] || '';
  });
  const [verifyLastName, setVerifyLastName] = useState<string>(() => {
    try {
      const saved = sessionStorage.getItem('pewa_draft_verification');
      if (saved) return JSON.parse(saved).lastName || '';
    } catch (_) {}
    return currentUser?.fullName?.split(' ').slice(1).join(' ') || '';
  });
  const [verifyPlan, setVerifyPlan] = useState<'monthly' | 'yearly'>(() => {
    try {
      const saved = sessionStorage.getItem('pewa_draft_verification');
      if (saved) return JSON.parse(saved).plan || 'monthly';
    } catch (_) {}
    return 'monthly';
  });
  const [verifyIdFront, setVerifyIdFront] = useState<string>(() => {
    try {
      const saved = sessionStorage.getItem('pewa_draft_verification');
      if (saved) return JSON.parse(saved).idFrontUrl || '';
    } catch (_) {}
    return '';
  });
  const [verifyIdBack, setVerifyIdBack] = useState<string>(() => {
    try {
      const saved = sessionStorage.getItem('pewa_draft_verification');
      if (saved) return JSON.parse(saved).idBackUrl || '';
    } catch (_) {}
    return '';
  });
  const [verifySelfie, setVerifySelfie] = useState<string>(() => {
    try {
      const saved = sessionStorage.getItem('pewa_draft_verification');
      if (saved) return JSON.parse(saved).selfieUrl || '';
    } catch (_) {}
    return '';
  });
  const [verifyPaymentScreenshot, setVerifyPaymentScreenshot] = useState<string>(() => {
    try {
      const saved = sessionStorage.getItem('pewa_draft_verification');
      if (saved) return JSON.parse(saved).paymentScreenshotUrl || '';
    } catch (_) {}
    return '';
  });
  const [verifyUploading, setVerifyUploading] = useState<string>('');
  const [verifyError, setVerifyError] = useState('');
  const [verifySubmittedSuccess, setVerifySubmittedSuccess] = useState(false);
  const [copyNotice, setCopyNotice] = useState('');
  const [showDemoFullscreen, setShowDemoFullscreen] = useState(false);

  useEffect(() => {
    try {
      sessionStorage.setItem('pewa_draft_verification', JSON.stringify({
        step: verifyStep,
        firstName: verifyFirstName,
        lastName: verifyLastName,
        plan: verifyPlan,
        idFrontUrl: verifyIdFront,
        idBackUrl: verifyIdBack,
        selfieUrl: verifySelfie,
        paymentScreenshotUrl: verifyPaymentScreenshot
      }));
    } catch (_) {}
  }, [verifyStep, verifyFirstName, verifyLastName, verifyPlan, verifyIdFront, verifyIdBack, verifySelfie, verifyPaymentScreenshot]);

  // --- BOOST POST DRAFT STATE & PERSISTENCE ---
  const [boostStep, setBoostStep] = useState<1 | 2 | 3>(() => {
    try {
      const saved = sessionStorage.getItem('pewa_draft_boost');
      if (saved) return JSON.parse(saved).step || 1;
    } catch (_) {}
    return 1;
  });
  const [boostSelectedPostId, setBoostSelectedPostId] = useState<string>(() => {
    try {
      const saved = sessionStorage.getItem('pewa_draft_boost');
      if (saved) return JSON.parse(saved).postId || '';
    } catch (_) {}
    return '';
  });
  const [boostTargetCountries, setBoostTargetCountries] = useState<string[]>(() => {
    try {
      const saved = sessionStorage.getItem('pewa_draft_boost');
      if (saved) return JSON.parse(saved).targetCountries || ['Zambia'];
    } catch (_) {}
    return ['Zambia'];
  });
  const [boostTargetAudience, setBoostTargetAudience] = useState<string>(() => {
    try {
      const saved = sessionStorage.getItem('pewa_draft_boost');
      if (saved) return JSON.parse(saved).targetAudience || 'All Members';
    } catch (_) {}
    return 'All Members';
  });
  const [boostDays, setBoostDays] = useState<number>(() => {
    try {
      const saved = sessionStorage.getItem('pewa_draft_boost');
      if (saved) return JSON.parse(saved).days || 3;
    } catch (_) {}
    return 3;
  });
  const [boostPaymentScreenshot, setBoostPaymentScreenshot] = useState<string>(() => {
    try {
      const saved = sessionStorage.getItem('pewa_draft_boost');
      if (saved) return JSON.parse(saved).paymentScreenshotUrl || '';
    } catch (_) {}
    return '';
  });
  const [boostUploading, setBoostUploading] = useState(false);
  const [boostError, setBoostError] = useState('');
  const [boostSubmittedSuccess, setBoostSubmittedSuccess] = useState(false);

  useEffect(() => {
    try {
      sessionStorage.setItem('pewa_draft_boost', JSON.stringify({
        step: boostStep,
        postId: boostSelectedPostId,
        targetCountries: boostTargetCountries,
        targetAudience: boostTargetAudience,
        days: boostDays,
        paymentScreenshotUrl: boostPaymentScreenshot
      }));
    } catch (_) {}
  }, [boostStep, boostSelectedPostId, boostTargetCountries, boostTargetAudience, boostDays, boostPaymentScreenshot]);

  // --- ADVERTISE DRAFT STATE & PERSISTENCE ---
  const [adBusinessName, setAdBusinessName] = useState(() => {
    try { const s = sessionStorage.getItem('pewa_draft_ad'); if(s) return JSON.parse(s).businessName || ''; } catch(_){} return '';
  });
  const [adContactName, setAdContactName] = useState(() => {
    try { const s = sessionStorage.getItem('pewa_draft_ad'); if(s) return JSON.parse(s).contactName || currentUser?.fullName || ''; } catch(_){} return currentUser?.fullName || '';
  });
  const [adPhone, setAdPhone] = useState(() => {
    try { const s = sessionStorage.getItem('pewa_draft_ad'); if(s) return JSON.parse(s).phone || currentUser?.phone || ''; } catch(_){} return currentUser?.phone || '';
  });
  const [adEmail, setAdEmail] = useState(() => {
    try { const s = sessionStorage.getItem('pewa_draft_ad'); if(s) return JSON.parse(s).email || currentUser?.email || ''; } catch(_){} return currentUser?.email || '';
  });
  const [adDescription, setAdDescription] = useState(() => {
    try { const s = sessionStorage.getItem('pewa_draft_ad'); if(s) return JSON.parse(s).description || ''; } catch(_){} return '';
  });
  const [adBannerUrl, setAdBannerUrl] = useState(() => {
    try { const s = sessionStorage.getItem('pewa_draft_ad'); if(s) return JSON.parse(s).bannerUrl || ''; } catch(_){} return '';
  });
  const [adDuration, setAdDuration] = useState(() => {
    try { const s = sessionStorage.getItem('pewa_draft_ad'); if(s) return JSON.parse(s).duration || '7 Days (K150)'; } catch(_){} return '7 Days (K150)';
  });
  const [adPaymentScreenshot, setAdPaymentScreenshot] = useState(() => {
    try { const s = sessionStorage.getItem('pewa_draft_ad'); if(s) return JSON.parse(s).paymentScreenshotUrl || ''; } catch(_){} return '';
  });
  const [adUploading, setAdUploading] = useState(false);
  const [adError, setAdError] = useState('');
  const [adSubmittedSuccess, setAdSubmittedSuccess] = useState(false);

  useEffect(() => {
    try {
      sessionStorage.setItem('pewa_draft_ad', JSON.stringify({
        businessName: adBusinessName,
        contactName: adContactName,
        phone: adPhone,
        email: adEmail,
        description: adDescription,
        bannerUrl: adBannerUrl,
        duration: adDuration,
        paymentScreenshotUrl: adPaymentScreenshot
      }));
    } catch (_) {}
  }, [adBusinessName, adContactName, adPhone, adEmail, adDescription, adBannerUrl, adDuration, adPaymentScreenshot]);

  const updateNotifSetting = (key: string, value: boolean) => {
    if (!currentUser) return;
    const currentSettings = currentUser.settings || {};
    const currentPrefs = currentSettings.notificationPreferences || {
      messageNotifications: true,
      findLoveNotifications: true,
      sugarsNotifications: true,
      broadcastNotifications: true,
      verificationNotifications: true
    };

    const newPrefs = { ...currentPrefs, [key]: value };
    updateCurrentUserProfile({
      settings: {
        ...currentSettings,
        notificationPreferences: newPrefs
      }
    });
  };

  const handleEnablePushPermission = async () => {
    const granted = await requestOneSignalPushPermission();
    if (granted) {
      setPushPermStatus('granted');
      alert('✅ OneSignal Push Notifications enabled successfully!');
    } else {
      setPushPermStatus('denied');
      alert('Push notification permission was not granted.');
    }
  };

  // Uploading
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [avatarProgress, setAvatarProgress] = useState(0);

  useEffect(() => {
    // Refresh system config
    setSysConfig(PEWADatabaseService.getSystemConfig());
  }, []);

  // Theme applier
  const applyTheme = (mode: 'light' | 'dark' | 'system') => {
    setThemeMode(mode);
    localStorage.setItem('pewa_theme_mode', mode);

    if (mode === 'dark') {
      document.documentElement.classList.add('dark');
    } else if (mode === 'light') {
      document.documentElement.classList.remove('dark');
    } else {
      // System mode
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      if (prefersDark) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    }
  };

  const handleSwapPhotoSlot = (index: number, direction: 'left' | 'right') => {
    const photoValues = [photosFullBody, photosNormalFace, photosNaturalPhoto, photosExtra1, photosExtra2];
    const photoSetters = [setPhotosFullBody, setPhotosNormalFace, setPhotosNaturalPhoto, setPhotosExtra1, setPhotosExtra2];

    const targetIndex = direction === 'left' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= photoValues.length) return;

    const valA = photoValues[index];
    const valB = photoValues[targetIndex];

    photoSetters[index](valB);
    photoSetters[targetIndex](valA);

    if (index === 1 || targetIndex === 1) {
      const newNormalFace = index === 1 ? valB : valA;
      if (newNormalFace) {
        setAccountAvatar(newNormalFace);
      }
    }
  };

  const handleClearPhotoSlot = (slot: 'fullBody' | 'normalFace' | 'naturalPhoto' | 'extra1' | 'extra2') => {
    if (slot === 'fullBody') setPhotosFullBody('');
    if (slot === 'normalFace') setPhotosNormalFace('');
    if (slot === 'naturalPhoto') setPhotosNaturalPhoto('');
    if (slot === 'extra1') setPhotosExtra1('');
    if (slot === 'extra2') setPhotosExtra2('');
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setIsUploadingAvatar(true);
      const folder = `profiles/${currentUser?.uid || 'user'}`;
      const url = await uploadImageWithProgress(file, (p) => setAvatarProgress(p), folder);
      setAccountAvatar(url);
      updateCurrentUserProfile({ avatar: url, profilePhoto: url, profileImage: url });
      setIsUploadingAvatar(false);
    } catch (err) {
      console.warn('Avatar upload note:', err);
      setIsUploadingAvatar(false);
    } finally {
      e.target.value = '';
    }
  };

  const handlePhotoSlotUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    slot: 'fullBody' | 'normalFace' | 'naturalPhoto' | 'extra1' | 'extra2'
  ) => {
    const file = e.target.files?.[0];
    if (!file || !currentUser) return;

    setPhotoUploadingSlot(slot);
    setImageVerificationError(null);

    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const base64Data = reader.result as string;

        // Perform Filter & Authenticity Verification Check
        const verification = await ImageVerificationService.verifyImage(base64Data, currentUser.uid, slot);

        if (!verification.valid) {
          setImageVerificationError(
            verification.userMessage || "This image appears edited. Please upload a natural photo without filters."
          );
          setPhotoUploadingSlot(null);
          return;
        }

        const url = await uploadImageWithProgress(file);

        if (slot === 'fullBody') setPhotosFullBody(url);
        if (slot === 'normalFace') {
          setPhotosNormalFace(url);
          setAccountAvatar(url);
        }
        if (slot === 'naturalPhoto') setPhotosNaturalPhoto(url);
        if (slot === 'extra1') setPhotosExtra1(url);
        if (slot === 'extra2') setPhotosExtra2(url);

        setPhotoUploadingSlot(null);
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.error('Error uploading photo slot:', err);
      setImageVerificationError("Failed to process image upload. Please try again with a natural photo.");
      setPhotoUploadingSlot(null);
    } finally {
      e.target.value = '';
    }
  };

  const handleSaveAccountInfo = (e: React.FormEvent) => {
    e.preventDefault();

    // 1. Collect & Validate all edited fields
    if (!accountFullName || !accountFullName.trim()) {
      alert('⚠️ Full name is required. Please enter your name before saving.');
      return;
    }

    if (!accountUsername || !accountUsername.trim()) {
      alert('⚠️ Username is required. Please enter a username before saving.');
      return;
    }

    try {
      const calculatedAge = accountDob ? calculateAge(accountDob) : (currentUser?.age || 18);

      const verifiedPhotoList = [
        photosFullBody,
        photosNormalFace,
        photosNaturalPhoto,
        photosExtra1,
        photosExtra2
      ].filter(Boolean);

      const primaryAvatar = photosNormalFace || photosFullBody || photosNaturalPhoto || photosExtra1 || photosExtra2 || accountAvatar || DEFAULT_USER_AVATAR;

      const hobbiesArr = accountHobbies.split(',').map(s => s.trim()).filter(Boolean);
      const activitiesArr = accountActivities.split(',').map(s => s.trim()).filter(Boolean);
      const musicArr = accountMusic.split(',').map(s => s.trim()).filter(Boolean);
      const sportsArr = accountSports.split(',').map(s => s.trim()).filter(Boolean);
      const entertainmentArr = accountEntertainment.split(',').map(s => s.trim()).filter(Boolean);
      const lifestyleInterestsArr = accountLifestyleInterests.split(',').map(s => s.trim()).filter(Boolean);

      const combinedInterests = Array.from(new Set([
        ...hobbiesArr,
        ...activitiesArr,
        ...musicArr,
        ...sportsArr,
        ...entertainmentArr,
        ...lifestyleInterestsArr
      ]));

      const updates: Partial<UserProfile> = {
        fullName: accountFullName.trim(),
        username: accountUsername.trim(),
        email: accountEmail.trim(),
        phone: accountPhone.trim(),
        dob: accountDob,
        age: calculatedAge,
        gender: accountGender as any,
        country: accountCountry.trim(),
        city: accountCity.trim(),
        height: accountHeight.trim(),
        skinTone: accountSkinTone,
        hairColor: accountHairColor,
        eyeColor: accountEyeColor,
        bodyType: accountBodyType,
        bio: accountBio.trim(),
        avatar: primaryAvatar,
        profilePhoto: primaryAvatar,
        profileImage: primaryAvatar,
        enjoysParties: accountEnjoysParties,
        partyPreferences: accountPartyPrefs,
        clubPreferences: accountClubPrefs,
        favoriteSocialPlaces: accountSocialPlaces.split(',').map(s => s.trim()).filter(Boolean),
        hobbies: hobbiesArr,
        favoriteActivities: activitiesArr,
        musicInterests: musicArr,
        sports: sportsArr,
        entertainmentPreferences: entertainmentArr,
        lifestyleInterests: lifestyleInterestsArr,
        interests: combinedInterests,
        lifestyle: {
          ...currentUser?.lifestyle,
          drinking: accountDrinking as any,
          smoking: accountSmoking as any,
          partying: (accountEnjoysParties === 'Yes' ? 'Weekends' : accountEnjoysParties === 'No' ? 'Never' : 'Weekends') as any,
          sexualActivity: currentUser?.lifestyle?.sexualActivity || 'Moderate'
        },
        lifestylePreferences: {
          ...currentUser?.lifestylePreferences,
          drinking: accountDrinking,
          smoking: accountSmoking,
          partying: accountPartyPrefs.join(', '),
          relationshipStatus: currentUser?.relationshipOrientation || 'Single'
        },
        profilePhotos: {
          fullBody: photosFullBody,
          normalFace: photosNormalFace,
          naturalPhoto: photosNaturalPhoto,
          extra1: photosExtra1,
          extra2: photosExtra2
        },
        verifiedPhotos: verifiedPhotoList,
        settings: {
          ...currentUser?.settings,
          privacy: {
            ...currentUser?.settings?.privacy,
            profileVisibility: profileVis as any,
            photosVisibility: photosVis
          }
        }
      };

      const updatedUser = updateCurrentUserProfile(updates);
      if (!updatedUser) {
        throw new Error('Could not update user profile record in database');
      }

      alert('✅ Account details and profile photos updated successfully!');
    } catch (err: any) {
      console.error('Save Account Info Error:', err);
      alert(`❌ Failed to save account changes: ${err?.message || 'Unknown database error'}. Your edits have been kept on screen — please try again.`);
    }
  };

  const handleChangePin = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPin.length < 4) {
      setPinChangeMsg('PIN must be at least 4 digits.');
      return;
    }
    if (newPin !== confirmPin) {
      setPinChangeMsg('PINs do not match.');
      return;
    }
    updateCurrentUserProfile({ pinHash: newPin });
    setPinChangeMsg('✅ Security PIN updated successfully!');
    setNewPin('');
    setConfirmPin('');
  };

  const handleWhatsAppChat = () => {
    const rawNumber = sysConfig.supportWhatsappNumber || '+260961968962';
    const cleanNumber = rawNumber.replace(/[^0-9]/g, '');
    const message = encodeURIComponent('Hello PEWA Support, I need assistance with my account.');
    window.open(`https://wa.me/${cleanNumber}?text=${message}`, '_blank');
  };

  const handleDownloadData = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(currentUser, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `pewa_account_${currentUser?.username || 'user'}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  if (!currentUser) return null;

  return (
    <div className="fixed inset-0 z-50 bg-[#0a0a0d] text-slate-100 flex flex-col font-sans overflow-hidden">
      {/* Settings Top Header */}
      <header className="sticky top-0 z-10 bg-[#121218]/95 backdrop-blur-xl border-b border-white/10 px-4 py-3.5 flex items-center justify-between shadow-lg">
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              if (activeSection === 'main') {
                onBack();
              } else if (activeSection === 'boost-posts' || activeSection === 'advertise-with-us') {
                setActiveSection('promote');
              } else {
                setActiveSection('main');
              }
            }}
            className="p-2.5 bg-white/5 hover:bg-white/10 rounded-2xl text-slate-300 hover:text-white border border-white/10 transition-all active:scale-95"
            aria-label="Back"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="font-black text-lg sm:text-xl text-white tracking-tight flex items-center gap-2">
              {activeSection === 'main' && 'PEWA Settings'}
              {activeSection === 'verify-account' && 'Verify Account'}
              {activeSection === 'promote' && 'Promote & Marketing'}
              {activeSection === 'boost-posts' && 'Boost Your Posts'}
              {activeSection === 'advertise-with-us' && 'Advertise With Us'}
              {activeSection === 'account' && 'Account Settings'}
              {activeSection === 'privacy' && 'Privacy Settings'}
              {activeSection === 'security' && 'Security Settings'}
              {activeSection === 'chat' && 'Chat Settings'}
              {activeSection === 'notifications' && 'Notification Settings'}
              {activeSection === 'theme' && 'Theme Settings'}
              {activeSection === 'language' && 'Language Settings'}
              {activeSection === 'help' && 'Help & Support'}
              {activeSection === 'about' && 'About PEWA'}
              {activeSection === 'pops' && 'Pops'}
            </h1>
            <p className="text-[11px] text-slate-400">
              {activeSection === 'main' ? 'Manage your account preferences & system privacy' : 'Customization & Controls'}
            </p>
          </div>
        </div>
      </header>

      {/* Main Settings Scroll Area */}
      <main className="flex-1 overflow-y-auto p-4 max-w-2xl mx-auto w-full space-y-4 pb-24">
        
        {/* SECTION 1: MAIN SETTINGS MENU */}
        {activeSection === 'main' && (
          <div className="space-y-4 animate-fadeIn">

            {/* BEST OFFERS SECTION - AT VERY TOP OF SETTINGS PAGE */}
            <div className="bg-gradient-to-r from-amber-500/15 via-pink-500/15 to-purple-500/15 border border-amber-500/40 rounded-3xl p-4 shadow-xl backdrop-blur-md space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-amber-500/20 text-amber-300 rounded-xl border border-amber-500/30">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <h2 className="font-black text-base text-amber-300 tracking-tight">Best Offers</h2>
                </div>
                <span className="px-2.5 py-0.5 bg-amber-500/20 text-amber-300 border border-amber-500/40 rounded-full text-[10px] font-black uppercase tracking-wider">
                  Featured
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {/* Verify Account Button */}
                <button
                  onClick={() => {
                    setVerifySubmittedSuccess(false);
                    setActiveSection('verify-account');
                  }}
                  className="p-3.5 bg-[#121216]/90 hover:bg-[#181824] border border-pink-500/40 hover:border-pink-500/80 rounded-2xl flex items-center justify-between text-left transition-all group shadow-lg"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-pink-500/20 text-pink-400 rounded-xl border border-pink-500/30 group-hover:scale-105 transition-transform">
                      <ShieldCheck className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-extrabold text-sm text-white flex items-center gap-1 group-hover:text-pink-300">
                        Verify Account
                      </h3>
                      <p className="text-[11px] text-slate-400">Get official blue checkmark</p>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-pink-400 group-hover:translate-x-1 transition-transform" />
                </button>

                {/* Promote Button */}
                <button
                  onClick={() => {
                    setActiveSection('promote');
                  }}
                  className="p-3.5 bg-[#121216]/90 hover:bg-[#181824] border border-amber-500/40 hover:border-amber-500/80 rounded-2xl flex items-center justify-between text-left transition-all group shadow-lg"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-amber-500/20 text-amber-400 rounded-xl border border-amber-500/30 group-hover:scale-105 transition-transform">
                      <Rocket className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-extrabold text-sm text-white flex items-center gap-1 group-hover:text-amber-300">
                        Promote
                      </h3>
                      <p className="text-[11px] text-slate-400">Boost posts & advertise</p>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-amber-400 group-hover:translate-x-1 transition-transform" />
                </button>
              </div>
            </div>
            {/* User Profile Summary Card */}
            <div
              onClick={() => setActiveSection('account')}
              className="bg-[#14141d] border border-white/10 rounded-3xl p-4 flex items-center justify-between hover:border-pink-500/40 cursor-pointer transition-all shadow-xl backdrop-blur-md group"
            >
              <div className="flex items-center gap-3.5">
                <img
                  src={currentUser.avatar || currentUser.profilePhoto || currentUser.profileImage || DEFAULT_USER_AVATAR}
                  alt={currentUser.fullName}
                  className="w-14 h-14 rounded-2xl object-cover border-2 border-pink-500/50 shadow-md group-hover:scale-105 transition-transform"
                  referrerPolicy="no-referrer"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = DEFAULT_USER_AVATAR;
                  }}
                />
                <div>
                  <div className="flex items-center gap-1.5">
                    <h2 className="font-extrabold text-base text-white">{currentUser.fullName}</h2>
                    {currentUser.verified && <ShieldCheck className="w-4 h-4 text-pink-500" />}
                  </div>
                  <p className="text-xs text-slate-400">@{currentUser.username} • {currentUser.email || currentUser.phone}</p>
                  <span className="inline-block mt-1 text-[10px] font-bold text-pink-400 bg-pink-500/10 px-2.5 py-0.5 rounded-full border border-pink-500/20">
                    Edit Profile Details
                  </span>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-slate-500 group-hover:text-pink-400 group-hover:translate-x-1 transition-all" />
            </div>

            {/* List of 9 Main Settings Categories */}
            <div className="bg-[#14141d] border border-white/10 rounded-3xl overflow-hidden shadow-xl divide-y divide-white/5">
              {[
                { id: 'account', title: 'Account Settings', desc: 'Profile photo, details, security PIN & deletion', icon: User, color: 'text-pink-400', bg: 'bg-pink-500/10' },
                { id: 'privacy', title: 'Privacy Settings', desc: 'Message limits, visibility & blocked users', icon: Shield, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
                { id: 'pops', title: 'Pops', desc: 'Manage popped users & blocked accounts', icon: BalloonIcon, color: 'text-purple-400', bg: 'bg-purple-500/10' },
                { id: 'security', title: 'Security Settings', desc: 'Two-factor auth, active sessions & trusted devices', icon: Lock, color: 'text-amber-400', bg: 'bg-amber-500/10' },
                { id: 'chat', title: 'Chat Settings', desc: 'Wallpaper, font size, media auto-download & receipts', icon: MessageSquare, color: 'text-sky-400', bg: 'bg-sky-500/10' },
                { id: 'notifications', title: 'Notification Settings', desc: 'Alerts, sound effects & message popups', icon: Bell, color: 'text-purple-400', bg: 'bg-purple-500/10' },
                { id: 'theme', title: 'Theme Settings', desc: 'Light Mode, Dark Mode or System sync', icon: Sun, color: 'text-amber-300', bg: 'bg-amber-400/10' },
                { id: 'language', title: 'Language Settings', desc: `Current: ${currentLang}`, icon: Globe, color: 'text-indigo-400', bg: 'bg-indigo-500/10' },
                { id: 'help', title: 'Help & Support', desc: 'WhatsApp live chat, support email & FAQs', icon: HelpCircle, color: 'text-emerald-300', bg: 'bg-emerald-400/10' },
                { id: 'about', title: 'About PEWA', desc: 'App version, Terms, Privacy Policy & Guidelines', icon: Info, color: 'text-rose-400', bg: 'bg-rose-500/10' }
              ].map((item) => {
                const IconComp = item.icon;
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveSection(item.id as SettingsSection)}
                    className="w-full p-4 flex items-center justify-between hover:bg-white/5 text-left transition-colors group"
                  >
                    <div className="flex items-center gap-3.5">
                      <div className={`p-3 rounded-2xl ${item.bg} ${item.color} border border-white/5 shadow-inner`}>
                        <IconComp className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="font-bold text-sm text-slate-100 group-hover:text-white">{item.title}</h3>
                        <p className="text-xs text-slate-400">{item.desc}</p>
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-slate-500 group-hover:text-white group-hover:translate-x-1 transition-all" />
                  </button>
                );
              })}
            </div>

            {/* Logout & Delete Actions */}
            <div className="pt-2 space-y-2">
              <button
                onClick={logout}
                className="w-full p-3.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 font-bold text-sm rounded-2xl border border-rose-500/20 flex items-center justify-center gap-2 transition-all"
              >
                <LogOut className="w-4 h-4" /> Log Out of Account
              </button>
            </div>
          </div>
        )}

        {/* SECTION 2: ACCOUNT SETTINGS */}
        {activeSection === 'account' && (
          <div className="space-y-5 animate-fadeIn">
            {/* Filter Rejection Banner Modal */}
            {imageVerificationError && (
              <div className="bg-rose-500/15 border-2 border-rose-500/40 rounded-3xl p-4 flex items-start justify-between gap-3 text-rose-200 shadow-xl">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-6 h-6 text-rose-400 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-extrabold text-sm text-white">Image Upload Rejected</h4>
                    <p className="text-xs text-rose-200 mt-0.5 font-medium">{imageVerificationError}</p>
                  </div>
                </div>
                <button
                  onClick={() => setImageVerificationError(null)}
                  className="p-1 hover:bg-white/10 rounded-xl transition-colors"
                >
                  <X className="w-5 h-5 text-rose-300" />
                </button>
              </div>
            )}

            <form onSubmit={handleSaveAccountInfo} className="space-y-5">
              {/* 1. REQUIRED USER PROFILE IMAGES (5 MAX) */}
              <div className="bg-[#14141d] border border-white/10 rounded-3xl p-5 space-y-4 shadow-xl">
                <div className="flex items-center justify-between border-b border-white/10 pb-3">
                  <div>
                    <h3 className="font-extrabold text-sm text-white flex items-center gap-2">
                      <Camera className="w-4 h-4 text-pink-400" /> Verified Profile Photos (5 Max)
                    </h3>
                    <p className="text-[11px] text-slate-400">
                      Upload natural photos. Use the left/right arrows to reorder photo display sequence.
                    </p>
                  </div>
                  <span className="text-xs font-bold text-pink-400 bg-pink-500/10 px-3 py-1 rounded-full border border-pink-500/20">
                    Reorder & Swap
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                  {/* Slot 1: Full Body Photo */}
                  <div className="relative aspect-[3/4] rounded-2xl border-2 border-dashed border-white/15 overflow-hidden bg-black/30 group hover:border-pink-500/50 transition-all flex flex-col justify-between p-2">
                    <div className="flex items-center justify-between text-[9px] font-bold z-10">
                      <span className="bg-pink-500/20 text-pink-300 px-1.5 py-0.5 rounded border border-pink-500/30">
                        #1 Full Body
                      </span>
                      {photosFullBody ? (
                        <span className="bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded border border-emerald-500/30 flex items-center gap-0.5">
                          <CheckCircle2 className="w-2.5 h-2.5" /> Approved
                        </span>
                      ) : (
                        <span className="bg-slate-700/50 text-slate-400 px-1.5 py-0.5 rounded">
                          Required
                        </span>
                      )}
                    </div>

                    <div className="relative my-auto w-full h-full flex items-center justify-center">
                      {photosFullBody ? (
                        <img src={photosFullBody} alt="Full Body" className="w-full h-full object-cover rounded-xl" />
                      ) : (
                        <label className="w-full h-full flex flex-col items-center justify-center cursor-pointer p-2">
                          <Upload className="w-5 h-5 text-slate-400 mb-1" />
                          <span className="text-[11px] font-bold text-pink-400">Full Body</span>
                          <span className="text-[9px] text-slate-400">Required 1</span>
                          <input type="file" accept="image/*" onChange={(e) => handlePhotoSlotUpload(e, 'fullBody')} className="hidden" />
                        </label>
                      )}
                    </div>

                    {/* Action Controls Bar */}
                    <div className="flex items-center justify-between gap-1 pt-1 border-t border-white/10 z-10 bg-black/40 p-1 rounded-xl">
                      <button
                        type="button"
                        onClick={() => handleSwapPhotoSlot(0, 'left')}
                        disabled={true}
                        className="p-1 text-slate-600 cursor-not-allowed rounded"
                        title="Can't move left"
                      >
                        <ArrowLeft className="w-3.5 h-3.5" />
                      </button>

                      <label className="p-1 bg-pink-600 hover:bg-pink-500 text-white rounded cursor-pointer shadow transition-colors" title="Upload / Change Photo">
                        <Camera className="w-3.5 h-3.5" />
                        <input type="file" accept="image/*" onChange={(e) => handlePhotoSlotUpload(e, 'fullBody')} className="hidden" />
                      </label>

                      {photosFullBody && (
                        <button
                          type="button"
                          onClick={() => handleClearPhotoSlot('fullBody')}
                          className="p-1 text-rose-400 hover:text-rose-300 hover:bg-rose-500/20 rounded transition-colors"
                          title="Remove Photo"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => handleSwapPhotoSlot(0, 'right')}
                        className="p-1 text-slate-300 hover:text-white hover:bg-white/10 rounded transition-colors"
                        title="Move Right"
                      >
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {photoUploadingSlot === 'fullBody' && (
                      <div className="absolute inset-0 bg-black/85 flex items-center justify-center text-[10px] text-pink-400 font-bold z-20">
                        Verifying...
                      </div>
                    )}
                  </div>

                  {/* Slot 2: Normal Face Photo */}
                  <div className="relative aspect-[3/4] rounded-2xl border-2 border-dashed border-white/15 overflow-hidden bg-black/30 group hover:border-pink-500/50 transition-all flex flex-col justify-between p-2">
                    <div className="flex items-center justify-between text-[9px] font-bold z-10">
                      <span className="bg-pink-500/20 text-pink-300 px-1.5 py-0.5 rounded border border-pink-500/30">
                        #2 Normal Face
                      </span>
                      {photosNormalFace ? (
                        <span className="bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded border border-emerald-500/30 flex items-center gap-0.5">
                          <CheckCircle2 className="w-2.5 h-2.5" /> Approved
                        </span>
                      ) : (
                        <span className="bg-slate-700/50 text-slate-400 px-1.5 py-0.5 rounded">
                          Required
                        </span>
                      )}
                    </div>

                    <div className="relative my-auto w-full h-full flex items-center justify-center">
                      {photosNormalFace ? (
                        <img src={photosNormalFace} alt="Normal Face" className="w-full h-full object-cover rounded-xl" />
                      ) : (
                        <label className="w-full h-full flex flex-col items-center justify-center cursor-pointer p-2">
                          <Upload className="w-5 h-5 text-slate-400 mb-1" />
                          <span className="text-[11px] font-bold text-pink-400">Normal Face</span>
                          <span className="text-[9px] text-slate-400">Required 2</span>
                          <input type="file" accept="image/*" onChange={(e) => handlePhotoSlotUpload(e, 'normalFace')} className="hidden" />
                        </label>
                      )}
                    </div>

                    {/* Action Controls Bar */}
                    <div className="flex items-center justify-between gap-1 pt-1 border-t border-white/10 z-10 bg-black/40 p-1 rounded-xl">
                      <button
                        type="button"
                        onClick={() => handleSwapPhotoSlot(1, 'left')}
                        className="p-1 text-slate-300 hover:text-white hover:bg-white/10 rounded transition-colors"
                        title="Move Left"
                      >
                        <ArrowLeft className="w-3.5 h-3.5" />
                      </button>

                      <label className="p-1 bg-pink-600 hover:bg-pink-500 text-white rounded cursor-pointer shadow transition-colors" title="Upload / Change Photo">
                        <Camera className="w-3.5 h-3.5" />
                        <input type="file" accept="image/*" onChange={(e) => handlePhotoSlotUpload(e, 'normalFace')} className="hidden" />
                      </label>

                      {photosNormalFace && (
                        <button
                          type="button"
                          onClick={() => handleClearPhotoSlot('normalFace')}
                          className="p-1 text-rose-400 hover:text-rose-300 hover:bg-rose-500/20 rounded transition-colors"
                          title="Remove Photo"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => handleSwapPhotoSlot(1, 'right')}
                        className="p-1 text-slate-300 hover:text-white hover:bg-white/10 rounded transition-colors"
                        title="Move Right"
                      >
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {photoUploadingSlot === 'normalFace' && (
                      <div className="absolute inset-0 bg-black/85 flex items-center justify-center text-[10px] text-pink-400 font-bold z-20">
                        Verifying...
                      </div>
                    )}
                  </div>

                  {/* Slot 3: Additional Natural Photo */}
                  <div className="relative aspect-[3/4] rounded-2xl border-2 border-dashed border-white/15 overflow-hidden bg-black/30 group hover:border-pink-500/50 transition-all flex flex-col justify-between p-2">
                    <div className="flex items-center justify-between text-[9px] font-bold z-10">
                      <span className="bg-pink-500/20 text-pink-300 px-1.5 py-0.5 rounded border border-pink-500/30">
                        #3 Natural Photo
                      </span>
                      {photosNaturalPhoto ? (
                        <span className="bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded border border-emerald-500/30 flex items-center gap-0.5">
                          <CheckCircle2 className="w-2.5 h-2.5" /> Approved
                        </span>
                      ) : (
                        <span className="bg-slate-700/50 text-slate-400 px-1.5 py-0.5 rounded">
                          Required
                        </span>
                      )}
                    </div>

                    <div className="relative my-auto w-full h-full flex items-center justify-center">
                      {photosNaturalPhoto ? (
                        <img src={photosNaturalPhoto} alt="Natural Photo" className="w-full h-full object-cover rounded-xl" />
                      ) : (
                        <label className="w-full h-full flex flex-col items-center justify-center cursor-pointer p-2">
                          <Upload className="w-5 h-5 text-slate-400 mb-1" />
                          <span className="text-[11px] font-bold text-pink-400">Natural Photo</span>
                          <span className="text-[9px] text-slate-400">Required 3</span>
                          <input type="file" accept="image/*" onChange={(e) => handlePhotoSlotUpload(e, 'naturalPhoto')} className="hidden" />
                        </label>
                      )}
                    </div>

                    {/* Action Controls Bar */}
                    <div className="flex items-center justify-between gap-1 pt-1 border-t border-white/10 z-10 bg-black/40 p-1 rounded-xl">
                      <button
                        type="button"
                        onClick={() => handleSwapPhotoSlot(2, 'left')}
                        className="p-1 text-slate-300 hover:text-white hover:bg-white/10 rounded transition-colors"
                        title="Move Left"
                      >
                        <ArrowLeft className="w-3.5 h-3.5" />
                      </button>

                      <label className="p-1 bg-pink-600 hover:bg-pink-500 text-white rounded cursor-pointer shadow transition-colors" title="Upload / Change Photo">
                        <Camera className="w-3.5 h-3.5" />
                        <input type="file" accept="image/*" onChange={(e) => handlePhotoSlotUpload(e, 'naturalPhoto')} className="hidden" />
                      </label>

                      {photosNaturalPhoto && (
                        <button
                          type="button"
                          onClick={() => handleClearPhotoSlot('naturalPhoto')}
                          className="p-1 text-rose-400 hover:text-rose-300 hover:bg-rose-500/20 rounded transition-colors"
                          title="Remove Photo"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => handleSwapPhotoSlot(2, 'right')}
                        className="p-1 text-slate-300 hover:text-white hover:bg-white/10 rounded transition-colors"
                        title="Move Right"
                      >
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {photoUploadingSlot === 'naturalPhoto' && (
                      <div className="absolute inset-0 bg-black/85 flex items-center justify-center text-[10px] text-pink-400 font-bold z-20">
                        Verifying...
                      </div>
                    )}
                  </div>

                  {/* Slot 4: Extra Photo 1 */}
                  <div className="relative aspect-[3/4] rounded-2xl border-2 border-dashed border-white/15 overflow-hidden bg-black/30 group hover:border-pink-500/50 transition-all flex flex-col justify-between p-2">
                    <div className="flex items-center justify-between text-[9px] font-bold z-10">
                      <span className="bg-purple-500/20 text-purple-300 px-1.5 py-0.5 rounded border border-purple-500/30">
                        #4 Extra Photo 1
                      </span>
                      {photosExtra1 ? (
                        <span className="bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded border border-emerald-500/30 flex items-center gap-0.5">
                          <CheckCircle2 className="w-2.5 h-2.5" /> Approved
                        </span>
                      ) : (
                        <span className="bg-slate-700/50 text-slate-400 px-1.5 py-0.5 rounded">
                          Optional
                        </span>
                      )}
                    </div>

                    <div className="relative my-auto w-full h-full flex items-center justify-center">
                      {photosExtra1 ? (
                        <img src={photosExtra1} alt="Extra 1" className="w-full h-full object-cover rounded-xl" />
                      ) : (
                        <label className="w-full h-full flex flex-col items-center justify-center cursor-pointer p-2">
                          <Plus className="w-5 h-5 text-slate-400 mb-1" />
                          <span className="text-[11px] font-bold text-slate-300">Extra Photo 1</span>
                          <span className="text-[9px] text-slate-400">Optional</span>
                          <input type="file" accept="image/*" onChange={(e) => handlePhotoSlotUpload(e, 'extra1')} className="hidden" />
                        </label>
                      )}
                    </div>

                    {/* Action Controls Bar */}
                    <div className="flex items-center justify-between gap-1 pt-1 border-t border-white/10 z-10 bg-black/40 p-1 rounded-xl">
                      <button
                        type="button"
                        onClick={() => handleSwapPhotoSlot(3, 'left')}
                        className="p-1 text-slate-300 hover:text-white hover:bg-white/10 rounded transition-colors"
                        title="Move Left"
                      >
                        <ArrowLeft className="w-3.5 h-3.5" />
                      </button>

                      <label className="p-1 bg-pink-600 hover:bg-pink-500 text-white rounded cursor-pointer shadow transition-colors" title="Upload / Change Photo">
                        <Camera className="w-3.5 h-3.5" />
                        <input type="file" accept="image/*" onChange={(e) => handlePhotoSlotUpload(e, 'extra1')} className="hidden" />
                      </label>

                      {photosExtra1 && (
                        <button
                          type="button"
                          onClick={() => handleClearPhotoSlot('extra1')}
                          className="p-1 text-rose-400 hover:text-rose-300 hover:bg-rose-500/20 rounded transition-colors"
                          title="Remove Photo"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => handleSwapPhotoSlot(3, 'right')}
                        className="p-1 text-slate-300 hover:text-white hover:bg-white/10 rounded transition-colors"
                        title="Move Right"
                      >
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {photoUploadingSlot === 'extra1' && (
                      <div className="absolute inset-0 bg-black/85 flex items-center justify-center text-[10px] text-pink-400 font-bold z-20">
                        Verifying...
                      </div>
                    )}
                  </div>

                  {/* Slot 5: Extra Photo 2 */}
                  <div className="relative aspect-[3/4] rounded-2xl border-2 border-dashed border-white/15 overflow-hidden bg-black/30 group hover:border-pink-500/50 transition-all flex flex-col justify-between p-2">
                    <div className="flex items-center justify-between text-[9px] font-bold z-10">
                      <span className="bg-purple-500/20 text-purple-300 px-1.5 py-0.5 rounded border border-purple-500/30">
                        #5 Extra Photo 2
                      </span>
                      {photosExtra2 ? (
                        <span className="bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded border border-emerald-500/30 flex items-center gap-0.5">
                          <CheckCircle2 className="w-2.5 h-2.5" /> Approved
                        </span>
                      ) : (
                        <span className="bg-slate-700/50 text-slate-400 px-1.5 py-0.5 rounded">
                          Optional
                        </span>
                      )}
                    </div>

                    <div className="relative my-auto w-full h-full flex items-center justify-center">
                      {photosExtra2 ? (
                        <img src={photosExtra2} alt="Extra 2" className="w-full h-full object-cover rounded-xl" />
                      ) : (
                        <label className="w-full h-full flex flex-col items-center justify-center cursor-pointer p-2">
                          <Plus className="w-5 h-5 text-slate-400 mb-1" />
                          <span className="text-[11px] font-bold text-slate-300">Extra Photo 2</span>
                          <span className="text-[9px] text-slate-400">Optional</span>
                          <input type="file" accept="image/*" onChange={(e) => handlePhotoSlotUpload(e, 'extra2')} className="hidden" />
                        </label>
                      )}
                    </div>

                    {/* Action Controls Bar */}
                    <div className="flex items-center justify-between gap-1 pt-1 border-t border-white/10 z-10 bg-black/40 p-1 rounded-xl">
                      <button
                        type="button"
                        onClick={() => handleSwapPhotoSlot(4, 'left')}
                        className="p-1 text-slate-300 hover:text-white hover:bg-white/10 rounded transition-colors"
                        title="Move Left"
                      >
                        <ArrowLeft className="w-3.5 h-3.5" />
                      </button>

                      <label className="p-1 bg-pink-600 hover:bg-pink-500 text-white rounded cursor-pointer shadow transition-colors" title="Upload / Change Photo">
                        <Camera className="w-3.5 h-3.5" />
                        <input type="file" accept="image/*" onChange={(e) => handlePhotoSlotUpload(e, 'extra2')} className="hidden" />
                      </label>

                      {photosExtra2 && (
                        <button
                          type="button"
                          onClick={() => handleClearPhotoSlot('extra2')}
                          className="p-1 text-rose-400 hover:text-rose-300 hover:bg-rose-500/20 rounded transition-colors"
                          title="Remove Photo"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => handleSwapPhotoSlot(4, 'right')}
                        disabled={true}
                        className="p-1 text-slate-600 cursor-not-allowed rounded"
                        title="Can't move right"
                      >
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {photoUploadingSlot === 'extra2' && (
                      <div className="absolute inset-0 bg-black/85 flex items-center justify-center text-[10px] text-pink-400 font-bold z-20">
                        Verifying...
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* 2. BASIC & PHYSICAL INFORMATION */}
              <div className="bg-[#14141d] border border-white/10 rounded-3xl p-5 space-y-4 shadow-xl">
                <h3 className="font-extrabold text-sm text-white flex items-center gap-2 border-b border-white/10 pb-2">
                  <User className="w-4 h-4 text-sky-400" /> Basic & Physical Traits
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-xs font-bold text-slate-400 mb-1">Full Name</label>
                    <input
                      type="text"
                      required
                      value={accountFullName}
                      onChange={(e) => setAccountFullName(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-2xl px-3.5 py-2.5 text-xs text-white focus:border-pink-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-400 mb-1">Username</label>
                    <input
                      type="text"
                      required
                      value={accountUsername}
                      onChange={(e) => setAccountUsername(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-2xl px-3.5 py-2.5 text-xs text-white focus:border-pink-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-400 mb-1">Email Address</label>
                    <input
                      type="email"
                      value={accountEmail}
                      onChange={(e) => setAccountEmail(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-2xl px-3.5 py-2.5 text-xs text-white focus:border-pink-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-400 mb-1">Phone Number</label>
                    <input
                      type="text"
                      value={accountPhone}
                      onChange={(e) => setAccountPhone(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-2xl px-3.5 py-2.5 text-xs text-white focus:border-pink-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-400 mb-1">Height</label>
                    <input
                      type="text"
                      placeholder="e.g. 175 cm / 5'9''"
                      value={accountHeight}
                      onChange={(e) => setAccountHeight(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-2xl px-3.5 py-2.5 text-xs text-white focus:border-pink-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-400 mb-1">Skin Tone</label>
                    <select
                      value={accountSkinTone}
                      onChange={(e) => setAccountSkinTone(e.target.value)}
                      className="w-full bg-[#14141d] border border-white/10 rounded-2xl px-3.5 py-2.5 text-xs text-white focus:border-pink-500 focus:outline-none"
                    >
                      <option value="Fair">Fair</option>
                      <option value="Medium">Medium</option>
                      <option value="Olive">Olive</option>
                      <option value="Tan">Tan</option>
                      <option value="Dark">Dark</option>
                      <option value="Deep">Deep</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-400 mb-1">Hair Color</label>
                    <select
                      value={accountHairColor}
                      onChange={(e) => setAccountHairColor(e.target.value)}
                      className="w-full bg-[#14141d] border border-white/10 rounded-2xl px-3.5 py-2.5 text-xs text-white focus:border-pink-500 focus:outline-none"
                    >
                      <option value="Black">Black</option>
                      <option value="Dark Brown">Dark Brown</option>
                      <option value="Light Brown">Light Brown</option>
                      <option value="Blonde">Blonde</option>
                      <option value="Red">Red</option>
                      <option value="Grey">Grey</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-400 mb-1">Eye Color</label>
                    <select
                      value={accountEyeColor}
                      onChange={(e) => setAccountEyeColor(e.target.value)}
                      className="w-full bg-[#14141d] border border-white/10 rounded-2xl px-3.5 py-2.5 text-xs text-white focus:border-pink-500 focus:outline-none"
                    >
                      <option value="Brown">Brown</option>
                      <option value="Blue">Blue</option>
                      <option value="Hazel">Hazel</option>
                      <option value="Green">Green</option>
                      <option value="Grey">Grey</option>
                      <option value="Amber">Amber</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-400 mb-1">Body Type</label>
                    <select
                      value={accountBodyType}
                      onChange={(e) => setAccountBodyType(e.target.value)}
                      className="w-full bg-[#14141d] border border-white/10 rounded-2xl px-3.5 py-2.5 text-xs text-white focus:border-pink-500 focus:outline-none"
                    >
                      <option value="Slim">Slim</option>
                      <option value="Athletic">Athletic</option>
                      <option value="Average">Average</option>
                      <option value="Curvy">Curvy</option>
                      <option value="Muscular">Muscular</option>
                      <option value="Plus size">Plus size</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-400 mb-1">Gender</label>
                    <select
                      value={accountGender}
                      onChange={(e) => setAccountGender(e.target.value as 'Male' | 'Female' | 'Other')}
                      className="w-full bg-[#14141d] border border-white/10 rounded-2xl px-3.5 py-2.5 text-xs text-white focus:border-pink-500 focus:outline-none"
                    >
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-400 mb-1">Country</label>
                    <input
                      type="text"
                      value={accountCountry}
                      onChange={(e) => setAccountCountry(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-2xl px-3.5 py-2.5 text-xs text-white focus:border-pink-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-400 mb-1">City</label>
                    <input
                      type="text"
                      value={accountCity}
                      onChange={(e) => setAccountCity(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-2xl px-3.5 py-2.5 text-xs text-white focus:border-pink-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1">Personal Bio</label>
                  <textarea
                    rows={3}
                    value={accountBio}
                    onChange={(e) => setAccountBio(e.target.value)}
                    placeholder="Tell other users about yourself..."
                    className="w-full bg-white/5 border border-white/10 rounded-2xl p-3 text-xs text-white focus:border-pink-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* 3. LIFESTYLE & PARTY / CLUB PREFERENCES */}
              <div className="bg-[#14141d] border border-white/10 rounded-3xl p-5 space-y-4 shadow-xl">
                <h3 className="font-extrabold text-sm text-white flex items-center gap-2 border-b border-white/10 pb-2">
                  <Sparkles className="w-4 h-4 text-amber-400" /> Lifestyle, Party & Club Preferences
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-xs font-bold text-slate-400 mb-1">Do you drink?</label>
                    <select
                      value={accountDrinking}
                      onChange={(e) => setAccountDrinking(e.target.value)}
                      className="w-full bg-[#14141d] border border-white/10 rounded-2xl px-3.5 py-2.5 text-xs text-white focus:border-pink-500 focus:outline-none"
                    >
                      <option value="Never">Never</option>
                      <option value="Occasionally">Occasionally</option>
                      <option value="Socially">Socially</option>
                      <option value="Frequently">Frequently</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-400 mb-1">Do you smoke?</label>
                    <select
                      value={accountSmoking}
                      onChange={(e) => setAccountSmoking(e.target.value)}
                      className="w-full bg-[#14141d] border border-white/10 rounded-2xl px-3.5 py-2.5 text-xs text-white focus:border-pink-500 focus:outline-none"
                    >
                      <option value="Never">Never</option>
                      <option value="Occasionally">Occasionally</option>
                      <option value="Regularly">Regularly</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-400 mb-1">Do you enjoy parties?</label>
                    <select
                      value={accountEnjoysParties}
                      onChange={(e) => setAccountEnjoysParties(e.target.value as any)}
                      className="w-full bg-[#14141d] border border-white/10 rounded-2xl px-3.5 py-2.5 text-xs text-white focus:border-pink-500 focus:outline-none"
                    >
                      <option value="Yes">Yes</option>
                      <option value="No">No</option>
                      <option value="Sometimes">Sometimes</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-400 mb-1">Favorite Places to Socialize</label>
                    <input
                      type="text"
                      placeholder="e.g. Lounge bars, Outdoor rooftop cafes"
                      value={accountSocialPlaces}
                      onChange={(e) => setAccountSocialPlaces(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-2xl px-3.5 py-2.5 text-xs text-white focus:border-pink-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-2">Types of Parties You Like</label>
                  <div className="flex flex-wrap gap-2">
                    {[
                      'House parties',
                      'Clubbing',
                      'Outdoor events',
                      'Music events',
                      'Cultural events',
                      'Quiet gatherings',
                      "I don't party"
                    ].map((partyType) => {
                      const isSelected = accountPartyPrefs.includes(partyType);
                      return (
                        <button
                          key={partyType}
                          type="button"
                          onClick={() => {
                            if (isSelected) {
                              setAccountPartyPrefs(accountPartyPrefs.filter(p => p !== partyType));
                            } else {
                              setAccountPartyPrefs([...accountPartyPrefs, partyType]);
                            }
                          }}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                            isSelected
                              ? 'bg-gradient-to-r from-pink-500 to-red-600 text-white border-pink-400 shadow'
                              : 'bg-white/5 text-slate-300 border-white/10 hover:bg-white/10'
                          }`}
                        >
                          {partyType}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-2">Preferred Club Atmosphere</label>
                  <div className="flex flex-wrap gap-2">
                    {[
                      'Dance clubs',
                      'Luxury lounges',
                      'Live music venues',
                      'Bars',
                      'Outdoor entertainment',
                      'No clubs'
                    ].map((clubType) => {
                      const isSelected = accountClubPrefs.includes(clubType);
                      return (
                        <button
                          key={clubType}
                          type="button"
                          onClick={() => {
                            if (isSelected) {
                              setAccountClubPrefs(accountClubPrefs.filter(c => c !== clubType));
                            } else {
                              setAccountClubPrefs([...accountClubPrefs, clubType]);
                            }
                          }}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                            isSelected
                              ? 'bg-gradient-to-r from-purple-500 to-indigo-600 text-white border-purple-400 shadow'
                              : 'bg-white/5 text-slate-300 border-white/10 hover:bg-white/10'
                          }`}
                        >
                          {clubType}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* 4. INTERESTS & HOBBIES */}
              <div className="bg-[#14141d] border border-white/10 rounded-3xl p-5 space-y-4 shadow-xl">
                <h3 className="font-extrabold text-sm text-white flex items-center gap-2 border-b border-white/10 pb-2">
                  <Sun className="w-4 h-4 text-emerald-400" /> Interests, Hobbies & Activities
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-xs font-bold text-slate-400 mb-1">Hobbies (Comma separated)</label>
                    <input
                      type="text"
                      placeholder="e.g. Photography, Cooking, Gaming"
                      value={accountHobbies}
                      onChange={(e) => setAccountHobbies(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-2xl px-3.5 py-2.5 text-xs text-white focus:border-pink-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-400 mb-1">Favorite Activities</label>
                    <input
                      type="text"
                      placeholder="e.g. Hiking, Swimming, Fine dining"
                      value={accountActivities}
                      onChange={(e) => setAccountActivities(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-2xl px-3.5 py-2.5 text-xs text-white focus:border-pink-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-400 mb-1">Music Interests</label>
                    <input
                      type="text"
                      placeholder="e.g. Afrobeats, Hip Hop, R&B, Pop"
                      value={accountMusic}
                      onChange={(e) => setAccountMusic(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-2xl px-3.5 py-2.5 text-xs text-white focus:border-pink-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-400 mb-1">Sports & Fitness</label>
                    <input
                      type="text"
                      placeholder="e.g. Football, Gym, Tennis"
                      value={accountSports}
                      onChange={(e) => setAccountSports(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-2xl px-3.5 py-2.5 text-xs text-white focus:border-pink-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-400 mb-1">Entertainment Preferences</label>
                    <input
                      type="text"
                      placeholder="e.g. Cinema, Stand-up comedy, Concerts"
                      value={accountEntertainment}
                      onChange={(e) => setAccountEntertainment(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-2xl px-3.5 py-2.5 text-xs text-white focus:border-pink-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-400 mb-1">Lifestyle Interests</label>
                    <input
                      type="text"
                      placeholder="e.g. Fashion, Travel, Wellness, Art"
                      value={accountLifestyleInterests}
                      onChange={(e) => setAccountLifestyleInterests(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-2xl px-3.5 py-2.5 text-xs text-white focus:border-pink-500 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* 5. PRIVACY CONTROLS */}
              <div className="bg-[#14141d] border border-white/10 rounded-3xl p-5 space-y-4 shadow-xl">
                <h3 className="font-extrabold text-sm text-white flex items-center gap-2 border-b border-white/10 pb-2">
                  <Shield className="w-4 h-4 text-emerald-400" /> Profile Visibility & Privacy Controls
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-xs font-bold text-slate-400 mb-1">Who can view my Profile Details?</label>
                    <select
                      value={profileVis}
                      onChange={(e) => setProfileVis(e.target.value as any)}
                      className="w-full bg-[#14141d] border border-white/10 rounded-2xl px-3.5 py-2.5 text-xs text-white focus:border-emerald-500 focus:outline-none"
                    >
                      <option value="everyone">Everyone can see</option>
                      <option value="verified_only">Verified users only</option>
                      <option value="hidden">Hidden</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-400 mb-1">Who can view my Profile Photos?</label>
                    <select
                      value={photosVis}
                      onChange={(e) => setPhotosVis(e.target.value as any)}
                      className="w-full bg-[#14141d] border border-white/10 rounded-2xl px-3.5 py-2.5 text-xs text-white focus:border-emerald-500 focus:outline-none"
                    >
                      <option value="everyone">Everyone can see</option>
                      <option value="verified_only">Verified users only</option>
                      <option value="hidden">Hidden</option>
                    </select>
                  </div>
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-4 bg-gradient-to-r from-pink-500 via-rose-600 to-red-600 hover:from-pink-600 hover:to-red-700 text-white font-extrabold text-sm rounded-2xl shadow-xl shadow-pink-500/25 transition-all"
              >
                Save All Profile & Lifestyle Details
              </button>
            </form>

            {/* Change Password / PIN Card */}
            <form onSubmit={handleChangePin} className="bg-[#14141d] border border-white/10 rounded-3xl p-5 space-y-3.5 shadow-xl">
              <h3 className="font-extrabold text-sm text-white flex items-center gap-2">
                <Key className="w-4 h-4 text-amber-400" /> Change Security PIN / Password
              </h3>

              {pinChangeMsg && (
                <p className={`text-xs p-2.5 rounded-xl border ${pinChangeMsg.includes('✅') ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' : 'bg-rose-500/10 border-rose-500/30 text-rose-300'}`}>
                  {pinChangeMsg}
                </p>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1">New 4-Digit PIN</label>
                  <input
                    type="password"
                    maxLength={6}
                    required
                    value={newPin}
                    onChange={(e) => setNewPin(e.target.value)}
                    placeholder="••••"
                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-3.5 py-2.5 text-xs text-white font-mono tracking-widest focus:border-amber-400 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1">Confirm PIN</label>
                  <input
                    type="password"
                    maxLength={6}
                    required
                    value={confirmPin}
                    onChange={(e) => setConfirmPin(e.target.value)}
                    placeholder="••••"
                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-3.5 py-2.5 text-xs text-white font-mono tracking-widest focus:border-amber-400 focus:outline-none"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-2.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 font-bold text-xs rounded-2xl transition-all"
              >
                Update Security PIN
              </button>
            </form>

            {/* Account Deletion */}
            <div className="bg-rose-500/10 border border-rose-500/20 rounded-3xl p-5 space-y-2 shadow-xl">
              <h3 className="font-extrabold text-sm text-rose-400 flex items-center gap-2">
                <Trash2 className="w-4 h-4" /> Permanently Delete Account
              </h3>
              <p className="text-xs text-slate-300">
                Deleting your account erases all your matches, conversations, uploaded posts, and activity history permanently.
              </p>
              <button
                onClick={async () => {
                  if (confirm('PERMANENT DELETION: Are you sure you want to delete your PEWA account?')) {
                    await deleteCurrentAccount();
                  }
                }}
                className="px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs rounded-2xl transition-all shadow-lg"
              >
                Delete My PEWA Account
              </button>
            </div>
          </div>
        )}

        {/* SECTION 3: PRIVACY SETTINGS */}
        {activeSection === 'privacy' && (
          <div className="space-y-4 animate-fadeIn">
            <div className="bg-[#14141d] border border-white/10 rounded-3xl p-5 space-y-4 shadow-xl">
              <h3 className="font-extrabold text-sm text-emerald-400 flex items-center gap-2">
                <Shield className="w-4 h-4" /> Messaging & Visibility Rules
              </h3>

              <div className="space-y-3 divide-y divide-white/5 text-xs">
                <div className="pt-2 flex items-center justify-between">
                  <div>
                    <span className="font-bold text-slate-200 block">Who Can Message Me</span>
                    <span className="text-slate-400 text-[11px]">Control direct chat initiation</span>
                  </div>
                  <select
                    value={whoCanMessage}
                    onChange={(e) => setWhoCanMessage(e.target.value as any)}
                    className="bg-[#1a1a24] border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none"
                  >
                    <option value="everyone">Everyone</option>
                    <option value="matched">Matched Users Only</option>
                    <option value="verified">Verified Users Only</option>
                  </select>
                </div>

                <div className="pt-3 flex items-center justify-between">
                  <div>
                    <span className="font-bold text-slate-200 block">Who Can See My Profile</span>
                    <span className="text-slate-400 text-[11px]">Discoverability in Find Love tab</span>
                  </div>
                  <select
                    value={whoCanSeeProfile}
                    onChange={(e) => setWhoCanSeeProfile(e.target.value as any)}
                    className="bg-[#1a1a24] border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none"
                  >
                    <option value="everyone">Everyone</option>
                    <option value="matched">Matched Users Only</option>
                    <option value="none">Hidden Profile</option>
                  </select>
                </div>

                <div className="pt-3 flex items-center justify-between">
                  <div>
                    <span className="font-bold text-slate-200 block">Online Status Visibility</span>
                    <span className="text-slate-400 text-[11px]">Show active green status indicator</span>
                  </div>
                  <select
                    value={whoCanSeeOnline}
                    onChange={(e) => setWhoCanSeeOnline(e.target.value as any)}
                    className="bg-[#1a1a24] border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none"
                  >
                    <option value="everyone">Everyone</option>
                    <option value="matched">Matched Users Only</option>
                    <option value="nobody">Nobody</option>
                  </select>
                </div>

                <div className="pt-3 flex items-center justify-between">
                  <div>
                    <span className="font-bold text-slate-200 block">Last Seen Visibility</span>
                    <span className="text-slate-400 text-[11px]">Timestamp of your last activity</span>
                  </div>
                  <select
                    value={lastSeenVis}
                    onChange={(e) => setLastSeenVis(e.target.value as any)}
                    className="bg-[#1a1a24] border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none"
                  >
                    <option value="everyone">Everyone</option>
                    <option value="matched">Matched Only</option>
                    <option value="nobody">Nobody</option>
                  </select>
                </div>

                <div className="pt-3 flex items-center justify-between">
                  <div>
                    <span className="font-bold text-slate-200 block">Private Account Mode</span>
                    <span className="text-slate-400 text-[11px]">Require connection approval for posts</span>
                  </div>
                  <button
                    onClick={() => setIsPrivateAccount(!isPrivateAccount)}
                    className={`px-3 py-1.5 rounded-xl font-bold text-xs transition-all ${
                      isPrivateAccount
                        ? 'bg-emerald-500 text-slate-950 shadow-md'
                        : 'bg-white/10 text-slate-400 hover:bg-white/20'
                    }`}
                  >
                    {isPrivateAccount ? 'Enabled' : 'Disabled'}
                  </button>
                </div>
              </div>
            </div>

            {/* Blocked Users & Data Download */}
            <div className="bg-[#14141d] border border-white/10 rounded-3xl p-5 space-y-3 shadow-xl">
              <h3 className="font-extrabold text-sm text-slate-200">Data & Safety Controls</h3>
              <div className="flex flex-col gap-2">
                <button
                  onClick={() => {
                    setPopsTab('blocked');
                    setActiveSection('pops');
                  }}
                  className="w-full p-3 bg-white/5 hover:bg-white/10 rounded-2xl border border-white/10 flex items-center justify-between text-xs font-bold text-slate-200 transition-all"
                >
                  <span>Blocked Users List ({blockedUsersList.length})</span>
                  <ChevronRight className="w-4 h-4 text-slate-500" />
                </button>

                <button
                  onClick={handleDownloadData}
                  className="w-full p-3 bg-emerald-500/10 hover:bg-emerald-500/20 rounded-2xl border border-emerald-500/20 flex items-center justify-between text-xs font-bold text-emerald-300 transition-all"
                >
                  <span className="flex items-center gap-2">
                    <Download className="w-4 h-4" /> Download My Account Data (.json)
                  </span>
                  <ChevronRight className="w-4 h-4 text-emerald-400" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* SECTION 4: SECURITY SETTINGS */}
        {activeSection === 'security' && (
          <div className="space-y-4 animate-fadeIn">
            <div className="bg-[#14141d] border border-white/10 rounded-3xl p-5 space-y-4 shadow-xl">
              <h3 className="font-extrabold text-sm text-amber-400 flex items-center gap-2">
                <Lock className="w-4 h-4" /> Two-Factor & Login Protection
              </h3>

              <div className="flex items-center justify-between p-3.5 bg-white/5 rounded-2xl border border-white/10">
                <div>
                  <span className="font-bold text-xs text-slate-200 block">Two-Factor Authentication (2FA)</span>
                  <span className="text-[11px] text-slate-400">Security PIN layer for account access</span>
                </div>
                <button
                  onClick={() => setTwoFactorEnabled(!twoFactorEnabled)}
                  className={`px-3 py-1.5 rounded-xl font-bold text-xs transition-all ${
                    twoFactorEnabled
                      ? 'bg-amber-400 text-slate-950 shadow-md'
                      : 'bg-white/10 text-slate-400 hover:bg-white/20'
                  }`}
                >
                  {twoFactorEnabled ? 'Active' : 'Enable 2FA'}
                </button>
              </div>

              {/* Active Sessions */}
              <div className="space-y-2 pt-2">
                <h4 className="font-bold text-xs text-slate-300 uppercase tracking-wider">Active Device Sessions</h4>
                
                <div className="p-3.5 bg-white/5 rounded-2xl border border-white/10 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Smartphone className="w-5 h-5 text-emerald-400" />
                    <div>
                      <span className="font-bold text-xs text-white block">Current Device (Active Now)</span>
                      <span className="text-[10px] text-slate-400">Mobile Web Browser • Lusaka, Zambia</span>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                    This Session
                  </span>
                </div>

                <div className="p-3.5 bg-white/5 rounded-2xl border border-white/10 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Laptop className="w-5 h-5 text-indigo-400" />
                    <div>
                      <span className="font-bold text-xs text-white block">Chrome on Windows</span>
                      <span className="text-[10px] text-slate-400">Last active 2 hours ago • Zambia</span>
                    </div>
                  </div>
                  <button
                    onClick={() => alert('Session revoked.')}
                    className="text-[11px] font-bold text-rose-400 hover:underline"
                  >
                    Revoke
                  </button>
                </div>
              </div>

              <button
                onClick={() => alert('All other sessions logged out successfully.')}
                className="w-full py-3 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 font-bold text-xs rounded-2xl transition-all"
              >
                Logout From All Other Devices
              </button>
            </div>
          </div>
        )}

        {/* SECTION 5: CHAT SETTINGS */}
        {activeSection === 'chat' && (
          <div className="space-y-4 animate-fadeIn">
            <div className="bg-[#14141d] border border-white/10 rounded-3xl p-5 space-y-4 shadow-xl">
              <h3 className="font-extrabold text-sm text-sky-400 flex items-center gap-2">
                <MessageSquare className="w-4 h-4" /> Chat Themes & Visual Customization
              </h3>

              <div className="space-y-4 text-xs">
                {/* Chat Themes */}
                <div>
                  <label className="font-bold text-slate-200 block mb-1">Chat Theme</label>
                  <p className="text-slate-400 text-[11px] mb-2">Changing theme updates all chat screens immediately</p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {[
                      { id: 'classic', name: 'Default Classic', bg: 'bg-gradient-to-r from-pink-500 to-red-600' },
                      { id: 'midnight', name: 'Midnight Blue', bg: 'bg-gradient-to-r from-indigo-600 to-blue-700' },
                      { id: 'emerald', name: 'Emerald Teal', bg: 'bg-gradient-to-r from-emerald-500 to-teal-700' },
                      { id: 'sunset', name: 'Sunset Purple', bg: 'bg-gradient-to-r from-purple-600 to-pink-600' },
                      { id: 'crimson', name: 'Crimson Rose', bg: 'bg-gradient-to-r from-rose-600 to-red-700' }
                    ].map((t) => (
                      <button
                        key={t.id}
                        onClick={() => handleUpdateChatSetting('theme', t.id as any)}
                        className={`p-2.5 rounded-2xl border text-left flex items-center justify-between transition-all ${
                          chatSettings.theme === t.id
                            ? 'border-sky-400 bg-sky-500/10 text-white font-bold shadow-lg'
                            : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'
                        }`}
                      >
                        <span className="text-[11px]">{t.name}</span>
                        <span className={`w-3.5 h-3.5 rounded-full ${t.bg}`} />
                      </button>
                    ))}
                  </div>
                </div>

                {/* Chat Wallpapers */}
                <div className="pt-2 border-t border-white/5">
                  <label className="font-bold text-slate-200 block mb-1">Chat Wallpaper</label>
                  <p className="text-slate-400 text-[11px] mb-2">Background texture for conversation threads</p>
                  <select
                    value={chatSettings.wallpaper}
                    onChange={(e) => handleUpdateChatSetting('wallpaper', e.target.value as any)}
                    className="w-full bg-[#1a1a24] border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                  >
                    <option value="dark_solid">Dark Solid Canvas</option>
                    <option value="doodle">Doodle Grid Pattern</option>
                    <option value="gradient">Soft Radial Gradient</option>
                    <option value="glow">Glow Matrix Ambient</option>
                    <option value="flat">Clean Flat Minimal</option>
                  </select>
                </div>

                {/* Font Size & Bubble Style */}
                <div className="grid grid-cols-2 gap-3 pt-2 border-t border-white/5">
                  <div>
                    <label className="font-bold text-slate-200 block mb-1">Font Size</label>
                    <select
                      value={chatSettings.fontSize}
                      onChange={(e) => handleUpdateChatSetting('fontSize', e.target.value as any)}
                      className="w-full bg-[#1a1a24] border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                    >
                      <option value="small">Small (11px)</option>
                      <option value="medium">Medium (12px standard)</option>
                      <option value="large">Large (14px expanded)</option>
                    </select>
                  </div>

                  <div>
                    <label className="font-bold text-slate-200 block mb-1">Bubble Style</label>
                    <select
                      value={chatSettings.bubbleStyle}
                      onChange={(e) => handleUpdateChatSetting('bubbleStyle', e.target.value as any)}
                      className="w-full bg-[#1a1a24] border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                    >
                      <option value="whatsapp">WhatsApp Classic</option>
                      <option value="rounded">Modern Rounded</option>
                      <option value="sharp">Sharp Compact</option>
                      <option value="pill">Pill Shape</option>
                    </select>
                  </div>
                </div>

                {/* Message Corner Radius */}
                <div className="pt-2 border-t border-white/5">
                  <label className="font-bold text-slate-200 block mb-1">Message Corner Radius</label>
                  <div className="grid grid-cols-3 gap-2 mt-1">
                    {[
                      { id: 'small', label: 'Small (8px)' },
                      { id: 'medium', label: 'Medium (16px)' },
                      { id: 'curved', label: 'Extra Curved (24px)' }
                    ].map((r) => (
                      <button
                        key={r.id}
                        onClick={() => handleUpdateChatSetting('cornerRadius', r.id as any)}
                        className={`py-2 px-2.5 rounded-xl border text-[11px] font-bold transition-all ${
                          chatSettings.cornerRadius === r.id
                            ? 'bg-sky-500/20 text-sky-300 border-sky-400'
                            : 'bg-white/5 text-slate-400 border-white/10 hover:bg-white/10'
                        }`}
                      >
                        {r.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Read Receipts, Typing & Media Settings */}
            <div className="bg-[#14141d] border border-white/10 rounded-3xl p-5 space-y-4 shadow-xl">
              <h3 className="font-extrabold text-sm text-sky-400 flex items-center gap-2">
                <Volume2 className="w-4 h-4" /> Message Delivery & Media Controls
              </h3>

              <div className="space-y-3 divide-y divide-white/5 text-xs">
                <div className="pt-2 flex items-center justify-between">
                  <div>
                    <span className="font-bold text-slate-200 block">Read Receipts</span>
                    <span className="text-slate-400 text-[11px]">Show double blue checkmarks when messages are read</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={chatSettings.readReceipts}
                    onChange={(e) => handleUpdateChatSetting('readReceipts', e.target.checked)}
                    className="w-4 h-4 accent-sky-400 rounded cursor-pointer"
                  />
                </div>

                <div className="pt-3 flex items-center justify-between">
                  <div>
                    <span className="font-bold text-slate-200 block">Typing Indicators</span>
                    <span className="text-slate-400 text-[11px]">Show live typing... indicator during chat</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={chatSettings.typingIndicators}
                    onChange={(e) => handleUpdateChatSetting('typingIndicators', e.target.checked)}
                    className="w-4 h-4 accent-sky-400 rounded cursor-pointer"
                  />
                </div>

                <div className="pt-3 flex items-center justify-between">
                  <div>
                    <span className="font-bold text-slate-200 block">Auto-Download Media</span>
                    <span className="text-slate-400 text-[11px]">Automatically load high resolution images & media</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={chatSettings.autoDownloadMedia}
                    onChange={(e) => handleUpdateChatSetting('autoDownloadMedia', e.target.checked)}
                    className="w-4 h-4 accent-sky-400 rounded cursor-pointer"
                  />
                </div>

                <div className="pt-3 flex items-center justify-between">
                  <div>
                    <span className="font-bold text-slate-200 block">Auto-play Next Voice Note</span>
                    <span className="text-slate-400 text-[11px]">Automatically play consecutive audio messages</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={chatSettings.autoPlayVoiceNotes}
                    onChange={(e) => handleUpdateChatSetting('autoPlayVoiceNotes', e.target.checked)}
                    className="w-4 h-4 accent-sky-400 rounded cursor-pointer"
                  />
                </div>

                <div className="pt-3 flex items-center justify-between">
                  <div>
                    <span className="font-bold text-slate-200 block">HD Audio Recording & Playback</span>
                    <span className="text-slate-400 text-[11px]">Record voice messages in high-fidelity audio format</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={chatSettings.hdAudio}
                    onChange={(e) => handleUpdateChatSetting('hdAudio', e.target.checked)}
                    className="w-4 h-4 accent-sky-400 rounded cursor-pointer"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* SECTION 6: NOTIFICATION SETTINGS */}
        {activeSection === 'notifications' && (
          <div className="space-y-4 animate-fadeIn">
            {/* OneSignal Status Card */}
            <div className="bg-[#14141d] border border-white/10 rounded-3xl p-5 space-y-3 shadow-xl">
              <h3 className="font-extrabold text-sm text-purple-400 flex items-center gap-2">
                <Bell className="w-4 h-4" /> OneSignal Push Notification Service
              </h3>
              <p className="text-xs text-slate-300">
                PEWA uses OneSignal Push Services (App ID: <code className="text-pink-400 bg-black/40 px-1.5 py-0.5 rounded">26477179-8f1d-49f5-8428-389a75eafeaf</code>) to send realtime chat messages and interaction alerts directly to your mobile & desktop devices.
              </p>
              <button
                onClick={handleEnablePushPermission}
                className="w-full py-2.5 bg-gradient-to-r from-purple-600 to-pink-600 hover:opacity-95 text-white font-extrabold text-xs rounded-2xl shadow-lg transition-all flex items-center justify-center gap-2"
              >
                <Bell className="w-4 h-4" /> Request OneSignal Push Permission
              </button>
            </div>

            {/* Notification Preference Toggles */}
            <div className="bg-[#14141d] border border-white/10 rounded-3xl p-5 space-y-4 shadow-xl">
              <h3 className="font-extrabold text-sm text-white flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-pink-400" /> Category Notification Preferences
              </h3>

              <div className="space-y-3 divide-y divide-white/5 text-xs">
                {/* Global Master Toggle */}
                <div className="pt-2 flex items-center justify-between">
                  <div>
                    <span className="font-bold text-slate-200 block">Master Push Notifications</span>
                    <span className="text-slate-400 text-[11px]">Master switch for background alerts</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={pushNotifications}
                    onChange={(e) => {
                      setPushNotifications(e.target.checked);
                      updateCurrentUserProfile({
                        settings: {
                          ...(currentUser?.settings || {}),
                          pushNotifications: e.target.checked
                        }
                      });
                    }}
                    className="w-4 h-4 accent-purple-400 rounded cursor-pointer"
                  />
                </div>

                {/* 1. Message Notifications */}
                <div className="pt-3 flex items-center justify-between">
                  <div>
                    <span className="font-bold text-slate-200 block">Message Notifications</span>
                    <span className="text-slate-400 text-[11px]">Chat messages, voice notes & replies</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={msgNotifs}
                    onChange={(e) => {
                      setMsgNotifs(e.target.checked);
                      updateNotifSetting('messageNotifications', e.target.checked);
                    }}
                    className="w-4 h-4 accent-purple-400 rounded cursor-pointer"
                  />
                </div>

                {/* 2. Find Love Notifications */}
                <div className="pt-3 flex items-center justify-between">
                  <div>
                    <span className="font-bold text-slate-200 block">Find Love Notifications</span>
                    <span className="text-slate-400 text-[11px]">Pops, Keeps, Shares & profile matches</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={findLoveNotifs}
                    onChange={(e) => {
                      setFindLoveNotifs(e.target.checked);
                      updateNotifSetting('findLoveNotifications', e.target.checked);
                    }}
                    className="w-4 h-4 accent-purple-400 rounded cursor-pointer"
                  />
                </div>

                {/* 3. PEWA Sugars Notifications */}
                <div className="pt-3 flex items-center justify-between">
                  <div>
                    <span className="font-bold text-slate-200 block">PEWA Sugars Alerts</span>
                    <span className="text-slate-400 text-[11px]">Sugar Mama/Daddy/Baby application status & matches</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={sugarsNotifs}
                    onChange={(e) => {
                      setSugarsNotifs(e.target.checked);
                      updateNotifSetting('sugarsNotifications', e.target.checked);
                    }}
                    className="w-4 h-4 accent-purple-400 rounded cursor-pointer"
                  />
                </div>

                {/* 4. Broadcast Notifications */}
                <div className="pt-3 flex items-center justify-between">
                  <div>
                    <span className="font-bold text-slate-200 block">Broadcast & System Alerts</span>
                    <span className="text-slate-400 text-[11px]">PEWA Official & administrator message updates</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={broadcastNotifs}
                    onChange={(e) => {
                      setBroadcastNotifs(e.target.checked);
                      updateNotifSetting('broadcastNotifications', e.target.checked);
                    }}
                    className="w-4 h-4 accent-purple-400 rounded cursor-pointer"
                  />
                </div>

                {/* 5. Verification Notifications */}
                <div className="pt-3 flex items-center justify-between">
                  <div>
                    <span className="font-bold text-slate-200 block">Verification Notifications</span>
                    <span className="text-slate-400 text-[11px]">Identity verification submission & approval updates</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={verificationNotifs}
                    onChange={(e) => {
                      setVerificationNotifs(e.target.checked);
                      updateNotifSetting('verificationNotifications', e.target.checked);
                    }}
                    className="w-4 h-4 accent-purple-400 rounded cursor-pointer"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* SECTION 7: THEME SETTINGS */}
        {activeSection === 'theme' && (
          <div className="space-y-4 animate-fadeIn">
            <div className="bg-[#14141d] border border-white/10 rounded-3xl p-5 space-y-4 shadow-xl">
              <h3 className="font-extrabold text-sm text-amber-300 flex items-center gap-2">
                <Sun className="w-4 h-4" /> Appearance & Display Theme
              </h3>
              <p className="text-xs text-slate-400">
                Choose how PEWA looks across your device. Theme updates instantly.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                {[
                  { id: 'dark', label: 'Dark Mode', icon: Moon, desc: 'OLED Black & Slate' },
                  { id: 'light', label: 'Light Mode', icon: Sun, desc: 'Clean High-Contrast White' },
                  { id: 'system', label: 'Follow Device', icon: Smartphone, desc: 'Sync with system preference' }
                ].map((t) => {
                  const IconComp = t.icon;
                  const isSelected = themeMode === t.id;
                  return (
                    <button
                      key={t.id}
                      onClick={() => applyTheme(t.id as any)}
                      className={`p-4 rounded-2xl border text-left flex flex-col justify-between transition-all ${
                        isSelected
                          ? 'bg-gradient-to-tr from-pink-500/20 to-red-500/20 border-pink-500/60 shadow-lg'
                          : 'bg-white/5 border-white/10 hover:bg-white/10'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-3">
                        <IconComp className={`w-6 h-6 ${isSelected ? 'text-pink-400' : 'text-slate-400'}`} />
                        {isSelected && <CheckCircle2 className="w-5 h-5 text-pink-500" />}
                      </div>
                      <div>
                        <span className="font-extrabold text-sm text-white block">{t.label}</span>
                        <span className="text-[10px] text-slate-400 mt-0.5 block">{t.desc}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* SECTION 8: LANGUAGE SETTINGS */}
        {activeSection === 'language' && (
          <div className="space-y-4 animate-fadeIn">
            <div className="bg-[#14141d] border border-white/10 rounded-3xl p-5 space-y-3 shadow-xl">
              <h3 className="font-extrabold text-sm text-indigo-400 flex items-center gap-2">
                <Globe className="w-4 h-4" /> Select Platform Language
              </h3>
              <p className="text-xs text-slate-400 mb-3">
                PEWA supports multiple languages across Southern Africa and international markets.
              </p>

              <div className="space-y-2">
                {[
                  { code: 'en', name: 'English (Zambia / Global)' },
                  { code: 'bem', name: 'Icibemba (Bemba)' },
                  { code: 'nya', name: 'Cinyanja (Nyanja / Chewa)' },
                  { code: 'fr', name: 'Français (French)' },
                  { code: 'pt', name: 'Português (Portuguese)' },
                  { code: 'sw', name: 'Kiswahili (Swahili)' }
                ].map((lang) => {
                  const isSelected = currentLang === lang.name;
                  return (
                    <button
                      key={lang.code}
                      onClick={() => {
                        setCurrentLang(lang.name);
                        localStorage.setItem('pewa_language', lang.name);
                      }}
                      className={`w-full p-3.5 rounded-2xl border text-left flex items-center justify-between transition-all ${
                        isSelected
                          ? 'bg-indigo-500/20 border-indigo-500/60 text-indigo-300 font-extrabold shadow-md'
                          : 'bg-white/5 border-white/10 text-slate-200 hover:bg-white/10'
                      }`}
                    >
                      <span className="text-xs">{lang.name}</span>
                      {isSelected && <Check className="w-4 h-4 text-indigo-400" />}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* SECTION 9: HELP & SUPPORT (WITH WHATSAPP LIVE CHAT) */}
        {activeSection === 'help' && (
          <div className="space-y-4 animate-fadeIn">
            {/* Direct WhatsApp Support Card */}
            <div className="bg-gradient-to-tr from-emerald-950/80 to-[#12121d] border border-emerald-500/30 rounded-3xl p-6 shadow-2xl space-y-4 relative overflow-hidden">
              <div className="flex items-center gap-3">
                <div className="p-3.5 bg-emerald-500/20 text-emerald-400 rounded-2xl border border-emerald-500/40 shadow-inner">
                  <MessageCircle className="w-7 h-7" />
                </div>
                <div>
                  <h3 className="font-black text-lg text-white">Chat on WhatsApp</h3>
                  <p className="text-xs text-emerald-300/80 font-medium">Direct live support from PEWA Team</p>
                </div>
              </div>

              <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl text-xs text-emerald-200 flex items-center justify-between">
                <span>Support Number:</span>
                <span className="font-mono font-bold text-emerald-300 text-sm">{sysConfig.supportWhatsappNumber || '+260961968962'}</span>
              </div>

              <button
                onClick={handleWhatsAppChat}
                className="w-full py-3.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-slate-950 font-black text-sm rounded-2xl shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2 transition-all active:scale-95"
              >
                <MessageCircle className="w-5 h-5 fill-current" />
                <span>Open WhatsApp Support Chat</span>
                <ExternalLink className="w-4 h-4 ml-1 opacity-80" />
              </button>
            </div>

            {/* Support Email Card */}
            <div className="bg-[#14141d] border border-white/10 rounded-3xl p-5 space-y-3 shadow-xl">
              <h3 className="font-extrabold text-sm text-slate-200">Email Assistance</h3>
              <p className="text-xs text-slate-400">Prefer email? Send your inquiries directly to our support inbox.</p>
              <a
                href={`mailto:${sysConfig.supportEmail || 'support@pewa.zm'}`}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-white/10 hover:bg-white/15 text-white font-bold text-xs rounded-2xl border border-white/10 transition-all"
              >
                <span>{sysConfig.supportEmail || 'support@pewa.zm'}</span>
              </a>
            </div>

            {/* FAQs Accordion */}
            <div className="bg-[#14141d] border border-white/10 rounded-3xl p-5 space-y-3 shadow-xl">
              <h3 className="font-extrabold text-sm text-slate-200">Frequently Asked Questions</h3>
              <div className="space-y-2 text-xs">
                <details className="bg-white/5 p-3 rounded-2xl border border-white/5 group">
                  <summary className="font-bold text-slate-200 cursor-pointer flex justify-between items-center">
                    How do I verify my PEWA profile?
                  </summary>
                  <p className="mt-2 text-slate-400 text-[11px] leading-relaxed">
                    Go to your Account tab, request verification, and submit your national ID or selfie. The administrator will review and grant the verified badge.
                  </p>
                </details>

                <details className="bg-white/5 p-3 rounded-2xl border border-white/5 group">
                  <summary className="font-bold text-slate-200 cursor-pointer flex justify-between items-center">
                    What are Sugar Baby & Sugar Mama features?
                  </summary>
                  <p className="mt-2 text-slate-400 text-[11px] leading-relaxed">
                    Users aged 30+ (Females) can opt into Sugar Mama profiles, while younger eligible users can apply for Sugar Baby listings subject to admin approval.
                  </p>
                </details>
              </div>
            </div>
          </div>
        )}

        {/* SECTION 10: ABOUT PEWA */}
        {activeSection === 'about' && (
          <div className="space-y-4 animate-fadeIn">
            <div className="bg-[#14141d] border border-white/10 rounded-3xl p-6 text-center shadow-xl space-y-3">
              <div className="w-16 h-16 mx-auto bg-gradient-to-tr from-pink-500 to-red-600 rounded-3xl p-3 flex items-center justify-center shadow-lg shadow-pink-500/30">
                <Sparkles className="w-9 h-9 text-white" />
              </div>
              <h2 className="font-black text-xl text-white">PEWA Platform</h2>
              <p className="text-xs text-pink-400 font-bold">Version 2.5.0 Premium Mobile</p>
              <p className="text-xs text-slate-400 max-w-sm mx-auto leading-relaxed">
                PEWA is Southern Africa's premier social connection app, providing authentic dating, real-time messaging, and trusted matches.
              </p>
            </div>

            <div className="bg-[#14141d] border border-white/10 rounded-3xl p-5 space-y-4 shadow-xl">
              <div>
                <h3 className="font-extrabold text-sm text-pink-400 mb-1 flex items-center gap-1.5">
                  <FileText className="w-4 h-4" /> Terms & Conditions
                </h3>
                <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-wrap bg-white/5 p-3.5 rounded-2xl border border-white/5">
                  {sysConfig.termsAndConditions}
                </p>
              </div>

              <div>
                <h3 className="font-extrabold text-sm text-emerald-400 mb-1 flex items-center gap-1.5">
                  <Shield className="w-4 h-4" /> Privacy Policy
                </h3>
                <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-wrap bg-white/5 p-3.5 rounded-2xl border border-white/5">
                  {sysConfig.privacyPolicy}
                </p>
              </div>

              <div>
                <h3 className="font-extrabold text-sm text-amber-300 mb-1 flex items-center gap-1.5">
                  <User className="w-4 h-4" /> Community Guidelines
                </h3>
                <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-wrap bg-white/5 p-3.5 rounded-2xl border border-white/5">
                  {sysConfig.communityGuidelines}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* SECTION 11: POPS & BLOCKED USERS */}
        {activeSection === 'pops' && (
          <div className="space-y-4 animate-fadeIn">
            {/* Two Tabs: Tab 1 — Popped Users | Tab 2 — Blocked Users */}
            <div className="flex bg-[#14141d] p-1.5 rounded-2xl border border-white/10">
              <button
                onClick={() => setPopsTab('popped')}
                className={`flex-1 py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all ${
                  popsTab === 'popped'
                    ? 'bg-purple-500 text-white shadow-lg shadow-purple-500/20'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                }`}
              >
                <BalloonIcon variant="pop" className="w-4 h-4" />
                <span>Popped Users ({poppedUsersList.length})</span>
              </button>
              <button
                onClick={() => setPopsTab('blocked')}
                className={`flex-1 py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all ${
                  popsTab === 'blocked'
                    ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/20'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                }`}
              >
                <Shield className="w-4 h-4" />
                <span>Blocked Users ({blockedUsersList.length})</span>
              </button>
            </div>

            {/* Tab 1 — Popped Users */}
            {popsTab === 'popped' && (
              <div className="bg-[#14141d] border border-white/10 rounded-3xl p-4 space-y-3 shadow-xl">
                {poppedUsersList.length === 0 ? (
                  <div className="text-center py-12 space-y-3">
                    <div className="w-14 h-14 bg-purple-500/10 border border-purple-500/20 rounded-full flex items-center justify-center mx-auto text-purple-400">
                      <BalloonIcon variant="pop" className="w-7 h-7" />
                    </div>
                    <div>
                      <h4 className="font-extrabold text-sm text-slate-200">No Popped Users</h4>
                      <p className="text-xs text-slate-400 max-w-xs mx-auto mt-1 leading-relaxed">
                        Users you pop in discovery will appear here. Popping removes a user from your discovery feed and recommendations.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="divide-y divide-white/5">
                    {poppedUsersList.map((item) => (
                      <div key={item.id} className="py-3 flex items-center justify-between gap-3 first:pt-0 last:pb-0">
                        <div className="flex items-center gap-3 min-w-0">
                          <img
                            src={item.avatar}
                            alt={item.fullName}
                            className="w-11 h-11 rounded-2xl object-cover border border-white/10 shadow-inner flex-shrink-0"
                          />
                          <div className="min-w-0">
                            <h4 className="font-extrabold text-sm text-white truncate">{item.fullName}</h4>
                            <p className="text-xs text-purple-400 font-medium truncate">@{item.username}</p>
                            <p className="text-[10px] text-slate-500 mt-0.5">
                              Popped on {new Date(item.timestamp).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={() => handleUnpop(item.userId)}
                          className="px-3.5 py-2 bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 border border-purple-500/30 font-bold text-xs rounded-xl flex items-center gap-1.5 transition-all flex-shrink-0 shadow-md active:scale-95"
                        >
                          <BalloonIcon variant="pop" className="w-3.5 h-3.5" />
                          Unpop
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Tab 2 — Blocked Users */}
            {popsTab === 'blocked' && (
              <div className="bg-[#14141d] border border-white/10 rounded-3xl p-4 space-y-3 shadow-xl">
                {blockedUsersList.length === 0 ? (
                  <div className="text-center py-12 space-y-3">
                    <div className="w-14 h-14 bg-rose-500/10 border border-rose-500/20 rounded-full flex items-center justify-center mx-auto text-rose-400">
                      <Shield className="w-7 h-7" />
                    </div>
                    <div>
                      <h4 className="font-extrabold text-sm text-slate-200">No Blocked Users</h4>
                      <p className="text-xs text-slate-400 max-w-xs mx-auto mt-1 leading-relaxed">
                        Users you block from chats or profiles will appear here. Blocked users cannot message or find you.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="divide-y divide-white/5">
                    {blockedUsersList.map((item) => (
                      <div key={item.id} className="py-3 flex items-center justify-between gap-3 first:pt-0 last:pb-0">
                        <div className="flex items-center gap-3 min-w-0">
                          <img
                            src={item.avatar}
                            alt={item.fullName}
                            className="w-11 h-11 rounded-2xl object-cover border border-white/10 shadow-inner flex-shrink-0"
                          />
                          <div className="min-w-0">
                            <h4 className="font-extrabold text-sm text-white truncate">{item.fullName}</h4>
                            <p className="text-xs text-rose-400 font-medium truncate">@{item.username}</p>
                            <p className="text-[10px] text-slate-500 mt-0.5">
                              Blocked on {new Date(item.timestamp).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={() => handleUnblock(item.userId)}
                          className="px-3.5 py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 font-bold text-xs rounded-xl flex items-center gap-1.5 transition-all flex-shrink-0 shadow-md active:scale-95"
                        >
                          <Shield className="w-3.5 h-3.5" />
                          Unblock
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* SECTION: VERIFY ACCOUNT FLOW */}
        {activeSection === 'verify-account' && (
          <div className="space-y-4 animate-fadeIn">
            {verifySubmittedSuccess ? (
              <div className="bg-[#14141d] border border-emerald-500/40 rounded-3xl p-6 text-center space-y-4 shadow-2xl backdrop-blur-xl">
                <div className="w-16 h-16 bg-emerald-500/20 text-emerald-400 rounded-3xl flex items-center justify-center mx-auto border border-emerald-500/40">
                  <CheckCircle2 className="w-10 h-10" />
                </div>
                <h2 className="font-black text-xl text-white">Verification Submission Received!</h2>
                <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl text-xs text-emerald-300 leading-relaxed font-medium">
                  Your payment is being reviewed. Verification normally takes between 5 and 20 minutes. Thank you for your patience.
                </div>
                <button
                  onClick={() => setActiveSection('main')}
                  className="w-full py-3 bg-gradient-to-r from-pink-500 to-rose-600 hover:from-pink-600 hover:to-rose-700 text-white font-black rounded-2xl shadow-lg transition-all"
                >
                  Return to Settings Menu
                </button>
              </div>
            ) : (
              <div className="bg-[#14141d] border border-white/10 rounded-3xl p-5 space-y-5 shadow-2xl backdrop-blur-xl">
                {/* Step Indicator */}
                <div className="flex items-center justify-between pb-3 border-b border-white/10">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-pink-400" />
                    <span className="font-extrabold text-sm text-white">Account Identity Verification</span>
                  </div>
                  <span className="px-2.5 py-1 bg-pink-500/20 text-pink-300 border border-pink-500/30 rounded-full text-[10px] font-mono font-bold">
                    Step {verifyStep} of 4
                  </span>
                </div>

                {verifyError && (
                  <div className="p-3 bg-rose-500/20 border border-rose-500/40 rounded-2xl text-xs text-rose-300 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                    <span>{verifyError}</span>
                  </div>
                )}

                {/* STEP 1: Personal Details & Documents */}
                {verifyStep === 1 && (
                  <div className="space-y-4">
                    <div className="space-y-3">
                      <h3 className="font-bold text-xs text-slate-300 uppercase tracking-wider">1. Personal Information</h3>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-[11px] text-slate-400 font-bold block mb-1">First Name *</label>
                          <input
                            type="text"
                            value={verifyFirstName}
                            onChange={(e) => setVerifyFirstName(e.target.value)}
                            placeholder="Enter first name"
                            className="w-full bg-[#0d0d12] border border-white/10 focus:border-pink-500/60 rounded-xl px-3 py-2 text-xs text-white outline-none"
                          />
                        </div>
                        <div>
                          <label className="text-[11px] text-slate-400 font-bold block mb-1">Last Name *</label>
                          <input
                            type="text"
                            value={verifyLastName}
                            onChange={(e) => setVerifyLastName(e.target.value)}
                            placeholder="Enter last name"
                            className="w-full bg-[#0d0d12] border border-white/10 focus:border-pink-500/60 rounded-xl px-3 py-2 text-xs text-white outline-none"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="space-y-3 pt-2">
                      <h3 className="font-bold text-xs text-slate-300 uppercase tracking-wider">2. Upload Identity Documents</h3>
                      <p className="text-[11px] text-slate-400">Clear photos of National ID card, Passport, or Driver's License.</p>

                      {/* Instruction Image Card */}
                      <div className="bg-[#0d0d12] border border-pink-500/30 rounded-2xl p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-pink-300 flex items-center gap-1.5">
                            <Info className="w-4 h-4 text-pink-400 shrink-0" />
                            Example: How to position your ID and selfie
                          </span>
                          <span className="text-[10px] text-slate-400 font-medium hidden sm:inline">Tap to enlarge</span>
                        </div>
                        <div
                          onClick={() => setShowDemoFullscreen(true)}
                          className="relative cursor-pointer rounded-xl overflow-hidden border border-white/10 hover:border-pink-500/60 transition-all group max-h-56 bg-black/40 flex items-center justify-center p-1"
                          title="Click to enlarge guide"
                        >
                          <img
                            src="/demo.png"
                            alt="Example: How to position your ID and selfie"
                            className="w-full h-auto max-h-52 object-contain rounded-lg group-hover:scale-[1.01] transition-transform duration-300"
                          />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1.5 text-xs text-white font-bold backdrop-blur-[2px]">
                            <ZoomIn className="w-4 h-4 text-pink-400" />
                            <span>Tap to enlarge example</span>
                          </div>
                        </div>
                      </div>

                      {/* Fullscreen Preview Modal */}
                      {showDemoFullscreen && (
                        <div
                          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn"
                          onClick={() => setShowDemoFullscreen(false)}
                        >
                          <div
                            className="relative max-w-3xl max-h-[90vh] w-full bg-[#14141d] border border-white/15 rounded-3xl p-4 flex flex-col items-center justify-center shadow-2xl"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div className="w-full flex items-center justify-between pb-3 border-b border-white/10 mb-3">
                              <span className="font-extrabold text-sm text-white flex items-center gap-2">
                                <Info className="w-4 h-4 text-pink-400" />
                                Example: How to position your ID and selfie
                              </span>
                              <button
                                onClick={() => setShowDemoFullscreen(false)}
                                className="p-2 bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white rounded-full transition-colors"
                                aria-label="Close preview"
                              >
                                <X className="w-5 h-5" />
                              </button>
                            </div>
                            <div className="relative w-full flex-1 flex items-center justify-center overflow-auto max-h-[75vh] bg-black/50 rounded-2xl p-2">
                              <img
                                src="/demo.png"
                                alt="Example: How to position your ID and selfie"
                                className="max-w-full max-h-[75vh] object-contain rounded-xl"
                              />
                            </div>
                          </div>
                        </div>
                      )}

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        {/* ID Front */}
                        <div className="space-y-1.5">
                          <label className="text-[11px] text-slate-300 font-bold block">Front of ID *</label>
                          <label className="border-2 border-dashed border-white/15 hover:border-pink-500/50 rounded-2xl p-3 flex flex-col items-center justify-center cursor-pointer bg-[#0d0d12] transition-all min-h-[110px] relative overflow-hidden group">
                            {verifyIdFront ? (
                              <img src={verifyIdFront} alt="ID Front" className="w-full h-24 object-cover rounded-xl" />
                            ) : (
                              <div className="text-center space-y-1">
                                <Upload className="w-5 h-5 text-slate-400 mx-auto group-hover:text-pink-400 transition-colors" />
                                <span className="text-[10px] text-slate-400 font-bold block">Upload Front</span>
                              </div>
                            )}
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={async (e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                  setVerifyUploading('front');
                                  const url = await uploadImageWithProgress(file);
                                  setVerifyIdFront(url);
                                  setVerifyUploading('');
                                }
                              }}
                            />
                            {verifyUploading === 'front' && (
                              <div className="absolute inset-0 bg-black/80 flex items-center justify-center text-[10px] text-pink-400 font-bold">
                                Uploading...
                              </div>
                            )}
                          </label>
                        </div>

                        {/* ID Back */}
                        <div className="space-y-1.5">
                          <label className="text-[11px] text-slate-300 font-bold block">Back of ID</label>
                          <label className="border-2 border-dashed border-white/15 hover:border-pink-500/50 rounded-2xl p-3 flex flex-col items-center justify-center cursor-pointer bg-[#0d0d12] transition-all min-h-[110px] relative overflow-hidden group">
                            {verifyIdBack ? (
                              <img src={verifyIdBack} alt="ID Back" className="w-full h-24 object-cover rounded-xl" />
                            ) : (
                              <div className="text-center space-y-1">
                                <Upload className="w-5 h-5 text-slate-400 mx-auto group-hover:text-pink-400 transition-colors" />
                                <span className="text-[10px] text-slate-400 font-bold block">Upload Back</span>
                              </div>
                            )}
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={async (e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                  setVerifyUploading('back');
                                  const url = await uploadImageWithProgress(file);
                                  setVerifyIdBack(url);
                                  setVerifyUploading('');
                                }
                              }}
                            />
                            {verifyUploading === 'back' && (
                              <div className="absolute inset-0 bg-black/80 flex items-center justify-center text-[10px] text-pink-400 font-bold">
                                Uploading...
                              </div>
                            )}
                          </label>
                        </div>

                        {/* Selfie Holding ID */}
                        <div className="space-y-1.5">
                          <label className="text-[11px] text-slate-300 font-bold block">Selfie Holding ID</label>
                          <label className="border-2 border-dashed border-white/15 hover:border-pink-500/50 rounded-2xl p-3 flex flex-col items-center justify-center cursor-pointer bg-[#0d0d12] transition-all min-h-[110px] relative overflow-hidden group">
                            {verifySelfie ? (
                              <img src={verifySelfie} alt="Selfie" className="w-full h-24 object-cover rounded-xl" />
                            ) : (
                              <div className="text-center space-y-1">
                                <Camera className="w-5 h-5 text-slate-400 mx-auto group-hover:text-pink-400 transition-colors" />
                                <span className="text-[10px] text-slate-400 font-bold block">Upload Selfie</span>
                              </div>
                            )}
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={async (e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                  setVerifyUploading('selfie');
                                  const url = await uploadImageWithProgress(file);
                                  setVerifySelfie(url);
                                  setVerifyUploading('');
                                }
                              }}
                            />
                            {verifyUploading === 'selfie' && (
                              <div className="absolute inset-0 bg-black/80 flex items-center justify-center text-[10px] text-pink-400 font-bold">
                                Uploading...
                              </div>
                            )}
                          </label>
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => {
                        if (!verifyFirstName.trim() || !verifyLastName.trim()) {
                          setVerifyError('Please enter both your First Name and Last Name.');
                          return;
                        }
                        if (!verifyIdFront && !verifyIdBack && !verifySelfie) {
                          setVerifyError('Please upload at least your Front of ID to proceed.');
                          return;
                        }
                        setVerifyError('');
                        setVerifyStep(2);
                      }}
                      className="w-full py-3 bg-gradient-to-r from-pink-500 to-rose-600 hover:from-pink-600 hover:to-rose-700 text-white font-black rounded-2xl shadow-lg transition-all flex items-center justify-center gap-2"
                    >
                      <span>Proceed to Plan Selection</span>
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                )}

                {/* STEP 2: Select Verification Plan */}
                {verifyStep === 2 && (
                  <div className="space-y-4">
                    <h3 className="font-bold text-xs text-slate-300 uppercase tracking-wider">Select Verification Plan</h3>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {/* Monthly Plan Card */}
                      <div
                        onClick={() => setVerifyPlan('monthly')}
                        className={`p-4 rounded-2xl border cursor-pointer transition-all space-y-2 relative ${
                          verifyPlan === 'monthly'
                            ? 'bg-pink-500/10 border-pink-500/80 shadow-lg shadow-pink-500/10'
                            : 'bg-[#0d0d12] border-white/10 hover:border-white/30'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <h4 className="font-extrabold text-sm text-white">Monthly Plan</h4>
                          <span className="font-black text-sm text-pink-400">K50 / mo</span>
                        </div>
                        <p className="text-[11px] text-slate-400">Renews monthly. Official blue tick badge, priority search placement & enhanced trust.</p>
                      </div>

                      {/* Yearly Plan Card */}
                      <div
                        onClick={() => setVerifyPlan('yearly')}
                        className={`p-4 rounded-2xl border cursor-pointer transition-all space-y-2 relative ${
                          verifyPlan === 'yearly'
                            ? 'bg-amber-500/10 border-amber-500/80 shadow-lg shadow-amber-500/10'
                            : 'bg-[#0d0d12] border-white/10 hover:border-white/30'
                        }`}
                      >
                        <span className="absolute -top-2.5 right-3 px-2 py-0.5 bg-amber-500 text-slate-950 font-black text-[9px] rounded-full uppercase">
                          Best Value - Save 83%
                        </span>
                        <div className="flex items-center justify-between">
                          <h4 className="font-extrabold text-sm text-white">Yearly Plan</h4>
                          <span className="font-black text-sm text-amber-400">K100 / yr</span>
                        </div>
                        <p className="text-[11px] text-slate-400">Full 12-month verified status. Save over K500 compared to monthly billing.</p>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={() => setVerifyStep(1)}
                        className="py-3 px-5 bg-white/5 hover:bg-white/10 text-slate-300 font-bold rounded-2xl border border-white/10"
                      >
                        Back
                      </button>
                      <button
                        onClick={() => setVerifyStep(3)}
                        className="flex-1 py-3 bg-gradient-to-r from-pink-500 to-rose-600 hover:from-pink-600 hover:to-rose-700 text-white font-black rounded-2xl shadow-lg transition-all flex items-center justify-center gap-2"
                      >
                        <span>View Payment Details</span>
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}

                {/* STEP 3: Payment Instructions */}
                {verifyStep === 3 && (
                  <div className="space-y-4">
                    <h3 className="font-bold text-xs text-slate-300 uppercase tracking-wider">Mobile Money Payment Instructions</h3>

                    <div className="bg-[#0d0d12] border border-amber-500/30 rounded-2xl p-4 space-y-3">
                      <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
                        <span className="text-xs text-slate-400">Chosen Plan:</span>
                        <span className="font-extrabold text-sm text-amber-300">
                          {verifyPlan === 'monthly' ? 'Monthly Plan (K50)' : 'Yearly Plan (K100)'}
                        </span>
                      </div>

                      <div className="space-y-2 text-xs">
                        <div className="flex justify-between items-center">
                          <span className="text-slate-400">Supported Networks:</span>
                          <span className="font-bold text-white">Airtel Money / MTN Mobile Money / Zamtel</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-slate-400">Recipient Name:</span>
                          <span className="font-extrabold text-white">Michael Bishonga</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-slate-400">Payment Number:</span>
                          <span className="font-mono font-bold text-amber-300 text-sm">+260975482573</span>
                        </div>
                      </div>

                      {/* Copy Button */}
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText('0975482573');
                          setCopyNotice('Copied 0975482573!');
                          setTimeout(() => setCopyNotice(''), 3000);
                        }}
                        className="w-full py-2.5 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 font-extrabold rounded-xl flex items-center justify-center gap-2 transition-all active:scale-95"
                      >
                        <Copy className="w-4 h-4" />
                        <span>Copy Mobile Money Number (0975482573)</span>
                      </button>

                      {copyNotice && (
                        <p className="text-emerald-400 text-[11px] font-bold text-center animate-bounce">
                          ✓ {copyNotice}
                        </p>
                      )}
                    </div>

                    <p className="text-[11px] text-slate-400 leading-relaxed bg-white/5 p-3 rounded-xl border border-white/5">
                      <strong>Instructions:</strong> Open your mobile money wallet app or USSD (*778# / *115#), send the fee (K{verifyPlan === 'monthly' ? '50' : '100'}) to <strong>0975482573</strong>, take a screenshot of your successful transaction, and click Next below.
                    </p>

                    <div className="flex gap-2">
                      <button
                        onClick={() => setVerifyStep(2)}
                        className="py-3 px-5 bg-white/5 hover:bg-white/10 text-slate-300 font-bold rounded-2xl border border-white/10"
                      >
                        Back
                      </button>
                      <button
                        onClick={() => setVerifyStep(4)}
                        className="flex-1 py-3 bg-gradient-to-r from-pink-500 to-rose-600 hover:from-pink-600 hover:to-rose-700 text-white font-black rounded-2xl shadow-lg transition-all flex items-center justify-center gap-2"
                      >
                        <span>Upload Payment Proof</span>
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}

                {/* STEP 4: Upload Payment Proof & Submit */}
                {verifyStep === 4 && (
                  <div className="space-y-4">
                    <h3 className="font-bold text-xs text-slate-300 uppercase tracking-wider">Upload Payment Screenshot</h3>

                    <label className="border-2 border-dashed border-emerald-500/40 hover:border-emerald-500/80 rounded-2xl p-4 flex flex-col items-center justify-center cursor-pointer bg-[#0d0d12] transition-all min-h-[140px] relative overflow-hidden group">
                      {verifyPaymentScreenshot ? (
                        <img src={verifyPaymentScreenshot} alt="Payment Proof" className="w-full h-36 object-cover rounded-xl border border-emerald-500/40" />
                      ) : (
                        <div className="text-center space-y-2">
                          <Upload className="w-7 h-7 text-emerald-400 mx-auto group-hover:scale-110 transition-transform" />
                          <span className="text-xs font-bold text-slate-200 block">Click to upload payment screenshot</span>
                          <span className="text-[10px] text-slate-400 block">Format: JPG, PNG, Mobile Money receipt screenshot</span>
                        </div>
                      )}
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            setVerifyUploading('proof');
                            const url = await uploadImageWithProgress(file);
                            setVerifyPaymentScreenshot(url);
                            setVerifyUploading('');
                          }
                        }}
                      />
                      {verifyUploading === 'proof' && (
                        <div className="absolute inset-0 bg-black/80 flex items-center justify-center text-xs text-emerald-400 font-bold">
                          Uploading payment proof...
                        </div>
                      )}
                    </label>

                    <div className="flex gap-2 pt-2">
                      <button
                        onClick={() => setVerifyStep(3)}
                        className="py-3 px-5 bg-white/5 hover:bg-white/10 text-slate-300 font-bold rounded-2xl border border-white/10"
                      >
                        Back
                      </button>
                      <button
                        onClick={() => {
                          setVerifyError('');
                          if (!verifyPaymentScreenshot) {
                            setVerifyError('Please upload a screenshot of your successful mobile money payment transaction.');
                            return;
                          }
                          try {
                            PEWADatabaseService.submitVerificationRequest(
                              currentUser.uid,
                              'national_id',
                              verifyIdFront,
                              {
                                firstName: verifyFirstName.trim(),
                                lastName: verifyLastName.trim(),
                                plan: verifyPlan === 'monthly' ? 'Monthly - K50/month' : 'Yearly - K100/year',
                                idFrontUrl: verifyIdFront,
                                idBackUrl: verifyIdBack,
                                selfieUrl: verifySelfie,
                                paymentScreenshotUrl: verifyPaymentScreenshot
                              }
                            );
                            sessionStorage.removeItem('pewa_draft_verification');
                            setVerifySubmittedSuccess(true);
                          } catch (err: any) {
                            setVerifyError(err.message || 'Error submitting verification request.');
                          }
                        }}
                        className="flex-1 py-3 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-black rounded-2xl shadow-xl transition-all flex items-center justify-center gap-2"
                      >
                        <Check className="w-5 h-5" />
                        <span>Submit Verification Request</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* SECTION: PROMOTE MENU */}
        {activeSection === 'promote' && (
          <div className="space-y-4 animate-fadeIn">
            <div className="bg-[#14141d] border border-amber-500/30 rounded-3xl p-5 space-y-4 shadow-xl backdrop-blur-md">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-amber-500/20 text-amber-400 rounded-xl">
                  <Rocket className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="font-extrabold text-base text-white">Promote & Marketing Options</h2>
                  <p className="text-xs text-slate-400">Expand your reach, get featured at the top, or run custom advertising campaigns.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                {/* Option 1: Boost Posts */}
                <div
                  onClick={() => {
                    setBoostSubmittedSuccess(false);
                    setActiveSection('boost-posts');
                  }}
                  className="bg-[#0d0d12] border border-pink-500/40 hover:border-pink-500/80 rounded-2xl p-4 cursor-pointer transition-all space-y-2 group shadow-lg"
                >
                  <div className="p-2.5 bg-pink-500/20 text-pink-400 rounded-xl w-fit border border-pink-500/30 group-hover:scale-105 transition-transform">
                    <Rocket className="w-6 h-6" />
                  </div>
                  <h3 className="font-black text-sm text-white group-hover:text-pink-300">Boost Posts</h3>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Prioritize your posts at the top of the PEWA home feed across Zambia & target countries. Starting at K20/day.
                  </p>
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-pink-400 pt-1">
                    <span>Start Boosting</span>
                    <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                  </span>
                </div>

                {/* Option 2: Advertise With Us */}
                <div
                  onClick={() => {
                    setAdSubmittedSuccess(false);
                    setActiveSection('advertise-with-us');
                  }}
                  className="bg-[#0d0d12] border border-amber-500/40 hover:border-amber-500/80 rounded-2xl p-4 cursor-pointer transition-all space-y-2 group shadow-lg"
                >
                  <div className="p-2.5 bg-amber-500/20 text-amber-400 rounded-xl w-fit border border-amber-500/30 group-hover:scale-105 transition-transform">
                    <Megaphone className="w-6 h-6" />
                  </div>
                  <h3 className="font-black text-sm text-white group-hover:text-amber-300">Advertise With Us</h3>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Run custom high-visibility banner campaigns for your business, event, or service across all active PEWA users.
                  </p>
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-400 pt-1">
                    <span>Create Campaign</span>
                    <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* SECTION: BOOST POSTS FLOW */}
        {activeSection === 'boost-posts' && (
          <div className="space-y-4 animate-fadeIn">
            {boostSubmittedSuccess ? (
              <div className="bg-[#14141d] border border-emerald-500/40 rounded-3xl p-6 text-center space-y-4 shadow-2xl backdrop-blur-xl">
                <div className="w-16 h-16 bg-emerald-500/20 text-emerald-400 rounded-3xl flex items-center justify-center mx-auto border border-emerald-500/40">
                  <CheckCircle2 className="w-10 h-10" />
                </div>
                <h2 className="font-black text-xl text-white">Boost Request Submitted!</h2>
                <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl text-xs text-emerald-300 leading-relaxed font-medium">
                  Your post boost payment screenshot has been uploaded and is under review by PEWA Admin. You will receive a notification once approved.
                </div>
                <button
                  onClick={() => setActiveSection('main')}
                  className="w-full py-3 bg-gradient-to-r from-pink-500 to-rose-600 hover:from-pink-600 hover:to-rose-700 text-white font-black rounded-2xl shadow-lg transition-all"
                >
                  Return to Settings Menu
                </button>
              </div>
            ) : (
              <div className="bg-[#14141d] border border-white/10 rounded-3xl p-5 space-y-5 shadow-2xl backdrop-blur-xl">
                <div className="flex items-center justify-between pb-3 border-b border-white/10">
                  <div className="flex items-center gap-2">
                    <Rocket className="w-5 h-5 text-amber-400" />
                    <span className="font-extrabold text-sm text-white">Boost Posts Campaign</span>
                  </div>
                  <span className="px-2.5 py-1 bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-full text-[10px] font-mono font-bold">
                    Step {boostStep} of 3
                  </span>
                </div>

                {boostError && (
                  <div className="p-3 bg-rose-500/20 border border-rose-500/40 rounded-2xl text-xs text-rose-300 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                    <span>{boostError}</span>
                  </div>
                )}

                {/* STEP 1: Select Post & Settings */}
                {boostStep === 1 && (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <h3 className="font-bold text-xs text-slate-300 uppercase tracking-wider">1. Select Your Post to Boost</h3>
                      {(() => {
                        const userPosts = PEWADatabaseService.getPosts(true).filter(p => p.authorId === currentUser.uid);
                        if (userPosts.length === 0) {
                          return (
                            <div className="p-4 bg-[#0d0d12] border border-white/10 rounded-2xl text-center space-y-2 text-xs text-slate-400">
                              <p className="font-bold text-white">You haven't published any posts yet.</p>
                              <p>Create a post on the Posts feed tab first before setting up a boost campaign.</p>
                            </div>
                          );
                        }
                        return (
                          <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                            {userPosts.map(p => (
                              <div
                                key={p.id}
                                onClick={() => setBoostSelectedPostId(p.id)}
                                className={`p-3 rounded-2xl border cursor-pointer transition-all flex items-center justify-between text-xs ${
                                  boostSelectedPostId === p.id
                                    ? 'bg-amber-500/15 border-amber-500/80 text-white'
                                    : 'bg-[#0d0d12] border-white/10 text-slate-300 hover:border-white/30'
                                }`}
                              >
                                <div className="truncate max-w-xs">
                                  <p className="font-medium truncate">{p.content || 'Photo Post'}</p>
                                  <span className="text-[10px] text-slate-400">{new Date(p.createdAt).toLocaleDateString()}</span>
                                </div>
                                <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                                  boostSelectedPostId === p.id ? 'border-amber-400 bg-amber-400 text-slate-950' : 'border-slate-600'
                                }`}>
                                  {boostSelectedPostId === p.id && <Check className="w-3 h-3 stroke-[3]" />}
                                </div>
                              </div>
                            ))}
                          </div>
                        );
                      })()}
                    </div>

                    <div className="space-y-3 pt-2">
                      <h3 className="font-bold text-xs text-slate-300 uppercase tracking-wider">2. Campaign Targeting & Duration</h3>
                      
                      {/* Target Countries */}
                      <div>
                        <label className="text-[11px] text-slate-400 font-bold block mb-1">Target Countries</label>
                        <div className="flex flex-wrap gap-1.5">
                          {['Zambia', 'Malawi', 'Zimbabwe', 'South Africa', 'Congo DR', 'Botswana'].map(c => {
                            const isSelected = boostTargetCountries.includes(c);
                            return (
                              <button
                                key={c}
                                type="button"
                                onClick={() => {
                                  if (isSelected) {
                                    if (boostTargetCountries.length > 1) {
                                      setBoostTargetCountries(boostTargetCountries.filter(x => x !== c));
                                    }
                                  } else {
                                    setBoostTargetCountries([...boostTargetCountries, c]);
                                  }
                                }}
                                className={`px-2.5 py-1 rounded-xl text-xs font-bold border transition-all ${
                                  isSelected
                                    ? 'bg-amber-500/20 border-amber-500/60 text-amber-300'
                                    : 'bg-[#0d0d12] border-white/10 text-slate-400 hover:text-slate-200'
                                }`}
                              >
                                {c}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Duration Days */}
                      <div>
                        <div className="flex justify-between items-center mb-1">
                          <label className="text-[11px] text-slate-400 font-bold">Campaign Duration (Days)</label>
                          <span className="text-xs font-black text-amber-400">K20 / day</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <input
                            type="range"
                            min="1"
                            max="30"
                            value={boostDays}
                            onChange={(e) => setBoostDays(parseInt(e.target.value))}
                            className="flex-1 accent-amber-400 cursor-pointer"
                          />
                          <span className="font-mono font-bold text-sm text-white min-w-[50px] text-right">
                            {boostDays} {boostDays === 1 ? 'day' : 'days'}
                          </span>
                        </div>
                      </div>

                      {/* Total Calculation Card */}
                      <div className="p-3.5 bg-amber-500/10 border border-amber-500/30 rounded-2xl flex items-center justify-between">
                        <span className="text-xs font-extrabold text-amber-300">Total Campaign Fee:</span>
                        <span className="font-black text-lg text-amber-400">K{boostDays * 20} Kwacha</span>
                      </div>
                    </div>

                    <button
                      onClick={() => {
                        setBoostError('');
                        if (!boostSelectedPostId) {
                          setBoostError('Please select a post to boost.');
                          return;
                        }
                        if (boostTargetCountries.length === 0) {
                          setBoostError('Please select at least one target country.');
                          return;
                        }
                        setBoostStep(2);
                      }}
                      className="w-full py-3 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-slate-950 font-black rounded-2xl shadow-lg transition-all flex items-center justify-center gap-2"
                    >
                      <span>Proceed to Payment (K{boostDays * 20})</span>
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                )}

                {/* STEP 2: Mobile Money Payment */}
                {boostStep === 2 && (
                  <div className="space-y-4">
                    <h3 className="font-bold text-xs text-slate-300 uppercase tracking-wider">Payment Instructions</h3>

                    <div className="bg-[#0d0d12] border border-amber-500/30 rounded-2xl p-4 space-y-3">
                      <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
                        <span className="text-xs text-slate-400">Boost Fee ({boostDays} days):</span>
                        <span className="font-black text-base text-amber-400">K{boostDays * 20} Kwacha</span>
                      </div>

                      <div className="space-y-2 text-xs">
                        <div className="flex justify-between items-center">
                          <span className="text-slate-400">Recipient Name:</span>
                          <span className="font-extrabold text-white">Michael Bishonga</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-slate-400">Payment Number:</span>
                          <span className="font-mono font-bold text-amber-300 text-sm">+260975482573</span>
                        </div>
                      </div>

                      <button
                        onClick={() => {
                          navigator.clipboard.writeText('0975482573');
                          setCopyNotice('Copied 0975482573!');
                          setTimeout(() => setCopyNotice(''), 3000);
                        }}
                        className="w-full py-2.5 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 font-extrabold rounded-xl flex items-center justify-center gap-2 transition-all active:scale-95"
                      >
                        <Copy className="w-4 h-4" />
                        <span>Copy Mobile Money Number (0975482573)</span>
                      </button>

                      {copyNotice && (
                        <p className="text-emerald-400 text-[11px] font-bold text-center animate-bounce">
                          ✓ {copyNotice}
                        </p>
                      )}
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={() => setBoostStep(1)}
                        className="py-3 px-5 bg-white/5 hover:bg-white/10 text-slate-300 font-bold rounded-2xl border border-white/10"
                      >
                        Back
                      </button>
                      <button
                        onClick={() => setBoostStep(3)}
                        className="flex-1 py-3 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-slate-950 font-black rounded-2xl shadow-lg transition-all flex items-center justify-center gap-2"
                      >
                        <span>Upload Payment Proof</span>
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}

                {/* STEP 3: Upload Proof & Submit */}
                {boostStep === 3 && (
                  <div className="space-y-4">
                    <h3 className="font-bold text-xs text-slate-300 uppercase tracking-wider">Upload Payment Screenshot</h3>

                    <label className="border-2 border-dashed border-emerald-500/40 hover:border-emerald-500/80 rounded-2xl p-4 flex flex-col items-center justify-center cursor-pointer bg-[#0d0d12] transition-all min-h-[140px] relative overflow-hidden group">
                      {boostPaymentScreenshot ? (
                        <img src={boostPaymentScreenshot} alt="Payment Proof" className="w-full h-36 object-cover rounded-xl border border-emerald-500/40" />
                      ) : (
                        <div className="text-center space-y-2">
                          <Upload className="w-7 h-7 text-emerald-400 mx-auto group-hover:scale-110 transition-transform" />
                          <span className="text-xs font-bold text-slate-200 block">Click to upload payment screenshot</span>
                        </div>
                      )}
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            setBoostUploading(true);
                            const url = await uploadImageWithProgress(file);
                            setBoostPaymentScreenshot(url);
                            setBoostUploading(false);
                          }
                        }}
                      />
                      {boostUploading && (
                        <div className="absolute inset-0 bg-black/80 flex items-center justify-center text-xs text-emerald-400 font-bold">
                          Uploading payment proof...
                        </div>
                      )}
                    </label>

                    <div className="flex gap-2 pt-2">
                      <button
                        onClick={() => setBoostStep(2)}
                        className="py-3 px-5 bg-white/5 hover:bg-white/10 text-slate-300 font-bold rounded-2xl border border-white/10"
                      >
                        Back
                      </button>
                      <button
                        onClick={() => {
                          setBoostError('');
                          if (!boostPaymentScreenshot) {
                            setBoostError('Please upload your payment screenshot.');
                            return;
                          }
                          try {
                            const userPosts = PEWADatabaseService.getPosts(true).filter(p => p.authorId === currentUser.uid);
                            const targetPost = userPosts.find(p => p.id === boostSelectedPostId);

                            PEWADatabaseService.submitPostBoostRequest({
                              userUid: currentUser.uid,
                              userName: currentUser.fullName,
                              userAvatar: currentUser.avatar,
                              userPhone: currentUser.phone,
                              postId: boostSelectedPostId,
                              postContent: targetPost?.content || '',
                              postMediaUrl: targetPost?.mediaUrl,
                              days: boostDays,
                              totalPayment: boostDays * 20,
                              targetCountries: boostTargetCountries,
                              targetAudience: boostTargetAudience,
                              paymentScreenshotUrl: boostPaymentScreenshot
                            });
                            sessionStorage.removeItem('pewa_draft_boost');
                            setBoostSubmittedSuccess(true);
                          } catch (err: any) {
                            setBoostError(err.message || 'Error submitting boost request.');
                          }
                        }}
                        className="flex-1 py-3 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-black rounded-2xl shadow-xl transition-all flex items-center justify-center gap-2"
                      >
                        <Check className="w-5 h-5" />
                        <span>Submit Boost Request</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* SECTION: ADVERTISE WITH US FLOW */}
        {activeSection === 'advertise-with-us' && (
          <div className="space-y-4 animate-fadeIn">
            {adSubmittedSuccess ? (
              <div className="bg-[#14141d] border border-emerald-500/40 rounded-3xl p-6 text-center space-y-4 shadow-2xl backdrop-blur-xl">
                <div className="w-16 h-16 bg-emerald-500/20 text-emerald-400 rounded-3xl flex items-center justify-center mx-auto border border-emerald-500/40">
                  <CheckCircle2 className="w-10 h-10" />
                </div>
                <h2 className="font-black text-xl text-white">Ad Request Submitted!</h2>
                <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl text-xs text-emerald-300 leading-relaxed font-medium">
                  Thank you! Your advertising campaign request and payment screenshot have been submitted for Administrator review.
                </div>
                <button
                  onClick={() => setActiveSection('main')}
                  className="w-full py-3 bg-gradient-to-r from-pink-500 to-rose-600 hover:from-pink-600 hover:to-rose-700 text-white font-black rounded-2xl shadow-lg transition-all"
                >
                  Return to Settings Menu
                </button>
              </div>
            ) : (
              <div className="bg-[#14141d] border border-white/10 rounded-3xl p-5 space-y-4 shadow-2xl backdrop-blur-xl">
                <div className="flex items-center gap-2 pb-3 border-b border-white/10">
                  <Megaphone className="w-5 h-5 text-amber-400" />
                  <span className="font-extrabold text-sm text-white">Create Advertising Campaign</span>
                </div>

                {adError && (
                  <div className="p-3 bg-rose-500/20 border border-rose-500/40 rounded-2xl text-xs text-rose-300 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                    <span>{adError}</span>
                  </div>
                )}

                <div className="space-y-3 text-xs">
                  <div>
                    <label className="text-[11px] text-slate-400 font-bold block mb-1">Business / Service Name *</label>
                    <input
                      type="text"
                      value={adBusinessName}
                      onChange={(e) => setAdBusinessName(e.target.value)}
                      placeholder="e.g. Lusaka Fashion Hub"
                      className="w-full bg-[#0d0d12] border border-white/10 focus:border-amber-500/60 rounded-xl px-3 py-2 text-white outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] text-slate-400 font-bold block mb-1">Contact Phone *</label>
                      <input
                        type="text"
                        value={adPhone}
                        onChange={(e) => setAdPhone(e.target.value)}
                        placeholder="+260..."
                        className="w-full bg-[#0d0d12] border border-white/10 focus:border-amber-500/60 rounded-xl px-3 py-2 text-white outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-slate-400 font-bold block mb-1">Campaign Duration *</label>
                      <select
                        value={adDuration}
                        onChange={(e) => setAdDuration(e.target.value)}
                        className="w-full bg-[#0d0d12] border border-white/10 focus:border-amber-500/60 rounded-xl px-3 py-2 text-white outline-none"
                      >
                        <option value="7 Days (K150)">7 Days - K150</option>
                        <option value="14 Days (K280)">14 Days - K280</option>
                        <option value="30 Days (K500)">30 Days - K500</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] text-slate-400 font-bold block mb-1">Campaign Objective & Description *</label>
                    <textarea
                      rows={2}
                      value={adDescription}
                      onChange={(e) => setAdDescription(e.target.value)}
                      placeholder="Brief description of what your business offers..."
                      className="w-full bg-[#0d0d12] border border-white/10 focus:border-amber-500/60 rounded-xl px-3 py-2 text-white outline-none resize-none"
                    />
                  </div>

                  {/* Banner Image Upload */}
                  <div>
                    <label className="text-[11px] text-slate-400 font-bold block mb-1">Campaign Banner / Artwork Image *</label>
                    <label className="border-2 border-dashed border-amber-500/40 hover:border-amber-500/80 rounded-2xl p-3 flex flex-col items-center justify-center cursor-pointer bg-[#0d0d12] transition-all min-h-[100px] relative overflow-hidden group">
                      {adBannerUrl ? (
                        <img src={adBannerUrl} alt="Ad Banner" className="w-full h-28 object-cover rounded-xl border border-amber-500/40" />
                      ) : (
                        <div className="text-center space-y-1">
                          <Upload className="w-5 h-5 text-amber-400 mx-auto" />
                          <span className="text-[10px] text-slate-300 font-bold block">Upload Banner Image</span>
                        </div>
                      )}
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            setAdUploading(true);
                            const url = await uploadImageWithProgress(file);
                            setAdBannerUrl(url);
                            setAdUploading(false);
                          }
                        }}
                      />
                    </label>
                  </div>

                  {/* Payment Details */}
                  <div className="bg-[#0d0d12] border border-amber-500/30 rounded-2xl p-3.5 space-y-2">
                    <p className="text-[11px] font-bold text-amber-300">Payment Details (Michael Bishonga)</p>
                    <div className="flex justify-between items-center text-[11px]">
                      <span className="text-slate-400">Mobile Money Number:</span>
                      <span className="font-mono font-bold text-amber-300">+260975482573</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText('0975482573');
                        setCopyNotice('Copied 0975482573!');
                        setTimeout(() => setCopyNotice(''), 3000);
                      }}
                      className="w-full py-2 bg-amber-500/20 border border-amber-500/30 text-amber-300 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy Number (0975482573)</span>
                    </button>
                    {copyNotice && <p className="text-emerald-400 text-[10px] text-center font-bold">✓ {copyNotice}</p>}
                  </div>

                  {/* Payment Proof Upload */}
                  <div>
                    <label className="text-[11px] text-slate-400 font-bold block mb-1">Payment Proof Screenshot *</label>
                    <label className="border-2 border-dashed border-emerald-500/40 hover:border-emerald-500/80 rounded-2xl p-3 flex flex-col items-center justify-center cursor-pointer bg-[#0d0d12] transition-all min-h-[90px] relative overflow-hidden group">
                      {adPaymentScreenshot ? (
                        <img src={adPaymentScreenshot} alt="Payment Proof" className="w-full h-24 object-cover rounded-xl border border-emerald-500/40" />
                      ) : (
                        <div className="text-center space-y-1">
                          <Upload className="w-5 h-5 text-emerald-400 mx-auto" />
                          <span className="text-[10px] text-slate-300 font-bold block">Upload Payment Screenshot</span>
                        </div>
                      )}
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            setAdUploading(true);
                            const url = await uploadImageWithProgress(file);
                            setAdPaymentScreenshot(url);
                            setAdUploading(false);
                          }
                        }}
                      />
                    </label>
                  </div>
                </div>

                <button
                  onClick={() => {
                    setAdError('');
                    if (!adBusinessName.trim() || !adDescription.trim()) {
                      setAdError('Please enter your business name and campaign description.');
                      return;
                    }
                    if (!adBannerUrl) {
                      setAdError('Please upload your campaign banner image.');
                      return;
                    }
                    if (!adPaymentScreenshot) {
                      setAdError('Please upload your payment proof screenshot.');
                      return;
                    }
                    try {
                      PEWADatabaseService.submitAdRequest({
                        userUid: currentUser.uid,
                        businessName: adBusinessName.trim(),
                        contactName: adContactName.trim(),
                        phone: adPhone.trim(),
                        email: adEmail.trim(),
                        description: adDescription.trim(),
                        bannerUrl: adBannerUrl,
                        duration: adDuration
                      });
                      sessionStorage.removeItem('pewa_draft_ad');
                      setAdSubmittedSuccess(true);
                    } catch (err: any) {
                      setAdError(err.message || 'Error submitting ad request.');
                    }
                  }}
                  className="w-full py-3 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-slate-950 font-black rounded-2xl shadow-xl transition-all flex items-center justify-center gap-2"
                >
                  <Check className="w-5 h-5" />
                  <span>Submit Advertising Campaign</span>
                </button>
              </div>
            )}
          </div>
        )}

      </main>
    </div>
  );
};
