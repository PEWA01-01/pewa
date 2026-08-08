import React, { useState, useEffect } from 'react';
import { UserProfile } from '../../types';
import {
  X,
  ShieldCheck,
  MapPin,
  Sparkles,
  Phone,
  MessageCircle,
  Copy,
  Check,
  Clock,
  Heart,
  Share2,
  ShieldAlert,
  AlertOctagon,
  Flame,
  User,
  Coffee,
  Cigarette,
  Eye,
  Ruler,
  Smile,
  Globe,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  CheckCircle,
  Camera,
  Layers
} from 'lucide-react';
import { PEWADatabaseService } from '../../services/db';
import { DEFAULT_USER_AVATAR } from '../../services/cloudinary';
import { VerificationRequestModal } from './VerificationRequestModal';

interface UserProfileModalProps {
  user: UserProfile;
  currentUser: UserProfile;
  onClose: () => void;
  onStartChat?: (targetUser: UserProfile) => void;
  onStartVoiceCall?: (targetUser: UserProfile) => void;
}

interface GalleryPhoto {
  url: string;
  title: string;
  slotName: string;
  slot: 'main' | 'fullBody' | 'normalFace' | 'extra1' | 'extra2';
}

export const UserProfileModal: React.FC<UserProfileModalProps> = ({
  user,
  currentUser,
  onClose,
  onStartChat,
  onStartVoiceCall
}) => {
  const [copiedId, setCopiedId] = useState(false);
  const [isKept, setIsKept] = useState(() => {
    return PEWADatabaseService.isUserKept(currentUser.uid, user.uid);
  });
  const [isPopped, setIsPopped] = useState(() => {
    return PEWADatabaseService.isUserPopped(currentUser.uid, user.uid);
  });
  const [keepsCount, setKeepsCount] = useState(user.keepsCount || user.keepCount || 0);

  // Full-screen image lightbox state
  const [activeLightboxIndex, setActiveLightboxIndex] = useState<number | null>(null);

  // Limit modals
  const [showKeepLimitModal, setShowKeepLimitModal] = useState(false);
  const [showSugarLimitModal, setShowSugarLimitModal] = useState(false);
  const [showVoiceLimitModal, setShowVoiceLimitModal] = useState(false);
  const [showVerificationModal, setShowVerificationModal] = useState(false);
  const [showReportForm, setShowReportForm] = useState(false);
  const [reportReason, setReportReason] = useState('Inappropriate behavior');
  const [reportDetails, setReportDetails] = useState('');

  const isTargetVerified = PEWADatabaseService.isUserVerified(user);
  const isCurrentVerified = PEWADatabaseService.isUserVerified(currentUser);

  // Privacy checks
  const privacy = user.settings?.privacy || {};
  const canShowLocation = privacy.showLocation !== false;
  const canShowOnlineStatus = privacy.showOnlineStatus !== false && privacy.whoCanSeeOnlineStatus !== 'nobody';
  const isOnline = user.onlineStatus === 'online';

  const avatarUrl = user.avatar && user.avatar.trim() !== '' ? user.avatar : (user.profilePhoto || user.profileImage || DEFAULT_USER_AVATAR);
  const coverUrl = user.coverImage || user.coverPhoto || avatarUrl;

  // Construct gallery images in exact required order:
  // 1. Main profile picture
  // 2. Full body image
  // 3. Natural face image
  // 4. Additional uploaded images
  // Maximum 5 profile images per user
  const getApprovedGalleryPhotos = (): GalleryPhoto[] => {
    const items: GalleryPhoto[] = [];
    const addedUrls = new Set<string>();

    const addPhoto = (url: string | undefined, title: string, slotName: string, slot: GalleryPhoto['slot']) => {
      if (!url || typeof url !== 'string' || url.trim() === '') return;
      if (addedUrls.has(url)) return;
      // Skip if explicitly rejected
      if (user.imageVerificationStatus === 'rejected' && user.rejectedPhotosReason) return;

      addedUrls.add(url);
      items.push({
        url,
        title,
        slotName,
        slot
      });
    };

    // 1. Main profile image
    addPhoto(avatarUrl, 'Main Profile Photo', '#1 Main Profile', 'main');

    // 2. Full body image
    addPhoto(user.profilePhotos?.fullBody, 'Full Body Photo', '#2 Full Body', 'fullBody');

    // 3. Natural face image
    addPhoto(user.profilePhotos?.normalFace || user.profilePhotos?.naturalPhoto, 'Natural Face Photo', '#3 Natural Face', 'normalFace');

    // 4. Additional uploaded images (extra1, extra2, or verifiedPhotos)
    addPhoto(user.profilePhotos?.extra1, 'Additional Photo 1', '#4 Extra Photo 1', 'extra1');
    addPhoto(user.profilePhotos?.extra2, 'Additional Photo 2', '#5 Extra Photo 2', 'extra2');

    if (items.length < 5 && user.verifiedPhotos && Array.isArray(user.verifiedPhotos)) {
      user.verifiedPhotos.forEach((vUrl, i) => {
        if (items.length < 5) {
          addPhoto(vUrl, `Verified Photo ${i + 1}`, `#${items.length + 1} Photo`, 'extra1');
        }
      });
    }

    return items.slice(0, 5); // Max 5 profile images
  };

  const galleryPhotos = getApprovedGalleryPhotos();

  // Keyboard navigation for Lightbox
  useEffect(() => {
    if (activeLightboxIndex === null) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setActiveLightboxIndex(null);
      } else if (e.key === 'ArrowLeft') {
        setActiveLightboxIndex(prev => (prev !== null && prev > 0 ? prev - 1 : galleryPhotos.length - 1));
      } else if (e.key === 'ArrowRight') {
        setActiveLightboxIndex(prev => (prev !== null && prev < galleryPhotos.length - 1 ? prev + 1 : 0));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeLightboxIndex, galleryPhotos.length]);

  const handleCopyId = () => {
    navigator.clipboard.writeText(user.username ? `@${user.username}` : user.uid);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  const handleKeepToggle = () => {
    if (isKept) {
      PEWADatabaseService.unkeepUser(currentUser.uid, user.uid);
      setIsKept(false);
      setKeepsCount(prev => Math.max(0, prev - 1));
      window.dispatchEvent(new Event('pewa_pops_updated'));
    } else {
      const res = PEWADatabaseService.keepUser(currentUser.uid, user.uid);
      if (res.limitReached) {
        setShowKeepLimitModal(true);
        return;
      }
      setIsKept(true);
      setKeepsCount(res.totalKeeps || keepsCount + 1);
      window.dispatchEvent(new Event('pewa_pops_updated'));
    }
  };

  const handlePopToggle = () => {
    const isNowPopped = PEWADatabaseService.togglePop(currentUser.uid, user.uid);
    setIsPopped(isNowPopped);
    window.dispatchEvent(new Event('pewa_pops_updated'));
  };

  const handleMessageClick = () => {
    const sugarCheck = PEWADatabaseService.canUserStartSugarChat(currentUser.uid, user.uid);
    if (!sugarCheck.allowed) {
      setShowSugarLimitModal(true);
      return;
    }
    if (onStartChat) {
      onStartChat(user);
      onClose();
    }
  };

  const handleCallClick = () => {
    if (!isCurrentVerified) {
      setShowVoiceLimitModal(true);
      return;
    }
    if (onStartVoiceCall) {
      onStartVoiceCall(user);
      onClose();
    }
  };

  const handleReportSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    PEWADatabaseService.submitReport(currentUser.uid, user.uid, undefined, reportReason, reportDetails);
    PEWADatabaseService.blockUser(currentUser.uid, user.uid);
    window.dispatchEvent(new Event('pewa_pops_updated'));
    alert('Report submitted to moderation. Profile has been blocked.');
    setShowReportForm(false);
    onClose();
  };

  // Lifestyle formatting
  const drinking = user.lifestylePreferences?.drinking || user.lifestyle?.drinking || 'Not specified';
  const smoking = user.lifestylePreferences?.smoking || user.lifestyle?.smoking || 'Not specified';
  const relationshipStatus = user.lifestylePreferences?.relationshipStatus || user.relationshipOrientation || 'Single';
  const height = user.height || '172 cm';
  const hairColor = user.hairColor || 'Dark Brown';
  const eyeColor = user.eyeColor || 'Brown';
  const bodyType = user.bodyType || 'Average';

  const interestsList = user.interests && user.interests.length > 0
    ? user.interests
    : ['Music', 'Travel', 'Dining out', 'Fitness', 'Movies'];

  const hobbiesList = user.hobbies && user.hobbies.length > 0
    ? user.hobbies
    : ['Photography', 'Reading', 'Cooking', 'Art'];

  const thingsInterestedIn = user.thingsInterestedIn && user.thingsInterestedIn.length > 0
    ? user.thingsInterestedIn
    : ['Serious relationship', 'Meaningful conversations', 'Weekend getaways'];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/85 backdrop-blur-xl animate-fadeIn">
      <div className="relative w-full max-w-lg bg-[#121216] border border-white/10 rounded-3xl overflow-hidden shadow-2xl max-h-[92vh] flex flex-col text-white">
        
        {/* Header Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-20 p-2.5 bg-black/60 hover:bg-black/80 rounded-full text-slate-300 hover:text-white backdrop-blur-md transition-colors shadow-lg"
          title="Close profile"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Scrollable Container */}
        <div className="overflow-y-auto flex-1 space-y-5 pb-6">
          
          {/* Cover Header & Avatar */}
          <div className="relative h-44 sm:h-52 w-full bg-slate-900 shrink-0 overflow-hidden">
            <img
              src={coverUrl}
              alt={user.fullName}
              className="w-full h-full object-cover opacity-80"
              referrerPolicy="no-referrer"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#121216] via-[#121216]/40 to-transparent" />

            {/* Top Badges */}
            <div className="absolute top-4 left-4 flex flex-wrap gap-2 z-10">
              {isTargetVerified ? (
                <span className="bg-gradient-to-r from-pink-500 to-rose-500 text-white font-black text-[11px] px-3 py-1 rounded-full shadow-lg flex items-center gap-1.5 border border-pink-400/30">
                  <ShieldCheck className="w-4 h-4 fill-white text-pink-600" /> Admin Verified
                </span>
              ) : (
                <span className="bg-black/60 backdrop-blur-md text-slate-400 text-[11px] font-semibold px-3 py-1 rounded-full border border-white/10 flex items-center gap-1">
                  <ShieldAlert className="w-3.5 h-3.5 text-amber-400" /> Standard User
                </span>
              )}
              {user.sugarProfile && (
                <span className="bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[11px] font-bold px-3 py-1 rounded-full">
                  Sugar Partner
                </span>
              )}
            </div>
          </div>

          {/* Profile Basic Summary Card */}
          <div className="px-5 -mt-16 relative z-10 flex flex-col items-center text-center space-y-3">
            <div
              onClick={() => setActiveLightboxIndex(0)}
              className="relative cursor-pointer group"
              title="Click to view full-screen image"
            >
              <img
                src={avatarUrl}
                alt={user.fullName}
                className="w-24 h-24 sm:w-28 sm:h-28 rounded-full border-4 border-[#121216] object-cover shadow-2xl bg-slate-800 group-hover:scale-105 transition-transform duration-300"
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-0 rounded-full bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <Maximize2 className="w-6 h-6 text-white drop-shadow-md" />
              </div>
              {canShowOnlineStatus && (
                <span
                  className={`absolute bottom-1 right-1 w-5 h-5 rounded-full border-3 border-[#121216] shadow-md ${
                    isOnline ? 'bg-emerald-500 ring-2 ring-emerald-500/40' : 'bg-slate-500'
                  }`}
                  title={isOnline ? 'Online now' : 'Offline'}
                />
              )}
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-center gap-2 flex-wrap">
                <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                  {user.fullName}, {user.age}
                </h2>
                {isTargetVerified && (
                  <ShieldCheck className="w-5 h-5 text-pink-500 fill-pink-500/20 inline" />
                )}
              </div>

              {/* Username / User ID Tag */}
              <div className="flex items-center justify-center gap-2 text-xs text-slate-400 font-medium">
                <span className="bg-white/5 border border-white/10 px-2.5 py-0.5 rounded-lg text-pink-300 font-mono">
                  {user.username ? `@${user.username}` : `ID: ${user.uid.slice(0, 8)}...`}
                </span>
                <button
                  onClick={handleCopyId}
                  className="p-1 text-slate-400 hover:text-white transition-colors"
                  title="Copy User ID"
                >
                  {copiedId ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>

              {/* Location & Active Status */}
              <div className="flex items-center justify-center gap-3 text-xs text-slate-300 pt-1 flex-wrap">
                {canShowLocation && (user.city || user.country) && (
                  <span className="flex items-center gap-1 text-pink-300 font-semibold bg-pink-500/10 px-2.5 py-1 rounded-full border border-pink-500/20">
                    <MapPin className="w-3.5 h-3.5 text-pink-400" />
                    {user.city ? `${user.city}, ` : ''}{user.country || 'Global'}
                  </span>
                )}
                {canShowOnlineStatus && (
                  <span className="flex items-center gap-1 text-slate-400">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    {isOnline ? 'Online now' : 'Active recently'}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Photo Gallery Section (Max 5 Approved Photos) */}
          {(() => {
            const photosVis = user.settings?.privacy?.photosVisibility || 'everyone';
            const isPhotosLocked = photosVis === 'verified_only' && !isCurrentVerified;

            if (galleryPhotos.length === 0) return null;

            return (
              <div className="px-5 space-y-2.5">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                    <Camera className="w-3.5 h-3.5 text-pink-400" /> Photo Gallery ({galleryPhotos.length}/5)
                  </h3>
                  {isPhotosLocked ? (
                    <span className="text-[10px] text-amber-400 font-bold bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                      Verified Users Only
                    </span>
                  ) : (
                    <span className="text-[10px] text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 flex items-center gap-1">
                      <CheckCircle className="w-3 h-3" /> Approved Natural
                    </span>
                  )}
                </div>

                {isPhotosLocked ? (
                  <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl text-center space-y-2">
                    <ShieldAlert className="w-6 h-6 text-amber-400 mx-auto" />
                    <p className="text-xs text-amber-200 font-medium">
                      Photos are restricted to verified users. Verify your account to view photo gallery.
                    </p>
                    <button
                      onClick={() => setShowVerificationModal(true)}
                      className="px-4 py-1.5 bg-gradient-to-r from-pink-500 to-rose-600 text-white text-xs font-extrabold rounded-xl"
                    >
                      Verify Account Now
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                    {galleryPhotos.map((photo, idx) => (
                      <div
                        key={idx}
                        onClick={() => setActiveLightboxIndex(idx)}
                        className="relative aspect-[3/4] rounded-2xl overflow-hidden border border-white/10 bg-slate-800 shadow-md group cursor-pointer hover:border-pink-500/60 transition-all"
                        title={`${photo.title} - Click for full screen`}
                      >
                        <img
                          src={photo.url}
                          alt={photo.title}
                          loading="lazy"
                          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                          referrerPolicy="no-referrer"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/30 opacity-80 group-hover:opacity-100 transition-opacity" />
                        
                        {/* Verified badge icon */}
                        <div className="absolute top-1 right-1 p-1 bg-emerald-500/80 text-white rounded-full shadow backdrop-blur-sm">
                          <CheckCircle className="w-3 h-3" />
                        </div>

                        {/* Caption Tag */}
                        <div className="absolute bottom-1.5 left-1.5 right-1.5 text-[9px] font-extrabold text-white truncate text-shadow">
                          {photo.slotName}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })()}

          {/* Action Buttons Bar */}
          <div className="px-5 grid grid-cols-4 gap-2 pt-1">
            <button
              onClick={handleKeepToggle}
              className={`py-3 px-2 rounded-2xl font-extrabold text-xs flex flex-col items-center justify-center gap-1 transition-all shadow-md ${
                isKept
                  ? 'bg-pink-500 text-white shadow-pink-500/30'
                  : 'bg-white/5 hover:bg-white/10 text-pink-300 border border-pink-500/30'
              }`}
            >
              <Heart className={`w-5 h-5 ${isKept ? 'fill-current' : ''}`} />
              <span>{isKept ? 'Kept' : 'Keep'}</span>
            </button>

            <button
              onClick={handleMessageClick}
              className="py-3 px-2 rounded-2xl bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 text-white font-extrabold text-xs flex flex-col items-center justify-center gap-1 transition-all shadow-lg shadow-pink-500/25"
            >
              <MessageCircle className="w-5 h-5" />
              <span>Chat</span>
            </button>

            <button
              onClick={handleCallClick}
              className={`py-3 px-2 rounded-2xl font-extrabold text-xs flex flex-col items-center justify-center gap-1 transition-all border ${
                isCurrentVerified
                  ? 'bg-white/5 hover:bg-white/10 text-emerald-300 border-emerald-500/30'
                  : 'bg-white/5 text-slate-500 border-white/5 opacity-60'
              }`}
            >
              <Phone className="w-5 h-5" />
              <span>Call</span>
            </button>

            <button
              onClick={handlePopToggle}
              className={`py-3 px-2 rounded-2xl font-extrabold text-xs flex flex-col items-center justify-center gap-1 transition-all border ${
                isPopped
                  ? 'bg-slate-700 text-slate-300 border-slate-600'
                  : 'bg-white/5 hover:bg-white/10 text-slate-400 border-white/10'
              }`}
            >
              <Sparkles className="w-5 h-5 text-purple-400" />
              <span>{isPopped ? 'Popped' : 'Pop'}</span>
            </button>
          </div>

          {/* Bio / About */}
          <div className="px-5 space-y-2">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-400">About</h3>
            <div className="p-4 bg-white/5 border border-white/10 rounded-2xl text-xs text-slate-200 leading-relaxed font-medium">
              {user.bio && user.bio.trim() !== '' ? user.bio : `Hi there! I am using PEWA to find genuine connections in ${user.city || user.country || 'my area'}.`}
            </div>
            
            <div className="flex flex-wrap gap-2 pt-1">
              <span className="px-3 py-1 bg-white/5 border border-white/10 rounded-xl text-xs text-slate-300 font-semibold flex items-center gap-1.5">
                <Smile className="w-3.5 h-3.5 text-pink-400" /> Orientation: <strong className="text-white">{relationshipStatus}</strong>
              </span>
              <span className="px-3 py-1 bg-white/5 border border-white/10 rounded-xl text-xs text-slate-300 font-semibold flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-purple-400" /> Personality: <strong className="text-white">{user.personality || 'Friendly'}</strong>
              </span>
            </div>
          </div>

          {/* Appearance Details / Physical Traits */}
          <div className="px-5 space-y-2">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-400">Physical Information</h3>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              <div className="p-2.5 bg-white/5 border border-white/10 rounded-2xl text-center space-y-0.5">
                <Ruler className="w-4 h-4 text-pink-400 mx-auto" />
                <span className="text-[9px] text-slate-400 block font-bold uppercase">Height</span>
                <span className="text-xs font-black text-white">{height}</span>
              </div>
              <div className="p-2.5 bg-white/5 border border-white/10 rounded-2xl text-center space-y-0.5">
                <Sparkles className="w-4 h-4 text-amber-400 mx-auto" />
                <span className="text-[9px] text-slate-400 block font-bold uppercase">Skin Tone</span>
                <span className="text-xs font-black text-white">{user.skinTone || 'Fair'}</span>
              </div>
              <div className="p-2.5 bg-white/5 border border-white/10 rounded-2xl text-center space-y-0.5">
                <Sparkles className="w-4 h-4 text-purple-400 mx-auto" />
                <span className="text-[9px] text-slate-400 block font-bold uppercase">Hair Color</span>
                <span className="text-xs font-black text-white">{hairColor}</span>
              </div>
              <div className="p-2.5 bg-white/5 border border-white/10 rounded-2xl text-center space-y-0.5">
                <Eye className="w-4 h-4 text-blue-400 mx-auto" />
                <span className="text-[9px] text-slate-400 block font-bold uppercase">Eye Color</span>
                <span className="text-xs font-black text-white">{eyeColor}</span>
              </div>
              <div className="p-2.5 bg-white/5 border border-white/10 rounded-2xl text-center space-y-0.5 col-span-2 sm:col-span-1">
                <User className="w-4 h-4 text-emerald-400 mx-auto" />
                <span className="text-[9px] text-slate-400 block font-bold uppercase">Body Type</span>
                <span className="text-xs font-black text-white">{bodyType}</span>
              </div>
            </div>
          </div>

          {/* Lifestyle Information */}
          <div className="px-5 space-y-2">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-400">Social Life & Lifestyle</h3>
            <div className="grid grid-cols-2 gap-2.5">
              <div className="p-3 bg-white/5 border border-white/10 rounded-2xl flex items-center gap-3">
                <div className="p-2 bg-pink-500/10 rounded-xl text-pink-400 shrink-0">
                  <Coffee className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block font-bold">Drinking</span>
                  <span className="text-xs font-extrabold text-white">{drinking}</span>
                </div>
              </div>

              <div className="p-3 bg-white/5 border border-white/10 rounded-2xl flex items-center gap-3">
                <div className="p-2 bg-purple-500/10 rounded-xl text-purple-400 shrink-0">
                  <Cigarette className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block font-bold">Smoking</span>
                  <span className="text-xs font-extrabold text-white">{smoking}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Party & Club Preferences */}
          <div className="px-5 space-y-2">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-400">Party & Club Preferences</h3>
            <div className="p-4 bg-white/5 border border-white/10 rounded-2xl space-y-3">
              <div className="flex items-center justify-between text-xs border-b border-white/10 pb-2">
                <span className="text-slate-400 font-bold">Enjoys Parties?</span>
                <span className="text-pink-300 font-extrabold">{user.enjoysParties || 'Sometimes'}</span>
              </div>

              {user.partyPreferences && user.partyPreferences.length > 0 && (
                <div className="space-y-1">
                  <span className="text-[10px] text-slate-400 font-bold block uppercase">Party Types Liked</span>
                  <div className="flex flex-wrap gap-1.5">
                    {user.partyPreferences.map((pt, pidx) => (
                      <span key={pidx} className="px-2.5 py-0.5 bg-pink-500/10 border border-pink-500/20 text-pink-300 rounded-lg text-[11px] font-bold">
                        {pt}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {user.clubPreferences && user.clubPreferences.length > 0 && (
                <div className="space-y-1">
                  <span className="text-[10px] text-slate-400 font-bold block uppercase">Preferred Club Atmosphere</span>
                  <div className="flex flex-wrap gap-1.5">
                    {user.clubPreferences.map((ct, cidx) => (
                      <span key={cidx} className="px-2.5 py-0.5 bg-purple-500/10 border border-purple-500/20 text-purple-300 rounded-lg text-[11px] font-bold">
                        {ct}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {user.favoriteSocialPlaces && user.favoriteSocialPlaces.length > 0 && (
                <div className="space-y-1 pt-1 border-t border-white/5">
                  <span className="text-[10px] text-slate-400 font-bold block uppercase">Favorite Social Spots</span>
                  <span className="text-xs text-slate-200 font-medium">
                    {user.favoriteSocialPlaces.join(', ')}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Interests & Hobbies */}
          <div className="px-5 space-y-3">
            <div>
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-400 mb-2">Interests</h3>
              <div className="flex flex-wrap gap-1.5">
                {interestsList.map((interest, idx) => (
                  <span
                    key={idx}
                    className="px-3 py-1 bg-pink-500/10 border border-pink-500/20 text-pink-300 rounded-full text-xs font-bold"
                  >
                    {interest}
                  </span>
                ))}
              </div>
            </div>

            <div>
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-400 mb-2">Hobbies</h3>
              <div className="flex flex-wrap gap-1.5">
                {hobbiesList.map((hobby, idx) => (
                  <span
                    key={idx}
                    className="px-3 py-1 bg-purple-500/10 border border-purple-500/20 text-purple-300 rounded-full text-xs font-bold"
                  >
                    {hobby}
                  </span>
                ))}
              </div>
            </div>

            <div>
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-400 mb-2">Interested In</h3>
              <div className="flex flex-wrap gap-1.5">
                {thingsInterestedIn.map((item, idx) => (
                  <span
                    key={idx}
                    className="px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 rounded-full text-xs font-bold"
                  >
                    {item}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Safety & Report Bar */}
          <div className="px-5 pt-2">
            {!showReportForm ? (
              <button
                onClick={() => setShowReportForm(true)}
                className="w-full py-2.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/20 rounded-2xl text-xs font-extrabold transition-colors flex items-center justify-center gap-2"
              >
                <AlertOctagon className="w-4 h-4" /> Report or Block Profile
              </button>
            ) : (
              <form onSubmit={handleReportSubmit} className="p-4 bg-rose-950/30 border border-rose-500/30 rounded-2xl space-y-3">
                <h4 className="text-xs font-bold text-rose-300 flex items-center gap-1.5">
                  <AlertOctagon className="w-4 h-4" /> Submit Report to Moderation
                </h4>
                <div>
                  <label className="block text-[10px] text-slate-400 mb-1 font-semibold">Reason</label>
                  <select
                    value={reportReason}
                    onChange={(e) => setReportReason(e.target.value)}
                    className="w-full bg-[#121216] border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white"
                  >
                    <option value="Inappropriate behavior">Inappropriate behavior</option>
                    <option value="Fake or misleading profile">Fake or misleading profile</option>
                    <option value="Harassment or spam">Harassment or spam</option>
                    <option value="Off-platform contact solicitation">Off-platform contact solicitation</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] text-slate-400 mb-1 font-semibold">Details</label>
                  <textarea
                    rows={2}
                    placeholder="Provide additional details..."
                    value={reportDetails}
                    onChange={(e) => setReportDetails(e.target.value)}
                    className="w-full bg-[#121216] border border-white/10 rounded-xl p-2 text-xs text-white"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    type="submit"
                    className="flex-1 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl"
                  >
                    Submit & Block
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowReportForm(false)}
                    className="px-4 py-2 bg-white/5 text-slate-400 hover:text-white text-xs font-bold rounded-xl"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </div>

        </div>
      </div>

      {/* FULL-SCREEN IMAGE VIEWING LIGHTBOX MODAL */}
      {activeLightboxIndex !== null && galleryPhotos[activeLightboxIndex] && (
        <div className="fixed inset-0 z-[60] bg-black/95 backdrop-blur-2xl flex flex-col items-center justify-between p-4 sm:p-6 text-white animate-fadeIn">
          {/* Top Bar */}
          <div className="w-full max-w-4xl flex items-center justify-between pb-3 border-b border-white/10 z-10">
            <div className="flex items-center gap-3">
              <span className="text-xs font-mono text-pink-400 bg-pink-500/10 border border-pink-500/20 px-2.5 py-1 rounded-lg">
                Photo {activeLightboxIndex + 1} of {galleryPhotos.length}
              </span>
              <div>
                <h4 className="font-extrabold text-sm text-white">{galleryPhotos[activeLightboxIndex].title}</h4>
                <p className="text-[11px] text-slate-400">{user.fullName} • {galleryPhotos[activeLightboxIndex].slotName}</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="hidden sm:flex items-center gap-1 text-xs font-bold text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20">
                <CheckCircle className="w-3.5 h-3.5" /> Verified Natural Photo
              </span>
              <button
                onClick={() => setActiveLightboxIndex(null)}
                className="p-2.5 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors"
                title="Close Lightbox"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
          </div>

          {/* Main Image View Area with Nav Controls */}
          <div className="relative flex-1 w-full max-w-4xl flex items-center justify-center my-4 overflow-hidden">
            {/* Prev Button */}
            <button
              onClick={() => setActiveLightboxIndex(prev => (prev !== null && prev > 0 ? prev - 1 : galleryPhotos.length - 1))}
              className="absolute left-2 sm:left-4 z-20 p-3 bg-black/60 hover:bg-black/80 text-white rounded-full border border-white/10 backdrop-blur-md transition-all hover:scale-110 shadow-2xl"
              title="Previous Photo"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>

            {/* High-Res Image Display */}
            <img
              src={galleryPhotos[activeLightboxIndex].url}
              alt={galleryPhotos[activeLightboxIndex].title}
              loading="eager"
              className="max-h-[72vh] max-w-full object-contain rounded-2xl shadow-2xl border border-white/10 animate-fadeIn"
              referrerPolicy="no-referrer"
            />

            {/* Next Button */}
            <button
              onClick={() => setActiveLightboxIndex(prev => (prev !== null && prev < galleryPhotos.length - 1 ? prev + 1 : 0))}
              className="absolute right-2 sm:right-4 z-20 p-3 bg-black/60 hover:bg-black/80 text-white rounded-full border border-white/10 backdrop-blur-md transition-all hover:scale-110 shadow-2xl"
              title="Next Photo"
            >
              <ChevronRight className="w-6 h-6" />
            </button>
          </div>

          {/* Bottom Thumbnails Strip */}
          <div className="w-full max-w-xl flex items-center justify-center gap-2 pt-2 border-t border-white/10">
            {galleryPhotos.map((photo, i) => (
              <button
                key={i}
                onClick={() => setActiveLightboxIndex(i)}
                className={`relative w-12 h-16 rounded-xl overflow-hidden border-2 transition-all ${
                  i === activeLightboxIndex
                    ? 'border-pink-500 scale-105 shadow-lg shadow-pink-500/30'
                    : 'border-white/20 opacity-60 hover:opacity-100'
                }`}
              >
                <img src={photo.url} alt={`Thumb ${i + 1}`} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* KEEP LIMIT MODAL */}
      {showKeepLimitModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-[#14141d] border border-white/10 rounded-3xl p-6 max-w-sm w-full space-y-4 shadow-2xl text-center">
            <div className="w-14 h-14 bg-pink-500/10 border border-pink-500/20 rounded-full flex items-center justify-center mx-auto text-pink-400">
              <Heart className="w-7 h-7" />
            </div>
            <div className="space-y-1.5">
              <h3 className="text-base font-extrabold text-white">Keep Limit Reached</h3>
              <p className="text-xs text-slate-300 leading-relaxed font-medium">
                You have reached your Keep limit. Verify your account to unlock unlimited Keeps.
              </p>
            </div>
            <div className="space-y-2 pt-2">
              <button
                onClick={() => {
                  setShowKeepLimitModal(false);
                  setShowVerificationModal(true);
                }}
                className="w-full py-3 bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 text-white font-extrabold text-xs rounded-2xl shadow-lg shadow-pink-500/25 transition-all flex items-center justify-center gap-2"
              >
                <ShieldCheck className="w-4 h-4" /> Request Verification
              </button>
              <button
                onClick={() => setShowKeepLimitModal(false)}
                className="w-full py-2.5 bg-white/5 hover:bg-white/10 text-slate-400 font-bold text-xs rounded-2xl transition-all"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SUGAR CHAT LIMIT MODAL */}
      {showSugarLimitModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-[#14141d] border border-white/10 rounded-3xl p-6 max-w-sm w-full space-y-4 shadow-2xl text-center">
            <div className="w-14 h-14 bg-amber-500/10 border border-amber-500/20 rounded-full flex items-center justify-center mx-auto text-amber-400">
              <MessageCircle className="w-7 h-7" />
            </div>
            <div className="space-y-1.5">
              <h3 className="text-base font-extrabold text-white">Sugar Chat Limit</h3>
              <p className="text-xs text-slate-300 leading-relaxed font-medium">
                Non-verified accounts can chat with a maximum of 2 Sugar users. Verify your account to unlock unlimited Sugar chats.
              </p>
            </div>
            <div className="space-y-2 pt-2">
              <button
                onClick={() => {
                  setShowSugarLimitModal(false);
                  setShowVerificationModal(true);
                }}
                className="w-full py-3 bg-gradient-to-r from-amber-400 to-amber-600 text-slate-950 font-extrabold text-xs rounded-2xl shadow-lg shadow-amber-500/25 transition-all flex items-center justify-center gap-2"
              >
                <ShieldCheck className="w-4 h-4" /> Request Verification
              </button>
              <button
                onClick={() => setShowSugarLimitModal(false)}
                className="w-full py-2.5 bg-white/5 hover:bg-white/10 text-slate-400 font-bold text-xs rounded-2xl transition-all"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* VOICE CALL RESTRICTION MODAL */}
      {showVoiceLimitModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-[#14141d] border border-white/10 rounded-3xl p-6 max-w-sm w-full space-y-4 shadow-2xl text-center">
            <div className="w-14 h-14 bg-pink-500/10 border border-pink-500/20 rounded-full flex items-center justify-center mx-auto text-pink-400">
              <Phone className="w-7 h-7" />
            </div>
            <div className="space-y-1.5">
              <h3 className="text-base font-extrabold text-white">Verification Required</h3>
              <p className="text-xs text-slate-300 leading-relaxed font-medium">
                Voice calling is available after your account has been verified.
              </p>
            </div>
            <div className="space-y-2 pt-2">
              <button
                onClick={() => {
                  setShowVoiceLimitModal(false);
                  setShowVerificationModal(true);
                }}
                className="w-full py-3 bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 text-white font-extrabold text-xs rounded-2xl shadow-lg shadow-pink-500/25 transition-all flex items-center justify-center gap-2"
              >
                <ShieldCheck className="w-4 h-4" /> Request Verification
              </button>
              <button
                onClick={() => setShowVoiceLimitModal(false)}
                className="w-full py-2.5 bg-white/5 hover:bg-white/10 text-slate-400 font-bold text-xs rounded-2xl transition-all"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* VERIFICATION REQUEST MODAL */}
      {showVerificationModal && currentUser && (
        <VerificationRequestModal
          userId={currentUser.uid}
          onClose={() => setShowVerificationModal(false)}
        />
      )}
    </div>
  );
};

