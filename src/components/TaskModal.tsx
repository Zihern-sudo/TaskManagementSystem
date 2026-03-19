"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { toast } from "sonner";
import { Task, TaskPriority, TaskStatus, AssignedUser, PRIORITY_LABELS, PRIORITY_COLORS, PRIORITY_DOT, STATUS_LABELS, STATUS_COLORS } from "@/types";
import CommentSection from "./CommentSection";
import ConfirmDialog from "./ConfirmDialog";

interface TaskModalProps {
  task: Task | null;
  isNew: boolean;
  onClose: () => void;
  onSave: (task: Task) => void;
  onDelete: (id: string) => void;
  currentUserId: string;
  currentUserRole: string;
}

const STATUSES: TaskStatus[] = ["not_started", "in_progress", "in_review", "completed"];
const PRIORITIES: TaskPriority[] = ["low", "medium", "high", "critical"];

function getInitials(name: string) {
  return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
}

const AVATAR_COLORS = ["bg-indigo-500", "bg-blue-500", "bg-purple-500", "bg-pink-500", "bg-teal-500"];

// ── Multi-select Assignee Picker ───────────────────────────────────────────

interface AssigneePickerProps {
  users: AssignedUser[];
  selected: string[];
  onChange: (ids: string[]) => void;
}

function AssigneePicker({ users, selected, onChange }: AssigneePickerProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const filtered = users.filter((u) =>
    u.fullName.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase())
  );

  function toggle(id: string) {
    if (selected.includes(id)) {
      onChange(selected.filter((x) => x !== id));
    } else if (selected.length < 5) {
      onChange([...selected, id]);
    }
  }

  const selectedUsers = users.filter((u) => selected.includes(u.id));

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-left focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white flex items-center justify-between gap-2 min-h-[38px] hover:border-gray-300 transition-colors"
      >
        <div className="flex items-center gap-1.5 flex-wrap flex-1">
          {selectedUsers.length === 0 ? (
            <span className="text-gray-400 text-sm">Unassigned</span>
          ) : (
            selectedUsers.map((u, i) => (
              <span
                key={u.id}
                className="flex items-center gap-1 bg-blue-50 text-blue-700 text-xs rounded-full px-2 py-0.5"
              >
                <span
                  className={`w-4 h-4 rounded-full ${AVATAR_COLORS[i % AVATAR_COLORS.length]} flex items-center justify-center text-white overflow-hidden shrink-0`}
                  style={{ fontSize: "8px", fontWeight: "bold" }}
                >
                  {u.avatarUrl
                    ? <Image src={u.avatarUrl} alt={u.fullName} width={16} height={16} className="w-full h-full object-cover" unoptimized />
                    : getInitials(u.fullName)}
                </span>
                {u.fullName.split(" ")[0]}
                <span
                  className="ml-0.5 cursor-pointer hover:text-red-500"
                  onClick={(e) => { e.stopPropagation(); toggle(u.id); }}
                >
                  ×
                </span>
              </span>
            ))
          )}
        </div>
        <svg className={`w-3.5 h-3.5 text-gray-400 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
          <div className="p-2 border-b border-gray-100">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search members..."
              className="w-full text-sm px-3 py-1.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
            />
          </div>
          <div className="max-h-48 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-3">No members found</p>
            ) : (
              filtered.map((u, i) => {
                const checked = selected.includes(u.id);
                return (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => toggle(u.id)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-gray-50 transition-colors ${
                      !checked && selected.length >= 5 ? "opacity-40 cursor-not-allowed" : ""
                    }`}
                    disabled={!checked && selected.length >= 5}
                  >
                    <div className={`w-7 h-7 rounded-full ${AVATAR_COLORS[i % AVATAR_COLORS.length]} flex items-center justify-center text-white text-xs font-bold shrink-0 overflow-hidden`}>
                      {u.avatarUrl
                        ? <Image src={u.avatarUrl} alt={u.fullName} width={28} height={28} className="w-full h-full object-cover" unoptimized />
                        : getInitials(u.fullName)}
                    </div>
                    <div className="flex-1 text-left">
                      <p className="font-medium text-gray-900">{u.fullName}</p>
                      <p className="text-xs text-gray-400">{u.email}</p>
                    </div>
                    {checked && (
                      <svg className="w-4 h-4 text-blue-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </button>
                );
              })
            )}
          </div>
          {selected.length >= 5 && (
            <div className="px-3 py-2 border-t border-gray-100 bg-orange-50 text-xs text-orange-600">
              Maximum 5 assignees reached
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Metadata Field Row ─────────────────────────────────────────────────────

function MetaField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
        {label}
      </label>
      {children}
    </div>
  );
}

