"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { toast } from "sonner";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  MouseSensor,
  TouchSensor,
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

const COLUMNS: { id: TaskStatus; label: string; bg: string; border: string; headerColor: string; dotColor: string; gradient: string }[] = [
  { id: "not_started", label: "To Do", bg: "bg-slate-50/70", border: "border-slate-200", headerColor: "text-slate-600", dotColor: "bg-slate-400", gradient: "linear-gradient(135deg, #64748b, #94a3b8)" },
  { id: "in_progress", label: "In Progress", bg: "bg-blue-50/60", border: "border-blue-100", headerColor: "text-blue-700", dotColor: "bg-blue-500", gradient: "linear-gradient(135deg, #3b82f6, #6366f1)" },
  { id: "in_review", label: "In Review", bg: "bg-amber-50/60", border: "border-amber-100", headerColor: "text-amber-700", dotColor: "bg-amber-500", gradient: "linear-gradient(135deg, #f59e0b, #f97316)" },
  { id: "completed", label: "Done", bg: "bg-green-50/60", border: "border-green-100", headerColor: "text-green-700", dotColor: "bg-green-500", gradient: "linear-gradient(135deg, #22c55e, #16a34a)" },
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

const PRIORITY_BORDER: Record<TaskPriority, string> = {
  critical: "border-l-red-500",
  high: "border-l-orange-500",
  medium: "border-l-blue-500",
  low: "border-l-slate-300",
};

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

function SortTh({ field, label, sortField, sortDir, onSort, className }: {
  field: SortField; label: string; sortField: SortField; sortDir: SortDir;
  onSort: (f: SortField) => void; className?: string;
}) {
  const active = sortField === field && sortDir !== "none";
  return (
    <th
      className={`text-left px-4 py-3 text-[11px] font-semibold uppercase tracking-wider cursor-pointer select-none transition-colors group ${active ? "text-indigo-600 bg-indigo-50/60" : "text-slate-500 hover:bg-slate-50/80 hover:text-slate-700"} ${className ?? ""}`}
      onClick={() => onSort(field)}
    >
      <div className="flex items-center gap-1.5">
        {label}
        <span className={`text-[10px] transition-all ${active ? "opacity-100 text-indigo-500" : "opacity-0 group-hover:opacity-50"}`}>
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
  const style = transform ? { transform: CSS.Translate.toString(transform) } : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      onClick={onClick}
      className={`bg-white rounded-xl border border-slate-200 border-l-[3px] ${PRIORITY_BORDER[task.priority]} p-3.5 cursor-pointer transition-all duration-150 group select-none ${
        isDragging ? "opacity-40 rotate-1 scale-105 shadow-lg" : "hover:shadow-[0_6px_20px_rgba(15,23,42,0.1)] hover:-translate-y-0.5 hover:border-slate-300"
      }`}
    >
      {/* Priority dot + title */}
      <div className="flex items-start gap-2 mb-2">
        <span className={`w-2 h-2 rounded-full shrink-0 mt-1 ${PRIORITY_DOT[task.priority]}`} />
        <p className="text-[13px] font-semibold text-slate-800 leading-snug group-hover:text-indigo-600 transition-colors line-clamp-2">
          {task.title}
        </p>
      </div>

      {task.description && (
        <p className="text-[11px] text-slate-400 mb-3 line-clamp-1 leading-relaxed pl-4">{task.description}</p>
      )}

      <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-100">
        <div className="flex items-center gap-1.5">
          {task.dueDate && (() => {
            const { formatted, overdue } = formatDueDate(task.dueDate!);
            return (
              <span className={`text-[11px] flex items-center gap-1 font-medium rounded-full px-2 py-0.5 ${
                overdue ? "text-red-600 bg-red-50" : "text-slate-400 bg-slate-50"
              }`}>
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
      {/* Column header */}
      <div className="flex items-center gap-2.5 mb-3 px-1">
        <div
          className="w-3 h-3 rounded-full shrink-0 shadow-sm"
          style={{ background: column.gradient }}
        />
        <span className={`text-[11px] font-bold uppercase tracking-widest ${column.headerColor}`}>{column.label}</span>
        <span
          className="ml-auto text-[11px] font-bold rounded-full px-2 py-0.5 tabular-nums min-w-[22px] text-center text-white shadow-sm"
          style={{ background: column.gradient }}
        >
          {tasks.length}
        </span>
      </div>

      <div
        ref={setNodeRef}
        className={`flex-1 min-h-[220px] rounded-2xl p-2.5 space-y-2.5 transition-all duration-200 ${
          isOver
            ? "ring-2 ring-indigo-300 ring-inset bg-indigo-50/60"
            : column.bg
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
          <div className="flex flex-col items-center justify-center h-full min-h-[100px] gap-2 text-slate-300">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
            </svg>
            <span className="text-[11px] font-semibold">Drop tasks here</span>
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
  exportTrigger: number;
}

const PAGE_SIZE = 10;

function ListView({ tasks, onTaskClick, onEdit, onDelete, currentUserId, currentUserRole, exportTrigger }: ListViewProps) {
  const [sortField, setSortField] = useState<SortField>("createdAt");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [page, setPage] = useState(1);
  const prevTasksKey = useRef(tasks.map((t) => t.id).join(","));

  // Reset to page 1 whenever the visible task set changes (due to filtering)
  const tasksKey = tasks.map((t) => t.id).join(",");
  if (prevTasksKey.current !== tasksKey) {
    prevTasksKey.current = tasksKey;
    if (page !== 1) setPage(1);
  }

  function handleSort(field: SortField) {
    if (sortField !== field) {
      setSortField(field);
      setSortDir("asc");
    } else {
      setSortDir((prev) => (prev === "none" ? "asc" : prev === "asc" ? "desc" : "none"));
    }
    setPage(1);
  }

  const sorted = sortTasks(tasks, sortField, sortDir);
  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paginated = sorted.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  useEffect(() => {
    if (exportTrigger > 0) exportToPDF();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exportTrigger]);

  function canModify(task: Task) {
    return currentUserRole === "admin" || task.assignees.some((a) => a.id === currentUserId);
  }

  function exportToPDF() {
    const doc = new jsPDF({ orientation: "landscape" });

    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text("Task List", 14, 16);

    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(120, 120, 120);
    doc.text(`Exported on ${new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}  •  Showing page ${currentPage} of ${totalPages}  •  ${paginated.length} task(s)`, 14, 23);
    doc.setTextColor(0, 0, 0);

    autoTable(doc, {
      startY: 28,
      head: [["#", "Title", "Status", "Priority", "Assignees", "Due Date", "Created"]],
      body: paginated.map((task, idx) => [
        (currentPage - 1) * PAGE_SIZE + idx + 1,
        task.title,
        STATUS_LABELS[task.status],
        PRIORITY_LABELS[task.priority],
        task.assignees.length > 0
          ? task.assignees.map((a) => `${a.fullName}${a.email ? ` (${a.email})` : ""}`).join(", ")
          : "—",
        task.dueDate
          ? new Date(task.dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
          : "—",
        new Date(task.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
      ]),
      headStyles: { fillColor: [37, 99, 235], textColor: 255, fontStyle: "bold", fontSize: 9 },
      bodyStyles: { fontSize: 8.5 },
      alternateRowStyles: { fillColor: [245, 247, 255] },
      columnStyles: {
        0: { cellWidth: 10, halign: "center" },
        1: { cellWidth: 70 },
        2: { cellWidth: 28 },
        3: { cellWidth: 22 },
        4: { cellWidth: 80 },
        5: { cellWidth: 28 },
        6: { cellWidth: 28 },
      },
      margin: { left: 14, right: 14 },
    });

    doc.save(`task-list-page-${currentPage}.pdf`);
    toast.success("PDF exported successfully!");
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
      {/* Top accent bar */}
      <div className="h-1" style={{ background: "linear-gradient(90deg, #4f46e5, #7c3aed, #a855f7)" }} />
      <div className="overflow-x-auto">
      <table className="w-full text-sm min-w-[480px]">
        <thead>
          <tr className="border-b-2 border-slate-100 bg-gradient-to-b from-slate-50 to-white">
            <SortTh field="idx" label="#" sortField={sortField} sortDir={sortDir} onSort={handleSort} className="w-12" />
            <SortTh field="title" label="Title" sortField={sortField} sortDir={sortDir} onSort={handleSort} />
            <SortTh field="status" label="Status" sortField={sortField} sortDir={sortDir} onSort={handleSort} className="hidden md:table-cell" />
            <SortTh field="priority" label="Priority" sortField={sortField} sortDir={sortDir} onSort={handleSort} className="hidden lg:table-cell" />
            <SortTh field="assignees" label="Assignees" sortField={sortField} sortDir={sortDir} onSort={handleSort} className="hidden lg:table-cell" />
            <SortTh field="dueDate" label="Due Date" sortField={sortField} sortDir={sortDir} onSort={handleSort} className="hidden xl:table-cell" />
            <SortTh field="createdAt" label="Created" sortField={sortField} sortDir={sortDir} onSort={handleSort} className="hidden xl:table-cell" />
            <th className="text-right px-4 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-50">
          {sorted.length === 0 ? (
            <tr>
              <td colSpan={8} className="text-center py-20">
                <div className="flex flex-col items-center gap-4 text-slate-400">
                  <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center">
                    <svg className="w-7 h-7 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-600">No tasks found</p>
                    <p className="text-xs text-slate-400 mt-0.5">Try adjusting your filters</p>
                  </div>
                </div>
              </td>
            </tr>
          ) : (
            paginated.map((task, idx) => {
              const rowNum = (currentPage - 1) * PAGE_SIZE + idx + 1;
              return (
              <tr
                key={task.id}
                className="border-b border-slate-100 hover:bg-indigo-50/30 transition-colors group"
              >
                <td className="px-4 py-4 text-slate-300 text-xs font-mono w-12">{rowNum}</td>
                <td className="px-4 py-4">
                  <div
                    className="flex items-center gap-2.5 cursor-pointer"
                    onClick={() => onTaskClick(task)}
                  >
                    <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${PRIORITY_DOT[task.priority]} ring-2 ring-white`} />
                    <span className="font-semibold text-slate-800 group-hover:text-indigo-600 transition-colors line-clamp-1">{task.title}</span>
                  </div>
                  {task.description && (
                    <p className="text-xs text-slate-400 mt-0.5 pl-5 line-clamp-1">{task.description}</p>
                  )}
                </td>
                <td className="px-4 py-4 hidden md:table-cell">
                  <span className={`inline-flex items-center text-xs px-2.5 py-1 rounded-full font-semibold border ${STATUS_COLORS[task.status]}`}>
                    {STATUS_LABELS[task.status]}
                  </span>
                </td>
                <td className="px-4 py-4 hidden lg:table-cell">
                  <span className={`inline-flex items-center text-xs px-2.5 py-1 rounded-full font-semibold border ${PRIORITY_COLORS[task.priority]}`}>
                    {PRIORITY_LABELS[task.priority]}
                  </span>
                </td>
                <td className="px-4 py-4 hidden lg:table-cell">
                  {task.assignees.length > 0 ? (
                    <div className="flex items-center gap-2">
                      <AvatarGroup users={task.assignees} max={3} size="md" />
                      {task.assignees.length === 1 && (
                        <span className="text-xs text-slate-600 font-medium">{task.assignees[0].fullName}</span>
                      )}
                    </div>
                  ) : (
                    <span className="text-slate-300 text-xs">—</span>
                  )}
                </td>
                <td className="px-4 py-4 hidden xl:table-cell">
                  {task.dueDate ? (() => {
                    const { formatted, overdue } = formatDueDate(task.dueDate!);
                    return (
                      <span className={`inline-flex items-center text-xs px-2 py-0.5 rounded-md font-medium ${overdue ? "bg-red-50 text-red-600 border border-red-100" : "bg-slate-50 text-slate-500 border border-slate-100"}`}>
                        {formatted}
                      </span>
                    );
                  })() : <span className="text-slate-300 text-xs">—</span>}
                </td>
                <td className="px-4 py-4 hidden xl:table-cell text-xs text-slate-400 font-medium">
                  {new Date(task.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                </td>
                <td className="px-4 py-4">
                  <div className="flex items-center justify-end gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                    {/* View */}
                    <button
                      onClick={() => onTaskClick(task)}
                      title="View task"
                      className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
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
                        className="p-1.5 text-slate-400 hover:text-violet-600 hover:bg-violet-50 rounded-lg transition-colors"
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
                        className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    )}
                  </div>
                </td>
              </tr>
              );
            })
          )}
        </tbody>
      </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-5 py-3.5 border-t border-slate-100 bg-slate-50/60">
          <span className="text-xs text-slate-400 font-medium">
            Showing {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, sorted.length)} of {sorted.length} tasks
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-3 py-1.5 text-xs rounded-lg border border-slate-200 bg-white hover:bg-indigo-50 hover:border-indigo-200 hover:text-indigo-600 disabled:opacity-30 disabled:cursor-not-allowed font-semibold text-slate-600 transition-colors"
            >
              ← Prev
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter((p) => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
              .reduce<(number | "...")[]>((acc, p, i, arr) => {
                if (i > 0 && (arr[i - 1] as number) !== p - 1) acc.push("...");
                acc.push(p);
                return acc;
              }, [])
              .map((item, i) =>
                item === "..." ? (
                  <span key={`ellipsis-${i}`} className="px-1 text-xs text-slate-300 select-none">…</span>
                ) : (
                  <button
                    key={item}
                    onClick={() => setPage(item as number)}
                    className={`w-7 h-7 text-xs rounded-lg font-semibold transition-all ${
                      item === currentPage
                        ? "text-white shadow-sm"
                        : "border border-slate-200 bg-white hover:bg-indigo-50 hover:border-indigo-200 hover:text-indigo-600 text-slate-600"
                    }`}
                    style={item === currentPage ? { background: "linear-gradient(135deg, #4f46e5, #7c3aed)" } : undefined}
                  >
                    {item}
                  </button>
                )
              )}
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="px-2.5 py-1 text-xs rounded-lg border border-gray-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed font-medium text-gray-600 transition-colors"
            >
              Next →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Delete Confirm Popover ─────────────────────────────────────────────────

function DeleteConfirm({ task, onConfirm, onCancel }: { task: Task; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-xl shadow-[0_20px_60px_rgba(0,0,0,0.18)] w-full max-w-sm p-6 border border-slate-200">
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
  const justDragged = useRef(false);
  const [search, setSearch] = useState("");
  const [filterPriority, setFilterPriority] = useState<TaskPriority | "">("");
  const [filterAssignedToMe, setFilterAssignedToMe] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Task | null>(null);
  const [exportTrigger, setExportTrigger] = useState(0);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);

  const sensors = useSensors(
    // MouseSensor handles only real mouse events — never touch-synthesized pointer events
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    // TouchSensor handles mobile exclusively; 250ms hold distinguishes drag from scroll
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } })
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
    justDragged.current = false;
    setActiveId(event.active.id as string);
  }

  async function handleDragEnd(event: DragEndEvent) {
    // Mark that a drag just finished so the synthesized touch-click is suppressed
    justDragged.current = true;
    setTimeout(() => { justDragged.current = false; }, 300);
    setActiveId(null);
    const { active, over } = event;
    if (!over) return;

    const taskId = active.id as string;
    const newStatus = over.id as TaskStatus;
    const task = tasks.find((t) => t.id === taskId);
    if (!task || task.status === newStatus) return;

    setTasks((prev) => prev.map((t) => t.id === taskId ? { ...t, status: newStatus } : t));

    try {
      const res = await fetch(`/api/tasks/${taskId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        toast.success(`Moved to ${STATUS_LABELS[newStatus]}`, { duration: 2000 });
      } else {
        throw new Error();
      }
    } catch {
      setTasks((prev) => prev.map((t) => t.id === taskId ? { ...t, status: task.status } : t));
      toast.error("Failed to update task status.");
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
    const res = await fetch(`/api/tasks/${deleteTarget.id}`, { method: "DELETE" });
    if (res.ok) toast.success("Task deleted");
    else toast.error("Failed to delete task.");
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
      <div className="sticky top-0 z-10 bg-white border-b border-slate-200 shadow-sm">
        <div className="flex items-center justify-between px-4 sm:px-6 h-14">
          <div className="flex items-center gap-2.5">
            <h1 className="text-sm font-bold text-slate-900">Task Board</h1>
            <span
              className="text-[11px] font-bold rounded-full px-2.5 py-0.5 text-white shadow-sm tabular-nums"
              style={{ background: "linear-gradient(135deg, #4f46e5, #7c3aed)" }}
            >
              {tasks.length}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* Mobile search toggle */}
            <button
              onClick={() => setMobileSearchOpen(!mobileSearchOpen)}
              className={`sm:hidden p-1.5 rounded-md transition-colors ${mobileSearchOpen ? "bg-blue-50 text-blue-600" : "text-slate-500 hover:bg-slate-100"}`}
              aria-label="Toggle search"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </button>

            {/* Desktop search */}
            <div className="relative hidden sm:block">
              <svg className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search tasks..."
                className="pl-8 pr-3 h-8 text-[13px] border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent w-44 placeholder-slate-400"
              />
            </div>

            {/* Priority filter */}
            <select
              value={filterPriority}
              onChange={(e) => setFilterPriority(e.target.value as TaskPriority | "")}
              className="h-8 text-[13px] border border-slate-200 rounded-md px-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-slate-700 hidden md:block"
            >
              <option value="">All Priorities</option>
              {(["critical", "high", "medium", "low"] as TaskPriority[]).map((p) => (
                <option key={p} value={p}>{PRIORITY_LABELS[p]}</option>
              ))}
            </select>

            {/* Assigned to me toggle */}
            {(() => {
              const myCount = tasks.filter((t) => t.assignees.some((a) => a.id === currentUser.id)).length;
              return (
                <button
                  onClick={() => setFilterAssignedToMe(!filterAssignedToMe)}
                  className={`hidden md:flex items-center gap-1.5 h-8 px-3 rounded-md text-[13px] font-medium border transition-colors ${
                    filterAssignedToMe
                      ? "bg-blue-600 text-white border-blue-600"
                      : "bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                  }`}
                >
                  <span className={`min-w-[18px] h-4 rounded-full flex items-center justify-center text-[10px] font-bold px-1 ${
                    filterAssignedToMe ? "bg-white/20 text-white" : "bg-blue-100 text-blue-700"
                  }`}>
                    {myCount}
                  </span>
                  My Tasks
                </button>
              );
            })()}

            {/* View toggle */}
            <div className="flex items-center bg-slate-100 rounded-md p-0.5">
              <button
                onClick={() => setView("kanban")}
                className={`flex items-center gap-1 px-2.5 h-7 rounded text-[13px] font-medium transition-colors ${
                  view === "kanban" ? "bg-white text-blue-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
                }`}
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
                </svg>
                <span className="hidden sm:inline">Board</span>
              </button>
              <button
                onClick={() => setView("list")}
                className={`flex items-center gap-1 px-2.5 h-7 rounded text-[13px] font-medium transition-colors ${
                  view === "list" ? "bg-white text-blue-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
                }`}
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                </svg>
                <span className="hidden sm:inline">List</span>
              </button>
            </div>

            {/* Export PDF — list view only */}
            {view === "list" && (
              <button
                onClick={() => setExportTrigger((n) => n + 1)}
                className="hidden sm:flex items-center gap-1.5 h-8 px-3 bg-white hover:bg-slate-50 text-slate-600 text-[13px] font-medium rounded-md border border-slate-200 hover:border-slate-300 transition-colors"
              >
                <svg className="w-3.5 h-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3M3 17V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
                </svg>
                Export
              </button>
            )}

            {/* Create task */}
            <button
              onClick={() => { setSelectedTask(null); setIsNewTask(true); }}
              className="flex items-center gap-1.5 h-8 px-3.5 text-white text-[13px] font-bold rounded-xl transition-all shadow-sm hover:shadow-md active:scale-[0.97]"
              style={{ background: "linear-gradient(135deg, #4f46e5, #7c3aed)" }}
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
              </svg>
              <span className="hidden sm:inline">New Task</span>
            </button>
          </div>
        </div>

        {/* Mobile search bar */}
        {mobileSearchOpen && (
          <div className="sm:hidden px-4 pb-3">
            <div className="relative">
              <svg className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search tasks..."
                autoFocus
                className="w-full pl-8 pr-4 py-2 text-[13px] border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        )}
      </div>

      {/* Board content */}
      <div className="flex-1 p-4 sm:p-6 overflow-auto bg-slate-50/60">
        {view === "kanban" ? (
          <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {COLUMNS.map((col) => (
                <KanbanColumn
                  key={col.id}
                  column={col}
                  tasks={filteredTasks.filter((t) => t.status === col.id)}
                  onTaskClick={(task) => { if (!justDragged.current) { setSelectedTask(task); setIsNewTask(false); } }}
                  activeId={activeId}
                />
              ))}
            </div>
            <DragOverlay>
              {activeTask && (
                <div className={`bg-white rounded-xl border border-slate-200 border-l-[3px] ${PRIORITY_BORDER[activeTask.priority]} shadow-[0_20px_40px_rgba(15,23,42,0.2)] p-3.5 w-64 rotate-2 scale-105 opacity-95`}>
                  <div className="flex items-start gap-2">
                    <span className={`w-2 h-2 rounded-full shrink-0 mt-1 ${PRIORITY_DOT[activeTask.priority]}`} />
                    <p className="text-[13px] font-semibold text-slate-800 line-clamp-2">{activeTask.title}</p>
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
            exportTrigger={exportTrigger}
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
