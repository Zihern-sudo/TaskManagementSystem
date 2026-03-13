"use client";

import { useEffect, useState, useCallback } from "react";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  useDraggable,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import {
  Task,
  TaskStatus,
  TaskPriority,
  SessionUser,
  STATUS_LABELS,
  STATUS_COLORS,
  PRIORITY_COLORS,
  PRIORITY_DOT,
  PRIORITY_LABELS,
} from "@/types";
import TaskModal from "./TaskModal";
import AvatarGroup from "./AvatarGroup";

interface TaskBoardProps {
  currentUser: SessionUser;
}

const COLUMNS: { id: TaskStatus; label: string; bg: string; border: string; headerColor: string }[] = [
  { id: "not_started", label: "To Do", bg: "bg-gray-50", border: "border-gray-300", headerColor: "bg-gray-400" },
  { id: "in_progress", label: "In Progress", bg: "bg-blue-50", border: "border-blue-200", headerColor: "bg-blue-500" },
  { id: "in_review", label: "In Review", bg: "bg-yellow-50", border: "border-yellow-200", headerColor: "bg-yellow-500" },
  { id: "completed", label: "Done", bg: "bg-green-50", border: "border-green-200", headerColor: "bg-green-500" },
];

function getInitials(name: string) {
  return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
}

function formatDueDate(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const overdue = d < now;
  const formatted = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return { formatted, overdue };
}

// ── Sort types ──────────────────────────────────────────────────────────────

type SortField = "idx" | "title" | "status" | "priority" | "assignees" | "dueDate" | "createdAt";
type SortDir = "asc" | "desc" | "none";

const PRIORITY_ORDER: Record<TaskPriority, number> = { critical: 0, high: 1, medium: 2, low: 3 };
const STATUS_ORDER: Record<TaskStatus, number> = { not_started: 0, in_progress: 1, in_review: 2, completed: 3 };

function sortTasks(tasks: Task[], field: SortField, dir: SortDir): Task[] {
  if (dir === "none") return tasks;
  return [...tasks].sort((a, b) => {
    let cmp = 0;
    switch (field) {
      case "title":
        cmp = a.title.localeCompare(b.title);
        break;
      case "status":
        cmp = STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
        break;
      case "priority":
        cmp = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
        break;
      case "assignees":
        cmp = (a.assignees[0]?.fullName ?? "").localeCompare(b.assignees[0]?.fullName ?? "");
        break;
      case "dueDate":
        cmp = (a.dueDate ? new Date(a.dueDate).getTime() : Infinity) -
              (b.dueDate ? new Date(b.dueDate).getTime() : Infinity);
        break;
      case "idx":
      case "createdAt":
        cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        break;
    }
    return dir === "asc" ? cmp : -cmp;
  });
}

// ── Sort Header Cell ────────────────────────────────────────────────────────

function SortTh({
  field, label, sortField, sortDir, onSort, className,
}: {
  field: SortField; label: string; sortField: SortField; sortDir: SortDir;
  onSort: (f: SortField) => void; className?: string;
}) {
  const active = sortField === field && sortDir !== "none";
  return (
    <th
      className={`text-left px-4 py-3 font-semibold text-gray-600 cursor-pointer select-none hover:bg-gray-100 transition-colors group ${className ?? ""}`}
      onClick={() => onSort(field)}
    >
      <div className="flex items-center gap-1">
        {label}
        <span className={`text-xs transition-opacity ${active ? "opacity-100" : "opacity-0 group-hover:opacity-40"}`}>
          {sortDir === "asc" && sortField === field ? "↑" : sortDir === "desc" && sortField === field ? "↓" : "↕"}
        </span>
      </div>
    </th>
  );
}

// ── Task Card ──────────────────────────────────────────────────────────────

interface TaskCardProps {
  task: Task;
  onClick: () => void;
  isDragging?: boolean;
}

