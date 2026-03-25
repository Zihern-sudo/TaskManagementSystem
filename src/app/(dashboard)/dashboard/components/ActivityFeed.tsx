"use client";

export interface ActivityItem {
  id: string;
  content: string;
  authorName: string;
  authorAvatar?: string | null;
  taskTitle: string;
  taskId: string;
  createdAt: string;
}

function getInitials(name: string) {
  return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function stripMentions(text: string): string {
  return text.replace(/@\[([^\]]+)\]\([^)]+\)/g, "@$1");
}

const AVATAR_COLORS = [
  "bg-indigo-500", "bg-violet-500", "bg-emerald-500",
  "bg-orange-500", "bg-pink-500", "bg-teal-500",
];

function avatarColor(name: string) {
  const sum = name.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  return AVATAR_COLORS[sum % AVATAR_COLORS.length];
}

export default function ActivityFeed({ items }: { items: ActivityItem[] }) {
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-slate-400 gap-2">
        <svg className="w-8 h-8 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
        <p className="text-sm">No recent activity</p>
      </div>
    );
  }

  return (
    <ul className="divide-y divide-slate-100">
      {items.map((item) => (
        <li key={item.id} className="flex gap-3 py-3 first:pt-0 last:pb-0">
          {/* Avatar */}
          <div className={`w-7 h-7 rounded-full shrink-0 flex items-center justify-center text-white text-[10px] font-bold mt-0.5 ${avatarColor(item.authorName)}`}>
            {getInitials(item.authorName)}
          </div>
          {/* Content */}
          <div className="min-w-0 flex-1">
            <p className="text-[12px] text-slate-500 leading-snug">
              <span className="font-semibold text-slate-700">{item.authorName}</span>
              {" commented on "}
              <span className="font-medium text-indigo-600 truncate">{item.taskTitle}</span>
            </p>
            <p className="text-[12px] text-slate-400 mt-0.5 line-clamp-2 leading-snug">
              {stripMentions(item.content)}
            </p>
          </div>
          {/* Time */}
          <span className="text-[11px] text-slate-400 shrink-0 mt-0.5">{timeAgo(item.createdAt)}</span>
        </li>
      ))}
    </ul>
  );
}
