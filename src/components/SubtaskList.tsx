"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { Subtask, TaskPriority, TaskStatus, PRIORITY_DOT, STATUS_LABELS, STATUS_COLORS } from "@/types";

interface SubtaskListProps {
  parentTaskId: string;
  subtasks: Subtask[];
  subtaskCount: number;
  completedSubtaskCount: number;
  currentUserRole: string;
  /** Called when a subtask is created, updated, or deleted so the parent can refresh */
  onSubtasksChange: (updatedSubtasks: Subtask[], completedCount: number) => void;
  /** Called after a subtask status change triggers a server-side parent status rollup */
  onParentStatusChange?: (newStatus: TaskStatus) => void;
}

const STATUSES: TaskStatus[] = ["not_started", "in_progress", "in_review", "completed"];
const PRIORITIES: TaskPriority[] = ["low", "medium", "high", "critical"];
const PRIORITY_LABELS_SHORT: Record<TaskPriority, string> = {
  low: "Low",
  medium: "Med",
  high: "High",
  critical: "Crit",
};

// ── Inline Add Subtask Form ─────────────────────────────────────────────────

interface AddSubtaskFormProps {
  parentTaskId: string;
  onCreated: (subtask: Subtask) => void;
  onCancel: () => void;
}

function AddSubtaskForm({ parentTaskId, onCreated, onCancel }: AddSubtaskFormProps) {
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState<TaskPriority>("medium");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/tasks/${parentTaskId}/subtasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim(), priority }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.message || "Failed to create subtask.");
        return;
      }
      toast.success("Subtask created");
      onCreated(data.data.subtask);
      setTitle("");
      setPriority("medium");
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-2 mt-2 p-2.5 bg-slate-50 rounded-xl border border-slate-200">
      <span className={`w-2 h-2 rounded-full shrink-0 ${PRIORITY_DOT[priority]}`} />
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Subtask title…"
        autoFocus
        className="flex-1 text-sm bg-transparent border-none focus:outline-none placeholder-slate-400 text-slate-800 min-w-0"
      />
      <select
        value={priority}
        onChange={(e) => setPriority(e.target.value as TaskPriority)}
        className="text-xs border border-slate-200 rounded-lg px-2 py-1 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400 shrink-0"
      >
        {PRIORITIES.map((p) => (
          <option key={p} value={p}>{PRIORITY_LABELS_SHORT[p]}</option>
        ))}
      </select>
      <button
        type="submit"
        disabled={saving || !title.trim()}
        className="px-3 py-1 text-xs font-bold text-white rounded-lg disabled:opacity-50 shrink-0"
        style={{ background: "linear-gradient(135deg, #4f46e5, #7c3aed)" }}
      >
        {saving ? "Adding…" : "Add"}
      </button>
      <button
        type="button"
        onClick={onCancel}
        className="p-1 text-slate-400 hover:text-slate-600 rounded-lg transition-colors shrink-0"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </form>
  );
}

// ── Single Subtask Row ──────────────────────────────────────────────────────

interface SubtaskRowProps {
  subtask: Subtask;
  onStatusChange: (id: string, status: TaskStatus) => void;
  onTitleChange: (id: string, title: string) => void;
  onDelete: (id: string) => void;
  isAdmin: boolean;
}

