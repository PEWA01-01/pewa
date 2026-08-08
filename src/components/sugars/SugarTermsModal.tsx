import React, { useState } from 'react';
import { ShieldCheck, Lock, AlertTriangle, FileText, CheckCircle2, Heart, Scale, ShieldAlert } from 'lucide-react';

interface SugarTermsModalProps {
  onAccept: () => void;
  onCancel: () => void;
}

export const SugarTermsModal: React.FC<SugarTermsModalProps> = ({ onAccept, onCancel }) => {
  const [readTerms, setReadTerms] = useState(false);
  const [readPrivacy, setReadPrivacy] = useState(false);
  const [readSafety, setReadSafety] = useState(false);
  const [confirm18, setConfirm18] = useState(false);
  const [agreeConduct, setAgreeConduct] = useState(false);
  const [activeDocTab, setActiveDocTab] = useState<'terms' | 'privacy' | 'safety'>('terms');

  const allAccepted = readTerms && readPrivacy && readSafety && confirm18 && agreeConduct;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0a0a0b]/85 backdrop-blur-xl animate-fadeIn">
      <div className="relative w-full max-w-xl bg-[#121216] border border-amber-500/40 rounded-3xl p-6 text-white space-y-4 shadow-2xl max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-white/10 pb-4 shrink-0">
          <div className="p-3 bg-gradient-to-r from-amber-400 to-amber-600 text-slate-950 rounded-2xl shadow-lg shadow-amber-500/30">
            <Scale className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-xl font-black text-amber-300">PEWA Sugars Governance & Safety Agreement</h3>
            <p className="text-xs text-slate-400">Strictly for consenting adults (18+) seeking mutually agreed companionship.</p>
          </div>
        </div>

        {/* Tab switcher for documents */}
        <div className="flex gap-2 border-b border-white/10 pb-2 shrink-0 text-xs">
          <button
            onClick={() => setActiveDocTab('terms')}
            className={`px-3 py-1.5 rounded-xl font-bold transition-all flex items-center gap-1.5 ${
              activeDocTab === 'terms' ? 'bg-amber-500 text-slate-950 font-black' : 'bg-white/5 text-slate-400 hover:text-white'
            }`}
          >
            <FileText className="w-3.5 h-3.5" /> Terms & Conditions
          </button>
          <button
            onClick={() => setActiveDocTab('privacy')}
            className={`px-3 py-1.5 rounded-xl font-bold transition-all flex items-center gap-1.5 ${
              activeDocTab === 'privacy' ? 'bg-amber-500 text-slate-950 font-black' : 'bg-white/5 text-slate-400 hover:text-white'
            }`}
          >
            <Lock className="w-3.5 h-3.5" /> Privacy Policy
          </button>
          <button
            onClick={() => setActiveDocTab('safety')}
            className={`px-3 py-1.5 rounded-xl font-bold transition-all flex items-center gap-1.5 ${
              activeDocTab === 'safety' ? 'bg-amber-500 text-slate-950 font-black' : 'bg-white/5 text-slate-400 hover:text-white'
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5" /> Safety Guidelines
          </button>
        </div>

        {/* Scrollable Document Content */}
        <div className="flex-1 overflow-y-auto bg-white/5 border border-white/10 rounded-2xl p-4 text-xs space-y-3 leading-relaxed text-slate-300">
          {activeDocTab === 'terms' && (
            <div className="space-y-2">
              <h4 className="font-extrabold text-amber-300 text-sm">Terms & Conditions of PEWA Sugars</h4>
              <p>1. <strong>Eligibility:</strong> You must be at least 18 years of age to register or participate in PEWA Sugars. Misrepresentation of age is strictly prohibited and leads to immediate permanent banning.</p>
              <p>2. <strong>Consenting Adults:</strong> All arrangements, interactions, and agreements between Sugar Mamas, Sugar Daddies, and Sugar Babies must be fully voluntary, transparent, and consensual.</p>
              <p>3. <strong>Prohibited Conduct:</strong> Exploitation, harassment, extortion, non-consensual sharing of media, human trafficking, or unlawful activities are illegal and reported to law enforcement agencies.</p>
              <p>4. <strong>Profile Authenticity:</strong> Submitted photos must be authentic representations of yourself. Impersonation or fake identity verification documents will result in permanent account termination.</p>
              <p>5. <strong>Platform Governance:</strong> PEWA reserves the right to review, reject, suspend, or terminate any Sugar profile that violates safety standard guidelines.</p>
            </div>
          )}

          {activeDocTab === 'privacy' && (
            <div className="space-y-2">
              <h4 className="font-extrabold text-amber-300 text-sm">PEWA Sugars Privacy & Data Protection Policy</h4>
              <p>1. <strong>Data Confidentiality:</strong> Your identity documents and personal contact details (phone number, exact street location) are kept secure and encrypted. Only your approved Sugar Profile is displayed publicly.</p>
              <p>2. <strong>Discreet Messaging:</strong> Direct messages exchanged on PEWA Sugars are end-to-end user encrypted. Never share financial credentials or security PINs in chat.</p>
              <p>3. <strong>Data Control:</strong> You retain the right to edit, pause, or permanently delete your Sugar profile at any time from your account settings.</p>
            </div>
          )}

          {activeDocTab === 'safety' && (
            <div className="space-y-2">
              <h4 className="font-extrabold text-amber-300 text-sm">Mandatory Safety & First-Meeting Protocols</h4>
              <p>1. <strong>Public First Meetings:</strong> Always arrange initial meetings in well-lit public places (restaurants, cafes, hotels).</p>
              <p>2. <strong>No Advance Financial Transfers:</strong> Never send money, deposits, or gift cards to any match before establishing mutual trust in person.</p>
              <p>3. <strong>Inform a Trusted Friend:</strong> Share your location and date details with a trusted friend before meeting a new match.</p>
              <p>4. <strong>Immediate Reporting:</strong> Use the Report & Block feature immediately if a member acts aggressively, makes inappropriate demands, or behaves suspiciously.</p>
            </div>
          )}
        </div>

        {/* Required Confirmation Checkboxes */}
        <div className="space-y-2 text-xs border-t border-white/10 pt-3 shrink-0">
          <label className="flex items-start gap-2.5 cursor-pointer p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 transition-colors">
            <input
              type="checkbox"
              checked={confirm18}
              onChange={(e) => setConfirm18(e.target.checked)}
              className="mt-0.5 accent-amber-500 w-4 h-4 rounded shrink-0"
            />
            <span>I solemnly confirm that I am <strong>18 years of age or older</strong>.</span>
          </label>

          <label className="flex items-start gap-2.5 cursor-pointer p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 transition-colors">
            <input
              type="checkbox"
              checked={readTerms}
              onChange={(e) => setReadTerms(e.target.checked)}
              className="mt-0.5 accent-amber-500 w-4 h-4 rounded shrink-0"
            />
            <span>I have read, understood, and accept the <strong>Terms & Conditions</strong>.</span>
          </label>

          <label className="flex items-start gap-2.5 cursor-pointer p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 transition-colors">
            <input
              type="checkbox"
              checked={readPrivacy}
              onChange={(e) => setReadPrivacy(e.target.checked)}
              className="mt-0.5 accent-amber-500 w-4 h-4 rounded shrink-0"
            />
            <span>I have read and accept the <strong>Privacy Policy</strong>.</span>
          </label>

          <label className="flex items-start gap-2.5 cursor-pointer p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 transition-colors">
            <input
              type="checkbox"
              checked={readSafety}
              onChange={(e) => setReadSafety(e.target.checked)}
              className="mt-0.5 accent-amber-500 w-4 h-4 rounded shrink-0"
            />
            <span>I agree to adhere strictly to all <strong>Safety Guidelines</strong>.</span>
          </label>

          <label className="flex items-start gap-2.5 cursor-pointer p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 transition-colors">
            <input
              type="checkbox"
              checked={agreeConduct}
              onChange={(e) => setAgreeConduct(e.target.checked)}
              className="mt-0.5 accent-amber-500 w-4 h-4 rounded shrink-0"
            />
            <span>I agree to respectful conduct, mutual consent, and platform code of honor.</span>
          </label>
        </div>

        {/* Buttons */}
        <div className="flex gap-3 pt-2 shrink-0">
          <button
            onClick={onCancel}
            className="flex-1 py-3 bg-white/10 hover:bg-white/20 text-slate-300 font-bold text-xs rounded-2xl transition-all"
          >
            Decline & Exit
          </button>
          <button
            onClick={onAccept}
            disabled={!allAccepted}
            className={`flex-1 py-3 font-extrabold text-xs rounded-2xl shadow-xl flex items-center justify-center gap-2 transition-all ${
              allAccepted
                ? 'bg-gradient-to-r from-amber-400 to-amber-600 text-slate-950 shadow-amber-500/30 hover:opacity-95'
                : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-white/5'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            Accept & Continue Application
          </button>
        </div>
      </div>
    </div>
  );
};
