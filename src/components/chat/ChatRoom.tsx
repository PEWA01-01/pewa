import React, { useState, useEffect, useRef } from 'react';
import {
  ArrowLeft, Paperclip, Send, BarChart2, Calendar, Gamepad2,
  Check, CheckCheck, MoreVertical, Trash2, Reply, ShieldCheck, X, AlertOctagon,
  Pin, Edit3, Plus, Phone, ShieldAlert
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { PEWADatabaseService } from '../../services/db';
import { Message, UserProfile, Poll, DatePlan, ChatGame } from '../../types';
import { ChatSettingsService, CustomChatSettings } from '../../services/chatSettings';
import { checkOffPlatformContact } from '../../services/contactModeration';
import { VerificationRequestModal } from '../common/VerificationRequestModal';
import { UserProfileModal } from '../common/UserProfileModal';

interface ChatRoomProps {
  chatId: string;
  partner: UserProfile;
  onBack: () => void;
}

export const ChatRoom: React.FC<ChatRoomProps> = ({ chatId, partner, onBack }) => {
  const { currentUser } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [showAttachmentMenu, setShowAttachmentMenu] = useState(false);
  const [showChatMenu, setShowChatMenu] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [editingMessage, setEditingMessage] = useState<Message | null>(null);

  // Chat Settings state & live updates
  const [chatSettings, setChatSettings] = useState<CustomChatSettings>(() => ChatSettingsService.getSettings());

  // Attachment Modals
  const [showPollModal, setShowPollModal] = useState(false);
  const [showGameModal, setShowGameModal] = useState(false);
  const [showDateModal, setShowDateModal] = useState(false);
  const [showUnverifiedCallModal, setShowUnverifiedCallModal] = useState(false);
  const [showVerificationModal, setShowVerificationModal] = useState(false);

  // Form states for poll
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOptions, setPollOptions] = useState(['Option 1', 'Option 2']);

  // Form states for game
  const [gameType, setGameType] = useState<'truth_or_dare' | 'would_you_rather' | '20_questions' | 'never_have_i_ever'>('truth_or_dare');
  const [gameTitle, setGameTitle] = useState('Truth or Dare');
  const [gamePrompt, setGamePrompt] = useState('Truth: What was your first impression of me?');
  const [gameOptionA, setGameOptionA] = useState('');
  const [gameOptionB, setGameOptionB] = useState('');

  // Form states for date planning
  const [dateTitle, setDateTitle] = useState('Coffee & Chat');
  const [dateLocation, setDateLocation] = useState('East Park Mall, Lusaka');
  const [dateTimeVal, setDateTimeVal] = useState('2026-08-05T19:00');
  const [dateNotes, setDateNotes] = useState('');

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadMessages();
    const interval = setInterval(loadMessages, 1500);

    const handleSettingsChange = (e: any) => {
      if (e.detail) setChatSettings(e.detail);
    };
    const handleStorageUpdate = () => loadMessages();

    window.addEventListener('pewa_chat_settings_changed', handleSettingsChange);
    window.addEventListener('pewa_storage_update', handleStorageUpdate);

    return () => {
      clearInterval(interval);
      window.removeEventListener('pewa_chat_settings_changed', handleSettingsChange);
      window.removeEventListener('pewa_storage_update', handleStorageUpdate);
    };
  }, [chatId, currentUser]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const loadMessages = () => {
    if (!currentUser) return;
    const list = PEWADatabaseService.getMessages(chatId, currentUser.uid);
    setMessages(list);
  };

  const getThemeBubbleClass = (isMe: boolean) => {
    if (!isMe) return 'bg-[#14141d]/95 border border-white/10 text-slate-100';
    switch (chatSettings.theme) {
      case 'midnight':
        return 'bg-gradient-to-r from-indigo-600 to-blue-700 text-white shadow-indigo-600/20';
      case 'emerald':
        return 'bg-gradient-to-r from-emerald-500 to-teal-700 text-white shadow-emerald-500/20';
      case 'sunset':
        return 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-purple-600/20';
      case 'crimson':
        return 'bg-gradient-to-r from-rose-600 to-red-700 text-white shadow-rose-600/20';
      case 'classic':
      default:
        return 'bg-gradient-to-r from-pink-500 to-red-600 text-white shadow-pink-500/20';
    }
  };

  const getWallpaperClass = () => {
    switch (chatSettings.wallpaper) {
      case 'doodle':
        return 'bg-[#0a0a0b] bg-[radial-gradient(rgba(255,255,255,0.06)_1px,transparent_1px)] [background-size:16px_16px]';
      case 'gradient':
        return 'bg-gradient-to-b from-[#12121c] via-[#0d0d14] to-[#0a0a0b]';
      case 'glow':
        return 'bg-[#0d0d16] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-pink-900/20 via-slate-950 to-black';
      case 'flat':
        return 'bg-[#0c0c0e]';
      case 'dark_solid':
      default:
        return 'bg-[#0a0a0b]';
    }
  };

  const getCornerRadiusClass = () => {
    switch (chatSettings.cornerRadius) {
      case 'small':
        return 'rounded-lg';
      case 'curved':
        return 'rounded-3xl';
      case 'medium':
      default:
        return 'rounded-2xl';
    }
  };

  const getFontSizeClass = () => {
    switch (chatSettings.fontSize) {
      case 'small':
        return 'text-[11px]';
      case 'large':
        return 'text-sm';
      case 'medium':
      default:
        return 'text-xs';
    }
  };

  const handleSendMessage = (overrideData?: Partial<Message>) => {
    if (!currentUser) return;
    const textToSend = overrideData?.text !== undefined ? overrideData.text : inputText.trim();
    if (!textToSend && !overrideData) return;

    // Global Chat handling
    if (chatId === 'chat_global_pewa') {
      if (editingMessage) {
        PEWADatabaseService.editMessage(chatId, editingMessage.id, textToSend);
        setEditingMessage(null);
      } else {
        PEWADatabaseService.sendGlobalChatMessage(currentUser.uid, {
          text: textToSend,
          type: overrideData?.type || 'text',
          replyToMessageId: replyingTo?.id,
          replyToText: replyingTo?.text
        });
      }
      setInputText('');
      setReplyingTo(null);
      setShowAttachmentMenu(false);
      loadMessages();
      return;
    }

    // Editing existing message in regular chat
    if (editingMessage) {
      PEWADatabaseService.editMessage(chatId, editingMessage.id, textToSend);
      setEditingMessage(null);
      setInputText('');
      setReplyingTo(null);
      loadMessages();
      return;
    }

    // Moderation Check for Unverified Accounts
    if (!overrideData && textToSend && !currentUser.verified) {
      const modResult = checkOffPlatformContact(textToSend);
      if (modResult.isBlocked) {
        alert(`Off-Platform Contact Restricted: ${modResult.reason}`);
        return;
      }
    }

    const payload: Omit<Message, 'id' | 'timestamp' | 'status'> = {
      chatId,
      senderId: currentUser.uid,
      receiverId: partner.uid,
      text: textToSend,
      type: overrideData?.type || 'text',
      replyToMessageId: replyingTo?.id,
      replyToText: replyingTo?.text,
      ...overrideData
    };

    PEWADatabaseService.sendMessage(payload);
    setInputText('');
    setReplyingTo(null);
    setShowAttachmentMenu(false);
    loadMessages();
  };

  const handleTogglePin = (msgId: string) => {
    PEWADatabaseService.togglePinMessage(chatId, msgId);
    loadMessages();
  };

  const handleReactToMessage = (msgId: string, emoji: string) => {
    if (!currentUser) return;
    PEWADatabaseService.reactToMessage(chatId, msgId, currentUser.uid, emoji);
    loadMessages();
  };

  // Poll creation
  const handleCreatePoll = () => {
    if (!pollQuestion.trim()) return;
    const poll: Poll = {
      id: 'poll_' + Date.now(),
      question: pollQuestion,
      options: pollOptions.filter(o => o.trim()).map((opt, i) => ({ id: 'opt_' + i, text: opt, votes: [] })),
      creatorId: currentUser!.uid
    };
    handleSendMessage({
      type: 'poll',
      text: `📊 Poll: ${pollQuestion}`,
      poll
    });
    setShowPollModal(false);
    setPollQuestion('');
  };

  // Chat Game creation
  const handleCreateGame = () => {
    if (!gamePrompt.trim()) return;
    const game: ChatGame = {
      id: 'game_' + Date.now(),
      chatId,
      creatorId: currentUser!.uid,
      gameType,
      title: gameTitle,
      prompt: gamePrompt,
      options: gameType === 'would_you_rather' ? [gameOptionA || 'Option A', gameOptionB || 'Option B'] : undefined,
      status: 'active',
      createdAt: Date.now()
    };
    handleSendMessage({
      type: 'game',
      text: `🎮 Game: ${gameTitle}`,
      game
    });
    setShowGameModal(false);
  };

  // Date planning creation
  const handleCreateDatePlan = () => {
    const datePlan: DatePlan = {
      id: 'date_' + Date.now(),
      chatId,
      title: dateTitle,
      location: dateLocation,
      dateTime: dateTimeVal,
      notes: dateNotes,
      status: 'pending',
      proposerId: currentUser!.uid
    };
    handleSendMessage({
      type: 'date_plan',
      text: `📅 Date Proposal: ${dateTitle}`,
      datePlan
    });
    setShowDateModal(false);
  };

  const handleVotePoll = (pollId: string, optionId: string) => {
    if (!currentUser) return;
    PEWADatabaseService.votePoll(chatId, pollId, optionId, currentUser.uid);
    loadMessages();
  };

  const handleRespondGame = (gameId: string, answer: string) => {
    if (!currentUser) return;
    PEWADatabaseService.respondGame(chatId, gameId, currentUser.uid, answer);
    loadMessages();
  };

  const handleUpdateDateStatus = (dateId: string, status: 'accepted' | 'declined') => {
    PEWADatabaseService.updateDateStatus(chatId, dateId, status);
    loadMessages();
  };

  const handleDeleteMsg = (msgId: string, forEveryone: boolean) => {
    PEWADatabaseService.deleteMessage(chatId, msgId, currentUser!.uid, forEveryone);
    loadMessages();
  };

  const isGlobalChat = chatId === 'chat_global_pewa';
  const isAdminUser = currentUser?.isAdmin || currentUser?.role === 'admin' || currentUser?.role === 'superadmin';
  const isReadOnlyGlobal = isGlobalChat && !isAdminUser;

  const adminProfile = PEWADatabaseService.getAdminUserProfile();
  const isPartnerAdmin = partner.uid === 'admin_main' || partner.uid === 'pewa_official' || partner.isAdmin || partner.role === 'admin' || partner.role === 'superadmin' || isGlobalChat;
  const displayPartnerAvatar = isPartnerAdmin ? (adminProfile.avatar || partner.avatar) : partner.avatar;
  const displayPartnerName = isPartnerAdmin ? (adminProfile.fullName || partner.fullName) : partner.fullName;

  const presence = PEWADatabaseService.getPresence(partner.uid);

  return (
    <div className="fixed inset-0 z-50 bg-[#0a0a0b] flex flex-col max-w-md mx-auto sm:max-w-4xl animate-fadeIn">
      {/* Top Bar */}
      <div className="bg-[#0a0a0b]/90 border-b border-white/10 px-4 py-3 flex items-center justify-between shrink-0 shadow-2xl backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="p-1.5 text-slate-300 hover:text-white rounded-xl hover:bg-white/10 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div
            onClick={() => !isGlobalChat && setShowProfileModal(true)}
            className={`flex items-center gap-3 ${!isGlobalChat ? 'cursor-pointer hover:opacity-85 transition-opacity' : ''}`}
            title={!isGlobalChat ? "Click to view full profile" : undefined}
          >
            <div className={`relative w-10 h-10 rounded-2xl overflow-hidden shrink-0 ${isPartnerAdmin ? 'border-2 border-amber-500/80 shadow-md shadow-amber-500/20' : 'border border-white/10'}`}>
              <img src={displayPartnerAvatar} alt={displayPartnerName} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-white flex items-center gap-1.5 leading-tight flex-wrap">
                <span>{displayPartnerName}</span>
                {isPartnerAdmin ? (
                  <span className="inline-flex items-center gap-1 text-[10px] bg-gradient-to-r from-amber-500 to-orange-600 text-slate-950 font-black px-2 py-0.5 rounded-full shadow-md shrink-0">
                    <ShieldCheck className="w-3 h-3 text-slate-950" /> Official Admin
                  </span>
                ) : (
                  partner.verified && <ShieldCheck className="w-4 h-4 text-pink-500" />
                )}
              </h3>
              <p className="text-[11px] text-amber-400 font-medium leading-none mt-0.5">
                {isGlobalChat ? 'Official PEWA Broadcast' : isPartnerAdmin ? 'Official Account' : (presence.status === 'online' ? 'Online' : 'Last seen recently')}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1">
          {!isGlobalChat && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (!currentUser) return;

                console.log('[VoiceCall] Call button clicked');
                console.log('[VoiceCall] Caller ID detected:', currentUser.uid);
                console.log('[VoiceCall] Receiver ID detected:', partner.uid);

                const isVerified = PEWADatabaseService.isUserVerified(currentUser);
                if (!isVerified) {
                  console.warn('[VoiceCall] Caller is unverified. Showing verification prompt.');
                  setShowUnverifiedCallModal(true);
                  return;
                }

                console.log('[VoiceCall] Dispatching pewa_start_voice_call...');
                window.dispatchEvent(
                  new CustomEvent('pewa_start_voice_call', {
                    detail: { partner }
                  })
                );
              }}
              className={`p-2 rounded-xl transition-colors ${
                PEWADatabaseService.isUserVerified(currentUser)
                  ? 'text-pink-400 hover:text-white hover:bg-pink-500/20'
                  : 'text-slate-500 opacity-70 hover:bg-white/5'
              }`}
              title={PEWADatabaseService.isUserVerified(currentUser) ? 'Start Voice Call' : 'Voice calling requires account verification'}
            >
              <Phone className="w-5 h-5" />
            </button>
          )}
          <button
            onClick={() => setShowChatMenu(!showChatMenu)}
            className="p-2 text-slate-300 hover:text-white rounded-xl hover:bg-white/10 transition-colors"
            title="Chat Options"
          >
            <MoreVertical className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Chat Dropdown Menu */}
      {showChatMenu && (
        <div className="absolute right-3 top-16 z-30 bg-[#121216] border border-white/10 rounded-2xl shadow-2xl p-2 w-52 text-xs text-slate-200 space-y-1 animate-fadeIn backdrop-blur-2xl">
          <button onClick={() => alert(`Contact Phone: ${partner.phone}`)} className="w-full text-left p-2.5 rounded-xl hover:bg-white/10 transition-colors">
            View Contact Info
          </button>
          <button onClick={() => alert('Muted notifications for this chat')} className="w-full text-left p-2.5 rounded-xl hover:bg-white/10 transition-colors">
            Mute Notifications
          </button>
          <button
            onClick={() => {
              if (confirm('Delete this conversation?')) {
                PEWADatabaseService.deleteChat(chatId, currentUser!.uid, true);
                setShowChatMenu(false);
                onBack();
              }
            }}
            className="w-full text-left p-2.5 rounded-xl hover:bg-rose-500/20 text-rose-400 flex items-center gap-2 transition-colors font-medium"
          >
            <Trash2 className="w-4 h-4" /> Delete Conversation
          </button>
          <button
            onClick={() => {
              PEWADatabaseService.submitReport(currentUser!.uid, partner.uid, undefined, 'Chat Abuse', 'Inappropriate behavior in chat');
              alert('User reported to Super Administrator.');
              setShowChatMenu(false);
            }}
            className="w-full text-left p-2.5 rounded-xl hover:bg-rose-500/20 text-rose-400 flex items-center gap-2 transition-colors font-medium"
          >
            <AlertOctagon className="w-4 h-4" /> Report & Block User
          </button>
        </div>
      )}

      {/* Messages Canvas */}
      <div className={`flex-1 overflow-y-auto p-4 space-y-3.5 ${getWallpaperClass()}`}>
        {messages.map((msg) => {
          const isMe = msg.senderId === currentUser?.uid;
          const isMsgFromAdmin = !isMe && (msg.senderId === 'admin_main' || msg.senderId === 'pewa_official' || (isPartnerAdmin && msg.senderId === partner.uid));

          return (
            <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
              {isMsgFromAdmin && (
                <div className="flex items-center gap-1.5 mb-1 px-1">
                  <img src={displayPartnerAvatar} alt={displayPartnerName} className="w-4 h-4 rounded-full object-cover border border-amber-500/80 shadow" referrerPolicy="no-referrer" />
                  <span className="text-[11px] font-extrabold text-amber-300 flex items-center gap-1">
                    <span>{displayPartnerName}</span>
                    <ShieldCheck className="w-3 h-3 text-amber-400" />
                  </span>
                </div>
              )}
              <div
                className={`group relative max-w-[85%] sm:max-w-[75%] p-3 shadow-xl backdrop-blur-md transition-all ${getCornerRadiusClass()} ${getThemeBubbleClass(
                  isMe
                )}`}
              >
                {/* Reply context */}
                {msg.replyToText && (
                  <div className="p-2 bg-black/25 border-l-2 border-white/60 rounded-xl text-[11px] opacity-90 mb-1.5">
                    <span className="font-bold block text-pink-300">Replying to message:</span>
                    <span className="truncate block">{msg.replyToText}</span>
                  </div>
                )}

                {/* Text Message */}
                {msg.type === 'text' && (
                  <p className={`leading-snug whitespace-pre-wrap font-normal ${getFontSizeClass()}`}>
                    {msg.text}
                    <span className="inline-flex items-center gap-1 text-[10px] opacity-75 ml-2.5 whitespace-nowrap float-right align-baseline mt-1">
                      <span>{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      {isMe && (chatSettings.readReceipts ? <CheckCheck className="w-3.5 h-3.5 text-sky-200" /> : <Check className="w-3.5 h-3.5 opacity-80" />)}
                    </span>
                  </p>
                )}

                {/* Poll Message */}
                {msg.type === 'poll' && msg.poll && (
                  <div className="space-y-2 p-1 min-w-[220px]">
                    <h5 className="font-extrabold text-sm text-amber-300 flex items-center gap-1.5">
                      <BarChart2 className="w-4 h-4 text-amber-400" />
                      {msg.poll.question}
                    </h5>
                    <div className="space-y-1.5">
                      {msg.poll.options.map((opt) => {
                        const hasVoted = opt.votes && currentUser && opt.votes.includes(currentUser.uid);
                        const totalVotes = msg.poll!.options.reduce((acc, o) => acc + (o.votes?.length || 0), 0);
                        const pct = totalVotes > 0 ? Math.round(((opt.votes?.length || 0) / totalVotes) * 100) : 0;

                        return (
                          <button
                            key={opt.id}
                            onClick={() => handleVotePoll(msg.poll!.id, opt.id)}
                            className={`w-full text-left p-2.5 rounded-xl border transition-all text-xs relative overflow-hidden ${
                              hasVoted
                                ? 'bg-amber-500/20 border-amber-500/50 text-white font-bold'
                                : 'bg-black/30 border-white/10 hover:bg-black/50 text-slate-200'
                            }`}
                          >
                            <div
                              className="absolute left-0 top-0 bottom-0 bg-amber-500/20 transition-all pointer-events-none"
                              style={{ width: `${pct}%` }}
                            />
                            <div className="relative z-10 flex justify-between items-center">
                              <span>{opt.text} {hasVoted && '✓'}</span>
                              <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded-full font-bold ml-2">
                                {opt.votes?.length || 0} ({pct}%)
                              </span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                    <div className="flex justify-end text-[9px] opacity-75 pt-1">
                      <span>{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                  </div>
                )}

                {/* Chat Game Message */}
                {msg.type === 'game' && msg.game && (
                  <div className="space-y-2 p-2 min-w-[230px] bg-gradient-to-br from-indigo-950/50 to-purple-950/50 border border-purple-500/30 rounded-2xl">
                    <div className="flex items-center gap-1.5 text-purple-300 font-extrabold text-xs uppercase tracking-wider">
                      <Gamepad2 className="w-4 h-4 text-pink-400" />
                      <span>{msg.game.title}</span>
                    </div>
                    <p className="text-xs text-white font-medium bg-black/30 p-2.5 rounded-xl border border-white/10">
                      {msg.game.prompt}
                    </p>

                    {/* Would You Rather options */}
                    {msg.game.gameType === 'would_you_rather' && msg.game.options && (
                      <div className="grid grid-cols-2 gap-2 pt-1">
                        {msg.game.options.map((opt, i) => {
                          const myAns = msg.game?.responses?.[currentUser?.uid || ''];
                          const isSelected = myAns === opt;
                          return (
                            <button
                              key={i}
                              onClick={() => handleRespondGame(msg.game!.id, opt)}
                              className={`p-2 rounded-xl border text-center text-xs font-bold transition-all ${
                                isSelected
                                  ? 'bg-pink-500 border-pink-400 text-white shadow-lg'
                                  : 'bg-white/10 border-white/10 hover:bg-white/20 text-slate-200'
                              }`}
                            >
                              {opt}
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {/* Direct text response for Truth or Dare / 20 Questions */}
                    {msg.game.gameType !== 'would_you_rather' && (
                      <div className="space-y-1.5 pt-1">
                        {msg.game.responses && Object.keys(msg.game.responses).length > 0 && (
                          <div className="space-y-1">
                            {Object.entries(msg.game.responses).map(([uid, resp]) => (
                              <div key={uid} className="bg-black/40 p-2 rounded-xl text-[11px] text-slate-200">
                                <span className="font-bold text-pink-300">
                                  {uid === currentUser?.uid ? 'You' : partner.fullName}:
                                </span>{' '}
                                {resp}
                              </div>
                            ))}
                          </div>
                        )}
                        <div className="flex gap-1.5 pt-1">
                          <input
                            type="text"
                            placeholder="Type your answer..."
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && e.currentTarget.value.trim()) {
                                handleRespondGame(msg.game!.id, e.currentTarget.value.trim());
                                e.currentTarget.value = '';
                              }
                            }}
                            className="flex-1 bg-black/40 border border-white/10 rounded-xl px-2.5 py-1 text-xs text-white placeholder-slate-400 focus:outline-none"
                          />
                        </div>
                      </div>
                    )}

                    <div className="flex justify-end text-[9px] opacity-75 pt-1">
                      <span>{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                  </div>
                )}

                {/* Date Plan Message */}
                {msg.type === 'date_plan' && msg.datePlan && (
                  <div className="p-3 bg-gradient-to-br from-pink-950/50 to-red-950/50 border border-pink-500/40 rounded-2xl space-y-1.5 text-xs backdrop-blur-md min-w-[220px]">
                    <span className="font-extrabold text-pink-300 flex items-center gap-1.5 text-sm">
                      <Calendar className="w-4 h-4 text-pink-400" />
                      Date Proposal: {msg.datePlan.title}
                    </span>
                    <p className="text-slate-300">📍 Location: {msg.datePlan.location}</p>
                    <p className="text-slate-300">⏰ Time: {new Date(msg.datePlan.dateTime).toLocaleString()}</p>
                    {msg.datePlan.notes && <p className="text-slate-400 italic">"{msg.datePlan.notes}"</p>}

                    <div className="pt-1.5 flex items-center justify-between">
                      <span className={`font-bold px-2 py-0.5 rounded-full text-[10px] capitalize ${
                        msg.datePlan.status === 'accepted'
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          : msg.datePlan.status === 'declined'
                          ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                          : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                      }`}>
                        Status: {msg.datePlan.status}
                      </span>
                      {msg.datePlan.proposerId !== currentUser?.uid && msg.datePlan.status === 'pending' && (
                        <div className="flex gap-1.5">
                          <button
                            onClick={() => handleUpdateDateStatus(msg.datePlan!.id, 'accepted')}
                            className="px-3 py-1 bg-emerald-600 font-bold rounded-xl text-[10px] text-white shadow-md hover:bg-emerald-500 transition-colors"
                          >
                            Accept
                          </button>
                          <button
                            onClick={() => handleUpdateDateStatus(msg.datePlan!.id, 'declined')}
                            className="px-3 py-1 bg-white/10 font-bold rounded-xl text-[10px] text-slate-300 hover:bg-white/20 transition-colors"
                          >
                            Decline
                          </button>
                        </div>
                      )}
                    </div>
                    <div className="flex justify-end text-[9px] opacity-75 pt-1">
                      <span>{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                  </div>
                )}

                {/* Pinned & Edited Indicators */}
                <div className="flex items-center gap-1.5 text-[10px] text-amber-400 font-medium">
                  {msg.pinned && (
                    <span className="flex items-center gap-0.5 bg-amber-500/20 px-1.5 py-0.5 rounded-full border border-amber-500/30">
                      <Pin className="w-3 h-3 fill-amber-400" /> Pinned
                    </span>
                  )}
                  {msg.edited && <span className="text-slate-400 italic">(edited)</span>}
                </div>

                {/* Reactions */}
                {msg.reactions && Object.keys(msg.reactions).length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {Object.entries(msg.reactions).map(([uid, emo]) => (
                      <span key={uid} className="text-xs bg-black/40 border border-white/10 px-1.5 py-0.5 rounded-full">
                        {emo}
                      </span>
                    ))}
                  </div>
                )}

                {/* Hover Message Toolbar */}
                <div className="hidden group-hover:flex items-center gap-1 absolute -top-3 right-0 bg-[#121216] border border-white/10 rounded-xl p-1 shadow-2xl backdrop-blur-xl z-20">
                  <button onClick={() => setReplyingTo(msg)} className="p-1 hover:text-pink-400 text-slate-300 transition-colors" title="Reply">
                    <Reply className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => handleTogglePin(msg.id)} className="p-1 hover:text-amber-400 text-slate-300 transition-colors" title={msg.pinned ? "Unpin message" : "Pin message"}>
                    <Pin className={`w-3.5 h-3.5 ${msg.pinned ? 'text-amber-400 fill-amber-400' : ''}`} />
                  </button>
                  {(isMe || isAdminUser) && msg.type === 'text' && (
                    <button onClick={() => { setEditingMessage(msg); setInputText(msg.text); }} className="p-1 hover:text-sky-400 text-slate-300 transition-colors" title="Edit message">
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <button onClick={() => handleReactToMessage(msg.id, '❤️')} className="p-1 hover:text-red-400 text-slate-300 text-xs" title="Love">
                    ❤️
                  </button>
                  <button onClick={() => handleReactToMessage(msg.id, '👍')} className="p-1 hover:text-amber-400 text-slate-300 text-xs" title="Like">
                    👍
                  </button>
                  <button onClick={() => handleDeleteMsg(msg.id, false)} className="p-1 hover:text-rose-400 text-slate-300 transition-colors" title="Delete for me">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                  {(isMe || isAdminUser) && (
                    <button onClick={() => handleDeleteMsg(msg.id, true)} className="p-1 hover:text-rose-500 text-slate-300 transition-colors" title="Delete for everyone">
                      ✕
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Replying or Editing Banner */}
      {(replyingTo || editingMessage) && (
        <div className="bg-[#121216] px-4 py-2.5 border-t border-white/10 flex items-center justify-between text-xs text-pink-400 backdrop-blur-xl">
          <div className="truncate">
            <span className="font-bold block text-[10px] uppercase">{editingMessage ? 'Editing Message:' : 'Replying:'}</span>
            <span className="text-slate-300 truncate block">{editingMessage ? editingMessage.text : replyingTo?.text}</span>
          </div>
          <button onClick={() => { setReplyingTo(null); setEditingMessage(null); setInputText(''); }} className="p-1 text-slate-400 hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Attachments Menu (Polls, Games, Date Scheduler) */}
      {showAttachmentMenu && !isReadOnlyGlobal && (
        <div className="bg-[#121216]/95 border-t border-white/10 p-3.5 grid grid-cols-3 gap-3 text-center text-xs text-slate-300 animate-fadeIn backdrop-blur-2xl">
          {/* Create Poll */}
          <button
            onClick={() => {
              setShowAttachmentMenu(false);
              setShowPollModal(true);
            }}
            className="flex flex-col items-center gap-1.5 p-3 bg-white/5 rounded-2xl hover:border-pink-500 border border-white/10 transition-all hover:bg-white/10"
          >
            <BarChart2 className="w-6 h-6 text-amber-400" />
            <span className="font-extrabold text-white">Create Poll</span>
          </button>

          {/* Start Chat Game */}
          <button
            onClick={() => {
              setShowAttachmentMenu(false);
              setShowGameModal(true);
            }}
            className="flex flex-col items-center gap-1.5 p-3 bg-white/5 rounded-2xl hover:border-pink-500 border border-white/10 transition-all hover:bg-white/10"
          >
            <Gamepad2 className="w-6 h-6 text-purple-400" />
            <span className="font-extrabold text-white">Start Chat Game</span>
          </button>

          {/* Schedule Date */}
          <button
            onClick={() => {
              setShowAttachmentMenu(false);
              setShowDateModal(true);
            }}
            className="flex flex-col items-center gap-1.5 p-3 bg-white/5 rounded-2xl hover:border-pink-500 border border-white/10 transition-all hover:bg-white/10"
          >
            <Calendar className="w-6 h-6 text-emerald-400" />
            <span className="font-extrabold text-white">Schedule Date</span>
          </button>
        </div>
      )}

      {/* Bottom Bar Input */}
      {isReadOnlyGlobal ? (
        <div className="bg-[#0a0a0b]/90 border-t border-white/10 p-4 text-center text-xs text-slate-300 shrink-0 backdrop-blur-xl space-y-1">
          <div className="flex items-center justify-center gap-1.5 text-pink-400 font-bold">
            <ShieldCheck className="w-4 h-4" />
            <span>PEWA Official Chat Room</span>
          </div>
          <p className="text-[11px] text-slate-400">
            This is an official announcement & update channel. Only PEWA Administrators can send messages in Global Chat.
          </p>
        </div>
      ) : (
        <div className="bg-[#0a0a0b]/90 border-t border-white/10 p-3.5 flex items-center gap-2.5 shrink-0 backdrop-blur-xl">
          <button
            onClick={() => setShowAttachmentMenu(!showAttachmentMenu)}
            className={`p-2.5 rounded-2xl transition-all ${showAttachmentMenu ? 'bg-pink-500 text-white shadow-lg' : 'bg-white/5 text-slate-300 hover:text-white border border-white/10'}`}
            title="Interactive Tools (Polls, Games, Dates)"
          >
            <Plus className="w-5 h-5" />
          </button>

          <input
            id="chat-message-input"
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
            placeholder={editingMessage ? "Edit message..." : "Type a message..."}
            className="flex-1 bg-white/5 border border-white/10 focus:border-pink-500/60 rounded-2xl px-4 py-2.5 text-xs text-white placeholder-slate-400 focus:outline-none transition-all"
          />

          <button
            onClick={() => handleSendMessage()}
            disabled={!inputText.trim() && !editingMessage}
            className="p-2.5 rounded-2xl bg-gradient-to-r from-pink-500 to-red-600 text-white shadow-lg shadow-pink-500/30 hover:opacity-95 transition-all disabled:opacity-40"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* POLL CREATOR MODAL */}
      {showPollModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="bg-[#121218] border border-amber-500/30 rounded-3xl p-5 max-w-sm w-full text-white space-y-3.5 shadow-2xl">
            <h4 className="font-extrabold text-base text-amber-400 flex items-center gap-2">
              <BarChart2 className="w-5 h-5 text-amber-400" />
              Create Poll
            </h4>
            <input
              type="text"
              placeholder="Ask a question..."
              value={pollQuestion}
              onChange={(e) => setPollQuestion(e.target.value)}
              className="w-full bg-slate-950 border border-white/10 rounded-2xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
            />
            <div className="space-y-2 text-xs">
              {pollOptions.map((opt, i) => (
                <input
                  key={i}
                  type="text"
                  placeholder={`Option ${i + 1}`}
                  value={opt}
                  onChange={(e) => {
                    const updated = [...pollOptions];
                    updated[i] = e.target.value;
                    setPollOptions(updated);
                  }}
                  className="w-full bg-slate-950 border border-white/10 rounded-2xl px-3.5 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
                />
              ))}
              <button
                onClick={() => setPollOptions([...pollOptions, `Option ${pollOptions.length + 1}`])}
                className="text-[11px] text-amber-400 hover:underline font-bold pt-1 block"
              >
                + Add Option
              </button>
            </div>
            <div className="flex gap-2 pt-2">
              <button onClick={() => setShowPollModal(false)} className="w-1/2 py-2.5 bg-white/5 rounded-2xl text-xs font-bold text-slate-300 hover:bg-white/10">
                Cancel
              </button>
              <button onClick={handleCreatePoll} className="w-1/2 py-2.5 bg-amber-500 font-extrabold rounded-2xl text-xs text-black shadow-lg shadow-amber-500/20">
                Send Poll
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CHAT GAME CREATOR MODAL */}
      {showGameModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="bg-[#121218] border border-purple-500/30 rounded-3xl p-5 max-w-sm w-full text-white space-y-3.5 shadow-2xl">
            <h4 className="font-extrabold text-base text-purple-400 flex items-center gap-2">
              <Gamepad2 className="w-5 h-5 text-purple-400" />
              Start Chat Game
            </h4>

            <div>
              <label className="text-[11px] text-slate-400 block mb-1">Game Type</label>
              <select
                value={gameType}
                onChange={(e) => {
                  const type = e.target.value as any;
                  setGameType(type);
                  if (type === 'truth_or_dare') {
                    setGameTitle('Truth or Dare');
                    setGamePrompt('Truth: What was your first impression of me?');
                  } else if (type === 'would_you_rather') {
                    setGameTitle('Would You Rather');
                    setGamePrompt('Would you rather...');
                    setGameOptionA('Travel the world');
                    setGameOptionB('Live in your dream home');
                  } else if (type === '20_questions') {
                    setGameTitle('20 Questions');
                    setGamePrompt("Ask me anything about my life!");
                  } else {
                    setGameTitle('Never Have I Ever');
                    setGamePrompt('Never have I ever been on a blind date');
                  }
                }}
                className="w-full bg-slate-950 border border-white/10 rounded-2xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-purple-400"
              >
                <option value="truth_or_dare">Truth or Dare</option>
                <option value="would_you_rather">Would You Rather</option>
                <option value="20_questions">20 Questions</option>
                <option value="never_have_i_ever">Never Have I Ever</option>
              </select>
            </div>

            <div>
              <label className="text-[11px] text-slate-400 block mb-1">Prompt / Question</label>
              <textarea
                rows={2}
                value={gamePrompt}
                onChange={(e) => setGamePrompt(e.target.value)}
                className="w-full bg-slate-950 border border-white/10 rounded-2xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-purple-400"
              />
            </div>

            {gameType === 'would_you_rather' && (
              <div className="space-y-2">
                <input
                  type="text"
                  placeholder="Option A"
                  value={gameOptionA}
                  onChange={(e) => setGameOptionA(e.target.value)}
                  className="w-full bg-slate-950 border border-white/10 rounded-2xl px-3.5 py-2 text-xs text-white focus:outline-none"
                />
                <input
                  type="text"
                  placeholder="Option B"
                  value={gameOptionB}
                  onChange={(e) => setGameOptionB(e.target.value)}
                  className="w-full bg-slate-950 border border-white/10 rounded-2xl px-3.5 py-2 text-xs text-white focus:outline-none"
                />
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <button onClick={() => setShowGameModal(false)} className="w-1/2 py-2.5 bg-white/5 rounded-2xl text-xs font-bold text-slate-300 hover:bg-white/10">
                Cancel
              </button>
              <button onClick={handleCreateGame} className="w-1/2 py-2.5 bg-purple-600 font-extrabold rounded-2xl text-xs text-white shadow-lg shadow-purple-600/20">
                Start Game
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DATE PLANNING MODAL */}
      {showDateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="bg-[#121218] border border-pink-500/30 rounded-3xl p-5 max-w-sm w-full text-white space-y-3.5 shadow-2xl">
            <h4 className="font-extrabold text-base text-pink-400 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-pink-400" />
              Schedule Date
            </h4>
            <div>
              <label className="text-[11px] text-slate-400 block mb-1">Date Activity Title</label>
              <input
                type="text"
                value={dateTitle}
                onChange={(e) => setDateTitle(e.target.value)}
                className="w-full bg-slate-950 border border-white/10 rounded-2xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-pink-400"
              />
            </div>
            <div>
              <label className="text-[11px] text-slate-400 block mb-1">Location</label>
              <input
                type="text"
                value={dateLocation}
                onChange={(e) => setDateLocation(e.target.value)}
                className="w-full bg-slate-950 border border-white/10 rounded-2xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-pink-400"
              />
            </div>
            <div>
              <label className="text-[11px] text-slate-400 block mb-1">Date & Time</label>
              <input
                type="datetime-local"
                value={dateTimeVal}
                onChange={(e) => setDateTimeVal(e.target.value)}
                className="w-full bg-slate-950 border border-white/10 rounded-2xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-pink-400"
              />
            </div>
            <div>
              <label className="text-[11px] text-slate-400 block mb-1">Notes (Optional)</label>
              <input
                type="text"
                placeholder="e.g. I'll reserve a table for two!"
                value={dateNotes}
                onChange={(e) => setDateNotes(e.target.value)}
                className="w-full bg-slate-950 border border-white/10 rounded-2xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-pink-400"
              />
            </div>
            <div className="flex gap-2 pt-2">
              <button onClick={() => setShowDateModal(false)} className="w-1/2 py-2.5 bg-white/5 rounded-2xl text-xs font-bold text-slate-300 hover:bg-white/10">
                Cancel
              </button>
              <button onClick={handleCreateDatePlan} className="w-1/2 py-2.5 bg-gradient-to-r from-pink-500 to-red-600 font-extrabold rounded-2xl text-xs text-white shadow-lg shadow-pink-500/20">
                Send Date Plan
              </button>
            </div>
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

      {/* USER PROFILE POPUP */}
      {showProfileModal && currentUser && (
        <UserProfileModal
          user={partner}
          currentUser={currentUser}
          onClose={() => setShowProfileModal(false)}
          onStartVoiceCall={(targetUser) => {
            window.dispatchEvent(
              new CustomEvent('pewa_start_voice_call', {
                detail: { partner: targetUser }
              })
            );
          }}
        />
      )}
    </div>
  );
};
