"use client";

import { useState } from "react";
import { toast } from "sonner";
import { CustomFieldDef, FieldEntity, FieldType } from "@/types";
import { useCustomFields } from "@/contexts/CustomFieldsContext";
import CustomFieldFormModal from "./CustomFieldFormModal";
import ConfirmDialog from "./ConfirmDialog";

// ── Badge helpers ──────────────────────────────────────────────────────────

const TYPE_BADGE: Record<FieldType, string> = {
  text: "bg-blue-50 text-blue-700 border-blue-200",
  picklist: "bg-violet-50 text-violet-700 border-violet-200",
};

const TYPE_LABEL: Record<FieldType, string> = {
  text: "Text",
  picklist: "Picklist",
};

const ENTITY_BADGE: Record<FieldEntity, string> = {
  task: "bg-indigo-50 text-indigo-700 border-indigo-200",
  user: "bg-teal-50 text-teal-700 border-teal-200",
};

const ENTITY_LABEL: Record<FieldEntity, string> = {
  task: "Tasks",
  user: "Users",
};

// ── Sort helpers ───────────────────────────────────────────────────────────

type SortField = "label" | "fieldKey" | "entity" | "type" | "showInListView" | "required" | "order";
type SortDir = "asc" | "desc" | "none";

function sortFields(fields: CustomFieldDef[], field: SortField, dir: SortDir): CustomFieldDef[] {
  if (dir === "none") return fields;
  return [...fields].sort((a, b) => {
    let cmp = 0;
    switch (field) {
      case "label":         cmp = a.label.localeCompare(b.label); break;
      case "fieldKey":      cmp = a.fieldKey.localeCompare(b.fieldKey); break;
      case "entity":        cmp = a.entity.localeCompare(b.entity); break;
      case "type":          cmp = a.type.localeCompare(b.type); break;
      case "showInListView": cmp = Number(a.showInListView) - Number(b.showInListView); break;
      case "required":      cmp = Number(a.required) - Number(b.required); break;
      case "order":         cmp = a.order - b.order; break;
    }
    return dir === "asc" ? cmp : -cmp;
  });
}

