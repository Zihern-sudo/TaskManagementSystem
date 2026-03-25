"use client";

import { useState } from "react";
import { toast } from "sonner";
import { CustomFieldDef, FieldType } from "@/types";
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

const ENTITY_BADGE = {
  task: "bg-indigo-50 text-indigo-700 border-indigo-200",
  user: "bg-teal-50 text-teal-700 border-teal-200",
};

const ENTITY_LABEL = {
  task: "Tasks",
  user: "Users",
};

// ── CustomFieldManager ─────────────────────────────────────────────────────

export default function CustomFieldManager() {
  const { allFields, refresh } = useCustomFields();
  const [modalField, setModalField] = useState<CustomFieldDef | null | undefined>(undefined);
  const [deleteTarget, setDeleteTarget] = useState<CustomFieldDef | null>(null);
  const [deleting, setDeleting] = useState(false);

  function handleSaved(saved: CustomFieldDef) {
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

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Custom Fields</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Define extra fields that appear on tasks or user profiles.
          </p>
        </div>
        <button
          onClick={() => setModalField(null)}
          className="flex items-center gap-1.5 px-4 py-2 text-sm font-bold text-white rounded-xl shadow-sm hover:shadow-md active:scale-[0.97] transition-all"
          style={{ background: "linear-gradient(135deg, #4f46e5, #7c3aed)" }}
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
          </svg>
          New Field
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="h-1" style={{ background: "linear-gradient(90deg, #4f46e5, #7c3aed, #a855f7)" }} />

        {allFields.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4 text-slate-400">
            <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center">
              <svg className="w-7 h-7 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <div className="text-center">
              <p className="text-sm font-semibold text-slate-600">No custom fields yet</p>
              <p className="text-xs text-slate-400 mt-0.5">Click &ldquo;New Field&rdquo; to add your first one.</p>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[700px]">
              <thead>
                <tr className="border-b-2 border-slate-100 bg-gradient-to-b from-slate-50 to-white">
                  <th className="text-left px-5 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider w-10">#</th>
                  <th className="text-left px-4 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Label</th>
                  <th className="text-left px-4 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Key</th>
                  <th className="text-left px-4 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Apply To</th>
                  <th className="text-left px-4 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Type</th>
                  <th className="text-left px-4 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider hidden md:table-cell">Options</th>
                  <th className="text-left px-4 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">In List</th>
                  <th className="text-left px-4 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Required</th>
                  <th className="text-right px-4 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {allFields.map((field, idx) => (
                  <tr key={field.id} className="hover:bg-indigo-50/30 transition-colors group">
                    <td className="px-5 py-4 text-slate-300 text-xs font-mono">{idx + 1}</td>
                    <td className="px-4 py-4">
                      <span className="font-semibold text-slate-800">{field.label}</span>
                    </td>
                    <td className="px-4 py-4">
                      <code className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md font-mono">
                        {field.fieldKey}
                      </code>
                    </td>
                    <td className="px-4 py-4">
                      <span className={`inline-flex items-center text-xs px-2.5 py-1 rounded-full font-semibold border ${ENTITY_BADGE[field.entity]}`}>
                        {ENTITY_LABEL[field.entity]}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <span className={`inline-flex items-center text-xs px-2.5 py-1 rounded-full font-semibold border ${TYPE_BADGE[field.type]}`}>
                        {TYPE_LABEL[field.type]}
                      </span>
                    </td>
                    <td className="px-4 py-4 hidden md:table-cell">
                      {field.type === "picklist" && field.options.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {field.options.slice(0, 3).map((opt) => (
                            <span key={opt} className="text-[11px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
                              {opt}
                            </span>
                          ))}
                          {field.options.length > 3 && (
                            <span className="text-[11px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">
                              +{field.options.length - 3}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-300 text-xs">—</span>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      {field.showInListView ? (
                        <svg className="w-4 h-4 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                        </svg>
                      ) : (
                        <span className="text-slate-300 text-xs">—</span>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      {field.required ? (
                        <span className="inline-flex items-center gap-1 text-xs text-green-700 font-semibold bg-green-50 border border-green-200 px-2.5 py-1 rounded-full">
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                          </svg>
                          Yes
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400">No</span>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center justify-end gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
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

      {/* Create / Edit modal */}
      {modalField !== undefined && (
        <CustomFieldFormModal
          field={modalField}
          onClose={() => setModalField(undefined)}
          onSaved={handleSaved}
        />
      )}

      {/* Delete confirm */}
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
