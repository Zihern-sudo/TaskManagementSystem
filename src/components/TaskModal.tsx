"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { toast } from "sonner";
import { Task, TaskPriority, TaskStatus, AssignedUser, PRIORITY_LABELS, PRIORITY_COLORS, PRIORITY_DOT, STATUS_LABELS, STATUS_COLORS } from "@/types";
import { useCustomFields } from "@/contexts/CustomFieldsContext";
import { useFieldLayout } from "@/context/FieldLayoutContext";
import CommentSection from "./CommentSection";
import ConfirmDialog from "./ConfirmDialog";
import SubtaskList from "./SubtaskList";
import { Subtask } from "@/types";
import { DndContext, closestCenter, DragEndEvent } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

const MODAL_SYSTEM_FIELD_LABELS: Record<string, string> = {
  title: "Title",
  description: "Description",
  status: "Status",
  priority: "Priority",
  due_date: "Due Date",
  assignees: "Assignees",
  created_at: "Created At",
};

function SortableFieldItem({ id, label }: { id: string; label: string }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };
  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm font-medium text-slate-700 shadow-sm select-none">
      <button {...attributes} {...listeners} className="cursor-grab text-slate-300 hover:text-slate-500 touch-none shrink-0">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>
      <span className="flex-1 truncate">{label}</span>
    </div>
  );
}

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

