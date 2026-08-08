import React, { useState, useEffect, useRef } from 'react';
import {
  Mic, Square, Pause, Play, RotateCcw, X, Check, Lock, Wand2, Scissors, Music, Sparkles, Volume2, ShieldCheck, AlertCircle
} from 'lucide-react';
import { UserProfile } from '../../types';
import { sliceAudioBuffer, processAudioWithEffect, audioBufferToWavBlob } from '../../utils/audioProcessor';
import { PEWADatabaseService } from '../../services/db';

interface VoiceRecorderModalProps {
  currentUser: UserProfile;
  onSendVoice: (audioBlob: Blob, duration: number, voiceTitle?: string, effectUsed?: string) => void;
  onClose: () => void;
  onRequestVerification?: () => void;
}

export type VoiceEffectType = 'normal' | 'deep' | 'soft' | 'studio' | 'echo' | 'bass_boost' | 'treble_boost' | 'radio';

const VOICE_EFFECTS: { id: VoiceEffectType; name: string; icon: string; desc: string }[] = [
  { id: 'normal', name: 'Original', icon: '🎙️', desc: 'Natural sound' },
  { id: 'deep', name: 'Deep Voice', icon: '🎙️', desc: 'Lower pitch & heavy resonance' },
  { id: 'soft', name: 'Soft Voice', icon: '☁️', desc: 'Smooth, high-pass tone' },
  { id: 'studio', name: 'Studio Voice', icon: '🎧', desc: 'Pro compressed & polished' },
  { id: 'echo', name: 'Echo', icon: '🌊', desc: 'Atmospheric delay effect' },
  { id: 'bass_boost', name: 'Bass Boost', icon: '🔊', desc: 'Amplified low-end frequencies' },
  { id: 'treble_boost', name: 'Treble Boost', icon: '✨', desc: 'Crisp, high-end emphasis' },
  { id: 'radio', name: 'Radio Effect', icon: '📻', desc: 'Retro walkie-talkie / telephone' }
];

