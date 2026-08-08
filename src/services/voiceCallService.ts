import { ref, set, update, onValue, off, push, get, child, onChildAdded, remove } from 'firebase/database';
import { rtdb } from '../firebase';
import { PEWADatabaseService } from './db';
import { UserProfile, CallItem } from '../types';
import { DEFAULT_USER_AVATAR } from './cloudinary';

export interface CallSignalDoc {
  callId: string;
  callerId: string;
  callerName: string;
  callerAvatar?: string;
  receiverId: string;
  receiverName: string;
  receiverAvatar?: string;
  type: 'voice';
  status: 'calling' | 'ringing' | 'connected' | 'rejected' | 'cancelled' | 'missed' | 'ended' | 'failed';
  createdAt: number;
  answeredAt?: number;
  endedAt?: number;
  duration?: number;
  offer?: { type: string; sdp: string };
  answer?: { type: string; sdp: string };
}

// Simple WebAudio Synthesizer for Ringback, Ringtone, and Beep sounds
class CallSoundSynthesizer {
  private audioCtx: AudioContext | null = null;
  private ringInterval: any = null;

  private getContext(): AudioContext | null {
    if (!this.audioCtx) {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) {
        this.audioCtx = new AudioContextClass();
      }
    }
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume().catch(() => {});
    }
    return this.audioCtx;
  }

  // Play outgoing ringback tone (US standard 440Hz + 480Hz)
  public startRingback() {
    this.stopSounds();
    const ctx = this.getContext();
    if (!ctx) return;

    const playToneBurst = () => {
      try {
        if (!this.audioCtx || this.audioCtx.state === 'closed') return;
        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const gain = ctx.createGain();

        osc1.type = 'sine';
        osc2.type = 'sine';
        osc1.frequency.setValueAtTime(440, ctx.currentTime);
        osc2.frequency.setValueAtTime(480, ctx.currentTime);

        gain.gain.setValueAtTime(0.08, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.8);

        osc1.connect(gain);
        osc2.connect(gain);
        gain.connect(ctx.destination);

        osc1.start(ctx.currentTime);
        osc2.start(ctx.currentTime);
        osc1.stop(ctx.currentTime + 1.8);
        osc2.stop(ctx.currentTime + 1.8);
      } catch (err) {
        console.warn('Ringback synth tone error:', err);
      }
    };

    playToneBurst();
    this.ringInterval = setInterval(playToneBurst, 3000);
  }

  // Play incoming ringtone melodic sequence
  public startIncomingRingtone() {
    this.stopSounds();
    const ctx = this.getContext();
    if (!ctx) return;

    const playMelody = () => {
      try {
        if (!this.audioCtx || this.audioCtx.state === 'closed') return;
        const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
        notes.forEach((freq, idx) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          const startTime = ctx.currentTime + idx * 0.18;

          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, startTime);
          gain.gain.setValueAtTime(0.12, startTime);
          gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.16);

          osc.connect(gain);
          gain.connect(ctx.destination);

          osc.start(startTime);
          osc.stop(startTime + 0.16);
        });
      } catch (err) {
        console.warn('Ringtone synth tone error:', err);
      }
    };

    playMelody();
    this.ringInterval = setInterval(playMelody, 2000);
  }

  // Play connection sound (Chime)
  public playConnectSound() {
    this.stopSounds();
    const ctx = this.getContext();
    if (!ctx) return;

    try {
      const notes = [440, 554.37, 659.25]; // A4, C#5, E5
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const startTime = ctx.currentTime + idx * 0.1;

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, startTime);
        gain.gain.setValueAtTime(0.15, startTime);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.3);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(startTime);
        osc.stop(startTime + 0.3);
      });
    } catch (err) {
      console.warn('Connect sound error:', err);
    }
  }

  // Play end call double beep sound
  public playEndSound() {
    this.stopSounds();
    const ctx = this.getContext();
    if (!ctx) return;

    try {
      [400, 300].forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const startTime = ctx.currentTime + idx * 0.15;

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, startTime);
        gain.gain.setValueAtTime(0.12, startTime);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.12);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(startTime);
        osc.stop(startTime + 0.12);
      });
    } catch (err) {
      console.warn('End sound error:', err);
    }
  }

  public stopSounds() {
    if (this.ringInterval) {
      clearInterval(this.ringInterval);
      this.ringInterval = null;
    }
  }
}

