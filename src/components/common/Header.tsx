import React from 'react';
import { ShieldCheck } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export const Header: React.FC<{ onOpenAuth: () => void }> = ({ onOpenAuth }) => {
  const { currentUser, isSuperAdmin } = useAuth();

  return (
    <header className="sticky top-0 z-30 bg-[#0a0a0b]/85 backdrop-blur-xl border-b border-white/10 px-4 py-3.5 max-w-md mx-auto sm:max-w-4xl transition-all">
      <div className="flex items-center justify-between">
        {/* Logo and Brand */}
        <div className="flex items-center gap-3">
          <div className="relative w-10 h-10 rounded-2xl overflow-hidden shadow-lg shadow-pink-500/20 bg-gradient-to-tr from-pink-500 to-red-600 p-0.5">
            <img
              src="/playstore.png"
              alt="PEWA Logo"
              className="w-full h-full object-cover rounded-[14px]"
              referrerPolicy="no-referrer"
            />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-black text-2xl tracking-tight bg-gradient-to-r from-pink-500 to-red-600 bg-clip-text text-transparent">
                PEWA
              </span>
              {isSuperAdmin && (
                <span className="bg-amber-500/10 border border-amber-500/30 text-amber-400 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 shadow-sm">
                  <ShieldCheck className="w-3 h-3" /> SUPER ADMIN
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-400 -mt-1 font-medium tracking-tight">
              Peza Wanga – Find Mine
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2.5">
          {/* User Account / Auth trigger */}
          {!currentUser && (
            <button
              id="header-login-btn"
              onClick={onOpenAuth}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-pink-500 to-red-600 text-white font-semibold text-xs shadow-lg shadow-pink-500/25 hover:opacity-95 transition-all"
            >
              Sign In / Register
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