function TaskCard({ task, onClick, isDragging }: TaskCardProps) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({ id: task.id });

  const style = transform
    ? { transform: CSS.Translate.toString(transform) }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      onClick={onClick}
      className={`bg-white rounded-lg border border-gray-200 p-3.5 cursor-pointer hover:shadow-md hover:border-blue-300 transition-all group select-none ${
        isDragging ? "opacity-50" : ""
      }`}
    >
      <div className="flex items-start gap-2 mb-2.5">
        <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${PRIORITY_DOT[task.priority]}`} />
        <p className="text-sm font-medium text-gray-900 leading-snug group-hover:text-blue-600 transition-colors line-clamp-2">
          {task.title}
        </p>
      </div>

      {task.description && (
        <p className="text-xs text-gray-400 mb-2.5 line-clamp-1 pl-4">{task.description}</p>
      )}

      <div className="flex items-center justify-between gap-2 pl-4">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${PRIORITY_COLORS[task.priority]}`}>
            {PRIORITY_LABELS[task.priority]}
          </span>
          {task.dueDate && (() => {
            const { formatted, overdue } = formatDueDate(task.dueDate!);
            return (
              <span className={`text-xs flex items-center gap-1 ${overdue ? "text-red-500" : "text-gray-400"}`}>
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                {formatted}
              </span>
            );
          })()}
        </div>
        <AvatarGroup users={task.assignees} max={3} size="sm" />
      </div>
    </div>
  );
}

// ── Kanban Column ──────────────────────────────────────────────────────────

interface KanbanColumnProps {
  column: typeof COLUMNS[0];
  tasks: Task[];
  onTaskClick: (task: Task) => void;
  activeId: string | null;
}

function KanbanColumn({ column, tasks, onTaskClick, activeId }: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id });

  return (
    <div className="flex flex-col min-w-0">
      <div className="flex items-center gap-2 mb-3">
        <div className={`w-3 h-3 rounded-full ${column.headerColor}`} />
        <span className="text-sm font-semibold text-gray-700">{column.label}</span>
        <span className="ml-auto text-xs bg-gray-200 text-gray-600 rounded-full px-2 py-0.5 font-medium">
          {tasks.length}
        </span>
      </div>

      <div
        ref={setNodeRef}
        className={`flex-1 min-h-[200px] rounded-xl border-2 border-dashed p-2 space-y-2 transition-colors ${
          isOver
            ? "border-blue-400 bg-blue-50"
            : `${column.bg} ${column.border}`
        }`}
      >
        {tasks.map((task) => (
          <TaskCard
            key={task.id}
            task={task}
            onClick={() => onTaskClick(task)}
            isDragging={activeId === task.id}
          />
        ))}
        {tasks.length === 0 && (
          <div className="flex items-center justify-center h-full min-h-[100px] text-xs text-gray-400">
            Drop tasks here
          </div>
        )}
      </div>
    </div>
  );
}

// ── List View ──────────────────────────────────────────────────────────────

interface ListViewProps {
  tasks: Task[];
  onTaskClick: (task: Task) => void;
  onEdit: (task: Task) => void;
  onDelete: (task: Task) => void;
  currentUserId: string;
  currentUserRole: string;
}

