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

interface TaskBoardProps {
  currentUser: SessionUser;
}

const COLUMNS: { id: TaskStatus; label: string; color: string; headerColor: string }[] = [
  { id: "not_started", label: "To Do", color: "bg-gray-50 border-gray-200", headerColor: "bg-gray-400" },
  { id: "in_progress", label: "In Progress", color: "bg-blue-50 border-blue-200", headerColor: "bg-blue-500" },
  { id: "in_review", label: "In Review", color: "bg-yellow-50 border-yellow-200", headerColor: "bg-yellow-500" },
  { id: "completed", label: "Done", color: "bg-green-50 border-green-200", headerColor: "bg-green-500" },
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
      {/* Priority dot + title */}
      <div className="flex items-start gap-2 mb-2.5">
        <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${PRIORITY_DOT[task.priority]}`} />
        <p className="text-sm font-medium text-gray-900 leading-snug group-hover:text-blue-600 transition-colors line-clamp-2">
          {task.title}
        </p>
      </div>

      {/* Description preview */}
      {task.description && (
        <p className="text-xs text-gray-400 mb-2.5 line-clamp-1 pl-4">{task.description}</p>
      )}

      {/* Footer: priority badge + due date + assignee */}
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
        {task.assignedUser && (
          <div
            title={task.assignedUser.fullName}
            className="w-6 h-6 rounded-full bg-indigo-500 flex items-center justify-center text-white text-xs font-bold shrink-0"
          >
            {getInitials(task.assignedUser.fullName)}
          </div>
        )}
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
      <div className="flex items-center gap-2 mb-3">
        <div className={`w-3 h-3 rounded-full ${column.headerColor}`} />
        <span className="text-sm font-semibold text-gray-700">{column.label}</span>
        <span className="ml-auto text-xs bg-gray-200 text-gray-600 rounded-full px-2 py-0.5 font-medium">
          {tasks.length}
        </span>
      </div>

      {/* Drop zone */}
      <div
        ref={setNodeRef}
        className={`flex-1 min-h-[200px] rounded-xl border-2 border-dashed p-2 space-y-2 transition-colors ${
          isOver
            ? "border-blue-400 bg-blue-50"
            : `${column.color} border-transparent`
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
}

function ListView({ tasks, onTaskClick }: ListViewProps) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 bg-gray-50">
            <th className="text-left px-4 py-3 font-semibold text-gray-600 w-8">#</th>
            <th className="text-left px-4 py-3 font-semibold text-gray-600">Title</th>
            <th className="text-left px-4 py-3 font-semibold text-gray-600 hidden md:table-cell">Status</th>
            <th className="text-left px-4 py-3 font-semibold text-gray-600 hidden lg:table-cell">Priority</th>
            <th className="text-left px-4 py-3 font-semibold text-gray-600 hidden lg:table-cell">Assignee</th>
            <th className="text-left px-4 py-3 font-semibold text-gray-600 hidden xl:table-cell">Due Date</th>
          </tr>
        </thead>
        <tbody>
          {tasks.length === 0 ? (
            <tr>
              <td colSpan={6} className="text-center py-12 text-gray-400">No tasks found</td>
            </tr>
          ) : (
            tasks.map((task, idx) => (
              <tr
                key={task.id}
                onClick={() => onTaskClick(task)}
                className="border-b border-gray-100 hover:bg-blue-50 cursor-pointer transition-colors"
              >
                <td className="px-4 py-3 text-gray-400 text-xs">{idx + 1}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full shrink-0 ${PRIORITY_DOT[task.priority]}`} />
                    <span className="font-medium text-gray-900 line-clamp-1">{task.title}</span>
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
                  {task.assignedUser ? (
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-indigo-500 flex items-center justify-center text-white text-xs font-bold">
                        {getInitials(task.assignedUser.fullName)}
                      </div>
                      <span className="text-gray-700 text-xs">{task.assignedUser.fullName}</span>
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
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

// ── Main TaskBoard ─────────────────────────────────────────────────────────

export default function TaskBoard({ currentUser }: TaskBoardProps) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"kanban" | "list">("kanban");
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isNewTask, setIsNewTask] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filterPriority, setFilterPriority] = useState<TaskPriority | "">("");

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const fetchTasks = useCallback(async () => {
    const res = await fetch("/api/tasks");
    const data = await res.json();
    if (data.data?.tasks) setTasks(data.data.tasks);
    setLoading(false);
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

    // Optimistic update
    setTasks((prev) => prev.map((t) => t.id === taskId ? { ...t, status: newStatus } : t));

    try {
      await fetch(`/api/tasks/${taskId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
    } catch {
      // Revert on failure
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
  }

  const filteredTasks = tasks.filter((t) => {
    const matchSearch = !search || t.title.toLowerCase().includes(search.toLowerCase());
    const matchPriority = !filterPriority || t.priority === filterPriority;
    return matchSearch && matchPriority;
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

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 bg-white border-b border-gray-200 sticky top-0 z-10">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Project Board</h1>
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
              className="pl-9 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 w-52"
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
    </div>
  );
}
