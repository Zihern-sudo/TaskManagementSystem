"use client";

import { useEffect, useState } from "react";
import { Comment } from "@/types";
import {
  MentionTextarea,
  renderMentions,
  ActiveUser,
} from "@/components/MentionTextarea";

interface CommentSectionProps {
  taskId: string;
  currentUserId: string;
  currentUserRole: string;
}

function getInitials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ── Comment Item ─────────────────────────────────────────────────────────────

interface CommentItemProps {
  comment: Comment;
  currentUserId: string;
  currentUserRole: string;
  activeUsers: ActiveUser[];
  onReply: (parentId: string, content: string, mentionedUserIds: string[]) => Promise<void>;
  onEdit: (id: string, content: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

function CommentItem({
  comment,
  currentUserId,
  currentUserRole,
  activeUsers,
  onReply,
  onEdit,
  onDelete,
}: CommentItemProps) {
  const [editing, setEditing] = useState(false);
  const [replying, setReplying] = useState(false);
  const [editContent, setEditContent] = useState(comment.content);
  const [replyContent, setReplyContent] = useState("");
  const [replyMentionedIds, setReplyMentionedIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const canModify =
    comment.author.id === currentUserId || currentUserRole === "admin";

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
    await onReply(comment.id, replyContent.trim(), replyMentionedIds);
    setSaving(false);
    setReplying(false);
    setReplyContent("");
    setReplyMentionedIds([]);
  }

  return (
    <div className="flex gap-3">
      <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white text-xs font-bold shrink-0 mt-0.5">
        {getInitials(comment.author.fullName)}
      </div>
      <div className="flex-1 min-w-0">
        <div className="bg-gray-50 rounded-xl px-4 py-3">
          <div className="flex items-center justify-between gap-2 mb-1">
            <span className="text-sm font-semibold text-gray-900">
              {comment.author.fullName}
            </span>
            <span className="text-xs text-gray-400 shrink-0">
              {formatDate(comment.createdAt)}
            </span>
          </div>
          {editing ? (
            <div className="mt-2">
              <textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                rows={2}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
              <div className="flex gap-2 mt-2">
                <button
                  onClick={submitEdit}
                  disabled={saving}
                  className="px-3 py-1 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {saving ? "Saving..." : "Save"}
                </button>
                <button
                  onClick={() => {
                    setEditing(false);
                    setEditContent(comment.content);
                  }}
                  className="px-3 py-1 text-gray-600 text-xs rounded-lg hover:bg-gray-200"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-700 whitespace-pre-wrap">
              {renderMentions(comment.content, activeUsers)}
            </p>
          )}
        </div>

        {/* Actions */}
        {!editing && (
          <div className="flex items-center gap-3 mt-1 px-1">
            {!comment.parentId && (
              <button
                onClick={() => setReplying(!replying)}
                className="text-xs text-gray-500 hover:text-blue-600 font-medium transition-colors"
              >
                Reply
              </button>
            )}
            {canModify && (
              <>
                <button
                  onClick={() => setEditing(true)}
                  className="text-xs text-gray-500 hover:text-blue-600 font-medium transition-colors"
                >
                  Edit
                </button>
                <button
                  onClick={() => onDelete(comment.id)}
                  className="text-xs text-gray-500 hover:text-red-600 font-medium transition-colors"
                >
                  Delete
                </button>
              </>
            )}
          </div>
        )}

        {/* Reply input with @mention */}
        {replying && (
          <div className="mt-3 flex gap-2">
            <MentionTextarea
              value={replyContent}
              onChange={setReplyContent}
              onMentionedUsersChange={setReplyMentionedIds}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  submitReply();
                }
              }}
              activeUsers={activeUsers}
              rows={2}
              placeholder="Write a reply... (@ to mention, Enter to post)"
              className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
            <div className="flex flex-col gap-1">
              <button
                onClick={submitReply}
                disabled={saving || !replyContent.trim()}
                className="px-3 py-1 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? "..." : "Send"}
              </button>
              <button
                onClick={() => {
                  setReplying(false);
                  setReplyContent("");
                }}
                className="px-3 py-1 text-gray-600 text-xs rounded-lg hover:bg-gray-200"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Replies */}
        {comment.replies && comment.replies.length > 0 && (
          <div className="mt-3 space-y-3 pl-4 border-l-2 border-gray-200">
            {comment.replies.map((reply) => (
              <CommentItem
                key={reply.id}
                comment={reply}
                currentUserId={currentUserId}
                currentUserRole={currentUserRole}
                activeUsers={activeUsers}
                onReply={onReply}
                onEdit={onEdit}
                onDelete={onDelete}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Comment Section ───────────────────────────────────────────────────────────

export default function CommentSection({
  taskId,
  currentUserId,
  currentUserRole,
}: CommentSectionProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [activeUsers, setActiveUsers] = useState<ActiveUser[]>([]);
  const [newComment, setNewComment] = useState("");
  const [mentionedUserIds, setMentionedUserIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);

  // Fetch active users once for @mention dropdown
  useEffect(() => {
    fetch("/api/users/active")
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d.data?.users)) setActiveUsers(d.data.users);
      })
      .catch(() => null);
  }, []);

  async function fetchComments() {
    const res = await fetch(`/api/tasks/${taskId}/comments`);
    const data = await res.json();
    if (data.data?.comments) setComments(data.data.comments);
    setLoading(false);
  }

  useEffect(() => {
    fetchComments();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskId]);

  async function handlePost() {
    if (!newComment.trim()) return;
    setPosting(true);
    await fetch(`/api/tasks/${taskId}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content: newComment.trim(),
        mentionedUserIds,
      }),
    });
    setNewComment("");
    setMentionedUserIds([]);
    await fetchComments();
    setPosting(false);
  }

  async function handleReply(
    parentId: string,
    content: string,
    replyMentionedUserIds: string[]
  ) {
    await fetch(`/api/tasks/${taskId}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content, parentId, mentionedUserIds: replyMentionedUserIds }),
    });
    await fetchComments();
  }