const AVATAR_COLORS = ["bg-indigo-500", "bg-indigo-500", "bg-purple-500", "bg-pink-500", "bg-teal-500"];

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
        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-left focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white flex items-center justify-between gap-2 min-h-[38px] hover:border-slate-300 transition-colors"
      >
        <div className="flex items-center gap-1.5 flex-wrap flex-1">
          {selectedUsers.length === 0 ? (
            <span className="text-slate-400 text-sm">Unassigned</span>
          ) : (
            selectedUsers.map((u, i) => (
              <span
                key={u.id}
                className="flex items-center gap-1 bg-indigo-50 text-indigo-700 text-xs rounded-full px-2 py-0.5"
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
        <svg className={`w-3.5 h-3.5 text-slate-400 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden">
          <div className="p-2 border-b border-slate-100">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search members..."
              className="w-full text-sm px-3 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              autoFocus
            />
          </div>
          <div className="max-h-48 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-3">No members found</p>
            ) : (
              filtered.map((u, i) => {
                const checked = selected.includes(u.id);
                return (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => toggle(u.id)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-slate-50 transition-colors ${
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
                      <p className="font-medium text-slate-900">{u.fullName}</p>
                      <p className="text-xs text-slate-400">{u.email}</p>
                    </div>
                    {checked && (
                      <svg className="w-4 h-4 text-indigo-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </button>
                );
              })
            )}
          </div>
          {selected.length >= 5 && (
            <div className="px-3 py-2 border-t border-slate-100 bg-orange-50 text-xs text-orange-600">
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
      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">
        {label}
      </label>
      {children}
    </div>
  );
}

// ── Task Modal ─────────────────────────────────────────────────────────────

export default function TaskModal({ task, isNew, onClose, onSave, onDelete, currentUserId, currentUserRole }: TaskModalProps) {
  const { taskFields: customFieldDefs } = useCustomFields();
  const { modalLayout, saveModalLayout, taskFormLayout, saveTaskFormLayout } = useFieldLayout();
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
  const [subtasks, setSubtasks] = useState<Subtask[]>(task?.subtasks ?? []);
  const [completedSubtaskCount, setCompletedSubtaskCount] = useState(task?.completedSubtaskCount ?? 0);
  const [wasAutoUpdated, setWasAutoUpdated] = useState(false);
  const autoUpdateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isCustomizing, setIsCustomizing] = useState(false);
  const [localLayout, setLocalLayout] = useState<string[]>([]);
  const [savingLayout, setSavingLayout] = useState(false);
  const [isCustomizingCreate, setIsCustomizingCreate] = useState(false);
  const [localCreateLayout, setLocalCreateLayout] = useState<string[]>([]);
  const [savingCreateLayout, setSavingCreateLayout] = useState(false);

  // Custom field values keyed by fieldId
  const [cfValues, setCfValues] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    if (task?.customFields) {
      for (const cf of task.customFields) {
        init[cf.fieldId] = cf.value;
      }
    }
    return init;
  });

  useEffect(() => {
    fetch("/api/users").then((r) => r.json()).then((d) => {
      if (d.data?.users) setUsers(d.data.users);
    });
  }, []);

  async function handleSave() {
    if (!title.trim()) { setError("Title is required."); return; }

    // Validate required custom fields
    const missingRequired = customFieldDefs.filter(
      (def) => def.required && !cfValues[def.id]?.trim()
    );
    if (missingRequired.length > 0) {
      setError(`Please fill in the required field: ${missingRequired.map((d) => d.label).join(", ")}`);
      return;
    }

    setSaving(true);
    setError("");
    try {
      const body: Record<string, unknown> = {
        title: title.trim(),
        description: description.trim() || null,
        status,
        priority,
        dueDate: dueDate || null,
      };
      // Only admins can set/change assignees
      if (currentUserRole === "admin") {
        body.assigneeIds = assigneeIds;
      }
      // Custom field values
      body.customFieldValues = Object.entries(cfValues)
        .filter(([, v]) => v !== "")
        .map(([fieldId, value]) => ({ fieldId, value }));
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={(e) => e.target === e.currentTarget && onClose()}>
          <div className="bg-white rounded-2xl shadow-[0_24px_80px_rgba(15,23,42,0.2)] w-full max-w-lg flex flex-col overflow-hidden animate-scale-in">
            {/* Gradient accent bar */}
            <div className="h-1.5 w-full" style={{ background: "linear-gradient(90deg, #4f46e5, #7c3aed, #ec4899)" }} />
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center shadow-sm" style={{ background: "linear-gradient(135deg, #4f46e5, #7c3aed)" }}>
                  <svg className="w-4.5 h-4.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900 leading-tight">Create Task</h2>
                  <p className="text-[11px] text-slate-400 font-medium">Add a new task to your board</p>
                </div>
              </div>
              <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors">
                <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Form */}
            <div className="p-6 space-y-4 overflow-y-auto max-h-[70vh]">
              {/* Reorder Fields button */}
              <div className="flex items-center justify-end">
                <button
                  type="button"
                  onClick={() => { setLocalCreateLayout([...taskFormLayout]); setIsCustomizingCreate(true); }}
                  className="flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 px-2.5 py-1.5 rounded-lg transition-colors"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                  Reorder Fields
                </button>
              </div>

              {/* Reorder panel */}
              {isCustomizingCreate && (
                <div className="border border-indigo-100 bg-indigo-50/40 rounded-xl p-4 space-y-3">
                  <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">Drag to reorder</p>
                  <DndContext
                    collisionDetection={closestCenter}
                    onDragEnd={(event: DragEndEvent) => {
                      const { active, over } = event;
                      if (over && active.id !== over.id) {
                        setLocalCreateLayout((prev) => arrayMove(prev, prev.indexOf(String(active.id)), prev.indexOf(String(over.id))));
                      }
                    }}
                  >
                    <SortableContext items={localCreateLayout} strategy={verticalListSortingStrategy}>
                      <div className="space-y-2">
                        {localCreateLayout.map((fieldId) => {
                          const label = MODAL_SYSTEM_FIELD_LABELS[fieldId] ?? customFieldDefs.find((f) => f.id === fieldId)?.label ?? fieldId;
                          return <SortableFieldItem key={fieldId} id={fieldId} label={label} />;
                        })}
                      </div>
                    </SortableContext>
                  </DndContext>
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={async () => {
                        setSavingCreateLayout(true);
                        await saveTaskFormLayout(localCreateLayout);
                        setSavingCreateLayout(false);
                        setIsCustomizingCreate(false);
                      }}
                      disabled={savingCreateLayout}
                      className="px-4 py-1.5 text-xs font-bold text-white rounded-lg disabled:opacity-50 flex items-center gap-1.5"
                      style={{ background: "linear-gradient(135deg, #4f46e5, #7c3aed)" }}
                    >
                      {savingCreateLayout ? "Saving…" : "Save Layout"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsCustomizingCreate(false)}
                      className="px-4 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-200 rounded-lg transition-colors"
                    >
                      Cancel
                    </button>
                    <span className="text-[10px] text-slate-400 ml-1">Your personal layout is saved</span>
                  </div>
                </div>
              )}

              {/* All fields rendered in taskFormLayout order */}
              {taskFormLayout.map((fieldId) => {
                if (fieldId === "title") return (
                  <div key="title">
                    <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Title <span className="text-red-400">*</span></label>
                    <input
                      type="text"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      autoFocus
                      className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent bg-slate-50 focus:bg-white transition-all placeholder-slate-400"
                      placeholder="What needs to be done?"
                    />
                  </div>
                );
                if (fieldId === "description") return (
                  <div key="description">
                    <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Description</label>
                    <textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      rows={3}
                      className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent resize-none bg-slate-50 focus:bg-white transition-all placeholder-slate-400"
                      placeholder="Add a description…"
                    />
                  </div>
                );
                if (fieldId === "status") return (
                  <div key="status">
                    <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Status</label>
                    <select value={status} onChange={(e) => setStatus(e.target.value as TaskStatus)} className="w-full border border-slate-200 rounded-xl px-3.5 py-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-slate-50 focus:bg-white transition-all">
                      {STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
                    </select>
                  </div>
                );
                if (fieldId === "priority") return (
                  <div key="priority">
                    <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Priority</label>
                    <select value={priority} onChange={(e) => setPriority(e.target.value as TaskPriority)} className="w-full border border-slate-200 rounded-xl px-3.5 py-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-slate-50 focus:bg-white transition-all">
                      {PRIORITIES.map((p) => <option key={p} value={p}>{PRIORITY_LABELS[p]}</option>)}
                    </select>
                  </div>
                );
                if (fieldId === "due_date") return (
                  <div key="due_date">
                    <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Due Date</label>
                    <input type="date" value={dueDate} min={new Date().toISOString().slice(0, 10)} onChange={(e) => setDueDate(e.target.value)} className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-slate-50 focus:bg-white transition-all" />
                  </div>
                );
                if (fieldId === "assignees") return (
                  <div key="assignees">
                    <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Assignees <span className="text-slate-400 font-normal normal-case">(up to 5)</span></label>
                    <AssigneePicker users={users} selected={assigneeIds} onChange={setAssigneeIds} />
                  </div>
                );
                // Custom field
                const def = customFieldDefs.find((f) => f.id === fieldId);
                if (!def) return null;
                return (
                  <div key={def.id}>
                    <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">
                      {def.label}
                      {def.required && <span className="text-red-400 ml-1">*</span>}
                    </label>
                    {def.type === "picklist" ? (
                      <select
                        value={cfValues[def.id] ?? ""}
                        onChange={(e) => setCfValues((prev) => ({ ...prev, [def.id]: e.target.value }))}
                        className="w-full border border-slate-200 rounded-xl px-3.5 py-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-slate-50 focus:bg-white transition-all"
                      >
                        <option value="">— Select —</option>
                        {def.options.map((opt) => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type="text"
                        value={cfValues[def.id] ?? ""}
                        onChange={(e) => setCfValues((prev) => ({ ...prev, [def.id]: e.target.value }))}
                        placeholder={`Enter ${def.label.toLowerCase()}…`}
                        className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent bg-slate-50 focus:bg-white transition-all placeholder-slate-400"
                      />
                    )}
                  </div>
                );
              })}

              {error && (
                <div className="flex items-center gap-2.5 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
                  <svg className="w-4 h-4 shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" /></svg>
                  {error}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50/80">
              <button onClick={onClose} className="px-5 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-200 rounded-xl transition-colors">Cancel</button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-6 py-2.5 text-sm font-bold text-white rounded-xl transition-all shadow-sm hover:shadow-md active:scale-[0.97] disabled:opacity-50 flex items-center gap-2"
                style={{ background: "linear-gradient(135deg, #4f46e5, #7c3aed)" }}
              >
                {saving ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                    Creating…
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

  // Read-only when the current user is not an admin and is not assigned to this task
  const isReadOnly =
    currentUserRole !== "admin" &&
    (task?.assignees?.length ?? 0) > 0 &&
    !task?.assignees?.some((a) => a.id === currentUserId);

  const PRIORITY_GRADIENT: Record<string, string> = {
    critical: "linear-gradient(90deg, #ef4444, #f97316)",
    high: "linear-gradient(90deg, #f97316, #eab308)",
    medium: "linear-gradient(90deg, #4f46e5, #7c3aed)",
    low: "linear-gradient(90deg, #64748b, #94a3b8)",
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={(e) => e.target === e.currentTarget && onClose()}>
        <div className="bg-white rounded-2xl shadow-[0_24px_80px_rgba(15,23,42,0.2)] w-full max-w-5xl max-h-[95vh] md:max-h-[92vh] flex flex-col overflow-hidden animate-scale-in">

          {/* Priority-colored gradient accent bar */}
          <div className="h-1.5 w-full shrink-0" style={{ background: PRIORITY_GRADIENT[priority] }} />

          {/* View-only banner */}
          {isReadOnly && (
            <div className="flex items-center gap-2 px-6 py-2 bg-amber-50 border-b border-amber-200 shrink-0">
              <svg className="w-4 h-4 text-amber-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
              <span className="text-xs font-semibold text-amber-700">View Only — you are not assigned to this task and cannot save changes.</span>
            </div>
          )}

          {/* Header */}
          <div className="flex items-center justify-between px-6 py-3.5 border-b border-slate-100 bg-slate-50/70 shrink-0">
            <div className="flex items-center gap-2.5">
              <span className={`w-2.5 h-2.5 rounded-full ${PRIORITY_DOT[priority]} ring-2 ring-white shadow-sm`} />
              <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Task</span>
              <span className={`text-xs px-2.5 py-1 rounded-full font-bold ${STATUS_COLORS[status]}`}>
                {STATUS_LABELS[status]}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              {canDelete && (
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-red-500 hover:text-red-700 hover:bg-red-50 rounded-xl transition-colors"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  Delete
                </button>
              )}
              <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-xl transition-colors">
                <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Body — stacks vertically on mobile, side-by-side on md+ */}
          <div className="flex-1 flex flex-col md:flex-row overflow-hidden min-h-0">

            {/* Left panel — title, description, comments */}
            <div className="flex-1 overflow-y-auto px-5 sm:px-8 py-6 space-y-5 border-b md:border-b-0 md:border-r border-slate-100">
              {/* Title */}
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full text-xl font-bold text-slate-900 border-none focus:outline-none focus:ring-0 placeholder-slate-300 bg-transparent leading-tight"
                placeholder="Task title"
              />

              {/* Description */}
              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2">Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={4}
                  className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent resize-y bg-slate-50 focus:bg-white transition-all placeholder-slate-400"
                  placeholder="Add a description…"
                />
              </div>

              {/* Subtasks — only on top-level tasks (no parentId) */}
              {!task?.parentId && (
                <div className="border-t border-slate-100 pt-4">
                  <SubtaskList
                    parentTaskId={task!.id}
                    subtasks={subtasks}
                    subtaskCount={subtasks.length}
                    completedSubtaskCount={completedSubtaskCount}
                    currentUserRole={currentUserRole}
                    onSubtasksChange={(updated, done) => {
                      setSubtasks(updated);
                      setCompletedSubtaskCount(done);
                    }}
                    onParentStatusChange={(newStatus) => {
                      setStatus(newStatus);
                      setWasAutoUpdated(true);
                      toast.info(`Status auto-updated to "${STATUS_LABELS[newStatus]}" based on subtask progress.`);
                      if (autoUpdateTimerRef.current) clearTimeout(autoUpdateTimerRef.current);
                      autoUpdateTimerRef.current = setTimeout(() => setWasAutoUpdated(false), 3000);
                    }}
                  />
                </div>
              )}

              {/* Activity / Comments */}
              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-3">Activity</label>
                <CommentSection taskId={task!.id} currentUserId={currentUserId} currentUserRole={currentUserRole} />
              </div>
            </div>

            {/* Right panel — metadata */}
            <div className="w-full md:w-68 xl:w-72 md:shrink-0 overflow-y-auto px-5 py-5 bg-slate-50/80">
              {/* Panel header with Customize button (admin only) */}
              <div className="flex items-center justify-between mb-4">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Details</span>
                {!isCustomizing && (
                  <button
                    onClick={() => { setLocalLayout([...modalLayout]); setIsCustomizing(true); }}
                    className="flex items-center gap-1 text-[11px] font-semibold text-indigo-500 hover:text-indigo-700 hover:bg-indigo-50 px-2 py-1 rounded-lg transition-colors"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                    </svg>
                    Reorder
                  </button>
                )}
              </div>

              {isCustomizing ? (
                /* ── Customize mode: drag-and-drop field reorder ── */
                <div className="space-y-3">
                  <p className="text-xs text-slate-500">Drag fields to reorder. Your personal layout is saved.</p>
                  <DndContext
                    collisionDetection={closestCenter}
                    onDragEnd={(event: DragEndEvent) => {
                      const { active, over } = event;
                      if (over && active.id !== over.id) {
                        setLocalLayout((prev) => {
                          const oldIndex = prev.indexOf(active.id as string);
                          const newIndex = prev.indexOf(over.id as string);
                          return arrayMove(prev, oldIndex, newIndex);
                        });
                      }
                    }}
                  >
                    <SortableContext items={localLayout} strategy={verticalListSortingStrategy}>
                      <div className="space-y-1.5">
                        {localLayout.map((id) => {
                          const label = MODAL_SYSTEM_FIELD_LABELS[id] ?? customFieldDefs.find((d) => d.id === id)?.label ?? id;
                          return <SortableFieldItem key={id} id={id} label={label} />;
                        })}
                      </div>
                    </SortableContext>
                  </DndContext>
                  <div className="flex items-center gap-2 pt-2">
                    <button
                      onClick={async () => {
                        setSavingLayout(true);
                        await saveModalLayout(localLayout);
                        setSavingLayout(false);
                        setIsCustomizing(false);
                        toast.success("Layout saved.");
                      }}
                      disabled={savingLayout}
                      className="flex-1 py-2 text-sm font-bold text-white rounded-xl disabled:opacity-50 flex items-center justify-center gap-1.5"
                      style={{ background: "linear-gradient(135deg, #4f46e5, #7c3aed)" }}
                    >
                      {savingLayout ? "Saving…" : "Save Layout"}
                    </button>
                    <button
                      onClick={() => setIsCustomizing(false)}
                      className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-200 rounded-xl transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                /* ── Normal mode: dynamic field rendering ── */
                <div className="space-y-4">
                  {modalLayout.map((fieldId) => {
                    if (fieldId === "status") {
                      return (
                        <MetaField key="status" label="Status">
                          <div className="relative">
                            <select
                              value={status}
                              onChange={(e) => { setStatus(e.target.value as TaskStatus); setWasAutoUpdated(false); }}
                              className={`w-full border rounded-xl px-3.5 py-2.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white hover:border-slate-300 transition-colors ${wasAutoUpdated ? "border-indigo-400 ring-2 ring-indigo-200" : "border-slate-200"}`}
                            >
                              {STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
                            </select>
                            {wasAutoUpdated && (
                              <span className="absolute -top-2 right-2 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-indigo-500 text-white uppercase tracking-wide animate-pulse">
                                Auto
                              </span>
                            )}
                          </div>
                        </MetaField>
                      );
                    }
                    if (fieldId === "priority") {
                      return (
                        <MetaField key="priority" label="Priority">
                          <div className="relative">
                            <select
                              value={priority}
                              onChange={(e) => setPriority(e.target.value as TaskPriority)}
                              className="w-full border border-slate-200 rounded-xl pl-8 pr-3.5 py-2.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white hover:border-slate-300 transition-colors appearance-none"
                            >
                              {PRIORITIES.map((p) => <option key={p} value={p}>{PRIORITY_LABELS[p]}</option>)}
                            </select>
                            <span className={`absolute left-3 top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full pointer-events-none ${PRIORITY_DOT[priority]}`} />
                          </div>
                        </MetaField>
                      );
                    }
                    if (fieldId === "due_date") {
                      return (
                        <MetaField key="due_date" label="Due Date">
                          <input
                            type="date"
                            value={dueDate}
                            min={new Date().toISOString().slice(0, 10)}
                            onChange={(e) => setDueDate(e.target.value)}
                            className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white hover:border-slate-300 transition-colors"
                          />
                        </MetaField>
                      );
                    }
                    if (fieldId === "assignees") {
                      return (
                        <MetaField key="assignees" label="Assignees">
                          {currentUserRole === "admin" ? (
                            <AssigneePicker users={users} selected={assigneeIds} onChange={setAssigneeIds} />
                          ) : (
                            <div className="flex flex-wrap gap-1.5 min-h-[38px] items-center">
                              {users.filter((u) => assigneeIds.includes(u.id)).length === 0 ? (
                                <span className="text-sm text-slate-400">Unassigned</span>
                              ) : (
                                users.filter((u) => assigneeIds.includes(u.id)).map((u, i) => (
                                  <span key={u.id} className="flex items-center gap-1 bg-slate-100 text-slate-700 text-xs rounded-full px-2.5 py-1">
                                    <span
                                      className={`w-4 h-4 rounded-full ${AVATAR_COLORS[i % AVATAR_COLORS.length]} flex items-center justify-center text-white overflow-hidden shrink-0`}
                                      style={{ fontSize: "8px", fontWeight: "bold" }}
                                    >
                                      {u.avatarUrl
                                        ? <Image src={u.avatarUrl} alt={u.fullName} width={16} height={16} className="w-full h-full object-cover" unoptimized />
                                        : getInitials(u.fullName)}
                                    </span>
                                    {u.fullName.split(" ")[0]}
                                  </span>
                                ))
                              )}
                            </div>
                          )}
                        </MetaField>
                      );
                    }
                    if (fieldId === "created_at") {
                      return task ? (
                        <div key="created_at" className="pt-1 border-t border-slate-200 space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Created</span>
                            <span className="text-xs text-slate-500 font-medium">{new Date(task.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Updated</span>
                            <span className="text-xs text-slate-500 font-medium">{new Date(task.updatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
                          </div>
                        </div>
                      ) : null;
                    }
                    // Custom field
                    const def = customFieldDefs.find((d) => d.id === fieldId);
                    if (!def) return null;
                    return (
                      <MetaField key={def.id} label={`${def.label}${def.required ? " *" : ""}`}>
                        {def.type === "picklist" ? (
                          <select
                            value={cfValues[def.id] ?? ""}
                            onChange={(e) => setCfValues((prev) => ({ ...prev, [def.id]: e.target.value }))}
                            className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white hover:border-slate-300 transition-colors"
                          >
                            <option value="">— Select —</option>
                            {def.options.map((opt) => (
                              <option key={opt} value={opt}>{opt}</option>
                            ))}
                          </select>
                        ) : (
                          <input
                            type="text"
                            value={cfValues[def.id] ?? ""}
                            onChange={(e) => setCfValues((prev) => ({ ...prev, [def.id]: e.target.value }))}
                            placeholder={`Enter ${def.label.toLowerCase()}…`}
                            className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white hover:border-slate-300 transition-colors placeholder-slate-400"
                          />
                        )}
                      </MetaField>
                    );
                  })}

                  {/* Priority badge preview — always visible at bottom */}
                  <div className="pt-1">
                    <span className={`inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full font-bold ${PRIORITY_COLORS[priority]}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${PRIORITY_DOT[priority]}`} />
                      {PRIORITY_LABELS[priority]} Priority
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-6 py-3.5 border-t border-slate-100 bg-slate-50/80 shrink-0">
            {error ? (
              <p className="text-sm text-red-600 flex items-center gap-1.5">
                <svg className="w-4 h-4 shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" /></svg>
                {error}
              </p>
            ) : isReadOnly ? (
              <span className="text-[11px] text-amber-600 font-semibold">View Only — contact an admin to be assigned to this task.</span>
            ) : (
              <span className="text-[11px] text-slate-400 font-medium">Click Save to apply your changes</span>
            )}
            <div className="flex items-center gap-2.5">
              <button onClick={onClose} className="px-5 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-200 rounded-xl transition-colors">
                {isReadOnly ? "Close" : "Cancel"}
              </button>
              {!isReadOnly && (
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="px-6 py-2.5 text-sm font-bold text-white rounded-xl transition-all shadow-sm hover:shadow-md active:scale-[0.97] disabled:opacity-50 flex items-center gap-2"
                  style={{ background: "linear-gradient(135deg, #4f46e5, #7c3aed)" }}
                >
                  {saving ? (
                    <>
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                      Saving…
                    </>
                  ) : "Save Changes"}
                </button>
              )}
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
