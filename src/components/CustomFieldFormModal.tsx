"use client";

import { useState } from "react";
import { toast } from "sonner";
import { CustomFieldDef, FieldEntity, FieldType } from "@/types";

function slugify(label: string): string {
  return label
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/^([0-9])/, "_$1");
}

interface CustomFieldFormModalProps {
  /** Pass an existing field to edit; null/undefined = create mode. */
  field?: CustomFieldDef | null;
  /** Pre-select the entity when opening from a specific module (create mode only). */
  defaultEntity?: FieldEntity;
  onClose: () => void;
  /** Called with the saved field after a successful create or edit. */
  onSaved: (field: CustomFieldDef) => void;
}

export default function CustomFieldFormModal({
  field,
  defaultEntity = "task",
  onClose,
  onSaved,
}: CustomFieldFormModalProps) {
  const isEdit = !!field;

  const [label, setLabel] = useState(field?.label ?? "");
  const [fieldKey, setFieldKey] = useState(field?.fieldKey ?? "");
  const [type, setType] = useState<FieldType>(field?.type ?? "text");
  const [entity, setEntity] = useState<FieldEntity>(field?.entity ?? defaultEntity);
  const [showInListView, setShowInListView] = useState(field?.showInListView ?? false);
  const [optionsRaw, setOptionsRaw] = useState(field?.options.join(", ") ?? "");
  const [required, setRequired] = useState(field?.required ?? false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  function handleLabelChange(val: string) {
    setLabel(val);
    if (!isEdit) setFieldKey(slugify(val));
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

    const options =
      type === "picklist"
        ? optionsRaw.split(",").map((o) => o.trim()).filter(Boolean)
        : [];

    const body = isEdit
      ? { label: label.trim(), options, required, showInListView }
      : { label: label.trim(), fieldKey, type, entity, showInListView, options, required };

    const url = isEdit
      ? `/api/admin/custom-fields/${field!.id}`
      : "/api/admin/custom-fields";

    try {
      const res = await fetch(url, {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();

      if (!res.ok) {
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
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5}
                  d={isEdit
                    ? "M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                    : "M12 4v16m8-8H4"}
                />
              </svg>
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 leading-tight">
                {isEdit ? "Edit Custom Field" : "Create Custom Field"}
              </h2>
              <p className="text-[11px] text-slate-400 font-medium">
                {isEdit
                  ? "Update label, options, or list visibility"
                  : "Define a new field for tasks or users"}
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
        <div className="p-6 space-y-4 overflow-y-auto max-h-[72vh]">

          {/* Entity — create only */}
          <div>
            <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">
              Apply To
              {isEdit && <span className="text-slate-300 font-normal normal-case ml-1">(immutable)</span>}
            </label>
            <div className="grid grid-cols-2 gap-2">
              {(["task", "user"] as FieldEntity[]).map((e) => (
                <button
                  key={e}
                  type="button"
                  disabled={isEdit}
                  onClick={() => !isEdit && setEntity(e)}
                  className={`flex items-center gap-2.5 px-4 py-3 rounded-xl border-2 text-sm font-semibold transition-all ${
                    entity === e
                      ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                      : "border-slate-200 bg-slate-50 text-slate-500 hover:border-slate-300"
                  } ${isEdit ? "opacity-60 cursor-not-allowed" : "cursor-pointer"}`}
                >
                  <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    {e === "task" ? (
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
                        d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                    ) : (
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
                        d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    )}
                  </svg>
                  {e === "task" ? "Tasks" : "Users"}
                </button>
              ))}
            </div>
          </div>

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
              className={`w-full border rounded-xl px-4 py-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent bg-slate-50 focus:bg-white transition-all placeholder-slate-400 ${
                errors.label ? "border-red-300" : "border-slate-200"
              }`}
            />
            {errors.label && <p className="mt-1 text-xs text-red-500">{errors.label}</p>}
          </div>

          {/* Field Key — create only */}
          <div>
            <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">
              Field Key
              {!isEdit && <span className="text-red-400 ml-1">*</span>}
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
            {errors.fieldKey
              ? <p className="mt-1 text-xs text-red-500">{errors.fieldKey}</p>
              : !isEdit && <p className="mt-1 text-[11px] text-slate-400">Auto-generated from label. Lowercase letters, numbers, underscores only.</p>}
          </div>

          {/* Type — create only */}
          <div>
            <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">
              Type
              {!isEdit && <span className="text-red-400 ml-1">*</span>}
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
                className={`w-full border rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent resize-none bg-slate-50 focus:bg-white transition-all placeholder-slate-400 ${
                  errors.options ? "border-red-300" : "border-slate-200"
                }`}
              />
              {errors.options
                ? <p className="mt-1 text-xs text-red-500">{errors.options}</p>
                : <p className="mt-1 text-[11px] text-slate-400">Comma-separated list of allowed values.</p>}
            </div>
          )}

          {/* Toggles */}
          <div className="space-y-3 pt-1">
            {/* Required */}
            <label className="flex items-center gap-3 cursor-pointer group">
              <div className="relative shrink-0">
                <input
                  type="checkbox"
                  checked={required}
                  onChange={(e) => setRequired(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-10 h-5 rounded-full bg-slate-200 peer-checked:bg-indigo-600 transition-colors" />
                <div className="absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform peer-checked:translate-x-5" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-700 group-hover:text-slate-900 transition-colors leading-none">
                  Required field
                </p>
                <p className="text-[11px] text-slate-400 mt-0.5">Records must provide a value for this field.</p>
              </div>
            </label>

            {/* Show in List View */}
            <label className="flex items-center gap-3 cursor-pointer group">
              <div className="relative shrink-0">
                <input
                  type="checkbox"
                  checked={showInListView}
                  onChange={(e) => setShowInListView(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-10 h-5 rounded-full bg-slate-200 peer-checked:bg-indigo-600 transition-colors" />
                <div className="absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform peer-checked:translate-x-5" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-700 group-hover:text-slate-900 transition-colors leading-none">
                  Show in List View
                </p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Adds a dedicated column to the {entity === "task" ? "Task Board" : "User Management"} list.
                </p>
              </div>
            </label>
          </div>
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