function SubtaskRow({ subtask, onStatusChange, onTitleChange, onDelete, isAdmin }: SubtaskRowProps) {
  const [updating, setUpdating] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(subtask.title);
  const editInputRef = useRef<HTMLInputElement>(null);

  async function handleStatusChange(newStatus: TaskStatus) {
    if (updating) return;
    setUpdating(true);
    try {
      const res = await fetch(`/api/tasks/${subtask.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) {
        toast.error("Failed to update subtask status.");
        return;
      }
      onStatusChange(subtask.id, newStatus);
    } catch {
      toast.error("Network error.");
    } finally {
      setUpdating(false);
    }
  }

  function startEditing() {
    if (!isAdmin) return;
    setEditTitle(subtask.title);
    setIsEditing(true);
    setTimeout(() => editInputRef.current?.focus(), 0);
  }

  async function commitEdit() {
    const trimmed = editTitle.trim();
    if (!trimmed) {
      cancelEdit();
      return;
    }
    if (trimmed === subtask.title) {
      setIsEditing(false);
      return;
    }
    try {
      const res = await fetch(`/api/tasks/${subtask.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: trimmed }),
      });
      if (!res.ok) {
        toast.error("Failed to rename subtask.");
        cancelEdit();
        return;
      }
      onTitleChange(subtask.id, trimmed);
      setIsEditing(false);
    } catch {
      toast.error("Network error.");
      cancelEdit();
    }
  }

  function cancelEdit() {
    setEditTitle(subtask.title);
    setIsEditing(false);
  }

  function handleEditKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") { e.preventDefault(); commitEdit(); }
    if (e.key === "Escape") cancelEdit();
  }

  async function handleDelete() {
    if (deleting) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/tasks/${subtask.id}`, { method: "DELETE" });
      if (!res.ok) {
        toast.error("Failed to delete subtask.");
        setDeleting(false);
        return;
      }
      toast.success("Subtask deleted");
      onDelete(subtask.id);
    } catch {
      toast.error("Network error.");
      setDeleting(false);
    }
  }

  const isDone = subtask.status === "completed";

  return (
    <div className="flex items-center gap-2.5 py-2 px-2.5 rounded-xl hover:bg-slate-50 group transition-colors">
      {/* Checkbox-style status toggle */}
      <button
        type="button"
        onClick={() => handleStatusChange(isDone ? "in_progress" : "completed")}
        disabled={updating}
        title={isDone ? "Mark incomplete" : "Mark complete"}
        className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${
          isDone
            ? "border-green-500 bg-green-500"
            : "border-slate-300 hover:border-indigo-400"
        } disabled:opacity-50`}
      >
        {isDone && (
          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
          </svg>
        )}
      </button>

      {/* Priority dot */}
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${PRIORITY_DOT[subtask.priority]}`} />

      {/* Title — double-click to edit (admin only) */}
      {isEditing ? (
        <input
          ref={editInputRef}
          type="text"
          value={editTitle}
          onChange={(e) => setEditTitle(e.target.value)}
          onBlur={commitEdit}
          onKeyDown={handleEditKeyDown}
          className="flex-1 text-sm min-w-0 border border-indigo-300 rounded-lg px-2 py-0.5 focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white text-slate-800"
        />
      ) : (
        <span
          onDoubleClick={startEditing}
          title={isAdmin ? "Double-click to rename" : undefined}
          className={`flex-1 text-sm min-w-0 truncate ${isDone ? "line-through text-slate-400" : "text-slate-700"} ${isAdmin ? "cursor-text" : ""}`}
        >
          {subtask.title}
        </span>
      )}

      {/* Status badge (small) */}
      <select
        value={subtask.status}
        onChange={(e) => handleStatusChange(e.target.value as TaskStatus)}
        disabled={updating}
        className={`hidden sm:block text-[10px] font-bold rounded-full px-2 py-0.5 border cursor-pointer focus:outline-none focus:ring-1 focus:ring-indigo-400 appearance-none text-center shrink-0 ${STATUS_COLORS[subtask.status]} disabled:opacity-50`}
        style={{ minWidth: "80px" }}
      >
        {STATUSES.map((s) => (
          <option key={s} value={s}>{STATUS_LABELS[s]}</option>
        ))}
      </select>

      {/* Delete button (admin only) */}
      {isAdmin && (
        <button
          type="button"
          onClick={handleDelete}
          disabled={deleting}
          title="Delete subtask"
          className="opacity-0 group-hover:opacity-100 p-1 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all shrink-0 disabled:opacity-50"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      )}
    </div>
  );
}

// ── SubtaskList ─────────────────────────────────────────────────────────────

export default function SubtaskList({
  parentTaskId,
  subtasks: initialSubtasks,
  subtaskCount: initialCount,
  completedSubtaskCount: initialCompleted,
  currentUserRole,
  onSubtasksChange,
  onParentStatusChange,
}: SubtaskListProps) {
  const [subtasks, setSubtasks] = useState<Subtask[]>(initialSubtasks);
  const [completedCount, setCompletedCount] = useState(initialCompleted);
  const [showAddForm, setShowAddForm] = useState(false);
  const isAdmin = currentUserRole === "admin";

  const total = subtasks.length;
  const progressPct = total > 0 ? Math.round((completedCount / total) * 100) : 0;

  function updateAndNotify(updated: Subtask[]) {
    const done = updated.filter((s) => s.status === "completed").length;
    setSubtasks(updated);
    setCompletedCount(done);
    onSubtasksChange(updated, done);
  }

  function handleSubtaskCreated(subtask: Subtask) {
    updateAndNotify([...subtasks, subtask]);
    setShowAddForm(false);
  }

  async function handleStatusChange(id: string, status: TaskStatus) {
    updateAndNotify(subtasks.map((s) => (s.id === id ? { ...s, status } : s)));
    // Fetch the parent's status after syncParentStatus has run server-side
    if (onParentStatusChange) {
      try {
        const res = await fetch(`/api/tasks/${parentTaskId}`);
        if (res.ok) {
          const data = await res.json();
          onParentStatusChange(data.data.task.status);
        }
      } catch {
        // Non-critical — modal status may be stale until reopened
      }
    }
  }

  function handleTitleChange(id: string, title: string) {
    updateAndNotify(subtasks.map((s) => (s.id === id ? { ...s, title } : s)));
  }

  function handleDelete(id: string) {
    updateAndNotify(subtasks.filter((s) => s.id !== id));
  }

  const [markingAllDone, setMarkingAllDone] = useState(false);

  async function handleMarkAllDone() {
    if (markingAllDone) return;
    setMarkingAllDone(true);
    try {
      const res = await fetch(`/api/tasks/${parentTaskId}/subtasks/bulk-complete`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.message || "Failed to mark all subtasks as done.");
        return;
      }
      updateAndNotify(data.data.subtasks);
      // Fetch updated parent status and notify
      if (onParentStatusChange) {
        const parentRes = await fetch(`/api/tasks/${parentTaskId}`);
        if (parentRes.ok) {
          const parentData = await parentRes.json();
          onParentStatusChange(parentData.data.task.status);
        }
      }
    } catch {
      toast.error("Network error.");
    } finally {
      setMarkingAllDone(false);
    }
  }

  return (
    <div className="space-y-2">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <svg className="w-3.5 h-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
          </svg>
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            Subtasks
          </span>
          {total > 0 && (
            <span className="text-[10px] font-bold text-slate-500 tabular-nums">
              {completedCount}/{total}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1">
          {isAdmin && total > 0 && completedCount < total && (
            <button
              type="button"
              onClick={handleMarkAllDone}
              disabled={markingAllDone}
              className="flex items-center gap-1 text-[10px] font-bold text-green-600 hover:text-green-800 hover:bg-green-50 px-2 py-1 rounded-lg transition-colors disabled:opacity-50"
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
              {markingAllDone ? "Marking…" : "Mark all done"}
            </button>
          )}
          {isAdmin && !showAddForm && (
            <button
              type="button"
              onClick={() => setShowAddForm(true)}
              className="flex items-center gap-1 text-[10px] font-bold text-indigo-500 hover:text-indigo-700 hover:bg-indigo-50 px-2 py-1 rounded-lg transition-colors"
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
              </svg>
              Add subtask
            </button>
          )}
        </div>
      </div>

      {/* Progress bar */}
      {total > 0 && (
        <div className="flex items-center gap-2">
          <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${progressPct}%`,
                background: progressPct === 100
                  ? "linear-gradient(90deg, #22c55e, #16a34a)"
                  : "linear-gradient(90deg, #4f46e5, #7c3aed)",
              }}
            />
          </div>
          <span className="text-[10px] font-bold text-slate-400 tabular-nums w-8 text-right shrink-0">
            {progressPct}%
          </span>
        </div>
      )}

      {/* Subtask rows */}
      {subtasks.length === 0 && !showAddForm ? (
        <p className="text-xs text-slate-400 py-1 pl-1">No subtasks yet.{isAdmin ? " Click \"Add subtask\" to create one." : ""}</p>
      ) : (
        <div className="divide-y divide-slate-50">
          {subtasks.map((subtask) => (
            <SubtaskRow
              key={subtask.id}
              subtask={subtask}
              onStatusChange={handleStatusChange}
              onTitleChange={handleTitleChange}
              onDelete={handleDelete}
              isAdmin={isAdmin}
            />
          ))}
        </div>
      )}

      {/* Inline add form */}
      {showAddForm && (
        <AddSubtaskForm
          parentTaskId={parentTaskId}
          onCreated={handleSubtaskCreated}
          onCancel={() => setShowAddForm(false)}
        />
      )}
    </div>
  );
}
