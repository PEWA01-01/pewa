import React from 'react';
import { ShieldCheck, X, Sparkles, CheckCircle2 } from 'lucide-react';

interface VerificationRequiredModalProps {
  title?: string;
  message: string;
  onClose: () => void;
  onRequestVerification?: () => void;
}

export const VerificationRequiredModal: React.FC<VerificationRequiredModalProps> = ({
  title = 'Account Verification Required',
  message,
  onClose,
  onRequestVerification
}) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0a0a0b]/85 backdrop-blur-xl animate-fadeIn">
      <div className="bg-[#14141d] border border-pink-500/30 rounded-3xl max-w-sm w-full p-6 text-white text-center space-y-4 shadow-2xl relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-all"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="w-16 h-16 mx-auto rounded-full bg-gradient-to-tr from-pink-500/30 via-rose-500/20 to-red-500/30 text-pink-400 flex items-center justify-center border border-pink-500/40 shadow-xl shadow-pink-500/20">
          <ShieldCheck className="w-8 h-8" />
        </div>

        <div className="space-y-2">
          <h3 className="font-extrabold text-base text-white">{title}</h3>
          <p className="text-xs text-slate-300 leading-relaxed">
            {message}
          </p>
        </div>

        <div className="p-3 bg-white/5 border border-white/10 rounded-2xl text-left space-y-1.5 text-[11px] text-slate-300">
          <span className="font-extrabold text-pink-300 block mb-1">Verified Member Benefits:</span>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-3.5 h-3.5 text-pink-400 shrink-0" />
            <span>Send Photos, Videos, Documents & Media</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-3.5 h-3.5 text-pink-400 shrink-0" />
            <span>Share Contacts & Verified Social Handles</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-3.5 h-3.5 text-pink-400 shrink-0" />
            <span>Unlimited Voice Editing & Premium Voice Effects</span>
          </div>
        </div>

        <div className="flex flex-col gap-2 pt-2">
          {onRequestVerification && (
            <button
              onClick={() => {
                onClose();
                onRequestVerification();
              }}
              className="w-full py-3 rounded-2xl bg-gradient-to-r from-pink-500 to-red-600 font-black text-xs text-white shadow-lg shadow-pink-500/30 hover:opacity-95 transition-all flex items-center justify-center gap-2"
            >
              <Sparkles className="w-4 h-4 fill-current" />
              <span>Submit Verification Request</span>
            </button>
          )}

          <button
            onClick={onClose}
            className="w-full py-2.5 rounded-2xl bg-white/5 hover:bg-white/10 font-bold text-xs text-slate-400 transition-all"
          >
            Got it, thanks
          </button>
        </div>
      </div>
    </div>
  );
};