function SortTh({
  field, label, sortField, sortDir, onSort, className,
}: {
  field: SortField; label: string; sortField: SortField; sortDir: SortDir;
  onSort: (f: SortField) => void; className?: string;
}) {
  const active = sortField === field && sortDir !== "none";
  return (
    <th
      className={`text-left px-4 py-3.5 text-[11px] font-semibold uppercase tracking-wider cursor-pointer select-none transition-colors group ${
        active ? "text-indigo-600 bg-indigo-50/60" : "text-slate-400 hover:bg-slate-50 hover:text-slate-600"
      } ${className ?? ""}`}
      onClick={() => onSort(field)}
    >
      <div className="flex items-center gap-1.5">
        {label}
        <span className={`text-[10px] transition-all ${active ? "opacity-100 text-indigo-400" : "opacity-0 group-hover:opacity-40"}`}>
          {sortDir === "asc" && sortField === field ? "↑" : sortDir === "desc" && sortField === field ? "↓" : "↕"}
        </span>
      </div>
    </th>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

export default function CustomFieldManager() {
  const { allFields, taskFields, userFields, refresh } = useCustomFields();
  const [modalField, setModalField] = useState<CustomFieldDef | null | undefined>(undefined);
  const [deleteTarget, setDeleteTarget] = useState<CustomFieldDef | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [sortField, setSortField] = useState<SortField>("order");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [filterEntity, setFilterEntity] = useState<FieldEntity | "">("");
  const [search, setSearch] = useState("");

  function handleSort(field: SortField) {
    if (sortField !== field) {
      setSortField(field);
      setSortDir("asc");
    } else {
      setSortDir((prev) => (prev === "none" ? "asc" : prev === "asc" ? "desc" : "none"));
    }
  }

  function handleSaved(_saved: CustomFieldDef) {
    refresh();
    setModalField(undefined);
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/custom-fields/${deleteTarget.id}`, { method: "DELETE" });
      if (res.ok) {
        refresh();
        toast.success("Custom field deleted.");
      } else {
        toast.error("Failed to delete field.");
      }
    } catch {
      toast.error("Network error.");
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  }

  const filtered = allFields.filter((f) => {
    const matchEntity = !filterEntity || f.entity === filterEntity;
    const matchSearch = !search ||
      f.label.toLowerCase().includes(search.toLowerCase()) ||
      f.fieldKey.toLowerCase().includes(search.toLowerCase());
    return matchEntity && matchSearch;
  });

  const sorted = sortFields(filtered, sortField, sortDir);

  return (
    <div className="flex flex-col min-h-full bg-slate-50/60">

      {/* ── Sticky page header ──────────────────────────────────────────── */}
      <div className="sticky top-0 z-10 bg-white border-b border-slate-200 shadow-sm">
        <div className="flex items-center justify-between px-6 sm:px-8 h-16">
          <div className="flex items-center gap-3">
            {/* Icon */}
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 shadow-sm"
              style={{ background: "linear-gradient(135deg, #4f46e5, #7c3aed)" }}
            >
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
              </svg>
            </div>
            <div>
              <h1 className="text-[15px] font-bold text-slate-900 leading-tight">Custom Fields</h1>
              <p className="text-[11px] text-slate-400 font-medium">Define extra fields for tasks or user profiles</p>
            </div>
          </div>

          <button
            onClick={() => setModalField(null)}
            className="flex items-center gap-1.5 px-4 py-2.5 text-sm font-bold text-white rounded-xl shadow-sm hover:shadow-md active:scale-[0.97] transition-all"
            style={{ background: "linear-gradient(135deg, #4f46e5, #7c3aed)" }}
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
            </svg>
            New Field
          </button>
        </div>
      </div>

      <div className="flex-1 px-6 sm:px-8 py-6 space-y-5">

        {/* ── Stats row ─────────────────────────────────────────────────── */}
        <div className="grid grid-cols-3 gap-4">
          {[
            {
              label: "Total Fields",
              value: allFields.length,
              icon: (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                </svg>
              ),
              color: "text-indigo-600",
              bg: "bg-indigo-50",
              border: "border-indigo-100",
            },
            {
              label: "Task Fields",
              value: taskFields.length,
              icon: (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
              ),
              color: "text-indigo-600",
              bg: "bg-indigo-50",
              border: "border-indigo-100",
            },
            {
              label: "User Fields",
              value: userFields.length,
              icon: (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              ),
              color: "text-teal-600",
              bg: "bg-teal-50",
              border: "border-teal-100",
            },
          ].map(({ label, value, icon, color, bg, border }) => (
            <div key={label} className={`flex items-center gap-3.5 bg-white border ${border} rounded-2xl px-5 py-4 shadow-sm`}>
              <div className={`w-9 h-9 rounded-xl ${bg} ${color} flex items-center justify-center shrink-0`}>
                {icon}
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-800 leading-none">{value}</p>
                <p className={`text-xs font-semibold mt-0.5 ${color}`}>{label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* ── Filter / search bar ───────────────────────────────────────── */}
        <div className="flex items-center gap-3 flex-wrap">
          {/* Search */}
          <div className="relative">
            <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by label or key…"
              className="pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent w-60 bg-white transition-all placeholder-slate-400"
            />
          </div>

          {/* Entity filter tabs */}
          <div className="flex items-center bg-slate-100 rounded-xl p-1 gap-0.5">
            {([["", "All"], ["task", "Tasks"], ["user", "Users"]] as [FieldEntity | "", string][]).map(([val, lbl]) => (
              <button
                key={val}
                onClick={() => setFilterEntity(val)}
                className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                  filterEntity === val
                    ? "bg-white text-indigo-600 shadow-sm"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                {lbl}
              </button>
            ))}
          </div>

          {/* Clear */}
          {(search || filterEntity) && (
            <button
              onClick={() => { setSearch(""); setFilterEntity(""); }}
              className="text-xs text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg transition-colors font-semibold"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
              </svg>
              Clear
            </button>
          )}

          <span className="ml-auto text-xs text-slate-400 font-medium">
            {sorted.length} of {allFields.length} fields
          </span>
        </div>

        {/* ── Table ─────────────────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
          <div className="h-1" style={{ background: "linear-gradient(90deg, #4f46e5, #7c3aed, #a855f7)" }} />

          {allFields.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 gap-4 text-slate-400">
              <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center">
                <svg className="w-8 h-8 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                    d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
              <div className="text-center">
                <p className="text-sm font-semibold text-slate-600">No custom fields yet</p>
                <p className="text-xs text-slate-400 mt-1">Click <strong>&ldquo;New Field&rdquo;</strong> to define your first one.</p>
              </div>
              <button
                onClick={() => setModalField(null)}
                className="mt-1 flex items-center gap-1.5 px-4 py-2 text-sm font-bold text-white rounded-xl shadow-sm hover:shadow-md transition-all"
                style={{ background: "linear-gradient(135deg, #4f46e5, #7c3aed)" }}
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                </svg>
                New Field
              </button>
            </div>
          ) : sorted.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-slate-400">
              <svg className="w-8 h-8 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <p className="text-sm font-semibold text-slate-500">No fields match your filters</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[780px]">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/80">
                    <th className="text-left px-5 py-3.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider w-10">#</th>
                    <SortTh field="label"         label="Label"    sortField={sortField} sortDir={sortDir} onSort={handleSort} />
                    <SortTh field="fieldKey"       label="Key"      sortField={sortField} sortDir={sortDir} onSort={handleSort} />
                    <SortTh field="entity"         label="Apply To" sortField={sortField} sortDir={sortDir} onSort={handleSort} />
                    <SortTh field="type"           label="Type"     sortField={sortField} sortDir={sortDir} onSort={handleSort} />
                    <th className="text-left px-4 py-3.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider hidden md:table-cell">Options</th>
                    <SortTh field="showInListView" label="In List"  sortField={sortField} sortDir={sortDir} onSort={handleSort} />
                    <SortTh field="required"       label="Required" sortField={sortField} sortDir={sortDir} onSort={handleSort} />
                    <th className="text-right px-5 py-3.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {sorted.map((field, idx) => (
                    <tr key={field.id} className="hover:bg-indigo-50/20 transition-colors group">
                      <td className="px-5 py-4 text-slate-300 text-xs font-mono tabular-nums">{idx + 1}</td>

                      {/* Label */}
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2.5">
                          <div className={`w-1.5 h-6 rounded-full shrink-0 ${field.entity === "task" ? "bg-indigo-400" : "bg-teal-400"}`} />
                          <span className="font-semibold text-slate-800 group-hover:text-indigo-700 transition-colors">
                            {field.label}
                          </span>
                        </div>
                      </td>

                      {/* Key */}
                      <td className="px-4 py-4">
                        <code className="text-[11px] bg-slate-100 text-slate-500 px-2.5 py-1 rounded-lg font-mono tracking-tight">
                          {field.fieldKey}
                        </code>
                      </td>

                      {/* Entity */}
                      <td className="px-4 py-4">
                        <span className={`inline-flex items-center text-xs px-2.5 py-1 rounded-full font-semibold border ${ENTITY_BADGE[field.entity]}`}>
                          {ENTITY_LABEL[field.entity]}
                        </span>
                      </td>

                      {/* Type */}
                      <td className="px-4 py-4">
                        <span className={`inline-flex items-center text-xs px-2.5 py-1 rounded-full font-semibold border ${TYPE_BADGE[field.type]}`}>
                          {TYPE_LABEL[field.type]}
                        </span>
                      </td>

                      {/* Options */}
                      <td className="px-4 py-4 hidden md:table-cell">
                        {field.type === "picklist" && field.options.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {field.options.slice(0, 3).map((opt) => (
                              <span key={opt} className="text-[11px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full border border-slate-200">
                                {opt}
                              </span>
                            ))}
                            {field.options.length > 3 && (
                              <span className="text-[11px] bg-slate-200 text-slate-500 px-2 py-0.5 rounded-full">
                                +{field.options.length - 3}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-300 text-xs">—</span>
                        )}
                      </td>

                      {/* In List */}
                      <td className="px-4 py-4">
                        {field.showInListView ? (
                          <span className="inline-flex items-center gap-1 text-xs text-indigo-700 font-semibold bg-indigo-50 border border-indigo-200 px-2.5 py-1 rounded-full">
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                            </svg>
                            Yes
                          </span>
                        ) : (
                          <span className="text-slate-300 text-xs">—</span>
                        )}
                      </td>

                      {/* Required */}
                      <td className="px-4 py-4">
                        {field.required ? (
                          <span className="inline-flex items-center gap-1 text-xs text-emerald-700 font-semibold bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full">
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                            </svg>
                            Yes
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400">No</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="px-5 py-4">
                        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => setModalField(field)}
                            title="Edit field"
                            className="p-1.5 text-slate-400 hover:text-violet-600 hover:bg-violet-50 rounded-lg transition-colors"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => setDeleteTarget(field)}
                            title="Delete field"
                            className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ── Create / Edit modal ───────────────────────────────────────────── */}
      {modalField !== undefined && (
        <CustomFieldFormModal
          field={modalField}
          onClose={() => setModalField(undefined)}
          onSaved={handleSaved}
        />
      )}

      {/* ── Delete confirm ────────────────────────────────────────────────── */}
      {deleteTarget && (
        <ConfirmDialog
          title="Delete Custom Field"
          message={`"${deleteTarget.label}" will be permanently deleted along with all its values on existing records.`}
          confirmLabel={deleting ? "Deleting…" : "Delete Field"}
          variant="danger"
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}
