import React, { useState } from 'react';
import {
  X,
  Share2,
  Copy,
  Check,
  ShieldAlert,
  ExternalLink,
  MessageCircle,
  Sparkles,
  Lock,
  Send,
  Camera
} from 'lucide-react';
import { UserProfile } from '../../types';
import { PEWADatabaseService } from '../../services/db';

interface MetaShareModalProps {
  userToShare: UserProfile;
  currentUser: UserProfile;
  onClose: () => void;
}

export const MetaShareModal: React.FC<MetaShareModalProps> = ({
  userToShare,
  currentUser,
  onClose
}) => {
  const [copied, setCopied] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const isVerified = currentUser.verified;

  // Build Privacy-Respecting Info
  const showLocation = userToShare.settings?.privacy?.showLocation !== false;
  const locationText = showLocation ? `${userToShare.city}, ${userToShare.country}` : 'PEWA Member';
  const ageText = userToShare.age ? `, ${userToShare.age}` : '';

  const shareTitle = `Meet ${userToShare.fullName} on PEWA ❤️`;
  const shareDescription = userToShare.bio || `Connect with ${userToShare.fullName} on PEWA Find Love.`;
  const profileUrl = `${window.location.origin}/?profile=${userToShare.uid}`;
  const shareImage = userToShare.avatar;

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  };

  const handleTriggerShareNotification = () => {
    if (userToShare.uid !== currentUser.uid) {
      PEWADatabaseService.addNotification({
        userId: userToShare.uid,
        type: 'share',
        title: '🔗 Profile Shared!',
        body: `${currentUser.fullName} shared your PEWA profile card!`,
        senderId: currentUser.uid,
        senderName: currentUser.fullName,
        senderAvatar: currentUser.avatar
      });
    }
  };

  // 1. Native Web Share
  const handleNativeShare = async () => {
    if (!isVerified) return;
    try {
      if (navigator.share) {
        await navigator.share({
          title: shareTitle,
          text: `${shareTitle}\n\n${shareDescription}`,
          url: profileUrl,
        });
        handleTriggerShareNotification();
        showToast('Shared successfully!');
      } else {
        handleCopyLink();
      }
    } catch (err) {
      console.log('Share dismissed or not supported');
    }
  };

  // 2. Copy Link
  const handleCopyLink = () => {
    if (!isVerified) return;
    navigator.clipboard.writeText(`${shareTitle}\n${profileUrl}`);
    setCopied(true);
    handleTriggerShareNotification();
    showToast('Profile link & preview copied to clipboard!');
    setTimeout(() => setCopied(false), 2500);
  };

  // 3. Facebook Share
  const handleFacebookShare = () => {
    if (!isVerified) return;
    const fbUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(profileUrl)}&quote=${encodeURIComponent(shareTitle)}`;
    window.open(fbUrl, '_blank', 'width=600,height=400');
    handleTriggerShareNotification();
  };

  // 4. Facebook Messenger Share
  const handleMessengerShare = () => {
    if (!isVerified) return;
    const msgUrl = `https://www.facebook.com/dialog/send?app_id=26477179-8f1d-49f5-8428-389a75eafeaf&link=${encodeURIComponent(profileUrl)}&redirect_uri=${encodeURIComponent(window.location.href)}`;
    window.open(msgUrl, '_blank', 'width=600,height=400');
    handleTriggerShareNotification();
  };

  // 5. Threads Share
  const handleThreadsShare = () => {
    if (!isVerified) return;
    const threadsUrl = `https://www.threads.net/intent/post?text=${encodeURIComponent(`${shareTitle}\n${shareDescription}\n${profileUrl}`)}`;
    window.open(threadsUrl, '_blank');
    handleTriggerShareNotification();
  };

  // 6. Instagram Share Helper
  const handleInstagramShare = () => {
    if (!isVerified) return;
    navigator.clipboard.writeText(`${shareTitle}\n${profileUrl}`);
    handleTriggerShareNotification();
    showToast('📸 Text & Profile photo link copied! Paste into Instagram Story or DM.');
  };

  // 7. WhatsApp Share
  const handleWhatsAppShare = () => {
    if (!isVerified) return;
    const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(`${shareTitle}\n\n"${shareDescription}"\n\nSee profile: ${profileUrl}`)}`;
    window.open(waUrl, '_blank');
    handleTriggerShareNotification();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn">
      <div className="bg-[#12121a] border border-white/10 rounded-3xl max-w-md w-full overflow-hidden shadow-2xl relative flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between bg-white/5">
          <div className="flex items-center gap-2">
            <Share2 className="w-5 h-5 text-pink-500" />
            <h2 className="font-extrabold text-base text-white">Share Find Love Card</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-full bg-white/5 hover:bg-white/10 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Toast Toast Notification */}
        {toastMsg && (
          <div className="bg-gradient-to-r from-pink-500 to-red-600 text-white font-bold text-xs px-4 py-2.5 text-center shadow-lg animate-pulse">
            {toastMsg}
          </div>
        )}

        <div className="p-5 overflow-y-auto space-y-4">
          {/* Card Share Preview Box */}
          <div className="bg-gradient-to-b from-[#1c1c28] to-[#14141e] border border-white/10 rounded-2xl p-4 shadow-inner space-y-3 relative overflow-hidden">
            <div className="flex items-center gap-3">
              <div className="relative w-16 h-16 rounded-2xl overflow-hidden border-2 border-pink-500 shadow-md bg-white/5 flex-shrink-0">
                <img
                  src={shareImage}
                  alt={userToShare.fullName}
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              </div>
              <div>
                <h3 className="font-extrabold text-sm text-white flex items-center gap-1.5">
                  {shareTitle}
                </h3>
                <p className="text-xs text-pink-400 font-bold mt-0.5">
                  @{userToShare.username} {ageText}
                </p>
                <p className="text-[11px] text-slate-400 mt-0.5">{locationText}</p>
              </div>
            </div>

            {/* Description */}
            <p className="text-xs text-slate-300 bg-white/5 p-2.5 rounded-xl border border-white/5 italic line-clamp-2">
              "{shareDescription}"
            </p>

            <div className="text-[10px] text-pink-400/80 font-mono tracking-wider truncate bg-black/30 px-2.5 py-1 rounded-lg">
              {profileUrl}
            </div>
          </div>

          {/* Locked State Warning for Unverified Users */}
          {!isVerified ? (
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 text-center space-y-2">
              <div className="w-10 h-10 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center mx-auto border border-amber-500/30">
                <Lock className="w-5 h-5" />
              </div>
              <h4 className="font-extrabold text-sm text-amber-300">Verification Required to Share</h4>
              <p className="text-xs text-slate-300">
                Only verified PEWA members can share profile cards to Meta applications and external networks to maintain trust and prevent spam.
              </p>
              <div className="pt-1">
                <span className="inline-block text-[11px] font-bold text-amber-400 bg-amber-500/20 px-3 py-1 rounded-full border border-amber-500/30">
                  Submit Verification Request in Settings
                </span>
              </div>
            </div>
          ) : (
            <>
              {/* Meta Share Apps Grid */}
              <div className="space-y-2">
                <label className="text-xs font-extrabold text-slate-300 uppercase tracking-wider block">
                  Share via Meta & Social Networks
                </label>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  {/* Facebook */}
                  <button
                    onClick={handleFacebookShare}
                    className="p-3 bg-[#1877F2]/10 hover:bg-[#1877F2]/20 border border-[#1877F2]/30 rounded-2xl flex items-center gap-2.5 text-left transition-all text-[#1877F2] font-bold text-xs group"
                  >
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm overflow-hidden group-hover:scale-105 transition-transform">
                      <img src="/icons/facebook.png" alt="Facebook" className="w-full h-full object-cover rounded-xl" />
                    </div>
                    <span>Facebook</span>
                  </button>

                  {/* Messenger */}
                  <button
                    onClick={handleMessengerShare}
                    className="p-3 bg-[#0084FF]/10 hover:bg-[#0084FF]/20 border border-[#0084FF]/30 rounded-2xl flex items-center gap-2.5 text-left transition-all text-[#0084FF] font-bold text-xs group"
                  >
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm overflow-hidden group-hover:scale-105 transition-transform">
                      <img src="/icons/messenger.jpg" alt="Messenger" className="w-full h-full object-cover rounded-xl" />
                    </div>
                    <span>Messenger</span>
                  </button>

                  {/* Threads */}
                  <button
                    onClick={handleThreadsShare}
                    className="p-3 bg-white/10 hover:bg-white/20 border border-white/20 rounded-2xl flex items-center gap-2.5 text-left transition-all text-white font-bold text-xs group"
                  >
                    <div className="w-8 h-8 rounded-xl bg-black flex items-center justify-center flex-shrink-0 shadow-sm overflow-hidden group-hover:scale-105 transition-transform border border-white/20">
                      <img src="/icons/threads.png" alt="Threads" className="w-full h-full object-cover rounded-xl" />
                    </div>
                    <span>Threads</span>
                  </button>

                  {/* Instagram */}
                  <button
                    onClick={handleInstagramShare}
                    className="p-3 bg-gradient-to-r from-purple-500/10 via-pink-500/10 to-amber-500/10 hover:opacity-90 border border-pink-500/30 rounded-2xl flex items-center gap-2.5 text-left transition-all text-pink-400 font-bold text-xs group"
                  >
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm overflow-hidden group-hover:scale-105 transition-transform">
                      <img src="/icons/instagram.webp" alt="Instagram" className="w-full h-full object-cover rounded-xl" />
                    </div>
                    <span>Instagram</span>
                  </button>

                  {/* WhatsApp */}
                  <button
                    onClick={handleWhatsAppShare}
                    className="p-3 bg-[#25D366]/10 hover:bg-[#25D366]/20 border border-[#25D366]/30 rounded-2xl flex items-center gap-2.5 text-left transition-all text-[#25D366] font-bold text-xs group"
                  >
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm overflow-hidden group-hover:scale-105 transition-transform">
                      <img src="/icons/whatsapp.png" alt="WhatsApp" className="w-full h-full object-cover rounded-xl" />
                    </div>
                    <span>WhatsApp</span>
                  </button>

                  {/* Native Share */}
                  <button
                    onClick={handleNativeShare}
                    className="p-3 bg-pink-500/10 hover:bg-pink-500/20 border border-pink-500/30 rounded-2xl flex items-center gap-2.5 text-left transition-all text-pink-400 font-bold text-xs group"
                  >
                    <div className="w-8 h-8 rounded-xl bg-gradient-to-r from-pink-500 to-red-600 text-white flex items-center justify-center flex-shrink-0 shadow-sm group-hover:scale-105 transition-transform">
                      <Share2 className="w-4 h-4" />
                    </div>
                    <span>System Share</span>
                  </button>
                </div>
              </div>

              {/* Copy Direct Link Button */}
              <button
                onClick={handleCopyLink}
                className="w-full py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl font-bold text-xs text-white flex items-center justify-center gap-2 transition-all active:scale-98"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-pink-400" />}
                {copied ? 'Link Copied!' : 'Copy Profile Card Link'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
