import React, { useState, useEffect, useMemo, useRef } from 'react';
import { MessageCircle, SlidersHorizontal, ShieldCheck, MapPin, User, Crown, Share2 } from 'lucide-react';
import { ref, onValue, query, limitToLast, orderByChild, equalTo } from 'firebase/database';
import { rtdb } from '../../firebase';
import { useAuth } from '../../context/AuthContext';
import { PEWADatabaseService } from '../../services/db';
import { UserProfile } from '../../types';
import { PewaSugarsSection } from '../sugars/PewaSugarsSection';
import { BalloonIcon } from '../common/BalloonIcon';
import { VerificationRequiredModal } from '../common/VerificationRequiredModal';
import { VerificationRequestModal } from '../common/VerificationRequestModal';
import { UserProfileModal } from '../common/UserProfileModal';
import { MetaShareModal } from '../common/MetaShareModal';

export const FindLoveTab: React.FC<{ onStartChat: (targetUser: UserProfile) => void }> = ({ onStartChat }) => {
  const { currentUser, updateCurrentUserProfile } = useAuth();
  const [rtdbUsers, setRtdbUsers] = useState<UserProfile[]>(() => {
    return PEWADatabaseService.getAllUsers(false);
  });
  const [poppedUserIds, setPoppedUserIds] = useState<string[]>(() => {
    return currentUser ? PEWADatabaseService.getPoppedUserIds(currentUser.uid) : [];
  });
  const [blockedUserIds, setBlockedUserIds] = useState<string[]>(() => {
    return currentUser ? PEWADatabaseService.getBlockedUserIds(currentUser.uid) : [];
  });
  const [isLoading, setIsLoading] = useState(() => {
    const cached = PEWADatabaseService.getAllUsers(false);
    return cached.length === 0;
  });

  useEffect(() => {
    if (currentUser?.uid) {
      setPoppedUserIds(PEWADatabaseService.getPoppedUserIds(currentUser.uid));
      setBlockedUserIds(PEWADatabaseService.getBlockedUserIds(currentUser.uid));
    }
    const handlePopsUpdated = () => {
      if (currentUser?.uid) {
        setPoppedUserIds(PEWADatabaseService.getPoppedUserIds(currentUser.uid));
        setBlockedUserIds(PEWADatabaseService.getBlockedUserIds(currentUser.uid));
      }
    };
    window.addEventListener('pewa_pops_updated', handlePopsUpdated);
    return () => window.removeEventListener('pewa_pops_updated', handlePopsUpdated);
  }, [currentUser?.uid]);

  const [activeTab, setActiveTab] = useState<'standard' | 'sugars'>('standard');
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [userToShare, setUserToShare] = useState<UserProfile | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Verification modal state
  const [showVerificationModal, setShowVerificationModal] = useState(false);
  const [verificationMessage, setVerificationMessage] = useState('');

  // Filters & Pagination
  const [showFilters, setShowFilters] = useState(false);
  const [filterGender, setFilterGender] = useState<string>('All');
  const [filterCity, setFilterCity] = useState<string>('All');
  const [filterVerifiedOnly, setFilterVerifiedOnly] = useState(false);
  const [pageSize, setPageSize] = useState(25);
  const [hasMore, setHasMore] = useState(true);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  // Automatic background pagination when scrolling near the bottom
  useEffect(() => {
    if (!sentinelRef.current || !hasMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setPageSize((prev) => prev + 25);
        }
      },
      { rootMargin: '300px' }
    );

    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [hasMore, rtdbUsers.length]);

  // Subscribe directly to Realtime Database users node with indexed queries & pagination
  useEffect(() => {
    if (!rtdb) {
      setIsLoading(false);
      return;
    }

    try { console.time('[Perf] RTDB User Discovery Listener'); } catch(e) {}
    const userCountry = (currentUser?.country || '').trim();
    const isVerified = currentUser ? PEWADatabaseService.isUserVerified(currentUser) : false;

    let usersQuery;
    if (!isVerified && userCountry) {
      // Query RTDB indexed by country for unverified users directly at DB level
      usersQuery = query(
        ref(rtdb, 'users'),
        orderByChild('country'),
        equalTo(userCountry),
        limitToLast(pageSize)
      );
    } else {
      // Query RTDB indexed by createdAt for verified/global users
      usersQuery = query(
        ref(rtdb, 'users'),
        orderByChild('createdAt'),
        limitToLast(pageSize)
      );
    }

    const unsubscribe = onValue(
      usersQuery,
      (snapshot) => {
        try { console.timeEnd('[Perf] RTDB User Discovery Listener'); } catch(e) {}
        const val = snapshot.val();
        if (!val) {
          setHasMore(false);
          setIsLoading(false);
          return;
        }

        const keys = Object.keys(val);
        setHasMore(keys.length >= pageSize);

        const list: UserProfile[] = keys.map((key) => {
          const profile = PEWADatabaseService.mapFirestoreDocToUserProfile(val[key], key);
          PEWADatabaseService.saveUser(profile);
          return profile;
        });

        setRtdbUsers(list);
        setIsLoading(false);
      },
      (err) => {
        console.warn('[FindLoveTab] RTDB listener note (falling back to default ordering):', err);
        // Fallback query if index is initializing
        const fallbackQuery = query(ref(rtdb, 'users'), limitToLast(pageSize));
        onValue(fallbackQuery, (snapshot) => {
          const val = snapshot.val();
          if (val) {
            const list = Object.keys(val).map((k) => PEWADatabaseService.mapFirestoreDocToUserProfile(val[k], k));
            setRtdbUsers(list);
          }
          setIsLoading(false);
        }, { onlyOnce: true });
      }
    );

    return () => unsubscribe();
  }, [currentUser?.uid, currentUser?.country, currentUser?.verified, pageSize]);

  // Debug Logs
  useEffect(() => {
    if (currentUser) {
      console.log("Current user:", {
        uid: currentUser.uid,
        gender: currentUser.gender,
        city: currentUser.city,
        country: currentUser.country
      });
    }
  }, [currentUser]);

  useEffect(() => {
    const maleCount = rtdbUsers.filter((u) => u.gender?.toLowerCase().trim() === 'male').length;
    const femaleCount = rtdbUsers.filter((u) => u.gender?.toLowerCase().trim() === 'female').length;
    console.log("Loaded users:", {
      total: rtdbUsers.length,
      maleCount,
      femaleCount
    });
  }, [rtdbUsers]);

  // Compute matches based on strict user matching rules and location priority
  const users = useMemo(() => {
    if (!currentUser) return [];

    const currentUserGender = (currentUser.gender || '').trim().toLowerCase();
    const currentUserCity = (currentUser.city || '').trim().toLowerCase();
    const currentUserCountry = (currentUser.country || '').trim().toLowerCase();

    // Determine strict opposite gender rule
    const targetGender = currentUserGender === 'female' ? 'male' : currentUserGender === 'male' ? 'female' : null;

    const filtered = rtdbUsers.filter((u) => {
      // 1. Exclude self
      if (u.uid === currentUser.uid) return false;

      // 2. Exclude popped or blocked users
      if (poppedUserIds.includes(u.uid) || blockedUserIds.includes(u.uid)) return false;

      // 3. Exclude suspended, banned, disabled, or deleted accounts
      if (u.suspended || u.banned || u.disabled || (u as any).status === 'suspended' || (u as any).status === 'banned' || (u as any).status === 'disabled' || (u as any).status === 'deleted') return false;

      // 4. Exclude incomplete profiles (must have uid, fullName)
      if (!u.uid || !u.fullName?.trim()) {
        return false;
      }

      const candidateGender = (u.gender || '').trim().toLowerCase();

      // 5. Gender Matching Rules:
      // Never show same gender users if current user gender is set
      if (currentUserGender && candidateGender === currentUserGender) return false;

      // Show opposite gender users strictly
      if (targetGender && candidateGender !== targetGender) return false;

      // 6. User UI Filters
      if (filterGender !== 'All') {
        if (candidateGender !== filterGender.toLowerCase()) return false;
      }
      if (filterCity !== 'All' && filterCity.trim() !== '') {
        if (!u.city.toLowerCase().includes(filterCity.toLowerCase().trim())) return false;
      }
      if (filterVerifiedOnly && !u.verified) {
        return false;
      }

      // 7. Country visibility restriction for non-verified users:
      // Verified users unlock global matching & international discovery.
      // Non-verified users can only see users from their own country.
      if (!PEWADatabaseService.isUserVerified(currentUser)) {
        const candidateCountry = (u.country || '').trim().toLowerCase();
        if (currentUserCountry && candidateCountry && candidateCountry !== currentUserCountry) {
          return false;
        }
      }

      return true;
    });

    // Sort by Location Matching Priority:
    // Priority 1: Same city
    // Priority 2: Same country
    // Priority 3: Other locations
    return filtered.sort((a, b) => {
      const aCity = (a.city || '').trim().toLowerCase();
      const bCity = (b.city || '').trim().toLowerCase();
      const aCountry = (a.country || '').trim().toLowerCase();
      const bCountry = (b.country || '').trim().toLowerCase();

      const getLocScore = (cCity: string, cCountry: string) => {
        if (currentUserCity && cCity === currentUserCity) return 1;
        if (currentUserCountry && cCountry === currentUserCountry) return 2;
        return 3;
      };

      const scoreA = getLocScore(aCity, aCountry);
      const scoreB = getLocScore(bCity, bCountry);

      if (scoreA !== scoreB) {
        return scoreA - scoreB;
      }

      // Secondary tie-breaker: verified first, then newest
      if (a.verified !== b.verified) return a.verified ? -1 : 1;
      return (b.createdAt || 0) - (a.createdAt || 0);
    });
  }, [rtdbUsers, currentUser, poppedUserIds, blockedUserIds, filterGender, filterCity, filterVerifiedOnly]);

  useEffect(() => {
    console.log("Filtered matches:", {
      count: users.length
    });
  }, [users]);

  const handleKeepUser = (target: UserProfile) => {
    if (!currentUser) return;
    const res = PEWADatabaseService.keepUser(currentUser.uid, target.uid);
    updateCurrentUserProfile({ keepsCount: res.totalKeeps });
    window.dispatchEvent(new Event('pewa_pops_updated'));
    setToastMessage(`🎈 Kept ${target.fullName}! Expressed interest.`);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handlePopUser = (target: UserProfile) => {
    if (!currentUser) return;
    const res = PEWADatabaseService.popUser(currentUser.uid, target.uid);
    updateCurrentUserProfile({ popsCount: res.totalPops });
    setPoppedUserIds((prev) => [...prev, target.uid]);
    window.dispatchEvent(new Event('pewa_pops_updated'));
    setToastMessage(`🎈 Popped ${target.fullName}. Skipped profile.`);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleShareProfile = (targetUser: UserProfile) => {
    setUserToShare(targetUser);
  };

  return (
    <div className="pb-24 pt-4 px-4 max-w-md mx-auto sm:max-w-4xl animate-fadeIn space-y-5 relative">
      {/* Toast feedback */}
      {toastMessage && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 bg-[#14141d] border border-pink-500/40 text-white px-5 py-2.5 rounded-2xl shadow-2xl text-xs font-bold flex items-center gap-2 animate-bounce">
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Tab Switcher: Standard Find Love vs PEWA Sugars */}
      <div className="flex items-center gap-2 bg-[#12121a]/90 border border-white/10 p-1.5 rounded-2xl shadow-2xl backdrop-blur-xl w-full">
        <div className="flex-1 min-w-0 flex items-center bg-black/40 p-1 rounded-xl border border-white/5 gap-1">
          <button
            onClick={() => setActiveTab('standard')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-lg text-xs font-black transition-all whitespace-nowrap select-none min-w-0 ${
              activeTab === 'standard'
                ? 'bg-gradient-to-r from-pink-500 to-rose-600 text-white shadow-md shadow-pink-500/25'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <BalloonIcon variant="keep" className="w-3.5 h-3.5 shrink-0 text-pink-200" />
            <span className="truncate">Find Love</span>
          </button>

          <button
            onClick={() => setActiveTab('sugars')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-lg text-xs font-black transition-all whitespace-nowrap select-none min-w-0 ${
              activeTab === 'sugars'
                ? 'bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 shadow-md shadow-amber-500/25'
                : 'text-amber-300/90 hover:text-amber-200 hover:bg-white/5'
            }`}
          >
            <Crown className="w-3.5 h-3.5 shrink-0 fill-current text-amber-400" />
            <span className="truncate">PEWA Sugars</span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-extrabold shrink-0 border ${
              activeTab === 'sugars'
                ? 'bg-slate-950/30 text-slate-950 border-slate-950/20'
                : 'bg-amber-400/20 text-amber-300 border-amber-400/30'
            }`}>
              18+
            </span>
          </button>
        </div>

        {activeTab === 'standard' && (
          <button
            onClick={() => setShowFilters(!showFilters)}
            title="Filter Profiles"
            className={`px-3 py-2.5 rounded-xl text-xs font-bold border transition-all flex items-center justify-center shrink-0 backdrop-blur-md ${
              showFilters
                ? 'bg-pink-500/20 text-pink-300 border-pink-500/50 shadow-md shadow-pink-500/20'
                : 'bg-white/5 hover:bg-white/10 text-slate-300 border-white/10'
            }`}
          >
            <SlidersHorizontal className="w-4 h-4 text-pink-400" />
          </button>
        )}
      </div>

      {/* Render Active View */}
      {activeTab === 'sugars' ? (
        <PewaSugarsSection onStartChat={onStartChat} />
      ) : (
        <>
          {/* Filter Drawer for Standard Find Love */}
          {showFilters && (
            <div className="p-5 bg-[#121216]/90 border border-white/10 rounded-3xl text-white space-y-4 animate-fadeIn shadow-2xl backdrop-blur-xl">
              <h4 className="text-xs font-black text-pink-400 uppercase tracking-wider">Nearby Matching Filters</h4>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block text-slate-400 mb-1.5 font-medium">Gender</label>
                  <select
                    value={filterGender}
                    onChange={(e) => setFilterGender(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-pink-500"
                  >
                    <option value="All" className="bg-[#121216]">All Matching Genders</option>
                    <option value="Female" className="bg-[#121216]">Female</option>
                    <option value="Male" className="bg-[#121216]">Male</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-400 mb-1.5 font-medium">City</label>
                  <input
                    type="text"
                    placeholder="e.g. Lusaka"
                    value={filterCity === 'All' ? '' : filterCity}
                    onChange={(e) => setFilterCity(e.target.value || 'All')}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-pink-500"
                  />
                </div>
              </div>
              <div className="flex items-center gap-2.5 text-xs pt-1">
                <input
                  type="checkbox"
                  id="filter-verified"
                  checked={filterVerifiedOnly}
                  onChange={(e) => setFilterVerifiedOnly(e.target.checked)}
                  className="accent-pink-500 w-4 h-4 rounded"
                />
                <label htmlFor="filter-verified" className="text-slate-300 cursor-pointer font-medium">
                  Show Verified Profiles Only
                </label>
              </div>
            </div>
          )}

          {/* PROFILES GRID / CARDS */}
          {isLoading ? (
            <div className="text-center py-16 px-4 bg-white/5 border border-white/10 rounded-3xl backdrop-blur-xl">
              <BalloonIcon variant="keep" className="w-12 h-12 text-pink-500 mx-auto mb-3 animate-pulse" />
              <p className="text-xs text-slate-400 font-semibold">Finding matches in Realtime Database...</p>
            </div>
          ) : users.length === 0 ? (
            <div className="text-center py-16 px-4 bg-white/5 border border-white/10 rounded-3xl backdrop-blur-xl space-y-2">
              <BalloonIcon variant="keep" className="w-12 h-12 text-slate-600 mx-auto mb-3 animate-pulse" />
              <h3 className="text-base font-bold text-slate-200">
                No matches found yet. More users will appear as people join.
              </h3>
            </div>
          ) : (
            <div className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                {users.map((profile) => (
                  <div
                    key={profile.uid}
                    className="group relative bg-[#121216]/80 border border-white/10 hover:border-pink-500/50 rounded-3xl overflow-hidden shadow-2xl transition-all duration-300 hover:shadow-pink-500/15 flex flex-col backdrop-blur-xl"
                  >
                    {/* Profile Cover & Avatar */}
                    <div className="relative h-56 w-full bg-slate-900 overflow-hidden">
                      <img
                        src={profile.avatar}
                        alt={profile.fullName}
                        loading="lazy"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        referrerPolicy="no-referrer"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-[#121216] via-[#121216]/20 to-transparent" />

                      {/* Badges */}
                      <div className="absolute top-3 left-3 flex items-center gap-1.5">
                        {profile.verified && (
                          <span className="bg-pink-500/90 text-white text-[11px] font-extrabold px-2.5 py-0.5 rounded-full shadow-lg flex items-center gap-1 backdrop-blur-md">
                            <ShieldCheck className="w-3.5 h-3.5" /> Verified
                          </span>
                        )}
                        {profile.sugarProfile?.active && (
                          <span className="bg-amber-400 text-slate-950 text-[10px] font-black px-2.5 py-0.5 rounded-full shadow-lg">
                            {profile.sugarProfile.type || 'Sugar'}
                          </span>
                        )}
                      </div>

                      <div className="absolute bottom-3 left-3 right-3 text-white">
                        <div className="flex items-center gap-1.5">
                          <h3 className="text-xl font-black tracking-tight drop-shadow-lg">
                            {profile.fullName}, {profile.age}
                          </h3>
                        </div>
                        <div className="flex items-center gap-1 text-xs text-pink-300 font-semibold mt-0.5">
                          <MapPin className="w-3.5 h-3.5" />
                          <span>{profile.city}, {profile.country}</span>
                        </div>
                      </div>
                    </div>

                    {/* Card Body */}
                    <div className="p-4 flex-1 flex flex-col justify-between space-y-3.5 text-slate-300 text-xs">
                      <p className="line-clamp-2 text-slate-400 italic">
                        "{profile.bio || 'Looking to connect with genuine people on PEWA.'}"
                      </p>

                      {/* Profile Tags */}
                      <div className="flex flex-wrap gap-1.5">
                        <span className="bg-white/5 border border-white/10 text-slate-300 px-2.5 py-1 rounded-xl text-[11px] font-medium">
                          {profile.relationshipOrientation}
                        </span>
                        <span className="bg-white/5 border border-white/10 text-slate-300 px-2.5 py-1 rounded-xl text-[11px] font-medium">
                          {profile.personality}
                        </span>
                      </div>

                      {/* Card Actions: POP (Not Interested) & KEEP (Interested) Balloon Buttons + Share */}
                      <div className="flex items-center gap-2 pt-2.5 border-t border-white/10">
                        <button
                          onClick={() => handlePopUser(profile)}
                          className="flex-1 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/10 font-extrabold text-xs flex items-center justify-center gap-1.5 transition-all active:scale-95"
                          title="Not Interested"
                        >
                          <BalloonIcon variant="pop" className="w-4 h-4 text-purple-400" />
                          <span>Pop</span>
                        </button>

                        <button
                          onClick={() => handleKeepUser(profile)}
                          className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-pink-500 to-red-600 text-white font-black text-xs shadow-lg shadow-pink-500/25 hover:opacity-95 flex items-center justify-center gap-1.5 transition-all active:scale-95"
                          title="Interested"
                        >
                          <BalloonIcon variant="keep" className="w-4 h-4 text-white" />
                          <span>Keep</span>
                        </button>

                        <button
                          onClick={() => onStartChat(profile)}
                          className="p-2.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 transition-all active:scale-95"
                          title="Start Conversation"
                        >
                          <MessageCircle className="w-4 h-4" />
                        </button>

                        <button
                          onClick={() => setSelectedUser(profile)}
                          className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 transition-all active:scale-95"
                          title="View Full Profile"
                        >
                          <User className="w-4 h-4" />
                        </button>

                        {/* Profile Share Button */}
                        <button
                          onClick={() => handleShareProfile(profile)}
                          className={`p-2.5 rounded-xl border transition-all active:scale-95 ${
                            currentUser?.verified
                              ? 'bg-pink-500/15 hover:bg-pink-500/25 text-pink-400 border-pink-500/30 shadow-md shadow-pink-500/10'
                              : 'bg-white/5 text-slate-500 border-white/10 hover:text-slate-400'
                          }`}
                          title={currentUser?.verified ? "Share Member Profile" : "Profile sharing is exclusive to verified members"}
                        >
                          <Share2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Infinite Scroll Sentinel Element */}
              {hasMore && <div ref={sentinelRef} className="h-4 w-full" />}

              {hasMore && users.length >= pageSize && (
                <div className="text-center pt-2">
                  <button
                    onClick={() => setPageSize((prev) => prev + 25)}
                    className="px-6 py-3 bg-gradient-to-r from-pink-500/20 to-purple-500/20 hover:from-pink-500/30 hover:to-purple-500/30 text-pink-200 border border-pink-500/30 rounded-2xl text-xs font-bold transition-all active:scale-95 shadow-xl backdrop-blur-md"
                  >
                    Load More Matches
                  </button>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* FULL PROFILE DETAIL POPUP FOR STANDARD FIND LOVE */}
      {selectedUser && currentUser && (
        <UserProfileModal
          user={selectedUser}
          currentUser={currentUser}
          onClose={() => setSelectedUser(null)}
          onStartChat={onStartChat}
          onStartVoiceCall={(targetUser) => {
            window.dispatchEvent(
              new CustomEvent('pewa_start_voice_call', {
                detail: { partner: targetUser }
              })
            );
          }}
        />
      )}

      {/* META SHARE MODAL */}
      {userToShare && currentUser && (
        <MetaShareModal
          userToShare={userToShare}
          currentUser={currentUser}
          onClose={() => setUserToShare(null)}
        />
      )}

      {/* VERIFICATION REQUIRED MODAL FOR UNVERIFIED SHARE ATTEMPTS */}
      {showVerificationModal && (
        <VerificationRequiredModal
          title="Verified Feature Only"
          message={verificationMessage}
          onClose={() => setShowVerificationModal(false)}
        />
      )}
    </div>
  );
};