export const callSoundSynth = new CallSoundSynthesizer();

// WebRTC Peer Connection Helper
export class WebRTCAudioSession {
  private localStream: MediaStream | null = null;
  private peerConnection: RTCPeerConnection | null = null;
  private audioElement: HTMLAudioElement | null = null;
  private isFallbackStream: boolean = false;

  public async initializeLocalAudio(): Promise<MediaStream> {
    try {
      console.log('[WebRTC] Requesting microphone permission...');
      if (navigator.mediaDevices && typeof navigator.mediaDevices.getUserMedia === 'function') {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        this.localStream = stream;
        this.isFallbackStream = false;
        console.log('[WebRTC] Microphone stream initialized successfully.');
        return stream;
      } else {
        throw new Error('navigator.mediaDevices.getUserMedia is not supported.');
      }
    } catch (err: any) {
      console.warn('[WebRTC] Microphone permission denied or device missing:', err?.message || err);
      console.log('[WebRTC] Creating synthetic silent audio stream fallback...');
      
      this.localStream = this.createSyntheticAudioStream();
      this.isFallbackStream = true;
      return this.localStream;
    }
  }

  public isUsingFallbackMic(): boolean {
    return this.isFallbackStream;
  }

  private createSyntheticAudioStream(): MediaStream {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) {
        const ctx = new AudioContextClass();
        const dest = ctx.createMediaStreamDestination();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(440, ctx.currentTime);
        gain.gain.setValueAtTime(0, ctx.currentTime); // Silent virtual audio track
        osc.connect(gain);
        gain.connect(dest);
        osc.start();
        return dest.stream;
      }
    } catch (e) {
      console.warn('Failed to create synthetic stream:', e);
    }
    return new MediaStream();
  }

  public createPeerConnection(onTrackAdded?: (stream: MediaStream) => void): RTCPeerConnection {
    const configuration: RTCConfiguration = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' }
      ]
    };

    this.peerConnection = new RTCPeerConnection(configuration);

    // Add local audio tracks to peer connection
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => {
        this.peerConnection?.addTrack(track, this.localStream!);
      });
    }

    // Handle incoming remote audio stream
    this.peerConnection.ontrack = (event) => {
      console.log('[WebRTC] Remote audio track received:', event.streams[0]);
      if (event.streams[0]) {
        if (!this.audioElement) {
          this.audioElement = document.createElement('audio');
          this.audioElement.autoplay = true;
          this.audioElement.style.display = 'none';
          document.body.appendChild(this.audioElement);
        }
        this.audioElement.srcObject = event.streams[0];
        this.audioElement.play().catch((e) => console.warn('Audio play auto error:', e));
        if (onTrackAdded) onTrackAdded(event.streams[0]);
      }
    };

    return this.peerConnection;
  }

  public getPeerConnection(): RTCPeerConnection | null {
    return this.peerConnection;
  }

  public toggleMute(muted: boolean) {
    if (this.localStream) {
      this.localStream.getAudioTracks().forEach((track) => {
        track.enabled = !muted;
      });
    }
  }

  public close() {
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => track.stop());
      this.localStream = null;
    }
    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }
    if (this.audioElement) {
      this.audioElement.srcObject = null;
      this.audioElement.remove();
      this.audioElement = null;
    }
  }
}

// Global broadcast channel for cross-tab or local signaling synchronization
let broadcastChannel: BroadcastChannel | null = null;
try {
  if (typeof BroadcastChannel !== 'undefined') {
    broadcastChannel = new BroadcastChannel('pewa_voice_signaling_v2');
  }
} catch (e) {
  broadcastChannel = null;
}

export function broadcastCallSignal(signal: { type: string; payload: any }) {
  try {
    if (broadcastChannel) {
      broadcastChannel.postMessage(signal);
    }
    localStorage.setItem('pewa_last_call_signal', JSON.stringify({ ...signal, time: Date.now() }));
    window.dispatchEvent(new CustomEvent('pewa_local_call_signal', { detail: signal }));
  } catch (e) {
    // Ignore broadcast error
  }
}

