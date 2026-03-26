"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  DndContext,
  DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ColumnConfig } from "@/types";

interface Props {
  initialColumns: ColumnConfig[];
  onClose: () => void;
  onSaved: () => void;
}

// ── Sortable row ───────────────────────────────────────────────────────────

function SortableRow({
  col,
  onToggle,
}: {
  col: ColumnConfig;
  onToggle: (key: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: col.columnKey });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : undefined,
  };

  const isCustom = col.columnKey.startsWith("cf_");

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-all ${
        isDragging
          ? "bg-indigo-50 border-indigo-300 shadow-lg"
          : "bg-white border-slate-200 hover:border-slate-300"
      }`}
    >
      {/* Drag handle */}
      <button
        {...listeners}
        {...attributes}
        className="cursor-grab active:cursor-grabbing text-slate-300 hover:text-slate-500 transition-colors shrink-0 touch-none"
        tabIndex={-1}
        aria-label="Drag to reorder"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M4 8h16M4 16h16" />
        </svg>
      </button>

      {/* Type badge */}
      <span
        className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border shrink-0 ${
          isCustom
            ? "bg-violet-50 text-violet-600 border-violet-200"
            : "bg-slate-100 text-slate-500 border-slate-200"
        }`}
      >
        {isCustom ? "Custom" : "System"}
      </span>

      {/* Label */}
      <span className={`flex-1 text-sm font-semibold ${col.visible ? "text-slate-800" : "text-slate-400 line-through"}`}>
        {col.label}
      </span>

      {/* Visible toggle */}
      <button
        onClick={() => onToggle(col.columnKey)}
        className={`relative w-9 h-5 rounded-full transition-colors shrink-0 ${
          col.visible ? "bg-indigo-500" : "bg-slate-200"
        }`}
        aria-label={col.visible ? "Hide column" : "Show column"}
      >
        <span
          className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${
            col.visible ? "translate-x-4" : "translate-x-0"
          }`}
        />
      </button>
    </div>
  );
}

// ── Modal ──────────────────────────────────────────────────────────────────

export default function ColumnOrderModal({ initialColumns, onClose, onSaved }: Props) {
  const [columns, setColumns] = useState<ColumnConfig[]>(
    [...initialColumns].sort((a, b) => a.order - b.order)
  );
  const [saving, setSaving] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setColumns((prev) => {
      const oldIdx = prev.findIndex((c) => c.columnKey === active.id);
      const newIdx = prev.findIndex((c) => c.columnKey === over.id);
      return arrayMove(prev, oldIdx, newIdx);
    });
  }

  function handleToggle(key: string) {
    setColumns((prev) =>
      prev.map((c) => (c.columnKey === key ? { ...c, visible: !c.visible } : c))
    );
  }

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/task-list-columns", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          columns: columns.map((c, i) => ({
            columnKey: c.columnKey,
            order: i,
            visible: c.visible,
          })),
        }),
      });
      if (!res.ok) throw new Error();
      toast.success("Column layout saved.");
      onSaved();
    } catch {
      toast.error("Failed to save column layout.");
    } finally {
      setSaving(false);
    }
  }

  const visibleCount = columns.filter((c) => c.visible).length;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white rounded-2xl shadow-[0_24px_80px_rgba(15,23,42,0.2)] w-full max-w-md overflow-hidden animate-scale-in flex flex-col max-h-[85vh]">
        {/* Gradient accent */}
        <div className="h-1.5 w-full shrink-0" style={{ background: "linear-gradient(90deg, #4f46e5, #7c3aed, #ec4899)" }} />

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center shadow-sm"
              style={{ background: "linear-gradient(135deg, #4f46e5, #7c3aed)" }}>
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M4 6h16M4 10h16M4 14h16M4 18h16" />
              </svg>
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 leading-tight">Manage Columns</h2>
              <p className="text-[11px] text-slate-400 font-medium mt-0.5">
                Drag to reorder · toggle to show/hide · {visibleCount} visible
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Pinned top: # */}
        <div className="px-6 pt-4 shrink-0">
          <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-2">Pinned</p>
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-slate-100 bg-slate-50">
            <svg className="w-4 h-4 text-slate-300 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border bg-slate-100 text-slate-500 border-slate-200 shrink-0">System</span>
            <span className="flex-1 text-sm font-semibold text-slate-400"># Row</span>
            <span className="text-[10px] text-slate-400 font-medium">Always first</span>
          </div>
        </div>

        {/* Sortable columns */}
        <div className="px-6 pb-2 pt-4 shrink-0">
          <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-2">Orderable</p>
        </div>
        <div className="px-6 overflow-y-auto flex-1">
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={columns.map((c) => c.columnKey)} strategy={verticalListSortingStrategy}>
              <div className="space-y-2 pb-2">
                {columns.map((col) => (
                  <SortableRow key={col.columnKey} col={col} onToggle={handleToggle} />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        </div>

        {/* Pinned bottom: Actions */}
        <div className="px-6 pb-4 pt-2 shrink-0">
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-slate-100 bg-slate-50">
            <svg className="w-4 h-4 text-slate-300 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border bg-slate-100 text-slate-500 border-slate-200 shrink-0">System</span>
            <span className="flex-1 text-sm font-semibold text-slate-400">Actions</span>
            <span className="text-[10px] text-slate-400 font-medium">Always last</span>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2.5 px-6 py-4 border-t border-slate-100 bg-slate-50/80 shrink-0">
          <button onClick={onClose} className="px-5 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-200 rounded-xl transition-colors">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-2.5 text-sm font-bold text-white rounded-xl transition-all shadow-sm hover:shadow-md active:scale-[0.97] disabled:opacity-50 flex items-center gap-2"
            style={{ background: "linear-gradient(135deg, #4f46e5, #7c3aed)" }}
          >
            {saving ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Saving…
              </>
            ) : "Save Layout"}
          </button>
        </div>
      </div>
    </div>
  );
}
