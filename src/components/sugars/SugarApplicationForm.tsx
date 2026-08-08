import React, { useState } from 'react';
import { UserProfile, SugarProfile, SugarRoleType, SugarPhotos } from '../../types';
import {
  Sparkles, Camera, Check, MapPin, DollarSign, User, Heart, ShieldCheck,
  ArrowLeft, ArrowRight, Upload, Scale, Lock, ShieldAlert, FileText, CheckCircle2,
  AlertCircle, Edit3, Image as ImageIcon, Briefcase, Users, HeartHandshake
} from 'lucide-react';
import { uploadImageWithProgress } from '../../services/cloudinary';

interface SugarApplicationFormProps {
  currentUser: UserProfile;
  sugarRole: SugarRoleType;
  onSubmit: (formData: Partial<SugarProfile>) => void;
  onCancel: () => void;
}

export const SugarApplicationForm: React.FC<SugarApplicationFormProps> = ({
  currentUser,
  sugarRole,
  onSubmit,
  onCancel
}) => {
  const isProviderRole = sugarRole === 'Sugar Mama' || sugarRole === 'Sugar Daddy';

  // Wizard Step state: 1 to 7
  const [currentStep, setCurrentStep] = useState<number>(1);

  // STEP 1: Terms & Conditions State
  const [activeDocTab, setActiveDocTab] = useState<'terms' | 'privacy' | 'safety'>('terms');
  const [confirm18, setConfirm18] = useState<boolean>(false);
  const [termsAccepted, setTermsAccepted] = useState<boolean>(false);

  // STEP 2: Basic Information State
  const [fullName, setFullName] = useState<string>(currentUser.fullName || '');
  const [age, setAge] = useState<number>(currentUser.age || 21);
  const [gender, setGender] = useState<string>(currentUser.gender || (sugarRole.includes('Female') || sugarRole === 'Sugar Mama' ? 'Female' : 'Male'));
  const [country, setCountry] = useState<string>(currentUser.country || 'Zambia');
  const [city, setCity] = useState<string>(currentUser.city || 'Lusaka');
  const [area, setArea] = useState<string>(currentUser.street || 'Kabwe Road');

  // STEP 3: Relationship Preferences State
  const [relPrefs, setRelPrefs] = useState<string[]>(
    isProviderRole
      ? ['Romantic relationship', 'Long-term companionship', 'Financial support']
      : ['Financial support', 'Emotional companionship', 'Mentorship & Guidance']
  );
  const [prefAgeMin, setPrefAgeMin] = useState<number>(isProviderRole ? 20 : 35);
  const [prefAgeMax, setPrefAgeMax] = useState<number>(isProviderRole ? 32 : 65);
  const [prefHeight, setPrefHeight] = useState<string>('Any height');
  const [prefLocation, setPrefLocation] = useState<string>('Lusaka & Copperbelt');

  // STEP 4: Lifestyle State
  const [occupation, setOccupation] = useState<string>(isProviderRole ? 'Business Executive' : 'Student / Entrepreneur');
  const [employmentStatus, setEmploymentStatus] = useState<string>(isProviderRole ? 'Self-Employed' : 'Student');
  const [monthlyBudget, setMonthlyBudget] = useState<string>('K10,000 - K25,000 / month');
  const [monthlyIncome, setMonthlyIncome] = useState<string>('K3,000 - K10,000 / month');
  const [financialWilling, setFinancialWilling] = useState<boolean>(true);
  const [childrenCount, setChildrenCount] = useState<number>(0);
  const [bio, setBio] = useState<string>(
    currentUser.bio ||
      `Ambitious, respectful and outgoing ${sugarRole} looking to connect with a genuinely supportive and like-minded partner for mutually rewarding companionship.`
  );
  const [hobbies, setHobbies] = useState<string>('Fine dining, Travel, Music, Fitness');
  const [languages, setLanguages] = useState<string>('English, Bemba, Nyanja');
  const [education, setEducation] = useState<string>("Bachelor's Degree");

  // STEP 5: Photos State (Require EXACTLY 3 photos)
  const defaultFacePhoto = currentUser.avatar && currentUser.avatar.includes('http') ? currentUser.avatar : '';
  const defaultBodyPhoto = currentUser.coverImage && currentUser.coverImage.includes('http') ? currentUser.coverImage : '';
  const defaultAddPhoto = '';

  const [photos, setPhotos] = useState<{ face: string; fullBody: string; additional: string }>({
    face: defaultFacePhoto,
    fullBody: defaultBodyPhoto,
    additional: defaultAddPhoto
  });

  const [uploadingKey, setUploadingKey] = useState<'face' | 'fullBody' | 'additional' | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number>(0);

  // Toggle Relationship Preference helper
  const toggleRelPref = (pref: string) => {
    if (relPrefs.includes(pref)) {
      setRelPrefs(relPrefs.filter((p) => p !== pref));
    } else {
      setRelPrefs([...relPrefs, pref]);
    }
  };

  // Upload handler for photos
  const handleFileSelect = async (key: 'face' | 'fullBody' | 'additional', e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploadingKey(key);
      setUploadProgress(10);
      const uploadedUrl = await uploadImageWithProgress(file, (p) => setUploadProgress(p));
      setPhotos((prev) => ({ ...prev, [key]: uploadedUrl }));
      setUploadingKey(null);
      setUploadProgress(0);
    } catch (err) {
      console.error('Photo upload failed:', err);
      setUploadingKey(null);
      setUploadProgress(0);
      alert('Photo upload failed. Please try selecting a different image.');
    }
  };

  // Sample photo presets helper
  const applyPresetPhoto = (key: 'face' | 'fullBody' | 'additional', url: string) => {
    setPhotos((prev) => ({ ...prev, [key]: url }));
  };

  // Photo count checker
  const uploadedPhotosCount = [photos.face, photos.fullBody, photos.additional].filter((p) => p && p.length > 5).length;
  const isPhotosStepValid = uploadedPhotosCount === 3;

  // Submit Handler
  const handleFinalSubmit = () => {
    const applicationData: Partial<SugarProfile> = {
      active: true,
      status: 'pending', // Requires admin review
      type: sugarRole,
      relationshipPreferences: relPrefs,
      financialSupportWilling: isProviderRole ? financialWilling : undefined,
      monthlySupportBudget: isProviderRole && financialWilling ? monthlyBudget : undefined,
      monthlyIncomeRange: !isProviderRole ? monthlyIncome : undefined,
      occupation,
      employmentStatus,
      country,
      city,
      area,
      childrenCount,
      preferredPartnerAgeMin: prefAgeMin,
      preferredPartnerAgeMax: prefAgeMax,
      preferredPartnerHeight: prefHeight,
      preferredPartnerLocation: prefLocation,
      languages: languages.split(',').map((l) => l.trim()).filter(Boolean),
      educationLevel: education,
      bio,
      hobbies: hobbies.split(',').map((h) => h.trim()).filter(Boolean),
      photos,
      termsAccepted: true,
      termsAcceptedAt: Date.now()
    };

    onSubmit(applicationData);
    setCurrentStep(7); // Show success step
  };

  const getStepTitle = (step: number) => {
    switch (step) {
      case 1: return 'Terms & Conditions';
      case 2: return 'Basic Information';
      case 3: return 'Relationship Preferences';
      case 4: return 'Lifestyle & Bio';
      case 5: return 'Upload Photos (3 Required)';
      case 6: return 'Review Application';
      case 7: return 'Application Submitted';
      default: return 'Profile Setup';
    }
  };

  return (
    <div className="w-full max-w-xl mx-auto bg-[#121216] border border-amber-500/30 rounded-3xl p-4 sm:p-6 text-white shadow-2xl backdrop-blur-2xl flex flex-col max-h-[92vh] sm:max-h-[88vh] overflow-hidden animate-fadeIn">
      {/* Top Header & Progress Stepper */}
      <div className="shrink-0 border-b border-white/10 pb-3 space-y-3">
        <div className="flex items-center justify-between">
          <button
            onClick={currentStep > 1 && currentStep < 7 ? () => setCurrentStep(currentStep - 1) : onCancel}
            className="p-2 text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 rounded-full transition-colors flex items-center justify-center"
            title="Go Back"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="text-center">
            <span className="bg-gradient-to-r from-amber-400 to-amber-600 text-slate-950 text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider inline-block">
              PEWA SUGARS WIZARD
            </span>
            <h2 className="text-base sm:text-lg font-black text-amber-300">
              {getStepTitle(currentStep)}
            </h2>
          </div>
          <div className="text-xs font-mono font-bold text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-full border border-amber-500/20">
            {currentStep < 7 ? `${currentStep}/6` : 'Done'}
          </div>
        </div>

        {/* Progress Bar */}
        {currentStep <= 6 && (
          <div className="space-y-1">
            <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-amber-400 via-amber-500 to-rose-500 transition-all duration-300"
                style={{ width: `${(currentStep / 6) * 100}%` }}
              />
            </div>
            <div className="flex justify-between text-[10px] text-slate-400 font-semibold px-0.5">
              <span>Step {currentStep} of 6</span>
              <span>{Math.round((currentStep / 6) * 100)}% Completed</span>
            </div>
          </div>
        )}
      </div>

      {/* Main Step Body - Fully Scrollable without Screen Overflow */}
      <div className="flex-1 overflow-y-auto py-3 pr-1 space-y-4 text-xs scrollbar-thin scrollbar-thumb-amber-500/30">
        {/* STEP 1: TERMS & CONDITIONS */}
        {currentStep === 1 && (
          <div className="space-y-4 animate-fadeIn">
            <div className="flex items-center gap-3 p-3 bg-amber-500/10 border border-amber-500/25 rounded-2xl">
              <Scale className="w-6 h-6 text-amber-400 shrink-0" />
              <div>
                <h4 className="font-extrabold text-amber-300 text-xs">PEWA Sugars Community Governance</h4>
                <p className="text-[11px] text-slate-300">
                  PEWA Sugars is designed exclusively for consenting adults (18+) seeking genuine, mutually agreed companionship.
                </p>
              </div>
            </div>

            {/* Document Tabs */}
            <div className="flex gap-1.5 border-b border-white/10 pb-2 text-[11px]">
              <button
                type="button"
                onClick={() => setActiveDocTab('terms')}
                className={`px-3 py-1.5 rounded-xl font-bold transition-all flex items-center gap-1.5 ${
                  activeDocTab === 'terms' ? 'bg-amber-500 text-slate-950 font-black' : 'bg-white/5 text-slate-400 hover:text-white'
                }`}
              >
                <FileText className="w-3.5 h-3.5" /> Terms
              </button>
              <button
                type="button"
                onClick={() => setActiveDocTab('privacy')}
                className={`px-3 py-1.5 rounded-xl font-bold transition-all flex items-center gap-1.5 ${
                  activeDocTab === 'privacy' ? 'bg-amber-500 text-slate-950 font-black' : 'bg-white/5 text-slate-400 hover:text-white'
                }`}
              >
                <Lock className="w-3.5 h-3.5" /> Privacy
              </button>
              <button
                type="button"
                onClick={() => setActiveDocTab('safety')}
                className={`px-3 py-1.5 rounded-xl font-bold transition-all flex items-center gap-1.5 ${
                  activeDocTab === 'safety' ? 'bg-amber-500 text-slate-950 font-black' : 'bg-white/5 text-slate-400 hover:text-white'
                }`}
              >
                <ShieldAlert className="w-3.5 h-3.5" /> Safety
              </button>
            </div>

            {/* Document Text Box */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-3.5 text-slate-300 space-y-2.5 max-h-48 overflow-y-auto leading-relaxed">
              {activeDocTab === 'terms' && (
                <>
                  <h5 className="font-black text-amber-300">1. Terms of Service & Eligibility</h5>
                  <p>• <strong>Age Requirement:</strong> You must be 18+ years old. Fake age declarations result in permanent exclusion.</p>
                  <p>• <strong>Consensual Relationships:</strong> All companionship agreements must be transparent, voluntary, and respectful.</p>
                  <p>• <strong>Prohibited Acts:</strong> Harassment, extortion, illegal solicitation, or identity theft will be reported to law enforcement.</p>
                  <p>• <strong>Moderation Approval:</strong> All profiles undergo admin review before public verification.</p>
                </>
              )}
              {activeDocTab === 'privacy' && (
                <>
                  <h5 className="font-black text-amber-300">2. Privacy & Data Protection</h5>
                  <p>• <strong>Discreet Data:</strong> Contact details (phone/email/street) remain confidential and unexposed to unauthorized users.</p>
                  <p>• <strong>End-to-End Encryption:</strong> Direct chat messages are protected under PEWA security rules.</p>
                  <p>• <strong>Profile Control:</strong> You can edit or pause your Sugar profile at any time.</p>
                </>
              )}
              {activeDocTab === 'safety' && (
                <>
                  <h5 className="font-black text-amber-300">3. Safety & Meeting Guidelines</h5>
                  <p>• <strong>Public First Meetings:</strong> Always arrange first meetings in public, secure venues (restaurants/malls).</p>
                  <p>• <strong>No Advance Wire Transfers:</strong> Never send advance deposits before establishing trust in person.</p>
                  <p>• <strong>Report Misconduct:</strong> Use PEWA Safety Reporting tools if any user acts inappropriately.</p>
                </>
              )}
            </div>

            {/* Confirmation Checkboxes */}
            <div className="space-y-2 pt-1">
              <label className="flex items-start gap-2.5 cursor-pointer p-2.5 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 transition-colors">
                <input
                  type="checkbox"
                  checked={confirm18}
                  onChange={(e) => setConfirm18(e.target.checked)}
                  className="mt-0.5 accent-amber-500 w-4 h-4 rounded cursor-pointer shrink-0"
                />
                <span className="text-slate-200 text-[11px] font-medium leading-snug">
                  I confirm that I am at least <strong>18 years of age</strong> and legally eligible to register on PEWA Sugars.
                </span>
              </label>

              <label className="flex items-start gap-2.5 cursor-pointer p-2.5 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 transition-colors">
                <input
                  type="checkbox"
                  checked={termsAccepted}
                  onChange={(e) => setTermsAccepted(e.target.checked)}
                  className="mt-0.5 accent-amber-500 w-4 h-4 rounded cursor-pointer shrink-0"
                />
                <span className="text-slate-200 text-[11px] font-medium leading-snug">
                  I have read and agree to the <strong>PEWA Sugars Terms of Service, Privacy Policy & Safety Guidelines</strong>.
                </span>
              </label>
            </div>
          </div>
        )}

        {/* STEP 2: BASIC INFORMATION */}
        {currentStep === 2 && (
          <div className="space-y-3.5 animate-fadeIn">
            <div className="p-3 bg-white/5 border border-white/10 rounded-2xl space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-300 mb-1">Full Name</label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Enter your full name"
                  className="w-full bg-black/40 border border-white/15 focus:border-amber-500 rounded-xl p-2.5 text-xs text-white focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-300 mb-1">Age (18+)</label>
                  <input
                    type="number"
                    min={18}
                    max={85}
                    value={age}
                    onChange={(e) => setAge(parseInt(e.target.value) || 18)}
                    className="w-full bg-black/40 border border-white/15 focus:border-amber-500 rounded-xl p-2.5 text-xs text-white focus:outline-none font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-300 mb-1">Gender</label>
                  <select
                    value={gender}
                    onChange={(e) => setGender(e.target.value)}
                    className="w-full bg-black/40 border border-white/15 focus:border-amber-500 rounded-xl p-2.5 text-xs text-white focus:outline-none"
                  >
                    <option value="Male" className="bg-[#121216]">Male</option>
                    <option value="Female" className="bg-[#121216]">Female</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="p-3 bg-white/5 border border-white/10 rounded-2xl space-y-3">
              <h4 className="font-extrabold text-amber-300 text-xs flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5" /> Location & Residence
              </h4>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 mb-1">Country (Auto-filled)</label>
                  <input
                    type="text"
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                    className="w-full bg-black/40 border border-white/15 focus:border-amber-500 rounded-xl p-2.5 text-xs text-amber-200 font-bold focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 mb-1">City (Auto-filled)</label>
                  <input
                    type="text"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    className="w-full bg-black/40 border border-white/15 focus:border-amber-500 rounded-xl p-2.5 text-xs text-amber-200 font-bold focus:outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 mb-1">Street / Area / Neighborhood</label>
                <input
                  type="text"
                  value={area}
                  onChange={(e) => setArea(e.target.value)}
                  placeholder="e.g. Woodlands, Kabulonga, Kitwe Central"
                  className="w-full bg-black/40 border border-white/15 focus:border-amber-500 rounded-xl p-2.5 text-xs text-white focus:outline-none"
                />
              </div>
            </div>
          </div>
        )}

        {/* STEP 3: RELATIONSHIP PREFERENCES */}
        {currentStep === 3 && (
          <div className="space-y-3.5 animate-fadeIn">
            <div className="p-3 bg-white/5 border border-white/10 rounded-2xl space-y-2.5">
              <label className="block text-xs font-black text-amber-300 uppercase tracking-wider">
                Relationship Types Desired
              </label>
              <div className="flex flex-wrap gap-1.5">
                {[
                  'Financial support',
                  'Romantic relationship',
                  'Emotional companionship',
                  'Casual dating',
                  'Long-term companionship',
                  'Travel buddy',
                  'Mentorship & Guidance'
                ].map((pref) => {
                  const selected = relPrefs.includes(pref);
                  return (
                    <button
                      type="button"
                      key={pref}
                      onClick={() => toggleRelPref(pref)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                        selected
                          ? 'bg-amber-500 text-slate-950 font-black shadow-md'
                          : 'bg-black/40 text-slate-300 hover:text-white border border-white/10'
                      }`}
                    >
                      {selected && <Check className="w-3.5 h-3.5" />}
                      {pref}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="p-3 bg-white/5 border border-white/10 rounded-2xl space-y-3">
              <h4 className="font-extrabold text-amber-300 text-xs flex items-center gap-1.5">
                <HeartHandshake className="w-3.5 h-3.5" /> Preferred Partner Age Range
              </h4>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 mb-1">Minimum Age: {prefAgeMin} years</label>
                  <input
                    type="range"
                    min={18}
                    max={prefAgeMax - 1}
                    value={prefAgeMin}
                    onChange={(e) => setPrefAgeMin(parseInt(e.target.value))}
                    className="w-full accent-amber-500 cursor-pointer"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 mb-1">Maximum Age: {prefAgeMax} years</label>
                  <input
                    type="range"
                    min={prefAgeMin + 1}
                    max={80}
                    value={prefAgeMax}
                    onChange={(e) => setPrefAgeMax(parseInt(e.target.value))}
                    className="w-full accent-amber-500 cursor-pointer"
                  />
                </div>
              </div>
            </div>

            <div className="p-3 bg-white/5 border border-white/10 rounded-2xl space-y-3">
              <h4 className="font-extrabold text-amber-300 text-xs">Matching Preferences</h4>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 mb-1">Preferred Location</label>
                  <input
                    type="text"
                    value={prefLocation}
                    onChange={(e) => setPrefLocation(e.target.value)}
                    placeholder="e.g. Lusaka, Ndola, Flexible"
                    className="w-full bg-black/40 border border-white/15 focus:border-amber-500 rounded-xl p-2.5 text-xs text-white focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 mb-1">Preferred Height</label>
                  <input
                    type="text"
                    value={prefHeight}
                    onChange={(e) => setPrefHeight(e.target.value)}
                    placeholder="e.g. 170cm+, Any"
                    className="w-full bg-black/40 border border-white/15 focus:border-amber-500 rounded-xl p-2.5 text-xs text-white focus:outline-none"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* STEP 4: LIFESTYLE & BIO */}
        {currentStep === 4 && (
          <div className="space-y-3.5 animate-fadeIn">
            <div className="p-3 bg-white/5 border border-white/10 rounded-2xl space-y-3">
              <h4 className="font-extrabold text-amber-300 text-xs flex items-center gap-1.5">
                <Briefcase className="w-3.5 h-3.5" /> Employment & Finances
              </h4>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 mb-1">Occupation</label>
                  <input
                    type="text"
                    value={occupation}
                    onChange={(e) => setOccupation(e.target.value)}
                    placeholder="e.g. Entrepreneur, Engineer"
                    className="w-full bg-black/40 border border-white/15 focus:border-amber-500 rounded-xl p-2.5 text-xs text-white focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 mb-1">Employment Status</label>
                  <select
                    value={employmentStatus}
                    onChange={(e) => setEmploymentStatus(e.target.value)}
                    className="w-full bg-black/40 border border-white/15 focus:border-amber-500 rounded-xl p-2.5 text-xs text-white focus:outline-none"
                  >
                    <option value="Self-Employed" className="bg-[#121216]">Self-Employed</option>
                    <option value="Employed Full-Time" className="bg-[#121216]">Employed Full-Time</option>
                    <option value="Business Owner" className="bg-[#121216]">Business Owner</option>
                    <option value="Student" className="bg-[#121216]">Student</option>
                    <option value="Other" className="bg-[#121216]">Other</option>
                  </select>
                </div>
              </div>

              {isProviderRole ? (
                <div>
                  <label className="block text-[10px] font-bold text-amber-300 mb-1">Monthly Support Budget (ZMW)</label>
                  <select
                    value={monthlyBudget}
                    onChange={(e) => setMonthlyBudget(e.target.value)}
                    className="w-full bg-black/40 border border-amber-500/30 focus:border-amber-500 rounded-xl p-2.5 text-xs text-amber-200 font-bold focus:outline-none"
                  >
                    <option value="K5,000 - K10,000 / month" className="bg-[#121216]">K5,000 - K10,000 / month</option>
                    <option value="K10,000 - K25,000 / month" className="bg-[#121216]">K10,000 - K25,000 / month</option>
                    <option value="K25,000 - K50,000 / month" className="bg-[#121216]">K25,000 - K50,000 / month</option>
                    <option value="K50,000+ / month" className="bg-[#121216]">K50,000+ / month (VIP Allowance)</option>
                  </select>
                </div>
              ) : (
                <div>
                  <label className="block text-[10px] font-bold text-amber-300 mb-1">Monthly Income / Support Range</label>
                  <select
                    value={monthlyIncome}
                    onChange={(e) => setMonthlyIncome(e.target.value)}
                    className="w-full bg-black/40 border border-amber-500/30 focus:border-amber-500 rounded-xl p-2.5 text-xs text-amber-200 font-bold focus:outline-none"
                  >
                    <option value="Below K3,000 / month" className="bg-[#121216]">Below K3,000 / month</option>
                    <option value="K3,000 - K10,000 / month" className="bg-[#121216]">K3,000 - K10,000 / month</option>
                    <option value="K10,000 - K25,000 / month" className="bg-[#121216]">K10,000 - K25,000 / month</option>
                    <option value="Flexible / Negotiable" className="bg-[#121216]">Flexible / Negotiable</option>
                  </select>
                </div>
              )}

              <div>
                <label className="block text-[10px] font-bold text-slate-400 mb-1">Number of Children</label>
                <input
                  type="number"
                  min={0}
                  max={10}
                  value={childrenCount}
                  onChange={(e) => setChildrenCount(parseInt(e.target.value) || 0)}
                  className="w-full bg-black/40 border border-white/15 focus:border-amber-500 rounded-xl p-2.5 text-xs text-white focus:outline-none"
                />
              </div>
            </div>

            <div className="p-3 bg-white/5 border border-white/10 rounded-2xl space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-300 mb-1">Biography</label>
                <textarea
                  rows={3}
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="Tell potential matches about yourself and what you are looking for..."
                  className="w-full bg-black/40 border border-white/15 focus:border-amber-500 rounded-xl p-2.5 text-xs text-white focus:outline-none resize-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-300 mb-1">Hobbies & Interests</label>
                <input
                  type="text"
                  value={hobbies}
                  onChange={(e) => setHobbies(e.target.value)}
                  placeholder="Fine dining, Travel, Fitness, Music"
                  className="w-full bg-black/40 border border-white/15 focus:border-amber-500 rounded-xl p-2.5 text-xs text-white focus:outline-none"
                />
              </div>
            </div>
          </div>
        )}

        {/* STEP 5: UPLOAD PHOTOS (EXACTLY 3 PHOTOS REQUIRED) */}
        {currentStep === 5 && (
          <div className="space-y-4 animate-fadeIn">
            <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-2xl flex items-center justify-between">
              <div>
                <h4 className="font-extrabold text-amber-300 text-xs">Required Profile Photos</h4>
                <p className="text-[10px] text-slate-300">
                  Upload exactly 3 clear photos to complete your Sugar verification application.
                </p>
              </div>
              <div className={`px-2.5 py-1 rounded-full text-[10px] font-black ${isPhotosStepValid ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'}`}>
                {uploadedPhotosCount}/3 Ready
              </div>
            </div>

            {/* Photo Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Photo 1: Face Photo */}
              <div className={`p-3 rounded-2xl border flex flex-col justify-between space-y-2 relative transition-all ${photos.face ? 'bg-amber-500/10 border-amber-500/50' : 'bg-white/5 border-white/10'}`}>
                <div className="flex items-center justify-between">
                  <span className="font-black text-[11px] text-amber-300">1. Face Photo *</span>
                  {photos.face ? (
                    <span className="text-[9px] font-bold bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-500/30">✓ Uploaded</span>
                  ) : (
                    <span className="text-[9px] font-bold bg-rose-500/20 text-rose-300 px-2 py-0.5 rounded-full border border-rose-500/30">Required</span>
                  )}
                </div>

                <div className="relative h-36 w-full rounded-xl bg-black/50 overflow-hidden border border-white/10 flex flex-col items-center justify-center">
                  {photos.face ? (
                    <img src={photos.face} alt="Face" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    <div className="text-center p-2 text-slate-400 space-y-1">
                      <Camera className="w-6 h-6 mx-auto text-amber-400" />
                      <span className="text-[10px] font-semibold block">Upload Face Photo</span>
                    </div>
                  )}

                  {uploadingKey === 'face' && (
                    <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center p-3 text-white space-y-2">
                      <span className="text-xs font-bold text-amber-300">Uploading... {uploadProgress}%</span>
                      <div className="w-full h-1.5 bg-white/20 rounded-full overflow-hidden">
                        <div className="h-full bg-amber-500 transition-all duration-150" style={{ width: `${uploadProgress}%` }} />
                      </div>
                    </div>
                  )}
                </div>

                <label className="w-full py-2 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 rounded-xl font-bold text-[10px] cursor-pointer text-center transition-all flex items-center justify-center gap-1.5">
                  <Upload className="w-3.5 h-3.5" />
                  <span>{photos.face ? 'Change Photo' : 'Choose File'}</span>
                  <input type="file" accept="image/*" onChange={(e) => handleFileSelect('face', e)} className="hidden" />
                </label>
              </div>

              {/* Photo 2: Full Body Photo */}
              <div className={`p-3 rounded-2xl border flex flex-col justify-between space-y-2 relative transition-all ${photos.fullBody ? 'bg-amber-500/10 border-amber-500/50' : 'bg-white/5 border-white/10'}`}>
                <div className="flex items-center justify-between">
                  <span className="font-black text-[11px] text-amber-300">2. Full-Body Photo *</span>
                  {photos.fullBody ? (
                    <span className="text-[9px] font-bold bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-500/30">✓ Uploaded</span>
                  ) : (
                    <span className="text-[9px] font-bold bg-rose-500/20 text-rose-300 px-2 py-0.5 rounded-full border border-rose-500/30">Required</span>
                  )}
                </div>

                <div className="relative h-36 w-full rounded-xl bg-black/50 overflow-hidden border border-white/10 flex flex-col items-center justify-center">
                  {photos.fullBody ? (
                    <img src={photos.fullBody} alt="Full Body" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    <div className="text-center p-2 text-slate-400 space-y-1">
                      <Camera className="w-6 h-6 mx-auto text-amber-400" />
                      <span className="text-[10px] font-semibold block">Upload Full-Body</span>
                    </div>
                  )}

                  {uploadingKey === 'fullBody' && (
                    <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center p-3 text-white space-y-2">
                      <span className="text-xs font-bold text-amber-300">Uploading... {uploadProgress}%</span>
                      <div className="w-full h-1.5 bg-white/20 rounded-full overflow-hidden">
                        <div className="h-full bg-amber-500 transition-all duration-150" style={{ width: `${uploadProgress}%` }} />
                      </div>
                    </div>
                  )}
                </div>

                <label className="w-full py-2 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 rounded-xl font-bold text-[10px] cursor-pointer text-center transition-all flex items-center justify-center gap-1.5">
                  <Upload className="w-3.5 h-3.5" />
                  <span>{photos.fullBody ? 'Change Photo' : 'Choose File'}</span>
                  <input type="file" accept="image/*" onChange={(e) => handleFileSelect('fullBody', e)} className="hidden" />
                </label>
              </div>

              {/* Photo 3: Additional Photo */}
              <div className={`p-3 rounded-2xl border flex flex-col justify-between space-y-2 relative transition-all ${photos.additional ? 'bg-amber-500/10 border-amber-500/50' : 'bg-white/5 border-white/10'}`}>
                <div className="flex items-center justify-between">
                  <span className="font-black text-[11px] text-amber-300">3. Additional Photo *</span>
                  {photos.additional ? (
                    <span className="text-[9px] font-bold bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-500/30">✓ Uploaded</span>
                  ) : (
                    <span className="text-[9px] font-bold bg-rose-500/20 text-rose-300 px-2 py-0.5 rounded-full border border-rose-500/30">Required</span>
                  )}
                </div>

                <div className="relative h-36 w-full rounded-xl bg-black/50 overflow-hidden border border-white/10 flex flex-col items-center justify-center">
                  {photos.additional ? (
                    <img src={photos.additional} alt="Additional" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    <div className="text-center p-2 text-slate-400 space-y-1">
                      <Camera className="w-6 h-6 mx-auto text-amber-400" />
                      <span className="text-[10px] font-semibold block">Upload 3rd Photo</span>
                    </div>
                  )}

                  {uploadingKey === 'additional' && (
                    <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center p-3 text-white space-y-2">
                      <span className="text-xs font-bold text-amber-300">Uploading... {uploadProgress}%</span>
                      <div className="w-full h-1.5 bg-white/20 rounded-full overflow-hidden">
                        <div className="h-full bg-amber-500 transition-all duration-150" style={{ width: `${uploadProgress}%` }} />
                      </div>
                    </div>
                  )}
                </div>

                <label className="w-full py-2 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 rounded-xl font-bold text-[10px] cursor-pointer text-center transition-all flex items-center justify-center gap-1.5">
                  <Upload className="w-3.5 h-3.5" />
                  <span>{photos.additional ? 'Change Photo' : 'Choose File'}</span>
                  <input type="file" accept="image/*" onChange={(e) => handleFileSelect('additional', e)} className="hidden" />
                </label>
              </div>
            </div>

            {/* Quick Sample Presets Picker */}
            <div className="p-3 bg-white/5 border border-white/10 rounded-2xl space-y-2">
              <span className="text-[10px] font-bold text-slate-400 block">Or select sample portrait models for quick testing:</span>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {[
                  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=400&auto=format&fit=crop',
                  'https://images.unsplash.com/photo-1517841905240-472988babdf9?q=80&w=400&auto=format&fit=crop',
                  'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?q=80&w=400&auto=format&fit=crop',
                  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=400&auto=format&fit=crop',
                  'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?q=80&w=400&auto=format&fit=crop'
                ].map((presetUrl, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      if (!photos.face) applyPresetPhoto('face', presetUrl);
                      else if (!photos.fullBody) applyPresetPhoto('fullBody', presetUrl);
                      else applyPresetPhoto('additional', presetUrl);
                    }}
                    className="h-12 w-12 rounded-xl border border-white/20 overflow-hidden shrink-0 hover:scale-105 transition-transform"
                  >
                    <img src={presetUrl} alt="Sample" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* STEP 6: REVIEW APPLICATION */}
        {currentStep === 6 && (
          <div className="space-y-3.5 animate-fadeIn">
            <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-2xl">
              <h4 className="font-extrabold text-amber-300 text-xs">Review Profile Submission</h4>
              <p className="text-[10px] text-slate-300">
                Please verify your details below before submitting for Administrator review.
              </p>
            </div>

            {/* Photos Review */}
            <div className="p-3 bg-white/5 border border-white/10 rounded-2xl space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-amber-300 text-[11px] flex items-center gap-1">
                  <ImageIcon className="w-3.5 h-3.5" /> 3 Profile Photos
                </span>
                <button
                  type="button"
                  onClick={() => setCurrentStep(5)}
                  className="text-slate-400 hover:text-amber-300 text-[10px] font-bold flex items-center gap-1"
                >
                  <Edit3 className="w-3 h-3" /> Edit
                </button>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="h-20 rounded-xl overflow-hidden border border-white/10">
                  <img src={photos.face} alt="Face" className="w-full h-full object-cover" />
                </div>
                <div className="h-20 rounded-xl overflow-hidden border border-white/10">
                  <img src={photos.fullBody} alt="Full Body" className="w-full h-full object-cover" />
                </div>
                <div className="h-20 rounded-xl overflow-hidden border border-white/10">
                  <img src={photos.additional} alt="Additional" className="w-full h-full object-cover" />
                </div>
              </div>
            </div>

            {/* Basic Info Summary */}
            <div className="p-3 bg-white/5 border border-white/10 rounded-2xl space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-amber-300 text-[11px] flex items-center gap-1">
                  <User className="w-3.5 h-3.5" /> Basic Information
                </span>
                <button
                  type="button"
                  onClick={() => setCurrentStep(2)}
                  className="text-slate-400 hover:text-amber-300 text-[10px] font-bold flex items-center gap-1"
                >
                  <Edit3 className="w-3 h-3" /> Edit
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-300">
                <div><strong>Role:</strong> {sugarRole}</div>
                <div><strong>Name:</strong> {fullName}</div>
                <div><strong>Age:</strong> {age} years</div>
                <div><strong>Location:</strong> {city}, {country}</div>
              </div>
            </div>

            {/* Relationship Preferences Summary */}
            <div className="p-3 bg-white/5 border border-white/10 rounded-2xl space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-amber-300 text-[11px] flex items-center gap-1">
                  <Heart className="w-3.5 h-3.5" /> Relationship Preferences
                </span>
                <button
                  type="button"
                  onClick={() => setCurrentStep(3)}
                  className="text-slate-400 hover:text-amber-300 text-[10px] font-bold flex items-center gap-1"
                >
                  <Edit3 className="w-3 h-3" /> Edit
                </button>
              </div>
              <div className="flex flex-wrap gap-1">
                {relPrefs.map((pref) => (
                  <span key={pref} className="bg-amber-500/20 text-amber-200 border border-amber-500/30 px-2 py-0.5 rounded-lg text-[10px] font-semibold">
                    {pref}
                  </span>
                ))}
              </div>
              <div className="text-[11px] text-slate-300 pt-1">
                <strong>Preferred Age:</strong> {prefAgeMin} - {prefAgeMax} years
              </div>
            </div>

            {/* Lifestyle Summary */}
            <div className="p-3 bg-white/5 border border-white/10 rounded-2xl space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-amber-300 text-[11px] flex items-center gap-1">
                  <Briefcase className="w-3.5 h-3.5" /> Occupation & Budget
                </span>
                <button
                  type="button"
                  onClick={() => setCurrentStep(4)}
                  className="text-slate-400 hover:text-amber-300 text-[10px] font-bold flex items-center gap-1"
                >
                  <Edit3 className="w-3 h-3" /> Edit
                </button>
              </div>
              <div className="text-[11px] text-slate-300 space-y-1">
                <div><strong>Occupation:</strong> {occupation} ({employmentStatus})</div>
                <div><strong>Budget / Income:</strong> {isProviderRole ? monthlyBudget : monthlyIncome}</div>
                <div><strong>Bio:</strong> "{bio}"</div>
              </div>
            </div>
          </div>
        )}

        {/* STEP 7: SUBMISSION SUCCESS SCREEN */}
        {currentStep === 7 && (
          <div className="py-6 text-center space-y-4 animate-fadeIn">
            <div className="w-16 h-16 mx-auto rounded-full bg-gradient-to-tr from-amber-400 to-amber-600 text-slate-950 flex items-center justify-center shadow-xl shadow-amber-500/30 border border-amber-300">
              <ShieldCheck className="w-9 h-9" />
            </div>
            <div className="space-y-1">
              <h3 className="text-lg font-black text-amber-300">Application Submitted!</h3>
              <p className="text-xs text-slate-300 max-w-sm mx-auto leading-relaxed">
                Your PEWA Sugar application has been received and is currently <strong>awaiting administrator review and approval</strong>.
              </p>
            </div>
            <div className="p-3.5 bg-white/5 border border-white/10 rounded-2xl max-w-sm mx-auto text-left text-[11px] text-slate-300 space-y-1.5">
              <span className="font-extrabold text-amber-300 block mb-1">What happens next?</span>
              <p>• PEWA Verification Administrators will review your submitted photos and bio.</p>
              <p>• Once approved, your Sugar Badge and profile will go live for matching.</p>
              <p>• You can browse existing Sugar members while your review is completed.</p>
            </div>
          </div>
        )}
      </div>

      {/* Wizard Footer Controls */}
      <div className="shrink-0 border-t border-white/10 pt-3 flex items-center justify-between gap-3">
        {currentStep < 7 ? (
          <>
            <button
              type="button"
              onClick={currentStep === 1 ? onCancel : () => setCurrentStep(currentStep - 1)}
              className="py-2.5 px-4 rounded-xl bg-white/5 hover:bg-white/10 font-bold text-xs text-slate-300 transition-all"
            >
              {currentStep === 1 ? 'Cancel' : 'Previous'}
            </button>

            {currentStep === 1 && (
              <button
                type="button"
                disabled={!confirm18 || !termsAccepted}
                onClick={() => setCurrentStep(2)}
                className={`py-2.5 px-5 rounded-xl font-extrabold text-xs flex items-center gap-1.5 transition-all ${
                  confirm18 && termsAccepted
                    ? 'bg-gradient-to-r from-amber-400 to-amber-600 text-slate-950 shadow-lg shadow-amber-500/25 hover:opacity-95'
                    : 'bg-white/10 text-slate-500 cursor-not-allowed'
                }`}
              >
                <span>Accept & Continue</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            )}

            {currentStep === 2 && (
              <button
                type="button"
                disabled={!fullName.trim()}
                onClick={() => setCurrentStep(3)}
                className="py-2.5 px-5 rounded-xl bg-gradient-to-r from-amber-400 to-amber-600 font-extrabold text-xs text-slate-950 shadow-lg shadow-amber-500/25 hover:opacity-95 transition-all flex items-center gap-1.5"
              >
                <span>Next: Preferences</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            )}

            {currentStep === 3 && (
              <button
                type="button"
                onClick={() => setCurrentStep(4)}
                className="py-2.5 px-5 rounded-xl bg-gradient-to-r from-amber-400 to-amber-600 font-extrabold text-xs text-slate-950 shadow-lg shadow-amber-500/25 hover:opacity-95 transition-all flex items-center gap-1.5"
              >
                <span>Next: Lifestyle</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            )}

            {currentStep === 4 && (
              <button
                type="button"
                onClick={() => setCurrentStep(5)}
                className="py-2.5 px-5 rounded-xl bg-gradient-to-r from-amber-400 to-amber-600 font-extrabold text-xs text-slate-950 shadow-lg shadow-amber-500/25 hover:opacity-95 transition-all flex items-center gap-1.5"
              >
                <span>Next: Upload Photos</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            )}

            {currentStep === 5 && (
              <button
                type="button"
                disabled={!isPhotosStepValid}
                onClick={() => setCurrentStep(6)}
                className={`py-2.5 px-5 rounded-xl font-extrabold text-xs flex items-center gap-1.5 transition-all ${
                  isPhotosStepValid
                    ? 'bg-gradient-to-r from-amber-400 to-amber-600 text-slate-950 shadow-lg shadow-amber-500/25 hover:opacity-95'
                    : 'bg-white/10 text-slate-500 cursor-not-allowed'
                }`}
              >
                <span>{isPhotosStepValid ? 'Next: Review' : `Upload 3 Photos (${uploadedPhotosCount}/3)`}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            )}

            {currentStep === 6 && (
              <button
                type="button"
                onClick={handleFinalSubmit}
                className="py-2.5 px-6 rounded-xl bg-gradient-to-r from-amber-400 via-amber-500 to-rose-500 font-black text-xs text-slate-950 shadow-xl shadow-amber-500/30 hover:opacity-95 transition-all flex items-center gap-1.5"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Submit Profile</span>
              </button>
            )}
          </>
        ) : (
          <button
            type="button"
            onClick={onCancel}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-400 to-amber-600 font-black text-xs text-slate-950 shadow-lg shadow-amber-500/30 hover:opacity-95 transition-all"
          >
            Explore PEWA Sugars
          </button>
        )}
      </div>
    </div>
  );
};
