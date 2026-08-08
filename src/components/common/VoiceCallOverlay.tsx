import React, { useState, useEffect, useRef } from 'react';
import {
  Phone, PhoneOff, Mic, MicOff, Volume2, VolumeX, X,
  ShieldAlert, ShieldCheck, AlertCircle, Sparkles
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { PEWADatabaseService } from '../../services/db';
import { UserProfile, CallItem } from '../../types';
import { DEFAULT_USER_AVATAR } from '../../services/cloudinary';
import { VerificationRequestModal } from './VerificationRequestModal';
import {
  callSoundSynth,
  WebRTCAudioSession,
  RealtimeSignalingService,
  CallSignalDoc
} from '../../services/voiceCallService';

export interface VoiceCallOverlayProps {}

export const VoiceCallOverlay: React.FC<VoiceCallOverlayProps> = () => {
  const { currentUser } = useAuth();
  const [activeCall, setActiveCall] = useState<CallSignalDoc | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeakerOn, setIsSpeakerOn] = useState(true);
  const [callDuration, setCallDuration] = useState(0);
  const [showUnverifiedModal, setShowUnverifiedModal] = useState(false);
  const [showVerificationRequestModal, setShowVerificationRequestModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [statusNotice, setStatusNotice] = useState<string | null>(null);

  const rtcSessionRef = useRef<WebRTCAudioSession | null>(null);
  const durationTimerRef = useRef<NodeJS.Timeout | null>(null);
  const ringingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const activeCallRef = useRef<CallSignalDoc | null>(null);

  // Keep ref in sync for event callbacks
  useEffect(() => {
    activeCallRef.current = activeCall;
  }, [activeCall]);

  // Format call duration (e.g. 00:05, 02:14)
  const formatCallDuration = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const remainder = sec % 60;
    return `${mins < 10 ? '0' : ''}${mins}:${remainder < 10 ? '0' : ''}${remainder}`;
  };

  // CLEANUP HELPER
  const cleanupCallSession = () => {
    callSoundSynth.stopSounds();
    if (durationTimerRef.current) {
      clearInterval(durationTimerRef.current);
      durationTimerRef.current = null;
    }
    if (ringingTimeoutRef.current) {
      clearTimeout(ringingTimeoutRef.current);
      ringingTimeoutRef.current = null;
    }
    if (rtcSessionRef.current) {
      rtcSessionRef.current.close();
      rtcSessionRef.current = null;
    }
    setActiveCall(null);
    setCallDuration(0);
    setIsMuted(false);
  };

  // 1. LISTEN FOR OUTGOING CALL REQUEST EVENT (`pewa_start_voice_call`)
  useEffect(() => {
    if (!currentUser) return;

    const handleStartCallEvent = async (e: any) => {
      console.log('-------------------------------------------');
      console.log('[VoiceCall] Outgoing Call Triggered');
      console.log('[VoiceCall] Caller ID:', currentUser.uid);

      const targetPartner: UserProfile = e.detail?.partner;
      if (!targetPartner) {
        console.error('[VoiceCall] Missing target partner information.');
        setErrorMessage('Could not locate partner profile information.');
        return;
      }

      console.log('[VoiceCall] Receiver ID:', targetPartner.uid);

      // Check caller verification status
      const isVerified = PEWADatabaseService.isUserVerified(currentUser);
      if (!isVerified) {
        console.warn('[VoiceCall] Blocked: Caller is unverified.');
        setShowUnverifiedModal(true);
        return;
      }

      const callId = `call_${currentUser.uid}_${targetPartner.uid}_${Date.now()}`;
      const partnerAvatar = targetPartner.avatar || DEFAULT_USER_AVATAR;
      const callerAvatar = currentUser.avatar || DEFAULT_USER_AVATAR;

      try {
        // Initialize local audio & WebRTC peer connection
        console.log('[VoiceCall] Initializing WebRTC audio stream...');
        const rtc = new WebRTCAudioSession();
        rtcSessionRef.current = rtc;
        await rtc.initializeLocalAudio();
        const pc = rtc.createPeerConnection();

        // Attach ICE candidate handler for caller
        pc.onicecandidate = (event) => {
          if (event.candidate) {
            RealtimeSignalingService.sendIceCandidate(callId, event.candidate.toJSON(), true);
          }
        };

        // Create WebRTC SDP offer
        const offer = await pc.createOffer({
          offerToReceiveAudio: true,
          offerToReceiveVideo: false
        });
        await pc.setLocalDescription(offer);

        const callSignalDoc: CallSignalDoc = {
          callId,
          callerId: currentUser.uid,
          callerName: currentUser.fullName,
          callerAvatar,
          receiverId: targetPartner.uid,
          receiverName: targetPartner.fullName,
          receiverAvatar: partnerAvatar,
          type: 'voice',
          status: 'ringing',
          createdAt: Date.now(),
          offer: { type: offer.type, sdp: offer.sdp }
        };

        // Log call record in PEWA local DB & Firestore history
        PEWADatabaseService.logCall({
          callerId: currentUser.uid,
          callerName: currentUser.fullName,
          callerAvatar,
          receiverId: targetPartner.uid,
          receiverName: targetPartner.fullName,
          receiverAvatar: partnerAvatar,
          type: 'voice',
          status: 'ongoing'
        });

        // Add call notification to receiver
        PEWADatabaseService.addNotification({
          userId: targetPartner.uid,
          senderId: currentUser.uid,
          senderName: currentUser.fullName,
          senderAvatar: callerAvatar,
          title: 'Incoming Voice Call',
          body: `${currentUser.fullName} is calling...`,
          type: 'call',
          actionId: callId
        });

        // Write real-time call document to Firebase RTDB
        await RealtimeSignalingService.createCallDoc(callSignalDoc);

        // Start ringback sound
        callSoundSynth.startRingback();

        // Set local state
        setActiveCall(callSignalDoc);
        setStatusNotice(null);

        // Set 30-second ringing timeout for missed call
        ringingTimeoutRef.current = setTimeout(() => {
          if (activeCallRef.current && activeCallRef.current.status === 'ringing') {
            console.log('[VoiceCall] Call unanswered after 30s timeout -> Missed Call');
            handleMissedCall(callSignalDoc);
          }
        }, 30000);

      } catch (err: any) {
        console.error('[VoiceCall] Error starting call session:', err);
        callSoundSynth.stopSounds();
        setErrorMessage(err.message || 'Microphone access is required for voice calls.');
      }
    };

    window.addEventListener('pewa_start_voice_call', handleStartCallEvent);
    return () => {
      window.removeEventListener('pewa_start_voice_call', handleStartCallEvent);
    };
  }, [currentUser]);

  // 2. LISTEN FOR INCOMING CALLS (RECEIVER SIDE)
  useEffect(() => {
    if (!currentUser || activeCall) return;

    const unsubscribeIncoming = RealtimeSignalingService.subscribeToIncomingCalls(
      currentUser.uid,
      (incCall) => {
        if (activeCallRef.current) return; // Already in a call

        console.log('[VoiceCall] Incoming call received from:', incCall.callerName);
        callSoundSynth.startIncomingRingtone();
        setActiveCall(incCall);
        setStatusNotice(null);
      }
    );

    return () => {
      unsubscribeIncoming();
    };
  }, [currentUser, activeCall]);

  // 3. LISTEN FOR SIGNALING & STATUS UPDATES ON ACTIVE CALL
  useEffect(() => {
    if (!activeCall) return;

    const isCaller = currentUser?.uid === activeCall.callerId;

    const unsubscribeCall = RealtimeSignalingService.subscribeToCall(
      activeCall.callId,
      async (doc) => {
        if (!doc) return;

        console.log('[VoiceCall] Real-time signal update received:', doc.status);

        // A. CALLER RECEIVES ACCEPT/ANSWER FROM RECEIVER
        if (isCaller && doc.status === 'connected' && doc.answer) {
          if (ringingTimeoutRef.current) {
            clearTimeout(ringingTimeoutRef.current);
            ringingTimeoutRef.current = null;
          }

          callSoundSynth.playConnectSound();
          setActiveCall((prev) => (prev ? { ...prev, status: 'connected', answeredAt: doc.answeredAt } : null));

          // Apply remote answer SDP to caller's WebRTC session
          if (rtcSessionRef.current) {
            const pc = rtcSessionRef.current.getPeerConnection();
            if (pc && pc.signalingState !== 'stable') {
              try {
                await pc.setRemoteDescription(new RTCSessionDescription(doc.answer as RTCSessionDescriptionInit));
                console.log('[VoiceCall] Caller setRemoteDescription succeeded');
              } catch (e) {
                console.warn('[VoiceCall] Error setting remote description:', e);
              }
            }
          }

          // Subscribe to receiver ICE candidates
          RealtimeSignalingService.subscribeToIceCandidates(
            activeCall.callId,
            'receiverCandidates',
            (cand) => {
              if (rtcSessionRef.current) {
                const pc = rtcSessionRef.current.getPeerConnection();
                if (pc) {
                  pc.addIceCandidate(new RTCIceCandidate(cand)).catch(() => {});
                }
              }
            }
          );
        }

        // B. RECEIVER DETECTS CALLER CANCELLED OR MISSED
        if (!isCaller && (doc.status === 'cancelled' || doc.status === 'missed')) {
          console.log('[VoiceCall] Call was cancelled or timed out by caller.');
          callSoundSynth.stopSounds();
          cleanupCallSession();
        }

        // C. CALL DECLINED / REJECTED
        if (doc.status === 'rejected') {
          console.log('[VoiceCall] Call declined by partner.');
          callSoundSynth.playEndSound();
          setStatusNotice('Call declined');
          setTimeout(() => {
            cleanupCallSession();
            setStatusNotice(null);
          }, 2000);
        }

        // D. CALL ENDED
        if (doc.status === 'ended') {
          console.log('[VoiceCall] Call ended by partner.');
          callSoundSynth.playEndSound();
          cleanupCallSession();
        }
      }
    );

    return () => {
      unsubscribeCall();
    };
  }, [activeCall?.callId, currentUser]);

  // 4. CALL DURATION TIMER FOR CONNECTED CALLS
  useEffect(() => {
    if (!activeCall || activeCall.status !== 'connected') {
      if (durationTimerRef.current) {
        clearInterval(durationTimerRef.current);
        durationTimerRef.current = null;
      }
      return;
    }

    const startTime = activeCall.answeredAt || Date.now();
    durationTimerRef.current = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      setCallDuration(elapsed);
    }, 1000);

    return () => {
      if (durationTimerRef.current) {
        clearInterval(durationTimerRef.current);
        durationTimerRef.current = null;
      }
    };
  }, [activeCall?.status, activeCall?.answeredAt]);

  // RECEIVER PRESSES ACCEPT
  const handleAcceptIncomingCall = async () => {
    if (!activeCall || !currentUser) return;

    console.log('[VoiceCall] Receiver pressed ACCEPT button');
    callSoundSynth.stopSounds();

    try {
      // Initialize receiver's WebRTC audio session
      const rtc = new WebRTCAudioSession();
      rtcSessionRef.current = rtc;
      await rtc.initializeLocalAudio();
      const pc = rtc.createPeerConnection();

      // Attach receiver ICE candidate handler
      pc.onicecandidate = (event) => {
        if (event.candidate) {
          RealtimeSignalingService.sendIceCandidate(activeCall.callId, event.candidate.toJSON(), false);
        }
      };

      // Set caller's SDP offer as remote description
      if (activeCall.offer) {
        await pc.setRemoteDescription(new RTCSessionDescription(activeCall.offer as RTCSessionDescriptionInit));
      }

      // Create SDP answer
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      // Subscribe to caller's ICE candidates
      RealtimeSignalingService.subscribeToIceCandidates(
        activeCall.callId,
        'callerCandidates',
        (cand) => {
          if (rtcSessionRef.current) {
            const currentPc = rtcSessionRef.current.getPeerConnection();
            if (currentPc) {
              currentPc.addIceCandidate(new RTCIceCandidate(cand)).catch(() => {});
            }
          }
        }
      );

      const answeredAt = Date.now();

      // Send SDP Answer & update status to 'connected' in Firebase
      await RealtimeSignalingService.sendAnswer(
        activeCall.callId,
        { type: answer.type, sdp: answer.sdp },
        answeredAt
      );

      callSoundSynth.playConnectSound();
      setActiveCall((prev) => (prev ? { ...prev, status: 'connected', answeredAt } : null));

    } catch (err: any) {
      console.error('[VoiceCall] Error accepting call:', err);
      setErrorMessage(err.message || 'Microphone access failed.');
      handleDeclineIncomingCall();
    }
  };

  // RECEIVER PRESSES DECLINE
  const handleDeclineIncomingCall = async () => {
    if (!activeCall || !currentUser) return;

    console.log('[VoiceCall] Receiver pressed DECLINE button');
    callSoundSynth.playEndSound();

    const callId = activeCall.callId;
    const callerId = activeCall.callerId;

    await RealtimeSignalingService.updateCallStatus(callId, currentUser.uid, 'rejected', 0);
    PEWADatabaseService.updateCallStatus(callId, 'rejected', 0);

    cleanupCallSession();
  };

  // CALLER PRESSES CANCEL
  const handleCancelOutgoingCall = async () => {
    if (!activeCall || !currentUser) return;

    console.log('[VoiceCall] Caller cancelled outgoing call');
    callSoundSynth.playEndSound();

    const callId = activeCall.callId;
    const receiverId = activeCall.receiverId;

    await RealtimeSignalingService.updateCallStatus(callId, receiverId, 'cancelled', 0);
    PEWADatabaseService.updateCallStatus(callId, 'cancelled', 0);

    cleanupCallSession();
  };

  // EITHER USER HANGS UP CONNECTED CALL
  const handleEndConnectedCall = async () => {
    if (!activeCall || !currentUser) return;

    console.log('[VoiceCall] User ended active call session. Duration:', callDuration);
    callSoundSynth.playEndSound();

    const callId = activeCall.callId;
    const otherUserId = currentUser.uid === activeCall.callerId ? activeCall.receiverId : activeCall.callerId;

    await RealtimeSignalingService.updateCallStatus(callId, otherUserId, 'ended', callDuration);
    PEWADatabaseService.updateCallStatus(callId, callDuration > 0 ? 'answered' : 'cancelled', callDuration);

    cleanupCallSession();
  };

  // MISSED CALL HANDLER
  const handleMissedCall = async (callDoc: CallSignalDoc) => {
    console.log('[VoiceCall] Handling missed call for:', callDoc.callId);
    callSoundSynth.stopSounds();

    await RealtimeSignalingService.updateCallStatus(callDoc.callId, callDoc.receiverId, 'missed', 0);
    PEWADatabaseService.updateCallStatus(callDoc.callId, 'missed', 0);

    setStatusNotice('No answer');
    setTimeout(() => {
      cleanupCallSession();
      setStatusNotice(null);
    }, 2500);
  };

  const handleToggleMute = () => {
    const nextMute = !isMuted;
    setIsMuted(nextMute);
    if (rtcSessionRef.current) {
      rtcSessionRef.current.toggleMute(nextMute);
    }
  };

  if (!activeCall && !statusNotice) return null;

  const isIncoming = activeCall ? currentUser?.uid === activeCall.receiverId : false;
  const partnerName = activeCall
    ? isIncoming
      ? activeCall.callerName
      : activeCall.receiverName
    : '';
  const partnerAvatar = activeCall
    ? isIncoming
      ? activeCall.callerAvatar
      : activeCall.receiverAvatar
    : DEFAULT_USER_AVATAR;

  return (
    <>
      {/* 1. ACTIVE VOICE CALL INTERFACE OVERLAY */}
      {activeCall && (
        <div className="fixed inset-0 z-[100] bg-slate-950/95 backdrop-blur-2xl flex flex-col items-center justify-between p-6 animate-fadeIn text-white">
          {/* Top Status Header */}
          <div className="pt-8 text-center space-y-2">
            <span className="inline-flex items-center gap-2 px-3.5 py-1 bg-pink-500/10 border border-pink-500/20 rounded-full text-pink-300 font-bold text-xs">
              <Sparkles className="w-3.5 h-3.5" /> PEWA HD Encrypted Voice Call
            </span>
            <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              {partnerName}
            </h2>
            <p className="text-xs font-semibold text-slate-300">
              {statusNotice ? (
                <span className="text-rose-400 font-bold">{statusNotice}</span>
              ) : isIncoming && activeCall.status === 'ringing' ? (
                'Incoming Voice Call...'
              ) : activeCall.status === 'ringing' ? (
                'Calling...'
              ) : activeCall.status === 'connected' ? (
                <span className="text-emerald-400 font-bold">Connected • {formatCallDuration(callDuration)}</span>
              ) : (
                'Connecting...'
              )}
            </p>
          </div>

          {/* Avatar Ring & Wave Animation */}
          <div className="relative my-auto flex items-center justify-center">
            {activeCall.status === 'ringing' && (
              <div className="absolute w-48 h-48 sm:w-56 sm:h-56 rounded-full bg-pink-500/10 border border-pink-500/30 animate-ping opacity-75" />
            )}
            <div
              className={`relative w-36 h-36 sm:w-44 sm:h-44 rounded-full overflow-hidden border-4 ${
                activeCall.status === 'connected'
                  ? 'border-emerald-500 shadow-emerald-500/30 ring-8 ring-emerald-500/20'
                  : 'border-pink-500/60 shadow-pink-500/30'
              } shadow-2xl transition-all duration-300`}
            >
              <img
                src={partnerAvatar || DEFAULT_USER_AVATAR}
                alt={partnerName}
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = DEFAULT_USER_AVATAR;
                }}
              />
            </div>
          </div>

          {/* Action Buttons Bar */}
          <div className="w-full max-w-xs space-y-4 mb-8">
            {isIncoming && activeCall.status === 'ringing' ? (
              /* RECEIVER CALLING SCREEN */
              <div className="flex items-center gap-3">
                <button
                  onClick={handleDeclineIncomingCall}
                  className="flex-1 py-4 bg-rose-600 hover:bg-rose-700 text-white font-extrabold rounded-2xl shadow-xl shadow-rose-600/30 flex items-center justify-center gap-2 transition-all active:scale-95 text-xs"
                >
                  <PhoneOff className="w-4 h-4" /> Decline
                </button>
                <button
                  onClick={handleAcceptIncomingCall}
                  className="flex-1 py-4 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-2xl shadow-xl shadow-emerald-600/30 flex items-center justify-center gap-2 transition-all active:scale-95 text-xs animate-bounce"
                >
                  <Phone className="w-4 h-4" /> Accept
                </button>
              </div>
            ) : !isIncoming && activeCall.status === 'ringing' ? (
              /* CALLER CALLING SCREEN */
              <button
                onClick={handleCancelOutgoingCall}
                className="w-full py-4 bg-rose-600 hover:bg-rose-700 text-white font-extrabold rounded-2xl shadow-xl shadow-rose-600/30 flex items-center justify-center gap-2 transition-all active:scale-95 text-xs"
              >
                <PhoneOff className="w-4 h-4" /> Cancel Call
              </button>
            ) : (
              /* CONNECTED CALL SCREEN */
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={handleToggleMute}
                    className={`py-3.5 rounded-2xl border font-bold text-xs flex items-center justify-center gap-2 transition-all ${
                      isMuted
                        ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                        : 'bg-white/10 border-white/10 text-slate-200 hover:bg-white/20'
                    }`}
                  >
                    {isMuted ? <MicOff className="w-4 h-4 text-amber-400" /> : <Mic className="w-4 h-4 text-slate-300" />}
                    <span>{isMuted ? 'Muted' : 'Mute'}</span>
                  </button>

                  <button
                    onClick={() => setIsSpeakerOn(!isSpeakerOn)}
                    className={`py-3.5 rounded-2xl border font-bold text-xs flex items-center justify-center gap-2 transition-all ${
                      !isSpeakerOn
                        ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                        : 'bg-white/10 border-white/10 text-slate-200 hover:bg-white/20'
                    }`}
                  >
                    {isSpeakerOn ? <Volume2 className="w-4 h-4 text-emerald-400" /> : <VolumeX className="w-4 h-4 text-slate-400" />}
                    <span>{isSpeakerOn ? 'Speaker' : 'Earpiece'}</span>
                  </button>
                </div>

                <button
                  onClick={handleEndConnectedCall}
                  className="w-full py-4 bg-rose-600 hover:bg-rose-700 text-white font-extrabold rounded-2xl shadow-xl shadow-rose-600/30 flex items-center justify-center gap-2 transition-all active:scale-95 text-xs"
                >
                  <PhoneOff className="w-4 h-4" /> End Call
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 2. UNVERIFIED USER RESTRICTION MODAL */}
      {showUnverifiedModal && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 z-[110] animate-fadeIn">
          <div className="bg-[#14141d] border border-white/10 rounded-3xl p-6 max-w-sm w-full space-y-4 shadow-2xl text-center text-white">
            <div className="w-14 h-14 bg-amber-500/10 border border-amber-500/20 rounded-full flex items-center justify-center mx-auto text-amber-400">
              <ShieldAlert className="w-7 h-7" />
            </div>
            <div className="space-y-1.5">
              <h3 className="text-base font-extrabold text-white">Verification Required</h3>
              <p className="text-xs text-slate-300 leading-relaxed font-medium">
                Voice calling requires account verification. Please submit your identity verification request to enable voice calling.
              </p>
            </div>
            <div className="space-y-2 pt-2">
              <button
                onClick={() => {
                  setShowUnverifiedModal(false);
                  setShowVerificationRequestModal(true);
                }}
                className="w-full py-3 bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 text-white font-extrabold text-xs rounded-2xl shadow-lg shadow-pink-500/25 transition-all flex items-center justify-center gap-2"
              >
                <ShieldCheck className="w-4 h-4" /> Request Account Verification
              </button>
              <button
                onClick={() => setShowUnverifiedModal(false)}
                className="w-full py-2.5 bg-white/5 hover:bg-white/10 text-slate-400 font-bold text-xs rounded-2xl transition-all"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. ERROR / RESTRICTION TOAST MODAL */}
      {errorMessage && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-[110] animate-fadeIn">
          <div className="bg-[#14141d] border border-rose-500/30 rounded-3xl p-6 max-w-sm w-full space-y-4 shadow-2xl text-center text-white">
            <div className="w-12 h-12 bg-rose-500/10 border border-rose-500/20 rounded-full flex items-center justify-center mx-auto text-rose-400">
              <AlertCircle className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-extrabold text-white">Call Error</h3>
              <p className="text-xs text-slate-300 leading-relaxed font-medium">{errorMessage}</p>
            </div>
            <button
              onClick={() => setErrorMessage(null)}
              className="w-full py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs rounded-2xl transition-all shadow-md"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* 4. VERIFICATION REQUEST MODAL */}
      {showVerificationRequestModal && currentUser && (
        <VerificationRequestModal
          userId={currentUser.uid}
          onClose={() => setShowVerificationRequestModal(false)}
        />
      )}
    </>
  );
};