function ListView({ tasks, onTaskClick, onEdit, onDelete, currentUserId, currentUserRole }: ListViewProps) {
  const [sortField, setSortField] = useState<SortField>("createdAt");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  function handleSort(field: SortField) {
    if (sortField !== field) {
      setSortField(field);
      setSortDir("asc");
    } else {
      setSortDir((prev) => (prev === "none" ? "asc" : prev === "asc" ? "desc" : "none"));
    }
  }

  const sorted = sortTasks(tasks, sortField, sortDir);

  function canModify(task: Task) {
    return currentUserRole === "admin" || task.assignees.some((a) => a.id === currentUserId);
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b-2 border-gray-200 bg-gray-50">
            <SortTh field="idx" label="#" sortField={sortField} sortDir={sortDir} onSort={handleSort} className="w-12" />
            <SortTh field="title" label="Title" sortField={sortField} sortDir={sortDir} onSort={handleSort} />
            <SortTh field="status" label="Status" sortField={sortField} sortDir={sortDir} onSort={handleSort} className="hidden md:table-cell" />
            <SortTh field="priority" label="Priority" sortField={sortField} sortDir={sortDir} onSort={handleSort} className="hidden lg:table-cell" />
            <SortTh field="assignees" label="Assignees" sortField={sortField} sortDir={sortDir} onSort={handleSort} className="hidden lg:table-cell" />
            <SortTh field="dueDate" label="Due Date" sortField={sortField} sortDir={sortDir} onSort={handleSort} className="hidden xl:table-cell" />
            <SortTh field="createdAt" label="Created" sortField={sortField} sortDir={sortDir} onSort={handleSort} className="hidden xl:table-cell" />
            <th className="text-right px-4 py-3 font-semibold text-gray-600">Actions</th>
          </tr>
        </thead>
        <tbody>
          {sorted.length === 0 ? (
            <tr>
              <td colSpan={8} className="text-center py-16">
                <div className="flex flex-col items-center gap-3 text-gray-400">
                  <svg className="w-10 h-10 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                  <p className="text-sm">No tasks found</p>
                </div>
              </td>
            </tr>
          ) : (
            sorted.map((task, idx) => (
              <tr
                key={task.id}
                className={`border-b border-gray-100 hover:bg-blue-50/50 transition-colors ${idx % 2 === 1 ? "bg-gray-50/40" : ""}`}
              >
                <td className="px-4 py-3 text-gray-400 text-xs font-mono">{idx + 1}</td>
                <td className="px-4 py-3">
                  <div
                    className="flex items-center gap-2 cursor-pointer"
                    onClick={() => onTaskClick(task)}
                  >
                    <div className={`w-2 h-2 rounded-full shrink-0 ${PRIORITY_DOT[task.priority]}`} />
                    <span className="font-medium text-gray-900 hover:text-blue-600 transition-colors line-clamp-1">{task.title}</span>
                  </div>
                  {task.description && (
                    <p className="text-xs text-gray-400 mt-0.5 pl-4 line-clamp-1">{task.description}</p>
                  )}
                </td>
                <td className="px-4 py-3 hidden md:table-cell">
                  <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${STATUS_COLORS[task.status]}`}>
                    {STATUS_LABELS[task.status]}
                  </span>
                </td>
                <td className="px-4 py-3 hidden lg:table-cell">
                  <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${PRIORITY_COLORS[task.priority]}`}>
                    {PRIORITY_LABELS[task.priority]}
                  </span>
                </td>
                <td className="px-4 py-3 hidden lg:table-cell">
                  {task.assignees.length > 0 ? (
                    <div className="flex items-center gap-2">
                      <AvatarGroup users={task.assignees} max={3} size="md" />
                      {task.assignees.length === 1 && (
                        <span className="text-xs text-gray-600">{task.assignees[0].fullName}</span>
                      )}
                    </div>
                  ) : (
                    <span className="text-gray-400 text-xs">—</span>
                  )}
                </td>
                <td className="px-4 py-3 hidden xl:table-cell">
                  {task.dueDate ? (() => {
                    const { formatted, overdue } = formatDueDate(task.dueDate!);
                    return <span className={`text-xs ${overdue ? "text-red-500 font-medium" : "text-gray-500"}`}>{formatted}</span>;
                  })() : <span className="text-gray-400 text-xs">—</span>}
                </td>
                <td className="px-4 py-3 hidden xl:table-cell text-xs text-gray-400">
                  {new Date(task.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-1">
                    {/* View */}
                    <button
                      onClick={() => onTaskClick(task)}
                      title="View task"
                      className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    </button>
                    {/* Edit */}
                    {(currentUserRole === "admin" || canModify(task)) && (
                      <button
                        onClick={() => onEdit(task)}
                        title="Edit task"
                        className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                    )}
                    {/* Delete */}
                    {currentUserRole === "admin" && (
                      <button
                        onClick={() => onDelete(task)}
                        title="Delete task"
                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

// ── Delete Confirm Popover ─────────────────────────────────────────────────

function DeleteConfirm({ task, onConfirm, onCancel }: { task: Task; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center shrink-0">
            <svg className="w-5 h-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">Delete Task</h3>
            <p className="text-sm text-gray-500">This action cannot be undone.</p>
          </div>
        </div>
        <p className="text-sm text-gray-700 mb-5 bg-gray-50 rounded-lg px-3 py-2">
          &ldquo;{task.title}&rdquo;
        </p>
        <div className="flex gap-3 justify-end">
          <button onClick={onCancel} className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg">Cancel</button>
          <button onClick={onConfirm} className="px-4 py-2 text-sm font-semibold bg-red-600 hover:bg-red-700 text-white rounded-lg">Delete</button>
        </div>
      </div>
    </div>
  );
}

// ── Main TaskBoard ─────────────────────────────────────────────────────────

export default function TaskBoard({ currentUser }: TaskBoardProps) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [view, setView] = useState<"kanban" | "list">("kanban");
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isNewTask, setIsNewTask] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filterPriority, setFilterPriority] = useState<TaskPriority | "">("");
  const [filterAssignedToMe, setFilterAssignedToMe] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Task | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const fetchTasks = useCallback(async () => {
    try {
      const res = await fetch("/api/tasks");
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        setFetchError(errData.message || `Server error ${res.status} — run: npx prisma db push`);
        setLoading(false);
        return;
      }
      const data = await res.json();
      if (data.data?.tasks) {
        setTasks(data.data.tasks);
        setFetchError(null);
      }
    } catch {
      setFetchError("Could not reach the server. Make sure npm run dev is running.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchTasks(); }, [fetchTasks]);

  function handleDragStart(event: DragStartEvent) {
    setActiveId(event.active.id as string);
  }

  async function handleDragEnd(event: DragEndEvent) {
    setActiveId(null);
    const { active, over } = event;
    if (!over) return;

    const taskId = active.id as string;
    const newStatus = over.id as TaskStatus;
    const task = tasks.find((t) => t.id === taskId);
    if (!task || task.status === newStatus) return;

    setTasks((prev) => prev.map((t) => t.id === taskId ? { ...t, status: newStatus } : t));

    try {
      await fetch(`/api/tasks/${taskId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
    } catch {
      setTasks((prev) => prev.map((t) => t.id === taskId ? { ...t, status: task.status } : t));
    }
  }

  function handleTaskSaved(saved: Task) {
    setTasks((prev) => {
      const exists = prev.find((t) => t.id === saved.id);
      return exists ? prev.map((t) => t.id === saved.id ? saved : t) : [saved, ...prev];
    });
    setSelectedTask(null);
    setIsNewTask(false);
  }

  function handleTaskDeleted(id: string) {
    setTasks((prev) => prev.filter((t) => t.id !== id));
    setSelectedTask(null);
    setDeleteTarget(null);
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    await fetch(`/api/tasks/${deleteTarget.id}`, { method: "DELETE" });
    handleTaskDeleted(deleteTarget.id);
  }

  const filteredTasks = tasks.filter((t) => {
    const matchSearch = !search || t.title.toLowerCase().includes(search.toLowerCase());
    const matchPriority = !filterPriority || t.priority === filterPriority;
    const matchAssigned = !filterAssignedToMe || t.assignees.some((a) => a.id === currentUser.id);
    return matchSearch && matchPriority && matchAssigned;
  });

  const activeTask = activeId ? tasks.find((t) => t.id === activeId) : null;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex items-center gap-3 text-gray-500">
          <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Loading board...
        </div>
      </div>
    );
  }

  if (fetchError) {
    return (
      <div className="flex items-center justify-center h-64 p-6">
        <div className="bg-red-50 border border-red-200 rounded-2xl p-6 max-w-lg w-full text-center space-y-3">
          <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto">
            <svg className="w-6 h-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h3 className="font-semibold text-red-800">Failed to load tasks</h3>
          <p className="text-sm text-red-600">{fetchError}</p>
          <div className="bg-red-100 rounded-lg px-4 py-2 text-xs text-red-700 font-mono text-left">
            npx prisma db push
          </div>
          <button
            onClick={() => { setFetchError(null); setLoading(true); fetchTasks(); }}
            className="px-4 py-2 text-sm bg-red-600 hover:bg-red-700 text-white rounded-lg transition"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 bg-white border-b border-gray-200 sticky top-0 z-10">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Project Kanban Board</h1>
          <p className="text-sm text-gray-500">{tasks.length} tasks total</p>
        </div>

        <div className="flex items-center gap-3">
          {/* Search */}
          <div className="relative hidden sm:block">
            <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search tasks..."
              className="pl-9 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 w-48"
            />
          </div>

          {/* Priority filter */}
          <select
            value={filterPriority}
            onChange={(e) => setFilterPriority(e.target.value as TaskPriority | "")}
            className="text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white hidden md:block"
          >
            <option value="">All Priorities</option>
            {(["critical", "high", "medium", "low"] as TaskPriority[]).map((p) => (
              <option key={p} value={p}>{PRIORITY_LABELS[p]}</option>
            ))}
          </select>

          {/* Assigned to me toggle */}
          <button
            onClick={() => setFilterAssignedToMe(!filterAssignedToMe)}
            className={`hidden md:flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
              filterAssignedToMe
                ? "bg-blue-600 text-white border-blue-600"
                : "bg-white text-gray-600 border-gray-300 hover:border-blue-400"
            }`}
          >
            <div className="w-5 h-5 rounded-full bg-current opacity-20 flex items-center justify-center text-[9px] font-bold">
              {getInitials(currentUser.name)}
            </div>
            My Tasks
          </button>

          {/* View toggle */}
          <div className="flex items-center bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setView("kanban")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                view === "kanban" ? "bg-white text-blue-600 shadow-sm" : "text-gray-500 hover:text-gray-700"
              }`}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
              </svg>
              Board
            </button>
            <button
              onClick={() => setView("list")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                view === "list" ? "bg-white text-blue-600 shadow-sm" : "text-gray-500 hover:text-gray-700"
              }`}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
              </svg>
              List
            </button>
          </div>

          {/* Create task */}
          <button
            onClick={() => { setSelectedTask(null); setIsNewTask(true); }}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Create
          </button>
        </div>
      </div>

      {/* Board content */}
      <div className="flex-1 p-6 overflow-auto">
        {view === "kanban" ? (
          <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
            <div className="grid grid-cols-4 gap-4 min-w-[900px]">
              {COLUMNS.map((col) => (
                <KanbanColumn
                  key={col.id}
                  column={col}
                  tasks={filteredTasks.filter((t) => t.status === col.id)}
                  onTaskClick={(task) => { setSelectedTask(task); setIsNewTask(false); }}
                  activeId={activeId}
                />
              ))}
            </div>
            <DragOverlay>
              {activeTask && (
                <div className="bg-white rounded-lg border border-blue-300 shadow-2xl p-3.5 w-64 opacity-95 rotate-2">
                  <div className="flex items-start gap-2">
                    <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${PRIORITY_DOT[activeTask.priority]}`} />
                    <p className="text-sm font-medium text-gray-900 line-clamp-2">{activeTask.title}</p>
                  </div>
                </div>
              )}
            </DragOverlay>
          </DndContext>
        ) : (
          <ListView
            tasks={filteredTasks}
            onTaskClick={(task) => { setSelectedTask(task); setIsNewTask(false); }}
            onEdit={(task) => { setSelectedTask(task); setIsNewTask(false); }}
            onDelete={(task) => setDeleteTarget(task)}
            currentUserId={currentUser.id}
            currentUserRole={currentUser.role}
          />
        )}
      </div>

      {/* Task Modal */}
      {(selectedTask || isNewTask) && (
        <TaskModal
          task={selectedTask}
          isNew={isNewTask}
          onClose={() => { setSelectedTask(null); setIsNewTask(false); }}
          onSave={handleTaskSaved}
          onDelete={handleTaskDeleted}
          currentUserId={currentUser.id}
          currentUserRole={currentUser.role}
        />
      )}

      {/* Delete Confirm */}
      {deleteTarget && (
        <DeleteConfirm
          task={deleteTarget}
          onConfirm={confirmDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}