// REAL FIREBASE & WEBRTC SIGNALING SERVICE
export class RealtimeSignalingService {
  // Write new call document to Firebase RTDB and broadcast
  static async createCallDoc(callData: CallSignalDoc): Promise<void> {
    if (rtdb) {
      try {
        await set(ref(rtdb, `active_calls/${callData.callId}`), callData);
        await set(ref(rtdb, `user_active_calls/${callData.receiverId}/${callData.callId}`), callData);
      } catch (err) {
        console.warn('[RealtimeSignaling] RTDB create call warning:', err);
      }
    }
    broadcastCallSignal({ type: 'incoming_call', payload: callData });
  }

  // Send SDP Answer
  static async sendAnswer(callId: string, answer: { type: string; sdp: string }, answeredAt: number): Promise<void> {
    const updates = {
      status: 'connected',
      answeredAt,
      answer
    };
    if (rtdb) {
      try {
        await update(ref(rtdb, `active_calls/${callId}`), updates);
      } catch (err) {
        console.warn('[RealtimeSignaling] RTDB send answer warning:', err);
      }
    }
    broadcastCallSignal({ type: 'call_answered', payload: { callId, ...updates } });
  }

  // Update Call Status (rejected, cancelled, missed, ended)
  static async updateCallStatus(
    callId: string,
    receiverId: string,
    status: CallSignalDoc['status'],
    duration: number = 0
  ): Promise<void> {
    const endedAt = Date.now();
    const updates: Partial<CallSignalDoc> = {
      status,
      endedAt,
      duration
    };

    if (rtdb) {
      try {
        await update(ref(rtdb, `active_calls/${callId}`), updates);
        await remove(ref(rtdb, `user_active_calls/${receiverId}/${callId}`));
      } catch (err) {
        console.warn('[RealtimeSignaling] RTDB update status warning:', err);
      }
    }
    broadcastCallSignal({ type: 'call_status_changed', payload: { callId, status, endedAt, duration } });
  }

