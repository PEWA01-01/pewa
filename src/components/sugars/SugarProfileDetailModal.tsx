import React, { useState } from 'react';
import { UserProfile } from '../../types';
import { ShieldCheck, Heart, MessageCircle, Bookmark, AlertTriangle, MapPin, Crown, X, ShieldAlert, ChevronLeft, ChevronRight } from 'lucide-react';
import { PEWADatabaseService } from '../../services/db';

interface SugarProfileDetailModalProps {
  user: UserProfile;
  currentUser: UserProfile;
  onClose: () => void;
  onStartChat: (targetUser: UserProfile) => void;
  onToggleFavorite: (targetUserId: string) => void;
  isFavorite: boolean;
}

export const SugarProfileDetailModal: React.FC<SugarProfileDetailModalProps> = ({
  user,
  currentUser,
  onClose,
  onStartChat,
  onToggleFavorite,
  isFavorite
}) => {
  const sugar = user.sugarProfile;

  // Photo gallery list (Face, Full-Body, Additional)
  const photoGallery = [
    { key: 'face', label: 'Face Photo', url: sugar?.photos?.face || user.avatar },
    { key: 'fullBody', label: 'Full Body', url: sugar?.photos?.fullBody || user.coverImage || user.avatar },
    { key: 'additional', label: 'Additional Photo', url: sugar?.photos?.additional || user.avatar }
  ].filter((p) => p.url);

  const [activePhotoIdx, setActivePhotoIdx] = useState(0);

  const [showReportForm, setShowReportForm] = useState(false);
  const [reportReason, setReportReason] = useState('Inappropriate behavior');
  const [reportDetails, setReportDetails] = useState('');
  const [isLiked, setIsLiked] = useState(false);

  const currentPhoto = photoGallery[activePhotoIdx] || photoGallery[0];

  const handleNextPhoto = () => {
    setActivePhotoIdx((prev) => (prev + 1) % photoGallery.length);
  };

  const handlePrevPhoto = () => {
    setActivePhotoIdx((prev) => (prev - 1 + photoGallery.length) % photoGallery.length);
  };

  const handleSendLike = () => {
    if (!isLiked) {
      PEWADatabaseService.keepUser(currentUser.uid, user.uid);
      setIsLiked(true);
    } else {
      PEWADatabaseService.unkeepUser(currentUser.uid, user.uid);
      setIsLiked(false);
    }
  };

  const handleReport = (e: React.FormEvent) => {
    e.preventDefault();
    PEWADatabaseService.submitReport(currentUser.uid, user.uid, undefined, reportReason, reportDetails);
    PEWADatabaseService.blockUser(currentUser.uid, user.uid);
    window.dispatchEvent(new Event('pewa_pops_updated'));
    alert('Safety report submitted to PEWA Moderation Team for review. Profile has been blocked.');
    setShowReportForm(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-[#0a0a0b]/85 backdrop-blur-xl animate-fadeIn">
      <div className="relative w-full max-w-lg bg-[#121216] border border-amber-500/30 rounded-3xl overflow-hidden shadow-2xl max-h-[92vh] flex flex-col text-white">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-20 p-2.5 bg-black/60 hover:bg-black/80 rounded-full text-slate-300 hover:text-white backdrop-blur-md transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header Photo Gallery Carousel */}
        <div className="relative h-64 sm:h-72 w-full bg-slate-900 shrink-0 overflow-hidden">
          <img
            src={currentPhoto.url}
            alt={user.fullName}
            className="w-full h-full object-cover transition-all duration-300"
            referrerPolicy="no-referrer"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#121216] via-[#121216]/20 to-transparent" />

          {/* Gallery Carousel Arrows */}
          {photoGallery.length > 1 && (
            <>
              <button
                onClick={handlePrevPhoto}
                className="absolute left-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/60 text-white/90 hover:text-white hover:bg-black/80 backdrop-blur-md transition-all z-10"
                title="Previous Photo"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                onClick={handleNextPhoto}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/60 text-white/90 hover:text-white hover:bg-black/80 backdrop-blur-md transition-all z-10"
                title="Next Photo"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </>
          )}

          {/* Badges */}
          <div className="absolute top-4 left-4 flex flex-wrap gap-2 z-10">
            {(sugar?.status === 'approved' || user.verified) && (
              <span className="bg-gradient-to-r from-amber-400 to-amber-600 text-slate-950 font-black text-xs px-3 py-1 rounded-full shadow-lg flex items-center gap-1.5">
                <Crown className="w-4 h-4 fill-current" /> Verified PEWA Sugar
              </span>
            )}
            <span className="bg-black/60 backdrop-blur-md text-amber-300 text-xs font-bold px-3 py-1 rounded-full border border-amber-500/30">
              {sugar?.type || 'Sugar Partner'}
            </span>
          </div>

          {/* Photo Switcher Tabs & Dots */}
          <div className="absolute bottom-3 left-4 right-4 flex items-center justify-between z-10">
            <span className="text-[10px] font-bold text-amber-300 bg-black/60 px-2.5 py-1 rounded-xl backdrop-blur-md border border-white/10">
              {activePhotoIdx + 1}/{photoGallery.length}: {currentPhoto.label}
            </span>

            <div className="flex gap-1.5 bg-black/60 p-1 rounded-2xl backdrop-blur-md border border-white/10">
              {photoGallery.map((p, idx) => (
                <button
                  key={p.key}
                  onClick={() => setActivePhotoIdx(idx)}
                  className={`px-2 py-0.5 text-[10px] font-bold rounded-xl transition-colors ${
                    activePhotoIdx === idx ? 'bg-amber-500 text-slate-950 font-black' : 'text-slate-300 hover:text-white'
                  }`}
                >
                  {p.label.split(' ')[0]}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
          {/* User Name & Location */}
          <div>
            <div className="flex items-center justify-between">
              <h3 className="text-2xl font-black flex items-center gap-2 text-white">
                {user.fullName}, {user.age}
                {user.verified && <ShieldCheck className="w-5 h-5 text-amber-400" />}
              </h3>
              <button
                onClick={() => onToggleFavorite(user.uid)}
                className={`p-2.5 rounded-2xl border transition-all ${
                  isFavorite
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/50'
                    : 'bg-white/5 text-slate-400 border-white/10 hover:text-white'
                }`}
                title="Save Favorite"
              >
                <Bookmark className={`w-5 h-5 ${isFavorite ? 'fill-current text-amber-400' : ''}`} />
              </button>
            </div>
            <p className="text-xs text-amber-300/80 font-semibold flex items-center gap-1 mt-1">
              <MapPin className="w-3.5 h-3.5" />
              {sugar?.area ? `${sugar.area}, ` : ''}{sugar?.city || user.city}, {sugar?.country || user.country}
            </p>
          </div>

          {/* Safety Reminder Banner */}
          <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-2xl text-amber-200 text-xs flex items-center gap-2.5">
            <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0" />
            <p className="leading-tight">
              <strong>PEWA Safety Protocol:</strong> Always meet in public places, never send advance money transfers, and report suspicious activity.
            </p>
          </div>

          {/* Support / Budget Highlight */}
          <div className="p-4 bg-gradient-to-r from-amber-500/15 to-amber-600/5 border border-amber-500/30 rounded-2xl space-y-1">
            <span className="text-[10px] font-extrabold uppercase text-amber-400 tracking-wider">
              {sugar?.financialSupportWilling !== undefined
                ? 'Financial Support Availability'
                : 'Allowance / Support Expectations'}
            </span>
            <div className="text-base font-black text-amber-300 font-mono">
              {sugar?.monthlySupportBudget || sugar?.monthlyIncomeRange || sugar?.expectationOrAllowance || 'Mutual Support Agreement'}
            </div>
          </div>

          {/* Biography */}
          <div className="space-y-1.5">
            <span className="font-extrabold text-slate-400 uppercase text-[10px] tracking-wider">Personal Bio</span>
            <p className="bg-white/5 p-3.5 rounded-2xl border border-white/10 text-slate-200 leading-relaxed italic">
              "{sugar?.bio || user.bio || 'Seeking mutually respectful relationship.'}"
            </p>
          </div>

          {/* Relationship Preferences */}
          <div className="space-y-1.5">
            <span className="font-extrabold text-slate-400 uppercase text-[10px] tracking-wider">Relationship Preferences</span>
            <div className="flex flex-wrap gap-1.5">
              {(sugar?.relationshipPreferences || ['Support', 'Companionship']).map((pref) => (
                <span key={pref} className="bg-amber-500/10 text-amber-300 border border-amber-500/30 px-3 py-1 rounded-xl font-medium">
                  {pref}
                </span>
              ))}
            </div>
          </div>

          {/* Profile Specs Grid */}
          <div className="grid grid-cols-2 gap-2.5">
            <div className="bg-white/5 p-3 rounded-2xl border border-white/10">
              <span className="text-slate-400 block text-[10px] uppercase font-bold">Height</span>
              <span className="font-bold text-slate-200">{sugar?.height || '175 cm'}</span>
            </div>
            <div className="bg-white/5 p-3 rounded-2xl border border-white/10">
              <span className="text-slate-400 block text-[10px] uppercase font-bold">Skin Tone</span>
              <span className="font-bold text-slate-200">{sugar?.skinTone || 'Light Brown'}</span>
            </div>
            <div className="bg-white/5 p-3 rounded-2xl border border-white/10">
              <span className="text-slate-400 block text-[10px] uppercase font-bold">Occupation</span>
              <span className="font-bold text-slate-200">{sugar?.occupation || 'Professional'}</span>
            </div>
            <div className="bg-white/5 p-3 rounded-2xl border border-white/10">
              <span className="text-slate-400 block text-[10px] uppercase font-bold">Education</span>
              <span className="font-bold text-slate-200">{sugar?.educationLevel || "Bachelor's"}</span>
            </div>
            <div className="bg-white/5 p-3 rounded-2xl border border-white/10">
              <span className="text-slate-400 block text-[10px] uppercase font-bold">Languages</span>
              <span className="font-bold text-slate-200">{(sugar?.languages || ['English']).join(', ')}</span>
            </div>
            <div className="bg-white/5 p-3 rounded-2xl border border-white/10">
              <span className="text-slate-400 block text-[10px] uppercase font-bold">Children</span>
              <span className="font-bold text-slate-200">{sugar?.childrenCount ?? 0}</span>
            </div>
          </div>

          {/* Preferred Partner Criteria */}
          <div className="p-3.5 bg-white/5 border border-white/10 rounded-2xl space-y-1.5">
            <span className="font-extrabold text-amber-300 uppercase text-[10px] tracking-wider block">Target Partner Criteria</span>
            <div className="text-slate-300 space-y-1">
              <p>• Preferred Age: <strong>{sugar?.preferredPartnerAgeMin || 20} – {sugar?.preferredPartnerAgeMax || 60} years</strong></p>
              <p>• Preferred Height: <strong>{sugar?.preferredPartnerHeight || 'Any'}</strong></p>
              <p>• Preferred Location: <strong>{sugar?.preferredPartnerLocation || 'Flexible'}</strong></p>
            </div>
          </div>

          {/* Report Form Toggle */}
          {showReportForm ? (
            <form onSubmit={handleReport} className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-2xl space-y-2.5">
              <h4 className="font-black text-rose-300 text-xs">Report Sugar Profile</h4>
              <select
                value={reportReason}
                onChange={(e) => setReportReason(e.target.value)}
                className="w-full bg-[#121216] border border-white/10 rounded-xl px-3 py-1.5 text-white"
              >
                <option value="Inappropriate behavior">Inappropriate behavior</option>
                <option value="Underage suspect">Underage suspect</option>
                <option value="Fake photos or identity">Fake photos or identity</option>
                <option value="Advance money scam">Advance money scam</option>
                <option value="Harassment or abusive conduct">Harassment or abusive conduct</option>
              </select>
              <textarea
                rows={2}
                value={reportDetails}
                onChange={(e) => setReportDetails(e.target.value)}
                placeholder="Additional report details..."
                className="w-full bg-[#121216] border border-white/10 rounded-xl p-2.5 text-white"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowReportForm(false)}
                  className="flex-1 py-2 bg-white/10 text-slate-300 font-bold rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 bg-rose-600 text-white font-black rounded-xl"
                >
                  Submit Report
                </button>
              </div>
            </form>
          ) : (
            <div className="flex justify-between items-center text-[11px] pt-1 text-slate-400">
              <button
                onClick={() => setShowReportForm(true)}
                className="hover:text-rose-400 underline flex items-center gap-1"
              >
                <AlertTriangle className="w-3.5 h-3.5" /> Report & Block Profile
              </button>
              <span className="text-amber-400/80 font-mono">ID: {user.uid.slice(0, 8)}</span>
            </div>
          )}
        </div>

        {/* Action Controls Footer */}
        <div className="p-4 border-t border-white/10 bg-[#121216] flex items-center gap-2.5 shrink-0">
          <button
            onClick={handleSendLike}
            className={`flex-1 py-3 rounded-2xl border font-bold text-xs flex items-center justify-center gap-2 transition-all ${
              isLiked
                ? 'bg-rose-500/20 text-rose-400 border-rose-500/50'
                : 'bg-white/5 hover:bg-rose-500/10 text-slate-200 border-white/10'
            }`}
          >
            <Heart className={`w-4 h-4 ${isLiked ? 'fill-current text-rose-500' : 'text-rose-400'}`} />
            <span>{isLiked ? 'Liked' : 'Send Like'}</span>
          </button>

          <button
            onClick={() => {
              onClose();
              onStartChat(user);
            }}
            className="flex-1 py-3 rounded-2xl bg-gradient-to-r from-amber-400 to-amber-600 text-slate-950 font-black text-xs shadow-xl shadow-amber-500/25 flex items-center justify-center gap-2 hover:opacity-95 transition-all"
          >
            <MessageCircle className="w-4 h-4 fill-current" />
            <span>Start Chat</span>
          </button>
        </div>
      </div>
    </div>
  );
};
