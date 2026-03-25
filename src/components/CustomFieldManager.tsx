"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { CustomFieldDef, FieldType } from "@/types";
import ConfirmDialog from "./ConfirmDialog";

// ── Helpers ────────────────────────────────────────────────────────────────

function slugify(label: string): string {
  return label
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/^([0-9])/, "_$1");
}

// ── Field Form Modal ───────────────────────────────────────────────────────

interface FieldFormModalProps {
  field: CustomFieldDef | null; // null = create mode
  onClose: () => void;
  onSaved: (field: CustomFieldDef) => void;
}

function FieldFormModal({ field, onClose, onSaved }: FieldFormModalProps) {
  const isEdit = field !== null;

  const [label, setLabel] = useState(field?.label ?? "");
  const [fieldKey, setFieldKey] = useState(field?.fieldKey ?? "");
  const [type, setType] = useState<FieldType>(field?.type ?? "text");
  const [optionsRaw, setOptionsRaw] = useState(field?.options.join(", ") ?? "");
  const [required, setRequired] = useState(field?.required ?? false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Auto-generate fieldKey from label on create
  function handleLabelChange(val: string) {
    setLabel(val);
    if (!isEdit) {
      setFieldKey(slugify(val));
    }
  }

  function validate(): boolean {
    const e: Record<string, string> = {};
    if (!label.trim()) e.label = "Label is required.";
    if (!isEdit) {
      if (!fieldKey.trim()) e.fieldKey = "Field key is required.";
      else if (!/^[a-z][a-z0-9_]*$/.test(fieldKey))
        e.fieldKey = "Must start with a letter; only lowercase letters, numbers, underscores.";
    }
    if (type === "picklist") {
      const opts = optionsRaw.split(",").map((o) => o.trim()).filter(Boolean);
      if (opts.length === 0) e.options = "At least one option is required for picklist.";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit() {
    if (!validate()) return;
    setSaving(true);

    const options = type === "picklist"
      ? optionsRaw.split(",").map((o) => o.trim()).filter(Boolean)
      : [];

    const body = isEdit
      ? { label: label.trim(), options, required }
      : { label: label.trim(), fieldKey, type, options, required };

    const url = isEdit
      ? `/api/admin/custom-fields/${field!.id}`
      : "/api/admin/custom-fields";
    const method = isEdit ? "PATCH" : "POST";

    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();

      if (!res.ok) {
        // Map server-side validation errors
        if (data.errors) {
          const mapped: Record<string, string> = {};
          for (const [k, v] of Object.entries(data.errors)) {
            mapped[k] = (v as string[])[0];
          }
          setErrors(mapped);
        } else {
          toast.error(data.message || "Failed to save field.");
        }
        return;
      }

      toast.success(isEdit ? "Custom field updated." : "Custom field created.");
      onSaved(data.data.field as CustomFieldDef);
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white rounded-2xl shadow-[0_24px_80px_rgba(15,23,42,0.2)] w-full max-w-lg flex flex-col overflow-hidden animate-scale-in">
        {/* Accent bar */}
        <div className="h-1.5 w-full" style={{ background: "linear-gradient(90deg, #4f46e5, #7c3aed, #ec4899)" }} />

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center shadow-sm"
              style={{ background: "linear-gradient(135deg, #4f46e5, #7c3aed)" }}
            >
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d={isEdit ? "M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" : "M12 4v16m8-8H4"} />
              </svg>
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 leading-tight">
                {isEdit ? "Edit Custom Field" : "New Custom Field"}
              </h2>
              <p className="text-[11px] text-slate-400 font-medium">
                {isEdit ? "Update label, options, or required status" : "Define a new field for all tasks"}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Form */}
        <div className="p-6 space-y-4 overflow-y-auto max-h-[70vh]">
          {/* Label */}
          <div>
            <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">
              Label <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={label}
              onChange={(e) => handleLabelChange(e.target.value)}
              autoFocus
              placeholder="e.g. Story Points"
              className={`w-full border rounded-xl px-4 py-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent bg-slate-50 focus:bg-white transition-all placeholder-slate-400 ${errors.label ? "border-red-300" : "border-slate-200"}`}
            />
            {errors.label && <p className="mt-1 text-xs text-red-500">{errors.label}</p>}
          </div>

          {/* Field Key — only editable on create */}
          <div>
            <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">
              Field Key {!isEdit && <span className="text-red-400">*</span>}
              {isEdit && <span className="text-slate-300 font-normal normal-case ml-1">(immutable)</span>}
            </label>
            <input
              type="text"
              value={fieldKey}
              onChange={(e) => !isEdit && setFieldKey(e.target.value)}
              disabled={isEdit}
              placeholder="e.g. story_points"
              className={`w-full border rounded-xl px-4 py-3 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent transition-all placeholder-slate-400 ${
                isEdit ? "bg-slate-100 text-slate-400 cursor-not-allowed" : "bg-slate-50 focus:bg-white"
              } ${errors.fieldKey ? "border-red-300" : "border-slate-200"}`}
            />
            {errors.fieldKey && <p className="mt-1 text-xs text-red-500">{errors.fieldKey}</p>}
            {!isEdit && <p className="mt-1 text-[11px] text-slate-400">Auto-generated from label. Lowercase letters, numbers, underscores only.</p>}
          </div>

          {/* Type — only selectable on create */}
          <div>
            <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">
              Type {!isEdit && <span className="text-red-400">*</span>}
              {isEdit && <span className="text-slate-300 font-normal normal-case ml-1">(immutable)</span>}
            </label>
            <select
              value={type}
              onChange={(e) => !isEdit && setType(e.target.value as FieldType)}
              disabled={isEdit}
              className={`w-full border border-slate-200 rounded-xl px-3.5 py-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-400 transition-all ${
                isEdit ? "bg-slate-100 text-slate-400 cursor-not-allowed" : "bg-slate-50 focus:bg-white"
              }`}
            >
              <option value="text">Text</option>
              <option value="picklist">Picklist</option>
            </select>
          </div>

          {/* Options — picklist only */}
          {type === "picklist" && (
            <div>
              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">
                Options <span className="text-red-400">*</span>
              </label>
              <textarea
                value={optionsRaw}
                onChange={(e) => setOptionsRaw(e.target.value)}
                rows={3}
                placeholder="Option A, Option B, Option C"
                className={`w-full border rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent resize-none bg-slate-50 focus:bg-white transition-all placeholder-slate-400 ${errors.options ? "border-red-300" : "border-slate-200"}`}
              />
              {errors.options
                ? <p className="mt-1 text-xs text-red-500">{errors.options}</p>
                : <p className="mt-1 text-[11px] text-slate-400">Comma-separated list of allowed values.</p>}
            </div>
          )}

          {/* Required */}
          <label className="flex items-center gap-3 cursor-pointer group">
            <div className="relative">
              <input
                type="checkbox"
                checked={required}
                onChange={(e) => setRequired(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-10 h-5 rounded-full bg-slate-200 peer-checked:bg-indigo-600 transition-colors" />
              <div className="absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform peer-checked:translate-x-5" />
            </div>
            <span className="text-sm font-medium text-slate-700 group-hover:text-slate-900 transition-colors">
              Required field
            </span>
            <span className="text-xs text-slate-400">(tasks must fill this field)</span>
          </label>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50/80">
          <button
            onClick={onClose}
            className="px-5 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-200 rounded-xl transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
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
            ) : isEdit ? "Save Changes" : "Create Field"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Badge helpers ──────────────────────────────────────────────────────────

const TYPE_BADGE: Record<FieldType, string> = {
  text: "bg-blue-50 text-blue-700 border-blue-200",
  picklist: "bg-violet-50 text-violet-700 border-violet-200",
};

const TYPE_LABEL: Record<FieldType, string> = {
  text: "Text",
  picklist: "Picklist",
};

// ── CustomFieldManager ─────────────────────────────────────────────────────

export default function CustomFieldManager() {
  const [fields, setFields] = useState<CustomFieldDef[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalField, setModalField] = useState<CustomFieldDef | null | undefined>(undefined); // undefined = closed, null = create, object = edit
  const [deleteTarget, setDeleteTarget] = useState<CustomFieldDef | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function loadFields() {
    try {
      const res = await fetch("/api/admin/custom-fields");
      const data = await res.json();
      if (data.data?.fields) setFields(data.data.fields);
    } catch {
      toast.error("Failed to load custom fields.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadFields(); }, []);

  function handleSaved(saved: CustomFieldDef) {
    setFields((prev) => {
      const exists = prev.find((f) => f.id === saved.id);
      return exists
        ? prev.map((f) => (f.id === saved.id ? saved : f)).sort((a, b) => a.order - b.order)
        : [...prev, saved].sort((a, b) => a.order - b.order);
    });
    setModalField(undefined);
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/custom-fields/${deleteTarget.id}`, { method: "DELETE" });
      if (res.ok) {
        setFields((prev) => prev.filter((f) => f.id !== deleteTarget.id));
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
            Define extra fields that appear on every task.
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

        {loading ? (
          <div className="flex items-center justify-center py-20 text-slate-400 gap-3">
            <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Loading fields…
          </div>
        ) : fields.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4 text-slate-400">
            <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center">
              <svg className="w-7 h-7 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <div className="text-center">
              <p className="text-sm font-semibold text-slate-600">No custom fields yet</p>
              <p className="text-xs text-slate-400 mt-0.5">Click &ldquo;New Field&rdquo; to add your first one.</p>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[600px]">
              <thead>
                <tr className="border-b-2 border-slate-100 bg-gradient-to-b from-slate-50 to-white">
                  <th className="text-left px-5 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider w-10">#</th>
                  <th className="text-left px-4 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Label</th>
                  <th className="text-left px-4 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Field Key</th>
                  <th className="text-left px-4 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Type</th>
                  <th className="text-left px-4 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider hidden md:table-cell">Options</th>
                  <th className="text-left px-4 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Required</th>
                  <th className="text-right px-4 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {fields.map((field, idx) => (
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
                      <span className={`inline-flex items-center text-xs px-2.5 py-1 rounded-full font-semibold border ${TYPE_BADGE[field.type]}`}>
                        {TYPE_LABEL[field.type]}
                      </span>
                    </td>
                    <td className="px-4 py-4 hidden md:table-cell">
                      {field.type === "picklist" && field.options.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {field.options.slice(0, 4).map((opt) => (
                            <span key={opt} className="text-[11px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
                              {opt}
                            </span>
                          ))}
                          {field.options.length > 4 && (
                            <span className="text-[11px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">
                              +{field.options.length - 4} more
                            </span>
                          )}
                        </div>
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
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => setDeleteTarget(field)}
                          title="Delete field"
                          className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
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
        <FieldFormModal
          field={modalField}
          onClose={() => setModalField(undefined)}
          onSaved={handleSaved}
        />
      )}

      {/* Delete confirm */}
      {deleteTarget && (
        <ConfirmDialog
          title="Delete Custom Field"
          message={`"${deleteTarget.label}" will be permanently deleted along with all its values on existing tasks.`}
          confirmLabel={deleting ? "Deleting…" : "Delete Field"}
          variant="danger"
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}
