"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";

export interface ActiveUser {
  id: string;
  fullName: string;
  email: string;
  avatarUrl?: string | null;
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

function getInitials(name: string) {
  return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
}

export interface MentionTextareaProps {
  value: string;
  onChange: (value: string) => void;
  /** Called whenever the set of mentioned user IDs changes */
  onMentionedUsersChange: (userIds: string[]) => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  activeUsers: ActiveUser[];
  rows?: number;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export function MentionTextarea({
  value,
  onChange,
  onMentionedUsersChange,
  onKeyDown,
  activeUsers,
  rows = 2,
  placeholder,
  className,
  disabled,
}: MentionTextareaProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // @mention state
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionStart, setMentionStart] = useState<number>(-1);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [mentionedUserIds, setMentionedUserIds] = useState<string[]>([]);

  // Portal position (fixed — escapes any overflow:hidden ancestor)
  const [dropdownPos, setDropdownPos] = useState<{
    top: number;
    left: number;
    width: number;
  } | null>(null);

  // Needed so createPortal only runs on the client
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  // Reset tracked IDs when field is cleared
  useEffect(() => {
    if (!value.trim()) {
      setMentionedUserIds([]);
      onMentionedUsersChange([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  // Close dropdown and recompute position on window scroll/resize
  useEffect(() => {
    function handleScroll() {
      if (mentionQuery === null) return;
      if (textareaRef.current) {
        const rect = textareaRef.current.getBoundingClientRect();
        setDropdownPos({ top: rect.bottom + 4, left: rect.left, width: Math.min(rect.width, 280) });
      }
    }
    window.addEventListener("scroll", handleScroll, true);
    window.addEventListener("resize", handleScroll);
    return () => {
      window.removeEventListener("scroll", handleScroll, true);
      window.removeEventListener("resize", handleScroll);
    };
  }, [mentionQuery]);

  const filteredUsers =
    mentionQuery !== null
      ? activeUsers
          .filter((u) => u.fullName.toLowerCase().includes(mentionQuery.toLowerCase()))
          .slice(0, 6)
      : [];

  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const val = e.target.value;
    const cursor = e.target.selectionStart ?? val.length;
    onChange(val);

    const textBeforeCursor = val.slice(0, cursor);
    // Match @<query> at the end — space/newline or start-of-string before @
    const match = textBeforeCursor.match(/(^|[\s\n])@([^\s@]*)$/);
    if (match) {
      const atIdx = textBeforeCursor.lastIndexOf("@");
      setMentionStart(atIdx);
      setMentionQuery(match[2]);
      setHighlightedIndex(0);

      // Compute fixed-position for the dropdown using viewport coordinates
      if (textareaRef.current) {
        const rect = textareaRef.current.getBoundingClientRect();
        setDropdownPos({
          top: rect.bottom + 4,
          left: rect.left,
          width: Math.min(rect.width, 280),
        });
      }
    } else {
      setMentionQuery(null);
      setMentionStart(-1);
      setDropdownPos(null);
    }
  }

  function selectUser(user: ActiveUser) {
    const cursor = textareaRef.current?.selectionStart ?? value.length;
    const before = value.slice(0, mentionStart);
    const after = value.slice(cursor);
    const insertText = `@${user.fullName} `;
    onChange(before + insertText + after);

    const newIds = [...mentionedUserIds, user.id];
    setMentionedUserIds(newIds);
    onMentionedUsersChange(newIds);

    setMentionQuery(null);
    setMentionStart(-1);
    setDropdownPos(null);

    setTimeout(() => {
      if (textareaRef.current) {
        const newPos = before.length + insertText.length;
        textareaRef.current.setSelectionRange(newPos, newPos);
        textareaRef.current.focus();
      }
    }, 0);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (mentionQuery !== null && filteredUsers.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setHighlightedIndex((i) => Math.min(i + 1, filteredUsers.length - 1));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setHighlightedIndex((i) => Math.max(i - 1, 0));
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        selectUser(filteredUsers[highlightedIndex]);
        return;
      }
      if (e.key === "Escape") {
        setMentionQuery(null);
        setDropdownPos(null);
        return;
      }
    }
    onKeyDown?.(e);
  }

  const dropdown =
    mounted && mentionQuery !== null && filteredUsers.length > 0 && dropdownPos
      ? createPortal(
          <div
            style={{
              position: "fixed",
              top: dropdownPos.top,
              left: dropdownPos.left,
              width: dropdownPos.width,
              zIndex: 9999,
            }}
            className="bg-white rounded-xl border border-gray-200 shadow-xl overflow-hidden"
          >
            <div className="px-3 py-1.5 border-b border-gray-100 bg-gray-50">
              <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">
                Mention a teammate
              </span>
            </div>
            {filteredUsers.map((user, i) => (
              <button
                key={user.id}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault(); // don't blur textarea
                  selectUser(user);
                }}
                className={`w-full flex items-center gap-3 px-3 py-2 text-left transition-colors ${
                  i === highlightedIndex
                    ? "bg-blue-50 text-blue-700"
                    : "text-gray-700 hover:bg-gray-50"
                }`}
              >
                <div
                  className={`w-7 h-7 rounded-full ${avatarColor(user.fullName)} flex items-center justify-center text-white text-[11px] font-bold shrink-0 overflow-hidden`}
                >
                  {user.avatarUrl ? (
                    <Image
                      src={user.avatarUrl}
                      alt={user.fullName}
                      width={28}
                      height={28}
                      className="w-full h-full object-cover"
                      unoptimized
                    />
                  ) : (
                    getInitials(user.fullName)
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{user.fullName}</p>
                  <p className="text-xs text-gray-400 truncate">{user.email}</p>
                </div>
              </button>
            ))}
          </div>,
          document.body
        )
      : null;

  return (
    <>
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        rows={rows}
        placeholder={placeholder}
        disabled={disabled}
        className={className}
      />
      {dropdown}
    </>
  );
}

/** Highlight @Name mentions in rendered comment text */
export function renderMentions(content: string, activeUsers: ActiveUser[]) {
  if (!content.includes("@") || activeUsers.length === 0) {
    return <span className="whitespace-pre-wrap">{content}</span>;
  }

  const escaped = activeUsers.map((u) =>
    u.fullName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  );
  const regex = new RegExp(`@(${escaped.join("|")})`, "g");

  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      parts.push(
        <span key={`t-${lastIndex}`} className="whitespace-pre-wrap">
          {content.slice(lastIndex, match.index)}
        </span>
      );
    }
    parts.push(
      <span
        key={`m-${match.index}`}
        className="inline-flex items-center bg-blue-100 text-blue-700 rounded-full px-1.5 py-0.5 text-xs font-semibold leading-tight"
      >
        @{match[1]}
      </span>
    );
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < content.length) {
    parts.push(
      <span key="t-end" className="whitespace-pre-wrap">
        {content.slice(lastIndex)}
      </span>
    );
  }

  return <>{parts}</>;
}