export const VoiceRecorderModal: React.FC<VoiceRecorderModalProps> = ({
  currentUser,
  onSendVoice,
  onClose,
  onRequestVerification
}) => {
  // Step: 'recording' | 'preview'
  const [step, setStep] = useState<'recording' | 'preview'>('recording');

  // Recording State
  const [isRecording, setIsRecording] = useState(true);
  const [isPaused, setIsPaused] = useState(false);
  const [duration, setDuration] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [waveformBars, setWaveformBars] = useState<number[]>(new Array(24).fill(15));

  // Audio Context & Recorder refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerIntervalRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Preview & Editing State
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioBuffer, setAudioBuffer] = useState<AudioBuffer | null>(null);
  const [originalBuffer, setOriginalBuffer] = useState<AudioBuffer | null>(null);
  const [isPlayingPreview, setIsPlayingPreview] = useState(false);
  const [previewProgress, setPreviewProgress] = useState(0);
  const [voiceTitle, setVoiceTitle] = useState('Voice Message');
  const [selectedEffect, setSelectedEffect] = useState<VoiceEffectType>('normal');

  // Trimming state
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(0);
  const [isEditingActive, setIsEditingActive] = useState(false);
  const [voiceEditsUsed, setVoiceEditsUsed] = useState<number>(() => (currentUser as any).voiceEditsUsed || 0);

  // Lock/Verification Modals & Errors
  const [showVerificationModal, setShowVerificationModal] = useState<string | null>(null);
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const previewAudioRef = useRef<HTMLAudioElement | null>(null);

  // START RECORDING ON MOUNT
  useEffect(() => {
    startRecordingProcess();
    return () => {
      cleanupAudio();
    };
  }, []);

  const cleanupAudio = () => {
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close().catch(() => {});
    }
  };

  const startRecordingProcess = async () => {
    setPermissionError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      // WebAudio Analyser for Waveform
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const audioCtx = new AudioCtx();
      audioContextRef.current = audioCtx;
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 64;
      source.connect(analyser);
      analyserRef.current = analyser;

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        setAudioBlob(blob);
        await preparePreview(blob);
      };

      mediaRecorder.start(100);
      setIsRecording(true);
      setIsPaused(false);
      setDuration(0);

      // Timer
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = setInterval(() => {
        setDuration((prev) => prev + 1);
      }, 1000);

      // Waveform Loop
      const updateWaveform = () => {
        if (analyserRef.current) {
          const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
          analyserRef.current.getByteFrequencyData(dataArray);

          const bars = Array.from({ length: 24 }).map((_, i) => {
            const val = dataArray[i % dataArray.length] || 10;
            return Math.max(12, Math.min(80, (val / 255) * 100));
          });
          setWaveformBars(bars);
        }
        animFrameRef.current = requestAnimationFrame(updateWaveform);
      };
      updateWaveform();
    } catch (err: any) {
      console.warn('Failed to start audio recorder:', err);
      setPermissionError(
        'Microphone access is required to record voice notes. Please grant microphone permission in your browser and try again.'
      );
    }
  };

  const preparePreview = async (blob: Blob) => {
    try {
      setIsProcessing(true);
      const arrayBuffer = await blob.arrayBuffer();
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const tempCtx = new AudioCtx();
      const decodedBuffer = await tempCtx.decodeAudioData(arrayBuffer);

      setOriginalBuffer(decodedBuffer);
      setAudioBuffer(decodedBuffer);
      setTrimStart(0);
      setTrimEnd(decodedBuffer.duration);

      const url = URL.createObjectURL(blob);
      setAudioUrl(url);
      setStep('preview');
      setIsProcessing(false);

      if (tempCtx.state !== 'closed') {
        tempCtx.close().catch(() => {});
      }
    } catch (e) {
      console.error('Error preparing audio preview:', e);
      setIsProcessing(false);
      setStep('preview');
    }
  };

  // CONTROL ACTIONS
  const handlePauseRecording = () => {
    if (mediaRecorderRef.current && isRecording && !isPaused) {
      mediaRecorderRef.current.pause();
      setIsPaused(true);
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    }
  };

  const handleResumeRecording = () => {
    if (mediaRecorderRef.current && isRecording && isPaused) {
      mediaRecorderRef.current.resume();
      setIsPaused(false);
      timerIntervalRef.current = setInterval(() => {
        setDuration((prev) => prev + 1);
      }, 1000);
    }
  };

  const handleCancelRecording = () => {
    cleanupAudio();
    onClose();
  };

  const handleRestartRecording = () => {
    cleanupAudio();
    startRecordingProcess();
  };

  const handleFinishRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      cleanupAudio();
    }
  };

  // PREVIEW PLAYBACK
  const handleTogglePreviewPlay = () => {
    if (!previewAudioRef.current) return;
    if (isPlayingPreview) {
      previewAudioRef.current.pause();
      setIsPlayingPreview(false);
    } else {
      previewAudioRef.current.play();
      setIsPlayingPreview(true);
    }
  };

  // EFFECT SELECTION (Verification check)
  const handleSelectEffect = async (effectId: VoiceEffectType) => {
    if (effectId !== 'normal' && !currentUser.verified) {
      setShowVerificationModal(
        'Voice Effects are exclusively available to verified accounts. Get verified to unlock all premium audio filters!'
      );
      return;
    }

    setSelectedEffect(effectId);
    if (!originalBuffer) return;

    try {
      setIsProcessing(true);
      let targetBuffer = originalBuffer;

      // Apply trimming first if active
      if (trimEnd > trimStart && (trimStart > 0 || trimEnd < originalBuffer.duration)) {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        const ctx = new AudioCtx();
        targetBuffer = sliceAudioBuffer(ctx, originalBuffer, trimStart, trimEnd);
        ctx.close().catch(() => {});
      }

      // Apply Voice Effect
      const processed = await processAudioWithEffect(targetBuffer, effectId);
      setAudioBuffer(processed);

      const wavBlob = audioBufferToWavBlob(processed);
      const url = URL.createObjectURL(wavBlob);
      setAudioUrl(url);
      setIsProcessing(false);
    } catch (e) {
      console.error('Error applying voice effect:', e);
      setIsProcessing(false);
    }
  };

  // TRIMMING / EDITING (Limits check: 2 free edits for unverified)
  const handleApplyTrim = async () => {
    if (!currentUser.verified && voiceEditsUsed >= 2) {
      setShowVerificationModal(
        'You have used your 2 free voice edits! Account verification unlocks unlimited voice editing.'
      );
      return;
    }

    if (!originalBuffer) return;

    try {
      setIsProcessing(true);
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioCtx();
      const sliced = sliceAudioBuffer(ctx, originalBuffer, trimStart, trimEnd);
      ctx.close().catch(() => {});

      const processed = await processAudioWithEffect(sliced, selectedEffect);
      setAudioBuffer(processed);

      const wavBlob = audioBufferToWavBlob(processed);
      const url = URL.createObjectURL(wavBlob);
      setAudioUrl(url);

      // Increment edits count for unverified users
      if (!currentUser.verified) {
        const newCount = voiceEditsUsed + 1;
        setVoiceEditsUsed(newCount);
        PEWADatabaseService.updateUserProfile(currentUser.uid, {
          ...(currentUser as any),
          voiceEditsUsed: newCount
        } as any);
      }

      setIsEditingActive(false);
      setIsProcessing(false);
    } catch (e) {
      console.error('Error applying trim:', e);
      setIsProcessing(false);
    }
  };

  // SEND VOICE NOTE
  const handleConfirmSend = async () => {
    try {
      setIsProcessing(true);
      let finalBlob = audioBlob;
      let finalDuration = duration;

      if (audioBuffer) {
        finalBlob = audioBufferToWavBlob(audioBuffer);
        finalDuration = Math.round(audioBuffer.duration);
      } else if (!finalBlob) {
        finalBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
      }

      onSendVoice(
        finalBlob,
        finalDuration || 1,
        voiceTitle.trim() || 'Voice Message',
        selectedEffect !== 'normal' ? selectedEffect : undefined
      );
      onClose();
    } catch (e) {
      console.error('Error confirming send voice:', e);
      onClose();
    }
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0a0a0b]/85 backdrop-blur-xl animate-fadeIn"
      onClick={(e) => e.stopPropagation()}
    >
      <div
        className="bg-[#14141d] border border-white/10 rounded-3xl max-w-md w-full p-6 text-white shadow-2xl relative space-y-5 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header */}
        <div className="flex items-center justify-between pb-3 border-b border-white/10">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-pink-500/20 text-pink-400 border border-pink-500/30">
              <Mic className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm">
                {permissionError ? 'Microphone Permission Required' : step === 'recording' ? 'Voice Recorder' : 'Voice Message Preview'}
              </h3>
              <p className="text-[11px] text-slate-400">
                {permissionError ? 'Permission required to record' : step === 'recording' ? (isPaused ? 'Recording Paused' : 'Recording audio...') : 'Review, edit or apply voice effects'}
              </p>
            </div>
          </div>
          <button
            onClick={handleCancelRecording}
            className="p-2 rounded-full bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-all"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* PERMISSION ERROR SCREEN */}
        {permissionError ? (
          <div className="space-y-4 py-4 text-center">
            <div className="w-14 h-14 mx-auto rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center">
              <AlertCircle className="w-7 h-7" />
            </div>
            <div className="space-y-1">
              <h4 className="font-bold text-sm text-white">Microphone Access Needed</h4>
              <p className="text-xs text-slate-300 leading-relaxed max-w-xs mx-auto">
                {permissionError}
              </p>
            </div>
            <div className="flex items-center gap-3 pt-3">
              <button
                onClick={handleCancelRecording}
                className="flex-1 py-3 rounded-2xl bg-white/5 hover:bg-white/10 text-slate-300 font-bold text-xs border border-white/10 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={startRecordingProcess}
                className="flex-1 py-3 rounded-2xl bg-gradient-to-r from-pink-500 to-red-600 text-white font-extrabold text-xs shadow-lg shadow-pink-500/30 hover:opacity-95 transition-all"
              >
                Grant & Retry
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* STEP 1: RECORDING SCREEN */}
        {step === 'recording' && (
          <div className="space-y-6 text-center py-4">
            {/* Waveform Visualization */}
            <div className="flex items-center justify-center gap-1.5 h-20 bg-black/40 rounded-2xl p-4 border border-white/5 overflow-hidden">
              {waveformBars.map((height, idx) => (
                <div
                  key={idx}
                  className={`w-1.5 rounded-full transition-all duration-75 ${
                    isPaused
                      ? 'bg-slate-600'
                      : 'bg-gradient-to-t from-pink-600 via-rose-500 to-red-400 shadow-md shadow-pink-500/30'
                  }`}
                  style={{ height: `${isPaused ? 15 : height}%` }}
                />
              ))}
            </div>

            {/* Live Timer */}
            <div className="text-3xl font-black tracking-wider text-pink-400 font-mono">
              {formatTime(duration)}
            </div>

            {/* Recorder Action Buttons */}
            <div className="grid grid-cols-4 gap-3 pt-2">
              {/* Cancel */}
              <button
                onClick={handleCancelRecording}
                className="flex flex-col items-center gap-1.5 p-3 rounded-2xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white text-xs font-semibold transition-all"
              >
                <X className="w-5 h-5" />
                <span>Cancel</span>
              </button>

              {/* Pause / Resume */}
              {isPaused ? (
                <button
                  onClick={handleResumeRecording}
                  className="flex flex-col items-center gap-1.5 p-3 rounded-2xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-xs font-semibold border border-amber-500/30 transition-all"
                >
                  <Play className="w-5 h-5 fill-current" />
                  <span>Resume</span>
                </button>
              ) : (
                <button
                  onClick={handlePauseRecording}
                  className="flex flex-col items-center gap-1.5 p-3 rounded-2xl bg-white/5 hover:bg-white/10 text-amber-400 text-xs font-semibold border border-white/10 transition-all"
                >
                  <Pause className="w-5 h-5 fill-current" />
                  <span>Pause</span>
                </button>
              )}

              {/* Restart */}
              <button
                onClick={handleRestartRecording}
                className="flex flex-col items-center gap-1.5 p-3 rounded-2xl bg-white/5 hover:bg-white/10 text-sky-400 text-xs font-semibold border border-white/10 transition-all"
              >
                <RotateCcw className="w-5 h-5" />
                <span>Restart</span>
              </button>

              {/* Finish & Preview */}
              <button
                onClick={handleFinishRecording}
                className="flex flex-col items-center gap-1.5 p-3 rounded-2xl bg-gradient-to-r from-pink-500 to-red-600 text-white text-xs font-bold shadow-lg shadow-pink-500/25 hover:opacity-95 transition-all"
              >
                <Square className="w-5 h-5 fill-current" />
                <span>Finish</span>
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: PREVIEW & VOICE EDITING SCREEN */}
        {step === 'preview' && (
          <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
            {/* Audio Player & Waveform preview */}
            <div className="p-4 bg-black/40 border border-white/10 rounded-2xl space-y-3">
              <div className="flex items-center justify-between">
                <button
                  onClick={handleTogglePreviewPlay}
                  disabled={isProcessing}
                  className="p-3 rounded-full bg-gradient-to-r from-pink-500 to-red-600 text-white shadow-lg shadow-pink-500/30 hover:scale-105 transition-all"
                >
                  {isPlayingPreview ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current ml-0.5" />}
                </button>

                <div className="flex-1 mx-4 space-y-1">
                  <input
                    type="text"
                    value={voiceTitle}
                    onChange={(e) => setVoiceTitle(e.target.value)}
                    placeholder="Optional Voice Title..."
                    className="w-full bg-transparent border-b border-white/20 text-xs font-bold text-pink-300 focus:outline-none focus:border-pink-500 pb-0.5"
                  />
                  <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono">
                    <span>{formatTime(audioBuffer ? audioBuffer.duration : duration)}</span>
                    {selectedEffect !== 'normal' && (
                      <span className="text-pink-400 font-bold uppercase tracking-wider">{selectedEffect.replace('_', ' ')}</span>
                    )}
                  </div>
                </div>

                <button
                  onClick={() => setIsEditingActive(!isEditingActive)}
                  className={`p-2.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-all ${
                    isEditingActive
                      ? 'bg-pink-500/20 border-pink-500 text-pink-300'
                      : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
                  }`}
                >
                  <Scissors className="w-4 h-4" />
                  <span>Trim</span>
                </button>
              </div>

              {audioUrl && (
                <audio
                  ref={previewAudioRef}
                  src={audioUrl}
                  onPlay={() => setIsPlayingPreview(true)}
                  onPause={() => setIsPlayingPreview(false)}
                  onEnded={() => setIsPlayingPreview(false)}
                  className="hidden"
                />
              )}
            </div>

            {/* Trimming Panel */}
            {isEditingActive && originalBuffer && (
              <div className="p-3.5 bg-pink-500/10 border border-pink-500/30 rounded-2xl space-y-3 animate-fadeIn">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-extrabold text-pink-300 flex items-center gap-1.5">
                    <Scissors className="w-3.5 h-3.5" /> Audio Trimmer
                  </span>
                  <span className="text-[10px] text-slate-400">
                    {!currentUser.verified ? `Free edits left: ${Math.max(0, 2 - voiceEditsUsed)}/2` : 'Unlimited Verified Edits'}
                  </span>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between text-[11px] text-slate-300">
                    <span>Start: {formatTime(trimStart)}</span>
                    <span>End: {formatTime(trimEnd)}</span>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] text-slate-400 block mb-1">Trim Start (sec)</label>
                      <input
                        type="range"
                        min={0}
                        max={trimEnd - 0.5}
                        step={0.1}
                        value={trimStart}
                        onChange={(e) => setTrimStart(parseFloat(e.target.value))}
                        className="w-full accent-pink-500 cursor-pointer"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-400 block mb-1">Trim End (sec)</label>
                      <input
                        type="range"
                        min={trimStart + 0.5}
                        max={originalBuffer.duration}
                        step={0.1}
                        value={trimEnd}
                        onChange={(e) => setTrimEnd(parseFloat(e.target.value))}
                        className="w-full accent-pink-500 cursor-pointer"
                      />
                    </div>
                  </div>

                  <button
                    onClick={handleApplyTrim}
                    disabled={isProcessing}
                    className="w-full py-2 rounded-xl bg-pink-500 hover:bg-pink-600 font-bold text-xs text-white shadow-md transition-all flex items-center justify-center gap-1.5"
                  >
                    <Check className="w-4 h-4" />
                    <span>Apply Audio Trim</span>
                  </button>
                </div>
              </div>
            )}

            {/* Voice Effects Section */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="font-extrabold text-xs text-slate-200 flex items-center gap-1.5">
                  <Wand2 className="w-3.5 h-3.5 text-pink-400" /> Premium Voice Effects
                </h4>
                {!currentUser.verified && (
                  <span className="text-[10px] text-pink-400 flex items-center gap-1 bg-pink-500/10 px-2 py-0.5 rounded-full border border-pink-500/20">
                    <Lock className="w-3 h-3" /> Verified Feature
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {VOICE_EFFECTS.map((fx) => {
                  const isLocked = fx.id !== 'normal' && !currentUser.verified;
                  const isSelected = selectedEffect === fx.id;

                  return (
                    <button
                      key={fx.id}
                      onClick={() => handleSelectEffect(fx.id)}
                      className={`p-2.5 rounded-2xl border text-left flex flex-col justify-between transition-all relative ${
                        isSelected
                          ? 'bg-gradient-to-r from-pink-500/20 to-red-500/20 border-pink-500 text-white shadow-lg shadow-pink-500/20'
                          : isLocked
                          ? 'bg-white/5 border-white/5 opacity-70 hover:opacity-90'
                          : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
                      }`}
                    >
                      {isLocked && (
                        <div className="absolute top-2 right-2 p-1 bg-black/60 rounded-full text-pink-400">
                          <Lock className="w-3 h-3" />
                        </div>
                      )}
                      <div className="text-base">{fx.icon}</div>
                      <div className="mt-1">
                        <span className="font-bold text-[11px] block text-white">{fx.name}</span>
                        <span className="text-[9px] text-slate-400 block truncate">{fx.desc}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Bottom Action Footer */}
            <div className="flex items-center gap-3 pt-3 border-t border-white/10">
              <button
                onClick={handleRestartRecording}
                className="flex-1 py-3 rounded-2xl bg-white/5 hover:bg-white/10 text-slate-300 font-bold text-xs border border-white/10 transition-all flex items-center justify-center gap-1.5"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Re-record</span>
              </button>

              <button
                onClick={handleConfirmSend}
                disabled={isProcessing}
                className="flex-1 py-3 rounded-2xl bg-gradient-to-r from-pink-500 to-red-600 text-white font-extrabold text-xs shadow-lg shadow-pink-500/30 hover:opacity-95 transition-all flex items-center justify-center gap-1.5"
              >
                <Check className="w-4.5 h-4.5" />
                <span>Send Voice Note</span>
              </button>
            </div>
          </div>
        )}

        {/* VERIFICATION PROMPT MODAL */}
        {showVerificationModal && (
          <div className="absolute inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-xl animate-fadeIn">
            <div className="bg-[#14141d] border border-pink-500/30 rounded-3xl p-5 text-center space-y-4 max-w-xs shadow-2xl">
              <div className="w-12 h-12 mx-auto rounded-full bg-pink-500/20 text-pink-400 flex items-center justify-center border border-pink-500/30">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div>
                <h4 className="font-extrabold text-sm text-white">Account Verification Required</h4>
                <p className="text-xs text-slate-300 mt-2 leading-relaxed">
                  {showVerificationModal}
                </p>
              </div>
              <div className="flex flex-col gap-2 pt-1">
                {onRequestVerification && (
                  <button
                    onClick={() => {
                      setShowVerificationModal(null);
                      onRequestVerification();
                    }}
                    className="w-full py-2.5 rounded-xl bg-gradient-to-r from-pink-500 to-red-600 font-bold text-xs text-white shadow-md"
                  >
                    Request Verification Now
                  </button>
                )}
                <button
                  onClick={() => setShowVerificationModal(null)}
                  className="w-full py-2 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-semibold text-slate-400"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
          </>
        )}
      </div>
    </div>
  );
};
