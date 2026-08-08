import React, { useState } from 'react';
import { X, Lock, Phone, Mail, ArrowRight, ShieldCheck, AlertCircle, ChevronDown, Loader2, KeyRound } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { SignupWizard } from './SignupWizard';
import { UserProfile } from '../../types';
import { COUNTRIES, CountryCode } from '../../data/countries';
import { PEWADatabaseService } from '../../services/db';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose }) => {
  const {
    currentUser,
    checkInputAccount,
    loginWithPin,
    completeSignup,
    setupNewPinForUserAsync
  } = useAuth();

  const [inputVal, setInputVal] = useState('');
  const [selectedCountry, setSelectedCountry] = useState<CountryCode>(COUNTRIES[0]); // Default Zambia (+260)
  const [showCountryMenu, setShowCountryMenu] = useState(false);
  const [countrySearch, setCountrySearch] = useState('');
  
  const [viewState, setViewState] = useState<'input' | 'pin' | 'setup_pin' | 'signup'>('input');
  const [targetAccount, setTargetAccount] = useState<UserProfile | null>(null);
  const [pinVal, setPinVal] = useState('');
  const [confirmPinVal, setConfirmPinVal] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [forgotPinSuccessMsg, setForgotPinSuccessMsg] = useState<string | null>(null);
  const [isSubmittingForgotPin, setIsSubmittingForgotPin] = useState(false);

  const [isSearching, setIsSearching] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const isEmail = inputVal.includes('@');

  const filteredCountries = COUNTRIES.filter(c =>
    c.name.toLowerCase().includes(countrySearch.toLowerCase()) ||
    c.dialCode.includes(countrySearch) ||
    c.code.toLowerCase().includes(countrySearch.toLowerCase())
  );

  const getFormattedPhoneOrEmail = () => {
    const raw = inputVal.trim();
    if (!raw) return '';
    if (raw.includes('@')) return raw;
    if (!raw.startsWith('+')) {
      const cleanDigits = raw.replace(/^0+/, '');
      return `${selectedCountry.dialCode}${cleanDigits}`;
    }
    return raw;
  };

  const handleCheckAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    const formatted = getFormattedPhoneOrEmail();
    if (!formatted) {
      setErrorMessage('Please enter a phone number or email address.');
      return;
    }

    setIsSearching(true);
    try {
      console.log(`[AuthModal] User lookup started for input: "${formatted}"`);
      const res = await checkInputAccount(formatted);
      if (res.exists && res.user) {
        console.log(`[AuthModal] User document found for input "${formatted}": UID=${res.user.uid}`);
        setTargetAccount(res.user);
        setViewState('pin');
      } else {
        console.log(`[AuthModal] User document not found for input "${formatted}". Directing to signup.`);
        setViewState('signup');
      }
    } catch (err: any) {
      console.error(`[AuthModal] Any Firebase errors note during account lookup:`, err);
      setErrorMessage(err?.message || 'Error checking user account credentials.');
    } finally {
      setIsSearching(false);
    }
  };

  const handlePinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    if (!targetAccount) return;

    setIsSubmitting(true);
    try {
      console.log(`[AuthModal] User lookup started for PIN login: ${targetAccount.uid} (${targetAccount.email || targetAccount.phone})`);
      const res = await loginWithPin(targetAccount, pinVal);
      if (res.success) {
        console.log(`[AuthModal] Authentication success for user ${targetAccount.uid}. Navigation to Home.`);
        onClose();
      } else {
        console.warn(`[AuthModal] Authentication failure reason for user ${targetAccount.uid}: ${res.message}`);
        setErrorMessage(res.message || 'Incorrect 4-digit PIN. Please try again.');
      }
    } catch (err: any) {
      console.error(`[AuthModal] Any Firebase errors note during PIN login:`, err);
      setErrorMessage(err?.message || 'Login failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleForgotPinRequest = async () => {
    setErrorMessage('');
    setForgotPinSuccessMsg(null);
    setIsSubmittingForgotPin(true);

    try {
      const formatted = getFormattedPhoneOrEmail();
      const userToRequest = targetAccount || {
        uid: 'user_' + Date.now(),
        fullName: 'PEWA Member',
        email: isEmail ? formatted : '',
        phone: !isEmail ? formatted : ''
      };

      const req = await PEWADatabaseService.submitPinResetRequest({
        uid: userToRequest.uid,
        name: userToRequest.fullName,
        registeredEmail: userToRequest.email,
        registeredPhone: userToRequest.phone
      });

      console.log('[AuthModal] Created secure PIN reset support request:', req.id);
      setForgotPinSuccessMsg('PIN Reset Request Submitted! A secure support request has been created in Firebase for the Administrator. Your 4-digit PIN remains encrypted and private.');
    } catch (err: any) {
      console.error('[AuthModal] Failed to submit PIN reset request:', err);
      setErrorMessage('Failed to submit PIN reset request. Please try again.');
    } finally {
      setIsSubmittingForgotPin(false);
    }
  };

  const handleSetupPinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    if (!targetAccount) return;

    if (pinVal.length !== 4 || !/^\d{4}$/.test(pinVal)) {
      setErrorMessage('PIN must be exactly 4 digits.');
      return;
    }
    if (pinVal !== confirmPinVal) {
      setErrorMessage('4-digit PINs do not match.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await setupNewPinForUserAsync(targetAccount, pinVal);
      if (res.success) {
        onClose();
      } else {
        setErrorMessage(res.message || 'Failed to set up PIN.');
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Error setting up PIN.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSignupComplete = async (draft: any) => {
    setIsSubmitting(true);
    setErrorMessage('');
    try {
      await completeSignup(draft);
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || 'Registration failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-[#0a0a0b]/80 backdrop-blur-xl animate-fadeIn overflow-y-auto">
      {/* Invisible reCAPTCHA container for Firebase Phone Auth */}
      <div id="auth-modal-recaptcha" className="hidden"></div>

      <div className="relative w-full max-w-md my-auto max-h-[94vh] flex flex-col">
        {/* Close Button - Only shown when user is logged in */}
        {currentUser && (
          <button
            onClick={onClose}
            className="absolute -top-3 -right-3 z-10 p-2.5 bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white rounded-full border border-white/10 shadow-lg backdrop-blur-md transition-all"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        )}

        {/* SCREEN 1: SINGLE INPUT (Phone Number or Email) */}
        {viewState === 'input' && (
          <div className="bg-[#121216]/90 border border-white/10 rounded-3xl p-6 shadow-2xl text-white backdrop-blur-2xl">
            <div className="text-center mb-6">
              <div className="inline-flex p-3 rounded-2xl bg-gradient-to-tr from-pink-500 to-red-600 shadow-lg shadow-pink-500/30 mb-3">
                <img
                  src="/playstore.png"
                  alt="PEWA"
                  className="w-10 h-10 object-cover rounded-xl"
                  referrerPolicy="no-referrer"
                />
              </div>
              <h2 className="text-2xl font-black bg-gradient-to-r from-pink-400 via-rose-500 to-red-500 bg-clip-text text-transparent">
                PEWA Account Access
              </h2>
              <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">
                Enter your registered Phone Number or Email address to sign in or register.
              </p>
            </div>

            {errorMessage && (
              <div className="mb-4 p-3.5 bg-rose-500/20 border border-rose-500/40 rounded-2xl text-rose-300 text-xs flex items-center gap-2.5 backdrop-blur-md">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{errorMessage}</span>
              </div>
            )}

            <form onSubmit={handleCheckAccount} className="space-y-4">
              <div>
                <label className="block text-[11px] font-extrabold text-slate-300 mb-1.5 uppercase tracking-wider">
                  Phone Number or Email
                </label>
                <div className="flex gap-2">
                  {/* Country Code Dropdown */}
                  {!isEmail && (
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setShowCountryMenu(!showCountryMenu)}
                        className="h-full px-3 py-3.5 bg-white/5 border border-white/10 hover:border-white/20 rounded-2xl flex items-center gap-1.5 text-xs font-semibold text-white transition-all shrink-0"
                      >
                        <span className="text-base">{selectedCountry.flag}</span>
                        <span>{selectedCountry.dialCode}</span>
                        <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                      </button>

                      {showCountryMenu && (
                        <div className="absolute left-0 top-full mt-2 w-64 max-h-60 bg-[#18181f] border border-white/10 rounded-2xl shadow-2xl z-50 overflow-hidden flex flex-col backdrop-blur-xl">
                          <div className="p-2 border-b border-white/10">
                            <input
                              type="text"
                              value={countrySearch}
                              onChange={(e) => setCountrySearch(e.target.value)}
                              placeholder="Search country or code..."
                              className="w-full bg-white/5 border border-white/10 rounded-xl px-2.5 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-pink-500/60"
                            />
                          </div>
                          <div className="overflow-y-auto flex-1 p-1 space-y-0.5 max-h-48">
                            {filteredCountries.map((c) => (
                              <button
                                key={c.code}
                                type="button"
                                onClick={() => {
                                  setSelectedCountry(c);
                                  setShowCountryMenu(false);
                                  setCountrySearch('');
                                }}
                                className={`w-full px-3 py-2 text-left text-xs rounded-xl flex items-center justify-between transition-colors ${
                                  selectedCountry.code === c.code
                                    ? 'bg-pink-500/20 text-pink-300 font-bold'
                                    : 'text-slate-300 hover:bg-white/5'
                                }`}
                              >
                                <span className="flex items-center gap-2 truncate">
                                  <span>{c.flag}</span>
                                  <span className="truncate">{c.name}</span>
                                </span>
                                <span className="text-slate-400 font-mono text-[11px] ml-2 shrink-0">{c.dialCode}</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="relative flex-1">
                    <input
                      id="auth-input-field"
                      type="text"
                      required
                      value={inputVal}
                      onChange={(e) => setInputVal(e.target.value)}
                      placeholder={isEmail ? "e.g. user@pewa.zm" : "e.g. 0971234567 or user@pewa.zm"}
                      className="w-full bg-white/5 border border-white/10 rounded-2xl pl-11 pr-4 py-3.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-pink-500/60 transition-all"
                    />
                    <div className="absolute left-4 top-4 text-slate-400">
                      {isEmail ? <Mail className="w-4 h-4 text-pink-400" /> : <Phone className="w-4 h-4 text-pink-400" />}
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-2 pt-1">
                <button
                  id="auth-submit-btn"
                  type="submit"
                  disabled={isSearching}
                  className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-pink-500 via-rose-500 to-red-600 font-extrabold text-sm text-white shadow-lg shadow-pink-500/30 hover:opacity-95 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
                >
                  {isSearching ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Checking credentials...</span>
                    </>
                  ) : (
                    <>
                      <span>Continue with PIN</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* SCREEN 2: PIN PROMPT FOR EXISTING USER / SUPER ADMIN */}
        {viewState === 'pin' && targetAccount && (
          <div className="bg-[#121216]/90 border border-white/10 rounded-3xl p-6 shadow-2xl text-white text-center backdrop-blur-2xl">
            <div className="relative w-20 h-20 mx-auto mb-3 rounded-3xl border-2 border-pink-500/60 p-1 bg-white/5 shadow-xl">
              <img
                src={targetAccount.avatar}
                alt={targetAccount.fullName}
                className="w-full h-full object-cover rounded-2xl"
                referrerPolicy="no-referrer"
              />
            </div>

            <div className="flex items-center justify-center gap-1.5 mb-1">
              <h3 className="text-xl font-bold">{targetAccount.fullName}</h3>
              {(targetAccount.role === 'admin' || targetAccount.role === 'superadmin' || targetAccount.uid === 'admin_main' || PEWADatabaseService.isAdminEmail(targetAccount.email)) && (
                <span title="Administrator System"><ShieldCheck className="w-5 h-5 text-amber-400" /></span>
              )}
            </div>
            <p className="text-xs text-slate-400 mb-5">
              {targetAccount.role === 'admin' || targetAccount.role === 'superadmin' || targetAccount.uid === 'admin_main' || PEWADatabaseService.isAdminEmail(targetAccount.email)
                ? 'Enter Administrator Security PIN to access Administrator Control Center'
                : 'Enter your 4-digit security PIN to unlock PEWA'}
            </p>

            {errorMessage && (
              <div className="mb-4 p-3.5 bg-rose-500/20 border border-rose-500/40 rounded-2xl text-rose-300 text-xs flex items-center justify-center gap-2 backdrop-blur-md">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            {forgotPinSuccessMsg && (
              <div className="mb-4 p-3.5 bg-emerald-500/20 border border-emerald-500/40 rounded-2xl text-emerald-300 text-xs flex items-center justify-center gap-2 backdrop-blur-md text-left">
                <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0" />
                <span>{forgotPinSuccessMsg}</span>
              </div>
            )}

            <form onSubmit={handlePinSubmit} className="space-y-4">
              <div className="relative max-w-xs mx-auto">
                {(targetAccount.role === 'admin' || targetAccount.role === 'superadmin' || targetAccount.uid === 'admin_main' || PEWADatabaseService.isAdminEmail(targetAccount.email)) ? (
                  <input
                    id="auth-pin-input"
                    type="password"
                    maxLength={20}
                    autoFocus
                    required
                    value={pinVal}
                    onChange={(e) => setPinVal(e.target.value)}
                    placeholder="Admin Security PIN"
                    className="w-full bg-white/5 border border-amber-500/60 rounded-2xl py-3.5 px-4 text-center text-xl font-mono tracking-widest text-amber-300 focus:outline-none focus:border-amber-400 shadow-inner"
                  />
                ) : (
                  <input
                    id="auth-pin-input"
                    type="password"
                    maxLength={4}
                    autoFocus
                    required
                    value={pinVal}
                    onChange={(e) => setPinVal(e.target.value.replace(/\D/g, ''))}
                    placeholder="••••"
                    className="w-full bg-white/5 border border-pink-500/50 rounded-2xl py-3.5 text-center text-2xl font-black tracking-[0.5em] text-pink-400 focus:outline-none focus:border-pink-400 shadow-inner"
                  />
                )}
              </div>

              <div className="space-y-2 pt-2">
                <div className="flex gap-2.5">
                  <button
                    type="button"
                    onClick={() => {
                      setViewState('input');
                      setPinVal('');
                      setErrorMessage('');
                      setForgotPinSuccessMsg(null);
                    }}
                    className="w-1/3 py-3 rounded-2xl bg-white/5 hover:bg-white/10 text-xs font-semibold text-slate-300 border border-white/10 transition-all"
                  >
                    Change User
                  </button>
                  <button
                    id="auth-pin-login-btn"
                    type="submit"
                    disabled={isSubmitting}
                    className="w-2/3 py-3 rounded-2xl bg-gradient-to-r from-pink-500 to-red-600 font-extrabold text-sm text-white shadow-lg shadow-pink-500/30 flex items-center justify-center gap-2 hover:opacity-95 disabled:opacity-50 transition-all"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Authenticating...</span>
                      </>
                    ) : (
                      <>
                        <Lock className="w-4 h-4" />
                        <span>Unlock PEWA</span>
                      </>
                    )}
                  </button>
                </div>

                <button
                  type="button"
                  onClick={handleForgotPinRequest}
                  disabled={isSubmittingForgotPin}
                  className="w-full py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-semibold text-pink-400 hover:text-pink-300 transition-all flex items-center justify-center gap-1.5"
                >
                  {isSubmittingForgotPin ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Submitting Reset Request...</span>
                    </>
                  ) : (
                    <>
                      <KeyRound className="w-3.5 h-3.5" />
                      <span>Forgot PIN? Request Reset</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* SCREEN 4: SETUP NEW PIN FOR EXISTING USER */}
        {viewState === 'setup_pin' && targetAccount && (
          <div className="bg-[#121216]/90 border border-white/10 rounded-3xl p-6 shadow-2xl text-white text-center backdrop-blur-2xl">
            <div className="inline-flex p-3 rounded-2xl bg-gradient-to-tr from-pink-500 to-red-600 text-white mb-3 shadow-lg shadow-pink-500/30">
              <KeyRound className="w-8 h-8" />
            </div>

            <h3 className="text-xl font-bold mb-1">Create 4-Digit PIN</h3>
            <p className="text-xs text-slate-400 mb-5">
              Set up a secure 4-digit PIN for {targetAccount.fullName} to unlock your account quickly in future sessions.
            </p>

            {errorMessage && (
              <div className="mb-4 p-3.5 bg-rose-500/20 border border-rose-500/40 rounded-2xl text-rose-300 text-xs flex items-center justify-center gap-2 backdrop-blur-md">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            <form onSubmit={handleSetupPinSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">New 4-Digit Security PIN</label>
                <input
                  type="password"
                  maxLength={4}
                  autoFocus
                  required
                  value={pinVal}
                  onChange={(e) => setPinVal(e.target.value.replace(/\D/g, ''))}
                  placeholder="••••"
                  className="w-full bg-white/5 border border-pink-500/50 rounded-2xl py-3 text-center text-xl font-black tracking-[0.5em] text-pink-400 focus:outline-none focus:border-pink-400 shadow-inner"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Confirm 4-Digit Security PIN</label>
                <input
                  type="password"
                  maxLength={4}
                  required
                  value={confirmPinVal}
                  onChange={(e) => setConfirmPinVal(e.target.value.replace(/\D/g, ''))}
                  placeholder="••••"
                  className="w-full bg-white/5 border border-pink-500/50 rounded-2xl py-3 text-center text-xl font-black tracking-[0.5em] text-pink-400 focus:outline-none focus:border-pink-400 shadow-inner"
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting || pinVal.length !== 4 || confirmPinVal.length !== 4}
                className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-pink-500 to-red-600 font-extrabold text-sm text-white shadow-lg shadow-pink-500/30 flex items-center justify-center gap-2 hover:opacity-95 disabled:opacity-50 transition-all mt-2"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Saving PIN...</span>
                  </>
                ) : (
                  <>
                    <Lock className="w-4 h-4" />
                    <span>Save PIN & Enter PEWA</span>
                  </>
                )}
              </button>
            </form>
          </div>
        )}

        {/* SCREEN 5: SIGNUP WIZARD FOR NEW USER */}
        {viewState === 'signup' && (
          <SignupWizard
            initialInput={inputVal}
            onComplete={handleSignupComplete}
            onCancel={() => setViewState('input')}
          />
        )}
      </div>
    </div>
  );
};
