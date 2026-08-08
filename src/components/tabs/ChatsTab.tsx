import React, { useState, useEffect } from 'react';
import { Search, MessageCircle, MoreVertical, Trash2, VolumeX, Archive, ShieldCheck, CheckCheck, X } from 'lucide-react';
import { ref, onValue, query, orderByChild, equalTo } from 'firebase/database';
import { rtdb } from '../../firebase';
import { useAuth } from '../../context/AuthContext';
import { PEWADatabaseService } from '../../services/db';
import { Chat, UserProfile } from '../../types';
import { runChatDiagnostic } from '../../utils/chatDiagnostic';

interface ChatsTabProps {
  onOpenChatRoom: (chatId: string, partner: UserProfile) => void;
}

export const ChatsTab: React.FC<ChatsTabProps> = ({ onOpenChatRoom }) => {
  const { currentUser } = useAuth();
  const [chats, setChats] = useState<Chat[]>(() => {
    if (!currentUser?.uid) return [];
    try { console.time('[Perf] Chat List Query'); } catch(e) {}
    const local = PEWADatabaseService.getUserChats(currentUser.uid);
    try { console.timeEnd('[Perf] Chat List Query'); } catch(e) {}
    return local;
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [activeContextMenuChatId, setActiveContextMenuChatId] = useState<string | null>(null);

  useEffect(() => {
    if (!currentUser?.uid) return;
    const userUid = currentUser.uid;

    // Load initial chats from local persistence
    loadChats();

    // Run diagnostic helper in background non-blockingly
    const diagTimer = setTimeout(() => {
      runChatDiagnostic(userUid).catch((err) => {
        console.warn('[ChatsTab Diagnostic Error]', err);
      });
    }, 1000);

    let unsubscribeParticipantsMap: (() => void) | null = null;
    let unsubscribeParticipantIds: (() => void) | null = null;

    if (rtdb) {
      try {
        const handleSnapshot = (snapshot: any) => {
          if (snapshot && snapshot.exists()) {
            const val = snapshot.val();
            if (val && typeof val === 'object') {
              const rawKeys = Object.keys(val);
              const validChats: Chat[] = rawKeys
                .map((key) => {
                  const rawItem = val[key];
                  if (!rawItem || typeof rawItem !== 'object') return null;

                  const chatId = rawItem.id || rawItem.chatId || key;
                  if (!chatId) return null;

                  let pList: string[] = [];
                  if (Array.isArray(rawItem.participants)) {
                    pList = rawItem.participants;
                  } else if (rawItem.participants && typeof rawItem.participants === 'object') {
                    pList = Object.keys(rawItem.participants);
                  } else if (Array.isArray(rawItem.participantsList)) {
                    pList = rawItem.participantsList;
                  } else if (Array.isArray(rawItem.participantIds)) {
                    pList = rawItem.participantIds;
                  } else if (chatId.includes('_')) {
                    pList = chatId.split('_');
                  }

                  if (!pList || pList.length === 0) return null;

                  const isUserParticipant =
                    pList.includes(userUid) ||
                    chatId.includes(userUid) ||
                    (rawItem.participants && rawItem.participants[userUid] === true);

                  if (!isUserParticipant) return null;

                  return {
                    id: chatId,
                    participants: pList,
                    lastMessage: rawItem.lastMessage || 'Chat started',
                    lastMessageTime: rawItem.lastMessageTime || rawItem.updatedAt || rawItem.createdAt || Date.now(),
                    unreadCount: rawItem.unreadCount || {},
                    muted: rawItem.muted || {},
                    archived: rawItem.archived || {},
                    updatedAt: rawItem.updatedAt || Date.now(),
                    participantProfiles: rawItem.participantProfiles || {},
                    ...rawItem
                  } as Chat;
                })
                .filter((c): c is Chat => c !== null);

              validChats.forEach((validChat) => {
                PEWADatabaseService.syncLocalChat(validChat);
              });
            }
          }
          loadChats();
        };

        const chatsQueryByMap = query(
          ref(rtdb, 'chats'),
          orderByChild(`participants/${userUid}`),
          equalTo(true)
        );

        unsubscribeParticipantsMap = onValue(
          chatsQueryByMap,
          handleSnapshot,
          (err) => console.warn('[ChatsTab RTDB Listener Note - participants map]', err)
        );

        const chatsQueryByIds = query(
          ref(rtdb, 'chats'),
          orderByChild('participantIds'),
          equalTo(userUid)
        );

        unsubscribeParticipantIds = onValue(
          chatsQueryByIds,
          handleSnapshot,
          (err) => console.warn('[ChatsTab RTDB Listener Note - participantIds]', err)
        );
      } catch (e) {
        console.warn('[ChatsTab Query Listener Setup Note]', e);
      }
    }

    const handleStorageUpdate = () => {
      setTimeout(() => loadChats(), 0);
    };
    window.addEventListener('pewa_storage_update', handleStorageUpdate);

    return () => {
      clearTimeout(diagTimer);
      if (unsubscribeParticipantsMap) unsubscribeParticipantsMap();
      if (unsubscribeParticipantIds) unsubscribeParticipantIds();
      window.removeEventListener('pewa_storage_update', handleStorageUpdate);
    };
  }, [currentUser]);

  const loadChats = () => {
    if (!currentUser) return;
    const userChats = PEWADatabaseService.getUserChats(currentUser.uid);
    setChats(userChats);
  };

  const filteredChats = chats.filter((chat) => {
    if (!currentUser || !chat) return false;
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

    const partnerId = participants.find((p) => p !== currentUser.uid) || participants[0] || '';
    const partner = partnerId ? chat.participantProfiles?.[partnerId] : null;
    const name = partner?.fullName || partner?.username || 'PEWA Member';
    const lastMsg = chat.lastMessage || '';

    const queryLower = searchQuery.toLowerCase().trim();
    if (!queryLower) return true;

    const matchesName = name.toLowerCase().includes(queryLower);
    const matchesLastMessage = lastMsg.toLowerCase().includes(queryLower);

    return matchesName || matchesLastMessage;
  });

  const handleToggleMute = (chatId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!currentUser) return;
    PEWADatabaseService.toggleMuteChat(chatId, currentUser.uid);
    loadChats();
    setActiveContextMenuChatId(null);
  };

  const handleToggleArchive = (chatId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!currentUser) return;
    PEWADatabaseService.toggleArchiveChat(chatId, currentUser.uid);
    loadChats();
    setActiveContextMenuChatId(null);
  };

  const handleDeleteChat = (chatId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!currentUser) return;
    if (confirm('Delete this chat conversation?')) {
      PEWADatabaseService.deleteChat(chatId, currentUser.uid, false);
      loadChats();
    }
    setActiveContextMenuChatId(null);
  };

  return (
    <div className="pb-24 pt-3 px-4 max-w-md mx-auto sm:max-w-4xl animate-fadeIn">
      {/* Search Bar - Filter active conversations by partner name or last message */}
      <div className="relative mb-4">
        <input
          id="chat-search-input"
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search by name or message..."
          className="w-full bg-white/5 border border-white/10 focus:border-pink-500/60 rounded-2xl pl-11 pr-10 py-3 text-xs text-white placeholder-slate-400 shadow-inner focus:outline-none transition-all backdrop-blur-xl"
        />
        <Search className="absolute left-4 top-3.5 text-slate-400 w-4 h-4" />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            aria-label="Clear search"
            className="absolute right-3.5 top-3.5 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Conversations List */}
      {filteredChats.length === 0 ? (
        <div className="text-center py-16 px-4 bg-white/5 border border-white/10 rounded-3xl backdrop-blur-xl">
          <MessageCircle className="w-12 h-12 text-slate-500 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-200">
            {searchQuery ? `No chats matching "${searchQuery}"` : 'No active chats'}
          </h3>
          <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">
            {searchQuery
              ? 'Try searching by a different name or message phrase.'
              : 'Head over to Find Love to match and initiate conversations with real registered users!'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredChats.map((chat) => {
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
            const partnerId = participants.find((p) => p !== currentUser?.uid) || participants[0] || '';
            const rawPartnerProfile = (chat.participantProfiles?.[partnerId] || {
              uid: partnerId,
              fullName: 'PEWA Member',
              avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=400&auto=format&fit=crop'
            }) as UserProfile;

            const isPartnerAdmin = partnerId === 'admin_main' || partnerId === 'pewa_official' || rawPartnerProfile.isAdmin || rawPartnerProfile.role === 'admin' || rawPartnerProfile.role === 'superadmin';
            const adminProfile = isPartnerAdmin ? PEWADatabaseService.getAdminUserProfile() : null;
            const partnerProfile: UserProfile = isPartnerAdmin
              ? ({
                  ...rawPartnerProfile,
                  uid: partnerId || 'admin_main',
                  fullName: adminProfile?.fullName || rawPartnerProfile.fullName || 'PEWA Official',
                  avatar: adminProfile?.avatar || rawPartnerProfile.avatar || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=400&auto=format&fit=crop',
                  verified: true,
                  isAdmin: true,
                  role: 'admin'
                } as UserProfile)
              : rawPartnerProfile;

            const presence = PEWADatabaseService.getPresence(partnerId);
            const isOnline = presence.status === 'online';
            const unread = chat.unreadCount?.[currentUser?.uid || ''] || 0;
            const isMuted = chat.muted?.[currentUser?.uid || ''];
            const isArchived = chat.archived?.[currentUser?.uid || ''];

            return (
              <div
                key={chat.id}
                onClick={() => onOpenChatRoom(chat.id, partnerProfile)}
                onContextMenu={(e) => {
                  e.preventDefault();
                  setActiveContextMenuChatId(activeContextMenuChatId === chat.id ? null : chat.id);
                }}
                className={`relative group flex items-center gap-3.5 p-3.5 rounded-2xl bg-[#121216]/80 hover:bg-white/10 border border-white/10 hover:border-pink-500/40 cursor-pointer transition-all duration-300 shadow-xl backdrop-blur-xl ${
                  isArchived ? 'opacity-60' : ''
                }`}
              >
                {/* Avatar with Online Status Indicator */}
                <div className={`relative w-12 h-12 rounded-2xl overflow-hidden shrink-0 ${isPartnerAdmin ? 'border-2 border-amber-500/80 shadow-md shadow-amber-500/20' : 'border border-white/10'}`}>
                  <img
                    src={partnerProfile.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=400&auto=format&fit=crop'}
                    alt={partnerProfile.fullName || 'User'}
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                  {isOnline && (
                    <span
                      className="absolute bottom-0.5 right-0.5 w-3.5 h-3.5 bg-emerald-500 border-2 border-[#121216] rounded-full"
                      title="Online now"
                    />
                  )}
                </div>

                {/* Conversation Body */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <h4 className="font-extrabold text-sm text-white truncate flex items-center gap-1.5 flex-wrap">
                      <span>{partnerProfile.fullName || 'PEWA User'}</span>
                      {isPartnerAdmin ? (
                        <span className="inline-flex items-center gap-1 text-[10px] bg-gradient-to-r from-amber-500 to-orange-600 text-slate-950 font-black px-2 py-0.5 rounded-full shadow-md shrink-0">
                          <ShieldCheck className="w-3 h-3 text-slate-950" /> Official Admin
                        </span>
                      ) : (
                        partnerProfile.verified && <ShieldCheck className="w-4 h-4 text-pink-500" />
                      )}
                    </h4>
                    <span className="text-[10px] text-slate-400 font-medium">
                      {new Date(chat.lastMessageTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <p className="text-xs text-slate-400 truncate pr-2 flex items-center gap-1">
                      <CheckCheck className="w-3.5 h-3.5 text-pink-400 shrink-0" />
                      <span>{chat.lastMessage}</span>
                    </p>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {isMuted && <VolumeX className="w-3.5 h-3.5 text-slate-500" />}
                      {unread > 0 && (
                        <span className="bg-gradient-to-r from-pink-500 to-red-600 text-white font-black text-[10px] px-2 py-0.5 rounded-full shadow-md">
                          {unread}
                        </span>
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveContextMenuChatId(activeContextMenuChatId === chat.id ? null : chat.id);
                        }}
                        className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
                        title="Options"
                      >
                        <MoreVertical className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Context Menu on Long Press / Click */}
                {activeContextMenuChatId === chat.id && (
                  <div className="absolute right-3 top-12 z-20 bg-[#121216] border border-white/10 rounded-2xl shadow-2xl p-1.5 w-40 text-xs space-y-1 animate-fadeIn backdrop-blur-2xl">
                    <button
                      onClick={(e) => handleToggleMute(chat.id, e)}
                      className="w-full text-left px-3 py-2 rounded-xl hover:bg-white/10 text-slate-200 flex items-center gap-2 transition-colors"
                    >
                      <VolumeX className="w-3.5 h-3.5 text-slate-400" />
                      <span>{isMuted ? 'Unmute' : 'Mute'}</span>
                    </button>
                    <button
                      onClick={(e) => handleToggleArchive(chat.id, e)}
                      className="w-full text-left px-3 py-2 rounded-xl hover:bg-white/10 text-slate-200 flex items-center gap-2 transition-colors"
                    >
                      <Archive className="w-3.5 h-3.5 text-slate-400" />
                      <span>{isArchived ? 'Unarchive' : 'Archive'}</span>
                    </button>
                    <button
                      onClick={(e) => handleDeleteChat(chat.id, e)}
                      className="w-full text-left px-3 py-2 rounded-xl hover:bg-rose-500/20 text-rose-400 flex items-center gap-2 transition-colors font-medium"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Delete</span>
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
