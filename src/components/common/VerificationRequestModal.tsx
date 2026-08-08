import React, { useState } from 'react';
import { ShieldCheck, X, FileCheck, Upload, CheckCircle2 } from 'lucide-react';
import { PEWADatabaseService } from '../../services/db';
import { uploadImageWithProgress } from '../../services/cloudinary';

interface VerificationRequestModalProps {
  userId: string;
  onClose: () => void;
  onSubmitted?: () => void;
}

export const VerificationRequestModal: React.FC<VerificationRequestModalProps> = ({
  userId,
  onClose,
  onSubmitted
}) => {
  const [docType, setDocType] = useState<'national_id' | 'passport' | 'drivers_license'>('national_id');
  const [docFile, setDocFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [success, setSuccess] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setDocFile(file);
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSubmitting(true);
      let uploadedUrl: string | undefined = undefined;

      if (docFile) {
        uploadedUrl = await uploadImageWithProgress(docFile, (p) => setUploadProgress(p));
      }

      PEWADatabaseService.submitVerificationRequest(userId, docType, uploadedUrl);
      setIsSubmitting(false);
      setSuccess(true);
      setTimeout(() => {
        if (onSubmitted) onSubmitted();
        onClose();
      }, 1500);
    } catch (err) {
      console.error('Failed to submit verification request:', err);
      // Fallback submit even if cloud upload fails
      PEWADatabaseService.submitVerificationRequest(userId, docType);
      setIsSubmitting(false);
      setSuccess(true);
      setTimeout(() => {
        if (onSubmitted) onSubmitted();
        onClose();
      }, 1500);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0a0a0b]/85 backdrop-blur-xl animate-fadeIn">
      <div className="bg-[#14141d] border border-pink-500/30 rounded-3xl max-w-sm w-full p-6 text-white space-y-4 shadow-2xl relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-all"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="text-center space-y-2">
          <div className="w-14 h-14 mx-auto rounded-full bg-pink-500/20 text-pink-400 flex items-center justify-center border border-pink-500/30">
            <ShieldCheck className="w-7 h-7" />
          </div>
          <h3 className="font-extrabold text-base">Request Account Verification</h3>
          <p className="text-xs text-slate-300">
            Submit your identification to the PEWA Administrator for instant verification approval.
          </p>
        </div>

        {success ? (
          <div className="py-8 text-center space-y-3 animate-fadeIn">
            <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto" />
            <h4 className="font-extrabold text-sm text-emerald-300">Request Submitted!</h4>
            <p className="text-xs text-slate-300">
              The Administrator will review your submission shortly.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-[11px] font-bold text-slate-400 block mb-1">Select Document Type</label>
              <select
                value={docType}
                onChange={(e) => setDocType(e.target.value as any)}
                className="w-full bg-white/5 border border-white/10 rounded-2xl p-3 text-xs text-white focus:outline-none focus:border-pink-500"
              >
                <option value="national_id" className="bg-[#14141d] text-white">National ID Card / NRC</option>
                <option value="passport" className="bg-[#14141d] text-white">International Passport</option>
                <option value="drivers_license" className="bg-[#14141d] text-white">Driver's License</option>
              </select>
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-400 block mb-1">Upload Document Photo (Optional)</label>
              <label className="flex flex-col items-center justify-center p-4 bg-white/5 border border-dashed border-white/20 rounded-2xl cursor-pointer hover:border-pink-500/60 transition-all text-center">
                {previewUrl ? (
                  <img src={previewUrl} alt="Document Preview" className="h-24 object-cover rounded-xl border border-white/10" />
                ) : (
                  <div className="space-y-1 text-slate-400">
                    <Upload className="w-6 h-6 mx-auto text-pink-400" />
                    <span className="text-xs font-semibold block">Click to select document image</span>
                    <span className="text-[10px] opacity-70 block">JPG, PNG or PDF (Max 10MB)</span>
                  </div>
                )}
                <input type="file" accept="image/*,.pdf" onChange={handleFileChange} className="hidden" />
              </label>
            </div>

            {isSubmitting && uploadProgress > 0 && (
              <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                <div className="h-full bg-pink-500 transition-all duration-300" style={{ width: `${uploadProgress}%` }} />
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3 rounded-2xl bg-gradient-to-r from-pink-500 to-red-600 font-extrabold text-xs text-white shadow-lg shadow-pink-500/30 hover:opacity-95 transition-all flex items-center justify-center gap-2"
            >
              <FileCheck className="w-4 h-4" />
              <span>{isSubmitting ? 'Submitting Request...' : 'Submit Verification Request'}</span>
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