  async function handleEdit(id: string, content: string) {
    await fetch(`/api/comments/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    });
    await fetchComments();
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this comment?")) return;
    await fetch(`/api/comments/${id}`, { method: "DELETE" });
    await fetchComments();
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10">
        <svg
          className="w-5 h-5 animate-spin text-blue-500"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
          />
        </svg>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
        <svg
          className="w-4 h-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
          />
        </svg>
        Comments ({comments.length})
      </h3>

      {/* New comment input */}
      <div className="flex gap-3">
        <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white text-xs font-bold shrink-0 mt-0.5">
          Me
        </div>
        <div className="flex-1">
          <MentionTextarea
            value={newComment}
            onChange={setNewComment}
            onMentionedUsersChange={setMentionedUserIds}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handlePost();
              }
            }}
            activeUsers={activeUsers}
            rows={2}
            placeholder="Add a comment... (@ to mention, Enter to post)"
            className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
          <div className="flex items-center justify-between mt-2">
            <p className="text-xs text-gray-400">
              Type{" "}
              <kbd className="px-1 py-0.5 bg-gray-100 rounded text-[10px] font-mono">
                @
              </kbd>{" "}
              to mention · Shift+Enter for new line
            </p>
            <button
              onClick={handlePost}
              disabled={posting || !newComment.trim()}
              className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-sm font-medium rounded-lg transition-colors"
            >
              {posting ? "Posting..." : "Post"}
            </button>
          </div>
        </div>
      </div>

      {/* Comments list */}
      <div className="space-y-4">
        {comments.length === 0 ? (
          <div className="text-center py-8 text-gray-400 text-sm">
            No comments yet. Be the first to comment!
          </div>
        ) : (
          comments.map((c) => (
            <CommentItem
              key={c.id}
              comment={c}
              currentUserId={currentUserId}
              currentUserRole={currentUserRole}
              activeUsers={activeUsers}
              onReply={handleReply}
              onEdit={handleEdit}
              onDelete={handleDelete}
            />
          ))
        )}
      </div>
    </div>
  );
}
