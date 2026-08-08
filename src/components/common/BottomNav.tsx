import React from 'react';
import { Heart, MessageCircle, Flame, Bell, User, ShieldAlert } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export const BottomNav: React.FC = () => {
  const { activeTab, setActiveTab, currentUser, isSuperAdmin } = useAuth();

  if (!currentUser) return null;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-[#0a0a0b]/90 backdrop-blur-2xl border-t border-white/10 px-2 sm:px-4 py-1.5 pb-safe max-w-md mx-auto sm:max-w-4xl transition-all">
      <div className="flex items-center justify-around h-14">
        {/* 1. Find Love */}
        <button
          id="nav-tab-love"
          onClick={() => setActiveTab('love')}
          aria-label="Find Love"
          className={`relative p-2.5 sm:p-3 rounded-2xl transition-all duration-300 ${
            activeTab === 'love'
              ? 'bg-gradient-to-r from-pink-500 to-red-600 text-white shadow-lg shadow-pink-500/35 scale-105'
              : 'text-slate-400 hover:text-pink-400 hover:bg-white/5'
          }`}
        >
          <Heart className="w-5 h-5 sm:w-6 sm:h-6 fill-current" />
          {activeTab === 'love' && (
            <span className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 w-1.5 h-1.5 bg-pink-400 rounded-full animate-ping" />
          )}
        </button>

        {/* 2. Chats */}
        <button
          id="nav-tab-chats"
          onClick={() => setActiveTab('chats')}
          aria-label="Chats"
          className={`relative p-2.5 sm:p-3 rounded-2xl transition-all duration-300 ${
            activeTab === 'chats'
              ? 'bg-gradient-to-r from-pink-500 to-red-600 text-white shadow-lg shadow-pink-500/35 scale-105'
              : 'text-slate-400 hover:text-pink-400 hover:bg-white/5'
          }`}
        >
          <MessageCircle className="w-5 h-5 sm:w-6 sm:h-6" />
          {activeTab === 'chats' && (
            <span className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 w-1.5 h-1.5 bg-pink-400 rounded-full animate-ping" />
          )}
        </button>

        {/* 3. Posts */}
        <button
          id="nav-tab-posts"
          onClick={() => setActiveTab('posts')}
          aria-label="Posts"
          className={`relative p-2.5 sm:p-3 rounded-2xl transition-all duration-300 ${
            activeTab === 'posts'
              ? 'bg-gradient-to-r from-pink-500 to-red-600 text-white shadow-lg shadow-pink-500/35 scale-105'
              : 'text-slate-400 hover:text-pink-400 hover:bg-white/5'
          }`}
        >
          <Flame className="w-5 h-5 sm:w-6 sm:h-6 fill-current" />
          {activeTab === 'posts' && (
            <span className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 w-1.5 h-1.5 bg-pink-400 rounded-full animate-ping" />
          )}
        </button>

        {/* 4. Notifications */}
        <button
          id="nav-tab-notifications"
          onClick={() => setActiveTab('notifications')}
          aria-label="Notifications"
          className={`relative p-2.5 sm:p-3 rounded-2xl transition-all duration-300 ${
            activeTab === 'notifications'
              ? 'bg-gradient-to-r from-pink-500 to-red-600 text-white shadow-lg shadow-pink-500/35 scale-105'
              : 'text-slate-400 hover:text-pink-400 hover:bg-white/5'
          }`}
        >
          <Bell className="w-5 h-5 sm:w-6 sm:h-6" />
          {activeTab === 'notifications' && (
            <span className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 w-1.5 h-1.5 bg-pink-400 rounded-full animate-ping" />
          )}
        </button>

        {/* 5. Account */}
        <button
          id="nav-tab-account"
          onClick={() => setActiveTab('account')}
          aria-label="Account"
          className={`relative p-2.5 sm:p-3 rounded-2xl transition-all duration-300 ${
            activeTab === 'account'
              ? 'bg-gradient-to-r from-pink-500 to-red-600 text-white shadow-lg shadow-pink-500/35 scale-105'
              : 'text-slate-400 hover:text-pink-400 hover:bg-white/5'
          }`}
        >
          <User className="w-5 h-5 sm:w-6 sm:h-6" />
          {activeTab === 'account' && (
            <span className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 w-1.5 h-1.5 bg-pink-400 rounded-full animate-ping" />
          )}
        </button>

        {/* Admin Workspace Icon (Super Admin Only) */}
        {isSuperAdmin && (
          <button
            id="nav-tab-admin"
            onClick={() => setActiveTab('admin')}
            aria-label="Super Administrator Dashboard"
            title="Super Administrator Dashboard"
            className={`relative p-2.5 sm:p-3 rounded-2xl transition-all duration-300 ${
              activeTab === 'admin'
                ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/40 scale-105 font-bold'
                : 'text-amber-400 hover:text-amber-300 hover:bg-white/5'
            }`}
          >
            <ShieldAlert className="w-5 h-5 sm:w-6 sm:h-6" />
          </button>
        )}
      </div>
    </nav>
  );
};
