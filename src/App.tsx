import React, { useState } from 'react';
import { ShieldCheck, LogOut } from 'lucide-react';
import { ref, set } from 'firebase/database';
import { rtdb } from './firebase';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Header } from './components/common/Header';
import { AndroidAppPromotionBanner } from './components/common/AndroidAppPromotionBanner';
import { BottomNav } from './components/common/BottomNav';
import { FindLoveTab } from './components/tabs/FindLoveTab';
import { ChatsTab } from './components/tabs/ChatsTab';
import { ChatRoom } from './components/chat/ChatRoom';
import { PostsTab } from './components/tabs/PostsTab';
import { NotificationsTab } from './components/tabs/NotificationsTab';
import { AccountTab } from './components/tabs/AccountTab';
import { AdminDashboard } from './components/admin/AdminDashboard';
import { AuthModal } from './components/auth/AuthModal';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { BalloonIcon } from './components/common/BalloonIcon';
import { VoiceCallOverlay } from './components/common/VoiceCallOverlay';
import { PEWADatabaseService } from './services/db';
import { UserProfile } from './types';

function MainAppContent() {
  const { currentUser, isAdminLoggedIn, isLoading, activeTab, setActiveTab, logout } = useAuth();
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  // Active chat room state with sessionStorage recovery
  const [activeChatRoom, setActiveChatRoom] = useState<{ chatId: string; partner: UserProfile } | null>(() => {
    try {
      const saved = sessionStorage.getItem('pewa_active_chat_room');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  // System status verification write to Firebase Realtime Database
  React.useEffect(() => {
    if (rtdb) {
      set(ref(rtdb, 'system/status'), {
        connected: true,
        database: "pewa-1-default-rtdb",
        time: Date.now()
      }).then(() => {
        console.log('[RTDB] system/status status write verified');
      }).catch((err) => {
        console.warn('[RTDB] system/status status write warning:', err);
      });
    }
  }, []);

  // Sync auth modal with auth state after loading completes
  React.useEffect(() => {
    if (!isLoading) {
      if (!currentUser && !isAdminLoggedIn) {
        setIsAuthModalOpen(true);
      } else {
        setIsAuthModalOpen(false);
      }
    }
  }, [currentUser, isAdminLoggedIn, isLoading]);

  React.useEffect(() => {
    if (activeChatRoom) {
      window.history.pushState({ inChat: true }, '');
    }

    const handlePopState = () => {
      if (activeChatRoom) {
        setActiveChatRoom(null);
        sessionStorage.removeItem('pewa_active_chat_room');
        setActiveTab('chats');
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [activeChatRoom]);

  const handleStartChatWithUser = (targetUser: UserProfile) => {
    if (!currentUser) {
      setIsAuthModalOpen(true);
      return;
    }
    const chat = PEWADatabaseService.getOrCreateChat(currentUser.uid, targetUser.uid, targetUser);
    const room = { chatId: chat.id, partner: targetUser };
    setActiveChatRoom(room);
    sessionStorage.setItem('pewa_active_chat_room', JSON.stringify(room));
    setActiveTab('chats');
  };

  const handleOpenChatRoom = (chatId: string, partner: UserProfile) => {
    const room = { chatId, partner };
    setActiveChatRoom(room);
    sessionStorage.setItem('pewa_active_chat_room', JSON.stringify(room));
  };

  // Auth Initialization Loader (Prevents flickering & accidental redirects)
  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 selection:bg-rose-500 selection:text-white">
        <div className="relative flex items-center justify-center mb-5">
          <div className="w-16 h-16 border-4 border-pink-500/20 border-t-pink-500 rounded-full animate-spin"></div>
          <BalloonIcon variant="keep" className="w-8 h-8 text-pink-400 absolute" />
        </div>
        <h2 className="text-sm font-bold text-slate-300 tracking-wider uppercase animate-pulse">
          Restoring PEWA Session...
        </h2>
        <p className="text-xs text-slate-500 mt-2">Connecting to secure account profile</p>
      </div>
    );
  }

  // DEDICATED ADMINISTRATOR ENVIRONMENT
  if (isAdminLoggedIn) {
    const adminConfig = PEWADatabaseService.getAdminConfig();
    const adminAvatar = currentUser?.avatar || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=400&auto=format&fit=crop';
    const adminName = currentUser?.fullName || 'PEWA Official';
    const adminEmail = currentUser?.email || adminConfig.email || 'mikelbishonga@gmail.com';

    return (
      <div className="min-h-screen bg-[#09090d] text-slate-100 font-sans selection:bg-amber-500 selection:text-slate-950 pb-12">
        {/* Dedicated Admin Header */}
        <header className="sticky top-0 z-40 bg-[#0d0d14]/95 backdrop-blur-xl border-b border-amber-500/30 px-4 py-3 shadow-2xl">
          <div className="max-w-6xl mx-auto flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="relative shrink-0">
                <img
                  src={adminAvatar}
                  alt={adminName}
                  className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl object-cover border-2 border-amber-500/80 shadow-lg shadow-amber-500/20"
                />
                <div className="absolute -bottom-1 -right-1 bg-amber-500 text-slate-950 p-0.5 rounded-full shadow">
                  <ShieldCheck className="w-3 h-3" />
                </div>
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h1 className="font-black text-sm sm:text-base tracking-tight text-white truncate">{adminName}</h1>
                  <span className="shrink-0 px-2 py-0.5 bg-gradient-to-r from-amber-500/20 to-orange-500/20 text-amber-300 border border-amber-500/40 rounded-full font-mono text-[9px] sm:text-[10px] font-black uppercase tracking-wider flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping"></span>
                    ADMIN ACTIVE
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 truncate">
                  Admin Email: <span className="font-mono text-amber-300 font-semibold">{adminEmail}</span>
                </p>
              </div>
            </div>

            <button
              onClick={logout}
              className="px-3.5 py-2 bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 hover:border-rose-500/60 rounded-xl font-bold text-xs transition-all flex items-center gap-1.5 shrink-0 shadow-md active:scale-95"
              title="Logout Admin"
            >
              <LogOut className="w-4 h-4 text-rose-400" />
              <span className="hidden sm:inline">Logout Admin</span>
            </button>
          </div>
        </header>

        {/* Dedicated Admin Dashboard View */}
        <main className="max-w-6xl mx-auto p-3 sm:p-6">
          <AdminDashboard />
        </main>
      </div>
    );
  }

  // NORMAL USER ENVIRONMENT
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-rose-500 selection:text-white pb-16">
      {/* Native Android App Promotion Banner & Fixed Top Header (Unless in full screen chat room) */}
      {!activeChatRoom && (
        <>
          <AndroidAppPromotionBanner />
          <Header
            onOpenAuth={() => setIsAuthModalOpen(true)}
          />
        </>
      )}

      {/* Main Tab Content Canvas */}
      <main className="container mx-auto">
        {activeChatRoom ? (
          <ChatRoom
            chatId={activeChatRoom.chatId}
            partner={activeChatRoom.partner}
            onBack={() => {
              setActiveChatRoom(null);
              sessionStorage.removeItem('pewa_active_chat_room');
              setActiveTab('chats');
            }}
          />
        ) : (
          <>
            {activeTab === 'love' && <FindLoveTab onStartChat={handleStartChatWithUser} />}
            {activeTab === 'chats' && <ChatsTab onOpenChatRoom={handleOpenChatRoom} />}
            {activeTab === 'posts' && <PostsTab />}
            {activeTab === 'notifications' && <NotificationsTab onOpenChatRoom={handleOpenChatRoom} />}
            {activeTab === 'account' && <AccountTab />}
          </>
        )}
      </main>

      {/* Fixed Bottom Navigation */}
      {!activeChatRoom && (
        <BottomNav />
      )}

      {/* Auth Modal */}
      <AuthModal isOpen={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} />

      {/* Global Voice Call Manager Overlay */}
      <VoiceCallOverlay />
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <MainAppContent />
      </AuthProvider>
    </ErrorBoundary>
  );
}