// ── Task Modal ─────────────────────────────────────────────────────────────

export default function TaskModal({ task, isNew, onClose, onSave, onDelete, currentUserId, currentUserRole }: TaskModalProps) {
  const [title, setTitle] = useState(task?.title ?? "");
  const [description, setDescription] = useState(task?.description ?? "");
  const [status, setStatus] = useState<TaskStatus>(task?.status ?? "not_started");
  const [priority, setPriority] = useState<TaskPriority>(task?.priority ?? "medium");
  const [dueDate, setDueDate] = useState(task?.dueDate ? task.dueDate.slice(0, 10) : "");
  const [assigneeIds, setAssigneeIds] = useState<string[]>(task?.assignees?.map((u) => u.id) ?? []);
  const [users, setUsers] = useState<AssignedUser[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    fetch("/api/users").then((r) => r.json()).then((d) => {
      if (d.data?.users) setUsers(d.data.users);
    });
  }, []);

  async function handleSave() {
    if (!title.trim()) { setError("Title is required."); return; }
    setSaving(true);
    setError("");
    try {
      const body = {
        title: title.trim(),
        description: description.trim() || null,
        status,
        priority,
        dueDate: dueDate || null,
        assigneeIds,
      };
      const res = await fetch(isNew ? "/api/tasks" : `/api/tasks/${task!.id}`, {
        method: isNew ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message || "Failed to save task.");
        toast.error(data.message || "Failed to save task.");
        return;
      }
      toast.success(isNew ? "Task created" : "Task updated");
      onSave(data.data.task);
    } catch {
      setError("Network error.");
      toast.error("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!task) return;
    try {
      await fetch(`/api/tasks/${task.id}`, { method: "DELETE" });
      toast.success("Task deleted");
      onDelete(task.id);
    } catch {
      toast.error("Failed to delete task.");
    }
    setShowDeleteConfirm(false);
  }

  // ── Create mode: compact centered form ──────────────────────────────────
  if (isNew) {
    return (
      <>
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={(e) => e.target === e.currentTarget && onClose()}>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-blue-100 flex items-center justify-center">
                  <svg className="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                </div>
                <h2 className="text-base font-bold text-gray-900">Create Task</h2>
              </div>
              <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Form */}
            <div className="p-6 space-y-4 overflow-y-auto max-h-[70vh]">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Title <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  autoFocus
                  className="w-full border border-gray-300 rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="What needs to be done?"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  className="w-full border border-gray-300 rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                  placeholder="Add a description..."
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Status</label>
                  <select value={status} onChange={(e) => setStatus(e.target.value as TaskStatus)} className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                    {STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Priority</label>
                  <select value={priority} onChange={(e) => setPriority(e.target.value as TaskPriority)} className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                    {PRIORITIES.map((p) => <option key={p} value={p}>{PRIORITY_LABELS[p]}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Due Date</label>
                <input type="date" value={dueDate} min={new Date().toISOString().slice(0, 10)} onChange={(e) => setDueDate(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Assignees <span className="text-gray-400 font-normal">(up to 5)</span></label>
                <AssigneePicker users={users} selected={assigneeIds} onChange={setAssigneeIds} />
              </div>
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50 rounded-b-xl">
              <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">Cancel</button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-5 py-2 text-sm font-semibold bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg transition-colors flex items-center gap-2"
              >
                {saving ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                    Creating...
                  </>
                ) : "Create Task"}
              </button>
            </div>
          </div>
        </div>
      </>
    );
  }

  // ── Edit mode: JIRA-style two-column layout ──────────────────────────────
  const canDelete = currentUserRole === "admin";

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={(e) => e.target === e.currentTarget && onClose()}>
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl max-h-[95vh] md:max-h-[92vh] flex flex-col">

          {/* Header */}
          <div className="flex items-center justify-between px-6 py-3.5 border-b border-gray-200 bg-gray-50/80 rounded-t-xl">
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${PRIORITY_DOT[priority]}`} />
              <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Task</span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[status]}`}>
                {STATUS_LABELS[status]}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              {canDelete && (
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  Delete
                </button>
              )}
              <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-200 rounded-lg transition-colors">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Body — stacks vertically on mobile, side-by-side on md+ */}
          <div className="flex-1 flex flex-col md:flex-row overflow-hidden min-h-0">

            {/* Left panel — title, description, comments */}
            <div className="flex-1 overflow-y-auto px-4 sm:px-8 py-5 sm:py-6 space-y-5 border-b md:border-b-0 md:border-r border-gray-100">
              {/* Title */}
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full text-xl font-bold text-gray-900 border-none focus:outline-none focus:ring-0 placeholder-gray-300 bg-transparent leading-tight"
                placeholder="Task title"
              />

              {/* Description */}
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={4}
                  className="w-full border border-gray-200 rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-y bg-gray-50 focus:bg-white transition-colors"
                  placeholder="Add a description..."
                />
              </div>

              {/* Activity / Comments */}
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Activity</label>
                <CommentSection taskId={task!.id} currentUserId={currentUserId} currentUserRole={currentUserRole} />
              </div>
            </div>

            {/* Right panel — metadata */}
            <div className="w-full md:w-64 xl:w-72 md:shrink-0 overflow-y-auto px-4 sm:px-5 py-4 sm:py-6 bg-gray-50/60 space-y-5">
              <MetaField label="Status">
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as TaskStatus)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white hover:border-gray-300 transition-colors"
                >
                  {STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
                </select>
              </MetaField>

              <MetaField label="Priority">
                <div className="relative">
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as TaskPriority)}
                    className="w-full border border-gray-200 rounded-lg pl-7 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white hover:border-gray-300 transition-colors appearance-none"
                  >
                    {PRIORITIES.map((p) => <option key={p} value={p}>{PRIORITY_LABELS[p]}</option>)}
                  </select>
                  <span className={`absolute left-2.5 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full pointer-events-none ${PRIORITY_DOT[priority]}`} />
                </div>
              </MetaField>

              <MetaField label="Due Date">
                <input
                  type="date"
                  value={dueDate}
                  min={new Date().toISOString().slice(0, 10)}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white hover:border-gray-300 transition-colors"
                />
              </MetaField>

              <MetaField label={`Assignees (up to 5)`}>
                <AssigneePicker users={users} selected={assigneeIds} onChange={setAssigneeIds} />
              </MetaField>

              {/* Priority badge preview */}
              <div className="pt-1">
                <span className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium ${PRIORITY_COLORS[priority]}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${PRIORITY_DOT[priority]}`} />
                  {PRIORITY_LABELS[priority]} Priority
                </span>
              </div>

              {/* Timestamps */}
              {task && (
                <div className="pt-4 border-t border-gray-200 space-y-2.5">
                  <div className="flex items-center justify-between text-xs text-gray-400">
                    <span className="font-medium text-gray-500">Created</span>
                    <span>{new Date(task.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-gray-400">
                    <span className="font-medium text-gray-500">Updated</span>
                    <span>{new Date(task.updatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-6 py-3.5 border-t border-gray-200 bg-gray-50/80 rounded-b-xl">
            {error ? (
              <p className="text-sm text-red-600 flex items-center gap-1.5">
                <svg className="w-4 h-4 shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" /></svg>
                {error}
              </p>
            ) : (
              <span className="text-xs text-gray-400">Changes are saved when you click Save</span>
            )}
            <div className="flex items-center gap-3">
              <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-5 py-2 text-sm font-semibold bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg transition-colors flex items-center gap-2"
              >
                {saving ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                    Saving...
                  </>
                ) : "Save Changes"}
              </button>
            </div>
          </div>

        </div>
      </div>

      {showDeleteConfirm && task && (
        <ConfirmDialog
          title="Delete Task"
          message={`"${task.title}" and all its comments will be permanently deleted.`}
          confirmLabel="Delete Task"
          variant="danger"
          onConfirm={handleDelete}
          onCancel={() => setShowDeleteConfirm(false)}
        />
      )}
    </>
  );
}
