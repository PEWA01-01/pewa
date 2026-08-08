import React, { useState, useEffect } from 'react';
import { Camera, Edit3, ShieldCheck, MapPin, Save, LogOut, Sparkles, Settings } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { uploadImageWithProgress, DEFAULT_PEWA_COVER, DEFAULT_USER_AVATAR } from '../../services/cloudinary';
import { SettingsPage } from '../settings/SettingsPage';
import { BalloonIcon } from '../common/BalloonIcon';

export const AccountTab: React.FC = () => {
  const { currentUser, updateCurrentUserProfile } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Form states for editing profile
  const [fullName, setFullName] = useState(currentUser?.fullName || '');
  const [bio, setBio] = useState(currentUser?.bio || '');
  const [city, setCity] = useState(currentUser?.city || '');
  const [street, setStreet] = useState(currentUser?.street || '');
  const [relationshipOrientation, setRelationshipOrientation] = useState(currentUser?.relationshipOrientation || 'Single');
  const [avatarUrl, setAvatarUrl] = useState(currentUser?.avatar || '');
  const [coverUrl, setCoverUrl] = useState(currentUser?.coverImage || DEFAULT_PEWA_COVER);

  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);

  // Sync profile data & profileImageUrl from currentUser upon auth restoration / Firestore update
  useEffect(() => {
    if (currentUser) {
      if (!isEditing && !isUploading) {
        setFullName(currentUser.fullName || '');
        setBio(currentUser.bio || '');
        setCity(currentUser.city || '');
        setStreet(currentUser.street || '');
        setRelationshipOrientation(currentUser.relationshipOrientation || 'Single');
        const currentAvatar = currentUser.avatar || currentUser.profilePhoto || currentUser.profileImage || '';
        if (currentAvatar) {
          setAvatarUrl(currentAvatar);
        }
        const currentCover = currentUser.coverImage || currentUser.coverPhoto || DEFAULT_PEWA_COVER;
        if (currentCover) {
          setCoverUrl(currentCover);
        }
      }
    }
  }, [currentUser, isEditing, isUploading]);

  if (!currentUser) return null;

  if (isSettingsOpen) {
    return <SettingsPage onBack={() => setIsSettingsOpen(false)} />;
  }

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setIsUploading(true);
      const folder = `profiles/${currentUser?.uid || 'user'}`;
      const url = await uploadImageWithProgress(file, (p) => setUploadProgress(p), folder);
      setAvatarUrl(url);
      updateCurrentUserProfile({ avatar: url, profilePhoto: url, profileImage: url });
      setIsUploading(false);
    } catch (err) {
      console.warn('Avatar upload note:', err);
      setIsUploading(false);
    } finally {
      e.target.value = '';
    }
  };

  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setIsUploading(true);
      const folder = `profiles/${currentUser?.uid || 'user'}`;
      const url = await uploadImageWithProgress(file, (p) => setUploadProgress(p), folder);
      setCoverUrl(url);
      updateCurrentUserProfile({ coverImage: url, coverPhoto: url });
      setIsUploading(false);
    } catch (err) {
      console.warn('Cover upload note:', err);
      setIsUploading(false);
    } finally {
      e.target.value = '';
    }
  };

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    updateCurrentUserProfile({
      fullName,
      bio,
      city,
      street,
      relationshipOrientation,
      avatar: avatarUrl,
      coverImage: coverUrl
    });
    setIsEditing(false);
    alert('Profile updated successfully!');
  };

  return (
    <div className="pb-24 pt-3 px-4 max-w-md mx-auto sm:max-w-4xl animate-fadeIn space-y-4 text-white">
      {/* Profile Header Container */}
      <div className="bg-[#121216]/80 border border-white/10 rounded-3xl overflow-hidden shadow-2xl relative backdrop-blur-xl">
        
        {/* Top Actions: Change Cover & Dedicated Settings Page Trigger */}
        <div className="absolute top-4 right-4 z-10 flex gap-2">
          {/* Edit Cover Trigger */}
          <label className="p-2.5 bg-black/40 backdrop-blur-xl rounded-2xl text-slate-300 hover:text-white cursor-pointer border border-white/10 shadow-lg transition-colors">
            <Camera className="w-4 h-4" />
            <input type="file" accept="image/*" onChange={handleCoverUpload} className="hidden" />
          </label>
          
          {/* Settings Trigger */}
          <button 
            onClick={() => setIsSettingsOpen(true)}
            className="p-2.5 bg-black/40 backdrop-blur-xl rounded-2xl text-slate-300 hover:text-white cursor-pointer border border-white/10 shadow-lg transition-colors flex items-center gap-1.5 font-bold text-xs"
          >
            <Settings className="w-4 h-4 text-pink-400" />
            <span className="hidden sm:inline">Settings</span>
          </button>
        </div>

        {/* Cover Photo */}
        <div className="relative h-48 w-full bg-white/5">
          <img
            src={coverUrl || DEFAULT_PEWA_COVER}
            alt="PEWA Cover"
            className="w-full h-full object-cover"
            referrerPolicy="no-referrer"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#121216] via-transparent to-black/40" />
        </div>

        {/* Profile Info Overlay */}
        <div className="px-6 pb-6 relative">
          <div className="flex justify-between items-end -mt-14 mb-4">
            {/* Avatar */}
            <div className="relative w-24 h-24 rounded-3xl border-4 border-[#121216] overflow-hidden bg-white/5 shadow-2xl">
              <img 
                src={avatarUrl || currentUser.avatar || currentUser.profilePhoto || currentUser.profileImage || DEFAULT_USER_AVATAR} 
                alt={currentUser.fullName} 
                className="w-full h-full object-cover" 
                referrerPolicy="no-referrer" 
                onError={(e) => {
                  (e.target as HTMLImageElement).src = DEFAULT_USER_AVATAR;
                }}
              />
              <label className="absolute bottom-0 right-0 p-2 bg-gradient-to-r from-pink-500 to-red-600 text-white rounded-xl cursor-pointer shadow-lg hover:scale-105 transition-transform">
                <Camera className="w-3.5 h-3.5" />
                <input type="file" accept="image/*" onChange={handleAvatarUpload} className="hidden" />
              </label>
            </div>

            {/* Edit / Save Action */}
            {isEditing ? (
              <button
                onClick={handleSaveProfile}
                className="px-5 py-2.5 bg-gradient-to-r from-pink-500 to-red-600 text-white font-extrabold text-xs rounded-xl shadow-lg shadow-pink-500/30 hover:opacity-95 transition-all flex items-center gap-1.5"
              >
                <Save className="w-4 h-4" /> Save
              </button>
            ) : (
              <button
                onClick={() => setIsEditing(true)}
                className="px-5 py-2.5 bg-white/5 hover:bg-white/10 text-slate-200 font-bold text-xs rounded-xl border border-white/10 flex items-center gap-1.5 transition-all backdrop-blur-md"
              >
                <Edit3 className="w-4 h-4" /> Edit Profile
              </button>
            )}
          </div>

          {isUploading && (
            <div className="mb-4">
              <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden border border-white/5">
                <div className="h-full bg-gradient-to-r from-pink-500 to-red-600 transition-all duration-300" style={{ width: `${uploadProgress}%` }} />
              </div>
            </div>
          )}

          {/* User Headline */}
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-2xl font-black text-white">{currentUser.fullName}</h2>
              {currentUser.verified && <ShieldCheck className="w-5 h-5 text-pink-500" />}
            </div>
            <p className="text-xs text-pink-400 font-semibold mt-0.5">@{currentUser.username} • {currentUser.gender}, {currentUser.age} years old</p>
            <p className="text-xs text-slate-400 flex items-center gap-1 mt-1">
              <MapPin className="w-3.5 h-3.5 text-slate-500" /> {currentUser.city}, {currentUser.country} ({currentUser.street})
            </p>
          </div>

          {/* STATS: POPS, KEEPS, VOTES */}
          <div className="grid grid-cols-3 gap-3 my-5 p-4 bg-white/5 rounded-2xl border border-white/10 text-center backdrop-blur-md">
            <div>
              <span className="block text-xl font-black text-purple-400">{currentUser.popsCount || 0}</span>
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider flex items-center justify-center gap-1 mt-0.5">
                <BalloonIcon variant="pop" className="w-3.5 h-3.5 text-purple-400" /> Pops (Skipped)
              </span>
            </div>
            <div>
              <span className="block text-xl font-black text-pink-400">{currentUser.keepsCount || 0}</span>
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider flex items-center justify-center gap-1 mt-0.5">
                <BalloonIcon variant="keep" className="w-3.5 h-3.5 text-pink-400" /> Keeps (Interested)
              </span>
            </div>
            <div>
              <span className="block text-xl font-black text-amber-400">{currentUser.votesCount || 0}</span>
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider flex items-center justify-center gap-1 mt-0.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" /> Activity
              </span>
            </div>
          </div>

          {/* Bio & Editable Details */}
          {isEditing ? (
            <form onSubmit={handleSaveProfile} className="space-y-4 pt-2">
              <div>
                <label className="text-[11px] font-bold text-slate-400 block mb-1">Full Name</label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-pink-500/60 transition-all"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-400 block mb-1">Bio</label>
                <textarea
                  rows={3}
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl p-3.5 text-xs text-white focus:outline-none focus:border-pink-500/60 transition-all"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-slate-400 block mb-1">City</label>
                  <input
                    type="text"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-pink-500/60 transition-all"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-400 block mb-1">Street</label>
                  <input
                    type="text"
                    value={street}
                    onChange={(e) => setStreet(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-pink-500/60 transition-all"
                  />
                </div>
              </div>
            </form>
          ) : (
            <div className="space-y-3 pt-2 text-xs text-slate-300">
              <div className="bg-white/5 p-4 rounded-2xl border border-white/10 backdrop-blur-md">
                <span className="font-bold text-slate-400 block mb-1 text-[11px]">Bio</span>
                <p className="italic text-slate-300 leading-relaxed">{currentUser.bio || 'No bio specified.'}</p>
              </div>

              {currentUser.sugarProfile?.active && (
                <div className="bg-amber-500/10 border border-amber-500/30 p-4 rounded-2xl flex items-center justify-between backdrop-blur-md">
                  <div>
                    <span className="font-bold text-amber-300 block flex items-center gap-1.5 text-xs">
                      <Sparkles className="w-4 h-4" /> Active {currentUser.sugarProfile.type}
                    </span>
                    <p className="text-[11px] text-amber-200 mt-1">{currentUser.sugarProfile.expectationOrAllowance}</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
