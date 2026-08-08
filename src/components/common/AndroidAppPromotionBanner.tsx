import React, { useState, useEffect } from 'react';
import { Download, X, Smartphone, Sparkles, CheckCircle2 } from 'lucide-react';

export const AndroidAppPromotionBanner: React.FC = () => {
  const [isNativeApp, setIsNativeApp] = useState<boolean>(false);
  const [isDismissed, setIsDismissed] = useState<boolean>(false);
  const [isAndroid, setIsAndroid] = useState<boolean>(false);

  useEffect(() => {
    // 1. Process nativeApp=1 signal from URL if present
    const url = new URL(window.location.href);
    if (url.searchParams.get('nativeApp') === '1') {
      localStorage.setItem('pewa_native_android', 'true');
      url.searchParams.delete('nativeApp');
      window.history.replaceState({}, document.title, url.pathname + url.search + url.hash);
    }

    // 2. Check if user is inside native PEWA Android app
    const checkNative = () => {
      const storedNative = localStorage.getItem('pewa_native_android') === 'true';
      const isAndroidTWA = document.referrer.includes('android-app://') || navigator.userAgent.includes('PEWANativeAndroid');
      return Boolean(storedNative || isAndroidTWA);
    };

    if (checkNative()) {
      setIsNativeApp(true);
      return;
    }

    // 3. Detect Android user agent or mobile environment
    const ua = navigator.userAgent.toLowerCase();
    const isAndroidUA = /android/.test(ua);
    setIsAndroid(isAndroidUA);

    // 4. Check dismissal status (session-based / temporal dismissal)
    const dismissedTime = sessionStorage.getItem('pewa_android_banner_dismissed');
    if (dismissedTime) {
      setIsDismissed(true);
    }
  }, []);

  const handleDismiss = () => {
    setIsDismissed(true);
    sessionStorage.setItem('pewa_android_banner_dismissed', Date.now().toString());
  };

  const apkDownloadUrl = 'https://github.com/PEWA01-01/Downloads/raw/8e7bf365c4d6a49e4ce4a58f1e60ceb1eb7fae16/PEWA.apk';

  // Do NOT render if in native Android app or dismissed
  if (isNativeApp || isDismissed) {
    return null;
  }

  return (
    <div className="relative z-50 bg-gradient-to-r from-rose-950 via-slate-900 to-rose-950 border-b border-rose-500/30 text-white shadow-xl backdrop-blur-md transition-all duration-300">
      <div className="max-w-7xl mx-auto px-3 py-2.5 sm:px-4 sm:py-3 flex items-center justify-between gap-3">
        {/* App Info Section */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="relative shrink-0">
            <img
              src="/icons/icon-192x192.png"
              alt="PEWA Android App"
              className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl shadow-md border border-rose-500/40 object-cover"
              onError={(e) => {
                (e.target as HTMLImageElement).src = '/logo.png';
              }}
            />
            <span className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 text-[9px] font-bold text-white shadow">
              <CheckCircle2 className="w-2.5 h-2.5" />
            </span>
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-sm sm:text-base font-bold text-white truncate">Get the PEWA Android App</h3>
              <span className="hidden xs:inline-block px-2 py-0.5 text-[9px] uppercase font-extrabold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 rounded-full tracking-wider">
                Official App
              </span>
            </div>
            <p className="text-xs text-rose-200/90 truncate">
              Enjoy PEWA faster with the official Android app.
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 shrink-0">
          <a
            href={apkDownloadUrl}
            download="PEWA.apk"
            className="flex items-center gap-1.5 px-3 py-1.5 sm:px-4 sm:py-2 bg-gradient-to-r from-rose-600 via-pink-600 to-rose-500 hover:from-rose-500 hover:to-pink-500 text-white font-bold text-xs sm:text-sm rounded-xl shadow-md shadow-rose-950/50 active:scale-95 transition-all cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>Get PEWA App</span>
          </a>

          <button
            onClick={handleDismiss}
            aria-label="Dismiss app banner"
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800/60 rounded-xl transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
