"use client";

import { useRef, useState } from "react";
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

interface OptionRow {
  localId: string;
  /** null = newly added in this session, string = original value from DB */
  original: string | null;
  value: string;
}

interface PendingConfirm {
  valuesCleared: number;
  // Resolved body to send after confirmation
  body: Record<string, unknown>;
}

interface CustomFieldFormModalProps {
  field?: CustomFieldDef | null;
  defaultEntity?: FieldEntity;
  onClose: () => void;
  onSaved: (field: CustomFieldDef) => void;
}

let _uid = 0;
function uid() { return String(++_uid); }

export default function CustomFieldFormModal({
  field,
  defaultEntity = "task",
  onClose,
  onSaved,
}: CustomFieldFormModalProps) {
  const isEdit = !!field;

  // ── Core field state ──────────────────────────────────────────────────────
  const [label, setLabel] = useState(field?.label ?? "");
  const [fieldKey, setFieldKey] = useState(field?.fieldKey ?? "");
  const [type, setType] = useState<FieldType>(field?.type ?? "text");
  const [entity, setEntity] = useState<FieldEntity>(field?.entity ?? defaultEntity);
  const [showInListView, setShowInListView] = useState(field?.showInListView ?? false);
  const [required, setRequired] = useState(field?.required ?? false);

  // ── Options (create: comma-separated textarea; edit: per-row with rename tracking) ──
  const [optionsRaw, setOptionsRaw] = useState(field?.options.join(", ") ?? "");
  const [optionRows, setOptionRows] = useState<OptionRow[]>(() =>
    (field?.options ?? []).map((o) => ({ localId: uid(), original: o, value: o }))
  );

  // ── UI state ──────────────────────────────────────────────────────────────
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pendingConfirm, setPendingConfirm] = useState<PendingConfirm | null>(null);
  const newOptionInputRef = useRef<HTMLInputElement>(null);

  // ── Derived flags ─────────────────────────────────────────────────────────
  const fieldKeyChanged = isEdit && fieldKey !== field!.fieldKey;
  const typeChanged = isEdit && type !== field!.type;

  // ── Option row helpers ────────────────────────────────────────────────────
  function addOption() {
    setOptionRows((prev) => [...prev, { localId: uid(), original: null, value: "" }]);
    setTimeout(() => newOptionInputRef.current?.focus(), 0);
  }

  function updateOption(localId: string, value: string) {
    setOptionRows((prev) => prev.map((r) => (r.localId === localId ? { ...r, value } : r)));
  }

  function removeOption(localId: string) {
    setOptionRows((prev) => prev.filter((r) => r.localId !== localId));
  }

  function moveOption(localId: string, direction: "up" | "down") {
    setOptionRows((prev) => {
      const idx = prev.findIndex((r) => r.localId === localId);
      if (idx === -1) return prev;
      if (direction === "up" && idx === 0) return prev;
      if (direction === "down" && idx === prev.length - 1) return prev;
      const next = [...prev];
      const target = direction === "up" ? idx - 1 : idx + 1;
      [next[idx], next[target]] = [next[target], next[idx]];
      return next;
    });
  }

  // ── Compute renames + removed (edit + picklist) ───────────────────────────
  function computeRenames(): Record<string, string> {
    const renames: Record<string, string> = {};
    for (const row of optionRows) {
      if (row.original !== null && row.value.trim() && row.value.trim() !== row.original) {
        renames[row.original] = row.value.trim();
      }
    }
    return renames;
  }

  function computeRemovedOptions(finalOptions: string[], renames: Record<string, string>): string[] {
    return (field?.options ?? []).filter(
      (o) => !Object.keys(renames).includes(o) && !finalOptions.includes(o)
    );
  }

  // ── Label → auto-slug (create mode only) ─────────────────────────────────
  function handleLabelChange(val: string) {
    setLabel(val);
    if (!isEdit) setFieldKey(slugify(val));
  }

  // ── Type change in edit mode ──────────────────────────────────────────────
  function handleTypeChange(newType: FieldType) {
    setType(newType);
    if (newType === "picklist" && optionRows.length === 0) {
      setOptionRows([{ localId: uid(), original: null, value: "" }]);
    }
  }

  // ── Validation ────────────────────────────────────────────────────────────
  function validate(): boolean {
    const e: Record<string, string> = {};

    if (!label.trim()) e.label = "Label is required.";

    // fieldKey validation (create always, edit when changed)
    if (!isEdit || fieldKeyChanged) {
      if (!fieldKey.trim()) e.fieldKey = "Field key is required.";
      else if (!/^[a-z][a-z0-9_]*$/.test(fieldKey.trim()))
        e.fieldKey = "Must start with a letter; only lowercase letters, numbers, underscores.";
    }

    // Options validation
    if (type === "picklist") {
      if (isEdit) {
        const valid = optionRows.map((r) => r.value.trim()).filter(Boolean);
        if (valid.length === 0) e.options = "At least one option is required.";
      } else {
        const opts = optionsRaw.split(",").map((o) => o.trim()).filter(Boolean);
        if (opts.length === 0) e.options = "At least one option is required for picklist.";
      }
    }

    setErrors(e);
    return Object.keys(e).length === 0;
  }

  // ── Build PATCH/POST body ─────────────────────────────────────────────────
  function buildBody(): Record<string, unknown> {
    if (!isEdit) {
      const options = type === "picklist"
        ? optionsRaw.split(",").map((o) => o.trim()).filter(Boolean)
        : [];
      return { label: label.trim(), fieldKey: fieldKey.trim(), type, entity, showInListView, options, required };
    }

    const finalOptions = optionRows.map((r) => r.value.trim()).filter(Boolean);
    const renames = computeRenames();

    const body: Record<string, unknown> = { label: label.trim(), required, showInListView };
    if (fieldKeyChanged) body.fieldKey = fieldKey.trim();
    if (typeChanged) body.type = type;
    if (type === "picklist") {
      body.options = finalOptions;
      if (Object.keys(renames).length > 0) body.renames = renames;
    }
    return body;
  }

  // ── Detect destructive changes + fetch impact ─────────────────────────────
  async function checkImpact(body: Record<string, unknown>): Promise<number> {
    if (!isEdit) return 0;

    // picklist → text is always safe: values are preserved as free text, nothing deleted
    if (typeChanged && type === "text") return 0;

    const finalOptions = (body.options as string[] | undefined) ?? [];
    const renames = (body.renames as Record<string, string> | undefined) ?? {};
    const removedOptions = computeRemovedOptions(finalOptions, renames);

    const isTypeToPick = typeChanged && type === "picklist";
    const hasRemovals = removedOptions.length > 0;
    if (!isTypeToPick && !hasRemovals) return 0;

    const params = new URLSearchParams();
    if (isTypeToPick) params.set("newType", "picklist");
    if (finalOptions.length) params.set("options", finalOptions.join(","));
    if (removedOptions.length) params.set("removed", removedOptions.join(","));

    const res = await fetch(`/api/admin/custom-fields/${field!.id}/impact?${params}`);
    if (!res.ok) return 0;
    const data = await res.json();
    return data.data?.valuesCleared ?? 0;
  }

  // ── Submit ────────────────────────────────────────────────────────────────
  async function handleSubmit(confirmedBody?: Record<string, unknown>) {
    const body = confirmedBody ?? buildBody();
    if (!confirmedBody && !validate()) return;

    setSaving(true);
    try {
      // Check for destructive impact (skip if this is a confirmed re-submit).
      // Early return here must NOT clear pendingConfirm — we're about to set it.
      if (!confirmedBody) {
        const valuesCleared = await checkImpact(body);
        if (valuesCleared > 0) {
          setPendingConfirm({ valuesCleared, body });
          setSaving(false);
          return;
        }
      }

      const url = isEdit ? `/api/admin/custom-fields/${field!.id}` : "/api/admin/custom-fields";
      const res = await fetch(url, {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();

      if (!res.ok) {
        setPendingConfirm(null);
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

      // Show migration summary if values were affected
      const cleared: number = data.data?.valuesCleared ?? 0;
      const migrated: number = data.data?.valuesMigrated ?? 0;
      let successMsg = isEdit ? "Custom field updated." : "Custom field created.";
      if (cleared > 0) successMsg += ` ${cleared} value${cleared !== 1 ? "s" : ""} cleared.`;
      if (migrated > 0) successMsg += ` ${migrated} value${migrated !== 1 ? "s" : ""} migrated.`;
      toast.success(successMsg);

      setPendingConfirm(null);
      onSaved(data.data.field as CustomFieldDef);
    } catch {
      setPendingConfirm(null);
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
                  ? "Edit label, key, type, options, or visibility"
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

          {/* Entity — always immutable in edit */}
          <div>
            <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">
              Apply To
              {isEdit && (
                <span className="ml-2 text-[10px] font-semibold text-slate-300 normal-case tracking-normal">
                  Cannot be changed — delete and recreate to switch entity
                </span>
              )}
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

          {/* Field Key — now editable in edit mode with warning */}
          <div>
            <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">
              Field Key {!isEdit && <span className="text-red-400">*</span>}
            </label>
            <input
              type="text"
              value={fieldKey}
              onChange={(e) => setFieldKey(e.target.value)}
              placeholder="e.g. story_points"
              className={`w-full border rounded-xl px-4 py-3 text-sm font-mono focus:outline-none focus:ring-2 transition-all placeholder-slate-400 bg-slate-50 focus:bg-white ${
                fieldKeyChanged
                  ? "border-amber-300 focus:ring-amber-400"
                  : errors.fieldKey
                  ? "border-red-300 focus:ring-red-400"
                  : "border-slate-200 focus:ring-indigo-400"
              }`}
            />
            {errors.fieldKey ? (
              <p className="mt-1 text-xs text-red-500">{errors.fieldKey}</p>
            ) : isEdit && fieldKeyChanged ? (
              <p className="mt-1 text-xs text-amber-600 flex items-center gap-1">
                <svg className="w-3 h-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                </svg>
                Renaming the key may break external API consumers that reference it by name. Stored values are unaffected.
              </p>
            ) : !isEdit ? (
              <p className="mt-1 text-[11px] text-slate-400">Auto-generated from label. Lowercase letters, numbers, underscores only.</p>
            ) : null}
          </div>

          {/* Type — now editable in edit mode */}
          <div>
            <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">
              Type {!isEdit && <span className="text-red-400">*</span>}
            </label>
            <select
              value={type}
              onChange={(e) => isEdit ? handleTypeChange(e.target.value as FieldType) : setType(e.target.value as FieldType)}
              className={`w-full border rounded-xl px-3.5 py-3 text-sm font-medium focus:outline-none focus:ring-2 transition-all bg-slate-50 focus:bg-white ${
                typeChanged
                  ? "border-amber-300 focus:ring-amber-400"
                  : "border-slate-200 focus:ring-indigo-400"
              }`}
            >
              <option value="text">Text</option>
              <option value="picklist">Picklist</option>
            </select>
            {typeChanged && type === "picklist" && (
              <p className="mt-1 text-xs text-amber-600 flex items-center gap-1">
                <svg className="w-3 h-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                </svg>
                Existing text values that don&apos;t match the new options will be permanently deleted.
              </p>
            )}
            {typeChanged && type === "text" && (
              <p className="mt-1 text-xs text-blue-600 flex items-center gap-1">
                <svg className="w-3 h-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Existing picklist values will be preserved as free text. No data loss.
              </p>
            )}
          </div>

          {/* Options */}
          {type === "picklist" && (
            <div>
              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">
                Options <span className="text-red-400">*</span>
              </label>

              {isEdit ? (
                /* Edit mode: per-row with rename tracking */
                <div className="space-y-1.5">
                  {optionRows.map((row, idx) => {
                    const isRenamed = row.original !== null && row.value.trim() !== row.original;
                    const isEmpty = !row.value.trim();
                    const isFirst = idx === 0;
                    const isLast = idx === optionRows.length - 1;
                    return (
                      <div key={row.localId} className="flex items-center gap-2 group">
                        <span className="text-[11px] text-slate-300 w-5 text-right shrink-0">{idx + 1}.</span>
                        <input
                          type="text"
                          value={row.value}
                          onChange={(e) => updateOption(row.localId, e.target.value)}
                          placeholder="Option name"
                          ref={idx === optionRows.length - 1 && row.original === null ? newOptionInputRef : undefined}
                          className={`flex-1 border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 transition-all ${
                            isEmpty
                              ? "border-red-200 bg-red-50 focus:ring-red-300"
                              : isRenamed
                              ? "border-amber-300 bg-amber-50 focus:ring-amber-400"
                              : "border-slate-200 bg-slate-50 focus:bg-white focus:ring-indigo-400"
                          }`}
                        />
                        {isRenamed && (
                          <span className="text-[10px] font-bold text-amber-600 bg-amber-100 px-1.5 py-0.5 rounded-full shrink-0">
                            rename
                          </span>
                        )}
                        {/* Move up / down */}
                        <div className="flex flex-col opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                          <button
                            type="button"
                            onClick={() => moveOption(row.localId, "up")}
                            disabled={isFirst}
                            title="Move up"
                            className="p-0.5 text-slate-300 hover:text-indigo-500 disabled:opacity-0 disabled:pointer-events-none rounded transition-colors"
                          >
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 15l7-7 7 7" />
                            </svg>
                          </button>
                          <button
                            type="button"
                            onClick={() => moveOption(row.localId, "down")}
                            disabled={isLast}
                            title="Move down"
                            className="p-0.5 text-slate-300 hover:text-indigo-500 disabled:opacity-0 disabled:pointer-events-none rounded transition-colors"
                          >
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                            </svg>
                          </button>
                        </div>
                        {/* Remove */}
                        <button
                          type="button"
                          onClick={() => removeOption(row.localId)}
                          title="Remove option"
                          className="opacity-0 group-hover:opacity-100 p-1 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all shrink-0"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    );
                  })}
                  <button
                    type="button"
                    onClick={addOption}
                    className="flex items-center gap-1.5 text-xs font-semibold text-indigo-500 hover:text-indigo-700 hover:bg-indigo-50 px-2 py-1.5 rounded-lg transition-colors mt-1"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                    </svg>
                    Add option
                  </button>
                  {errors.options && <p className="mt-1 text-xs text-red-500">{errors.options}</p>}
                  <p className="mt-1 text-[11px] text-slate-400">
                    Edit a name to rename it (existing values migrate automatically after confirmation).
                    Removing a row deletes its stored values.
                  </p>
                </div>
              ) : (
                /* Create mode: simple comma-separated textarea */
                <div>
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
            </div>
          )}

          {/* Toggles */}
          <div className="space-y-3 pt-1">
            <label className="flex items-center gap-3 cursor-pointer group">
              <div className="relative shrink-0">
                <input type="checkbox" checked={required} onChange={(e) => setRequired(e.target.checked)} className="sr-only peer" />
                <div className="w-10 h-5 rounded-full bg-slate-200 peer-checked:bg-indigo-600 transition-colors" />
                <div className="absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform peer-checked:translate-x-5" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-700 group-hover:text-slate-900 transition-colors leading-none">Required field</p>
                <p className="text-[11px] text-slate-400 mt-0.5">Records must provide a value for this field.</p>
              </div>
            </label>

            <label className="flex items-center gap-3 cursor-pointer group">
              <div className="relative shrink-0">
                <input type="checkbox" checked={showInListView} onChange={(e) => setShowInListView(e.target.checked)} className="sr-only peer" />
                <div className="w-10 h-5 rounded-full bg-slate-200 peer-checked:bg-indigo-600 transition-colors" />
                <div className="absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform peer-checked:translate-x-5" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-700 group-hover:text-slate-900 transition-colors leading-none">Show in List View</p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Adds a dedicated column to the {entity === "task" ? "Task Board" : "User Management"} list.
                </p>
              </div>
            </label>
          </div>

          {/* Confirmation dialog — shown inline when destructive changes detected */}
          {pendingConfirm && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 space-y-3">
              <div className="flex items-start gap-2.5">
                <svg className="w-5 h-5 text-red-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                </svg>
                <div>
                  <p className="text-sm font-bold text-red-800">
                    {pendingConfirm.valuesCleared === 1
                      ? "1 stored value will be permanently deleted."
                      : `${pendingConfirm.valuesCleared} stored values will be permanently deleted.`}
                  </p>
                  <p className="text-xs text-red-600 mt-1">
                    This cannot be undone. Renamed options will auto-migrate their values; removed options and type-incompatible values will be cleared.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setPendingConfirm(null)}
                  className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-red-100 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => handleSubmit(pendingConfirm.body)}
                  disabled={saving}
                  className="px-5 py-2 text-sm font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl transition-colors disabled:opacity-50"
                >
                  {saving ? "Saving…" : "Yes, proceed"}
                </button>
              </div>
            </div>
          )}
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
            onClick={() => handleSubmit()}
            disabled={saving || !!pendingConfirm}
            className="px-6 py-2.5 text-sm font-bold text-white rounded-xl transition-all shadow-sm hover:shadow-md active:scale-[0.97] disabled:opacity-50 flex items-center gap-2"
            style={{ background: "linear-gradient(135deg, #4f46e5, #7c3aed)" }}
          >
            {saving && !pendingConfirm ? (
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
