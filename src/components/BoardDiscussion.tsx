"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { BoardComment, TaskCommentFeed, SessionUser } from "@/types";

interface BoardDiscussionProps {
  currentUser: SessionUser;
}

const EMOJIS = ["👍", "❤️", "🎉", "🔥", "😂", "🙌"];

function getInitials(name: string) {
  return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

const AVATAR_COLORS = [
  "bg-indigo-500", "bg-blue-500", "bg-purple-500",
  "bg-pink-500", "bg-teal-500", "bg-orange-500",
];

function avatarColor(name: string) {
  let hash = 0;
  for (const c of name) hash = (hash << 5) - hash + c.charCodeAt(0);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

// ── Reaction Bar ───────────────────────────────────────────────────────────

interface ReactionBarProps {
  commentId: string;
  reactions: BoardComment["reactions"];
  onReact: (commentId: string, emoji: string) => Promise<void>;
}

function ReactionBar({ commentId, reactions, onReact }: ReactionBarProps) {
  const [picking, setPicking] = useState(false);
  const [inFlight, setInFlight] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setPicking(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  async function handleReact(emoji: string) {
    if (inFlight) return;
    setInFlight(emoji);
    try {
      await onReact(commentId, emoji);
    } finally {
      setInFlight(null);
    }
  }

  return (
    <div className="flex items-center gap-1.5 mt-2 flex-wrap">
      {reactions.map((r) => (
        <button
          key={r.emoji}
          onClick={() => handleReact(r.emoji)}
          disabled={!!inFlight}
          className={`flex items-center gap-1 text-xs rounded-full px-2 py-0.5 border transition-all disabled:opacity-60 disabled:cursor-not-allowed ${
            r.reacted
              ? "bg-blue-100 border-blue-300 text-blue-700 font-medium"
              : "bg-gray-50 border-gray-200 text-gray-500 hover:bg-gray-100"
          }`}
        >
          {r.emoji} <span>{r.count}</span>
        </button>
      ))}

      {/* Emoji picker trigger */}
      <div ref={ref} className="relative">
        <button
          onClick={() => setPicking(!picking)}
          disabled={!!inFlight}
          className="flex items-center gap-1 text-xs rounded-full px-2 py-0.5 border border-dashed border-gray-300 text-gray-400 hover:border-gray-400 hover:text-gray-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </button>
        {picking && (
          <div className="absolute bottom-full mb-1 left-0 bg-white rounded-xl border border-gray-200 shadow-lg p-2 flex gap-1 z-10">
            {EMOJIS.map((e) => (
              <button
                key={e}
                onClick={() => { handleReact(e); setPicking(false); }}
                disabled={!!inFlight}
                className="text-lg hover:scale-125 transition-transform disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {e}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Comment Item ───────────────────────────────────────────────────────────

interface CommentItemProps {
  comment: BoardComment;
  currentUser: SessionUser;
  isReply?: boolean;
  onReply: (parentId: string, content: string) => Promise<void>;
  onEdit: (id: string, content: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onReact: (commentId: string, emoji: string) => Promise<void>;
  onPin: (id: string) => Promise<void>;
}

function CommentItem({ comment, currentUser, isReply, onReply, onEdit, onDelete, onReact, onPin }: CommentItemProps) {
  const [editing, setEditing] = useState(false);
  const [replying, setReplying] = useState(false);
  const [editContent, setEditContent] = useState(comment.content);
  const [replyContent, setReplyContent] = useState("");
  const [saving, setSaving] = useState(false);

  const canModify = comment.author.id === currentUser.id || currentUser.role === "admin";

  async function submitEdit() {
    if (!editContent.trim()) return;
    setSaving(true);
    await onEdit(comment.id, editContent.trim());
    setSaving(false);
    setEditing(false);
  }

  async function submitReply() {
    if (!replyContent.trim()) return;
    setSaving(true);
    await onReply(comment.id, replyContent.trim());
    setSaving(false);
    setReplying(false);
    setReplyContent("");
  }

  return (
    <div className={`flex gap-3 ${isReply ? "pl-10" : ""}`}>
      <div
        className={`w-8 h-8 rounded-full ${avatarColor(comment.author.fullName)} flex items-center justify-center text-white text-xs font-bold shrink-0 mt-0.5 overflow-hidden`}
      >
        {comment.author.avatarUrl
          ? <Image src={comment.author.avatarUrl} alt={comment.author.fullName} width={32} height={32} className="w-full h-full object-cover" unoptimized />
          : getInitials(comment.author.fullName)}
      </div>
      <div className="flex-1 min-w-0">
        <div className={`bg-white rounded-2xl border px-4 py-3 shadow-sm ${comment.pinned ? "border-amber-200 bg-amber-50/30" : "border-gray-100"}`}>
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-semibold text-gray-900">{comment.author.fullName}</span>
              {isReply && (
                <span className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full">reply</span>
              )}
              {comment.pinned && !isReply && (
                <span className="flex items-center gap-1 text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full border border-amber-200">
                  <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z"/>
                  </svg>
                  Pinned
                </span>
              )}
            </div>
            <span className="text-xs text-gray-400 shrink-0">{timeAgo(comment.createdAt)}</span>
          </div>
          {editing ? (
            <div className="mt-1">
              <textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                rows={2}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none bg-gray-50"
              />
              <div className="flex gap-2 mt-2">
                <button onClick={submitEdit} disabled={saving} className="px-3 py-1 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700 disabled:opacity-50">
                  {saving ? "Saving..." : "Save"}
                </button>
                <button onClick={() => { setEditing(false); setEditContent(comment.content); }} className="px-3 py-1 text-gray-600 text-xs rounded-lg hover:bg-gray-100">
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{comment.content}</p>
          )}
        </div>

        {/* Reactions */}
        {!editing && (
          <ReactionBar commentId={comment.id} reactions={comment.reactions} onReact={onReact} />
        )}

        {/* Actions */}
        {!editing && (
          <div className="flex items-center gap-3 mt-1 px-1">
            {!isReply && (
              <button
                onClick={() => setReplying(!replying)}
                className="text-xs text-gray-400 hover:text-blue-600 font-medium transition-colors flex items-center gap-1"
              >
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                </svg>
                Reply {comment.replies && comment.replies.length > 0 ? `(${comment.replies.length})` : ""}
              </button>
            )}
            {/* Pin — only on top-level comments */}
            {!isReply && (
              <button
                onClick={() => onPin(comment.id)}
                className={`text-xs font-medium transition-colors flex items-center gap-1 ${
                  comment.pinned
                    ? "text-amber-600 hover:text-amber-700"
                    : "text-gray-400 hover:text-amber-600"
                }`}
              >
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z"/>
                </svg>
                {comment.pinned ? "Unpin" : "Pin"}
              </button>
            )}
            {canModify && (
              <>
                <button onClick={() => setEditing(true)} className="text-xs text-gray-400 hover:text-blue-600 font-medium transition-colors">
                  Edit
                </button>
                <button onClick={() => onDelete(comment.id)} className="text-xs text-gray-400 hover:text-red-600 font-medium transition-colors">
                  Delete
                </button>
              </>
            )}
          </div>
        )}

        {/* Reply input */}
        {replying && (
          <div className="mt-3 flex gap-2 pl-2">
            <textarea
              value={replyContent}
              onChange={(e) => setReplyContent(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submitReply(); } }}
              rows={2}
              placeholder="Write a reply... (Enter to post)"
              className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none bg-gray-50 focus:bg-white"
            />
            <div className="flex flex-col gap-1">
              <button onClick={submitReply} disabled={saving || !replyContent.trim()} className="px-3 py-1.5 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium">
                {saving ? "..." : "Send"}
              </button>
              <button onClick={() => { setReplying(false); setReplyContent(""); }} className="px-3 py-1.5 text-gray-500 text-xs rounded-lg hover:bg-gray-100">
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Replies */}
        {!isReply && comment.replies && comment.replies.length > 0 && (
          <div className="mt-3 space-y-3">
            {comment.replies.map((reply) => (
              <CommentItem
                key={reply.id}
                comment={reply}
                currentUser={currentUser}
                isReply
                onReply={onReply}
                onEdit={onEdit}
                onDelete={onDelete}
                onReact={onReact}
                onPin={onPin}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Optimistic reaction helpers ────────────────────────────────────────────

function toggleReactionOnComment(comment: BoardComment, emoji: string): BoardComment {
  const existing = comment.reactions.find((r) => r.emoji === emoji);
  let newReactions: BoardComment["reactions"];

  if (existing?.reacted) {
    newReactions = existing.count <= 1
      ? comment.reactions.filter((r) => r.emoji !== emoji)
      : comment.reactions.map((r) => r.emoji === emoji ? { ...r, count: r.count - 1, reacted: false } : r);
  } else if (existing) {
    newReactions = comment.reactions.map((r) =>
      r.emoji === emoji ? { ...r, count: r.count + 1, reacted: true } : r
    );
  } else {
    newReactions = [...comment.reactions, { emoji, count: 1, reacted: true }];
  }

  return { ...comment, reactions: newReactions };
}

function applyOptimisticReaction(
  comments: BoardComment[],
  commentId: string,
  emoji: string
): BoardComment[] {
  return comments.map((c) => {
    if (c.id === commentId) return toggleReactionOnComment(c, emoji);
    if (c.replies?.some((r) => r.id === commentId)) {
      return {
        ...c,
        replies: c.replies.map((r) =>
          r.id === commentId ? toggleReactionOnComment(r, emoji) : r
        ),
      };
    }
    return c;
  });
}

// ── Board Discussion ───────────────────────────────────────────────────────

export default function BoardDiscussion({ currentUser }: BoardDiscussionProps) {
  const [comments, setComments] = useState<BoardComment[]>([]);
  const [taskComments, setTaskComments] = useState<TaskCommentFeed[]>([]);
  const [loading, setLoading] = useState(true);
  const [collapsed, setCollapsed] = useState(false);
  const [tab, setTab] = useState<"discussion" | "activity">("discussion");
  const [newComment, setNewComment] = useState("");
  const [posting, setPosting] = useState(false);
  const [currentUserAvatar, setCurrentUserAvatar] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/profile")
      .then((r) => r.json())
      .then((d) => { if (d.data?.user?.avatarUrl) setCurrentUserAvatar(d.data.user.avatarUrl); })
      .catch(() => null);
  }, []);

  async function fetchComments() {
    try {
      const res = await fetch("/api/board-comments");
      if (!res.ok) { setLoading(false); return; }
      const data = await res.json();
      if (data.data?.comments) setComments(data.data.comments);
      if (data.data?.taskComments) setTaskComments(data.data.taskComments);
    } catch {
      // empty / non-JSON response
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchComments(); }, []);

  async function handlePost() {
    if (!newComment.trim()) return;
    setPosting(true);
    await fetch("/api/board-comments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: newComment.trim() }),
    });
    setNewComment("");
    await fetchComments();
    setPosting(false);
  }

  async function handleReply(parentId: string, content: string) {
    await fetch("/api/board-comments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content, parentId }),
    });
    await fetchComments();
  }

  async function handleEdit(id: string, content: string) {
    await fetch(`/api/board-comments/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    });
    await fetchComments();
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this comment?")) return;
    await fetch(`/api/board-comments/${id}`, { method: "DELETE" });
    await fetchComments();
  }

  async function handleReact(commentId: string, emoji: string) {
    // Optimistic update — instant UI feedback
    setComments((prev) => applyOptimisticReaction(prev, commentId, emoji));

    try {
      await fetch(`/api/board-comments/${commentId}/react`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emoji }),
      });
    } finally {
      // Sync with server to confirm final state
      fetchComments();
    }
  }

  async function handlePin(commentId: string) {
    // Optimistic update
    setComments((prev) =>
      prev.map((c) =>
        c.id === commentId
          ? { ...c, pinned: !c.pinned, pinnedAt: !c.pinned ? new Date().toISOString() : null }
          : c
      )
    );
    try {
      await fetch(`/api/board-comments/${commentId}/pin`, { method: "POST" });
    } finally {
      fetchComments();
    }
  }

  const totalCount = comments.reduce((acc, c) => acc + 1 + (c.replies?.length ?? 0), 0);

  return (
    <div className="mx-6 mb-6">
      <div className="bg-slate-50 rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Header */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="w-full flex items-center justify-between px-6 py-4 hover:bg-slate-100 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-blue-100 flex items-center justify-center">
              <svg className="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z" />
              </svg>
            </div>
            <div className="text-left">
              <h2 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                Board Discussion
                {totalCount > 0 && (
                  <span className="text-xs bg-blue-600 text-white rounded-full px-2 py-0.5 font-medium">
                    {totalCount}
                  </span>
                )}
              </h2>
              <p className="text-xs text-gray-400 mt-0.5">Project-wide team discussion</p>
            </div>
          </div>
          <svg
            className={`w-5 h-5 text-gray-400 transition-transform ${collapsed ? "" : "rotate-180"}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {!collapsed && (
          <div className="border-t border-slate-200">
            {/* Tabs */}
            <div className="flex items-center gap-1 px-6 pt-3 pb-0 bg-white/60 border-b border-slate-200">
              <button
                onClick={(e) => { e.stopPropagation(); setTab("discussion"); }}
                className={`px-4 py-2 text-xs font-semibold rounded-t-lg transition-colors border-b-2 ${
                  tab === "discussion"
                    ? "border-blue-600 text-blue-600 bg-white"
                    : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
              >
                Discussion
                {totalCount > 0 && (
                  <span className={`ml-1.5 text-[10px] rounded-full px-1.5 py-0.5 font-medium ${
                    tab === "discussion" ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-500"
                  }`}>
                    {totalCount}
                  </span>
                )}
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); setTab("activity"); }}
                className={`px-4 py-2 text-xs font-semibold rounded-t-lg transition-colors border-b-2 ${
                  tab === "activity"
                    ? "border-blue-600 text-blue-600 bg-white"
                    : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
              >
                Task Activity
                {taskComments.length > 0 && (
                  <span className={`ml-1.5 text-[10px] rounded-full px-1.5 py-0.5 font-medium ${
                    tab === "activity" ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-500"
                  }`}>
                    {taskComments.length}
                  </span>
                )}
              </button>
            </div>

            {tab === "discussion" && (
              <>
                {/* New comment input */}
                <div className="px-6 py-4 bg-white/60 border-b border-slate-200">
                  <div className="flex gap-3">
                    <div
                      className={`w-8 h-8 rounded-full ${avatarColor(currentUser.name)} flex items-center justify-center text-white text-xs font-bold shrink-0 mt-0.5 overflow-hidden`}
                    >
                      {currentUserAvatar
                        ? <Image src={currentUserAvatar} alt={currentUser.name} width={32} height={32} className="w-full h-full object-cover" unoptimized />
                        : getInitials(currentUser.name)}
                    </div>
                    <div className="flex-1">
                      <textarea
                        value={newComment}
                        onChange={(e) => setNewComment(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handlePost(); } }}
                        rows={2}
                        placeholder="Share an update, ask a question, or start a discussion... (Enter to post)"
                        className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none bg-white transition"
                      />
                      <div className="flex items-center justify-between mt-2">
                        <p className="text-xs text-gray-400">Shift+Enter for new line</p>
                        <button
                          onClick={handlePost}
                          disabled={posting || !newComment.trim()}
                          className="flex items-center gap-2 px-4 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white text-sm font-medium rounded-lg transition-colors"
                        >
                          {posting ? (
                            <>
                              <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                              </svg>
                              Posting...
                            </>
                          ) : (
                            <>
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                              </svg>
                              Post
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Comments list */}
                <div className="px-6 py-4 space-y-4 max-h-[480px] overflow-y-auto bg-slate-50/80">
                  {loading ? (
                    <div className="flex items-center justify-center py-8 gap-2 text-gray-400">
                      <svg className="w-4 h-4 animate-spin text-blue-500" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Loading discussion...
                    </div>
                  ) : comments.length === 0 ? (
                    <div className="flex flex-col items-center py-10 gap-3 text-gray-400">
                      <svg className="w-10 h-10 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                      </svg>
                      <p className="text-sm">No discussion yet. Start the conversation!</p>
                    </div>
                  ) : (
                    comments.map((c) => (
                      <CommentItem
                        key={c.id}
                        comment={c}
                        currentUser={currentUser}
                        onReply={handleReply}
                        onEdit={handleEdit}
                        onDelete={handleDelete}
                        onReact={handleReact}
                        onPin={handlePin}
                      />
                    ))
                  )}
                </div>
              </>
            )}

            {tab === "activity" && (
              <div className="px-6 py-4 space-y-3 max-h-[560px] overflow-y-auto bg-slate-50/80">
                {loading ? (
                  <div className="flex items-center justify-center py-8 gap-2 text-gray-400">
                    <svg className="w-4 h-4 animate-spin text-blue-500" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Loading activity...
                  </div>
                ) : taskComments.length === 0 ? (
                  <div className="flex flex-col items-center py-10 gap-3 text-gray-400">
                    <svg className="w-10 h-10 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                    <p className="text-sm">No task comments yet.</p>
                  </div>
                ) : (
                  taskComments.map((tc) => (
                    <div key={tc.id} className="flex gap-3">
                      <div
                        className={`w-8 h-8 rounded-full ${avatarColor(tc.author.fullName)} flex items-center justify-center text-white text-xs font-bold shrink-0 mt-0.5 overflow-hidden`}
                      >
                        {tc.author.avatarUrl
                          ? <Image src={tc.author.avatarUrl} alt={tc.author.fullName} width={32} height={32} className="w-full h-full object-cover" unoptimized />
                          : getInitials(tc.author.fullName)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="bg-white rounded-2xl border border-gray-100 px-4 py-3 shadow-sm">
                          <div className="flex items-start justify-between gap-2 mb-1.5">
                            <div className="flex items-center gap-2 flex-wrap min-w-0">
                              <span className="text-sm font-semibold text-gray-900 shrink-0">{tc.author.fullName}</span>
                              <span className="flex items-center gap-1 text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full border border-blue-100 truncate max-w-[180px]">
                                <svg className="w-2.5 h-2.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                                </svg>
                                <span className="truncate">{tc.task.title}</span>
                              </span>
                            </div>
                            <span className="text-xs text-gray-400 shrink-0">{timeAgo(tc.createdAt)}</span>
                          </div>
                          <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{tc.content}</p>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
