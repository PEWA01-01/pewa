import React, { useState, useEffect } from 'react';
import { ChevronUp, ChevronDown, MessageCircle, Share2, Plus, ShieldCheck, Image as ImageIcon, X, ExternalLink, Copy, Check } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { PEWADatabaseService } from '../../services/db';
import { Post, Comment } from '../../types';
import { uploadImageWithProgress } from '../../services/cloudinary';

export const PostsTab: React.FC = () => {
  const { currentUser } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);

  // Post creation modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [postContent, setPostContent] = useState('');
  const [mediaUrl, setMediaUrl] = useState('');
  const [isUploading, setIsUploading] = useState(false);

  // Comments state
  const [activeCommentsPostId, setActiveCommentsPostId] = useState<string | null>(null);
  const [postComments, setPostComments] = useState<Record<string, Comment[]>>({});
  const [commentInput, setCommentInput] = useState('');

  // Meta Share Modal State
  const [shareModalPost, setShareModalPost] = useState<Post | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    loadPosts();
    const handleStorageUpdate = () => loadPosts();
    window.addEventListener('pewa_storage_update', handleStorageUpdate);
    const interval = setInterval(loadPosts, 2000);
    return () => {
      window.removeEventListener('pewa_storage_update', handleStorageUpdate);
      clearInterval(interval);
    };
  }, [currentUser]);

  const loadPosts = () => {
    const list = PEWADatabaseService.getPosts();
    setPosts(list);
  };

  const handleCreatePost = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !postContent.trim()) return;

    PEWADatabaseService.createPost(currentUser.uid, postContent, mediaUrl || undefined, mediaUrl ? 'image' : undefined);
    setPostContent('');
    setMediaUrl('');
    setShowCreateModal(false);
    loadPosts();
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setIsUploading(true);
      const folder = `posts/${currentUser?.uid || 'posts'}`;
      const url = await uploadImageWithProgress(file, undefined, folder);
      setMediaUrl(url);
      setIsUploading(false);
    } catch (err) {
      alert('Media upload failed.');
      setIsUploading(false);
    }
  };

  const handleVote = (postId: string, direction: 'up' | 'down') => {
    if (!currentUser) return;
    PEWADatabaseService.votePost(postId, currentUser.uid, direction);
    loadPosts();
  };

  const handleToggleComments = (postId: string) => {
    if (activeCommentsPostId === postId) {
      setActiveCommentsPostId(null);
    } else {
      setActiveCommentsPostId(postId);
      const comments = PEWADatabaseService.getComments(postId);
      setPostComments((prev) => ({ ...prev, [postId]: comments }));
    }
  };

  const handleAddComment = (postId: string, e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !commentInput.trim()) return;

    const newComment = PEWADatabaseService.addComment(postId, currentUser.uid, commentInput.trim());
    setPostComments((prev) => ({
      ...prev,
      [postId]: [...(prev[postId] || []), newComment]
    }));
    setCommentInput('');
    loadPosts();
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleShare = async (post: Post) => {
    const shareTitle = `PEWA - ${post.author?.fullName || 'Member'}'s Post`;
    const shareText = `"${post.content.slice(0, 120)}${post.content.length > 120 ? '...' : ''}"\n\nShared via PEWA - Zambia's premiere social app.`;
    const shareUrl = `${window.location.origin}?post=${post.id}`;

    // Try native share sheet with file preview if media image exists
    let sharedWithFiles = false;
    if (post.mediaUrl && navigator.canShare && navigator.canShare({ files: [] })) {
      try {
        const response = await fetch(post.mediaUrl, { mode: 'cors' });
        if (response.ok) {
          const blob = await response.blob();
          const file = new File([blob], `pewa_post_${post.id}.jpg`, { type: blob.type || 'image/jpeg' });
          if (navigator.canShare({ files: [file] })) {
            await navigator.share({
              title: shareTitle,
              text: shareText,
              url: shareUrl,
              files: [file]
            });
            sharedWithFiles = true;
            return;
          }
        }
      } catch (err) {
        console.warn('[MetaShare] File share note:', err);
      }
    }

    // Try standard Web Share API (opens OS share sheet which prioritizes Meta apps like FB, Instagram, Messenger, Threads)
    if (!sharedWithFiles && navigator.share) {
      try {
        await navigator.share({
          title: shareTitle,
          text: shareText,
          url: shareUrl
        });
        return;
      } catch (err) {
        console.warn('[MetaShare] Web share note:', err);
      }
    }

    // Fallback Meta Share Modal
    setShareModalPost(post);
  };

  return (
    <div className="pb-24 pt-3 px-4 max-w-md mx-auto sm:max-w-4xl animate-fadeIn space-y-4 relative">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 bg-[#14141d] border border-pink-500/40 text-white px-5 py-2.5 rounded-2xl shadow-2xl text-xs font-bold flex items-center gap-2 animate-bounce">
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Create Post Card trigger */}
      <div className="bg-[#121216]/80 border border-white/10 rounded-3xl p-4 shadow-xl backdrop-blur-xl flex items-center gap-3">
        <div className="relative w-11 h-11 rounded-2xl border border-pink-500/40 overflow-hidden shrink-0">
          <img
            src={currentUser?.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=400&auto=format&fit=crop'}
            alt="User Avatar"
            className="w-full h-full object-cover"
            referrerPolicy="no-referrer"
          />
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex-1 text-left bg-white/5 border border-white/10 hover:border-pink-500/50 rounded-2xl px-4 py-3 text-xs text-slate-400 font-medium transition-all backdrop-blur-md"
        >
          Share what's on your mind...
        </button>
        <button
          onClick={() => setShowCreateModal(true)}
          className="p-3 bg-gradient-to-r from-pink-500 to-red-600 text-white rounded-2xl shadow-lg shadow-pink-500/30 hover:opacity-95 transition-all active:scale-95"
          title="Create Post"
        >
          <Plus className="w-5 h-5" />
        </button>
      </div>

      {/* Posts Feed */}
      {posts.length === 0 ? (
        <div className="text-center py-16 px-4 bg-white/5 border border-white/10 rounded-3xl text-slate-400 backdrop-blur-xl">
          <p className="text-sm font-bold text-slate-200">No posts in the social feed yet.</p>
          <p className="text-xs mt-1">Be the first to share an update on PEWA!</p>
        </div>
      ) : (
        <div className="space-y-4">
          {posts.map((post) => {
            const hasUpVoted = currentUser ? post.upVotes?.includes(currentUser.uid) : false;
            const hasDownVoted = currentUser ? post.downVotes?.includes(currentUser.uid) : false;
            const commentsList = postComments[post.id] || [];
            const adminProfile = PEWADatabaseService.getAdminUserProfile();

            const isOfficialPost = post.isOfficial || post.authorRole === 'admin' || post.author?.isAdmin || post.authorId === 'admin_main' || post.author?.uid === 'admin_main' || post.isAd;
            const displayAvatar = isOfficialPost ? (adminProfile.avatar || post.author?.avatar) : (post.author?.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=400&auto=format&fit=crop');
            const displayName = isOfficialPost ? (adminProfile.fullName || post.author?.fullName || 'PEWA Official') : (post.author?.fullName || 'PEWA Member');
            const displayUsername = isOfficialPost ? 'pewa_official' : (post.author?.username || 'pewa');

            return (
              <div
                key={post.id}
                className="bg-[#121216]/80 border border-white/10 rounded-3xl p-5 shadow-xl space-y-4 transition-all hover:border-pink-500/40 backdrop-blur-xl"
              >
                {/* Author Info */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <img
                      src={displayAvatar}
                      alt={displayName}
                      className={`w-10 h-10 rounded-2xl object-cover ${isOfficialPost ? 'border-2 border-amber-500/80 shadow-lg shadow-amber-500/20' : 'border border-white/10'}`}
                      referrerPolicy="no-referrer"
                    />
                    <div>
                      <h4 className="font-extrabold text-sm text-white flex items-center gap-1.5 flex-wrap">
                        <span>{displayName}</span>
                        {isOfficialPost ? (
                          <span className="inline-flex items-center gap-1 text-[10px] bg-gradient-to-r from-amber-500 to-orange-600 text-slate-950 font-black px-2.5 py-0.5 rounded-full shadow-md shrink-0">
                            <ShieldCheck className="w-3 h-3 text-slate-950" /> Official Admin
                          </span>
                        ) : (
                          post.author?.verified && <ShieldCheck className="w-4 h-4 text-pink-500" />
                        )}
                      </h4>
                      <span className="text-[10px] text-slate-400">
                        @{displayUsername} • {new Date(post.createdAt).toLocaleDateString()} {new Date(post.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Content */}
                <p className="text-xs text-slate-200 leading-relaxed whitespace-pre-wrap">{post.content}</p>

                {/* Media Image */}
                {post.mediaUrl && (
                  <div className="rounded-2xl overflow-hidden max-h-80 bg-white/5 border border-white/10">
                    <img src={post.mediaUrl} alt="Post Attachment" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  </div>
                )}

                {/* CTA Link for Official Ads */}
                {post.adCtaUrl && (
                  <div className="pt-1">
                    <a
                      href={post.adCtaUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-pink-500 to-red-600 text-white font-extrabold text-xs rounded-2xl shadow-lg hover:opacity-95 transition-all active:scale-95"
                    >
                      <span>{post.adCtaText || 'Learn More'}</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                )}

                {/* Modern Post Action Bar (Icon-only with smooth animations & mobile friendly layout) */}
                <div className="flex items-center justify-between pt-3 border-t border-white/10 text-xs text-slate-400">
                  <div className="flex items-center gap-2">
                    {/* Up Vote (Up Arrow icon only) */}
                    <button
                      onClick={() => handleVote(post.id, 'up')}
                      className={`flex items-center gap-1.5 px-3 py-2 rounded-2xl border transition-all duration-200 active:scale-90 hover:scale-105 ${
                        hasUpVoted
                          ? 'bg-pink-500/20 border-pink-500/60 text-pink-400 font-extrabold shadow-md shadow-pink-500/20'
                          : 'bg-white/5 border-white/10 text-slate-400 hover:text-white hover:bg-white/10'
                      }`}
                      title="Up Vote"
                    >
                      <ChevronUp className="w-4 h-4 stroke-[2.5]" />
                      <span className="text-xs font-bold font-mono">{(post.upVotes || []).length}</span>
                    </button>

                    {/* Down Vote (Down Arrow icon only) */}
                    <button
                      onClick={() => handleVote(post.id, 'down')}
                      className={`flex items-center gap-1.5 px-3 py-2 rounded-2xl border transition-all duration-200 active:scale-90 hover:scale-105 ${
                        hasDownVoted
                          ? 'bg-red-500/20 border-red-500/60 text-red-400 font-extrabold shadow-md shadow-red-500/20'
                          : 'bg-white/5 border-white/10 text-slate-400 hover:text-white hover:bg-white/10'
                      }`}
                      title="Down Vote"
                    >
                      <ChevronDown className="w-4 h-4 stroke-[2.5]" />
                      <span className="text-xs font-bold font-mono">{(post.downVotes || []).length}</span>
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Comment (Comment icon only) */}
                    <button
                      onClick={() => handleToggleComments(post.id)}
                      className={`flex items-center gap-1.5 px-3 py-2 rounded-2xl border transition-all duration-200 active:scale-90 hover:scale-105 ${
                        activeCommentsPostId === post.id
                          ? 'bg-pink-500/15 border-pink-500/60 text-pink-400 font-extrabold'
                          : 'bg-white/5 border-white/10 text-slate-400 hover:text-white hover:bg-white/10'
                      }`}
                      title="Comments"
                    >
                      <MessageCircle className="w-4 h-4 stroke-[2.5] text-pink-400" />
                      <span className="text-xs font-bold font-mono">{post.commentsCount || 0}</span>
                    </button>

                    {/* Share (Share icon only) */}
                    <button
                      onClick={() => handleShare(post)}
                      className="p-2.5 rounded-2xl bg-white/5 border border-white/10 text-slate-400 hover:text-white hover:bg-white/10 transition-all duration-200 active:scale-90 hover:scale-105 flex items-center justify-center"
                      title="Share Post to Meta Apps"
                    >
                      <Share2 className="w-4 h-4 stroke-[2.5]" />
                    </button>
                  </div>
                </div>

                {/* Comments Expandable Section */}
                {activeCommentsPostId === post.id && (
                  <div className="pt-3 border-t border-white/10 space-y-3 animate-fadeIn">
                    <form onSubmit={(e) => handleAddComment(post.id, e)} className="flex gap-2">
                      <input
                        type="text"
                        value={commentInput}
                        onChange={(e) => setCommentInput(e.target.value)}
                        placeholder="Write a comment..."
                        className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-pink-500/60 transition-all"
                      />
                      <button type="submit" className="px-4 py-2 bg-gradient-to-r from-pink-500 to-red-600 font-bold text-xs text-white rounded-xl shadow-md hover:opacity-95 transition-all">
                        Post
                      </button>
                    </form>

                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {commentsList.map((c) => (
                        <div key={c.id} className="p-2.5 bg-white/5 border border-white/5 rounded-xl text-xs space-y-0.5">
                          <span className="font-bold text-pink-400 block">{c.authorName}</span>
                          <p className="text-slate-300">{c.text}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* CREATE POST MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0a0a0b]/80 backdrop-blur-xl animate-fadeIn">
          <div className="bg-[#121216] border border-white/10 rounded-3xl p-6 max-w-md w-full text-white space-y-4 shadow-2xl relative backdrop-blur-2xl">
            <div className="flex justify-between items-center border-b border-white/10 pb-3">
              <h3 className="font-extrabold text-base bg-gradient-to-r from-pink-400 to-red-500 bg-clip-text text-transparent">
                Create Social Feed Post
              </h3>
              <button onClick={() => setShowCreateModal(false)} className="p-1.5 text-slate-400 hover:text-white rounded-xl hover:bg-white/10 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreatePost} className="space-y-4">
              <textarea
                required
                rows={4}
                value={postContent}
                onChange={(e) => setPostContent(e.target.value)}
                placeholder="What's on your mind? Connect with the PEWA community..."
                className="w-full bg-white/5 border border-white/10 rounded-2xl p-3.5 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-pink-500/60 transition-all"
              />

              {/* Image Preview */}
              {mediaUrl && (
                <div className="relative rounded-2xl overflow-hidden max-h-40 border border-white/10">
                  <img src={mediaUrl} alt="Preview" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => setMediaUrl('')}
                    className="absolute top-2 right-2 p-1.5 bg-black/60 rounded-full text-white hover:bg-black/80 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* Media Upload */}
              <div className="flex justify-between items-center pt-2">
                <label className="flex items-center gap-2 px-3.5 py-2.5 bg-white/5 rounded-xl border border-white/10 text-xs text-slate-300 cursor-pointer hover:border-pink-500/60 transition-all">
                  <ImageIcon className="w-4 h-4 text-pink-400" />
                  <span>{isUploading ? 'Uploading...' : 'Add Photo / Video'}</span>
                  <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                </label>

                <button
                  type="submit"
                  disabled={isUploading}
                  className="px-6 py-2.5 bg-gradient-to-r from-pink-500 to-red-600 font-extrabold text-xs text-white rounded-xl shadow-lg shadow-pink-500/30 hover:opacity-95 transition-all"
                >
                  Publish Post
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* META SHARE MODAL */}
      {shareModalPost && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0a0a0b]/85 backdrop-blur-xl animate-fadeIn">
          <div className="bg-[#121216] border border-white/10 rounded-3xl p-6 max-w-sm w-full text-white space-y-5 shadow-2xl relative">
            <button
              onClick={() => {
                setShareModalPost(null);
                setCopiedLink(false);
              }}
              className="absolute top-4 right-4 p-2 rounded-full bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-all"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-pink-500/20 text-pink-400 border border-pink-500/30">
                <Share2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-extrabold text-sm text-white">Share Post via Meta</h3>
                <p className="text-[11px] text-slate-400">Select an application or copy link</p>
              </div>
            </div>

            {/* Post Preview Card */}
            <div className="p-3 bg-white/5 border border-white/10 rounded-2xl space-y-2 text-xs">
              <div className="flex items-center gap-2">
                <img
                  src={shareModalPost.author?.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=400&auto=format&fit=crop'}
                  alt="Author"
                  className="w-6 h-6 rounded-full object-cover"
                />
                <span className="font-bold text-white text-xs">{shareModalPost.author?.fullName || 'PEWA Member'}</span>
                <span className="text-[10px] text-pink-400 ml-auto font-mono">PEWA App</span>
              </div>
              <p className="text-slate-300 line-clamp-2 text-[11px]">{shareModalPost.content}</p>
              {shareModalPost.mediaUrl && (
                <div className="rounded-xl overflow-hidden max-h-28 border border-white/10">
                  <img src={shareModalPost.mediaUrl} alt="Media" className="w-full h-full object-cover" />
                </div>
              )}
            </div>

            {/* Meta Platform Share Buttons */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              {/* Facebook */}
              <a
                href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(`${window.location.origin}?post=${shareModalPost.id}`)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 py-2.5 rounded-2xl bg-[#1877F2]/20 hover:bg-[#1877F2]/30 text-[#1877F2] border border-[#1877F2]/30 font-bold transition-all"
              >
                <span>Facebook</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>

              {/* Threads */}
              <a
                href={`https://threads.net/intent/post?text=${encodeURIComponent(`"${shareModalPost.content.slice(0, 100)}" - Shared via PEWA App: ${window.location.origin}?post=${shareModalPost.id}`)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 py-2.5 rounded-2xl bg-white/10 hover:bg-white/20 text-white border border-white/20 font-bold transition-all"
              >
                <span>Threads</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>

              {/* Messenger */}
              <a
                href={`https://www.facebook.com/dialog/send?link=${encodeURIComponent(`${window.location.origin}?post=${shareModalPost.id}`)}&app_id=291494419107518&redirect_uri=${encodeURIComponent(`${window.location.origin}?post=${shareModalPost.id}`)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 py-2.5 rounded-2xl bg-[#0084FF]/20 hover:bg-[#0084FF]/30 text-[#0084FF] border border-[#0084FF]/30 font-bold transition-all"
              >
                <span>Messenger</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>

              {/* WhatsApp */}
              <a
                href={`https://api.whatsapp.com/send?text=${encodeURIComponent(`"${shareModalPost.content.slice(0, 100)}" - Check out this post on PEWA: ${window.location.origin}?post=${shareModalPost.id}`)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 py-2.5 rounded-2xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/30 font-bold transition-all"
              >
                <span>WhatsApp</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>

            {/* Copy Post Link Button */}
            <button
              onClick={() => {
                const fullText = `"${shareModalPost.content}"\n\nShared via PEWA: ${window.location.origin}?post=${shareModalPost.id}`;
                navigator.clipboard.writeText(fullText);
                setCopiedLink(true);
                showToast('📋 Post link and content copied to clipboard!');
                setTimeout(() => setCopiedLink(false), 3000);
              }}
              className="w-full py-3 rounded-2xl bg-gradient-to-r from-pink-500 to-red-600 text-white font-extrabold text-xs flex items-center justify-center gap-2 shadow-lg shadow-pink-500/30 hover:opacity-95 transition-all"
            >
              {copiedLink ? (
                <>
                  <Check className="w-4 h-4 text-emerald-300" />
                  <span>Link & Preview Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  <span>Copy Post Link & Caption</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

