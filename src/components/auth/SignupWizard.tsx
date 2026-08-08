import React, { useState } from 'react';
import { Camera, ArrowRight, ArrowLeft, CheckCircle2, AlertTriangle, ShieldCheck, Loader2, Sparkles, User, Image as ImageIcon, Heart, Info, Upload } from 'lucide-react';
import { calculateAge, detectZambiaNetwork, isEmailInput } from '../../services/phone';
import { uploadImageWithProgress, DEFAULT_USER_AVATAR } from '../../services/cloudinary';
import { ImageVerificationService } from '../../services/imageVerification';
import { SugarProfile } from '../../types';

interface SignupWizardProps {
  initialInput: string;
  onComplete: (draft: any) => void;
  onCancel: () => void;
}

export const SignupWizard: React.FC<SignupWizardProps> = ({ initialInput, onComplete, onCancel }) => {
  const [step, setStep] = useState(1);
  const [errorMessage, setErrorMessage] = useState('');

  // Determine if user started with email or phone
  const startedWithEmail = isEmailInput(initialInput);

  // STEP 1: Basic Information
  const [email, setEmail] = useState(startedWithEmail ? initialInput.trim() : '');
  const [phone, setPhone] = useState(!startedWithEmail ? initialInput.trim() : '');
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [dob, setDob] = useState('2000-01-01');
  const [age, setAge] = useState(calculateAge('2000-01-01'));
  const [isUnderage, setIsUnderage] = useState(false);
  const [gender, setGender] = useState<'Male' | 'Female' | 'Other'>('Male');
  const [country, setCountry] = useState('Zambia');
  const [city, setCity] = useState('Lusaka');
  const [street, setStreet] = useState('Cairo Road');
  const [bio, setBio] = useState('');

  // STEP 2: Appearance Information
  const [height, setHeight] = useState('175 cm');
  const [hairColor, setHairColor] = useState('Dark Brown');
  const [eyeColor, setEyeColor] = useState('Brown');
  const [skinTone, setSkinTone] = useState('Medium');
  const [bodyType, setBodyType] = useState('Average');

  // STEP 3: Lifestyle & Preferences
  const [drinking, setDrinking] = useState<'Never' | 'Socially' | 'Regularly'>('Socially');
  const [smoking, setSmoking] = useState<'Never' | 'Socially' | 'Regularly'>('Never');
  const [partying, setPartying] = useState<'Never' | 'Weekends' | 'Often'>('Weekends');
  const [sexualActivity, setSexualActivity] = useState<'Low' | 'Moderate' | 'High' | 'Prefer not to say'>('Moderate');
  const [relationshipOrientation, setRelationshipOrientation] = useState('Single');
  const [personality, setPersonality] = useState<'Indoor' | 'Outdoor' | 'Balanced'>('Balanced');
  const [relationshipGoals, setRelationshipGoals] = useState('Serious Relationship');
  const [visitingPreferences, setVisitingPreferences] = useState<'Host' | 'Visit' | 'Public Places Only' | 'Flexible'>('Flexible');

  const [clubPreferencesStr, setClubPreferencesStr] = useState('Luxury lounges, Rooftop bars');
  const [hobbiesStr, setHobbiesStr] = useState('Photography, Travel, Cooking');
  const [interestsStr, setInterestsStr] = useState('Hiking, Music, Movies, Fitness');

  // Sugar Profile Opt-In
  const [optInSugar, setOptInSugar] = useState(false);
  const [sugarBio, setSugarBio] = useState('');
  const [sugarExpectation, setSugarExpectation] = useState('');

  // STEP 4: Profile Photos (5 Max: 3 Main required + 2 Additional)
  const [photosFullBody, setPhotosFullBody] = useState<string>('');
  const [photosNormalFace, setPhotosNormalFace] = useState<string>('');
  const [photosNaturalPhoto, setPhotosNaturalPhoto] = useState<string>('');
  const [photosExtra1, setPhotosExtra1] = useState<string>('');
  const [photosExtra2, setPhotosExtra2] = useState<string>('');
  const [uploadingSlot, setUploadingSlot] = useState<string | null>(null);
  const [imageVerificationError, setImageVerificationError] = useState<string | null>(null);

  // STEP 5: Security PIN & Terms
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Auto detect age on DOB change
  const handleDobChange = (value: string) => {
    setDob(value);
    const calculated = calculateAge(value);
    setAge(calculated);
    if (calculated < 18) {
      setIsUnderage(true);
      setErrorMessage('You must be at least 18 years old to join PEWA.');
    } else {
      setIsUnderage(false);
      setErrorMessage('');
    }
  };

  const handlePhotoUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    slot: 'fullBody' | 'normalFace' | 'naturalPhoto' | 'extra1' | 'extra2'
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingSlot(slot);
    setImageVerificationError(null);
    setErrorMessage('');

    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const base64Data = reader.result as string;

        // Run Anti-Filter & Image Rules Verification Check
        const verification = await ImageVerificationService.verifyImage(base64Data, 'signup_temp', slot);

        if (!verification.valid) {
          const userMsg = verification.userMessage || "Image rejected. Snapchat/face filters and heavy editing are prohibited. Please upload a natural photo.";
          setImageVerificationError(userMsg);
          setUploadingSlot(null);
          return;
        }

        // Verification passed -> Upload image
        const url = await uploadImageWithProgress(file, undefined, 'profiles/signup');

        if (slot === 'fullBody') setPhotosFullBody(url);
        if (slot === 'normalFace') setPhotosNormalFace(url);
        if (slot === 'naturalPhoto') setPhotosNaturalPhoto(url);
        if (slot === 'extra1') setPhotosExtra1(url);
        if (slot === 'extra2') setPhotosExtra2(url);

        setUploadingSlot(null);
      };
      reader.readAsDataURL(file);
    } catch (err: any) {
      console.error('[SignupWizard] Photo upload error:', err);
      setImageVerificationError('Failed to upload image. Please try again.');
      setUploadingSlot(null);
    } finally {
      e.target.value = '';
    }
  };

  const detectedNetwork = phone ? detectZambiaNetwork(phone) : '';

  // Determine sugar eligibility based on age & gender
  const isSugarBabyEligible = gender === 'Male' && age >= 20 && age <= 34;
  const isSugarMamaEligible = gender === 'Female' && age >= 45 && age <= 65;
  const isSugarEligible = isSugarBabyEligible || isSugarMamaEligible;

  const handleNextStep = () => {
    setErrorMessage('');
    setImageVerificationError(null);

    if (step === 1) {
      if (!fullName.trim()) {
        setErrorMessage('Please enter your full name.');
        return;
      }
      if (isUnderage || age < 18) {
        setErrorMessage('Access blocked: PEWA is strictly 18+ only.');
        return;
      }
      if (startedWithEmail && !phone.trim()) {
        setErrorMessage('Please provide your phone number.');
        return;
      }
      if (!startedWithEmail && !email.trim()) {
        setErrorMessage('Please provide your email address.');
        return;
      }
      if (!city.trim()) {
        setErrorMessage('Please enter your city.');
        return;
      }
      setStep(2);
    } else if (step === 2) {
      setStep(3);
    } else if (step === 3) {
      setStep(4);
    } else if (step === 4) {
      // Photo step validation: Require at least normalFace or fullBody
      if (!photosNormalFace && !photosFullBody && !photosNaturalPhoto) {
        setErrorMessage('Please upload at least 1 main natural profile photo to continue.');
        return;
      }
      setStep(5);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (pin.length !== 4 || !/^\d{4}$/.test(pin)) {
      setErrorMessage('PIN must be exactly 4 digits.');
      return;
    }
    if (pin !== confirmPin) {
      setErrorMessage('4-digit PINs do not match.');
      return;
    }
    if (!termsAccepted) {
      setErrorMessage('You must accept the Terms and Conditions to proceed.');
      return;
    }

    const primaryAvatar = photosNormalFace || photosFullBody || photosNaturalPhoto || DEFAULT_USER_AVATAR;

    const clubPrefs = clubPreferencesStr.split(',').map(s => s.trim()).filter(Boolean);
    const hobbies = hobbiesStr.split(',').map(s => s.trim()).filter(Boolean);
    const interests = interestsStr.split(',').map(s => s.trim()).filter(Boolean);

    const sugarProfile: SugarProfile = {
      isEligible: isSugarEligible,
      active: optInSugar && isSugarEligible,
      status: 'pending',
      type: isSugarMamaEligible ? 'Sugar Mama' : gender === 'Male' ? 'Sugar Baby (Male)' : 'Sugar Baby (Female)',
      relationshipPreferences: ['Emotional companionship', 'Romantic relationship'],
      bio: sugarBio || (isSugarMamaEligible ? 'Generous Sugar Mama looking for respectful baby' : 'Sugar Baby looking for a caring partner'),
      expectationOrAllowance: sugarExpectation || 'Flexible',
      preferredPerks: ['Travel', 'Fine Dining', 'Allowance'],
      termsAccepted: termsAccepted
    };

    setIsSubmitting(true);
    try {
      await onComplete({
        initialInput,
        fullName,
        username: username || fullName.toLowerCase().replace(/\s+/g, '_'),
        email,
        phone,
        dob,
        gender,
        country,
        city,
        street,
        bio: bio || `Hi there! I am ${fullName}, looking to connect on PEWA in ${city || 'Zambia'}.`,

        // Appearance Information
        height,
        hairColor,
        eyeColor,
        skinTone,
        bodyType,

        // Lifestyle & Preferences
        relationshipOrientation,
        personality,
        lifestyle: {
          drinking,
          smoking,
          partying,
          sexualActivity
        },
        clubPreferences: clubPrefs,
        partyPreferences: [partying === 'Often' ? 'Nightclubs' : 'House parties', 'Outdoor events'],
        favoriteSocialPlaces: ['Rooftop cafes', 'Lounge bars'],
        hobbies,
        interests,

        relationshipGoals,
        visitingPreferences,

        // Profile Images
        avatar: primaryAvatar,
        profilePhotos: {
          fullBody: photosFullBody,
          normalFace: photosNormalFace || primaryAvatar,
          naturalPhoto: photosNaturalPhoto,
          extra1: photosExtra1,
          extra2: photosExtra2
        },

        sugarProfile,
        pin,
        termsAccepted
      });
    } catch (err: any) {
      console.error('[SignupWizard] Registration error:', err);
      setErrorMessage(err.message || 'Registration failed. Please check your network and try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-[#121216]/95 border border-white/10 rounded-2xl sm:rounded-3xl p-3.5 sm:p-6 shadow-2xl text-white backdrop-blur-2xl max-w-lg w-full mx-auto max-h-[88vh] overflow-y-auto box-border flex flex-col my-auto overflow-x-hidden">
      {/* Header Stepper */}
      <div className="flex items-center justify-between border-b border-white/10 pb-3.5 mb-4">
        <div>
          <h2 className="text-xl font-extrabold bg-gradient-to-r from-pink-400 to-rose-500 bg-clip-text text-transparent">
            Create Complete Profile
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Step {step} of 5 – {
              step === 1 ? 'Basic Details' :
              step === 2 ? 'Appearance' :
              step === 3 ? 'Lifestyle & Interests' :
              step === 4 ? 'Natural Profile Photos' :
              'Security PIN & Terms'
            }
          </p>
        </div>
        <div className="flex gap-1.5">
          {[1, 2, 3, 4, 5].map((s) => (
            <div
              key={s}
              className={`w-2.5 h-2.5 rounded-full transition-all ${
                s === step ? 'bg-gradient-to-r from-pink-500 to-red-600 w-5' : s < step ? 'bg-pink-500/60' : 'bg-white/10'
              }`}
            />
          ))}
        </div>
      </div>

      {errorMessage && (
        <div className="mb-4 p-3 bg-rose-500/20 border border-rose-500/40 rounded-2xl text-rose-300 text-xs flex items-center gap-2 backdrop-blur-md">
          <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
          <span>{errorMessage}</span>
        </div>
      )}

      {imageVerificationError && (
        <div className="mb-4 p-3 bg-rose-500/20 border border-rose-500/40 rounded-2xl text-rose-300 text-xs flex items-center gap-2 backdrop-blur-md">
          <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
          <span>{imageVerificationError}</span>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        {/* STEP 1: Basic Information */}
        {step === 1 && (
          <div className="space-y-3.5 animate-fadeIn">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Full Name *</label>
              <input
                id="signup-fullname"
                type="text"
                required
                value={fullName}
                onChange={(e) => {
                  setFullName(e.target.value);
                  if (!username) {
                    setUsername(e.target.value.toLowerCase().replace(/\s+/g, '_'));
                  }
                }}
                placeholder="e.g. Mulenga Chisha"
                className="w-full bg-white/5 border border-white/10 rounded-2xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-pink-500/60 text-white transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Username / User ID *</label>
              <input
                id="signup-username"
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                placeholder="e.g. mulenga_chisha"
                className="w-full bg-white/5 border border-white/10 rounded-2xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-pink-500/60 text-white transition-all"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Date of Birth *</label>
                <input
                  id="signup-dob"
                  type="date"
                  required
                  value={dob}
                  onChange={(e) => handleDobChange(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-2xl px-3 py-2 text-xs focus:outline-none focus:border-pink-500/60 text-white transition-all"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Calculated Age</label>
                <div className={`w-full bg-white/5 border rounded-2xl px-3 py-2 text-xs font-bold flex items-center justify-between ${
                  isUnderage ? 'border-rose-500/60 text-rose-400' : 'border-white/10 text-emerald-400'
                }`}>
                  <span>{age} yrs</span>
                  {isUnderage ? (
                    <span className="text-[9px] uppercase font-bold text-rose-400 bg-rose-500/20 px-1.5 py-0.5 rounded">
                      Blocked
                    </span>
                  ) : (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  )}
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Gender *</label>
              <div className="grid grid-cols-3 gap-2">
                {(['Male', 'Female', 'Other'] as const).map((g) => (
                  <button
                    type="button"
                    key={g}
                    onClick={() => setGender(g)}
                    className={`py-2 rounded-xl text-xs font-semibold border transition-all ${
                      gender === g
                        ? 'bg-gradient-to-r from-pink-500 to-red-600 border-pink-500/60 text-white shadow-md'
                        : 'bg-white/5 border-white/10 text-slate-400 hover:border-white/20'
                    }`}
                  >
                    {g}
                  </button>
                ))}
              </div>
            </div>

            {startedWithEmail ? (
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Phone Number *</label>
                <input
                  id="signup-phone"
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="e.g. 0971234567 or +260971234567"
                  className="w-full bg-white/5 border border-white/10 rounded-2xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-pink-500/60 text-white transition-all"
                />
                {detectedNetwork && (
                  <p className="text-[11px] text-pink-400 mt-1 font-medium">
                    Network: <span className="font-bold text-pink-300">{detectedNetwork}</span>
                  </p>
                )}
              </div>
            ) : (
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Email Address *</label>
                <input
                  id="signup-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="e.g. mulenga@example.zm"
                  className="w-full bg-white/5 border border-white/10 rounded-2xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-pink-500/60 text-white transition-all"
                />
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Country</label>
                <input
                  type="text"
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-2xl px-3 py-2 text-xs text-white focus:outline-none focus:border-pink-500/60 transition-all"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">City *</label>
                <input
                  type="text"
                  required
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="e.g. Lusaka, Ndola, Kitwe"
                  className="w-full bg-white/5 border border-white/10 rounded-2xl px-3 py-2 text-xs text-white focus:outline-none focus:border-pink-500/60 transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Short Bio</label>
              <textarea
                rows={2}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Tell others a little about yourself..."
                className="w-full bg-white/5 border border-white/10 rounded-2xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-pink-500/60 transition-all resize-none"
              />
            </div>

            <button
              type="button"
              onClick={handleNextStep}
              className="w-full py-3 mt-2 rounded-2xl bg-gradient-to-r from-pink-500 to-red-600 font-bold text-xs text-white shadow-lg shadow-pink-500/30 hover:opacity-95 flex items-center justify-center gap-2 transition-all"
            >
              <span>Continue to Appearance (Step 2)</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* STEP 2: Appearance Information */}
        {step === 2 && (
          <div className="space-y-3.5 animate-fadeIn">
            <h3 className="text-xs font-bold text-pink-400 uppercase tracking-wider">Appearance Information</h3>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Height</label>
              <select
                value={height}
                onChange={(e) => setHeight(e.target.value)}
                className="w-full bg-[#121216] border border-white/10 rounded-2xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-pink-500/60 transition-all"
              >
                {['150 cm', '155 cm', '160 cm', '165 cm', '170 cm', '175 cm', '180 cm', '185 cm', '190 cm+'].map((h) => (
                  <option key={h} value={h}>{h}</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Hair Color</label>
                <select
                  value={hairColor}
                  onChange={(e) => setHairColor(e.target.value)}
                  className="w-full bg-[#121216] border border-white/10 rounded-2xl px-3 py-2 text-xs text-white focus:outline-none focus:border-pink-500/60 transition-all"
                >
                  {['Black', 'Dark Brown', 'Light Brown', 'Blonde', 'Red', 'Dark', 'Other'].map((hc) => (
                    <option key={hc} value={hc}>{hc}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Eye Color</label>
                <select
                  value={eyeColor}
                  onChange={(e) => setEyeColor(e.target.value)}
                  className="w-full bg-[#121216] border border-white/10 rounded-2xl px-3 py-2 text-xs text-white focus:outline-none focus:border-pink-500/60 transition-all"
                >
                  {['Brown', 'Dark Brown', 'Blue', 'Hazel', 'Green', 'Dark', 'Other'].map((ec) => (
                    <option key={ec} value={ec}>{ec}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Skin Tone</label>
                <select
                  value={skinTone}
                  onChange={(e) => setSkinTone(e.target.value)}
                  className="w-full bg-[#121216] border border-white/10 rounded-2xl px-3 py-2 text-xs text-white focus:outline-none focus:border-pink-500/60 transition-all"
                >
                  {['Light', 'Fair', 'Medium', 'Olive', 'Tan', 'Dark', 'Deep Dark'].map((st) => (
                    <option key={st} value={st}>{st}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Body Type</label>
                <select
                  value={bodyType}
                  onChange={(e) => setBodyType(e.target.value)}
                  className="w-full bg-[#121216] border border-white/10 rounded-2xl px-3 py-2 text-xs text-white focus:outline-none focus:border-pink-500/60 transition-all"
                >
                  {['Slim', 'Athletic', 'Average', 'Curvy', 'Muscular', 'Plus Size'].map((bt) => (
                    <option key={bt} value={bt}>{bt}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex gap-3 pt-3">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="w-1/3 py-2.5 rounded-2xl bg-white/5 hover:bg-white/10 font-semibold text-xs text-slate-300 border border-white/10 flex items-center justify-center gap-1 transition-all"
              >
                <ArrowLeft className="w-4 h-4" /> Back
              </button>
              <button
                type="button"
                onClick={handleNextStep}
                className="w-2/3 py-2.5 rounded-2xl bg-gradient-to-r from-pink-500 to-red-600 font-bold text-xs text-white shadow-lg shadow-pink-500/30 flex items-center justify-center gap-2 hover:opacity-95 transition-all"
              >
                <span>Continue to Lifestyle (Step 3)</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: Lifestyle & Preferences */}
        {step === 3 && (
          <div className="space-y-3 animate-fadeIn">
            <h3 className="text-xs font-bold text-pink-400 uppercase tracking-wider">Lifestyle & Preferences</h3>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block text-slate-300 mb-1 font-semibold">Drinking Preference</label>
                <select
                  value={drinking}
                  onChange={(e) => setDrinking(e.target.value as any)}
                  className="w-full bg-[#121216] border border-white/10 rounded-2xl px-3 py-2 text-white focus:outline-none focus:border-pink-500/60 transition-all"
                >
                  <option value="Never">Never</option>
                  <option value="Socially">Socially</option>
                  <option value="Regularly">Regularly</option>
                </select>
              </div>
              <div>
                <label className="block text-slate-300 mb-1 font-semibold">Smoking Preference</label>
                <select
                  value={smoking}
                  onChange={(e) => setSmoking(e.target.value as any)}
                  className="w-full bg-[#121216] border border-white/10 rounded-2xl px-3 py-2 text-white focus:outline-none focus:border-pink-500/60 transition-all"
                >
                  <option value="Never">Never</option>
                  <option value="Socially">Socially</option>
                  <option value="Regularly">Regularly</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block text-slate-300 mb-1 font-semibold">Relationship Status</label>
                <select
                  value={relationshipOrientation}
                  onChange={(e) => setRelationshipOrientation(e.target.value)}
                  className="w-full bg-[#121216] border border-white/10 rounded-2xl px-3 py-2 text-white focus:outline-none focus:border-pink-500/60 transition-all"
                >
                  <option value="Single">Single</option>
                  <option value="Dating">Dating & Exploring</option>
                  <option value="Looking for Marriage">Looking for Marriage</option>
                  <option value="Open Relationship">Open Relationship</option>
                </select>
              </div>
              <div>
                <label className="block text-slate-300 mb-1 font-semibold">Party Preference</label>
                <select
                  value={partying}
                  onChange={(e) => setPartying(e.target.value as any)}
                  className="w-full bg-[#121216] border border-white/10 rounded-2xl px-3 py-2 text-white focus:outline-none focus:border-pink-500/60 transition-all"
                >
                  <option value="Never">Never</option>
                  <option value="Weekends">Weekends</option>
                  <option value="Often">Often</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Club & Hangout Preferences</label>
              <input
                type="text"
                value={clubPreferencesStr}
                onChange={(e) => setClubPreferencesStr(e.target.value)}
                placeholder="e.g. Luxury lounges, Rooftop bars, Chill spots"
                className="w-full bg-white/5 border border-white/10 rounded-2xl px-3 py-2 text-xs text-white focus:outline-none focus:border-pink-500/60 transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Hobbies (comma separated)</label>
              <input
                type="text"
                value={hobbiesStr}
                onChange={(e) => setHobbiesStr(e.target.value)}
                placeholder="e.g. Photography, Cooking, Travel, Music"
                className="w-full bg-white/5 border border-white/10 rounded-2xl px-3 py-2 text-xs text-white focus:outline-none focus:border-pink-500/60 transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Interests (comma separated)</label>
              <input
                type="text"
                value={interestsStr}
                onChange={(e) => setInterestsStr(e.target.value)}
                placeholder="e.g. Hiking, Fitness, Movies, Fashion"
                className="w-full bg-white/5 border border-white/10 rounded-2xl px-3 py-2 text-xs text-white focus:outline-none focus:border-pink-500/60 transition-all"
              />
            </div>

            {/* SUGAR SEARCH ELIGIBILITY SECTION */}
            {isSugarEligible && (
              <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-2xl space-y-2 backdrop-blur-md">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-amber-300 flex items-center gap-1">
                    <ShieldCheck className="w-4 h-4 text-amber-400" />
                    Eligible for Sugar Search ({isSugarMamaEligible ? 'Sugar Mama 45-65' : 'Sugar Baby 20-34'})
                  </span>
                  <input
                    type="checkbox"
                    checked={optInSugar}
                    onChange={(e) => setOptInSugar(e.target.checked)}
                    className="w-4 h-4 accent-amber-500 rounded cursor-pointer"
                  />
                </div>
                {optInSugar && (
                  <div className="space-y-2 pt-1 text-xs">
                    <input
                      type="text"
                      placeholder={isSugarMamaEligible ? "Sugar Mama Bio / Expectations" : "Sugar Baby Bio / Goals"}
                      value={sugarBio}
                      onChange={(e) => setSugarBio(e.target.value)}
                      className="w-full bg-white/5 border border-amber-500/30 rounded-xl px-3 py-1.5 text-white focus:outline-none focus:border-amber-400/60 text-xs"
                    />
                    <input
                      type="text"
                      placeholder="Monthly Expectation / Allowance terms"
                      value={sugarExpectation}
                      onChange={(e) => setSugarExpectation(e.target.value)}
                      className="w-full bg-white/5 border border-amber-500/30 rounded-xl px-3 py-1.5 text-white focus:outline-none focus:border-amber-400/60 text-xs"
                    />
                  </div>
                )}
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="w-1/3 py-2.5 rounded-2xl bg-white/5 hover:bg-white/10 font-semibold text-xs text-slate-300 border border-white/10 flex items-center justify-center gap-1 transition-all"
              >
                <ArrowLeft className="w-4 h-4" /> Back
              </button>
              <button
                type="button"
                onClick={handleNextStep}
                className="w-2/3 py-2.5 rounded-2xl bg-gradient-to-r from-pink-500 to-red-600 font-bold text-xs text-white shadow-lg shadow-pink-500/30 flex items-center justify-center gap-2 hover:opacity-95 transition-all"
              >
                <span>Continue to Photos (Step 4)</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 4: Profile Image Upload & Filter Verification */}
        {step === 4 && (
          <div className="space-y-3 animate-fadeIn">
            <div>
              <h3 className="text-xs font-bold text-pink-400 uppercase tracking-wider flex items-center gap-1.5">
                <ImageIcon className="w-4 h-4 text-pink-400" />
                Upload Natural Profile Photos (Up to 5)
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Upload up to 5 natural photos. Snapchat filters, heavy face editing, or AI generated images are automatically rejected.
              </p>
            </div>

            {/* Grid of 5 Photo Slots */}
            <div className="grid grid-cols-3 gap-2.5">
              {[
                { slot: 'normalFace', label: 'Main Face *', photo: photosNormalFace },
                { slot: 'fullBody', label: 'Full Body *', photo: photosFullBody },
                { slot: 'naturalPhoto', label: 'Natural Photo *', photo: photosNaturalPhoto },
                { slot: 'extra1', label: 'Extra 1', photo: photosExtra1 },
                { slot: 'extra2', label: 'Extra 2', photo: photosExtra2 },
              ].map(({ slot, label, photo }) => (
                <div key={slot} className="relative aspect-[4/5] bg-white/5 border border-white/10 rounded-2xl overflow-hidden flex flex-col items-center justify-center group">
                  {photo ? (
                    <>
                      <img src={photo} alt={label} className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => {
                          if (slot === 'normalFace') setPhotosNormalFace('');
                          if (slot === 'fullBody') setPhotosFullBody('');
                          if (slot === 'naturalPhoto') setPhotosNaturalPhoto('');
                          if (slot === 'extra1') setPhotosExtra1('');
                          if (slot === 'extra2') setPhotosExtra2('');
                        }}
                        className="absolute top-1 right-1 p-1 bg-black/60 text-white rounded-full hover:bg-rose-600 transition-colors"
                        title="Remove photo"
                      >
                        ×
                      </button>
                    </>
                  ) : (
                    <label className="w-full h-full flex flex-col items-center justify-center p-2 cursor-pointer hover:bg-white/10 transition-colors text-center">
                      {uploadingSlot === slot ? (
                        <Loader2 className="w-5 h-5 animate-spin text-pink-400" />
                      ) : (
                        <>
                          <Camera className="w-5 h-5 text-pink-400 mb-1" />
                          <span className="text-[10px] font-semibold text-slate-300">{label}</span>
                          <span className="text-[9px] text-slate-500 mt-0.5">Upload</span>
                        </>
                      )}
                      <input
                        type="file"
                        accept="image/*"
                        disabled={uploadingSlot !== null}
                        onChange={(e) => handlePhotoUpload(e, slot as any)}
                        className="hidden"
                      />
                    </label>
                  )}
                </div>
              ))}
            </div>

            <div className="p-2.5 bg-pink-500/10 border border-pink-500/20 rounded-xl text-[11px] text-pink-300 flex items-start gap-2">
              <Info className="w-4 h-4 text-pink-400 shrink-0 mt-0.5" />
              <span>
                <strong>Image Verification Rule:</strong> Photos are automatically scanned for Snapchat/face filters and heavy editing. Only clear, natural photos are approved.
              </span>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setStep(3)}
                className="w-1/3 py-2.5 rounded-2xl bg-white/5 hover:bg-white/10 font-semibold text-xs text-slate-300 border border-white/10 flex items-center justify-center gap-1 transition-all"
              >
                <ArrowLeft className="w-4 h-4" /> Back
              </button>
              <button
                type="button"
                onClick={handleNextStep}
                className="w-2/3 py-2.5 rounded-2xl bg-gradient-to-r from-pink-500 to-red-600 font-bold text-xs text-white shadow-lg shadow-pink-500/30 flex items-center justify-center gap-2 hover:opacity-95 transition-all"
              >
                <span>Continue to Security PIN (Step 5)</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 5: Create PIN & Accept Terms */}
        {step === 5 && (
          <div className="space-y-3.5 animate-fadeIn">
            <h3 className="text-xs font-bold text-pink-400 uppercase tracking-wider">Create 4-Digit Security PIN & Accept Terms</h3>
            <p className="text-xs text-slate-400">
              Set a 4-digit PIN to securely unlock your PEWA profile in future sessions.
            </p>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Create PIN *</label>
                <input
                  id="signup-pin"
                  type="password"
                  maxLength={4}
                  required
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                  placeholder="••••"
                  className="w-full bg-white/5 border border-white/10 rounded-2xl px-3 py-2.5 text-center text-lg tracking-[0.4em] font-extrabold text-white focus:outline-none focus:border-pink-500/60 transition-all"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Confirm PIN *</label>
                <input
                  id="signup-confirm-pin"
                  type="password"
                  maxLength={4}
                  required
                  value={confirmPin}
                  onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ''))}
                  placeholder="••••"
                  className="w-full bg-white/5 border border-white/10 rounded-2xl px-3 py-2.5 text-center text-lg tracking-[0.4em] font-extrabold text-white focus:outline-none focus:border-pink-500/60 transition-all"
                />
              </div>
            </div>

            <div className="p-3 bg-white/5 border border-white/10 rounded-2xl flex items-start gap-2.5 text-xs backdrop-blur-md">
              <input
                id="signup-terms"
                type="checkbox"
                required
                checked={termsAccepted}
                onChange={(e) => setTermsAccepted(e.target.checked)}
                className="w-4 h-4 mt-0.5 accent-pink-500 rounded cursor-pointer shrink-0"
              />
              <label htmlFor="signup-terms" className="text-slate-300 leading-relaxed cursor-pointer text-xs font-medium">
                I accept the <span className="font-bold text-pink-400">PEWA Terms & Community Guidelines</span>. I confirm I am 18+ years old and all provided profile details and photos are authentic.
              </label>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setStep(4)}
                className="w-1/3 py-3 rounded-2xl bg-white/5 hover:bg-white/10 font-semibold text-xs text-slate-300 border border-white/10 flex items-center justify-center gap-1 transition-all"
              >
                <ArrowLeft className="w-4 h-4" /> Back
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-2/3 py-3 rounded-2xl bg-gradient-to-r from-pink-500 via-rose-500 to-red-600 font-extrabold text-xs text-white shadow-xl shadow-pink-500/30 hover:opacity-95 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Creating Complete Profile...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Complete Profile & Enter PEWA</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </form>
    </div>
  );
};
