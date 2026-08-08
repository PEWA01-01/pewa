import React, { useState } from 'react';
import { UserProfile } from '../../types';
import { Crown, MapPin, MessageCircle, User, Bookmark, ChevronLeft, ChevronRight, Briefcase } from 'lucide-react';
import { BalloonIcon } from '../common/BalloonIcon';

interface SugarCardProps {
  user: UserProfile;
  currentUser: UserProfile;
  onViewDetail: (user: UserProfile) => void;
  onStartChat: (user: UserProfile) => void;
  onSendLike: (user: UserProfile) => void;
  onToggleFavorite: (targetUserId: string) => void;
  isFavorite: boolean;
}

export const SugarCard: React.FC<SugarCardProps> = ({
  user,
  currentUser,
  onViewDetail,
  onStartChat,
  onSendLike,
  onToggleFavorite,
  isFavorite
}) => {
  const sugar = user.sugarProfile;

  // Photos List (Face, Full-Body, Additional)
  const photosList = [
    sugar?.photos?.face || user.avatar,
    sugar?.photos?.fullBody || user.coverImage || user.avatar,
    sugar?.photos?.additional || user.avatar
  ].filter(Boolean);

  const [activePhotoIndex, setActivePhotoIndex] = useState(0);

  const currentPhotoUrl = photosList[activePhotoIndex] || user.avatar;

  const handleNextPhoto = (e: React.MouseEvent) => {
    e.stopPropagation();
    setActivePhotoIndex((prev) => (prev + 1) % photosList.length);
  };

  const handlePrevPhoto = (e: React.MouseEvent) => {
    e.stopPropagation();
    setActivePhotoIndex((prev) => (prev - 1 + photosList.length) % photosList.length);
  };

  return (
    <div className="group relative bg-[#121216]/95 border border-amber-500/20 hover:border-amber-400/60 rounded-3xl overflow-hidden shadow-2xl transition-all duration-300 hover:shadow-amber-500/15 flex flex-col backdrop-blur-xl max-w-full">
      {/* Profile Photo Header with Interactive Carousel */}
      <div className="relative h-64 sm:h-72 w-full bg-slate-900 overflow-hidden cursor-pointer" onClick={() => onViewDetail(user)}>
        <img
          src={currentPhotoUrl}
          alt={user.fullName}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          referrerPolicy="no-referrer"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#121216] via-[#121216]/20 to-transparent" />

        {/* Carousel Prev/Next Overlay Buttons */}
        {photosList.length > 1 && (
          <>
            <button
              onClick={handlePrevPhoto}
              className="absolute left-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-black/50 text-white/80 hover:text-white hover:bg-black/75 backdrop-blur-md transition-all opacity-80 hover:opacity-100 z-10"
              title="Previous Photo"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={handleNextPhoto}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-black/50 text-white/80 hover:text-white hover:bg-black/75 backdrop-blur-md transition-all opacity-80 hover:opacity-100 z-10"
              title="Next Photo"
            >
              <ChevronRight className="w-4 h-4" />
            </button>

            {/* Photo Carousel Indicator Dots */}
            <div className="absolute top-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5 bg-black/60 px-2 py-1 rounded-full backdrop-blur-md border border-white/10 z-10">
              {photosList.map((_, idx) => (
                <button
                  key={idx}
                  onClick={(e) => {
                    e.stopPropagation();
                    setActivePhotoIndex(idx);
                  }}
                  className={`h-1.5 rounded-full transition-all ${
                    activePhotoIndex === idx ? 'w-4 bg-amber-400' : 'w-1.5 bg-white/40 hover:bg-white/80'
                  }`}
                  title={`Photo ${idx + 1}`}
                />
              ))}
            </div>
          </>
        )}

        {/* Badges */}
        <div className="absolute top-3 left-3 flex items-center gap-1.5 flex-wrap z-10">
          {(sugar?.status === 'approved' || user.verified) && (
            <span className="bg-gradient-to-r from-amber-400 to-amber-600 text-slate-950 text-[10px] font-black px-2.5 py-0.5 rounded-full shadow-lg flex items-center gap-1">
              <Crown className="w-3 h-3 fill-current" /> Verified Sugar
            </span>
          )}
          <span className="bg-black/60 backdrop-blur-md text-amber-300 text-[10px] font-bold px-2.5 py-0.5 rounded-full border border-amber-500/30">
            {sugar?.type || 'Sugar Partner'}
          </span>
        </div>

        {/* Favorite Bookmark Button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleFavorite(user.uid);
          }}
          className={`absolute top-3 right-3 p-2 rounded-full backdrop-blur-md border transition-all z-10 ${
            isFavorite
              ? 'bg-amber-500/30 text-amber-300 border-amber-500/60'
              : 'bg-black/50 text-slate-300 border-white/10 hover:text-white'
          }`}
          title="Save Favorite"
        >
          <Bookmark className={`w-4 h-4 ${isFavorite ? 'fill-current text-amber-400' : ''}`} />
        </button>

        {/* Name & Location Overlay */}
        <div className="absolute bottom-3 left-3 right-3 text-white z-10">
          <div className="flex items-center gap-1.5">
            <h3 className="text-lg sm:text-xl font-black tracking-tight drop-shadow-lg text-amber-100">
              {user.fullName}, {user.age}
            </h3>
          </div>
          <div className="flex items-center gap-1 text-xs text-amber-300 font-semibold mt-0.5">
            <MapPin className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">{sugar?.city || user.city}, {sugar?.country || user.country}</span>
          </div>
        </div>
      </div>

      {/* Card Content Body */}
      <div className="p-4 flex-1 flex flex-col justify-between space-y-3 text-slate-300 text-xs">
        {/* Support / Allowance Budget Highlight */}
        <div className="p-2.5 bg-amber-500/10 border border-amber-500/25 rounded-2xl flex items-center justify-between">
          <span className="text-[10px] uppercase font-bold text-amber-400">
            {sugar?.financialSupportWilling !== undefined ? 'Monthly Budget' : 'Monthly Support'}
          </span>
          <span className="font-extrabold text-amber-200 text-xs font-mono">
            {sugar?.monthlySupportBudget || sugar?.monthlyIncomeRange || sugar?.expectationOrAllowance || 'Negotiable'}
          </span>
        </div>

        {/* Occupation & Bio */}
        {sugar?.occupation && (
          <div className="flex items-center gap-1.5 text-[11px] font-medium text-slate-300">
            <Briefcase className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span className="truncate">{sugar.occupation} {sugar.employmentStatus ? `(${sugar.employmentStatus})` : ''}</span>
          </div>
        )}

        <p className="line-clamp-2 text-slate-400 italic text-[11px]">
          "{sugar?.bio || user.bio || 'Looking for a mutually supportive arrangement.'}"
        </p>

        {/* Relationship Preference Tags */}
        <div className="flex flex-wrap gap-1">
          {(sugar?.relationshipPreferences || ['Support', 'Companionship']).slice(0, 3).map((pref) => (
            <span key={pref} className="bg-white/5 border border-white/10 text-slate-300 px-2 py-0.5 rounded-lg text-[10px] font-medium">
              {pref}
            </span>
          ))}
        </div>

        {/* Card Action Buttons */}
        <div className="flex items-center gap-2 pt-2 border-t border-white/10">
          <button
            onClick={() => onSendLike(user)}
            className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-pink-500 to-red-600 text-white font-black text-xs shadow-lg shadow-pink-500/20 hover:opacity-95 flex items-center justify-center gap-1.5 transition-all"
            title="Keep (Interested)"
          >
            <BalloonIcon variant="keep" className="w-4 h-4 text-white" />
            <span>Keep</span>
          </button>

          <button
            onClick={() => onStartChat(user)}
            className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-amber-400 to-amber-600 text-slate-950 font-black text-xs shadow-lg shadow-amber-500/20 hover:opacity-95 flex items-center justify-center gap-1.5 transition-all"
          >
            <MessageCircle className="w-4 h-4 fill-current" />
            <span>Chat</span>
          </button>

          <button
            onClick={() => onViewDetail(user)}
            className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 transition-all"
            title="View Full Sugar Profile"
          >
            <User className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
