import React, { useState, useEffect } from 'react';
import { UserProfile, SugarProfile, SugarRoleType } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { PEWADatabaseService } from '../../services/db';
import { SugarTermsModal } from './SugarTermsModal';
import { SugarApplicationForm } from './SugarApplicationForm';
import { SugarCard } from './SugarCard';
import { SugarProfileDetailModal } from './SugarProfileDetailModal';
import { Sparkles, ShieldCheck, SlidersHorizontal, Search, Heart, Bookmark, AlertTriangle, Crown, PlusCircle, CheckCircle, Info, Edit3 } from 'lucide-react';

interface PewaSugarsSectionProps {
  onStartChat: (targetUser: UserProfile) => void;
}

export const PewaSugarsSection: React.FC<PewaSugarsSectionProps> = ({ onStartChat }) => {
  const { currentUser, refreshCurrentUser } = useAuth();
  const [sugarUsers, setSugarUsers] = useState<UserProfile[]>([]);
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);

  // Flow State
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [showAppForm, setShowAppForm] = useState(false);

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [filterAgeMin, setFilterAgeMin] = useState<number>(18);
  const [filterAgeMax, setFilterAgeMax] = useState<number>(65);
  const [filterCountry, setFilterCountry] = useState('All');
  const [filterCity, setFilterCity] = useState('All');
  const [filterRelPref, setFilterRelPref] = useState('All');
  const [filterVerifiedOnly, setFilterVerifiedOnly] = useState(false);
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    loadSugarProfiles();
    const handlePopsUpdated = () => loadSugarProfiles();
    window.addEventListener('pewa_pops_updated', handlePopsUpdated);
    return () => window.removeEventListener('pewa_pops_updated', handlePopsUpdated);
  }, [currentUser, searchQuery, filterAgeMin, filterAgeMax, filterCountry, filterCity, filterRelPref, filterVerifiedOnly, showFavoritesOnly]);

  if (!currentUser) return null;

  // Age Check (18+)
  if (currentUser.age < 18) {
    return (
      <div className="p-8 text-center bg-rose-500/10 border border-rose-500/30 rounded-3xl max-w-md mx-auto my-8 space-y-3">
        <AlertTriangle className="w-12 h-12 text-rose-500 mx-auto" />
        <h3 className="text-xl font-black text-rose-300">PEWA Sugars Access Restricted</h3>
        <p className="text-xs text-rose-200 leading-relaxed">
          PEWA Sugars is strictly reserved for consenting adults aged 18 years or older. Our system indicates you are currently under 18.
        </p>
      </div>
    );
  }

  // Determine Sugar Role based on gender and age
  const getRoleForUser = (user: UserProfile): SugarRoleType => {
    if (user.gender === 'Female') {
      return user.age >= 35 ? 'Sugar Mama' : 'Sugar Baby (Female)';
    } else {
      return user.age >= 31 ? 'Sugar Daddy' : 'Sugar Baby (Male)';
    }
  };

  const userSugarRole = getRoleForUser(currentUser);
  const hasAcceptedTerms = !!currentUser.sugarProfile?.termsAccepted;
  const hasProfile = !!currentUser.sugarProfile?.active;
  const isPendingApproval = currentUser.sugarProfile?.status === 'pending';

  const loadSugarProfiles = () => {
    let list = PEWADatabaseService.getSugarUsers(currentUser);

    // Filter out self, popped, and blocked users
    const poppedIds = PEWADatabaseService.getPoppedUserIds(currentUser.uid);
    const blockedIds = PEWADatabaseService.getBlockedUserIds(currentUser.uid);
    list = list.filter((u) => u.uid !== currentUser.uid && !poppedIds.includes(u.uid) && !blockedIds.includes(u.uid));

    // Filter by name/username search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (u) =>
          u.fullName.toLowerCase().includes(q) ||
          u.city.toLowerCase().includes(q) ||
          u.country.toLowerCase().includes(q)
      );
    }

    // Age Filter
    list = list.filter((u) => u.age >= filterAgeMin && u.age <= filterAgeMax);

    // Country Filter
    if (filterCountry !== 'All') {
      list = list.filter((u) => u.country.toLowerCase().includes(filterCountry.toLowerCase()));
    }

    // City Filter
    if (filterCity !== 'All') {
      list = list.filter((u) => u.city.toLowerCase().includes(filterCity.toLowerCase()));
    }

    // Relationship Preference Filter
    if (filterRelPref !== 'All') {
      list = list.filter((u) =>
        u.sugarProfile?.relationshipPreferences?.some((p) => p.toLowerCase().includes(filterRelPref.toLowerCase()))
      );
    }

    // Verified Only Filter
    if (filterVerifiedOnly) {
      list = list.filter((u) => u.sugarProfile?.status === 'approved' || u.verified);
    }

    // Favorites Only Filter
    if (showFavoritesOnly) {
      const favs = currentUser.favoriteSugarUids || [];
      list = list.filter((u) => favs.includes(u.uid));
    }

    setSugarUsers(list);
  };

  const handleTermsAccept = () => {
    setShowTermsModal(false);
    setShowAppForm(true);
  };

  const handleFormSubmit = (formData: Partial<SugarProfile>) => {
    const updatedUser = PEWADatabaseService.submitSugarApplication(currentUser.uid, formData);
    refreshCurrentUser();
    setShowAppForm(false);
    alert('Your PEWA Sugar application has been submitted! Administrators will review your profile shortly.');
  };

  const handleToggleFavorite = (targetUserId: string) => {
    PEWADatabaseService.toggleFavoriteSugarUser(currentUser.uid, targetUserId);
    refreshCurrentUser();
  };

  const handleSendLike = (target: UserProfile) => {
    PEWADatabaseService.togglePop(currentUser.uid, target.uid);
    alert(`You sent a Sugar Heart to ${target.fullName}!`);
  };

  const isFavorite = (uid: string) => (currentUser.favoriteSugarUids || []).includes(uid);

  return (
    <div className="space-y-6">
      {/* PEWA SUGARS HERO & ONBOARDING HEADER */}
      <div className="relative overflow-hidden bg-gradient-to-r from-[#1a1400] via-[#241a00] to-[#121216] border border-amber-500/30 rounded-3xl p-5 sm:p-6 shadow-2xl">
        <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Crown className="w-6 h-6 text-amber-400 fill-current animate-pulse" />
              <h2 className="text-2xl font-black text-amber-300 tracking-tight">PEWA Sugars</h2>
              <span className="bg-amber-400/20 text-amber-300 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full border border-amber-500/40">
                18+ VIP
              </span>
            </div>
            <p className="text-xs text-amber-200/80 max-w-lg">
              Mutually agreed companionship & support-based relationships for consenting adults.
            </p>
          </div>

          {/* Action Button: Application / Edit */}
          <div className="flex items-center gap-2 w-full sm:w-auto">
            {!hasProfile ? (
              <button
                onClick={() => setShowAppForm(true)}
                className="w-full sm:w-auto px-5 py-3 rounded-2xl bg-gradient-to-r from-amber-400 to-amber-600 text-slate-950 font-black text-xs shadow-xl shadow-amber-500/30 hover:opacity-95 flex items-center justify-center gap-2 transition-all"
              >
                <PlusCircle className="w-4 h-4" />
                <span>Create {userSugarRole} Profile</span>
              </button>
            ) : (
              <button
                onClick={() => setShowAppForm(true)}
                className="w-full sm:w-auto px-4 py-2.5 rounded-2xl bg-white/10 hover:bg-white/20 text-amber-300 border border-amber-500/40 font-extrabold text-xs flex items-center justify-center gap-2 transition-all"
              >
                <Edit3 className="w-4 h-4 text-amber-400" />
                <span>Edit My Sugar Profile</span>
              </button>
            )}
          </div>
        </div>

        {/* Pending Approval Banner */}
        {hasProfile && isPendingApproval && (
          <div className="mt-4 p-3 bg-amber-500/20 border border-amber-500/40 rounded-2xl text-amber-200 text-xs flex items-center gap-3">
            <Info className="w-5 h-5 text-amber-400 shrink-0" />
            <div>
              <span className="font-bold text-amber-300 block">Application Pending Review</span>
              Your Sugar profile is currently under administrator verification. Approved profiles display the Golden Verified Sugar Badge.
            </div>
          </div>
        )}
      </div>

      {/* SEARCH, FILTER & FAVORITES BAR */}
      <div className="bg-[#121216]/90 border border-white/10 p-3 sm:p-4 rounded-3xl space-y-3 backdrop-blur-xl shadow-xl">
        <div className="flex flex-col sm:flex-row items-center gap-2.5">
          {/* Search Input */}
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search Sugar profiles by name, city, country..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-2xl text-xs text-white placeholder-slate-400 focus:outline-none focus:border-amber-500"
            />
          </div>

          {/* Filter & Favorites Buttons */}
          <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
            <button
              onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
              className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition-all flex items-center gap-2 ${
                showFavoritesOnly
                  ? 'bg-amber-500 text-slate-950 font-black shadow-lg shadow-amber-500/25'
                  : 'bg-white/5 text-slate-300 hover:text-white border border-white/10'
              }`}
            >
              <Bookmark className="w-4 h-4" />
              <span>Saved Favorites</span>
            </button>

            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition-all flex items-center gap-2 ${
                showFilters
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/50'
                  : 'bg-white/5 text-slate-300 hover:text-white border border-white/10'
              }`}
            >
              <SlidersHorizontal className="w-4 h-4 text-amber-400" />
              <span>Filters</span>
            </button>
          </div>
        </div>

        {/* Expanded Filters Drawer */}
        {showFilters && (
          <div className="p-4 bg-white/5 border border-white/10 rounded-2xl space-y-3 animate-fadeIn text-xs">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className="block text-slate-400 mb-1 font-semibold">Min Age ({filterAgeMin})</label>
                <input
                  type="range"
                  min={18}
                  max={65}
                  value={filterAgeMin}
                  onChange={(e) => setFilterAgeMin(Number(e.target.value))}
                  className="w-full accent-amber-500"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-semibold">Max Age ({filterAgeMax})</label>
                <input
                  type="range"
                  min={18}
                  max={65}
                  value={filterAgeMax}
                  onChange={(e) => setFilterAgeMax(Number(e.target.value))}
                  className="w-full accent-amber-500"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-semibold">City</label>
                <input
                  type="text"
                  placeholder="e.g. Lusaka"
                  value={filterCity === 'All' ? '' : filterCity}
                  onChange={(e) => setFilterCity(e.target.value || 'All')}
                  className="w-full bg-[#121216] border border-white/10 rounded-xl px-3 py-1.5 text-white"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-semibold">Relationship Goal</label>
                <select
                  value={filterRelPref}
                  onChange={(e) => setFilterRelPref(e.target.value)}
                  className="w-full bg-[#121216] border border-white/10 rounded-xl px-3 py-1.5 text-white"
                >
                  <option value="All">All Preferences</option>
                  <option value="Financial support">Financial support</option>
                  <option value="Romantic relationship">Romantic relationship</option>
                  <option value="Emotional companionship">Emotional companionship</option>
                  <option value="Casual dating">Casual dating</option>
                  <option value="Long-term companionship">Long-term companionship</option>
                </select>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="sugar-verified-filter"
                checked={filterVerifiedOnly}
                onChange={(e) => setFilterVerifiedOnly(e.target.checked)}
                className="accent-amber-500 w-4 h-4 rounded"
              />
              <label htmlFor="sugar-verified-filter" className="text-slate-300 font-medium cursor-pointer">
                Show Approved & Verified Profiles Only
              </label>
            </div>
          </div>
        )}
      </div>

      {/* PROFILES FEED GRID */}
      {sugarUsers.length === 0 ? (
        <div className="text-center py-16 px-4 bg-white/5 border border-white/10 rounded-3xl backdrop-blur-xl space-y-3">
          <Crown className="w-12 h-12 text-amber-500/50 mx-auto animate-pulse" />
          <h3 className="text-lg font-bold text-slate-200">No Sugar Profiles Found</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            {showFavoritesOnly
              ? "You haven't saved any favorite Sugar profiles yet. Click the bookmark icon on any profile card to save them!"
              : `No active ${userSugarRole === 'Sugar Mama' || userSugarRole === 'Sugar Daddy' ? 'Sugar Babies' : 'Sugar Mamas / Daddies'} match your search filters currently.`}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {sugarUsers.map((user) => (
            <SugarCard
              key={user.uid}
              user={user}
              currentUser={currentUser}
              onViewDetail={(u) => setSelectedUser(u)}
              onStartChat={onStartChat}
              onSendLike={handleSendLike}
              onToggleFavorite={handleToggleFavorite}
              isFavorite={isFavorite(user.uid)}
            />
          ))}
        </div>
      )}

      {/* MODALS */}
      {showTermsModal && (
        <SugarTermsModal
          onAccept={handleTermsAccept}
          onCancel={() => setShowTermsModal(false)}
        />
      )}

      {showAppForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-[#0a0a0b]/85 backdrop-blur-xl overflow-y-auto">
          <SugarApplicationForm
            currentUser={currentUser}
            sugarRole={userSugarRole}
            onSubmit={handleFormSubmit}
            onCancel={() => setShowAppForm(false)}
          />
        </div>
      )}

      {selectedUser && (
        <SugarProfileDetailModal
          user={selectedUser}
          currentUser={currentUser}
          onClose={() => setSelectedUser(null)}
          onStartChat={onStartChat}
          onToggleFavorite={handleToggleFavorite}
          isFavorite={isFavorite(selectedUser.uid)}
        />
      )}
    </div>
  );
};
