import React, { useState, useEffect, useRef } from 'react';
import {
  Bell,
  Phone,
  Send,
  ShieldCheck,
  CheckCircle2,
  Trash2,
  CheckCheck,
  MessageSquare,
  Sparkles,
  Heart,
  Share2,
  Crown,
  Volume2,
  X,
  ChevronRight,
  Filter,
  PhoneIncoming,
  PhoneOutgoing,
  PhoneMissed,
  PhoneOff,
  Mic,
  MicOff,
  Clock,
  ShieldAlert
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { PEWADatabaseService } from '../../services/db';
import { NotificationItem, CallItem, UserProfile } from '../../types';
import { BalloonIcon } from '../common/BalloonIcon';
import { DEFAULT_USER_AVATAR } from '../../services/cloudinary';
import { VerificationRequestModal } from '../common/VerificationRequestModal';

interface NotificationsTabProps {
  onOpenChatRoom?: (chatId: string, partner: UserProfile) => void;
}

type FilterCategory = 'all' | 'unread' | 'messages' | 'interactions' | 'system';

interface ActiveVoiceCallState {
  callId: string;
  partnerId: string;
  partnerName: string;
  partnerAvatar: string;
  isIncoming: boolean;
  status: 'calling' | 'connected' | 'ended';
  duration: number;
}

export const NotificationsTab: React.FC<NotificationsTabProps> = ({ onOpenChatRoom }) => {
  const { currentUser } = useAuth();
  const [subTab, setSubTab] = useState<'notifications' | 'calls'>('notifications');
  const [filter, setFilter] = useState<FilterCategory>('all');
  
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [calls, setCalls] = useState<CallItem[]>([]);

  // Inline reply state
  const [activeInlineReplyNotifId, setActiveInlineReplyNotifId] = useState<string | null>(null);
  const [inlineReplyText, setInlineReplyText] = useState('');

  // Real voice call state
  const [activeVoiceCall, setActiveVoiceCall] = useState<ActiveVoiceCallState | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [showUnverifiedCallModal, setShowUnverifiedCallModal] = useState(false);
  const [showVerificationModal, setShowVerificationModal] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 3000);
    return () => clearInterval(interval);
  }, [currentUser]);

  useEffect(() => {
    const handleCustomVoiceCall = (e: any) => {
      if (e.detail?.partner) {
        handleStartRealCall(e.detail.partner);
      }
    };
    window.addEventListener('pewa_start_voice_call', handleCustomVoiceCall);
    return () => window.removeEventListener('pewa_start_voice_call', handleCustomVoiceCall);
  }, [currentUser]);

  // Handle call active timer
  useEffect(() => {
    if (!activeVoiceCall) return;

    if (activeVoiceCall.status === 'calling' && !activeVoiceCall.isIncoming) {
      // Auto connect simulated ringing to established peer call after 2.5 seconds
      const connectTimer = setTimeout(() => {
        setActiveVoiceCall((prev) => prev ? { ...prev, status: 'connected' } : null);
      }, 2500);
      return () => clearTimeout(connectTimer);
    }

    if (activeVoiceCall.status === 'connected') {
      timerRef.current = setInterval(() => {
        setActiveVoiceCall((prev) => (prev ? { ...prev, duration: prev.duration + 1 } : null));
      }, 1000);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [activeVoiceCall?.status, activeVoiceCall?.isIncoming]);

  const loadData = () => {
    if (!currentUser) return;
    const notifs = PEWADatabaseService.getNotifications(currentUser.uid);
    const callLogs = PEWADatabaseService.getCalls(currentUser.uid);
    setNotifications(notifs);
    setCalls(callLogs);
  };

  const handleStartRealCall = (partnerUser: { uid: string; fullName: string; avatar?: string }) => {
    if (!currentUser) return;
    if (!PEWADatabaseService.isUserVerified(currentUser)) {
      setShowUnverifiedCallModal(true);
      return;
    }
    const partnerObj = PEWADatabaseService.getUserById(partnerUser.uid) || {
      uid: partnerUser.uid,
      fullName: partnerUser.fullName,
      avatar: partnerUser.avatar || DEFAULT_USER_AVATAR
    };
    window.dispatchEvent(
      new CustomEvent('pewa_start_voice_call', { detail: { partner: partnerObj } })
    );
  };

  const handleAcceptIncomingCall = () => {
    if (!activeVoiceCall) return;
    PEWADatabaseService.updateCallStatus(activeVoiceCall.callId, 'answered');
    setActiveVoiceCall((prev) => prev ? { ...prev, status: 'connected' } : null);
    loadData();
  };

  const handleDeclineIncomingCall = () => {
    if (!activeVoiceCall) return;
    PEWADatabaseService.updateCallStatus(activeVoiceCall.callId, 'rejected', 0);
    setActiveVoiceCall(null);
    loadData();
  };

  const handleEndCall = () => {
    if (!activeVoiceCall) return;
    const finalStatus = activeVoiceCall.duration > 0 ? 'answered' : (activeVoiceCall.isIncoming ? 'missed' : 'cancelled');
    PEWADatabaseService.updateCallStatus(activeVoiceCall.callId, finalStatus, activeVoiceCall.duration);
    setActiveVoiceCall(null);
    setIsMuted(false);
    loadData();
  };

  const handleMarkAsRead = (notifId: string) => {
    if (!currentUser) return;
    PEWADatabaseService.markNotificationAsRead(currentUser.uid, notifId);
    loadData();
  };

  const handleMarkAllRead = () => {
    if (!currentUser) return;
    PEWADatabaseService.markAllNotificationsAsRead(currentUser.uid);
    loadData();
  };

  const handleDeleteNotification = (notifId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!currentUser) return;
    PEWADatabaseService.deleteNotification(currentUser.uid, notifId);
    loadData();
  };

  const handleClearAll = () => {
    if (!currentUser) return;
    if (confirm('Clear all notifications from your inbox?')) {
      PEWADatabaseService.clearAllNotifications(currentUser.uid);
      loadData();
    }
  };

  const handleClearCallHistory = () => {
    if (!currentUser) return;
    if (confirm('Clear all call logs from your call history?')) {
      PEWADatabaseService.clearCallHistory(currentUser.uid);
      loadData();
    }
  };

  const handleInlineReply = (notif: NotificationItem, e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !notif.senderId || !notif.chatId || !inlineReplyText.trim()) return;

    PEWADatabaseService.sendMessage({
      chatId: notif.chatId,
      senderId: currentUser.uid,
      receiverId: notif.senderId,
      text: inlineReplyText.trim(),
      type: 'text'
    });

    PEWADatabaseService.markNotificationAsRead(currentUser.uid, notif.id);
    setInlineReplyText('');
    setActiveInlineReplyNotifId(null);
    loadData();
  };

  const handleNotificationClick = (notif: NotificationItem) => {
    if (!currentUser) return;
    PEWADatabaseService.markNotificationAsRead(currentUser.uid, notif.id);
    loadData();

    if (notif.type === 'call' && notif.senderId) {
      const senderObj = PEWADatabaseService.getUserById(notif.senderId);
      if (senderObj) {
        window.dispatchEvent(
          new CustomEvent('pewa_start_voice_call', { detail: { partner: senderObj } })
        );
        return;
      }
    }

    if (notif.chatId && notif.senderId && onOpenChatRoom) {
      const senderObj = PEWADatabaseService.getUserById(notif.senderId);
      if (senderObj) {
        onOpenChatRoom(notif.chatId, senderObj);
      }
    }
  };

  const formatCallDuration = (seconds?: number) => {
    if (!seconds || seconds <= 0) return '0s';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins > 0) {
      return `${mins}m ${secs < 10 ? '0' : ''}${secs}s`;
    }
    return `${secs}s`;
  };

  // Filtered Notifications
  const filteredNotifications = notifications.filter((n) => {
    if (filter === 'unread') return !n.read;
    if (filter === 'messages') return n.type === 'message';
    if (filter === 'interactions') return ['pop', 'keep', 'share', 'vote', 'like'].includes(n.type);
    if (filter === 'system') return ['sugars', 'broadcast', 'verification', 'call'].includes(n.type);
    return true;
  });

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <div className="pb-24 pt-3 px-4 max-w-md mx-auto sm:max-w-4xl animate-fadeIn space-y-4 text-white">
      {/* Top Header Switcher: Notifications vs Calls */}
      <div className="flex bg-white/5 p-1.5 rounded-2xl border border-white/10 shadow-xl backdrop-blur-xl">
        <button
          onClick={() => setSubTab('notifications')}
          className={`flex-1 py-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all ${
            subTab === 'notifications'
              ? 'bg-gradient-to-r from-pink-500 to-red-600 text-white shadow-lg shadow-pink-500/20'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Bell className="w-4 h-4" />
          <span>Notifications</span>
          {unreadCount > 0 && (
            <span className="bg-white text-pink-600 text-[10px] px-2 py-0.5 rounded-full font-black">
              {unreadCount}
            </span>
          )}
        </button>

        <button
          onClick={() => setSubTab('calls')}
          className={`flex-1 py-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all ${
            subTab === 'calls'
              ? 'bg-gradient-to-r from-pink-500 to-red-600 text-white shadow-lg shadow-pink-500/20'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Phone className="w-4 h-4" />
          <span>Calls Log</span>
          {calls.length > 0 && (
            <span className="bg-white/10 text-slate-300 text-[10px] px-2 py-0.5 rounded-full font-bold">
              {calls.length}
            </span>
          )}
        </button>
      </div>

      {/* SUB TAB 1: NOTIFICATIONS CENTER */}
      {subTab === 'notifications' && (
        <div className="space-y-3">
          {/* Controls Bar: Categories & Quick Bulk Actions */}
          <div className="flex items-center justify-between gap-2 overflow-x-auto pb-1 no-scrollbar">
            <div className="flex items-center gap-1.5">
              {[
                { id: 'all', label: 'All' },
                { id: 'unread', label: `Unread (${unreadCount})` },
                { id: 'messages', label: 'Messages' },
                { id: 'interactions', label: 'Find Love' },
                { id: 'system', label: 'System' }
              ].map((f) => (
                <button
                  key={f.id}
                  onClick={() => setFilter(f.id as FilterCategory)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                    filter === f.id
                      ? 'bg-pink-500 text-white shadow-md shadow-pink-500/20'
                      : 'bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white border border-white/5'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {/* Bulk Actions */}
            <div className="flex items-center gap-1.5 flex-shrink-0">
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllRead}
                  className="p-1.5 bg-white/5 hover:bg-white/10 text-pink-400 rounded-xl border border-white/10 text-[11px] font-bold flex items-center gap-1"
                  title="Mark all as read"
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Mark Read</span>
                </button>
              )}
              {notifications.length > 0 && (
                <button
                  onClick={handleClearAll}
                  className="p-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 rounded-xl border border-rose-500/20 text-[11px] font-bold"
                  title="Clear all notifications"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Notifications Feed */}
          {filteredNotifications.length === 0 ? (
            <div className="text-center py-16 px-4 bg-white/5 border border-white/10 rounded-3xl text-slate-400 backdrop-blur-xl">
              <Bell className="w-12 h-12 text-slate-500 mx-auto mb-3" />
              <p className="text-sm font-bold text-slate-200">No notifications found</p>
              <p className="text-xs mt-1 max-w-xs mx-auto text-slate-400">
                {filter === 'all'
                  ? 'Chat messages, matches, pop alerts, and PEWA broadcasts will appear here.'
                  : `No items in the ${filter} category.`}
              </p>
            </div>
          ) : (
            filteredNotifications.map((notif) => {
              // Icon selector
              const getNotifIcon = () => {
                if (notif.type === 'call') return <Phone className="w-3.5 h-3.5 text-emerald-400" />;
                if (notif.type === 'message') return <MessageSquare className="w-3.5 h-3.5 text-sky-400" />;
                if (notif.type === 'pop') return <BalloonIcon variant="pop" className="w-3.5 h-3.5 text-purple-400" />;
                if (notif.type === 'keep') return <BalloonIcon variant="keep" className="w-3.5 h-3.5 text-pink-400" />;
                if (notif.type === 'share') return <Share2 className="w-3.5 h-3.5 text-pink-400" />;
                if (notif.type === 'sugars') return <Crown className="w-3.5 h-3.5 text-amber-400" />;
                if (notif.type === 'verification') return <ShieldCheck className="w-3.5 h-3.5 text-pink-500" />;
                return <Sparkles className="w-3.5 h-3.5 text-amber-400" />;
              };

              return (
                <div
                  key={notif.id}
                  onClick={() => handleNotificationClick(notif)}
                  className={`p-4 rounded-3xl border transition-all backdrop-blur-xl shadow-xl cursor-pointer group ${
                    notif.read
                      ? 'bg-[#121216]/80 border-white/10 hover:border-white/20'
                      : 'bg-[#16131c]/90 border-pink-500/50 shadow-pink-500/10'
                  }`}
                >
                  <div className="flex items-start gap-3.5">
                    {/* Avatar with icon badge */}
                    <div className="relative shrink-0">
                      <img
                        src={notif.senderAvatar || DEFAULT_USER_AVATAR}
                        alt="Sender"
                        className="w-11 h-11 rounded-2xl object-cover border border-white/10"
                        referrerPolicy="no-referrer"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = DEFAULT_USER_AVATAR;
                        }}
                      />
                      <div className="absolute -bottom-1 -right-1 p-1 bg-[#121216] border border-white/10 rounded-full shadow">
                        {getNotifIcon()}
                      </div>
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-center mb-1">
                        <div className="flex items-center gap-1.5 truncate">
                          <h4 className="font-extrabold text-xs text-white truncate">{notif.title}</h4>
                          {!notif.read && (
                            <span className="w-2 h-2 rounded-full bg-pink-500 shrink-0 animate-ping" />
                          )}
                        </div>
                        <span className="text-[10px] text-slate-400 font-medium">
                          {new Date(notif.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>

                      <p className="text-xs text-slate-300 mb-2 leading-relaxed">{notif.body}</p>

                      {/* Notification Action Buttons */}
                      <div className="flex items-center justify-between pt-2 border-t border-white/10 text-xs">
                        {notif.type === 'call' && notif.senderId ? (
                          <div className="flex items-center gap-3">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                const senderObj = PEWADatabaseService.getUserById(notif.senderId!);
                                if (senderObj) {
                                  handleStartRealCall(senderObj);
                                }
                              }}
                              className="text-[11px] font-bold text-emerald-400 hover:text-emerald-300 transition-colors flex items-center gap-1"
                            >
                              <Phone className="w-3 h-3" /> Call Back
                            </button>
                          </div>
                        ) : notif.type === 'message' && notif.chatId ? (
                          <div className="flex items-center gap-3">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveInlineReplyNotifId(
                                  activeInlineReplyNotifId === notif.id ? null : notif.id
                                );
                              }}
                              className="text-[11px] font-bold text-pink-400 hover:text-pink-300 transition-colors flex items-center gap-1"
                            >
                              <Send className="w-3 h-3" /> Quick Reply
                            </button>
                            <span className="text-[11px] font-bold text-sky-400 flex items-center gap-1">
                              Tap to open chat <ChevronRight className="w-3 h-3" />
                            </span>
                          </div>
                        ) : (
                          <span className="text-[10px] text-slate-500 font-mono">
                            PEWA Alert • {notif.type.toUpperCase()}
                          </span>
                        )}

                        <button
                          onClick={(e) => handleDeleteNotification(notif.id, e)}
                          className="p-1 text-slate-500 hover:text-rose-400 transition-colors"
                          title="Delete notification"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {/* Inline Reply Form */}
                      {activeInlineReplyNotifId === notif.id && (
                        <form
                          onSubmit={(e) => handleInlineReply(notif, e)}
                          onClick={(e) => e.stopPropagation()}
                          className="mt-3 flex gap-2"
                        >
                          <input
                            type="text"
                            autoFocus
                            value={inlineReplyText}
                            onChange={(e) => setInlineReplyText(e.target.value)}
                            placeholder="Type direct response..."
                            className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-pink-500/60 transition-all"
                          />
                          <button
                            type="submit"
                            className="p-2 bg-gradient-to-r from-pink-500 to-red-600 text-white rounded-xl shadow-md hover:opacity-95 transition-all"
                          >
                            <Send className="w-3.5 h-3.5" />
                          </button>
                        </form>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* SUB TAB 2: CALLS LOG */}
      {subTab === 'calls' && (
        <div className="space-y-3">
          {calls.length > 0 && (
            <div className="flex justify-end mb-1">
              <button
                onClick={handleClearCallHistory}
                className="text-[11px] font-bold text-slate-400 hover:text-rose-400 flex items-center gap-1 transition-colors px-2 py-1 rounded-lg bg-white/5 border border-white/5"
              >
                <Trash2 className="w-3 h-3" /> Clear History
              </button>
            </div>
          )}

          {calls.length === 0 ? (
            <div className="text-center py-16 px-4 bg-white/5 border border-white/10 rounded-3xl text-slate-400 backdrop-blur-xl">
              <Phone className="w-12 h-12 text-slate-500 mx-auto mb-3 opacity-60" />
              <p className="text-sm font-bold text-slate-200">No call history yet.</p>
              <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">
                Real voice call records between registered users will appear here.
              </p>
            </div>
          ) : (
            calls.map((call) => {
              if (!currentUser) return null;
              const isOutgoing = call.callerId === currentUser.uid;
              const partnerId = isOutgoing ? call.receiverId : call.callerId;
              const partnerName = isOutgoing ? (call.receiverName || 'PEWA Contact') : call.callerName;
              const partnerAvatar = isOutgoing ? (call.receiverAvatar || DEFAULT_USER_AVATAR) : (call.callerAvatar || DEFAULT_USER_AVATAR);

              const getStatusBadge = () => {
                if (call.status === 'answered' || call.status === 'completed') {
                  return (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      Answered
                    </span>
                  );
                }
                if (call.status === 'missed') {
                  return (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                      Missed
                    </span>
                  );
                }
                if (call.status === 'rejected') {
                  return (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                      Rejected
                    </span>
                  );
                }
                return (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-slate-500/10 text-slate-400 border border-slate-500/20">
                    Cancelled
                  </span>
                );
              };

              return (
                <div
                  key={call.id}
                  className="p-4 bg-[#121216]/80 border border-white/10 rounded-3xl flex items-center justify-between text-xs backdrop-blur-xl shadow-xl hover:border-white/20 transition-all"
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <img
                      src={partnerAvatar}
                      alt={partnerName}
                      className="w-11 h-11 rounded-2xl object-cover border border-white/10 shrink-0"
                      referrerPolicy="no-referrer"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = DEFAULT_USER_AVATAR;
                      }}
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <h5 className="font-extrabold text-white truncate text-xs">{partnerName}</h5>
                        {getStatusBadge()}
                      </div>

                      <div className="flex items-center gap-2 text-[11px] text-slate-400">
                        <div className="flex items-center gap-1 font-medium">
                          {isOutgoing ? (
                            <PhoneOutgoing className="w-3 h-3 text-sky-400" />
                          ) : call.status === 'missed' ? (
                            <PhoneMissed className="w-3 h-3 text-rose-400" />
                          ) : (
                            <PhoneIncoming className="w-3 h-3 text-emerald-400" />
                          )}
                          <span>{isOutgoing ? 'Outgoing Call' : 'Incoming Call'}</span>
                        </div>
                        <span>•</span>
                        <span>{new Date(call.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric' })} at {new Date(call.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>

                      {call.duration && call.duration > 0 ? (
                        <div className="text-[10px] text-slate-400 mt-1 font-mono flex items-center gap-1">
                          <Clock className="w-3 h-3 text-slate-500" /> Duration: {formatCallDuration(call.duration)}
                        </div>
                      ) : null}
                    </div>
                  </div>

                  <button
                    onClick={() => handleStartRealCall({ uid: partnerId, fullName: partnerName, avatar: partnerAvatar })}
                    className="p-3 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-2xl hover:opacity-95 shadow-lg shadow-emerald-600/20 transition-all shrink-0 ml-2"
                    title="Call Back"
                  >
                    <Phone className="w-4 h-4" />
                  </button>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* ACTIVE REAL VOICE CALL SCREEN OVERLAY */}
      {activeVoiceCall && (
        <div className="fixed inset-0 z-50 bg-[#0a0a0b]/95 backdrop-blur-2xl flex flex-col items-center justify-between p-8 text-white animate-fadeIn">
          <div className="text-center space-y-2 mt-12">
            <span className="text-xs font-bold text-emerald-400 uppercase tracking-widest bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20">
              PEWA HD Voice Call
            </span>
            <h2 className="text-2xl font-black">{activeVoiceCall.partnerName}</h2>
            <p className="text-xs text-slate-400 animate-pulse font-mono">
              {activeVoiceCall.isIncoming && activeVoiceCall.status === 'calling'
                ? 'Incoming voice call request...'
                : activeVoiceCall.status === 'calling'
                ? 'Ringing...'
                : `Connected • ${formatCallDuration(activeVoiceCall.duration)}`}
            </p>
          </div>

          <div className="relative">
            <div className={`w-36 h-36 rounded-full overflow-hidden border-4 ${activeVoiceCall.status === 'connected' ? 'border-emerald-500' : 'border-pink-500/50'} shadow-2xl animate-pulse`}>
              <img
                src={activeVoiceCall.partnerAvatar}
                alt={activeVoiceCall.partnerName}
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = DEFAULT_USER_AVATAR;
                }}
              />
            </div>
          </div>

          <div className="w-full max-w-xs space-y-4 mb-8">
            {activeVoiceCall.isIncoming && activeVoiceCall.status === 'calling' ? (
              <div className="flex items-center gap-3">
                <button
                  onClick={handleDeclineIncomingCall}
                  className="flex-1 py-4 bg-rose-600 hover:bg-rose-700 text-white font-extrabold rounded-2xl shadow-2xl flex items-center justify-center gap-2 transition-all active:scale-95 text-xs"
                >
                  <PhoneOff className="w-4 h-4" /> Decline
                </button>
                <button
                  onClick={handleAcceptIncomingCall}
                  className="flex-1 py-4 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-2xl shadow-2xl flex items-center justify-center gap-2 transition-all active:scale-95 text-xs"
                >
                  <Phone className="w-4 h-4" /> Answer
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {activeVoiceCall.status === 'connected' && (
                  <button
                    onClick={() => setIsMuted(!isMuted)}
                    className={`w-full py-3.5 rounded-2xl border font-bold text-xs flex items-center justify-center gap-2 transition-all ${
                      isMuted
                        ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                        : 'bg-white/10 border-white/10 text-slate-200 hover:bg-white/20'
                    }`}
                  >
                    {isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                    <span>{isMuted ? 'Muted' : 'Mute Microphone'}</span>
                  </button>
                )}
                <button
                  onClick={handleEndCall}
                  className="w-full py-4 bg-rose-600 hover:bg-rose-700 text-white font-extrabold rounded-2xl shadow-2xl flex items-center justify-center gap-2 transition-all active:scale-95 text-xs"
                >
                  <X className="w-5 h-5" /> End Call
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* UNVERIFIED VOICE CALL RESTRICTION MODAL */}
      {showUnverifiedCallModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-[#14141d] border border-white/10 rounded-3xl p-6 max-w-sm w-full space-y-4 shadow-2xl text-center">
            <div className="w-14 h-14 bg-amber-500/10 border border-amber-500/20 rounded-full flex items-center justify-center mx-auto text-amber-400">
              <ShieldAlert className="w-7 h-7" />
            </div>
            <div className="space-y-1.5">
              <h3 className="text-base font-extrabold text-white">Verification Required</h3>
              <p className="text-xs text-slate-300 leading-relaxed font-medium">
                Voice calling is available after your account has been verified.
              </p>
            </div>
            <div className="space-y-2 pt-2">
              <button
                onClick={() => {
                  setShowUnverifiedCallModal(false);
                  setShowVerificationModal(true);
                }}
                className="w-full py-3 bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 text-white font-extrabold text-xs rounded-2xl shadow-lg shadow-pink-500/25 transition-all flex items-center justify-center gap-2"
              >
                <ShieldCheck className="w-4 h-4" /> Request Verification
              </button>
              <button
                onClick={() => setShowUnverifiedCallModal(false)}
                className="w-full py-2.5 bg-white/5 hover:bg-white/10 text-slate-400 font-bold text-xs rounded-2xl transition-all"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* VERIFICATION REQUEST MODAL */}
      {showVerificationModal && currentUser && (
        <VerificationRequestModal
          userId={currentUser.uid}
          onClose={() => setShowVerificationModal(false)}
        />
      )}
    </div>
  );
};