  // Send ICE Candidates
  static async sendIceCandidate(callId: string, candidate: RTCIceCandidateInit, isCaller: boolean): Promise<void> {
    const candidatePath = isCaller ? 'callerCandidates' : 'receiverCandidates';
    const candId = `cand_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;

    if (rtdb) {
      try {
        await set(ref(rtdb, `active_calls/${callId}/${candidatePath}/${candId}`), candidate);
      } catch (err) {
        console.warn('[RealtimeSignaling] ICE candidate write warning:', err);
      }
    }
    broadcastCallSignal({ type: candidatePath, payload: { callId, candidate } });
  }

  // Subscribe to call document updates
  static subscribeToCall(callId: string, callback: (doc: CallSignalDoc) => void): () => void {
    let active = true;

    // RTDB listener
    let rtdbRef: any = null;
    let rtdbCallback: any = null;

    if (rtdb) {
      try {
        rtdbRef = ref(rtdb, `active_calls/${callId}`);
        rtdbCallback = (snapshot: any) => {
          if (!active) return;
          if (snapshot.exists()) {
            callback(snapshot.val() as CallSignalDoc);
          }
        };
        onValue(rtdbRef, rtdbCallback);
      } catch (err) {
        console.warn('[RealtimeSignaling] RTDB subscribe error:', err);
      }
    }

    // BroadcastChannel & local event listeners
    const handleBroadcast = (event: MessageEvent) => {
      if (!active || !event.data) return;
      const { payload } = event.data;
      if (payload && payload.callId === callId) {
        callback(payload as CallSignalDoc);
      }
    };

    const handleCustomEvent = (e: any) => {
      if (!active || !e.detail) return;
      if (e.detail.payload && e.detail.payload.callId === callId) {
        callback(e.detail.payload as CallSignalDoc);
      }
    };

    if (broadcastChannel) {
      broadcastChannel.addEventListener('message', handleBroadcast);
    }
    window.addEventListener('pewa_local_call_signal', handleCustomEvent);

    return () => {
      active = false;
      if (rtdbRef && rtdbCallback) {
        try {
          off(rtdbRef, 'value', rtdbCallback);
        } catch (_) {}
      }
      if (broadcastChannel) {
        broadcastChannel.removeEventListener('message', handleBroadcast);
      }
      window.removeEventListener('pewa_local_call_signal', handleCustomEvent);
    };
  }

  // Subscribe to incoming calls for user
  static subscribeToIncomingCalls(userId: string, callback: (doc: CallSignalDoc) => void): () => void {
    let active = true;
    let userCallsRef: any = null;
    let userCallsCallback: any = null;

    if (rtdb && userId) {
      try {
        userCallsRef = ref(rtdb, `user_active_calls/${userId}`);
        userCallsCallback = (snapshot: any) => {
          if (!active) return;
          if (snapshot.exists()) {
            const calls = snapshot.val();
            Object.values(calls).forEach((c: any) => {
              if (
                c &&
                c.receiverId === userId &&
                c.status === 'ringing' &&
                Date.now() - c.createdAt < 45000
              ) {
                callback(c as CallSignalDoc);
              }
            });
          }
        };
        onValue(userCallsRef, userCallsCallback);
      } catch (err) {
        console.warn('[RealtimeSignaling] Incoming calls listener error:', err);
      }
    }

    // Fallback broadcast listener
    const handleBroadcast = (event: MessageEvent) => {
      if (!active || !event.data) return;
      if (event.data.type === 'incoming_call' && event.data.payload) {
        const doc = event.data.payload as CallSignalDoc;
        if (doc.receiverId === userId && doc.status === 'ringing') {
          callback(doc);
        }
      }
    };

    const handleCustomEvent = (e: any) => {
      if (!active || !e.detail) return;
      if (e.detail.type === 'incoming_call' && e.detail.payload) {
        const doc = e.detail.payload as CallSignalDoc;
        if (doc.receiverId === userId && doc.status === 'ringing') {
          callback(doc);
        }
      }
    };

    if (broadcastChannel) {
      broadcastChannel.addEventListener('message', handleBroadcast);
    }
    window.addEventListener('pewa_local_call_signal', handleCustomEvent);

    return () => {
      active = false;
      if (userCallsRef && userCallsCallback) {
        try {
          off(userCallsRef, 'value', userCallsCallback);
        } catch (_) {}
      }
      if (broadcastChannel) {
        broadcastChannel.removeEventListener('message', handleBroadcast);
      }
      window.removeEventListener('pewa_local_call_signal', handleCustomEvent);
    };
  }

  // Subscribe to ICE candidates
  static subscribeToIceCandidates(
    callId: string,
    targetType: 'callerCandidates' | 'receiverCandidates',
    callback: (candidate: RTCIceCandidateInit) => void
  ): () => void {
    let active = true;
    let candRef: any = null;
    let candCallback: any = null;

    if (rtdb) {
      try {
        candRef = ref(rtdb, `active_calls/${callId}/${targetType}`);
        candCallback = (snapshot: any) => {
          if (!active) return;
          const cand = snapshot.val();
          if (cand) {
            callback(cand);
          }
        };
        onChildAdded(candRef, candCallback);
      } catch (err) {
        console.warn('[RealtimeSignaling] ICE subscribe error:', err);
      }
    }

    const handleBroadcast = (event: MessageEvent) => {
      if (!active || !event.data) return;
      if (event.data.type === targetType && event.data.payload?.callId === callId) {
        callback(event.data.payload.candidate);
      }
    };

    const handleCustomEvent = (e: any) => {
      if (!active || !e.detail) return;
      if (e.detail.type === targetType && e.detail.payload?.callId === callId) {
        callback(e.detail.payload.candidate);
      }
    };

    if (broadcastChannel) {
      broadcastChannel.addEventListener('message', handleBroadcast);
    }
    window.addEventListener('pewa_local_call_signal', handleCustomEvent);

    return () => {
      active = false;
      if (candRef && candCallback) {
        try {
          off(candRef, 'child_added', candCallback);
        } catch (_) {}
      }
      if (broadcastChannel) {
        broadcastChannel.removeEventListener('message', handleBroadcast);
      }
      window.removeEventListener('pewa_local_call_signal', handleCustomEvent);
    };
  }
}
